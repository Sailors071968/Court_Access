// ============================================================================
// Phase N.1 — Production Readiness Routes
// Deterministic validation — no opaque systems.
// ============================================================================

import { FastifyInstance } from 'fastify';
import {
  runFullProductionReadinessAnalysis,
  runIntegrationTests,
  validateRegression,
  runBenchmarks,
  verifyStability,
  rehearseDeployment,
  simulateWorkflows,
  validateSecurity,
  certifyProduction,
  validateGoldenCorpus,
  runRedTeamValidation,
} from '../services/productionReadinessService.js';
import prisma from '../lib/prisma.js';

export async function registerProductionReadinessRoutes(fastify: FastifyInstance) {

  // POST — Full production readiness analysis
  fastify.post('/api/readiness/analyze/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const result = await runFullProductionReadinessAnalysis(params.caseId);
      return reply.code(200).send(result);
    } catch (err) {
      fastify.log.error(err, 'Production readiness analysis failed');
      return reply.code(500).send({ error: 'Analysis failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // Integration Tests
  fastify.post('/api/readiness/integration/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await runIntegrationTests(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/readiness/integration/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.integrationTestRecord.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, tests: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Regression Validation
  fastify.post('/api/readiness/regression/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await validateRegression(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/readiness/regression/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.regressionValidationRecord.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, regressions: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Performance Benchmarks
  fastify.post('/api/readiness/benchmarks/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await runBenchmarks(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/readiness/benchmarks/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.performanceBenchmarkRecord.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, benchmarks: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Stability Verification
  fastify.post('/api/readiness/stability/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await verifyStability(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/readiness/stability/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.stabilityVerificationRecord.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, stability: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Deployment Rehearsal
  fastify.post('/api/readiness/rehearsal/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await rehearseDeployment(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/readiness/rehearsal/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.deploymentRehearsalRecord.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 20 });
      return reply.code(200).send({ caseId: params.caseId, rehearsals: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Workflow Simulations
  fastify.post('/api/readiness/simulations/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await simulateWorkflows(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/readiness/simulations/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.workflowSimulationRecord.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, simulations: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Security Hardening
  fastify.post('/api/readiness/security/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await validateSecurity(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/readiness/security/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.securityHardeningValidation.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, security: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Production Certification
  fastify.post('/api/readiness/certification/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await certifyProduction(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/readiness/certification/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.productionCertificationRecord.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, certifications: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Golden-Case Corpus
  fastify.post('/api/readiness/golden-corpus/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await validateGoldenCorpus(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/readiness/golden-corpus/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.goldenCaseValidationCorpus.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, corpus: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Red-Team Validation
  fastify.post('/api/readiness/red-team/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await runRedTeamValidation(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/readiness/red-team/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.redTeamValidationRecord.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, redTeam: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Validation endpoint
  fastify.get('/api/readiness/validation', async (_req, reply) => {
    try {
      const [integration, regression, benchmarks, stability, rehearsals, simulations, security, certifications, goldenCorpus, redTeam] = await Promise.all([
        prisma.integrationTestRecord.count(),
        prisma.regressionValidationRecord.count(),
        prisma.performanceBenchmarkRecord.count(),
        prisma.stabilityVerificationRecord.count(),
        prisma.deploymentRehearsalRecord.count(),
        prisma.workflowSimulationRecord.count(),
        prisma.securityHardeningValidation.count(),
        prisma.productionCertificationRecord.count(),
        prisma.goldenCaseValidationCorpus.count(),
        prisma.redTeamValidationRecord.count(),
      ]);
      return reply.code(200).send({
        phase: 'N.1',
        name: 'Platform Stabilization, Validation & Controlled Production Readiness',
        generatedAt: new Date().toISOString(),
        totals: { integration, regression, benchmarks, stability, rehearsals, simulations, security, certifications, goldenCorpus, redTeam },
        constraints: {
          deterministic: true, reproducible: true, auditable: true,
          transparent: true, evidenceLinked: true, hashVerifiable: true,
          governanceControlled: true, operationallyExplainable: true,
          neverProbabilistic: true, neverOpaque: true,
          neverSelfMutating: true, neverAutonomous: true, neverUnverifiable: true,
          corePrinciple: 'CourtAccess must remain deterministic, reproducible, auditable, transparent, evidence-linked, hash-verifiable, governance-controlled, and operationally explainable.',
        },
      });
    } catch (err) { return reply.code(500).send({ error: 'Validation failed' }); }
  });
}
