// =============================================================================
// CourtAccess — Timeline adapters (Program 26)
// Map domain-specific event shapes into the unified TimelineEvent model so
// every timeline can share one engine.
// =============================================================================

import type { ApiTimelineEvent } from '../../services/caseApi';
import type { TimelineEvent, TimelineSignificance } from './types';

function confidencePct(raw?: number): number | undefined {
  if (raw === undefined) return undefined;
  return raw <= 1 ? Math.round(raw * 100) : Math.round(raw);
}

/** Case API timeline events → unified TimelineEvent[]. */
export function fromApiTimelineEvents(events: ApiTimelineEvent[]): TimelineEvent[] {
  return events.map((e) => ({
    id: e.eventId,
    timestamp: e.canonicalTimestamp || null,
    title: e.action || e.eventType || 'Event',
    description: e.description,
    actor: e.actor,
    category: e.eventType,
    confidence: confidencePct(e.confidence),
    source: e.timestampSource,
    isUnknown: !e.canonicalTimestamp,
  }));
}

/** Generic policy/investigation event shape → unified TimelineEvent[]. */
export function fromGenericEvents(
  events: Array<{
    eventId?: string;
    id?: string;
    timestamp?: string | null;
    description?: string;
    eventType?: string;
    sourceType?: string;
    confidence?: number;
    significance?: TimelineSignificance;
  }>,
): TimelineEvent[] {
  return events.map((e, i) => ({
    id: e.eventId ?? e.id ?? `evt-${i}`,
    timestamp: e.timestamp ?? null,
    title: e.eventType ?? 'Event',
    description: e.description,
    category: e.eventType,
    significance: e.significance,
    confidence: confidencePct(e.confidence),
    source: e.sourceType,
    isUnknown: !e.timestamp,
  }));
}
