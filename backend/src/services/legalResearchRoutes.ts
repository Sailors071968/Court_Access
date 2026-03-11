// ============================================================================
// Phases 293-300 — Legal Research API Routes
// Exposes CourtListener integration through secure backend endpoints.
// API key is never exposed to the frontend.
// ============================================================================

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { CourtListenerService } from './courtListenerService.js';
import { LegalResearchEngine } from './legalResearchEngine.js';
import { MotionPrecedentLinker } from './motionPrecedentLinker.js';
import { JudgeIntelligenceService } from './judgeIntelligenceService.js';
import { CitationGraphService } from './citationGraphService.js';
import { RecommendationStrengthener } from './recommendationStrengthener.js';
import { courtListenerCache } from './courtListenerCache.js';

// ---------------------------------------------------------------------------
// Route Registration
// ---------------------------------------------------------------------------

export async function registerLegalResearchRoutes(app: FastifyInstance): Promise<void> {
  // -----------------------------------------------------------------------
  // Phase 293: CourtListener API verification
  // -----------------------------------------------------------------------
  app.get('/api/legal-research/status', async (_req: FastifyRequest, _reply: FastifyReply) => {
    const result = await CourtListenerService.verifyAuthentication();
    const cacheStats = courtListenerCache.stats();
    return {
      ...result,
      cache: cacheStats,
    };
  });

  // -----------------------------------------------------------------------
  // Phase 294: Search for case law precedent
  // -----------------------------------------------------------------------
  app.get('/api/legal-research/search', async (req: FastifyRequest, _reply: FastifyReply) => {
    const query = req.query as { q?: string; jurisdiction?: string; motionType?: string; maxResults?: string };

    if (!query.q) {
      return { error: 'Missing required parameter: q' };
    }

    const result = await LegalResearchEngine.searchForPrecedent(query.q, {
      jurisdiction: query.jurisdiction,
      motionType: query.motionType,
      maxResults: query.maxResults ? parseInt(query.maxResults, 10) : 5,
    });

    return result;
  });

  // -----------------------------------------------------------------------
  // Phase 294: Search opinions directly
  // -----------------------------------------------------------------------
  app.get('/api/legal-research/opinions', async (req: FastifyRequest, _reply: FastifyReply) => {
    const query = req.query as { q?: string; court?: string; pageSize?: string };

    if (!query.q) {
      return { error: 'Missing required parameter: q' };
    }

    const result = await CourtListenerService.searchOpinions(query.q, {
      court: query.court,
      pageSize: query.pageSize ? parseInt(query.pageSize, 10) : 10,
    });

    return result;
  });

  // -----------------------------------------------------------------------
  // Phase 295: Get motion precedent
  // -----------------------------------------------------------------------
  app.get('/api/legal-research/motion-precedent', async (req: FastifyRequest, _reply: FastifyReply) => {
    const query = req.query as { motionType?: string; observation?: string; jurisdiction?: string };

    if (!query.motionType || !query.observation) {
      return { error: 'Missing required parameters: motionType, observation' };
    }

    const result = await LegalResearchEngine.searchMotionPrecedent(
      query.motionType,
      query.observation,
      query.jurisdiction,
    );

    return result;
  });

  // -----------------------------------------------------------------------
  // Phase 296: Case law intelligence for a case
  // -----------------------------------------------------------------------
  app.get('/api/legal-research/case-intelligence/:caseId', async (req: FastifyRequest, _reply: FastifyReply) => {
    const { caseId } = req.params as { caseId: string };
    const query = req.query as { charges?: string; jurisdiction?: string; policyIssues?: string; motionTypes?: string };

    // Build search context from case data
    const searchQueries: Array<{ observation: string; motionType?: string }> = [];

    if (query.charges) {
      searchQueries.push({ observation: query.charges });
    }
    if (query.policyIssues) {
      searchQueries.push({ observation: query.policyIssues });
    }
    if (query.motionTypes) {
      const types = query.motionTypes.split(',');
      for (const t of types) {
        searchQueries.push({ observation: t.trim(), motionType: t.trim() });
      }
    }

    // Default search if no context provided
    if (searchQueries.length === 0) {
      searchQueries.push({ observation: 'criminal defense evidence suppression California' });
    }

    const precedents = await LegalResearchEngine.batchSearch(searchQueries, query.jurisdiction);

    return {
      caseId,
      precedents,
      searchedAt: new Date().toISOString(),
      queryCount: searchQueries.length,
    };
  });

  // -----------------------------------------------------------------------
  // Phase 297: Judge intelligence
  // -----------------------------------------------------------------------
  app.get('/api/legal-research/judge/:judgeName', async (req: FastifyRequest, _reply: FastifyReply) => {
    const { judgeName } = req.params as { judgeName: string };
    const query = req.query as { court?: string };

    const profile = await JudgeIntelligenceService.getJudgeProfile(judgeName, {
      court: query.court,
    });

    return profile;
  });

  // -----------------------------------------------------------------------
  // Phase 298: Citation graph analysis
  // -----------------------------------------------------------------------
  app.get('/api/legal-research/citation-graph/:opinionId', async (req: FastifyRequest, _reply: FastifyReply) => {
    const { opinionId } = req.params as { opinionId: string };

    const analysis = await CitationGraphService.analyzeCitations(parseInt(opinionId, 10));

    // Convert Map to plain object for JSON serialization
    const depthMap: Record<string, number> = {};
    for (const [k, v] of analysis.citationDepthMap.entries()) {
      depthMap[String(k)] = v;
    }

    return {
      ...analysis,
      citationDepthMap: depthMap,
    };
  });

  // -----------------------------------------------------------------------
  // Phase 300: Cache management
  // -----------------------------------------------------------------------
  app.get('/api/legal-research/cache/stats', async (_req: FastifyRequest, _reply: FastifyReply) => {
    return courtListenerCache.stats();
  });

  app.post('/api/legal-research/cache/clear', async (_req: FastifyRequest, _reply: FastifyReply) => {
    courtListenerCache.clear();
    return { cleared: true, timestamp: new Date().toISOString() };
  });
}
