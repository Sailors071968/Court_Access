// ============================================================================
// Timeline Reconstruction Engine — Worker 1: Temporal Extraction
// Extracts timestamps, time references, and temporal sequences from
// police reports, dispatch logs, and other text-based evidence.
// ============================================================================

import { PrismaClient } from '@prisma/client';
import type { TemporalExtractionJob } from './timelineProcessingPipeline.js';
import { enqueueEventCorrelation } from './timelineProcessingPipeline.js';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Time Pattern Detection
// ---------------------------------------------------------------------------

interface TemporalEvent {
  timestamp: string | null;
  description: string;
  actor: string;
  eventType: string;
  confidence: number;
  sourceIndex: number;
}

const TIME_PATTERNS = [
  /(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))/g,
  /(\d{4}\s*(?:hours?|hrs?))/g,
  /(\d{2}:\d{2}(?::\d{2})?)/g,
  /(?:at\s+)?approximately\s+(\d{1,2}:\d{2})/gi,
];

const EVENT_MARKERS: Array<{ pattern: RegExp; eventType: string }> = [
  { pattern: /(?:arrived|responded|on[- ]scene)/i, eventType: 'arrival' },
  { pattern: /(?:dispatch|call|report)\s*(?:received|came)/i, eventType: 'dispatch' },
  { pattern: /(?:shots?\s+fired|discharged|fired)/i, eventType: 'weapon_discharge' },
  { pattern: /(?:fled|ran|foot\s+pursuit)/i, eventType: 'pursuit' },
  { pattern: /(?:arrested|detained|handcuff)/i, eventType: 'arrest' },
  { pattern: /(?:ambulance|medical|hospital|ems)/i, eventType: 'medical' },
  { pattern: /(?:taser|tased|pepper\s+spray)/i, eventType: 'force_used' },
  { pattern: /(?:stopped|traffic\s+stop|pulled\s+over)/i, eventType: 'vehicle_stop' },
  { pattern: /(?:searched|pat\s+down|frisk)/i, eventType: 'search' },
  { pattern: /(?:weapon|gun|firearm|knife)\s+(?:found|recovered|seized)/i, eventType: 'evidence_found' },
];

// ---------------------------------------------------------------------------
// Extraction Logic
// ---------------------------------------------------------------------------

function extractTemporalEvents(text: string, evidenceType: string): TemporalEvent[] {
  const events: TemporalEvent[] = [];
  const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.length > 10);

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];

    // Find timestamps in this sentence
    let timestamp: string | null = null;
    for (const pattern of TIME_PATTERNS) {
      pattern.lastIndex = 0;
      const match = pattern.exec(sentence);
      if (match) {
        timestamp = match[1] || match[0];
        break;
      }
    }

    // Find event type
    let eventType = 'observation';
    for (const marker of EVENT_MARKERS) {
      if (marker.pattern.test(sentence)) {
        eventType = marker.eventType;
        break;
      }
    }

    // Only include sentences with timestamps or clear event markers
    if (timestamp || eventType !== 'observation') {
      const confidence = timestamp ? 0.8 : 0.5;
      const typeBoost = ['dispatch_log', 'police_report'].includes(evidenceType) ? 0.1 : 0;

      events.push({
        timestamp,
        description: sentence.substring(0, 500),
        actor: 'Unknown',
        eventType,
        confidence: Math.min(confidence + typeBoost, 0.95),
        sourceIndex: i,
      });
    }
  }

  return events;
}

// ---------------------------------------------------------------------------
// Worker Processor
// ---------------------------------------------------------------------------

export async function processTemporalExtraction(job: TemporalExtractionJob): Promise<{
  eventsExtracted: number;
  processingTimeMs: number;
}> {
  const startTime = Date.now();
  console.log(
    `[TimelineEngine] Temporal extraction started` +
    ` caseId=${job.caseId}` +
    ` evidenceId=${job.evidenceId}` +
    ` evidenceType=${job.evidenceType}`
  );

  // Verify evidence exists
  const evidence = await prisma.evidence.findUnique({
    where: { evidenceId: job.evidenceId },
  });

  if (!evidence) {
    console.error(`[TimelineEngine] Evidence ${job.evidenceId} not found`);
    return { eventsExtracted: 0, processingTimeMs: Date.now() - startTime };
  }

  // In production: download from R2 and extract text.
  // Log processing intent for now.
  console.log(
    `[TimelineEngine] Would extract temporal events from ${job.fileName} (${job.evidenceType})` +
    ` s3Key=${job.s3Key}`
  );

  const processingTimeMs = Date.now() - startTime;
  console.log(
    `[TimelineEngine] Temporal extraction completed` +
    ` caseId=${job.caseId}` +
    ` evidenceId=${job.evidenceId}` +
    ` events=0` +
    ` processingTime=${(processingTimeMs / 1000).toFixed(1)}s`
  );

  // Trigger event correlation
  try {
    await enqueueEventCorrelation({
      caseId: job.caseId,
      tenantId: job.tenantId,
      triggerEvidenceId: job.evidenceId,
    });
  } catch (err) {
    console.error(`[TimelineEngine] Failed to enqueue event correlation:`, err);
  }

  return { eventsExtracted: 0, processingTimeMs };
}

export { extractTemporalEvents };
