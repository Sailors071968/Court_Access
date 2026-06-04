// ============================================================================
// Phase N.3 — Pilot Operations Routes
// Controlled operationalization. No speculative expansion.
// ============================================================================

import { FastifyInstance } from 'fastify';
import {
  runFullPilotOperationsAnalysis,
  replayHistoricalCases,
  enrollInternalPilots,
  trackUsabilityTelemetry,
  trackWorkflowFriction,
  validateExports,
  runSurvivabilityDrills,
  rehearsePilotRollbacks,
  enablePilotFeatures,
  triageOperationalIssues,
  generatePilotCertification,
} from '../services/pilotOperationsService.js';
import prisma from '../lib/prisma.js';

export async function registerPilotOperationsRoutes(fastify: FastifyInstance) {

  // POST — Full pilot operations analysis
  fastify.post('/api/pilot/analyze/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const result = await runFullPilotOperationsAnalysis(params.caseId);
      return reply.code(200).send(result);
    } catch (err) {
      fastify.log.error(err, 'Pilot operations analysis failed');
      return reply.code(500).send({ error: 'Analysis failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // Historical Replay
  fastify.post('/api/pilot/replay/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await replayHistoricalCases(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/pilot/replay/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.historicalCaseReplayPilot.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, replays: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Internal Pilots
  fastify.post('/api/pilot/users/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await enrollInternalPilots(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/pilot/users/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.internalUserPilot.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, pilots: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Usability Telemetry
  fastify.post('/api/pilot/telemetry/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await trackUsabilityTelemetry(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/pilot/telemetry/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.attorneyUsabilityTelemetry.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, telemetry: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Workflow Friction
  fastify.post('/api/pilot/friction/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await trackWorkflowFriction(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/pilot/friction/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.workflowFrictionEntry.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, friction: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Export Validation
  fastify.post('/api/pilot/exports/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await validateExports(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/pilot/exports/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.realWorldExportValidation.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, exports: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Survivability Drills
  fastify.post('/api/pilot/drills/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await runSurvivabilityDrills(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/pilot/drills/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.productionSurvivabilityDrill.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, drills: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Rollback Rehearsals
  fastify.post('/api/pilot/rollbacks/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await rehearsePilotRollbacks(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/pilot/rollbacks/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.pilotRollbackRehearsal.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, rollbacks: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Feature Enablement
  fastify.post('/api/pilot/features/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await enablePilotFeatures(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/pilot/features/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.pilotFeatureEnablement.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, features: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Issue Triage
  fastify.post('/api/pilot/issues/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await triageOperationalIssues(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/pilot/issues/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.operationalIssueTriage.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, issues: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Pilot Certification
  fastify.post('/api/pilot/certification/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await generatePilotCertification(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/pilot/certification/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.pilotCertificationManifest.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, certifications: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Validation endpoint
  fastify.get('/api/pilot/validation', async (_req, reply) => {
    try {
      const [replays, pilots, telemetry, friction, exports, drills, rollbacks, features, issues, certifications] = await Promise.all([
        prisma.historicalCaseReplayPilot.count(),
        prisma.internalUserPilot.count(),
        prisma.attorneyUsabilityTelemetry.count(),
        prisma.workflowFrictionEntry.count(),
        prisma.realWorldExportValidation.count(),
        prisma.productionSurvivabilityDrill.count(),
        prisma.pilotRollbackRehearsal.count(),
        prisma.pilotFeatureEnablement.count(),
        prisma.operationalIssueTriage.count(),
        prisma.pilotCertificationManifest.count(),
      ]);
      return reply.code(200).send({
        phase: 'N.3',
        name: 'Controlled Pilot Deployment + Real-World Operational Validation',
        generatedAt: new Date().toISOString(),
        totals: { replays, pilots, telemetry, friction, exports, drills, rollbacks, features, issues, certifications },
        constraints: {
          controlledOperationalization: true,
          noSpeculativeExpansion: true,
          noUncontrolledRollout: true,
          noAutonomousEnablement: true,
          noHiddenTelemetry: true,
          corePrinciple: 'Controlled operationalization. No speculative expansion.',
        },
      });
    } catch (err) { return reply.code(500).send({ error: 'Validation failed' }); }
  });
}
