// ============================================================================
// Phase N.5 — Enterprise Rollout Routes
// Disciplined operational stewardship. No speculative subsystem growth.
// ============================================================================

import { FastifyInstance } from 'fastify';
import {
  runFullEnterpriseRolloutAnalysis,
  executeStagedRollout,
  executeEnterpriseOnboarding,
  assessMonitoringReadiness,
  orchestrateIncidentResponse,
  establishSupportWorkflows,
  certifyEnterpiseRollout,
  governProductionRollbacks,
  trackLongTermSupport,
  controlInstitutionalEnablement,
  generateStewardshipManifests,
} from '../services/enterpriseRolloutService.js';
import prisma from '../lib/prisma.js';

export async function registerEnterpriseRolloutRoutes(fastify: FastifyInstance) {

  // POST — Full enterprise rollout analysis
  fastify.post('/api/rollout/analyze/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const result = await runFullEnterpriseRolloutAnalysis(params.caseId);
      return reply.code(200).send(result);
    } catch (err) {
      fastify.log.error(err, 'Enterprise rollout analysis failed');
      return reply.code(500).send({ error: 'Analysis failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // Staged Rollout
  fastify.post('/api/rollout/stages/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await executeStagedRollout(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/rollout/stages/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.stagedRolloutWorkflow.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, stages: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Onboarding Execution
  fastify.post('/api/rollout/onboarding/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await executeEnterpriseOnboarding(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/rollout/onboarding/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.enterpriseOnboardingExecution.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, executions: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Monitoring Readiness
  fastify.post('/api/rollout/monitoring/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await assessMonitoringReadiness(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/rollout/monitoring/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.productionMonitoringReadiness.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, monitoring: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Incident Response
  fastify.post('/api/rollout/incidents/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await orchestrateIncidentResponse(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/rollout/incidents/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.incidentResponseOrchestration.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, incidents: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Support Workflows
  fastify.post('/api/rollout/support/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await establishSupportWorkflows(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/rollout/support/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.operationalSupportWorkflow.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, support: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Rollout Certification
  fastify.post('/api/rollout/certification/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await certifyEnterpiseRollout(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/rollout/certification/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.enterpriseRolloutCertification.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, certifications: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Rollback Governance
  fastify.post('/api/rollout/rollbacks/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await governProductionRollbacks(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/rollout/rollbacks/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.productionRollbackGovernance.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, rollbacks: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Long-Term Support
  fastify.post('/api/rollout/lts/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await trackLongTermSupport(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/rollout/lts/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.longTermSupportTracking.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, tracking: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Enablement Controls
  fastify.post('/api/rollout/enablement/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await controlInstitutionalEnablement(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/rollout/enablement/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.institutionalEnablementControl.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, controls: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Stewardship Manifests
  fastify.post('/api/rollout/stewardship/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await generateStewardshipManifests(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/rollout/stewardship/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.productionStewardshipManifest.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, manifests: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Validation endpoint
  fastify.get('/api/rollout/validation', async (_req, reply) => {
    try {
      const [stages, onboarding, monitoring, incidents, support, certification, rollbacks, lts, enablement, stewardship] = await Promise.all([
        prisma.stagedRolloutWorkflow.count(),
        prisma.enterpriseOnboardingExecution.count(),
        prisma.productionMonitoringReadiness.count(),
        prisma.incidentResponseOrchestration.count(),
        prisma.operationalSupportWorkflow.count(),
        prisma.enterpriseRolloutCertification.count(),
        prisma.productionRollbackGovernance.count(),
        prisma.longTermSupportTracking.count(),
        prisma.institutionalEnablementControl.count(),
        prisma.productionStewardshipManifest.count(),
      ]);
      return reply.code(200).send({
        phase: 'N.5',
        name: 'Controlled Production Enablement + Enterprise Rollout Governance',
        generatedAt: new Date().toISOString(),
        totals: { stages, onboarding, monitoring, incidents, support, certification, rollbacks, lts, enablement, stewardship },
        constraints: {
          disciplinedStewardship: true,
          noSpeculativeGrowth: true,
          noUncontrolledRollout: true,
          noAutonomousExpansion: true,
          noOpaqueGovernance: true,
          corePrinciple: 'Disciplined operational stewardship. No speculative subsystem growth.',
        },
      });
    } catch (err) { return reply.code(500).send({ error: 'Validation failed' }); }
  });
}
