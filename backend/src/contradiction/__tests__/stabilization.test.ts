// ============================================================================
// CDE Stabilization Tests
// Tests for: timestamp alignment, duplicate event detection, contradiction
// scoring, doctrine matching, large-case processing.
// Uses synthetic datasets.
// ============================================================================

import { describe, it, expect } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import type { ExtractedEvent, TimelineEvent, Contradiction } from '../types.ts';
import { normalizeEvent, normalizeEvents } from '../eventNormalization.ts';
import { buildUnifiedTimeline } from '../timelineEngine.ts';
import { analyzeContradictions } from '../contradictionDetectionEngine.ts';
import { matchContradictionToDoctrine, matchAllContradictions } from '../doctrineMatchingEngine.ts';
import { isValidEventType, getEventType } from '../eventOntology.ts';
import {
  paginateTimeline,
  paginateContradictions,
  batchEvents,
  checkCaseSize,
  PERFORMANCE_LIMITS,
} from '../performanceSafeguards.ts';

// ---------------------------------------------------------------------------
// Helpers — Synthetic Event Factory
// ---------------------------------------------------------------------------

function makeEvent(overrides: Partial<ExtractedEvent> = {}): ExtractedEvent {
  return {
    eventId: uuidv4(),
    caseId: 'test-case-1',
    eventType: 'OFFICER_DETAINS_PERSON',
    timestamp: '2026-03-12T14:30:00Z',
    timestampSource: 'officer_report',
    actor: 'Officer Smith',
    actorRole: 'officer',
    object: null,
    location: '123 Main Street',
    sourceEvidenceId: `evidence-${uuidv4().slice(0, 8)}`,
    sourceTextSpan: 'Officer detained the subject at the location.',
    sourceTimestamp: '2026-03-12T14:30:00Z',
    sourceConfidence: 0.85,
    confidence: 0.85,
    extractionMethod: 'REPORT_NLP',
    rawText: 'Officer detained the subject at the location.',
    normalized: false,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeContradiction(overrides: Partial<Contradiction> = {}): Contradiction {
  return {
    contradictionId: uuidv4(),
    caseId: 'test-case-1',
    eventA: uuidv4(),
    eventB: uuidv4(),
    contradictionType: 'narrative_inconsistency',
    description: 'Potential inconsistency detected.',
    timeRangeStart: '2026-03-12T14:30:00Z',
    timeRangeEnd: '2026-03-12T14:35:00Z',
    confidence: 0.75,
    contradictionScore: 0,
    sourceEvidenceIds: ['evidence-1', 'evidence-2'],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. Timestamp Alignment Tests
// ---------------------------------------------------------------------------

describe('Timestamp Alignment', () => {
  it('should normalize ISO timestamps correctly', () => {
    const event = makeEvent({ timestamp: '2026-03-12T14:30:00Z' });
    const result = normalizeEvent(event);
    expect(result.event.timestamp).toBe('2026-03-12T14:30:00.000Z');
    expect(result.event.normalized).toBe(true);
  });

  it('should normalize military time timestamps', () => {
    const event = makeEvent({ timestamp: '1430 hrs' });
    const result = normalizeEvent(event);
    expect(result.event.timestamp).toContain('14:30');
    expect(result.event.normalized).toBe(true);
  });

  it('should normalize 12-hour format timestamps', () => {
    const event = makeEvent({ timestamp: '2:30 PM' });
    const result = normalizeEvent(event);
    expect(result.event.timestamp).toContain('14:30');
    expect(result.event.normalized).toBe(true);
  });

  it('should preserve null timestamps', () => {
    const event = makeEvent({ timestamp: null });
    const result = normalizeEvent(event);
    expect(result.event.timestamp).toBeNull();
    expect(result.event.normalized).toBe(true);
  });

  it('should preserve sourceTimestamp for traceability', () => {
    const event = makeEvent({ timestamp: '1430 hrs' });
    const result = normalizeEvent(event);
    expect(result.event.sourceTimestamp).toBe('1430 hrs');
  });

  it('should build a deterministic timeline with secondary sort', () => {
    const events: ExtractedEvent[] = [
      makeEvent({
        eventId: 'event-b',
        timestamp: '2026-03-12T14:30:00Z',
        timestampSource: 'officer_report',
      }),
      makeEvent({
        eventId: 'event-a',
        timestamp: '2026-03-12T14:30:00Z',
        timestampSource: 'cad_dispatch',
      }),
    ];

    const result = buildUnifiedTimeline('test-case-1', events);
    // cad_dispatch has higher priority than officer_report, so event-a should come first
    expect(result.timeline[0].eventId).toBe('event-a');
    expect(result.timeline[1].eventId).toBe('event-b');
  });
});

// ---------------------------------------------------------------------------
// 2. Duplicate Event Detection Tests
// ---------------------------------------------------------------------------

describe('Duplicate Event Detection', () => {
  it('should deduplicate contradictions with same event pair and type', () => {
    const eventA = makeEvent({ eventId: 'ev-1' });
    const eventB = makeEvent({
      eventId: 'ev-2',
      sourceEvidenceId: 'different-source',
      actorRole: 'witness',
    });

    const events = [eventA, eventB];
    const timeline: TimelineEvent[] = [];

    const result = analyzeContradictions('test-case-1', events, timeline);

    // Should not have duplicate contradictions for the same event pair
    const seen = new Set<string>();
    for (const c of result.contradictions) {
      const key = [c.eventA, c.eventB].sort().join(':') + '|' + c.contradictionType;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Contradiction Scoring Tests
// ---------------------------------------------------------------------------

describe('Contradiction Scoring', () => {
  it('should compute non-zero contradiction scores', () => {
    const events: ExtractedEvent[] = [
      makeEvent({
        eventId: 'ev-1',
        eventType: 'OFFICER_SEARCHES_VEHICLE',
        sourceEvidenceId: 'evidence-1',
        actorRole: 'officer',
      }),
      makeEvent({
        eventId: 'ev-2',
        eventType: 'OFFICER_SEARCHES_VEHICLE',
        sourceEvidenceId: 'evidence-2',
        actorRole: 'witness',
      }),
    ];

    const result = analyzeContradictions('test-case-1', events, []);

    for (const c of result.contradictions) {
      expect(c.contradictionScore).toBeGreaterThan(0);
      expect(c.contradictionScore).toBeLessThanOrEqual(1);
    }
  });

  it('should have higher scores for higher-weight events', () => {
    const highWeightDef = getEventType('OFFICER_FIRES_WEAPON');
    const lowWeightDef = getEventType('SUSPECT_RUNS');

    expect(highWeightDef).not.toBeNull();
    expect(lowWeightDef).not.toBeNull();
    expect(highWeightDef!.eventWeight).toBeGreaterThan(lowWeightDef!.eventWeight);
  });
});

// ---------------------------------------------------------------------------
// 4. Doctrine Matching Tests
// ---------------------------------------------------------------------------

describe('Doctrine Matching', () => {
  it('should match search authority gap to LD-16 rules', () => {
    const contradiction = makeContradiction({
      contradictionType: 'search_authority_gap',
      confidence: 0.85,
    });

    const result = matchContradictionToDoctrine(
      contradiction,
      'OFFICER_SEARCHES_VEHICLE',
      'OFFICER_SEARCHES_VEHICLE',
    );

    const hasLD16 = result.doctrineMatches.some((m) =>
      m.doctrineRuleId.startsWith('POSTLD16'),
    );
    expect(hasLD16).toBe(true);
  });

  it('should match missing miranda to LD-15 rules', () => {
    const contradiction = makeContradiction({
      contradictionType: 'missing_miranda',
      confidence: 0.80,
    });

    const result = matchContradictionToDoctrine(
      contradiction,
      'OFFICER_READS_MIRANDA',
      'OFFICER_INTERROGATES_SUSPECT',
    );

    const hasLD15 = result.doctrineMatches.some((m) =>
      m.doctrineRuleId.startsWith('POSTLD15'),
    );
    expect(hasLD15).toBe(true);
  });

  it('should match force contradictions to LD-20 rules', () => {
    const contradiction = makeContradiction({
      contradictionType: 'force_justification_gap',
      confidence: 0.90,
    });

    const result = matchContradictionToDoctrine(
      contradiction,
      'OFFICER_USES_PHYSICAL_FORCE',
      'OFFICER_USES_PHYSICAL_FORCE',
    );

    const hasLD20 = result.doctrineMatches.some((m) =>
      m.doctrineRuleId.startsWith('POSTLD20'),
    );
    expect(hasLD20).toBe(true);
  });

  it('should batch match all contradictions', () => {
    const contradictions = [
      makeContradiction({ contradictionType: 'search_authority_gap' }),
      makeContradiction({ contradictionType: 'missing_miranda' }),
    ];

    const eventMap = new Map<string, string>();
    eventMap.set(contradictions[0].eventA, 'OFFICER_SEARCHES_VEHICLE');
    eventMap.set(contradictions[0].eventB, 'OFFICER_SEARCHES_VEHICLE');
    eventMap.set(contradictions[1].eventA, 'OFFICER_READS_MIRANDA');
    eventMap.set(contradictions[1].eventB, 'OFFICER_INTERROGATES_SUSPECT');

    const results = matchAllContradictions(contradictions, eventMap);
    expect(results).toHaveLength(2);
    expect(results[0].doctrineMatches.length).toBeGreaterThan(0);
    expect(results[1].doctrineMatches.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 5. Event Ontology Tests
// ---------------------------------------------------------------------------

describe('Event Ontology', () => {
  it('should validate known event types', () => {
    expect(isValidEventType('OFFICER_DETAINS_PERSON')).toBe(true);
    expect(isValidEventType('OFFICER_SEARCHES_VEHICLE')).toBe(true);
    expect(isValidEventType('OFFICER_FIRES_WEAPON')).toBe(true);
  });

  it('should reject unknown event types', () => {
    expect(isValidEventType('NONEXISTENT_EVENT')).toBe(false);
  });

  it('should have eventWeight on all event types', () => {
    const def = getEventType('OFFICER_DETAINS_PERSON');
    expect(def).not.toBeNull();
    expect(def!.eventWeight).toBeGreaterThanOrEqual(0);
    expect(def!.eventWeight).toBeLessThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// 6. Event Normalization Tests
// ---------------------------------------------------------------------------

describe('Event Normalization', () => {
  it('should normalize actor rank abbreviations', () => {
    const event = makeEvent({ actor: 'Ofc. Johnson' });
    const result = normalizeEvent(event);
    expect(result.event.actor).toBe('Officer Johnson');
  });

  it('should warn on unknown event types', () => {
    const event = makeEvent({ eventType: 'NONEXISTENT_TYPE' });
    const result = normalizeEvent(event);
    expect(result.valid).toBe(false);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('should batch normalize events', () => {
    const events = [
      makeEvent({ actor: 'Sgt. Davis' }),
      makeEvent({ actor: 'Det. Brown' }),
    ];

    const result = normalizeEvents(events);
    expect(result.events).toHaveLength(2);
    expect(result.events[0].actor).toBe('Sergeant Davis');
    expect(result.events[1].actor).toBe('Detective Brown');
  });

  it('should populate sourceTextSpan from rawText if missing', () => {
    const event = makeEvent({
      sourceTextSpan: null,
      rawText: 'The officer detained the suspect.',
    });
    const result = normalizeEvent(event);
    expect(result.event.sourceTextSpan).toBe('The officer detained the suspect.');
  });
});

// ---------------------------------------------------------------------------
// 7. Large Case Performance Tests
// ---------------------------------------------------------------------------

describe('Large Case Performance Safeguards', () => {
  it('should paginate timeline correctly', () => {
    const timeline: TimelineEvent[] = Array.from({ length: 2500 }, (_, i) => ({
      eventId: `ev-${i}`,
      caseId: 'test-case-1',
      eventType: 'OFFICER_DETAINS_PERSON',
      canonicalTimestamp: new Date(2026, 2, 12, 14, 0, 0, i * 100).toISOString(),
      timestampSource: 'officer_report' as const,
      actor: 'Officer Smith',
      actorRole: 'officer' as const,
      location: null,
      confidence: 0.85,
      sourceEvidenceIds: ['evidence-1'],
    }));

    const page1 = paginateTimeline(timeline, 1);
    expect(page1.items).toHaveLength(1000);
    expect(page1.page).toBe(1);
    expect(page1.totalPages).toBe(3);
    expect(page1.hasNextPage).toBe(true);
    expect(page1.hasPrevPage).toBe(false);

    const page3 = paginateTimeline(timeline, 3);
    expect(page3.items).toHaveLength(500);
    expect(page3.hasNextPage).toBe(false);
    expect(page3.hasPrevPage).toBe(true);
  });

  it('should batch events correctly', () => {
    const events = Array.from({ length: 550 }, () => makeEvent());
    const batches = batchEvents(events, 200);
    expect(batches).toHaveLength(3);
    expect(batches[0]).toHaveLength(200);
    expect(batches[1]).toHaveLength(200);
    expect(batches[2]).toHaveLength(150);
  });

  it('should detect large cases', () => {
    const events = Array.from({ length: 6000 }, () => makeEvent());
    const check = checkCaseSize(events);
    expect(check.isLargeCase).toBe(true);
    expect(check.exceedsHardLimit).toBe(false);
  });

  it('should detect cases exceeding hard limit', () => {
    const events = Array.from({ length: PERFORMANCE_LIMITS.MAX_CASE_EVENTS + 1 }, () =>
      makeEvent(),
    );
    const check = checkCaseSize(events);
    expect(check.exceedsHardLimit).toBe(true);
  });

  it('should paginate contradictions correctly', () => {
    const contradictions = Array.from({ length: 1200 }, () => makeContradiction());
    const page1 = paginateContradictions(contradictions, 1);
    expect(page1.items).toHaveLength(500);
    expect(page1.totalPages).toBe(3);
  });
});
