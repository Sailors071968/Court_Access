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

export async function registerAgencyRoutes(app: RouteApp): Promise<void> {
  // -----------------------------------------------------------------------
  // GET /api/policy/agencies — List agencies (paginated, filterable)
  // -----------------------------------------------------------------------
  app.get('/api/policy/agencies', async (request: RouteRequest, reply: RouteReply) => {
    const query = request.query;

    const filter: AgencyFilter = {
      county: query.county || undefined,
      agencyType: query.agencyType as AgencyFilter['agencyType'],
      search: query.search || undefined,
      page: query.page ? parseInt(query.page, 10) : 1,
      limit: query.limit ? parseInt(query.limit, 10) : 25,
    };

    const result = await listAgencies(filter);
    reply.status(200).send(result);
  });

  // -----------------------------------------------------------------------
  // GET /api/policy/agencies/stats — Agency statistics
  // -----------------------------------------------------------------------
  app.get('/api/policy/agencies/stats', async (_request: RouteRequest, reply: RouteReply) => {
    const stats = await getAgencyStats();
    reply.status(200).send(stats);
  });

  // -----------------------------------------------------------------------
  // GET /api/policy/agencies/counties — Distinct county list
  // -----------------------------------------------------------------------
  app.get('/api/policy/agencies/counties', async (_request: RouteRequest, reply: RouteReply) => {
    const counties = await getDistinctCounties();
    reply.status(200).send(counties);
  });

  // -----------------------------------------------------------------------
  // GET /api/policy/agencies/:id — Get single agency
  // -----------------------------------------------------------------------
  app.get('/api/policy/agencies/:id', async (request: RouteRequest, reply: RouteReply) => {
    const { id } = request.params;
    const agency = await getAgencyById(id);

    if (!agency) {
      reply.status(404).send({ error: 'Agency not found' });
      return;
    }

    reply.status(200).send(agency);
  });

  // -----------------------------------------------------------------------
  // POST /api/policy/agencies — Create agency
  // -----------------------------------------------------------------------
  app.post('/api/policy/agencies', async (request: RouteRequest, reply: RouteReply) => {
    const body = request.body as CreateAgencyInput;

    if (!body.agencyName || !body.agencyType || !body.county) {
      reply.status(400).send({ error: 'agencyName, agencyType, and county are required' });
      return;
    }

    const agency = await createAgency(body);
    reply.status(201).send(agency);
  });

  // -----------------------------------------------------------------------
  // PUT /api/policy/agencies/:id — Update agency
  // -----------------------------------------------------------------------
  app.put('/api/policy/agencies/:id', async (request: RouteRequest, reply: RouteReply) => {
    const { id } = request.params;
    const body = request.body as UpdateAgencyInput;

    const existing = await getAgencyById(id);
    if (!existing) {
      reply.status(404).send({ error: 'Agency not found' });
      return;
    }

    const agency = await updateAgency(id, body);
    reply.status(200).send(agency);
  });

  // -----------------------------------------------------------------------
  // DELETE /api/policy/agencies/:id — Delete agency
  // -----------------------------------------------------------------------
  app.delete('/api/policy/agencies/:id', async (request: RouteRequest, reply: RouteReply) => {
    const { id } = request.params;

    const existing = await getAgencyById(id);
    if (!existing) {
      reply.status(404).send({ error: 'Agency not found' });
      return;
    }

    await deleteAgency(id);
    reply.status(204).send();
  });
}
