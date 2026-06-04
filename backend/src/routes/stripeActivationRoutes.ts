// ============================================================================
// Phase O.2 — Stripe Activation Routes
// Full sandbox-to-production rehearsal. No live Stripe without full rehearsal.
// ============================================================================

import { FastifyInstance } from 'fastify';
import {
  runFullStripeActivationAnalysis,
  runActivationWorkflow,
  rotateProductionKeys,
  hardenWebhookEndpoints,
  runLiveBillingRehearsals,
  onboardInstitutionalSubscription,
  validateFinancialSurvivability,
  testBillingStateTransitions,
  simulateReplayAttacks,
  validateTierTransitions,
  certifyProductionBilling,
} from '../services/stripeActivationService.js';
import prisma from '../lib/prisma.js';

export async function registerStripeActivationRoutes(fastify: FastifyInstance) {

  // POST — Full activation analysis
  fastify.post('/api/activation/analyze/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try {
      const result = await runFullStripeActivationAnalysis(params.customerId);
      return reply.code(200).send(result);
    } catch (err) {
      fastify.log.error(err, 'Stripe activation analysis failed');
      return reply.code(500).send({ error: 'Analysis failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // Activation Workflow
  fastify.post('/api/activation/workflow/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try { return reply.code(200).send(await runActivationWorkflow(params.customerId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/activation/workflow/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try {
      const records = await prisma.stripeActivationWorkflow.findMany({ orderBy: { stepOrder: 'asc' }, take: 50 });
      return reply.code(200).send({ customerId: params.customerId, workflows: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Key Rotation
  fastify.post('/api/activation/keys/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try { return reply.code(200).send(await rotateProductionKeys(params.customerId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/activation/keys/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try {
      const records = await prisma.productionKeyRotation.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ customerId: params.customerId, rotations: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Webhook Hardening
  fastify.post('/api/activation/hardening/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try { return reply.code(200).send(await hardenWebhookEndpoints(params.customerId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/activation/hardening/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try {
      const records = await prisma.webhookEndpointHardening.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ customerId: params.customerId, checks: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Live Rehearsals
  fastify.post('/api/activation/rehearsals/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try { return reply.code(200).send(await runLiveBillingRehearsals(params.customerId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/activation/rehearsals/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try {
      const records = await prisma.liveBillingRehearsal.findMany({ orderBy: { rehearsalOrder: 'asc' }, take: 50 });
      return reply.code(200).send({ customerId: params.customerId, rehearsals: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Institutional Onboarding
  fastify.post('/api/activation/institutional/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try { return reply.code(200).send(await onboardInstitutionalSubscription(params.customerId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/activation/institutional/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try {
      const records = await prisma.institutionalSubscriptionOnboarding.findMany({ orderBy: { phaseOrder: 'asc' }, take: 50 });
      return reply.code(200).send({ customerId: params.customerId, phases: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Survivability
  fastify.post('/api/activation/survivability/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try { return reply.code(200).send(await validateFinancialSurvivability(params.customerId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/activation/survivability/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try {
      const records = await prisma.financialSurvivabilityTest.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ customerId: params.customerId, tests: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // State Transitions
  fastify.post('/api/activation/transitions/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try { return reply.code(200).send(await testBillingStateTransitions(params.customerId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/activation/transitions/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try {
      const records = await prisma.billingStateTransitionTest.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ customerId: params.customerId, transitions: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Replay Simulations
  fastify.post('/api/activation/replay/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try { return reply.code(200).send(await simulateReplayAttacks(params.customerId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/activation/replay/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try {
      const records = await prisma.replayAttackSimulation.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ customerId: params.customerId, simulations: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Tier Validations
  fastify.post('/api/activation/tiers/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try { return reply.code(200).send(await validateTierTransitions(params.customerId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/activation/tiers/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try {
      const records = await prisma.billingDowngradeUpgradeValidation.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ customerId: params.customerId, validations: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Certification
  fastify.post('/api/activation/certification/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try { return reply.code(200).send(await certifyProductionBilling(params.customerId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/activation/certification/:customerId', async (req, reply) => {
    const params = req.params as { customerId: string };
    try {
      const records = await prisma.productionBillingCertificationManifest.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ customerId: params.customerId, certifications: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Validation endpoint
  fastify.get('/api/activation/validation', async (_req, reply) => {
    try {
      const [activation, keys, hardening, rehearsals, institutional, survivability, transitions, replay, tiers, certification] = await Promise.all([
        prisma.stripeActivationWorkflow.count(),
        prisma.productionKeyRotation.count(),
        prisma.webhookEndpointHardening.count(),
        prisma.liveBillingRehearsal.count(),
        prisma.institutionalSubscriptionOnboarding.count(),
        prisma.financialSurvivabilityTest.count(),
        prisma.billingStateTransitionTest.count(),
        prisma.replayAttackSimulation.count(),
        prisma.billingDowngradeUpgradeValidation.count(),
        prisma.productionBillingCertificationManifest.count(),
      ]);
      return reply.code(200).send({
        phase: 'O.2',
        name: 'Stripe Production Activation + Controlled Billing Validation',
        generatedAt: new Date().toISOString(),
        totals: { activation, keys, hardening, rehearsals, institutional, survivability, transitions, replay, tiers, certification },
        constraints: {
          noLiveWithoutRehearsal: true,
          fullSandboxToProductionRehearsal: true,
          allTransitionsDeterministic: true,
          allTransitionsReplayVerifiable: true,
          noTestLiveMixing: true,
          corePrinciple: 'No live Stripe without full rehearsal. Every transition deterministic and replay-verifiable.',
        },
      });
    } catch (err) { return reply.code(500).send({ error: 'Validation failed' }); }
  });
}
