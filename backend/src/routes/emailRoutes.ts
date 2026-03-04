// ============================================
// Court Access — Email Event Routes (SES/SNS webhook)
// ============================================

import { Router } from 'express';
import { handleEmailEvents } from '../controllers/emailController.js';

const router = Router();

// SNS webhook — no auth needed (verified via SNS message signing)
router.post('/events', handleEmailEvents);

export default router;
