// ============================================
// Court Access — Document Controller
// ============================================

import type { FastifyRequest, FastifyReply } from 'fastify';
import { uploadDocument, listDocuments, getDocumentById, getDocumentDownloadUrl, updateDocumentStatus } from '../services/documentService.js';
import { runIngestionPipeline } from '../pipeline/ingestionPipeline.js';
import { runExtractionPipeline } from '../pipeline/extractionPipeline.js';
import { runIntelligencePipeline } from '../pipeline/intelligencePipeline.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/loggingUtils.js';

export async function handleUploadDocument(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user) throw new AppError('Authentication required', 401);

  const data = await request.file();
  if (!data) {
    throw new AppError('No file uploaded', 400);
  }

  const { caseId } = request.params as { caseId: string };
  const buffer = await data.toBuffer();

  // Stage 1: Ingestion
  const ingestion = runIngestionPipeline(data.filename, data.mimetype, buffer);

  // Upload to S3 and store metadata
  const doc = await uploadDocument({
    tenantId: request.user.tenantId,
    caseId,
    uploadedBy: request.user.userId,
    fileName: ingestion.fileName,
    fileType: ingestion.fileType,
    mimeType: data.mimetype,
    buffer: ingestion.buffer,
  });

  // Stage 2: Extraction (async — don't block upload response)
  processDocumentAsync(doc.id, doc.tenantId, doc.caseId, buffer, ingestion.fileType).catch(
    (err) => logger.error('Async document processing failed', { documentId: doc.id, error: (err as Error).message })
  );

  return reply.status(201).send({
    id: doc.id,
    fileName: doc.fileName,
    fileType: doc.fileType,
    fileSize: doc.fileSize,
    documentHash: doc.documentHash,
    analysisStatus: 'processing',
  });
}

async function processDocumentAsync(
  documentId: string,
  tenantId: string,
  caseId: string,
  buffer: Buffer,
  fileType: string
) {
  try {
    // Stage 2: Extract text
    const extractedText = await runExtractionPipeline(buffer, fileType);
    await updateDocumentStatus(documentId, tenantId, {
      extractedText,
      extractionStatus: 'complete',
    });

    if (!extractedText || extractedText.length === 0) {
      await updateDocumentStatus(documentId, tenantId, {
        analysisStatus: 'extraction_failed',
      });
      return;
    }

    // Stage 3: AI Analysis with constitutional enforcement
    await runIntelligencePipeline({
      documentId,
      caseId,
      tenantId,
      extractedText,
    });

    logger.info('Document processing complete', { documentId });
  } catch (error) {
    logger.error('Document processing failed', {
      documentId,
      error: (error as Error).message,
    });
    await updateDocumentStatus(documentId, tenantId, {
      analysisStatus: 'failed',
    });
  }
}

export async function handleListDocuments(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user) throw new AppError('Authentication required', 401);
  const { caseId } = request.params as { caseId: string };
  const result = await listDocuments(caseId, request.user.tenantId);
  return reply.send(result);
}

export async function handleGetDocument(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user) throw new AppError('Authentication required', 401);
  const { id } = request.params as { id: string };
  const doc = await getDocumentById(id, request.user.tenantId);
  return reply.send(doc);
}

export async function handleGetDocumentDownloadUrl(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user) throw new AppError('Authentication required', 401);
  const { id } = request.params as { id: string };
  const url = await getDocumentDownloadUrl(id, request.user.tenantId);
  return reply.send({ url });
}
