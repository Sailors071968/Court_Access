// ============================================================================
// Phases 126-127 — Operations Console API Routes
// Registers endpoints for Staff Operations Dashboard and Policy Topic Viewer.
// ============================================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  getOperationsDashboardData,
  getAgencyTopicStatus,
  getAllTopicStatusSummary,
  exportTopicStatusCsv,
  getCpraDeadlines,
  generateOperationsReport,
  populateAgencyPolicyStatus,
  populatePolicyInventory,
  populateTopicCoverageMatrix,
  populateCpraRequestLog,
  type OperationsDashboardFilters,
} from './phase121_128_operationsConsole.js';

export async function registerOperationsConsoleRoutes(
  app: FastifyInstance,
): Promise<void> {

  // =========================================================================
  // Phase 126: Staff Operations Dashboard
  // =========================================================================

  // GET /api/operations/dashboard — main dashboard data with filters
  app.get(
    '/api/operations/dashboard',
    async (
      request: FastifyRequest<{
        Querystring: {
          county?: string;
          agencySize?: string;
          minCoverage?: string;
          maxCoverage?: string;
          cpraStatus?: string;
          search?: string;
          page?: string;
          limit?: string;
        };
      }>,
      reply: FastifyReply,
    ) => {
      try {
        const filters: OperationsDashboardFilters = {
          county: request.query.county,
          agencySize: request.query.agencySize as 'large' | 'medium' | 'small' | undefined,
          minCoverage: request.query.minCoverage ? parseFloat(request.query.minCoverage) : undefined,
          maxCoverage: request.query.maxCoverage ? parseFloat(request.query.maxCoverage) : undefined,
          cpraStatus: request.query.cpraStatus,
          search: request.query.search,
          page: request.query.page ? parseInt(request.query.page, 10) : 1,
          limit: request.query.limit ? parseInt(request.query.limit, 10) : 50,
        };
        const data = await getOperationsDashboardData(filters);
        return reply.send({ success: true, data });
      } catch (error) {
        console.error('[Phase 126] Operations dashboard error:', error);
        return reply.status(500).send({ success: false, error: 'Failed to load operations dashboard' });
      }
    },
  );

  // GET /api/operations/deadlines — CPRA deadline countdown
  app.get(
    '/api/operations/deadlines',
    async (_req: FastifyRequest, reply: FastifyReply) => {
      try {
        const deadlines = await getCpraDeadlines();
        return reply.send({ success: true, data: deadlines });
      } catch (error) {
        console.error('[Phase 125] Deadline error:', error);
        return reply.status(500).send({ success: false, error: 'Failed to load CPRA deadlines' });
      }
    },
  );

  // =========================================================================
  // Phase 127: Policy Topic Status Viewer
  // =========================================================================

  // GET /api/operations/topics — all agencies topic summary
  app.get(
    '/api/operations/topics',
    async (
      request: FastifyRequest<{
        Querystring: { county?: string; search?: string };
      }>,
      reply: FastifyReply,
    ) => {
      try {
        const data = await getAllTopicStatusSummary({
          county: request.query.county,
          search: request.query.search,
        });
        return reply.send({ success: true, data });
      } catch (error) {
        console.error('[Phase 127] Topic status error:', error);
        return reply.status(500).send({ success: false, error: 'Failed to load topic status' });
      }
    },
  );

  // GET /api/operations/topics/:agencyId — single agency topic detail
  app.get(
    '/api/operations/topics/:agencyId',
    async (
      request: FastifyRequest<{ Params: { agencyId: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const data = await getAgencyTopicStatus(request.params.agencyId);
        if (!data) {
          return reply.status(404).send({ success: false, error: 'Agency not found' });
        }
        return reply.send({ success: true, data });
      } catch (error) {
        console.error('[Phase 127] Agency topic error:', error);
        return reply.status(500).send({ success: false, error: 'Failed to load agency topics' });
      }
    },
  );

  // GET /api/operations/topics/:agencyId/export/csv — CSV export
  app.get(
    '/api/operations/topics/:agencyId/export/csv',
    async (
      request: FastifyRequest<{ Params: { agencyId: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const data = await getAgencyTopicStatus(request.params.agencyId);
        if (!data) {
          return reply.status(404).send({ success: false, error: 'Agency not found' });
        }
        const csv = exportTopicStatusCsv(data);
        return reply
          .header('Content-Type', 'text/csv')
          .header('Content-Disposition', `attachment; filename="${data.agency.agencyName}_topics.csv"`)
          .send(csv);
      } catch (_error) {
        return reply.status(500).send({ success: false, error: 'Failed to export CSV' });
      }
    },
  );

  // =========================================================================
  // Phase 128: Operations Report
  // =========================================================================

  // POST /api/operations/report — generate operations report
  app.post(
    '/api/operations/report',
    async (_req: FastifyRequest, reply: FastifyReply) => {
      try {
        const { report } = await generateOperationsReport();
        return reply.send({ success: true, data: report });
      } catch (error) {
        console.error('[Phase 128] Report error:', error);
        return reply.status(500).send({ success: false, error: 'Failed to generate report' });
      }
    },
  );

  // =========================================================================
  // Setup: Populate operational tables
  // =========================================================================

  // POST /api/operations/populate — populate all Phase 121-124 tables
  app.post(
    '/api/operations/populate',
    async (_req: FastifyRequest, reply: FastifyReply) => {
      try {
        const [phase121, phase122, phase123, phase124] = await Promise.all([
          populateAgencyPolicyStatus(),
          populatePolicyInventory(),
          populateTopicCoverageMatrix(),
          populateCpraRequestLog(),
        ]);
        return reply.send({
          success: true,
          data: { phase121, phase122, phase123, phase124 },
        });
      } catch (error) {
        console.error('[Operations] Populate error:', error);
        return reply.status(500).send({ success: false, error: 'Failed to populate operational tables' });
      }
    },
  );

  console.log('[Phases 121-128] Operations console routes registered');
}
