// ============================================
// Court Access — Document Service
// ============================================

import { eq, and, desc } from 'drizzle-orm';
import { db } from '../config/database.js';
import { documents } from '../models/schema.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/loggingUtils.js';
import { buildS3Key, uploadToS3, getS3DownloadUrl } from '../utils/fileUtils.js';
import { computeBufferSHA256, computeBufferSHA3_256 } from '../utils/hashUtils.js';
import { v4 as uuidv4 } from 'uuid';

export interface UploadDocumentInput {
  tenantId: string;
  caseId: string;
  uploadedBy: string;
  fileName: string;
  fileType: string;
  mimeType: string;
  buffer: Buffer;
}

/**
 * Upload and store a document (tenant-scoped).
 * 1. Validate file
 * 2. Hash file content (dual-hash)
 * 3. Upload to S3
 * 4. Store metadata in database
 */
export async function uploadDocument(input: UploadDocumentInput) {
  const documentId = uuidv4();
  const s3Key = buildS3Key(input.tenantId, input.caseId, documentId, input.fileName);

  // Dual-hash the document content
  const documentHash = computeBufferSHA256(input.buffer);
  const sha3Hash = computeBufferSHA3_256(input.buffer);

  // Upload to S3
  await uploadToS3(s3Key, input.buffer, input.mimeType);

  // Store metadata
  const [doc] = await db
    .insert(documents)
    .values({
      id: documentId,
      tenantId: input.tenantId,
      caseId: input.caseId,
      fileName: input.fileName,
      fileType: input.fileType,
      fileSize: input.buffer.length,
      s3Key,
      documentHash,
      sha3Hash,
      uploadedBy: input.uploadedBy,
      extractionStatus: 'pending',
      analysisStatus: 'pending',
    })
    .returning();

  logger.info('Document uploaded', {
    documentId: doc.id,
    caseId: input.caseId,
    tenantId: input.tenantId,
    fileSize: input.buffer.length,
  });

  return doc;
}

/**
 * List documents for a case (tenant-scoped).
 */
export async function listDocuments(caseId: string, tenantId: string) {
  return db
    .select()
    .from(documents)
    .where(and(eq(documents.caseId, caseId), eq(documents.tenantId, tenantId)))
    .orderBy(desc(documents.uploadTimestamp));
}

/**
 * Get a single document by ID (tenant-scoped).
 */
export async function getDocumentById(documentId: string, tenantId: string) {
  const [doc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.tenantId, tenantId)))
    .limit(1);

  if (!doc) {
    throw new AppError('Document not found', 404);
  }
  return doc;
}

/**
 * Get a presigned download URL for a document.
 */
export async function getDocumentDownloadUrl(documentId: string, tenantId: string): Promise<string> {
  const doc = await getDocumentById(documentId, tenantId);
  return getS3DownloadUrl(doc.s3Key);
}

/**
 * Update document extraction/analysis status.
 */
export async function updateDocumentStatus(
  documentId: string,
  tenantId: string,
  updates: {
    extractedText?: string;
    extractionStatus?: string;
    analysisStatus?: string;
  }
) {
  const [updated] = await db
    .update(documents)
    .set(updates)
    .where(and(eq(documents.id, documentId), eq(documents.tenantId, tenantId)))
    .returning();

  return updated;
}
