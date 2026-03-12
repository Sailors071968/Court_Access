// ============================================================================
// Phase 2 — Event Extraction Engine
// Converts raw evidence (reports, transcripts, video, CAD logs) into
// structured events using NLP and rule-based extraction.
// ============================================================================

import { v4 as uuidv4 } from 'uuid';
import type {
  ExtractedEvent,
  ExtractionJobData,
  ExtractionResult,
  ExtractionMethod,
  ActorType,
  TimestampSource,
} from './types.ts';
import { isValidEventType } from './eventOntology.ts';

// ---------------------------------------------------------------------------
// NLP Pattern Definitions — Rule-based extraction patterns
// ---------------------------------------------------------------------------

interface ExtractionPattern {
  pattern: RegExp;
  eventType: string;
  actorRole: ActorType;
  timestampSource: TimestampSource;
  confidence: number;
}

const REPORT_PATTERNS: ExtractionPattern[] = [
  // Detention patterns
  { pattern: /(?:I|officer|off(?:icer)?\.?\s*\w+)\s+(?:detained|stopped|held)\s+(?:the\s+)?(?:suspect|subject|individual|defendant)/i, eventType: 'OFFICER_DETAINS_PERSON', actorRole: 'officer', timestampSource: 'officer_report', confidence: 0.85 },
  { pattern: /(?:initiated|conducted|made)\s+(?:a\s+)?traffic\s+stop/i, eventType: 'OFFICER_INITIATES_TRAFFIC_STOP', actorRole: 'officer', timestampSource: 'officer_report', confidence: 0.90 },
  { pattern: /(?:I|officer)\s+(?:handcuffed|placed\s+(?:in\s+)?handcuffs)/i, eventType: 'OFFICER_HANDCUFFS_SUSPECT', actorRole: 'officer', timestampSource: 'officer_report', confidence: 0.90 },
  { pattern: /(?:released|let\s+go)\s+(?:the\s+)?(?:detainee|subject|suspect)/i, eventType: 'OFFICER_RELEASES_DETAINEE', actorRole: 'officer', timestampSource: 'officer_report', confidence: 0.80 },
  { pattern: /(?:ordered|directed|told)\s+(?:the\s+)?(?:driver|occupant|suspect|subject)\s+(?:to\s+)?(?:exit|get\s+out|step\s+out)/i, eventType: 'OFFICER_ORDERS_EXIT_VEHICLE', actorRole: 'officer', timestampSource: 'officer_report', confidence: 0.85 },

  // Search patterns
  { pattern: /(?:searched|conducted\s+(?:a\s+)?search\s+of)\s+(?:the\s+)?vehicle/i, eventType: 'OFFICER_SEARCHES_VEHICLE', actorRole: 'officer', timestampSource: 'officer_report', confidence: 0.90 },
  { pattern: /(?:searched|conducted\s+(?:a\s+)?search\s+of)\s+(?:the\s+)?(?:suspect|subject|person|individual)/i, eventType: 'OFFICER_SEARCHES_PERSON', actorRole: 'officer', timestampSource: 'officer_report', confidence: 0.90 },
  { pattern: /(?:asked|requested)\s+(?:for\s+)?consent\s+to\s+search/i, eventType: 'OFFICER_REQUESTS_CONSENT_SEARCH', actorRole: 'officer', timestampSource: 'officer_report', confidence: 0.85 },
  { pattern: /(?:consent|permission)\s+(?:was\s+)?(?:granted|given|obtained)/i, eventType: 'PERSON_GRANTS_CONSENT', actorRole: 'suspect', timestampSource: 'officer_report', confidence: 0.80 },
  { pattern: /(?:consent|permission)\s+(?:was\s+)?(?:denied|refused|withheld)/i, eventType: 'PERSON_DENIES_CONSENT', actorRole: 'suspect', timestampSource: 'officer_report', confidence: 0.80 },
  { pattern: /(?:observed|saw|noticed)\s+(?:in\s+)?plain\s+view/i, eventType: 'OFFICER_OBSERVES_PLAIN_VIEW', actorRole: 'officer', timestampSource: 'officer_report', confidence: 0.85 },
  { pattern: /(?:executed|served)\s+(?:a\s+)?(?:search\s+)?warrant/i, eventType: 'OFFICER_EXECUTES_WARRANT', actorRole: 'officer', timestampSource: 'officer_report', confidence: 0.90 },
  { pattern: /(?:pat(?:ted)?[\s-]?down|terry\s+frisk|protective\s+frisk)/i, eventType: 'OFFICER_PATS_DOWN_PERSON', actorRole: 'officer', timestampSource: 'officer_report', confidence: 0.85 },

  // Force patterns
  { pattern: /(?:drew|unholstered|pointed)\s+(?:my\s+)?(?:firearm|weapon|gun|service\s+weapon)/i, eventType: 'OFFICER_DRAWS_WEAPON', actorRole: 'officer', timestampSource: 'officer_report', confidence: 0.90 },
  { pattern: /(?:discharged|fired)\s+(?:my\s+)?(?:firearm|weapon|gun|service\s+weapon)/i, eventType: 'OFFICER_FIRES_WEAPON', actorRole: 'officer', timestampSource: 'officer_report', confidence: 0.95 },
  { pattern: /(?:deployed|used|activated)\s+(?:my\s+)?(?:taser|cew|conducted\s+energy)/i, eventType: 'OFFICER_DEPLOYS_TASER', actorRole: 'officer', timestampSource: 'officer_report', confidence: 0.90 },
  { pattern: /(?:used|applied|employed)\s+(?:physical\s+)?force/i, eventType: 'OFFICER_USES_PHYSICAL_FORCE', actorRole: 'officer', timestampSource: 'officer_report', confidence: 0.85 },
  { pattern: /(?:deployed|used|sprayed)\s+(?:oc|pepper)\s+spray/i, eventType: 'OFFICER_DEPLOYS_OC_SPRAY', actorRole: 'officer', timestampSource: 'officer_report', confidence: 0.90 },
  { pattern: /(?:suspect|subject)\s+(?:actively\s+)?resist(?:ed|ing)/i, eventType: 'SUSPECT_RESISTS_ACTIVELY', actorRole: 'suspect', timestampSource: 'officer_report', confidence: 0.80 },
  { pattern: /(?:took|brought)\s+(?:the\s+)?(?:suspect|subject)\s+(?:to\s+the\s+)?ground/i, eventType: 'OFFICER_TAKES_DOWN_PERSON', actorRole: 'officer', timestampSource: 'officer_report', confidence: 0.85 },
  { pattern: /de[\s-]?escalat(?:ed|ion)/i, eventType: 'OFFICER_DEESCALATES', actorRole: 'officer', timestampSource: 'officer_report', confidence: 0.80 },

  // Miranda patterns
  { pattern: /(?:read|administered|advised|gave)\s+(?:the\s+)?(?:suspect|subject|defendant)\s+(?:their\s+)?(?:miranda|rights)/i, eventType: 'OFFICER_READS_MIRANDA', actorRole: 'officer', timestampSource: 'officer_report', confidence: 0.90 },
  { pattern: /(?:invoked|exercised|asserted)\s+(?:the\s+)?(?:right|fifth\s+amendment)/i, eventType: 'SUSPECT_INVOKES_RIGHTS', actorRole: 'suspect', timestampSource: 'officer_report', confidence: 0.85 },
  { pattern: /(?:waived|agreed\s+to\s+speak|voluntarily\s+spoke)/i, eventType: 'SUSPECT_WAIVES_RIGHTS', actorRole: 'suspect', timestampSource: 'officer_report', confidence: 0.80 },
  { pattern: /(?:requested|asked\s+for)\s+(?:an?\s+)?(?:attorney|lawyer|counsel)/i, eventType: 'SUSPECT_REQUESTS_ATTORNEY', actorRole: 'suspect', timestampSource: 'officer_report', confidence: 0.90 },

  // Arrest patterns
  { pattern: /(?:placed|was)\s+(?:under\s+)?arrest/i, eventType: 'OFFICER_ARRESTS_PERSON', actorRole: 'officer', timestampSource: 'officer_report', confidence: 0.90 },
  { pattern: /(?:transported|took|brought)\s+(?:the\s+)?(?:suspect|subject|arrestee|defendant)\s+(?:to\s+)?(?:jail|booking|station|county)/i, eventType: 'OFFICER_TRANSPORTS_ARRESTEE', actorRole: 'officer', timestampSource: 'officer_report', confidence: 0.85 },
  { pattern: /(?:booked|processed)\s+(?:at|into)\s+(?:the\s+)?(?:jail|county|facility)/i, eventType: 'OFFICER_BOOKS_ARRESTEE', actorRole: 'officer', timestampSource: 'officer_report', confidence: 0.85 },

  // Movement patterns
  { pattern: /(?:suspect|subject)\s+(?:fled|ran|bolted|took\s+off)\s+(?:on\s+foot)/i, eventType: 'SUSPECT_RUNS', actorRole: 'suspect', timestampSource: 'officer_report', confidence: 0.85 },
  { pattern: /(?:suspect|subject)\s+(?:fled|drove\s+away|sped\s+away)\s+(?:in\s+(?:a\s+)?(?:the\s+)?vehicle)/i, eventType: 'SUSPECT_FLEES_IN_VEHICLE', actorRole: 'suspect', timestampSource: 'officer_report', confidence: 0.85 },
  { pattern: /(?:pursued|chased|followed)\s+(?:the\s+)?(?:suspect|subject)\s+on\s+foot/i, eventType: 'OFFICER_PURSUES_ON_FOOT', actorRole: 'officer', timestampSource: 'officer_report', confidence: 0.85 },
  { pattern: /(?:vehicle|car)\s+pursuit/i, eventType: 'OFFICER_PURSUES_IN_VEHICLE', actorRole: 'officer', timestampSource: 'officer_report', confidence: 0.85 },
  { pattern: /(?:arrived|responded)\s+(?:at|to)\s+(?:the\s+)?(?:scene|location|address)/i, eventType: 'OFFICER_ARRIVES_AT_SCENE', actorRole: 'officer', timestampSource: 'officer_report', confidence: 0.80 },

  // Evidence handling
  { pattern: /(?:collected|recovered|seized)\s+(?:the\s+)?(?:evidence|item|contraband|narcotics|drugs|weapon|firearm)/i, eventType: 'EVIDENCE_ITEM_COLLECTED', actorRole: 'officer', timestampSource: 'officer_report', confidence: 0.85 },
  { pattern: /(?:photographed|took\s+photographs?\s+of)\s+(?:the\s+)?(?:scene|evidence|injuries)/i, eventType: 'OFFICER_PHOTOGRAPHS_EVIDENCE', actorRole: 'officer', timestampSource: 'officer_report', confidence: 0.85 },

  // Documentation
  { pattern: /(?:activated|turned\s+on)\s+(?:my\s+)?(?:body[\s-]?worn\s+camera|body[\s-]?cam|bwc|bodycam)/i, eventType: 'OFFICER_ACTIVATES_BODYCAM', actorRole: 'officer', timestampSource: 'officer_report', confidence: 0.90 },
  { pattern: /(?:deactivated|turned\s+off)\s+(?:my\s+)?(?:body[\s-]?worn\s+camera|body[\s-]?cam|bwc|bodycam)/i, eventType: 'OFFICER_DEACTIVATES_BODYCAM', actorRole: 'officer', timestampSource: 'officer_report', confidence: 0.90 },

  // Communication
  { pattern: /(?:requested|called\s+for)\s+(?:additional\s+)?(?:backup|additional\s+units|cover)/i, eventType: 'OFFICER_REQUESTS_BACKUP', actorRole: 'officer', timestampSource: 'officer_report', confidence: 0.85 },
  { pattern: /(?:called|requested|summoned)\s+(?:ems|medical|ambulance|paramedics)/i, eventType: 'OFFICER_CALLS_EMS', actorRole: 'officer', timestampSource: 'officer_report', confidence: 0.85 },

  // K9 patterns
  { pattern: /(?:k[\s-]?9|canine)\s+(?:unit\s+)?(?:deployed|alerted|indicated|sniffed)/i, eventType: 'OFFICER_USES_K9_SNIFF', actorRole: 'k9_handler', timestampSource: 'officer_report', confidence: 0.85 },
  { pattern: /(?:k[\s-]?9|canine)\s+(?:gave\s+)?(?:a\s+)?positive\s+(?:alert|indication)/i, eventType: 'K9_ALERTS_ON_TARGET', actorRole: 'k9_handler', timestampSource: 'officer_report', confidence: 0.85 },
];

const TRANSCRIPT_PATTERNS: ExtractionPattern[] = [
  { pattern: /(?:you(?:'re| are)\s+(?:being\s+)?detained|don(?:'t|t)\s+move|stay\s+right\s+there|stop)/i, eventType: 'OFFICER_DETAINS_PERSON', actorRole: 'officer', timestampSource: 'video_transcript', confidence: 0.75 },
  { pattern: /put\s+your\s+hands\s+(?:up|behind|on|where)/i, eventType: 'OFFICER_ORDERS_HANDS_UP', actorRole: 'officer', timestampSource: 'video_transcript', confidence: 0.80 },
  { pattern: /(?:get\s+out\s+of\s+the\s+(?:car|vehicle)|step\s+out)/i, eventType: 'OFFICER_ORDERS_EXIT_VEHICLE', actorRole: 'officer', timestampSource: 'video_transcript', confidence: 0.80 },
  { pattern: /(?:you\s+have\s+the\s+right\s+to\s+remain\s+silent|miranda)/i, eventType: 'OFFICER_READS_MIRANDA', actorRole: 'officer', timestampSource: 'video_transcript', confidence: 0.90 },
  { pattern: /(?:I\s+want\s+(?:a\s+)?(?:my\s+)?(?:lawyer|attorney)|I(?:'m| am)\s+not\s+(?:saying|talking))/i, eventType: 'SUSPECT_INVOKES_RIGHTS', actorRole: 'suspect', timestampSource: 'video_transcript', confidence: 0.80 },
  { pattern: /(?:you(?:'re| are)\s+under\s+arrest)/i, eventType: 'OFFICER_ARRESTS_PERSON', actorRole: 'officer', timestampSource: 'video_transcript', confidence: 0.90 },
  { pattern: /(?:do\s+(?:I|you)\s+have\s+consent|mind\s+if\s+(?:I|we)\s+(?:look|search))/i, eventType: 'OFFICER_REQUESTS_CONSENT_SEARCH', actorRole: 'officer', timestampSource: 'video_transcript', confidence: 0.80 },
  { pattern: /(?:go\s+ahead|sure|yes|okay|fine)\s*[,.]?\s*(?:you\s+can\s+(?:search|look))?/i, eventType: 'PERSON_GRANTS_CONSENT', actorRole: 'suspect', timestampSource: 'video_transcript', confidence: 0.60 },
  { pattern: /(?:no|I\s+do\s+not\s+consent|you\s+can(?:'t|not)\s+search)/i, eventType: 'PERSON_DENIES_CONSENT', actorRole: 'suspect', timestampSource: 'video_transcript', confidence: 0.75 },
  { pattern: /(?:taser|taser|deploying\s+taser|don(?:'t|t)\s+make\s+me\s+tase)/i, eventType: 'OFFICER_DEPLOYS_TASER', actorRole: 'officer', timestampSource: 'video_transcript', confidence: 0.80 },
  { pattern: /(?:shots?\s+fired|he(?:'s| is)\s+got\s+a\s+gun|drop\s+the\s+(?:weapon|gun))/i, eventType: 'OFFICER_DRAWS_WEAPON', actorRole: 'officer', timestampSource: 'video_transcript', confidence: 0.75 },
  { pattern: /(?:stop\s+resisting|quit\s+(?:fighting|resisting)|comply)/i, eventType: 'SUSPECT_RESISTS_ACTIVELY', actorRole: 'suspect', timestampSource: 'video_transcript', confidence: 0.70 },
  { pattern: /(?:he(?:'s| is)\s+running|stop|runner|foot\s+pursuit)/i, eventType: 'SUSPECT_RUNS', actorRole: 'suspect', timestampSource: 'video_transcript', confidence: 0.70 },
  { pattern: /(?:requesting|send(?:ing)?)\s+(?:backup|additional|code\s+3)/i, eventType: 'OFFICER_REQUESTS_BACKUP', actorRole: 'officer', timestampSource: 'video_transcript', confidence: 0.80 },
  { pattern: /(?:need\s+(?:ems|medical|ambulance|paramedic))/i, eventType: 'OFFICER_CALLS_EMS', actorRole: 'officer', timestampSource: 'video_transcript', confidence: 0.80 },
];

// ---------------------------------------------------------------------------
// Timestamp Extraction
// ---------------------------------------------------------------------------

const TIMESTAMP_PATTERNS = [
  // 24-hour format: 14:30:00, 1430 hrs
  /(\d{1,2}:\d{2}(?::\d{2})?)\s*(?:hrs?|hours?)?/i,
  // 12-hour format: 2:30 PM
  /(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|a\.m\.|p\.m\.))/i,
  // Approximate: approximately 1430 hours
  /(?:at\s+)?(?:approximately|approx\.?|about|around)\s+(\d{4})\s*(?:hrs?|hours?)/i,
  // Military time: 1430 hours
  /(\d{4})\s*(?:hrs?|hours?)/i,
];

function extractTimestamp(text: string): string | null {
  for (const pattern of TIMESTAMP_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Location Extraction
// ---------------------------------------------------------------------------

function extractLocation(text: string): string | null {
  // Simple pattern matching for common location references
  const locationPatterns = [
    /(?:at|near|on|in\s+front\s+of)\s+(\d+\s+\w+(?:\s+\w+)*\s+(?:St|Ave|Blvd|Dr|Rd|Ln|Way|Ct|Pl|Cir|Hwy|Fwy)\.?(?:\s*[,.]?\s*\w+)?)/i,
    /(?:intersection\s+of)\s+(\w+(?:\s+\w+)*\s+(?:and|&)\s+\w+(?:\s+\w+)*)/i,
    /(?:(?:mile|marker)\s+(\d+(?:\.\d+)?)\s+(?:on|of)\s+(\w+(?:\s+\w+)*))/i,
    /(?:parking\s+lot|alley|sidewalk|highway|freeway|interstate)\s+(?:of\s+)?(\w+(?:\s+\w+)*)/i,
  ];

  for (const pattern of locationPatterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Actor Extraction
// ---------------------------------------------------------------------------

function extractActor(text: string, defaultRole: ActorType): string {
  const officerMatch = text.match(/(?:Officer|Ofc\.?|Deputy|Det\.?|Sgt\.?|Lt\.?|Cpl\.?)\s+(\w+(?:\s+\w+)?)/i);
  if (officerMatch) return officerMatch[0].trim();

  const subjectMatch = text.match(/(?:suspect|subject|defendant|arrestee)\s+(\w+(?:\s+\w+)?)/i);
  if (subjectMatch) return subjectMatch[0].trim();

  if (defaultRole === 'officer') return 'Reporting Officer';
  if (defaultRole === 'suspect') return 'Subject';
  if (defaultRole === 'witness') return 'Witness';
  return 'Unknown';
}

// ---------------------------------------------------------------------------
// Core Extraction Functions
// ---------------------------------------------------------------------------

/**
 * Extract events from a police report using NLP pattern matching.
 */
export function extractEventsFromReport(job: ExtractionJobData): ExtractionResult {
  const startTime = Date.now();
  const events: ExtractedEvent[] = [];
  const errors: string[] = [];

  const sentences = job.content.split(/[.!?]+/).filter((s) => s.trim().length > 10);

  for (const sentence of sentences) {
    for (const pattern of REPORT_PATTERNS) {
      if (pattern.pattern.test(sentence)) {
        if (!isValidEventType(pattern.eventType)) {
          errors.push(`Unknown event type: ${pattern.eventType}`);
          continue;
        }

        const event: ExtractedEvent = {
          eventId: uuidv4(),
          caseId: job.caseId,
          eventType: pattern.eventType,
          timestamp: extractTimestamp(sentence),
          timestampSource: pattern.timestampSource,
          actor: extractActor(sentence, pattern.actorRole),
          actorRole: pattern.actorRole,
          object: null,
          location: extractLocation(sentence),
          sourceEvidenceId: job.evidenceId,
          confidence: pattern.confidence,
          extractionMethod: 'REPORT_NLP' as ExtractionMethod,
          rawText: sentence.trim(),
          createdAt: new Date().toISOString(),
        };

        events.push(event);
        break; // One event per sentence to avoid duplicates
      }
    }
  }

  return {
    evidenceId: job.evidenceId,
    eventsExtracted: events.length,
    events,
    processingTimeMs: Date.now() - startTime,
    errors,
  };
}

/**
 * Extract events from a transcript (bodycam/dashcam audio).
 */
export function extractEventsFromTranscript(job: ExtractionJobData): ExtractionResult {
  const startTime = Date.now();
  const events: ExtractedEvent[] = [];
  const errors: string[] = [];

  const lines = job.content.split('\n').filter((l) => l.trim().length > 5);

  for (const line of lines) {
    for (const pattern of TRANSCRIPT_PATTERNS) {
      if (pattern.pattern.test(line)) {
        if (!isValidEventType(pattern.eventType)) {
          errors.push(`Unknown event type: ${pattern.eventType}`);
          continue;
        }

        const event: ExtractedEvent = {
          eventId: uuidv4(),
          caseId: job.caseId,
          eventType: pattern.eventType,
          timestamp: extractTimestamp(line),
          timestampSource: pattern.timestampSource,
          actor: extractActor(line, pattern.actorRole),
          actorRole: pattern.actorRole,
          object: null,
          location: null,
          sourceEvidenceId: job.evidenceId,
          confidence: pattern.confidence,
          extractionMethod: 'TRANSCRIPT_NLP' as ExtractionMethod,
          rawText: line.trim(),
          createdAt: new Date().toISOString(),
        };

        events.push(event);
        break;
      }
    }
  }

  return {
    evidenceId: job.evidenceId,
    eventsExtracted: events.length,
    events,
    processingTimeMs: Date.now() - startTime,
    errors,
  };
}

/**
 * Extract events from CAD/dispatch logs.
 */
export function extractEventsFromCAD(job: ExtractionJobData): ExtractionResult {
  const startTime = Date.now();
  const events: ExtractedEvent[] = [];
  const errors: string[] = [];

  // CAD logs are typically structured: TIMESTAMP | UNIT | EVENT_CODE | DESCRIPTION
  const lines = job.content.split('\n').filter((l) => l.trim().length > 5);

  const cadEventMap: Record<string, string> = {
    'DISPATCHED': 'DISPATCH_ASSIGNS_UNITS',
    'EN ROUTE': 'DISPATCH_ASSIGNS_UNITS',
    'ON SCENE': 'OFFICER_GOES_ON_SCENE',
    'ARRIVED': 'OFFICER_ARRIVES_AT_SCENE',
    'CLEARED': 'OFFICER_CLEARS_CALL',
    'CODE 4': 'OFFICER_CLEARS_CALL',
    'PURSUIT': 'OFFICER_PURSUES_IN_VEHICLE',
    'FOOT PURSUIT': 'OFFICER_PURSUES_ON_FOOT',
    'SHOTS FIRED': 'OFFICER_FIRES_WEAPON',
    'EMS REQUESTED': 'OFFICER_CALLS_EMS',
    'EMS ON SCENE': 'EMS_ARRIVES',
    'TRANSPORT': 'PERSON_TRANSPORTED_TO_HOSPITAL',
    'BACKUP REQUESTED': 'OFFICER_REQUESTS_BACKUP',
    'BACKUP ARRIVED': 'BACKUP_UNIT_ARRIVES',
    'ARREST': 'OFFICER_ARRESTS_PERSON',
    'DETAINED': 'OFFICER_DETAINS_PERSON',
    'K9 DEPLOYED': 'K9_DEPLOYED_FOR_TRACK',
    'K9 ALERT': 'K9_ALERTS_ON_TARGET',
    'PRIORITY UPGRADED': 'DISPATCH_UPGRADES_PRIORITY',
    '911 RECEIVED': 'DISPATCH_RECEIVES_911_CALL',
  };

  for (const line of lines) {
    const parts = line.split(/[|\t]+/).map((p) => p.trim());
    if (parts.length < 2) continue;

    const cadTimestamp = parts[0] ?? null;
    const cadDescription = parts.slice(1).join(' ').toUpperCase();

    for (const [cadCode, eventType] of Object.entries(cadEventMap)) {
      if (cadDescription.includes(cadCode)) {
        if (!isValidEventType(eventType)) {
          errors.push(`Unknown event type mapped from CAD: ${eventType}`);
          continue;
        }

        const event: ExtractedEvent = {
          eventId: uuidv4(),
          caseId: job.caseId,
          eventType,
          timestamp: cadTimestamp,
          timestampSource: 'cad_dispatch',
          actor: parts[1] ?? 'Dispatch',
          actorRole: eventType.startsWith('DISPATCH') ? 'dispatcher' : 'officer',
          object: null,
          location: null,
          sourceEvidenceId: job.evidenceId,
          confidence: 0.95, // CAD logs are high-confidence structured data
          extractionMethod: 'CAD_IMPORT' as ExtractionMethod,
          rawText: line.trim(),
          createdAt: new Date().toISOString(),
        };

        events.push(event);
        break;
      }
    }
  }

  return {
    evidenceId: job.evidenceId,
    eventsExtracted: events.length,
    events,
    processingTimeMs: Date.now() - startTime,
    errors,
  };
}

/**
 * Router function — dispatches to appropriate extractor based on evidence type.
 */
export function extractEvents(job: ExtractionJobData): ExtractionResult {
  switch (job.evidenceType) {
    case 'report':
      return extractEventsFromReport(job);
    case 'transcript':
    case 'witness_statement':
      return extractEventsFromTranscript(job);
    case 'cad_log':
      return extractEventsFromCAD(job);
    case 'video':
      // Video extraction is handled by Phase 4 Video Intelligence Pipeline
      return {
        evidenceId: job.evidenceId,
        eventsExtracted: 0,
        events: [],
        processingTimeMs: 0,
        errors: ['Video extraction requires Video Intelligence Pipeline (Phase 4)'],
      };
    default:
      return {
        evidenceId: job.evidenceId,
        eventsExtracted: 0,
        events: [],
        processingTimeMs: 0,
        errors: [`Unsupported evidence type: ${job.evidenceType}`],
      };
  }
}
