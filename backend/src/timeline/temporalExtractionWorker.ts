// ============================================================================
// Timeline Reconstruction Engine — Worker 1: Temporal Extraction
// Extracts time references from text documents using NLP patterns.
// Sources: police reports, witness statements, transcripts, CAD logs
// ============================================================================

import { PrismaClient } from '@prisma/client';
import type { TemporalExtractionJob } from './timelineProcessingPipeline.js';
import { enqueueEventCorrelation } from './timelineProcessingPipeline.js';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Temporal Pattern Definitions
// ---------------------------------------------------------------------------

interface ExtractedEvent {
  eventType: string;
  timestamp: Date;
  endTimestamp?: Date;
  confidence: number;
  description: string;
  rawText: string;
}

// Time patterns: "at 9:43 PM", "at 21:43", "at approximately 2143 hours"
const TIME_PATTERNS = [
  // "at 9:43 PM" / "at 9:43 AM" / "at 9:43 pm"
  /(?:at|around|approximately|approx\.?)\s+(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)/gi,
  // "at 2143 hours" / "at 0943 hours"
  /(?:at|around|approximately|approx\.?)\s+(\d{4})\s*(?:hours?|hrs?)/gi,
  // "21:43" / "09:43" standalone military time
  /\b(\d{2}):(\d{2})(?::(\d{2}))?\b/g,
  // "9:43 PM" without prefix
  /\b(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)\b/gi,
];

// Event type detection keywords
const EVENT_TYPE_KEYWORDS: Record<string, string[]> = {
  officer_arrival: ['arrived', 'arrived on scene', 'responded', 'on scene', 'code 6'],
  vehicle_stop: ['traffic stop', 'vehicle stop', 'pulled over', 'stopped the vehicle', 'initiated a stop'],
  gunshot: ['shots fired', 'gunshot', 'gunfire', 'discharged', 'fired weapon', 'shot fired'],
  foot_pursuit: ['foot pursuit', 'foot chase', 'ran from', 'fled on foot', 'pursued on foot'],
  taser_deployment: ['taser', 'tased', 'conducted energy', 'CEW', 'drive stun'],
  use_of_force: ['use of force', 'physical force', 'struck', 'baton', 'OC spray', 'pepper spray', 'takedown'],
  arrest: ['arrested', 'placed under arrest', 'taken into custody', 'handcuffed', 'detained'],
  miranda: ['miranda', 'read rights', 'advisement of rights', 'advised of rights'],
  search: ['searched', 'search warrant', 'pat down', 'search incident', 'consent search'],
  seizure: ['seized', 'confiscated', 'recovered', 'found in possession'],
  medical: ['paramedics', 'ambulance', 'medical attention', 'transported to hospital', 'CPR', 'first aid'],
  dispatch: ['dispatch', 'dispatched', 'radio call', 'call received', 'CAD', 'called for service'],
  witness_observation: ['witness', 'observed', 'saw', 'heard', 'stated that', 'reported seeing'],
  '911_call': ['911', 'emergency call', 'called police', 'called 911', 'reported to police'],
  statement: ['statement', 'testified', 'told officers', 'said', 'reported', 'described'],
};

// ---------------------------------------------------------------------------
// Time Parsing Utilities
// ---------------------------------------------------------------------------

function parseMilitaryTime(timeStr: string, referenceDate: Date): Date {
  const hours = parseInt(timeStr.substring(0, 2), 10);
  const minutes = parseInt(timeStr.substring(2, 4), 10);
  const result = new Date(referenceDate);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

function parse12HourTime(hours: number, minutes: number, ampm: string, referenceDate: Date): Date {
  let h = hours;
  const isPM = ampm.toUpperCase() === 'PM';
  if (isPM && h !== 12) h += 12;
  if (!isPM && h === 12) h = 0;
  const result = new Date(referenceDate);
  result.setHours(h, minutes, 0, 0);
  return result;
}

function parseMilitaryTimeHHMM(hh: string, mm: string, referenceDate: Date): Date {
  const result = new Date(referenceDate);
  result.setHours(parseInt(hh, 10), parseInt(mm, 10), 0, 0);
  return result;
}

// ---------------------------------------------------------------------------
// Event Type Classification
// ---------------------------------------------------------------------------

function classifyEventType(text: string): { eventType: string; confidence: number } {
  const lowerText = text.toLowerCase();
  let bestType = 'other';
  let bestScore = 0;

  for (const [eventType, keywords] of Object.entries(EVENT_TYPE_KEYWORDS)) {
    let score = 0;
    for (const keyword of keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        score += 1;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestType = eventType;
    }
  }

  // Confidence based on keyword matches
  const confidence = bestScore === 0 ? 0.3 : Math.min(0.5 + bestScore * 0.15, 0.95);
  return { eventType: bestType, confidence };
}

// ---------------------------------------------------------------------------
// Extract Events from Text
// ---------------------------------------------------------------------------

function extractSentences(text: string): string[] {
  return text
    .split(/[.!?\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);
}

export function extractTemporalEvents(
  text: string,
  sourceType: string,
  referenceDate: Date = new Date(),
): ExtractedEvent[] {
  const events: ExtractedEvent[] = [];
  const sentences = extractSentences(text);

  for (const sentence of sentences) {
    // Try each time pattern
    for (const pattern of TIME_PATTERNS) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = pattern.exec(sentence)) !== null) {
        let timestamp: Date | null = null;

        if (match[3] && /^[AP]M$/i.test(match[3])) {
          // 12-hour format: "9:43 PM"
          timestamp = parse12HourTime(
            parseInt(match[1], 10),
            parseInt(match[2], 10),
            match[3],
            referenceDate,
          );
        } else if (match[0].match(/\d{4}\s*(?:hours?|hrs?)/i)) {
          // Military time: "2143 hours"
          timestamp = parseMilitaryTime(match[1], referenceDate);
        } else if (match[1] && match[2] && !match[3]) {
          // HH:MM military format
          timestamp = parseMilitaryTimeHHMM(match[1], match[2], referenceDate);
        }

        if (timestamp && !isNaN(timestamp.getTime())) {
          const { eventType, confidence } = classifyEventType(sentence);

          // Boost confidence for CAD logs and dispatch (structured data)
          const confidenceBoost = ['cad_log', 'dispatch_log'].includes(sourceType) ? 0.1 : 0;

          events.push({
            eventType,
            timestamp,
            confidence: Math.min(confidence + confidenceBoost, 1.0),
            description: sentence.substring(0, 200),
            rawText: sentence,
          });
          break; // One event per sentence
        }
      }
    }
  }

  return events;
}

// ---------------------------------------------------------------------------
// Worker Processor
// ---------------------------------------------------------------------------

export async function processTemporalExtraction(job: TemporalExtractionJob): Promise<{
  eventsExtracted: number;
}> {
  console.log(`[TemporalExtraction] Processing evidence ${job.evidenceId} (${job.sourceType})`);

  // In production, this would download the document from R2 and extract text.
  // For now, we create a placeholder processing record and return.
  // The actual text extraction would use:
  // - PDF: pdfjs-dist or pdf-parse
  // - DOCX: mammoth
  // - Plain text: direct read
  // - CAD logs: structured CSV/XML parsing

  // Attempt to find existing text content for this evidence
  // (In a real implementation, download from R2 and parse)
  const evidence = await prisma.evidence.findUnique({
    where: { evidenceId: job.evidenceId },
  });

  if (!evidence) {
    console.error(`[TemporalExtraction] Evidence ${job.evidenceId} not found`);
    return { eventsExtracted: 0 };
  }

  // For now, mark evidence as processing and create a sample extraction
  // Real implementation would extract text, run NLP, and store events
  console.log(`[TemporalExtraction] Would extract temporal events from ${job.fileName} (${job.sourceType})`);
  console.log(`[TemporalExtraction] S3 key: ${job.s3Key}`);

  // After extraction, trigger correlation
  try {
    await enqueueEventCorrelation({
      caseId: job.caseId,
      tenantId: job.tenantId,
      triggerEvidenceId: job.evidenceId,
    });
  } catch (err) {
    console.error(`[TemporalExtraction] Failed to enqueue correlation:`, err);
  }

  return { eventsExtracted: 0 };
}
