// ============================================================================
// Evidence Processing Service — Canonical post-upload pipeline
// Text extraction → chunking → status updates (used by direct upload + worker)
// ============================================================================

import path from 'path';
import fs from 'fs/promises';
import {
  extractTextFromFile,
  extractTextFromBuffer,
  guessMimeType,
  type BufferExtractionResult,
} from './evidenceContentExtractor.js';
import { chunkAndPersistEvidence } from '../services/evidenceChunkingService.js';
import prisma from '../lib/prisma.js';

const UPLOAD_DIR = process.env.EVIDENCE_UPLOAD_DIR || '/var/www/courtaccess/uploads/evidence';

export type ProcessingStage = 'ingesting' | 'processing' | 'analyzed' | 'failed';

/** Resolve local disk path from tenant-scoped s3Key (direct upload layout) */
export function resolveLocalEvidencePath(
  tenantId: string,
  caseId: string,
  s3Key: string,
  fileName: string,
): string | null {
  // s3Key: evidence/{tenantId}/{caseId}/{fileId}/{fileName}
  const parts = s3Key.split('/');
  if (parts.length < 5 || parts[0] !== 'evidence') return null;
  const fileId = parts[3];
  if (!fileId) return null;
  return path.join(UPLOAD_DIR, tenantId, caseId, `${fileId}_${fileName}`);
}

export async function setEvidenceProcessingStage(
  evidenceId: string,
  stage: ProcessingStage,
  processingError: string | null = null,
): Promise<void> {
  await prisma.evidence.update({
    where: { evidenceId },
    data: {
      processingStatus: stage,
      processingError,
      ...(stage === 'analyzed' ? { analysisStatus: 'completed' } : {}),
      ...(stage === 'failed' ? { analysisStatus: 'failed' } : {}),
      ...(stage === 'processing' ? { analysisStatus: 'processing' } : {}),
    },
  });
}

/**
 * Finalize evidence after text extraction: chunk, persist, update status.
 */
export async function finalizeExtractedEvidence(
  evidenceId: string,
  tenantId: string,
  mimeType: string,
  extraction: BufferExtractionResult,
): Promise<void> {
  const trimmed = extraction.text?.trim() ?? '';

  if (!trimmed) {
    const message =
      extraction.error ??
      (mimeType.startsWith('video/') || mimeType.startsWith('audio/')
        ? 'Audio/video files require transcript pipeline'
        : 'No extractable text found');

    await setEvidenceProcessingStage(evidenceId, 'analyzed', message);
    console.warn(`[EvidenceProcessing] No text for ${evidenceId}: ${message}`);
    return;
  }

  const chunkResult = await chunkAndPersistEvidence(evidenceId, tenantId, trimmed);

  await prisma.evidence.update({
    where: { evidenceId },
    data: {
      processingStatus: 'analyzed',
      processingError: null,
      analysisStatus: 'completed',
      normalizedPageCount: chunkResult.chunkCount,
    },
  });

  console.log(
    `[EvidenceProcessing] Complete ${evidenceId}: ${chunkResult.chunkCount} chunks, ` +
      `method=${extraction.method}, chars=${trimmed.length}`,
  );
}

/** Process evidence from a local file path (direct upload path) */
export async function processEvidenceFromLocalFile(
  evidenceId: string,
  tenantId: string,
  localPath: string,
  mimeType: string,
): Promise<void> {
  try {
    await setEvidenceProcessingStage(evidenceId, 'processing');

    const extraction = await extractTextFromFile(localPath, mimeType);
    await finalizeExtractedEvidence(evidenceId, tenantId, mimeType, extraction);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Processing failed';
    console.error(`[EvidenceProcessing] Failed for ${evidenceId}:`, err);
    await setEvidenceProcessingStage(evidenceId, 'failed', message).catch((updateErr) => {
      console.error(`[EvidenceProcessing] Failed to persist error for ${evidenceId}:`, updateErr);
    });
  }
}

/** Process evidence from buffer (R2 download path) */
export async function processEvidenceFromBuffer(
  evidenceId: string,
  tenantId: string,
  buffer: Buffer,
  mimeType: string,
): Promise<void> {
  try {
    await setEvidenceProcessingStage(evidenceId, 'processing');

    const extraction = await extractTextFromBuffer(buffer, mimeType);
    await finalizeExtractedEvidence(evidenceId, tenantId, mimeType, extraction);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Processing failed';
    console.error(`[EvidenceProcessing] Buffer processing failed for ${evidenceId}:`, err);
    await setEvidenceProcessingStage(evidenceId, 'failed', message).catch((updateErr) => {
      console.error(`[EvidenceProcessing] Failed to persist error for ${evidenceId}:`, updateErr);
    });
  }
}

/** Process evidence by evidenceId — tries local file then R2 via extraction service */
export async function processEvidenceRecord(evidenceId: string, tenantId: string): Promise<void> {
  const evidence = await prisma.evidence.findFirst({
    where: { evidenceId, tenantId },
  });

  if (!evidence) {
    throw new Error(`Evidence ${evidenceId} not found`);
  }

  const mimeType = evidence.mimeType ?? guessMimeType(evidence.fileName);

  if (evidence.s3Key) {
    const localPath = resolveLocalEvidencePath(
      tenantId,
      evidence.caseId,
      evidence.s3Key,
      evidence.fileName,
    );

    if (localPath) {
      try {
        await fs.access(localPath);
        await processEvidenceFromLocalFile(evidenceId, tenantId, localPath, mimeType);
        return;
      } catch {
        // Fall through to R2 extraction
      }
    }
  }

  const { extractEvidenceText } = await import('../services/evidenceTextExtractionService.js');
  await setEvidenceProcessingStage(evidenceId, 'processing');

  const outcome = await extractEvidenceText({
    evidenceId: evidence.evidenceId,
    fileName: evidence.fileName,
    mimeType: evidence.mimeType,
    s3Key: evidence.s3Key,
    evidenceType: evidence.evidenceType,
  });

  await finalizeExtractedEvidence(evidenceId, tenantId, mimeType, {
    text: outcome.text,
    method: outcome.method,
    error: outcome.error,
  });
}
