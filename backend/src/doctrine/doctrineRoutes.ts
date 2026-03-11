// ============================================
// Court Access — Doctrine Intelligence API Routes
// REST endpoints for doctrine ingestion, search,
// compliance analysis, and statistics.
// ============================================

import type { DoctrineCategory, DoctrineComplianceResultWithLitigation } from './types.ts';

// Valid doctrine categories for input validation
const VALID_CATEGORIES: ReadonlySet<string> = new Set<string>([
  'constitutional', 'encounter', 'detention', 'search', 'arrest',
  'miranda', 'interrogation', 'use_of_force', 'pursuit',
  'evidence_presentation', 'chain_of_custody', 'testimony',
  'report_writing', 'evidence_handling', 'evidence_collection',
  'crime_scene', 'patrol', 'field_contact', 'general',
]);
import { doctrineStore } from './doctrineStore.ts';
import { doctrineEmbeddingPipeline } from './doctrineEmbeddingPipeline.ts';
import { DoctrineComplianceEngine } from './doctrineComplianceEngine.ts';
import { DoctrineIngestionService } from './doctrineIngestionService.ts';

// ---------------------------------------------------------------------------
// Minimal Fastify-compatible type stubs
// (The backend does not use Fastify directly in all modules — these
//  provide the shape needed for route registration.)
// ---------------------------------------------------------------------------

interface FastifyRequest {
  query: Record<string, string | undefined>;
  params: Record<string, string>;
  body: unknown;
}

interface FastifyReply {
  code(statusCode: number): FastifyReply;
  send(payload: unknown): FastifyReply;
}

interface RouteOptions {
  method: string;
  url: string;
  handler: (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>;
}

interface FastifyInstance {
  get(url: string, handler: (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>): void;
  post(url: string, handler: (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>): void;
  route(opts: RouteOptions): void;
}

// ---------------------------------------------------------------------------
// Route Registration
// ---------------------------------------------------------------------------

export function registerDoctrineRoutes(app: FastifyInstance): void {
  // -----------------------------------------------------------------------
  // GET /api/doctrine/status — system status + stats
  // -----------------------------------------------------------------------
  app.get('/api/doctrine/status', async (_req: FastifyRequest, _reply: FastifyReply) => {
    const stats = doctrineStore.getStats();
    const embeddingCount = doctrineEmbeddingPipeline.size;

    return {
      status: 'operational',
      totalRules: stats.totalRules,
      totalEmbeddings: embeddingCount,
      rulesByCategory: stats.rulesByCategory,
      rulesBySource: stats.rulesBySource,
      rulesByDomain: stats.rulesByDomain,
      seedDataLoaded: DoctrineIngestionService.isSeedDataLoaded(),
      allDomainsLoaded: DoctrineIngestionService.isAllSeedDataLoaded(),
      availableDomains: DoctrineIngestionService.getAvailableDomains(),
    };
  });

  // -----------------------------------------------------------------------
  // GET /api/doctrine/rules — list all rules (with optional filters)
  // -----------------------------------------------------------------------
  app.get('/api/doctrine/rules', async (req: FastifyRequest, _reply: FastifyReply) => {
    const query = req.query as { category?: string; chapter?: string; source?: string; topic?: string; limit?: string };

    let rules = doctrineStore.getAll();

    if (query.category) {
      rules = rules.filter((r) => r.category === query.category);
    }
    if (query.chapter) {
      rules = rules.filter((r) => r.chapter === query.chapter);
    }
    if (query.source) {
      rules = rules.filter((r) => r.sourceName === query.source);
    }
    if (query.topic) {
      rules = rules.filter((r) => r.topic === query.topic);
    }

    const limit = query.limit ? parseInt(query.limit, 10) : 100;
    rules = rules.slice(0, limit);

    return { count: rules.length, rules };
  });

  // -----------------------------------------------------------------------
  // GET /api/doctrine/rules/:doctrineId — get specific rule
  // -----------------------------------------------------------------------
  app.get('/api/doctrine/rules/:doctrineId', async (req: FastifyRequest, reply: FastifyReply) => {
    const { doctrineId } = req.params as { doctrineId: string };
    const rule = doctrineStore.getById(doctrineId);

    if (!rule) {
      return reply.code(404).send({ error: `Doctrine rule not found: ${doctrineId}` });
    }

    return { rule };
  });

  // -----------------------------------------------------------------------
  // GET /api/doctrine/search?q=... — keyword search
  // -----------------------------------------------------------------------
  app.get('/api/doctrine/search', async (req: FastifyRequest, reply: FastifyReply) => {
    const query = req.query as { q?: string; maxResults?: string };

    if (!query.q) {
      return reply.code(400).send({ error: 'Missing required parameter: q' });
    }

    const maxResults = query.maxResults ? parseInt(query.maxResults, 10) : 20;
    const rules = doctrineStore.search(query.q, maxResults);

    return { query: query.q, count: rules.length, rules };
  });

  // -----------------------------------------------------------------------
  // POST /api/doctrine/analyze — analyze evidence text for compliance
  // -----------------------------------------------------------------------
  app.post('/api/doctrine/analyze', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as { evidenceText?: string; category?: string; maxResults?: number; minSimilarity?: number } | null;

    if (!body?.evidenceText) {
      return reply.code(400).send({ error: 'Missing required field: evidenceText' });
    }

    if (body.category && !VALID_CATEGORIES.has(body.category)) {
      return reply.code(400).send({
        error: `Invalid category: ${body.category}. Valid categories: ${[...VALID_CATEGORIES].join(', ')}`,
      });
    }

    const result = await DoctrineComplianceEngine.analyzeCompliance(body.evidenceText, {
      category: body.category as DoctrineCategory | undefined,
      maxResults: body.maxResults,
      minSimilarity: body.minSimilarity,
    });

    return {
      overallCompliance: result.overallCompliance,
      totalRulesChecked: result.totalRulesChecked,
      violations: result.violations.length,
      concerns: result.concerns.length,
      compliant: result.compliant.length,
      matches: result.matches.map((m) => ({
        doctrineId: m.doctrineRule.doctrineId,
        source: m.doctrineRule.sourceName,
        chapter: m.doctrineRule.chapter,
        topic: m.doctrineRule.topic,
        ruleText: m.doctrineRule.ruleText,
        category: m.doctrineRule.category,
        similarityScore: Math.round(m.similarityScore * 1000) / 1000,
        flagType: m.flagType,
        flagDescription: m.flagDescription,
        legalImplication: m.doctrineRule.legalImplication,
      })),
      analyzedAt: result.analyzedAt.toISOString(),
      litigationSummary: (result as DoctrineComplianceResultWithLitigation).litigationSummary,
    };
  });

  // -----------------------------------------------------------------------
  // POST /api/doctrine/quick-scan — fast violation check
  // -----------------------------------------------------------------------
  app.post('/api/doctrine/quick-scan', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as { evidenceText?: string } | null;

    if (!body?.evidenceText) {
      return reply.code(400).send({ error: 'Missing required field: evidenceText' });
    }

    const result = await DoctrineComplianceEngine.quickScan(body.evidenceText);

    return {
      hasViolations: result.violations.length > 0,
      hasConcerns: result.concerns.length > 0,
      violations: result.violations.map((m) => ({
        doctrineId: m.doctrineRule.doctrineId,
        topic: m.doctrineRule.topic,
        ruleText: m.doctrineRule.ruleText,
        flagDescription: m.flagDescription,
        similarityScore: Math.round(m.similarityScore * 1000) / 1000,
      })),
      concerns: result.concerns.map((m) => ({
        doctrineId: m.doctrineRule.doctrineId,
        topic: m.doctrineRule.topic,
        ruleText: m.doctrineRule.ruleText,
        flagDescription: m.flagDescription,
        similarityScore: Math.round(m.similarityScore * 1000) / 1000,
      })),
    };
  });

  // -----------------------------------------------------------------------
  // POST /api/doctrine/ingest — ingest raw text from a POST manual
  // -----------------------------------------------------------------------
  app.post('/api/doctrine/ingest', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as { rawText?: string; sourceName?: string } | null;

    if (!body?.rawText || !body?.sourceName) {
      return reply.code(400).send({ error: 'Missing required fields: rawText, sourceName' });
    }

    const result = await DoctrineIngestionService.ingestFromText(body.rawText, body.sourceName);

    return {
      success: true,
      sourceName: result.sourceName,
      totalChunks: result.totalChunks,
      rulesCreated: result.rulesCreated,
      rulesDuplicate: result.rulesDuplicate,
      embeddingsGenerated: result.embeddingsGenerated,
      durationMs: result.durationMs,
      errors: result.errors,
    };
  });

  // -----------------------------------------------------------------------
  // POST /api/doctrine/seed — load built-in LD-15 seed data
  // -----------------------------------------------------------------------
  app.post('/api/doctrine/seed', async (_req: FastifyRequest, _reply: FastifyReply) => {
    if (DoctrineIngestionService.isSeedDataLoaded()) {
      const stats = doctrineStore.getStats();
      return {
        success: true,
        message: 'Seed data already loaded',
        totalRules: stats.totalRules,
      };
    }

    const result = await DoctrineIngestionService.loadSeedData();

    return {
      success: true,
      message: `Loaded ${result.rulesCreated} doctrine rules from ${result.sourceName}`,
      rulesCreated: result.rulesCreated,
      embeddingsGenerated: result.embeddingsGenerated,
      durationMs: result.durationMs,
    };
  });

  // -----------------------------------------------------------------------
  // POST /api/doctrine/seed-all — load ALL learning domain seed data
  // -----------------------------------------------------------------------
  app.post('/api/doctrine/seed-all', async (_req: FastifyRequest, _reply: FastifyReply) => {
    if (DoctrineIngestionService.isAllSeedDataLoaded()) {
      const stats = doctrineStore.getStats();
      return {
        success: true,
        message: 'All domain seed data already loaded',
        totalRules: stats.totalRules,
        rulesBySource: stats.rulesBySource,
      };
    }

    const result = await DoctrineIngestionService.loadAllSeedData();

    return {
      success: true,
      message: `Loaded ${result.rulesCreated} doctrine rules from all domains`,
      sourceName: result.sourceName,
      rulesCreated: result.rulesCreated,
      rulesDuplicate: result.rulesDuplicate,
      embeddingsGenerated: result.embeddingsGenerated,
      durationMs: result.durationMs,
      errors: result.errors.length > 0 ? result.errors : undefined,
    };
  });

  // -----------------------------------------------------------------------
  // POST /api/doctrine/seed/:domainCode — load specific domain seed data
  // -----------------------------------------------------------------------
  app.post('/api/doctrine/seed/:domainCode', async (req: FastifyRequest, reply: FastifyReply) => {
    const { domainCode } = req.params as { domainCode: string };

    const result = await DoctrineIngestionService.loadDomainSeedData(domainCode);
    if (!result) {
      return reply.code(404).send({ error: `Unknown domain code: ${domainCode}. Available: LD-15, LD-16, LD-17, LD-18, LD-20, LD-21, LD-24, LD-30` });
    }

    return {
      success: true,
      message: `Loaded ${result.rulesCreated} doctrine rules from ${result.sourceName}`,
      rulesCreated: result.rulesCreated,
      embeddingsGenerated: result.embeddingsGenerated,
      durationMs: result.durationMs,
    };
  });

  // -----------------------------------------------------------------------
  // GET /api/doctrine/domains — list all available domains with status
  // -----------------------------------------------------------------------
  app.get('/api/doctrine/domains', async (_req: FastifyRequest, _reply: FastifyReply) => {
    const available = DoctrineIngestionService.getAvailableDomains();
    const stats = doctrineStore.getStats();

    return {
      domains: available.map((d) => ({
        name: d.name,
        seedRuleCount: d.ruleCount,
        loadedRuleCount: stats.rulesBySource[d.name] || 0,
        isLoaded: (stats.rulesBySource[d.name] || 0) > 0,
      })),
      totalAvailableRules: available.reduce((sum, d) => sum + d.ruleCount, 0),
      totalLoadedRules: stats.totalRules,
    };
  });

  // -----------------------------------------------------------------------
  // GET /api/doctrine/categories — list all categories with counts
  // -----------------------------------------------------------------------
  app.get('/api/doctrine/categories', async (_req: FastifyRequest, _reply: FastifyReply) => {
    const stats = doctrineStore.getStats();
    return { categories: stats.rulesByCategory };
  });

  // -----------------------------------------------------------------------
  // GET /api/doctrine/chapters — list all chapters with counts
  // -----------------------------------------------------------------------
  app.get('/api/doctrine/chapters', async (_req: FastifyRequest, _reply: FastifyReply) => {
    const allRules = doctrineStore.getAll();
    const chapters: Record<string, number> = {};
    for (const rule of allRules) {
      chapters[rule.chapter] = (chapters[rule.chapter] || 0) + 1;
    }
    return { chapters };
  });
}
