// ============================================================================
// Phase 3 — Timeline Reconstruction Service
// Orchestrates the full timeline reconstruction pipeline:
//   1. Fetch evidence for a case
//   2. Extract structured events from evidence text
//   3. Build officer action timeline
//   4. Merge into unified timeline (clock drift correction)
//   5. Detect timeline conflicts
//   6. Persist TimelineEvent records to PostgreSQL
// ============================================================================

import prisma from '../lib/prisma.js';
import { extractEventsFromText, storeEvents } from '../evidence/eventExtractionService.js';
import { buildOfficerTimeline } from '../evidence/officerActionTimelineService.js';
import { buildUnifiedTimeline, findTimelineGaps } from '../contradiction/timelineEngine.js';
import { TimelineConflictAnalyzer } from '../conflict/timelineConflictAnalyzer.js';
import type { ExtractedEvent as CdeExtractedEvent } from '../contradiction/types.js';
import type { TimelineEvent as ConflictTimelineEvent } from '../conflict/types.js';

// ---------------------------------------------------------------------------
// Result Types
// ---------------------------------------------------------------------------

export interface TimelineReconstructionResult {
  caseId: string;
  tenantId: string;
  /** Total evidence items processed */
  evidenceProcessed: number;
  /** Total events extracted from evidence */
  eventsExtracted: number;
  /** Total events stored in EvidenceEvent table */
  eventsStored: number;
  /** Total TimelineEvent records persisted */
  timelineEventsCreated: number;
  /** Number of conflict flags set on timeline events */
  conflictsDetected: number;
  /** Timeline gaps (periods with no events) */
  gapsDetected: number;
  /** Processing duration in ms */
  durationMs: number;
  /** Any non-fatal errors encountered during processing */
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Source Type Mapping
// ---------------------------------------------------------------------------

/** Map evidence.evidenceType to the source types expected by extraction service */
function mapEvidenceTypeToSourceType(
  evidenceType: string,
): 'bodycam' | 'dashcam' | 'audio' | 'transcript' | 'police_report' {
  switch (evidenceType) {
    case 'bodycam':
      return 'bodycam';
    case 'dashcam':
      return 'dashcam';
    case 'witness_video':
    case 'photo':
      return 'bodycam'; // closest match for visual evidence
    case 'transcript':
    case 'dispatch_log':
      return 'transcript';
    case 'police_report':
    case 'forensic_report':
    case 'autopsy_report':
    case 'other_document':
      return 'police_report';
    default:
      return 'police_report';
  }
}

/** Map evidence source type to timeline source type */
function mapToTimelineSourceType(sourceType: string): string {
  switch (sourceType) {
    case 'bodycam':
      return 'bodycam';
    case 'dashcam':
      return 'dashcam';
    case 'transcript':
    case 'dispatch_log':
      return 'dispatch';
    case 'police_report':
      return 'police_report';
    case 'audio':
      return 'witness';
    default:
      return 'police_report';
  }
}

// ---------------------------------------------------------------------------
// Core Reconstruction Pipeline
// ---------------------------------------------------------------------------

/**
 * Run the full timeline reconstruction pipeline for a case.
 * This is called by the TimelineProcessingWorker when a timeline build job runs.
 *
 * Pipeline steps:
 *   1. Fetch all evidence for the case
 *   2. Extract events from evidence text content
 *   3. Store extracted events in EvidenceEvent table
 *   4. Build officer action timeline from stored events
 *   5. Merge into unified timeline with clock drift correction
 *   6. Detect conflicts between timeline events
 *   7. Persist final TimelineEvent records to PostgreSQL
 */
export async function reconstructTimeline(
  caseId: string,
  tenantId: string,
): Promise<TimelineReconstructionResult> {
  const startTime = Date.now();
  const warnings: string[] = [];

  // -------------------------------------------------------------------------
  // Step 1: Fetch evidence for the case
  // -------------------------------------------------------------------------
  const evidence = await prisma.evidence.findMany({
    where: { caseId, tenantId },
    select: {
      evidenceId: true,
      evidenceType: true,
      fileName: true,
      processingStatus: true,
    },
  });

  if (evidence.length === 0) {
    return {
      caseId,
      tenantId,
      evidenceProcessed: 0,
      eventsExtracted: 0,
      eventsStored: 0,
      timelineEventsCreated: 0,
      conflictsDetected: 0,
      gapsDetected: 0,
      durationMs: Date.now() - startTime,
      warnings: ['No evidence found for this case'],
    };
  }

  // -------------------------------------------------------------------------
  // Step 2: Extract events from evidence
  // -------------------------------------------------------------------------
  let totalExtracted = 0;
  let totalStored = 0;

  for (const ev of evidence) {
    try {
      const sourceType = mapEvidenceTypeToSourceType(ev.evidenceType);

      // Use evidence filename + type as proxy content for extraction.
      // In production, this would read the actual file content from R2/S3.
      // For now, we check if there are already EvidenceEvent records for this
      // evidence item and skip extraction if so (idempotent).
      const existingEvents = await prisma.evidenceEvent.count({
        where: { caseId, sourceEvidence: ev.evidenceId },
      });

      if (existingEvents > 0) {
        totalExtracted += existingEvents;
        totalStored += existingEvents;
        continue; // Skip re-extraction for already-processed evidence
      }

      // Extract events from any available text content.
      // Note: Real file content would come from R2 in production.
      // The extraction service handles the NLP pattern matching.
      const extractedEvents = extractEventsFromText(
        `Evidence: ${ev.fileName} (${ev.evidenceType})`,
        caseId,
        ev.evidenceId,
        sourceType,
      );

      totalExtracted += extractedEvents.length;

      if (extractedEvents.length > 0) {
        const stored = await storeEvents(extractedEvents);
        totalStored += stored;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`Event extraction failed for evidence ${ev.evidenceId}: ${msg}`);
    }
  }

  // -------------------------------------------------------------------------
  // Step 3: Build officer action timeline from stored events
  // -------------------------------------------------------------------------
  let officerTimelineEntryCount = 0;
  try {
    const officerTimeline = await buildOfficerTimeline(caseId);
    officerTimelineEntryCount = officerTimeline.totalEntries;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    warnings.push(`Officer timeline construction failed: ${msg}`);
  }

  // -------------------------------------------------------------------------
  // Step 4: Build unified timeline (clock drift + merge)
  // -------------------------------------------------------------------------
  // Fetch all stored EvidenceEvent records and convert to CDE ExtractedEvent format
  const storedEvents = await prisma.evidenceEvent.findMany({
    where: { caseId },
    orderBy: { timestamp: 'asc' },
  });

  // Convert DB events to the CDE ExtractedEvent format for the timeline engine
  const cdeEvents: CdeExtractedEvent[] = storedEvents.map((ev) => ({
    eventId: ev.eventId,
    caseId: ev.caseId,
    eventType: ev.eventType,
    timestamp: ev.timestamp,
    timestampSource: mapTimestampSource(ev.sourceType),
    actor: 'unknown',
    actorRole: 'officer' as const,
    object: null,
    location: null,
    sourceEvidenceId: ev.sourceEvidence,
    sourceTextSpan: ev.rawText,
    sourceTimestamp: ev.timestamp,
    sourceConfidence: ev.confidence,
    confidence: ev.confidence,
    extractionMethod: 'REPORT_NLP' as const,
    rawText: ev.rawText,
    normalized: true,
    createdAt: ev.createdAt.toISOString(),
  }));

  const unifiedTimeline = buildUnifiedTimeline(caseId, cdeEvents);
  const timelineGaps = findTimelineGaps(unifiedTimeline.timeline);

  // -------------------------------------------------------------------------
  // Step 5: Detect timeline conflicts
  // -------------------------------------------------------------------------
  const conflictAnalyzer = new TimelineConflictAnalyzer();

  // Convert to the format expected by the conflict analyzer (conflict/types.ts TimelineEvent)
  const conflictEvents: ConflictTimelineEvent[] = storedEvents.map((ev) => ({
    id: ev.eventId,
    description: ev.description ?? ev.eventType.replace(/_/g, ' '),
    timestamp: ev.createdAt, // Use createdAt as Date for conflict analysis
    precision: 'approximate' as const,
    endTimestamp: null,
    sourceId: ev.sourceEvidence,
    sourceType: 'evidence' as const,
    speakerId: ev.sourceEvidence,
    sourceDocumentId: ev.sourceEvidence,
    tenantId,
  }));

  let conflictsDetected = 0;
  try {
    const conflictResult = conflictAnalyzer.analyzeTimeline(conflictEvents, tenantId);
    conflictsDetected = conflictResult.timelineConflicts.length;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    warnings.push(`Conflict analysis failed: ${msg}`);
  }

  // -------------------------------------------------------------------------
  // Step 6: Persist TimelineEvent records to PostgreSQL
  // -------------------------------------------------------------------------
  // Delete existing timeline events for this case to allow rebuild
  await prisma.timelineEvent.deleteMany({
    where: { caseId, tenantId },
  });

  let timelineEventsCreated = 0;

  for (const te of unifiedTimeline.timeline) {
    try {
      // Find the original evidence event for source info
      const sourceEvent = storedEvents.find((ev) => ev.eventId === te.eventId);

      await prisma.timelineEvent.create({
        data: {
          caseId,
          tenantId,
          timestamp: parseTimelineTimestamp(te.canonicalTimestamp),
          sourceDoc: sourceEvent?.sourceEvidence ?? 'unknown',
          sourceType: mapToTimelineSourceType(sourceEvent?.sourceType ?? 'police_report'),
          description: sourceEvent?.description ?? `${sourceEvent?.eventType?.replace(/_/g, ' ') ?? 'Event'} detected`,
          actor: null,
          location: null,
          confidence: te.confidence,
          conflictFlag: false,
          conflictsWith: null,
          metadata: {
            timelineEventId: te.timelineEventId,
            originalTimestamp: te.originalTimestamp,
            timestampSource: te.timestampSource,
            alignmentMethod: te.alignmentMethod,
            driftCorrectionMs: te.driftCorrectionMs,
            officerTimelineEntries: officerTimelineEntryCount,
          },
        },
      });
      timelineEventsCreated++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`Failed to persist timeline event ${te.timelineEventId}: ${msg}`);
    }
  }

  // If conflicts were detected, mark affected timeline events
  if (conflictsDetected > 0) {
    try {
      const timelineEvents = await prisma.timelineEvent.findMany({
        where: { caseId, tenantId },
        orderBy: { timestamp: 'asc' },
        take: conflictsDetected * 2, // Get enough events to flag
      });

      // Flag the first N events as having conflicts (simplified — real implementation
      // would match specific conflicting pairs from the conflict analyzer output)
      for (let i = 0; i < Math.min(conflictsDetected, timelineEvents.length); i++) {
        const partner = timelineEvents[i + 1] ?? timelineEvents[0];
        await prisma.timelineEvent.update({
          where: { id: timelineEvents[i].id },
          data: {
            conflictFlag: true,
            conflictsWith: partner.id,
          },
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`Failed to flag conflict events: ${msg}`);
    }
  }

  return {
    caseId,
    tenantId,
    evidenceProcessed: evidence.length,
    eventsExtracted: totalExtracted,
    eventsStored: totalStored,
    timelineEventsCreated,
    conflictsDetected,
    gapsDetected: timelineGaps.length,
    durationMs: Date.now() - startTime,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map evidence source type to CDE TimestampSource */
function mapTimestampSource(
  sourceType: string,
): 'bodycam_overlay' | 'dashcam_overlay' | 'cad_dispatch' | 'officer_report' | 'witness_estimate' | 'manual' {
  switch (sourceType) {
    case 'bodycam':
      return 'bodycam_overlay';
    case 'dashcam':
      return 'dashcam_overlay';
    case 'transcript':
      return 'cad_dispatch';
    case 'police_report':
      return 'officer_report';
    case 'audio':
      return 'witness_estimate';
    default:
      return 'manual';
  }
}

/** Parse a timeline timestamp string to a Date object */
function parseTimelineTimestamp(ts: string): Date {
  // Try ISO format first
  const isoDate = new Date(ts);
  if (!isNaN(isoDate.getTime())) {
    return isoDate;
  }

  // Try HH:MM:SS format — normalize to today's date
  const match = ts.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (match) {
    const now = new Date();
    const h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const s = match[3] ? parseInt(match[3], 10) : 0;
    now.setUTCHours(h, m, s, 0);
    return now;
  }

  // Fallback to current time
  return new Date();
}

// ---------------------------------------------------------------------------
// Query Functions (used by API routes)
// ---------------------------------------------------------------------------

/** Get the full timeline for a case */
export async function getTimeline(caseId: string, tenantId: string) {
  const events = await prisma.timelineEvent.findMany({
    where: { caseId, tenantId },
    orderBy: { timestamp: 'asc' },
  });

  const conflicts = events.filter((e) => e.conflictFlag);

  return {
    caseId,
    tenantId,
    totalEvents: events.length,
    conflictCount: conflicts.length,
    events,
    conflicts,
    status: events.length > 0 ? 'completed' : 'pending',
  };
}

/** Get timeline events with optional filtering */
export async function getTimelineEvents(
  caseId: string,
  tenantId: string,
  options?: {
    sourceType?: string;
    minConfidence?: number;
    conflictsOnly?: boolean;
    limit?: number;
    offset?: number;
  },
) {
  const where: Record<string, unknown> = { caseId, tenantId };

  if (options?.sourceType) {
    where.sourceType = options.sourceType;
  }
  if (options?.minConfidence !== undefined) {
    where.confidence = { gte: options.minConfidence };
  }
  if (options?.conflictsOnly) {
    where.conflictFlag = true;
  }

  const [events, total] = await Promise.all([
    prisma.timelineEvent.findMany({
      where,
      orderBy: { timestamp: 'asc' },
      take: options?.limit ?? 100,
      skip: options?.offset ?? 0,
    }),
    prisma.timelineEvent.count({ where }),
  ]);

  return { caseId, events, total, limit: options?.limit ?? 100, offset: options?.offset ?? 0 };
}

/** Get timeline conflicts for a case */
export async function getTimelineConflicts(caseId: string, tenantId: string) {
  const conflicts = await prisma.timelineEvent.findMany({
    where: { caseId, tenantId, conflictFlag: true },
    orderBy: { timestamp: 'asc' },
  });

  return {
    caseId,
    totalConflicts: conflicts.length,
    conflicts: conflicts.map((c) => ({
      id: c.id,
      timestamp: c.timestamp,
      sourceDoc: c.sourceDoc,
      sourceType: c.sourceType,
      description: c.description,
      confidence: c.confidence,
      conflictsWith: c.conflictsWith,
      metadata: c.metadata,
    })),
  };
}
