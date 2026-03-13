// ============================================================================
// Admin Queue Monitoring — GET /api/admin/queues
// Returns real-time status of all BullMQ worker queues across
// the Timeline and Narrative intelligence systems.
// ============================================================================

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { QUEUE_CONFIGS, globalMonitor, getQueue } from '../workers/queueManager.js';

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
  const queues = await Promise.all(MONITORED_QUEUES.map(async (configKey) => {
    const config = QUEUE_CONFIGS[configKey];
    const metrics = allMetrics.find((m) => m.configKey === configKey);

    if (!config) {
      // Derive dash-separated name from camelCase configKey
      const dashName = configKey.replace(/([A-Z])/g, '-$1').toLowerCase();
      return {
        queueName: dashName,
        status: 'not_registered',
        activeJobs: 0,
        waitingJobs: 0,
        failedJobs: 0,
        completedJobs: 0,
      };
    }

    let jobCounts: {
      active?: number;
      waiting?: number;
      failed?: number;
      completed?: number;
    } = {};

    try {
      // Use BullMQ queue counts (requires Redis connection)
      const queue = getQueue(configKey);
      jobCounts = await queue.getJobCounts('active', 'waiting', 'failed', 'completed');
    } catch (err) {
      console.error(`[QueueMonitor] Failed to fetch job counts for ${configKey}:`, err);
    }

    return {
      queueName: config.name,
      status: config.enabled ? 'active' : 'disabled',
      activeJobs: jobCounts.active ?? 0,
      waitingJobs: jobCounts.waiting ?? 0,
      failedJobs: jobCounts.failed ?? (metrics?.failedJobs ?? 0),
      completedJobs: jobCounts.completed ?? (metrics?.completedJobs ?? 0),
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
  }));

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

  const timelineQueues = queues.filter((q) => q.queueName.startsWith('timeline-'));
  const narrativeQueues = queues.filter((q) => q.queueName.startsWith('narrative-'));

  return reply.send({
    timestamp: new Date().toISOString(),
    totalQueues: timelineQueues.length + narrativeQueues.length + otherQueues.length,
    intelligence: {
      timeline: timelineQueues,
      narrative: narrativeQueues,
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
