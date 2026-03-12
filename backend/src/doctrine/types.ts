// ============================================
// Court Access — POST Training Doctrine Types
// Canonical type definitions for the doctrine
// intelligence pipeline.
// ============================================

// ---------------------------------------------------------------------------
// Source Types
// ---------------------------------------------------------------------------

export type DoctrineSourceType = 'POST' | 'DOJ' | 'AGENCY';

export type DoctrineCategory =
  | 'constitutional'
  | 'encounter'
  | 'detention'
  | 'search'
  | 'arrest'
  | 'miranda'
  | 'interrogation'
  | 'use_of_force'
  | 'pursuit'
  | 'evidence_presentation'
  | 'chain_of_custody'
  | 'testimony'
  | 'report_writing'
  | 'evidence_handling'
  | 'evidence_collection'
  | 'crime_scene'
  | 'patrol'
  | 'field_contact'
  | 'general';

export type DoctrineFlagType = 'violation' | 'concern' | 'compliant';

// ---------------------------------------------------------------------------
// Doctrine Rule — parsed from POST training manuals
// ---------------------------------------------------------------------------

export interface DoctrineRule {
  doctrineId: string;
  sourceType: DoctrineSourceType;
  sourceName: string;
  sourceVersion: string;
  domain: string;
  chapter: string;
  topic: string;
  ruleText: string;
  explanation: string | null;
  legalImplication: string | null;
  category: DoctrineCategory;
  keywords: string[];
  contentHash: string;
}

// ---------------------------------------------------------------------------
// Parsed Doctrine Chunk — raw output from PDF parser
// ---------------------------------------------------------------------------

export interface ParsedDoctrineChunk {
  source: string;
  chapter: string;
  topic: string;
  rule: string;
  explanation: string;
  legalImplication: string;
  category: DoctrineCategory;
  keywords: string[];
}

// ---------------------------------------------------------------------------
// Doctrine Match — result of matching evidence against doctrine
// ---------------------------------------------------------------------------

export interface DoctrineMatch {
  doctrineRule: DoctrineRule;
  similarityScore: number;
  effectiveSimilarity: number;
  flagType: DoctrineFlagType;
  flagDescription: string;
}

// ---------------------------------------------------------------------------
// Doctrine Compliance Result — full analysis of evidence text
// ---------------------------------------------------------------------------

export interface DoctrineComplianceResult {
  evidenceText: string;
  matches: DoctrineMatch[];
  totalRulesChecked: number;
  violations: DoctrineMatch[];
  concerns: DoctrineMatch[];
  compliant: DoctrineMatch[];
  overallCompliance: 'compliant' | 'concerns' | 'violations';
  analyzedAt: Date;
}

// ---------------------------------------------------------------------------
// Doctrine Search Options
// ---------------------------------------------------------------------------

export interface DoctrineSearchOptions {
  category?: DoctrineCategory;
  domain?: string;
  chapter?: string;
  maxResults?: number;
  minSimilarity?: number;
}

// ---------------------------------------------------------------------------
// Doctrine Ingestion Result
// ---------------------------------------------------------------------------

export interface DoctrineIngestionResult {
  sourceName: string;
  totalChunks: number;
  rulesCreated: number;
  rulesDuplicate: number;
  embeddingsGenerated: number;
  durationMs: number;
  errors: Array<{ chunk: string; error: string }>;
}

// ---------------------------------------------------------------------------
// Litigation Intelligence — Doctrine-to-Litigation Mapping
// ---------------------------------------------------------------------------

export type MotionType =
  | 'motion_to_suppress'
  | 'motion_to_dismiss'
  | 'motion_in_limine'
  | 'motion_for_discovery'
  | 'motion_for_sanctions'
  | 'motion_to_compel'
  | 'motion_for_summary_judgment'
  | 'motion_for_new_trial'
  | 'habeas_corpus';

export interface LitigationMotion {
  type: MotionType;
  title: string;
  basis: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

export interface InvestigativeTask {
  task: string;
  description: string;
  urgency: 'immediate' | 'standard' | 'low';
}

export interface ExpertRecommendation {
  expertType: string;
  purpose: string;
  relevance: string;
}

export interface LitigationRecommendation {
  motions: LitigationMotion[];
  investigativeTasks: InvestigativeTask[];
  expertRecommendations: ExpertRecommendation[];
  strategySummary: string;
}

export interface DoctrineToLitigationMapping {
  domain: string;
  category: DoctrineCategory;
  flagType: DoctrineFlagType;
  keywordTriggers: string[];
  motions: LitigationMotion[];
  investigativeTasks: InvestigativeTask[];
  expertRecommendations: ExpertRecommendation[];
}

// Extend DoctrineMatch with optional litigation recommendations
export interface DoctrineMatchWithLitigation extends DoctrineMatch {
  litigationRecommendation?: LitigationRecommendation;
}

// Extended compliance result with litigation intelligence
export interface DoctrineComplianceResultWithLitigation extends DoctrineComplianceResult {
  litigationSummary?: LitigationRecommendation;
}

// ---------------------------------------------------------------------------
// Doctrine Statistics
// ---------------------------------------------------------------------------

export interface DoctrineStats {
  totalRules: number;
  totalEmbeddings: number;
  rulesByCategory: Record<string, number>;
  rulesBySource: Record<string, number>;
  rulesByDomain: Record<string, number>;
  totalMatches: number;
  lastIngestionAt: Date | null;
}
