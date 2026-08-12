// ============================================================================
// CSV roster parser.
//
// Streamed line by line, because a county's annual export is large enough that
// reading it whole is a memory problem on a host that is also serving requests.
//
// The CSV dialect is implemented here rather than taken from a dependency: the
// requirement is small and exactly specified (RFC 4180 quoting, embedded commas,
// newlines and doubled quotes), and it avoids adding a package to a release whose
// artifact is fingerprinted and frozen.
// ============================================================================

import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

import type { ColumnMap, IngestionIssue, ParseResult, RawRecord } from '../types.js';
import { inspectHeaders } from './columnMaps.js';

/**
 * Split one CSV line into fields.
 *
 * Exported because the quoting rules are the part most likely to be wrong on a
 * real roster — an address field containing a comma, a charge description
 * containing a quote — and it is worth testing directly.
 */
export function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { current += '"'; i++; }   // doubled quote is a literal
        else inQuotes = false;
      } else current += ch;
    } else if (ch === '"') {
      // A quote only opens a quoted field at the start of one. Anywhere else it is a
      // literal character.
      //
      // RFC 4180 says a field containing a quote must be quoted and its quotes
      // doubled, and county exports routinely ignore that: a height column writes
      // 5'11" as-is. Treating that quote as the start of a quoted field swallows the
      // rest of the line, then the next, until the file ends — one inches mark
      // rejects the whole roster. Strictness here buys nothing, because the only
      // documents this parser reads are the ones the county actually sends.
      if (current === '') inQuotes = true;
      else current += ch;
    }
    else if (ch === ',') { fields.push(current); current = ''; }
    else current += ch;
  }
  fields.push(current);
  return fields.map((f) => f.trim());
}

export interface CsvParseOptions {
  /** Stop after this many data rows. Used by --dry-run to sample a large file. */
  limit?: number;
}

export async function parseCsvRoster(
  filePath: string,
  map: ColumnMap,
  options: CsvParseOptions = {},
): Promise<ParseResult> {
  const issues: IngestionIssue[] = [];
  const records: RawRecord[] = [];
  let headers: string[] | null = null;
  let lineNumber = 0;
  let unparseableLines = 0;

  // A quoted field may contain newlines, so a physical line is not always a
  // record. Lines are accumulated until the quotes balance.
  let pending = '';

  const rl = createInterface({
    input: createReadStream(filePath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  for await (const rawLine of rl) {
    lineNumber++;
    pending = pending ? `${pending}\n${rawLine}` : rawLine;
    if (endsInsideQuotedField(pending)) continue;      // still inside a quoted field

    const line = pending;
    pending = '';
    if (!line.trim()) continue;

    const fields = splitCsvLine(line);

    if (!headers) {
      headers = fields;
      const inspection = inspectHeaders(headers, map);

      if (inspection.missingRequired.length > 0) {
        issues.push({
          severity: 'error',
          code: 'headers_missing_required',
          message:
            `The file does not supply ${inspection.missingRequired.join(', ')}. ` +
            `Headers found: ${headers.join(', ')}. ` +
            `The column map for "${map.facility}" needs updating, or this is not a roster for that facility.`,
        });
        rl.close();
        return { records, stats: { ocrUsed: false, unparseableLines }, issues };
      }

      if (inspection.unmapped.length > 0) {
        issues.push({
          severity: 'info',
          code: 'headers_unmapped',
          message: `Columns present but not used: ${inspection.unmapped.join(', ')}.`,
        });
      }
      continue;
    }

    if (fields.length !== headers.length) {
      // Reported rather than realigned: a row with the wrong field count has
      // shifted, and importing shifted data is worse than skipping the row.
      unparseableLines++;
      issues.push({
        severity: 'warning',
        code: 'field_count_mismatch',
        message: `Line ${lineNumber} has ${fields.length} fields; the header has ${headers.length}. Row skipped.`,
        lineNumber,
      });
      continue;
    }

    const row: RawRecord = {};
    headers.forEach((header, i) => { row[header] = fields[i] ?? ''; });
    row.__lineNumber = String(lineNumber);
    records.push(row);

    if (options.limit && records.length >= options.limit) { rl.close(); break; }
  }

  if (pending.trim()) {
    unparseableLines++;
    issues.push({
      severity: 'warning',
      code: 'unterminated_quote',
      message: `The file ends inside a quoted field, starting near line ${lineNumber}. The final row was skipped.`,
      lineNumber,
    });
  }

  if (!headers) {
    issues.push({ severity: 'error', code: 'empty_file', message: 'The file contains no rows.' });
  }

  return { records, stats: { ocrUsed: false, unparseableLines }, issues };
}

/**
 * Whether the text ends part-way through a quoted field.
 *
 * Uses the same rule as `splitCsvLine`: a quote opens a field only at the start of
 * one, and is a literal character anywhere else. Counting quotes instead — which is
 * what this replaced — meant a height written 5'11" left an odd count, so the reader
 * decided it was inside a quoted field and swallowed every following line until the
 * file ended. One inches mark rejected the whole roster.
 *
 * The two must agree. If the splitter treats a quote as literal and this treats it as
 * an opening quote, records silently merge.
 */
function endsInsideQuotedField(text: string): boolean {
  let inQuotes = false;
  let fieldEmpty = true;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') i++;
        else inQuotes = false;
      }
    } else if (ch === '"') {
      if (fieldEmpty) { inQuotes = true; fieldEmpty = false; }
    } else if (ch === ',') {
      fieldEmpty = true;
    } else {
      fieldEmpty = false;
    }
  }
  return inQuotes;
}
