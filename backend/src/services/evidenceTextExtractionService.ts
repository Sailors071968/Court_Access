// ============================================================================
// Evidence Text Extraction Service
// Converts evidence files stored in Cloudflare R2 into normalized text.
// Uses canonical evidenceContentExtractor for buffer-based extraction.
// ============================================================================

import { getR2Object } from '../lib/r2.js';
import { streamToBuffer } from '../utils/streamToBuffer.js';
import {
  extractTextFromBuffer,
  guessMimeType,
  type ExtractionMethod,
} from '../evidence/evidenceContentExtractor.js';

const MAX_EXTRACTION_BUFFER_BYTES = 50 * 1024 * 1024;
const EXTRACTION_TIMEOUT_MS = 60_000;
const MAX_EXTRACTED_TEXT_CHARS = 2 * 1024 * 1024;

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
  method: ExtractionMethod;
  charCount: number;
  durationMs: number;
  error?: string;
}

/**
 * Retrieve evidence content from R2 and convert it to text.
 * Never throws — errors are returned in ExtractionOutcome.
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
    if (!evidence.s3Key) {
      outcome.error = 'No s3Key on evidence record';
      outcome.durationMs = Date.now() - start;
      return outcome;
    }

    const mimeType = evidence.mimeType ?? guessMimeType(evidence.fileName);

    const extractionPromise = extractFromR2(evidence, mimeType, outcome);
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error(`Extraction timed out after ${EXTRACTION_TIMEOUT_MS}ms`)),
        EXTRACTION_TIMEOUT_MS,
      );
    });

    return await Promise.race([extractionPromise, timeoutPromise]);
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

async function extractFromR2(
  evidence: EvidenceRecord,
  mimeType: string,
  outcome: ExtractionOutcome,
): Promise<ExtractionOutcome> {
  const start = Date.now();

  const r2Object = await getR2Object(evidence.s3Key!);
  if (!r2Object) {
    outcome.method = 'failed';
    outcome.error = 'Object not found in R2';
    outcome.durationMs = Date.now() - start;
    return outcome;
  }

  if (r2Object.contentLength && r2Object.contentLength > MAX_EXTRACTION_BUFFER_BYTES) {
    outcome.method = 'skipped';
    outcome.error = `File too large for extraction: ${(r2Object.contentLength / (1024 * 1024)).toFixed(1)} MB`;
    outcome.durationMs = Date.now() - start;
    return outcome;
  }

  const buffer = await streamToBuffer(r2Object.body, MAX_EXTRACTION_BUFFER_BYTES);
  const result = await extractTextFromBuffer(buffer, mimeType);

  outcome.text = result.text;
  outcome.method = result.method;
  outcome.error = result.error;

  if (outcome.text && outcome.text.length > MAX_EXTRACTED_TEXT_CHARS) {
    outcome.text = outcome.text.slice(0, MAX_EXTRACTED_TEXT_CHARS);
  }

  outcome.charCount = outcome.text?.length ?? 0;
  outcome.durationMs = Date.now() - start;
  return outcome;
}
