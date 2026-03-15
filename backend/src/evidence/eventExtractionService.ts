// ============================================================================
// Phase 129 — Evidence Event Extraction Engine
// Extracts structured events from bodycam, dashcam, audio, transcripts,
// and police reports. Stores results in EvidenceEvents table.
// ============================================================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExtractedEvent {
  caseId: string;
  timestamp: string;
  eventType: string;
  confidence: number;
  sourceEvidence: string;
  sourceType: 'bodycam' | 'dashcam' | 'audio' | 'transcript' | 'police_report';
  description?: string;
  rawText?: string;
  metadata?: Record<string, unknown>;
}

export interface ExtractionResult {
  caseId: string;
  eventsExtracted: number;
  sourceType: string;
  durationMs: number;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Event type taxonomy
// ---------------------------------------------------------------------------

export const EVENT_TYPES = [
  'suspect_restrained',
  'taser_deployed',
  'neck_restraint',
  'vehicle_search',
  'verbal_command',
  'miranda_warning',
  'weapon_drawn',
  'handcuffing',
  'physical_strike',
  'officer_proximity',
  'threat_language',
  'compliance_command',
  'uof_warning',
  'foot_pursuit',
  'vehicle_pursuit',
  'baton_strike',
  'pepper_spray',
  'k9_deployment',
  'shots_fired',
  'medical_attention',
  'de_escalation_attempt',
  'pat_down_search',
  'prone_restraint',
  'traffic_stop',
  'dispatch_notification',
  'arrest',
  'field_sobriety_test',
  'citation_issued',
  'backup_requested',
  'subject_detained',
  'other',
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

// ---------------------------------------------------------------------------
// Keyword patterns for text-based event extraction
// ---------------------------------------------------------------------------

const EVENT_KEYWORD_PATTERNS: Record<string, RegExp[]> = {
  suspect_restrained: [
    /restrain/i, /held down/i, /pinned/i, /control hold/i, /took.*ground/i,
  ],
  taser_deployed: [
    /taser/i, /tased/i, /conducted energy/i, /CEW/i, /electroshock/i,
  ],
  neck_restraint: [
    /neck restraint/i, /chokehold/i, /carotid/i, /lateral.*vascular/i,
    /neck.*hold/i, /choke/i,
  ],
  vehicle_search: [
    /search.*vehicle/i, /searched.*car/i, /vehicle search/i, /trunk search/i,
    /glove.*box/i, /search.*trunk/i,
  ],
  verbal_command: [
    /get on the ground/i, /hands up/i, /don't move/i, /stop resisting/i,
    /show me your hands/i, /get down/i, /freeze/i, /drop.*weapon/i,
  ],
  miranda_warning: [
    /miranda/i, /right to remain silent/i, /anything you say/i,
    /right to an attorney/i, /right.*lawyer/i,
  ],
  weapon_drawn: [
    /drew.*weapon/i, /unholstered/i, /gun drawn/i, /firearm.*pointed/i,
    /weapon drawn/i, /drew.*firearm/i, /drew.*sidearm/i,
  ],
  handcuffing: [
    /handcuff/i, /cuffed/i, /placed in cuffs/i, /applied.*restraints/i,
  ],
  physical_strike: [
    /struck/i, /punched/i, /kicked/i, /hit.*subject/i, /physical force/i,
    /baton.*strike/i, /elbow.*strike/i,
  ],
  officer_proximity: [
    /approached/i, /closed distance/i, /within.*feet/i, /moved toward/i,
  ],
  threat_language: [
    /I'll shoot/i, /I will.*force/i, /you're going to get/i, /threat/i,
  ],
  compliance_command: [
    /comply/i, /cooperate/i, /stop resisting/i, /relax/i, /calm down/i,
  ],
  uof_warning: [
    /use.*force/i, /deploy.*taser/i, /going to.*spray/i, /last warning/i,
  ],
  foot_pursuit: [
    /foot pursuit/i, /chased.*on foot/i, /running after/i, /foot chase/i,
  ],
  vehicle_pursuit: [
    /vehicle pursuit/i, /car chase/i, /pursuit.*vehicle/i, /high.*speed/i,
  ],
  baton_strike: [/baton/i, /baton.*strike/i, /impact weapon/i],
  pepper_spray: [/pepper spray/i, /OC spray/i, /chemical agent/i, /mace/i],
  k9_deployment: [/K-?9/i, /canine/i, /dog.*deployed/i, /police dog/i],
  shots_fired: [/shots fired/i, /discharged.*firearm/i, /shot.*fired/i, /OIS/i],
  medical_attention: [
    /medical/i, /paramedic/i, /ambulance/i, /first aid/i, /CPR/i,
  ],
  de_escalation_attempt: [
    /de-escalat/i, /deescalat/i, /calm.*situation/i, /verbal.*resolution/i,
  ],
  pat_down_search: [/pat down/i, /frisk/i, /Terry stop/i, /patted.*down/i],
  prone_restraint: [
    /prone/i, /face.*down/i, /stomach.*ground/i, /prone.*position/i,
  ],
  traffic_stop: [
    /traffic stop/i, /initiated.*stop/i, /pulled over/i, /vehicle stop/i,
    /conducted.*stop/i, /stopped.*vehicle/i, /routine stop/i,
    /initiated.*traffic/i, /motor vehicle stop/i,
  ],
  dispatch_notification: [
    /dispatch.*notified/i, /notified.*dispatch/i, /dispatch.*advised/i,
    /contacted.*dispatch/i, /radioed.*dispatch/i, /dispatch.*informed/i,
    /dispatch.*called/i, /called.*dispatch/i, /dispatch was/i,
  ],
  arrest: [
    /placed.*under arrest/i, /you're under arrest/i, /arrested/i,
    /taken into custody/i, /effected.*arrest/i,
  ],
  field_sobriety_test: [
    /field sobriety/i, /sobriety test/i, /FST/i, /breathalyzer/i,
    /DUI.*test/i, /intoxication.*test/i,
  ],
  citation_issued: [
    /citation.*issued/i, /issued.*citation/i, /ticket.*issued/i,
    /issued.*ticket/i, /written.*warning/i, /verbal.*warning/i,
  ],
  backup_requested: [
    /backup.*requested/i, /requested.*backup/i, /additional.*units/i,
    /called for.*backup/i, /requesting.*assistance/i,
  ],
  subject_detained: [
    /detained/i, /held.*for.*questioning/i, /investigative.*detention/i,
    /detain.*subject/i, /subject.*held/i,
  ],
};

// ---------------------------------------------------------------------------
// Core extraction functions
// ---------------------------------------------------------------------------

/**
 * Extract events from text content (transcripts, police reports)
 */
export function extractEventsFromText(
  text: string,
  caseId: string,
  sourceEvidence: string,
  sourceType: ExtractedEvent['sourceType'],
): ExtractedEvent[] {
  const events: ExtractedEvent[] = [];
  const lines = text.split('\n');
  let currentTimestamp = '00:00:00';

  for (const line of lines) {
    // Try to extract timestamp from line
    const tsMatch = line.match(/(\d{1,2}:\d{2}(?::\d{2})?)/);
    if (tsMatch) {
      currentTimestamp = tsMatch[1].length <= 5
        ? `${tsMatch[1]}:00`
        : tsMatch[1];
    }

    // Check each event type pattern
    for (const [eventType, patterns] of Object.entries(EVENT_KEYWORD_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(line)) {
          // Calculate confidence based on keyword specificity
          const confidence = calculateTextConfidence(line, eventType, patterns);
          events.push({
            caseId,
            timestamp: currentTimestamp,
            eventType,
            confidence,
            sourceEvidence,
            sourceType,
            description: `Detected ${eventType.replace(/_/g, ' ')} in ${sourceType}`,
            rawText: line.trim().substring(0, 500),
          });
          break; // Only one match per event type per line
        }
      }
    }
  }

  return deduplicateEvents(events);
}

/**
 * Calculate confidence for text-based detection
 */
function calculateTextConfidence(
  text: string,
  eventType: string,
  patterns: RegExp[],
): number {
  let matchCount = 0;
  for (const pattern of patterns) {
    if (pattern.test(text)) matchCount++;
  }
  // More keyword matches = higher confidence
  const patternConfidence = Math.min(0.9, 0.5 + (matchCount * 0.1));

  // Longer, more specific text gets higher confidence
  const lengthBonus = Math.min(0.1, text.length / 1000);

  // Critical event types get slight boost for safety
  const criticalEvents = ['neck_restraint', 'shots_fired', 'taser_deployed', 'physical_strike'];
  const criticalBonus = criticalEvents.includes(eventType) ? 0.05 : 0;

  return Math.min(0.95, patternConfidence + lengthBonus + criticalBonus);
}

/**
 * Deduplicate events with same type at same timestamp
 */
function deduplicateEvents(events: ExtractedEvent[]): ExtractedEvent[] {
  const seen = new Map<string, ExtractedEvent>();
  for (const event of events) {
    const key = `${event.caseId}:${event.timestamp}:${event.eventType}`;
    const existing = seen.get(key);
    if (!existing || event.confidence > existing.confidence) {
      seen.set(key, event);
    }
  }
  return Array.from(seen.values());
}

// ---------------------------------------------------------------------------
// Database operations
// ---------------------------------------------------------------------------

/**
 * Store extracted events in the database
 */
export async function storeEvents(events: ExtractedEvent[]): Promise<number> {
  let stored = 0;
  for (const event of events) {
    await prisma.evidenceEvent.create({
      data: {
        caseId: event.caseId,
        timestamp: event.timestamp,
        eventType: event.eventType,
        confidence: event.confidence,
        sourceEvidence: event.sourceEvidence,
        sourceType: event.sourceType,
        description: event.description,
        rawText: event.rawText,
        metadata: event.metadata ? JSON.stringify(event.metadata) : undefined,
      },
    });
    stored++;
  }
  return stored;
}

/**
 * Run full extraction pipeline for a case
 */
export async function extractEventsForCase(
  caseId: string,
  evidenceSources: Array<{
    content: string;
    sourceId: string;
    sourceType: ExtractedEvent['sourceType'];
  }>,
): Promise<ExtractionResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let totalEvents = 0;

  for (const source of evidenceSources) {
    try {
      const events = extractEventsFromText(
        source.content,
        caseId,
        source.sourceId,
        source.sourceType,
      );
      const stored = await storeEvents(events);
      totalEvents += stored;
    } catch (err) {
      errors.push(`Failed to extract from ${source.sourceId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return {
    caseId,
    eventsExtracted: totalEvents,
    sourceType: 'mixed',
    durationMs: Date.now() - startTime,
    errors,
  };
}

/**
 * Get all events for a case, ordered by timestamp
 */
export async function getCaseEvents(caseId: string) {
  return prisma.evidenceEvent.findMany({
    where: { caseId },
    orderBy: { timestamp: 'asc' },
  });
}

/**
 * Get events by type across all cases
 */
export async function getEventsByType(eventType: string) {
  return prisma.evidenceEvent.findMany({
    where: { eventType },
    orderBy: { confidence: 'desc' },
  });
}

/**
 * Get event statistics for a case
 */
export async function getCaseEventStats(caseId: string) {
  const events = await prisma.evidenceEvent.findMany({
    where: { caseId },
  });

  const byType: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  let totalConfidence = 0;

  for (const event of events) {
    byType[event.eventType] = (byType[event.eventType] || 0) + 1;
    bySource[event.sourceType] = (bySource[event.sourceType] || 0) + 1;
    totalConfidence += event.confidence;
  }

  return {
    totalEvents: events.length,
    byType,
    bySource,
    averageConfidence: events.length > 0 ? totalConfidence / events.length : 0,
  };
}
