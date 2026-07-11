// ============================================================================
// Legal Intelligence Provider API — registry, health dashboard, federated
// capability search. Auth-guarded. The registry is the single source of truth.
// ============================================================================

import type { FastifyInstance, FastifyReply } from 'fastify';
import type { AuthenticatedRequest } from '../security/authMiddleware.js';
import { guardAuth } from '../membership/resourceAuthMiddleware.js';
import { providerRegistry } from './registry.js';
import { registerAllProviders } from './index.js';
import type { SearchParams } from './types.js';

const SEARCH_CAPS = ['searchAuthorities', 'searchOpinions', 'searchStatutes', 'searchRegulations', 'searchDockets', 'searchRules', 'searchForms', 'searchJuryInstructions'] as const;

export async function registerProviderRoutes(app: FastifyInstance): Promise<void> {
  registerAllProviders();

  // Provider Registry (single source of truth).
  app.get('/api/providers', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!(await guardAuth(user, reply))) return;
    return reply.send(providerRegistry.snapshot());
  });

  // Provider Health Dashboard (Phase 14).
  app.get('/api/providers/health', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!(await guardAuth(user, reply))) return;
    const health = await providerRegistry.healthAll();
    const score = health.length ? Math.round((health.filter((h) => h.status === 'online').length / health.length) * 100) : 0;
    return reply.send({ checkedAt: new Date().toISOString(), healthScore: score, providers: health });
  });

  // Single provider metadata + health.
  app.get('/api/providers/:id', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!(await guardAuth(user, reply))) return;
    const { id } = request.params as { id: string };
    const p = providerRegistry.get(id);
    if (!p) return reply.code(404).send({ error: 'Provider not found' });
    return reply.send({
      id: p.id, name: p.name, description: p.description, documentationUrl: p.documentationUrl,
      version: p.version(), capabilities: p.capabilities(), coverage: p.coverage(),
      authentication: p.authentication(), rateLimits: p.rateLimits(), health: await p.health(),
    });
  });

  // Federated capability search across all providers that support it (Phase 16).
  app.get('/api/providers/search/:capability', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!(await guardAuth(user, reply))) return;
    const { capability } = request.params as { capability: string };
    if (!(SEARCH_CAPS as readonly string[]).includes(capability)) {
      return reply.code(400).send({ error: `capability must be one of ${SEARCH_CAPS.join(', ')}` });
    }
    const q = request.query as Record<string, string>;
    const query = (q.q ?? '').trim();
    if (!query) return reply.code(400).send({ error: 'q is required' });
    const params: SearchParams = { q: query, jurisdiction: q.jurisdiction, court: q.court, pageSize: Math.min(parseInt(q.page_size ?? '10', 10) || 10, 50) };
    const result = await providerRegistry.federatedSearch(capability as typeof SEARCH_CAPS[number], params);
    return reply.send(result);
  });
}
