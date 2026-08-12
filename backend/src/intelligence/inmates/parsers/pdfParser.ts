// ============================================================================
// PDF roster parser.
//
// Two paths, tried in order: the text layer, then OCR. Most county roster PDFs
// are generated and have a text layer; scanned ones do not.
//
// The reason this file records per-page character counts is not diagnostics. A
// blank OCR page and a genuinely blank page produce identical output, so an OCR
// run that silently fails looks exactly like a day with no arrests — a zero that
// the new-inmate report would present as fact. The counts are what make that
// distinguishable, and an empty page raises an issue rather than passing quietly.
// ============================================================================

import { readFile } from 'node:fs/promises';

import type { ColumnMap, IngestionIssue, ParseResult, RawRecord } from '../types.js';
import { inspectHeaders } from './columnMaps.js';
import { splitCsvLine } from './csvParser.js';
import {
  isActiveInmateBasicRoster,
  parseActiveInmateBasicRoster,
} from './sacramentoJailScan.js';

/** Below this many characters, a page is treated as having no text layer. */
const MIN_CHARS_PER_PAGE = 40;

export interface PdfParseOptions {
  /** Force OCR even when a text layer exists. */
  forceOcr?: boolean;
  /** Cap OCR pages. OCR is CPU-bound and runs on the host that serves requests. */
  maxOcrPages?: number;
  /**
   * Operator / filename roster date (ISO or MM/DD/YYYY). Used by layouts that have
   * no per-row booking date (Sacramento Active Inmate Basic Roster).
   */
  rosterDate?: string;
}

export async function parsePdfRoster(
  filePath: string,
  map: ColumnMap,
  options: PdfParseOptions = {},
): Promise<ParseResult> {
  const issues: IngestionIssue[] = [];
  const buffer = await readFile(filePath);

  let pageTexts: string[] = [];
  let ocrUsed = false;

  if (!options.forceOcr) {
    try {
      pageTexts = await extractTextLayer(buffer);
    } catch (err) {
      issues.push({
        severity: 'warning',
        code: 'pdf_text_layer_failed',
        message: `Could not read a text layer: ${err instanceof Error ? err.message : String(err)}. Falling back to OCR.`,
      });
    }
  }

  const charactersPerPage = pageTexts.map((t) => t.trim().length);
  const needsOcr = options.forceOcr
    || pageTexts.length === 0
    || charactersPerPage.every((n) => n < MIN_CHARS_PER_PAGE);

  if (needsOcr) {
    const ocr = await extractWithOcr(filePath, options.maxOcrPages);
    issues.push(...ocr.issues);
    pageTexts = ocr.pageTexts;
    ocrUsed = true;
  }

  const finalCounts = pageTexts.map((t) => t.trim().length);
  const emptyPages = finalCounts.map((n, i) => (n < MIN_CHARS_PER_PAGE ? i + 1 : -1)).filter((n) => n > 0);

  if (emptyPages.length > 0) {
    issues.push({
      severity: ocrUsed ? 'error' : 'warning',
      code: 'pages_yielded_no_text',
      message:
        `Page(s) ${emptyPages.join(', ')} produced no readable text. ` +
        (ocrUsed
          ? 'With OCR this usually means the language model was unavailable, not that the pages were blank. ' +
            'A roster imported in this state would report zero arrests. Confirm before accepting this batch.'
          : 'Consider re-running with OCR.'),
    });
  }

  if (finalCounts.every((n) => n < MIN_CHARS_PER_PAGE)) {
    issues.push({
      severity: 'error',
      code: 'no_text_extracted',
      message: 'No page yielded readable text. The batch produced no records; this is not an empty roster.',
    });
    return {
      records: [],
      stats: { pageCount: pageTexts.length, charactersPerPage: finalCounts, emptyPages, ocrUsed, unparseableLines: 0 },
      issues,
    };
  }

  const joined = pageTexts.join('\n');

  // Sacramento SACJAILSCAN / Active Inmate Basic Roster — multi-token layout.
  // Tried before the generic delimited-table path because pdf-parse fragments
  // those pages so no line looks like a table row.
  if (isActiveInmateBasicRoster(joined)) {
    const jail = parseActiveInmateBasicRoster(joined, options.rosterDate);
    issues.push(...jail.issues);
    return {
      records: jail.records,
      stats: {
        pageCount: pageTexts.length,
        charactersPerPage: finalCounts,
        emptyPages,
        ocrUsed,
        unparseableLines: 0,
      },
      issues,
    };
  }

  const { records, unparseableLines, issues: rowIssues } = rowsFromText(joined, map);
  issues.push(...rowIssues);

  return {
    records,
    stats: { pageCount: pageTexts.length, charactersPerPage: finalCounts, emptyPages, ocrUsed, unparseableLines },
    issues,
  };
}

/**
 * Per-page text via pdf-parse. Imported lazily so a CSV-only run does not pay
 * for it.
 *
 * pdf-parse v2 exports a `PDFParse` class and returns text per page. An earlier
 * version of this function assumed the v1 `default(buffer)` signature, which
 * type-checks against `unknown` and fails only when a PDF is actually ingested —
 * found by putting a real PDF through it.
 */
async function extractTextLayer(buffer: Buffer): Promise<string[]> {
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    const pages = (result.pages ?? []).map((p: { text?: string }) => p.text ?? '');
    if (pages.length > 0) return pages;
    return result.text ? [result.text] : [];
  } finally {
    // Releases the worker. Without it the process keeps an open handle and a CLI
    // run does not exit.
    await parser.destroy();
  }
}

/**
 * OCR. Deliberately not implemented as part of Phase 1.
 *
 * tesseract.js needs the PDF rasterised to images first, which requires a
 * renderer this release does not ship. Returning an explicit, actionable issue
 * is better than a partial implementation that appears to work and produces
 * empty rosters — the exact failure this file exists to make visible.
 */
async function extractWithOcr(
  filePath: string,
  _maxPages?: number,
): Promise<{ pageTexts: string[]; issues: IngestionIssue[] }> {
  return {
    pageTexts: [],
    issues: [{
      severity: 'error',
      code: 'ocr_not_available',
      message:
        `${filePath} has no usable text layer and OCR is not enabled in this release. ` +
        'tesseract.js is present but rasterising PDF pages needs a renderer that is not shipped. ' +
        'Convert the file to text or CSV, or supply a PDF with a text layer.',
    }],
  };
}

/**
 * Recover tabular rows from extracted text.
 *
 * Roster PDFs are tables, and reconstructing rows from positioned text is the
 * hard part. Two layouts are handled: delimited text, which generated PDFs often
 * produce, and fixed-width columns. Anything else is reported per line rather
 * than guessed at, because a mis-split row attaches one person's charges to
 * another.
 */
function rowsFromText(text: string, map: ColumnMap): {
  records: RawRecord[]; unparseableLines: number; issues: IngestionIssue[];
} {
  const issues: IngestionIssue[] = [];
  const records: RawRecord[] = [];
  let unparseableLines = 0;

  const lines = text.split('\n').map((l) => l.replace(/\s+$/, '')).filter((l) => l.trim());
  if (lines.length === 0) return { records, unparseableLines, issues };

  const delimiter = detectDelimiter(lines);
  if (!delimiter) {
    issues.push({
      severity: 'error',
      code: 'pdf_layout_unrecognised',
      message:
        'The extracted text is not delimited or column-aligned in a way this parser recognises. ' +
        'No rows were produced. A layout descriptor for this facility is needed.',
    });
    return { records, unparseableLines: lines.length, issues };
  }

  let headers: string[] | null = null;
  for (const [index, line] of lines.entries()) {
    const fields = delimiter === ','
      ? splitCsvLine(line)
      : line.split(delimiter).map((f) => f.trim()).filter((f, i, arr) => f || i < arr.length - 1);

    if (!headers) {
      const inspection = inspectHeaders(fields, map);
      if (inspection.missingRequired.length === 0) { headers = fields; continue; }
      continue;   // still looking for the header row; page furniture precedes it
    }

    if (fields.length !== headers.length) { unparseableLines++; continue; }

    const row: RawRecord = {};
    headers.forEach((h, i) => { row[h] = fields[i] ?? ''; });
    row.__lineNumber = String(index + 1);
    records.push(row);
  }

  if (!headers) {
    issues.push({
      severity: 'error',
      code: 'pdf_header_not_found',
      message:
        `No line in the extracted text supplies the fields a booking needs. ` +
        `The column map for "${map.facility}" may not match this document.`,
    });
  }
  if (unparseableLines > 0) {
    issues.push({
      severity: 'warning',
      code: 'pdf_rows_skipped',
      message: `${unparseableLines} line(s) did not have the expected field count and were skipped.`,
    });
  }

  return { records, unparseableLines, issues };
}

/**
 * Whichever candidate splits the sampled lines into a stable column count.
 *
 * Commas are tried last: inmate names are often "LAST, FIRST", and bail amounts
 * are written as "$25,000", so a comma count alone looks like a delimited table
 * when it is not. Preferring a delimiter that yields a consistent field count
 * across most lines avoids attaching one person's charges to the next.
 */
function detectDelimiter(lines: string[]): string | RegExp | null {
  const sample = lines.slice(0, 25);
  for (const candidate of ['\t', '|', '  ', ','] as const) {
    const splitter: string | RegExp = candidate === '  ' ? /\s{2,}/ : candidate;
    const fieldCounts = sample
      .map((l) => l.split(splitter).map((f) => f.trim()).filter((f) => f.length > 0).length)
      .filter((n) => n >= 4);
    if (fieldCounts.length < Math.min(3, sample.length)) continue;
    if (fieldCounts.length < sample.length * 0.5) continue;

    // Majority of delimited lines must share one column count.
    const tallies = new Map<number, number>();
    for (const n of fieldCounts) tallies.set(n, (tallies.get(n) ?? 0) + 1);
    const [bestCount, bestHits] = [...tallies.entries()].sort((a, b) => b[1] - a[1])[0]!;
    if (bestCount >= 4 && bestHits >= fieldCounts.length * 0.7) {
      return splitter;
    }
  }
  return null;
}
