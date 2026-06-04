// ============================================================================
// Phase P.2 — Enterprise Scale Operations Routes
// Disciplined scaling + customer success governance.
// ============================================================================

import { FastifyInstance } from 'fastify';
import {
  runFullEnterpriseScaleAnalysis,
  governAutoscaling,
  operateCustomerSuccess,
  validateInfrastructureElasticity,
  testMultiTenantSurvivability,
  orchestrateCapacityPlanning,
  onboardLargeDeployment,
  refineEnterpriseObservability,
  governOperationalCosts,
  certifyScaleReadiness,
  operateLongTermStewardship,
} from '../services/enterpriseScaleService.js';
import prisma from '../lib/prisma.js';

export async function registerEnterpriseScaleRoutes(fastify: FastifyInstance) {

  // POST — Full enterprise scale analysis
  fastify.post('/api/scale/analyze/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try {
      const result = await runFullEnterpriseScaleAnalysis(params.customerId);
      return reply.code(200).send(result);
    } catch (err) {
      fastify.log.error(err, 'Enterprise scale analysis failed');
      return reply.code(500).send({ error: 'Analysis failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // Autoscaling
  fastify.post('/api/scale/autoscaling/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try { return reply.code(200).send(await governAutoscaling(params.customerId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/scale/autoscaling/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try {
      const records = await prisma.enterpriseAutoscalingGovernance.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ customerId: params.customerId, events: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Customer Success
  fastify.post('/api/scale/success/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try { return reply.code(200).send(await operateCustomerSuccess(params.customerId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/scale/success/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try {
      const records = await prisma.customerSuccessOperation.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ customerId: params.customerId, operations: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Elasticity
  fastify.post('/api/scale/elasticity/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try { return reply.code(200).send(await validateInfrastructureElasticity(params.customerId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/scale/elasticity/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try {
      const records = await prisma.infrastructureElasticityTest.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ customerId: params.customerId, tests: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Multi-Tenant
  fastify.post('/api/scale/multitenant/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try { return reply.code(200).send(await testMultiTenantSurvivability(params.customerId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/scale/multitenant/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try {
      const records = await prisma.multiTenantScaleSurvivability.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ customerId: params.customerId, metrics: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Capacity Planning
  fastify.post('/api/scale/capacity/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try { return reply.code(200).send(await orchestrateCapacityPlanning(params.customerId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/scale/capacity/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try {
      const records = await prisma.capacityPlanningOrchestration.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ customerId: params.customerId, plans: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Large Deployment
  fastify.post('/api/scale/deployment/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try { return reply.code(200).send(await onboardLargeDeployment(params.customerId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/scale/deployment/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try {
      const records = await prisma.largeDeploymentOnboarding.findMany({ orderBy: { phaseOrder: 'asc' }, take: 50 });
      return reply.code(200).send({ customerId: params.customerId, phases: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Observability
  fastify.post('/api/scale/observability/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try { return reply.code(200).send(await refineEnterpriseObservability(params.customerId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/scale/observability/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try {
      const records = await prisma.enterpriseObservabilityRefinement.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ customerId: params.customerId, refinements: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Cost Governance
  fastify.post('/api/scale/costs/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try { return reply.code(200).send(await governOperationalCosts(params.customerId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/scale/costs/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try {
      const records = await prisma.operationalCostGovernance.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ customerId: params.customerId, categories: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Scale Certification
  fastify.post('/api/scale/certification/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try { return reply.code(200).send(await certifyScaleReadiness(params.customerId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/scale/certification/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try {
      const records = await prisma.scaleCertificationManifest.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ customerId: params.customerId, certifications: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Stewardship
  fastify.post('/api/scale/stewardship/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try { return reply.code(200).send(await operateLongTermStewardship(params.customerId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/scale/stewardship/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try {
      const records = await prisma.longTermStewardshipOperation.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ customerId: params.customerId, operations: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Validation endpoint
  fastify.get('/api/scale/validation', async (_req, reply) => {
    try {
      const [autoscaling, success, elasticity, multitenant, capacity, deployment, observability, costs, certification, stewardship] = await Promise.all([
        prisma.enterpriseAutoscalingGovernance.count(),
        prisma.customerSuccessOperation.count(),
        prisma.infrastructureElasticityTest.count(),
        prisma.multiTenantScaleSurvivability.count(),
        prisma.capacityPlanningOrchestration.count(),
        prisma.largeDeploymentOnboarding.count(),
        prisma.enterpriseObservabilityRefinement.count(),
        prisma.operationalCostGovernance.count(),
        prisma.scaleCertificationManifest.count(),
        prisma.longTermStewardshipOperation.count(),
      ]);
      return reply.code(200).send({
        phase: 'P.2',
        name: 'Enterprise Scale Operations + Customer Success Governance',
        generatedAt: new Date().toISOString(),
        totals: { autoscaling, success, elasticity, multitenant, capacity, deployment, observability, costs, certification, stewardship },
        constraints: {
          noUncontrolledScaling: true,
          noSpeculativeExpansion: true,
          governanceControlled: true,
          corePrinciple: 'Disciplined scaling. Institutional reliability. Customer success governance.',
        },
      });
    } catch (err) { return reply.code(500).send({ error: 'Validation failed' }); }
  });
}
