// ============================================================================
// Phase D.2.5 — Charge Intake + California Code Routes
// Deterministic charge entry, code lookup, statute search, CALCRIM linkage.
// NO hallucination. NO LLM. NO generative reasoning.
// ============================================================================

import { FastifyInstance } from 'fastify';
import {
  getAllCodes,
  getCriminalDefenseCodes,
  searchCodes,
  getStatutesByCode,
  searchStatutes,
  getCodeByAbbreviation,
} from '../services/californiaCodeRegistry.js';
import {
  validateCaseCharges,
  autoLinkCharges,
  createCharge,
  requireChargesForAnalysis,
  getRegistryStats,
} from '../services/chargeCalcrimLinker.js';

export async function registerChargeIntakeRoutes(fastify: FastifyInstance) {

  // GET /api/codes/california
  // List all 29 California codes
  fastify.get('/api/codes/california', async (_req, reply) => {
    return reply.code(200).send({ codes: getAllCodes() });
  });

  // GET /api/codes/california/criminal
  // List codes commonly used in criminal defense
  fastify.get('/api/codes/california/criminal', async (_req, reply) => {
    return reply.code(200).send({ codes: getCriminalDefenseCodes() });
  });

  // GET /api/codes/california/search
  // Search codes by name or abbreviation
  fastify.get('/api/codes/california/search', async (req, reply) => {
    const query = req.query as { q?: string };
    if (!query.q) return reply.code(400).send({ error: 'Required: q (search query)' });
    return reply.code(200).send({ codes: searchCodes(query.q) });
  });

  // GET /api/codes/california/:code
  // Get a specific code by abbreviation
  fastify.get('/api/codes/california/:code', async (req, reply) => {
    const params = req.params as { code: string };
    const code = getCodeByAbbreviation(params.code);
    if (!code) return reply.code(404).send({ error: `Code not found: ${params.code}` });
    return reply.code(200).send(code);
  });

  // GET /api/codes/statutes/:code
  // Get common criminal statutes for a California code
  fastify.get('/api/codes/statutes/:code', async (req, reply) => {
    const params = req.params as { code: string };
    return reply.code(200).send({ statutes: getStatutesByCode(params.code) });
  });

  // GET /api/codes/statutes/search
  // Search statutes by section, title, or description
  fastify.get('/api/codes/statutes/search', async (req, reply) => {
    const query = req.query as { q?: string };
    if (!query.q) return reply.code(400).send({ error: 'Required: q (search query)' });
    return reply.code(200).send({ statutes: searchStatutes(query.q) });
  });

  // GET /api/codes/registry/stats
  // Get registry statistics
  fastify.get('/api/codes/registry/stats', async (_req, reply) => {
    return reply.code(200).send(getRegistryStats());
  });

  // POST /api/charges/create
  // Create a new charge with California code validation and auto-CALCRIM linkage
  fastify.post('/api/charges/create', async (req, reply) => {
    const body = req.body as {
      caseId: string;
      code: string;
      section: string;
      title?: string;
      dateOfOffense?: string;
      victim: string;
      severity?: string;
      countNumber?: number;
      autoLink?: boolean;
    };

    if (!body.caseId || !body.code || !body.section || !body.victim) {
      return reply.code(400).send({
        error: 'Required: caseId, code (California code abbreviation), section (statute section), victim',
      });
    }

    try {
      const result = await createCharge(body);
      return reply.code(201).send(result);
    } catch (err) {
      fastify.log.error(err, 'Charge creation failed');
      return reply.code(400).send({
        error: 'Charge creation failed',
        details: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // GET /api/charges/validate/:caseId
  // Validate charges for a case (prerequisite for CALCRIM analysis)
  fastify.get('/api/charges/validate/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    if (!params.caseId) return reply.code(400).send({ error: 'Required: caseId' });

    try {
      const result = await validateCaseCharges(params.caseId);
      return reply.code(200).send(result);
    } catch (err) {
      fastify.log.error(err, 'Charge validation failed');
      return reply.code(500).send({
        error: 'Charge validation failed',
        details: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // POST /api/charges/auto-link/:caseId
  // Auto-link all charges to CALCRIM instructions using statute registry
  fastify.post('/api/charges/auto-link/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    if (!params.caseId) return reply.code(400).send({ error: 'Required: caseId' });

    try {
      const result = await autoLinkCharges(params.caseId);
      return reply.code(200).send(result);
    } catch (err) {
      fastify.log.error(err, 'Auto-link failed');
      return reply.code(500).send({
        error: 'Auto-link failed',
        details: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // GET /api/charges/analysis-ready/:caseId
  // Check if a case meets prerequisites for CALCRIM analysis
  fastify.get('/api/charges/analysis-ready/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    if (!params.caseId) return reply.code(400).send({ error: 'Required: caseId' });

    try {
      const result = await requireChargesForAnalysis(params.caseId);
      return reply.code(200).send(result);
    } catch (err) {
      fastify.log.error(err, 'Analysis readiness check failed');
      return reply.code(500).send({
        error: 'Analysis readiness check failed',
        details: err instanceof Error ? err.message : String(err),
      });
    }
  });
}
