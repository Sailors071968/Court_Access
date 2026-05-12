// ============================================================================
// Phase P.1 — Enterprise Production Rollout Routes
// Controlled enterprise production rollout + operational stewardship.
// ============================================================================

import { FastifyInstance } from 'fastify';
import {
  runFullEnterpriseProductionAnalysis,
  rollOutInstitution,
  monitorProductionOperations,
  processEnterpriseSupport,
  onboardAttorney,
  governProductionIncidents,
  overseeOperationalSurvivability,
  trackInstitutionalSlas,
  collectWorkflowTelemetry,
  certifyProductionStewardship,
  certifyEnterpriseReadiness,
} from '../services/enterpriseProductionService.js';
import prisma from '../lib/prisma.js';

export async function registerEnterpriseProductionRoutes(fastify: FastifyInstance) {

  // POST — Full enterprise production analysis
  fastify.post('/api/production/analyze/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try {
      const result = await runFullEnterpriseProductionAnalysis(params.customerId);
      return reply.code(200).send(result);
    } catch (err) {
      fastify.log.error(err, 'Enterprise production analysis failed');
      return reply.code(500).send({ error: 'Analysis failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // Institutional Rollout
  fastify.post('/api/production/rollout/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try { return reply.code(200).send(await rollOutInstitution(params.customerId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/production/rollout/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try {
      const records = await prisma.controlledInstitutionalRollout.findMany({ orderBy: { stageOrder: 'asc' }, take: 50 });
      return reply.code(200).send({ customerId: params.customerId, stages: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Operations Monitoring
  fastify.post('/api/production/monitoring/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try { return reply.code(200).send(await monitorProductionOperations(params.customerId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/production/monitoring/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try {
      const records = await prisma.productionOperationsMonitor.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ customerId: params.customerId, monitors: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Enterprise Support
  fastify.post('/api/production/support/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try { return reply.code(200).send(await processEnterpriseSupport(params.customerId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/production/support/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try {
      const records = await prisma.enterpriseSupportWorkflow.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ customerId: params.customerId, workflows: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Attorney Onboarding
  fastify.post('/api/production/attorneys/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try { return reply.code(200).send(await onboardAttorney(params.customerId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/production/attorneys/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try {
      const records = await prisma.attorneyOnboardingOperation.findMany({ orderBy: { stepOrder: 'asc' }, take: 50 });
      return reply.code(200).send({ customerId: params.customerId, steps: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Incident Governance
  fastify.post('/api/production/incidents/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try { return reply.code(200).send(await governProductionIncidents(params.customerId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/production/incidents/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try {
      const records = await prisma.productionIncidentGovernance.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ customerId: params.customerId, incidents: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Survivability Oversight
  fastify.post('/api/production/survivability/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try { return reply.code(200).send(await overseeOperationalSurvivability(params.customerId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/production/survivability/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try {
      const records = await prisma.operationalSurvivabilityOversight.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ customerId: params.customerId, assessments: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // SLA Tracking
  fastify.post('/api/production/slas/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try { return reply.code(200).send(await trackInstitutionalSlas(params.customerId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/production/slas/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try {
      const records = await prisma.institutionalSlaTracking.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ customerId: params.customerId, slas: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Workflow Telemetry
  fastify.post('/api/production/telemetry/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try { return reply.code(200).send(await collectWorkflowTelemetry(params.customerId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/production/telemetry/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try {
      const records = await prisma.realWorldWorkflowTelemetry.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ customerId: params.customerId, telemetry: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Stewardship
  fastify.post('/api/production/stewardship/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try { return reply.code(200).send(await certifyProductionStewardship(params.customerId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/production/stewardship/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try {
      const records = await prisma.productionStewardshipManifestP1.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ customerId: params.customerId, manifests: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Readiness Certification
  fastify.post('/api/production/readiness/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try { return reply.code(200).send(await certifyEnterpriseReadiness(params.customerId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/production/readiness/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try {
      const records = await prisma.enterpriseReadinessCertification.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ customerId: params.customerId, certifications: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Validation endpoint
  fastify.get('/api/production/validation', async (_req, reply) => {
    try {
      const [rollout, monitoring, support, attorneys, incidents, survivability, slas, telemetry, stewardship, readiness] = await Promise.all([
        prisma.controlledInstitutionalRollout.count(),
        prisma.productionOperationsMonitor.count(),
        prisma.enterpriseSupportWorkflow.count(),
        prisma.attorneyOnboardingOperation.count(),
        prisma.productionIncidentGovernance.count(),
        prisma.operationalSurvivabilityOversight.count(),
        prisma.institutionalSlaTracking.count(),
        prisma.realWorldWorkflowTelemetry.count(),
        prisma.productionStewardshipManifestP1.count(),
        prisma.enterpriseReadinessCertification.count(),
      ]);
      return reply.code(200).send({
        phase: 'P.1',
        name: 'Controlled Enterprise Production Rollout + Operational Stewardship',
        generatedAt: new Date().toISOString(),
        totals: { rollout, monitoring, support, attorneys, incidents, survivability, slas, telemetry, stewardship, readiness },
        constraints: {
          noUncontrolledRollout: true,
          noSpeculativeExpansion: true,
          governanceControlled: true,
          corePrinciple: 'Controlled enterprise production rollout. Disciplined operational stewardship.',
        },
      });
    } catch (err) { return reply.code(500).send({ error: 'Validation failed' }); }
  });
}
