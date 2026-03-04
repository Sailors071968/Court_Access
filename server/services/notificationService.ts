// ============================================
// Court Access — Notification Service
// ============================================

import { eq, and, desc } from 'drizzle-orm';
import { db } from '../config/database.js';
import { notifications } from '../models/schema.js';
import { logger } from '../utils/loggingUtils.js';

export interface CreateNotificationInput {
  tenantId: string;
  userId: string;
  type: string;
  channel: string;
  message: string;
}

/**
 * Create a notification record.
 */
export async function createNotification(input: CreateNotificationInput) {
  const [notification] = await db
    .insert(notifications)
    .values({
      tenantId: input.tenantId,
      userId: input.userId,
      type: input.type,
      channel: input.channel,
      message: input.message,
      sentStatus: 'pending',
    })
    .returning();

  logger.info('Notification created', {
    notificationId: notification.id,
    type: input.type,
    channel: input.channel,
  });

  return notification;
}

/**
 * List notifications for a user (tenant-scoped).
 */
export async function listNotifications(userId: string, tenantId: string) {
  return db
    .select()
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.tenantId, tenantId)))
    .orderBy(desc(notifications.createdAt));
}

/**
 * Update notification sent status.
 */
export async function updateNotificationStatus(
  notificationId: string,
  sentStatus: string,
  twilioSid?: string
) {
  const updateData: Record<string, unknown> = { sentStatus };
  if (twilioSid) updateData.twilioSid = twilioSid;

  const [updated] = await db
    .update(notifications)
    .set(updateData)
    .where(eq(notifications.id, notificationId))
    .returning();

  return updated;
}
