// ============================================
// Court Access — Document Service
// ============================================

import { prisma } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../config/logger.js';
import { buildS3Key, uploadToS3, getS3DownloadUrl } from '../config/s3.js';
import { computeBufferSHA256, computeBufferSHA3_256 } from '../engines/hashEngine.js';
import { v4 as uuidv4 } from 'uuid';

export interface UploadDocumentInput {
  tenantId: string;
  caseId: string;
  uploadedBy: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}

export async function uploadDocument(input: UploadDocumentInput) {
  const documentId = uuidv4();
  const s3Key = buildS3Key(input.tenantId, input.caseId, documentId, input.fileName);

  // Dual-hash the document content (constitutional integrity)
  const fileHashSha256 = computeBufferSHA256(input.buffer);
  const fileHashSha3256 = computeBufferSHA3_256(input.buffer);

  // Upload to S3
  await uploadToS3(s3Key, input.buffer, input.mimeType);

  // Store metadata
  const doc = await prisma.document.create({
    data: {
      id: documentId,
      caseId: input.caseId,
      fileName: input.fileName,
      fileHashSha256,
      fileHashSha3256,
      storagePath: s3Key,
      uploadedBy: input.uploadedBy,
      analysisStatus: 'pending',
    },
  });

  logger.info('Document uploaded', {
    documentId: doc.id,
    caseId: input.caseId,
    tenantId: input.tenantId,
    fileSize: input.buffer.length,
  });

  return doc;
}

export async function listDocuments(caseId: string, tenantId: string) {
  // Verify case belongs to tenant
  const caseRecord = await prisma.case.findFirst({
    where: { id: caseId, tenantId },
  });
  if (!caseRecord) {
    throw new AppError('Case not found', 404);
  }

  return prisma.document.findMany({
    where: { caseId },
    orderBy: { uploadedAt: 'desc' },
  });
}

export async function getDocumentById(documentId: string, tenantId: string) {
  const doc = await prisma.document.findFirst({
    where: { id: documentId },
    include: { case: true },
  });

  if (!doc || doc.case.tenantId !== tenantId) {
    throw new AppError('Document not found', 404);
  }
  return doc;
}

export async function getDocumentDownloadUrl(documentId: string, tenantId: string): Promise<string> {
  const doc = await getDocumentById(documentId, tenantId);
  return getS3DownloadUrl(doc.storagePath);
}

export async function updateDocumentAnalysisStatus(
  documentId: string,
  status: string,
  extractedText?: string
) {
  return prisma.document.update({
    where: { id: documentId },
    data: {
      analysisStatus: status,
      ...(extractedText !== undefined ? { extractedText } : {}),
    },
  });
}
