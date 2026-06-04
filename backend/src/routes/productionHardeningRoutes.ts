// ============================================================================
// Phase I.3 — Production Hardening + Operational Certification Routes
// Reproducible deployment, deterministic validation.
// NEVER performs opaque autonomous deployment behavior.
// ============================================================================

import { FastifyInstance } from 'fastify';
import {
  runFullProductionHardeningAnalysis,
  runDeploymentCertification,
  verifyEnvironmentIntegrity,
  validateReleaseReproducibility,
  verifyRollbackAssurance,
  verifyRuntimeConfiguration,
  scoreProductionReadiness,
  runOperationalValidation,
  createDeploymentManifest,
  verifyDependencyIntegrity,
  trackReleaseLineage,
} from '../services/productionHardeningService.js';
import prisma from '../lib/prisma.js';

export async function registerProductionHardeningRoutes(fastify: FastifyInstance) {

  // POST — Full production hardening analysis
  fastify.post('/api/production/analyze/:caseId', async (req, reply) => {
    const body = req.body as { releaseVersion?: string } | undefined;
    try {
      const result = await runFullProductionHardeningAnalysis(body?.releaseVersion || '1.0.0');
      return reply.code(200).send(result);
    } catch (err) {
      fastify.log.error(err, 'Production hardening analysis failed');
      return reply.code(500).send({ error: 'Analysis failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // Deployment Certification
  fastify.post('/api/production/certification/:caseId', async (_req, reply) => {
    try { return reply.code(200).send(await runDeploymentCertification()); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/production/certification/:caseId', async (_req, reply) => {
    try {
      const certs = await prisma.deploymentCertificationWorkflow.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });
      return reply.code(200).send({ certifications: certs, total: certs.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Environment Integrity
  fastify.post('/api/production/environment/:caseId', async (_req, reply) => {
    try { return reply.code(200).send(await verifyEnvironmentIntegrity()); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/production/environment/:caseId', async (_req, reply) => {
    try {
      const records = await prisma.environmentIntegrityVerification.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });
      return reply.code(200).send({ verifications: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Release Reproducibility
  fastify.post('/api/production/reproducibility/:caseId', async (_req, reply) => {
    try { return reply.code(200).send(await validateReleaseReproducibility()); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/production/reproducibility/:caseId', async (_req, reply) => {
    try {
      const records = await prisma.releaseReproducibilityValidation.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });
      return reply.code(200).send({ validations: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Rollback Assurance
  fastify.post('/api/production/rollback/:caseId', async (_req, reply) => {
    try { return reply.code(200).send(await verifyRollbackAssurance()); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/production/rollback/:caseId', async (_req, reply) => {
    try {
      const records = await prisma.rollbackAssuranceRecord.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });
      return reply.code(200).send({ records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Runtime Config
  fastify.post('/api/production/runtime/:caseId', async (_req, reply) => {
    try { return reply.code(200).send(await verifyRuntimeConfiguration()); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/production/runtime/:caseId', async (_req, reply) => {
    try {
      const records = await prisma.runtimeConfigurationVerification.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ configs: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Readiness Scoring
  fastify.post('/api/production/readiness/:caseId', async (_req, reply) => {
    try { return reply.code(200).send(await scoreProductionReadiness()); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/production/readiness/:caseId', async (_req, reply) => {
    try {
      const records = await prisma.productionReadinessScore.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });
      return reply.code(200).send({ scores: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Validation Suites
  fastify.post('/api/production/validation-suites/:caseId', async (_req, reply) => {
    try { return reply.code(200).send(await runOperationalValidation()); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/production/validation-suites/:caseId', async (_req, reply) => {
    try {
      const records = await prisma.operationalValidationSuite.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });
      return reply.code(200).send({ suites: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Deployment Manifests
  fastify.post('/api/production/manifests/:caseId', async (_req, reply) => {
    try { return reply.code(200).send(await createDeploymentManifest()); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/production/manifests/:caseId', async (_req, reply) => {
    try {
      const records = await prisma.deploymentAuditManifest.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });
      return reply.code(200).send({ manifests: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Dependency Integrity
  fastify.post('/api/production/dependencies/:caseId', async (_req, reply) => {
    try { return reply.code(200).send(await verifyDependencyIntegrity()); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/production/dependencies/:caseId', async (_req, reply) => {
    try {
      const records = await prisma.dependencyIntegrityVerification.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ dependencies: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Release Lineage
  fastify.post('/api/production/lineage/:caseId', async (_req, reply) => {
    try { return reply.code(200).send(await trackReleaseLineage()); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/production/lineage/:caseId', async (_req, reply) => {
    try {
      const records = await prisma.releaseLineageRecord.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });
      return reply.code(200).send({ lineage: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Validation endpoint
  fastify.get('/api/production/validation', async (_req, reply) => {
    try {
      const [certifications, environments, reproducibility, rollbacks, runtime, readiness, suites, manifests, dependencies, lineage] = await Promise.all([
        prisma.deploymentCertificationWorkflow.count(),
        prisma.environmentIntegrityVerification.count(),
        prisma.releaseReproducibilityValidation.count(),
        prisma.rollbackAssuranceRecord.count(),
        prisma.runtimeConfigurationVerification.count(),
        prisma.productionReadinessScore.count(),
        prisma.operationalValidationSuite.count(),
        prisma.deploymentAuditManifest.count(),
        prisma.dependencyIntegrityVerification.count(),
        prisma.releaseLineageRecord.count(),
      ]);
      return reply.code(200).send({
        phase: 'I.3',
        name: 'Production Hardening + Operational Certification Framework',
        generatedAt: new Date().toISOString(),
        totals: { certifications, environments, reproducibility, rollbacks, runtime, readiness, suites, manifests, dependencies, lineage },
        constraints: {
          noHiddenRuntimeMutation: true,
          noUnverifiableDeployment: true,
          noOpaqueReleaseScoring: true,
          noUncontrolledAutoDeployment: true,
          noProductionDriftWithoutLogging: true,
          corePrinciple: 'CourtAccess deploys reproducibly and validates operational integrity deterministically. It does NOT perform opaque autonomous deployment behavior.',
        },
      });
    } catch (err) { return reply.code(500).send({ error: 'Validation failed' }); }
  });
}
