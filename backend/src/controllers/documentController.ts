// ============================================
// Court Access — Document Controller
// ============================================

import type { Request, Response, NextFunction } from 'express';
import { uploadDocument, listDocuments, getDocumentById, getDocumentDownloadUrl } from '../services/documentService.js';
import { enqueueAnalysisJob } from '../services/analysisQueueService.js';
import { getCaseById } from '../services/caseService.js';
import { logger } from '../config/logger.js';

export async function handleUploadDocument(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) { res.status(401).json({ error: 'Authentication required' }); return; }
    if (!req.file) { res.status(400).json({ error: 'No file uploaded' }); return; }

    const { caseId } = req.params;
    if (!caseId) { res.status(400).json({ error: 'caseId is required' }); return; }

    // Verify case belongs to tenant
    await getCaseById(caseId, req.user.tenantId);

    const doc = await uploadDocument({
      tenantId: req.user.tenantId,
      caseId,
      uploadedBy: req.user.userId,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      buffer: req.file.buffer,
    });

    // Enqueue analysis job
    try {
      await enqueueAnalysisJob({
        documentId: doc.id,
        caseId,
        tenantId: req.user.tenantId,
        storagePath: doc.storagePath,
        fileName: doc.fileName,
      });
    } catch (queueError) {
      logger.warn('Failed to enqueue analysis job — Redis may not be running', {
        documentId: doc.id,
        error: (queueError as Error).message,
      });
    }

    res.status(201).json({
      id: doc.id,
      fileName: doc.fileName,
      fileHashSha256: doc.fileHashSha256,
      fileHashSha3256: doc.fileHashSha3256,
      analysisStatus: 'pending',
    });
  } catch (error) {
    next(error);
  }
}

export async function handleListDocuments(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const { caseId } = req.params;
    const result = await listDocuments(caseId, req.user.tenantId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function handleGetDocument(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const doc = await getDocumentById(req.params.id, req.user.tenantId);
    res.json(doc);
  } catch (error) {
    next(error);
  }
}

export async function handleGetDocumentDownloadUrl(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const url = await getDocumentDownloadUrl(req.params.id, req.user.tenantId);
    res.json({ url });
  } catch (error) {
    next(error);
  }
}

export async function handleGetDocumentStatus(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const doc = await getDocumentById(req.params.id, req.user.tenantId);
    res.json({
      id: doc.id,
      analysisStatus: doc.analysisStatus,
      fileName: doc.fileName,
    });
  } catch (error) {
    next(error);
  }
}
