// ---------------------------------------------------------------------------
// Phase 47 — CPRA Annual Policy Update Service
// Calculates annual update due dates and manages the yearly update cycle.
// ---------------------------------------------------------------------------

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ANNUAL_UPDATE_DAYS = 365;

// ---------------------------------------------------------------------------
// Phase 47 — Schedule annual policy update
// Called when policies are received from an agency.
// Sets policyReceivedAt and calculates annualUpdateDue = +365 days.
// ---------------------------------------------------------------------------

export async function scheduleAnnualPolicyUpdate(
  agencyId: string,
  requestId?: string,
): Promise<{ annualUpdateDue: Date; updateId: string | null }> {
  const now = new Date();
  const annualUpdateDue = new Date(now);
  annualUpdateDue.setDate(annualUpdateDue.getDate() + ANNUAL_UPDATE_DAYS);

  // If we have a specific CPRA request, update its fields
  if (requestId) {
    await prisma.cPRAAgencyRequest.update({
      where: { requestId },
      data: {
        policyReceivedAt: now,
        annualUpdateDue,
      },
    });
  }

  // Create an annual update record for tracking the next cycle
  const update = await prisma.cPRAAnnualUpdate.create({
    data: {
      agencyId,
      requestedAt: annualUpdateDue, // Will be sent on this date
      annualUpdateDue,
      status: 'scheduled',
    },
  });

  console.log(
    `[CPRA Annual] Scheduled annual update for agency ${agencyId} on ${annualUpdateDue.toISOString()}`,
  );

  return { annualUpdateDue, updateId: update.updateId };
}

// ---------------------------------------------------------------------------
// Find annual updates that are due today or overdue
// ---------------------------------------------------------------------------

export async function findDueAnnualUpdates(): Promise<
  Array<{
    updateId: string;
    agencyId: string;
    annualUpdateDue: Date | null;
    status: string;
  }>
> {
  const now = new Date();

  const dueUpdates = await prisma.cPRAAnnualUpdate.findMany({
    where: {
      annualUpdateDue: { lte: now },
      closed: false,
      status: 'scheduled',
    },
    orderBy: { annualUpdateDue: 'asc' },
  });

  return dueUpdates.map((u) => ({
    updateId: u.updateId,
    agencyId: u.agencyId,
    annualUpdateDue: u.annualUpdateDue,
    status: u.status,
  }));
}

// ---------------------------------------------------------------------------
// Find annual updates needing follow-up (sent but no response after 10 biz days)
// ---------------------------------------------------------------------------

export async function findAnnualUpdatesNeedingFollowUp(): Promise<
  Array<{
    updateId: string;
    agencyId: string;
    followUpCount: number;
    lastFollowUpAt: Date | null;
  }>
> {
  const tenDaysAgo = new Date();
  tenDaysAgo.setDate(tenDaysAgo.getDate() - 14); // ~10 business days

  const updates = await prisma.cPRAAnnualUpdate.findMany({
    where: {
      closed: false,
      responseReceived: false,
      status: { in: ['sent', 'follow_up_1', 'follow_up_2'] },
      followUpCount: { lt: 3 },
      OR: [
        { lastFollowUpAt: null, requestedAt: { lte: tenDaysAgo } },
        { lastFollowUpAt: { lte: tenDaysAgo } },
      ],
    },
    orderBy: { requestedAt: 'asc' },
  });

  return updates.map((u) => ({
    updateId: u.updateId,
    agencyId: u.agencyId,
    followUpCount: u.followUpCount,
    lastFollowUpAt: u.lastFollowUpAt,
  }));
}

// ---------------------------------------------------------------------------
// Mark annual update response received
// ---------------------------------------------------------------------------

export async function markAnnualUpdateReceived(
  updateId: string,
): Promise<{ success: boolean; error: string | null }> {
  const update = await prisma.cPRAAnnualUpdate.findUnique({
    where: { updateId },
  });

  if (!update) {
    return { success: false, error: `Annual update ${updateId} not found` };
  }

  const now = new Date();

  await prisma.cPRAAnnualUpdate.update({
    where: { updateId },
    data: {
      responseReceived: true,
      responseReceivedAt: now,
      policyReceivedAt: now,
      closed: true,
      status: 'received',
    },
  });

  return { success: true, error: null };
}

// ---------------------------------------------------------------------------
// Phase 52 — Restart cycle: schedule next annual update after receiving docs
// ---------------------------------------------------------------------------

export async function restartAnnualCycle(
  agencyId: string,
  updateId: string,
): Promise<{ nextUpdateDue: Date; newUpdateId: string }> {
  // Mark the current cycle as received
  await markAnnualUpdateReceived(updateId);

  // Schedule next annual update (365 days from now)
  const { annualUpdateDue, updateId: newUpdateId } =
    await scheduleAnnualPolicyUpdate(agencyId);

  console.log(
    `[CPRA Annual] Cycle restarted for agency ${agencyId}: next update due ${annualUpdateDue.toISOString()}`,
  );

  return {
    nextUpdateDue: annualUpdateDue,
    newUpdateId: newUpdateId ?? '',
  };
}

// ---------------------------------------------------------------------------
// Get annual update dashboard summary
// ---------------------------------------------------------------------------

export async function getAnnualUpdateSummary(): Promise<{
  totalScheduled: number;
  totalSent: number;
  totalAwaitingResponse: number;
  totalReceived: number;
  totalClosed: number;
  upcomingUpdates: Array<{
    updateId: string;
    agencyId: string;
    annualUpdateDue: Date | null;
    status: string;
  }>;
}> {
  const [totalScheduled, totalSent, totalAwaitingResponse, totalReceived, totalClosed] =
    await Promise.all([
      prisma.cPRAAnnualUpdate.count({ where: { status: 'scheduled' } }),
      prisma.cPRAAnnualUpdate.count({
        where: { status: { in: ['sent', 'follow_up_1', 'follow_up_2', 'follow_up_final'] } },
      }),
      prisma.cPRAAnnualUpdate.count({
        where: { closed: false, responseReceived: false, status: { not: 'scheduled' } },
      }),
      prisma.cPRAAnnualUpdate.count({ where: { status: 'received' } }),
      prisma.cPRAAnnualUpdate.count({ where: { closed: true } }),
    ]);

  // Next 30 days of upcoming updates
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const upcomingUpdates = await prisma.cPRAAnnualUpdate.findMany({
    where: {
      status: 'scheduled',
      annualUpdateDue: { lte: thirtyDaysFromNow },
    },
    orderBy: { annualUpdateDue: 'asc' },
    take: 50,
  });

  return {
    totalScheduled,
    totalSent,
    totalAwaitingResponse,
    totalReceived,
    totalClosed,
    upcomingUpdates: upcomingUpdates.map((u) => ({
      updateId: u.updateId,
      agencyId: u.agencyId,
      annualUpdateDue: u.annualUpdateDue,
      status: u.status,
    })),
  };
}
