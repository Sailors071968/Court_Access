// ============================================================================
// California Criminal Knowledge Graph — canonical types
// Every fact traces to a source statute via sourceStatuteId
// ============================================================================

import type { StatuteHierarchy } from '../types.ts';

export type ExtractionConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';

export type FieldValue<T> = {
  value: T | 'UNKNOWN';
  confidence: ExtractionConfidence;
  sourceSpan?: { start: number; end: number };
  sourceText?: string;
};

export interface AuditMetadata {
  extractedAt: string;
  extractorVersion: string;
  sourceStatuteId: string;
  sourceUrl: string;
  contentHash: string;
  parseStatus: 'success' | 'rejected' | 'partial';
  rejectionReason?: string;
}

export interface StatuteSubdivision {
  label: string;
  text: string;
  children: StatuteSubdivision[];
}

export interface StatuteRecord {
  id: string;
  code: string;
  section: string;
  title: string;
  hierarchy: StatuteHierarchy;
  fullText: string;
  subdivisions: StatuteSubdivision[];
  sourceUrl: string;
  retrievedAt: string;
  contentHash: string;
  effectiveDate: string | 'UNKNOWN';
  flags: string[];
  audit: AuditMetadata;
}

export interface OffenseRecord {
  id: string;
  sourceStatuteId: string;
  code: string;
  section: string;
  name: FieldValue<string>;
  classification: FieldValue<'felony' | 'misdemeanor' | 'infraction' | 'wobble' | 'UNKNOWN'>;
  actor: FieldValue<string>;
  conduct: FieldValue<string>;
  object: FieldValue<string>;
  result: FieldValue<string>;
  victim: FieldValue<string>;
  penalty: FieldValue<string>;
  audit: AuditMetadata;
}

export interface ElementRecord {
  id: string;
  sourceStatuteId: string;
  offenseId: string;
  label: FieldValue<string>;
  description: FieldValue<string>;
  required: boolean;
  audit: AuditMetadata;
}

export interface MensReaRecord {
  id: string;
  sourceStatuteId: string;
  offenseId: string;
  type: FieldValue<'specific' | 'general' | 'strict_liability' | 'UNKNOWN'>;
  terms: FieldValue<string[]>;
  description: FieldValue<string>;
  audit: AuditMetadata;
}

export interface ExceptionRecord {
  id: string;
  sourceStatuteId: string;
  offenseId?: string;
  text: FieldValue<string>;
  audit: AuditMetadata;
}

export interface DefenseRecord {
  id: string;
  sourceStatuteId: string;
  offenseId?: string;
  text: FieldValue<string>;
  audit: AuditMetadata;
}

export interface CrossReferenceRecord {
  id: string;
  sourceStatuteId: string;
  targetCode: string;
  targetSection: string;
  referenceType: 'section' | 'code' | 'regulatory' | 'UNKNOWN';
  context: FieldValue<string>;
  audit: AuditMetadata;
}

export interface RegulatoryIncorporationRecord {
  id: string;
  sourceStatuteId: string;
  incorporatedAuthority: FieldValue<string>;
  context: FieldValue<string>;
  audit: AuditMetadata;
}

export interface CalcrimLinkRecord {
  id: string;
  sourceStatuteId: string;
  offenseId: string;
  instructionNumber: FieldValue<number>;
  instructionTitle: FieldValue<string>;
  confidence: ExtractionConfidence;
  audit: AuditMetadata;
}

export interface AuthorityRecord {
  id: string;
  sourceStatuteId: string;
  authorityType: 'statute' | 'regulation' | 'case_law' | 'constitutional' | 'UNKNOWN';
  citation: FieldValue<string>;
  context: FieldValue<string>;
  audit: AuditMetadata;
}

export interface CriminalKnowledgeBundle {
  statute: StatuteRecord;
  offenses: OffenseRecord[];
  elements: ElementRecord[];
  mensRea: MensReaRecord[];
  exceptions: ExceptionRecord[];
  defenses: DefenseRecord[];
  crossReferences: CrossReferenceRecord[];
  regulatoryIncorporations: RegulatoryIncorporationRecord[];
  calcrimLinks: CalcrimLinkRecord[];
  authorities: AuthorityRecord[];
}

export interface ParseRejection {
  code: string;
  section: string;
  sourceUrl: string;
  reason: string;
  retrievedAt: string;
  contentHash: string;
}

export interface RepositoryCoverageMetrics {
  repository: string;
  totalRecords: number;
  unknownFieldCount: number;
  unknownFieldRate: number;
  statutesCovered: number;
  lastUpdatedAt: string;
}

export interface KnowledgeGraphCoverageReport {
  generatedAt: string;
  extractorVersion: string;
  statutes: RepositoryCoverageMetrics;
  offenses: RepositoryCoverageMetrics;
  elements: RepositoryCoverageMetrics;
  mensRea: RepositoryCoverageMetrics;
  exceptions: RepositoryCoverageMetrics;
  defenses: RepositoryCoverageMetrics;
  crossReferences: RepositoryCoverageMetrics;
  regulatoryIncorporations: RepositoryCoverageMetrics;
  calcrimLinks: RepositoryCoverageMetrics;
  authorities: RepositoryCoverageMetrics;
  criminalOffensesIdentified: number;
  calcrimCoveragePercent: number;
  parsingFailures: number;
  manualReviewCandidates: number;
}
