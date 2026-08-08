// ============================================================================
// Action centre.
//
// What actually needs attention, across every case the user can see. Each item
// is counted from the database and links to the thing it is about, so a queue
// entry can always be checked rather than taken on trust.
//
// This replaces a hand-written list of example alerts that named cases which
// did not exist and announced a motion recommendation nobody had made. An
// empty queue here means there is nothing to do, and that is a useful thing to
// be able to rely on.
// ============================================================================

import prisma from '../lib/prisma.js';

export type Urgency = 'high' | 'medium' | 'low';

export interface ActionItem {
  id: string;
  urgency: Urgency;
  category:
    | 'processing_failed'
    | 'processing_pending'
    | 'awaiting_review'
    | 'investigation_task'
    | 'charges_amended'
    | 'no_charges'
    | 'hearing_upcoming'
    | 'discovery_outstanding';
  title: string;
  /** Why this is in the queue, in a sentence. */
  detail: string;
  caseId: string | null;
  caseTitle: string | null;
  /** Where clicking it goes. */
  href: string | null;
  occurredAt: Date;
}

export interface ActionCentre {
  items: ActionItem[];
  counts: { high: number; medium: number; low: number; total: number };
  /** Stated so an empty queue reads as "nothing to do", not "nothing loaded". */
  scope: string;
}

/**
 * Build the queue for one user. Everything is derived from records that exist;
 * where there is nothing to report the queue is simply shorter.
 */
export async function buildActionCentre(user: { userId: string; tenantId: string; role: string }): Promise<ActionCentre> {
  const cases = await prisma.criminalCase.findMany({
    where: { tenantId: user.tenantId, deletedAt: null },
    select: { caseId: true, title: true, caseNumber: true, nextHearing: true, status: true },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  });

  const caseIds = cases.map((c) => c.caseId);
  const titleOf = new Map(cases.map((c) => [c.caseId, c.title]));
  const items: ActionItem[] = [];

  if (caseIds.length === 0) {
    return { items: [], counts: { high: 0, medium: 0, low: 0, total: 0 }, scope: 'No cases in this account yet.' };
  }

  // --- Evidence that failed to process -------------------------------------
  const failed = await prisma.evidence.findMany({
    where: { caseId: { in: caseIds }, processingStatus: 'failed' },
    select: { evidenceId: true, caseId: true, fileName: true, updatedAt: true },
    take: 25,
  });
  for (const e of failed) {
    items.push({
      id: `failed-${e.evidenceId}`,
      urgency: 'high',
      category: 'processing_failed',
      title: `${e.fileName} could not be processed`,
      detail:
        'This file was stored but its contents could not be read, so nothing in it is searchable and no finding ' +
        'can cite it. Open the evidence to see why.',
      caseId: e.caseId,
      caseTitle: titleOf.get(e.caseId) ?? null,
      href: `/cases/${e.caseId}/evidence`,
      occurredAt: e.updatedAt,
    });
  }

  // --- Evidence still waiting ------------------------------------------------
  const pending = await prisma.evidence.groupBy({
    by: ['caseId'],
    where: { caseId: { in: caseIds }, processingStatus: { in: ['pending', 'processing', 'queued'] } },
    _count: { evidenceId: true },
    _max: { createdAt: true },
  });
  for (const p of pending) {
    items.push({
      id: `pending-${p.caseId}`,
      urgency: 'low',
      category: 'processing_pending',
      title: `${p._count.evidenceId} item(s) of evidence still processing`,
      detail: 'Findings that depend on these files are incomplete until processing finishes.',
      caseId: p.caseId,
      caseTitle: titleOf.get(p.caseId) ?? null,
      href: `/cases/${p.caseId}/evidence`,
      occurredAt: p._max.createdAt ?? new Date(),
    });
  }

  // --- Investigation tasks not yet done ----------------------------------------
  const tasks = await prisma.investigationTask
    .findMany({
      where: { caseId: { in: caseIds }, status: { notIn: ['completed', 'closed', 'cancelled'] } },
      select: { id: true, caseId: true, title: true, priority: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 25,
    })
    .catch(() => []);
  for (const t of tasks) {
    items.push({
      id: `task-${t.id}`,
      urgency: t.priority === 'high' || t.priority === 'critical' ? 'high' : 'medium',
      category: 'investigation_task',
      title: t.title,
      detail: 'An investigation task on this case has not been completed.',
      caseId: t.caseId,
      caseTitle: titleOf.get(t.caseId) ?? null,
      href: `/cases/${t.caseId}/investigator-workbench`,
      occurredAt: t.createdAt,
    });
  }

  // --- Charges recently amended -------------------------------------------------
  const recentFilings = await prisma.chargingDocument
    .findMany({
      where: {
        caseId: { in: caseIds },
        status: 'filed',
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        filingSequence: { gt: 1 },
      },
      select: { chargingDocumentId: true, caseId: true, name: true, filedAt: true, createdAt: true },
      take: 15,
    })
    .catch(() => []);
  for (const f of recentFilings) {
    items.push({
      id: `charges-${f.chargingDocumentId}`,
      urgency: 'high',
      category: 'charges_amended',
      title: `${f.name} filed — the charges have changed`,
      detail:
        'Everything built on the charges follows the newest filing. Work done against the previous pleading may ' +
        'need revisiting.',
      caseId: f.caseId,
      caseTitle: titleOf.get(f.caseId) ?? null,
      href: `/cases/${f.caseId}/charges`,
      occurredAt: f.createdAt,
    });
  }

  // --- Cases with no charging document at all -------------------------------------
  const withCharges = new Set(
    (
      await prisma.chargingDocument
        .findMany({ where: { caseId: { in: caseIds }, status: 'filed' }, select: { caseId: true }, distinct: ['caseId'] })
        .catch(() => [])
    ).map((c) => c.caseId),
  );
  for (const c of cases) {
    if (withCharges.has(c.caseId) || c.status === 'closed' || c.status === 'archived') continue;
    items.push({
      id: `nocharges-${c.caseId}`,
      urgency: 'medium',
      category: 'no_charges',
      title: `${c.title} has no charging document on record`,
      detail:
        'CALCRIM, mens rea and the elements analysis all read the charges, so they cannot run until a complaint ' +
        'or information is filed here.',
      caseId: c.caseId,
      caseTitle: c.title,
      href: `/cases/${c.caseId}/charges`,
      occurredAt: new Date(),
    });
  }

  // --- Hearings coming up ------------------------------------------------------------
  const soon = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  for (const c of cases) {
    if (!c.nextHearing || c.nextHearing > soon || c.nextHearing < new Date()) continue;
    const days = Math.ceil((c.nextHearing.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    items.push({
      id: `hearing-${c.caseId}`,
      urgency: days <= 3 ? 'high' : 'medium',
      category: 'hearing_upcoming',
      title: `${c.title} is in court in ${days} day(s)`,
      detail: `Next hearing ${c.nextHearing.toDateString()}.`,
      caseId: c.caseId,
      caseTitle: c.title,
      href: `/cases/${c.caseId}/overview`,
      occurredAt: c.nextHearing,
    });
  }

  const order: Record<Urgency, number> = { high: 0, medium: 1, low: 2 };
  items.sort((a, b) => order[a.urgency] - order[b.urgency] || b.occurredAt.getTime() - a.occurredAt.getTime());

  return {
    items,
    counts: {
      high: items.filter((i) => i.urgency === 'high').length,
      medium: items.filter((i) => i.urgency === 'medium').length,
      low: items.filter((i) => i.urgency === 'low').length,
      total: items.length,
    },
    scope: `Across ${cases.length} case(s) in this account.`,
  };
}
