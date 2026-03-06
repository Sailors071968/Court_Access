// ============================================
// Court Access — Phase C/55: AI Case Narrative API
// Generate and retrieve structured case narratives.
// Phase 55: Integrates correlations, policy findings,
// and transcripts into narrative generation.
// ============================================

import express from 'express';
import prisma from '../services/prismaClient.js';
import { config } from '../config/index.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Phase 94: All narrative routes require authentication
router.use(authenticate);

// Phase 60: Legal safeguard disclaimer for all AI-generated content
const AI_DISCLAIMER = 'This analysis is automated and intended for investigative assistance only. It does not constitute legal advice, definitive conclusions, or expert opinion. All findings should be independently verified by qualified professionals before use in legal proceedings.';

// ---------------------------------------------------------------------------
// GET /api/narrative/:caseId — Get latest narrative for a case
// ---------------------------------------------------------------------------

router.get('/:caseId', async (req, res) => {
  try {
    const { caseId } = req.params;

    const narrative = await prisma.caseNarrative.findFirst({
      where: { caseId },
      orderBy: { generatedTimestamp: 'desc' },
    });

    if (!narrative) {
      return res.json({ narrative: null, message: 'No narrative generated yet' });
    }

    res.json({ narrative, disclaimer: AI_DISCLAIMER });
  } catch (err) {
    console.error('[Narrative] Get error:', err.message);
    res.status(500).json({ error: 'Failed to fetch narrative' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/narrative/:caseId/history — Get all narratives for a case
// ---------------------------------------------------------------------------

router.get('/:caseId/history', async (req, res) => {
  try {
    const { caseId } = req.params;

    const narratives = await prisma.caseNarrative.findMany({
      where: { caseId },
      orderBy: { generatedTimestamp: 'desc' },
      take: 10,
    });

    res.json({ narratives, count: narratives.length });
  } catch (err) {
    console.error('[Narrative] History error:', err.message);
    res.status(500).json({ error: 'Failed to fetch narrative history' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/narrative/:caseId/generate — Generate a new narrative
// ---------------------------------------------------------------------------

router.post('/:caseId/generate', async (req, res) => {
  try {
    const { caseId } = req.params;

    // Gather all intelligence sources (Phase 55: integrated intelligence)
    const [timelineEvents, entities, correlations, policyFindings, transcripts] = await Promise.all([
      prisma.timelineEvent.findMany({
        where: { caseId },
        orderBy: { timestamp: 'asc' },
        take: 100,
      }),
      prisma.entity.findMany({
        where: { caseId },
        include: { links: true },
      }),
      prisma.evidenceCorrelation.findMany({
        where: { caseId, status: { not: 'dismissed' } },
        orderBy: { confidenceScore: 'desc' },
        take: 20,
      }),
      prisma.policyComplianceFinding.findMany({
        where: { caseId, status: { not: 'dismissed' } },
        orderBy: { severity: 'desc' },
        take: 20,
      }),
      prisma.mediaTranscript.findMany({
        where: { caseId, fullTranscript: true, status: 'complete' },
        take: 10,
      }),
    ]);

    // Build context for narrative generation
    const timelineSummary = timelineEvents.map((e) =>
      `[${e.timestamp.toISOString().split('T')[0]}] ${e.eventDescription} (${e.sourceType}, confidence: ${e.confidenceScore})`
    ).join('\n');

    const entitySummary = entities.map((e) =>
      `${e.entityType}: ${e.entityValue} (linked to ${e.links.length} evidence items)`
    ).join('\n');

    // Phase 55: Additional intelligence context
    const correlationSummary = correlations.map((c) =>
      `[${c.correlationType}] ${c.description} (confidence: ${c.confidenceScore})`
    ).join('\n');

    const policySummary = policyFindings.map((f) =>
      `[${f.severity}] ${f.description} (section: ${f.policySection})`
    ).join('\n');

    const transcriptSummary = transcripts.map((t) =>
      `Transcript (${t.evidenceId}): ${t.transcriptText.substring(0, 300)}...`
    ).join('\n');

    // Generate narrative using OpenAI if available, otherwise deterministic
    let summaryText = '';
    let keyEvents = [];
    let conflictsDetected = [];
    let participants = [];
    let modelVersion = 'deterministic-v1';

    if (config.openaiApiKey) {
      try {
        const { default: OpenAI } = await import('openai');
        const openai = new OpenAI({ apiKey: config.openaiApiKey });

        const prompt = `You are a legal case analyst. Generate a structured case narrative from the following evidence data.

Timeline Events:
${timelineSummary || 'No timeline events recorded yet.'}

Detected Entities:
${entitySummary || 'No entities detected yet.'}

Evidence Correlations:
${correlationSummary || 'No cross-evidence correlations detected yet.'}

Policy Compliance Findings:
${policySummary || 'No policy compliance findings yet.'}

Media Transcript Excerpts:
${transcriptSummary || 'No media transcripts available yet.'}

Generate a JSON response with:
1. "summary": A concise narrative overview of the case (2-4 paragraphs), incorporating correlation findings and policy deviations where relevant
2. "keyEvents": Array of the 5 most significant events with date and description
3. "conflicts": Array of any detected contradictions or conflicts between evidence (include cross-evidence correlations)
4. "participants": Array of key people/organizations involved with their roles
5. "policyDeviations": Array of any identified policy compliance issues with severity and description
6. "timelineInconsistencies": Array of timeline mismatches found across evidence sources
7. "evidenceConflicts": Array of statement contradictions or conflicting evidence
8. "keySupportingEvidence": Array of strongest corroborating evidence pairs`;

        const completion = await openai.chat.completions.create({
          model: 'gpt-4',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          max_tokens: 2000,
        });

        const parsed = JSON.parse(completion.choices[0].message.content);
        summaryText = parsed.summary || '';
        keyEvents = parsed.keyEvents || [];
        conflictsDetected = parsed.conflicts || [];
        participants = parsed.participants || [];
        modelVersion = 'gpt-4';
      } catch (aiErr) {
        console.warn('[Narrative] OpenAI generation failed, using deterministic fallback:', aiErr.message);
      }
    }

    // Deterministic fallback
    if (!summaryText) {
      const eventCount = timelineEvents.length;
      const entityCount = entities.length;
      const personEntities = entities.filter((e) => e.entityType === 'person');
      const locationEntities = entities.filter((e) => e.entityType === 'location');

      summaryText = `Case analysis based on ${eventCount} timeline events, ${entityCount} detected entities, ${correlations.length} evidence correlations, and ${policyFindings.length} policy compliance findings. `;

      if (personEntities.length > 0) {
        summaryText += `Key individuals identified: ${personEntities.map((e) => e.entityValue).join(', ')}. `;
      }

      if (locationEntities.length > 0) {
        summaryText += `Relevant locations: ${locationEntities.map((e) => e.entityValue).join(', ')}. `;
      }

      if (eventCount > 0) {
        const first = timelineEvents[0];
        const last = timelineEvents[eventCount - 1];
        summaryText += `Events span from ${first.timestamp.toISOString().split('T')[0]} to ${last.timestamp.toISOString().split('T')[0]}. `;
      }

      // Phase 55: Include correlations and policy findings in deterministic output
      if (correlations.length > 0) {
        const contradictions = correlations.filter((c) => c.correlationType === 'statement_contradiction');
        const mismatches = correlations.filter((c) => c.correlationType === 'timeline_mismatch');
        if (contradictions.length > 0) {
          summaryText += `${contradictions.length} statement contradiction(s) detected across evidence sources. `;
        }
        if (mismatches.length > 0) {
          summaryText += `${mismatches.length} timeline mismatch(es) identified between sources. `;
        }
      }

      if (policyFindings.length > 0) {
        const critical = policyFindings.filter((f) => f.severity === 'critical' || f.severity === 'high');
        summaryText += `${policyFindings.length} policy compliance finding(s) identified${critical.length > 0 ? `, including ${critical.length} high/critical severity` : ''}. `;
      }

      if (transcripts.length > 0) {
        summaryText += `${transcripts.length} media transcript(s) analyzed. `;
      }

      keyEvents = timelineEvents.slice(0, 5).map((e) => ({
        date: e.timestamp.toISOString().split('T')[0],
        description: e.eventDescription,
        type: e.eventType,
      }));

      // Phase 55: Deterministic conflicts from correlations
      conflictsDetected = correlations
        .filter((c) => c.correlationType === 'statement_contradiction' || c.correlationType === 'timeline_mismatch')
        .map((c) => ({
          type: c.correlationType,
          description: c.description,
          confidence: c.confidenceScore,
        }));

      participants = personEntities.map((e) => ({
        name: e.entityValue,
        role: 'mentioned in evidence',
        evidenceCount: e.links.length,
      }));

      modelVersion = 'deterministic-v2';
    }

    const narrative = await prisma.caseNarrative.create({
      data: {
        caseId,
        summaryText,
        keyEvents,
        conflictsDetected,
        participants,
        modelVersion,
      },
    });

    console.log(JSON.stringify({
      event: 'narrative_generated',
      caseId,
      modelVersion,
      timelineEventsUsed: timelineEvents.length,
      entitiesUsed: entities.length,
      timestamp: new Date().toISOString(),
    }));

    res.status(201).json({ narrative, disclaimer: AI_DISCLAIMER });
  } catch (err) {
    console.error('[Narrative] Generate error:', err.message);
    res.status(500).json({ error: 'Failed to generate narrative' });
  }
});

export default router;
