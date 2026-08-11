// ============================================================================
// Daily Difference Viewer — side-by-side prior vs current roster.
//
// Purpose: make manual verification and diagnostics fast while NIIS earns trust.
// Classification semantics are owned by ingestion / changeDetection; this module
// only presents them with evidence links. It never redefines "new".
// ============================================================================

import prisma from '../../lib/prisma.js';

export type DifferenceColor = 'green' | 'blue' | 'yellow' | 'gray' | 'red';
export type DifferenceClass =
  | 'new'
  | 'returning'
  | 'changed'
  | 'unchanged'
  | 'review'
  | 'departed'
  | 'unclassified'
  | 'failed';

export interface RosterSideSnapshot {
  recordId: string;
  lineNumber: number;
  name: string;
  bookingNumber: string | null;
  housing: string | null;
  bail: string | null;
  charges: string | null;
  bookedAt: string | null;
  resolution: string;
  confidence: number | null;
  matchTier: string | null;
  sourcePage: number | null;
  inmateId: string | null;
  bookingId: string | null;
}

export interface DifferenceEvidence {
  uploadId: string | null;
  filename: string;
  sha256: string | null;
  page: number | null;
  row: number | null;
  side: 'prior' | 'current';
  href: string | null;
}

export interface DifferenceWhy {
  summary: string;
  rules: string[];
  presence: string | null;
  identity: string | null;
  attributeChanges: { field: string; from: string | null; to: string | null }[];
}

export interface DifferenceRow {
  key: string;
  name: string;
  color: DifferenceColor;
  classification: DifferenceClass;
  onPrior: boolean;
  onCurrent: boolean;
  inmateId: string | null;
  bookingId: string | null;
  prior: RosterSideSnapshot | null;
  current: RosterSideSnapshot | null;
  why: DifferenceWhy;
  evidence: DifferenceEvidence[];
}

export interface DailyDifferenceView {
  facility: string;
  opsDate: string;
  priorDate: string;
  caseId: string | null;
  status: string | null;
  reportCertification: 'certified' | 'provisional' | 'missing' | 'failed';
  prior: {
    batchId: string;
    uploadId: string | null;
    filename: string | null;
    rosterDate: string | null;
    count: number;
  };
  current: {
    batchId: string;
    uploadId: string | null;
    filename: string | null;
    rosterDate: string | null;
    count: number;
  };
  counts: Record<DifferenceClass, number>;
  rows: DifferenceRow[];
  unclassifiedCount: number;
  reconcileOk: boolean;
}

type NormPayload = {
  last?: string;
  first?: string;
  externalBookingId?: string;
  housingLocation?: string;
  bailAmountCents?: number | string | null;
  bookedAt?: string;
  charges?: { rawText?: string; statuteCode?: string; statuteSection?: string }[];
};

type RawPayload = { Name?: string; name?: string };

const ATTR_CHANGE_TYPES = new Set([
  'housing_change',
  'bail_change',
  'charge_added',
  'charge_removed',
  'court_date_change',
  'custody_status_change',
]);

export function normalizePersonName(name: string): string {
  return name.toUpperCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();
}

export function nameFromPayloads(
  normalized: NormPayload | null,
  raw: RawPayload | null,
): string {
  if (normalized?.last && normalized?.first) {
    return normalizePersonName(`${normalized.last}, ${normalized.first}`);
  }
  const rawName = raw?.Name ?? raw?.name;
  return rawName ? normalizePersonName(String(rawName)) : '';
}

function moneyLabel(cents: number | string | null | undefined): string | null {
  if (cents === null || cents === undefined || cents === '') return null;
  const n = typeof cents === 'string' ? Number(cents) : cents;
  if (!Number.isFinite(n)) return null;
  return (n / 100).toFixed(2);
}

function chargesLabel(charges: NormPayload['charges']): string | null {
  if (!charges?.length) return null;
  return charges
    .map((c) => c.rawText || [c.statuteCode, c.statuteSection].filter(Boolean).join(' '))
    .filter(Boolean)
    .join('; ');
}

/**
 * Color priority when multiple signals apply:
 * review/failed > new > returning > changed > unchanged/departed.
 */
export function classifyDifferenceColor(input: {
  onPrior: boolean;
  onCurrent: boolean;
  presence: 'new' | 'returning' | 'existing' | 'review' | 'failed' | 'unclassified' | null;
  hasAttributeChanges: boolean;
}): { color: DifferenceColor; classification: DifferenceClass } {
  if (!input.onCurrent && input.onPrior) {
    return { color: 'gray', classification: 'departed' };
  }
  if (input.presence === 'review' || input.presence === 'failed') {
    return { color: 'red', classification: input.presence === 'failed' ? 'failed' : 'review' };
  }
  if (input.presence === 'unclassified' || input.presence === null) {
    return { color: 'red', classification: 'unclassified' };
  }
  if (input.presence === 'new') {
    return { color: 'green', classification: 'new' };
  }
  if (input.presence === 'returning') {
    return { color: 'blue', classification: 'returning' };
  }
  if (input.hasAttributeChanges) {
    return { color: 'yellow', classification: 'changed' };
  }
  return { color: 'gray', classification: 'unchanged' };
}

function emptyCounts(): Record<DifferenceClass, number> {
  return {
    new: 0,
    returning: 0,
    changed: 0,
    unchanged: 0,
    review: 0,
    departed: 0,
    unclassified: 0,
    failed: 0,
  };
}

function toSnapshot(
  r: {
    recordId: string;
    lineNumber: number;
    resolution: string;
    confidence: number | null;
    matchTier: string | null;
    sourcePage: number | null;
    resolvedInmateId: string | null;
    bookingId: string | null;
    normalizedPayload: unknown;
    rawPayload: unknown;
  },
): RosterSideSnapshot | null {
  const normalized = r.normalizedPayload as NormPayload | null;
  const raw = r.rawPayload as RawPayload | null;
  const name = nameFromPayloads(normalized, raw);
  if (!name) return null;
  return {
    recordId: r.recordId,
    lineNumber: r.lineNumber,
    name,
    bookingNumber: normalized?.externalBookingId ?? null,
    housing: normalized?.housingLocation ?? null,
    bail: moneyLabel(normalized?.bailAmountCents),
    charges: chargesLabel(normalized?.charges),
    bookedAt: normalized?.bookedAt ?? null,
    resolution: r.resolution,
    confidence: r.confidence,
    matchTier: r.matchTier,
    sourcePage: r.sourcePage,
    inmateId: r.resolvedInmateId,
    bookingId: r.bookingId,
  };
}

function attributeDiffs(
  prior: RosterSideSnapshot | null,
  current: RosterSideSnapshot | null,
  events: { field: string | null; previousValue: string | null; newValue: string | null; changeType: string }[],
): { field: string; from: string | null; to: string | null }[] {
  const out: { field: string; from: string | null; to: string | null }[] = [];
  const seen = new Set<string>();

  for (const e of events) {
    if (!ATTR_CHANGE_TYPES.has(e.changeType)) continue;
    const field = e.field || e.changeType;
    if (seen.has(field)) continue;
    seen.add(field);
    out.push({ field, from: e.previousValue, to: e.newValue });
  }

  if (prior && current) {
    const pairs: [string, string | null, string | null][] = [
      ['housing', prior.housing, current.housing],
      ['bail', prior.bail, current.bail],
      ['charges', prior.charges, current.charges],
    ];
    for (const [field, from, to] of pairs) {
      if (from == null || to == null) continue;
      if (from === to) continue;
      if (seen.has(field)) continue;
      seen.add(field);
      out.push({ field, from, to });
    }
  }
  return out;
}

function presenceFromResolution(
  resolution: string,
  changeType: string | null,
): 'new' | 'returning' | 'existing' | 'review' | 'failed' | 'unclassified' {
  if (resolution === 'needs_review') return 'review';
  if (resolution === 'failed') return 'failed';
  if (resolution === 'new_inmate') return 'new';
  if (changeType === 'new_inmate') return 'new';
  if (changeType === 'returning_inmate') return 'returning';
  if (resolution === 'matched' || resolution === 'duplicate') return 'existing';
  if (changeType === 'known_inmate') return 'existing';
  return 'unclassified';
}

function buildWhy(args: {
  classification: DifferenceClass;
  presence: string | null;
  current: RosterSideSnapshot | null;
  attributeChanges: { field: string; from: string | null; to: string | null }[];
  matchEvidence: unknown;
}): DifferenceWhy {
  const rules: string[] = [];
  let identity: string | null = null;
  const ev = args.matchEvidence as {
    reviewRationale?: string;
    reasons?: { label?: string; detail?: string }[];
  } | null;

  if (args.current?.resolution) {
    rules.push(`ingestion.resolution = ${args.current.resolution}`);
  }
  if (args.current?.matchTier) {
    rules.push(`identity.matchTier = ${args.current.matchTier}`);
  }
  if (args.presence) {
    rules.push(`presence = ${args.presence}`);
  }
  for (const c of args.attributeChanges) {
    rules.push(`attribute.${c.field}: ${c.from ?? '—'} → ${c.to ?? '—'}`);
  }
  if (ev?.reviewRationale) identity = ev.reviewRationale;
  else if (ev?.reasons?.length) {
    identity = ev.reasons.map((r) => r.detail || r.label).filter(Boolean).join('; ');
  }

  const summaries: Record<DifferenceClass, string> = {
    new: 'Classified as newly booked: first appearance in the Sacramento repository relative to the prior certified roster.',
    returning: 'Classified as returning: known person with a prior closed booking, now present again.',
    changed: 'Still in custody (existing), but one or more booking attributes changed since the prior roster.',
    unchanged: 'Present on both rosters with no material booking attribute changes.',
    review: 'Identity or classification deferred to human review — not counted as new until decided.',
    failed: 'Processing failed for this row; it requires engineering attention.',
    departed: 'Present on the prior roster but absent from today — left the active population.',
    unclassified: 'No disposition was recorded. This violates the daily classification rule and is a defect.',
  };

  return {
    summary: summaries[args.classification],
    rules,
    presence: args.presence,
    identity,
    attributeChanges: args.attributeChanges,
  };
}

async function resolveBatchPair(args: {
  facility: string;
  opsDate?: string;
  caseId?: string;
  priorBatchId?: string;
  currentBatchId?: string;
}): Promise<{
  facility: string;
  opsDate: string;
  priorDate: string;
  caseId: string | null;
  status: string | null;
  priorBatchId: string;
  currentBatchId: string;
  priorUploadId: string | null;
  currentUploadId: string | null;
  reportCertification: DailyDifferenceView['reportCertification'];
}> {
  const facility = args.facility || 'sacramento';

  if (args.priorBatchId && args.currentBatchId) {
    const [priorBatch, currentBatch, dailyCase, cert] = await Promise.all([
      prisma.inmateIngestionBatch.findUnique({ where: { batchId: args.priorBatchId } }),
      prisma.inmateIngestionBatch.findUnique({ where: { batchId: args.currentBatchId } }),
      args.caseId
        ? prisma.inmateDailyCase.findUnique({ where: { caseId: args.caseId } })
        : null,
      prisma.inmateDailyCertification.findFirst({
        where: { facility },
        orderBy: { opsDate: 'desc' },
      }),
    ]);
    if (!priorBatch || !currentBatch) {
      throw Object.assign(new Error('Prior or current batch not found'), { statusCode: 404 });
    }
    const opsDate = (currentBatch.rosterDate ?? new Date()).toISOString().slice(0, 10);
    const priorDate = (priorBatch.rosterDate ?? new Date()).toISOString().slice(0, 10);
    const todayCert = await prisma.inmateDailyCertification.findUnique({
      where: { facility_opsDate: { facility, opsDate: new Date(`${opsDate}T00:00:00.000Z`) } },
    }).catch(() => null);
    let reportCertification: DailyDifferenceView['reportCertification'] = 'provisional';
    if (todayCert?.status === 'pass') reportCertification = 'certified';
    else if (todayCert?.status === 'fail') reportCertification = 'failed';
    else if (!todayCert && !cert) reportCertification = 'missing';

    return {
      facility,
      opsDate,
      priorDate,
      caseId: dailyCase?.caseId ?? null,
      status: dailyCase?.status ?? null,
      priorBatchId: priorBatch.batchId,
      currentBatchId: currentBatch.batchId,
      priorUploadId: null,
      currentUploadId: null,
      reportCertification,
    };
  }

  const opsDate = args.opsDate ?? new Date().toISOString().slice(0, 10);
  const opsStart = new Date(`${opsDate}T00:00:00.000Z`);
  const prior = new Date(opsStart);
  prior.setUTCDate(prior.getUTCDate() - 1);
  const priorDate = prior.toISOString().slice(0, 10);

  const dailyCase = args.caseId
    ? await prisma.inmateDailyCase.findUnique({ where: { caseId: args.caseId } })
    : await prisma.inmateDailyCase.findUnique({
        where: { facility_opsDate: { facility, opsDate: opsStart } },
      });

  let priorBatchId = dailyCase?.priorPdfBatchId ?? null;
  let currentBatchId = dailyCase?.currentPdfBatchId ?? null;
  let priorUploadId = dailyCase?.priorPdfUploadId ?? null;
  let currentUploadId = dailyCase?.currentPdfUploadId ?? null;

  if (!priorBatchId || !currentBatchId) {
    const [priorBatch, currentBatch] = await Promise.all([
      prisma.inmateIngestionBatch.findFirst({
        where: {
          facility,
          status: 'completed',
          sourceType: { in: ['pdf_text', 'pdf_ocr'] },
          rosterDate: { gte: prior, lt: opsStart },
        },
        orderBy: { finishedAt: 'desc' },
      }),
      prisma.inmateIngestionBatch.findFirst({
        where: {
          facility,
          status: 'completed',
          sourceType: { in: ['pdf_text', 'pdf_ocr'] },
          rosterDate: { gte: opsStart, lt: new Date(opsStart.getTime() + 86_400_000) },
        },
        orderBy: { finishedAt: 'desc' },
      }),
    ]);
    priorBatchId = priorBatchId ?? priorBatch?.batchId ?? null;
    currentBatchId = currentBatchId ?? currentBatch?.batchId ?? null;
  }

  if (!priorBatchId || !currentBatchId) {
    throw Object.assign(
      new Error('Both prior and current PDF batches are required for the Daily Difference Viewer.'),
      { statusCode: 409 },
    );
  }

  if (!priorUploadId || !currentUploadId) {
    const uploads = await prisma.inmateRosterUpload.findMany({
      where: { batchId: { in: [priorBatchId, currentBatchId] } },
      select: { uploadId: true, batchId: true },
    });
    for (const u of uploads) {
      if (u.batchId === priorBatchId) priorUploadId = priorUploadId ?? u.uploadId;
      if (u.batchId === currentBatchId) currentUploadId = currentUploadId ?? u.uploadId;
    }
  }

  const cert = await prisma.inmateDailyCertification.findUnique({
    where: { facility_opsDate: { facility, opsDate: opsStart } },
  });
  let reportCertification: DailyDifferenceView['reportCertification'] = 'provisional';
  if (cert?.status === 'pass') reportCertification = 'certified';
  else if (cert?.status === 'fail') reportCertification = 'failed';
  else if (!cert) reportCertification = dailyCase ? 'provisional' : 'missing';

  return {
    facility,
    opsDate,
    priorDate,
    caseId: dailyCase?.caseId ?? null,
    status: dailyCase?.status ?? null,
    priorBatchId,
    currentBatchId,
    priorUploadId,
    currentUploadId,
    reportCertification,
  };
}

/**
 * Build the side-by-side difference view for an operational day.
 */
export async function buildDailyDifferenceView(args: {
  facility?: string;
  opsDate?: string;
  caseId?: string;
  priorBatchId?: string;
  currentBatchId?: string;
}): Promise<DailyDifferenceView> {
  const pair = await resolveBatchPair({
    facility: args.facility ?? 'sacramento',
    opsDate: args.opsDate,
    caseId: args.caseId,
    priorBatchId: args.priorBatchId,
    currentBatchId: args.currentBatchId,
  });

  const [priorBatch, currentBatch, priorRecords, currentRecords, changeEvents, priorUpload, currentUpload] =
    await Promise.all([
      prisma.inmateIngestionBatch.findUniqueOrThrow({ where: { batchId: pair.priorBatchId } }),
      prisma.inmateIngestionBatch.findUniqueOrThrow({ where: { batchId: pair.currentBatchId } }),
      prisma.inmateIngestionRecord.findMany({
        where: { batchId: pair.priorBatchId },
        select: {
          recordId: true,
          lineNumber: true,
          resolution: true,
          confidence: true,
          matchTier: true,
          sourcePage: true,
          resolvedInmateId: true,
          bookingId: true,
          normalizedPayload: true,
          rawPayload: true,
          matchEvidence: true,
        },
      }),
      prisma.inmateIngestionRecord.findMany({
        where: { batchId: pair.currentBatchId },
        select: {
          recordId: true,
          lineNumber: true,
          resolution: true,
          confidence: true,
          matchTier: true,
          sourcePage: true,
          resolvedInmateId: true,
          bookingId: true,
          normalizedPayload: true,
          rawPayload: true,
          matchEvidence: true,
        },
      }),
      prisma.inmateChangeEvent.findMany({
        where: { batchId: pair.currentBatchId },
        select: {
          bookingId: true,
          inmateId: true,
          changeType: true,
          field: true,
          previousValue: true,
          newValue: true,
          material: true,
        },
      }),
      pair.priorUploadId
        ? prisma.inmateRosterUpload.findUnique({
            where: { uploadId: pair.priorUploadId },
            select: { uploadId: true, originalName: true, sha256: true },
          })
        : prisma.inmateRosterUpload.findFirst({
            where: { batchId: pair.priorBatchId },
            select: { uploadId: true, originalName: true, sha256: true },
          }),
      pair.currentUploadId
        ? prisma.inmateRosterUpload.findUnique({
            where: { uploadId: pair.currentUploadId },
            select: { uploadId: true, originalName: true, sha256: true },
          })
        : prisma.inmateRosterUpload.findFirst({
            where: { batchId: pair.currentBatchId },
            select: { uploadId: true, originalName: true, sha256: true },
          }),
    ]);

  const presenceByBooking = new Map<string, string>();
  const presenceByInmate = new Map<string, string>();
  const attrByBooking = new Map<string, typeof changeEvents>();
  for (const e of changeEvents) {
    if (e.changeType === 'new_inmate' || e.changeType === 'returning_inmate' || e.changeType === 'known_inmate') {
      if (e.bookingId) presenceByBooking.set(e.bookingId, e.changeType);
      if (e.inmateId) presenceByInmate.set(e.inmateId, e.changeType);
    }
    if (ATTR_CHANGE_TYPES.has(e.changeType) && e.bookingId) {
      const list = attrByBooking.get(e.bookingId) ?? [];
      list.push(e);
      attrByBooking.set(e.bookingId, list);
    }
  }

  type Internal = {
    snap: RosterSideSnapshot;
    matchEvidence: unknown;
  };

  const priorByKey = new Map<string, Internal>();
  const currentByKey = new Map<string, Internal>();

  for (const r of priorRecords) {
    const snap = toSnapshot(r);
    if (!snap) continue;
    const key = snap.inmateId ? `id:${snap.inmateId}` : `name:${snap.name}`;
    if (!priorByKey.has(key)) priorByKey.set(key, { snap, matchEvidence: r.matchEvidence });
    // Also index by name for cross-day joins when inmateId missing on one side.
    if (snap.inmateId) {
      const nameKey = `name:${snap.name}`;
      if (!priorByKey.has(nameKey)) priorByKey.set(nameKey, { snap, matchEvidence: r.matchEvidence });
    }
  }

  for (const r of currentRecords) {
    const snap = toSnapshot(r);
    if (!snap) continue;
    const key = snap.inmateId ? `id:${snap.inmateId}` : `name:${snap.name}`;
    if (!currentByKey.has(key)) currentByKey.set(key, { snap, matchEvidence: r.matchEvidence });
    if (snap.inmateId) {
      const nameKey = `name:${snap.name}`;
      if (!currentByKey.has(nameKey)) currentByKey.set(nameKey, { snap, matchEvidence: r.matchEvidence });
    }
  }

  // Prefer identity keys; collect unique people.
  const people: { key: string; prior: Internal | null; current: Internal | null }[] = [];
  const seenNames = new Set<string>();

  for (const r of currentRecords) {
    const snap = toSnapshot(r);
    if (!snap) continue;
    if (seenNames.has(snap.name)) continue;
    seenNames.add(snap.name);
    const idKey = snap.inmateId ? `id:${snap.inmateId}` : null;
    const prior =
      (idKey ? priorByKey.get(idKey) : null)
      ?? priorByKey.get(`name:${snap.name}`)
      ?? null;
    people.push({
      key: idKey ?? `name:${snap.name}`,
      prior,
      current: { snap, matchEvidence: r.matchEvidence },
    });
  }

  for (const r of priorRecords) {
    const snap = toSnapshot(r);
    if (!snap) continue;
    if (seenNames.has(snap.name)) continue;
    // Check if already linked via inmate id on current.
    if (snap.inmateId && currentByKey.has(`id:${snap.inmateId}`)) continue;
    if (currentByKey.has(`name:${snap.name}`)) continue;
    seenNames.add(snap.name);
    people.push({
      key: snap.inmateId ? `id:${snap.inmateId}` : `name:${snap.name}`,
      prior: { snap, matchEvidence: r.matchEvidence },
      current: null,
    });
  }

  const counts = emptyCounts();
  const rows: DifferenceRow[] = [];

  for (const person of people) {
    const priorSnap = person.prior?.snap ?? null;
    const currentSnap = person.current?.snap ?? null;
    const bookingId = currentSnap?.bookingId ?? priorSnap?.bookingId ?? null;
    const inmateId = currentSnap?.inmateId ?? priorSnap?.inmateId ?? null;
    const changeType =
      (bookingId ? presenceByBooking.get(bookingId) : null)
      ?? (inmateId ? presenceByInmate.get(inmateId) : null)
      ?? null;
    const presence = currentSnap
      ? presenceFromResolution(currentSnap.resolution, changeType)
      : null;
    const attrEvents = bookingId ? (attrByBooking.get(bookingId) ?? []) : [];
    const attributeChanges = attributeDiffs(priorSnap, currentSnap, attrEvents);
    const { color, classification } = classifyDifferenceColor({
      onPrior: Boolean(priorSnap),
      onCurrent: Boolean(currentSnap),
      presence,
      hasAttributeChanges: attributeChanges.length > 0,
    });
    counts[classification] += 1;

    const evidence: DifferenceEvidence[] = [];
    if (priorSnap && (priorUpload || pair.priorUploadId)) {
      const uploadId = priorUpload?.uploadId ?? pair.priorUploadId;
      evidence.push({
        side: 'prior',
        uploadId,
        filename: priorUpload?.originalName ?? priorBatch.sourceFilename,
        sha256: priorUpload?.sha256 ?? null,
        page: priorSnap.sourcePage,
        row: priorSnap.lineNumber,
        href: uploadId ? `/api/admin/intelligence/uploads/${uploadId}/file` : null,
      });
    }
    if (currentSnap && (currentUpload || pair.currentUploadId)) {
      const uploadId = currentUpload?.uploadId ?? pair.currentUploadId;
      evidence.push({
        side: 'current',
        uploadId,
        filename: currentUpload?.originalName ?? currentBatch.sourceFilename,
        sha256: currentUpload?.sha256 ?? null,
        page: currentSnap.sourcePage,
        row: currentSnap.lineNumber,
        href: uploadId ? `/api/admin/intelligence/uploads/${uploadId}/file` : null,
      });
    }

    rows.push({
      key: person.key,
      name: currentSnap?.name ?? priorSnap!.name,
      color,
      classification,
      onPrior: Boolean(priorSnap),
      onCurrent: Boolean(currentSnap),
      inmateId,
      bookingId,
      prior: priorSnap,
      current: currentSnap,
      why: buildWhy({
        classification,
        presence,
        current: currentSnap,
        attributeChanges,
        matchEvidence: person.current?.matchEvidence ?? person.prior?.matchEvidence ?? null,
      }),
      evidence,
    });
  }

  rows.sort((a, b) => {
    const order: Record<DifferenceColor, number> = {
      red: 0, green: 1, blue: 2, yellow: 3, gray: 4,
    };
    const d = order[a.color] - order[b.color];
    return d !== 0 ? d : a.name.localeCompare(b.name);
  });

  const unclassifiedCount = counts.unclassified + counts.failed;
  const currentNamed = rows.filter((r) => r.onCurrent).length;
  const classifiedCurrent =
    counts.new + counts.returning + counts.changed + counts.unchanged + counts.review;
  const reconcileOk =
    unclassifiedCount === 0
    && classifiedCurrent === currentNamed
    && counts.failed === 0;

  return {
    facility: pair.facility,
    opsDate: pair.opsDate,
    priorDate: pair.priorDate,
    caseId: pair.caseId,
    status: pair.status,
    reportCertification: pair.reportCertification,
    prior: {
      batchId: pair.priorBatchId,
      uploadId: priorUpload?.uploadId ?? pair.priorUploadId,
      filename: priorUpload?.originalName ?? priorBatch.sourceFilename,
      rosterDate: priorBatch.rosterDate?.toISOString().slice(0, 10) ?? pair.priorDate,
      count: rows.filter((r) => r.onPrior).length,
    },
    current: {
      batchId: pair.currentBatchId,
      uploadId: currentUpload?.uploadId ?? pair.currentUploadId,
      filename: currentUpload?.originalName ?? currentBatch.sourceFilename,
      rosterDate: currentBatch.rosterDate?.toISOString().slice(0, 10) ?? pair.opsDate,
      count: rows.filter((r) => r.onCurrent).length,
    },
    counts,
    rows,
    unclassifiedCount,
    reconcileOk,
  };
}
