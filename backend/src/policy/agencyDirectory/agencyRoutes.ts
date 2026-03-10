// ============================================
// Court Access — Agency Directory API Routes
// RESTful endpoints for the Agency Directory.
// ============================================

import {
  listAgencies,
  getAgencyById,
  createAgency,
  updateAgency,
  deleteAgency,
  getAgencyStats,
  getDistinctCounties,
} from './agencyService.js';
import type { AgencyFilter, CreateAgencyInput, UpdateAgencyInput } from './types.js';

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
  delete(path: string, handler: (req: RouteRequest, reply: RouteReply) => Promise<void>): void;
}

// ---------------------------------------------------------------------------
// Route Registration
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse a numeric query param, returning fallback if missing/invalid. */
function safeInt(val: string | undefined, fallback: number, min = 1, max = 1000): number {
  if (!val) return fallback;
  const n = parseInt(val, 10);
  if (!Number.isFinite(n) || n < min) return fallback;
  return Math.min(n, max);
}

/** Map Prisma error codes to HTTP status codes. */
function prismaErrorStatus(err: unknown): number {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as { code: string }).code;
    if (code === 'P2002') return 409; // unique constraint violation
    if (code === 'P2025') return 404; // record not found
  }
  return 500;
}

export async function registerAgencyRoutes(app: RouteApp): Promise<void> {
  // -----------------------------------------------------------------------
  // GET /api/policy/agencies — List agencies (paginated, filterable)
  // -----------------------------------------------------------------------
  app.get('/api/policy/agencies', async (request: RouteRequest, reply: RouteReply) => {
    try {
      const query = request.query;

      const filter: AgencyFilter = {
        county: query.county || undefined,
        agencyType: query.agencyType as AgencyFilter['agencyType'],
        search: query.search || undefined,
        page: safeInt(query.page, 1, 1, 10000),
        limit: safeInt(query.limit, 25, 1, 100),
      };

      const result = await listAgencies(filter);
      reply.status(200).send(result);
    } catch (err) {
      reply.status(prismaErrorStatus(err)).send({ error: 'Failed to list agencies' });
    }
  });

  // -----------------------------------------------------------------------
  // GET /api/policy/agencies/stats — Agency statistics
  // -----------------------------------------------------------------------
  app.get('/api/policy/agencies/stats', async (_request: RouteRequest, reply: RouteReply) => {
    try {
      const stats = await getAgencyStats();
      reply.status(200).send(stats);
    } catch (err) {
      reply.status(prismaErrorStatus(err)).send({ error: 'Failed to fetch agency stats' });
    }
  });

  // -----------------------------------------------------------------------
  // GET /api/policy/agencies/counties — Distinct county list
  // -----------------------------------------------------------------------
  app.get('/api/policy/agencies/counties', async (_request: RouteRequest, reply: RouteReply) => {
    try {
      const counties = await getDistinctCounties();
      reply.status(200).send(counties);
    } catch (err) {
      reply.status(prismaErrorStatus(err)).send({ error: 'Failed to fetch counties' });
    }
  });

  // -----------------------------------------------------------------------
  // GET /api/policy/agencies/:id — Get single agency
  // -----------------------------------------------------------------------
  app.get('/api/policy/agencies/:id', async (request: RouteRequest, reply: RouteReply) => {
    try {
      const { id } = request.params;
      const agency = await getAgencyById(id);

      if (!agency) {
        reply.status(404).send({ error: 'Agency not found' });
        return;
      }

      reply.status(200).send(agency);
    } catch (err) {
      reply.status(prismaErrorStatus(err)).send({ error: 'Failed to fetch agency' });
    }
  });

  // -----------------------------------------------------------------------
  // POST /api/policy/agencies — Create agency
  // -----------------------------------------------------------------------
  app.post('/api/policy/agencies', async (request: RouteRequest, reply: RouteReply) => {
    try {
      const body = request.body as CreateAgencyInput;

      if (!body.agencyName || !body.agencyType || !body.county) {
        reply.status(400).send({ error: 'agencyName, agencyType, and county are required' });
        return;
      }

      const agency = await createAgency(body);
      reply.status(201).send(agency);
    } catch (err) {
      reply.status(prismaErrorStatus(err)).send({ error: 'Failed to create agency' });
    }
  });

  // -----------------------------------------------------------------------
  // PUT /api/policy/agencies/:id — Update agency
  // -----------------------------------------------------------------------
  app.put('/api/policy/agencies/:id', async (request: RouteRequest, reply: RouteReply) => {
    try {
      const { id } = request.params;
      const body = request.body as UpdateAgencyInput;

      const existing = await getAgencyById(id);
      if (!existing) {
        reply.status(404).send({ error: 'Agency not found' });
        return;
      }

      const agency = await updateAgency(id, body);
      reply.status(200).send(agency);
    } catch (err) {
      reply.status(prismaErrorStatus(err)).send({ error: 'Failed to update agency' });
    }
  });

  // -----------------------------------------------------------------------
  // DELETE /api/policy/agencies/:id — Delete agency
  // -----------------------------------------------------------------------
  app.delete('/api/policy/agencies/:id', async (request: RouteRequest, reply: RouteReply) => {
    try {
      const { id } = request.params;

      const existing = await getAgencyById(id);
      if (!existing) {
        reply.status(404).send({ error: 'Agency not found' });
        return;
      }

      await deleteAgency(id);
      reply.status(204).send();
    } catch (err) {
      reply.status(prismaErrorStatus(err)).send({ error: 'Failed to delete agency' });
    }
  });
}
