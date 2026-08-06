// ============================================================================
// Defence strategy, motion issues and the action centre.
//
// Everything served here is organised from what is in the record. None of it
// states a conclusion: no dashboard tells anyone that a defence is available,
// that a motion should be filed, or how a case will end.
// ============================================================================

import type { FastifyInstance, FastifyReply } from 'fastify';
import type { AuthenticatedRequest } from '../security/authMiddleware.js';
import prisma from '../lib/prisma.js';
import { buildDefenseThemes, DEFENSE_THEMES } from './defenseThemes.js';
import { buildActionCentre } from './actionCenter.js';

async function caseInTenant(caseId: string, tenantId: string): Promise<boolean> {
  const found = await prisma.criminalCase.findFirst({ where: { caseId, tenantId }, select: { caseId: true } });
  return found !== null;
}

/**
 * Motion topics are the procedural and constitutional themes, presented as
 * issues that may warrant review. The wording matters: this platform organises
 * issues, it does not advise anyone to file anything.
 */
const MOTION_THEME_IDS = new Set([
  'fourth_amendment',
  'miranda',
  'voluntariness',
  'fifth_amendment',
  'sixth_amendment',
  'pitchess',
  'brady',
  'discovery',
  'chain_of_custody',
  'forensic_reliability',
  'expert_reliability',
  'identity',
  'mistaken_identification',
]);

export async function registerStrategyRoutes(app: FastifyInstance): Promise<void> {
  // -------------------------------------------------------------------------
  // Defence strategy workspace
  // -------------------------------------------------------------------------
  app.get('/api/cases/:caseId/defense-themes', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!request.user) return reply.code(401).send({ error: 'Authentication required' });
    const { caseId } = request.params as { caseId: string };
    if (!(await caseInTenant(caseId, request.user.tenantId))) {
      return reply.code(404).send({ error: 'Not Found', message: 'No such case in this account.' });
    }

    const result = await buildDefenseThemes(caseId, request.user.tenantId);

    if (result.documentsExamined === 0) {
      return reply.send({
        ...result,
        message:
          'No evidence has been processed for this case yet, so there is nothing to organise. Every theme is ' +
          'reported as unsupported because the record is empty, not because the themes were considered and rejected.',
      });
    }

    return reply.send(result);
  });

  // -------------------------------------------------------------------------
  // Motion intelligence — issues for review, never advice
  // -------------------------------------------------------------------------
  app.get('/api/cases/:caseId/motion-issues', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!request.user) return reply.code(401).send({ error: 'Authentication required' });
    const { caseId } = request.params as { caseId: string };
    if (!(await caseInTenant(caseId, request.user.tenantId))) {
      return reply.code(404).send({ error: 'Not Found', message: 'No such case in this account.' });
    }

    const { themes, documentsExamined, charges } = await buildDefenseThemes(caseId, request.user.tenantId);

    const issues = themes
      .filter((t) => MOTION_THEME_IDS.has(t.id) && t.status === 'supported')
      .map((t) => ({
        id: t.id,
        topic: t.label,
        group: t.group,
        // The phrasing the constitution requires, everywhere.
        statement: `This repository-backed issue may warrant attorney review.`,
        whyItAppears:
          `${t.documentCount} document(s) in this case contain language bearing on ${t.label.toLowerCase()}. ` +
          'It appears for that reason alone.',
        supportingEvidence: t.citations,
        missingEvidence: t.missing,
        openQuestions: t.openQuestions,
        authorities: t.authorities,
        reviewStatus: 'not_reviewed',
      }));

    const notRaised = themes
      .filter((t) => MOTION_THEME_IDS.has(t.id) && t.status === 'unsupported')
      .map((t) => ({ topic: t.label, reason: t.basis }));

    return reply.send({
      caseId,
      documentsExamined,
      charges,
      issues,
      notRaised,
      caveat:
        'These are issues the record touches, organised for review. CourtAccess does not recommend filing any ' +
        'motion, does not assess the merits of one, and does not predict how a court would rule.',
    });
  });

  // -------------------------------------------------------------------------
  // Action centre
  // -------------------------------------------------------------------------
  app.get('/api/action-center', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!request.user) return reply.code(401).send({ error: 'Authentication required' });
    return reply.send(
      await buildActionCentre({
        userId: request.user.userId,
        tenantId: request.user.tenantId,
        role: request.user.role,
      }),
    );
  });

  // -------------------------------------------------------------------------
  // Executive dashboard — counted, never estimated
  // -------------------------------------------------------------------------
  app.get('/api/cases/:caseId/executive-summary', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!request.user) return reply.code(401).send({ error: 'Authentication required' });
    const { caseId } = request.params as { caseId: string };
    if (!(await caseInTenant(caseId, request.user.tenantId))) {
      return reply.code(404).send({ error: 'Not Found', message: 'No such case in this account.' });
    }

    const [criminalCase, evidence, operative, timelineEvents, witnesses] = await Promise.all([
      prisma.criminalCase.findUnique({
        where: { caseId },
        select: { title: true, caseNumber: true, status: true, phase: true, nextHearing: true, court: true },
      }),
      prisma.evidence.findMany({
        where: { caseId },
        select: { evidenceId: true, evidenceType: true, processingStatus: true, mimeType: true },
      }),
      prisma.chargingDocument.findFirst({
        where: { caseId, status: 'filed' },
        orderBy: { filingSequence: 'desc' },
        include: { charges: { include: { defendants: true } } },
      }),
      prisma.timelineEvent.count({ where: { caseId } }).catch(() => 0),
      prisma.caseWitness.count({ where: { caseId } }).catch(() => 0),
    ]);

    const media = (pattern: RegExp) => evidence.filter((e) => pattern.test(e.mimeType ?? '')).length;

    const { themes } = await buildDefenseThemes(caseId, request.user.tenantId);
    const supportedThemes = themes.filter((t) => t.status === 'supported');

    return reply.send({
      caseId,
      case: criminalCase,
      charges: {
        operativeDocument: operative ? { name: operative.name, filedAt: operative.filedAt } : null,
        activeCounts: operative?.charges.filter((c) => c.status === 'active').length ?? 0,
        dismissedCounts: operative?.charges.filter((c) => c.status === 'dismissed').length ?? 0,
        defendants: [...new Set((operative?.charges ?? []).flatMap((c) => c.defendants.map((d) => d.defendantName)))],
        // Said plainly rather than shown as a zero that looks like an answer.
        note: operative ? null : 'No charging document has been filed, so there are no charges to report.',
      },
      evidence: {
        total: evidence.length,
        processed: evidence.filter((e) => e.processingStatus === 'completed').length,
        failed: evidence.filter((e) => e.processingStatus === 'failed').length,
        pending: evidence.filter((e) => ['pending', 'processing', 'queued'].includes(e.processingStatus)).length,
        documents: media(/pdf|word|text|officedocument/i),
        videos: media(/^video\//i),
        audio: media(/^audio\//i),
        photographs: media(/^image\//i),
      },
      repository: {
        timelineEvents,
        witnesses,
        themesSupported: supportedThemes.length,
        themesExamined: themes.length,
      },
      unknowns: themes.filter((t) => t.status === 'unsupported').length,
      caveat:
        'Every figure here is a count of records that exist. Where something has not been produced or processed ' +
        'the count is zero and says so; nothing is estimated.',
    });
  });

  // The catalogue of themes, so a client can render them without inventing any.
  app.get('/api/defense-themes/catalogue', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!request.user) return reply.code(401).send({ error: 'Authentication required' });
    return reply.send({
      themes: DEFENSE_THEMES.map((t) => ({ id: t.id, label: t.label, group: t.group })),
      groups: [...new Set(DEFENSE_THEMES.map((t) => t.group))],
    });
  });

  console.log('[Server] Defence strategy, motion issues and action centre registered');
}
