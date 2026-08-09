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

/**
 * Version of the normalization rules.
 *
 * Stamped onto every batch and every intelligence item so a conclusion can be
 * attributed to the rules that produced it. Bump this whenever a change here could
 * alter a normalized value — a date format, a name-splitting rule, a sex or race
 * mapping — because that is exactly the kind of change a reprocessing run needs to
 * be able to identify as the cause of a difference.
 */
export const NORMALIZATION_VERSION = '1.1.0';

/**
 * Height, as inches.
 *
 * Rosters write this several ways for the same person: `5'11"`, `5-11`, `511`,
 * `71`, `5 ft 11 in`. Parsed to a number so a range query is possible at all, and
 * refused rather than guessed when the result would be outside human range — a
 * mis-parsed `511` becoming 511 inches is worse than an absent height, because a
 * number carries an authority that a blank does not.
 */
export function parseHeightInches(value: string | undefined | null): number | undefined {
  const text = cleanText(value).toUpperCase();
  if (!text) return undefined;

  // 5'11", 5-11, 5 ft 11 in, 5FT11
  const feetInches = /^(\d)\s*(?:'|-|FT\.?|FEET)\s*(\d{1,2})?\s*(?:"|IN\.?|INCHES)?$/.exec(text);
  if (feetInches) {
    const feet = Number(feetInches[1]);
    const inches = feetInches[2] ? Number(feetInches[2]) : 0;
    if (inches > 11) return undefined;
    const total = feet * 12 + inches;
    return total >= 24 && total <= 96 ? total : undefined;
  }

  // 511 meaning 5'11" — a common roster shorthand. Constrained to four to seven feet,
  // because otherwise a weight of 205 in a mis-mapped column reads as 2 feet 5 inches
  // and passes the plausibility check below.
  const packed = /^([4-7])(\d{2})$/.exec(text);
  if (packed) {
    const inches = Number(packed[2]);
    if (inches <= 11) return Number(packed[1]) * 12 + inches;
  }

  // A plain inch count.
  const plain = /^(\d{2})$/.exec(text);
  if (plain) {
    const total = Number(plain[1]);
    return total >= 24 && total <= 96 ? total : undefined;
  }

  return undefined;
}

/** Weight in pounds. Refused outside a plausible range for the same reason. */
export function parseWeightPounds(value: string | undefined | null): number | undefined {
  const text = cleanText(value).toUpperCase().replace(/\s*(LBS?|POUNDS?)\.?$/, '');
  if (!text) return undefined;
  const match = /^(\d{2,3})$/.exec(text.trim());
  if (!match) return undefined;
  const pounds = Number(match[1]);
  return pounds >= 50 && pounds <= 700 ? pounds : undefined;
}

/**
 * A yes/no column.
 *
 * Returns undefined for anything unrecognised rather than false. "No outstanding
 * warrants" and "the roster did not say" are different claims, and only one of them
 * is safe to repeat.
 */
export function parseBoolean(value: string | undefined | null): boolean | undefined {
  const text = cleanText(value).toUpperCase();
  if (!text) return undefined;
  if (['Y', 'YES', 'TRUE', 'T', '1', 'X'].includes(text)) return true;
  if (['N', 'NO', 'FALSE', 'F', '0', 'NONE'].includes(text)) return false;
  return undefined;
}

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
/**
 * The name as it should be shown and printed.
 *
 * Keeps the hyphen in GARCIA-LOPEZ and the apostrophe in O'BRIEN, which the matching
 * form deliberately removes. Two forms are needed because they answer different
 * questions: matching must treat O'BRIEN and OBRIEN as the same surname, and a report
 * handed to a deputy must not spell a person's name wrong.
 *
 * Only for display. Nothing compares these, and no blocking key derives from them.
 */
export function displayNamePart(value: string | undefined | null): string {
  const cleaned = cleanText(value).toUpperCase().replace(/[.,]/g, '');
  const words = cleaned.split(' ').filter((w) => w && !HONORIFICS.has(w));
  return words.join(' ').trim();
}

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
  let displayLast: string | undefined;
  let displayFirst: string | undefined;
  let displayMiddle: string | undefined;

  const fullName = pick(row, map, 'fullName');
  if (fullName) {
    name = splitFullName(fullName, map.nameOrder);
    // A single name column is split on the matching form, so the display halves are
    // not recoverable from it without splitting twice. Left undefined rather than
    // guessed: the matching form is a correct name, just a punctuation-free one.
  } else {
    const last = normalizeNamePart(pick(row, map, 'last'));
    const first = normalizeNamePart(pick(row, map, 'first'));
    displayLast = displayNamePart(pick(row, map, 'last'));
    displayFirst = displayNamePart(pick(row, map, 'first'));
    displayMiddle = displayNamePart(pick(row, map, 'middle')) || undefined;
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
    // Only set when they differ from the matching form, so a name with no
    // punctuation does not carry a redundant second copy of itself.
    displayFirst: displayFirst && displayFirst !== name.first ? displayFirst : undefined,
    displayLast: displayLast && displayLast !== name.last ? displayLast : undefined,
    displayMiddle: displayMiddle && displayMiddle !== name.middle ? displayMiddle : undefined,
    dateOfBirth,
    sex: normalizeSex(pick(row, map, 'sex')),
    race: normalizeRace(pick(row, map, 'race')),
    facility: map.facility,
    externalBookingId: cleanText(pick(row, map, 'externalBookingId')) || undefined,
    externalPersonId: cleanText(pick(row, map, 'externalPersonId')).toUpperCase() || undefined,
    bookedAt,
    releasedAt: parseDateTime(pick(row, map, 'releasedAt'), map.dateFormats),
    arrestingAgency: cleanText(pick(row, map, 'arrestingAgency')) || undefined,
    bailAmountCents: parseMoneyCents(pick(row, map, 'bailAmount')),
    housingLocation: cleanText(pick(row, map, 'housingLocation')) || undefined,
    charges: parseCharges(pick(row, map, 'charges'), map.chargeSeparator ?? ';'),

    // A forecast, kept apart from the recorded release date above.
    projectedReleaseAt: parseDateTime(pick(row, map, 'projectedReleaseAt'), map.dateFormats),
    arrestType: cleanText(pick(row, map, 'arrestType')) || undefined,
    courtDate: parseDate(pick(row, map, 'courtDate'), map.dateFormats),
    courtName: cleanText(pick(row, map, 'courtName')) || undefined,
    outstandingWarrants: parseBoolean(pick(row, map, 'outstandingWarrants')),
    heightInches: parseHeightInches(pick(row, map, 'height')),
    weightPounds: parseWeightPounds(pick(row, map, 'weight')),
  };

  return { record, issues };
}
