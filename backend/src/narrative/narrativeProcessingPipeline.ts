// ============================================================================
// Narrative Deconstruction Engine — Processing Pipeline
// Defines job interfaces, queue configs, and enqueue functions for
// the 4-worker narrative analysis pipeline.
// ============================================================================

import { QUEUE_CONFIGS, getQueue } from '../workers/queueManager.js';

// ---------------------------------------------------------------------------
// Pipeline Job Types
// ---------------------------------------------------------------------------

export interface ClaimExtractionJob {
  evidenceId: string;
  caseId: string;
  tenantId: string;
  fileName: string;
  evidenceType: string;
  s3Key: string;
}

export interface ClaimNormalizationJob {
  caseId: string;
  tenantId: string;
  triggerEvidenceId: string;
}

export interface EvidenceValidationJob {
  caseId: string;
  tenantId: string;
  triggerClaimId?: string;
}

export interface ImpeachmentAnalysisJob {
  caseId: string;
  tenantId: string;
  rebuild?: boolean;
}

// ---------------------------------------------------------------------------
// Register Queue Configs
// ---------------------------------------------------------------------------

if (!QUEUE_CONFIGS.narrativeClaimExtraction) {
  QUEUE_CONFIGS.narrativeClaimExtraction = {
    name: 'narrative-claim-extraction',
    concurrency: 3,
    maxRetries: 3,
    retryBackoffMs: 10_000,
    timeoutMs: 300_000,
    enabled: true,
    description: 'Extract atomic factual claims from police reports and narratives',
  };
}

if (!QUEUE_CONFIGS.narrativeClaimNormalization) {
  QUEUE_CONFIGS.narrativeClaimNormalization = {
    name: 'narrative-claim-normalization',
    concurrency: 3,
    maxRetries: 3,
    retryBackoffMs: 10_000,
    timeoutMs: 180_000,
    enabled: true,
    description: 'Normalize claims into standardized ontology events',
  };
}

if (!QUEUE_CONFIGS.narrativeEvidenceValidation) {
  QUEUE_CONFIGS.narrativeEvidenceValidation = {
    name: 'narrative-evidence-validation',
    concurrency: 2,
    maxRetries: 2,
    retryBackoffMs: 15_000,
    timeoutMs: 300_000,
    enabled: true,
    description: 'Validate claims against evidence sources (bodycam, witnesses, timeline)',
  };
}

if (!QUEUE_CONFIGS.narrativeImpeachmentAnalysis) {
  QUEUE_CONFIGS.narrativeImpeachmentAnalysis = {
    name: 'narrative-impeachment-analysis',
    concurrency: 2,
    maxRetries: 2,
    retryBackoffMs: 15_000,
    timeoutMs: 300_000,
    enabled: true,
    description: 'Detect impeachment candidates from contradicted claims',
  };
}

// ---------------------------------------------------------------------------
// Enqueue Functions
// ---------------------------------------------------------------------------

export async function enqueueClaimExtraction(job: ClaimExtractionJob): Promise<void> {
  const queue = getQueue<ClaimExtractionJob>('narrativeClaimExtraction');
  await queue.add('claim-extract', job, {
    jobId: `claim-extract-${job.evidenceId}`,
    priority: 1,
  });
  console.log(`[NarrativePipeline] Enqueued claim extraction for evidence ${job.evidenceId}`);
}

export async function enqueueClaimNormalization(job: ClaimNormalizationJob): Promise<void> {
  const queue = getQueue<ClaimNormalizationJob>('narrativeClaimNormalization');
  await queue.add('claim-normalize', job, {
    jobId: `claim-normalize-${job.caseId}-${Date.now()}`,
  });
  console.log(`[NarrativePipeline] Enqueued claim normalization for case ${job.caseId}`);
}

export async function enqueueEvidenceValidation(job: EvidenceValidationJob): Promise<void> {
  const queue = getQueue<EvidenceValidationJob>('narrativeEvidenceValidation');
  await queue.add('evidence-validate', job, {
    jobId: `evidence-validate-${job.caseId}-${Date.now()}`,
  });
  console.log(`[NarrativePipeline] Enqueued evidence validation for case ${job.caseId}`);
}

export async function enqueueImpeachmentAnalysis(job: ImpeachmentAnalysisJob): Promise<void> {
  const queue = getQueue<ImpeachmentAnalysisJob>('narrativeImpeachmentAnalysis');
  await queue.add('impeachment-analyze', job, {
    jobId: `impeachment-${job.caseId}-${Date.now()}`,
  });
  console.log(`[NarrativePipeline] Enqueued impeachment analysis for case ${job.caseId}`);
}
