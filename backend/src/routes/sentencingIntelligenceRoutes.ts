// ============================================================================
// Phase E.3 — Sentencing Intelligence Routes
// Organizes sentencing-related legal structures. NEVER functions as sentencing counsel.
// ============================================================================

import { FastifyInstance } from 'fastify';
import {
  runFullSentencingIntelligence,
  calculateSentencingExposure,
  analyzeEnhancementStacking,
  modelConsecutiveConcurrentExposure,
  analyzeProbationEligibility,
  organizeMitigationFactors,
  trackAggravationFactors,
  analyzeStrikesPriors,
  calculateCustodyCredits,
  indexJudicialRulingTrends,
  modelPleaConsequences,
} from '../services/sentencingIntelligenceService.js';
import prisma from '../lib/prisma.js';

export async function registerSentencingIntelligenceRoutes(fastify: FastifyInstance) {

  // POST /api/sentencing/analyze/:caseId — Full sentencing analysis
  fastify.post('/api/sentencing/analyze/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const result = await runFullSentencingIntelligence(params.caseId);
      return reply.code(200).send(result);
    } catch (err) {
      fastify.log.error(err, 'Sentencing analysis failed');
      return reply.code(500).send({ error: 'Analysis failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // POST/GET /api/sentencing/exposure/:caseId
  fastify.post('/api/sentencing/exposure/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await calculateSentencingExposure(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/sentencing/exposure/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const exposures = await prisma.sentencingExposure.findMany({ where: { caseId: params.caseId }, orderBy: { totalExposureMonthsHigh: 'desc' } });
      return reply.code(200).send({ caseId: params.caseId, exposures, total: exposures.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // POST/GET /api/sentencing/enhancements/:caseId
  fastify.post('/api/sentencing/enhancements/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await analyzeEnhancementStacking(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/sentencing/enhancements/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const enhancements = await prisma.enhancementStacking.findMany({ where: { caseId: params.caseId }, orderBy: { stackingOrder: 'asc' } });
      return reply.code(200).send({ caseId: params.caseId, enhancements, total: enhancements.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // POST/GET /api/sentencing/consecutive/:caseId
  fastify.post('/api/sentencing/consecutive/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await modelConsecutiveConcurrentExposure(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/sentencing/consecutive/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const models = await prisma.consecutiveConcurrentExposure.findMany({ where: { caseId: params.caseId } });
      return reply.code(200).send({ caseId: params.caseId, models, total: models.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // POST/GET /api/sentencing/probation/:caseId
  fastify.post('/api/sentencing/probation/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await analyzeProbationEligibility(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/sentencing/probation/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const eligibilities = await prisma.probationEligibility.findMany({ where: { caseId: params.caseId } });
      return reply.code(200).send({ caseId: params.caseId, eligibilities, total: eligibilities.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // POST/GET /api/sentencing/mitigation/:caseId
  fastify.post('/api/sentencing/mitigation/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await organizeMitigationFactors(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/sentencing/mitigation/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const factors = await prisma.mitigationFactor.findMany({ where: { caseId: params.caseId }, orderBy: { strength: 'asc' } });
      return reply.code(200).send({ caseId: params.caseId, factors, total: factors.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // POST/GET /api/sentencing/aggravation/:caseId
  fastify.post('/api/sentencing/aggravation/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await trackAggravationFactors(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/sentencing/aggravation/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const factors = await prisma.aggravationFactor.findMany({ where: { caseId: params.caseId }, orderBy: { strength: 'asc' } });
      return reply.code(200).send({ caseId: params.caseId, factors, total: factors.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // POST/GET /api/sentencing/strikes/:caseId
  fastify.post('/api/sentencing/strikes/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await analyzeStrikesPriors(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/sentencing/strikes/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const priors = await prisma.strikePriorAnalysis.findMany({ where: { caseId: params.caseId } });
      return reply.code(200).send({ caseId: params.caseId, priors, total: priors.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // POST/GET /api/sentencing/credits/:caseId
  fastify.post('/api/sentencing/credits/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await calculateCustodyCredits(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/sentencing/credits/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const creditList = await prisma.custodyCredit.findMany({ where: { caseId: params.caseId } });
      return reply.code(200).send({ caseId: params.caseId, creditAnalysis: creditList[0] || null, total: creditList.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // POST/GET /api/sentencing/trends/:caseId
  fastify.post('/api/sentencing/trends/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await indexJudicialRulingTrends(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/sentencing/trends/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const trends = await prisma.judicialRulingTrend.findMany({ where: { caseId: params.caseId } });
      return reply.code(200).send({ caseId: params.caseId, trends, total: trends.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // POST/GET /api/sentencing/plea/:caseId
  fastify.post('/api/sentencing/plea/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await modelPleaConsequences(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/sentencing/plea/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const consequences = await prisma.pleaConsequence.findMany({ where: { caseId: params.caseId } });
      return reply.code(200).send({ caseId: params.caseId, consequences, total: consequences.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // GET /api/sentencing/validation
  fastify.get('/api/sentencing/validation', async (_req, reply) => {
    try {
      const [exp, enh, con, pro, mit, agg, str, cre, tre, ple] = await Promise.all([
        prisma.sentencingExposure.count(),
        prisma.enhancementStacking.count(),
        prisma.consecutiveConcurrentExposure.count(),
        prisma.probationEligibility.count(),
        prisma.mitigationFactor.count(),
        prisma.aggravationFactor.count(),
        prisma.strikePriorAnalysis.count(),
        prisma.custodyCredit.count(),
        prisma.judicialRulingTrend.count(),
        prisma.pleaConsequence.count(),
      ]);
      return reply.code(200).send({
        phase: 'E.3',
        name: 'Judicial Analytics + Sentencing Intelligence Framework',
        generatedAt: new Date().toISOString(),
        totals: {
          sentencingExposures: exp, enhancementStackings: enh, consecutiveConcurrent: con,
          probationEligibilities: pro, mitigationFactors: mit, aggravationFactors: agg,
          strikePriorAnalyses: str, custodyCredits: cre, judicialRulingTrends: tre,
          pleaConsequences: ple,
        },
        deterministicConstraints: {
          noPredictingSpecificJudges: true,
          noFabricatedMitigation: true,
          noHallucinatedSentencing: true,
          noSpeculativePleaAdvice: true,
          noAISentencingRecommendations: true,
          corePrinciple: 'CourtAccess organizes sentencing-related legal structures. It does NOT function as sentencing counsel.',
        },
      });
    } catch (err) { return reply.code(500).send({ error: 'Validation failed' }); }
  });
}
