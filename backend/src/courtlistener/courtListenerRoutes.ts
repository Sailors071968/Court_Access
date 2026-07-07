// ============================================================================
// CourtListener API routes — canonical legal-research / authority / citation
// endpoints backed by the Free Law Project REST v4 API. Auth-guarded.
// ============================================================================

import type { FastifyInstance, FastifyReply } from 'fastify';
import type { AuthenticatedRequest } from '../security/authMiddleware.js';
import { guardAuth } from '../membership/resourceAuthMiddleware.js';
import { searchAuthorities, opinionById, docketById, analyzeCitations, integrationStatus } from './courtListenerService.js';

export async function registerCourtListenerRoutes(app: FastifyInstance): Promise<void> {
  // Integration status / health (does not call upstream).
  app.get('/api/courtlistener/status', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!(await guardAuth(user, reply))) return;
    return reply.send(integrationStatus());
  });

  // Authority / case-law search (Legal Research, Authority Search).
  app.get('/api/courtlistener/search', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!(await guardAuth(user, reply))) return;
    const q = request.query as Record<string, string>;
    const query = (q.q ?? '').trim();
    if (!query) return reply.code(400).send({ error: 'q is required' });
    const type = (['o', 'r', 'p', 'oa'] as const).includes(q.type as never) ? (q.type as 'o') : 'o';
    const pageSize = Math.min(Math.max(parseInt(q.page_size ?? '10', 10) || 10, 1), 50);
    const result = await searchAuthorities({ q: query, type, court: q.court, pageSize });
    return reply.code(result.ok ? 200 : 502).send(result);
  });

  // Opinion retrieval.
  app.get('/api/courtlistener/opinions/:id', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!(await guardAuth(user, reply))) return;
    const { id } = request.params as { id: string };
    const res = await opinionById(id);
    return reply.code(res.ok ? 200 : res.status || 502).send(res);
  });

  // Docket lookup.
  app.get('/api/courtlistener/dockets/:id', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!(await guardAuth(user, reply))) return;
    const { id } = request.params as { id: string };
    const res = await docketById(id);
    return reply.code(res.ok ? 200 : res.status || 502).send(res);
  });

  // Citation analysis / lookup — resolve citations in free text to authorities.
  app.post('/api/courtlistener/citation-lookup', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!(await guardAuth(user, reply))) return;
    const body = (request.body ?? {}) as { text?: string };
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text) return reply.code(400).send({ error: 'text is required' });
    if (text.length > 5000) return reply.code(400).send({ error: 'text too long (max 5000 chars)' });
    const result = await analyzeCitations(text);
    // Surface the real upstream status (e.g. 401 = token required) instead of masking.
    return reply.code(result.ok ? 200 : (result.status && result.status >= 400 ? result.status : 502)).send(result);
  });
}
