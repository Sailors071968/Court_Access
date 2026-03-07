// ============================================
// Court Access — Court Timeline Builder
// Phase 127: Construct chronological timeline
// ============================================

import prisma from '../services/prismaClient.js';

/**
 * Build chronological court timeline from reconstructed events and facts.
 * @param {string} caseId
 * @returns {{ timeline: object[], summary: object }}
 */
export async function buildCourtTimeline(caseId) {
  console.log(`[CourtTimeline] Building timeline for case ${caseId}`);

  const [events, caseEvents, timelineEvents] = await Promise.all([
    prisma.reconstructedEvent.findMany({ where: { caseId }, orderBy: { timestamp: 'asc' } }),
    prisma.caseEvent.findMany({ where: { caseId }, orderBy: { timestamp: 'asc' } }),
    prisma.timelineEvent.findMany({ where: { caseId }, orderBy: { timestamp: 'asc' } }),
  ]);

  const timelineItems = [];

  for (const event of events) {
    if (!event.timestamp) continue;
    timelineItems.push({
      caseId,
      time: event.timestamp,
      event: event.description,
      sourceEvidence: event.evidenceSources || [],
      confidence: event.confidenceScore,
      metadata: { source: 'reconstructed_event', eventId: event.id },
    });
  }

  for (const ce of caseEvents) {
    timelineItems.push({
      caseId,
      time: ce.timestamp,
      event: ce.description,
      sourceEvidence: ce.sourceDocumentId ? [{ evidenceId: ce.sourceDocumentId, type: ce.eventType }] : [],
      confidence: ce.confidence,
      metadata: { source: 'case_event', eventId: ce.id },
    });
  }

  for (const te of timelineEvents) {
    timelineItems.push({
      caseId,
      time: te.timestamp,
      event: te.eventDescription,
      sourceEvidence: te.sourceEvidenceId ? [{ evidenceId: te.sourceEvidenceId, type: te.sourceType }] : [],
      confidence: te.confidenceScore,
      metadata: { source: 'timeline_event', eventId: te.id },
    });
  }

  timelineItems.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  const deduped = deduplicateTimeline(timelineItems);

  const stored = [];
  for (const item of deduped) {
    try {
      const record = await prisma.courtTimelineEvent.create({ data: item });
      stored.push(record);
    } catch (err) {
      console.warn(`[CourtTimeline] Store error: ${err.message}`);
    }
  }

  console.log(`[CourtTimeline] Built timeline with ${stored.length} events for case ${caseId}`);

  return {
    timeline: stored,
    summary: {
      totalEvents: stored.length,
      timespan: stored.length >= 2 ? { start: stored[0].time, end: stored[stored.length - 1].time } : null,
      avgConfidence: stored.length > 0
        ? Math.round((stored.reduce((sum, s) => sum + s.confidence, 0) / stored.length) * 100) / 100
        : 0,
    },
  };
}

function deduplicateTimeline(items) {
  const result = [];
  const WINDOW_MS = 5 * 60 * 1000;

  for (const item of items) {
    const isDup = result.some(existing => {
      const timeDiff = Math.abs(new Date(existing.time).getTime() - new Date(item.time).getTime());
      if (timeDiff > WINDOW_MS) return false;
      return existing.event.toLowerCase().includes(item.event.toLowerCase().substring(0, 30));
    });
    if (!isDup) result.push(item);
  }
  return result;
}

export async function getCaseTimeline(caseId) {
  return prisma.courtTimelineEvent.findMany({ where: { caseId }, orderBy: { time: 'asc' } });
}
