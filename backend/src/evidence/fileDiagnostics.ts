// ============================================================================
// File diagnostics for evidence ingestion.
//
// Uploads arrive with whatever content type the client chose to send, which is
// frequently application/octet-stream and is never trustworthy for a legal
// record. Everything here works from the file's actual bytes so that the
// pipeline routes a document to the right extractor, and so that a file it
// cannot read can be described to the user in terms they can act on.
// ============================================================================

import { inflateRawSync } from 'node:zlib';

export type DetectedFormat =
  | 'pdf'
  | 'png'
  | 'jpeg'
  | 'gif'
  | 'tiff'
  | 'bmp'
  | 'webp'
  | 'docx'
  | 'xlsx'
  | 'pptx'
  | 'zip'
  | 'mp4'
  | 'quicktime'
  | 'avi'
  | 'matroska'
  | 'mp3'
  | 'wav'
  | 'flac'
  | 'aac'
  | 'ogg'
  | 'executable'
  | 'rtf'
  | 'text'
  | 'empty'
  | 'unknown';

export interface FormatDetection {
  format: DetectedFormat;
  mimeType: string;
  /** Human-readable name used in messages shown to the user. */
  label: string;
  category: 'document' | 'image' | 'video' | 'audio' | 'archive' | 'other';
}

const FORMAT_INFO: Record<DetectedFormat, Omit<FormatDetection, 'format'>> = {
  pdf: { mimeType: 'application/pdf', label: 'PDF document', category: 'document' },
  png: { mimeType: 'image/png', label: 'PNG image', category: 'image' },
  jpeg: { mimeType: 'image/jpeg', label: 'JPEG image', category: 'image' },
  gif: { mimeType: 'image/gif', label: 'GIF image', category: 'image' },
  tiff: { mimeType: 'image/tiff', label: 'TIFF image', category: 'image' },
  bmp: { mimeType: 'image/bmp', label: 'BMP image', category: 'image' },
  webp: { mimeType: 'image/webp', label: 'WebP image', category: 'image' },
  docx: {
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    label: 'Word document',
    category: 'document',
  },
  xlsx: {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    label: 'Excel workbook',
    category: 'document',
  },
  pptx: {
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    label: 'PowerPoint presentation',
    category: 'document',
  },
  zip: { mimeType: 'application/zip', label: 'ZIP archive', category: 'archive' },
  mp4: { mimeType: 'video/mp4', label: 'MP4 video', category: 'video' },
  quicktime: { mimeType: 'video/quicktime', label: 'QuickTime video', category: 'video' },
  avi: { mimeType: 'video/x-msvideo', label: 'AVI video', category: 'video' },
  matroska: { mimeType: 'video/x-matroska', label: 'Matroska video', category: 'video' },
  mp3: { mimeType: 'audio/mpeg', label: 'MP3 audio', category: 'audio' },
  wav: { mimeType: 'audio/wav', label: 'WAV audio', category: 'audio' },
  flac: { mimeType: 'audio/flac', label: 'FLAC audio', category: 'audio' },
  aac: { mimeType: 'audio/aac', label: 'AAC audio', category: 'audio' },
  ogg: { mimeType: 'audio/ogg', label: 'Ogg audio', category: 'audio' },
  executable: { mimeType: 'application/x-msdownload', label: 'Windows executable', category: 'other' },
  rtf: { mimeType: 'application/rtf', label: 'RTF document', category: 'document' },
  text: { mimeType: 'text/plain', label: 'plain text file', category: 'document' },
  empty: { mimeType: 'application/octet-stream', label: 'empty file', category: 'other' },
  unknown: { mimeType: 'application/octet-stream', label: 'unrecognised file', category: 'other' },
};

export function describe(format: DetectedFormat): FormatDetection {
  return { format, ...FORMAT_INFO[format] };
}

function startsWith(buf: Buffer, bytes: number[], offset = 0): boolean {
  if (buf.length < offset + bytes.length) return false;
  return bytes.every((b, i) => buf[offset + i] === b);
}

function ascii(buf: Buffer, offset: number, length: number): string {
  return buf.subarray(offset, offset + length).toString('latin1');
}

/**
 * Identify a file from its leading bytes. `fileName` is consulted only to
 * disambiguate members of the ZIP family and never to override content.
 */
export function detectFormat(buf: Buffer, fileName = ''): FormatDetection {
  if (buf.length === 0) return describe('empty');

  if (ascii(buf, 0, 5) === '%PDF-') return describe('pdf');
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return describe('png');
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return describe('jpeg');
  if (ascii(buf, 0, 6) === 'GIF87a' || ascii(buf, 0, 6) === 'GIF89a') return describe('gif');
  if (startsWith(buf, [0x49, 0x49, 0x2a, 0x00]) || startsWith(buf, [0x4d, 0x4d, 0x00, 0x2a]))
    return describe('tiff');
  if (ascii(buf, 0, 2) === 'BM') return describe('bmp');
  if (ascii(buf, 0, 4) === 'RIFF') {
    const kind = ascii(buf, 8, 4);
    if (kind === 'WEBP') return describe('webp');
    if (kind === 'WAVE') return describe('wav');
    if (kind === 'AVI ') return describe('avi');
  }
  if (ascii(buf, 0, 4) === 'fLaC') return describe('flac');
  if (ascii(buf, 0, 4) === 'OggS') return describe('ogg');
  if (ascii(buf, 0, 3) === 'ID3') return describe('mp3');
  if (buf.length > 1 && buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) {
    // MPEG audio frame sync; ADTS AAC uses the same sync word with layer 0.
    const layer = (buf[1] >> 1) & 0x03;
    return describe(layer === 0 ? 'aac' : 'mp3');
  }
  if (startsWith(buf, [0x1a, 0x45, 0xdf, 0xa3])) return describe('matroska');
  if (ascii(buf, 4, 4) === 'ftyp') {
    const brand = ascii(buf, 8, 4);
    return describe(brand.startsWith('qt') ? 'quicktime' : 'mp4');
  }
  if (ascii(buf, 0, 2) === 'MZ') return describe('executable');
  if (ascii(buf, 0, 5) === '{\\rtf') return describe('rtf');

  if (startsWith(buf, [0x50, 0x4b, 0x03, 0x04])) {
    // OOXML containers are ZIPs; the part names identify which one.
    const head = buf.subarray(0, Math.min(buf.length, 8192)).toString('latin1');
    if (head.includes('word/')) return describe('docx');
    if (head.includes('xl/')) return describe('xlsx');
    if (head.includes('ppt/')) return describe('pptx');
    if (/\.(docx)$/i.test(fileName)) return describe('docx');
    if (/\.(xlsx)$/i.test(fileName)) return describe('xlsx');
    if (/\.(pptx)$/i.test(fileName)) return describe('pptx');
    return describe('zip');
  }

  if (looksLikeText(buf)) return describe('text');
  return describe('unknown');
}

export function looksLikeText(buf: Buffer): boolean {
  const sample = buf.subarray(0, Math.min(buf.length, 4096));
  if (sample.length === 0) return false;
  let printable = 0;
  for (const byte of sample) {
    if (byte === 0) return false; // NUL never appears in a text document
    if ((byte >= 32 && byte <= 126) || byte === 9 || byte === 10 || byte === 13 || byte >= 0xa0) {
      printable++;
    }
  }
  return printable / sample.length > 0.9;
}

// ---------------------------------------------------------------------------
// PDF structure checks
// ---------------------------------------------------------------------------

export interface PdfInspection {
  encrypted: boolean;
  truncated: boolean;
  pageCount: number | null;
}

/**
 * Cheap structural inspection used to explain why a PDF could not be read.
 * A PDF must end with an %%EOF marker, and an encrypted one carries an
 * /Encrypt entry in its trailer.
 */
export function inspectPdf(buf: Buffer): PdfInspection {
  const tailStart = Math.max(0, buf.length - 4096);
  const tail = buf.subarray(tailStart).toString('latin1');
  const whole = buf.toString('latin1');

  const encrypted = /\/Encrypt[\s/<\d]/.test(whole);
  const truncated = !tail.includes('%%EOF');
  const matches = whole.match(/\/Type\s*\/Page[^s]/g);

  return {
    encrypted,
    truncated,
    pageCount: matches ? matches.length : null,
  };
}

// ---------------------------------------------------------------------------
// Page and line citation
// ---------------------------------------------------------------------------

export interface PageSpan {
  page: number;
  startOffset: number;
  endOffset: number;
}

export interface Citation {
  page: number;
  /** 1-based line number within that page. */
  line: number;
  /** The full text of the cited line, for verification against the source. */
  lineText: string;
  offset: number;
}

/**
 * Join per-page text into the single string the rest of the pipeline indexes,
 * recording where each page starts and ends so an offset can be turned back
 * into a page and line.
 */
export function joinPagesWithMap(pages: string[]): { text: string; pageMap: PageSpan[] } {
  const pageMap: PageSpan[] = [];
  let text = '';

  pages.forEach((pageText, i) => {
    const startOffset = text.length;
    text += pageText;
    pageMap.push({ page: i + 1, startOffset, endOffset: text.length });
    // Pages are separated by a newline so the last line of one page and the
    // first of the next are not run together.
    if (i < pages.length - 1) text += '\n';
  });

  return { text, pageMap };
}

/**
 * Resolve a character offset in the extracted text to the page it falls on and
 * the line within that page, returning the line itself so the citation can be
 * checked against the document.
 */
export function resolveCitation(text: string, pageMap: PageSpan[], offset: number): Citation | null {
  if (!Number.isFinite(offset) || offset < 0 || offset > text.length) return null;
  if (!Array.isArray(pageMap) || pageMap.length === 0) return null;

  const span =
    pageMap.find((p) => offset >= p.startOffset && offset < p.endOffset) ??
    (offset >= pageMap[pageMap.length - 1].endOffset ? pageMap[pageMap.length - 1] : null);
  if (!span) return null;

  const pageText = text.slice(span.startOffset, span.endOffset);
  const withinPage = Math.min(Math.max(offset - span.startOffset, 0), Math.max(pageText.length - 1, 0));

  const lines = pageText.split('\n');
  let consumed = 0;
  for (let i = 0; i < lines.length; i++) {
    const lineEnd = consumed + lines[i].length;
    if (withinPage <= lineEnd) {
      return { page: span.page, line: i + 1, lineText: lines[i], offset };
    }
    consumed = lineEnd + 1; // account for the newline
  }

  return {
    page: span.page,
    line: lines.length,
    lineText: lines[lines.length - 1] ?? '',
    offset,
  };
}

/** Locate a quoted passage in the extracted text and cite where it sits. */
export function citeQuote(text: string, pageMap: PageSpan[], quote: string): Citation | null {
  const needle = quote.trim();
  if (!needle) return null;
  const at = text.indexOf(needle);
  if (at < 0) return null;
  return resolveCitation(text, pageMap, at);
}

/**
 * An ISO base-media file (MP4/MOV/M4V) needs a `moov` atom to describe its
 * tracks and an `mdat` atom holding the samples. A recording truncated in
 * transfer keeps its `ftyp` header and loses one of these, which is otherwise
 * indistinguishable from a healthy file until playback fails.
 */
export function isTruncatedIsoMedia(buf: Buffer): boolean {
  const haystack = buf.toString('latin1');
  return !haystack.includes('moov') || !haystack.includes('mdat');
}

// ---------------------------------------------------------------------------
// Minimal ZIP reader
//
// Implemented directly against the central directory so that DOCX text
// extraction and discovery-archive listing do not require a new dependency.
// ---------------------------------------------------------------------------

export interface ZipEntry {
  name: string;
  compressedSize: number;
  uncompressedSize: number;
  method: number;
  localHeaderOffset: number;
}

export function listZipEntries(buf: Buffer): ZipEntry[] {
  // Locate the end-of-central-directory record, scanning back over the comment.
  const maxComment = 0xffff;
  const start = Math.max(0, buf.length - maxComment - 22);
  let eocd = -1;
  for (let i = buf.length - 22; i >= start; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return [];

  const entryCount = buf.readUInt16LE(eocd + 10);
  let offset = buf.readUInt32LE(eocd + 16);
  const entries: ZipEntry[] = [];

  for (let i = 0; i < entryCount; i++) {
    if (offset + 46 > buf.length || buf.readUInt32LE(offset) !== 0x02014b50) break;
    const method = buf.readUInt16LE(offset + 10);
    const compressedSize = buf.readUInt32LE(offset + 20);
    const uncompressedSize = buf.readUInt32LE(offset + 24);
    const nameLen = buf.readUInt16LE(offset + 28);
    const extraLen = buf.readUInt16LE(offset + 30);
    const commentLen = buf.readUInt16LE(offset + 32);
    const localHeaderOffset = buf.readUInt32LE(offset + 42);
    const name = buf.subarray(offset + 46, offset + 46 + nameLen).toString('utf8');

    entries.push({ name, compressedSize, uncompressedSize, method, localHeaderOffset });
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

export function readZipEntry(buf: Buffer, entry: ZipEntry): Buffer | null {
  const o = entry.localHeaderOffset;
  if (o + 30 > buf.length || buf.readUInt32LE(o) !== 0x04034b50) return null;
  const nameLen = buf.readUInt16LE(o + 26);
  const extraLen = buf.readUInt16LE(o + 28);
  const dataStart = o + 30 + nameLen + extraLen;
  const data = buf.subarray(dataStart, dataStart + entry.compressedSize);

  try {
    if (entry.method === 0) return Buffer.from(data);
    if (entry.method === 8) return inflateRawSync(data);
  } catch {
    return null;
  }
  return null;
}

/** Extract the visible text of a .docx by reading its document part. */
export function extractDocxText(buf: Buffer): string | null {
  const entries = listZipEntries(buf);
  const parts = entries.filter(
    (e) => e.name === 'word/document.xml' || /^word\/(header|footer)\d*\.xml$/.test(e.name),
  );
  if (parts.length === 0) return null;

  const pieces: string[] = [];
  for (const part of parts) {
    const raw = readZipEntry(buf, part);
    if (!raw) continue;
    const xml = raw.toString('utf8');
    const text = xml
      // Paragraph and line breaks become real newlines.
      .replace(/<\/w:p>/g, '\n')
      .replace(/<w:br\s*\/>/g, '\n')
      .replace(/<w:tab\s*\/>/g, '\t')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/\n{3,}/g, '\n\n');
    if (text.trim()) pieces.push(text.trim());
  }
  const joined = pieces.join('\n\n').trim();
  return joined.length > 0 ? joined : null;
}

// ---------------------------------------------------------------------------
// Text hygiene
// ---------------------------------------------------------------------------

/**
 * PostgreSQL text columns cannot store NUL, and OCR/extraction output
 * occasionally contains lone surrogates. Persisting either aborts the insert
 * for the whole batch, so extracted text is cleaned before it is stored.
 */
export function sanitizeExtractedText(text: string): string {
  return text
    .replace(/\u0000/g, '')
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '')
    .replace(/(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '$1');
}
