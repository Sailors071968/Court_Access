// ============================================================================
// Import Inspection Mode.
//
// Upload a file the system has never seen and find out what would happen — without
// anything happening. Nothing is written to the repository: no batch, no observation,
// no person, no booking. The output is a description of the document and a
// ready-to-publish parser profile update.
//
// This exists because Sacramento County publishes no bulk export, so every header
// spelling in the profiles is a candidate until a real file arrives. The alternative
// to inspection is importing an unknown file to see what breaks, and the failure mode
// there is not a crash — it is a repository quietly full of nulls that reads as a
// quiet day at the jail.
//
// The suggestions are suggestions. Nothing here publishes a profile or changes a
// mapping; a person does that, having read the sample values. An inspector that
// silently corrected the profile would be guessing with more confidence than the
// evidence supports, which is the thing this whole subsystem is built not to do.
// ============================================================================

import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import { createInterface } from 'node:readline';

import prisma from '../../../lib/prisma.js';
import type { CanonicalField, ColumnMap } from '../types.js';
import { splitCsvLine } from '../parsers/csvParser.js';
import { resolveProfile } from '../../platform/parserProfiles.js';
import { inferColumnType, type TypeInference } from './typeInference.js';

/** Rows read for inspection. Enough to characterise a column, few enough to be fast. */
const SAMPLE_ROWS = 500;

export interface ColumnFinding {
  /** Position in the header row, 1-based, as a person would count columns. */
  position: number;
  /** The header exactly as written in the file. */
  header: string;
  /** The canonical field the active profile maps this to, if any. */
  mappedTo: CanonicalField | null;
  /** How the mapping was reached. */
  mappedBy: 'profile_alias' | 'none';
  inference: TypeInference;
  /**
   * What this column probably is, when the profile does not map it.
   *
   * Ranked, with a reason. A suggestion never becomes a mapping on its own.
   */
  suggestions: {
    field: CanonicalField;
    confidence: number;
    reason: string;
  }[];
  /** True when another column in the file has the same header. */
  duplicate: boolean;
  /** True when the profile maps it but the values contradict the field's type. */
  typeMismatch: string | null;
}

export interface InspectionReport {
  inspectionId?: string;
  file: {
    filename: string;
    sizeBytes: number;
    sha256: string;
    kind: 'csv' | 'pdf' | 'unknown';
  };
  facility: string;
  /** The profile the file would be read with, had it been imported. */
  profile: {
    profileId: string | null;
    version: number | null;
    label: string;
    sourceType: string;
    isFallback: boolean;
    expectedHeaders: string[];
  };
  structure: {
    rowsSampled: number;
    /** Physical lines read, which differs from rows when a field contains newlines. */
    linesRead: boolean;
    headerRow: string[];
    /** Rows whose field count disagrees with the header. */
    ragged: { line: number; fields: number }[];
    encodingWarnings: string[];
    /** PDF only. */
    pageCount?: number;
    hasTextLayer?: boolean;
    ocrWouldBeUsed?: boolean;
    sampleLines?: string[];
  };
  columns: ColumnFinding[];
  /** Grouped for the report Priority 2 asks for. */
  summary: {
    recognized: string[];
    unknown: string[];
    missingRequired: string[];
    duplicated: string[];
    /** Mapped by the profile but empty in every sampled row. */
    emptyThoughMapped: string[];
    /** Present, unmapped, and confidently identifiable — the actionable list. */
    suggestedMappings: { header: string; field: CanonicalField; confidence: number }[];
  };
  /** Would an import succeed, and what would it cost? */
  compatibility: {
    verdict: 'would_import' | 'would_import_with_warnings' | 'would_be_refused';
    reasons: string[];
    /** How much of the profile's vocabulary this file satisfies, 0–100. */
    parserConfidence: number;
  };
  /**
   * A column map that would read this file, as a starting point for a new profile
   * version. Derived from the active profile plus the confident suggestions.
   */
  suggestedProfileUpdate: {
    basedOnVersion: number | null;
    addedAliases: { field: CanonicalField; alias: string }[];
    columnMap: ColumnMap;
  } | null;
  inspectedAt: string;
}

/**
 * Every canonical field, with what a header for it tends to look like and which value
 * shapes are consistent with it.
 *
 * Used only to suggest. The scoring deliberately weighs the *values* as heavily as the
 * header, because a renamed column is exactly the case where the header is useless and
 * the values are not.
 */
const FIELD_HINTS: {
  field: CanonicalField;
  /** Substrings that suggest this field, most specific first. */
  headerHints: string[];
  compatibleTypes: string[];
  /** True when values being unique is expected. */
  expectUnique?: boolean;
  note?: string;
}[] = [
  { field: 'externalBookingId', headerHints: ['booking number', 'booking no', 'booking #', 'bkg', 'registry', 'book #', 'bookingid', 'bkgno'], compatibleTypes: ['identifier', 'integer', 'text'], expectUnique: true, note: 'identifies one stay' },
  { field: 'externalPersonId', headerHints: ['x-ref', 'xref', 'so #', 'so number', 'subject', 'main id', 'mni', 'inmate #', 'subjectref'], compatibleTypes: ['identifier', 'integer', 'text'], note: 'identifies the person across stays' },
  { field: 'last', headerHints: ['last name', 'lastname', 'surname', 'last'], compatibleTypes: ['person_name', 'text'] },
  { field: 'first', headerHints: ['first name', 'firstname', 'given', 'first'], compatibleTypes: ['person_name', 'text'] },
  { field: 'middle', headerHints: ['middle name', 'middle', 'midname', 'mi'], compatibleTypes: ['person_name', 'text', 'empty'] },
  { field: 'suffix', headerHints: ['suffix', 'sfx'], compatibleTypes: ['code_list', 'text', 'empty'] },
  { field: 'fullName', headerHints: ['inmate name', 'full name', 'defendant', 'name'], compatibleTypes: ['person_name', 'text'] },
  { field: 'dateOfBirth', headerHints: ['dob', 'date of birth', 'birth date', 'birthdate'], compatibleTypes: ['date'] },
  { field: 'sex', headerHints: ['sex', 'gender'], compatibleTypes: ['code_list', 'boolean'] },
  { field: 'race', headerHints: ['race', 'ethnicity', 'descent'], compatibleTypes: ['code_list'] },
  { field: 'bookedAt', headerHints: ['booking date', 'intake', 'booked', 'book date', 'arrest date'], compatibleTypes: ['date', 'datetime'] },
  { field: 'releasedAt', headerHints: ['release date', 'released', 'actual release'], compatibleTypes: ['date', 'datetime', 'empty'] },
  { field: 'projectedReleaseAt', headerHints: ['projected release', 'expected release', 'scheduled release', 'proj rel'], compatibleTypes: ['date', 'datetime', 'empty'], note: 'a forecast, not a release' },
  { field: 'bailAmount', headerHints: ['bail', 'bond'], compatibleTypes: ['money', 'integer'] },
  { field: 'housingLocation', headerHints: ['housing', 'location', 'cell', 'pod', 'unit', 'bed'], compatibleTypes: ['code_list', 'identifier', 'text'] },
  { field: 'charges', headerHints: ['charge', 'offense', 'crime'], compatibleTypes: ['text', 'mixed'] },
  { field: 'arrestingAgency', headerHints: ['arresting agency', 'agency', 'law enforcement'], compatibleTypes: ['code_list', 'text'] },
  { field: 'arrestType', headerHints: ['type of arrest', 'arrest type', 'arrtype'], compatibleTypes: ['code_list'] },
  { field: 'courtDate', headerHints: ['court date', 'next court', 'arraignment', 'courtdt'], compatibleTypes: ['date', 'datetime', 'empty'] },
  { field: 'courtName', headerHints: ['court name', 'hearing court', 'court location', 'courtloc', 'court'], compatibleTypes: ['code_list', 'text'] },
  { field: 'outstandingWarrants', headerHints: ['warrant', 'holds', 'warr'], compatibleTypes: ['boolean', 'code_list'] },
  { field: 'height', headerHints: ['height', 'ht'], compatibleTypes: ['height', 'integer', 'text'] },
  { field: 'weight', headerHints: ['weight', 'wt'], compatibleTypes: ['integer'] },
];

/** Fields a document must supply for a row to become a booking. */
const REQUIRED: CanonicalField[] = ['bookedAt'];

// ---------------------------------------------------------------------------

/**
 * Inspect a file without importing it.
 *
 * The whole function is read-only with respect to the intelligence repository. The
 * only write is the inspection record itself, and only when asked.
 */
export async function inspectFile(args: {
  filePath: string;
  facility: string;
  originalName?: string;
  rosterDate?: string;
  /** Keep the report, so a file's structure is on record before it was imported. */
  persist?: boolean;
  inspectedById?: string;
}): Promise<InspectionReport> {
  const filename = args.originalName ?? basename(args.filePath);
  const extension = extname(filename).toLowerCase();
  const kind: 'csv' | 'pdf' | 'unknown' =
    extension === '.csv' ? 'csv' : extension === '.pdf' ? 'pdf' : 'unknown';

  const stats = await stat(args.filePath);
  const sha256 = await hashFile(args.filePath);

  const resolved = await resolveProfile({
    facility: args.facility,
    sourceType: kind === 'pdf' ? 'pdf_text' : 'csv',
    rosterDate: args.rosterDate ? new Date(args.rosterDate) : null,
  });

  const report: InspectionReport = {
    file: { filename, sizeBytes: stats.size, sha256, kind },
    facility: args.facility,
    profile: {
      profileId: resolved.profileId,
      version: resolved.version,
      label: resolved.label,
      sourceType: kind === 'pdf' ? 'pdf_text' : 'csv',
      isFallback: resolved.fallback,
      expectedHeaders: resolved.expectedHeaders ?? [],
    },
    structure: { rowsSampled: 0, linesRead: false, headerRow: [], ragged: [], encodingWarnings: [] },
    columns: [],
    summary: {
      recognized: [], unknown: [], missingRequired: [], duplicated: [],
      emptyThoughMapped: [], suggestedMappings: [],
    },
    compatibility: { verdict: 'would_be_refused', reasons: [], parserConfidence: 0 },
    suggestedProfileUpdate: null,
    inspectedAt: new Date().toISOString(),
  };

  if (kind === 'unknown') {
    report.compatibility = {
      verdict: 'would_be_refused',
      reasons: [`"${filename}" is neither a .csv nor a .pdf. Only those two are read.`],
      parserConfidence: 0,
    };
    return persistIfAsked(report, args);
  }

  if (kind === 'pdf') {
    await inspectPdf(report, args.filePath, resolved.columnMap);
    return persistIfAsked(report, args);
  }

  await inspectCsv(report, args.filePath, resolved.columnMap);
  return persistIfAsked(report, args);
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

async function inspectCsv(report: InspectionReport, filePath: string, map: ColumnMap | undefined): Promise<void> {
  const rows: string[][] = [];
  let headerRow: string[] | null = null;
  let pending = '';
  let lineNumber = 0;
  const ragged: { line: number; fields: number }[] = [];
  const encodingWarnings: string[] = [];

  const rl = createInterface({
    input: createReadStream(filePath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  for await (const rawLine of rl) {
    lineNumber += 1;

    // A replacement character means the file is not UTF-8 — usually Windows-1252 from
    // a Windows export, which mangles names with accents. Reported rather than fixed,
    // because guessing an encoding silently corrupts exactly the names that matter.
    if (rawLine.includes('\uFFFD') && encodingWarnings.length === 0) {
      encodingWarnings.push(
        `Line ${lineNumber} contains characters that are not valid UTF-8. The file is probably Windows-1252 or Latin-1; accented names will be mangled. Re-export as UTF-8, or a profile option for the encoding is needed.`,
      );
    }
    if (lineNumber === 1 && rawLine.charCodeAt(0) === 0xfeff) {
      encodingWarnings.push('The file begins with a UTF-8 byte order mark. It is stripped from the first header on read.');
    }

    pending = pending ? `${pending}\n${rawLine}` : rawLine;
    if (endsInsideQuotedField(pending)) continue;

    const line = pending;
    pending = '';
    if (!line.trim()) continue;

    const fields = splitCsvLine(line).map((f, i) =>
      i === 0 ? f.replace(/^\uFEFF/, '') : f);

    if (!headerRow) {
      headerRow = fields;
      continue;
    }
    if (fields.length !== headerRow.length) {
      ragged.push({ line: lineNumber, fields: fields.length });
    }
    rows.push(fields);
    if (rows.length >= SAMPLE_ROWS) { rl.close(); break; }
  }

  report.structure = {
    rowsSampled: rows.length,
    linesRead: true,
    headerRow: headerRow ?? [],
    ragged: ragged.slice(0, 20),
    encodingWarnings,
  };

  if (!headerRow) {
    report.compatibility = {
      verdict: 'would_be_refused',
      reasons: ['The file has no readable header row.'],
      parserConfidence: 0,
    };
    return;
  }

  report.columns = describeColumns(headerRow, rows, map);
  finalise(report, map);
}

/** Mirrors the reader in csvParser.ts: a quote opens a field only at its start. */
function endsInsideQuotedField(text: string): boolean {
  let inQuotes = false;
  let fieldEmpty = true;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') i += 1;
        else inQuotes = false;
      }
    } else if (ch === '"') {
      if (fieldEmpty) { inQuotes = true; fieldEmpty = false; }
    } else if (ch === ',') fieldEmpty = true;
    else fieldEmpty = false;
  }
  return inQuotes;
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

/**
 * Inspect a PDF.
 *
 * The question a PDF inspection answers is different from a CSV's. There are no
 * columns to map yet — there is a document that either has a text layer or does not,
 * and either has a layout this parser can reassemble into rows or does not. Saying
 * which, with sample lines, is what lets a person write the profile.
 */
async function inspectPdf(report: InspectionReport, filePath: string, map: ColumnMap | undefined): Promise<void> {
  let text = '';
  let pageCount = 0;
  let extractionError: string | null = null;

  try {
    const { PDFParse } = await import('pdf-parse');
    const { readFile } = await import('node:fs/promises');
    const parser = new PDFParse({ data: await readFile(filePath) });
    try {
      const result = await parser.getText();
      text = result.text ?? '';
      pageCount = result.total ?? 0;
    } finally {
      await parser.destroy();
    }
  } catch (err) {
    extractionError = err instanceof Error ? err.message : String(err);
  }

  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  // A page or two of headings with no rows is a scanned document whose text layer is
  // just the letterhead. The threshold is per page so a long scanned roster is not
  // mistaken for a short text one.
  const charsPerPage = pageCount > 0 ? text.replace(/\s/g, '').length / pageCount : 0;
  const hasTextLayer = charsPerPage >= 200;

  report.structure = {
    rowsSampled: lines.length,
    linesRead: true,
    headerRow: [],
    ragged: [],
    encodingWarnings: extractionError ? [`Text extraction failed: ${extractionError}`] : [],
    pageCount,
    hasTextLayer,
    ocrWouldBeUsed: !hasTextLayer,
    sampleLines: lines.slice(0, 40),
  };

  const reasons: string[] = [];
  if (extractionError) {
    reasons.push(`The PDF could not be read: ${extractionError}`);
    report.compatibility = { verdict: 'would_be_refused', reasons, parserConfidence: 0 };
    return;
  }

  if (!hasTextLayer) {
    reasons.push(
      `${pageCount} page(s) with about ${Math.round(charsPerPage)} characters each — too little for a text layer, so this is a scan. Import would fall back to OCR, and OCR output is the least reliable source in the system.`,
    );
  } else {
    reasons.push(`${pageCount} page(s) with a usable text layer, about ${Math.round(charsPerPage)} characters per page. No OCR needed.`);
  }

  // Does any line look like a roster row? A date and a name on the same line is the
  // minimum signature.
  const rowLike = lines.filter((l) => /\d{1,2}[/-]\d{1,2}[/-]\d{4}/.test(l) && /[A-Z]{2,}/.test(l));
  reasons.push(
    rowLike.length > 0
      ? `${rowLike.length} of ${lines.length} line(s) carry both a date and a name, so the layout is probably row-per-inmate.`
      : 'No line carries both a date and a name, so either the layout puts one inmate across several lines, or this is not a roster.',
  );

  if (map) {
    // Header-ish lines: a line mentioning several of the profile's expected headers.
    const aliases = Object.values(map.fields).flat().map((a) => String(a).toLowerCase());
    const headerish = lines
      .map((line) => ({ line, hits: aliases.filter((a) => line.toLowerCase().includes(a)).length }))
      .filter((c) => c.hits >= 3)
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 3);
    if (headerish.length > 0) {
      reasons.push(`A header line was found: "${headerish[0].line.slice(0, 120)}" (${headerish[0].hits} recognised column names).`);
    } else {
      reasons.push('No line resembles a header row, so column positions must be inferred from the layout rather than read.');
    }
  }

  report.compatibility = {
    verdict: !hasTextLayer ? 'would_import_with_warnings'
      : rowLike.length === 0 ? 'would_import_with_warnings'
      : 'would_import',
    reasons,
    // A PDF's confidence is about the document being readable at all, not about
    // columns — there are none to score.
    parserConfidence: !hasTextLayer ? 35 : rowLike.length === 0 ? 45 : 75,
  };
  report.summary.missingRequired = [];
}

// ---------------------------------------------------------------------------
// Column description and scoring
// ---------------------------------------------------------------------------

function describeColumns(headerRow: string[], rows: string[][], map: ColumnMap | undefined): ColumnFinding[] {
  const seen = new Map<string, number>();
  for (const header of headerRow) {
    const key = normalise(header);
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }

  // Reverse lookup: alias → canonical field, from the active profile.
  const aliasToField = new Map<string, CanonicalField>();
  if (map) {
    for (const [field, aliases] of Object.entries(map.fields)) {
      for (const alias of aliases ?? []) {
        aliasToField.set(normalise(String(alias)), field as CanonicalField);
      }
    }
  }

  return headerRow.map((header, index) => {
    const values = rows.map((r) => r[index] ?? '');
    const inference = inferColumnType(values);
    const mappedTo = aliasToField.get(normalise(header)) ?? null;

    const finding: ColumnFinding = {
      position: index + 1,
      header,
      mappedTo,
      mappedBy: mappedTo ? 'profile_alias' : 'none',
      inference,
      suggestions: mappedTo ? [] : suggestFields(header, inference),
      duplicate: (seen.get(normalise(header)) ?? 0) > 1,
      typeMismatch: mappedTo ? checkTypeMismatch(mappedTo, inference) : null,
    };
    return finding;
  });
}

/**
 * What an unmapped column probably is.
 *
 * Header text and value shape are scored separately and added, so a column whose name
 * means nothing can still be identified from its values, and a column whose values are
 * ambiguous can still be identified from its name. Neither alone is enough to be
 * confident, which is why the ceiling for a single signal is below the threshold the
 * profile update uses.
 */
function suggestFields(header: string, inference: TypeInference): ColumnFinding['suggestions'] {
  const normalised = normalise(header);
  const suggestions: ColumnFinding['suggestions'] = [];

  for (const hint of FIELD_HINTS) {
    let score = 0;
    const reasons: string[] = [];

    const matched = hint.headerHints.find((h) => normalised.includes(normalise(h)));
    if (matched) {
      // An exact header match is worth more than a substring of one.
      const exact = normalised === normalise(matched);
      score += exact ? 55 : 40;
      reasons.push(exact ? `the header is "${matched}"` : `the header contains "${matched}"`);
    }

    if (hint.compatibleTypes.includes(inference.type)) {
      score += 30;
      reasons.push(`the values are ${inference.type.replace(/_/g, ' ')}`);
    } else if (inference.type !== 'empty' && inference.type !== 'text' && score > 0) {
      // The header says one thing and the values say another. Worth reporting, but
      // this is the case most likely to be a wrong guess.
      score -= 25;
      reasons.push(`but the values look like ${inference.type.replace(/_/g, ' ')}, not ${hint.compatibleTypes.join(' or ')}`);
    }

    if (hint.expectUnique && inference.statistics.looksUnique) {
      score += 10;
      reasons.push('every value is distinct, as expected for this field');
    }

    if (score >= 35) {
      suggestions.push({
        field: hint.field,
        confidence: Math.min(95, score),
        reason: `${reasons.join(', ')}${hint.note ? ` (${hint.note})` : ''}.`,
      });
    }
  }

  return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
}

/** The profile maps this column, but the values disagree with the field. */
function checkTypeMismatch(field: CanonicalField, inference: TypeInference): string | null {
  const hint = FIELD_HINTS.find((h) => h.field === field);
  if (!hint) return null;
  if (inference.type === 'empty') return null;   // absence is reported separately
  if (hint.compatibleTypes.includes(inference.type)) return null;
  if (inference.type === 'text' || inference.type === 'mixed') return null;

  return `The profile maps this to ${field}, but the values look like ${inference.type.replace(/_/g, ' ')} rather than ${hint.compatibleTypes.join(' or ')}. Either the county reused a header for something else, or the mapping is wrong.`;
}

/** Group the findings and decide what would happen. */
function finalise(report: InspectionReport, map: ColumnMap | undefined): void {
  const recognized: string[] = [];
  const unknown: string[] = [];
  const duplicated = new Set<string>();
  const emptyThoughMapped: string[] = [];
  const suggested: { header: string; field: CanonicalField; confidence: number }[] = [];

  for (const column of report.columns) {
    if (column.duplicate) duplicated.add(column.header);
    if (column.mappedTo) {
      recognized.push(column.header);
      if (column.inference.type === 'empty') emptyThoughMapped.push(column.header);
    } else {
      unknown.push(column.header);
      const best = column.suggestions[0];
      // 65 is the threshold at which both signals agreed: a header match alone caps
      // at 55, and a value-shape match alone at 40. Below it, a person decides.
      if (best && best.confidence >= 65) {
        suggested.push({ header: column.header, field: best.field, confidence: best.confidence });
      }
    }
  }

  const mappedFields = new Set(report.columns.map((c) => c.mappedTo).filter((f): f is CanonicalField => Boolean(f)));
  const suggestedFields = new Set(suggested.map((s) => s.field));

  // Missing means missing *under the profile as it stands*. A suggestion does not
  // supply a column until someone publishes it, and a verdict that counted
  // suggestions would tell an operator the file would import when importing it now
  // would refuse it — the one thing this mode exists to get right.
  const missingRequired = REQUIRED.filter((f) => !mappedFields.has(f));
  const missingButSuggested = missingRequired.filter((f) => suggestedFields.has(f));

  report.summary = {
    recognized, unknown,
    missingRequired,
    duplicated: [...duplicated],
    emptyThoughMapped,
    suggestedMappings: suggested,
  };

  // Parser confidence: how much of the file the active profile understands. Weighted
  // by columns rather than by rows, because an unmapped column loses every value in it.
  const total = report.columns.length || 1;
  const understood = recognized.length;
  let parserConfidence = Math.round((understood / total) * 100);

  const reasons: string[] = [];
  reasons.push(`${understood} of ${total} column(s) are recognised by ${report.profile.isFallback ? 'the compiled-in map' : `profile v${report.profile.version}`}.`);

  if (report.profile.isFallback) {
    parserConfidence = Math.max(0, parserConfidence - 15);
    reasons.push('No published profile applies to this facility and date, so the compiled-in map was used. An import would record weaker provenance and could not later be reprocessed against a corrected mapping.');
  }
  if (duplicated.size > 0) {
    parserConfidence = Math.max(0, parserConfidence - 10);
    reasons.push(`${duplicated.size} header(s) appear more than once (${[...duplicated].join(', ')}). Only one of each pair would be read, and which one depends on column order.`);
  }
  if (report.structure.ragged.length > 0) {
    reasons.push(`${report.structure.ragged.length} row(s) have a different field count from the header and would be skipped rather than realigned.`);
  }
  if (report.structure.encodingWarnings.length > 0) {
    parserConfidence = Math.max(0, parserConfidence - 10);
    reasons.push(report.structure.encodingWarnings[0]);
  }
  if (emptyThoughMapped.length > 0) {
    reasons.push(`${emptyThoughMapped.length} mapped column(s) are empty in every sampled row (${emptyThoughMapped.join(', ')}). The column exists but the export is not filling it.`);
  }
  const mismatches = report.columns.filter((c) => c.typeMismatch);
  if (mismatches.length > 0) {
    parserConfidence = Math.max(0, parserConfidence - 10 * mismatches.length);
    for (const m of mismatches) reasons.push(`${m.header}: ${m.typeMismatch}`);
  }
  if (suggested.length > 0) {
    reasons.push(`${suggested.length} unmapped column(s) can be identified confidently and are offered as a profile update: ${suggested.map((s) => `${s.header} → ${s.field}`).join(', ')}.`);
  }

  let verdict: InspectionReport['compatibility']['verdict'];
  if (missingRequired.length > 0) {
    verdict = 'would_be_refused';
    reasons.unshift(
      `No column supplies ${missingRequired.join(', ')}, which every row needs to become a booking. An import would be refused as things stand.${
        missingButSuggested.length > 0
          ? ` A suggestion below would supply ${missingButSuggested.join(', ')} — publish it as a new profile version, then re-inspect.`
          : ''}`,
    );
  } else if (report.structure.rowsSampled < 5) {
    verdict = 'would_be_refused';
    reasons.unshift(`Only ${report.structure.rowsSampled} data row(s). A roster this short would be refused as a truncated download.`);
  } else if (parserConfidence < 60 || unknown.length > recognized.length) {
    verdict = 'would_import_with_warnings';
  } else {
    verdict = 'would_import';
  }

  report.compatibility = { verdict, reasons, parserConfidence };

  // The suggested profile update: the active map plus the confident aliases. Offered
  // as data for a person to publish, never published here.
  if (map && suggested.length > 0) {
    const fields: ColumnMap['fields'] = {};
    for (const [field, aliases] of Object.entries(map.fields)) {
      fields[field as CanonicalField] = [...(aliases ?? [])];
    }
    const added: { field: CanonicalField; alias: string }[] = [];
    for (const suggestion of suggested) {
      const existing = fields[suggestion.field] ?? [];
      const alias = normalise(suggestion.header);
      if (!existing.some((a) => normalise(String(a)) === alias)) {
        fields[suggestion.field] = [...existing, suggestion.header.trim().toLowerCase()];
        added.push({ field: suggestion.field, alias: suggestion.header.trim().toLowerCase() });
      }
    }
    if (added.length > 0) {
      report.suggestedProfileUpdate = {
        basedOnVersion: report.profile.version,
        addedAliases: added,
        columnMap: { ...map, fields },
      };
    }
  }
}

const normalise = (header: string): string =>
  header.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[._]/g, ' ');

// ---------------------------------------------------------------------------

async function hashFile(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  const stream = createReadStream(filePath);
  for await (const chunk of stream) hash.update(chunk as Buffer);
  return hash.digest('hex');
}

/**
 * Keep the report.
 *
 * An inspection is a record of what a file looked like before anyone decided what to
 * do with it, which is worth having when the decision turns out to be wrong.
 */
async function persistIfAsked(
  report: InspectionReport,
  args: { persist?: boolean; facility: string; inspectedById?: string },
): Promise<InspectionReport> {
  if (!args.persist) return report;

  const created = await prisma.inmateImportInspection.create({
    data: {
      facility: args.facility,
      filename: report.file.filename,
      sha256: report.file.sha256,
      sizeBytes: report.file.sizeBytes,
      fileKind: report.file.kind,
      profileId: report.profile.profileId,
      profileVersion: report.profile.version,
      verdict: report.compatibility.verdict,
      parserConfidence: report.compatibility.parserConfidence,
      report: report as unknown as object,
      inspectedById: args.inspectedById ?? null,
    },
    select: { inspectionId: true },
  });

  return { ...report, inspectionId: created.inspectionId };
}
