// ============================================================================
// Statutory intelligence service.
//
// Sits between the analysis engines and the Legislature's website. Serves a
// verified compilation from cache where the law has not moved, retrieves and
// compiles it where it has, resolves what a charged section depends on, and
// records every version so an old case can be reproduced under the law it was
// analysed against.
//
// The cache holds only verified retrievals. Nothing speculative is stored: a
// section that could not be read is reported as unavailable each time rather
// than remembered as though it had been answered.
// ============================================================================

import prisma from '../lib/prisma.js';
import {
  EXTRACTION_VERSION,
  normalizeSection,
  officialUrlFor,
  retrieveStatute,
  type RetrievedStatute,
} from './officialLawSource.js';
import { COMPILER_VERSION, compileStatute, type CompiledStatute } from './statutoryCompiler.js';

export interface StatuteRecord {
  officialStatuteId: string;
  code: string;
  section: string;
  officialUrl: string;
  status: string;
  unavailableReason: string | null;
  text: string | null;
  fingerprint: string | null;
  legislativeNote: string | null;
  hierarchy: Array<{ level: string; heading: string }>;
  compilation: CompiledStatute | null;
  compilerVersion: string | null;
  extractionVersion: string | null;
  retrievedAt: Date;
  /** Whether this answer came from cache or from the official source. */
  source: 'cache' | 'official';
}

interface GetOptions {
  /** Ignore the cache and re-read the official source. */
  forceRefresh?: boolean;
  /** Serve a cached compilation if it is younger than this. */
  maxAgeMs?: number;
}

/** Cached law is served for a day before it is checked again. */
const DEFAULT_MAX_AGE_MS = Number(process.env.LAW_CACHE_MAX_AGE_MS ?? 24 * 60 * 60 * 1000);

function toRecord(row: {
  officialStatuteId: string;
  code: string;
  section: string;
  officialUrl: string;
  status: string;
  unavailableReason: string | null;
  text: string | null;
  fingerprint: string | null;
  legislativeNote: string | null;
  hierarchy: unknown;
  compilation: unknown;
  compilerVersion: string | null;
  extractionVersion: string | null;
  retrievedAt: Date;
}, source: 'cache' | 'official'): StatuteRecord {
  return {
    officialStatuteId: row.officialStatuteId,
    code: row.code,
    section: row.section,
    officialUrl: row.officialUrl,
    status: row.status,
    unavailableReason: row.unavailableReason,
    text: row.text,
    fingerprint: row.fingerprint,
    legislativeNote: row.legislativeNote,
    hierarchy: (row.hierarchy as Array<{ level: string; heading: string }>) ?? [],
    compilation: (row.compilation as CompiledStatute) ?? null,
    compilerVersion: row.compilerVersion,
    extractionVersion: row.extractionVersion,
    retrievedAt: row.retrievedAt,
    source,
  };
}

/** Store a verified retrieval, superseding an earlier version if the text moved. */
async function persist(retrieved: RetrievedStatute, compilation: CompiledStatute | null) {
  if (!retrieved.fingerprint) {
    // Nothing verified to cache. Returning an unsaved record keeps the
    // contract without remembering a failure as if it were law.
    return null;
  }

  const existing = await prisma.officialStatute.findUnique({
    where: {
      code_section_fingerprint: {
        code: retrieved.code,
        section: retrieved.section,
        fingerprint: retrieved.fingerprint,
      },
    },
  });

  if (existing) {
    return prisma.officialStatute.update({
      where: { officialStatuteId: existing.officialStatuteId },
      data: {
        lastVerifiedAt: new Date(),
        // Recompile in place when the compiler has moved on.
        ...(compilation && existing.compilerVersion !== COMPILER_VERSION
          ? { compilation: compilation as unknown as object, compilerVersion: COMPILER_VERSION }
          : {}),
      },
    });
  }

  // Different text for the same section means the Legislature amended it.
  await prisma.officialStatute.updateMany({
    where: { code: retrieved.code, section: retrieved.section, supersededAt: null },
    data: { supersededAt: new Date() },
  });

  return prisma.officialStatute.create({
    data: {
      code: retrieved.code,
      section: retrieved.section,
      officialUrl: retrieved.officialUrl,
      status: retrieved.status,
      httpStatus: retrieved.httpStatus,
      unavailableReason: retrieved.unavailableReason,
      text: retrieved.text,
      fingerprint: retrieved.fingerprint,
      legislativeNote: retrieved.legislativeNote,
      hierarchy: retrieved.hierarchy as unknown as object,
      compilation: (compilation as unknown as object) ?? undefined,
      compilerVersion: compilation ? COMPILER_VERSION : null,
      extractionVersion: EXTRACTION_VERSION,
      lastVerifiedAt: new Date(),
    },
  });
}

/**
 * The current compiled statute, from cache where that is still trustworthy and
 * from the Legislature where it is not.
 */
export async function getStatute(codeInput: string, sectionInput: string, options: GetOptions = {}): Promise<StatuteRecord> {
  const code = codeInput.trim().toUpperCase();
  const section = normalizeSection(sectionInput);
  const maxAge = options.maxAgeMs ?? DEFAULT_MAX_AGE_MS;

  if (!options.forceRefresh) {
    const cached = await prisma.officialStatute.findFirst({
      where: { code, section, supersededAt: null, status: { in: ['retrieved', 'repealed'] } },
      orderBy: { retrievedAt: 'desc' },
    });

    const fresh =
      cached &&
      cached.compilation !== null &&
      cached.compilerVersion === COMPILER_VERSION &&
      cached.extractionVersion === EXTRACTION_VERSION &&
      Date.now() - (cached.lastVerifiedAt ?? cached.retrievedAt).getTime() < maxAge;

    if (cached && fresh) {
      await prisma.officialStatute
        .update({ where: { officialStatuteId: cached.officialStatuteId }, data: { cacheHits: { increment: 1 } } })
        .catch(() => {});
      return toRecord(cached, 'cache');
    }
  }

  const retrieved = await retrieveStatute(code, section);
  const compilation = retrieved.text ? compileStatute(retrieved.text, code, retrieved.hierarchy) : null;
  const row = await persist(retrieved, compilation);

  if (row) return toRecord(row, 'official');

  // Unverifiable: report it, do not cache it.
  return {
    officialStatuteId: '',
    code,
    section,
    officialUrl: officialUrlFor(code, section),
    status: retrieved.status,
    unavailableReason: retrieved.unavailableReason,
    text: null,
    fingerprint: null,
    legislativeNote: null,
    hierarchy: retrieved.hierarchy,
    compilation: null,
    compilerVersion: null,
    extractionVersion: EXTRACTION_VERSION,
    retrievedAt: retrieved.retrievedAt,
    source: 'official',
  };
}

// ---------------------------------------------------------------------------
// Statutory context graph
// ---------------------------------------------------------------------------

export interface ContextNode {
  code: string;
  section: string;
  relationship: 'charged' | 'definition' | 'reference';
  depth: number;
  reachedVia: string | null;
  record: StatuteRecord;
}

export interface StatutoryContext {
  charged: Array<{ code: string; section: string }>;
  nodes: ContextNode[];
  /** Sections named in the text that could not be read, and why. */
  unresolved: Array<{ code: string; section: string; reason: string; reachedVia: string }>;
  retrievedCount: number;
  cacheHits: number;
}

/**
 * Build the statutory context for a set of charges: the charged sections, the
 * definitions they depend on, and the sections they refer to, to a bounded
 * depth. Definitions are followed first, because a charge cannot be understood
 * without the terms it uses.
 */
export async function buildStatutoryContext(
  charges: Array<{ code: string; section: string }>,
  options: { maxDepth?: number; maxNodes?: number } = {},
): Promise<StatutoryContext> {
  const maxDepth = options.maxDepth ?? 2;
  const maxNodes = options.maxNodes ?? 40;

  const nodes: ContextNode[] = [];
  const unresolved: StatutoryContext['unresolved'] = [];
  const seen = new Set<string>();
  let retrievedCount = 0;
  let cacheHits = 0;

  type QueueItem = { code: string; section: string; relationship: ContextNode['relationship']; depth: number; reachedVia: string | null };
  const queue: QueueItem[] = charges.map((c) => ({
    code: c.code.toUpperCase(),
    section: normalizeSection(c.section),
    relationship: 'charged' as const,
    depth: 0,
    reachedVia: null,
  }));

  while (queue.length > 0 && nodes.length < maxNodes) {
    // Definitions before plain references, shallow before deep.
    queue.sort((a, b) => a.depth - b.depth || (a.relationship === 'definition' ? -1 : 1));
    const item = queue.shift()!;
    const key = `${item.code} ${item.section}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const record = await getStatute(item.code, item.section);
    if (record.source === 'cache') cacheHits++;
    else retrievedCount++;

    if (!record.text) {
      unresolved.push({
        code: item.code,
        section: item.section,
        reason: record.unavailableReason ?? 'The section could not be read from the official source.',
        reachedVia: item.reachedVia ?? 'charged',
      });
      continue;
    }

    nodes.push({ code: item.code, section: item.section, relationship: item.relationship, depth: item.depth, reachedVia: item.reachedVia, record });

    if (item.depth >= maxDepth) continue;

    for (const ref of record.compilation?.crossReferences ?? []) {
      const refKey = `${ref.code} ${ref.section}`;
      if (seen.has(refKey)) continue;
      queue.push({
        code: ref.code,
        section: ref.section,
        relationship: ref.kind === 'definition' ? 'definition' : 'reference',
        depth: item.depth + 1,
        reachedVia: `${item.code} ${item.section}: ${ref.phrase}`,
      });
    }
  }

  return { charged: charges, nodes, unresolved, retrievedCount, cacheHits };
}

// ---------------------------------------------------------------------------
// Versioned snapshots
// ---------------------------------------------------------------------------

/** Pin the statutes a case was analysed against, so the analysis is reproducible. */
export async function pinContextToCase(caseId: string, context: StatutoryContext): Promise<number> {
  let pinned = 0;
  for (const node of context.nodes) {
    if (!node.record.officialStatuteId) continue;
    await prisma.caseStatuteSnapshot
      .upsert({
        where: {
          caseId_officialStatuteId_relationship: {
            caseId,
            officialStatuteId: node.record.officialStatuteId,
            relationship: node.relationship,
          },
        },
        create: {
          caseId,
          officialStatuteId: node.record.officialStatuteId,
          relationship: node.relationship,
          reachedVia: node.reachedVia,
        },
        update: {},
      })
      .then(() => {
        pinned++;
      })
      .catch(() => {});
  }
  return pinned;
}

/** The exact law a case was analysed against, whatever has happened since. */
export async function getCaseSnapshot(caseId: string) {
  const rows = await prisma.caseStatuteSnapshot.findMany({
    where: { caseId },
    include: { officialStatute: true },
    orderBy: { pinnedAt: 'asc' },
  });

  return rows.map((r) => ({
    relationship: r.relationship,
    reachedVia: r.reachedVia,
    pinnedAt: r.pinnedAt,
    code: r.officialStatute.code,
    section: r.officialStatute.section,
    officialUrl: r.officialStatute.officialUrl,
    fingerprint: r.officialStatute.fingerprint,
    legislativeNote: r.officialStatute.legislativeNote,
    retrievedAt: r.officialStatute.retrievedAt,
    compilerVersion: r.officialStatute.compilerVersion,
    extractionVersion: r.officialStatute.extractionVersion,
    /** Set when the Legislature has amended the section since it was pinned. */
    supersededAt: r.officialStatute.supersededAt,
  }));
}

// ---------------------------------------------------------------------------
// Legislative synchronisation
// ---------------------------------------------------------------------------

export interface SyncOutcome {
  code: string;
  section: string;
  outcome: 'unchanged' | 'amended' | 'repealed' | 'disappeared' | 'error';
  previousFingerprint: string | null;
  currentFingerprint: string | null;
  detail: string;
}

/**
 * Re-read cached sections from the official source and record what moved.
 * A changed fingerprint is an amendment; the previous version is kept so
 * existing analyses stay reproducible.
 */
export async function synchronize(options: { limit?: number; codes?: string[] } = {}): Promise<{
  checked: number;
  outcomes: SyncOutcome[];
}> {
  const rows = await prisma.officialStatute.findMany({
    where: { supersededAt: null, status: { in: ['retrieved', 'repealed'] }, ...(options.codes ? { code: { in: options.codes } } : {}) },
    orderBy: { lastVerifiedAt: 'asc' },
    take: options.limit ?? 25,
  });

  const outcomes: SyncOutcome[] = [];

  for (const row of rows) {
    const retrieved = await retrieveStatute(row.code, row.section);

    let outcome: SyncOutcome['outcome'];
    let detail: string;

    if (!retrieved.text && retrieved.status === 'not_found') {
      outcome = 'disappeared';
      detail = `${row.code} ${row.section} is no longer published at the official source. It may have been renumbered.`;
    } else if (!retrieved.text) {
      outcome = 'error';
      detail = retrieved.unavailableReason ?? 'The section could not be read.';
    } else if (retrieved.fingerprint === row.fingerprint) {
      outcome = 'unchanged';
      detail = 'The official text is identical to the cached version.';
      await prisma.officialStatute
        .update({ where: { officialStatuteId: row.officialStatuteId }, data: { lastVerifiedAt: new Date() } })
        .catch(() => {});
    } else if (retrieved.status === 'repealed') {
      outcome = 'repealed';
      detail = `${row.code} ${row.section} has been repealed since it was last read.`;
    } else {
      outcome = 'amended';
      detail =
        `${row.code} ${row.section} has been amended since it was last read. ` +
        `${retrieved.legislativeNote ?? 'The legislative note was not published with the text.'} ` +
        'The previous version is retained so existing analyses remain reproducible.';
    }

    if (outcome === 'amended' || outcome === 'repealed') {
      // Store the new version; persist supersedes the old one.
      const compilation = retrieved.text ? compileStatute(retrieved.text, row.code, retrieved.hierarchy) : null;
      await persist(retrieved, compilation);
    }

    const record: SyncOutcome = {
      code: row.code,
      section: row.section,
      outcome,
      previousFingerprint: row.fingerprint,
      currentFingerprint: retrieved.fingerprint,
      detail,
    };
    outcomes.push(record);

    await prisma.legislativeSyncEvent
      .create({
        data: {
          code: row.code,
          section: row.section,
          outcome,
          previousFingerprint: row.fingerprint,
          currentFingerprint: retrieved.fingerprint,
          detail,
        },
      })
      .catch(() => {});
  }

  return { checked: rows.length, outcomes };
}

// ---------------------------------------------------------------------------
// Cache statistics, for the reporting phase
// ---------------------------------------------------------------------------

export async function cacheStatistics() {
  const [total, current, superseded, repealed, hits, syncEvents, changes] = await Promise.all([
    prisma.officialStatute.count(),
    prisma.officialStatute.count({ where: { supersededAt: null } }),
    prisma.officialStatute.count({ where: { supersededAt: { not: null } } }),
    prisma.officialStatute.count({ where: { status: 'repealed' } }),
    prisma.officialStatute.aggregate({ _sum: { cacheHits: true } }),
    prisma.legislativeSyncEvent.count(),
    prisma.legislativeSyncEvent.count({ where: { outcome: { in: ['amended', 'repealed', 'disappeared'] } } }),
  ]);

  const byCode = await prisma.officialStatute.groupBy({
    by: ['code'],
    where: { supersededAt: null },
    _count: { code: true },
  });

  return {
    statutesCached: total,
    currentVersions: current,
    supersededVersions: superseded,
    repealed,
    cacheHits: hits._sum.cacheHits ?? 0,
    syncEventsRecorded: syncEvents,
    legislativeChangesDetected: changes,
    byCode: Object.fromEntries(byCode.map((b) => [b.code, b._count.code])),
    compilerVersion: COMPILER_VERSION,
    extractionVersion: EXTRACTION_VERSION,
  };
}
