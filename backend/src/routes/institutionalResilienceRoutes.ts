// ============================================================================
// Phase J.1 — Institutional Resilience Routes
// Institutional continuity — deterministic preservation and recovery.
// NEVER creates opaque autonomous recovery systems.
// ============================================================================

import { FastifyInstance } from 'fastify';
import {
  runFullInstitutionalResilienceAnalysis,
  preserveEvidence,
  orchestrateDisasterRecovery,
  initializeContinuityWorkflows,
  verifyMultiRegionIntegrity,
  validateArchivalSurvivability,
  trackRecoveryGovernance,
  manageRetentionLifecycle,
  runRecoverySimulation,
  certifyPreservation,
} from '../services/institutionalResilienceService.js';
import prisma from '../lib/prisma.js';

export async function registerInstitutionalResilienceRoutes(fastify: FastifyInstance) {

  // POST — Full resilience analysis
  fastify.post('/api/resilience/analyze/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const result = await runFullInstitutionalResilienceAnalysis(params.caseId);
      return reply.code(200).send(result);
    } catch (err) {
      fastify.log.error(err, 'Resilience analysis failed');
      return reply.code(500).send({ error: 'Analysis failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // Evidence Preservation
  fastify.post('/api/resilience/preservation/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await preserveEvidence(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/resilience/preservation/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.longTermEvidencePreservation.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, preservations: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Disaster Recovery
  fastify.post('/api/resilience/disaster/:caseId', async (_req, reply) => {
    try { return reply.code(200).send(await orchestrateDisasterRecovery()); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/resilience/disaster/:caseId', async (_req, reply) => {
    try {
      const records = await prisma.disasterRecoveryOrchestration.findMany({ orderBy: { recoveryPriority: 'asc' }, take: 20 });
      return reply.code(200).send({ plans: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Continuity Workflows
  fastify.post('/api/resilience/continuity/:caseId', async (_req, reply) => {
    try { return reply.code(200).send(await initializeContinuityWorkflows()); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/resilience/continuity/:caseId', async (_req, reply) => {
    try {
      const records = await prisma.continuityOfOperationsWorkflow.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });
      return reply.code(200).send({ workflows: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Multi-Region Verification
  fastify.post('/api/resilience/regions/:caseId', async (_req, reply) => {
    try { return reply.code(200).send(await verifyMultiRegionIntegrity()); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/resilience/regions/:caseId', async (_req, reply) => {
    try {
      const records = await prisma.multiRegionIntegrityVerification.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });
      return reply.code(200).send({ verifications: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Archival Survivability
  fastify.post('/api/resilience/archival/:caseId', async (_req, reply) => {
    try { return reply.code(200).send(await validateArchivalSurvivability()); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/resilience/archival/:caseId', async (_req, reply) => {
    try {
      const records = await prisma.archivalSurvivabilityValidation.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });
      return reply.code(200).send({ validations: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Recovery Governance
  fastify.post('/api/resilience/governance/:caseId', async (_req, reply) => {
    try { return reply.code(200).send(await trackRecoveryGovernance()); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/resilience/governance/:caseId', async (_req, reply) => {
    try {
      const records = await prisma.recoveryGovernanceTracking.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });
      return reply.code(200).send({ trackings: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Retention Lifecycle
  fastify.post('/api/resilience/retention/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await manageRetentionLifecycle(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/resilience/retention/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.retentionLifecycleManagement.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, retentions: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Recovery Simulation
  fastify.post('/api/resilience/simulation/:caseId', async (_req, reply) => {
    try { return reply.code(200).send(await runRecoverySimulation()); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/resilience/simulation/:caseId', async (_req, reply) => {
    try {
      const records = await prisma.recoverySimulationFramework.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });
      return reply.code(200).send({ simulations: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Preservation Certification
  fastify.post('/api/resilience/certification/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await certifyPreservation(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/resilience/certification/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.preservationCertification.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 20 });
      return reply.code(200).send({ caseId: params.caseId, certifications: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Validation endpoint
  fastify.get('/api/resilience/validation', async (_req, reply) => {
    try {
      const [preservation, disaster, continuity, regions, archival, governance, manifests, retention, simulation, certification] = await Promise.all([
        prisma.longTermEvidencePreservation.count(),
        prisma.disasterRecoveryOrchestration.count(),
        prisma.continuityOfOperationsWorkflow.count(),
        prisma.multiRegionIntegrityVerification.count(),
        prisma.archivalSurvivabilityValidation.count(),
        prisma.recoveryGovernanceTracking.count(),
        prisma.institutionalContinuityManifest.count(),
        prisma.retentionLifecycleManagement.count(),
        prisma.recoverySimulationFramework.count(),
        prisma.preservationCertification.count(),
      ]);
      return reply.code(200).send({
        phase: 'J.1',
        name: 'Long-Term Continuity + Institutional Resilience Framework',
        generatedAt: new Date().toISOString(),
        totals: { preservation, disaster, continuity, regions, archival, governance, manifests, retention, simulation, certification },
        constraints: {
          noHiddenArchivalMutation: true,
          noUnverifiableRecovery: true,
          noOpaqueContinuityScoring: true,
          noAutonomousGovernance: true,
          noUndocumentedDeletion: true,
          corePrinciple: 'CourtAccess preserves institutional continuity and evidentiary survivability deterministically. It does NOT create opaque autonomous recovery systems.',
        },
      });
    } catch (err) { return reply.code(500).send({ error: 'Validation failed' }); }
  });
}
