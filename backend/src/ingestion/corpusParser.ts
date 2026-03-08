// ============================================
// Court Access — Streaming Corpus Parser
// Memory-safe streaming parser for large legal corpus files.
// Supports JSON arrays, JSONL (newline-delimited), and CSV.
// Never loads entire file into memory.
// ============================================

import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Transform, type Readable } from 'node:stream';
import { createInterface } from 'node:readline';
import type { RawDocument } from './types.ts';

// ---------------------------------------------------------------------------
// Format Detection
// ---------------------------------------------------------------------------

type CorpusFormat = 'json_array' | 'jsonl' | 'csv';

async function detectFormat(filePath: string): Promise<CorpusFormat> {
  const stream = createReadStream(filePath, { start: 0, end: 1024, encoding: 'utf-8' });
  let header = '';
  for await (const chunk of stream) {
    header += chunk;
  }
  const trimmed = header.trim();
  if (trimmed.startsWith('[')) return 'json_array';
  if (trimmed.startsWith('{')) return 'jsonl';
  return 'csv';
}

// ---------------------------------------------------------------------------
// JSONL Parser (newline-delimited JSON)
// ---------------------------------------------------------------------------

function createJsonlParser(filePath: string, startOffset: number): Readable {
  const fileStream = createReadStream(filePath, {
    start: startOffset,
    encoding: 'utf-8',
  });

  let lineCount = 0;
  const transform = new Transform({
    objectMode: true,
    transform(chunk: string, _encoding, callback) {
      const lines = chunk.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const doc: RawDocument = JSON.parse(trimmed);
          lineCount++;
          this.push({ doc, offset: lineCount });
        } catch {
          // Skip malformed lines
        }
      }
      callback();
    },
  });

  return fileStream.pipe(transform);
}

// ---------------------------------------------------------------------------
// JSON Array Parser (streaming with manual chunking)
// ---------------------------------------------------------------------------

function createJsonArrayParser(filePath: string, startOffset: number): Readable {
  const fileStream = createReadStream(filePath, {
    encoding: 'utf-8',
  });

  let buffer = '';
  let depth = 0;
  let inString = false;
  let escape = false;
  let docCount = 0;
  let skippedInitial = false;

  const transform = new Transform({
    objectMode: true,
    transform(chunk: string, _encoding, callback) {
      for (const char of chunk) {
        if (escape) {
          buffer += char;
          escape = false;
          continue;
        }

        if (char === '\\' && inString) {
          buffer += char;
          escape = true;
          continue;
        }

        if (char === '"') {
          inString = !inString;
          buffer += char;
          continue;
        }

        if (inString) {
          buffer += char;
          continue;
        }

        if (char === '{') {
          if (depth === 0) {
            buffer = '{';
          } else {
            buffer += char;
          }
          depth++;
          continue;
        }

        if (char === '}') {
          depth--;
          buffer += char;
          if (depth === 0) {
            docCount++;
            if (!skippedInitial && docCount <= startOffset) {
              buffer = '';
              continue;
            }
            skippedInitial = true;
            try {
              const doc: RawDocument = JSON.parse(buffer);
              this.push({ doc, offset: docCount });
            } catch {
              // Skip malformed objects
            }
            buffer = '';
          }
          continue;
        }

        if (depth > 0) {
          buffer += char;
        }
      }
      callback();
    },
  });

  return fileStream.pipe(transform);
}

// ---------------------------------------------------------------------------
// CSV Parser (tab or comma delimited)
// ---------------------------------------------------------------------------

function createCsvParser(filePath: string, startOffset: number): Readable {
  const fileStream = createReadStream(filePath, { encoding: 'utf-8' });
  const rl = createInterface({ input: fileStream, crlfDelay: Infinity });

  let headers: string[] = [];
  let lineCount = 0;
  let headerParsed = false;

  const transform = new Transform({
    objectMode: true,
    write(_chunk, _encoding, callback) {
      callback();
    },
  });

  rl.on('line', (line: string) => {
    if (!headerParsed) {
      const delimiter = line.includes('\t') ? '\t' : ',';
      headers = line.split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
      headerParsed = true;
      return;
    }

    lineCount++;
    if (lineCount <= startOffset) return;

    const delimiter = line.includes('\t') ? '\t' : ',';
    const values = line.split(delimiter).map(v => v.trim().replace(/^"|"$/g, ''));
    const doc: RawDocument = {};
    for (let i = 0; i < headers.length; i++) {
      doc[headers[i]] = values[i] ?? '';
    }
    transform.push({ doc, offset: lineCount });
  });

  rl.on('close', () => {
    transform.push(null);
  });

  rl.on('error', (err) => {
    transform.destroy(err);
  });

  return transform;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ParsedRecord {
  doc: RawDocument;
  offset: number;
}

export interface ParserResult {
  stream: Readable;
  format: CorpusFormat;
  fileSizeBytes: number;
}

/**
 * Create a streaming parser for a legal corpus file.
 * The parser never loads the entire file into memory.
 *
 * @param filePath - Path to the corpus file
 * @param startOffset - Number of records to skip (for resume)
 * @returns Readable stream of ParsedRecord objects
 */
export async function createCorpusParser(
  filePath: string,
  startOffset: number = 0,
): Promise<ParserResult> {
  const fileInfo = await stat(filePath);
  const format = await detectFormat(filePath);

  let stream: Readable;

  switch (format) {
    case 'jsonl':
      stream = createJsonlParser(filePath, startOffset);
      break;
    case 'json_array':
      stream = createJsonArrayParser(filePath, startOffset);
      break;
    case 'csv':
      stream = createCsvParser(filePath, startOffset);
      break;
  }

  return {
    stream,
    format,
    fileSizeBytes: fileInfo.size,
  };
}

/**
 * Count total records in a file (for progress tracking).
 * Uses streaming line count — does not load file into memory.
 */
export async function countRecords(filePath: string): Promise<number> {
  const format = await detectFormat(filePath);

  if (format === 'jsonl' || format === 'csv') {
    const fileStream = createReadStream(filePath, { encoding: 'utf-8' });
    const rl = createInterface({ input: fileStream, crlfDelay: Infinity });
    let count = 0;
    for await (const _line of rl) {
      count++;
    }
    // Subtract header for CSV
    return format === 'csv' ? Math.max(0, count - 1) : count;
  }

  // JSON array — count objects
  const fileStream = createReadStream(filePath, { encoding: 'utf-8' });
  let depth = 0;
  let count = 0;
  let inString = false;
  let escape = false;

  for await (const chunk of fileStream) {
    for (const char of chunk as string) {
      if (escape) { escape = false; continue; }
      if (char === '\\' && inString) { escape = true; continue; }
      if (char === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (char === '{') { depth++; continue; }
      if (char === '}') { depth--; if (depth === 0) count++; }
    }
  }

  return count;
}
