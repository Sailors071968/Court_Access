// ============================================================================
// Charging document API.
//
// Reading the charges is open to anyone with access to the case, including a
// defendant reading what they are accused of. Filing a document changes what
// the case is about and what every analysis is built on, so that is limited to
// the roles who are accountable for it.
// ============================================================================

import type { FastifyInstance, FastifyReply } from 'fastify';
import type { AuthenticatedRequest } from '../security/authMiddleware.js';
import prisma from '../lib/prisma.js';
import { CALIFORNIA_CODES } from '../law/officialLawSource.js';
import {
  allegationSummary,
  audit,
  auditTrail,
  duplicateFiling,
  editCharge,
  finalizeDraft,
  type Actor,
} from './chargeLifecycle.js';
import { parseComplaint } from './complaintParser.js';
import { addCountToDocument } from './chargingService.js';
import {
  CHARGING_DOCUMENT_KINDS,
  chargingTimeline,
  compareDocuments,
  fileChargingDocument,
  getChargingDocument,
  getChargingHistory,
  getOperativeDocument,
  syncOperativeCharges,
  type ChargeInput,
  type ChargingDocumentKind,
} from './chargingService.js';

/** Roles that may change what a defendant is accused of. */
const FILING_ROLES = new Set(['admin', 'attorney', 'paralegal']);

async function caseInTenant(caseId: string, tenantId: string): Promise<boolean> {
  const found = await prisma.criminalCase.findFirst({ where: { caseId, tenantId }, select: { caseId: true } });
  return found !== null;
}

export async function registerChargingRoutes(app: FastifyInstance): Promise<void> {
  // -------------------------------------------------------------------------
  // The California codes, for the selector
  // -------------------------------------------------------------------------
  app.get('/api/charging/codes', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!request.user) return reply.code(401).send({ error: 'Authentication required' });
    return reply.send({
      codes: Object.entries(CALIFORNIA_CODES)
        .map(([abbreviation, name]) => ({ abbreviation, name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      documentKinds: CHARGING_DOCUMENT_KINDS,
    });
  });

  // -------------------------------------------------------------------------
  // What the defendant faces now
  // -------------------------------------------------------------------------
  app.get('/api/cases/:caseId/charges/current', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!request.user) return reply.code(401).send({ error: 'Authentication required' });
    const { caseId } = request.params as { caseId: string };
    if (!(await caseInTenant(caseId, request.user.tenantId))) {
      return reply.code(404).send({ error: 'Not Found', message: 'No such case in this account.' });
    }

    const operative = await getOperativeDocument(caseId);
    if (!operative) {
      return reply.send({
        caseId,
        operativeDocument: null,
        charges: [],
        message: 'No charging document has been filed for this case yet.',
      });
    }

    return reply.send({
      caseId,
      operativeDocument: {
        chargingDocumentId: operative.chargingDocumentId,
        kind: operative.kind,
        name: operative.name,
        filedAt: operative.filedAt,
        court: operative.court,
        courtCaseNumber: operative.courtCaseNumber,
        filingSequence: operative.filingSequence,
        citation: operative.citation,
      },
      charges: operative.charges.map((c) => ({
        filedChargeId: c.filedChargeId,
        countNumber: c.countNumber,
        code: c.code,
        section: c.section,
        subdivision: c.subdivision,
        normalizedCitation: c.normalizedCitation,
        verbatimText: c.verbatimText,
        status: c.status,
        enhancements: c.enhancements ?? [],
        officialStatuteId: c.officialStatuteId,
        statuteNote: c.statuteNote,
        defendants: c.defendants.map((d) => ({ name: d.defendantName, status: d.status, note: d.note })),
      })),
      activeCounts: operative.charges.filter((c) => c.status === 'active').length,
      dismissedCounts: operative.charges.filter((c) => c.status === 'dismissed').length,
    });
  });

  // -------------------------------------------------------------------------
  // Everything ever filed, and what each filing changed
  // -------------------------------------------------------------------------
  app.get('/api/cases/:caseId/charges/timeline', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!request.user) return reply.code(401).send({ error: 'Authentication required' });
    const { caseId } = request.params as { caseId: string };
    if (!(await caseInTenant(caseId, request.user.tenantId))) {
      return reply.code(404).send({ error: 'Not Found', message: 'No such case in this account.' });
    }
    return reply.send({ caseId, timeline: await chargingTimeline(caseId) });
  });

  app.get('/api/cases/:caseId/charges/history', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!request.user) return reply.code(401).send({ error: 'Authentication required' });
    const { caseId } = request.params as { caseId: string };
    if (!(await caseInTenant(caseId, request.user.tenantId))) {
      return reply.code(404).send({ error: 'Not Found', message: 'No such case in this account.' });
    }
    return reply.send({ caseId, documents: await getChargingHistory(caseId) });
  });

  // -------------------------------------------------------------------------
  // Compare any two filings
  // -------------------------------------------------------------------------
  app.get('/api/cases/:caseId/charges/compare', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!request.user) return reply.code(401).send({ error: 'Authentication required' });
    const { caseId } = request.params as { caseId: string };
    const { from, to } = request.query as { from?: string; to?: string };

    if (!(await caseInTenant(caseId, request.user.tenantId))) {
      return reply.code(404).send({ error: 'Not Found', message: 'No such case in this account.' });
    }
    if (!from || !to) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'Two charging documents are needed: from and to.',
      });
    }

    const [a, b] = await Promise.all([getChargingDocument(from), getChargingDocument(to)]);
    if (!a || !b || a.caseId !== caseId || b.caseId !== caseId) {
      return reply.code(404).send({ error: 'Not Found', message: 'One of those documents is not in this case.' });
    }

    return reply.send({
      from: { chargingDocumentId: a.chargingDocumentId, name: a.name, filedAt: a.filedAt },
      to: { chargingDocumentId: b.chargingDocumentId, name: b.name, filedAt: b.filedAt },
      changes: compareDocuments(
        { name: a.name, charges: a.charges as never },
        { name: b.name, charges: b.charges as never },
      ),
    });
  });

  // -------------------------------------------------------------------------
  // File a charging document
  // -------------------------------------------------------------------------
  app.post('/api/cases/:caseId/charges/documents', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!request.user) return reply.code(401).send({ error: 'Authentication required' });

    if (!FILING_ROLES.has(request.user.role)) {
      return reply.code(403).send({
        error: 'Forbidden',
        message:
          'Filing a charging document changes what the case is about and what every analysis is built on. ' +
          'It is limited to attorneys, paralegals and administrators.',
      });
    }

    const { caseId } = request.params as { caseId: string };
    if (!(await caseInTenant(caseId, request.user.tenantId))) {
      return reply.code(404).send({ error: 'Not Found', message: 'No such case in this account.' });
    }

    const body = (request.body ?? {}) as {
      kind?: string;
      name?: string;
      filedAt?: string;
      court?: string;
      courtCaseNumber?: string;
      citation?: string;
      sourceEvidenceId?: string;
      notes?: string;
      charges?: ChargeInput[];
    };

    if (!body.kind || !CHARGING_DOCUMENT_KINDS.includes(body.kind as ChargingDocumentKind)) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: `kind must be one of ${CHARGING_DOCUMENT_KINDS.join(', ')}.`,
      });
    }
    if (!body.name || !body.filedAt) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'A charging document needs a name and the date it was filed.',
      });
    }

    const filedAt = new Date(body.filedAt);
    if (Number.isNaN(filedAt.getTime())) {
      return reply.code(400).send({ error: 'Bad Request', message: 'filedAt is not a date.' });
    }

    const charges = body.charges ?? [];
    for (const c of charges) {
      if (!c.code || !c.section || !c.verbatimText || typeof c.countNumber !== 'number') {
        return reply.code(400).send({
          error: 'Bad Request',
          message:
            'Every count needs a count number, a code, a section, and the wording exactly as it appears in ' +
            'the document. The wording is stored verbatim and is never paraphrased.',
        });
      }
      if (!CALIFORNIA_CODES[c.code.toUpperCase()]) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: `"${c.code}" is not a California code. Choose one of ${Object.keys(CALIFORNIA_CODES).join(', ')}.`,
        });
      }
    }

    const document = await fileChargingDocument({
      caseId,
      tenantId: request.user.tenantId,
      uploadedById: request.user.userId,
      kind: body.kind as ChargingDocumentKind,
      name: body.name,
      filedAt,
      court: body.court,
      courtCaseNumber: body.courtCaseNumber,
      citation: body.citation,
      sourceEvidenceId: body.sourceEvidenceId,
      notes: body.notes,
      charges,
    });

    // The operative charges have moved, so the analysis inputs move with them.
    const synced = await syncOperativeCharges(caseId);

    return reply.code(201).send({
      document,
      operativeChargesSynchronised: synced.synced,
      message:
        'Filed. This document is now operative; earlier filings are marked superseded and kept in full. ' +
        'Analyses built on the charges will use the counts in this document.',
    });
  });

  // -------------------------------------------------------------------------
  // Amend a count's status. Nothing is ever removed.
  // -------------------------------------------------------------------------
  app.patch('/api/charging/counts/:filedChargeId', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!request.user) return reply.code(401).send({ error: 'Authentication required' });
    if (!FILING_ROLES.has(request.user.role)) {
      return reply.code(403).send({
        error: 'Forbidden',
        message: 'Changing a charge is limited to attorneys, paralegals and administrators.',
      });
    }

    const { filedChargeId } = request.params as { filedChargeId: string };
    const body = (request.body ?? {}) as { status?: string; note?: string };

    const charge = await prisma.filedCharge.findUnique({
      where: { filedChargeId },
      include: { chargingDocument: { select: { tenantId: true, caseId: true } } },
    });
    if (!charge || charge.chargingDocument.tenantId !== request.user.tenantId) {
      return reply.code(404).send({ error: 'Not Found', message: 'No such charge in this account.' });
    }

    if (body.status && !['active', 'dismissed', 'superseded'].includes(body.status)) {
      return reply.code(400).send({
        error: 'Bad Request',
        message:
          'A charge may be active, dismissed or superseded. It is never deleted: the history of what the ' +
          'People charged is the basis of every motion already filed against it.',
      });
    }

    const updated = await prisma.filedCharge.update({
      where: { filedChargeId },
      data: { status: body.status ?? charge.status, statuteNote: body.note ?? charge.statuteNote },
    });

    const synced = await syncOperativeCharges(charge.chargingDocument.caseId);
    return reply.send({ charge: updated, operativeChargesSynchronised: synced.synced });
  });

  // -------------------------------------------------------------------------
  // Drafts: create empty, duplicate a prior filing, finalise
  // -------------------------------------------------------------------------
  app.post('/api/cases/:caseId/charges/drafts', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!request.user) return reply.code(401).send({ error: 'Authentication required' });
    if (!FILING_ROLES.has(request.user.role)) {
      return reply.code(403).send({ error: 'Forbidden', message: 'Only attorneys, paralegals and administrators may draft a filing.' });
    }
    const { caseId } = request.params as { caseId: string };
    if (!(await caseInTenant(caseId, request.user.tenantId))) {
      return reply.code(404).send({ error: 'Not Found', message: 'No such case in this account.' });
    }

    const body = (request.body ?? {}) as {
      kind?: string; name?: string; filedAt?: string; court?: string; courtCaseNumber?: string;
      duplicateOf?: string;
    };
    if (!body.kind || !CHARGING_DOCUMENT_KINDS.includes(body.kind as ChargingDocumentKind) || !body.name || !body.filedAt) {
      return reply.code(400).send({ error: 'Bad Request', message: 'A draft needs a kind, a name and a filing date.' });
    }

    const actor: Actor = { userId: request.user.userId, role: request.user.role, tenantId: request.user.tenantId };

    if (body.duplicateOf) {
      const result = await duplicateFiling({
        sourceChargingDocumentId: body.duplicateOf,
        kind: body.kind,
        name: body.name,
        filedAt: new Date(body.filedAt),
        actor,
      });
      if (!result.ok) return reply.code(result.status).send({ error: 'Not Found', message: result.message });
      return reply.code(201).send({ document: await getChargingDocument(result.chargingDocumentId), duplicated: true });
    }

    const last = await prisma.chargingDocument.findFirst({
      where: { caseId }, orderBy: { filingSequence: 'desc' }, select: { filingSequence: true },
    });
    const created = await prisma.chargingDocument.create({
      data: {
        caseId, tenantId: request.user.tenantId, uploadedById: request.user.userId,
        kind: body.kind, name: body.name, filedAt: new Date(body.filedAt),
        court: body.court, courtCaseNumber: body.courtCaseNumber,
        filingSequence: (last?.filingSequence ?? 0) + 1,
        status: 'draft',
      },
    });
    await audit({
      caseId, tenantId: request.user.tenantId, actor, action: 'created',
      chargingDocumentId: created.chargingDocumentId,
      description: `${body.name} was started as a draft.`,
    });
    return reply.code(201).send({ document: await getChargingDocument(created.chargingDocumentId) });
  });

  // Add a count to a draft.
  app.post('/api/charging/documents/:chargingDocumentId/counts', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!request.user) return reply.code(401).send({ error: 'Authentication required' });
    if (!FILING_ROLES.has(request.user.role)) {
      return reply.code(403).send({ error: 'Forbidden', message: 'Only attorneys, paralegals and administrators may add a count.' });
    }
    const { chargingDocumentId } = request.params as { chargingDocumentId: string };
    const doc = await prisma.chargingDocument.findUnique({ where: { chargingDocumentId } });
    if (!doc || doc.tenantId !== request.user.tenantId) {
      return reply.code(404).send({ error: 'Not Found', message: 'No such charging document.' });
    }
    if (doc.lockedAt) {
      return reply.code(409).send({
        error: 'Filing locked',
        message:
          `${doc.name} is part of the litigation record: ${doc.lockedReason} Supersede it with a new filing ` +
          'rather than changing what was filed.',
      });
    }

    const c = (request.body ?? {}) as ChargeInput;
    if (!c.code || !c.section || !c.verbatimText || typeof c.countNumber !== 'number') {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'A count needs a number, a code, a section, and the wording exactly as it appears.',
      });
    }
    if (!CALIFORNIA_CODES[c.code.toUpperCase()]) {
      return reply.code(400).send({ error: 'Bad Request', message: `"${c.code}" is not a California code.` });
    }

    const added = await addCountToDocument(chargingDocumentId, doc.caseId, c);
    await audit({
      caseId: doc.caseId, tenantId: doc.tenantId,
      actor: { userId: request.user.userId, role: request.user.role, tenantId: request.user.tenantId },
      action: 'created', chargingDocumentId, filedChargeId: added.filedChargeId,
      description: `Count ${c.countNumber} charging ${added.normalizedCitation} was added to ${doc.name}.`,
    });
    return reply.code(201).send({ charge: added });
  });

  app.post('/api/charging/documents/:chargingDocumentId/finalize', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!request.user) return reply.code(401).send({ error: 'Authentication required' });
    if (!FILING_ROLES.has(request.user.role)) {
      return reply.code(403).send({ error: 'Forbidden', message: 'Only attorneys, paralegals and administrators may file a document.' });
    }
    const { chargingDocumentId } = request.params as { chargingDocumentId: string };
    const result = await finalizeDraft(chargingDocumentId, {
      userId: request.user.userId, role: request.user.role, tenantId: request.user.tenantId,
    });
    if (!result.ok) return reply.code(result.status).send({ error: 'Cannot file', message: result.message });
    return reply.send({
      chargingDocumentId,
      operativeChargesSynchronised: result.synced,
      message: 'Filed. This document is now operative and the case analysis follows its counts.',
    });
  });

  // -------------------------------------------------------------------------
  // Manual correction, audited
  // -------------------------------------------------------------------------
  app.patch('/api/charging/counts/:filedChargeId/edit', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!request.user) return reply.code(401).send({ error: 'Authentication required' });
    if (!FILING_ROLES.has(request.user.role)) {
      return reply.code(403).send({ error: 'Forbidden', message: 'Only attorneys, paralegals and administrators may correct a charge.' });
    }
    const { filedChargeId } = request.params as { filedChargeId: string };
    const result = await editCharge({
      filedChargeId,
      changes: (request.body ?? {}) as Record<string, unknown>,
      actor: { userId: request.user.userId, role: request.user.role, tenantId: request.user.tenantId },
    });
    if (!result.ok) return reply.code(result.status).send({ error: 'Cannot edit', message: result.message });
    return reply.send({ changed: result.changed });
  });

  // -------------------------------------------------------------------------
  // Parse an uploaded charging document
  // -------------------------------------------------------------------------
  app.post('/api/cases/:caseId/charges/parse', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!request.user) return reply.code(401).send({ error: 'Authentication required' });
    if (!FILING_ROLES.has(request.user.role)) {
      return reply.code(403).send({ error: 'Forbidden', message: 'Only attorneys, paralegals and administrators may parse a filing.' });
    }
    const { caseId } = request.params as { caseId: string };
    if (!(await caseInTenant(caseId, request.user.tenantId))) {
      return reply.code(404).send({ error: 'Not Found', message: 'No such case in this account.' });
    }

    const body = (request.body ?? {}) as { text?: string; evidenceId?: string };
    let text = body.text;

    if (!text && body.evidenceId) {
      const evidence = await prisma.evidence.findFirst({
        where: { evidenceId: body.evidenceId, caseId },
        select: { evidenceId: true, fileName: true },
      });
      if (!evidence) return reply.code(404).send({ error: 'Not Found', message: 'No such evidence in this case.' });

      // Extracted text is stored in chunks, in order.
      const chunks = await prisma.evidenceChunk.findMany({
        where: { evidenceId: evidence.evidenceId },
        orderBy: { chunkIndex: 'asc' },
        select: { text: true },
      });
      const joined = chunks.map((c) => c.text).join('\n');

      if (joined.trim().length === 0) {
        return reply.code(422).send({
          error: 'No text',
          message:
            `No text could be read from "${evidence.fileName}", so its counts cannot be extracted. ` +
            'The document may be a scan without a readable text layer. Enter the counts by hand.',
        });
      }
      text = joined;
    }

    if (!text) {
      return reply.code(400).send({ error: 'Bad Request', message: 'Provide either the document text or an evidenceId.' });
    }

    const parsed = parseComplaint(text);
    return reply.send({
      ...parsed,
      message:
        'These counts were read from the document and are a proposal, not a filing. Check every one against ' +
        'the document, correct anything wrong, then file it.',
    });
  });

  // -------------------------------------------------------------------------
  // Audit trail
  // -------------------------------------------------------------------------
  app.get('/api/cases/:caseId/charges/audit', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!request.user) return reply.code(401).send({ error: 'Authentication required' });
    const { caseId } = request.params as { caseId: string };
    if (!(await caseInTenant(caseId, request.user.tenantId))) {
      return reply.code(404).send({ error: 'Not Found', message: 'No such case in this account.' });
    }
    return reply.send({ caseId, events: await auditTrail(caseId) });
  });

  // -------------------------------------------------------------------------
  // The defendant and count matrix
  // -------------------------------------------------------------------------
  app.get('/api/cases/:caseId/charges/matrix', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!request.user) return reply.code(401).send({ error: 'Authentication required' });
    const { caseId } = request.params as { caseId: string };
    if (!(await caseInTenant(caseId, request.user.tenantId))) {
      return reply.code(404).send({ error: 'Not Found', message: 'No such case in this account.' });
    }

    const operative = await getOperativeDocument(caseId);
    if (!operative) return reply.send({ caseId, defendants: [], counts: [], cells: [] });

    const defendants = [...new Set(operative.charges.flatMap((c) => c.defendants.map((d) => d.defendantName)))].sort();

    const counts = operative.charges.map((c) => {
      const summary = allegationSummary(c);
      return {
        filedChargeId: c.filedChargeId,
        countNumber: c.countNumber,
        citation: c.normalizedCitation,
        status: c.status,
        attempt: c.attempt,
        enhancements: (c.enhancements as string[]) ?? [],
        allegations: summary.alleged,
        exposureNote: summary.exposureNote,
      };
    });

    const cells = operative.charges.flatMap((c) =>
      defendants.map((name) => {
        const on = c.defendants.find((d) => d.defendantName === name);
        return {
          filedChargeId: c.filedChargeId,
          countNumber: c.countNumber,
          defendant: name,
          // charged | dismissed | severed | not_charged
          state: on ? on.status : 'not_charged',
          note: on?.note ?? null,
        };
      }),
    );

    return reply.send({
      caseId,
      operativeDocument: { name: operative.name, filedAt: operative.filedAt },
      defendants,
      counts,
      cells,
      jointCounts: operative.charges.filter((c) => c.defendants.length > 1).map((c) => c.countNumber),
    });
  });

  // A charge cannot be deleted. Say so rather than returning a bare 405.
  app.delete('/api/charging/counts/:filedChargeId', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!request.user) return reply.code(401).send({ error: 'Authentication required' });
    return reply.code(409).send({
      error: 'Charges are not deleted',
      message:
        'A charge is never removed from the record. Mark it dismissed, or file the amended document that ' +
        'drops it — both leave the history of what the People charged intact.',
    });
  });

  console.log('[Server] Charging document engine registered: /api/cases/:caseId/charges/*');
}
