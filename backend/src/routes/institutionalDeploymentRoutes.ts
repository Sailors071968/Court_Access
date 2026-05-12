// ============================================================================
// Phase K.1 — Institutional Deployment Routes
// Controlled adoption — no opaque multi-tenant intelligence.
// ============================================================================

import { FastifyInstance } from 'fastify';
import {
  runFullInstitutionalDeploymentAnalysis,
  initiateOnboarding,
  establishTenantIsolation,
  createGovernanceControls,
  trackOrganizationalRollout,
  verifyTenantBoundaries,
  configureEnablementControls,
  verifyAdoptionReadiness,
  conductAuditOnboarding,
  segregateEnvironments,
  certifyOrganization,
} from '../services/institutionalDeploymentService.js';
import prisma from '../lib/prisma.js';

export async function registerInstitutionalDeploymentRoutes(fastify: FastifyInstance) {

  // POST — Full deployment analysis
  fastify.post('/api/deployment/analyze/:orgId', async (req, reply) => {
    const params = req.params as { orgId: string };
    try {
      const result = await runFullInstitutionalDeploymentAnalysis(params.orgId);
      return reply.code(200).send(result);
    } catch (err) {
      fastify.log.error(err, 'Deployment analysis failed');
      return reply.code(500).send({ error: 'Analysis failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // Onboarding
  fastify.post('/api/deployment/onboarding/:orgId', async (req, reply) => {
    const params = req.params as { orgId: string };
    try { return reply.code(200).send(await initiateOnboarding(params.orgId, `Org-${params.orgId.slice(0, 8)}`)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/deployment/onboarding/:orgId', async (req, reply) => {
    const params = req.params as { orgId: string };
    try {
      const records = await prisma.institutionalOnboardingWorkflow.findMany({ where: { organizationId: params.orgId }, orderBy: { createdAt: 'desc' }, take: 20 });
      return reply.code(200).send({ organizationId: params.orgId, workflows: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Tenant Isolation
  fastify.post('/api/deployment/isolation/:orgId', async (req, reply) => {
    const params = req.params as { orgId: string };
    try { return reply.code(200).send(await establishTenantIsolation(params.orgId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/deployment/isolation/:orgId', async (req, reply) => {
    const params = req.params as { orgId: string };
    try {
      const tenantId = `tenant-${params.orgId.slice(0, 8)}`;
      const records = await prisma.tenantIsolationRecord.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' }, take: 20 });
      return reply.code(200).send({ organizationId: params.orgId, isolations: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Governance Controls
  fastify.post('/api/deployment/governance/:orgId', async (req, reply) => {
    const params = req.params as { orgId: string };
    try { return reply.code(200).send(await createGovernanceControls(params.orgId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/deployment/governance/:orgId', async (req, reply) => {
    const params = req.params as { orgId: string };
    try {
      const records = await prisma.deploymentGovernanceControl.findMany({ where: { organizationId: params.orgId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ organizationId: params.orgId, controls: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Rollout Tracking
  fastify.post('/api/deployment/rollout/:orgId', async (req, reply) => {
    const params = req.params as { orgId: string };
    try { return reply.code(200).send(await trackOrganizationalRollout(params.orgId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/deployment/rollout/:orgId', async (req, reply) => {
    const params = req.params as { orgId: string };
    try {
      const records = await prisma.organizationalRolloutTracking.findMany({ where: { organizationId: params.orgId }, orderBy: { createdAt: 'desc' }, take: 20 });
      return reply.code(200).send({ organizationId: params.orgId, rollouts: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Tenant Boundaries
  fastify.post('/api/deployment/boundaries/:orgId', async (req, reply) => {
    const params = req.params as { orgId: string };
    try { return reply.code(200).send(await verifyTenantBoundaries(params.orgId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/deployment/boundaries/:orgId', async (req, reply) => {
    const params = req.params as { orgId: string };
    try {
      const sourceTenant = `tenant-${params.orgId.slice(0, 8)}`;
      const records = await prisma.multiTenantIntegrityBoundary.findMany({ where: { sourceTenantId: sourceTenant }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ organizationId: params.orgId, boundaries: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Enablement Controls
  fastify.post('/api/deployment/enablement/:orgId', async (req, reply) => {
    const params = req.params as { orgId: string };
    try { return reply.code(200).send(await configureEnablementControls(params.orgId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/deployment/enablement/:orgId', async (req, reply) => {
    const params = req.params as { orgId: string };
    try {
      const records = await prisma.operationalEnablementControl.findMany({ where: { organizationId: params.orgId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ organizationId: params.orgId, controls: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Adoption Readiness
  fastify.post('/api/deployment/readiness/:orgId', async (req, reply) => {
    const params = req.params as { orgId: string };
    try { return reply.code(200).send(await verifyAdoptionReadiness(params.orgId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/deployment/readiness/:orgId', async (req, reply) => {
    const params = req.params as { orgId: string };
    try {
      const records = await prisma.adoptionReadinessVerification.findMany({ where: { organizationId: params.orgId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ organizationId: params.orgId, verifications: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Audit Onboarding
  fastify.post('/api/deployment/audit/:orgId', async (req, reply) => {
    const params = req.params as { orgId: string };
    try { return reply.code(200).send(await conductAuditOnboarding(params.orgId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/deployment/audit/:orgId', async (req, reply) => {
    const params = req.params as { orgId: string };
    try {
      const records = await prisma.institutionalAuditOnboarding.findMany({ where: { organizationId: params.orgId }, orderBy: { createdAt: 'desc' }, take: 20 });
      return reply.code(200).send({ organizationId: params.orgId, audits: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Environment Segregation
  fastify.post('/api/deployment/environments/:orgId', async (req, reply) => {
    const params = req.params as { orgId: string };
    try { return reply.code(200).send(await segregateEnvironments(params.orgId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/deployment/environments/:orgId', async (req, reply) => {
    const params = req.params as { orgId: string };
    try {
      const records = await prisma.deploymentEnvironmentSegregation.findMany({ where: { organizationId: params.orgId }, orderBy: { createdAt: 'desc' }, take: 20 });
      return reply.code(200).send({ organizationId: params.orgId, environments: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Organizational Certification
  fastify.post('/api/deployment/certification/:orgId', async (req, reply) => {
    const params = req.params as { orgId: string };
    try { return reply.code(200).send(await certifyOrganization(params.orgId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/deployment/certification/:orgId', async (req, reply) => {
    const params = req.params as { orgId: string };
    try {
      const records = await prisma.organizationalCertificationTracking.findMany({ where: { organizationId: params.orgId }, orderBy: { createdAt: 'desc' }, take: 20 });
      return reply.code(200).send({ organizationId: params.orgId, certifications: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Validation endpoint
  fastify.get('/api/deployment/validation', async (_req, reply) => {
    try {
      const [onboarding, isolation, governance, rollout, boundaries, enablement, readiness, audit, environments, certification] = await Promise.all([
        prisma.institutionalOnboardingWorkflow.count(),
        prisma.tenantIsolationRecord.count(),
        prisma.deploymentGovernanceControl.count(),
        prisma.organizationalRolloutTracking.count(),
        prisma.multiTenantIntegrityBoundary.count(),
        prisma.operationalEnablementControl.count(),
        prisma.adoptionReadinessVerification.count(),
        prisma.institutionalAuditOnboarding.count(),
        prisma.deploymentEnvironmentSegregation.count(),
        prisma.organizationalCertificationTracking.count(),
      ]);
      return reply.code(200).send({
        phase: 'K.1',
        name: 'Institutional Deployment + Controlled Adoption Framework',
        generatedAt: new Date().toISOString(),
        totals: { onboarding, isolation, governance, rollout, boundaries, enablement, readiness, audit, environments, certification },
        constraints: {
          noHiddenTenantMonitoring: true,
          noOpaqueOrganizationalScoring: true,
          noUncontrolledInstitutionalAccess: true,
          noUnverifiableTenantIsolation: true,
          noAutonomousOrganizationalProvisioning: true,
          corePrinciple: 'CourtAccess supports controlled institutional deployment with transparent operational governance. It does NOT create opaque multi-tenant intelligence systems.',
        },
      });
    } catch (err) { return reply.code(500).send({ error: 'Validation failed' }); }
  });
}
