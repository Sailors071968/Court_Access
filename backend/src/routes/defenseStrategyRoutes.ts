// ============================================================================
// Phase D.4 — Defense Strategy Synthesis + Attorney Workspace Routes
// Citation-backed litigation intelligence. NEVER acts like a lawyer.
// Organizes provable defense opportunities for attorney review.
// ============================================================================

import { FastifyInstance } from 'fastify';
import {
  runFullDefenseSynthesis,
  synthesizeDefenseIssues,
  detectMotionOpportunities,
  buildImpeachmentPackets,
  computeBurdenCollapseScores,
  buildReasonableDoubtStructures,
  getAttorneyWorkspaceData,
} from '../services/defenseStrategySynthesisService.js';
import prisma from '../lib/prisma.js';

export async function registerDefenseStrategyRoutes(fastify: FastifyInstance) {

  // POST /api/defense/synthesize/:caseId — Run full defense synthesis
  fastify.post('/api/defense/synthesize/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    if (!params.caseId) return reply.code(400).send({ error: 'Required: caseId' });

    try {
      const result = await runFullDefenseSynthesis(params.caseId);
      return reply.code(200).send(result);
    } catch (err) {
      fastify.log.error(err, 'Defense synthesis failed');
      return reply.code(500).send({ error: 'Defense synthesis failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // GET /api/defense/workspace/:caseId — Attorney workspace data (all panes)
  fastify.get('/api/defense/workspace/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    if (!params.caseId) return reply.code(400).send({ error: 'Required: caseId' });

    try {
      const result = await getAttorneyWorkspaceData(params.caseId);
      return reply.code(200).send(result);
    } catch (err) {
      fastify.log.error(err, 'Workspace data failed');
      return reply.code(500).send({ error: 'Workspace data failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // POST /api/defense/issues/:caseId — Synthesize defense issues only
  fastify.post('/api/defense/issues/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    if (!params.caseId) return reply.code(400).send({ error: 'Required: caseId' });

    try {
      const result = await synthesizeDefenseIssues(params.caseId);
      return reply.code(200).send(result);
    } catch (err) {
      fastify.log.error(err, 'Issue synthesis failed');
      return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // GET /api/defense/issues/:caseId — Get defense issues with filters
  fastify.get('/api/defense/issues/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    const query = req.query as { severity?: string; type?: string; status?: string };
    if (!params.caseId) return reply.code(400).send({ error: 'Required: caseId' });

    try {
      const issues = await prisma.defenseIssue.findMany({
        where: {
          caseId: params.caseId,
          ...(query.severity ? { severity: query.severity } : {}),
          ...(query.type ? { issueType: query.type } : {}),
          ...(query.status ? { status: query.status } : {}),
        },
        orderBy: { priority: 'asc' },
      });
      return reply.code(200).send({ caseId: params.caseId, issues, total: issues.length });
    } catch (err) {
      return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // POST /api/defense/motions/:caseId — Detect motion opportunities
  fastify.post('/api/defense/motions/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    if (!params.caseId) return reply.code(400).send({ error: 'Required: caseId' });

    try {
      const result = await detectMotionOpportunities(params.caseId);
      return reply.code(200).send(result);
    } catch (err) {
      return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // GET /api/defense/motions/:caseId — Get motion opportunities
  fastify.get('/api/defense/motions/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    const query = req.query as { type?: string; strength?: string };
    if (!params.caseId) return reply.code(400).send({ error: 'Required: caseId' });

    try {
      const motions = await prisma.motionOpportunity.findMany({
        where: {
          caseId: params.caseId,
          ...(query.type ? { motionType: query.type } : {}),
          ...(query.strength ? { strength: query.strength } : {}),
        },
        orderBy: { priority: 'asc' },
      });
      return reply.code(200).send({ caseId: params.caseId, motions, total: motions.length });
    } catch (err) {
      return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // POST /api/defense/impeachment/:caseId — Build impeachment packets
  fastify.post('/api/defense/impeachment/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    if (!params.caseId) return reply.code(400).send({ error: 'Required: caseId' });

    try {
      const result = await buildImpeachmentPackets(params.caseId);
      return reply.code(200).send(result);
    } catch (err) {
      return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // GET /api/defense/impeachment/:caseId — Get impeachment packets
  fastify.get('/api/defense/impeachment/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    const query = req.query as { witness?: string };
    if (!params.caseId) return reply.code(400).send({ error: 'Required: caseId' });

    try {
      const packets = await prisma.impeachmentPacket.findMany({
        where: {
          caseId: params.caseId,
          ...(query.witness ? { witnessName: { contains: query.witness, mode: 'insensitive' as const } } : {}),
        },
        orderBy: { credibilityScore: 'asc' },
      });
      return reply.code(200).send({ caseId: params.caseId, packets, total: packets.length });
    } catch (err) {
      return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // POST /api/defense/burden-collapse/:caseId — Compute burden collapse scores
  fastify.post('/api/defense/burden-collapse/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    if (!params.caseId) return reply.code(400).send({ error: 'Required: caseId' });

    try {
      const result = await computeBurdenCollapseScores(params.caseId);
      return reply.code(200).send(result);
    } catch (err) {
      return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // GET /api/defense/burden-collapse/:caseId — Get burden collapse scores
  fastify.get('/api/defense/burden-collapse/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    if (!params.caseId) return reply.code(400).send({ error: 'Required: caseId' });

    try {
      const scores = await prisma.burdenCollapseScore.findMany({
        where: { caseId: params.caseId },
        orderBy: { collapseScore: 'desc' },
      });
      return reply.code(200).send({ caseId: params.caseId, scores, total: scores.length });
    } catch (err) {
      return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // POST /api/defense/reasonable-doubt/:caseId — Build reasonable doubt structures
  fastify.post('/api/defense/reasonable-doubt/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    if (!params.caseId) return reply.code(400).send({ error: 'Required: caseId' });

    try {
      const result = await buildReasonableDoubtStructures(params.caseId);
      return reply.code(200).send(result);
    } catch (err) {
      return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // GET /api/defense/reasonable-doubt/:caseId — Get reasonable doubt structures
  fastify.get('/api/defense/reasonable-doubt/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    const query = req.query as { category?: string; strength?: string };
    if (!params.caseId) return reply.code(400).send({ error: 'Required: caseId' });

    try {
      const structures = await prisma.juryReasonableDoubtStructure.findMany({
        where: {
          caseId: params.caseId,
          ...(query.category ? { doubtCategory: query.category } : {}),
          ...(query.strength ? { strength: query.strength } : {}),
        },
        orderBy: { strength: 'asc' },
      });
      return reply.code(200).send({ caseId: params.caseId, structures, total: structures.length });
    } catch (err) {
      return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // GET /api/defense/validation — Live validation report
  fastify.get('/api/defense/validation', async (_req, reply) => {
    try {
      const [issues, motions, packets, scores, doubt] = await Promise.all([
        prisma.defenseIssue.count(),
        prisma.motionOpportunity.count(),
        prisma.impeachmentPacket.count(),
        prisma.burdenCollapseScore.count(),
        prisma.juryReasonableDoubtStructure.count(),
      ]);
      return reply.code(200).send({
        phase: 'D.4',
        name: 'Defense Strategy Synthesis + Attorney Intelligence',
        generatedAt: new Date().toISOString(),
        totals: { defenseIssues: issues, motionOpportunities: motions, impeachmentPackets: packets, burdenCollapseScores: scores, reasonableDoubtStructures: doubt },
        deterministicConstraints: {
          noFakeLegalAdvice: true,
          noHallucinatedMotions: true,
          noInventedImpeachment: true,
          noUncitedStrategyClaims: true,
          noSpeculativeConstitutionalViolations: true,
          noGenerativeCaseTheories: true,
          corePrinciple: 'CourtAccess NEVER acts like a lawyer. It organizes provable litigation intelligence for criminal defendants and defense attorneys.',
        },
      });
    } catch (err) {
      return reply.code(500).send({ error: 'Validation failed', details: err instanceof Error ? err.message : String(err) });
    }
  });
}
