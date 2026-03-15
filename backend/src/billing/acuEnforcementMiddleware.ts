// ============================================================================
// CourtAccess — ACU (Analysis Compute Unit) Enforcement Middleware
// Pre-processing credit validation, upload locks, and worker enforcement.
// ============================================================================

import type { FastifyRequest, FastifyReply } from 'fastify';
import { getAvailableCredits, hasEnoughCredits, deductCredits, type AnalysisType } from './aiCreditService.js';
import type { AuthenticatedRequest } from '../security/authMiddleware.js';

// ---------------------------------------------------------------------------
// ACU Balance Validation — Call before any processing job
// ---------------------------------------------------------------------------

export interface ACUValidationResult {
  allowed: boolean;
  availableCredits: number;
  requiredCredits: number;
  message: string;
}

/**
 * Validate that a user has sufficient ACU balance before running a processing job.
 * Returns 402 Payment Required if credits are exhausted.
 */
export async function validateACUBalance(userId: string, requiredCredits = 1): Promise<ACUValidationResult> {
  const available = await getAvailableCredits(userId);

  if (!(await hasEnoughCredits(userId, requiredCredits))) {
    return {
      allowed: false,
      availableCredits: available,
      requiredCredits,
      message: 'Your analysis credits have been exhausted. Please purchase additional ACU credits to continue.',
    };
  }

  return {
    allowed: true,
    availableCredits: available,
    requiredCredits,
    message: `${available - requiredCredits} ACU credits remaining after this operation.`,
  };
}

/**
 * Deduct ACU credits for a completed processing job.
 * Call this after successful processing.
 */
export async function consumeACU(
  userId: string,
  credits: number,
  analysisType: AnalysisType,
  caseId?: string,
): Promise<boolean> {
  return await deductCredits(userId, credits, analysisType, caseId);
}

// ---------------------------------------------------------------------------
// ACU Upload Lock — Block evidence uploads when ACU = 0
// Applied as a Fastify hook on upload routes
// ---------------------------------------------------------------------------

/**
 * Fastify preHandler hook that blocks evidence uploads when user has zero ACU credits.
 * Attach to POST /api/evidence/upload-url and POST /api/evidence routes.
 */
export async function acuUploadLockHook(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const path = request.url.split('?')[0];

  // Only apply to evidence upload routes
  const uploadRoutes = ['/api/evidence/upload-url', '/api/evidence'];
  const isUploadRoute = uploadRoutes.some(route => path === route);

  if (!isUploadRoute) return;
  if (request.method !== 'POST') return;

  const user = (request as AuthenticatedRequest).user;
  if (!user) return; // Auth middleware will handle this

  const validation = await validateACUBalance(user.userId, 1);

  if (!validation.allowed) {
    reply.code(402).send({
      error: 'Payment Required',
      message: validation.message,
      availableCredits: validation.availableCredits,
      action: 'Purchase additional ACU credits at /api/billing/acu-packs',
    });
    return;
  }
}

// ---------------------------------------------------------------------------
// ACU Credit Cost Map — Per-pipeline credit costs
// ---------------------------------------------------------------------------

export const ACU_PIPELINE_COSTS: Record<string, { credits: number; analysisType: AnalysisType }> = {
  'timeline-reconstruction': { credits: 2, analysisType: 'CONTRADICTION_ENGINE' },
  'narrative-claim-extraction': { credits: 1, analysisType: 'DOCTRINE_ANALYSIS' },
  'narrative-normalization': { credits: 1, analysisType: 'DOCTRINE_ANALYSIS' },
  'narrative-validation': { credits: 1, analysisType: 'RELIABILITY_SCORING' },
  'contradiction-analysis': { credits: 2, analysisType: 'CONTRADICTION_ENGINE' },
  'video-segmentation': { credits: 3, analysisType: 'VIDEO_PROCESSING' },
  'evidence-processing': { credits: 1, analysisType: 'DOCTRINE_ANALYSIS' },
};

/**
 * Validate ACU balance before a specific pipeline runs.
 * Returns the validation result and the credit cost for the pipeline.
 */
export async function validatePipelineACU(
  userId: string,
  pipelineName: string,
): Promise<ACUValidationResult & { creditCost: number; analysisType: AnalysisType }> {
  const cost = ACU_PIPELINE_COSTS[pipelineName];
  if (!cost) {
    // Unknown pipeline — allow with 0 cost
    return {
      allowed: true,
      availableCredits: await getAvailableCredits(userId),
      requiredCredits: 0,
      message: 'No ACU cost for this pipeline.',
      creditCost: 0,
      analysisType: 'DOCTRINE_ANALYSIS',
    };
  }

  const validation = await validateACUBalance(userId, cost.credits);
  return {
    ...validation,
    creditCost: cost.credits,
    analysisType: cost.analysisType,
  };
}

/**
 * Consume ACU credits for a completed pipeline job.
 */
export async function consumePipelineACU(
  userId: string,
  pipelineName: string,
  caseId?: string,
): Promise<boolean> {
  const cost = ACU_PIPELINE_COSTS[pipelineName];
  if (!cost) return true; // No cost pipeline

  return await consumeACU(userId, cost.credits, cost.analysisType, caseId);
}
