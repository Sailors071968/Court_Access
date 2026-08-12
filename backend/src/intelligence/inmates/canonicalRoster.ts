// ============================================================================
// Canonical roster — the Sheriff PDF treated as a deterministic dataset.
//
// Per Primary Engineering Directive: parse builds this object first.
// Comparison, certification, and reporting happen only after the canonical
// roster exists. Never compare while parsing.
// ============================================================================

import { createHash } from 'node:crypto';

import type { RawRecord } from './types.js';
import { normalizeRosterName, nameFromRecord } from './rosterComparison.js';

export interface CanonicalInmateRecord {
  ordinal: number;
  name: string;
  normalizedName: string;
  xref: string | null;
  housing: string | null;
  classification: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  releaseDate: string | null;
  sourcePage: number | null;
  sourceRow: number | null;
  extractionConfidence: number | null;
  /** Evidence pointers back to the original PDF. */
  evidence: {
    sourcePdf: string | null;
    page: number | null;
    row: number | null;
    boundingBox: unknown | null;
  };
}

export interface CanonicalRoster {
  facility: string;
  county: string;
  rosterDate: string;
  pageCount: number | null;
  sourcePdf: string | null;
  sourceSha256: string | null;
  parserVersion: string | null;
  processingVersion: string;
  inmates: CanonicalInmateRecord[];
  /** SHA-256 of sorted XREF|name|DOB lines — snapshot identity. */
  contentHash: string;
  /** True when extracted order was already alphabetical (Sheriff layout). */
  sourceAlphabeticalOk: boolean;
}

export const PROCESSING_VERSION = 'niis-primary-directive-1.0';

type NormLike = {
  last?: string;
  first?: string;
  externalBookingId?: string;
  dateOfBirth?: string;
  housingLocation?: string;
  sex?: string;
};

/**
 * Build a canonical Active Inmate roster from extracted raw records.
 * Sorting is alphabetical by normalized name (Sheriff roster order).
 */
export function buildCanonicalRoster(args: {
  facility: string;
  rosterDate: string;
  records: RawRecord[];
  pageCount?: number | null;
  sourcePdf?: string | null;
  sourceSha256?: string | null;
  parserVersion?: string | null;
  county?: string;
}): CanonicalRoster {
  const inmates: CanonicalInmateRecord[] = [];
  const seen = new Set<string>();

  for (const raw of args.records) {
    const name = nameFromRecord(
      {
        last: splitName(String(raw.Name ?? '')).last,
        first: splitName(String(raw.Name ?? '')).first,
      },
      { Name: String(raw.Name ?? '') },
    ) || normalizeRosterName(String(raw.Name ?? ''));
    if (!name) continue;

    const xref = clean(raw.XREF ?? raw.xref);
    const dob = normalizeDob(clean(raw.DOB ?? raw.Dob ?? raw.dateOfBirth));
    const dedupe = `${xref ?? ''}|${name}|${dob ?? ''}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);

    const classification = clean(
      raw.Classification ?? raw.classification ?? extractClassFromHousing(String(raw.Housing ?? '')),
    );
    const housing = cleanHousing(String(raw.Housing ?? ''), classification);
    const page = intOrNull(raw.__page ?? raw.sourcePage);
    const row = intOrNull(raw.__lineNumber ?? raw.sourceRow);

    inmates.push({
      ordinal: 0,
      name: displayName(raw),
      normalizedName: name,
      xref,
      housing,
      classification,
      gender: clean(raw.Gender ?? raw.Sex ?? raw.sex)?.toUpperCase() ?? null,
      dateOfBirth: dob,
      releaseDate: clean(raw['Release Date'] ?? raw.releaseDate),
      sourcePage: page,
      sourceRow: row,
      extractionConfidence: intOrNull(raw.__extractionConfidence) ?? 100,
      evidence: {
        sourcePdf: args.sourcePdf ?? null,
        page,
        row,
        boundingBox: null,
      },
    });
  }

  let sourceAlphabeticalOk = true;
  for (let i = 1; i < inmates.length; i++) {
    if (inmates[i - 1]!.normalizedName.localeCompare(inmates[i]!.normalizedName) > 0) {
      sourceAlphabeticalOk = false;
      break;
    }
  }

  inmates.sort((a, b) => a.normalizedName.localeCompare(b.normalizedName));
  inmates.forEach((m, i) => {
    m.ordinal = i;
  });

  const contentHash = hashMembers(inmates);

  return {
    facility: args.facility,
    county: args.county ?? 'sacramento',
    rosterDate: args.rosterDate.slice(0, 10),
    pageCount: args.pageCount ?? null,
    sourcePdf: args.sourcePdf ?? null,
    sourceSha256: args.sourceSha256 ?? null,
    parserVersion: args.parserVersion ?? null,
    processingVersion: PROCESSING_VERSION,
    inmates,
    contentHash,
    sourceAlphabeticalOk,
  };
}

/** Build canonical roster members from already-normalized ingestion payloads. */
export function buildCanonicalRosterFromNormalized(args: {
  facility: string;
  rosterDate: string;
  rows: {
    normalized: NormLike | null;
    raw: Record<string, unknown> | null;
    sourcePage?: number | null;
    lineNumber?: number | null;
    extractionConfidence?: number | null;
  }[];
  pageCount?: number | null;
  sourcePdf?: string | null;
  sourceSha256?: string | null;
  parserVersion?: string | null;
}): CanonicalRoster {
  const asRaw: RawRecord[] = args.rows.map((r, idx) => {
    const name = r.normalized?.last && r.normalized?.first
      ? `${r.normalized.last}, ${r.normalized.first}`
      : String(r.raw?.Name ?? r.raw?.name ?? '');
    return {
      Name: name,
      XREF: r.normalized?.externalBookingId ?? r.raw?.XREF ?? r.raw?.xref,
      DOB: r.normalized?.dateOfBirth ?? r.raw?.DOB,
      Gender: r.normalized?.sex ?? r.raw?.Gender,
      Housing: r.normalized?.housingLocation ?? r.raw?.Housing,
      Classification: r.raw?.Classification,
      __lineNumber: String(r.lineNumber ?? idx + 1),
      __page: r.sourcePage != null ? String(r.sourcePage) : undefined,
      __extractionConfidence: r.extractionConfidence != null
        ? String(r.extractionConfidence)
        : undefined,
    } as RawRecord;
  });
  return buildCanonicalRoster({
    facility: args.facility,
    rosterDate: args.rosterDate,
    records: asRaw,
    pageCount: args.pageCount,
    sourcePdf: args.sourcePdf,
    sourceSha256: args.sourceSha256,
    parserVersion: args.parserVersion,
  });
}

export function hashMembers(inmates: CanonicalInmateRecord[]): string {
  const lines = inmates
    .map((m) => `${m.xref ?? ''}|${m.normalizedName}|${m.dateOfBirth ?? ''}`)
    .sort();
  return createHash('sha256').update(lines.join('\n')).digest('hex');
}

function clean(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s ? s : null;
}

function cleanHousing(housing: string, classification: string | null): string | null {
  let h = housing.replace(/\s+/g, ' ').trim();
  if (!h) return null;
  if (classification) {
    h = h.replace(new RegExp(`\\b${classification.replace(/\s+/g, '\\s+')}\\b`, 'i'), '').trim();
  }
  h = h.replace(/\b(MINIMUM|MEDIUM|MAXIMUM)\s+SECURITY\b/gi, '').replace(/\s+/g, ' ').trim();
  return h || null;
}

function extractClassFromHousing(housing: string): string | null {
  const m = housing.match(/\b((?:MINIMUM|MEDIUM|MAXIMUM)\s+SECURITY)\b/i);
  return m ? m[1]!.toUpperCase().replace(/\s+/g, ' ') : null;
}

function normalizeDob(value: string | null): string | null {
  if (!value) return null;
  const us = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) {
    return `${us[1]!.padStart(2, '0')}/${us[2]!.padStart(2, '0')}/${us[3]}`;
  }
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[2]}/${iso[3]}/${iso[1]}`;
  return value;
}

function intOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function splitName(name: string): { last: string; first: string } {
  const parts = name.split(',').map((p) => p.trim());
  if (parts.length >= 2) return { last: parts[0]!, first: parts.slice(1).join(' ') };
  return { last: name.trim(), first: '' };
}

function displayName(raw: RawRecord): string {
  const n = String(raw.Name ?? '').replace(/\s+/g, ' ').replace(/,\s*/, ', ').trim();
  return n;
}
