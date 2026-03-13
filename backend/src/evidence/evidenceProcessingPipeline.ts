// ============================================================================
// Core Evidence System — Evidence Processing Pipeline (Part 5)
// Enqueues evidence for ingestion, normalization, OCR, video segmentation,
// and graph node creation. All processing runs through queues.
// ============================================================================

import { QUEUE_CONFIGS, getQueue } from '../workers/queueManager.js';

// ---------------------------------------------------------------------------
// Pipeline Job Types
// ---------------------------------------------------------------------------

export interface EvidenceIngestionJob {
  evidenceId: string;
  caseId: string;
  tenantId: string;
  fileName: string;
  evidenceType: string;
  s3Key: string;
  size: number;
  isVideo: boolean;
}

export interface VideoSegmentJob {
  evidenceId: string;
  caseId: string;
  tenantId: string;
  s3Key: string;
  fileName: string;
}

export interface DocumentAnalysisJob {
  evidenceId: string;
  caseId: string;
  tenantId: string;
  s3Key: string;
  fileName: string;
  evidenceType: string;
  pageCount?: number;
}

// ---------------------------------------------------------------------------
// Register Queue Configs (Part 14)
// ---------------------------------------------------------------------------

// Extend QUEUE_CONFIGS with evidence processing queues
if (!QUEUE_CONFIGS.evidenceIngestion) {
  QUEUE_CONFIGS.evidenceIngestion = {
    name: 'evidence-ingestion-queue',
    concurrency: 3,
    maxRetries: 3,
    retryBackoffMs: 10_000,
    timeoutMs: 300_000,
    enabled: true,
    description: 'Initial evidence ingestion: file validation, type detection, routing',
  };
}

if (!QUEUE_CONFIGS.videoSegment) {
  QUEUE_CONFIGS.videoSegment = {
    name: 'video-segment-queue',
    concurrency: 2,
    maxRetries: 2,
    retryBackoffMs: 30_000,
    timeoutMs: 600_000, // 10 minutes per video
    enabled: true,
    description: 'Video segmentation: split into 30-second chunks for analysis',
  };
}

if (!QUEUE_CONFIGS.documentAnalysis) {
  QUEUE_CONFIGS.documentAnalysis = {
    name: 'document-analysis-queue',
    concurrency: 3,
    maxRetries: 3,
    retryBackoffMs: 10_000,
    timeoutMs: 180_000,
    enabled: true,
    description: 'Document analysis: normalization, OCR, multiplex detection',
  };
}

if (!QUEUE_CONFIGS.contradictionAnalysis) {
  QUEUE_CONFIGS.contradictionAnalysis = {
    name: 'contradiction-analysis-queue',
    concurrency: 2,
    maxRetries: 2,
    retryBackoffMs: 15_000,
    timeoutMs: 300_000,
    enabled: true,
    description: 'Cross-evidence contradiction detection and analysis',
  };
}

// ---------------------------------------------------------------------------
// Enqueue Functions
// ---------------------------------------------------------------------------

export async function enqueueEvidenceIngestion(job: EvidenceIngestionJob): Promise<void> {
  try {
    const queue = getQueue<EvidenceIngestionJob>('evidenceIngestion');
    await queue.add('evidence-ingest', job, {
      jobId: `evidence-${job.evidenceId}`,
      priority: job.isVideo ? 2 : 1, // Documents processed first
    });
    console.log(`[EvidencePipeline] Enqueued ingestion for evidence ${job.evidenceId} (${job.evidenceType})`);
  } catch (err) {
    console.error('[EvidencePipeline] Failed to enqueue evidence ingestion:', err);
  }
}

export async function enqueueVideoSegmentation(job: VideoSegmentJob): Promise<void> {
  try {
    const queue = getQueue<VideoSegmentJob>('videoSegment');
    await queue.add('video-segment', job, {
      jobId: `video-segment-${job.evidenceId}`,
    });
    console.log(`[EvidencePipeline] Enqueued video segmentation for evidence ${job.evidenceId}`);
  } catch (err) {
    console.error('[EvidencePipeline] Failed to enqueue video segmentation:', err);
  }
}

export async function enqueueDocumentAnalysis(job: DocumentAnalysisJob): Promise<void> {
  try {
    const queue = getQueue<DocumentAnalysisJob>('documentAnalysis');
    await queue.add('document-analyze', job, {
      jobId: `doc-analysis-${job.evidenceId}`,
    });
    console.log(`[EvidencePipeline] Enqueued document analysis for evidence ${job.evidenceId}`);
  } catch (err) {
    console.error('[EvidencePipeline] Failed to enqueue document analysis:', err);
  }
}
