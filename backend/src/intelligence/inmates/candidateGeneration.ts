// ============================================================================
// Candidate generation — phase 1 of identity resolution.
//
// This stage maximises RECALL. It answers "who could possibly be this person",
// and it is supposed to over-answer: a candidate that arrives here still has to
// earn a tier from the evidence in phase 2 and pass a rule in phase 3. Nothing
// merges because a blocking key matched.
//
// The failure this file exists to fix: the original implementation blocked on
// `inmates.canonicalLast` alone and never consulted the alias table — which was
// written on every booking, indexed, and never read. Every surname variation was
// therefore a missed match, and a missed match puts an already-known person on
// the newly-discovered report, which is the primary deliverable.
//
// Seven blocking keys now, unioned. Every query has an explicit ORDER BY, because
// a candidate set that depends on the planner's natural order is not deterministic
// and this system is required to produce identical output for identical input.
// ============================================================================

import type { PrismaClient } from '@prisma/client';

import { deriveNameKeys } from './nameKeys.js';
import type { InmateCandidate, NormalizedRecord } from './types.js';

/**
 * Per-key result cap.
 *
 * A cap is necessary: `phoneticLast = 'S530'` in a large repository could return
 * thousands. It is applied per key rather than to the union so that a broad key
 * cannot crowd out a precise one — an exact surname match must never be lost
 * because a phonetic key filled the budget first.
 */
export const PER_KEY_LIMIT = 100;

/** Safety bound on the union, after de-duplication. */
export const TOTAL_CANDIDATE_LIMIT = 400;

/** How a candidate was found. Recorded so recall can be audited per key. */
export type BlockingKey =
  | 'external_person_id'
  | 'canonical_surname'
  | 'alias_surname'
  | 'surname_part'
  | 'phonetic_surname'
  | 'phonetic_alias'
  | 'collapsed_surname'
  | 'collapsed_alias';

export interface GeneratedCandidate extends InmateCandidate {
  /** Every key that produced this candidate, sorted. More keys is not more
   *  evidence — it is recorded for auditing recall, not for scoring. */
  foundBy: BlockingKey[];
  /** The facility's own person identifier matched. Phase 3 treats this as the
   *  strongest available evidence. */
  externalPersonIdMatched: boolean;
}

export interface CandidateSet {
  candidates: GeneratedCandidate[];
  /** Rows returned per key before de-duplication, for observability. */
  keyCounts: Record<string, number>;
  /** True when any key hit PER_KEY_LIMIT, so recall may be incomplete. */
  truncated: boolean;
  keysUsed: string[];
}

const SELECT = {
  inmateId: true, canonicalFirst: true, canonicalLast: true, canonicalMiddle: true,
  suffix: true, dateOfBirth: true, sex: true, race: true, bookingCount: true,
} as const;

/**
 * Find every person who could be the subject of this row.
 *
 * Deliberately several small indexed queries rather than one clever one: each is
 * a single index probe with a stable order, each can be reasoned about alone, and
 * a slow one is identifiable. A single `OR` across seven predicates would be one
 * query the planner is likely to turn into a scan.
 */
export async function generateCandidates(
  prisma: PrismaClient,
  record: NormalizedRecord,
): Promise<CandidateSet> {
  const keys = deriveNameKeys(record.last);
  const byId = new Map<string, GeneratedCandidate>();
  const keyCounts: Record<string, number> = {};
  const keysUsed: string[] = [];
  let truncated = false;

  const add = (rows: typeof SELECT[] | unknown[], key: BlockingKey, external = false): void => {
    const list = rows as {
      inmateId: string; canonicalFirst: string; canonicalLast: string;
      canonicalMiddle: string | null; suffix?: string | null;
      dateOfBirth: Date | null; sex: string | null; race: string | null; bookingCount: number;
    }[];
    keyCounts[key] = list.length;
    keysUsed.push(key);
    if (list.length >= PER_KEY_LIMIT) truncated = true;

    for (const row of list) {
      const existing = byId.get(row.inmateId);
      if (existing) {
        if (!existing.foundBy.includes(key)) existing.foundBy.push(key);
        if (external) existing.externalPersonIdMatched = true;
        continue;
      }
      if (byId.size >= TOTAL_CANDIDATE_LIMIT) { truncated = true; continue; }
      byId.set(row.inmateId, {
        inmateId: row.inmateId,
        canonicalFirst: row.canonicalFirst,
        canonicalLast: row.canonicalLast,
        canonicalMiddle: row.canonicalMiddle,
        suffix: row.suffix ?? null,
        dateOfBirth: row.dateOfBirth,
        sex: row.sex,
        race: row.race,
        bookingCount: row.bookingCount,
        foundBy: [key],
        externalPersonIdMatched: external,
      });
    }
  };

  // --- Key 1: the facility's own person identifier ------------------------
  // Checked first because it is the strongest evidence there is, and because a
  // hit makes the rest of the search almost redundant — though it still runs, so
  // an identifier collision surfaces as an ambiguous candidate set rather than
  // silently overriding a name mismatch.
  if (record.externalPersonId) {
    const hit = await prisma.inmateExternalId.findUnique({
      where: { facility_externalId: { facility: record.facility, externalId: record.externalPersonId } },
      select: { inmate: { select: SELECT } },
    });
    if (hit?.inmate) add([hit.inmate], 'external_person_id', true);
    else keyCounts.external_person_id = 0;
  }

  // --- Key 2: exact canonical surname ------------------------------------
  add(await prisma.inmate.findMany({
    where: { canonicalLast: keys.canonical, mergedIntoId: null },
    select: SELECT,
    orderBy: { inmateId: 'asc' },
    take: PER_KEY_LIMIT,
  }), 'canonical_surname');

  // --- Key 3: exact alias surname ----------------------------------------
  // The gap this file was written to close.
  await addViaAlias(prisma, add, { last: keys.canonical }, 'alias_surname');

  // --- Key 4: each part of a hyphenated or compound surname ---------------
  // SMITH-JONES must find SMITH and JONES; DE LA CRUZ must find CRUZ.
  for (const part of keys.parts) {
    if (part === keys.canonical) continue;
    add(await prisma.inmate.findMany({
      where: { canonicalLast: part, mergedIntoId: null },
      select: SELECT,
      orderBy: { inmateId: 'asc' },
      take: PER_KEY_LIMIT,
    }), 'surname_part');
    await addViaAlias(prisma, add, { last: part }, 'surname_part');
  }

  // --- Keys 5 and 6: phonetic ---------------------------------------------
  if (keys.phonetic) {
    add(await prisma.inmate.findMany({
      where: { phoneticLast: keys.phonetic, mergedIntoId: null },
      select: SELECT,
      orderBy: { inmateId: 'asc' },
      take: PER_KEY_LIMIT,
    }), 'phonetic_surname');
    await addViaAlias(prisma, add, { phoneticLast: keys.phonetic }, 'phonetic_alias');
  }

  // --- Keys 7 and 8: collapsed shape --------------------------------------
  // Catches what phonetics cannot: a misread first character, and an initial
  // sound spelled two ways (CATHERINE / KATHERINE).
  if (keys.collapsed) {
    add(await prisma.inmate.findMany({
      where: { collapsedLast: keys.collapsed, mergedIntoId: null },
      select: SELECT,
      orderBy: { inmateId: 'asc' },
      take: PER_KEY_LIMIT,
    }), 'collapsed_surname');
    await addViaAlias(prisma, add, { collapsedLast: keys.collapsed }, 'collapsed_alias');
  }

  // Stable order for everything downstream. Without this the candidate list
  // order depends on which key ran first and what the planner returned, and the
  // resolver's output would not be reproducible.
  const candidates = [...byId.values()].sort((a, b) => a.inmateId.localeCompare(b.inmateId));
  for (const c of candidates) c.foundBy.sort();

  return { candidates, keyCounts, truncated, keysUsed };
}

/**
 * Candidates reached through the alias table.
 *
 * An alias points at a person, and the same person can hold several matching
 * aliases, so results are de-duplicated by the caller's map. Merged people are
 * excluded here rather than downstream, because a merged row is not a candidate.
 */
async function addViaAlias(
  prisma: PrismaClient,
  add: (rows: unknown[], key: BlockingKey, external?: boolean) => void,
  where: { last?: string; phoneticLast?: string; collapsedLast?: string },
  key: BlockingKey,
): Promise<void> {
  const rows = await prisma.inmateAlias.findMany({
    where: { ...where, inmate: { mergedIntoId: null } },
    select: { inmate: { select: SELECT } },
    orderBy: { aliasId: 'asc' },
    take: PER_KEY_LIMIT,
  });
  add(rows.map((r) => r.inmate), key);
}
