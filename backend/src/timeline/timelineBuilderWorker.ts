// ============================================================================
// Timeline Reconstruction Engine — Worker 4: Timeline Builder
// Constructs the master case timeline: sorts events, detects conflicts,
// estimates clock offsets between cameras, produces the final timeline.
// ============================================================================

import { PrismaClient } from '@prisma/client';
import type { TimelineBuilderJob } from './timelineProcessingPipeline.js';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Conflict Detection Configuration
// ---------------------------------------------------------------------------

/** Events within this window that contradict each other are flagged */
const CONFLICT_WINDOW_MS = 120_000; // 2 minutes

/** Event types that logically cannot co-occur for the same subject */
const CONTRADICTORY_PAIRS: Array<[string, string]> = [
  ['officer_arrival', 'officer_arrival'], // same officer, different times
  ['arrest', 'foot_pursuit'], // can't be arrested and running at the same time
  ['gunshot', 'miranda'], // unlikely to read miranda during gunfire
  ['medical', 'foot_pursuit'], // can't receive medical and be in pursuit
];

// ---------------------------------------------------------------------------
// Conflict Detection
// ---------------------------------------------------------------------------

interface TimelineConflict {
  eventIdA: string;
  eventIdB: string;
  conflictType: 'temporal_contradiction' | 'sequence_error' | 'narrative_inconsistency';
  description: string;
  timeDifferenceMs: number;
}

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

function detectConflicts(events: TimelineEventRow[]): TimelineConflict[] {
  const conflicts: TimelineConflict[] = [];
  const sorted = [...events].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i];
      const b = sorted[j];
      const timeDiff = b.timestamp.getTime() - a.timestamp.getTime();

      if (timeDiff > CONFLICT_WINDOW_MS) break; // Past window

      // Check if from different sources (cross-source conflicts are more significant)
      if (a.sourceEvidenceId === b.sourceEvidenceId) continue;

      // Check contradictory pairs
      for (const [typeA, typeB] of CONTRADICTORY_PAIRS) {
        if (
          (a.eventType === typeA && b.eventType === typeB) ||
          (a.eventType === typeB && b.eventType === typeA)
        ) {
          conflicts.push({
            eventIdA: a.eventId,
            eventIdB: b.eventId,
            conflictType: 'temporal_contradiction',
            description: `${a.eventType} (${a.sourceType}) at ${a.timestamp.toISOString()} conflicts with ${b.eventType} (${b.sourceType}) at ${b.timestamp.toISOString()}`,
            timeDifferenceMs: timeDiff,
          });
        }
      }

      // Check for same event type from different sources with significant time gap
      // (potential clock sync issue)
      if (
        a.eventType === b.eventType &&
        a.correlationGroup === b.correlationGroup &&
        a.correlationGroup !== null &&
        timeDiff > 10_000 // > 10 seconds apart for "same" event
      ) {
        conflicts.push({
          eventIdA: a.eventId,
          eventIdB: b.eventId,
          conflictType: 'sequence_error',
          description: `Same ${a.eventType} event reported ${(timeDiff / 1000).toFixed(1)}s apart: ${a.sourceType} vs ${b.sourceType} — possible clock offset`,
          timeDifferenceMs: timeDiff,
        });
      }
    }
  }

  return conflicts;
}

// ---------------------------------------------------------------------------
// Clock Offset Estimation
// ---------------------------------------------------------------------------

interface ClockOffset {
  sourceA: string;
  sourceB: string;
  offsetMs: number;
  confidence: number;
  sampleCount: number;
}

/**
 * Estimate clock offsets between different video/evidence sources by analyzing
 * correlated events that should have the same timestamp.
 */
function estimateClockOffsets(events: TimelineEventRow[]): ClockOffset[] {
  const offsets: ClockOffset[] = [];
  const correlationGroups = new Map<string, TimelineEventRow[]>();

  // Group events by correlation group
  for (const event of events) {
    if (!event.correlationGroup) continue;
    const group = correlationGroups.get(event.correlationGroup) ?? [];
    group.push(event);
    correlationGroups.set(event.correlationGroup, group);
  }

  // For each group, compute pairwise offsets between sources
  const pairOffsets = new Map<string, number[]>();

  for (const [, group] of correlationGroups) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i];
        const b = group[j];
        const sortedTypes = [a.sourceType, b.sourceType].sort();
        const key = sortedTypes.join('::');
        // Ensure consistent sign: offset = first-alphabetically minus second-alphabetically
        const offset = a.sourceType === sortedTypes[0]
          ? a.timestamp.getTime() - b.timestamp.getTime()
          : b.timestamp.getTime() - a.timestamp.getTime();
        const existing = pairOffsets.get(key) ?? [];
        existing.push(offset);
        pairOffsets.set(key, existing);
      }
    }
  }

  // Compute median offset for each pair
  for (const [key, values] of pairOffsets) {
    if (values.length < 1) continue;
    values.sort((a, b) => a - b);
    const median = values[Math.floor(values.length / 2)];
    const [sourceA, sourceB] = key.split('::');

    offsets.push({
      sourceA,
      sourceB,
      offsetMs: median,
      confidence: Math.min(0.5 + values.length * 0.1, 0.95),
      sampleCount: values.length,
    });
  }

  return offsets;
}

// ---------------------------------------------------------------------------
// Worker Processor
// ---------------------------------------------------------------------------

export async function processTimelineBuild(job: TimelineBuilderJob): Promise<{
  eventCount: number;
  conflictCount: number;
  clockOffsets: ClockOffset[];
}> {
  console.log(`[TimelineBuilder] Building timeline for case ${job.caseId}${job.rebuild ? ' (rebuild)' : ''}`);

  // Update or create case timeline record
  let timeline = await prisma.caseTimeline.findUnique({
    where: { caseId: job.caseId },
  });

  if (!timeline) {
    timeline = await prisma.caseTimeline.create({
      data: {
        caseId: job.caseId,
        tenantId: job.tenantId,
        status: 'building',
      },
    });
  } else {
    await prisma.caseTimeline.update({
      where: { caseId: job.caseId },
      data: { status: 'building' },
    });
  }

  // Note: rebuild no longer clears correlation groups. The correlation data
  // is produced by the event correlation worker and is expensive to regenerate.
  // Rebuild re-runs conflict detection and clock offset estimation on existing
  // correlated data. To fully re-correlate, trigger the full pipeline instead.

  // Fetch all events for this case
  const events = await prisma.timelineEvent.findMany({
    where: { caseId: job.caseId, tenantId: job.tenantId },
    orderBy: { timestamp: 'asc' },
  });

  // Detect conflicts
  const conflicts = detectConflicts(events);

  // Estimate clock offsets
  const clockOffsets = estimateClockOffsets(events);

  // Update timeline record
  await prisma.caseTimeline.update({
    where: { caseId: job.caseId },
    data: {
      status: 'complete',
      eventCount: events.length,
      conflictCount: conflicts.length,
      clockOffsets: clockOffsets.length > 0 ? clockOffsets : null,
      builtAt: new Date(),
      metadata: {
        buildDuration: 'computed',
        conflictDetails: conflicts.map((c) => ({
          type: c.conflictType,
          description: c.description,
          eventIdA: c.eventIdA,
          eventIdB: c.eventIdB,
        })),
      },
    },
  });

  console.log(
    `[TimelineBuilder] Timeline complete: ${events.length} events, ${conflicts.length} conflicts, ${clockOffsets.length} clock offsets`,
  );

  return {
    eventCount: events.length,
    conflictCount: conflicts.length,
    clockOffsets,
  };
}
