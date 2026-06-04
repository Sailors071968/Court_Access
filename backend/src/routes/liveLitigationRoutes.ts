// ============================================================================
// Phase F.2 — Live Litigation Monitoring Routes
// Analyzes uploaded/live-authorized litigation materials.
// NEVER operates as a surveillance system.
// ============================================================================

import { FastifyInstance } from 'fastify';
import {
  runFullLiveLitigationAnalysis,
  processRealTimeTranscript,
  trackLiveContradictionEmergence,
  monitorDynamicBurdenShifts,
  updateActiveWitnessCredibility,
  trackRealTimeTimelineUpdates,
  trackLiveObjectionConsequences,
  trackOngoingAppellatePreservation,
  buildCourtroomEventStream,
  captureLitigationStateSnapshot,
} from '../services/liveLitigationMonitoringService.js';
import prisma from '../lib/prisma.js';

export async function registerLiveLitigationRoutes(fastify: FastifyInstance) {

  // POST /api/litigation/analyze/:caseId — Full live analysis
  fastify.post('/api/litigation/analyze/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const result = await runFullLiveLitigationAnalysis(params.caseId);
      return reply.code(200).send(result);
    } catch (err) {
      fastify.log.error(err, 'Live litigation analysis failed');
      return reply.code(500).send({ error: 'Analysis failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // POST/GET transcript
  fastify.post('/api/litigation/transcript/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await processRealTimeTranscript(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/litigation/transcript/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const events = await prisma.realTimeTranscriptEvent.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' } });
      return reply.code(200).send({ caseId: params.caseId, events, total: events.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // POST/GET contradictions
  fastify.post('/api/litigation/contradictions/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await trackLiveContradictionEmergence(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/litigation/contradictions/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const emergences = await prisma.liveContradictionEmergence.findMany({ where: { caseId: params.caseId }, orderBy: { detectedAt: 'desc' } });
      return reply.code(200).send({ caseId: params.caseId, emergences, total: emergences.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // POST/GET burden shifts
  fastify.post('/api/litigation/burden/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await monitorDynamicBurdenShifts(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/litigation/burden/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const shifts = await prisma.dynamicBurdenShift.findMany({ where: { caseId: params.caseId }, orderBy: { magnitude: 'desc' } });
      return reply.code(200).send({ caseId: params.caseId, shifts, total: shifts.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // POST/GET credibility
  fastify.post('/api/litigation/credibility/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await updateActiveWitnessCredibility(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/litigation/credibility/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const updates = await prisma.activeWitnessCredibilityUpdate.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' } });
      return reply.code(200).send({ caseId: params.caseId, updates, total: updates.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // POST/GET timeline
  fastify.post('/api/litigation/timeline/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await trackRealTimeTimelineUpdates(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/litigation/timeline/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const updates = await prisma.realTimeTimelineUpdate.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' } });
      return reply.code(200).send({ caseId: params.caseId, updates, total: updates.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // POST/GET objections
  fastify.post('/api/litigation/objections/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await trackLiveObjectionConsequences(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/litigation/objections/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const consequences = await prisma.liveObjectionConsequence.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' } });
      return reply.code(200).send({ caseId: params.caseId, consequences, total: consequences.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // POST/GET appellate preservation
  fastify.post('/api/litigation/appellate/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await trackOngoingAppellatePreservation(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/litigation/appellate/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const issues = await prisma.ongoingAppellatePreservation.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' } });
      return reply.code(200).send({ caseId: params.caseId, issues, total: issues.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // POST/GET courtroom events
  fastify.post('/api/litigation/events/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await buildCourtroomEventStream(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/litigation/events/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const events = await prisma.courtroomEventStream.findMany({ where: { caseId: params.caseId }, orderBy: { sequenceNumber: 'asc' } });
      return reply.code(200).send({ caseId: params.caseId, events, total: events.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // POST/GET snapshots
  fastify.post('/api/litigation/snapshots/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await captureLitigationStateSnapshot(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/litigation/snapshots/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const snapshots = await prisma.litigationStateSnapshot.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' } });
      return reply.code(200).send({ caseId: params.caseId, snapshots, total: snapshots.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // GET /api/litigation/validation
  fastify.get('/api/litigation/validation', async (_req, reply) => {
    try {
      const [transcripts, contradictions, shifts, credibility, timeline, objections, appellate, events, snapshots] = await Promise.all([
        prisma.realTimeTranscriptEvent.count(),
        prisma.liveContradictionEmergence.count(),
        prisma.dynamicBurdenShift.count(),
        prisma.activeWitnessCredibilityUpdate.count(),
        prisma.realTimeTimelineUpdate.count(),
        prisma.liveObjectionConsequence.count(),
        prisma.ongoingAppellatePreservation.count(),
        prisma.courtroomEventStream.count(),
        prisma.litigationStateSnapshot.count(),
      ]);
      return reply.code(200).send({
        phase: 'F.2',
        name: 'Real-Time Case Intelligence + Live Litigation Monitoring Framework',
        generatedAt: new Date().toISOString(),
        totals: {
          transcriptEvents: transcripts, liveContradictions: contradictions,
          burdenShifts: shifts, credibilityUpdates: credibility,
          timelineUpdates: timeline, objectionConsequences: objections,
          appellatePreservation: appellate, courtroomEvents: events,
          litigationSnapshots: snapshots,
        },
        constraints: {
          noCovertMonitoring: true,
          noUnauthorizedRecording: true,
          noSurveillanceFeatures: true,
          noHiddenCourtroomCollection: true,
          noExternalScraping: true,
          noPredictiveBehaviorSystems: true,
          corePrinciple: 'CourtAccess analyzes uploaded/live-authorized litigation materials. It does NOT operate as a surveillance system.',
        },
      });
    } catch (err) { return reply.code(500).send({ error: 'Validation failed' }); }
  });
}
