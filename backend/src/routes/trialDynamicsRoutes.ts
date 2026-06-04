// ============================================================================
// Phase D.7 — Trial Dynamics Routes
// Analyzes litigation clarity and evidentiary coherence. NEVER manipulates juries.
// ============================================================================

import { FastifyInstance } from 'fastify';
import {
  runFullTrialDynamics,
  scoreNarrativeCoherence,
  detectJurorConfusion,
  scoreContradictionSalience,
  modelWitnessCredibilityImpact,
  analyzeBurdenClarity,
  amplifyReasonableDoubt,
  analyzeTheoryComplexity,
  modelTimelineComprehension,
  balanceEvidentiaryWeight,
} from '../services/trialDynamicsService.js';
import prisma from '../lib/prisma.js';

export async function registerTrialDynamicsRoutes(fastify: FastifyInstance) {

  // POST /api/dynamics/analyze/:caseId — Full trial dynamics analysis
  fastify.post('/api/dynamics/analyze/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const result = await runFullTrialDynamics(params.caseId);
      return reply.code(200).send(result);
    } catch (err) {
      fastify.log.error(err, 'Trial dynamics analysis failed');
      return reply.code(500).send({ error: 'Analysis failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // POST /api/dynamics/narrative/:caseId
  fastify.post('/api/dynamics/narrative/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await scoreNarrativeCoherence(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });

  // GET /api/dynamics/narrative/:caseId
  fastify.get('/api/dynamics/narrative/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const score = await prisma.narrativeCoherenceScore.findFirst({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' } });
      if (!score) return reply.code(200).send(null);
      return reply.code(200).send({ ...score, weakPoints: JSON.parse(score.weakPoints), strengthPoints: JSON.parse(score.strengthPoints) });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // POST /api/dynamics/confusion/:caseId
  fastify.post('/api/dynamics/confusion/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await detectJurorConfusion(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });

  // GET /api/dynamics/confusion/:caseId
  fastify.get('/api/dynamics/confusion/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const zones = await prisma.jurorConfusionZone.findMany({ where: { caseId: params.caseId }, orderBy: { severity: 'asc' } });
      return reply.code(200).send({ caseId: params.caseId, zones, total: zones.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // POST /api/dynamics/salience/:caseId
  fastify.post('/api/dynamics/salience/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await scoreContradictionSalience(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });

  // GET /api/dynamics/salience/:caseId
  fastify.get('/api/dynamics/salience/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const scores = await prisma.contradictionSalienceScore.findMany({ where: { caseId: params.caseId }, orderBy: { presentationPriority: 'asc' } });
      return reply.code(200).send({ caseId: params.caseId, scores, total: scores.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // POST /api/dynamics/witness/:caseId
  fastify.post('/api/dynamics/witness/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await modelWitnessCredibilityImpact(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });

  // GET /api/dynamics/witness/:caseId
  fastify.get('/api/dynamics/witness/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const witnesses = await prisma.witnessCredibilityImpact.findMany({ where: { caseId: params.caseId }, orderBy: { overallCredibility: 'asc' } });
      return reply.code(200).send({ caseId: params.caseId, witnesses, total: witnesses.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // POST /api/dynamics/burden/:caseId
  fastify.post('/api/dynamics/burden/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await analyzeBurdenClarity(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });

  // GET /api/dynamics/burden/:caseId
  fastify.get('/api/dynamics/burden/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const analyses = await prisma.burdenClarityAnalysis.findMany({ where: { caseId: params.caseId }, orderBy: { overallBurdenClarity: 'asc' } });
      return reply.code(200).send({ caseId: params.caseId, analyses, total: analyses.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // POST /api/dynamics/doubt/:caseId
  fastify.post('/api/dynamics/doubt/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await amplifyReasonableDoubt(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });

  // GET /api/dynamics/doubt/:caseId
  fastify.get('/api/dynamics/doubt/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const items = await prisma.reasonableDoubtAmplifier.findMany({ where: { caseId: params.caseId }, orderBy: { presentationOrder: 'asc' } });
      return reply.code(200).send({ caseId: params.caseId, items, total: items.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // POST /api/dynamics/complexity/:caseId
  fastify.post('/api/dynamics/complexity/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await analyzeTheoryComplexity(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });

  // GET /api/dynamics/complexity/:caseId
  fastify.get('/api/dynamics/complexity/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const scores = await prisma.theoryComplexityScore.findMany({ where: { caseId: params.caseId } });
      return reply.code(200).send({ caseId: params.caseId, scores, total: scores.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // POST /api/dynamics/timeline/:caseId
  fastify.post('/api/dynamics/timeline/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await modelTimelineComprehension(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });

  // GET /api/dynamics/timeline/:caseId
  fastify.get('/api/dynamics/timeline/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const model = await prisma.timelineComprehensionModel.findFirst({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' } });
      return reply.code(200).send(model || null);
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // POST /api/dynamics/weight/:caseId
  fastify.post('/api/dynamics/weight/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await balanceEvidentiaryWeight(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });

  // GET /api/dynamics/weight/:caseId
  fastify.get('/api/dynamics/weight/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const balance = await prisma.evidentiaryWeightBalance.findFirst({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' } });
      if (!balance) return reply.code(200).send(null);
      return reply.code(200).send({ ...balance, vulnerabilities: JSON.parse(balance.vulnerabilities) });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // GET /api/dynamics/validation — Live validation
  fastify.get('/api/dynamics/validation', async (_req, reply) => {
    try {
      const [narrative, confusion, salience, witness, burden, doubt, complexity, timeline, weight] = await Promise.all([
        prisma.narrativeCoherenceScore.count(),
        prisma.jurorConfusionZone.count(),
        prisma.contradictionSalienceScore.count(),
        prisma.witnessCredibilityImpact.count(),
        prisma.burdenClarityAnalysis.count(),
        prisma.reasonableDoubtAmplifier.count(),
        prisma.theoryComplexityScore.count(),
        prisma.timelineComprehensionModel.count(),
        prisma.evidentiaryWeightBalance.count(),
      ]);
      return reply.code(200).send({
        phase: 'D.7',
        name: 'Jury Persuasion Analytics + Trial Dynamics Intelligence',
        generatedAt: new Date().toISOString(),
        totals: { narrativeCoherenceScores: narrative, jurorConfusionZones: confusion, contradictionSalienceScores: salience, witnessCredibilityImpacts: witness, burdenClarityAnalyses: burden, reasonableDoubtAmplifiers: doubt, theoryComplexityScores: complexity, timelineComprehensionModels: timeline, evidentiaryWeightBalances: weight },
        deterministicConstraints: {
          noJuryManipulation: true,
          noPsychologicalExploitation: true,
          noFabricatedPersuasionTactics: true,
          noEmotionalManipulationEngines: true,
          noSpeculativeJurorProfiling: true,
          corePrinciple: 'CourtAccess analyzes litigation clarity and evidentiary coherence. It does NOT manipulate juries.',
        },
      });
    } catch (err) { return reply.code(500).send({ error: 'Validation failed' }); }
  });
}
