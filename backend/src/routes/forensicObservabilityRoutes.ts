// ============================================================================
// Phase L.1 — Forensic Observability Routes
// Transparent observability — no hidden surveillance.
// ============================================================================

import { FastifyInstance } from 'fastify';
import {
  runFullForensicObservabilityAnalysis,
  traceOperations,
  syncCrossLayerTelemetry,
  reconstructIncident,
  monitorIntegrityEvents,
  runObservabilityPipeline,
  detectAnomalies,
  buildAuditTelemetryManifest,
  captureStateVisibility,
  verifyTelemetryReplay,
  certifyObservability,
} from '../services/forensicObservabilityService.js';
import prisma from '../lib/prisma.js';

export async function registerForensicObservabilityRoutes(fastify: FastifyInstance) {

  // POST — Full observability analysis
  fastify.post('/api/observability/analyze/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const result = await runFullForensicObservabilityAnalysis(params.caseId);
      return reply.code(200).send(result);
    } catch (err) {
      fastify.log.error(err, 'Observability analysis failed');
      return reply.code(500).send({ error: 'Analysis failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // Operational Traces
  fastify.post('/api/observability/traces/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await traceOperations(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/observability/traces/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.endToEndOperationalTrace.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, traces: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Telemetry Sync
  fastify.post('/api/observability/telemetry/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await syncCrossLayerTelemetry(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/observability/telemetry/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.crossLayerTelemetrySync.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, syncs: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Incident Reconstruction
  fastify.post('/api/observability/incidents/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await reconstructIncident(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/observability/incidents/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.incidentReconstructionRecord.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 20 });
      return reply.code(200).send({ caseId: params.caseId, incidents: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Integrity Events
  fastify.post('/api/observability/integrity/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await monitorIntegrityEvents(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/observability/integrity/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.integrityEventMonitor.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, events: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Observability Pipelines
  fastify.post('/api/observability/pipelines/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await runObservabilityPipeline(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/observability/pipelines/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.deterministicObservabilityPipeline.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, pipelines: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Anomaly Detection
  fastify.post('/api/observability/anomalies/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await detectAnomalies(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/observability/anomalies/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.operationalAnomalyDetection.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, anomalies: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Audit Telemetry
  fastify.post('/api/observability/manifests/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await buildAuditTelemetryManifest(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/observability/manifests/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.auditTelemetryManifest.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 20 });
      return reply.code(200).send({ caseId: params.caseId, manifests: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // State Visibility
  fastify.post('/api/observability/state/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await captureStateVisibility(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/observability/state/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.platformStateVisibility.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, components: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Replay Verification
  fastify.post('/api/observability/replay/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await verifyTelemetryReplay(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/observability/replay/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.telemetryReplayVerification.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 20 });
      return reply.code(200).send({ caseId: params.caseId, replays: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Observability Certification
  fastify.post('/api/observability/certification/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await certifyObservability(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/observability/certification/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.observabilityCertificationTracking.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, certifications: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Validation endpoint
  fastify.get('/api/observability/validation', async (_req, reply) => {
    try {
      const [traces, telemetry, incidents, integrity, pipelines, anomalies, manifests, state, replays, certifications] = await Promise.all([
        prisma.endToEndOperationalTrace.count(),
        prisma.crossLayerTelemetrySync.count(),
        prisma.incidentReconstructionRecord.count(),
        prisma.integrityEventMonitor.count(),
        prisma.deterministicObservabilityPipeline.count(),
        prisma.operationalAnomalyDetection.count(),
        prisma.auditTelemetryManifest.count(),
        prisma.platformStateVisibility.count(),
        prisma.telemetryReplayVerification.count(),
        prisma.observabilityCertificationTracking.count(),
      ]);
      return reply.code(200).send({
        phase: 'L.1',
        name: 'Full-System Observability + Forensic Telemetry Framework',
        generatedAt: new Date().toISOString(),
        totals: { traces, telemetry, incidents, integrity, pipelines, anomalies, manifests, state, replays, certifications },
        constraints: {
          noCovertTelemetryCollection: true,
          noOpaqueUserAnalytics: true,
          noHiddenBehavioralMonitoring: true,
          noProbabilisticSurveillanceScoring: true,
          noUnverifiableObservabilitySystems: true,
          corePrinciple: 'CourtAccess maximizes transparent forensic observability and operational traceability. It does NOT create hidden surveillance infrastructure.',
        },
      });
    } catch (err) { return reply.code(500).send({ error: 'Validation failed' }); }
  });
}
