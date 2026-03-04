// ============================================
// Court Access — Ingestion Pipeline (Stage 1)
// File validation, hashing, metadata extraction.
// ============================================

import { logger } from '../utils/loggingUtils.js';
import { computeBufferSHA256, computeBufferSHA3_256 } from '../utils/hashUtils.js';
import { isAllowedFileType, getFileExtension, ALLOWED_EXTENSIONS } from '../utils/validationUtils.js';
import { AppError } from '../middleware/errorHandler.js';
import { env } from '../config/env.js';

export interface IngestionResult {
  fileName: string;
  fileType: string;
  fileSize: number;
  documentHash: string;
  sha3Hash: string;
  buffer: Buffer;
}

/**
 * Stage 1: Validate and prepare a file for processing.
 * - Validates file type
 * - Validates file size
 * - Computes dual-hash (SHA-256 + SHA3-256)
 */
export function runIngestionPipeline(
  fileName: string,
  mimeType: string,
  buffer: Buffer
): IngestionResult {
  // Validate file type
  if (!isAllowedFileType(mimeType)) {
    throw new AppError('File type not allowed. Supported: PDF, DOCX, TXT', 400);
  }

  const ext = getFileExtension(fileName);
  if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
    throw new AppError('File extension not allowed. Supported: .pdf, .docx, .txt', 400);
  }

  // Validate file size
  const maxBytes = env.MAX_FILE_SIZE_MB * 1024 * 1024;
  if (buffer.length > maxBytes) {
    throw new AppError(`File exceeds maximum size of ${env.MAX_FILE_SIZE_MB}MB`, 400);
  }

  // Compute dual-hash
  const documentHash = computeBufferSHA256(buffer);
  const sha3Hash = computeBufferSHA3_256(buffer);

  // Determine file type from extension
  let fileType = 'unknown';
  if (ext === '.pdf') fileType = 'pdf';
  else if (ext === '.docx') fileType = 'docx';
  else if (ext === '.txt') fileType = 'txt';

  logger.info('Ingestion pipeline complete', {
    fileName,
    fileType,
    fileSize: buffer.length,
    hashPrefix: documentHash.substring(0, 16),
  });

  return {
    fileName,
    fileType,
    fileSize: buffer.length,
    documentHash,
    sha3Hash,
    buffer,
  };
}
