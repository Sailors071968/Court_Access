// ============================================================================
// Phase 131 — Audio / Speech Analysis Service
// Capabilities: command detection, Miranda warning detection, threat language,
// compliance commands, use-of-force warnings.
// Uses Whisper transcription + NLP classification patterns.
// ============================================================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SpeechEvent {
  timestamp: string;
  eventType: string;
  speaker: 'officer' | 'subject' | 'bystander' | 'unknown';
  confidence: number;
  transcript: string;
  classification: string;
}

export interface SpeechAnalysisResult {
  caseId: string;
  sourceId: string;
  totalSegments: number;
  speechEvents: SpeechEvent[];
  mirandaDetected: boolean;
  threatLanguageDetected: boolean;
  complianceCommandsCount: number;
  uofWarningsCount: number;
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Speech classification patterns
// ---------------------------------------------------------------------------

const SPEECH_PATTERNS: Record<string, {
  patterns: RegExp[];
  speaker: SpeechEvent['speaker'];
  classification: string;
}> = {
  miranda_warning: {
    patterns: [
      /you have the right to remain silent/i,
      /anything you say can and will be used/i,
      /right to an attorney/i,
      /if you cannot afford an attorney/i,
      /do you understand these rights/i,
      /miranda/i,
    ],
    speaker: 'officer',
    classification: 'procedural_requirement',
  },
  verbal_command: {
    patterns: [
      /get on the ground/i,
      /put your hands (up|behind|on)/i,
      /don'?t move/i,
      /stop (right there|moving|resisting)/i,
      /show me your hands/i,
      /get (down|out of the (car|vehicle))/i,
      /freeze/i,
      /drop (the|your) (weapon|gun|knife)/i,
      /step (back|away|out)/i,
      /turn around/i,
      /on your (knees|stomach|belly)/i,
    ],
    speaker: 'officer',
    classification: 'command',
  },
  threat_language: {
    patterns: [
      /i('ll| will) (shoot|tase|spray|hurt)/i,
      /you('re| are) going to get (shot|tased|hurt)/i,
      /last (chance|warning)/i,
      /i('ll| will) (use|deploy) (force|my (taser|weapon))/i,
      /you('re| are) (dead|done|finished)/i,
    ],
    speaker: 'officer',
    classification: 'threat',
  },
  compliance_command: {
    patterns: [
      /comply/i,
      /cooperate/i,
      /stop resisting/i,
      /relax/i,
      /calm down/i,
      /just (relax|cooperate|comply)/i,
      /work with (me|us)/i,
      /make this easy/i,
    ],
    speaker: 'officer',
    classification: 'compliance_directive',
  },
  uof_warning: {
    patterns: [
      /i (am|'m) going to (use|deploy|tase|spray)/i,
      /force (will|may) be used/i,
      /taser.*taser.*taser/i,
      /deploying (taser|OC|pepper)/i,
      /this is your (final|last) warning/i,
      /less.?lethal/i,
    ],
    speaker: 'officer',
    classification: 'use_of_force_warning',
  },
  subject_distress: {
    patterns: [
      /i can'?t breathe/i,
      /you('re| are) (hurting|choking|killing) me/i,
      /please (stop|help|don'?t)/i,
      /my (arm|leg|neck|back) (hurts|is broken)/i,
      /i need (help|medical|a doctor|air)/i,
      /i('m| am) (dying|going to die|in pain)/i,
    ],
    speaker: 'subject',
    classification: 'distress_indicator',
  },
  de_escalation: {
    patterns: [
      /let'?s (talk|calm down|work this out)/i,
      /i('m| am) (here|not going) to (help|hurt)/i,
      /nobody needs to get hurt/i,
      /we can (resolve|handle|figure) this/i,
      /take a (deep )?breath/i,
      /i understand/i,
    ],
    speaker: 'officer',
    classification: 'de_escalation',
  },
};

// ---------------------------------------------------------------------------
// Core analysis functions
// ---------------------------------------------------------------------------

/**
 * Analyze speech content (transcripts or audio transcriptions)
 */
export function analyzeSpeechContent(
  text: string,
  caseId: string,
  sourceId: string,
): SpeechAnalysisResult {
  const startTime = Date.now();
  const speechEvents: SpeechEvent[] = [];
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  let currentTimestamp = '00:00:00';

  for (const line of lines) {
    // Extract timestamp
    const tsMatch = line.match(/(\d{1,2}:\d{2}(?::\d{2})?)/);
    if (tsMatch) {
      currentTimestamp = tsMatch[1].length <= 5
        ? `${tsMatch[1]}:00`
        : tsMatch[1];
    }

    // Check each speech pattern
    for (const [eventType, config] of Object.entries(SPEECH_PATTERNS)) {
      for (const pattern of config.patterns) {
        if (pattern.test(line)) {
          const confidence = calculateSpeechConfidence(line, config.patterns);
          speechEvents.push({
            timestamp: currentTimestamp,
            eventType,
            speaker: detectSpeaker(line, config.speaker),
            confidence,
            transcript: line.trim().substring(0, 500),
            classification: config.classification,
          });
          break;
        }
      }
    }
  }

  // Deduplicate by timestamp + eventType
  const deduped = deduplicateSpeechEvents(speechEvents);

  return {
    caseId,
    sourceId,
    totalSegments: lines.length,
    speechEvents: deduped,
    mirandaDetected: deduped.some(e => e.eventType === 'miranda_warning'),
    threatLanguageDetected: deduped.some(e => e.eventType === 'threat_language'),
    complianceCommandsCount: deduped.filter(e => e.eventType === 'compliance_command').length,
    uofWarningsCount: deduped.filter(e => e.eventType === 'uof_warning').length,
    durationMs: Date.now() - startTime,
  };
}

/**
 * Calculate confidence for speech detection
 */
function calculateSpeechConfidence(text: string, patterns: RegExp[]): number {
  let matchCount = 0;
  for (const pattern of patterns) {
    if (pattern.test(text)) matchCount++;
  }
  return Math.min(0.95, 0.55 + (matchCount * 0.12));
}

/**
 * Detect speaker from line context
 */
function detectSpeaker(
  line: string,
  defaultSpeaker: SpeechEvent['speaker'],
): SpeechEvent['speaker'] {
  const lower = line.toLowerCase();
  if (/officer|deputy|sergeant|detective|corporal|lieutenant/i.test(lower)) return 'officer';
  if (/suspect|subject|defendant|individual/i.test(lower)) return 'subject';
  if (/witness|bystander|civilian/i.test(lower)) return 'bystander';
  return defaultSpeaker;
}

/**
 * Deduplicate speech events
 */
function deduplicateSpeechEvents(events: SpeechEvent[]): SpeechEvent[] {
  const seen = new Map<string, SpeechEvent>();
  for (const event of events) {
    const key = `${event.timestamp}:${event.eventType}`;
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
 * Store speech events as evidence events
 */
export async function storeSpeechEvents(
  caseId: string,
  sourceId: string,
  events: SpeechEvent[],
): Promise<number> {
  let stored = 0;
  for (const event of events) {
    await prisma.evidenceEvent.create({
      data: {
        caseId,
        timestamp: event.timestamp,
        eventType: event.eventType,
        confidence: event.confidence,
        sourceEvidence: sourceId,
        sourceType: 'audio',
        description: `[${event.speaker}] ${event.classification}: ${event.transcript.substring(0, 200)}`,
        rawText: event.transcript,
        metadata: JSON.stringify({
          speaker: event.speaker,
          classification: event.classification,
        }),
      },
    });
    stored++;
  }
  return stored;
}

/**
 * Run full speech analysis pipeline
 */
export async function runSpeechAnalysis(
  caseId: string,
  sourceId: string,
  audioTranscript: string,
): Promise<SpeechAnalysisResult> {
  const result = analyzeSpeechContent(audioTranscript, caseId, sourceId);
  await storeSpeechEvents(caseId, sourceId, result.speechEvents);
  return result;
}
