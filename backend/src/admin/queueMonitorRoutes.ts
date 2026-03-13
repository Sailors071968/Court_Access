// ============================================================================
// Admin Queue Monitoring — GET /api/admin/queues
// Returns real-time status of all BullMQ worker queues across
// the Timeline and Narrative intelligence systems.
// ============================================================================

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { QUEUE_CONFIGS, globalMonitor } from '../workers/queueManager.js';

// Import pipeline modules to ensure their queue configs are registered
import '../timeline/timelineProcessingPipeline.js';
import '../narrative/narrativeProcessingPipeline.js';
import '../evidence/evidenceProcessingPipeline.js';

// ---------------------------------------------------------------------------
// Queue names the user expects to monitor
// ---------------------------------------------------------------------------

const MONITORED_QUEUES = [
  // Timeline Engine
  'timelineTemporalExtraction',
  'timelineVideoEvents',
  'timelineEventCorrelation',
  'timelineBuilder',
  // Narrative Engine
  'narrativeClaimExtraction',
  'narrativeClaimNormalization',
  'narrativeEvidenceValidation',
  'narrativeImpeachmentAnalysis',
];

// ---------------------------------------------------------------------------
// GET /api/admin/queues
// ---------------------------------------------------------------------------

async function getQueueStatus(
  _request: FastifyRequest,
  reply: FastifyReply,
) {
  const allMetrics = globalMonitor.getAllMetrics();

  // Build response for all monitored queues
  const queues = MONITORED_QUEUES.map((configKey) => {
    const config = QUEUE_CONFIGS[configKey];
    const metrics = allMetrics.find((m) => m.configKey === configKey);

    if (!config) {
      return {
        queueName: configKey,
        status: 'not_registered',
        activeJobs: 0,
        waitingJobs: 0,
        failedJobs: 0,
        completedJobs: 0,
      };
    }

    return {
      queueName: config.name,
      status: config.enabled ? 'active' : 'disabled',
      activeJobs: 0, // BullMQ active count requires queue connection — use monitor metrics
      waitingJobs: 0,
      failedJobs: metrics?.failedJobs ?? 0,
      completedJobs: metrics?.completedJobs ?? 0,
      description: config.description,
      concurrency: config.concurrency,
      lastCompletedAt: metrics?.lastCompletedAt
        ? new Date(metrics.lastCompletedAt).toISOString()
        : null,
      lastFailedAt: metrics?.lastFailedAt
        ? new Date(metrics.lastFailedAt).toISOString()
        : null,
      lastError: metrics?.lastError ?? null,
    };
  });

  // Also include other registered queues not in the main list
  const otherQueues = allMetrics
    .filter((m) => !MONITORED_QUEUES.includes(m.configKey))
    .map((m) => ({
      queueName: m.queueName,
      status: m.enabled ? 'active' : 'disabled',
      activeJobs: 0,
      waitingJobs: 0,
      failedJobs: m.failedJobs,
      completedJobs: m.completedJobs,
      description: m.description,
      concurrency: m.concurrency,
    }));

  return reply.send({
    timestamp: new Date().toISOString(),
    totalQueues: queues.length + otherQueues.length,
    intelligence: {
      timeline: queues.filter((q) => q.queueName.startsWith('timeline-')),
      narrative: queues.filter((q) => q.queueName.startsWith('narrative-')),
    },
    other: otherQueues,
  });
}

// ---------------------------------------------------------------------------
// Route Registration
// ---------------------------------------------------------------------------

export async function registerQueueMonitorRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/admin/queues', getQueueStatus);
}
