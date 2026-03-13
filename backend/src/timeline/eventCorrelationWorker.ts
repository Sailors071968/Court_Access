// ============================================================================
// Timeline Reconstruction Engine — Worker 3: Event Correlation
// Matches events detected from multiple evidence sources into unified groups.
// Example: gunshot audio spike + bodycam transcript + 911 call = one event
// ============================================================================

import { PrismaClient } from '@prisma/client';
import type { EventCorrelationJob } from './timelineProcessingPipeline.js';
import { enqueueTimelineBuild } from './timelineProcessingPipeline.js';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Correlation Configuration
// ---------------------------------------------------------------------------

/** Maximum time difference (ms) between events to consider them correlated */
const CORRELATION_WINDOW_MS = 60_000; // 60 seconds

/** Minimum confidence to include an event in correlation */
const MIN_CORRELATION_CONFIDENCE = 0.3;

/** Event types that are likely to describe the same incident */
const CORRELATABLE_EVENT_TYPES: Record<string, string[]> = {
  gunshot: ['gunshot', 'audio_spike', 'use_of_force', '911_call'],
  officer_arrival: ['officer_arrival', 'dispatch', 'vehicle_stop'],
  vehicle_stop: ['vehicle_stop', 'officer_arrival', 'light_activation'],
  arrest: ['arrest', 'handcuff', 'miranda'],
  use_of_force: ['use_of_force', 'taser_deployment', 'gunshot'],
  taser_deployment: ['taser_deployment', 'use_of_force'],
  '911_call': ['911_call', 'dispatch', 'witness_observation'],
  foot_pursuit: ['foot_pursuit', 'arrest'],
  medical: ['medical', 'use_of_force', 'gunshot'],
};

// ---------------------------------------------------------------------------
// Correlation Algorithm
// ---------------------------------------------------------------------------

interface TimelineEventRow {
  eventId: string;
  caseId: string;
  tenantId: string;
  sourceEvidenceId: string | null;
  eventType: string;
  timestamp: Date;
  confidence: number;
  sourceType: string;
  description: string;
  correlationGroup: string | null;
}

/**
 * Find events that are temporally and semantically close enough to be correlated.
 * Uses a greedy approach: for each uncorrelated event, find all events within
 * the correlation window that have a compatible event type.
 */
function findCorrelationGroups(events: TimelineEventRow[]): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  const assigned = new Set<string>();
  let groupCounter = 0;

  // Sort by timestamp
  const sorted = [...events].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  for (let i = 0; i < sorted.length; i++) {
    const event = sorted[i];
    if (assigned.has(event.eventId)) continue;

    const compatibleTypes = CORRELATABLE_EVENT_TYPES[event.eventType] ?? [event.eventType];
    const groupId = `corr-${event.caseId}-${++groupCounter}`;
    const groupMembers = [event.eventId];
    assigned.add(event.eventId);

    // Look forward within the correlation window
    for (let j = i + 1; j < sorted.length; j++) {
      const candidate = sorted[j];
      if (assigned.has(candidate.eventId)) continue;

      const timeDiff = candidate.timestamp.getTime() - event.timestamp.getTime();
      if (timeDiff > CORRELATION_WINDOW_MS) break; // Past window

      // Must come from a different evidence source
      if (candidate.sourceEvidenceId === event.sourceEvidenceId) continue;

      // Must have a compatible event type
      if (!compatibleTypes.includes(candidate.eventType)) continue;

      groupMembers.push(candidate.eventId);
      assigned.add(candidate.eventId);
    }

    // Only create groups with 2+ members (cross-source)
    if (groupMembers.length >= 2) {
      groups.set(groupId, groupMembers);
    }
  }

  return groups;
}

// ---------------------------------------------------------------------------
// Worker Processor
// ---------------------------------------------------------------------------

export async function processEventCorrelation(job: EventCorrelationJob): Promise<{
  groupsCreated: number;
  eventsCorrelated: number;
}> {
  console.log(`[EventCorrelation] Correlating events for case ${job.caseId}`);

  // Fetch all events for this case above the minimum confidence threshold
  const events = await prisma.timelineEvent.findMany({
    where: {
      caseId: job.caseId,
      tenantId: job.tenantId,
      confidence: { gte: MIN_CORRELATION_CONFIDENCE },
    },
    orderBy: { timestamp: 'asc' },
  });

  if (events.length < 2) {
    console.log(`[EventCorrelation] Not enough events to correlate (${events.length})`);
    return { groupsCreated: 0, eventsCorrelated: 0 };
  }

  // Clear existing correlation groups for fresh analysis
  await prisma.timelineEvent.updateMany({
    where: { caseId: job.caseId, tenantId: job.tenantId },
    data: { correlationGroup: null },
  });

  // Find correlation groups
  const groups = findCorrelationGroups(events);

  // Apply correlation groups to events
  let eventsCorrelated = 0;
  for (const [groupId, memberIds] of groups) {
    await prisma.timelineEvent.updateMany({
      where: { eventId: { in: memberIds } },
      data: { correlationGroup: groupId },
    });
    eventsCorrelated += memberIds.length;
  }

  console.log(`[EventCorrelation] Created ${groups.size} correlation groups (${eventsCorrelated} events)`);

  // After correlation, trigger timeline build
  try {
    await enqueueTimelineBuild({
      caseId: job.caseId,
      tenantId: job.tenantId,
    });
  } catch (err) {
    console.error(`[EventCorrelation] Failed to enqueue timeline build:`, err);
  }

  return { groupsCreated: groups.size, eventsCorrelated };
}
