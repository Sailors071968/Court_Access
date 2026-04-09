export interface TimelineEvent {
  timestamp: string | null;
  actor: string;
  action: string;
  description: string;
  confidence: number;
  chunkId: string;
  fileId: string;
}

export function buildTimeline(events: TimelineEvent[]): TimelineEvent[] {
  if (!events.length) return [];

  const normalized = events.map((e, index) => ({
    ...e,
    normalizedTime: normalizeTimestamp(e.timestamp, index),
  }));

  normalized.sort((a, b) => a.normalizedTime - b.normalizedTime);

  return normalized.map(({ normalizedTime, ...rest }) => rest);
}

function normalizeTimestamp(timestamp: string | null, fallback: number): number {
  if (!timestamp) return 999999999 + fallback;

  // Try parsing as-is first (handles ISO datetime, Unix, etc.)
  const direct = Date.parse(timestamp);
  if (!isNaN(direct)) return direct;

  // Try HH:MM:SS format with fixed reference date
  const parsed = Date.parse(`1970-01-01T${timestamp}Z`);
  return isNaN(parsed) ? 999999999 + fallback : parsed;
}
