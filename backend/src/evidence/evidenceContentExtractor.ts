// ============================================================================
// Evidence Content Extractor — Canonical text/OCR extraction
// Shared by direct upload, R2 extraction service, and ingest worker.
// ============================================================================

import fs from 'fs/promises';

export type ExtractionMethod = 'direct' | 'pdf-parse' | 'tesseract-ocr' | 'skipped' | 'failed';

export interface BufferExtractionResult {
  text: string | null;
  method: ExtractionMethod;
  error?: string;
}

/** Guess MIME type from file extension when mimeType is unknown */
export function guessMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  const mimeMap: Record<string, string> = {
    txt: 'text/plain',
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    tiff: 'image/tiff',
    tif: 'image/tiff',
    bmp: 'image/bmp',
    webp: 'image/webp',
    csv: 'text/csv',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    m4a: 'audio/mp4',
  };
  return mimeMap[ext] ?? 'application/octet-stream';
}

/** Heuristic: does this string look like human-readable text? */
export function isProbablyText(content: string): boolean {
  if (content.length === 0) return false;
  const sample = content.slice(0, 1000);
  let printable = 0;
  for (let i = 0; i < sample.length; i++) {
    const code = sample.charCodeAt(i);
    if ((code >= 32 && code <= 126) || code === 9 || code === 10 || code === 13) {
      printable++;
    }
  }
  return printable / sample.length > 0.85;
}

/**
 * Extract text from an in-memory buffer based on MIME type.
 * Supports plain text, PDF (pdf-parse), and images (Tesseract OCR).
 */
export async function extractTextFromBuffer(
  buffer: Buffer,
  mimeType: string,
): Promise<BufferExtractionResult> {
  if (mimeType.startsWith('audio/') || mimeType.startsWith('video/')) {
    return {
      text: null,
      method: 'skipped',
      error: 'Audio/video files require transcript pipeline',
    };
  }

  if (mimeType === 'text/plain' || mimeType === 'text/csv') {
    return { text: buffer.toString('utf-8'), method: 'direct' };
  }

  if (mimeType === 'application/pdf') {
    const text = await extractFromPdf(buffer);
    return text
      ? { text, method: 'pdf-parse' }
      : { text: null, method: 'failed', error: 'PDF extraction returned no text' };
  }

  if (mimeType.startsWith('image/')) {
    const text = await extractFromImage(buffer);
    return text
      ? { text, method: 'tesseract-ocr' }
      : { text: null, method: 'failed', error: 'OCR returned no text' };
  }

  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const content = buffer.toString('utf-8');
    if (isProbablyText(content)) {
      return { text: content, method: 'direct' };
    }
    return { text: null, method: 'skipped', error: 'DOCX binary format not supported' };
  }

  const tentative = buffer.toString('utf-8');
  if (isProbablyText(tentative)) {
    return { text: tentative, method: 'direct' };
  }

  return { text: null, method: 'skipped', error: `Unsupported MIME type: ${mimeType}` };
}

/** Extract text from a file on local disk */
export async function extractTextFromFile(
  filePath: string,
  mimeType: string,
): Promise<BufferExtractionResult> {
  try {
    const buffer = await fs.readFile(filePath);
    return extractTextFromBuffer(buffer, mimeType);
  } catch (err) {
    return {
      text: null,
      method: 'failed',
      error: err instanceof Error ? err.message : 'Failed to read file',
    };
  }
}

async function extractFromPdf(buffer: Buffer): Promise<string | null> {
  try {
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: buffer });
    await (parser as unknown as { load(): Promise<void> }).load();
    const result = await parser.getText();
    const text = (
      typeof result === 'object' && result !== null
        ? (result as { text?: string }).text || ''
        : String(result || '')
    ).trim();
    await parser.destroy();
    return text.length > 0 ? text : null;
  } catch (err) {
    console.warn(
      '[EvidenceContentExtractor] PDF extraction failed:',
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

async function extractFromImage(buffer: Buffer): Promise<string | null> {
  try {
    const Tesseract = await import('tesseract.js');
    const worker = await Tesseract.createWorker('eng');
    const result = await worker.recognize(buffer);
    await worker.terminate();
    const text = result.data.text?.trim();
    return text && text.length > 0 ? text : null;
  } catch (err) {
    console.warn(
      '[EvidenceContentExtractor] OCR failed:',
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}
