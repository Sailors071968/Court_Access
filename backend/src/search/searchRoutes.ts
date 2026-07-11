// ============================================================================
// Program 115 — Unified Case Search API
//   GET /api/search?q=&types=&limit=            (tenant-wide, permission-scoped)
//   GET /api/cases/:caseId/search?q=&types=      (single case, access-guarded)
// Evidence-governed: results come only from real records the user may access.
// ============================================================================

import type { FastifyInstance, FastifyReply } from 'fastify';
import type { AuthenticatedRequest } from '../security/authMiddleware.js';
import { guardAuth, guardCaseAccess } from '../membership/resourceAuthMiddleware.js';
import { searchCaseData } from './searchService.js';
import type { SearchResultType } from './searchService.js';

const VALID_TYPES: SearchResultType[] = ['case', 'evidence', 'ocr_text', 'timeline_event', 'message'];

function parseTypes(raw: unknown): SearchResultType[] | undefined {
  if (typeof raw !== 'string' || !raw.trim()) return undefined;
  const parsed = raw
    .split(',')
    .map((t) => t.trim())
    .filter((t): t is SearchResultType => VALID_TYPES.includes(t as SearchResultType));
  return parsed.length ? parsed : undefined;
}

function parseLimit(raw: unknown): number | undefined {
  const n = typeof raw === 'string' ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) ? n : undefined;
}

export async function registerSearchRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/search', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!(await guardAuth(user, reply))) return;

    const q = request.query as Record<string, unknown>;
    const query = typeof q.q === 'string' ? q.q : '';

    const response = await searchCaseData(user!, query, {
      types: parseTypes(q.types),
      limit: parseLimit(q.limit),
    });
    return reply.send(response);
  });

  app.get('/api/cases/:caseId/search', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!(await guardAuth(user, reply))) return;

    const { caseId } = request.params as { caseId: string };
    if (!(await guardCaseAccess(user!, caseId, 'view', reply))) return;

    const q = request.query as Record<string, unknown>;
    const query = typeof q.q === 'string' ? q.q : '';

    const response = await searchCaseData(user!, query, {
      caseId,
      types: parseTypes(q.types),
      limit: parseLimit(q.limit),
    });
    return reply.send(response);
  });
}
