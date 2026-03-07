// ============================================
// Court Access — Phase 53: Cross-Evidence Correlation Engine
// Automatically compares extracted information across all
// evidence in a case to detect contradictions, matches,
// and timeline mismatches.
// ============================================

import { config } from '../config/index.js';
import prisma from './prismaClient.js';
import { captureException } from './errorMonitoring.js';

/**
 * Run correlation analysis across all evidence in a case.
 * Compares: transcripts, documents, timeline events, entities.
 *
 * @param {string} caseId
 * @returns {Promise<{correlations: Array, count: number}>}
 */
export async function runCorrelationAnalysis(caseId) {
  console.log(`[CorrelationEngine] Starting analysis for case=${caseId}`);

  try {
    // Gather all evidence sources
    const [transcripts, timelineEvents, entities, evidence] = await Promise.all([
      prisma.mediaTranscript.findMany({
        where: { caseId, fullTranscript: true, status: 'complete' },
      }),
      prisma.timelineEvent.findMany({
        where: { caseId },
        orderBy: { timestamp: 'asc' },
      }),
      prisma.entity.findMany({
        where: { caseId },
        include: { links: true },
      }),
      prisma.evidenceRecord.findMany({
        where: { caseId, status: 'complete' },
      }),
    ]);

    const newCorrelations = [];

    // 1. Timeline mismatch detection
    const timelineMismatches = detectTimelineMismatches(timelineEvents, transcripts);
    newCorrelations.push(...timelineMismatches);

    // 2. Entity cross-reference matching
    const entityMatches = detectEntityCrossReferences(entities, evidence);
    newCorrelations.push(...entityMatches);

    // 3. Statement contradiction detection (AI-powered if available)
    if (config.openaiApiKey && transcripts.length >= 2) {
      const contradictions = await detectStatementContradictions(caseId, transcripts, evidence);
      newCorrelations.push(...contradictions);
    }

    // 4. Event confirmation detection
    const confirmations = detectEventConfirmations(timelineEvents, transcripts);
    newCorrelations.push(...confirmations);

    // Persist correlations
    const created = [];
    for (const corr of newCorrelations) {
      try {
        const record = await prisma.evidenceCorrelation.create({
          data: {
            caseId,
            sourceEvidenceId: corr.sourceEvidenceId,
            relatedEvidenceId: corr.relatedEvidenceId,
            correlationType: corr.correlationType,
            confidenceScore: corr.confidenceScore,
            description: corr.description,
            sourceSnippet: corr.sourceSnippet || '',
            relatedSnippet: corr.relatedSnippet || '',
            metadata: corr.metadata || {},
          },
        });
        created.push(record);
      } catch (dbErr) {
        // Skip duplicates
        if (!dbErr.message?.includes('Unique constraint')) {
          console.warn('[CorrelationEngine] DB insert failed:', dbErr.message);
        }
      }
    }

    console.log(`[CorrelationEngine] Analysis complete: ${created.length} correlations found for case=${caseId}`);

    return { correlations: created, count: created.length };
  } catch (err) {
    console.error(`[CorrelationEngine] Analysis failed for case=${caseId}:`, err.message);
    captureException(err, { caseId });
    throw err;
  }
}

/**
 * Detect timeline mismatches between events from different sources.
 */
function detectTimelineMismatches(timelineEvents, transcripts) {
  const mismatches = [];

  // Group timeline events by description similarity
  for (let i = 0; i < timelineEvents.length; i++) {
    for (let j = i + 1; j < timelineEvents.length; j++) {
      const a = timelineEvents[i];
      const b = timelineEvents[j];

      // Skip if same source
      if (a.sourceEvidenceId === b.sourceEvidenceId) continue;
      if (!a.sourceEvidenceId || !b.sourceEvidenceId) continue;

      // Check if events reference similar content but have different timestamps
      const similarity = textSimilarity(a.eventDescription, b.eventDescription);
      if (similarity > 0.6) {
        const timeDiffHours = Math.abs(
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        ) / (1000 * 60 * 60);

        // Flag if same event described with >2 hour time difference
        if (timeDiffHours > 2) {
          mismatches.push({
            sourceEvidenceId: a.sourceEvidenceId,
            relatedEvidenceId: b.sourceEvidenceId,
            correlationType: 'timeline_mismatch',
            confidenceScore: Math.min(similarity, 0.95),
            description: `Timeline discrepancy: "${a.eventDescription}" dated ${formatDate(a.timestamp)} vs "${b.eventDescription}" dated ${formatDate(b.timestamp)} — ${Math.round(timeDiffHours)} hour difference from different sources.`,
            sourceSnippet: `${formatDate(a.timestamp)}: ${a.eventDescription}`,
            relatedSnippet: `${formatDate(b.timestamp)}: ${b.eventDescription}`,
            metadata: { timeDiffHours: Math.round(timeDiffHours), similarity },
          });
        }
      }
    }
  }

  return mismatches;
}

/**
 * Detect entity cross-references across evidence items.
 */
function detectEntityCrossReferences(entities, evidence) {
  const matches = [];
  const evidenceMap = new Map(evidence.map((e) => [e.id, e]));

  for (const entity of entities) {
    if (entity.links.length < 2) continue;

    // Entity appears in multiple evidence items
    const linkedEvidence = entity.links
      .map((l) => l.evidenceId)
      .filter((id) => evidenceMap.has(id));

    for (let i = 0; i < linkedEvidence.length; i++) {
      for (let j = i + 1; j < linkedEvidence.length; j++) {
        const srcEvidence = evidenceMap.get(linkedEvidence[i]);
        const relEvidence = evidenceMap.get(linkedEvidence[j]);
        if (!srcEvidence || !relEvidence) continue;

        matches.push({
          sourceEvidenceId: linkedEvidence[i],
          relatedEvidenceId: linkedEvidence[j],
          correlationType: 'entity_reference_match',
          confidenceScore: 0.85,
          description: `${entity.entityType} "${entity.entityValue}" appears in both "${srcEvidence.filename}" and "${relEvidence.filename}".`,
          sourceSnippet: `${entity.entityType}: ${entity.entityValue}`,
          relatedSnippet: `${entity.entityType}: ${entity.entityValue}`,
          metadata: { entityType: entity.entityType, entityValue: entity.entityValue },
        });
      }
    }
  }

  return matches;
}

/**
 * Use AI to detect statement contradictions across transcripts.
 */
async function detectStatementContradictions(caseId, transcripts, evidence) {
  try {
    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey: config.openaiApiKey });

    const evidenceMap = new Map(evidence.map((e) => [e.id, e]));

    // Build context from transcripts (limit to avoid token overflow)
    const transcriptSummaries = transcripts.slice(0, 5).map((t, i) => {
      const ev = evidenceMap.get(t.evidenceId);
      const text = t.transcriptText.substring(0, 2000);
      return `Source ${i + 1} (${ev?.filename || t.evidenceId}):\n${text}`;
    }).join('\n\n---\n\n');

    const prompt = `You are a legal evidence analyst. Compare the following transcript excerpts from different evidence sources in the same case. Identify any contradictions, conflicting statements, or inconsistencies between the sources.

${transcriptSummaries}

Respond with valid JSON only:
{
  "contradictions": [
    {
      "sourceIndex": 0,
      "relatedIndex": 1,
      "description": "Description of the contradiction",
      "sourceQuote": "Relevant quote from source",
      "relatedQuote": "Conflicting quote from related source",
      "confidence": 0.8
    }
  ]
}

If no contradictions are found, return: {"contradictions": []}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 2000,
      temperature: 0.2,
    });

    const result = JSON.parse(response.choices[0].message.content);
    const contradictions = [];

    for (const c of (result.contradictions || [])) {
      const srcTranscript = transcripts[c.sourceIndex];
      const relTranscript = transcripts[c.relatedIndex];
      if (!srcTranscript || !relTranscript) continue;

      contradictions.push({
        sourceEvidenceId: srcTranscript.evidenceId,
        relatedEvidenceId: relTranscript.evidenceId,
        correlationType: 'statement_contradiction',
        confidenceScore: c.confidence || 0.7,
        description: c.description,
        sourceSnippet: c.sourceQuote || '',
        relatedSnippet: c.relatedQuote || '',
        metadata: { aiDetected: true, model: 'gpt-4o-mini' },
      });
    }

    return contradictions;
  } catch (err) {
    console.warn('[CorrelationEngine] AI contradiction detection failed:', err.message);
    return [];
  }
}

/**
 * Detect events confirmed across multiple sources.
 */
function detectEventConfirmations(timelineEvents, transcripts) {
  const confirmations = [];

  for (const event of timelineEvents) {
    if (!event.sourceEvidenceId) continue;

    // Check if transcript text mentions event keywords
    const keywords = extractKeywords(event.eventDescription);
    if (keywords.length === 0) continue;

    for (const transcript of transcripts) {
      if (transcript.evidenceId === event.sourceEvidenceId) continue;

      const matchCount = keywords.filter((kw) =>
        transcript.transcriptText.toLowerCase().includes(kw.toLowerCase())
      ).length;

      const matchRatio = matchCount / keywords.length;

      if (matchRatio > 0.5) {
        confirmations.push({
          sourceEvidenceId: event.sourceEvidenceId,
          relatedEvidenceId: transcript.evidenceId,
          correlationType: 'event_confirmation',
          confidenceScore: Math.min(matchRatio, 0.95),
          description: `Event "${event.eventDescription}" is corroborated by transcript from evidence ${transcript.evidenceId} — ${matchCount}/${keywords.length} key terms confirmed.`,
          sourceSnippet: event.eventDescription,
          relatedSnippet: extractMatchContext(transcript.transcriptText, keywords[0]),
          metadata: { matchRatio, matchedKeywords: matchCount },
        });
      }
    }
  }

  return confirmations;
}

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

/**
 * Simple text similarity using Jaccard index on word sets.
 */
function textSimilarity(a, b) {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }

  return intersection / (wordsA.size + wordsB.size - intersection);
}

function extractKeywords(text) {
  const stopWords = new Set(['the', 'and', 'was', 'were', 'that', 'this', 'with', 'from', 'have', 'has', 'had', 'been', 'being', 'will', 'would', 'could', 'should', 'their', 'there', 'then', 'than', 'about', 'into', 'over', 'after', 'before']);
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stopWords.has(w))
    .slice(0, 10);
}

function extractMatchContext(text, keyword) {
  const idx = text.toLowerCase().indexOf(keyword.toLowerCase());
  if (idx === -1) return text.substring(0, 200);
  const start = Math.max(0, idx - 100);
  const end = Math.min(text.length, idx + keyword.length + 100);
  return (start > 0 ? '...' : '') + text.substring(start, end) + (end < text.length ? '...' : '');
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
