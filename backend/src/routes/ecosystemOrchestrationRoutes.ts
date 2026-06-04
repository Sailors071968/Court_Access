// ============================================================================
// Phase M.2 — Ecosystem Orchestration Routes
// Transparent orchestration — no hidden control systems.
// ============================================================================

import { FastifyInstance } from 'fastify';
import {
  runFullEcosystemOrchestrationAnalysis,
  orchestrateEcosystem,
  coordinateLifecycles,
  synchronizeConvergence,
  harmonizeEcosystemState,
  buildOrchestrationManifest,
  replayCoordination,
  validateOrchestration,
  certifyConvergence,
  trackCompleteness,
  synchronizeEcosystemLineage,
} from '../services/ecosystemOrchestrationService.js';
import prisma from '../lib/prisma.js';

export async function registerEcosystemOrchestrationRoutes(fastify: FastifyInstance) {

  // POST — Full orchestration analysis
  fastify.post('/api/orchestration/analyze/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const result = await runFullEcosystemOrchestrationAnalysis(params.caseId);
      return reply.code(200).send(result);
    } catch (err) {
      fastify.log.error(err, 'Orchestration analysis failed');
      return reply.code(500).send({ error: 'Analysis failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // Ecosystem Orchestration
  fastify.post('/api/orchestration/ecosystem/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await orchestrateEcosystem(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/orchestration/ecosystem/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.unifiedEcosystemOrchestration.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 20 });
      return reply.code(200).send({ caseId: params.caseId, orchestrations: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Lifecycle Coordination
  fastify.post('/api/orchestration/lifecycles/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await coordinateLifecycles(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/orchestration/lifecycles/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.crossSubsystemLifecycleCoordination.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, coordinations: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Convergence Sync
  fastify.post('/api/orchestration/convergence/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await synchronizeConvergence(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/orchestration/convergence/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.platformConvergenceSynchronization.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, convergences: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // State Harmonization
  fastify.post('/api/orchestration/state/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await harmonizeEcosystemState(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/orchestration/state/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.ecosystemStateHarmonization.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, states: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Orchestration Manifests
  fastify.post('/api/orchestration/manifests/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await buildOrchestrationManifest(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/orchestration/manifests/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.unifiedOrchestrationManifest.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 20 });
      return reply.code(200).send({ caseId: params.caseId, manifests: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Coordination Replay
  fastify.post('/api/orchestration/replay/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await replayCoordination(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/orchestration/replay/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.deterministicCoordinationReplay.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 20 });
      return reply.code(200).send({ caseId: params.caseId, replays: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Orchestration Validation
  fastify.post('/api/orchestration/validation-run/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await validateOrchestration(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/orchestration/validation-run/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.crossLayerOrchestrationValidation.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, validations: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Convergence Certification
  fastify.post('/api/orchestration/certification/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await certifyConvergence(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/orchestration/certification/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.finalConvergenceCertification.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, certifications: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Completeness Tracking
  fastify.post('/api/orchestration/completeness/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await trackCompleteness(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/orchestration/completeness/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.operationalCompletenessTracking.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, completeness: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Ecosystem Lineage
  fastify.post('/api/orchestration/lineage/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await synchronizeEcosystemLineage(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/orchestration/lineage/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.ecosystemLineageSynchronization.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, lineages: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Validation endpoint
  fastify.get('/api/orchestration/validation', async (_req, reply) => {
    try {
      const [orchestrations, lifecycles, convergences, states, manifests, replays, validations, certifications, completeness, lineages] = await Promise.all([
        prisma.unifiedEcosystemOrchestration.count(),
        prisma.crossSubsystemLifecycleCoordination.count(),
        prisma.platformConvergenceSynchronization.count(),
        prisma.ecosystemStateHarmonization.count(),
        prisma.unifiedOrchestrationManifest.count(),
        prisma.deterministicCoordinationReplay.count(),
        prisma.crossLayerOrchestrationValidation.count(),
        prisma.finalConvergenceCertification.count(),
        prisma.operationalCompletenessTracking.count(),
        prisma.ecosystemLineageSynchronization.count(),
      ]);
      return reply.code(200).send({
        phase: 'M.2',
        name: 'Unified Ecosystem Orchestration + Deterministic Platform Convergence Framework',
        generatedAt: new Date().toISOString(),
        totals: { orchestrations, lifecycles, convergences, states, manifests, replays, validations, certifications, completeness, lineages },
        constraints: {
          noHiddenOrchestrationMutation: true,
          noOpaqueSubsystemCoordination: true,
          noUnverifiableEcosystemStateChanges: true,
          noAutonomousGovernanceDrift: true,
          noSecretOrchestrationOverrides: true,
          corePrinciple: 'CourtAccess orchestrates platform convergence transparently and deterministically. It does NOT create opaque autonomous ecosystem control systems.',
        },
      });
    } catch (err) { return reply.code(500).send({ error: 'Validation failed' }); }
  });
}
