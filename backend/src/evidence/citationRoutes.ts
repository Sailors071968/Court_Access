// ============================================================================
// Citation resolution.
//
// A finding is only useful to a defence team if it can be taken back to the
// page and line it came from. Extraction records where each page begins in the
// indexed text; these routes turn a character offset, or a quoted passage,
// into "page N, line M" together with the line itself so the citation can be
// checked against the original document.
// ============================================================================

import type { FastifyInstance, FastifyReply } from 'fastify';
import type { AuthenticatedRequest } from '../security/authMiddleware.js';
import { guardCaseAccess } from '../membership/resourceAuthMiddleware.js';
import prisma from '../lib/prisma.js';
import { citeQuote, resolveCitation, type Citation, type PageSpan } from './fileDiagnostics.js';

/** Reassemble the indexed text of a document from its chunks. */
async function indexedText(evidenceId: string): Promise<string> {
  const chunks = await prisma.evidenceChunk.findMany({
    where: { evidenceId },
    orderBy: { chunkIndex: 'asc' },
    select: { text: true },
  });
  return chunks.map((c) => c.text).join('');
}

async function loadEvidenceForCaller(
  request: AuthenticatedRequest,
  reply: FastifyReply,
  evidenceId: string,
) {
  const user = request.user;
  if (!user) {
    await reply.code(401).send({ error: 'Authentication required' });
    return null;
  }

  const evidence = await prisma.evidence.findFirst({
    where: { evidenceId, tenantId: user.tenantId },
    select: { evidenceId: true, caseId: true, fileName: true, pageMap: true, evidenceType: true },
  });
  if (!evidence) {
    await reply.code(404).send({
      error: 'Not Found',
      message: 'No such document exists in this account.',
    });
    return null;
  }

  if (!(await guardCaseAccess(user, evidence.caseId, 'view', reply))) return null;
  return evidence;
}

function pageMapOf(evidence: { pageMap: unknown }): PageSpan[] {
  return Array.isArray(evidence.pageMap) ? (evidence.pageMap as PageSpan[]) : [];
}

function noPageMap(fileName: string) {
  return {
    error: 'Citation unavailable',
    message:
      `Page boundaries were not recorded for "${fileName}", so a page and line cannot be given. ` +
      'Page positions are captured for PDFs at ingestion; documents ingested before that, ' +
      'and formats that carry no page structure such as plain text, resolve to a character ' +
      'offset only. Re-upload the document to record its pages.',
  };
}

export async function registerCitationRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/evidence/:evidenceId/pages — the page index for a document
  app.get('/api/evidence/:evidenceId/pages', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const { evidenceId } = request.params as { evidenceId: string };
    const evidence = await loadEvidenceForCaller(request, reply, evidenceId);
    if (!evidence) return;

    const pageMap = pageMapOf(evidence);
    if (pageMap.length === 0) return reply.code(409).send(noPageMap(evidence.fileName));

    return reply.send({
      evidenceId,
      fileName: evidence.fileName,
      pageCount: pageMap.length,
      pages: pageMap,
    });
  });

  // GET /api/evidence/:evidenceId/citation?offset=N | ?quote=...
  app.get('/api/evidence/:evidenceId/citation', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const { evidenceId } = request.params as { evidenceId: string };
    const query = request.query as { offset?: string; quote?: string };

    const evidence = await loadEvidenceForCaller(request, reply, evidenceId);
    if (!evidence) return;

    if (query.offset === undefined && !query.quote) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'Provide either offset (a character position) or quote (a passage to locate).',
      });
    }

    const pageMap = pageMapOf(evidence);
    if (pageMap.length === 0) return reply.code(409).send(noPageMap(evidence.fileName));

    const text = await indexedText(evidenceId);
    if (text.length === 0) {
      return reply.code(409).send({
        error: 'Citation unavailable',
        message: `No indexed text is held for "${evidence.fileName}", so nothing can be cited from it.`,
      });
    }

    let citation: Citation | null;
    if (query.quote) {
      citation = citeQuote(text, pageMap, query.quote);
      if (!citation) {
        return reply.code(404).send({
          error: 'Quote not found',
          message:
            `That passage does not appear in "${evidence.fileName}". ` +
            'A citation is only issued for text actually present in the document.',
        });
      }
    } else {
      const offset = parseInt(query.offset as string, 10);
      if (!Number.isFinite(offset)) {
        return reply.code(400).send({ error: 'Bad Request', message: 'offset must be a number.' });
      }
      citation = resolveCitation(text, pageMap, offset);
      if (!citation) {
        return reply.code(404).send({
          error: 'Offset out of range',
          message: `Offset ${offset} lies outside the indexed text of "${evidence.fileName}" (${text.length} characters).`,
        });
      }
    }

    return reply.send({
      evidenceId,
      caseId: evidence.caseId,
      fileName: evidence.fileName,
      evidenceType: evidence.evidenceType,
      citation,
      // The exact string a brief would carry.
      formatted: `${evidence.fileName}, p. ${citation.page}, l. ${citation.line}`,
    });
  });

  console.log('[Server] Citation routes registered: GET /api/evidence/:evidenceId/pages, /citation');
}
