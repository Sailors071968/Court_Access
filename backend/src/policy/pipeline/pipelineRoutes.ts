// ---------------------------------------------------------------------------
// Agency Registry + Policy Pipeline — API Routes
// ---------------------------------------------------------------------------

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  runPostDirectoryCrawl,
  runPopulationRanking,
  enqueueSiteCrawls,
  getPipelineStats,
  getAgenciesPaginated,
  searchAgencies,
  getAgencyWithPolicies,
} from './pipelineOrchestrator.js';
import { getCasePolicyIntelligence } from './neo4jPolicyGraph.js';

/**
 * Register all pipeline routes on the Fastify instance.
 */
export async function registerPipelineRoutes(
  app: FastifyInstance
): Promise<void> {
  // ---------------------------------------------------------------------------
  // Dashboard stats
  // ---------------------------------------------------------------------------
  app.get(
    '/api/policy-pipeline/stats',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const stats = await getPipelineStats();
        return reply.send(stats);
      } catch (error) {
        console.error('[Pipeline Routes] Stats error:', error);
        return reply
          .status(500)
          .send({ error: 'Failed to get pipeline stats' });
      }
    }
  );

  // ---------------------------------------------------------------------------
  // Agency listing (paginated)
  // ---------------------------------------------------------------------------
  app.get(
    '/api/policy-pipeline/agencies',
    async (
      request: FastifyRequest<{
        Querystring: {
          page?: string;
          pageSize?: string;
          agencyType?: string;
          county?: string;
          crawlStatus?: string;
          search?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const {
          page = '1',
          pageSize = '50',
          agencyType,
          county,
          crawlStatus,
          search,
        } = request.query;

        const result = await getAgenciesPaginated(
          parseInt(page, 10),
          parseInt(pageSize, 10),
          { agencyType, county, crawlStatus, search }
        );
        return reply.send(result);
      } catch (error) {
        console.error('[Pipeline Routes] Agencies error:', error);
        return reply
          .status(500)
          .send({ error: 'Failed to get agencies' });
      }
    }
  );

  // ---------------------------------------------------------------------------
  // Agency search
  // ---------------------------------------------------------------------------
  app.get(
    '/api/policy-pipeline/agencies/search',
    async (
      request: FastifyRequest<{
        Querystring: { q: string; limit?: string; offset?: string };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { q, limit = '20', offset = '0' } = request.query;
        if (!q) return reply.status(400).send({ error: 'Query required' });

        const results = await searchAgencies(
          q,
          parseInt(limit, 10),
          parseInt(offset, 10)
        );
        return reply.send({ results, count: results.length });
      } catch (error) {
        console.error('[Pipeline Routes] Search error:', error);
        return reply
          .status(500)
          .send({ error: 'Failed to search agencies' });
      }
    }
  );

  // ---------------------------------------------------------------------------
  // Single agency with policies
  // ---------------------------------------------------------------------------
  app.get(
    '/api/policy-pipeline/agencies/:agencyId',
    async (
      request: FastifyRequest<{ Params: { agencyId: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { agencyId } = request.params;
        const agency = await getAgencyWithPolicies(agencyId);
        if (!agency) {
          return reply.status(404).send({ error: 'Agency not found' });
        }
        return reply.send(agency);
      } catch (error) {
        console.error('[Pipeline Routes] Agency detail error:', error);
        return reply
          .status(500)
          .send({ error: 'Failed to get agency' });
      }
    }
  );

  // ---------------------------------------------------------------------------
  // Phase 13: Intelligence linking — get policies for case agencies
  // ---------------------------------------------------------------------------
  app.post(
    '/api/policy-pipeline/intelligence',
    async (
      request: FastifyRequest<{ Body: { agencyIds: string[] } }>,
      reply: FastifyReply
    ) => {
      try {
        const { agencyIds } = request.body;
        if (!agencyIds || !Array.isArray(agencyIds)) {
          return reply
            .status(400)
            .send({ error: 'agencyIds array required' });
        }

        const intelligence = await getCasePolicyIntelligence(agencyIds);
        return reply.send({ intelligence });
      } catch (error) {
        console.error('[Pipeline Routes] Intelligence error:', error);
        return reply
          .status(500)
          .send({ error: 'Failed to get policy intelligence' });
      }
    }
  );

  // ---------------------------------------------------------------------------
  // Pipeline execution endpoints (admin)
  // ---------------------------------------------------------------------------

  // Run Phase 1: POST directory crawl
  app.post(
    '/api/policy-pipeline/run/post-crawl',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const result = await runPostDirectoryCrawl();
        return reply.send(result);
      } catch (error) {
        console.error('[Pipeline Routes] POST crawl error:', error);
        return reply
          .status(500)
          .send({ error: 'Failed to run POST directory crawl' });
      }
    }
  );

  // Run Phase 2: Population ranking
  app.post(
    '/api/policy-pipeline/run/rank',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const result = await runPopulationRanking();
        return reply.send(result);
      } catch (error) {
        console.error('[Pipeline Routes] Ranking error:', error);
        return reply
          .status(500)
          .send({ error: 'Failed to run population ranking' });
      }
    }
  );

  // Run Phase 4: Enqueue site crawls
  app.post(
    '/api/policy-pipeline/run/enqueue-crawls',
    async (
      request: FastifyRequest<{ Body: { limit?: number } }>,
      reply: FastifyReply
    ) => {
      try {
        const limit = request.body?.limit;
        const result = await enqueueSiteCrawls(limit);
        return reply.send(result);
      } catch (error) {
        console.error('[Pipeline Routes] Enqueue crawls error:', error);
        return reply
          .status(500)
          .send({ error: 'Failed to enqueue site crawls' });
      }
    }
  );

  // Run full pipeline (Phases 1 + 2)
  app.post(
    '/api/policy-pipeline/run/full',
    async (
      request: FastifyRequest<{ Body: { crawlLimit?: number } }>,
      reply: FastifyReply
    ) => {
      try {
        // Phase 1: Crawl POST directory
        const crawlResult = await runPostDirectoryCrawl();

        // Phase 2: Rank by population
        const rankResult = await runPopulationRanking();

        // Phase 4: Enqueue site crawls
        const crawlLimit = request.body?.crawlLimit;
        const enqueueResult = await enqueueSiteCrawls(crawlLimit);

        return reply.send({
          phase1: crawlResult,
          phase2: rankResult,
          phase4: enqueueResult,
        });
      } catch (error) {
        console.error('[Pipeline Routes] Full pipeline error:', error);
        return reply
          .status(500)
          .send({ error: 'Failed to run full pipeline' });
      }
    }
  );
}
