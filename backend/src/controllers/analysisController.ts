// ============================================
// Court Access — Analysis Controller
// ============================================

import type { Request, Response, NextFunction } from 'express';
import { getSnapshotsByDocument, getSnapshotById } from '../services/snapshotService.js';
import { getDocumentById } from '../services/documentService.js';

export async function handleGetAnalysisResults(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const { documentId } = req.params;

    // Verify document belongs to tenant
    await getDocumentById(documentId, req.user.tenantId);

    const snapshots = await getSnapshotsByDocument(documentId);
    res.json(snapshots);
  } catch (error) {
    next(error);
  }
}

export async function handleGetSnapshotById(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const snapshot = await getSnapshotById(req.params.id);

    // Verify snapshot's document belongs to tenant
    await getDocumentById(snapshot.documentId, req.user.tenantId);

    res.json(snapshot);
  } catch (error) {
    next(error);
  }
}
