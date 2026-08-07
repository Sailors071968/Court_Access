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
import { buildEvidenceCoverage, explain } from './evidenceCoverage.js';
import {
  LIFECYCLE_STAGES,
  STAGE_LABELS,
  STAGE_PLAIN_ENGLISH,
  caseEvolution,
  determineStage,
  recordStage,
  stageHistory,
} from './caseLifecycle.js';

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

  // -------------------------------------------------------------------------
  // Case lifecycle
  // -------------------------------------------------------------------------
  app.get('/api/cases/:caseId/stage', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!request.user) return reply.code(401).send({ error: 'Authentication required' });
    const { caseId } = request.params as { caseId: string };
    if (!(await caseInTenant(caseId, request.user.tenantId))) {
      return reply.code(404).send({ error: 'Not Found', message: 'No such case in this account.' });
    }

    const determination = await determineStage(caseId, request.user.tenantId);
    if (determination.source === 'inferred') {
      await recordStage({
        caseId,
        tenantId: request.user.tenantId,
        stage: determination.stage,
        basis: determination.basis,
        source: 'inferred',
      });
    }

    return reply.send({
      caseId,
      ...determination,
      stages: LIFECYCLE_STAGES.map((s) => ({ id: s, label: STAGE_LABELS[s] })),
      history: await stageHistory(caseId),
    });
  });

  app.put('/api/cases/:caseId/stage', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!request.user) return reply.code(401).send({ error: 'Authentication required' });
    if (!['admin', 'attorney', 'paralegal'].includes(request.user.role)) {
      return reply.code(403).send({
        error: 'Forbidden',
        message: 'Setting the stage of a case is limited to attorneys, paralegals and administrators.',
      });
    }
    const { caseId } = request.params as { caseId: string };
    if (!(await caseInTenant(caseId, request.user.tenantId))) {
      return reply.code(404).send({ error: 'Not Found', message: 'No such case in this account.' });
    }

    const body = (request.body ?? {}) as { stage?: string; basis?: string };
    if (!body.stage || !LIFECYCLE_STAGES.includes(body.stage as never)) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: `stage must be one of ${LIFECYCLE_STAGES.join(', ')}.`,
      });
    }

    await recordStage({
      caseId,
      tenantId: request.user.tenantId,
      stage: body.stage,
      basis: body.basis?.trim() || 'Set by counsel.',
      source: 'attorney',
      actorId: request.user.userId,
    });

    return reply.send({
      caseId,
      stage: body.stage,
      label: STAGE_LABELS[body.stage],
      plainEnglish: STAGE_PLAIN_ENGLISH[body.stage],
      source: 'attorney',
      message: 'Set. Inference will not override this.',
    });
  });

  // -------------------------------------------------------------------------
  // Case evolution — what changed, and what it changed
  // -------------------------------------------------------------------------
  app.get('/api/cases/:caseId/evolution', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!request.user) return reply.code(401).send({ error: 'Authentication required' });
    const { caseId } = request.params as { caseId: string };
    if (!(await caseInTenant(caseId, request.user.tenantId))) {
      return reply.code(404).send({ error: 'Not Found', message: 'No such case in this account.' });
    }
    const entries = await caseEvolution(caseId, request.user.tenantId);
    return reply.send({
      caseId,
      entries,
      note:
        'Every entry is a record that exists. Where a change had a consequence that cannot be established from ' +
        'the record, the consequence is left blank rather than asserted.',
    });
  });

  // -------------------------------------------------------------------------
  // Attorney war room — one screen
  // -------------------------------------------------------------------------
  app.get('/api/cases/:caseId/war-room', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!request.user) return reply.code(401).send({ error: 'Authentication required' });
    const { caseId } = request.params as { caseId: string };
    if (!(await caseInTenant(caseId, request.user.tenantId))) {
      return reply.code(404).send({ error: 'Not Found', message: 'No such case in this account.' });
    }

    const [stage, operative, themesResult, evolution, criminalCase] = await Promise.all([
      determineStage(caseId, request.user.tenantId),
      prisma.chargingDocument.findFirst({
        where: { caseId, status: 'filed' },
        orderBy: { filingSequence: 'desc' },
        include: { charges: { include: { defendants: true }, orderBy: { countNumber: 'asc' } } },
      }).catch(() => null),
      buildDefenseThemes(caseId, request.user.tenantId),
      caseEvolution(caseId, request.user.tenantId),
      prisma.criminalCase.findUnique({
        where: { caseId },
        select: { title: true, caseNumber: true, court: true, nextHearing: true, nextHearingNote: true },
      }),
    ]);

    const supported = themesResult.themes.filter((t) => t.status === 'supported');
    const motionIssues = supported.filter((t) => MOTION_THEME_IDS.has(t.id));

    // The most recent things to have happened, newest first.
    const recent = [...evolution].reverse().slice(0, 15);

    return reply.send({
      caseId,
      case: criminalCase,
      stage: {
        stage: stage.stage,
        label: stage.label,
        source: stage.source,
        basis: stage.basis,
      },
      charges: {
        operativeDocument: operative ? { name: operative.name, filedAt: operative.filedAt, kind: operative.kind } : null,
        counts: (operative?.charges ?? []).map((c) => ({
          countNumber: c.countNumber,
          citation: c.normalizedCitation,
          status: c.status,
          defendants: c.defendants.map((d) => ({ name: d.defendantName, status: d.status })),
        })),
        note: operative ? null : 'No charging document has been filed, so there are no charges to show.',
      },
      repositoryIssues: motionIssues.map((t) => ({
        id: t.id,
        topic: t.label,
        documentCount: t.documentCount,
        statement: 'This repository-backed issue may warrant attorney review.',
        firstPassage: t.citations[0] ?? null,
      })),
      defenceThemes: {
        supported: supported.length,
        examined: themesResult.themes.length,
        topThemes: supported.slice(0, 6).map((t) => ({ id: t.id, label: t.label, documentCount: t.documentCount })),
      },
      outstanding: {
        missingMaterial: [...new Set(supported.flatMap((t) => t.missing))].slice(0, 12),
      },
      recentActivity: recent,
      caveat:
        'Everything here is drawn from records in this case and links to them. Nothing on this screen states a ' +
        'conclusion about guilt, the merits of an issue, or how the case will end.',
    });
  });

  // -------------------------------------------------------------------------
  // Family view — plain English, no advice
  // -------------------------------------------------------------------------
  app.get('/api/cases/:caseId/family-view', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!request.user) return reply.code(401).send({ error: 'Authentication required' });
    const { caseId } = request.params as { caseId: string };
    if (!(await caseInTenant(caseId, request.user.tenantId))) {
      return reply.code(404).send({ error: 'Not Found', message: 'No such case in this account.' });
    }

    const [criminalCase, stage, operative, evidence, themesResult] = await Promise.all([
      prisma.criminalCase.findUnique({
        where: { caseId },
        select: { title: true, nextHearing: true, nextHearingNote: true },
      }),
      determineStage(caseId, request.user.tenantId),
      prisma.chargingDocument.findFirst({
        where: { caseId, status: 'filed' },
        orderBy: { filingSequence: 'desc' },
        include: { charges: { orderBy: { countNumber: 'asc' } } },
      }).catch(() => null),
      prisma.evidence.findMany({
        where: { caseId },
        select: { fileName: true, createdAt: true, processingStatus: true },
        orderBy: { createdAt: 'desc' },
        take: 6,
      }),
      buildDefenseThemes(caseId, request.user.tenantId),
    ]);

    // The charge in the People's own words, trimmed to the offence named,
    // rather than a paraphrase this platform invented.
    const charges = (operative?.charges ?? [])
      .filter((c) => c.status === 'active')
      .map((c) => {
        const named = c.verbatimText.match(/the crime of ([A-Z][A-Z ,'()-]{4,90})/);
        return {
          countNumber: c.countNumber,
          plainLanguage: named
            ? named[1].trim().toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase())
            : c.normalizedCitation,
          citation: c.normalizedCitation,
        };
      });

    // Questions come from what is missing on a theme the record actually
    // raised. Each one names what prompted it, so it is a real question about
    // this case rather than a generic checklist.
    const questions: Array<{ question: string; why: string; basedOn: string | null }> = [];
    for (const theme of themesResult.themes.filter((t) => t.status === 'supported')) {
      for (const missing of theme.missing.slice(0, 2)) {
        questions.push({
          question: `Has ${missing.charAt(0).toLowerCase()}${missing.slice(1)} been requested?`,
          why:
            `The case file mentions ${theme.label.toLowerCase()}, and this is something usually needed to look ` +
            'into that properly. It may already be in hand.',
          basedOn: theme.citations[0]?.fileName ?? null,
        });
      }
      if (questions.length >= 8) break;
    }

    const unreadable = evidence.filter((e) => e.processingStatus === 'failed');
    for (const u of unreadable.slice(0, 2)) {
      questions.push({
        question: `Is there a readable copy of ${u.fileName}?`,
        why: 'This file was added to the case but the system could not read what is inside it.',
        basedOn: u.fileName,
      });
    }

    return reply.send({
      caseTitle: criminalCase?.title ?? 'This case',
      stage: { label: stage.label, plainEnglish: stage.plainEnglish },
      charges,
      chargesNote:
        charges.length > 0
          ? null
          : 'No charges have been entered into the system for this case yet. That does not necessarily mean none ' +
            'have been filed in court — ask the attorney.',
      nextHearing: criminalCase?.nextHearing
        ? { date: criminalCase.nextHearing, note: criminalCase.nextHearingNote }
        : null,
      recentlyAdded: evidence.map((e) => ({
        fileName: e.fileName,
        addedAt: e.createdAt,
        readable: e.processingStatus === 'completed',
      })),
      questions: questions.slice(0, 8),
      caveat:
        'This page is a summary of what is in the case file. It is not legal advice, it does not say whether ' +
        'anyone is guilty or innocent, and it cannot tell you how the case will end. Only the attorney can ' +
        'advise you.',
    });
  });

  // -------------------------------------------------------------------------
  // Evidence coverage — the material beside each element
  // -------------------------------------------------------------------------
  app.get('/api/cases/:caseId/evidence-coverage', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!request.user) return reply.code(401).send({ error: 'Authentication required' });
    const { caseId } = request.params as { caseId: string };
    if (!(await caseInTenant(caseId, request.user.tenantId))) {
      return reply.code(404).send({ error: 'Not Found', message: 'No such case in this account.' });
    }
    return reply.send(await buildEvidenceCoverage(caseId, request.user.tenantId));
  });

  // -------------------------------------------------------------------------
  // Explain this
  // -------------------------------------------------------------------------
  app.get('/api/cases/:caseId/explain/:kind/:id', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!request.user) return reply.code(401).send({ error: 'Authentication required' });
    const { caseId, kind, id } = request.params as { caseId: string; kind: string; id: string };
    if (!(await caseInTenant(caseId, request.user.tenantId))) {
      return reply.code(404).send({ error: 'Not Found', message: 'No such case in this account.' });
    }
    if (kind !== 'count' && kind !== 'theme') {
      return reply.code(400).send({ error: 'Bad Request', message: 'kind must be count or theme.' });
    }

    const explanation = await explain({ caseId, tenantId: request.user.tenantId, kind, id });
    if (!explanation) {
      return reply.code(404).send({
        error: 'Nothing to explain',
        message: `No ${kind} with that identifier is being shown for this case.`,
      });
    }
    return reply.send(explanation);
  });

  // -------------------------------------------------------------------------
  // Repository completeness
  // -------------------------------------------------------------------------
  app.get('/api/repositories/completeness', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!request.user) return reply.code(401).send({ error: 'Authentication required' });

    const [statutes, current, superseded, syncEvents, changes, corpora] = await Promise.all([
      prisma.officialStatute.count(),
      prisma.officialStatute.count({ where: { supersededAt: null } }),
      prisma.officialStatute.count({ where: { supersededAt: { not: null } } }),
      prisma.legislativeSyncEvent.count(),
      prisma.legislativeSyncEvent.count({ where: { outcome: { in: ['amended', 'repealed', 'disappeared'] } } }),
      prisma.certificationCase.count(),
    ]);

    const lastSync = await prisma.legislativeSyncEvent.findFirst({ orderBy: { detectedAt: 'desc' } });

    return reply.send({
      repositories: [
        {
          name: 'Official California law',
          source: 'https://leginfo.legislature.ca.gov/',
          coverage: `${current} section(s) retrieved and cached across the 29 California codes`,
          unknownItems: 'Any section not yet requested. Retrieval is on demand, so coverage grows with use.',
          missingSources: [],
          version: 'compiler 1.0.0, extraction 1.0.0',
          fingerprinted: true,
          synchronization: lastSync
            ? `Last checked ${lastSync.detectedAt.toISOString()}; ${changes} legislative change(s) detected across ${syncEvents} check(s).`
            : 'Never synchronised.',
          supersededVersions: superseded,
          totalVersions: statutes,
        },
        {
          name: 'CALCRIM correspondence',
          source: 'Judicial Council of California, verified by hand',
          coverage: '7 verified instruction correspondences',
          unknownItems:
            'Every charged section outside those 7 returns UNKNOWN. The Judicial Council does not publish the ' +
            'instructions in machine-readable form, so this grows by verification rather than retrieval.',
          missingSources: ['A machine-readable CALCRIM corpus'],
          version: 'hand-verified list',
          fingerprinted: false,
          synchronization: 'Not synchronised: there is no feed to synchronise against.',
          supersededVersions: 0,
          totalVersions: 7,
        },
        {
          name: 'Gold Standard corpora',
          source: 'Discovery uploaded through the certification portal',
          coverage: `${corpora} corpus/corpora imported`,
          unknownItems: 'No attorney-authorized case has been imported; all corpora are synthetic fixtures.',
          missingSources: ['Case 001', 'Case 002', 'Case 003'],
          version: 'per-corpus fingerprint',
          fingerprinted: true,
          synchronization: 'Not applicable: a corpus is fixed once imported.',
          supersededVersions: 0,
          totalVersions: corpora,
        },
      ],
      caveat:
        'Coverage is reported as what has been retrieved, not as a proportion of what exists. Where a proportion ' +
        'is not known it is described rather than given a number.',
    });
  });

  console.log('[Server] Case lifecycle, evolution and war room registered');
  console.log('[Server] Defence strategy, motion issues and action centre registered');
}
