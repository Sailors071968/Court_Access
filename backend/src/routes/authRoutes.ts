// ============================================
// Court Access — Auth Routes
// ============================================

import { Router } from 'express';
import { handleRegister, handleLogin, handleLogout, handleMe } from '../controllers/authController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/register', handleRegister);
router.post('/login', handleLogin);
router.post('/logout', authMiddleware, handleLogout);
router.get('/me', authMiddleware, handleMe);

export default router;
