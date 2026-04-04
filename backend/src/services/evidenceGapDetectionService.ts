// ============================================================================
// Phase 3 — Evidence Gap Detection Engine
// Analyzes timeline events (document + video) to detect missing supporting
// evidence and generates structured EvidenceRequest objects.
// Runs after timeline processing completes.
// ============================================================================

import prisma from '../lib/prisma.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GapDetectionResult {
  caseId: string;
  tenantId: string;
  requestsCreated: number;
  requestsSkipped: number; // duplicates avoided via idempotency
  gaps: DetectedGap[];
  durationMs: number;
}

export interface DetectedGap {
  type: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  sourceEventIds: string[];
}

// ---------------------------------------------------------------------------
// Gap Detection Rules
// ---------------------------------------------------------------------------

interface GapRule {
  type: string;
  title: string;
  /** Check if this gap exists given the case evidence and events */
  detect: (ctx: GapDetectionContext) => DetectedGap[];
}

interface GapDetectionContext {
  caseId: string;
  tenantId: string;
  events: Array<{
    eventId: string;
    eventType: string;
    sourceType: string;
    sourceEvidence: string;
    confidence: number;
    description: string | null;
    rawText: string | null;
    timestamp: string;
  }>;
  evidence: Array<{
    evidenceId: string;
    evidenceType: string;
    fileName: string;
    processingStatus: string;
  }>;
  timelineEvents: Array<{
    id: string;
    timestamp: Date;
    sourceType: string;
    description: string;
  }>;
}

// ---------------------------------------------------------------------------
// Evidence type sets
// ---------------------------------------------------------------------------

const VIDEO_TYPES = new Set(['bodycam', 'dashcam', 'witness_video']);
const DOCUMENT_TYPES = new Set([
  'transcript', 'police_report', 'dispatch_log', 'forensic_report',
  'autopsy_report', 'other_document',
]);

// ---------------------------------------------------------------------------
// Use-of-force event types that require bodycam corroboration
// ---------------------------------------------------------------------------

const USE_OF_FORCE_EVENTS = new Set([
  'suspect_restrained', 'taser_deployed', 'neck_restraint', 'physical_strike',
  'baton_strike', 'pepper_spray', 'k9_deployment', 'shots_fired',
  'prone_restraint', 'weapon_drawn',
]);

// ---------------------------------------------------------------------------
// Gap detection rules
// ---------------------------------------------------------------------------

const GAP_RULES: GapRule[] = [
  // Rule 1: Use-of-force event without bodycam evidence
  {
    type: 'missing_bodycam',
    title: 'Missing bodycam for use-of-force event',
    detect: (ctx) => {
      const gaps: DetectedGap[] = [];
      const hasBodycam = ctx.evidence.some((e) => e.evidenceType === 'bodycam');
      if (hasBodycam) return gaps;

      const uofEvents = ctx.events.filter((e) => USE_OF_FORCE_EVENTS.has(e.eventType));
      if (uofEvents.length === 0) return gaps;

      gaps.push({
        type: 'missing_bodycam',
        title: 'No bodycam footage for use-of-force incident',
        description:
          `${uofEvents.length} use-of-force event(s) detected (${[...new Set(uofEvents.map((e) => e.eventType.replace(/_/g, ' ')))].join(', ')}) ` +
          `but no bodycam footage has been uploaded. Bodycam evidence is critical for corroborating or challenging use-of-force claims.`,
        priority: 'high',
        sourceEventIds: uofEvents.map((e) => e.eventId),
      });
      return gaps;
    },
  },

  // Rule 2: Use-of-force event without dashcam evidence
  {
    type: 'missing_dashcam',
    title: 'Missing dashcam for vehicle-related event',
    detect: (ctx) => {
      const gaps: DetectedGap[] = [];
      const hasDashcam = ctx.evidence.some((e) => e.evidenceType === 'dashcam');
      if (hasDashcam) return gaps;

      const vehicleEvents = ctx.events.filter((e) =>
        e.eventType === 'vehicle_pursuit' ||
        e.eventType === 'vehicle_search' ||
        e.eventType === 'traffic_stop',
      );
      if (vehicleEvents.length === 0) return gaps;

      gaps.push({
        type: 'missing_dashcam',
        title: 'No dashcam footage for vehicle-related incident',
        description:
          `${vehicleEvents.length} vehicle-related event(s) detected (${[...new Set(vehicleEvents.map((e) => e.eventType.replace(/_/g, ' ')))].join(', ')}) ` +
          `but no dashcam footage has been uploaded. Dashcam evidence may provide critical context for vehicle interactions.`,
        priority: 'medium',
        sourceEventIds: vehicleEvents.map((e) => e.eventId),
      });
      return gaps;
    },
  },

  // Rule 3: Witness mentioned but no witness statement uploaded
  {
    type: 'missing_witness_statement',
    title: 'Witness referenced but no statement uploaded',
    detect: (ctx) => {
      const gaps: DetectedGap[] = [];
      const hasWitnessEvidence = ctx.evidence.some(
        (e) => e.evidenceType === 'witness_video' || e.fileName.toLowerCase().includes('witness'),
      );
      if (hasWitnessEvidence) return gaps;

      // Check if any event raw text mentions witnesses
      const witnessPattern = /witness|bystander|civilian observer|third[- ]party/i;
      const witnessEvents = ctx.events.filter(
        (e) => (e.rawText && witnessPattern.test(e.rawText)) ||
               (e.description && witnessPattern.test(e.description)),
      );
      if (witnessEvents.length === 0) return gaps;

      gaps.push({
        type: 'missing_witness_statement',
        title: 'Witness referenced but no witness statement on file',
        description:
          `${witnessEvents.length} event(s) reference witnesses or bystanders, but no witness statements or ` +
          `witness video has been uploaded. Witness testimony can provide independent corroboration of events.`,
        priority: 'high',
        sourceEventIds: witnessEvents.map((e) => e.eventId),
      });
      return gaps;
    },
  },

  // Rule 4: Timeline gaps (large time intervals with no events)
  {
    type: 'timeline_gap',
    title: 'Significant timeline gap detected',
    detect: (ctx) => {
      const gaps: DetectedGap[] = [];
      if (ctx.timelineEvents.length < 2) return gaps;

      // Sort by timestamp
      const sorted = [...ctx.timelineEvents].sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
      );

      // Filter out 1970 epoch-based placeholder timestamps
      const realEvents = sorted.filter((e) => e.timestamp.getFullYear() > 1971);
      if (realEvents.length < 2) return gaps;

      const GAP_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

      for (let i = 1; i < realEvents.length; i++) {
        const prev = realEvents[i - 1];
        const curr = realEvents[i];
        const gapMs = curr.timestamp.getTime() - prev.timestamp.getTime();

        if (gapMs >= GAP_THRESHOLD_MS) {
          const gapMinutes = Math.round(gapMs / 60000);
          gaps.push({
            type: 'timeline_gap',
            title: `${gapMinutes}-minute gap in timeline`,
            description:
              `A ${gapMinutes}-minute gap was detected between events: ` +
              `"${prev.description}" and "${curr.description}". ` +
              `Missing evidence during this period could affect case analysis. ` +
              `Consider requesting dispatch logs, bodycam footage, or witness statements covering this interval.`,
            priority: gapMinutes >= 60 ? 'high' : 'medium',
            sourceEventIds: [prev.id, curr.id],
          });
        }
      }
      return gaps;
    },
  },

  // Rule 5: Missing dispatch log
  {
    type: 'missing_dispatch_log',
    title: 'No dispatch log on file',
    detect: (ctx) => {
      const gaps: DetectedGap[] = [];
      const hasDispatch = ctx.evidence.some(
        (e) => e.evidenceType === 'dispatch_log' || e.fileName.toLowerCase().includes('dispatch'),
      );
      if (hasDispatch) return gaps;

      const dispatchEvents = ctx.events.filter(
        (e) => e.eventType === 'dispatch_notification' || e.eventType === 'backup_requested',
      );

      // Only flag if there are dispatch-related events or significant number of events
      if (dispatchEvents.length === 0 && ctx.events.length < 5) return gaps;

      gaps.push({
        type: 'missing_dispatch_log',
        title: 'No dispatch/CAD log uploaded',
        description:
          `${dispatchEvents.length > 0
            ? `${dispatchEvents.length} dispatch-related event(s) detected but no dispatch/CAD log has been uploaded.`
            : 'Multiple events have been extracted but no dispatch/CAD log is available.'
          } ` +
          `Dispatch logs provide an independent, timestamped record of the incident that can validate or challenge the timeline.`,
        priority: dispatchEvents.length > 0 ? 'high' : 'low',
        sourceEventIds: dispatchEvents.map((e) => e.eventId),
      });
      return gaps;
    },
  },

  // Rule 6: Missing forensic report when medical attention events exist
  {
    type: 'missing_forensic_report',
    title: 'Missing forensic/medical report',
    detect: (ctx) => {
      const gaps: DetectedGap[] = [];
      const hasForensic = ctx.evidence.some(
        (e) => e.evidenceType === 'forensic_report' || e.evidenceType === 'autopsy_report',
      );
      if (hasForensic) return gaps;

      const medicalEvents = ctx.events.filter(
        (e) => e.eventType === 'medical_attention' || e.eventType === 'shots_fired',
      );
      if (medicalEvents.length === 0) return gaps;

      gaps.push({
        type: 'missing_forensic_report',
        title: 'No forensic or medical report for injury-related events',
        description:
          `${medicalEvents.length} event(s) involving medical attention or shots fired detected, ` +
          `but no forensic or medical report has been uploaded. Medical records can document injuries and provide objective evidence.`,
        priority: 'high',
        sourceEventIds: medicalEvents.map((e) => e.eventId),
      });
      return gaps;
    },
  },

  // Rule 7: Events from only one source type — need corroboration
  {
    type: 'missing_corroboration',
    title: 'Events from single source — no corroboration',
    detect: (ctx) => {
      const gaps: DetectedGap[] = [];
      if (ctx.events.length < 3) return gaps; // too few to judge

      const sourceTypes = new Set(ctx.events.map((e) => e.sourceType));
      if (sourceTypes.size > 1) return gaps; // already have multiple sources

      const singleSource = [...sourceTypes][0];
      const evidenceTypes = new Set(ctx.evidence.map((e) => e.evidenceType));

      // Determine what's missing
      const hasVideo = [...evidenceTypes].some((t) => VIDEO_TYPES.has(t));
      const hasDocument = [...evidenceTypes].some((t) => DOCUMENT_TYPES.has(t));

      if (hasVideo && !hasDocument) {
        gaps.push({
          type: 'missing_corroboration',
          title: 'Only video evidence — no document corroboration',
          description:
            `All ${ctx.events.length} extracted events come from video sources (${singleSource}). ` +
            `No police reports, dispatch logs, or other document evidence has been uploaded. ` +
            `Multiple independent sources strengthen the evidentiary record.`,
          priority: 'medium',
          sourceEventIds: ctx.events.slice(0, 5).map((e) => e.eventId),
        });
      } else if (hasDocument && !hasVideo) {
        gaps.push({
          type: 'missing_corroboration',
          title: 'Only document evidence — no video corroboration',
          description:
            `All ${ctx.events.length} extracted events come from document sources (${singleSource}). ` +
            `No bodycam, dashcam, or witness video has been uploaded. ` +
            `Video evidence can independently verify or challenge document claims.`,
          priority: 'medium',
          sourceEventIds: ctx.events.slice(0, 5).map((e) => e.eventId),
        });
      }
      return gaps;
    },
  },

  // Rule 8: Missing aerial surveillance (helicopter / drone footage)
  {
    type: 'missing_aerial_footage',
    title: 'Helicopter / Aerial Footage Missing',
    detect: (ctx) => {
      const gaps: DetectedGap[] = [];
      const hasAerialEvidence = ctx.evidence.some(
        (e) => e.evidenceType === 'aerial_footage' ||
               e.fileName.toLowerCase().match(/aerial|helicopter|drone|air.?unit/),
      );
      if (hasAerialEvidence) return gaps;

      // Check for pursuit events, multi-unit coordination, or aerial language
      const pursuitEvents = ctx.events.filter(
        (e) => e.eventType === 'vehicle_pursuit' || e.eventType === 'foot_pursuit',
      );
      const multiUnitEvents = ctx.events.filter(
        (e) => e.eventType === 'backup_requested' || e.eventType === 'multi_unit_response',
      );

      // Check event text for aerial support language
      const aerialPattern = /air\s*unit|helicopter|chopper|aerial|drone|overhead.*unit|sky\s*watch|air\s*support/i;
      const aerialTextEvents = ctx.events.filter(
        (e) => (e.rawText && aerialPattern.test(e.rawText)) ||
               (e.description && aerialPattern.test(e.description)),
      );

      const triggerEvents = [...pursuitEvents, ...multiUnitEvents, ...aerialTextEvents];
      // Deduplicate by eventId
      const uniqueTriggers = [...new Map(triggerEvents.map((e) => [e.eventId, e])).values()];

      if (uniqueTriggers.length === 0) return gaps;

      const reasons: string[] = [];
      if (pursuitEvents.length > 0) reasons.push(`${pursuitEvents.length} pursuit event(s)`);
      if (multiUnitEvents.length > 0) reasons.push(`${multiUnitEvents.length} multi-unit coordination event(s)`);
      if (aerialTextEvents.length > 0) reasons.push(`${aerialTextEvents.length} event(s) referencing aerial support`);

      gaps.push({
        type: 'missing_aerial_footage',
        title: 'Helicopter / Aerial Footage Missing',
        description:
          `${reasons.join(', ')} detected, but no aerial surveillance footage (helicopter or drone) has been uploaded. ` +
          `Aerial footage can provide a wide-angle, independent perspective on pursuit routes, geographic movement, and officer positioning.`,
        priority: 'medium',
        sourceEventIds: uniqueTriggers.map((e) => e.eventId),
      });
      return gaps;
    },
  },
];

// ---------------------------------------------------------------------------
// Core Detection Function
// ---------------------------------------------------------------------------

/**
 * Run evidence gap detection for a case.
 * Analyzes all evidence events and uploaded evidence to find gaps,
 * then creates EvidenceRequest records (idempotent — skips duplicates).
 */
export async function detectEvidenceGaps(
  caseId: string,
  tenantId: string,
): Promise<GapDetectionResult> {
  const startTime = Date.now();

  // Fetch all data needed for gap analysis
  const [events, evidence, timelineEvents] = await Promise.all([
    prisma.evidenceEvent.findMany({
      where: { caseId },
      orderBy: { timestamp: 'asc' },
    }),
    prisma.evidence.findMany({
      where: { caseId, tenantId },
      select: {
        evidenceId: true,
        evidenceType: true,
        fileName: true,
        processingStatus: true,
      },
    }),
    prisma.timelineEvent.findMany({
      where: { caseId, tenantId },
      orderBy: { timestamp: 'asc' },
      select: {
        id: true,
        timestamp: true,
        sourceType: true,
        description: true,
      },
    }),
  ]);

  const ctx: GapDetectionContext = {
    caseId,
    tenantId,
    events,
    evidence,
    timelineEvents,
  };

  // Run all gap detection rules
  const allGaps: DetectedGap[] = [];
  for (const rule of GAP_RULES) {
    try {
      const detected = rule.detect(ctx);
      allGaps.push(...detected);
    } catch (err) {
      console.warn(`[EvidenceGapDetection] Rule "${rule.type}" failed:`, err);
    }
  }

  // Upsert EvidenceRequest records — create new ones, update stale pending ones,
  // skip records the user has already acted on (acknowledged/dismissed/deferred).
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const gap of allGaps) {
    try {
      const compositeKey = {
        caseId_tenantId_type_title: { caseId, tenantId, type: gap.type, title: gap.title },
      };

      const existing = await prisma.evidenceRequest.findUnique({
        where: compositeKey,
        select: { id: true, status: true },
      });

      if (!existing) {
        // New gap — create the request
        await prisma.evidenceRequest.create({
          data: {
            caseId,
            tenantId,
            type: gap.type,
            title: gap.title,
            description: gap.description,
            priority: gap.priority,
            status: 'pending',
            sourceEventIds: JSON.stringify(gap.sourceEventIds),
          },
        });
        created++;
      } else if (existing.status === 'pending') {
        // Existing pending request — update with fresh detection data
        await prisma.evidenceRequest.update({
          where: { id: existing.id },
          data: {
            description: gap.description,
            priority: gap.priority,
            sourceEventIds: JSON.stringify(gap.sourceEventIds),
          },
        });
        updated++;
      } else {
        // User already acted (acknowledged/dismissed/deferred) — don't touch
        skipped++;
      }
    } catch (err: unknown) {
      console.error('[EvidenceGapDetection] Failed to upsert request:', err);
    }
  }

  console.info('[EvidenceGapDetection] Detection complete', {
    caseId,
    gapsFound: allGaps.length,
    requestsCreated: created,
    requestsUpdated: updated,
    requestsSkipped: skipped,
    durationMs: Date.now() - startTime,
  });

  return {
    caseId,
    tenantId,
    requestsCreated: created,
    requestsSkipped: skipped,
    gaps: allGaps,
    durationMs: Date.now() - startTime,
  };
}

// ---------------------------------------------------------------------------
// Query Functions
// ---------------------------------------------------------------------------

/**
 * Get all evidence requests for a case, ordered by priority then creation date.
 */
export async function getEvidenceRequests(
  caseId: string,
  tenantId: string,
  filters?: {
    status?: string;
    priority?: string;
  },
) {
  const where: Record<string, unknown> = { caseId, tenantId };
  if (filters?.status) where.status = filters.status;
  if (filters?.priority) where.priority = filters.priority;

  const requests = await prisma.evidenceRequest.findMany({
    where,
    include: {
      responses: {
        orderBy: { createdAt: 'desc' },
        take: 1, // Latest response only
      },
    },
    orderBy: [
      { priority: 'desc' }, // high > medium > low (alphabetical desc)
      { createdAt: 'desc' },
    ],
  });

  // Sort with proper priority ordering
  const priorityOrder: Record<string, number> = { high: 3, medium: 2, low: 1 };
  requests.sort((a, b) => {
    const pA = priorityOrder[a.priority] ?? 0;
    const pB = priorityOrder[b.priority] ?? 0;
    if (pA !== pB) return pB - pA;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  return requests;
}

/**
 * Respond to an evidence request.
 */
export async function respondToEvidenceRequest(
  requestId: string,
  respondedBy: string,
  responseType: 'requested' | 'not_relevant' | 'defer',
  opts?: {
    deferUntilDate?: Date;
    notes?: string;
  },
) {
  // Verify the request exists
  const request = await prisma.evidenceRequest.findUnique({
    where: { id: requestId },
  });

  if (!request) {
    throw new Error(`Evidence request ${requestId} not found`);
  }

  // Update request status based on response type
  const statusMap: Record<string, string> = {
    requested: 'acknowledged',
    not_relevant: 'dismissed',
    defer: 'deferred',
  };

  // Atomic transaction: create response + update status together
  const response = await prisma.$transaction(async (tx) => {
    const created = await tx.evidenceRequestResponse.create({
      data: {
        requestId,
        respondedBy,
        responseType,
        deferUntilDate: opts?.deferUntilDate ?? null,
        notes: opts?.notes ?? null,
      },
    });

    await tx.evidenceRequest.update({
      where: { id: requestId },
      data: { status: statusMap[responseType] ?? 'acknowledged' },
    });

    return created;
  });

  return response;
}
