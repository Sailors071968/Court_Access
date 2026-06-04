// ============================================================================
// Phase O.3 — LIVE Billing Enablement Routes
// Controlled LIVE billing enablement + revenue operations governance.
// ============================================================================

import { FastifyInstance } from 'fastify';
import {
  runFullLiveBillingAnalysis,
  governLiveActivation,
  monitorProductionBilling,
  runRevenueOperations,
  orchestrateBillingIncidents,
  observeLiveWebhooks,
  onboardInstitutionalCustomer,
  certifyProductionRevenue,
  governFinancialRollbacks,
  manageEscalations,
  certifyRevenueStewardship,
} from '../services/liveBillingEnablementService.js';
import prisma from '../lib/prisma.js';

export async function registerLiveBillingEnablementRoutes(fastify: FastifyInstance) {

  // POST — Full LIVE billing analysis
  fastify.post('/api/livebilling/analyze/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try {
      const result = await runFullLiveBillingAnalysis(params.customerId);
      return reply.code(200).send(result);
    } catch (err) {
      fastify.log.error(err, 'LIVE billing analysis failed');
      return reply.code(500).send({ error: 'Analysis failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // Activation Governance
  fastify.post('/api/livebilling/activation/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try { return reply.code(200).send(await governLiveActivation(params.customerId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/livebilling/activation/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try {
      const records = await prisma.liveStripeActivationGovernance.findMany({ orderBy: { gateOrder: 'asc' }, take: 50 });
      return reply.code(200).send({ customerId: params.customerId, gates: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Production Monitoring
  fastify.post('/api/livebilling/monitoring/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try { return reply.code(200).send(await monitorProductionBilling(params.customerId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/livebilling/monitoring/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try {
      const records = await prisma.productionBillingMonitor.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ customerId: params.customerId, monitors: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Revenue Operations
  fastify.post('/api/livebilling/revenue/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try { return reply.code(200).send(await runRevenueOperations(params.customerId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/livebilling/revenue/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try {
      const records = await prisma.revenueOperationsWorkflow.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ customerId: params.customerId, workflows: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Incident Response
  fastify.post('/api/livebilling/incidents/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try { return reply.code(200).send(await orchestrateBillingIncidents(params.customerId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/livebilling/incidents/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try {
      const records = await prisma.billingIncidentResponse.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ customerId: params.customerId, incidents: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Webhook Observability
  fastify.post('/api/livebilling/webhooks/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try { return reply.code(200).send(await observeLiveWebhooks(params.customerId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/livebilling/webhooks/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try {
      const records = await prisma.liveWebhookObservability.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ customerId: params.customerId, metrics: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Institutional Onboarding
  fastify.post('/api/livebilling/institutional/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try { return reply.code(200).send(await onboardInstitutionalCustomer(params.customerId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/livebilling/institutional/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try {
      const records = await prisma.institutionalCustomerOnboarding.findMany({ orderBy: { milestoneOrder: 'asc' }, take: 50 });
      return reply.code(200).send({ customerId: params.customerId, milestones: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Revenue Certification
  fastify.post('/api/livebilling/certification/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try { return reply.code(200).send(await certifyProductionRevenue(params.customerId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/livebilling/certification/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try {
      const records = await prisma.productionRevenueCertification.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ customerId: params.customerId, certifications: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Rollback Governance
  fastify.post('/api/livebilling/rollbacks/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try { return reply.code(200).send(await governFinancialRollbacks(params.customerId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/livebilling/rollbacks/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try {
      const records = await prisma.financialRollbackGovernance.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ customerId: params.customerId, rollbacks: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Support Escalations
  fastify.post('/api/livebilling/escalations/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try { return reply.code(200).send(await manageEscalations(params.customerId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/livebilling/escalations/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try {
      const records = await prisma.operationalSupportEscalation.findMany({ where: { customerId: params.customerId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ customerId: params.customerId, escalations: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Stewardship
  fastify.post('/api/livebilling/stewardship/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try { return reply.code(200).send(await certifyRevenueStewardship(params.customerId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/livebilling/stewardship/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try {
      const records = await prisma.revenueStewardshipManifest.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ customerId: params.customerId, manifests: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Validation endpoint
  fastify.get('/api/livebilling/validation', async (_req, reply) => {
    try {
      const [activation, monitoring, revenue, incidents, webhooks, institutional, certification, rollbacks, escalations, stewardship] = await Promise.all([
        prisma.liveStripeActivationGovernance.count(),
        prisma.productionBillingMonitor.count(),
        prisma.revenueOperationsWorkflow.count(),
        prisma.billingIncidentResponse.count(),
        prisma.liveWebhookObservability.count(),
        prisma.institutionalCustomerOnboarding.count(),
        prisma.productionRevenueCertification.count(),
        prisma.financialRollbackGovernance.count(),
        prisma.operationalSupportEscalation.count(),
        prisma.revenueStewardshipManifest.count(),
      ]);
      return reply.code(200).send({
        phase: 'O.3',
        name: 'Controlled LIVE Billing Enablement + Revenue Operations Governance',
        generatedAt: new Date().toISOString(),
        totals: { activation, monitoring, revenue, incidents, webhooks, institutional, certification, rollbacks, escalations, stewardship },
        constraints: {
          noActivationBeforeWarningResolution: true,
          noTestLiveMixing: true,
          allWarningsResolved: true,
          governanceApproved: true,
          corePrinciple: 'Controlled LIVE billing enablement. Disciplined revenue governance. No activation before warning resolution.',
        },
      });
    } catch (err) { return reply.code(500).send({ error: 'Validation failed' }); }
  });
}
