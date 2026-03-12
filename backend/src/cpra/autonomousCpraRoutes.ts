// ============================================================================
// Autonomous CPRA System — Route Handlers
// All API endpoints for the autonomous CPRA policy acquisition system.
// ============================================================================

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  sendAutonomousCpraRequest,
  sendBatchCpraRequests,
  sendCpraRequestsToAllMissing,
  sendAutonomousFollowUp,
  getAcquisitionProgress,
} from './services/cpraRequestEngine.js';
import {
  getEmailLogForAgency,
  getEmailConversation,
  getEmailStats,
} from './services/cpraEmailLogService.js';
import {
  processAllPendingAttachments,
  processAttachment,
} from './services/cpraAttachmentProcessor.js';
import {
  classifyAttachment,
  classifyAllPending,
} from './services/cpraClassificationEngine.js';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  dismissNotification,
  getUnreadCount,
  getNotificationSummary,
} from './services/cpraNotificationService.js';
import {
  getAgencyTimeline,
  getRecentTimelineEvents,
} from './services/cpraTimelineService.js';
import {
  pollIncomingEmails,
  simulateIncomingEmail,
  startEmailMonitor,
  stopEmailMonitor,
  isEmailMonitorRunning,
} from './workers/cpraEmailMonitorWorker.js';
import {
  checkAndSendFollowUps,
  startFollowUpWorker,
  stopFollowUpWorker,
  isFollowUpWorkerRunning,
} from './workers/cpraFollowUpWorker.js';
import {
  processIngestionQueue,
  startIngestionWorker,
  stopIngestionWorker,
  isIngestionWorkerRunning,
} from './workers/cpraIngestionWorker.js';

// ---------------------------------------------------------------------------
// Route Registration
// ---------------------------------------------------------------------------

export async function registerAutonomousCpraRoutes(app: FastifyInstance): Promise<void> {
  // =========================================================================
  // CPRA Request Engine
  // =========================================================================

  // POST /api/admin/cpra/send — send CPRA request to single agency
  app.post('/api/admin/cpra/send', async (req: FastifyRequest, reply: FastifyReply) => {
    const { agencyId, campaignId } = req.body as { agencyId: string; campaignId: string };
    if (!agencyId || !campaignId) {
      return reply.status(400).send({ error: 'agencyId and campaignId required' });
    }
    const result = await sendAutonomousCpraRequest(agencyId, campaignId);
    return reply.send(result);
  });

  // POST /api/admin/cpra/send-batch — send CPRA requests to multiple agencies
  app.post('/api/admin/cpra/send-batch', async (req: FastifyRequest, reply: FastifyReply) => {
    const { agencyIds, campaignId } = req.body as { agencyIds: string[]; campaignId: string };
    if (!agencyIds?.length || !campaignId) {
      return reply.status(400).send({ error: 'agencyIds[] and campaignId required' });
    }
    const result = await sendBatchCpraRequests(agencyIds, campaignId);
    return reply.send(result);
  });

  // POST /api/admin/cpra/send-all-missing — send to all agencies with missing policies
  app.post('/api/admin/cpra/send-all-missing', async (req: FastifyRequest, reply: FastifyReply) => {
    const { campaignId } = req.body as { campaignId: string };
    if (!campaignId) {
      return reply.status(400).send({ error: 'campaignId required' });
    }
    const result = await sendCpraRequestsToAllMissing(campaignId);
    return reply.send(result);
  });

  // POST /api/admin/cpra/follow-up/:requestId — send follow-up for a request
  app.post('/api/admin/cpra/follow-up/:requestId', async (req: FastifyRequest, reply: FastifyReply) => {
    const { requestId } = req.params as { requestId: string };
    const result = await sendAutonomousFollowUp(requestId);
    return reply.send(result);
  });

  // GET /api/admin/cpra/progress — acquisition progress summary
  app.get('/api/admin/cpra/progress', async (_req: FastifyRequest, reply: FastifyReply) => {
    const progress = await getAcquisitionProgress();
    return reply.send(progress);
  });

  // =========================================================================
  // Email Log
  // =========================================================================

  // GET /api/admin/cpra/emails/:agencyId — email log for an agency
  app.get('/api/admin/cpra/emails/:agencyId', async (req: FastifyRequest, reply: FastifyReply) => {
    const { agencyId } = req.params as { agencyId: string };
    const query = req.query as { limit?: string };
    const emails = await getEmailLogForAgency(agencyId, parseInt(query.limit ?? '50', 10));
    return reply.send({ emails, total: emails.length });
  });

  // GET /api/admin/cpra/emails/conversation/:requestId — email conversation for a request
  app.get('/api/admin/cpra/emails/conversation/:requestId', async (req: FastifyRequest, reply: FastifyReply) => {
    const { requestId } = req.params as { requestId: string };
    const emails = await getEmailConversation(requestId);
    return reply.send({ emails, total: emails.length });
  });

  // GET /api/admin/cpra/email-stats — email statistics
  app.get('/api/admin/cpra/email-stats', async (_req: FastifyRequest, reply: FastifyReply) => {
    const stats = await getEmailStats();
    return reply.send(stats);
  });

  // =========================================================================
  // Attachment Processing
  // =========================================================================

  // POST /api/admin/cpra/attachments/process — process all pending attachments
  app.post('/api/admin/cpra/attachments/process', async (_req: FastifyRequest, reply: FastifyReply) => {
    const result = await processAllPendingAttachments();
    return reply.send(result);
  });

  // POST /api/admin/cpra/attachments/process/:attachmentId — process single attachment
  app.post('/api/admin/cpra/attachments/process/:attachmentId', async (req: FastifyRequest, reply: FastifyReply) => {
    const { attachmentId } = req.params as { attachmentId: string };
    const result = await processAttachment(attachmentId);
    return reply.send(result);
  });

  // =========================================================================
  // Classification Engine
  // =========================================================================

  // POST /api/admin/cpra/classify/:attachmentId — classify a single attachment
  app.post('/api/admin/cpra/classify/:attachmentId', async (req: FastifyRequest, reply: FastifyReply) => {
    const { attachmentId } = req.params as { attachmentId: string };
    const result = await classifyAttachment(attachmentId);
    return reply.send(result);
  });

  // POST /api/admin/cpra/classify-all — classify all pending attachments
  app.post('/api/admin/cpra/classify-all', async (_req: FastifyRequest, reply: FastifyReply) => {
    const result = await classifyAllPending();
    return reply.send(result);
  });

  // =========================================================================
  // Notifications
  // =========================================================================

  // GET /api/admin/cpra/notifications — get notifications
  app.get('/api/admin/cpra/notifications', async (req: FastifyRequest, reply: FastifyReply) => {
    const query = req.query as {
      unreadOnly?: string;
      eventType?: string;
      agencyId?: string;
      limit?: string;
      since?: string;
    };

    const notifications = await getNotifications({
      unreadOnly: query.unreadOnly === 'true',
      eventType: query.eventType as Parameters<typeof getNotifications>[0] extends undefined ? never : NonNullable<Parameters<typeof getNotifications>[0]>['eventType'],
      agencyId: query.agencyId,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      since: query.since ? new Date(query.since) : undefined,
    });

    return reply.send({ notifications, total: notifications.length });
  });

  // GET /api/admin/cpra/notifications/count — unread count
  app.get('/api/admin/cpra/notifications/count', async (_req: FastifyRequest, reply: FastifyReply) => {
    const count = await getUnreadCount();
    return reply.send({ unread: count });
  });

  // GET /api/admin/cpra/notifications/summary — notification summary
  app.get('/api/admin/cpra/notifications/summary', async (_req: FastifyRequest, reply: FastifyReply) => {
    const summary = await getNotificationSummary();
    return reply.send(summary);
  });

  // PUT /api/admin/cpra/notifications/:notificationId/read — mark as read
  app.put('/api/admin/cpra/notifications/:notificationId/read', async (req: FastifyRequest, reply: FastifyReply) => {
    const { notificationId } = req.params as { notificationId: string };
    await markNotificationRead(notificationId);
    return reply.send({ success: true });
  });

  // PUT /api/admin/cpra/notifications/read-all — mark all as read
  app.put('/api/admin/cpra/notifications/read-all', async (_req: FastifyRequest, reply: FastifyReply) => {
    const count = await markAllNotificationsRead();
    return reply.send({ success: true, markedRead: count });
  });

  // DELETE /api/admin/cpra/notifications/:notificationId — dismiss
  app.delete('/api/admin/cpra/notifications/:notificationId', async (req: FastifyRequest, reply: FastifyReply) => {
    const { notificationId } = req.params as { notificationId: string };
    await dismissNotification(notificationId);
    return reply.send({ success: true });
  });

  // =========================================================================
  // Timeline
  // =========================================================================

  // GET /api/admin/cpra/timeline/:agencyId — agency timeline
  app.get('/api/admin/cpra/timeline/:agencyId', async (req: FastifyRequest, reply: FastifyReply) => {
    const { agencyId } = req.params as { agencyId: string };
    const query = req.query as { limit?: string };
    const events = await getAgencyTimeline(agencyId, parseInt(query.limit ?? '100', 10));
    return reply.send({ events, total: events.length });
  });

  // GET /api/admin/cpra/timeline — recent timeline events across all agencies
  app.get('/api/admin/cpra/timeline', async (req: FastifyRequest, reply: FastifyReply) => {
    const query = req.query as { limit?: string; since?: string };
    const events = await getRecentTimelineEvents(
      parseInt(query.limit ?? '50', 10),
      query.since ? new Date(query.since) : undefined,
    );
    return reply.send({ events, total: events.length });
  });

  // =========================================================================
  // Email Monitor Worker
  // =========================================================================

  // POST /api/admin/cpra/monitor/poll — manually trigger inbox poll
  app.post('/api/admin/cpra/monitor/poll', async (_req: FastifyRequest, reply: FastifyReply) => {
    const result = await pollIncomingEmails();
    return reply.send(result);
  });

  // POST /api/admin/cpra/monitor/simulate — simulate incoming email (testing)
  app.post('/api/admin/cpra/monitor/simulate', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as {
      from: string;
      subject: string;
      body: string;
      attachments?: Array<{ fileName: string; mimeType: string; size: number }>;
    };
    const result = await simulateIncomingEmail(body);
    return reply.send(result);
  });

  // POST /api/admin/cpra/monitor/start — start email monitor worker
  app.post('/api/admin/cpra/monitor/start', async (_req: FastifyRequest, reply: FastifyReply) => {
    startEmailMonitor();
    return reply.send({ started: true, running: isEmailMonitorRunning() });
  });

  // POST /api/admin/cpra/monitor/stop — stop email monitor worker
  app.post('/api/admin/cpra/monitor/stop', async (_req: FastifyRequest, reply: FastifyReply) => {
    stopEmailMonitor();
    return reply.send({ stopped: true, running: isEmailMonitorRunning() });
  });

  // =========================================================================
  // Follow-Up Worker
  // =========================================================================

  // POST /api/admin/cpra/follow-up/check — manually trigger follow-up check
  app.post('/api/admin/cpra/follow-up/check', async (_req: FastifyRequest, reply: FastifyReply) => {
    const result = await checkAndSendFollowUps();
    return reply.send(result);
  });

  // POST /api/admin/cpra/follow-up/worker/start — start follow-up worker
  app.post('/api/admin/cpra/follow-up/worker/start', async (_req: FastifyRequest, reply: FastifyReply) => {
    startFollowUpWorker();
    return reply.send({ started: true, running: isFollowUpWorkerRunning() });
  });

  // POST /api/admin/cpra/follow-up/worker/stop — stop follow-up worker
  app.post('/api/admin/cpra/follow-up/worker/stop', async (_req: FastifyRequest, reply: FastifyReply) => {
    stopFollowUpWorker();
    return reply.send({ stopped: true, running: isFollowUpWorkerRunning() });
  });

  // =========================================================================
  // Ingestion Worker
  // =========================================================================

  // POST /api/admin/cpra/ingestion/process — manually trigger ingestion
  app.post('/api/admin/cpra/ingestion/process', async (_req: FastifyRequest, reply: FastifyReply) => {
    const result = await processIngestionQueue();
    return reply.send(result);
  });

  // POST /api/admin/cpra/ingestion/worker/start — start ingestion worker
  app.post('/api/admin/cpra/ingestion/worker/start', async (_req: FastifyRequest, reply: FastifyReply) => {
    startIngestionWorker();
    return reply.send({ started: true, running: isIngestionWorkerRunning() });
  });

  // POST /api/admin/cpra/ingestion/worker/stop — stop ingestion worker
  app.post('/api/admin/cpra/ingestion/worker/stop', async (_req: FastifyRequest, reply: FastifyReply) => {
    stopIngestionWorker();
    return reply.send({ stopped: true, running: isIngestionWorkerRunning() });
  });

  // =========================================================================
  // System Status
  // =========================================================================

  // GET /api/admin/cpra/status — system-wide status
  app.get('/api/admin/cpra/status', async (_req: FastifyRequest, reply: FastifyReply) => {
    const [progress, emailStats, notificationSummary] = await Promise.all([
      getAcquisitionProgress(),
      getEmailStats(),
      getNotificationSummary(),
    ]);

    return reply.send({
      workers: {
        emailMonitor: { running: isEmailMonitorRunning() },
        followUp: { running: isFollowUpWorkerRunning() },
        ingestion: { running: isIngestionWorkerRunning() },
      },
      acquisition: progress,
      emails: emailStats,
      notifications: notificationSummary,
      timestamp: new Date().toISOString(),
    });
  });
}
