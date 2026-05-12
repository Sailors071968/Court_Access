// ============================================================================
// Phase I.2 — Governance & Compliance Routes
// Transparent, auditable governance and compliance structures.
// NEVER creates opaque institutional control systems.
// ============================================================================

import { FastifyInstance } from 'fastify';
import {
  runFullGovernanceComplianceAnalysis,
  initializeGovernancePolicies,
  logPermissionAudit,
  generatePermissionAuditReport,
  runComplianceVerification,
  enforceEthicalSafeguards,
  logOperationalAction,
  generateOversightReport,
  initializeGovernanceControls,
  trackComplianceException,
  versionSystemPolicies,
  certifyGovernanceReview,
} from '../services/governanceComplianceService.js';
import prisma from '../lib/prisma.js';

export async function registerGovernanceComplianceRoutes(fastify: FastifyInstance) {

  // POST — Full governance analysis
  fastify.post('/api/governance/analyze/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const result = await runFullGovernanceComplianceAnalysis(params.caseId);
      return reply.code(200).send(result);
    } catch (err) {
      fastify.log.error(err, 'Governance analysis failed');
      return reply.code(500).send({ error: 'Analysis failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // Governance Policies
  fastify.post('/api/governance/policies/:caseId', async (_req, reply) => {
    try { return reply.code(200).send(await initializeGovernancePolicies()); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/governance/policies/:caseId', async (_req, reply) => {
    try {
      const policies = await prisma.governancePolicy.findMany({ where: { isActive: true }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ policies, total: policies.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Permission Audits
  fastify.post('/api/governance/audits/:caseId', async (req, reply) => {
    const body = req.body as { userId?: string; role?: string; action?: string } | undefined;
    try {
      return reply.code(200).send(await logPermissionAudit(body?.userId || 'system', body?.role || 'lead_attorney', body?.action || 'access_granted', 'case_data', 'case'));
    } catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/governance/audits/:caseId', async (_req, reply) => {
    try { return reply.code(200).send(await generatePermissionAuditReport()); }
    catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Compliance Workflows
  fastify.post('/api/governance/compliance/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await runComplianceVerification(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/governance/compliance/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const workflows = await prisma.complianceVerificationWorkflow.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, workflows, total: workflows.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Ethical Safeguards
  fastify.post('/api/governance/safeguards/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await enforceEthicalSafeguards(`manual_check_${params.caseId}`)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/governance/safeguards/:caseId', async (_req, reply) => {
    try {
      const safeguards = await prisma.ethicalSafeguardEnforcement.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ safeguards, total: safeguards.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Accountability Logs
  fastify.post('/api/governance/accountability/:caseId', async (req, reply) => {
    const body = req.body as { actorId?: string; role?: string; operation?: string } | undefined;
    try {
      return reply.code(200).send(await logOperationalAction(body?.actorId || 'system', body?.role || 'lead_attorney', body?.operation || 'analysis_execution', 'case_analysis', {}));
    } catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/governance/accountability/:caseId', async (_req, reply) => {
    try {
      const logs = await prisma.operationalAccountabilityLog.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
      return reply.code(200).send({ logs, total: logs.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Oversight Reports
  fastify.post('/api/governance/oversight/:caseId', async (_req, reply) => {
    try { return reply.code(200).send(await generateOversightReport()); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/governance/oversight/:caseId', async (_req, reply) => {
    try {
      const reports = await prisma.institutionalOversightReport.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });
      return reply.code(200).send({ reports, total: reports.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Exception Tracking
  fastify.post('/api/governance/exceptions/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    const body = req.body as { type?: string; requestedBy?: string; justification?: string } | undefined;
    try {
      return reply.code(200).send(await trackComplianceException(params.caseId, body?.type || 'policy_override', body?.requestedBy || 'system', body?.justification || 'Automated exception'));
    } catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/governance/exceptions/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const exceptions = await prisma.complianceExceptionTracking.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, exceptions, total: exceptions.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Policy Versioning
  fastify.post('/api/governance/versions/:caseId', async (_req, reply) => {
    try { return reply.code(200).send(await versionSystemPolicies()); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/governance/versions/:caseId', async (_req, reply) => {
    try {
      const versions = await prisma.systemPolicyVersion.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ versions, total: versions.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Governance Controls
  fastify.post('/api/governance/controls/:caseId', async (_req, reply) => {
    try { return reply.code(200).send(await initializeGovernanceControls()); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/governance/controls/:caseId', async (_req, reply) => {
    try {
      const controls = await prisma.roleBasedGovernanceControl.findMany({ where: { isActive: true }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ controls, total: controls.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Certification
  fastify.post('/api/governance/certification/:caseId', async (_req, reply) => {
    try { return reply.code(200).send(await certifyGovernanceReview()); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/governance/certification/:caseId', async (_req, reply) => {
    try {
      const certs = await prisma.governanceReviewCertification.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });
      return reply.code(200).send({ certifications: certs, total: certs.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Validation
  fastify.get('/api/governance/validation', async (_req, reply) => {
    try {
      const [policies, audits, workflows, safeguards, accountability, reports, controls, exceptions, versions, certifications] = await Promise.all([
        prisma.governancePolicy.count(),
        prisma.permissionAuditTrail.count(),
        prisma.complianceVerificationWorkflow.count(),
        prisma.ethicalSafeguardEnforcement.count(),
        prisma.operationalAccountabilityLog.count(),
        prisma.institutionalOversightReport.count(),
        prisma.roleBasedGovernanceControl.count(),
        prisma.complianceExceptionTracking.count(),
        prisma.systemPolicyVersion.count(),
        prisma.governanceReviewCertification.count(),
      ]);
      return reply.code(200).send({
        phase: 'I.2',
        name: 'Governance, Compliance, and Institutional Trust Framework',
        generatedAt: new Date().toISOString(),
        totals: { policies, audits, workflows, safeguards, accountability, reports, controls, exceptions, versions, certifications },
        constraints: {
          noHiddenModeration: true,
          noOpaqueComplianceScoring: true,
          noUnverifiableGovernance: true,
          noAutonomousPolicyEnforcement: true,
          noSecretSurveillance: true,
          noProbabilisticEthicsScoring: true,
          corePrinciple: 'CourtAccess provides transparent, auditable governance and compliance structures. It does NOT create opaque institutional control systems.',
        },
      });
    } catch (err) { return reply.code(500).send({ error: 'Validation failed' }); }
  });
}
