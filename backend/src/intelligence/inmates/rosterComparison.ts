// ============================================================================
// Roster Comparison Engine — PDF-primary "new inmate" detection.
//
// Gold standard: manual investigator comparison.
// Operational definition of NEW for the revenue report:
//   on today's roster ∧ not on yesterday's roster
//
// Historical repository bookings are enrichment (shown on the report), not the
// definition of newness. A person absent yesterday but present in older history
// is still NEW for this morning's report, classified as returning for
// disposition accounting.
//
// Every current-roster inmate receives exactly one classification.
// ============================================================================

import prisma from '../../lib/prisma.js';

export type RosterDisposition =
  | 'new'
  | 'returning'
  | 'existing'
  | 'review'
  | 'failed'
  | 'unclassified';

export interface RosterPersonKey {
  /** Normalized "LAST, FIRST". */
  name: string;
  xref: string | null;
  inmateId: string | null;
  dob: string | null;
}

export interface RosterMember {
  key: string;
  name: string;
  xref: string | null;
  inmateId: string | null;
  bookingId: string | null;
  recordId: string;
  resolution: string;
  confidence: number | null;
  matchTier: string | null;
  sourcePage: number | null;
  lineNumber: number;
  dob: string | null;
}

export interface RosterDispositionRow {
  name: string;
  disposition: RosterDisposition;
  onPrior: boolean;
  onCurrent: boolean;
  inmateId: string | null;
  bookingId: string | null;
  recordId: string | null;
  xref: string | null;
  historicalBookingCount: number;
  why: string;
}

export interface RosterComparisonResult {
  facility: string;
  priorBatchId: string | null;
  currentBatchId: string;
  priorSnapshotId: string | null;
  /** Where yesterday's baseline came from. */
  baselineSource: 'certified_snapshot' | 'validated_snapshot' | 'prior_batch_fallback';
  priorDate: string | null;
  currentDate: string | null;
  priorCount: number;
  currentCount: number;
  counts: Record<RosterDisposition, number>;
  /** Current-roster members classified (one row each). */
  current: RosterDispositionRow[];
  /** Prior-only names (departed from active population). */
  departed: { name: string; inmateId: string | null; xref: string | null }[];
  /** Booking IDs on the New Inmate Report = new + returning. */
  newInmateBookingIds: string[];
  /** Names on the New Inmate Report (normalized). */
  newInmateNames: string[];
  reconcileOk: boolean;
}

type NormPayload = {
  last?: string;
  first?: string;
  externalBookingId?: string;
  dateOfBirth?: string;
};

type RawPayload = { Name?: string; name?: string; XREF?: string; Xref?: string };

export function normalizeRosterName(name: string): string {
  return name.toUpperCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();
}

export function nameFromRecord(
  normalized: NormPayload | null,
  raw: RawPayload | null,
): string {
  if (normalized?.last && normalized?.first) {
    return normalizeRosterName(`${normalized.last}, ${normalized.first}`);
  }
  const rawName = raw?.Name ?? raw?.name;
  return rawName ? normalizeRosterName(String(rawName)) : '';
}

/**
 * Join keys for set-diff. Prefer XREF (facility booking identity), then inmateId,
 * then name+DOB, then name alone.
 */
export function rosterJoinKeys(member: Pick<RosterMember, 'xref' | 'inmateId' | 'name' | 'dob'>): string[] {
  const keys: string[] = [];
  if (member.xref) keys.push(`xref:${member.xref}`);
  if (member.inmateId) keys.push(`inmate:${member.inmateId}`);
  if (member.name && member.dob) keys.push(`namedob:${member.name}|${member.dob}`);
  if (member.name) keys.push(`name:${member.name}`);
  return keys;
}

/**
 * Pure disposition — Primary Engineering Directive Steps 8–11.
 *
 * Exactly one of: NEW | EXISTING | RETURNING | REVIEW (plus failed/unclassified defects).
 * NEW / RETURNING both appear on the Morning New Inmate Report (absent yesterday).
 */
export function classifyRosterDisposition(input: {
  onPrior: boolean;
  resolution: string;
  historicalBookingCount: number;
}): RosterDisposition {
  // Step 11 — uncertain cases only; never silently guess.
  if (input.resolution === 'needs_review') return 'review';
  if (input.resolution === 'failed') return 'failed';
  // Step 10 — present yesterday and today.
  if (input.onPrior) return 'existing';
  // Step 9 — historically known, not active yesterday, active today.
  if (input.historicalBookingCount > 0) return 'returning';
  // Step 8 — present today, absent yesterday, no prior active-roster match.
  if (
    input.resolution === 'new_inmate'
    || input.resolution === 'matched'
    || input.resolution === 'duplicate'
    || input.resolution === ''
  ) {
    return 'new';
  }
  return 'unclassified';
}

/** Names that belong on the Morning New Inmate Intelligence Report. */
export function isReportableNew(disposition: RosterDisposition): boolean {
  return disposition === 'new' || disposition === 'returning';
}

function emptyCounts(): Record<RosterDisposition, number> {
  return {
    new: 0,
    returning: 0,
    existing: 0,
    review: 0,
    failed: 0,
    unclassified: 0,
  };
}

function memberFromRow(r: {
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
}): RosterMember | null {
  const normalized = r.normalizedPayload as NormPayload | null;
  const raw = r.rawPayload as RawPayload | null;
  const name = nameFromRecord(normalized, raw);
  if (!name) return null;
  const xref = (
    normalized?.externalBookingId
    || (raw?.XREF ? String(raw.XREF) : null)
    || (raw?.Xref ? String(raw.Xref) : null)
  )?.toUpperCase().trim() || null;
  const dob = normalized?.dateOfBirth?.slice(0, 10) ?? null;
  const member: RosterMember = {
    key: '',
    name,
    xref,
    inmateId: r.resolvedInmateId,
    bookingId: r.bookingId,
    recordId: r.recordId,
    resolution: r.resolution,
    confidence: r.confidence,
    matchTier: r.matchTier,
    sourcePage: r.sourcePage,
    lineNumber: r.lineNumber,
    dob,
  };
  member.key = rosterJoinKeys(member)[0] ?? `name:${name}`;
  return member;
}

function indexMembers(members: RosterMember[]): Map<string, RosterMember> {
  const index = new Map<string, RosterMember>();
  for (const m of members) {
    for (const k of rosterJoinKeys(m)) {
      if (!index.has(k)) index.set(k, m);
    }
  }
  return index;
}

function findPrior(
  current: RosterMember,
  priorIndex: Map<string, RosterMember>,
): RosterMember | null {
  for (const k of rosterJoinKeys(current)) {
    const hit = priorIndex.get(k);
    if (hit) return hit;
  }
  return null;
}

async function loadBatchMembers(batchId: string): Promise<RosterMember[]> {
  const rows = await prisma.inmateIngestionRecord.findMany({
    where: { batchId },
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
    },
  });
  const out: RosterMember[] = [];
  const seenNames = new Set<string>();
  for (const r of rows) {
    const m = memberFromRow(r);
    if (!m) continue;
    // One disposition per person-name on the roster.
    if (seenNames.has(m.name)) continue;
    seenNames.add(m.name);
    out.push(m);
  }
  return out;
}

async function historicalCounts(
  inmateIds: string[],
  before: Date,
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (inmateIds.length === 0) return map;
  const grouped = await prisma.inmateBooking.groupBy({
    by: ['inmateId'],
    where: {
      inmateId: { in: inmateIds },
      bookedAt: { lt: before },
    },
    _count: { bookingId: true },
  });
  for (const g of grouped) {
    map.set(g.inmateId, g._count.bookingId);
  }
  return map;
}

function runComparison(args: {
  facility: string;
  priorMembers: RosterMember[];
  currentMembers: RosterMember[];
  currentBatchId: string;
  priorBatchId: string | null;
  priorSnapshotId: string | null;
  baselineSource: RosterComparisonResult['baselineSource'];
  priorDate: string | null;
  currentDate: string | null;
  history: Map<string, number>;
}): RosterComparisonResult {
  const priorIndex = indexMembers(args.priorMembers);
  const counts = emptyCounts();
  const current: RosterDispositionRow[] = [];
  const newInmateBookingIds: string[] = [];
  const newInmateNames: string[] = [];

  for (const member of args.currentMembers) {
    const prior = findPrior(member, priorIndex);
    const onPrior = Boolean(prior);
    const historicalBookingCount = member.inmateId
      ? (args.history.get(member.inmateId) ?? 0)
      : 0;
    const disposition = classifyRosterDisposition({
      onPrior,
      resolution: member.resolution,
      historicalBookingCount,
    });
    counts[disposition] += 1;

    let why: string;
    switch (disposition) {
      case 'new':
        why = 'NEW: present today, absent from yesterday\'s certified roster; no historical bookings.';
        break;
      case 'returning':
        why = `RETURNING: present today, absent yesterday; ${historicalBookingCount} prior booking(s) in repository.`;
        break;
      case 'existing':
        why = 'EXISTING: present on yesterday\'s certified roster and today\'s roster.';
        break;
      case 'review':
        why = 'REVIEW: identity uncertain — never silently guess.';
        break;
      case 'failed':
        why = 'FAILED: ingestion failed for this row.';
        break;
      default:
        why = 'UNCLASSIFIED — engineering defect; reconciliation fails.';
    }

    current.push({
      name: member.name,
      disposition,
      onPrior,
      onCurrent: true,
      inmateId: member.inmateId,
      bookingId: member.bookingId,
      recordId: member.recordId,
      xref: member.xref,
      historicalBookingCount,
      why,
    });

    if (isReportableNew(disposition)) {
      newInmateNames.push(member.name);
      if (member.bookingId) newInmateBookingIds.push(member.bookingId);
    }
  }

  const currentIndex = indexMembers(args.currentMembers);
  const departed = args.priorMembers
    .filter((p) => !findPrior(p, currentIndex))
    .map((p) => ({ name: p.name, inmateId: p.inmateId, xref: p.xref }));

  const classified =
    counts.new + counts.returning + counts.existing + counts.review;
  const reconcileOk =
    counts.unclassified === 0
    && counts.failed === 0
    && classified === args.currentMembers.length;

  return {
    facility: args.facility,
    priorBatchId: args.priorBatchId,
    currentBatchId: args.currentBatchId,
    priorSnapshotId: args.priorSnapshotId,
    baselineSource: args.baselineSource,
    priorDate: args.priorDate,
    currentDate: args.currentDate,
    priorCount: args.priorMembers.length,
    currentCount: args.currentMembers.length,
    counts,
    current,
    departed,
    newInmateBookingIds,
    newInmateNames,
    reconcileOk,
  };
}

/**
 * Preferred comparison path (Primary Engineering Directive Step 5):
 * today's batch vs yesterday's certified/validated snapshot.
 * Falls back to prior PDF batch only when no snapshot exists (transition).
 */
export async function compareAgainstPriorSnapshot(args: {
  facility: string;
  opsDate: string;
  currentBatchId: string;
  fallbackPriorBatchId?: string | null;
}): Promise<RosterComparisonResult> {
  const { loadPriorCertifiedSnapshot } = await import('./rosterSnapshot.js');
  const [currentBatch, currentMembers, priorSnap] = await Promise.all([
    prisma.inmateIngestionBatch.findUniqueOrThrow({ where: { batchId: args.currentBatchId } }),
    loadBatchMembers(args.currentBatchId),
    loadPriorCertifiedSnapshot(args.facility, args.opsDate),
  ]);

  const currentDate = currentBatch.rosterDate ?? new Date(`${args.opsDate}T00:00:00.000Z`);
  const inmateIds = currentMembers
    .map((m) => m.inmateId)
    .filter((id): id is string => Boolean(id));
  const history = await historicalCounts(inmateIds, currentDate);

  if (priorSnap) {
    const priorMembers: RosterMember[] = priorSnap.members.map((m, idx) => ({
      key: m.xref ? `xref:${m.xref}` : `name:${m.normalizedName}`,
      name: m.normalizedName,
      xref: m.xref,
      inmateId: m.inmateId,
      bookingId: m.bookingId,
      recordId: `snapshot:${priorSnap.snapshotId}:${idx}`,
      resolution: 'matched',
      confidence: 100,
      matchTier: 'snapshot',
      sourcePage: m.sourcePage,
      lineNumber: m.sourceRow ?? idx + 1,
      dob: m.dateOfBirth,
    }));
    return runComparison({
      facility: args.facility,
      priorMembers,
      currentMembers,
      currentBatchId: args.currentBatchId,
      priorBatchId: null,
      priorSnapshotId: priorSnap.snapshotId,
      baselineSource: priorSnap.status === 'certified' ? 'certified_snapshot' : 'validated_snapshot',
      priorDate: priorSnap.rosterDate,
      currentDate: currentBatch.rosterDate?.toISOString().slice(0, 10) ?? args.opsDate,
      history,
    });
  }

  const fallbackId = args.fallbackPriorBatchId;
  if (!fallbackId) {
    throw Object.assign(
      new Error(
        'No certified/validated prior roster snapshot and no fallback prior PDF batch. '
        + 'Upload and validate yesterday\'s roster before comparing today.',
      ),
      { statusCode: 409 },
    );
  }

  const [priorBatch, priorMembers] = await Promise.all([
    prisma.inmateIngestionBatch.findUniqueOrThrow({ where: { batchId: fallbackId } }),
    loadBatchMembers(fallbackId),
  ]);

  return runComparison({
    facility: args.facility,
    priorMembers,
    currentMembers,
    currentBatchId: args.currentBatchId,
    priorBatchId: fallbackId,
    priorSnapshotId: null,
    baselineSource: 'prior_batch_fallback',
    priorDate: priorBatch.rosterDate?.toISOString().slice(0, 10) ?? null,
    currentDate: currentBatch.rosterDate?.toISOString().slice(0, 10) ?? args.opsDate,
    history,
  });
}

/**
 * Compare yesterday's PDF batch to today's PDF batch (fallback / suite helper).
 * Prefer `compareAgainstPriorSnapshot` in production operations.
 */
export async function compareRosterBatches(args: {
  priorBatchId: string;
  currentBatchId: string;
}): Promise<RosterComparisonResult> {
  const [priorBatch, currentBatch, priorMembers, currentMembers] = await Promise.all([
    prisma.inmateIngestionBatch.findUniqueOrThrow({ where: { batchId: args.priorBatchId } }),
    prisma.inmateIngestionBatch.findUniqueOrThrow({ where: { batchId: args.currentBatchId } }),
    loadBatchMembers(args.priorBatchId),
    loadBatchMembers(args.currentBatchId),
  ]);

  const currentDate = currentBatch.rosterDate ?? new Date();
  const inmateIds = currentMembers
    .map((m) => m.inmateId)
    .filter((id): id is string => Boolean(id));
  const history = await historicalCounts(inmateIds, currentDate);

  return runComparison({
    facility: currentBatch.facility,
    priorMembers,
    currentMembers,
    currentBatchId: args.currentBatchId,
    priorBatchId: args.priorBatchId,
    priorSnapshotId: null,
    baselineSource: 'prior_batch_fallback',
    priorDate: priorBatch.rosterDate?.toISOString().slice(0, 10) ?? null,
    currentDate: currentBatch.rosterDate?.toISOString().slice(0, 10) ?? null,
    history,
  });
}

/**
 * Resolve the PDF batch pair for an ops date (today's roster date).
 */
export async function resolvePdfRosterPair(
  facility: string,
  opsDate: string,
): Promise<{ priorBatchId: string; currentBatchId: string } | null> {
  const opsStart = new Date(`${opsDate.slice(0, 10)}T00:00:00.000Z`);
  const prior = new Date(opsStart);
  prior.setUTCDate(prior.getUTCDate() - 1);

  const daily = await prisma.inmateDailyCase.findUnique({
    where: { facility_opsDate: { facility, opsDate: opsStart } },
  });
  if (daily?.priorPdfBatchId && daily?.currentPdfBatchId) {
    return {
      priorBatchId: daily.priorPdfBatchId,
      currentBatchId: daily.currentPdfBatchId,
    };
  }

  const [priorBatch, currentBatch] = await Promise.all([
    prisma.inmateIngestionBatch.findFirst({
      where: {
        facility,
        status: 'completed',
        sourceType: { in: ['pdf_text', 'pdf_ocr'] },
        rosterDate: { gte: prior, lt: opsStart },
      },
      orderBy: { finishedAt: 'desc' },
      select: { batchId: true },
    }),
    prisma.inmateIngestionBatch.findFirst({
      where: {
        facility,
        status: 'completed',
        sourceType: { in: ['pdf_text', 'pdf_ocr'] },
        rosterDate: { gte: opsStart, lt: new Date(opsStart.getTime() + 86_400_000) },
      },
      orderBy: { finishedAt: 'desc' },
      select: { batchId: true },
    }),
  ]);

  if (!priorBatch || !currentBatch) return null;
  return { priorBatchId: priorBatch.batchId, currentBatchId: currentBatch.batchId };
}
