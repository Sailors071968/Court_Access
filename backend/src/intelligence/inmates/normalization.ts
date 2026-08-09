// ============================================================================
// Normalization engine.
//
// Both parsers converge here before anything is matched, so CSV and PDF rosters
// are compared on the same footing. Everything in this file is a pure function
// of its input: normalization is where matching errors originate, and a pure
// function is one that can be tested exhaustively without a database.
//
// The rule throughout: never invent information. A field that cannot be read
// confidently becomes undefined, and the caller raises an issue. Guessing at a
// date of birth is worse than not having one, because a wrong date of birth
// matches the wrong person.
// ============================================================================

import type {
  CanonicalField, ChargeSeverity, ColumnMap, DateFormat,
  NormalizedCharge, NormalizedRecord, RawRecord, Sex,
} from './types.js';

/** Honorifics and noise that rosters add to names and matching must ignore. */
const HONORIFICS = new Set(['MR', 'MRS', 'MS', 'MISS', 'DR', 'SIR', 'REV', 'FR', 'HON']);

/** Generational suffixes, separated from the surname so they do not defeat a match. */
const SUFFIXES = new Set(['JR', 'SR', 'I', 'II', 'III', 'IV', 'V', 'VI']);

/** Sex codes observed in county rosters. Anything else is unknown, not guessed. */
const SEX_CODES: Record<string, Sex> = {
  M: 'M', MALE: 'M', '1': 'M',
  F: 'F', FEMALE: 'F', '2': 'F',
  X: 'X', U: 'unknown', UNKNOWN: 'unknown', '': 'unknown',
};

/** California code abbreviations as rosters write them. */
const STATUTE_CODES: Record<string, string> = {
  PC: 'PEN', PEN: 'PEN', PENAL: 'PEN',
  HS: 'HSC', HSC: 'HSC', 'H&S': 'HSC',
  VC: 'VEH', VEH: 'VEH',
  BP: 'BPC', BPC: 'BPC',
  WI: 'WIC', WIC: 'WIC',
  FC: 'FAM', FAM: 'FAM',
};

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

/** Collapse whitespace, strip control characters, trim. */
export function cleanText(value: string | undefined | null): string {
  if (!value) return '';
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * The form names are compared in: upper case, no punctuation, no honorifics.
 * Hyphens and apostrophes are removed rather than replaced with a space, so
 * "O'Brien" and "OBrien" — the same person, spelled two ways by two clerks —
 * normalize identically.
 */
export function normalizeNamePart(value: string | undefined | null): string {
  const cleaned = cleanText(value).toUpperCase().replace(/[.,]/g, '');
  const withoutPunctuation = cleaned.replace(/['\u2019\-]/g, '');
  const words = withoutPunctuation.split(' ').filter((w) => w && !HONORIFICS.has(w));
  return words.join(' ').trim();
}

export interface SplitName {
  first: string;
  last: string;
  middle?: string;
  suffix?: string;
}

/**
 * Split a single name cell into parts.
 *
 * A comma is authoritative — "SMITH, JOHN A" is unambiguous regardless of the
 * facility's declared order — so it is honoured before `nameOrder` is consulted.
 * Without one, the declared order decides, because guessing from word count is
 * wrong often enough to matter on names like "DE LA CRUZ".
 */
export function splitFullName(raw: string, nameOrder: 'last_first' | 'first_last'): SplitName | null {
  const value = normalizeNamePart(raw);
  if (!value) return null;

  let head: string;
  let tail: string;

  if (raw.includes(',')) {
    const [beforeComma, ...rest] = raw.split(',');
    head = normalizeNamePart(beforeComma);
    tail = normalizeNamePart(rest.join(' '));
    if (!tail) return { first: '', last: head };
    return withSuffix(splitParts(tail, head));
  }

  const words = value.split(' ');
  if (words.length === 1) return { first: '', last: words[0] };

  if (nameOrder === 'last_first') {
    head = words[0];
    tail = words.slice(1).join(' ');
    return withSuffix(splitParts(tail, head));
  }
  // first_last: the final word is the surname.
  const last = words[words.length - 1];
  const rest = words.slice(0, -1).join(' ');
  return withSuffix(splitParts(rest, last));
}

/** `given` is "FIRST [MIDDLE...]", `last` is the surname. */
function splitParts(given: string, last: string): SplitName {
  const words = given.split(' ').filter(Boolean);
  return {
    first: words[0] ?? '',
    middle: words.length > 1 ? words.slice(1).join(' ') : undefined,
    last,
  };
}

/** Move a generational suffix out of whichever part it landed in. */
function withSuffix(name: SplitName): SplitName {
  const out = { ...name };
  for (const key of ['last', 'middle', 'first'] as const) {
    const value = out[key];
    if (!value) continue;
    const words = value.split(' ');
    const tail = words[words.length - 1];
    if (words.length > 1 && SUFFIXES.has(tail)) {
      out.suffix = tail;
      out[key] = words.slice(0, -1).join(' ');
    } else if (words.length === 1 && SUFFIXES.has(tail) && key !== 'last') {
      out.suffix = tail;
      out[key] = undefined as unknown as string;
    }
  }
  if (!out.middle) delete out.middle;
  return out;
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

/** Nobody in a county jail was born before this, and nobody is born later than today. */
const EARLIEST_BIRTH_YEAR = 1900;

/**
 * Parse a date against the formats the facility declares, in order.
 *
 * Ambiguity is refused rather than resolved: `03/04/2020` is a different day
 * under `mm/dd/yyyy` than under `dd/mm/yyyy`, so the facility's column map has
 * to say which, and a format that produces an implausible date is rejected
 * instead of accepted with a shrug.
 */
export function parseDate(raw: string | undefined, formats: DateFormat[]): string | undefined {
  const value = cleanText(raw);
  if (!value) return undefined;

  for (const format of formats) {
    const parsed = tryFormat(value, format);
    if (parsed) return parsed;
  }
  return undefined;
}

function tryFormat(value: string, format: DateFormat): string | undefined {
  if (format === 'iso' || format === 'yyyy-mm-dd') {
    const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(value);
    if (m) return build(Number(m[1]), Number(m[2]), Number(m[3]));
    // A full ISO datetime is also acceptable here.
    const t = Date.parse(value);
    if (format === 'iso' && !Number.isNaN(t)) {
      const d = new Date(t);
      return build(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    }
    return undefined;
  }

  const m = /^(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})/.exec(value);
  if (!m) return undefined;
  const a = Number(m[1]);
  const b = Number(m[2]);
  let year = Number(m[3]);
  // A two-digit year is this century when it is not in the future, last
  // century otherwise. "68" is 1968; "05" is 2005.
  if (year < 100) {
    const currentTwoDigit = new Date().getUTCFullYear() % 100;
    year += year <= currentTwoDigit ? 2000 : 1900;
  }
  return format === 'dd/mm/yyyy' ? build(year, b, a) : build(year, a, b);
}

function build(year: number, month: number, day: number): string | undefined {
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  if (year < EARLIEST_BIRTH_YEAR || year > new Date().getUTCFullYear() + 1) return undefined;
  const d = new Date(Date.UTC(year, month - 1, day));
  // Rejects 31 February, which the constructor would otherwise roll forward.
  if (d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return undefined;
  return d.toISOString().slice(0, 10);
}

/** A booking timestamp, which may carry a time. Falls back to the date alone. */
export function parseDateTime(raw: string | undefined, formats: DateFormat[]): string | undefined {
  const value = cleanText(raw);
  if (!value) return undefined;
  const t = Date.parse(value);
  if (!Number.isNaN(t)) {
    const year = new Date(t).getUTCFullYear();
    if (year >= EARLIEST_BIRTH_YEAR && year <= new Date().getUTCFullYear() + 1) {
      return new Date(t).toISOString();
    }
  }
  const dateOnly = parseDate(value, formats);
  return dateOnly ? `${dateOnly}T00:00:00.000Z` : undefined;
}

// ---------------------------------------------------------------------------
// Coded fields
// ---------------------------------------------------------------------------

export function normalizeSex(raw: string | undefined): Sex {
  const key = cleanText(raw).toUpperCase();
  return SEX_CODES[key] ?? 'unknown';
}

/** Kept as written, cleaned. Race vocabularies differ per facility and
 *  collapsing them into a single scheme would be inventing information. */
export function normalizeRace(raw: string | undefined): string | undefined {
  const value = cleanText(raw).toUpperCase();
  return value || undefined;
}

/** Currency to integer cents, so no total is ever a float. */
export function parseMoneyCents(raw: string | undefined): bigint | undefined {
  const value = cleanText(raw).replace(/[$,]/g, '');
  if (!value || !/^\d+(\.\d{1,2})?$/.test(value)) return undefined;
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}

// ---------------------------------------------------------------------------
// Charges
// ---------------------------------------------------------------------------

/**
 * Split a charge cell into structured charges.
 *
 * `rawText` is always retained. Charge text is the least consistent field on a
 * roster, so when the parse below is wrong the original is still there to read,
 * and `statuteSection` being undefined is an honest outcome rather than a bug.
 */
export function parseCharges(raw: string | undefined, separator = ';'): NormalizedCharge[] {
  const value = cleanText(raw);
  if (!value) return [];

  return value
    .split(separator)
    .map((part) => cleanText(part))
    .filter(Boolean)
    .map((rawText) => {
      const charge: NormalizedCharge = { severity: 'unknown', counts: 1, rawText };

      // e.g. "PC 459 - BURGLARY (F)" or "VC12500(a) DRIVING W/O LICENSE"
      const statute = /\b([A-Z&]{2,5})\s*[.\s]?\s*(\d+(?:\.\d+)?(?:\([a-z0-9]+\))*)/.exec(rawText.toUpperCase());
      if (statute) {
        const code = STATUTE_CODES[statute[1]];
        if (code) {
          charge.statuteCode = code;
          charge.statuteSection = statute[2].toLowerCase();
        }
      }

      const severity = detectSeverity(rawText);
      if (severity) charge.severity = severity;

      const counts = /\b(\d+)\s*(?:CTS?|COUNTS?)\b/i.exec(rawText);
      if (counts) charge.counts = Math.max(1, Number(counts[1]));

      const description = rawText
        .replace(/\b[A-Z&]{2,5}\s*[.\s]?\s*\d+(?:\.\d+)?(?:\([a-z0-9]+\))*/i, '')
        .replace(/[()\-]{1,2}\s*[FMI]\s*$/i, '')
        .replace(/^[\s\-:]+/, '')
        .trim();
      if (description) charge.description = description;

      return charge;
    });
}

function detectSeverity(text: string): ChargeSeverity | undefined {
  const upper = text.toUpperCase();
  if (/\bFELONY\b/.test(upper) || /\(\s*F\s*\)/.test(upper)) return 'felony';
  if (/\bMISDEMEANOR\b/.test(upper) || /\bMISD\b/.test(upper) || /\(\s*M\s*\)/.test(upper)) return 'misdemeanor';
  if (/\bINFRACTION\b/.test(upper) || /\(\s*I\s*\)/.test(upper)) return 'infraction';
  return undefined;
}

// ---------------------------------------------------------------------------
// Row normalization
// ---------------------------------------------------------------------------

export interface NormalizeOutcome {
  record?: NormalizedRecord;
  issues: { severity: 'warning' | 'error'; code: string; message: string }[];
}

/** Case-insensitive header lookup against a column map. */
function pick(row: RawRecord, map: ColumnMap, field: CanonicalField): string | undefined {
  const candidates = map.fields[field];
  if (!candidates) return undefined;
  const lowered = new Map(Object.entries(row).map(([k, v]) => [k.trim().toLowerCase(), v]));
  for (const header of candidates) {
    const value = lowered.get(header.trim().toLowerCase());
    if (value !== undefined && cleanText(value)) return value;
  }
  return undefined;
}

/**
 * Turn one raw row into a NormalizedRecord, or explain why it cannot be.
 *
 * A row is rejected only when it lacks something a booking cannot exist
 * without: a surname and a booking date. Everything else degrades to a warning,
 * because a roster row missing a middle name is still a real arrest.
 */
export function normalizeRecord(row: RawRecord, map: ColumnMap): NormalizeOutcome {
  const issues: NormalizeOutcome['issues'] = [];

  let name: SplitName | null = null;
  const fullName = pick(row, map, 'fullName');
  if (fullName) {
    name = splitFullName(fullName, map.nameOrder);
  } else {
    const last = normalizeNamePart(pick(row, map, 'last'));
    const first = normalizeNamePart(pick(row, map, 'first'));
    if (last || first) {
      name = withSuffix({
        first,
        last,
        middle: normalizeNamePart(pick(row, map, 'middle')) || undefined,
      });
      const suffix = normalizeNamePart(pick(row, map, 'suffix'));
      if (suffix) name.suffix = suffix;
    }
  }

  if (!name || !name.last) {
    issues.push({ severity: 'error', code: 'missing_name', message: 'No surname could be read from the row.' });
    return { issues };
  }
  if (!name.first) {
    issues.push({ severity: 'warning', code: 'missing_first_name', message: `No given name for "${name.last}".` });
  }

  const bookedAt = parseDateTime(pick(row, map, 'bookedAt'), map.dateFormats);
  if (!bookedAt) {
    issues.push({
      severity: 'error',
      code: 'missing_booked_at',
      message: `No readable booking date for "${name.last}, ${name.first}".`,
    });
    return { issues };
  }

  const dateOfBirth = parseDate(pick(row, map, 'dateOfBirth'), map.dateFormats);
  if (!dateOfBirth && pick(row, map, 'dateOfBirth')) {
    issues.push({
      severity: 'warning',
      code: 'unparseable_dob',
      message: `Date of birth "${cleanText(pick(row, map, 'dateOfBirth'))}" did not parse under the facility's declared formats.`,
    });
  }

  const record: NormalizedRecord = {
    first: name.first,
    last: name.last,
    middle: name.middle,
    suffix: name.suffix,
    dateOfBirth,
    sex: normalizeSex(pick(row, map, 'sex')),
    race: normalizeRace(pick(row, map, 'race')),
    facility: map.facility,
    externalBookingId: cleanText(pick(row, map, 'externalBookingId')) || undefined,
    bookedAt,
    releasedAt: parseDateTime(pick(row, map, 'releasedAt'), map.dateFormats),
    arrestingAgency: cleanText(pick(row, map, 'arrestingAgency')) || undefined,
    bailAmountCents: parseMoneyCents(pick(row, map, 'bailAmount')),
    housingLocation: cleanText(pick(row, map, 'housingLocation')) || undefined,
    charges: parseCharges(pick(row, map, 'charges'), map.chargeSeparator ?? ';'),
  };

  return { record, issues };
}
