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
