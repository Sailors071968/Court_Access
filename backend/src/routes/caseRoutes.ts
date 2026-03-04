// ============================================
// Court Access — Case Routes
// ============================================

import { Router } from 'express';
import { handleCreateCase, handleListCases, handleGetCase } from '../controllers/caseController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { tenantMiddleware } from '../middleware/tenantMiddleware.js';

const router = Router();

router.use(authMiddleware);
router.use(tenantMiddleware);

router.post('/', handleCreateCase);
router.get('/', handleListCases);
router.get('/:id', handleGetCase);

export default router;
