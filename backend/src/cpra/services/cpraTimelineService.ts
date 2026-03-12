// ============================================================================
// Autonomous CPRA System — Timeline Service
// Manages per-agency timeline events for the CPRA acquisition dashboard.
// ============================================================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TimelineEventType =
  | 'REQUEST_SENT'
  | 'EMAIL_RECEIVED'
  | 'ATTACHMENT_DETECTED'
  | 'POLICY_UPLOADED'
  | 'POLICY_INGESTED'
  | 'FOLLOW_UP_SENT'
  | 'STATUS_CHANGED';

export interface AddTimelineEventParams {
  agencyId: string;
  eventType: TimelineEventType;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface TimelineEvent {
  eventId: string;
  agencyId: string;
  eventType: string;
  title: string;
  description: string | null;
  metadata: string | null;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Add a timeline event
// ---------------------------------------------------------------------------

export async function addTimelineEvent(
  params: AddTimelineEventParams,
): Promise<TimelineEvent> {
  const event = await prisma.cpraTimelineEvent.create({
    data: {
      agencyId: params.agencyId,
      eventType: params.eventType,
      title: params.title,
      description: params.description ?? null,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    },
  });

  return event;
}

// ---------------------------------------------------------------------------
// Get timeline for an agency
// ---------------------------------------------------------------------------

export async function getAgencyTimeline(
  agencyId: string,
  limit: number = 100,
): Promise<TimelineEvent[]> {
  return prisma.cpraTimelineEvent.findMany({
    where: { agencyId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

// ---------------------------------------------------------------------------
// Get recent timeline events across all agencies
// ---------------------------------------------------------------------------

export async function getRecentTimelineEvents(
  limit: number = 50,
  since?: Date,
): Promise<TimelineEvent[]> {
  const where: Record<string, unknown> = {};
  if (since) {
    where.createdAt = { gte: since };
  }

  return prisma.cpraTimelineEvent.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

// ---------------------------------------------------------------------------
// Get timeline event counts by agency
// ---------------------------------------------------------------------------

export async function getTimelineCountsByAgency(): Promise<
  Array<{ agencyId: string; eventCount: number }>
> {
  const groups = await prisma.cpraTimelineEvent.groupBy({
    by: ['agencyId'],
    _count: true,
    orderBy: { _count: { agencyId: 'desc' } },
  });

  return groups.map((g) => ({
    agencyId: g.agencyId,
    eventCount: g._count,
  }));
}
