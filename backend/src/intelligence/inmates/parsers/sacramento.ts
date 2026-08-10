// ============================================================================
// Sacramento County — the only county in Phase 2 scope.
//
// Two profiles, because the two sources are genuinely different documents: the CSV
// export is machine-written and one row per booking, while the PDF roster is a
// paginated listing whose text layer (or OCR output) has to be reassembled into
// rows. They disagree about the spelling of the same column, so one profile with
// both sets of aliases would hide which document a value came from.
//
// The field vocabulary is taken from the Sheriff's own description of what the
// roster contains — name, date of birth, booking date and time, X-reference number,
// booking/registry number, sex, height, weight, outstanding warrants, projected
// release date, charges, bail, arresting agency, type of arrest, holding facility,
// housing location, next court date, and the court hearing the case.
//
// It is NOT taken from a sample file, because Sacramento County publishes no bulk
// export: the public source is a search portal, and a CSV or PDF roster comes from a
// records request or a data vendor. So the header spellings below are candidates,
// deliberately generous, and the validation rules exist to make a wrong guess fail
// loudly on the first import rather than quietly produce a roster of nulls.
//
// Correct these against a real export by publishing a NEW profile version. Never by
// editing one: the old version is the only accurate description of how the documents
// already imported were read.
// ============================================================================

import type { ColumnMap } from '../types.js';

/**
 * What a profile promises about the document it reads.
 *
 * Separate from the column map because a map says "this header means that field"
 * while these say "a document that does not look like this is not the document this
 * profile describes". Without them a changed export imports with most columns
 * unmapped, and a roster of nulls looks exactly like a quiet day at the jail.
 */
export interface ValidationRules {
  /** Headers that must be present, by canonical field. A missing one fails the batch. */
  requiredFields: string[];
  /**
   * Fields expected on most rows. Below the threshold the batch is flagged rather
   * than failed: a jail genuinely publishes rows with no bail and no charges, so a
   * hard rule here would refuse real data.
   */
  expectedCoverage: { field: string; minimumPercent: number }[];
  /** A roster smaller than this is suspicious — a truncated download, not a quiet day. */
  minimumRows: number;
  /** Above this proportion of unparseable rows, the document is the wrong shape. */
  maximumRowFailurePercent: number;
  /** Headers the profile does not recognise. Reported, never silently dropped. */
  unmappedHeadersAreErrors: boolean;
}

export interface SacramentoProfile {
  facility: string;
  sourceType: 'csv' | 'pdf_text' | 'pdf_ocr';
  version: number;
  label: string;
  effectiveFrom: string;
  changeNote: string;
  /** The header row this profile was written against, in order, for comparison. */
  expectedHeaders: string[];
  columnMap: ColumnMap;
  normalizationRules: string[];
  validation: ValidationRules;
}

/** Shared field aliases. Both documents describe the same jail. */
const SACRAMENTO_FIELDS: ColumnMap['fields'] = {
  fullName: ['name', 'inmate name', 'inmate', 'defendant name', 'full name'],
  last: ['last name', 'last', 'lastname', 'surname'],
  first: ['first name', 'first', 'firstname'],
  middle: ['middle name', 'middle', 'mi', 'middle initial'],
  suffix: ['suffix', 'sfx'],
  dateOfBirth: ['dob', 'date of birth', 'birth date', 'birthdate'],
  sex: ['sex', 'gender'],
  // Sacramento's published roster describes sex but not race. Mapped anyway, because
  // an export that carries it should not have it discarded.
  race: ['race', 'ethnicity', 'descent'],

  // Two different identifiers, and conflating them would be the worst single mistake
  // available here. The booking number identifies one stay; the X-Ref identifies the
  // person across every stay, and it is what makes identity resolution reliable.
  externalBookingId: ['booking number', 'booking #', 'booking no', 'bkg #', 'bkg no',
                      'registry number', 'registry #', 'book #', 'booking id', 'booking'],
  externalPersonId: ['x-ref', 'xref', 'x ref', 'x-ref number', 'xref number',
                     'so #', 'so number', 'main id', 'subject number', 'inmate #'],

  bookedAt: ['booking date', 'booking date and time', 'booking date/time', 'booked',
             'book date', 'intake date', 'arrest date', 'date booked'],
  releasedAt: ['release date', 'released', 'release date/time', 'actual release'],
  // A forecast. Never mapped onto releasedAt.
  projectedReleaseAt: ['projected release date', 'projected release', 'expected release',
                       'scheduled release', 'proj release'],

  arrestingAgency: ['arresting agency', 'agency', 'arr agency', 'law enforcement agency'],
  arrestType: ['type of arrest', 'arrest type', 'arrest reason'],
  bailAmount: ['bail', 'bail amount', 'total bail', 'bond', 'bond amount'],
  housingLocation: ['housing location', 'housing', 'location', 'cell', 'pod', 'unit', 'bed'],
  charges: ['charges', 'charge', 'charge description', 'offense', 'offenses', 'charge(s)'],
  courtDate: ['next court date', 'court date', 'court appearance', 'arraignment date'],
  courtName: ['court', 'court name', 'hearing court', 'court location'],
  outstandingWarrants: ['outstanding warrants', 'warrants', 'holds', 'warrant'],
  height: ['height', 'ht'],
  weight: ['weight', 'wt'],
};

/**
 * The CSV export.
 *
 * One row per booking. Machine-written, so it is the more authoritative source when
 * the two disagree — which is why cross-source reconciliation prefers it over the PDF.
 */
export const SACRAMENTO_CSV: SacramentoProfile = {
  facility: 'sacramento',
  sourceType: 'csv',
  version: 1,
  label: 'Sacramento County Main Jail — CSV export',
  effectiveFrom: '2020-01-01',
  changeNote:
    'Initial profile. Field vocabulary from the Sheriff\'s published description of the roster; header spellings are candidates until a real export is available. Correct by publishing v2, not by editing this.',
  expectedHeaders: [
    'Booking Number', 'X-Ref', 'Last Name', 'First Name', 'Middle Name',
    'DOB', 'Sex', 'Height', 'Weight',
    'Booking Date', 'Arresting Agency', 'Type of Arrest',
    'Facility', 'Housing Location', 'Charges', 'Bail',
    'Outstanding Warrants', 'Projected Release Date', 'Next Court Date', 'Court',
  ],
  columnMap: {
    facility: 'sacramento',
    label: 'Sacramento County Main Jail — CSV export',
    // The county writes mm/dd/yyyy; ISO is accepted because some exports normalise it.
    dateFormats: ['mm/dd/yyyy', 'iso', 'yyyy-mm-dd'],
    nameOrder: 'last_first',
    chargeSeparator: ';',
    fields: SACRAMENTO_FIELDS,
  },
  normalizationRules: [
    'Names uppercased; punctuation removed for matching, preserved for display.',
    'Dates parsed as mm/dd/yyyy first, then ISO. An unparseable date of birth is left absent rather than guessed.',
    'Bail parsed to integer cents. "NO BAIL" and "PC 1275" are recorded as absent, not zero — no bail set and bail of zero are different facts.',
    'Height parsed to inches from feet-and-inches or packed notation; refused outside 24–96 inches.',
    'Weight parsed to pounds; refused outside 50–700.',
    'Charges split on ";" then parsed for statute, section and severity.',
    'Outstanding warrants: only recognised yes/no values become a boolean; anything else stays absent.',
    'Projected release date recorded separately from an actual release date.',
  ],
  validation: {
    requiredFields: ['bookedAt'],
    expectedCoverage: [
      // A booking with no number is possible; a roster where most rows lack one is
      // the wrong document or a mis-mapped column.
      { field: 'externalBookingId', minimumPercent: 80 },
      { field: 'last', minimumPercent: 95 },
      { field: 'dateOfBirth', minimumPercent: 70 },
      // The X-Ref is what identity resolution leans on hardest, so a drop here is
      // worth knowing about even though the import can proceed without it.
      { field: 'externalPersonId', minimumPercent: 60 },
      { field: 'charges', minimumPercent: 70 },
    ],
    minimumRows: 5,
    maximumRowFailurePercent: 10,
    unmappedHeadersAreErrors: false,
  },
};

/**
 * The PDF roster.
 *
 * A paginated listing rather than a table. Its text layer is read directly when
 * present and OCR'd when not, and OCR output is the least reliable source in the
 * system — which is why the profile expects less of it and why reconciliation gives
 * the CSV precedence.
 */
export const SACRAMENTO_PDF: SacramentoProfile = {
  facility: 'sacramento',
  sourceType: 'pdf_text',
  version: 1,
  label: 'Sacramento County Main Jail — PDF roster',
  effectiveFrom: '2020-01-01',
  changeNote:
    'Initial profile. The PDF is a paginated listing, not a table; layout is inferred per page. Expect to publish v2 once a real roster is available.',
  expectedHeaders: [
    'Booking Number', 'Name', 'DOB', 'Sex', 'Booked', 'Housing', 'Charges', 'Bail',
  ],
  columnMap: {
    facility: 'sacramento',
    label: 'Sacramento County Main Jail — PDF roster',
    dateFormats: ['mm/dd/yyyy', 'iso'],
    nameOrder: 'last_first',
    chargeSeparator: ';',
    fields: SACRAMENTO_FIELDS,
  },
  normalizationRules: [
    'Same rules as the CSV profile — normalization is a property of the field, not the document.',
    'Page and row are recorded on every observation, so a value traces to a place in the PDF.',
    'OCR is used only when the page has no text layer, and the source type is recorded as pdf_ocr so the weaker provenance is visible.',
  ],
  validation: {
    requiredFields: ['bookedAt'],
    expectedCoverage: [
      // Lower than the CSV throughout: a PDF row that failed to reassemble loses
      // fields, and holding it to the CSV's standard would fail real rosters.
      { field: 'last', minimumPercent: 85 },
      { field: 'externalBookingId', minimumPercent: 60 },
      { field: 'dateOfBirth', minimumPercent: 50 },
    ],
    minimumRows: 5,
    maximumRowFailurePercent: 25,
    unmappedHeadersAreErrors: false,
  },
};

export const SACRAMENTO_PROFILES: SacramentoProfile[] = [SACRAMENTO_CSV, SACRAMENTO_PDF];

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface ValidationFinding {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
}

/**
 * Check a parsed document against the profile that read it.
 *
 * Runs after parsing and before anything is written, so a document of the wrong
 * shape fails the batch rather than half-importing. The distinction between error
 * and warning is whether continuing would put wrong data in the repository: a
 * missing required field would, and low coverage of an optional one would not.
 */
export function validateDocument(args: {
  rules: ValidationRules;
  /** Headers actually found, lower-cased. */
  headers: string[];
  /** Canonical fields the map placed, and how many rows carried a value for each. */
  coverage: Record<string, number>;
  rowsParsed: number;
  rowsFailed: number;
  /** Headers the map could not place. */
  unmappedHeaders: string[];
}): ValidationFinding[] {
  const findings: ValidationFinding[] = [];
  const { rules, coverage, rowsParsed, rowsFailed } = args;

  for (const field of rules.requiredFields) {
    if ((coverage[field] ?? 0) === 0) {
      findings.push({
        severity: 'error',
        code: 'required_field_absent',
        message: `No row carried a value for "${field}", which this profile requires. Either the column is named something this profile does not recognise, or this is not the document the profile describes.`,
      });
    }
  }

  if (rowsParsed < rules.minimumRows) {
    findings.push({
      severity: 'error',
      code: 'roster_too_small',
      message: `Only ${rowsParsed} row(s) parsed, below the minimum of ${rules.minimumRows}. A roster this short is more likely a truncated download than a quiet day at the jail.`,
    });
  }

  if (rowsParsed > 0) {
    const failurePercent = Math.round((rowsFailed / (rowsParsed + rowsFailed)) * 100);
    if (failurePercent > rules.maximumRowFailurePercent) {
      findings.push({
        severity: 'error',
        code: 'too_many_unparseable_rows',
        message: `${failurePercent}% of rows could not be read, above this profile's limit of ${rules.maximumRowFailurePercent}%. The document's layout has probably changed; publish a new profile version rather than accepting the loss.`,
      });
    }

    for (const expectation of rules.expectedCoverage) {
      const present = coverage[expectation.field] ?? 0;
      const percent = Math.round((present / rowsParsed) * 100);
      if (percent < expectation.minimumPercent) {
        findings.push({
          severity: 'warning',
          code: 'low_field_coverage',
          message: `"${expectation.field}" is present on ${percent}% of rows, below the ${expectation.minimumPercent}% this profile expects. Usually a renamed column rather than missing data.`,
        });
      }
    }
  }

  if (args.unmappedHeaders.length > 0) {
    findings.push({
      severity: rules.unmappedHeadersAreErrors ? 'error' : 'warning',
      code: 'unmapped_headers',
      message: `The document carries ${args.unmappedHeaders.length} column(s) this profile does not recognise: ${args.unmappedHeaders.join(', ')}. Their values were not imported.`,
    });
  }

  // Header drift, reported even when coverage is fine, because it is the earliest
  // sign that a new profile version will be needed.
  return findings;
}

/**
 * How far the document's headers differ from the ones the profile was written for.
 *
 * Informational. Header order changes constantly and means nothing on its own, but a
 * header the profile has never seen is the leading indicator of a format change.
 */
export function compareHeaders(expected: string[], found: string[]): {
  missing: string[];
  unexpected: string[];
  matched: number;
} {
  const norm = (h: string) => h.trim().toLowerCase().replace(/\s+/g, ' ');
  const expectedSet = new Set(expected.map(norm));
  const foundSet = new Set(found.map(norm));

  return {
    missing: expected.filter((h) => !foundSet.has(norm(h))),
    unexpected: found.filter((h) => !expectedSet.has(norm(h))),
    matched: [...foundSet].filter((h) => expectedSet.has(h)).length,
  };
}
