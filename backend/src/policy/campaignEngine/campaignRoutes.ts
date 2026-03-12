// ============================================
// Court Access — Campaign Engine API Routes
// RESTful endpoints for policy acquisition campaigns.
// ============================================

import { sendCampaign } from './campaignService.js';
import {
  listPolicyRequests,
  getCampaignStats,
  updateRequestStatus,
  getRequestByTrackingId,
} from './requestTracker.js';
import {
  startScheduler,
  stopScheduler,
  getSchedulerStatus,
} from './campaignScheduler.js';
import type { CampaignFilter, PolicyRequestStatus, SendCampaignInput } from './types.js';
import { ALL_REQUEST_STATUSES } from './types.js';

// ---------------------------------------------------------------------------
// Generic HTTP types (framework-agnostic — compatible with Fastify/Express)
// ---------------------------------------------------------------------------

interface RouteRequest {
  query: Record<string, string | undefined>;
  params: Record<string, string>;
  body: unknown;
}

interface RouteReply {
  status(code: number): RouteReply;
  send(data?: unknown): void;
}

interface RouteApp {
  get(path: string, handler: (req: RouteRequest, reply: RouteReply) => Promise<void>): void;
  post(path: string, handler: (req: RouteRequest, reply: RouteReply) => Promise<void>): void;
  put(path: string, handler: (req: RouteRequest, reply: RouteReply) => Promise<void>): void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safeInt(val: string | undefined, fallback: number, min = 1, max = 1000): number {
  if (!val) return fallback;
  const n = parseInt(val, 10);
  if (!Number.isFinite(n) || n < min) return fallback;
  return Math.min(n, max);
}

// ---------------------------------------------------------------------------
// Route Registration
// ---------------------------------------------------------------------------

export async function registerCampaignRoutes(app: RouteApp): Promise<void> {
  // -----------------------------------------------------------------------
  // GET /api/policy/campaigns — List policy requests (paginated)
  // -----------------------------------------------------------------------
  app.get('/api/policy/campaigns', async (request: RouteRequest, reply: RouteReply) => {
    try {
      const query = request.query;

      const filter: CampaignFilter = {
        agencyId: query.agencyId || undefined,
        status: (query.status && ALL_REQUEST_STATUSES.includes(query.status as PolicyRequestStatus))
          ? (query.status as PolicyRequestStatus)
          : undefined,
        county: query.county || undefined,
        agencyType: query.agencyType || undefined,
        search: query.search || undefined,
        page: safeInt(query.page, 1, 1, 10000),
        limit: safeInt(query.limit, 25, 1, 100),
      };

      const result = await listPolicyRequests(filter);
      reply.status(200).send(result);
    } catch (err) {
      reply.status(500).send({ error: 'Failed to list campaign requests' });
    }
  });

  // -----------------------------------------------------------------------
  // GET /api/policy/campaigns/stats — Campaign statistics
  // -----------------------------------------------------------------------
  app.get('/api/policy/campaigns/stats', async (_request: RouteRequest, reply: RouteReply) => {
    try {
      const stats = await getCampaignStats();
      reply.status(200).send(stats);
    } catch (err) {
      reply.status(500).send({ error: 'Failed to fetch campaign stats' });
    }
  });

  // -----------------------------------------------------------------------
  // GET /api/policy/campaigns/scheduler — Scheduler status
  // -----------------------------------------------------------------------
  app.get('/api/policy/campaigns/scheduler', async (_request: RouteRequest, reply: RouteReply) => {
    try {
      const status = await getSchedulerStatus();
      reply.status(200).send(status);
    } catch (err) {
      reply.status(500).send({ error: 'Failed to fetch scheduler status' });
    }
  });

  // -----------------------------------------------------------------------
  // GET /api/policy/campaigns/:trackingId — Get request by tracking ID
  // -----------------------------------------------------------------------
  app.get('/api/policy/campaigns/:trackingId', async (request: RouteRequest, reply: RouteReply) => {
    try {
      const { trackingId } = request.params;
      const req = await getRequestByTrackingId(trackingId);

      if (!req) {
        reply.status(404).send({ error: 'Request not found' });
        return;
      }

      reply.status(200).send(req);
    } catch (err) {
      reply.status(500).send({ error: 'Failed to fetch request' });
    }
  });

  // -----------------------------------------------------------------------
  // POST /api/policy/campaigns/send — Send campaign batch
  // -----------------------------------------------------------------------
  app.post('/api/policy/campaigns/send', async (request: RouteRequest, reply: RouteReply) => {
    try {
      const body = request.body as SendCampaignInput;

      const input: SendCampaignInput = {
        county: body.county || undefined,
        agencyType: body.agencyType || undefined,
        onlyNew: body.onlyNew ?? true,
      };

      const result = await sendCampaign(input);
      reply.status(200).send(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Campaign send failed';
      reply.status(500).send({ error: msg });
    }
  });

  // -----------------------------------------------------------------------
  // POST /api/policy/campaigns/scheduler/start — Start scheduler
  // -----------------------------------------------------------------------
  app.post('/api/policy/campaigns/scheduler/start', async (request: RouteRequest, reply: RouteReply) => {
    try {
      const body = request.body as SendCampaignInput | undefined;
      startScheduler(body || { onlyNew: true });
      const status = await getSchedulerStatus();
      reply.status(200).send(status);
    } catch (err) {
      reply.status(500).send({ error: 'Failed to start scheduler' });
    }
  });

  // -----------------------------------------------------------------------
  // POST /api/policy/campaigns/scheduler/stop — Stop scheduler
  // -----------------------------------------------------------------------
  app.post('/api/policy/campaigns/scheduler/stop', async (_request: RouteRequest, reply: RouteReply) => {
    try {
      stopScheduler();
      const status = await getSchedulerStatus();
      reply.status(200).send(status);
    } catch (err) {
      reply.status(500).send({ error: 'Failed to stop scheduler' });
    }
  });

  // -----------------------------------------------------------------------
  // PUT /api/policy/campaigns/:trackingId/status — Update request status
  // -----------------------------------------------------------------------
  app.put('/api/policy/campaigns/:trackingId/status', async (request: RouteRequest, reply: RouteReply) => {
    try {
      const { trackingId } = request.params;
      const body = request.body as { status: PolicyRequestStatus; responseAt?: string };

      if (!body.status) {
        reply.status(400).send({ error: 'status is required' });
        return;
      }

      if (!ALL_REQUEST_STATUSES.includes(body.status)) {
        reply.status(400).send({ error: `Invalid status value. Allowed: ${ALL_REQUEST_STATUSES.join(', ')}` });
        return;
      }

      const updated = await updateRequestStatus(trackingId, body.status, {
        responseAt: body.responseAt ? new Date(body.responseAt) : undefined,
      });

      reply.status(200).send(updated);
    } catch (err) {
      reply.status(500).send({ error: 'Failed to update request status' });
    }
  });
}
