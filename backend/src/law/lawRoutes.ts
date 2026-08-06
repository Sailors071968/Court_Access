// ============================================================================
// Statutory intelligence API.
//
// Reading the law is available to any authenticated user, because every
// analysis depends on it. Forcing a refresh, running a synchronisation pass
// and rebuilding the cache reach out to a public service on the Legislature's
// infrastructure, so those are administrator-only.
// ============================================================================

import type { FastifyInstance, FastifyReply } from 'fastify';
import type { AuthenticatedRequest } from '../security/authMiddleware.js';
import prisma from '../lib/prisma.js';
import { CALIFORNIA_CODES } from './officialLawSource.js';
import {
  buildStatutoryContext,
  cacheStatistics,
  getCaseSnapshot,
  getStatute,
  pinContextToCase,
  synchronize,
} from './lawService.js';
import { mapToCalcrim, mappingCoverage } from './calcrimMapping.js';

function requireAdministrator(request: AuthenticatedRequest, reply: FastifyReply): boolean {
  if (!request.user) {
    void reply.code(401).send({ error: 'Authentication required' });
    return false;
  }
  if (request.user.role !== 'admin') {
    void reply.code(403).send({
      error: 'Forbidden',
      message: 'Retrieving law from the official source on demand is restricted to administrators.',
    });
    return false;
  }
  return true;
}

export async function registerLawRoutes(app: FastifyInstance): Promise<void> {
  // -------------------------------------------------------------------------
  // One section, compiled
  // -------------------------------------------------------------------------
  app.get('/api/law/statute/:code/:section', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!request.user) return reply.code(401).send({ error: 'Authentication required' });

    const { code, section } = request.params as { code: string; section: string };
    const query = request.query as { refresh?: string };

    // Only an administrator may force a fresh read of the official source.
    const forceRefresh = query.refresh === 'true' && request.user.role === 'admin';

    const record = await getStatute(code, section, { forceRefresh });

    if (!record.text) {
      return reply.code(404).send({
        error: 'Statute unavailable',
        message: record.unavailableReason,
        code: record.code,
        section: record.section,
        officialUrl: record.officialUrl,
        status: record.status,
      });
    }

    return reply.send({ statute: record });
  });

  // -------------------------------------------------------------------------
  // CALCRIM correspondence for a charged section
  // -------------------------------------------------------------------------
  app.get('/api/law/calcrim/:code/:section', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!request.user) return reply.code(401).send({ error: 'Authentication required' });

    const { code, section } = request.params as { code: string; section: string };
    const record = await getStatute(code, section);

    if (!record.text) {
      return reply.code(404).send({
        error: 'Statute unavailable',
        message: record.unavailableReason,
        officialUrl: record.officialUrl,
      });
    }

    return reply.send({
      calcrim: mapToCalcrim(code, section, record.compilation),
      statute: {
        code: record.code,
        section: record.section,
        officialUrl: record.officialUrl,
        fingerprint: record.fingerprint,
        legislativeNote: record.legislativeNote,
        retrievedAt: record.retrievedAt,
      },
    });
  });

  // -------------------------------------------------------------------------
  // The statutory context for a set of charges
  // -------------------------------------------------------------------------
  app.post('/api/law/context', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!request.user) return reply.code(401).send({ error: 'Authentication required' });

    const body = (request.body ?? {}) as {
      charges?: Array<{ code?: string; section?: string }>;
      caseId?: string;
      maxDepth?: number;
    };

    const charges = (body.charges ?? [])
      .filter((c) => c.code && c.section)
      .map((c) => ({ code: c.code!, section: c.section! }));

    if (charges.length === 0) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'At least one charge is needed, each with a code and a section.',
      });
    }

    const context = await buildStatutoryContext(charges, {
      maxDepth: Math.min(body.maxDepth ?? 2, 3),
    });

    // Pin the context to the case so the analysis can be reproduced later.
    let pinned = 0;
    if (body.caseId) {
      const owned = await prisma.criminalCase.findFirst({
        where: { caseId: body.caseId, tenantId: request.user.tenantId },
        select: { caseId: true },
      });
      if (!owned) {
        return reply.code(404).send({ error: 'Not Found', message: 'No such case in this account.' });
      }
      pinned = await pinContextToCase(body.caseId, context);
    }

    return reply.send({
      charged: context.charged,
      nodes: context.nodes.map((n) => ({
        code: n.code,
        section: n.section,
        relationship: n.relationship,
        depth: n.depth,
        reachedVia: n.reachedVia,
        officialUrl: n.record.officialUrl,
        fingerprint: n.record.fingerprint,
        legislativeNote: n.record.legislativeNote,
        status: n.record.status,
        kind: n.record.compilation?.kind ?? 'unknown',
        mentalStates: n.record.compilation?.mentalStates ?? [],
        definedTerms: n.record.compilation?.definedTerms ?? [],
        unknowns: n.record.compilation?.unknowns ?? [],
        source: n.record.source,
      })),
      unresolved: context.unresolved,
      retrievedFromOfficialSource: context.retrievedCount,
      servedFromCache: context.cacheHits,
      pinnedToCase: pinned,
    });
  });

  // -------------------------------------------------------------------------
  // The law a case was analysed against
  // -------------------------------------------------------------------------
  app.get('/api/law/case/:caseId/snapshot', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!request.user) return reply.code(401).send({ error: 'Authentication required' });

    const { caseId } = request.params as { caseId: string };
    const owned = await prisma.criminalCase.findFirst({
      where: { caseId, tenantId: request.user.tenantId },
      select: { caseId: true },
    });
    if (!owned) return reply.code(404).send({ error: 'Not Found', message: 'No such case in this account.' });

    const snapshot = await getCaseSnapshot(caseId);
    const amendedSince = snapshot.filter((s) => s.supersededAt !== null);

    return reply.send({
      caseId,
      statutes: snapshot,
      /** Sections the Legislature has changed since this case was analysed. */
      amendedSinceAnalysis: amendedSince.map((s) => ({
        code: s.code,
        section: s.section,
        pinnedAt: s.pinnedAt,
        message:
          `${s.code} ${s.section} has been amended since this case was analysed. The analysis remains reproducible ` +
          'against the pinned version; reanalysing under current law is a separate decision.',
      })),
    });
  });

  // -------------------------------------------------------------------------
  // Reporting
  // -------------------------------------------------------------------------
  app.get('/api/law/status', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!request.user) return reply.code(401).send({ error: 'Authentication required' });

    const stats = await cacheStatistics();
    const recent = await prisma.legislativeSyncEvent.findMany({
      orderBy: { detectedAt: 'desc' },
      take: 20,
    });

    return reply.send({
      officialSource: 'https://leginfo.legislature.ca.gov/',
      codesAvailable: Object.keys(CALIFORNIA_CODES).length,
      codes: CALIFORNIA_CODES,
      cache: stats,
      calcrim: mappingCoverage(),
      recentSyncEvents: recent,
    });
  });

  // -------------------------------------------------------------------------
  // Synchronisation — administrator only
  // -------------------------------------------------------------------------
  app.post('/api/law/synchronize', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;

    const body = (request.body ?? {}) as { limit?: number; codes?: string[] };
    const result = await synchronize({ limit: Math.min(body.limit ?? 25, 100), codes: body.codes });

    const changed = result.outcomes.filter((o) => o.outcome !== 'unchanged');
    return reply.send({
      checked: result.checked,
      unchanged: result.outcomes.length - changed.length,
      changed: changed.length,
      outcomes: result.outcomes,
    });
  });

  console.log('[Server] Official California law engine registered: /api/law/*');
}
