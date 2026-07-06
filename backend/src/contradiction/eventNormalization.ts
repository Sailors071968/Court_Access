// ============================================================================
// Event Normalization Layer
// Central normalization function through which ALL event creation must pass.
// Validates event types, normalizes timestamps/actors/locations, attaches
// ontology metadata.
// ============================================================================

import type { ExtractedEvent } from './types.ts';
import { isValidEventType, getEventType } from './eventOntology.ts';

// ---------------------------------------------------------------------------
// Actor Label Normalization
// ---------------------------------------------------------------------------

const ACTOR_ALIASES: Record<string, string> = {
  'ofc': 'Officer',
  'ofc.': 'Officer',
  'off': 'Officer',
  'off.': 'Officer',
  'officer': 'Officer',
  'ofcr': 'Officer',
  'deputy': 'Deputy',
  'dep': 'Deputy',
  'dep.': 'Deputy',
  'det': 'Detective',
  'det.': 'Detective',
  'detective': 'Detective',
  'sgt': 'Sergeant',
  'sgt.': 'Sergeant',
  'sergeant': 'Sergeant',
  'lt': 'Lieutenant',
  'lt.': 'Lieutenant',
  'lieutenant': 'Lieutenant',
  'cpl': 'Corporal',
  'cpl.': 'Corporal',
  'corporal': 'Corporal',
  'capt': 'Captain',
  'capt.': 'Captain',
  'captain': 'Captain',
  'dispatcher': 'Dispatcher',
  'disp': 'Dispatcher',
  'paramedic': 'Paramedic',
  'emt': 'EMT',
  'witness': 'Witness',
  'suspect': 'Suspect',
  'subject': 'Suspect',
  'defendant': 'Defendant',
  'victim': 'Victim',
};

/**
 * Normalize an actor label to a canonical form.
 * - Trims whitespace
 * - Normalizes rank abbreviations
 * - Title-cases names
 */
function normalizeActorLabel(actor: string): string {
  if (!actor) return actor;

  const trimmed = actor.trim();
  const parts = trimmed.split(/\s+/);

  if (parts.length === 0) return trimmed;

  // Check if first part is a rank abbreviation
  const firstLower = parts[0].toLowerCase();
  const normalizedRank = ACTOR_ALIASES[firstLower];

  if (normalizedRank && parts.length > 1) {
    // Replace abbreviation with full rank, keep name parts title-cased
    return [normalizedRank, ...parts.slice(1).map(titleCase)].join(' ');
  }

  // If entire string is an alias, return the canonical form
  const fullLower = trimmed.toLowerCase();
  if (ACTOR_ALIASES[fullLower]) {
    return ACTOR_ALIASES[fullLower];
  }

  return parts.map(titleCase).join(' ');
}

function titleCase(s: string): string {
  if (s.length === 0) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

// ---------------------------------------------------------------------------
// Location Normalization
// ---------------------------------------------------------------------------

/**
 * Normalize location references.
 * - Trims whitespace
 * - Normalizes common abbreviations
 * - Lowercases for consistency, then title-cases
 */
function normalizeLocation(location: string | null): string | null {
  if (!location) return null;

  let normalized = location.trim();
  if (!normalized) return null;

  // Common abbreviations
  const abbrevs: Record<string, string> = {
    'st': 'Street',
    'st.': 'Street',
    'ave': 'Avenue',
    'ave.': 'Avenue',
    'blvd': 'Boulevard',
    'blvd.': 'Boulevard',
    'dr': 'Drive',
    'dr.': 'Drive',
    'rd': 'Road',
    'rd.': 'Road',
    'ln': 'Lane',
    'ln.': 'Lane',
    'ct': 'Court',
    'ct.': 'Court',
    'pl': 'Place',
    'pl.': 'Place',
    'hwy': 'Highway',
    'fwy': 'Freeway',
    'pkwy': 'Parkway',
    'n': 'North',
    'n.': 'North',
    's': 'South',
    's.': 'South',
    'e': 'East',
    'e.': 'East',
    'w': 'West',
    'w.': 'West',
  };

  const parts = normalized.split(/\s+/);
  normalized = parts
    .map((part) => {
      const lower = part.toLowerCase();
      return abbrevs[lower] ?? titleCase(part);
    })
    .join(' ');

  return normalized;
}

// ---------------------------------------------------------------------------
// Timestamp Normalization
// ---------------------------------------------------------------------------

/**
 * Normalize a timestamp to ISO 8601 format if possible.
 */
function normalizeTimestamp(ts: string | null): string | null {
  if (!ts) return null;

  const trimmed = ts.trim();
  if (!trimmed) return null;

  // Already ISO?
  const isoDate = new Date(trimmed);
  if (!isNaN(isoDate.getTime())) {
    return isoDate.toISOString();
  }

  // 24-hour: 14:30:00 or 14:30
  const match24 = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (match24) {
    const h = match24[1].padStart(2, '0');
    const m = match24[2];
    const s = (match24[3] ?? '00').padStart(2, '0');
    return `1970-01-01T${h}:${m}:${s}Z`;
  }

  // Military: 1430 or 1430 hrs
  const matchMil = trimmed.match(/^(\d{4})\s*(?:hrs?)?$/i);
  if (matchMil) {
    const h = matchMil[1].slice(0, 2);
    const m = matchMil[1].slice(2, 4);
    return `1970-01-01T${h}:${m}:00Z`;
  }

  // 12-hour: 2:30 PM
  const match12 = trimmed.match(
    /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM|a\.m\.|p\.m\.)/i,
  );
  if (match12) {
    let h = parseInt(match12[1], 10);
    const m = match12[2];
    const s = (match12[3] ?? '00').padStart(2, '0');
    const isPM = /pm|p\.m\./i.test(match12[4]);
    if (isPM && h < 12) h += 12;
    if (!isPM && h === 12) h = 0;
    return `1970-01-01T${String(h).padStart(2, '0')}:${m}:${s}Z`;
  }

  return trimmed; // Return as-is if unrecognized
}

// ---------------------------------------------------------------------------
// Public API — normalizeEvent()
// ---------------------------------------------------------------------------

export interface NormalizationResult {
  event: ExtractedEvent;
  warnings: string[];
  valid: boolean;
}

/**
 * Central event normalization function.
 * ALL event creation must pass through this function.
 *
 * Responsibilities:
 * 1. Validate event_type against the ontology
 * 2. Normalize timestamps to ISO 8601
 * 3. Normalize actor labels (rank abbreviations, casing)
 * 4. Normalize location references (abbreviations, casing)
 * 5. Attach ontology metadata (set sourceConfidence, sourceTextSpan)
 * 6. Mark event as normalized
 */
export function normalizeEvent(event: ExtractedEvent): NormalizationResult {
  const warnings: string[] = [];
  const normalized = { ...event };

  // 1. Validate event type
  if (!isValidEventType(normalized.eventType)) {
    warnings.push(
      `Unknown event type: ${normalized.eventType}. Event will be preserved but may not match doctrine rules.`,
    );
  }

  // 2. Normalize timestamps
  const originalTimestamp = normalized.timestamp;
  normalized.sourceTimestamp = originalTimestamp;
  normalized.timestamp = normalizeTimestamp(originalTimestamp);

  // 3. Normalize actor labels
  normalized.actor = normalizeActorLabel(normalized.actor);

  // 4. Normalize location references
  normalized.location = normalizeLocation(normalized.location);

  // 5. Populate traceability fields if not set
  if (normalized.sourceTextSpan === undefined || normalized.sourceTextSpan === null) {
    normalized.sourceTextSpan = normalized.rawText;
  }
  if (normalized.sourceConfidence === undefined || normalized.sourceConfidence === 0) {
    normalized.sourceConfidence = normalized.confidence;
  }

  // 6. Attach ontology metadata — enrich confidence with event weight
  const eventDef = getEventType(normalized.eventType);
  if (eventDef) {
    // Adjust confidence slightly based on event weight when source confidence is uncertain
    const weightFactor = eventDef.eventWeight;
    // Keep original confidence but note the event weight is available for scoring
    normalized.confidence = Math.min(
      1.0,
      normalized.confidence * (0.9 + 0.1 * weightFactor),
    );
  }

  // 7. Mark as normalized
  normalized.normalized = true;

  return {
    event: normalized,
    warnings,
    valid: warnings.length === 0,
  };
}

/**
 * Batch-normalize an array of events.
 */
export function normalizeEvents(events: ExtractedEvent[]): {
  events: ExtractedEvent[];
  totalWarnings: number;
  invalidCount: number;
} {
  let totalWarnings = 0;
  let invalidCount = 0;
  const normalized: ExtractedEvent[] = [];

  for (const event of events) {
    const result = normalizeEvent(event);
    normalized.push(result.event);
    totalWarnings += result.warnings.length;
    if (!result.valid) invalidCount++;
  }

  return { events: normalized, totalWarnings, invalidCount };
}
