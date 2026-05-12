// ============================================================================
// Phase H.3 — Enterprise Scalability + Distributed Reliability Routes
// Scales deterministically and recovers reproducibly.
// NEVER sacrifices evidentiary integrity for throughput.
// ============================================================================

import { FastifyInstance } from 'fastify';
import {
  runFullEnterpriseScalabilityAnalysis,
  orchestrateDistributedJob,
  executeDistributedJob,
  verifyQueueIntegrity,
  logFaultRecovery,
  synchronizeWorkers,
  batchEvidenceProcessing,
  verifyDistributedReplay,
  createRecoveryCheckpoint,
  collectHealthTelemetry,
  isolateFailureCascade,
  computeSurvivabilityMetrics,
} from '../services/enterpriseScalabilityService.js';
import prisma from '../lib/prisma.js';

export async function registerEnterpriseScalabilityRoutes(fastify: FastifyInstance) {

  // POST — Full scalability analysis
  fastify.post('/api/scalability/analyze/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const result = await runFullEnterpriseScalabilityAnalysis(params.caseId);
      return reply.code(200).send(result);
    } catch (err) {
      fastify.log.error(err, 'Scalability analysis failed');
      return reply.code(500).send({ error: 'Analysis failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // Distributed Jobs
  fastify.post('/api/scalability/jobs/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    const body = req.body as { jobType?: string; priority?: number } | undefined;
    try {
      const jobResult = await orchestrateDistributedJob(body?.jobType || 'full_analysis', params.caseId, { caseId: params.caseId }, body?.priority || 5);
      const execResult = await executeDistributedJob(jobResult.jobId);
      return reply.code(200).send(execResult);
    } catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/scalability/jobs/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const jobs = await prisma.distributedJobOrchestration.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, jobs, total: jobs.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Queue Integrity
  fastify.post('/api/scalability/queues/:caseId', async (_req, reply) => {
    try { return reply.code(200).send(await verifyQueueIntegrity()); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/scalability/queues/:caseId', async (_req, reply) => {
    try {
      const queues = await prisma.queueIntegrityVerification.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });
      return reply.code(200).send({ queues, total: queues.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Fault Recovery
  fastify.post('/api/scalability/recovery/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    const body = req.body as { faultType?: string; component?: string } | undefined;
    try {
      return reply.code(200).send(await logFaultRecovery(body?.faultType || 'timeout', body?.component || 'analysis_engine', params.caseId, { timestamp: new Date().toISOString() }));
    } catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/scalability/recovery/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const logs = await prisma.faultTolerantRecoveryLog.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, logs, total: logs.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Worker Sync
  fastify.post('/api/scalability/sync/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await synchronizeWorkers(`sync-${params.caseId}`)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/scalability/sync/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const syncs = await prisma.multiWorkerSynchronization.findMany({ where: { syncGroupId: `sync-${params.caseId}` }, orderBy: { createdAt: 'desc' }, take: 20 });
      return reply.code(200).send({ caseId: params.caseId, syncs, total: syncs.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Evidence Batching
  fastify.post('/api/scalability/batches/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await batchEvidenceProcessing(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/scalability/batches/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const batches = await prisma.highVolumeEvidenceBatch.findMany({ where: { caseId: params.caseId }, orderBy: { batchNumber: 'asc' }, take: 100 });
      return reply.code(200).send({ caseId: params.caseId, batches, total: batches.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Distributed Replay
  fastify.post('/api/scalability/replays/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await verifyDistributedReplay(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/scalability/replays/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const replays = await prisma.distributedReplayVerification.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, replays, total: replays.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Recovery Checkpoints
  fastify.post('/api/scalability/checkpoints/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await createRecoveryCheckpoint(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/scalability/checkpoints/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const checkpoints = await prisma.recoveryCheckpoint.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 20 });
      return reply.code(200).send({ caseId: params.caseId, checkpoints, total: checkpoints.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Health Telemetry
  fastify.post('/api/scalability/telemetry/:caseId', async (_req, reply) => {
    try { return reply.code(200).send(await collectHealthTelemetry()); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/scalability/telemetry/:caseId', async (_req, reply) => {
    try {
      const telemetry = await prisma.operationalHealthTelemetry.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ telemetry, total: telemetry.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Failure Isolation
  fastify.post('/api/scalability/isolations/:caseId', async (req, reply) => {
    const body = req.body as { origin?: string; failureType?: string; affected?: string[] } | undefined;
    try {
      return reply.code(200).send(await isolateFailureCascade(body?.origin || 'api_server', body?.failureType || 'timeout', body?.affected || ['database']));
    } catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/scalability/isolations/:caseId', async (_req, reply) => {
    try {
      const isolations = await prisma.failureCascadeIsolation.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });
      return reply.code(200).send({ isolations, total: isolations.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Survivability Metrics
  fastify.post('/api/scalability/metrics/:caseId', async (_req, reply) => {
    try { return reply.code(200).send(await computeSurvivabilityMetrics()); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/scalability/metrics/:caseId', async (_req, reply) => {
    try {
      const metrics = await prisma.systemSurvivabilityMetric.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });
      return reply.code(200).send({ metrics, total: metrics.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Validation
  fastify.get('/api/scalability/validation', async (_req, reply) => {
    try {
      const [jobs, queues, recovery, syncs, batches, replays, checkpoints, telemetry, isolations, metrics] = await Promise.all([
        prisma.distributedJobOrchestration.count(),
        prisma.queueIntegrityVerification.count(),
        prisma.faultTolerantRecoveryLog.count(),
        prisma.multiWorkerSynchronization.count(),
        prisma.highVolumeEvidenceBatch.count(),
        prisma.distributedReplayVerification.count(),
        prisma.recoveryCheckpoint.count(),
        prisma.operationalHealthTelemetry.count(),
        prisma.failureCascadeIsolation.count(),
        prisma.systemSurvivabilityMetric.count(),
      ]);
      return reply.code(200).send({
        phase: 'H.3',
        name: 'Enterprise Scalability + Distributed Reliability Framework',
        generatedAt: new Date().toISOString(),
        totals: { jobs, queues, recovery, syncs, batches, replays, checkpoints, telemetry, isolations, metrics },
        constraints: {
          noOpaqueDistributedMutation: true,
          noUnverifiableAsyncProcessing: true,
          noHiddenQueueCorruption: true,
          noUncontrolledAutoscaling: true,
          noProbabilisticDivergence: true,
          corePrinciple: 'CourtAccess scales deterministically and recovers reproducibly. It does NOT sacrifice evidentiary integrity for distributed throughput.',
        },
      });
    } catch (err) { return reply.code(500).send({ error: 'Validation failed' }); }
  });
}
