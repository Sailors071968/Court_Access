// ============================================================================
// Phase 80 — Policy Intelligence Dashboard Activation
// Registers all Phase 73-79 endpoints and populates dashboards with real data.
// Pages: /dashboard/policy-intelligence, /dashboard/policy-acquisition,
//        /dashboard/system-health, /dashboard/cpra
// ============================================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { executeSandboxCrawl, getSandboxExecutionStatus } from './sandboxCrawlExecutor.js';
import { importChpPolicies, getChpImportStatus } from './chpPolicyImportService.js';
import {
  runClassificationValidation,
  getClassificationAccuracySummary,
} from './classificationValidator.js';
import {
  generateCoverageMatrix,
  getAgencyCoverage,
  getCoverageHeatmapData,
} from './coverageMatrixGenerator.js';
import {
  prepareCpraRequestQueue,
  getCpraQueueStatus,
} from './cpraRequestPreparation.js';
import {
  launchCpraCampaign,
  getActiveCampaignStatus,
} from './cpraCampaignLauncher.js';
import {
  processInboundResponse,
  getResponsePipelineHealth,
  processPendingDocuments,
  type InboundResponsePayload,
} from './documentResponsePipeline.js';
import { getCoverageSummary } from '../taxonomy/coveragePopulator.js';
import { getPipelineStats } from './pipelineOrchestrator.js';
// PrismaClient used by imported modules

// ---------------------------------------------------------------------------
// Dashboard aggregation endpoint
// ---------------------------------------------------------------------------

async function getDashboardMetrics() {
  const [
    pipelineStats,
    coverageSummary,
    classificationAccuracy,
    cpraQueue,
    campaignStatus,
    pipelineHealth,
    chpStatus,
  ] = await Promise.all([
    getPipelineStats(),
    getCoverageSummary(),
    getClassificationAccuracySummary(),
    getCpraQueueStatus(),
    getActiveCampaignStatus(),
    getResponsePipelineHealth(),
    getChpImportStatus(),
  ]);

  return {
    // Policy Intelligence Dashboard
    policyIntelligence: {
      agenciesIndexed: coverageSummary.agenciesIndexed,
      policiesDiscovered: pipelineStats.documentsFound,
      policiesIngested: pipelineStats.documentsClassified,
      topicsSeeded: coverageSummary.totalTopics,
      overallCoverage: coverageSummary.overallCoveragePercent,
      classificationAccuracy: classificationAccuracy.estimatedAccuracy,
      aboveAccuracyThreshold: classificationAccuracy.aboveThreshold,
    },

    // Policy Acquisition Dashboard
    policyAcquisition: {
      totalAgencies: coverageSummary.totalAgencies,
      agenciesCrawled: pipelineStats.sitesCrawled,
      documentsDownloaded: pipelineStats.documentsDownloaded,
      documentsOcrd: pipelineStats.documentsOcr,
      documentsClassified: pipelineStats.documentsClassified,
      chpDocumentsImported: chpStatus.totalDocuments,
      chpClassified: chpStatus.classifiedDocuments,
    },

    // System Health Dashboard
    systemHealth: {
      pipelineStatus: 'operational',
      ocrStatus: pipelineHealth.ocrStatus,
      classificationStatus: pipelineHealth.classificationStatus,
      inboundEmailStatus: pipelineHealth.inboundEmailStatus,
      pendingOcr: pipelineHealth.pendingOcr,
      pendingClassification: pipelineHealth.pendingClassification,
      lastResponseAt: pipelineHealth.lastResponseAt,
    },

    // CPRA Dashboard
    cpra: {
      requestsSent: campaignStatus.totalRequestsSent,
      responsesReceived: campaignStatus.totalResponsesReceived,
      pendingFollowUps: campaignStatus.pendingFollowUps,
      activeCampaigns: campaignStatus.activeCampaigns,
      dailySendCount: campaignStatus.dailySendCount,
      dailyLimit: campaignStatus.dailyLimit,
      queuePending: cpraQueue.pendingRequests,
    },
  };
}

// ---------------------------------------------------------------------------
// Register all Phase 73-80 routes
// ---------------------------------------------------------------------------

export async function registerPolicyIntelligenceRoutes(
  app: FastifyInstance,
): Promise<void> {

  // =========================================================================
  // Phase 80: Dashboard metrics endpoint
  // =========================================================================

  app.get(
    '/api/policy-intelligence/dashboard',
    async (_req: FastifyRequest, reply: FastifyReply) => {
      try {
        const metrics = await getDashboardMetrics();
        return reply.send({ success: true, data: metrics });
      } catch (error) {
        console.error('[Phase 80] Dashboard error:', error);
        return reply.status(500).send({
          success: false,
          error: 'Failed to get dashboard metrics',
        });
      }
    },
  );

  // =========================================================================
  // Phase 73: Sandbox Crawl Execution
  // =========================================================================

  app.post(
    '/api/policy-intelligence/sandbox/crawl',
    async (
      request: FastifyRequest<{
        Body: {
          maxPagesPerAgency?: number;
          maxCrawlTimeMs?: number;
          dryRun?: boolean;
        };
      }>,
      reply: FastifyReply,
    ) => {
      try {
        const config = {
          maxPagesPerAgency: request.body?.maxPagesPerAgency ?? 200,
          maxCrawlTimeMs: request.body?.maxCrawlTimeMs ?? 300000,
          requestDelayMs: 1000,
          respectRobotsTxt: true,
          maxConcurrentAgencies: 2,
          dryRun: request.body?.dryRun ?? false,
        };
        const result = await executeSandboxCrawl(config);
        return reply.send({ success: true, data: result });
      } catch (error) {
        console.error('[Phase 73] Sandbox crawl error:', error);
        return reply.status(500).send({
          success: false,
          error: 'Sandbox crawl failed',
        });
      }
    },
  );

  app.get(
    '/api/policy-intelligence/sandbox/status',
    async (_req: FastifyRequest, reply: FastifyReply) => {
      try {
        const status = getSandboxExecutionStatus();
        return reply.send({ success: true, data: status });
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: 'Failed to get sandbox status',
        });
      }
    },
  );

  // =========================================================================
  // Phase 74: CHP Policy Import
  // =========================================================================

  app.post(
    '/api/policy-intelligence/chp/import',
    async (_req: FastifyRequest, reply: FastifyReply) => {
      try {
        const result = await importChpPolicies();
        return reply.send({ success: true, data: result });
      } catch (error) {
        console.error('[Phase 74] CHP import error:', error);
        return reply.status(500).send({
          success: false,
          error: 'CHP policy import failed',
        });
      }
    },
  );

  app.get(
    '/api/policy-intelligence/chp/status',
    async (_req: FastifyRequest, reply: FastifyReply) => {
      try {
        const status = await getChpImportStatus();
        return reply.send({ success: true, data: status });
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: 'Failed to get CHP status',
        });
      }
    },
  );

  // =========================================================================
  // Phase 75: Classification Validation
  // =========================================================================

  app.get(
    '/api/policy-intelligence/classification/validate',
    async (
      request: FastifyRequest<{ Querystring: { topN?: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const topN = parseInt(request.query.topN ?? '50', 10);
        const report = await runClassificationValidation(topN);
        return reply.send({ success: true, data: report });
      } catch (error) {
        console.error('[Phase 75] Validation error:', error);
        return reply.status(500).send({
          success: false,
          error: 'Classification validation failed',
        });
      }
    },
  );

  app.get(
    '/api/policy-intelligence/classification/accuracy',
    async (_req: FastifyRequest, reply: FastifyReply) => {
      try {
        const summary = await getClassificationAccuracySummary();
        return reply.send({ success: true, data: summary });
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: 'Failed to get accuracy summary',
        });
      }
    },
  );

  // =========================================================================
  // Phase 76: Coverage Matrix
  // =========================================================================

  app.post(
    '/api/policy-intelligence/coverage/generate',
    async (_req: FastifyRequest, reply: FastifyReply) => {
      try {
        const report = await generateCoverageMatrix();
        return reply.send({ success: true, data: report });
      } catch (error) {
        console.error('[Phase 76] Coverage matrix error:', error);
        return reply.status(500).send({
          success: false,
          error: 'Coverage matrix generation failed',
        });
      }
    },
  );

  app.get(
    '/api/policy-intelligence/coverage/agency/:agencyId',
    async (
      request: FastifyRequest<{ Params: { agencyId: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const report = await getAgencyCoverage(request.params.agencyId);
        return reply.send({ success: true, data: report });
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: 'Failed to get agency coverage',
        });
      }
    },
  );

  app.get(
    '/api/policy-intelligence/coverage/heatmap',
    async (
      request: FastifyRequest<{
        Querystring: { limit?: string; offset?: string };
      }>,
      reply: FastifyReply,
    ) => {
      try {
        const limit = parseInt(request.query.limit ?? '25', 10);
        const offset = parseInt(request.query.offset ?? '0', 10);
        const data = await getCoverageHeatmapData(limit, offset);
        return reply.send({ success: true, data });
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: 'Failed to get coverage heatmap',
        });
      }
    },
  );

  app.get(
    '/api/policy-intelligence/coverage/summary',
    async (_req: FastifyRequest, reply: FastifyReply) => {
      try {
        const summary = await getCoverageSummary();
        return reply.send({ success: true, data: summary });
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: 'Failed to get coverage summary',
        });
      }
    },
  );

  // =========================================================================
  // Phase 77: CPRA Request Preparation
  // =========================================================================

  app.post(
    '/api/policy-intelligence/cpra/prepare-queue',
    async (
      request: FastifyRequest<{ Body: { maxAgencies?: number } }>,
      reply: FastifyReply,
    ) => {
      try {
        const maxAgencies = request.body?.maxAgencies ?? 100;
        const result = await prepareCpraRequestQueue(maxAgencies);
        return reply.send({ success: true, data: result });
      } catch (error) {
        console.error('[Phase 77] CPRA queue error:', error);
        return reply.status(500).send({
          success: false,
          error: 'CPRA queue preparation failed',
        });
      }
    },
  );

  app.get(
    '/api/policy-intelligence/cpra/queue-status',
    async (_req: FastifyRequest, reply: FastifyReply) => {
      try {
        const status = await getCpraQueueStatus();
        return reply.send({ success: true, data: status });
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: 'Failed to get CPRA queue status',
        });
      }
    },
  );

  // =========================================================================
  // Phase 78: CPRA Campaign Launch
  // =========================================================================

  app.post(
    '/api/policy-intelligence/cpra/launch-campaign',
    async (
      request: FastifyRequest<{
        Body: {
          maxAgencies?: number;
          dailyEmailLimit?: number;
          campaignName?: string;
          dryRun?: boolean;
        };
      }>,
      reply: FastifyReply,
    ) => {
      try {
        const result = await launchCpraCampaign({
          maxAgencies: request.body?.maxAgencies ?? 25,
          dailyEmailLimit: request.body?.dailyEmailLimit ?? 20,
          campaignName: request.body?.campaignName,
          dryRun: request.body?.dryRun ?? false,
        });
        return reply.send({ success: true, data: result });
      } catch (error) {
        console.error('[Phase 78] Campaign launch error:', error);
        return reply.status(500).send({
          success: false,
          error: 'Campaign launch failed',
        });
      }
    },
  );

  app.get(
    '/api/policy-intelligence/cpra/campaign-status',
    async (_req: FastifyRequest, reply: FastifyReply) => {
      try {
        const status = await getActiveCampaignStatus();
        return reply.send({ success: true, data: status });
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: 'Failed to get campaign status',
        });
      }
    },
  );

  // =========================================================================
  // Phase 79: Document Response Processing
  // =========================================================================

  app.post(
    '/api/policy-intelligence/responses/process',
    async (
      request: FastifyRequest<{ Body: InboundResponsePayload }>,
      reply: FastifyReply,
    ) => {
      try {
        const result = await processInboundResponse(request.body);
        return reply.send({ success: true, data: result });
      } catch (error) {
        console.error('[Phase 79] Response processing error:', error);
        return reply.status(500).send({
          success: false,
          error: 'Response processing failed',
        });
      }
    },
  );

  app.get(
    '/api/policy-intelligence/responses/health',
    async (_req: FastifyRequest, reply: FastifyReply) => {
      try {
        const health = await getResponsePipelineHealth();
        return reply.send({ success: true, data: health });
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: 'Failed to get pipeline health',
        });
      }
    },
  );

  app.post(
    '/api/policy-intelligence/responses/process-pending',
    async (_req: FastifyRequest, reply: FastifyReply) => {
      try {
        const result = await processPendingDocuments();
        return reply.send({ success: true, data: result });
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: 'Failed to process pending documents',
        });
      }
    },
  );

  console.log('[Phase 80] Policy intelligence routes registered');
}
