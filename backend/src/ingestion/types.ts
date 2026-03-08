// ============================================
// Court Access — Bulk Legal Corpus Loader Types
// Canonical type definitions for the ingestion pipeline.
// ============================================

// ---------------------------------------------------------------------------
// Corpus Types
// ---------------------------------------------------------------------------

export type CorpusType =
  | 'policy'
  | 'statute'
  | 'case_law'
  | 'transcript'
  | 'evidence'
  | 'investigative_report';

export type IngestionStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'paused';

export type BatchStatus = 'success' | 'failed' | 'skipped';

// ---------------------------------------------------------------------------
// Normalized Document
// ---------------------------------------------------------------------------

export interface NormalizedDocument {
  id: string;
  tenantId: string;
  title: string;
  content: string;
  jurisdiction: string;
  documentType: CorpusType;
  source: string;
  version: string;
  corpusName: string;
  sourceFile: string;
  contentHash: string;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Raw Document (pre-normalization)
// ---------------------------------------------------------------------------

export interface RawDocument {
  /** Original ID from source (optional) */
  id?: string;
  /** Title or heading */
  title?: string;
  /** Full text content */
  content?: string;
  /** Alternative field: body, text */
  body?: string;
  text?: string;
  /** Jurisdiction code or name */
  jurisdiction?: string;
  /** Document classification */
  type?: string;
  documentType?: string;
  /** Source reference */
  source?: string;
  /** Version string */
  version?: string;
  /** Any other fields from source */
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Ingestion Configuration
// ---------------------------------------------------------------------------

export interface IngestionConfig {
  corpusName: string;
  filePath: string;
  tenantId: string;
  batchSize: number;
  resume: boolean;
  dryRun: boolean;
  /** Use PostgreSQL COPY for large corpora (>100k records) */
  useCopy: boolean;
  /** Maximum concurrent batch workers */
  concurrency: number;
}

// ---------------------------------------------------------------------------
// Batch Job Payload
// ---------------------------------------------------------------------------

export interface BatchJobPayload {
  corpusName: string;
  batchNumber: number;
  documents: NormalizedDocument[];
  tenantId: string;
  useCopy: boolean;
  dryRun: boolean;
  /** Cumulative offset after this batch (from chunkBuilder endOffset) */
  cumulativeOffset: number;
}

// ---------------------------------------------------------------------------
// Ingestion Progress
// ---------------------------------------------------------------------------

export interface IngestionProgress {
  corpusName: string;
  fileName: string;
  lastProcessedOffset: number;
  recordsProcessed: number;
  totalRecords: number | null;
  status: IngestionStatus;
  startedAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Batch Result
// ---------------------------------------------------------------------------

export interface BatchResult {
  batchNumber: number;
  recordsInserted: number;
  recordsSkipped: number;
  durationMs: number;
  status: BatchStatus;
  errorMessage?: string;
}

// ---------------------------------------------------------------------------
// Ingestion Summary
// ---------------------------------------------------------------------------

export interface IngestionSummary {
  corpusName: string;
  fileName: string;
  totalRecords: number;
  recordsInserted: number;
  recordsSkipped: number;
  recordsFailed: number;
  totalBatches: number;
  totalDurationMs: number;
  averageBatchDurationMs: number;
  throughputPerMinute: number;
  status: IngestionStatus;
}
