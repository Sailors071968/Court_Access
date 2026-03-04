// ============================================
// Court Access — Analysis Routes
// ============================================

import { Router } from 'express';
import { handleGetAnalysisResults, handleGetSnapshotById } from '../controllers/analysisController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { tenantMiddleware } from '../middleware/tenantMiddleware.js';

const router = Router();

router.use(authMiddleware);
router.use(tenantMiddleware);

router.get('/document/:documentId', handleGetAnalysisResults);
router.get('/snapshot/:id', handleGetSnapshotById);

export default router;
