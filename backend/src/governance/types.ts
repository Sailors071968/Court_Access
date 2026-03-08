// ============================================
// Court Access — Corpus Governance Types
// Canonical type definitions for the governance layer.
// ============================================

// ---------------------------------------------------------------------------
// Corpus Registry
// ---------------------------------------------------------------------------

export type CorpusIngestionStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export interface CorpusRegistryEntry {
  id: string;
  corpusName: string;
  jurisdiction: string;
  sourceAuthority: string;
  version: string;
  releaseDate: Date | null;
  ingestionStatus: CorpusIngestionStatus;
  totalDocuments: number;
  totalBytes: number;
  checksum: string | null;
  metadata: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RegisterCorpusInput {
  corpusName: string;
  jurisdiction: string;
  sourceAuthority: string;
  version: string;
  releaseDate?: Date;
  checksum?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateCorpusInput {
  ingestionStatus?: CorpusIngestionStatus;
  totalDocuments?: number;
  totalBytes?: number;
  checksum?: string;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Corpus Lock
// ---------------------------------------------------------------------------

export interface CorpusLock {
  id: string;
  corpusName: string;
  workerId: string;
  lockedAt: Date;
  expiresAt: Date;
  metadata: string | null;
}

export interface AcquireLockInput {
  corpusName: string;
  workerId: string;
  /** Lock duration in milliseconds (default: 30 minutes) */
  durationMs?: number;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Governance Pipeline Config
// ---------------------------------------------------------------------------

export interface GovernedIngestionConfig {
  corpusName: string;
  jurisdiction: string;
  sourceAuthority: string;
  version: string;
  filePath: string;
  tenantId: string;
  batchSize: number;
  resume: boolean;
  dryRun: boolean;
  useCopy: boolean;
  concurrency: number;
  /** Lock duration in milliseconds (default: 30 minutes) */
  lockDurationMs?: number;
  releaseDate?: Date;
  checksum?: string;
}

// ---------------------------------------------------------------------------
// Duplicate Report
// ---------------------------------------------------------------------------

export interface DuplicateReport {
  corpusName: string;
  version: string;
  totalDocuments: number;
  duplicatesSkipped: number;
  newDocuments: number;
  updatedDocuments: number;
}

// ---------------------------------------------------------------------------
// Version Diff
// ---------------------------------------------------------------------------

export interface VersionDiff {
  corpusName: string;
  fromVersion: string;
  toVersion: string;
  added: number;
  removed: number;
  modified: number;
  unchanged: number;
}
