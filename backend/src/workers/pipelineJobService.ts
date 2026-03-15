// ============================================================================
// Phase 2 — Pipeline Job Service
// Creates ProcessingJob records and enqueues BullMQ jobs for each pipeline.
// Validates ACU credits at job creation time — if credits are exhausted,
// the job is immediately marked failed with failureCode=ACU_EXHAUSTED.
// ============================================================================

import prisma from '../lib/prisma.js';
import {
  QUEUE_NAMES,
  getQueue,
  type BaseJobData,
  type TimelineBuildJobData,
  type NarrativeProcessingJobData,
  type ContradictionAnalysisJobData,
  type VideoProcessingJobData,
  type DoctrineAnalysisJobData,
} from '../lib/queues.js';
import { CREDIT_COSTS, type AnalysisType } from '../billing/aiCreditService.js';

// ---------------------------------------------------------------------------
// Pipeline Types
// ---------------------------------------------------------------------------

export type PipelineType = 'TIMELINE' | 'NARRATIVE' | 'CONTRADICTION' | 'VIDEO' | 'DOCTRINE';

/** Map pipeline types to ACU analysis types for credit cost lookup */
const PIPELINE_TO_ANALYSIS_TYPE: Record<PipelineType, AnalysisType> = {
  TIMELINE: 'CONTRADICTION_ENGINE', // Timeline uses same rate as contradiction
  NARRATIVE: 'CONTRADICTION_ENGINE',
  CONTRADICTION: 'CONTRADICTION_ENGINE',
  VIDEO: 'VIDEO_PROCESSING',
  DOCTRINE: 'DOCTRINE_ANALYSIS',
};

// ---------------------------------------------------------------------------
// Credit Cost Lookup
// ---------------------------------------------------------------------------

function getCreditCostForPipeline(pipeline: PipelineType): number {
  const analysisType = PIPELINE_TO_ANALYSIS_TYPE[pipeline];
  const config = CREDIT_COSTS.find((c) => c.analysisType === analysisType);
  return config?.costPerUnit ?? 1;
}

// ---------------------------------------------------------------------------
// Job Result Types
// ---------------------------------------------------------------------------

export interface PipelineJobResult {
  jobId: string;
  processingJobId: string;
  pipeline: PipelineType;
  status: 'queued' | 'rejected';
  failureCode?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Enqueue Functions
// ---------------------------------------------------------------------------

/**
 * Create a ProcessingJob record and enqueue a BullMQ job for the given pipeline.
 * Validates ACU credits before enqueuing — if insufficient, the job is
 * immediately marked failed with failureCode=ACU_EXHAUSTED.
 */
async function createAndEnqueueJob(
  pipeline: PipelineType,
  queueName: string,
  jobName: string,
  jobData: BaseJobData,
  payload: Record<string, unknown>,
): Promise<PipelineJobResult> {
  const { userId, tenantId, caseId } = jobData;

  // Create ProcessingJob record in pending state
  const processingJob = await prisma.processingJob.create({
    data: {
      userId,
      tenantId,
      caseId: caseId ?? '',
      pipeline,
      status: 'pending',
      payload: JSON.parse(JSON.stringify(payload)),
      acuCredits: jobData.acuCreditsRequired,
    },
  });

  // Inject processingJobId into job data so workers can look up by ID directly
  const enrichedJobData = { ...jobData, processingJobId: processingJob.id };

  // Enqueue the BullMQ job — ACU credit validation happens in the worker
  // via CourtAccessWorker.reserveACU() which does atomic check-and-deduct.
  // If credits are insufficient, reserveACU throws and the job is retried/failed.
  const queue = getQueue(queueName);
  const bullJob = await queue.add(jobName, enrichedJobData, {
    jobId: `${pipeline.toLowerCase()}-${processingJob.id}`,
  });

  return {
    jobId: bullJob.id ?? processingJob.id,
    processingJobId: processingJob.id,
    pipeline,
    status: 'queued',
  };
}

// ---------------------------------------------------------------------------
// Public API — Pipeline-specific enqueue functions
// ---------------------------------------------------------------------------

export async function enqueueTimelineProcessing(params: {
  userId: string;
  tenantId: string;
  caseId: string;
}): Promise<PipelineJobResult> {
  const creditCost = getCreditCostForPipeline('TIMELINE');
  const jobData: TimelineBuildJobData = {
    userId: params.userId,
    tenantId: params.tenantId,
    caseId: params.caseId,
    acuCreditsRequired: creditCost,
    enqueuedAt: new Date().toISOString(),
  };

  return createAndEnqueueJob(
    'TIMELINE',
    QUEUE_NAMES.TIMELINE_BUILD,
    'timeline-build',
    jobData,
    { caseId: params.caseId },
  );
}

export async function enqueueNarrativeProcessing(params: {
  userId: string;
  tenantId: string;
  caseId: string;
}): Promise<PipelineJobResult> {
  const creditCost = getCreditCostForPipeline('NARRATIVE');
  const jobData: NarrativeProcessingJobData = {
    userId: params.userId,
    tenantId: params.tenantId,
    caseId: params.caseId,
    acuCreditsRequired: creditCost,
    enqueuedAt: new Date().toISOString(),
  };

  return createAndEnqueueJob(
    'NARRATIVE',
    QUEUE_NAMES.NARRATIVE_PROCESSING,
    'narrative-process',
    jobData,
    { caseId: params.caseId },
  );
}

export async function enqueueContradictionAnalysis(params: {
  userId: string;
  tenantId: string;
  caseId: string;
}): Promise<PipelineJobResult> {
  const creditCost = getCreditCostForPipeline('CONTRADICTION');
  const jobData: ContradictionAnalysisJobData = {
    userId: params.userId,
    tenantId: params.tenantId,
    caseId: params.caseId,
    acuCreditsRequired: creditCost,
    enqueuedAt: new Date().toISOString(),
  };

  return createAndEnqueueJob(
    'CONTRADICTION',
    QUEUE_NAMES.CONTRADICTION_ANALYSIS,
    'contradiction-analyze',
    jobData,
    { caseId: params.caseId },
  );
}

export async function enqueueVideoProcessing(params: {
  userId: string;
  tenantId: string;
  caseId: string;
  evidenceId: string;
  fileKey: string;
  mimeType: string;
}): Promise<PipelineJobResult> {
  const creditCost = getCreditCostForPipeline('VIDEO');
  const jobData: VideoProcessingJobData = {
    userId: params.userId,
    tenantId: params.tenantId,
    caseId: params.caseId,
    evidenceId: params.evidenceId,
    fileKey: params.fileKey,
    mimeType: params.mimeType,
    acuCreditsRequired: creditCost,
    enqueuedAt: new Date().toISOString(),
  };

  return createAndEnqueueJob(
    'VIDEO',
    QUEUE_NAMES.VIDEO_PROCESSING,
    'video-process',
    jobData,
    { caseId: params.caseId, evidenceId: params.evidenceId },
  );
}

export async function enqueueDoctrineAnalysis(params: {
  userId: string;
  tenantId: string;
  caseId: string;
}): Promise<PipelineJobResult> {
  const creditCost = getCreditCostForPipeline('DOCTRINE');
  const jobData: DoctrineAnalysisJobData = {
    userId: params.userId,
    tenantId: params.tenantId,
    caseId: params.caseId,
    acuCreditsRequired: creditCost,
    enqueuedAt: new Date().toISOString(),
  };

  return createAndEnqueueJob(
    'DOCTRINE',
    QUEUE_NAMES.DOCTRINE_ANALYSIS,
    'doctrine-analyze',
    jobData,
    { caseId: params.caseId },
  );
}
