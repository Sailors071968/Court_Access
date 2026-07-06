// ============================================================================
// Criminal Liability Discovery Engine — deterministic statutory classification
// Every California Code is eligible; classification is evidence-based
// ============================================================================

import { createHash } from 'node:crypto';
import type { AuditMetadata, ExtractionConfidence, FieldValue, StatuteRecord } from '../knowledgeGraph/types.ts';
import type {
  ClassificationEvidence,
  CriminalLiabilityPath,
  DiscoveryPriority,
  StatuteClassificationRecord,
  StatutoryClassification,
} from './types.ts';
import { CLASSIFIER_VERSION } from './types.ts';

interface SignalRule {
  signal: string;
  pattern: RegExp;
  confidence: ExtractionConfidence;
  liabilityPath?: CriminalLiabilityPath;
  classificationHint?: StatutoryClassification;
}

const LIABILITY_SIGNALS: SignalRule[] = [
  {
    signal: 'guilty_of_offense',
    pattern: /\b(?:is|be)\s+guilty\s+of\b/i,
    confidence: 'HIGH',
    liabilityPath: 'direct_offense_language',
    classificationHint: 'criminal_offense',
  },
  {
    signal: 'commits_crime',
    pattern: /\bcommits?\s+(?:a\s+)?(?:crime|felony|misdemeanor|infraction)\b/i,
    confidence: 'HIGH',
    liabilityPath: 'direct_offense_language',
    classificationHint: 'criminal_offense',
  },
  {
    signal: 'punishable_language',
    pattern: /\b(?:shall\s+be\s+punished|is\s+punishable)\b/i,
    confidence: 'HIGH',
    liabilityPath: 'penalty_clause',
    classificationHint: 'criminal_penalty',
  },
  {
    signal: 'penalty_clause',
    pattern: /\b(?:punish(?:ed|able|ment)?\s+by|imprisonment\s+in|(?:a\s+)?(?:felony|misdemeanor|infraction))\b/i,
    confidence: 'MEDIUM',
    liabilityPath: 'penalty_clause',
    classificationHint: 'criminal_penalty',
  },
  {
    signal: 'enhancement_language',
    pattern: /\b(?:enhancement|increased\s+punishment|additional\s+(?:term|penalty|sentence))\b/i,
    confidence: 'HIGH',
    liabilityPath: 'penalty_clause',
    classificationHint: 'criminal_enhancement',
  },
  {
    signal: 'sentencing_provision',
    pattern: /\b(?:sentence|sentencing|term\s+of\s+imprisonment|consecutive\s+sentence)\b/i,
    confidence: 'MEDIUM',
    classificationHint: 'sentencing_provision',
  },
  {
    signal: 'penal_code_cross_ref',
    pattern: /\b(?:penal\s+code|(?:PEN|PC)\s+(?:section\s+)?\d)/i,
    confidence: 'MEDIUM',
    liabilityPath: 'cross_reference_to_penal',
    classificationHint: 'cross_reference',
  },
  {
    signal: 'regulatory_incorporation',
    pattern: /\b(?:as\s+(?:defined|set\s+forth|provided)\s+in|pursuant\s+to|in\s+accordance\s+with)\s+(?:the\s+)?(?:regulations?|rules?|standards?)\b/i,
    confidence: 'HIGH',
    liabilityPath: 'regulatory_incorporation',
    classificationHint: 'regulatory_incorporation',
  },
  {
    signal: 'statutory_incorporation',
    pattern: /\b(?:incorporat(?:ed|es|ion)\s+by\s+reference|as\s+set\s+forth\s+in\s+(?:section|chapter|part))\b/i,
    confidence: 'MEDIUM',
    liabilityPath: 'statutory_incorporation',
    classificationHint: 'regulatory_incorporation',
  },
  {
    signal: 'administrative_enforcement',
    pattern: /\b(?:misdemeanor|criminal\s+penalt(?:y|ies)|(?:shall\s+be\s+)?guilty\s+of\s+(?:a\s+)?misdemeanor).*(?:department|agency|board|commission)/i,
    confidence: 'MEDIUM',
    liabilityPath: 'administrative_enforcement',
    classificationHint: 'administrative',
  },
  {
    signal: 'licensing_violation',
    pattern: /\b(?:license|permit|certificate|registration).*(?:revok|suspend|deni|violat|unlawful|misdemeanor|guilty)/i,
    confidence: 'MEDIUM',
    liabilityPath: 'licensing_violation',
    classificationHint: 'licensing',
  },
  {
    signal: 'failure_to_comply',
    pattern: /\b(?:failure\s+to\s+(?:comply|obey|follow)|violation\s+of\s+this\s+(?:section|chapter|code)).*(?:misdemeanor|guilty|punish)/i,
    confidence: 'HIGH',
    liabilityPath: 'failure_to_comply',
    classificationHint: 'criminal_offense',
  },
  {
    signal: 'delegated_rulemaking',
    pattern: /\b(?:adopt\s+regulations|promulgate\s+rules|delegat(?:e|ed)\s+(?:to|authority))\b/i,
    confidence: 'MEDIUM',
    liabilityPath: 'delegated_rulemaking',
    classificationHint: 'administrative',
  },
  {
    signal: 'definition_language',
    pattern: /\b(?:as\s+used\s+in\s+(?:this|the)|shall\s+mean|means\s+(?:any|a|an|the))\b/i,
    confidence: 'HIGH',
    classificationHint: 'definitions',
  },
  {
    signal: 'procedure_language',
    pattern: /\b(?:procedure|hearing|court\s+shall|jurisdiction|venue|appeal|petition|motion)\b/i,
    confidence: 'MEDIUM',
    classificationHint: 'procedure',
  },
  {
    signal: 'evidence_language',
    pattern: /\b(?:evidence|admissible|hearsay|presumption|burden\s+of\s+proof|testimony)\b/i,
    confidence: 'MEDIUM',
    classificationHint: 'evidence',
  },
  {
    signal: 'civil_language',
    pattern: /\b(?:civil\s+action|civil\s+liability|liable\s+in\s+a\s+civil|damages|injunction)\b/i,
    confidence: 'HIGH',
    classificationHint: 'civil',
  },
  {
    signal: 'tax_language',
    pattern: /\b(?:tax|taxation|revenue\s+and\s+taxation|assessment|levy)\b/i,
    confidence: 'MEDIUM',
    classificationHint: 'tax',
  },
  {
    signal: 'environmental_language',
    pattern: /\b(?:pollut(?:ion|ant)|environmental|discharge|hazardous\s+waste|air\s+quality|water\s+quality)\b/i,
    confidence: 'MEDIUM',
    classificationHint: 'environmental',
  },
  {
    signal: 'licensing_general',
    pattern: /\b(?:license|permit|certificate\s+of|registration\s+(?:shall|required|issued))\b/i,
    confidence: 'LOW',
    classificationHint: 'licensing',
  },
  {
    signal: 'administrative_general',
    pattern: /\b(?:department|agency|board|commission|director\s+shall|secretary\s+shall)\b/i,
    confidence: 'LOW',
    classificationHint: 'administrative',
  },
  {
    signal: 'cross_reference_only',
    pattern: /^(?:see\s+)?(?:section|chapter|part)\s+\d/i,
    confidence: 'LOW',
    classificationHint: 'cross_reference',
  },
];

const CLASSIFICATION_PRIORITY: StatutoryClassification[] = [
  'criminal_offense',
  'criminal_penalty',
  'criminal_enhancement',
  'sentencing_provision',
  'regulatory_incorporation',
  'licensing',
  'definitions',
  'evidence',
  'procedure',
  'administrative',
  'environmental',
  'tax',
  'civil',
  'cross_reference',
  'unknown',
];

function entityId(...parts: string[]): string {
  return createHash('sha256').update(parts.join(':')).digest('hex').slice(0, 32);
}

function field<T>(value: T | 'UNKNOWN', confidence: ExtractionConfidence, sourceText?: string): FieldValue<T> {
  return { value, confidence, sourceText };
}

function cloneAudit(statute: StatuteRecord): AuditMetadata {
  return {
    ...statute.audit,
    extractedAt: new Date().toISOString(),
    extractorVersion: CLASSIFIER_VERSION,
    parseStatus: statute.audit.parseStatus,
  };
}

export function detectClassificationSignals(text: string): ClassificationEvidence[] {
  const evidence: ClassificationEvidence[] = [];
  for (const rule of LIABILITY_SIGNALS) {
    const match = text.match(rule.pattern);
    if (match) {
      evidence.push({
        signal: rule.signal,
        matchedText: match[0].slice(0, 200),
        confidence: rule.confidence,
      });
    }
  }
  return evidence;
}

export function detectLiabilityPaths(text: string, evidence: ClassificationEvidence[]): CriminalLiabilityPath[] {
  const paths = new Set<CriminalLiabilityPath>();
  for (const rule of LIABILITY_SIGNALS) {
    if (!rule.liabilityPath) continue;
    if (rule.pattern.test(text)) paths.add(rule.liabilityPath);
  }
  for (const ev of evidence) {
    const rule = LIABILITY_SIGNALS.find((r) => r.signal === ev.signal);
    if (rule?.liabilityPath) paths.add(rule.liabilityPath);
  }
  return [...paths];
}

function scoreClassificationHints(
  text: string,
  evidence: ClassificationEvidence[],
): Map<StatutoryClassification, number> {
  const scores = new Map<StatutoryClassification, number>();

  for (const rule of LIABILITY_SIGNALS) {
    if (!rule.classificationHint) continue;
    const match = text.match(rule.pattern);
    if (!match) continue;
    const weight = rule.confidence === 'HIGH' ? 3 : rule.confidence === 'MEDIUM' ? 2 : 1;
    scores.set(rule.classificationHint, (scores.get(rule.classificationHint) ?? 0) + weight);
  }

  if (evidence.some((e) => e.signal === 'guilty_of_offense' || e.signal === 'commits_crime')) {
    scores.set('criminal_offense', (scores.get('criminal_offense') ?? 0) + 5);
  }

  return scores;
}

export function classifyStatutoryType(
  text: string,
  evidence: ClassificationEvidence[],
): FieldValue<StatutoryClassification> {
  const scores = scoreClassificationHints(text, evidence);
  if (scores.size === 0) return field('unknown', 'UNKNOWN');

  let best: StatutoryClassification = 'unknown';
  let bestScore = 0;
  for (const classification of CLASSIFICATION_PRIORITY) {
    const score = scores.get(classification) ?? 0;
    if (score > bestScore) {
      bestScore = score;
      best = classification;
    }
  }

  const confidence: ExtractionConfidence =
    bestScore >= 5 ? 'HIGH' : bestScore >= 3 ? 'MEDIUM' : bestScore >= 1 ? 'LOW' : 'UNKNOWN';

  const topEvidence = evidence.find((e) => {
    const rule = LIABILITY_SIGNALS.find((r) => r.signal === e.signal);
    return rule?.classificationHint === best;
  });

  return field(best, confidence, topEvidence?.matchedText);
}

export function computeDiscoveryPriority(
  classification: StatutoryClassification,
  liabilityPaths: CriminalLiabilityPath[],
  confirmedOffense: boolean,
): { priority: DiscoveryPriority; score: number } {
  if (confirmedOffense) return { priority: 'critical', score: 100 };

  if (classification === 'criminal_offense' || liabilityPaths.includes('direct_offense_language')) {
    return { priority: 'critical', score: 90 };
  }
  if (classification === 'criminal_penalty' || liabilityPaths.includes('penalty_clause')) {
    return { priority: 'high', score: 75 };
  }
  if (
    classification === 'regulatory_incorporation' ||
    liabilityPaths.includes('regulatory_incorporation') ||
    liabilityPaths.includes('statutory_incorporation')
  ) {
    return { priority: 'high', score: 70 };
  }
  if (classification === 'criminal_enhancement') return { priority: 'high', score: 65 };
  if (
    liabilityPaths.includes('licensing_violation') ||
    liabilityPaths.includes('failure_to_comply') ||
    liabilityPaths.includes('administrative_enforcement')
  ) {
    return { priority: 'medium', score: 50 };
  }
  if (classification === 'licensing' || classification === 'administrative') {
    return { priority: 'low', score: 25 };
  }
  if (classification === 'definitions' || classification === 'civil') {
    return { priority: 'low', score: 15 };
  }
  if (classification === 'unknown' && liabilityPaths.length > 0) {
    return { priority: 'medium', score: 40 };
  }
  return { priority: 'deferred', score: 5 };
}

export function isCriminalLiabilityLikely(
  classification: StatutoryClassification,
  liabilityPaths: CriminalLiabilityPath[],
  confirmedOffense: boolean,
): boolean {
  if (confirmedOffense) return true;
  if (classification === 'criminal_offense' || classification === 'criminal_penalty') return true;
  if (classification === 'criminal_enhancement') return true;
  if (classification === 'regulatory_incorporation' && liabilityPaths.length > 0) return true;
  const criminalPaths: CriminalLiabilityPath[] = [
    'direct_offense_language',
    'penalty_clause',
    'licensing_violation',
    'failure_to_comply',
    'administrative_enforcement',
  ];
  return liabilityPaths.some((p) => criminalPaths.includes(p));
}

export function requiresManualReview(
  classification: FieldValue<StatutoryClassification>,
  liabilityPaths: CriminalLiabilityPath[],
  confirmedOffense: boolean,
): boolean {
  if (classification.value === 'unknown' && liabilityPaths.length > 0) return true;
  if (isCriminalLiabilityLikely(classification.value as StatutoryClassification, liabilityPaths, confirmedOffense) && !confirmedOffense) {
    return true;
  }
  if (classification.confidence === 'LOW' || classification.confidence === 'UNKNOWN') {
    return liabilityPaths.length > 0;
  }
  return false;
}

export interface ClassifyStatuteOptions {
  confirmedOffenseCount?: number;
}

export function classifyStatute(
  statute: StatuteRecord,
  options?: ClassifyStatuteOptions,
): StatuteClassificationRecord {
  const text = statute.fullText;
  const evidence = detectClassificationSignals(text);
  const liabilityPaths = detectLiabilityPaths(text, evidence);
  const classification = classifyStatutoryType(text, evidence);
  const confirmedOffense = (options?.confirmedOffenseCount ?? 0) > 0;
  const { priority, score } = computeDiscoveryPriority(
    classification.value as StatutoryClassification,
    liabilityPaths,
    confirmedOffense,
  );
  const criminalLiabilityLikely = isCriminalLiabilityLikely(
    classification.value as StatutoryClassification,
    liabilityPaths,
    confirmedOffense,
  );

  return {
    id: entityId(statute.id, 'classification'),
    sourceStatuteId: statute.id,
    code: statute.code,
    section: statute.section,
    classification,
    liabilityPaths: field(liabilityPaths.length ? liabilityPaths : 'UNKNOWN', liabilityPaths.length ? 'HIGH' : 'UNKNOWN'),
    criminalLiabilityLikely,
    discoveryPriority: priority,
    priorityScore: score,
    evidence,
    confirmedOffense,
    manualReviewRequired: requiresManualReview(classification, liabilityPaths, confirmedOffense),
    audit: cloneAudit(statute),
  };
}

/** Used by intelligence extractor — offense extraction gate */
export function shouldExtractOffense(text: string): boolean {
  const evidence = detectClassificationSignals(text);
  const paths = detectLiabilityPaths(text, evidence);
  const classification = classifyStatutoryType(text, evidence);

  if (paths.includes('direct_offense_language')) return true;
  if (classification.value === 'criminal_offense') return true;
  if (/\b(?:is|be)\s+guilty\s+of\b/i.test(text)) return true;
  if (/\bcommits?\s+(?:a\s+)?(?:crime|felony|misdemeanor)/i.test(text)) return true;
  if (/\bshall\s+be\s+punished\b/i.test(text) && /\bfor\b/i.test(text)) return true;
  return false;
}

export { CLASSIFIER_VERSION };
