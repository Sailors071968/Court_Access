// ============================================================================
// MULTI-EVENT EXTRACTION ENGINE (ENHANCED v3)
// SINGLE SOURCE OF TRUTH — All actor/action/target extraction originates here.
// No duplicate extraction logic allowed elsewhere in the pipeline.
// ============================================================================

import { createHash } from 'crypto';
import { extractTimestamp } from './timestampExtractionService';
import { classifyAction, type ClassifiedAction } from './actionClassificationService';
import {
  resolveActor as resolveActorFromEngine,
  createActorMemory,
} from './actorResolutionEngine';

export interface ExtractedEvent {
  description: string;
  action: string;
  actor: string;
  target: string | null;
  timestamp?: string;
}

export interface NormalizedEvent {
  eventId: string;
  actor: string;
  action: string;
  actionClassification: ClassifiedAction;
  target: string | null;
  timestamp: string | null;
  timestampConfidence: number;
  timestampMethod: string;
  description: string;
  confidence: number;
}

// ----------------------------------------------------------------------------
// ACTION KEYWORDS (EXPANDED)
// ----------------------------------------------------------------------------

const ACTION_KEYWORDS = [
  // Base forms
  "approach", "exit", "enter", "draw", "fire", "shoot",
  "detain", "handcuff", "search", "pursue", "chase",
  "strike", "tase", "yell", "order", "command",
  "observe", "interview", "respond", "arrive", "leave", "transport",
  // Past tense / conjugated (common in police reports)
  "approached", "exited", "entered", "drew", "fired", "shot",
  "detained", "handcuffed", "searched", "pursued", "chased",
  "struck", "tased", "yelled", "ordered", "commanded",
  "observed", "interviewed", "responded", "arrived", "transported",
  // Action-first parsing keywords (from user spec)
  "ran", "drove", "grabbed", "pointed",
];

// ----------------------------------------------------------------------------
// SENTENCE SPLIT
// ----------------------------------------------------------------------------

function splitSentences(text: string): string[] {
  return text
    .replace(/\n/g, " ")
    .split(/[.?!]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// ----------------------------------------------------------------------------
// CLAUSE SPLIT (MORE AGGRESSIVE)
// ----------------------------------------------------------------------------

function splitClauses(sentence: string): string[] {
  return sentence
    .split(/,| and | then | after | while | when | as | which | who /i)
    .map((s) => s.trim())
    .filter(Boolean);
}

// ----------------------------------------------------------------------------
// ACTOR EXTRACTION
// ----------------------------------------------------------------------------

export function extractActor(text: string): string {
  // Match titled officers — case-insensitive title, but require the name
  // to start with an uppercase letter (prevents "Officer approached" false match).
  // Two-step: match case-insensitively, then validate name casing.
  const titleMatch = text.match(
    /\b(Officer|Deputy|Detective\.?|Sgt\.?|Lt\.?)\s+(\w+)/i
  );
  if (titleMatch) {
    const name = titleMatch[2];
    // Require name starts with uppercase — handles both normal ("Smith")
    // and all-caps OCR text ("SMITH"). But reject known action verbs
    // (e.g. "OFFICER APPROACHED" → "APPROACHED" is a verb, not a name).
    if (/^[A-Z]/.test(name) && !ACTION_KEYWORDS.includes(name.toLowerCase())) {
      return `${titleMatch[1]} ${titleMatch[2]}`;
    }
  }

  // Match role keywords with word boundaries
  const roleMatch = text.match(/\b(Suspect|Victim|Defendant)\b/i);
  if (roleMatch) return roleMatch[0];

  return "unknown";
}

// ----------------------------------------------------------------------------
// ACTION EXTRACTION
// ----------------------------------------------------------------------------

function extractActions(text: string): string[] {
  const lower = text.toLowerCase();

  return ACTION_KEYWORDS.filter((keyword) =>
    new RegExp(`\\b${keyword}\\b`).test(lower)
  );
}

// ----------------------------------------------------------------------------
// TARGET EXTRACTION (DETERMINISTIC — NO GUESSING)
// Rule A: Direct object after preposition (at/toward/into/onto/to)
// Rule B: "against" prepositional target
// Rule C: Fallback → null (court-safe: never hallucinate)
// ----------------------------------------------------------------------------

// Verbs that commonly follow "to" as infinitives — must NOT be captured as targets
const INFINITIVE_VERBS = new Set([
  'search', 'run', 'flee', 'drop', 'resist', 'exit', 'enter', 'leave',
  'approach', 'pursue', 'chase', 'strike', 'fire', 'shoot', 'draw',
  'detain', 'handcuff', 'grab', 'tase', 'yell', 'order', 'command',
  'observe', 'interview', 'respond', 'arrive', 'transport', 'stop',
  'be', 'get', 'have', 'do', 'make', 'take', 'go', 'come', 'see',
  'know', 'find', 'give', 'tell', 'say', 'try', 'help', 'keep',
]);

// Stop words that must NOT appear as the second word of a two-word target capture.
// Prevents false targets like "scene at" from "responded to the scene at 10:30 PM".
const TARGET_STOP_WORDS = new Set([
  'at', 'on', 'in', 'by', 'to', 'for', 'of', 'from', 'with', 'into',
  'approximately', 'around', 'about', 'near', 'before', 'after',
  'during', 'until', 'since', 'between', 'toward', 'towards',
  'was', 'were', 'is', 'are', 'has', 'had', 'will', 'would',
  'who', 'that', 'which', 'where', 'while', 'then', 'but', 'or',
]);

export function extractTarget(text: string): string | null {
  const patterns: Array<{ regex: RegExp; filterInfinitives: boolean }> = [
    // Rule A: Direct object after preposition (supports multi-word: "red vehicle", "front door")
    // Infinitive filter ONLY applies here ("to search" → null, "to flee" → null)
    { regex: /\b(?:at|toward|into|onto|to)\s+(?:the\s+)?([a-zA-Z]+(?:\s+[a-zA-Z]+)?)/i, filterInfinitives: true },
    // Rule B: Prepositional "against" — no infinitive filter
    { regex: /\b(?:against)\s+(?:the\s+)?([a-zA-Z]+(?:\s+[a-zA-Z]+)?)/i, filterInfinitives: false },
    // Rule C: Direct object after action verbs — no infinitive filter
    // ("approached the search area" → "search area" is valid)
    { regex: /\b(?:approached|searched|entered|exited|grabbed|struck)\s+(?:the\s+)?([a-zA-Z]+(?:\s+[a-zA-Z]+)?)/i, filterInfinitives: false },
  ];

  for (const { regex, filterInfinitives } of patterns) {
    const match = text.match(regex);
    if (match) {
      const captured = match[1].toLowerCase().trim();
      // Filter infinitive verbs ONLY for Rule A ("to search", "to run", "to flee")
      if (filterInfinitives) {
        const firstWord = captured.split(/\s+/)[0];
        if (INFINITIVE_VERBS.has(firstWord)) continue;
      }
      // Strip trailing stop words from two-word captures
      // (e.g. "scene at" → "scene", "suspect or" → "suspect")
      const words = captured.split(/\s+/);
      if (words.length === 2 && TARGET_STOP_WORDS.has(words[1])) {
        return words[0];
      }
      return captured;
    }
  }

  return null;
}

// ----------------------------------------------------------------------------
// MAIN EXTRACTION
// ----------------------------------------------------------------------------

export function extractEvents(chunkText: string): ExtractedEvent[] {
  const sentences = splitSentences(chunkText);

  const events: ExtractedEvent[] = [];

  for (const sentence of sentences) {
    const clauses = splitClauses(sentence);

    for (const clause of clauses) {
      if (clause.length < 8) continue;

      const actor = extractActor(clause);
      const actions = extractActions(clause);
      const target = extractTarget(clause);

      // MULTI-ACTION PER CLAUSE
      if (actions.length > 0) {
        for (const action of actions) {
          events.push({
            description: clause,
            actor,
            action,
            target,
          });
        }
      } else {
        // fallback event
        events.push({
          description: clause,
          actor,
          action: "unknown",
          target,
        });
      }
    }
  }

  return events;
}

// ----------------------------------------------------------------------------
// EVENT NORMALIZATION (PHASE 2 — SINGLE SOURCE OF TRUTH)
// Pipeline: extractEvents → normalizeEvents → resolveActor → classifyAction
// ⚠️ DO NOT CHANGE THIS ORDER
// ----------------------------------------------------------------------------

function computeConfidence(event: ExtractedEvent): number {
  let score = 0.5;
  if (event.actor !== 'unknown') score += 0.2;
  if (event.action !== 'unknown') score += 0.15;
  if (event.target !== null) score += 0.15;
  return Math.min(score, 1.0);
}

function generateEventId(text: string, index: number): string {
  return createHash('sha256')
    .update(`${text}|${index}`)
    .digest('hex');
}

/**
 * Normalize a batch of extracted events through the full pipeline:
 *   1. extractEvents (already done — input to this function)
 *   2. normalizeEvent (timestamp, confidence)
 *   3. resolveActor (pronoun → named actor via memory)
 *   4. classifyAction (raw verb → classified category)
 *
 * Actor memory is maintained across the batch for coreference resolution
 * (e.g. "he" → "Officer Smith" from previous sentence).
 */
export function normalizeEvents(
  events: ExtractedEvent[],
  chunkText: string,
  chunkIndex: number,
): NormalizedEvent[] {
  const memory = createActorMemory();

  return events.map((event, i) => {
    // Step 2: Timestamp extraction from description
    const ts = extractTimestamp(event.description);

    // Step 3: Actor resolution (pronoun → named actor)
    const actorCandidates = event.actor !== 'unknown' ? [event.actor] : [];
    const resolvedActor = resolveActorFromEngine(
      event.description,
      actorCandidates,
      memory,
    );

    // Step 4: Action classification (raw verb → category)
    const actionClassification = classifyAction(event.action, event.description);

    // Step 5: Traceability — deterministic eventId
    const eventId = generateEventId(chunkText, chunkIndex * 1000 + i);

    return {
      eventId,
      actor: resolvedActor,
      action: event.action,
      actionClassification,
      target: event.target,
      timestamp: ts.value,
      timestampConfidence: ts.confidence,
      timestampMethod: ts.method,
      description: event.description,
      confidence: computeConfidence(event),
    };
  });
}
