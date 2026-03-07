// ============================================
// Court Access — Evidence Timeline Generator (Foundation)
// Phase 115: Chronological case timeline generation
//
// Ingests:
// - Structured transcripts (from transcriptParser)
// - Evidence documents (metadata + extracted text)
// - Manual timeline entries
//
// Generates:
// - Chronological case timeline with source attribution
// - Conflict detection between timeline entries
// ============================================

import prisma from './prismaClient.js';

/**
 * Generate a chronological case timeline from all available evidence.
 *
 * @param {string} caseId - The case ID
 * @returns {Promise<{ timeline: Array, conflicts: Array, metadata: object }>}
 */
export async function generateTimeline(caseId) {
  // Gather all timeline events from database
  const events = await prisma.timelineEvent.findMany({
    where: { caseId },
    orderBy: { timestamp: 'asc' },
  });

  // Gather transcript segments that have timestamps
  const transcripts = await prisma.mediaTranscript.findMany({
    where: { caseId, status: 'complete' },
    orderBy: { startTime: 'asc' },
  });

  // Build unified timeline
  const timeline = [];

  // Add existing timeline events
  for (const event of events) {
    timeline.push({
      id: event.id,
      timestamp: event.timestamp,
      description: event.eventDescription,
      sourceType: event.sourceType,
      sourceEvidenceId: event.sourceEvidenceId,
      eventType: event.eventType,
      confidence: event.confidenceScore,
      source: 'timeline_event',
    });
  }

  // Add transcript-derived events (segments with meaningful content)
  for (const transcript of transcripts) {
    if (transcript.startTime > 0) {
      timeline.push({
        id: transcript.id,
        timestamp: new Date(transcript.startTime * 1000), // Convert seconds to Date
        description: `[${transcript.speakerLabel || 'Speaker'}] ${transcript.transcriptText.substring(0, 200)}`,
        sourceType: 'transcript',
        sourceEvidenceId: transcript.evidenceId,
        eventType: 'dialogue',
        confidence: transcript.confidenceScore,
        source: 'media_transcript',
      });
    }
  }

  // Sort by timestamp
  timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Detect conflicts (overlapping timestamps with contradictory descriptions)
  const conflicts = detectConflicts(timeline);

  return {
    timeline,
    conflicts,
    metadata: {
      caseId,
      totalEvents: timeline.length,
      timelineEventCount: events.length,
      transcriptSegmentCount: transcripts.length,
      conflictCount: conflicts.length,
      generatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Detect timeline conflicts — events at the same time with contradictory info.
 */
function detectConflicts(timeline) {
  const conflicts = [];
  const WINDOW_MS = 60000; // 1-minute window for "same time"

  for (let i = 0; i < timeline.length; i++) {
    for (let j = i + 1; j < timeline.length; j++) {
      const timeDiff = Math.abs(
        new Date(timeline[i].timestamp).getTime() - new Date(timeline[j].timestamp).getTime()
      );

      if (timeDiff > WINDOW_MS) break; // Sorted — no more overlaps

      // Check if different sources describe the same timeframe differently
      if (
        timeline[i].sourceEvidenceId !== timeline[j].sourceEvidenceId &&
        timeline[i].sourceType !== timeline[j].sourceType
      ) {
        conflicts.push({
          eventA: { id: timeline[i].id, description: timeline[i].description, source: timeline[i].sourceType },
          eventB: { id: timeline[j].id, description: timeline[j].description, source: timeline[j].sourceType },
          timeDifferenceMs: timeDiff,
          type: 'temporal_overlap',
        });
      }
    }
  }

  return conflicts;
}

/**
 * Add a manual timeline entry.
 *
 * @param {object} params
 * @param {string} params.caseId
 * @param {Date} params.timestamp
 * @param {string} params.description
 * @param {string} params.eventType
 * @param {string} [params.sourceEvidenceId]
 * @returns {Promise<object>} The created timeline event
 */
export async function addTimelineEntry(params) {
  const { caseId, timestamp, description, eventType = 'manual', sourceEvidenceId = null } = params;

  const event = await prisma.timelineEvent.create({
    data: {
      caseId,
      timestamp: new Date(timestamp),
      eventDescription: description,
      eventType,
      sourceType: 'manual',
      sourceEvidenceId,
      confidenceScore: 1.0,
    },
  });

  return event;
}

/**
 * Format timeline for display.
 * Output example:
 *   10:02:14 AM — Officer Smith enters residence
 *   10:03:02 AM — Defendant detained
 */
export function formatTimelineText(timeline) {
  const lines = [];

  for (const event of timeline) {
    const date = new Date(event.timestamp);
    const timeStr = date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });

    lines.push(`${timeStr} — ${event.description}`);
  }

  return lines.join('\n');
}
