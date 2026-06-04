// ============================================================================
// Phase N.2 — Operational Reliability Routes
// Operational excellence over architectural expansion.
// ============================================================================

import { FastifyInstance } from 'fastify';
import {
  runFullOperationalReliabilityAnalysis,
  buildGoldenCorpus,
  runDeterministicReplay,
  runCrossLayerRegression,
  runLoadStabilityTests,
  runSurvivabilityTests,
  trackUiUxRefinements,
  checkReleaseGates,
  generateCertificationManifest,
  scoreReliability,
} from '../services/operationalReliabilityService.js';
import prisma from '../lib/prisma.js';

export async function registerOperationalReliabilityRoutes(fastify: FastifyInstance) {

  // POST — Full operational reliability analysis
  fastify.post('/api/reliability/analyze/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const result = await runFullOperationalReliabilityAnalysis(params.caseId);
      return reply.code(200).send(result);
    } catch (err) {
      fastify.log.error(err, 'Operational reliability analysis failed');
      return reply.code(500).send({ error: 'Analysis failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // Golden-Case Corpus
  fastify.post('/api/reliability/corpus/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await buildGoldenCorpus(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/reliability/corpus/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.goldenCaseCorpusEntry.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, corpus: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Deterministic Replay
  fastify.post('/api/reliability/replay/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await runDeterministicReplay(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/reliability/replay/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.deterministicReplayRun.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 100 });
      return reply.code(200).send({ caseId: params.caseId, replays: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Cross-Layer Regression
  fastify.post('/api/reliability/regression/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await runCrossLayerRegression(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/reliability/regression/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.crossLayerRegressionRun.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, regressions: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Load + Stability
  fastify.post('/api/reliability/load-stability/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await runLoadStabilityTests(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/reliability/load-stability/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.loadStabilityTestRun.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, loadTests: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Survivability
  fastify.post('/api/reliability/survivability/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await runSurvivabilityTests(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/reliability/survivability/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.survivabilityTestRun.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, survivability: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // UI/UX Refinement
  fastify.post('/api/reliability/uiux/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await trackUiUxRefinements(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/reliability/uiux/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.uiUxRefinementEntry.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, refinements: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Release Gates
  fastify.post('/api/reliability/gates/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await checkReleaseGates(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/reliability/gates/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.releaseGateCheck.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, gates: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Certification Manifests
  fastify.post('/api/reliability/manifests/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await generateCertificationManifest(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/reliability/manifests/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.certificationManifestEntry.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, manifests: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Reliability Scores
  fastify.post('/api/reliability/scores/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await scoreReliability(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/reliability/scores/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.operationalReliabilityScore.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, scores: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Validation endpoint
  fastify.get('/api/reliability/validation', async (_req, reply) => {
    try {
      const [corpus, replays, regressions, loadTests, survivability, uiux, gates, manifests, expectedOutputs, scores] = await Promise.all([
        prisma.goldenCaseCorpusEntry.count(),
        prisma.deterministicReplayRun.count(),
        prisma.crossLayerRegressionRun.count(),
        prisma.loadStabilityTestRun.count(),
        prisma.survivabilityTestRun.count(),
        prisma.uiUxRefinementEntry.count(),
        prisma.releaseGateCheck.count(),
        prisma.certificationManifestEntry.count(),
        prisma.corpusExpectedOutput.count(),
        prisma.operationalReliabilityScore.count(),
      ]);
      return reply.code(200).send({
        phase: 'N.2',
        name: 'Golden-Case Validation + Operational Reliability Framework',
        generatedAt: new Date().toISOString(),
        totals: { corpus, replays, regressions, loadTests, survivability, uiux, gates, manifests, expectedOutputs, scores },
        constraints: {
          deterministic: true, reproducible: true, auditable: true,
          transparent: true, evidenceLinked: true, hashVerifiable: true,
          governanceControlled: true, operationallyExplainable: true,
          operationallySurvivable: true,
          noNewSpeculativeLayers: true, noAutonomousMutation: true,
          noProbabilisticBehavior: true, noOpaqueAnalytics: true,
          corePrinciple: 'Operational excellence over architectural expansion.',
        },
      });
    } catch (err) { return reply.code(500).send({ error: 'Validation failed' }); }
  });
}
