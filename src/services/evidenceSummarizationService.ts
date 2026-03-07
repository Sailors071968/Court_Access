// ============================================
// Court Access — Evidence Summarization Service (AI Evidence Intelligence Phase 8)
// AI-generated summaries for each evidence item.
//
// Summary types:
//   - Document summary
//   - Audio conversation summary
//   - Video content summary
//   - Image description
//
// Integration point for AI summarization API.
// ============================================

import type {
  EvidenceSummary,
  MentionedEntity,
  SummaryGenerationInput,
  SummaryGenerationResult,
} from '../models/EvidenceSummaryModel';

// ---------------------------------------------------------------------------
// Entity Extraction — Deterministic Pattern Matching
// ---------------------------------------------------------------------------

/**
 * Extract mentioned entities from text using pattern matching.
 * This is a deterministic extraction — no AI model involved.
 *
 * In production, this will be augmented with NER (Named Entity Recognition).
 */
export function extractMentionedEntities(text: string): MentionedEntity[] {
  const entities: MentionedEntity[] = [];
  const entityMap = new Map<string, MentionedEntity>();

  // Date patterns
  const datePattern = /\b(\d{1,2}\/\d{1,2}\/\d{2,4}|\w+\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2})\b/g;
  const dateMatches = text.match(datePattern) ?? [];
  for (const match of dateMatches) {
    const key = `date:${match}`;
    const existing = entityMap.get(key);
    if (existing) {
      existing.occurrenceCount++;
    } else {
      entityMap.set(key, { name: match, type: 'date', occurrenceCount: 1 });
    }
  }

  // Legal term patterns
  const legalTerms = [
    'plaintiff', 'defendant', 'witness', 'testimony', 'evidence',
    'motion', 'hearing', 'trial', 'verdict', 'sentence', 'appeal',
    'objection', 'sustained', 'overruled', 'counsel', 'prosecution',
    'defense', 'jury', 'subpoena', 'deposition', 'affidavit',
    'warrant', 'arraignment', 'bail', 'indictment', 'plea',
    'felony', 'misdemeanor', 'statute', 'jurisdiction',
  ];
  for (const term of legalTerms) {
    const regex = new RegExp(`\\b${term}\\b`, 'gi');
    const matches = text.match(regex);
    if (matches && matches.length > 0) {
      entityMap.set(`legal:${term}`, {
        name: term,
        type: 'legal_term',
        occurrenceCount: matches.length,
      });
    }
  }

  // Capitalized proper nouns (potential person/organization names)
  const properNounPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g;
  const nameMatches = text.match(properNounPattern) ?? [];
  for (const match of nameMatches) {
    // Skip common non-name capitalized phrases
    const skipPhrases = ['The Court', 'United States', 'Your Honor', 'The State'];
    if (skipPhrases.some((p) => match.includes(p))) continue;

    const key = `person:${match.toLowerCase()}`;
    const existing = entityMap.get(key);
    if (existing) {
      existing.occurrenceCount++;
    } else {
      entityMap.set(key, { name: match, type: 'person', occurrenceCount: 1 });
    }
  }

  for (const entity of entityMap.values()) {
    entities.push(entity);
  }

  // Sort by occurrence count (descending)
  entities.sort((a, b) => b.occurrenceCount - a.occurrenceCount);

  return entities;
}

// ---------------------------------------------------------------------------
// Key Points Extraction — Deterministic
// ---------------------------------------------------------------------------

/**
 * Extract key points from text by identifying sentences with important markers.
 * Deterministic — same input always produces same output.
 *
 * In production, this will be augmented with AI summarization.
 */
export function extractKeyPoints(text: string, maxPoints: number = 5): string[] {
  const sentences = text.split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length > 20);

  // Score sentences by importance markers
  const importanceMarkers = [
    'stated', 'confirmed', 'denied', 'testified', 'claimed',
    'agreed', 'objected', 'found', 'determined', 'concluded',
    'evidence shows', 'according to', 'on the record',
    'key finding', 'important', 'critical', 'significant',
  ];

  const scored = sentences.map((sentence, sentenceIndex) => {
    let score = 0;
    const lower = sentence.toLowerCase();
    for (const marker of importanceMarkers) {
      if (lower.includes(marker)) score += 1;
    }
    // Boost sentences near the beginning
    if (sentenceIndex < 3) score += 1;
    return { sentence, score };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, maxPoints).map((s) => s.sentence);
}

// ---------------------------------------------------------------------------
// Summary Generation — Integration Point
// ---------------------------------------------------------------------------

/**
 * Generate a summary for evidence content.
 *
 * In production, this calls an AI summarization API (e.g. OpenAI, Anthropic).
 * For now, uses deterministic extraction as a baseline.
 */
export async function generateEvidenceSummary(
  input: SummaryGenerationInput
): Promise<SummaryGenerationResult> {
  try {
    const summaryId = `es-${input.evidenceId.replace('ev-', '')}`;

    // Extract key points and entities deterministically
    const keyPoints = extractKeyPoints(input.textContent);
    const mentionedEntities = extractMentionedEntities(input.textContent);

    // Build summary text (in production, this comes from AI API)
    const summaryText = keyPoints.length > 0
      ? keyPoints.join('. ') + '.'
      : `Evidence content: ${input.textContent.slice(0, 200)}${input.textContent.length > 200 ? '...' : ''}`;

    const summary: EvidenceSummary = {
      summaryId,
      evidenceId: input.evidenceId,
      caseId: input.caseId,
      tenantId: input.tenantId,
      summaryText,
      summaryType: input.summaryType,
      keyPoints,
      mentionedEntities,
      wordCount: input.textContent.split(/\s+/).length,
      generatedTimestamp: new Date().toISOString(),
      modelVersion: 'deterministic-v1',
    };

    return {
      success: true,
      summary,
      error: null,
    };
  } catch (err) {
    return {
      success: false,
      summary: null,
      error: err instanceof Error ? err.message : 'Summary generation failed',
    };
  }
}
