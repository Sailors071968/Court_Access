// ============================================================================
// Autonomous CPRA System — Notification Service
// Creates and manages real-time notifications for CPRA acquisition events.
// ============================================================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CpraEventType =
  | 'EMAIL_SENT'
  | 'EMAIL_RECEIVED'
  | 'DOCUMENT_UPLOADED'
  | 'POLICY_PARSED'
  | 'POLICY_ACTIVE'
  | 'FOLLOW_UP_SENT'
  | 'REQUEST_CREATED';

export interface CreateNotificationParams {
  agencyId?: string;
  eventType: CpraEventType;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationEntry {
  notificationId: string;
  agencyId: string | null;
  eventType: string;
  title: string;
  message: string;
  metadata: string | null;
  read: boolean;
  dismissed: boolean;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Create a notification
// ---------------------------------------------------------------------------

export async function createNotification(
  params: CreateNotificationParams,
): Promise<NotificationEntry> {
  const entry = await prisma.cpraNotification.create({
    data: {
      agencyId: params.agencyId ?? null,
      eventType: params.eventType,
      title: params.title,
      message: params.message,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    },
  });

  console.log(`[CPRA Notification] ${params.eventType}: ${params.title}`);
  return entry;
}

// ---------------------------------------------------------------------------
// Get notifications (with optional filters)
// ---------------------------------------------------------------------------

export async function getNotifications(options?: {
  unreadOnly?: boolean;
  eventType?: CpraEventType;
  agencyId?: string;
  limit?: number;
  since?: Date;
}): Promise<NotificationEntry[]> {
  const where: Record<string, unknown> = {};

  if (options?.unreadOnly) {
    where.read = false;
    where.dismissed = false;
  }
  if (options?.eventType) {
    where.eventType = options.eventType;
  }
  if (options?.agencyId) {
    where.agencyId = options.agencyId;
  }
  if (options?.since) {
    where.createdAt = { gte: options.since };
  }

  return prisma.cpraNotification.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: options?.limit ?? 100,
  });
}

// ---------------------------------------------------------------------------
// Mark notification as read
// ---------------------------------------------------------------------------

export async function markNotificationRead(notificationId: string): Promise<void> {
  await prisma.cpraNotification.update({
    where: { notificationId },
    data: { read: true },
  });
}

// ---------------------------------------------------------------------------
// Mark all notifications as read
// ---------------------------------------------------------------------------

export async function markAllNotificationsRead(): Promise<number> {
  const result = await prisma.cpraNotification.updateMany({
    where: { read: false },
    data: { read: true },
  });
  return result.count;
}

// ---------------------------------------------------------------------------
// Dismiss a notification
// ---------------------------------------------------------------------------

export async function dismissNotification(notificationId: string): Promise<void> {
  await prisma.cpraNotification.update({
    where: { notificationId },
    data: { dismissed: true },
  });
}

// ---------------------------------------------------------------------------
// Get unread notification count
// ---------------------------------------------------------------------------

export async function getUnreadCount(): Promise<number> {
  return prisma.cpraNotification.count({
    where: { read: false, dismissed: false },
  });
}

// ---------------------------------------------------------------------------
// Get notification summary by event type
// ---------------------------------------------------------------------------

export async function getNotificationSummary(): Promise<{
  total: number;
  unread: number;
  byEventType: Record<string, number>;
}> {
  const [total, unread, groups] = await Promise.all([
    prisma.cpraNotification.count(),
    prisma.cpraNotification.count({ where: { read: false, dismissed: false } }),
    prisma.cpraNotification.groupBy({
      by: ['eventType'],
      _count: true,
    }),
  ]);

  const byEventType: Record<string, number> = {};
  for (const group of groups) {
    byEventType[group.eventType] = group._count;
  }

  return { total, unread, byEventType };
}
