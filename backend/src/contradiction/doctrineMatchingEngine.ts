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
// Event-Type Pre-Filtering Map
// Maps event type categories to relevant doctrine rule prefixes.
// Used to skip irrelevant doctrine rules early before deeper matching.
// ---------------------------------------------------------------------------

const EVENT_TYPE_DOCTRINE_PREFILTER: Record<string, string[]> = {
  // Search-related events → LD-16 only
  'OFFICER_SEARCHES_VEHICLE': ['POSTLD16'],
  'OFFICER_SEARCHES_PERSON': ['POSTLD16'],
  'OFFICER_REQUESTS_CONSENT_SEARCH': ['POSTLD16'],
  'PERSON_GRANTS_CONSENT': ['POSTLD16'],
  'PERSON_DENIES_CONSENT': ['POSTLD16'],
  'PERSON_REVOKES_CONSENT': ['POSTLD16'],
  'OFFICER_EXECUTES_WARRANT': ['POSTLD16'],
  'OFFICER_OBSERVES_PLAIN_VIEW': ['POSTLD16'],
  'OFFICER_SEARCHES_INCIDENT_TO_ARREST': ['POSTLD16'],

  // Detention/Miranda events → LD-15 only
  'OFFICER_DETAINS_PERSON': ['POSTLD15'],
  'OFFICER_READS_MIRANDA': ['POSTLD15'],
  'OFFICER_INTERROGATES_SUSPECT': ['POSTLD15'],
  'SUSPECT_INVOKES_RIGHTS': ['POSTLD15'],
  'SUSPECT_REQUESTS_ATTORNEY': ['POSTLD15'],
  'SUSPECT_WAIVES_RIGHTS': ['POSTLD15'],
  'OFFICER_CONTINUES_QUESTIONING_AFTER_INVOCATION': ['POSTLD15'],

  // Force events → LD-20 only
  'OFFICER_USES_PHYSICAL_FORCE': ['POSTLD20'],
  'OFFICER_DRAWS_WEAPON': ['POSTLD20'],
  'OFFICER_FIRES_WEAPON': ['POSTLD20'],
  'OFFICER_DEPLOYS_TASER': ['POSTLD20'],
  'OFFICER_DEPLOYS_OC_SPRAY': ['POSTLD20'],
  'OFFICER_USES_BATON': ['POSTLD20'],
  'OFFICER_TAKES_DOWN_PERSON': ['POSTLD20'],
  'OFFICER_WARNS_FORCE': ['POSTLD20'],
  'OFFICER_DEESCALATES': ['POSTLD20'],

  // Evidence handling → LD-24 only
  'EVIDENCE_ITEM_COLLECTED': ['POSTLD24'],
  'EVIDENCE_LOGGED_INTO_STORAGE': ['POSTLD24'],
  'EVIDENCE_MISSING': ['POSTLD24'],
  'EVIDENCE_TRANSFERRED': ['POSTLD24'],

  // Arrest events → LD-15 + LD-18
  'OFFICER_ARRESTS_PERSON': ['POSTLD15', 'POSTLD18'],

  // Report events → LD-18 only
  'OFFICER_WRITES_REPORT': ['POSTLD18'],
  'OFFICER_SUPPLEMENTS_REPORT': ['POSTLD18'],
};

/**
 * Pre-filter doctrine rules by event type to reduce search volume.
 * Returns only relevant rule prefixes for the given event types.
 */
function getPreFilteredDoctrinePrefixes(eventTypeA: string, eventTypeB: string): string[] | null {
  const prefixesA = EVENT_TYPE_DOCTRINE_PREFILTER[eventTypeA];
  const prefixesB = EVENT_TYPE_DOCTRINE_PREFILTER[eventTypeB];

  if (!prefixesA && !prefixesB) return null; // No pre-filter available

  const combined = new Set<string>();
  if (prefixesA) prefixesA.forEach((p) => combined.add(p));
  if (prefixesB) prefixesB.forEach((p) => combined.add(p));

  return Array.from(combined);
}

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

  // Step 2: Pre-filter by event type to reduce search volume
  const allowedPrefixes = getPreFilteredDoctrinePrefixes(eventTypeA, eventTypeB);

  // Step 3: Add event-specific doctrine rules (filtered if possible)
  const eventARules = getEventDoctrineRules(eventTypeA);
  const eventBRules = getEventDoctrineRules(eventTypeB);
  const allEventRules = [...new Set([...eventARules, ...eventBRules])];

  for (const ruleId of allEventRules) {
    // Avoid duplicates
    if (links.some((l) => l.doctrineRuleId === ruleId)) continue;

    // Apply pre-filter: skip rules that don't match allowed prefixes
    if (allowedPrefixes && !allowedPrefixes.some((prefix) => ruleId.startsWith(prefix))) {
      continue;
    }

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
