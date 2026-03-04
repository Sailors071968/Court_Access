// ============================================
// Court Access — Analysis Controller
// ============================================

import type { FastifyRequest, FastifyReply } from 'fastify';
import { getAnalysisResult, getAnalysisResultById } from '../services/analysisService.js';
import { getDocumentById, updateDocumentStatus } from '../services/documentService.js';
import { runExtractionPipeline } from '../pipeline/extractionPipeline.js';
import { runIntelligencePipeline } from '../pipeline/intelligencePipeline.js';
import { getS3FileBuffer } from '../utils/fileUtils.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/loggingUtils.js';

export async function handleRunAnalysis(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user) throw new AppError('Authentication required', 401);

  const { documentId } = request.body as { documentId: string };
  if (!documentId) throw new AppError('documentId is required', 400);

  const doc = await getDocumentById(documentId, request.user.tenantId);

  let extractedText = doc.extractedText;

  // If text not yet extracted, do it now
  if (!extractedText) {
    try {
      const buffer = await getS3FileBuffer(doc.s3Key);
      extractedText = await runExtractionPipeline(buffer, doc.fileType);
      await updateDocumentStatus(doc.id, request.user.tenantId, {
        extractedText,
        extractionStatus: 'complete',
      });
    } catch (error) {
      logger.error('Extraction failed during manual analysis', { documentId, error: (error as Error).message });
      throw new AppError('Text extraction failed', 500);
    }
  }

  if (!extractedText || extractedText.length === 0) {
    throw new AppError('No text could be extracted from document', 400);
  }

  // Run intelligence pipeline
  const result = await runIntelligencePipeline({
    documentId: doc.id,
    caseId: doc.caseId,
    tenantId: request.user.tenantId,
    extractedText,
  });

  return reply.send(result);
}

export async function handleGetAnalysisResult(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user) throw new AppError('Authentication required', 401);
  const { id } = request.params as { id: string };
  const result = await getAnalysisResultById(id, request.user.tenantId);
  return reply.send(result);
}
