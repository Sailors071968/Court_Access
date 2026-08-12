// ============================================================================
// What kind of value is this column carrying?
//
// Inspection has to describe a file nobody has seen before, from its values rather
// than its header — because the header is exactly what cannot be trusted when a
// county renames a column.
//
// Every inference reports how sure it is and on how many values, so a column judged
// from three non-empty rows is not presented with the same authority as one judged
// from four hundred. A confident wrong answer here becomes a wrong parser profile,
// which becomes a repository of wrong data.
// ============================================================================

/** What the values look like. Deliberately about shape, not about meaning. */
export type InferredType =
  | 'date'
  | 'datetime'
  | 'money'
  | 'integer'
  | 'decimal'
  | 'boolean'
  | 'identifier'
  | 'person_name'
  | 'height'
  | 'code_list'
  | 'text'
  | 'empty'
  | 'mixed';

export interface ColumnStatistics {
  /** Rows examined, including empty ones. */
  rowsSeen: number;
  /** Rows carrying any value. The denominator for every rate below. */
  rowsPopulated: number;
  /** Distinct non-empty values, capped. */
  distinctValues: number;
  /** True when every populated value is distinct — the signature of an identifier. */
  looksUnique: boolean;
  minLength: number;
  maxLength: number;
  /** A handful of real values, for a human to look at. */
  samples: string[];
}

export interface TypeInference {
  type: InferredType;
  /** 0–100, how well the values fit. Not how useful the column is. */
  confidence: number;
  /** What the values looked like, in a sentence. */
  rationale: string;
  /** For a date column: the formats that parsed, most frequent first. */
  detectedFormats?: string[];
  statistics: ColumnStatistics;
}

const MONEY = /^\$?\s*-?\d{1,3}(,\d{3})*(\.\d{1,2})?$|^\$?\s*-?\d+(\.\d{1,2})?$/;
const INTEGER = /^-?\d+$/;
const DECIMAL = /^-?\d+\.\d+$/;
const MDY = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/;
const YMD = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
const DMY_DOTTED = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/;
const TIME_SUFFIX = /\s+\d{1,2}:\d{2}(:\d{2})?(\s*[AP]M)?$/i;
// The packed form (511 meaning 5'11") is constrained to plausible heights: four to
// seven feet, and inches under twelve. Without that, a weight of 180 and a bail of 205
// both read as heights.
const HEIGHT = /^\d\s*(?:'|-|ft\.?)\s*\d{0,2}\s*(?:"|in\.?)?$|^[4-7](?:0[0-9]|1[01])$/i;
const BOOLEANS = new Set(['Y', 'N', 'YES', 'NO', 'TRUE', 'FALSE', 'T', 'F', '0', '1']);
/** Identifiers carry digits and structure; names do not. */
const IDENTIFIER = /^[A-Z0-9][A-Z0-9\-_/]{2,}$/i;
const PERSON_NAME = /^[A-Z][A-Z' .-]*$/i;

/**
 * Describe a column from its values.
 *
 * The order of tests matters: money before decimal (because `1,250.00` is both), date
 * before integer (because `08092026` is neither, but `2026` alone is an integer), and
 * boolean before code list (because two distinct values could be either and boolean is
 * the more useful answer).
 */
export function inferColumnType(values: string[]): TypeInference {
  const rowsSeen = values.length;
  const populated = values.map((v) => (v ?? '').trim()).filter((v) => v !== '');
  const distinct = new Set(populated);

  const statistics: ColumnStatistics = {
    rowsSeen,
    rowsPopulated: populated.length,
    distinctValues: distinct.size,
    // A single row is trivially unique, which says nothing. Two is the minimum at
    // which uniqueness is a signal rather than an artefact.
    looksUnique: populated.length >= 2 && distinct.size === populated.length,
    minLength: populated.length === 0 ? 0 : Math.min(...populated.map((v) => v.length)),
    maxLength: populated.length === 0 ? 0 : Math.max(...populated.map((v) => v.length)),
    samples: [...distinct].slice(0, 6),
  };

  if (populated.length === 0) {
    return {
      type: 'empty',
      confidence: 100,
      rationale: `No value in any of ${rowsSeen} row(s). The column exists but the export left it blank, which is different from the column being absent.`,
      statistics,
    };
  }

  const rate = (predicate: (v: string) => boolean): number =>
    populated.filter(predicate).length / populated.length;

  // --- Dates, and which formats parsed ------------------------------------
  const dateFormats = new Map<string, number>();
  let dateLike = 0;
  let withTime = 0;
  for (const value of populated) {
    const bare = value.replace(TIME_SUFFIX, '');
    if (bare !== value) withTime += 1;
    if (MDY.test(bare)) { dateFormats.set('mm/dd/yyyy', (dateFormats.get('mm/dd/yyyy') ?? 0) + 1); dateLike += 1; }
    else if (YMD.test(bare)) { dateFormats.set('yyyy-mm-dd', (dateFormats.get('yyyy-mm-dd') ?? 0) + 1); dateLike += 1; }
    else if (DMY_DOTTED.test(bare)) { dateFormats.set('dd.mm.yyyy', (dateFormats.get('dd.mm.yyyy') ?? 0) + 1); dateLike += 1; }
  }
  const dateRate = dateLike / populated.length;

  if (dateRate >= 0.8) {
    const formats = [...dateFormats.entries()].sort((a, b) => b[1] - a[1]).map(([f]) => f);
    const hasTime = withTime / populated.length >= 0.5;
    return {
      type: hasTime ? 'datetime' : 'date',
      confidence: Math.round(dateRate * 100),
      rationale: `${Math.round(dateRate * 100)}% of ${populated.length} value(s) parse as ${formats.join(' or ')}${
        hasTime ? ', with a time component' : ''}.${
        formats.length > 1 ? ' More than one format is present, which usually means the export was assembled from two sources.' : ''}`,
      detectedFormats: formats,
      statistics,
    };
  }

  // --- Money --------------------------------------------------------------
  const moneyRate = rate((v) => MONEY.test(v));
  const currencyMarked = rate((v) => v.includes('$') || v.includes(','));

  // A bare integer is a valid currency amount, so weight (180) and bail (50000) match
  // the same pattern. Magnitude is the only signal available from values alone: a
  // three-digit bare number is a weight or a height, not a bail figure. Stated as a
  // heuristic because it is one — a $500 bail exists, and only the header distinguishes
  // it, which is why the suggestion scoring weighs header and values together.
  const bareSmallIntegers = currencyMarked === 0
    && rate((v) => INTEGER.test(v)) >= 0.9
    && statistics.maxLength <= 3;
  // A bail column also carries words: NO BAIL, PC 1275, HOLD. Those are meaningful
  // absences rather than noise, so a column that is mostly numeric and partly words
  // is still money — and the words are reported.
  const moneyWords = populated.filter((v) => /^(NO BAIL|NOBAIL|NONE|HOLD|PC ?1275|N\/A|\$0)$/i.test(v));
  if (!bareSmallIntegers && (moneyRate >= 0.7 || (moneyRate >= 0.5 && currencyMarked > 0.2))) {
    return {
      type: 'money',
      confidence: Math.round(Math.min(100, moneyRate * 100 + (currencyMarked > 0.2 ? 10 : 0))),
      rationale: `${Math.round(moneyRate * 100)}% of values are currency amounts${
        currencyMarked > 0.2 ? ' with $ or thousands separators' : ''}.${
        moneyWords.length > 0
          ? ` ${moneyWords.length} row(s) carry words instead: ${[...new Set(moneyWords)].slice(0, 3).join(', ')} — those are statements about bail, not missing data.`
          : ''}`,
      statistics,
    };
  }

  // --- Boolean ------------------------------------------------------------
  if (distinct.size <= 3 && rate((v) => BOOLEANS.has(v.toUpperCase())) >= 0.9) {
    return {
      type: 'boolean',
      confidence: 95,
      rationale: `Only ${distinct.size} distinct value(s), all yes/no forms: ${statistics.samples.join(', ')}.`,
      statistics,
    };
  }

  // --- Height, checked before identifier because 511 matches both ---------
  const heightRate = rate((v) => HEIGHT.test(v));
  if (heightRate >= 0.8 && statistics.maxLength <= 7) {
    return {
      type: 'height',
      confidence: Math.round(heightRate * 90),
      rationale: `${Math.round(heightRate * 100)}% of values look like heights in feet and inches (${statistics.samples.slice(0, 3).join(', ')}). Short numeric columns are ambiguous, so confirm against the header before mapping.`,
      statistics,
    };
  }

  // --- Numbers ------------------------------------------------------------
  if (rate((v) => INTEGER.test(v)) >= 0.9) {
    return {
      type: 'integer',
      confidence: 90,
      rationale: `All values are whole numbers, ${statistics.minLength}–${statistics.maxLength} digits.${
        statistics.looksUnique ? ' Every value is distinct, so this may be an identifier rather than a quantity.' : ''}`,
      statistics,
    };
  }
  if (rate((v) => DECIMAL.test(v)) >= 0.9) {
    return { type: 'decimal', confidence: 90, rationale: 'All values are decimal numbers.', statistics };
  }

  // --- Identifier ---------------------------------------------------------
  // Uniqueness is the signal, not the shape: a booking number column is unique by
  // definition, and that is more reliable than any pattern.
  if (statistics.looksUnique && rate((v) => IDENTIFIER.test(v)) >= 0.8 && rate((v) => /\d/.test(v)) >= 0.5) {
    return {
      type: 'identifier',
      confidence: 88,
      rationale: `Every one of ${populated.length} value(s) is distinct and mixes letters and digits (${statistics.samples.slice(0, 3).join(', ')}) — the shape of a booking or subject number.`,
      statistics,
    };
  }

  // --- Code list ----------------------------------------------------------
  // Few distinct values across many rows: a facility, an agency, a sex code.
  if (populated.length >= 5 && distinct.size <= Math.max(2, Math.floor(populated.length / 3))) {
    return {
      type: 'code_list',
      confidence: 80,
      rationale: `${distinct.size} distinct value(s) across ${populated.length} row(s) — a fixed vocabulary rather than free text: ${statistics.samples.slice(0, 4).join(', ')}.`,
      statistics,
    };
  }

  // --- Names --------------------------------------------------------------
  if (rate((v) => PERSON_NAME.test(v)) >= 0.85 && statistics.maxLength <= 40 && !statistics.looksUnique) {
    return {
      type: 'person_name',
      confidence: 70,
      rationale: `Letters, apostrophes and hyphens only, up to ${statistics.maxLength} characters — consistent with a name, though a place or agency looks the same.`,
      statistics,
    };
  }
  if (rate((v) => PERSON_NAME.test(v)) >= 0.85 && statistics.maxLength <= 40) {
    return {
      type: 'person_name',
      confidence: 60,
      rationale: `Consistent with a name, but every value is distinct, so this could equally be any free-text column with one value per row.`,
      statistics,
    };
  }

  const mixedShapes = new Set(populated.slice(0, 50).map(shapeOf)).size;
  return {
    type: mixedShapes > 4 ? 'mixed' : 'text',
    confidence: mixedShapes > 4 ? 40 : 60,
    rationale: mixedShapes > 4
      ? `Values take ${mixedShapes} different shapes, so this column probably holds more than one kind of thing — a charge list, or two fields that were concatenated.`
      : `Free text, ${statistics.minLength}–${statistics.maxLength} characters.`,
    statistics,
  };
}

/** A crude signature, used only to notice that a column is not homogeneous. */
function shapeOf(value: string): string {
  return value
    .replace(/[A-Za-z]+/g, 'A')
    .replace(/\d+/g, '9')
    .replace(/\s+/g, ' ')
    .slice(0, 12);
}
