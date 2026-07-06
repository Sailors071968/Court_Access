// ============================================================================
// Phase 5 — Contradiction Detection Engine
// Analyzes unified timeline and extracted events to detect evidentiary
// contradictions across all source types.
// Language guardrails: NEVER use accusatory language.
// ============================================================================

import { v4 as uuidv4 } from 'uuid';
import type {
  ExtractedEvent,
  TimelineEvent,
  Contradiction,
  ContradictionType,
  ContradictionAnalysisResult,
} from './types.ts';
import { getEventType } from './eventOntology.ts';

// ---------------------------------------------------------------------------
// Contradiction Scoring Model
// score = semantic_conflict_score × event_weight × evidence_confidence × timeline_distance_factor
// ---------------------------------------------------------------------------

function computeContradictionScore(
  semanticConflictScore: number,
  eventTypeA: string,
  eventTypeB: string,
  evidenceConfidence: number,
  timeRangeStartMs: number | null,
  timeRangeEndMs: number | null,
): number {
  // Event weight: average of both events' weights
  const defA = getEventType(eventTypeA);
  const defB = getEventType(eventTypeB);
  const weightA = defA?.eventWeight ?? 0.5;
  const weightB = defB?.eventWeight ?? 0.5;
  const eventWeight = (weightA + weightB) / 2;

  // Timeline distance factor: closer in time = higher score
  let timelineDistanceFactor = 1.0;
  if (timeRangeStartMs !== null && timeRangeEndMs !== null) {
    const distanceMs = Math.abs(timeRangeEndMs - timeRangeStartMs);
    // Decay: events within 5 min get factor 1.0, beyond 1 hour drops to ~0.5
    timelineDistanceFactor = Math.max(0.3, 1.0 - distanceMs / 7_200_000);
  }

  const score = semanticConflictScore * eventWeight * evidenceConfidence * timelineDistanceFactor;
  return Math.round(score * 1000) / 1000; // 3 decimal places
}

// ---------------------------------------------------------------------------
// Contradiction Detection Rules
// ---------------------------------------------------------------------------

interface DetectionRule {
  type: ContradictionType;
  description: string;
  detect: (events: ExtractedEvent[], timeline: TimelineEvent[]) => Contradiction[];
}

// ---------------------------------------------------------------------------
// Rule 1: Narrative Inconsistency Detection
// Finds events described differently across sources.
// ---------------------------------------------------------------------------

function detectNarrativeInconsistencies(events: ExtractedEvent[]): Contradiction[] {
  const contradictions: Contradiction[] = [];

  // Group events by type and case
  const byTypeAndCase = new Map<string, ExtractedEvent[]>();
  for (const ev of events) {
    const key = `${ev.caseId}:${ev.eventType}`;
    const group = byTypeAndCase.get(key) ?? [];
    group.push(ev);
    byTypeAndCase.set(key, group);
  }

  for (const [, group] of byTypeAndCase) {
    if (group.length < 2) continue;

    // Compare events from different sources
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const evA = group[i];
        const evB = group[j];

        // Skip if same source
        if (evA.sourceEvidenceId === evB.sourceEvidenceId) continue;

        // Check for actor disagreement
        if (evA.actorRole !== evB.actorRole) {
          const eventDef = getEventType(evA.eventType);
          contradictions.push({
            contradictionId: uuidv4(),
            caseId: evA.caseId,
            eventA: evA.eventId,
            eventB: evB.eventId,
            contradictionType: 'narrative_inconsistency',
            description: `Potential inconsistency: ${eventDef?.eventName ?? evA.eventType} — different actor roles reported across sources. Source A reports ${evA.actorRole}, Source B reports ${evB.actorRole}. Requires human review.`,
            timeRangeStart: evA.timestamp,
            timeRangeEnd: evB.timestamp,
            confidence: 0.70,
            contradictionScore: 0,
            sourceEvidenceIds: [evA.sourceEvidenceId, evB.sourceEvidenceId],
            createdAt: new Date().toISOString(),
          });
        }

        // Check for significant location disagreement
        if (evA.location && evB.location && evA.location !== evB.location) {
          contradictions.push({
            contradictionId: uuidv4(),
            caseId: evA.caseId,
            eventA: evA.eventId,
            eventB: evB.eventId,
            contradictionType: 'location_inconsistency',
            description: `Potential inconsistency: Different locations reported for the same event. Source A: "${evA.location}", Source B: "${evB.location}". Warrants further examination.`,
            timeRangeStart: evA.timestamp,
            timeRangeEnd: evB.timestamp,
            confidence: 0.65,
            contradictionScore: 0,
            sourceEvidenceIds: [evA.sourceEvidenceId, evB.sourceEvidenceId],
            createdAt: new Date().toISOString(),
          });
        }
      }
    }
  }

  return contradictions;
}

// ---------------------------------------------------------------------------
// Rule 2: Timeline Conflict Detection
// Finds events that are reported in conflicting temporal order.
// ---------------------------------------------------------------------------

function detectTimelineConflicts(
  events: ExtractedEvent[],
  timeline: TimelineEvent[],
): Contradiction[] {
  const contradictions: Contradiction[] = [];

  // Build a map from eventId to timeline position
  const timelinePos = new Map<string, number>();
  for (let i = 0; i < timeline.length; i++) {
    timelinePos.set(timeline[i].eventId, i);
  }

  // Define expected temporal orderings
  const expectedSequences: Array<{ before: string; after: string; label: string }> = [
    { before: 'OFFICER_DETAINS_PERSON', after: 'OFFICER_SEARCHES_PERSON', label: 'Detention should precede search' },
    { before: 'OFFICER_READS_MIRANDA', after: 'OFFICER_INTERROGATES_SUSPECT', label: 'Miranda should precede interrogation' },
    { before: 'OFFICER_ARRESTS_PERSON', after: 'OFFICER_BOOKS_ARRESTEE', label: 'Arrest should precede booking' },
    { before: 'OFFICER_REQUESTS_CONSENT_SEARCH', after: 'OFFICER_SEARCHES_VEHICLE', label: 'Consent request should precede search' },
    { before: 'OFFICER_ACTIVATES_BODYCAM', after: 'OFFICER_DETAINS_PERSON', label: 'Bodycam activation should precede detention' },
    { before: 'OFFICER_WARNS_FORCE', after: 'OFFICER_USES_PHYSICAL_FORCE', label: 'Force warning should precede force use' },
    { before: 'OFFICER_DEESCALATES', after: 'OFFICER_USES_PHYSICAL_FORCE', label: 'De-escalation attempt expected before force' },
    { before: 'OFFICER_ARRIVES_AT_SCENE', after: 'OFFICER_DETAINS_PERSON', label: 'Arrival should precede detention' },
    { before: 'OFFICER_DETAINS_PERSON', after: 'OFFICER_ARRESTS_PERSON', label: 'Detention should precede arrest' },
    { before: 'OFFICER_ARTICULATES_SUSPICION', after: 'OFFICER_DETAINS_PERSON', label: 'Reasonable suspicion should be articulated before detention' },
  ];

  // Group events by case
  const byCaseId = new Map<string, ExtractedEvent[]>();
  for (const ev of events) {
    const group = byCaseId.get(ev.caseId) ?? [];
    group.push(ev);
    byCaseId.set(ev.caseId, group);
  }

  for (const [caseId, caseEvents] of byCaseId) {
    for (const seq of expectedSequences) {
      const beforeEvents = caseEvents.filter((e) => e.eventType === seq.before);
      const afterEvents = caseEvents.filter((e) => e.eventType === seq.after);

      for (const be of beforeEvents) {
        for (const ae of afterEvents) {
          const posB = timelinePos.get(be.eventId);
          const posA = timelinePos.get(ae.eventId);

          // If "after" event appears before "before" event in timeline
          if (posB !== undefined && posA !== undefined && posA < posB) {
            contradictions.push({
              contradictionId: uuidv4(),
              caseId,
              eventA: be.eventId,
              eventB: ae.eventId,
              contradictionType: 'action_sequence_conflict',
              description: `Potential deviation: ${seq.label}. Timeline indicates reversed order. Requires human review.`,
              timeRangeStart: ae.timestamp,
              timeRangeEnd: be.timestamp,
              confidence: 0.75,
              contradictionScore: 0,
            sourceEvidenceIds: [be.sourceEvidenceId, ae.sourceEvidenceId],
              createdAt: new Date().toISOString(),
            });
          }
        }
      }
    }
  }

  return contradictions;
}

// ---------------------------------------------------------------------------
// Rule 3: Missing Bodycam Activation Detection
// Finds critical events with no corresponding bodycam footage.
// ---------------------------------------------------------------------------

function detectMissingBodycam(events: ExtractedEvent[]): Contradiction[] {
  const contradictions: Contradiction[] = [];

  // Events that MUST have bodycam coverage
  const criticalEventTypes = new Set([
    'OFFICER_DETAINS_PERSON',
    'OFFICER_SEARCHES_PERSON',
    'OFFICER_SEARCHES_VEHICLE',
    'OFFICER_ARRESTS_PERSON',
    'OFFICER_USES_PHYSICAL_FORCE',
    'OFFICER_DRAWS_WEAPON',
    'OFFICER_FIRES_WEAPON',
    'OFFICER_DEPLOYS_TASER',
    'OFFICER_READS_MIRANDA',
    'OFFICER_TAKES_DOWN_PERSON',
    'OFFICER_REQUESTS_CONSENT_SEARCH',
  ]);

  // Group by case
  const byCaseId = new Map<string, ExtractedEvent[]>();
  for (const ev of events) {
    const group = byCaseId.get(ev.caseId) ?? [];
    group.push(ev);
    byCaseId.set(ev.caseId, group);
  }

  for (const [caseId, caseEvents] of byCaseId) {
    const bodycamActivation = caseEvents.find((e) => e.eventType === 'OFFICER_ACTIVATES_BODYCAM');
    const videoEvents = caseEvents.filter((e) => e.extractionMethod === 'VIDEO_ACTION_DETECTION');

    for (const ev of caseEvents) {
      if (!criticalEventTypes.has(ev.eventType)) continue;

      // Check if there's corresponding video evidence
      const hasVideoCorroboration = videoEvents.some(
        (ve) => ve.eventType === ev.eventType,
      );

      if (!hasVideoCorroboration && !bodycamActivation) {
        const eventDef = getEventType(ev.eventType);
        contradictions.push({
          contradictionId: uuidv4(),
          caseId,
          eventA: ev.eventId,
          eventB: ev.eventId, // Self-reference — no corresponding video event
          contradictionType: 'missing_bodycam_activation',
          description: `Potential inconsistency: ${eventDef?.eventName ?? ev.eventType} reported in officer narrative but no body-worn camera footage available for this critical event. Warrants further examination.`,
          timeRangeStart: ev.timestamp,
          timeRangeEnd: ev.timestamp,
          confidence: 0.80,
          contradictionScore: 0,
            sourceEvidenceIds: [ev.sourceEvidenceId],
          createdAt: new Date().toISOString(),
        });
      }
    }
  }

  return contradictions;
}

// ---------------------------------------------------------------------------
// Rule 4: Dispatch-Report Inconsistency Detection
// Compares CAD/dispatch logs with officer reports for discrepancies.
// ---------------------------------------------------------------------------

function detectDispatchReportInconsistencies(events: ExtractedEvent[]): Contradiction[] {
  const contradictions: Contradiction[] = [];

  // Group by case
  const byCaseId = new Map<string, ExtractedEvent[]>();
  for (const ev of events) {
    const group = byCaseId.get(ev.caseId) ?? [];
    group.push(ev);
    byCaseId.set(ev.caseId, group);
  }

  for (const [caseId, caseEvents] of byCaseId) {
    const cadEvents = caseEvents.filter((e) => e.extractionMethod === 'CAD_IMPORT');
    const reportEvents = caseEvents.filter((e) => e.extractionMethod === 'REPORT_NLP');

    // Check for events in CAD but not in report
    for (const cadEv of cadEvents) {
      const matchingReport = reportEvents.find(
        (re) => re.eventType === cadEv.eventType,
      );

      if (!matchingReport) {
        const eventDef = getEventType(cadEv.eventType);
        contradictions.push({
          contradictionId: uuidv4(),
          caseId,
          eventA: cadEv.eventId,
          eventB: cadEv.eventId,
          contradictionType: 'dispatch_report_inconsistency',
          description: `Potential discrepancy: ${eventDef?.eventName ?? cadEv.eventType} logged in dispatch records but not mentioned in officer report. Notation for review.`,
          timeRangeStart: cadEv.timestamp,
          timeRangeEnd: cadEv.timestamp,
          confidence: 0.70,
          contradictionScore: 0,
            sourceEvidenceIds: [cadEv.sourceEvidenceId],
          createdAt: new Date().toISOString(),
        });
      }

      // Check for significant timestamp discrepancies
      if (matchingReport && cadEv.timestamp && matchingReport.timestamp) {
        // If timestamps differ by more than 15 minutes, flag it
        const tsA = new Date(cadEv.timestamp).getTime();
        const tsB = new Date(matchingReport.timestamp).getTime();
        if (!isNaN(tsA) && !isNaN(tsB) && Math.abs(tsA - tsB) > 900_000) {
          contradictions.push({
            contradictionId: uuidv4(),
            caseId,
            eventA: cadEv.eventId,
            eventB: matchingReport.eventId,
            contradictionType: 'timeline_conflict',
            description: `Potential inconsistency: Dispatch log and officer report show significantly different times for the same event. Difference exceeds 15 minutes. Requires human review.`,
            timeRangeStart: cadEv.timestamp,
            timeRangeEnd: matchingReport.timestamp,
            confidence: 0.75,
            contradictionScore: 0,
            sourceEvidenceIds: [cadEv.sourceEvidenceId, matchingReport.sourceEvidenceId],
            createdAt: new Date().toISOString(),
          });
        }
      }
    }
  }

  return contradictions;
}

// ---------------------------------------------------------------------------
// Rule 5: Witness Conflict Detection
// Finds disagreements between witness statements and officer reports.
// ---------------------------------------------------------------------------

function detectWitnessConflicts(events: ExtractedEvent[]): Contradiction[] {
  const contradictions: Contradiction[] = [];

  // Group by case
  const byCaseId = new Map<string, ExtractedEvent[]>();
  for (const ev of events) {
    const group = byCaseId.get(ev.caseId) ?? [];
    group.push(ev);
    byCaseId.set(ev.caseId, group);
  }

  for (const [caseId, caseEvents] of byCaseId) {
    const witnessEvents = caseEvents.filter(
      (e) => e.actorRole === 'witness' || e.extractionMethod === 'TRANSCRIPT_NLP',
    );
    const officerEvents = caseEvents.filter(
      (e) => e.actorRole === 'officer' && e.extractionMethod === 'REPORT_NLP',
    );

    // Check for force events reported by witnesses but not by officer
    const witnessForceEvents = witnessEvents.filter((e) =>
      e.eventType.includes('FORCE') ||
      e.eventType.includes('DRAWS_WEAPON') ||
      e.eventType.includes('DEPLOYS') ||
      e.eventType.includes('TAKES_DOWN'),
    );

    for (const we of witnessForceEvents) {
      const officerReported = officerEvents.some(
        (oe) => oe.eventType === we.eventType,
      );

      if (!officerReported) {
        const eventDef = getEventType(we.eventType);
        contradictions.push({
          contradictionId: uuidv4(),
          caseId,
          eventA: we.eventId,
          eventB: we.eventId,
          contradictionType: 'witness_conflict',
          description: `Potential inconsistency: ${eventDef?.eventName ?? we.eventType} described in witness account but not documented in officer report. Warrants further examination.`,
          timeRangeStart: we.timestamp,
          timeRangeEnd: we.timestamp,
          confidence: 0.65,
          contradictionScore: 0,
            sourceEvidenceIds: [we.sourceEvidenceId],
          createdAt: new Date().toISOString(),
        });
      }
    }

    // Check for events only in officer report but contradicted by witnesses
    for (const oe of officerEvents) {
      if (oe.eventType === 'PERSON_GRANTS_CONSENT') {
        const witnessDispute = witnessEvents.some(
          (we) => we.eventType === 'PERSON_DENIES_CONSENT',
        );
        if (witnessDispute) {
          contradictions.push({
            contradictionId: uuidv4(),
            caseId,
            eventA: oe.eventId,
            eventB: witnessEvents.find((we) => we.eventType === 'PERSON_DENIES_CONSENT')!.eventId,
            contradictionType: 'consent_dispute',
            description: 'Potential inconsistency: Officer report states consent was granted, but witness/subject account indicates consent was denied. Requires human review.',
            timeRangeStart: oe.timestamp,
            timeRangeEnd: oe.timestamp,
            confidence: 0.80,
            contradictionScore: 0,
            sourceEvidenceIds: [oe.sourceEvidenceId],
            createdAt: new Date().toISOString(),
          });
        }
      }
    }
  }

  return contradictions;
}

// ---------------------------------------------------------------------------
// Rule 6: Evidence Chain of Custody Gaps
// ---------------------------------------------------------------------------

function detectChainOfCustodyGaps(events: ExtractedEvent[]): Contradiction[] {
  const contradictions: Contradiction[] = [];

  const byCaseId = new Map<string, ExtractedEvent[]>();
  for (const ev of events) {
    const group = byCaseId.get(ev.caseId) ?? [];
    group.push(ev);
    byCaseId.set(ev.caseId, group);
  }

  for (const [caseId, caseEvents] of byCaseId) {
    // Check if evidence was collected but never logged into storage
    const collected = caseEvents.filter((e) => e.eventType === 'EVIDENCE_ITEM_COLLECTED');
    const logged = caseEvents.filter((e) => e.eventType === 'EVIDENCE_LOGGED_INTO_STORAGE');

    if (collected.length > 0 && logged.length === 0) {
      contradictions.push({
        contradictionId: uuidv4(),
        caseId,
        eventA: collected[0].eventId,
        eventB: collected[0].eventId,
        contradictionType: 'chain_of_custody_gap',
        description: `Possible procedural gap: Evidence reported as collected but no corresponding evidence storage log found. Notation for review.`,
        timeRangeStart: collected[0].timestamp,
        timeRangeEnd: null,
        confidence: 0.60,
        contradictionScore: 0,
            sourceEvidenceIds: collected.map((e) => e.sourceEvidenceId),
        createdAt: new Date().toISOString(),
      });
    }

    // Check for evidence missing events
    const missing = caseEvents.filter((e) => e.eventType === 'EVIDENCE_MISSING');
    for (const ev of missing) {
      contradictions.push({
        contradictionId: uuidv4(),
        caseId,
        eventA: ev.eventId,
        eventB: ev.eventId,
        contradictionType: 'evidence_appearance_disappearance',
        description: 'Potential inconsistency: Evidence item reported as missing from storage. Requires human review.',
        timeRangeStart: ev.timestamp,
        timeRangeEnd: null,
        confidence: 0.85,
        contradictionScore: 0,
            sourceEvidenceIds: [ev.sourceEvidenceId],
        createdAt: new Date().toISOString(),
      });
    }
  }

  return contradictions;
}

// ---------------------------------------------------------------------------
// Rule 7: Miranda and Search Authority Gaps
// ---------------------------------------------------------------------------

function detectProceduralGaps(events: ExtractedEvent[]): Contradiction[] {
  const contradictions: Contradiction[] = [];

  const byCaseId = new Map<string, ExtractedEvent[]>();
  for (const ev of events) {
    const group = byCaseId.get(ev.caseId) ?? [];
    group.push(ev);
    byCaseId.set(ev.caseId, group);
  }

  for (const [caseId, caseEvents] of byCaseId) {
    // Check for interrogation without Miranda
    const hasInterrogation = caseEvents.some((e) => e.eventType === 'OFFICER_INTERROGATES_SUSPECT');
    const hasMiranda = caseEvents.some((e) => e.eventType === 'OFFICER_READS_MIRANDA');
    const hasArrest = caseEvents.some((e) => e.eventType === 'OFFICER_ARRESTS_PERSON');

    if (hasInterrogation && hasArrest && !hasMiranda) {
      const interrogation = caseEvents.find((e) => e.eventType === 'OFFICER_INTERROGATES_SUSPECT')!;
      contradictions.push({
        contradictionId: uuidv4(),
        caseId,
        eventA: interrogation.eventId,
        eventB: interrogation.eventId,
        contradictionType: 'missing_miranda',
        description: 'Possible procedural gap: Custodial interrogation documented but no Miranda advisement found in available evidence. Warrants further examination.',
        timeRangeStart: interrogation.timestamp,
        timeRangeEnd: null,
        confidence: 0.75,
        contradictionScore: 0,
            sourceEvidenceIds: [interrogation.sourceEvidenceId],
        createdAt: new Date().toISOString(),
      });
    }

    // Check for continued questioning after rights invocation
    const hasInvocation = caseEvents.some((e) => e.eventType === 'SUSPECT_INVOKES_RIGHTS');
    const hasContinuedQuestioning = caseEvents.some(
      (e) => e.eventType === 'OFFICER_CONTINUES_QUESTIONING_AFTER_INVOCATION',
    );

    if (hasInvocation && hasContinuedQuestioning) {
      const continued = caseEvents.find(
        (e) => e.eventType === 'OFFICER_CONTINUES_QUESTIONING_AFTER_INVOCATION',
      )!;
      contradictions.push({
        contradictionId: uuidv4(),
        caseId,
        eventA: continued.eventId,
        eventB: continued.eventId,
        contradictionType: 'missing_miranda',
        description: 'Potential deviation: Questioning appears to have continued after suspect invoked rights. Requires human review.',
        timeRangeStart: continued.timestamp,
        timeRangeEnd: null,
        confidence: 0.85,
        contradictionScore: 0,
            sourceEvidenceIds: [continued.sourceEvidenceId],
        createdAt: new Date().toISOString(),
      });
    }

    // Check for search without documented authority
    const hasSearch = caseEvents.some(
      (e) => e.eventType === 'OFFICER_SEARCHES_VEHICLE' || e.eventType === 'OFFICER_SEARCHES_PERSON',
    );
    const hasConsent = caseEvents.some((e) => e.eventType === 'PERSON_GRANTS_CONSENT');
    const hasWarrant = caseEvents.some((e) => e.eventType === 'OFFICER_EXECUTES_WARRANT');
    const hasPlainView = caseEvents.some((e) => e.eventType === 'OFFICER_OBSERVES_PLAIN_VIEW');
    const hasIncidentToArrest = caseEvents.some(
      (e) => e.eventType === 'OFFICER_SEARCHES_INCIDENT_TO_ARREST',
    );

    if (hasSearch && !hasConsent && !hasWarrant && !hasPlainView && !hasIncidentToArrest && !hasArrest) {
      const searchEvent = caseEvents.find(
        (e) => e.eventType === 'OFFICER_SEARCHES_VEHICLE' || e.eventType === 'OFFICER_SEARCHES_PERSON',
      )!;
      contradictions.push({
        contradictionId: uuidv4(),
        caseId,
        eventA: searchEvent.eventId,
        eventB: searchEvent.eventId,
        contradictionType: 'search_authority_gap',
        description: 'Possible procedural gap: Search conducted but no documented search authority found (no consent, warrant, plain view, or incident to arrest). Warrants further examination.',
        timeRangeStart: searchEvent.timestamp,
        timeRangeEnd: null,
        confidence: 0.70,
        contradictionScore: 0,
            sourceEvidenceIds: [searchEvent.sourceEvidenceId],
        createdAt: new Date().toISOString(),
      });
    }
  }

  return contradictions;
}

// ---------------------------------------------------------------------------
// Master Detection Pipeline
// ---------------------------------------------------------------------------

const DETECTION_RULES: DetectionRule[] = [
  {
    type: 'narrative_inconsistency',
    description: 'Cross-source narrative comparison',
    detect: (events) => detectNarrativeInconsistencies(events),
  },
  {
    type: 'timeline_conflict',
    description: 'Temporal ordering verification',
    detect: (events, timeline) => detectTimelineConflicts(events, timeline),
  },
  {
    type: 'missing_bodycam_activation',
    description: 'Body-worn camera activation gap detection',
    detect: (events) => detectMissingBodycam(events),
  },
  {
    type: 'dispatch_report_inconsistency',
    description: 'CAD/dispatch vs officer report comparison',
    detect: (events) => detectDispatchReportInconsistencies(events),
  },
  {
    type: 'witness_conflict',
    description: 'Witness statement vs official report comparison',
    detect: (events) => detectWitnessConflicts(events),
  },
  {
    type: 'chain_of_custody_gap',
    description: 'Evidence chain of custody verification',
    detect: (events) => detectChainOfCustodyGaps(events),
  },
  {
    type: 'missing_miranda',
    description: 'Miranda and procedural requirement verification',
    detect: (events) => detectProceduralGaps(events),
  },
];

/**
 * Run the full contradiction detection pipeline on a case's events.
 */
export function analyzeContradictions(
  caseId: string,
  events: ExtractedEvent[],
  timeline: TimelineEvent[],
): ContradictionAnalysisResult {
  const allContradictions: Contradiction[] = [];

  for (const rule of DETECTION_RULES) {
    const found = rule.detect(events, timeline);
    allContradictions.push(...found);
  }

  // Deduplicate by checking event pair overlaps
  const seen = new Set<string>();
  const deduplicated = allContradictions.filter((c) => {
    const key = [c.eventA, c.eventB].sort().join(':') + '|' + c.contradictionType;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Compute contradiction scores using the composite scoring model
  const eventLookup = new Map<string, ExtractedEvent>();
  for (const ev of events) {
    eventLookup.set(ev.eventId, ev);
  }

  for (const c of deduplicated) {
    const evA = eventLookup.get(c.eventA);
    const evB = eventLookup.get(c.eventB);
    const avgConfidence = ((evA?.confidence ?? 0.5) + (evB?.confidence ?? 0.5)) / 2;
    const tsStartMs = c.timeRangeStart ? new Date(c.timeRangeStart).getTime() : null;
    const tsEndMs = c.timeRangeEnd ? new Date(c.timeRangeEnd).getTime() : null;

    c.contradictionScore = computeContradictionScore(
      c.confidence,       // semantic_conflict_score
      evA?.eventType ?? '',
      evB?.eventType ?? '',
      avgConfidence,       // evidence_confidence
      isNaN(tsStartMs ?? NaN) ? null : tsStartMs,
      isNaN(tsEndMs ?? NaN) ? null : tsEndMs,
    );
  }

  // Categorize by confidence
  const highConfidence = deduplicated.filter((c) => c.confidence >= 0.80).length;
  const mediumConfidence = deduplicated.filter((c) => c.confidence >= 0.60 && c.confidence < 0.80).length;
  const lowConfidence = deduplicated.filter((c) => c.confidence < 0.60).length;

  // Count by type
  const byType: Partial<Record<ContradictionType, number>> = {};
  for (const c of deduplicated) {
    byType[c.contradictionType] = (byType[c.contradictionType] ?? 0) + 1;
  }

  return {
    caseId,
    totalContradictions: deduplicated.length,
    byType,
    highConfidence,
    mediumConfidence,
    lowConfidence,
    contradictions: deduplicated,
    analyzedAt: new Date().toISOString(),
  };
}
