// ============================================================================
// Criminal Liability Discovery Engine — canonical types
// Evidence-governed classification; UNKNOWN is acceptable
// ============================================================================

import type { AuditMetadata, ExtractionConfidence, FieldValue } from '../knowledgeGraph/types.ts';

export const CLASSIFIER_VERSION = '1.0.0';

export type StatutoryClassification =
  | 'criminal_offense'
  | 'criminal_penalty'
  | 'criminal_enhancement'
  | 'sentencing_provision'
  | 'definitions'
  | 'procedure'
  | 'evidence'
  | 'regulatory_incorporation'
  | 'licensing'
  | 'administrative'
  | 'civil'
  | 'tax'
  | 'environmental'
  | 'cross_reference'
  | 'unknown';

export type CriminalLiabilityPath =
  | 'direct_offense_language'
  | 'penalty_clause'
  | 'cross_reference_to_penal'
  | 'regulatory_incorporation'
  | 'administrative_enforcement'
  | 'licensing_violation'
  | 'failure_to_comply'
  | 'delegated_rulemaking'
  | 'statutory_incorporation';

export type DiscoveryPriority = 'critical' | 'high' | 'medium' | 'low' | 'deferred';

export interface ClassificationEvidence {
  signal: string;
  matchedText: string;
  confidence: ExtractionConfidence;
}

export interface StatuteClassificationRecord {
  id: string;
  sourceStatuteId: string;
  code: string;
  section: string;
  classification: FieldValue<StatutoryClassification>;
  liabilityPaths: FieldValue<CriminalLiabilityPath[]>;
  criminalLiabilityLikely: boolean;
  discoveryPriority: DiscoveryPriority;
  priorityScore: number;
  evidence: ClassificationEvidence[];
  confirmedOffense: boolean;
  manualReviewRequired: boolean;
  audit: AuditMetadata;
}

export interface LiabilityDiscoveryMetrics {
  generatedAt: string;
  classifierVersion: string;
  californiaCodesDiscovered: number;
  californiaCodesTotal: number;
  codesAnalyzed: number;
  statutesClassified: number;
  likelyCriminalStatutes: number;
  confirmedCriminalOffenses: number;
  regulatoryIncorporationCandidates: number;
  manualReviewQueue: number;
  unknownClassifications: number;
  byClassification: Record<StatutoryClassification, number>;
  byPriority: Record<DiscoveryPriority, number>;
  byCode: Record<string, { classified: number; likelyCriminal: number; confirmedOffenses: number }>;
}
