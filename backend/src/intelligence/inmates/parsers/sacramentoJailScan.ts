// ============================================================================
// Sacramento County Sheriff — "Active Inmate Basic Roster" PDF layout.
//
// Real SACJAILSCAN exports are not the pipe-delimited table the v1 PDF profile
// expected. pdf-parse yields a fragmented text layer (fields often one token per
// line). This module reassembles inmate rows from that stream.
//
// Observed columns: Name, XREF, Housing, Classification, Gender, DOB.
// There is no booking number or booking date on the page; the roster header date
// (and/or the operator-supplied roster date) is used as bookedAt so normalization
// can proceed. Identity leans on XREF (externalPersonId).
// ============================================================================

import type { IngestionIssue, RawRecord } from '../types.js';

const ROSTER_MARKER = /Active\s+Inmate\s+Basic\s+Roster/i;
const HEADER_DATE_RE = /(\d{2}\/\d{2}\/\d{4})\s+\d{1,2}:\d{2}/;
const RECORD_RE =
  /([A-Z][A-Z'\-]+,\s*[A-Z][A-Z'\- ]*?)\s+(\d{6,8})\s+(MAIN\b.*?)\s+\b([MFX])\s+(\d{2}\/\d{2}\/\d{4})/g;

export function isActiveInmateBasicRoster(text: string): boolean {
  return ROSTER_MARKER.test(text);
}

/** Roster date from the document header, as MM/DD/YYYY, or null. */
export function extractJailScanRosterDate(text: string): string | null {
  const flat = text.replace(/\s+/g, ' ');
  const marker = flat.search(ROSTER_MARKER);
  const window = marker >= 0 ? flat.slice(marker, marker + 120) : flat.slice(0, 400);
  const match = window.match(HEADER_DATE_RE) ?? flat.match(HEADER_DATE_RE);
  return match?.[1] ?? null;
}

export interface JailScanParseResult {
  records: RawRecord[];
  rosterDate: string | null;
  issues: IngestionIssue[];
}

/**
 * Parse an Active Inmate Basic Roster text layer into RawRecords keyed for the
 * Sacramento column map (Name, XREF, DOB, Gender, Housing, Booked, Booking Number).
 *
 * @param fallbackRosterDate ISO or MM/DD/YYYY from the operator / filename when
 *   the header date cannot be read.
 */
export function parseActiveInmateBasicRoster(
  text: string,
  fallbackRosterDate?: string,
): JailScanParseResult {
  const issues: IngestionIssue[] = [];
  const headerDate = extractJailScanRosterDate(text);
  const booked = toMmDdYyyy(headerDate ?? fallbackRosterDate);
  if (!booked) {
    issues.push({
      severity: 'error',
      code: 'jail_scan_missing_roster_date',
      message:
        'Active Inmate Basic Roster has no booking date column; the header roster date ' +
        'could not be read and no fallback roster date was supplied.',
    });
    return { records: [], rosterDate: null, issues };
  }

  const flat = text.replace(/\s+/g, ' ').trim();
  const records: RawRecord[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;
  RECORD_RE.lastIndex = 0;
  while ((match = RECORD_RE.exec(flat)) !== null) {
    const name = collapseName(match[1]!);
    const xref = match[2]!;
    const housing = cleanupHousing(match[3]!);
    const sex = match[4]!;
    const dob = match[5]!;
    const key = `${xref}|${name}|${dob}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // Classification tokens (MINIMUM/MEDIUM/MAXIMUM SECURITY) sit inside the
    // housing capture on this layout — split them into a dedicated field.
    const classMatch = housing.match(/\b((?:MINIMUM|MEDIUM|MAXIMUM)\s+SECURITY)\b/i);
    const classification = classMatch ? classMatch[1]!.toUpperCase().replace(/\s+/g, ' ') : '';
    const housingOnly = housing
      .replace(/\b(MINIMUM|MEDIUM|MAXIMUM)\s+SECURITY\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    records.push({
      Name: name,
      XREF: xref,
      'Booking Number': `${xref}@${booked}`,
      DOB: dob,
      Gender: sex,
      Housing: housingOnly || housing,
      Classification: classification,
      Booked: booked,
      __lineNumber: String(records.length + 1),
    });
  }

  if (records.length === 0) {
    issues.push({
      severity: 'error',
      code: 'jail_scan_no_rows',
      message:
        'Active Inmate Basic Roster was detected but no Name/XREF/Gender/DOB rows could be reassembled.',
    });
  } else {
    issues.push({
      severity: 'info',
      code: 'jail_scan_layout',
      message:
        `Parsed ${records.length} inmate row(s) from Active Inmate Basic Roster ` +
        `(roster date ${booked}${headerDate ? ' from header' : ' from fallback'}).`,
    });
  }

  return { records, rosterDate: booked, issues };
}

function collapseName(raw: string): string {
  return raw.replace(/\s+/g, ' ').replace(/,\s*/, ', ').trim();
}

function cleanupHousing(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

/** Accept MM/DD/YYYY or YYYY-MM-DD; return MM/DD/YYYY. */
function toMmDdYyyy(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  const us = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) {
    return `${us[1]!.padStart(2, '0')}/${us[2]!.padStart(2, '0')}/${us[3]}`;
  }
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[2]}/${iso[3]}/${iso[1]}`;
  return null;
}
