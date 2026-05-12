// ============================================================================
// Phase M.1 — Platform Governance Routes
// Transparent governance — no hidden overrides.
// ============================================================================

import { FastifyInstance } from 'fastify';
import {
  runFullPlatformGovernanceAnalysis,
  establishOperationalDoctrine,
  governRelease,
  controlFeatureEnablement,
  harmonizePolicies,
  certifyAdminActions,
  trackStewardship,
  synchronizeGovernance,
  verifyReleaseIntegrity,
  validateCrossLayerPolicies,
  trackDoctrineLineage,
} from '../services/platformGovernanceService.js';
import prisma from '../lib/prisma.js';

export async function registerPlatformGovernanceRoutes(fastify: FastifyInstance) {

  // POST — Full governance analysis
  fastify.post('/api/governance-m1/analyze/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const result = await runFullPlatformGovernanceAnalysis(params.caseId);
      return reply.code(200).send(result);
    } catch (err) {
      fastify.log.error(err, 'Governance analysis failed');
      return reply.code(500).send({ error: 'Analysis failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // Operational Doctrine
  fastify.post('/api/governance-m1/doctrine/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await establishOperationalDoctrine(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/governance-m1/doctrine/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.unifiedOperationalDoctrine.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, doctrines: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Release Governance
  fastify.post('/api/governance-m1/releases/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await governRelease(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/governance-m1/releases/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.releaseGovernanceWorkflow.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 20 });
      return reply.code(200).send({ caseId: params.caseId, releases: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Feature Enablement
  fastify.post('/api/governance-m1/features/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await controlFeatureEnablement(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/governance-m1/features/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.controlledFeatureEnablement.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, features: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Policy Harmonization
  fastify.post('/api/governance-m1/policies/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await harmonizePolicies(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/governance-m1/policies/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.operationalPolicyHarmonization.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, policies: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Administrative Certification
  fastify.post('/api/governance-m1/admin-actions/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await certifyAdminActions(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/governance-m1/admin-actions/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.administrativeActionCertification.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, actions: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Stewardship
  fastify.post('/api/governance-m1/stewardship/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await trackStewardship(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/governance-m1/stewardship/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.platformStewardshipTracking.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, stewardship: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Governance Sync
  fastify.post('/api/governance-m1/sync/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await synchronizeGovernance(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/governance-m1/sync/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.governanceSynchronizationEngine.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, syncs: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Release Integrity
  fastify.post('/api/governance-m1/release-integrity/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await verifyReleaseIntegrity(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/governance-m1/release-integrity/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.releaseIntegrityVerification.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, verifications: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Cross-Layer Policy
  fastify.post('/api/governance-m1/cross-layer/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await validateCrossLayerPolicies(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/governance-m1/cross-layer/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.crossLayerPolicyValidation.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, validations: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Doctrine Lineage
  fastify.post('/api/governance-m1/lineage/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await trackDoctrineLineage(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/governance-m1/lineage/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.doctrineLineageTracking.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, lineages: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Validation endpoint
  fastify.get('/api/governance-m1/validation', async (_req, reply) => {
    try {
      const [doctrines, releases, features, policies, adminActions, stewardship, syncs, releaseIntegrity, crossLayer, lineages] = await Promise.all([
        prisma.unifiedOperationalDoctrine.count(),
        prisma.releaseGovernanceWorkflow.count(),
        prisma.controlledFeatureEnablement.count(),
        prisma.operationalPolicyHarmonization.count(),
        prisma.administrativeActionCertification.count(),
        prisma.platformStewardshipTracking.count(),
        prisma.governanceSynchronizationEngine.count(),
        prisma.releaseIntegrityVerification.count(),
        prisma.crossLayerPolicyValidation.count(),
        prisma.doctrineLineageTracking.count(),
      ]);
      return reply.code(200).send({
        phase: 'M.1',
        name: 'Unified Platform Doctrine + Controlled Release Governance Framework',
        generatedAt: new Date().toISOString(),
        totals: { doctrines, releases, features, policies, adminActions, stewardship, syncs, releaseIntegrity, crossLayer, lineages },
        constraints: {
          noHiddenAdministrativeOverrides: true,
          noOpaqueGovernanceMutation: true,
          noUnverifiablePolicyEnforcement: true,
          noAutonomousDoctrineRewriting: true,
          noSecretReleaseControls: true,
          corePrinciple: 'CourtAccess enforces transparent, deterministic operational governance and release stewardship. It does NOT create opaque centralized control infrastructure.',
        },
      });
    } catch (err) { return reply.code(500).send({ error: 'Validation failed' }); }
  });
}
