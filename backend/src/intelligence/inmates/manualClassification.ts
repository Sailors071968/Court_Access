// ============================================================================
// Manual Classification — investigator gold standard for one roster date.
//
// The gold standard is NOT a target count (e.g. "67").
// It is the full verified classification:
//   NEW / EXISTING / RETURNING / REVIEW
//
// Whatever counts fall out of that classification are consequences of the
// evidence for that day only.
// ============================================================================

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

import { normalizeRosterName } from './rosterComparison.js';

export type ManualClass = 'new' | 'existing' | 'returning' | 'review';

export interface ManualInmateLine {
  /** Normalized LAST, FIRST… */
  name: string;
  /** Raw line as recorded by investigator. */
  raw: string;
  dob?: string | null;
  xref?: string | null;
}

export interface ManualClassification {
  rosterDate: string | null;
  priorDate: string | null;
  investigator: string | null;
  verifiedAt: string | null;
  new: ManualInmateLine[];
  existing: ManualInmateLine[];
  returning: ManualInmateLine[];
  review: ManualInmateLine[];
  /** True when only NEW was provided (legacy gold lists). */
  partial: boolean;
  sourcePath?: string;
}

const SECTION_HEADERS: Record<string, ManualClass> = {
  new: 'new',
  existing: 'existing',
  returning: 'returning',
  review: 'review',
};

function parseInmateLine(raw: string): ManualInmateLine | null {
  let line = raw.replace(/^\d+\.\s*/, '').trim();
  if (!line || line.startsWith('#') || line.startsWith('<!--')) return null;
  // Strip markdown list markers
  line = line.replace(/^[-*]\s+/, '').trim();
  if (!line.includes(',') && !/^[A-Z][A-Z' -]+,\s*/.test(line)) {
    // Allow plain "LAST, FIRST" without requiring comma if looks like a name
    if (!/^[A-Z]/.test(line)) return null;
  }

  let dob: string | null = null;
  let xref: string | null = null;
  let namePart = line;

  // LAST, FIRST | DOB | XREF
  const pipes = line.split('|').map((p) => p.trim());
  if (pipes.length >= 2) {
    namePart = pipes[0]!;
    const dobMatch = pipes[1]?.match(/(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4})/);
    if (dobMatch) dob = dobMatch[1]!;
    if (pipes[2]) xref = pipes[2]!.replace(/^XREF[:\s]*/i, '').trim() || null;
  }

  const name = normalizeRosterName(namePart);
  if (!name) return null;
  return { name, raw: line, dob, xref };
}

/**
 * Parse investigator manual-classification.md (preferred) or a legacy NEW-only list.
 */
export function parseManualClassification(
  text: string,
  opts?: { sourcePath?: string; defaultRosterDate?: string },
): ManualClassification {
  const result: ManualClassification = {
    rosterDate: opts?.defaultRosterDate ?? null,
    priorDate: null,
    investigator: null,
    verifiedAt: null,
    new: [],
    existing: [],
    returning: [],
    review: [],
    partial: false,
    sourcePath: opts?.sourcePath,
  };

  const rosterMatch = text.match(/Roster\s*Date:\s*(\d{4}-\d{2}-\d{2})/i);
  if (rosterMatch) result.rosterDate = rosterMatch[1]!;
  const priorMatch = text.match(
    /(?:Prior(?:\s*Roster)?\s*Date|Compared\s+Against(?:\s*Roster)?(?:\s*Date)?)\s*:\s*(\d{4}-\d{2}-\d{2})/i,
  );
  if (priorMatch) result.priorDate = priorMatch[1]!;
  const invMatch = text.match(/Investigator:\s*(.+)/i);
  if (invMatch) result.investigator = invMatch[1]!.trim().replace(/^<|>$/g, '') || null;
  const verifiedMatch = text.match(/Verified\s*At:\s*(\S+)/i);
  if (verifiedMatch) result.verifiedAt = verifiedMatch[1]!.replace(/^<|>$/g, '') || null;

  const hasSectionHeaders = /(?:^|\n)\s*(?:#{1,3}\s*)?(?:NEW|EXISTING|RETURNING|REVIEW)\s*:?\s*$/im.test(text);

  if (!hasSectionHeaders) {
    // Legacy NEW-only gold list
    result.partial = true;
    for (const line of text.split(/\r?\n/)) {
      const parsed = parseInmateLine(line);
      if (parsed) result.new.push(parsed);
    }
    return result;
  }

  let current: ManualClass | null = null;
  for (const line of text.split(/\r?\n/)) {
    const header = line
      .replace(/^#{1,3}\s*/, '')
      .replace(/\*+/g, '')
      .trim()
      .toLowerCase()
      .replace(/:$/, '');
    if (header in SECTION_HEADERS) {
      current = SECTION_HEADERS[header]!;
      continue;
    }
    if (!current) continue;
    const parsed = parseInmateLine(line);
    if (!parsed) continue;
    result[current].push(parsed);
  }

  const nonNew =
    result.existing.length + result.returning.length + result.review.length;
  result.partial = nonNew === 0 && result.new.length > 0;
  return result;
}

export function loadManualClassification(
  path: string,
  opts?: { defaultRosterDate?: string },
): ManualClassification {
  return parseManualClassification(readFileSync(path, 'utf8'), {
    sourcePath: path,
    defaultRosterDate: opts?.defaultRosterDate,
  });
}

export function renderManualClassification(c: ManualClassification): string {
  const fmt = (rows: ManualInmateLine[]) =>
    rows.length
      ? rows.map((r, i) => `${i + 1}. ${r.raw || r.name}`).join('\n')
      : '(none)';

  return [
    '# Manual Classification — Sacramento County',
    '',
    `Roster Date: ${c.rosterDate ?? 'UNKNOWN'}`,
    `Compared Against: ${c.priorDate ?? 'UNKNOWN'}`,
    `Investigator: ${c.investigator ?? 'UNKNOWN'}`,
    `Verified At: ${c.verifiedAt ?? 'UNKNOWN'}`,
    '',
    '> Gold standard = this classification. Counts are consequences, not targets.',
    c.partial
      ? '> PARTIAL: only NEW provided (legacy). EXISTING/RETURNING/REVIEW unknown.'
      : '',
    '',
    '## Manual Classification',
    '',
    '### NEW:',
    fmt(c.new),
    '',
    '### EXISTING:',
    fmt(c.existing),
    '',
    '### RETURNING:',
    fmt(c.returning),
    '',
    '### REVIEW:',
    fmt(c.review),
    '',
  ]
    .filter((l) => l !== '')
    .join('\n');
}

export function writeManualClassification(path: string, c: ManualClassification): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, renderManualClassification(c));
}

export interface ClassificationDiff {
  missedNew: string[];
  falseNew: string[];
  missedReturning: string[];
  falseReturning: string[];
  classMismatches: { name: string; manual: ManualClass; niis: string }[];
  /** Perfect match on NEW (and RETURNING when both sides have full classes). */
  newPerfect: boolean;
  fullPerfect: boolean;
  manualPartial: boolean;
}

export function diffAgainstManual(args: {
  manual: ManualClassification;
  /** NIIS disposition per normalized name for current roster. */
  niisByName: Map<string, string>;
  /** Names NIIS put on the Morning New Inmate Report (new + returning). */
  niisReportableNames: string[];
}): ClassificationDiff {
  const manual = args.manual;
  const manualNew = new Set(manual.new.map((r) => r.name));
  const manualReturning = new Set(manual.returning.map((r) => r.name));
  // Reportable gold = NEW ∪ RETURNING (operational morning report)
  const goldReportable = new Set([...manualNew, ...manualReturning]);
  const niisReportable = new Set(args.niisReportableNames.map(normalizeRosterName));

  const missedNew = [...manualNew].filter((n) => !niisReportable.has(n)).sort();
  const falseNew = [...niisReportable]
    .filter((n) => !goldReportable.has(n) && !manualNew.has(n))
    .sort();

  // Stricter: names NIIS called new that manual put elsewhere
  const falseNewStrict = [...niisReportable]
    .filter((n) => {
      if (manualNew.has(n) || manualReturning.has(n)) return false;
      if (manual.partial) return !manualNew.has(n);
      return true;
    })
    .sort();

  const missedReturning = manual.partial
    ? []
    : [...manualReturning].filter((n) => !niisReportable.has(n)).sort();
  const falseReturning: string[] = [];

  const classMismatches: ClassificationDiff['classMismatches'] = [];
  if (!manual.partial) {
    const manualClass = new Map<string, ManualClass>();
    for (const r of manual.new) manualClass.set(r.name, 'new');
    for (const r of manual.existing) manualClass.set(r.name, 'existing');
    for (const r of manual.returning) manualClass.set(r.name, 'returning');
    for (const r of manual.review) manualClass.set(r.name, 'review');

    for (const [name, mClass] of manualClass) {
      const niis = args.niisByName.get(name);
      if (!niis) continue;
      const n = niis.toLowerCase();
      if (n !== mClass && !(mClass === 'new' && n === 'returning' && false)) {
        if (n !== mClass) {
          classMismatches.push({ name, manual: mClass, niis: n });
        }
      }
    }
  }

  const newPerfect = missedNew.length === 0 && falseNewStrict.length === 0 && manualNew.size > 0;
  const fullPerfect =
    newPerfect
    && !manual.partial
    && missedReturning.length === 0
    && classMismatches.length === 0;

  return {
    missedNew,
    falseNew: falseNewStrict,
    missedReturning,
    falseReturning,
    classMismatches,
    newPerfect,
    fullPerfect,
    manualPartial: manual.partial,
  };
}

export function corpusEntryDir(
  corpusRoot: string,
  priorDate: string,
  currentDate: string,
): string {
  return `${corpusRoot}/${priorDate}__${currentDate}`;
}

export function ensureCorpusEntry(args: {
  corpusRoot: string;
  priorDate: string;
  currentDate: string;
}): string {
  const dir = corpusEntryDir(args.corpusRoot, args.priorDate, args.currentDate);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

export function summaryCounts(c: ManualClassification): {
  newCount: number;
  existingCount: number;
  returningCount: number;
  reviewCount: number;
  partial: boolean;
} {
  return {
    newCount: c.new.length,
    existingCount: c.existing.length,
    returningCount: c.returning.length,
    reviewCount: c.review.length,
    partial: c.partial,
  };
}
