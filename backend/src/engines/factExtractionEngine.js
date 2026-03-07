// ============================================
// Court Access — Fact Extraction Engine
// Phase 123: Raw Fact Extraction
// Phase B: Fact Extraction Pipeline
//
// Extracts objective factual statements from documents,
// transcripts, police reports, GPS records, phone logs.
// Entities: PERSON, LOCATION, DATE, TIME, EVENT, OBJECT, ACTION
// ============================================

import prisma from '../services/prismaClient.js';

// ---------------------------------------------------------------------------
// Entity Types
// ---------------------------------------------------------------------------

export const FACT_TYPES = {
  PERSON: 'PERSON',
  LOCATION: 'LOCATION',
  DATE: 'DATE',
  TIME: 'TIME',
  EVENT: 'EVENT',
  OBJECT: 'OBJECT',
  ACTION: 'ACTION',
};

// ---------------------------------------------------------------------------
// Extraction Patterns
// ---------------------------------------------------------------------------

const PERSON_PATTERNS = [
  /(?:Officer|Detective|Sergeant|Lieutenant|Captain|Deputy|Agent)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g,
  /(?:Mr\.|Mrs\.|Ms\.|Dr\.)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g,
  /(?:Witness|Victim|Suspect|Defendant|Plaintiff)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g,
  /(?:witness|victim|suspect)\s+(?:identified\s+as\s+)?([A-Z][a-z]+\s+[A-Z][a-z]+)/g,
];

const LOCATION_PATTERNS = [
  /(\d+\s+[A-Z][a-zA-Z]+(?:\s+(?:Street|St|Avenue|Ave|Boulevard|Blvd|Drive|Dr|Road|Rd|Lane|Ln|Way|Court|Ct|Place|Pl|Circle|Cir))\.?(?:\s*,?\s*(?:Apt|Suite|Unit|#)\s*\d+)?)/g,
  /(?:at|near|on|intersection\s+of)\s+([A-Z][a-zA-Z]+\s+(?:and|&)\s+[A-Z][a-zA-Z]+)/g,
  /(\d+\s+(?:block|Block)\s+(?:of\s+)?[A-Z][a-zA-Z]+\s+(?:Street|St|Avenue|Ave|Blvd|Dr|Rd))/g,
];

const TIME_PATTERNS = [
  /(?:at|around|approximately|approx\.?)\s+(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm|a\.m\.|p\.m\.))/g,
  /(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))/g,
  /(\d{4}\s*(?:hours|hrs|h))/g,
];

const DATE_PATTERNS = [
  /(?:on|dated?)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/g,
  /(?:on|dated?)\s+((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})/gi,
  /(\d{4}-\d{2}-\d{2})/g,
];

const EVENT_PATTERNS = [
  /(?:observed|witnessed|saw|noticed|heard)\s+(.{10,80}?)(?:\.|,|$)/gi,
  /(?:suspect|defendant|victim)\s+((?:was|were)\s+.{10,80}?)(?:\.|,|$)/gi,
  /(?:incident|event|occurrence)\s+(?:occurred|happened|took place)\s+(.{10,80}?)(?:\.|,|$)/gi,
];

const OBJECT_PATTERNS = [
  /(?:firearm|weapon|gun|knife|vehicle|car|phone|cellphone|bag|backpack|container)\b/gi,
  /(?:recovered|seized|found|confiscated)\s+(?:a\s+)?(.{5,50}?)(?:\.|,|\s+from|\s+at|$)/gi,
];

// ---------------------------------------------------------------------------
// Main Extraction Function
// ---------------------------------------------------------------------------

/**
 * Extract facts from document text content.
 *
 * @param {object} params
 * @param {string} params.caseId
 * @param {string} params.documentId - source evidence ID
 * @param {string} params.text - document text content
 * @param {string} [params.sourceType] - transcript, police_report, gps_log, etc.
 * @param {number} [params.page]
 * @param {string} [params.speaker]
 * @returns {object} { facts: ExtractedFact[], summary: {...} }
 */
export async function extractFacts({ caseId, documentId, text, sourceType = '', page = null, speaker = '' }) {
  console.log(`[FactExtraction] Extracting facts from document ${documentId} for case ${caseId}`);

  const facts = [];

  // Extract each entity type
  facts.push(...extractByPattern(text, PERSON_PATTERNS, FACT_TYPES.PERSON, { caseId, documentId, sourceType, page, speaker }));
  facts.push(...extractByPattern(text, LOCATION_PATTERNS, FACT_TYPES.LOCATION, { caseId, documentId, sourceType, page, speaker }));
  facts.push(...extractByPattern(text, TIME_PATTERNS, FACT_TYPES.TIME, { caseId, documentId, sourceType, page, speaker }));
  facts.push(...extractByPattern(text, DATE_PATTERNS, FACT_TYPES.DATE, { caseId, documentId, sourceType, page, speaker }));
  facts.push(...extractByPattern(text, EVENT_PATTERNS, FACT_TYPES.EVENT, { caseId, documentId, sourceType, page, speaker }));
  facts.push(...extractByPattern(text, OBJECT_PATTERNS, FACT_TYPES.OBJECT, { caseId, documentId, sourceType, page, speaker }));

  // Store extracted facts
  const stored = [];
  for (const fact of facts) {
    try {
      const record = await prisma.extractedFact.create({ data: fact });
      stored.push(record);
    } catch (err) {
      // Skip duplicates
      if (!err.message.includes('Unique constraint')) {
        console.warn(`[FactExtraction] Failed to store fact: ${err.message}`);
      }
    }
  }

  console.log(`[FactExtraction] Extracted ${stored.length} facts from document ${documentId}`);

  return {
    facts: stored,
    summary: {
      total: stored.length,
      byType: countByType(stored),
    },
  };
}

// ---------------------------------------------------------------------------
// Pattern-Based Extraction Helper
// ---------------------------------------------------------------------------

function extractByPattern(text, patterns, factType, context) {
  const facts = [];
  const seen = new Set();

  for (const pattern of patterns) {
    // Reset regex lastIndex
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;

    while ((match = regex.exec(text)) !== null) {
      const value = (match[1] || match[0]).trim();
      const normalized = value.toLowerCase().replace(/\s+/g, ' ');

      if (seen.has(normalized) || value.length < 2) continue;
      seen.add(normalized);

      // Calculate line number from position
      const textBefore = text.substring(0, match.index);
      const lineNumber = (textBefore.match(/\n/g) || []).length + 1;

      facts.push({
        caseId: context.caseId,
        factType,
        statementText: value,
        normalizedValue: normalized,
        confidenceScore: calculateConfidence(factType, value, text),
        documentId: context.documentId,
        sourceType: context.sourceType,
        page: context.page,
        line: lineNumber,
        speaker: context.speaker,
        metadata: {
          matchIndex: match.index,
          context: text.substring(Math.max(0, match.index - 50), Math.min(text.length, match.index + value.length + 50)),
        },
      });
    }
  }

  return facts;
}

// ---------------------------------------------------------------------------
// Confidence Scoring
// ---------------------------------------------------------------------------

function calculateConfidence(factType, value, fullText) {
  let confidence = 0.5;

  // Higher confidence for specific entity types
  if (factType === FACT_TYPES.TIME || factType === FACT_TYPES.DATE) {
    confidence = 0.85; // Timestamps/dates are highly reliable from regex
  } else if (factType === FACT_TYPES.PERSON) {
    confidence = 0.7;
    // Boost if person appears multiple times
    const count = (fullText.match(new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')) || []).length;
    if (count >= 3) confidence = 0.85;
  } else if (factType === FACT_TYPES.LOCATION) {
    confidence = 0.75;
  } else if (factType === FACT_TYPES.EVENT) {
    confidence = 0.6;
  }

  return Math.round(confidence * 100) / 100;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function countByType(facts) {
  const counts = {};
  for (const f of facts) {
    const type = f.factType || f.data?.factType;
    counts[type] = (counts[type] || 0) + 1;
  }
  return counts;
}

/**
 * Get all extracted facts for a case.
 */
export async function getCaseFacts(caseId, factType = null) {
  const where = { caseId };
  if (factType) where.factType = factType;

  return prisma.extractedFact.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get facts by document.
 */
export async function getDocumentFacts(documentId) {
  return prisma.extractedFact.findMany({
    where: { documentId },
    orderBy: { createdAt: 'desc' },
  });
}
