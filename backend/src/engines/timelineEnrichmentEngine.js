// ============================================
// Court Access — Timeline Enrichment Engine
// Phase 116: Evidence Intelligence Engine v1
//
// Extends Phase 115 timeline engine with:
// - Automatic event detection from documents
// - Transcript-based event extraction
// - Chronological case event storage
// ============================================

import prisma from '../services/prismaClient.js';

// ---------------------------------------------------------------------------
// Event Detection Patterns
// ---------------------------------------------------------------------------

const EVENT_PATTERNS = [
  // Arrest events
  { pattern: /\b(?:arrested|taken into custody|handcuffed|detained|apprehended)\b/gi, type: 'arrest' },
  // Filing events
  { pattern: /\b(?:filed|submitted|entered|recorded|docketed)\s+(?:a\s+)?(?:complaint|motion|petition|report|charges?)\b/gi, type: 'filing' },
  // Hearing events
  { pattern: /\b(?:hearing|arraignment|trial|sentencing|conference|deposition|proceeding)\b/gi, type: 'hearing' },
  // Evidence events
  { pattern: /\b(?:seized|collected|recovered|found|discovered|obtained)\s+(?:evidence|weapon|drugs?|contraband|firearm)\b/gi, type: 'evidence' },
  // Incident events
  { pattern: /\b(?:incident|accident|assault|robbery|burglary|theft|homicide|shooting)\s+(?:occurred|happened|took place|reported)\b/gi, type: 'incident' },
  // Testimony events
  { pattern: /\b(?:testified|stated|declared|swore|affirmed|deposed)\b/gi, type: 'testimony' },
  // Miranda / rights
  { pattern: /\b(?:Miranda\s+rights?|right to (?:remain silent|an attorney)|advised of (?:rights|charges))\b/gi, type: 'rights_advisory' },
  // Search/warrant
  { pattern: /\b(?:search\s+warrant|warrant\s+(?:executed|served|issued)|searched\s+(?:the|a)\s+\w+)\b/gi, type: 'search' },
];

const DATE_EXTRACTION = [
  // ISO format: 2025-01-12
  { pattern: /\b(\d{4}-\d{2}-\d{2})\b/g, parse: (m) => new Date(m) },
  // US format: 01/12/2025 or 1/12/2025
  { pattern: /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g, parse: (m, d1, d2, d3) => new Date(`${d3}-${d1.padStart(2, '0')}-${d2.padStart(2, '0')}`) },
  // Long format: January 12, 2025
  { pattern: /\b((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})\b/gi, parse: (m) => new Date(m) },
  // Short format: Jan 12 2025
  { pattern: /\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{1,2},?\s+\d{4})\b/gi, parse: (m) => new Date(m) },
];

// ---------------------------------------------------------------------------
// Core Enrichment Functions
// ---------------------------------------------------------------------------

/**
 * Extract chronological events from document text and store as CaseEvents.
 *
 * @param {string} caseId
 * @param {string} documentId
 * @param {string} text - Full document text
 * @returns {object} { events: [...], count: number }
 */
export async function enrichTimelineFromDocument(caseId, documentId, text) {
  if (!text || typeof text !== 'string') return { events: [], count: 0 };

  console.log(`[TimelineEnrich] Enriching timeline from document ${documentId}`);

  const lines = text.split('\n');
  const events = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Try to extract a date from this line or nearby context
    const date = extractDateFromContext(line, lines, i);

    // Check for event patterns
    for (const { pattern, type } of EVENT_PATTERNS) {
      const regex = new RegExp(pattern.source, pattern.flags);
      if (regex.test(line)) {
        events.push({
          caseId,
          timestamp: date || new Date(),
          eventType: type,
          sourceDocumentId: documentId,
          description: line.substring(0, 500).trim(),
          confidence: date ? 0.8 : 0.5, // Higher confidence if we found a date
          metadata: { lineIndex: i, hasDate: !!date },
        });
        break; // One event per line
      }
    }
  }

  // Store events in database
  if (events.length > 0) {
    try {
      await prisma.caseEvent.createMany({
        data: events,
        skipDuplicates: true,
      });
      console.log(`[TimelineEnrich] Stored ${events.length} events from document ${documentId}`);
    } catch (err) {
      console.error(`[TimelineEnrich] Failed to store events: ${err.message}`);
    }
  }

  return { events, count: events.length };
}

/**
 * Extract chronological events from parsed transcript segments.
 *
 * @param {string} caseId
 * @param {string} transcriptId
 * @param {Array} segments - Parsed transcript segments [{ speaker, dialogue, timestamp, lineNumber }]
 */
export async function enrichTimelineFromTranscript(caseId, transcriptId, segments) {
  if (!segments || segments.length === 0) return { events: [], count: 0 };

  console.log(`[TimelineEnrich] Enriching timeline from transcript ${transcriptId} (${segments.length} segments)`);

  const events = [];

  for (const segment of segments) {
    const text = segment.dialogue || '';
    const date = segment.timestamp ? new Date(segment.timestamp) : extractDateFromText(text);

    for (const { pattern, type } of EVENT_PATTERNS) {
      const regex = new RegExp(pattern.source, pattern.flags);
      if (regex.test(text)) {
        events.push({
          caseId,
          timestamp: date || new Date(),
          eventType: type,
          sourceDocumentId: transcriptId,
          description: `${segment.speaker || 'Unknown'}: ${text.substring(0, 400).trim()}`,
          confidence: date ? 0.75 : 0.45,
          metadata: {
            speaker: segment.speaker,
            lineNumber: segment.lineNumber,
            source: 'transcript',
          },
        });
        break;
      }
    }
  }

  if (events.length > 0) {
    try {
      await prisma.caseEvent.createMany({
        data: events,
        skipDuplicates: true,
      });
    } catch (err) {
      console.error(`[TimelineEnrich] Failed to store transcript events: ${err.message}`);
    }
  }

  return { events, count: events.length };
}

/**
 * Get full enriched timeline for a case, sorted chronologically.
 */
export async function getEnrichedTimeline(caseId) {
  const events = await prisma.caseEvent.findMany({
    where: { caseId },
    orderBy: { timestamp: 'asc' },
  });

  return {
    caseId,
    events,
    count: events.length,
    dateRange: events.length > 0 ? {
      earliest: events[0].timestamp,
      latest: events[events.length - 1].timestamp,
    } : null,
  };
}

// ---------------------------------------------------------------------------
// Date Extraction Helpers
// ---------------------------------------------------------------------------

function extractDateFromContext(line, lines, lineIndex) {
  // First try the current line
  let date = extractDateFromText(line);
  if (date) return date;

  // Try the previous 3 lines
  for (let i = Math.max(0, lineIndex - 3); i < lineIndex; i++) {
    date = extractDateFromText(lines[i]);
    if (date) return date;
  }

  return null;
}

function extractDateFromText(text) {
  for (const { pattern, parse } of DATE_EXTRACTION) {
    const regex = new RegExp(pattern.source, pattern.flags);
    const match = regex.exec(text);
    if (match) {
      try {
        const date = parse(...match);
        if (date && !isNaN(date.getTime()) && date.getFullYear() > 1990 && date.getFullYear() < 2040) {
          return date;
        }
      } catch {
        // Skip invalid dates
      }
    }
  }
  return null;
}
