// ============================================================================
// Program 108 — Litigation Assistant API
//   POST /api/cases/:caseId/assistant   { question: string }
// Returns an AI Safety Envelope (Program 118): every answer is citation-backed
// or UNKNOWN; low/insufficient confidence flags human review.
// ============================================================================

import type { FastifyInstance, FastifyReply } from 'fastify';
import type { AuthenticatedRequest } from '../security/authMiddleware.js';
import { guardAuth, guardCaseAccess } from '../membership/resourceAuthMiddleware.js';
import { askLitigationAssistant } from './litigationAssistantService.js';

export async function registerLitigationAssistantRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/cases/:caseId/assistant', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!(await guardAuth(user, reply))) return;

    const { caseId } = request.params as { caseId: string };
    if (!(await guardCaseAccess(user!, caseId, 'view', reply))) return;

    const body = (request.body ?? {}) as { question?: unknown };
    const question = typeof body.question === 'string' ? body.question.trim() : '';
    if (!question) return reply.code(400).send({ error: 'question is required' });
    if (question.length > 500) return reply.code(400).send({ error: 'question too long (max 500 chars)' });

    const response = await askLitigationAssistant(user!, caseId, question);
    if (!response) return reply.code(404).send({ error: 'Case not found' });

    return reply.send(response);
  });
}
