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

import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma.js';
import { extractEventsFromText, storeEvents } from '../evidence/eventExtractionService.js';
import { buildOfficerTimeline } from '../evidence/officerActionTimelineService.js';
import { buildUnifiedTimeline, findTimelineGaps } from '../contradiction/timelineEngine.js';
import { TimelineConflictAnalyzer } from '../conflict/timelineConflictAnalyzer.js';
import { extractEvidenceText } from '../services/evidenceTextExtractionService.js';
import { normalizeDocumentText } from '../services/documentNormalizationService.js';
import { detectEvidenceGaps } from '../services/evidenceGapDetectionService.js';
import type { ExtractedEvent as CdeExtractedEvent } from '../contradiction/types.js';
import type { TimelineEvent as ConflictTimelineEvent, TimelineConflict } from '../conflict/types.js';
import { extractActor, extractTarget } from '../services/extractEvents.js';
import { extractAttributes } from '../services/attributeExtractionService.js';

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
  /** Evidence requests created by gap detection (Phase 3) */
  evidenceRequestsCreated: number;
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
      return 'bodycam'; // dashcam maps to bodycam per schema + evidenceIntelligenceIntegration pattern
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
// Safety Limits
// ---------------------------------------------------------------------------

/** Maximum total pipeline duration (5 minutes). Prevents runaway jobs. */
const PIPELINE_TIMEOUT_MS = 5 * 60 * 1000;

/** Maximum number of evidence items to process per pipeline run */
const MAX_EVIDENCE_PER_RUN = 200;

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
 *
 * Safety: Enforces a 5-minute pipeline timeout, 200 evidence item cap,
 * and per-evidence extraction timeouts (delegated to extractEvidenceText).
 */
export async function reconstructTimeline(
  caseId: string,
  tenantId: string = 'dev-tenant',
): Promise<TimelineReconstructionResult> {
  const startTime = Date.now();
  const warnings: string[] = [];

  // -------------------------------------------------------------------------
  // Step 1: Fetch evidence for the case
  // -------------------------------------------------------------------------
  console.info('[TimelineReconstruction] Starting pipeline', {
    caseId,
    tenantId,
  });

  const evidence = await prisma.evidence.findMany({
    where: { caseId, tenantId },
    select: {
      evidenceId: true,
      evidenceType: true,
      fileName: true,
      mimeType: true,
      s3Key: true,
      processingStatus: true,
    },
  });

  console.info('[TimelineReconstruction] Evidence fetched', {
    caseId,
    evidenceCount: evidence.length,
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
      evidenceRequestsCreated: 0,
      durationMs: Date.now() - startTime,
      warnings: ['No evidence found for this case'],
    };
  }

  // Enforce evidence cap to prevent runaway processing
  const evidenceToProcess = evidence.slice(0, MAX_EVIDENCE_PER_RUN);
  if (evidence.length > MAX_EVIDENCE_PER_RUN) {
    warnings.push(
      `Evidence capped at ${MAX_EVIDENCE_PER_RUN} items (${evidence.length} total). ` +
      `Remaining evidence will be processed on next pipeline run.`,
    );
    console.warn('[TimelineReconstruction] Evidence cap applied', {
      caseId,
      total: evidence.length,
      processing: MAX_EVIDENCE_PER_RUN,
    });
  }

  // Pipeline-level timeout: abort processing if total time exceeds limit
  const pipelineDeadline = startTime + PIPELINE_TIMEOUT_MS;

  // -------------------------------------------------------------------------
  // Step 2: Extract events from evidence
  // -------------------------------------------------------------------------
  let totalExtracted = 0;
  let totalStored = 0;

  for (const ev of evidenceToProcess) {
    // Check pipeline timeout before each evidence item
    if (Date.now() >= pipelineDeadline) {
      warnings.push(
        `Pipeline timeout reached (${PIPELINE_TIMEOUT_MS / 1000}s). ` +
        `Processed ${totalExtracted} events from evidence so far; skipping remaining items.`,
      );
      console.warn('[TimelineReconstruction] Pipeline timeout reached', {
        caseId,
        elapsedMs: Date.now() - startTime,
        limitMs: PIPELINE_TIMEOUT_MS,
      });
      break;
    }

    try {
      const sourceType = mapEvidenceTypeToSourceType(ev.evidenceType);

      // -----------------------------------------------------------------
      // Step 2a: Retrieve real evidence content from R2
      // -----------------------------------------------------------------
      const extraction = await extractEvidenceText({
        evidenceId: ev.evidenceId,
        fileName: ev.fileName,
        mimeType: ev.mimeType,
        s3Key: ev.s3Key,
        evidenceType: ev.evidenceType,
      });

      if (!extraction.text) {
        // Text extraction failed or was skipped (audio/video/unsupported)
        if (extraction.error) {
          console.warn('[TimelineReconstruction] Evidence skipped', {
            evidenceId: ev.evidenceId,
            mimeType: ev.mimeType,
            reason: extraction.error,
          });
          warnings.push(`Skipped evidence ${ev.evidenceId} (${ev.fileName}): ${extraction.error}`);
        }
        continue;
      }

      // -----------------------------------------------------------------
      // Step 2b: Normalize document text for better extraction accuracy
      // -----------------------------------------------------------------
      const normalizedText = normalizeDocumentText(extraction.text);

      console.info('[TimelineReconstruction] Text extracted', {
        evidenceId: ev.evidenceId,
        method: extraction.method,
        rawChars: extraction.charCount,
        normalizedChars: normalizedText.length,
      });

      // -----------------------------------------------------------------
      // Step 2c: Delete any previously extracted events for this evidence
      //          to ensure a clean re-extraction on rebuild
      // -----------------------------------------------------------------
      await prisma.evidenceEvent.deleteMany({
        where: { caseId, sourceEvidence: ev.evidenceId },
      });

      // -----------------------------------------------------------------
      // Step 2d: Extract structured events from the normalized text
      // -----------------------------------------------------------------
      const extractedEvents = extractEventsFromText(
        normalizedText,
        caseId,
        ev.evidenceId,
        sourceType,
      );

      totalExtracted += extractedEvents.length;

      if (extractedEvents.length > 0) {
        const stored = await storeEvents(extractedEvents);
        totalStored += stored;

        console.info('[TimelineReconstruction] Events stored', {
          evidenceId: ev.evidenceId,
          extracted: extractedEvents.length,
          stored,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`Event extraction failed for evidence ${ev.evidenceId}: ${msg}`);
      console.warn('[TimelineReconstruction] Evidence processing failed', {
        evidenceId: ev.evidenceId,
        error: msg,
      });
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
    timestamp: parseTimelineTimestamp(ev.timestamp), // Use actual event timestamp for conflict analysis
    precision: 'approximate' as const,
    endTimestamp: null,
    sourceId: ev.sourceEvidence,
    sourceType: 'evidence' as const,
    speakerId: ev.sourceEvidence,
    sourceDocumentId: ev.sourceEvidence,
    tenantId,
  }));

  let conflictsDetected = 0;
  let detectedConflictPairs: TimelineConflict[] = [];
  try {
    const conflictResult = conflictAnalyzer.analyzeTimeline(conflictEvents, tenantId);
    detectedConflictPairs = conflictResult.timelineConflicts;
    conflictsDetected = detectedConflictPairs.length;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    warnings.push(`Conflict analysis failed: ${msg}`);
  }

  // -------------------------------------------------------------------------
  // Step 6: Persist TimelineEvent records to PostgreSQL
  // -------------------------------------------------------------------------
  // Build all create data objects first, then execute delete + createMany
  // inside a transaction so the operation is atomic — if any part fails,
  // the old timeline events are preserved and BullMQ will retry.
  const createDataList = unifiedTimeline.timeline.map((te) => {
    const sourceEvent = storedEvents.find((ev) => ev.eventId === te.eventId);
    const rawText = sourceEvent?.rawText ?? '';
    const description = sourceEvent?.description ?? `${sourceEvent?.eventType?.replace(/_/g, ' ') ?? 'Event'} detected`;

    // Extract structured fields from source text (deterministic — no guessing)
    // Clause-split rawText before calling extractTarget to avoid capturing
    // trailing conjunctions (e.g. "suspect and" from "approached the suspect and drew...")
    const actorResult = rawText ? extractActor(rawText) : null;
    const actor = actorResult === 'unknown' ? null : actorResult;
    const action = sourceEvent?.eventType?.replace(/_/g, ' ') ?? null;
    const clauses = rawText
      ? rawText.split(/,| and | then | after | while | when | as | which | who /i).map(s => s.trim()).filter(Boolean)
      : [];
    let target: string | null = null;
    for (const clause of clauses) {
      target = extractTarget(clause);
      if (target !== null) break;
    }

    return {
      caseId,
      tenantId,
      timestamp: parseTimelineTimestamp(te.canonicalTimestamp),
      sourceDoc: sourceEvent?.sourceEvidence ?? 'unknown',
      sourceType: mapToTimelineSourceType(sourceEvent?.sourceType ?? 'police_report'),
      description,
      actor,
      action,
      target,
      location: null as string | null,
      confidence: te.confidence,
      conflictFlag: false,
      conflictsWith: null as string | null,
      metadata: {
        timelineEventId: te.timelineEventId,
        originalTimestamp: te.originalTimestamp,
        timestampSource: te.timestampSource,
        alignmentMethod: te.alignmentMethod,
        driftCorrectionMs: te.driftCorrectionMs,
        officerTimelineEntries: officerTimelineEntryCount,
        attributes: extractAttributes(rawText),
      } as Prisma.InputJsonValue,
    };
  });

  let timelineEventsCreated = 0;

  // Atomic transaction: delete old + insert new — rolls back on any failure
  const txResult = await prisma.$transaction(async (tx) => {
    await tx.timelineEvent.deleteMany({
      where: { caseId, tenantId },
    });
    const created = await tx.timelineEvent.createMany({
      data: createDataList,
    });
    return created.count;
  });
  timelineEventsCreated = txResult;

  // If conflicts were detected, mark the actual conflicting timeline event pairs
  if (detectedConflictPairs.length > 0) {
    try {
      const timelineEvents = await prisma.timelineEvent.findMany({
        where: { caseId, tenantId },
      });

      // Build lookup chain: conflict analyzer event ID → unified timeline eventId
      //   → unified timeline timelineEventId → DB TimelineEvent.
      // This avoids non-unique key collisions when multiple events share the
      // same evidence source (sourceDoc / sourceEvidence).

      // Step A: EvidenceEvent.eventId → unified timeline's timelineEventId
      const evidenceEventToTimelineId = new Map<string, string>();
      for (const ute of unifiedTimeline.timeline) {
        evidenceEventToTimelineId.set(ute.eventId, ute.timelineEventId);
      }

      // Step B: metadata.timelineEventId → DB TimelineEvent (unique per event)
      const dbEventByTimelineId = new Map<string, typeof timelineEvents[number]>();
      for (const te of timelineEvents) {
        const meta = te.metadata as Record<string, unknown> | null;
        if (meta?.timelineEventId) {
          dbEventByTimelineId.set(String(meta.timelineEventId), te);
        }
      }

      for (const conflict of detectedConflictPairs) {
        // Map conflict analyzer event IDs through the unified timeline to DB records
        const timelineIdA = evidenceEventToTimelineId.get(conflict.eventA.id);
        const dbEventA = timelineIdA ? dbEventByTimelineId.get(timelineIdA) : undefined;
        const timelineIdB = evidenceEventToTimelineId.get(conflict.eventB.id);
        const dbEventB = timelineIdB ? dbEventByTimelineId.get(timelineIdB) : undefined;

        if (dbEventA) {
          await prisma.timelineEvent.update({
            where: { id: dbEventA.id },
            data: {
              conflictFlag: true,
              conflictsWith: dbEventB?.id ?? null,
            },
          });
        }
        if (dbEventB) {
          await prisma.timelineEvent.update({
            where: { id: dbEventB.id },
            data: {
              conflictFlag: true,
              conflictsWith: dbEventA?.id ?? null,
            },
          });
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`Failed to flag conflict events: ${msg}`);
    }
  }

  // -------------------------------------------------------------------------
  // Step 7: Run evidence gap detection (Phase 3)
  // Non-fatal — gaps are informational, not blocking
  // -------------------------------------------------------------------------
  let evidenceRequestsCreated = 0;
  try {
    const gapResult = await detectEvidenceGaps(caseId, tenantId);
    evidenceRequestsCreated = gapResult.requestsCreated;
    console.info('[TimelineReconstruction] Evidence gap detection complete', {
      caseId,
      gapsFound: gapResult.gaps.length,
      requestsCreated: gapResult.requestsCreated,
      requestsSkipped: gapResult.requestsSkipped,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    warnings.push(`Evidence gap detection failed (non-fatal): ${msg}`);
    console.warn('[TimelineReconstruction] Evidence gap detection failed', { caseId, error: msg });
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
    evidenceRequestsCreated,
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

  // Try HH:MM:SS format — use fixed reference date (1970-01-01) consistent
  // with timelineEngine.parseTimestamp to ensure deterministic values across rebuilds
  const match = ts.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (match) {
    const h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const s = match[3] ? parseInt(match[3], 10) : 0;
    const d = new Date(`1970-01-01T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}Z`);
    if (!isNaN(d.getTime())) {
      return d;
    }
  }

  // Try offset-seconds format (e.g. "120" → 120 seconds from epoch)
  const offsetSec = Number(ts);
  if (!isNaN(offsetSec)) {
    return new Date(offsetSec * 1000);
  }

  // Deterministic fallback — epoch start rather than wall-clock time
  return new Date('1970-01-01T00:00:00Z');
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
