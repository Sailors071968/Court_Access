// ============================================================================
// Phase 6 — Doctrine Matching Engine
// Connects detected contradictions to the merged doctrine system (PR #32).
// Maps event types and contradictions to specific POST LD rules.
// ============================================================================

import type {
  Contradiction,
  DoctrineContradictionLink,
  DoctrineMatchResult,
  ContradictionType,
} from './types.ts';
import { getEventType } from './eventOntology.ts';

// ---------------------------------------------------------------------------
// Doctrine Rule Mapping — Contradiction Type → Relevant Doctrine
// ---------------------------------------------------------------------------

interface DoctrineRuleMapping {
  contradictionType: ContradictionType;
  doctrineRuleIds: string[];
  severity: 'critical' | 'significant' | 'moderate' | 'minor';
  proceduralDeviation: string;
}

const CONTRADICTION_DOCTRINE_MAP: DoctrineRuleMapping[] = [
  // Narrative inconsistencies
  {
    contradictionType: 'narrative_inconsistency',
    doctrineRuleIds: ['POSTLD18_REPO_001', 'POSTLD18_REPO_002'],
    severity: 'significant',
    proceduralDeviation: 'Potential deviation from LD-18 report accuracy requirements.',
  },

  // Timeline conflicts
  {
    contradictionType: 'timeline_conflict',
    doctrineRuleIds: ['POSTLD18_TIME_001', 'POSTLD18_REPO_001'],
    severity: 'significant',
    proceduralDeviation: 'Potential deviation from LD-18 temporal accuracy documentation requirements.',
  },

  // Missing bodycam
  {
    contradictionType: 'missing_bodycam_activation',
    doctrineRuleIds: [],
    severity: 'significant',
    proceduralDeviation: 'Body-worn camera not activated during critical event. Agency BWC policy may apply.',
  },

  // Dispatch inconsistency
  {
    contradictionType: 'dispatch_report_inconsistency',
    doctrineRuleIds: ['POSTLD18_REPO_001'],
    severity: 'moderate',
    proceduralDeviation: 'Potential discrepancy between CAD system records and officer narrative.',
  },

  // Witness conflicts
  {
    contradictionType: 'witness_conflict',
    doctrineRuleIds: ['POSTLD18_REPO_001', 'POSTLD18_REPO_002'],
    severity: 'significant',
    proceduralDeviation: 'Witness account differs from official report. LD-18 accuracy standards implicated.',
  },

  // Evidence chain of custody
  {
    contradictionType: 'chain_of_custody_gap',
    doctrineRuleIds: ['POSTLD24_CHAI_001', 'POSTLD24_EVID_001', 'POSTLD24_EVID_002'],
    severity: 'critical',
    proceduralDeviation: 'Potential deviation from LD-24 evidence handling and chain of custody requirements.',
  },

  // Evidence appearance/disappearance
  {
    contradictionType: 'evidence_appearance_disappearance',
    doctrineRuleIds: ['POSTLD24_CHAI_001', 'POSTLD24_STOR_001'],
    severity: 'critical',
    proceduralDeviation: 'Evidence item unaccounted for. LD-24 chain of custody requirements implicated.',
  },

  // Location inconsistency
  {
    contradictionType: 'location_inconsistency',
    doctrineRuleIds: ['POSTLD18_REPO_001'],
    severity: 'moderate',
    proceduralDeviation: 'Location discrepancy between sources. LD-18 report accuracy standards apply.',
  },

  // Action sequence conflict
  {
    contradictionType: 'action_sequence_conflict',
    doctrineRuleIds: ['POSTLD15_DETE_001', 'POSTLD20_FORC_001'],
    severity: 'significant',
    proceduralDeviation: 'Expected procedural sequence not followed per LD-15/LD-20 requirements.',
  },

  // Force justification gap
  {
    contradictionType: 'force_justification_gap',
    doctrineRuleIds: ['POSTLD20_FORC_001', 'POSTLD20_FORC_002', 'POSTLD20_DEES_001', 'POSTLD20_REPO_001'],
    severity: 'critical',
    proceduralDeviation: 'Force application without documented justification. LD-20 use of force requirements implicated.',
  },

  // Missing Miranda
  {
    contradictionType: 'missing_miranda',
    doctrineRuleIds: ['POSTLD15_MIRA_001', 'POSTLD15_MIRA_002', 'POSTLD15_MIRA_003'],
    severity: 'critical',
    proceduralDeviation: 'Potential deviation from LD-15 Miranda advisement requirements during custodial interrogation.',
  },

  // Consent dispute
  {
    contradictionType: 'consent_dispute',
    doctrineRuleIds: ['POSTLD16_CONS_001', 'POSTLD16_CONS_002', 'POSTLD16_CONS_003'],
    severity: 'critical',
    proceduralDeviation: 'Consent to search disputed between sources. LD-16 consent search requirements implicated.',
  },

  // Search authority gap
  {
    contradictionType: 'search_authority_gap',
    doctrineRuleIds: ['POSTLD16_SEAR_001', 'POSTLD16_WARR_001'],
    severity: 'critical',
    proceduralDeviation: 'No documented legal authority for search. LD-16 search and seizure requirements implicated.',
  },

  // Identity inconsistency
  {
    contradictionType: 'identity_inconsistency',
    doctrineRuleIds: ['POSTLD18_REPO_001'],
    severity: 'moderate',
    proceduralDeviation: 'Identity information inconsistent across sources.',
  },

  // Count discrepancy
  {
    contradictionType: 'count_discrepancy',
    doctrineRuleIds: ['POSTLD18_REPO_001', 'POSTLD24_EVID_001'],
    severity: 'moderate',
    proceduralDeviation: 'Quantity or count discrepancy between sources.',
  },
];

// ---------------------------------------------------------------------------
// Event-Level Doctrine Mapping
// ---------------------------------------------------------------------------

/**
 * Get doctrine rules related to a specific event type from the ontology.
 */
function getEventDoctrineRules(eventTypeId: string): string[] {
  const eventDef = getEventType(eventTypeId);
  if (!eventDef) return [];
  return eventDef.relatedDoctrineRules;
}

// ---------------------------------------------------------------------------
// Public API — Doctrine Matching
// ---------------------------------------------------------------------------

/**
 * Match a contradiction to relevant POST Learning Domain doctrine rules.
 */
export function matchContradictionToDoctrine(
  contradiction: Contradiction,
  eventTypeA: string,
  eventTypeB: string,
): DoctrineMatchResult {
  const links: DoctrineContradictionLink[] = [];
  const proceduralDeviations: string[] = [];

  // Step 1: Find doctrine mapping for the contradiction type
  const typeMapping = CONTRADICTION_DOCTRINE_MAP.find(
    (m) => m.contradictionType === contradiction.contradictionType,
  );

  if (typeMapping) {
    proceduralDeviations.push(typeMapping.proceduralDeviation);

    for (const ruleId of typeMapping.doctrineRuleIds) {
      links.push({
        contradictionId: contradiction.contradictionId,
        doctrineRuleId: ruleId,
        eventTypeId: eventTypeA,
        matchDescription: typeMapping.proceduralDeviation,
        severity: typeMapping.severity,
        confidence: contradiction.confidence,
      });
    }
  }

  // Step 2: Add event-specific doctrine rules
  const eventARules = getEventDoctrineRules(eventTypeA);
  const eventBRules = getEventDoctrineRules(eventTypeB);
  const allEventRules = [...new Set([...eventARules, ...eventBRules])];

  for (const ruleId of allEventRules) {
    // Avoid duplicates
    if (links.some((l) => l.doctrineRuleId === ruleId)) continue;

    links.push({
      contradictionId: contradiction.contradictionId,
      doctrineRuleId: ruleId,
      eventTypeId: eventTypeA,
      matchDescription: `Event type doctrine mapping: ${eventTypeA} relates to ${ruleId}`,
      severity: typeMapping?.severity ?? 'moderate',
      confidence: contradiction.confidence * 0.8, // Slightly lower confidence for indirect matches
    });
  }

  return {
    contradictionId: contradiction.contradictionId,
    doctrineMatches: links,
    proceduralDeviations,
  };
}

/**
 * Batch match all contradictions for a case.
 */
export function matchAllContradictions(
  contradictions: Contradiction[],
  eventMap: Map<string, string>, // eventId → eventType
): DoctrineMatchResult[] {
  return contradictions.map((c) => {
    const eventTypeA = eventMap.get(c.eventA) ?? 'UNKNOWN';
    const eventTypeB = eventMap.get(c.eventB) ?? 'UNKNOWN';
    return matchContradictionToDoctrine(c, eventTypeA, eventTypeB);
  });
}

/**
 * Get the overall severity level for a case based on doctrine matches.
 */
export function assessCaseSeverity(
  results: DoctrineMatchResult[],
): 'critical' | 'significant' | 'moderate' | 'minor' {
  let hasCritical = false;
  let hasSignificant = false;
  let hasModerate = false;

  for (const result of results) {
    for (const link of result.doctrineMatches) {
      if (link.severity === 'critical') hasCritical = true;
      if (link.severity === 'significant') hasSignificant = true;
      if (link.severity === 'moderate') hasModerate = true;
    }
  }

  if (hasCritical) return 'critical';
  if (hasSignificant) return 'significant';
  if (hasModerate) return 'moderate';
  return 'minor';
}
