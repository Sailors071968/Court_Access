// ============================================================================
// Phase H.1 — Unified Attorney Command Environment Routes
// Augments and organizes attorney litigation operations.
// NEVER replaces licensed legal counsel.
// ============================================================================

import { FastifyInstance } from 'fastify';
import {
  runFullUnifiedCommandAnalysis,
  buildUnifiedCaseState,
  orchestrateCrossLayerAnalysis,
  trackEvidenceLifecycles,
  buildLitigationMilestones,
  buildUnifiedSearchIndex,
  buildEvidenceRelationships,
  syncWorkspaceState,
  configureRoleWorkflow,
  getAuditLogs,
  trackLitigationLifecycle,
} from '../services/unifiedAttorneyCommandService.js';
import prisma from '../lib/prisma.js';

export async function registerUnifiedAttorneyCommandRoutes(fastify: FastifyInstance) {

  // POST /api/command/analyze/:caseId — Full unified analysis
  fastify.post('/api/command/analyze/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const result = await runFullUnifiedCommandAnalysis(params.caseId);
      return reply.code(200).send(result);
    } catch (err) {
      fastify.log.error(err, 'Unified command analysis failed');
      return reply.code(500).send({ error: 'Analysis failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // Case State
  fastify.post('/api/command/state/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await buildUnifiedCaseState(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/command/state/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const state = await prisma.unifiedCaseState.findUnique({ where: { caseId: params.caseId } });
      return reply.code(200).send({ caseId: params.caseId, state });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Cross-Layer Orchestration
  fastify.post('/api/command/orchestrate/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await orchestrateCrossLayerAnalysis(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/command/orchestrations/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const orchestrations = await prisma.crossLayerOrchestration.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 20 });
      return reply.code(200).send({ caseId: params.caseId, orchestrations, total: orchestrations.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Evidence Lifecycles
  fastify.post('/api/command/lifecycles/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await trackEvidenceLifecycles(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/command/lifecycles/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const lifecycles = await prisma.evidenceLifecycleTracker.findMany({ where: { caseId: params.caseId }, orderBy: { layerCount: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, lifecycles, total: lifecycles.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Milestones
  fastify.post('/api/command/milestones/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await buildLitigationMilestones(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/command/milestones/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const milestones = await prisma.litigationMilestone.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'asc' } });
      return reply.code(200).send({ caseId: params.caseId, milestones, total: milestones.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Search Index
  fastify.post('/api/command/search/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await buildUnifiedSearchIndex(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/command/search/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const entries = await prisma.unifiedSearchIndex.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 100 });
      return reply.code(200).send({ caseId: params.caseId, entries, total: entries.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Evidence Relationships
  fastify.post('/api/command/relationships/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await buildEvidenceRelationships(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/command/relationships/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const relationships = await prisma.evidenceRelationshipExplorer.findMany({ where: { caseId: params.caseId }, orderBy: { relationshipStrength: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, relationships, total: relationships.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Workspace Sync
  fastify.post('/api/command/workspace/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    const body = req.body as { userId?: string; activePane?: string } | undefined;
    try { return reply.code(200).send(await syncWorkspaceState(params.caseId, body?.userId || 'default', body?.activePane || 'evidence')); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });

  // Role Workflows
  fastify.post('/api/command/role/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    const body = req.body as { userId?: string; role?: string } | undefined;
    try { return reply.code(200).send(await configureRoleWorkflow(params.caseId, body?.userId || 'default', body?.role || 'lead_attorney')); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/command/roles/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const workflows = await prisma.roleBasedWorkflow.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' } });
      return reply.code(200).send({ caseId: params.caseId, workflows, total: workflows.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Audit Logs
  fastify.get('/api/command/audit/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await getAuditLogs(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Litigation Lifecycle
  fastify.post('/api/command/lifecycle/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await trackLitigationLifecycle(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/command/lifecycle/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const phases = await prisma.litigationLifecycleTracker.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'asc' } });
      return reply.code(200).send({ caseId: params.caseId, phases, total: phases.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Validation
  fastify.get('/api/command/validation', async (_req, reply) => {
    try {
      const [states, orchestrations, lifecycles, milestones, search, relationships, workspaces, roles, audit, lifecycle] = await Promise.all([
        prisma.unifiedCaseState.count(),
        prisma.crossLayerOrchestration.count(),
        prisma.evidenceLifecycleTracker.count(),
        prisma.litigationMilestone.count(),
        prisma.unifiedSearchIndex.count(),
        prisma.evidenceRelationshipExplorer.count(),
        prisma.workspaceSyncState.count(),
        prisma.roleBasedWorkflow.count(),
        prisma.auditActionLog.count(),
        prisma.litigationLifecycleTracker.count(),
      ]);
      return reply.code(200).send({
        phase: 'H.1',
        name: 'Full Operational Defense Platform Integration + Unified Attorney Command Environment',
        generatedAt: new Date().toISOString(),
        totals: {
          unifiedCaseStates: states, crossLayerOrchestrations: orchestrations,
          evidenceLifecycles: lifecycles, litigationMilestones: milestones,
          searchIndexEntries: search, evidenceRelationships: relationships,
          workspaceSyncStates: workspaces, roleBasedWorkflows: roles,
          auditActionLogs: audit, litigationLifecyclePhases: lifecycle,
        },
        constraints: {
          noAutonomousLegalStrategy: true,
          noAIAttorneyReplacement: true,
          noAutonomousCourtroomActions: true,
          noAutomatedLegalFilingWithoutReview: true,
          noUnsupervisedLegalDecisions: true,
          corePrinciple: 'CourtAccess augments and organizes attorney litigation operations. It does NOT replace licensed legal counsel.',
        },
      });
    } catch (err) { return reply.code(500).send({ error: 'Validation failed' }); }
  });
}
