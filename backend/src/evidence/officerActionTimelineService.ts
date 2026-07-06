// ============================================================================
// Phase 132 — Officer Action Timeline Service
// Constructs a chronological timeline of all officer actions linked to
// evidence timestamps. Merges events from video, audio, and text sources.
// ============================================================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TimelineEntry {
  timestamp: string;
  timestampSeconds: number;
  eventType: string;
  description: string;
  confidence: number;
  sourceType: string;
  sourceEvidence: string;
  eventId: string;
}

export interface OfficerTimeline {
  caseId: string;
  totalEntries: number;
  durationSeconds: number;
  entries: TimelineEntry[];
  summary: TimelineSummary;
}

export interface TimelineSummary {
  firstEvent: string;
  lastEvent: string;
  totalUofEvents: number;
  totalCommandEvents: number;
  totalProceduralEvents: number;
  highConfidenceEvents: number;
  criticalEvents: string[];
}

// ---------------------------------------------------------------------------
// Use-of-force related event types
// ---------------------------------------------------------------------------

const UOF_EVENT_TYPES = new Set([
  'suspect_restrained', 'taser_deployed', 'neck_restraint', 'physical_strike',
  'weapon_drawn', 'baton_strike', 'pepper_spray', 'k9_deployment',
  'shots_fired', 'prone_restraint',
]);

const COMMAND_EVENT_TYPES = new Set([
  'verbal_command', 'compliance_command', 'uof_warning', 'de_escalation_attempt',
]);

const PROCEDURAL_EVENT_TYPES = new Set([
  'miranda_warning', 'handcuffing', 'vehicle_search', 'pat_down_search',
]);

const CRITICAL_EVENT_TYPES = new Set([
  'neck_restraint', 'shots_fired', 'taser_deployed', 'prone_restraint',
  'physical_strike', 'k9_deployment',
]);

// ---------------------------------------------------------------------------
// Core timeline construction
// ---------------------------------------------------------------------------

/**
 * Parse timestamp string to seconds for sorting
 */
function parseTimestampToSeconds(ts: string): number {
  const parts = ts.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

/**
 * Build complete officer action timeline for a case
 */
export async function buildOfficerTimeline(caseId: string): Promise<OfficerTimeline> {
  const events = await prisma.evidenceEvent.findMany({
    where: { caseId },
    orderBy: { timestamp: 'asc' },
  });

  const entries: TimelineEntry[] = events.map(event => ({
    timestamp: event.timestamp,
    timestampSeconds: parseTimestampToSeconds(event.timestamp),
    eventType: event.eventType,
    description: event.description || `${event.eventType.replace(/_/g, ' ')} detected`,
    confidence: event.confidence,
    sourceType: event.sourceType,
    sourceEvidence: event.sourceEvidence,
    eventId: event.eventId,
  }));

  // Sort by timestamp seconds
  entries.sort((a, b) => a.timestampSeconds - b.timestampSeconds);

  // Build summary
  const summary = buildTimelineSummary(entries);

  const durationSeconds = entries.length > 0
    ? entries[entries.length - 1].timestampSeconds - entries[0].timestampSeconds
    : 0;

  return {
    caseId,
    totalEntries: entries.length,
    durationSeconds,
    entries,
    summary,
  };
}

/**
 * Build summary statistics for a timeline
 */
function buildTimelineSummary(entries: TimelineEntry[]): TimelineSummary {
  const criticalEvents: string[] = [];

  let totalUofEvents = 0;
  let totalCommandEvents = 0;
  let totalProceduralEvents = 0;
  let highConfidenceEvents = 0;

  for (const entry of entries) {
    if (UOF_EVENT_TYPES.has(entry.eventType)) totalUofEvents++;
    if (COMMAND_EVENT_TYPES.has(entry.eventType)) totalCommandEvents++;
    if (PROCEDURAL_EVENT_TYPES.has(entry.eventType)) totalProceduralEvents++;
    if (entry.confidence >= 0.80) highConfidenceEvents++;
    if (CRITICAL_EVENT_TYPES.has(entry.eventType)) {
      criticalEvents.push(`${entry.timestamp}: ${entry.eventType.replace(/_/g, ' ')}`);
    }
  }

  return {
    firstEvent: entries.length > 0 ? entries[0].timestamp : 'N/A',
    lastEvent: entries.length > 0 ? entries[entries.length - 1].timestamp : 'N/A',
    totalUofEvents,
    totalCommandEvents,
    totalProceduralEvents,
    highConfidenceEvents,
    criticalEvents,
  };
}

/**
 * Get timeline entries within a time range
 */
export async function getTimelineRange(
  caseId: string,
  startSeconds: number,
  endSeconds: number,
): Promise<TimelineEntry[]> {
  const timeline = await buildOfficerTimeline(caseId);
  return timeline.entries.filter(
    e => e.timestampSeconds >= startSeconds && e.timestampSeconds <= endSeconds,
  );
}

/**
 * Get timeline entries filtered by event type category
 */
export async function getTimelineByCategory(
  caseId: string,
  category: 'uof' | 'command' | 'procedural' | 'all',
): Promise<TimelineEntry[]> {
  const timeline = await buildOfficerTimeline(caseId);

  if (category === 'all') return timeline.entries;

  const typeSet = category === 'uof'
    ? UOF_EVENT_TYPES
    : category === 'command'
      ? COMMAND_EVENT_TYPES
      : PROCEDURAL_EVENT_TYPES;

  return timeline.entries.filter(e => typeSet.has(e.eventType));
}

/**
 * Format timeline as human-readable text
 */
export function formatTimelineText(timeline: OfficerTimeline): string {
  const lines: string[] = [
    `Officer Action Timeline — Case ${timeline.caseId}`,
    `Total Events: ${timeline.totalEntries} | Duration: ${Math.floor(timeline.durationSeconds / 60)}m ${timeline.durationSeconds % 60}s`,
    `Use-of-Force Events: ${timeline.summary.totalUofEvents} | Commands: ${timeline.summary.totalCommandEvents} | Procedural: ${timeline.summary.totalProceduralEvents}`,
    '',
    'Timeline:',
    '─'.repeat(70),
  ];

  for (const entry of timeline.entries) {
    const confidenceBar = entry.confidence >= 0.8 ? '██' : entry.confidence >= 0.6 ? '█░' : '░░';
    const critical = CRITICAL_EVENT_TYPES.has(entry.eventType) ? ' ⚠' : '';
    lines.push(
      `${entry.timestamp}  ${confidenceBar} ${entry.confidence.toFixed(2)}  ${entry.description}${critical}`,
    );
  }

  return lines.join('\n');
}
