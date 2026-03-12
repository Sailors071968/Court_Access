// ============================================================================
// Phase 3 — Unified Timeline Engine
// Merges events from all sources into a single canonical timeline.
// Handles timestamp priority ordering and clock drift correction.
// ============================================================================

import { v4 as uuidv4 } from 'uuid';
import type {
  ExtractedEvent,
  TimelineEvent,
  TimelineMergeResult,
  TimestampSource,
  AlignmentMethod,
} from './types.ts';
import { TIMESTAMP_PRIORITY } from './types.ts';

// ---------------------------------------------------------------------------
// Clock Drift Detection
// ---------------------------------------------------------------------------

interface DriftPair {
  sourceA: TimestampSource;
  sourceB: TimestampSource;
  driftMs: number;
  sampleCount: number;
}

/**
 * Detect clock drift between different timestamp sources by finding
 * events that likely refer to the same real-world event but have
 * timestamps from different sources.
 */
function detectClockDrift(events: ExtractedEvent[]): DriftPair[] {
  const drifts: DriftPair[] = [];
  const sourceGroups = new Map<TimestampSource, ExtractedEvent[]>();

  for (const ev of events) {
    if (!ev.timestamp || !ev.timestampSource) continue;
    const group = sourceGroups.get(ev.timestampSource) ?? [];
    group.push(ev);
    sourceGroups.set(ev.timestampSource, group);
  }

  const sources = Array.from(sourceGroups.keys());

  for (let i = 0; i < sources.length; i++) {
    for (let j = i + 1; j < sources.length; j++) {
      const sourceA = sources[i];
      const sourceB = sources[j];
      const eventsA = sourceGroups.get(sourceA) ?? [];
      const eventsB = sourceGroups.get(sourceB) ?? [];

      // Find events of the same type that are close in time
      const driftSamples: number[] = [];

      for (const evA of eventsA) {
        for (const evB of eventsB) {
          if (evA.eventType === evB.eventType && evA.timestamp && evB.timestamp) {
            const tsA = parseTimestamp(evA.timestamp);
            const tsB = parseTimestamp(evB.timestamp);
            if (tsA !== null && tsB !== null) {
              const diff = tsA - tsB;
              // Only consider pairs within 10 minutes of each other
              if (Math.abs(diff) < 600_000) {
                driftSamples.push(diff);
              }
            }
          }
        }
      }

      if (driftSamples.length > 0) {
        // Use median drift to be robust against outliers
        driftSamples.sort((a, b) => a - b);
        const medianDrift = driftSamples[Math.floor(driftSamples.length / 2)];
        drifts.push({
          sourceA,
          sourceB,
          driftMs: medianDrift,
          sampleCount: driftSamples.length,
        });
      }
    }
  }

  return drifts;
}

// ---------------------------------------------------------------------------
// Timestamp Parsing
// ---------------------------------------------------------------------------

/**
 * Parse a timestamp string into epoch milliseconds.
 * Handles multiple formats: ISO, HH:MM:SS, HH:MM, HHMM, 12-hour with AM/PM.
 * Time-only strings are normalized to a reference date (UTC epoch day 0)
 * to ensure all return values are in the same numeric domain.
 */
function parseTimestamp(ts: string, referenceDate?: string): number | null {
  if (!ts) return null;

  // Try ISO format first
  const isoDate = new Date(ts);
  if (!isNaN(isoDate.getTime())) {
    return isoDate.getTime();
  }

  // For time-only formats, normalize to a reference date so all values
  // are in epoch-ms domain (consistent with ISO results).
  // Default reference: 1970-01-01 (UTC epoch day 0).
  const refPrefix = referenceDate ?? '1970-01-01';

  // 24-hour: 14:30:00 or 14:30
  const match24 = ts.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (match24) {
    const h = match24[1].padStart(2, '0');
    const m = match24[2];
    const s = (match24[3] ?? '00').padStart(2, '0');
    const d = new Date(`${refPrefix}T${h}:${m}:${s}Z`);
    return !isNaN(d.getTime()) ? d.getTime() : null;
  }

  // Military: 1430 or 1430 hrs
  const matchMil = ts.match(/^(\d{4})\s*(?:hrs?)?$/i);
  if (matchMil) {
    const h = matchMil[1].slice(0, 2);
    const m = matchMil[1].slice(2, 4);
    const d = new Date(`${refPrefix}T${h}:${m}:00Z`);
    return !isNaN(d.getTime()) ? d.getTime() : null;
  }

  // 12-hour: 2:30 PM
  const match12 = ts.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM|a\.m\.|p\.m\.)/i);
  if (match12) {
    let h = parseInt(match12[1], 10);
    const m = match12[2];
    const s = (match12[3] ?? '00').padStart(2, '0');
    const isPM = /pm|p\.m\./i.test(match12[4]);
    if (isPM && h < 12) h += 12;
    if (!isPM && h === 12) h = 0;
    const d = new Date(`${refPrefix}T${String(h).padStart(2, '0')}:${m}:${s}Z`);
    return !isNaN(d.getTime()) ? d.getTime() : null;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Timestamp Priority Resolution
// ---------------------------------------------------------------------------

/**
 * Get priority rank for a timestamp source (lower = higher priority).
 */
function getTimestampPriority(source: TimestampSource): number {
  const idx = TIMESTAMP_PRIORITY.indexOf(source);
  return idx === -1 ? TIMESTAMP_PRIORITY.length : idx;
}

/**
 * Choose the best timestamp from multiple sources for the same event.
 */
function resolveCanonicalTimestamp(
  events: ExtractedEvent[],
  drifts: DriftPair[],
): { timestamp: string; source: TimestampSource; method: AlignmentMethod; driftMs: number } {
  // Sort by priority (best source first)
  const withTimestamps = events
    .filter((e) => e.timestamp && e.timestampSource)
    .sort((a, b) => {
      const prioA = getTimestampPriority(a.timestampSource!);
      const prioB = getTimestampPriority(b.timestampSource!);
      return prioA - prioB;
    });

  if (withTimestamps.length === 0) {
    return {
      timestamp: new Date().toISOString(),
      source: 'manual',
      method: 'estimated',
      driftMs: 0,
    };
  }

  const best = withTimestamps[0];
  let driftCorrection = 0;
  let method: AlignmentMethod = 'direct';

  // Check if we need to apply drift correction
  if (withTimestamps.length > 1) {
    const secondBest = withTimestamps[1];
    const drift = drifts.find(
      (d) =>
        (d.sourceA === best.timestampSource && d.sourceB === secondBest.timestampSource) ||
        (d.sourceB === best.timestampSource && d.sourceA === secondBest.timestampSource),
    );

    if (drift && Math.abs(drift.driftMs) > 1000) {
      method = 'clock_drift_corrected';
      driftCorrection = drift.driftMs;
    } else if (withTimestamps.length > 2) {
      method = 'cross_reference';
    }
  }

  return {
    timestamp: best.timestamp!,
    source: best.timestampSource!,
    method,
    driftMs: driftCorrection,
  };
}

// ---------------------------------------------------------------------------
// Event Clustering
// ---------------------------------------------------------------------------

interface EventCluster {
  eventType: string;
  events: ExtractedEvent[];
}

/**
 * Cluster events that likely refer to the same real-world event.
 * Uses event type + temporal proximity + actor similarity.
 */
function clusterEvents(events: ExtractedEvent[]): EventCluster[] {
  const clusters: EventCluster[] = [];
  const used = new Set<string>();

  // Sort events by event type, then by timestamp
  const sorted = [...events].sort((a, b) => {
    if (a.eventType !== b.eventType) return a.eventType.localeCompare(b.eventType);
    const tsA = parseTimestamp(a.timestamp ?? '') ?? 0;
    const tsB = parseTimestamp(b.timestamp ?? '') ?? 0;
    return tsA - tsB;
  });

  for (const event of sorted) {
    if (used.has(event.eventId)) continue;

    const cluster: EventCluster = {
      eventType: event.eventType,
      events: [event],
    };
    used.add(event.eventId);

    // Find nearby events of the same type from different sources
    for (const other of sorted) {
      if (used.has(other.eventId)) continue;
      if (other.eventType !== event.eventType) continue;
      if (other.sourceEvidenceId === event.sourceEvidenceId) continue;

      // Check temporal proximity (within 5 minutes)
      const tsA = parseTimestamp(event.timestamp ?? '') ?? 0;
      const tsB = parseTimestamp(other.timestamp ?? '') ?? 0;
      if (tsA > 0 && tsB > 0 && Math.abs(tsA - tsB) > 300_000) continue;

      cluster.events.push(other);
      used.add(other.eventId);
    }

    clusters.push(cluster);
  }

  // Also add unclustered events
  for (const event of events) {
    if (!used.has(event.eventId)) {
      clusters.push({
        eventType: event.eventType,
        events: [event],
      });
    }
  }

  return clusters;
}

// ---------------------------------------------------------------------------
// Public API — Timeline Builder
// ---------------------------------------------------------------------------

/**
 * Build a unified timeline from extracted events across all evidence sources.
 */
export function buildUnifiedTimeline(caseId: string, events: ExtractedEvent[]): TimelineMergeResult {
  const caseEvents = events.filter((e) => e.caseId === caseId);

  // Step 1: Detect clock drift between sources
  const drifts = detectClockDrift(caseEvents);

  // Step 2: Cluster events that refer to the same real-world event
  const clusters = clusterEvents(caseEvents);

  // Step 3: For each cluster, resolve the canonical timestamp
  const timelineEvents: TimelineEvent[] = [];

  for (const cluster of clusters) {
    const resolved = resolveCanonicalTimestamp(cluster.events, drifts);

    const timelineEvent: TimelineEvent = {
      timelineEventId: uuidv4(),
      caseId,
      eventId: cluster.events[0].eventId,
      canonicalTimestamp: resolved.timestamp,
      originalTimestamp: cluster.events[0].timestamp ?? '',
      timestampSource: resolved.source,
      alignmentMethod: resolved.method,
      confidence: Math.max(...cluster.events.map((e) => e.confidence)),
      driftCorrectionMs: resolved.driftMs,
    };

    timelineEvents.push(timelineEvent);
  }

  // Step 4: Sort by canonical timestamp
  timelineEvents.sort((a, b) => {
    const tsA = parseTimestamp(a.canonicalTimestamp) ?? 0;
    const tsB = parseTimestamp(b.canonicalTimestamp) ?? 0;
    return tsA - tsB;
  });

  return {
    caseId,
    totalEvents: caseEvents.length,
    mergedEvents: timelineEvents.length,
    clockDriftDetected: drifts.some((d) => Math.abs(d.driftMs) > 1000),
    driftCorrections: drifts.map((d) => ({
      sourceA: d.sourceA,
      sourceB: d.sourceB,
      driftMs: d.driftMs,
    })),
    timeline: timelineEvents,
  };
}

/**
 * Find gaps in the timeline where no events are recorded.
 * Useful for detecting missing bodycam activation periods.
 */
export function findTimelineGaps(
  timeline: TimelineEvent[],
  minGapMs: number = 120_000, // 2 minutes default
): Array<{ startTime: string; endTime: string; gapMs: number }> {
  const gaps: Array<{ startTime: string; endTime: string; gapMs: number }> = [];

  for (let i = 0; i < timeline.length - 1; i++) {
    const current = parseTimestamp(timeline[i].canonicalTimestamp);
    const next = parseTimestamp(timeline[i + 1].canonicalTimestamp);

    if (current !== null && next !== null) {
      const gap = next - current;
      if (gap > minGapMs) {
        gaps.push({
          startTime: timeline[i].canonicalTimestamp,
          endTime: timeline[i + 1].canonicalTimestamp,
          gapMs: gap,
        });
      }
    }
  }

  return gaps;
}

/**
 * Get events from a specific time window.
 */
export function getEventsInWindow(
  timeline: TimelineEvent[],
  startMs: number,
  endMs: number,
): TimelineEvent[] {
  return timeline.filter((te) => {
    const ts = parseTimestamp(te.canonicalTimestamp);
    return ts !== null && ts >= startMs && ts <= endMs;
  });
}
