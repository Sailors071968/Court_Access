// ============================================================================
// Phase D.3 — Contradiction Intelligence Routes
// Deterministic contradiction proving, burden fracture analysis,
// witness inconsistency graph, timeline incompatibility, theory attacks.
// NEVER invents contradictions. PROVES them with exact citations.
// ============================================================================

import { FastifyInstance } from 'fastify';
import {
  runFullIntelligenceAnalysis,
  getCaseIntelligenceSummary,
  detectContradictionPairs,
  detectBurdenFractures,
  detectWitnessInconsistencies,
  detectTimelineIncompatibilities,
  generateTheoryAttackSurfaces,
  getContradictionPairs,
  getBurdenFractures,
  getWitnessInconsistencies,
  getTimelineIncompatibilities,
  getTheoryAttackSurfaces,
  generateIntelligenceValidationReport,
} from '../services/contradictionIntelligenceService.js';

export async function registerContradictionIntelligenceRoutes(fastify: FastifyInstance) {

  // POST /api/intelligence/analyze/:caseId
  // Run full intelligence analysis (all subsystems)
  fastify.post('/api/intelligence/analyze/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    if (!params.caseId) return reply.code(400).send({ error: 'Required: caseId' });

    try {
      const result = await runFullIntelligenceAnalysis(params.caseId);
      return reply.code(200).send(result);
    } catch (err) {
      fastify.log.error(err, 'Intelligence analysis failed');
      return reply.code(500).send({
        error: 'Intelligence analysis failed',
        details: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // GET /api/intelligence/summary/:caseId
  // Get intelligence summary for a case
  fastify.get('/api/intelligence/summary/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    if (!params.caseId) return reply.code(400).send({ error: 'Required: caseId' });

    try {
      const result = await getCaseIntelligenceSummary(params.caseId);
      return reply.code(200).send(result);
    } catch (err) {
      fastify.log.error(err, 'Intelligence summary failed');
      return reply.code(500).send({
        error: 'Intelligence summary failed',
        details: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // POST /api/intelligence/contradictions/:caseId
  // Detect contradiction pairs only
  fastify.post('/api/intelligence/contradictions/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    if (!params.caseId) return reply.code(400).send({ error: 'Required: caseId' });

    try {
      const result = await detectContradictionPairs(params.caseId);
      return reply.code(200).send(result);
    } catch (err) {
      fastify.log.error(err, 'Contradiction detection failed');
      return reply.code(500).send({ error: 'Contradiction detection failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // GET /api/intelligence/contradictions/:caseId
  // Get contradiction pairs with optional filters
  fastify.get('/api/intelligence/contradictions/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    const query = req.query as { severity?: string; type?: string; elementId?: string };
    if (!params.caseId) return reply.code(400).send({ error: 'Required: caseId' });

    try {
      const result = await getContradictionPairs(params.caseId, query);
      return reply.code(200).send({ caseId: params.caseId, contradictions: result, total: (result as unknown[]).length });
    } catch (err) {
      fastify.log.error(err, 'Failed to get contradictions');
      return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // POST /api/intelligence/burden-fractures/:caseId
  // Detect burden fractures only
  fastify.post('/api/intelligence/burden-fractures/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    if (!params.caseId) return reply.code(400).send({ error: 'Required: caseId' });

    try {
      const result = await detectBurdenFractures(params.caseId);
      return reply.code(200).send(result);
    } catch (err) {
      fastify.log.error(err, 'Burden fracture detection failed');
      return reply.code(500).send({ error: 'Burden fracture detection failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // GET /api/intelligence/burden-fractures/:caseId
  // Get burden fractures with optional filters
  fastify.get('/api/intelligence/burden-fractures/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    const query = req.query as { severity?: string; type?: string };
    if (!params.caseId) return reply.code(400).send({ error: 'Required: caseId' });

    try {
      const result = await getBurdenFractures(params.caseId, query);
      return reply.code(200).send({ caseId: params.caseId, fractures: result, total: (result as unknown[]).length });
    } catch (err) {
      fastify.log.error(err, 'Failed to get burden fractures');
      return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // POST /api/intelligence/witness-inconsistencies/:caseId
  // Detect witness inconsistencies only
  fastify.post('/api/intelligence/witness-inconsistencies/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    if (!params.caseId) return reply.code(400).send({ error: 'Required: caseId' });

    try {
      const result = await detectWitnessInconsistencies(params.caseId);
      return reply.code(200).send(result);
    } catch (err) {
      fastify.log.error(err, 'Witness inconsistency detection failed');
      return reply.code(500).send({ error: 'Detection failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // GET /api/intelligence/witness-inconsistencies/:caseId
  // Get witness inconsistencies with optional speaker filter
  fastify.get('/api/intelligence/witness-inconsistencies/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    const query = req.query as { speaker?: string };
    if (!params.caseId) return reply.code(400).send({ error: 'Required: caseId' });

    try {
      const result = await getWitnessInconsistencies(params.caseId, query);
      return reply.code(200).send({ caseId: params.caseId, inconsistencies: result, total: (result as unknown[]).length });
    } catch (err) {
      fastify.log.error(err, 'Failed to get witness inconsistencies');
      return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // POST /api/intelligence/timeline/:caseId
  // Detect timeline incompatibilities only
  fastify.post('/api/intelligence/timeline/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    if (!params.caseId) return reply.code(400).send({ error: 'Required: caseId' });

    try {
      const result = await detectTimelineIncompatibilities(params.caseId);
      return reply.code(200).send(result);
    } catch (err) {
      fastify.log.error(err, 'Timeline detection failed');
      return reply.code(500).send({ error: 'Detection failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // GET /api/intelligence/timeline/:caseId
  // Get timeline incompatibilities
  fastify.get('/api/intelligence/timeline/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    if (!params.caseId) return reply.code(400).send({ error: 'Required: caseId' });

    try {
      const result = await getTimelineIncompatibilities(params.caseId);
      return reply.code(200).send({ caseId: params.caseId, incompatibilities: result, total: (result as unknown[]).length });
    } catch (err) {
      fastify.log.error(err, 'Failed to get timeline incompatibilities');
      return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // POST /api/intelligence/theory-attacks/:caseId
  // Generate prosecutor theory attack surfaces
  fastify.post('/api/intelligence/theory-attacks/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    if (!params.caseId) return reply.code(400).send({ error: 'Required: caseId' });

    try {
      const result = await generateTheoryAttackSurfaces(params.caseId);
      return reply.code(200).send(result);
    } catch (err) {
      fastify.log.error(err, 'Theory attack generation failed');
      return reply.code(500).send({ error: 'Generation failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // GET /api/intelligence/theory-attacks/:caseId
  // Get theory attack surfaces with optional filters
  fastify.get('/api/intelligence/theory-attacks/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    const query = req.query as { type?: string; severity?: string };
    if (!params.caseId) return reply.code(400).send({ error: 'Required: caseId' });

    try {
      const result = await getTheoryAttackSurfaces(params.caseId, query);
      return reply.code(200).send({ caseId: params.caseId, attacks: result, total: (result as unknown[]).length });
    } catch (err) {
      fastify.log.error(err, 'Failed to get theory attacks');
      return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // GET /api/intelligence/validation
  // Live validation report
  fastify.get('/api/intelligence/validation', async (_req, reply) => {
    try {
      const report = await generateIntelligenceValidationReport();
      return reply.code(200).send(report);
    } catch (err) {
      fastify.log.error(err, 'Validation report failed');
      return reply.code(500).send({ error: 'Validation report failed', details: err instanceof Error ? err.message : String(err) });
    }
  });
}
