// ============================================================================
// Phase N.4 — Operational Maturation Routes
// Operational refinement. No speculative architecture growth.
// ============================================================================

import { FastifyInstance } from 'fastify';
import {
  runFullOperationalMaturationAnalysis,
  collectAttorneyReviews,
  runUiUxOptimization,
  tuneInfrastructure,
  verifyDeploymentMaturity,
  refineTelemetry,
  scoreProductionReadiness,
  rehearseOnboarding,
  runLongDurationStability,
  certifyProductionCandidate,
  generateMaturityManifests,
} from '../services/operationalMaturationService.js';
import prisma from '../lib/prisma.js';

export async function registerOperationalMaturationRoutes(fastify: FastifyInstance) {

  // POST — Full operational maturation analysis
  fastify.post('/api/maturation/analyze/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const result = await runFullOperationalMaturationAnalysis(params.caseId);
      return reply.code(200).send(result);
    } catch (err) {
      fastify.log.error(err, 'Operational maturation analysis failed');
      return reply.code(500).send({ error: 'Analysis failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // Attorney Reviews
  fastify.post('/api/maturation/reviews/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await collectAttorneyReviews(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/maturation/reviews/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.attorneyPilotReview.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, reviews: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // UI/UX Optimization
  fastify.post('/api/maturation/uiux/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await runUiUxOptimization(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/maturation/uiux/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.uiUxOptimizationCycle.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, cycles: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Infrastructure Tuning
  fastify.post('/api/maturation/infrastructure/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await tuneInfrastructure(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/maturation/infrastructure/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.infrastructureTuningEntry.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, tunings: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Deployment Maturity
  fastify.post('/api/maturation/deployment/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await verifyDeploymentMaturity(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/maturation/deployment/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.deploymentMaturityCheck.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, maturity: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Telemetry Refinement
  fastify.post('/api/maturation/telemetry/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await refineTelemetry(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/maturation/telemetry/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.telemetryRefinementEntry.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, telemetry: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Readiness Scoring
  fastify.post('/api/maturation/readiness/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await scoreProductionReadiness(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/maturation/readiness/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.maturationReadinessScore.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, scores: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Onboarding Rehearsals
  fastify.post('/api/maturation/onboarding/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await rehearseOnboarding(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/maturation/onboarding/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.institutionalOnboardingRehearsal.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, rehearsals: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Long-Duration Stability
  fastify.post('/api/maturation/stability/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await runLongDurationStability(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/maturation/stability/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.longDurationStabilityRun.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, stability: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Candidate Certification
  fastify.post('/api/maturation/certification/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await certifyProductionCandidate(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/maturation/certification/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.productionCandidateCertification.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, certifications: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Maturity Manifests
  fastify.post('/api/maturation/manifests/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await generateMaturityManifests(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/maturation/manifests/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.operationalMaturityManifest.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, manifests: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Validation endpoint
  fastify.get('/api/maturation/validation', async (_req, reply) => {
    try {
      const [reviews, cycles, tunings, maturity, telemetry, scores, rehearsals, stability, certifications, manifests] = await Promise.all([
        prisma.attorneyPilotReview.count(),
        prisma.uiUxOptimizationCycle.count(),
        prisma.infrastructureTuningEntry.count(),
        prisma.deploymentMaturityCheck.count(),
        prisma.telemetryRefinementEntry.count(),
        prisma.maturationReadinessScore.count(),
        prisma.institutionalOnboardingRehearsal.count(),
        prisma.longDurationStabilityRun.count(),
        prisma.productionCandidateCertification.count(),
        prisma.operationalMaturityManifest.count(),
      ]);
      return reply.code(200).send({
        phase: 'N.4',
        name: 'Controlled Production Readiness + Operational Maturation',
        generatedAt: new Date().toISOString(),
        totals: { reviews, cycles, tunings, maturity, telemetry, scores, rehearsals, stability, certifications, manifests },
        constraints: {
          operationalRefinement: true,
          noSpeculativeGrowth: true,
          noUncontrolledRollout: true,
          noAutonomousExpansion: true,
          noOpaqueTelemetry: true,
          corePrinciple: 'Operational refinement. No speculative architecture growth.',
        },
      });
    } catch (err) { return reply.code(500).send({ error: 'Validation failed' }); }
  });
}
