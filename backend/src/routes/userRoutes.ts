// ============================================
// Court Access — User Routes
// ============================================

import { Router } from 'express';
import { handleGetUsers, handleUpdateUser } from '../controllers/userController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { tenantMiddleware } from '../middleware/tenantMiddleware.js';

const router = Router();

router.use(authMiddleware);
router.use(tenantMiddleware);

router.get('/', handleGetUsers);
router.patch('/me', handleUpdateUser);

export default router;
