// ============================================
// Court Access — Analytics Routes
// ============================================

import { Router } from 'express';
import { handleGetDashboardMetrics } from '../controllers/analyticsController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { tenantMiddleware } from '../middleware/tenantMiddleware.js';

const router = Router();

router.use(authMiddleware);
router.use(tenantMiddleware);

router.get('/dashboard', handleGetDashboardMetrics);

export default router;
