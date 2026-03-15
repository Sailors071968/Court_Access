// ============================================================================
// Evidence Text Extraction Service
// Converts evidence files stored in Cloudflare R2 into normalized text
// usable by the timeline reconstruction engine.
//
// Supported MIME types:
//   text/plain        → direct read
//   application/pdf   → pdf-parse
//   image/*           → Tesseract OCR
//   audio/*, video/*  → transcript pipeline placeholder (returns null)
// ============================================================================

import { getR2Object } from '../lib/r2.js';
import { streamToBuffer } from '../utils/streamToBuffer.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EvidenceRecord {
  evidenceId: string;
  fileName: string;
  mimeType: string | null;
  s3Key: string | null;
  evidenceType: string;
}

export interface ExtractionOutcome {
  evidenceId: string;
  text: string | null;
  method: 'direct' | 'pdf-parse' | 'tesseract-ocr' | 'skipped' | 'failed';
  charCount: number;
  durationMs: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// Core extraction function
// ---------------------------------------------------------------------------

/**
 * Retrieve evidence content from R2 and convert it to text.
 *
 * Returns the extracted text or null if extraction is not possible
 * (unsupported type, missing key, audio/video).
 *
 * This function NEVER throws — all errors are caught and returned in
 * the ExtractionOutcome so the pipeline can continue safely.
 */
export async function extractEvidenceText(
  evidence: EvidenceRecord,
): Promise<ExtractionOutcome> {
  const start = Date.now();
  const outcome: ExtractionOutcome = {
    evidenceId: evidence.evidenceId,
    text: null,
    method: 'skipped',
    charCount: 0,
    durationMs: 0,
  };

  try {
    // Guard: no S3 key means the file was never uploaded
    if (!evidence.s3Key) {
      outcome.error = 'No s3Key on evidence record';
      outcome.durationMs = Date.now() - start;
      console.warn('[EvidenceTextExtraction] Skipping — no s3Key', {
        evidenceId: evidence.evidenceId,
      });
      return outcome;
    }

    const mimeType = evidence.mimeType ?? guessMimeType(evidence.fileName);

    // Audio/video → transcript pipeline handles these separately
    if (mimeType.startsWith('audio/') || mimeType.startsWith('video/')) {
      outcome.method = 'skipped';
      outcome.error = 'Audio/video files processed by transcript pipeline';
      outcome.durationMs = Date.now() - start;
      console.info('[EvidenceTextExtraction] Skipping audio/video', {
        evidenceId: evidence.evidenceId,
        mimeType,
      });
      return outcome;
    }

    // Fetch object from R2
    const r2Object = await getR2Object(evidence.s3Key);
    if (!r2Object) {
      outcome.method = 'failed';
      outcome.error = 'Object not found in R2';
      outcome.durationMs = Date.now() - start;
      console.warn('[EvidenceTextExtraction] R2 object not found', {
        evidenceId: evidence.evidenceId,
        s3Key: evidence.s3Key,
      });
      return outcome;
    }

    // Stream → Buffer
    const buffer = await streamToBuffer(r2Object.body);

    // Route by MIME type
    if (mimeType === 'text/plain' || mimeType === 'text/csv') {
      outcome.text = buffer.toString('utf-8');
      outcome.method = 'direct';
    } else if (mimeType === 'application/pdf') {
      outcome.text = await extractFromPdf(buffer);
      outcome.method = 'pdf-parse';
    } else if (mimeType.startsWith('image/')) {
      outcome.text = await extractFromImage(buffer);
      outcome.method = 'tesseract-ocr';
    } else {
      // Attempt plain text read as best-effort fallback
      const tentative = buffer.toString('utf-8');
      if (isProbablyText(tentative)) {
        outcome.text = tentative;
        outcome.method = 'direct';
      } else {
        outcome.method = 'skipped';
        outcome.error = `Unsupported MIME type: ${mimeType}`;
        console.warn('[EvidenceTextExtraction] Unsupported MIME type', {
          evidenceId: evidence.evidenceId,
          mimeType,
        });
      }
    }

    outcome.charCount = outcome.text?.length ?? 0;
    outcome.durationMs = Date.now() - start;

    if (outcome.text) {
      console.info('[EvidenceTextExtraction] Extracted text', {
        evidenceId: evidence.evidenceId,
        method: outcome.method,
        charCount: outcome.charCount,
        durationMs: outcome.durationMs,
      });
    }

    return outcome;
  } catch (err) {
    outcome.method = 'failed';
    outcome.error = err instanceof Error ? err.message : String(err);
    outcome.durationMs = Date.now() - start;
    console.warn('[EvidenceTextExtraction] Extraction failed', {
      evidenceId: evidence.evidenceId,
      error: outcome.error,
    });
    return outcome;
  }
}

// ---------------------------------------------------------------------------
// PDF extraction
// ---------------------------------------------------------------------------

async function extractFromPdf(buffer: Buffer): Promise<string | null> {
  try {
    // pdf-parse v2 uses named export PDFParse class with { data: buffer }
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: buffer });
    // load() is marked private in types but required at runtime
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
      '[EvidenceTextExtraction] pdf-parse failed:',
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

// ---------------------------------------------------------------------------
// Image OCR extraction
// ---------------------------------------------------------------------------

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
      '[EvidenceTextExtraction] Tesseract OCR failed:',
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/** Guess MIME type from file extension when mimeType is null */
function guessMimeType(fileName: string): string {
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
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    m4a: 'audio/mp4',
  };
  return mimeMap[ext] ?? 'application/octet-stream';
}

/** Heuristic: does this buffer look like human-readable text? */
function isProbablyText(content: string): boolean {
  if (content.length === 0) return false;
  // Check first 1000 chars for non-printable characters
  const sample = content.slice(0, 1000);
  let printable = 0;
  for (let i = 0; i < sample.length; i++) {
    const code = sample.charCodeAt(i);
    // printable ASCII + common whitespace
    if ((code >= 32 && code <= 126) || code === 9 || code === 10 || code === 13) {
      printable++;
    }
  }
  return printable / sample.length > 0.85;
}
