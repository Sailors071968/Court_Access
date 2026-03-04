// ============================================
// Court Access — Email Event Controller (SES/SNS)
// ============================================

import type { Request, Response, NextFunction } from 'express';
import { handleSESEvent } from '../services/emailService.js';
import { logger } from '../config/logger.js';

/**
 * POST /email/events
 * Handles SNS notifications from AWS SES.
 */
export async function handleEmailEvents(req: Request, res: Response, next: NextFunction) {
  try {
    const body = req.body;

    // Handle SNS subscription confirmation
    if (body.Type === 'SubscriptionConfirmation') {
      logger.info('SNS subscription confirmation received', { subscribeUrl: body.SubscribeURL });
      // In production, auto-confirm by fetching the SubscribeURL
      res.json({ message: 'Subscription confirmation received' });
      return;
    }

    // Handle SNS notification
    if (body.Type === 'Notification') {
      let message;
      try {
        message = JSON.parse(body.Message);
      } catch {
        message = body.Message;
      }

      if (message && message.eventType) {
        await handleSESEvent(message);
      }
    }

    res.json({ received: true });
  } catch (error) {
    next(error);
  }
}
