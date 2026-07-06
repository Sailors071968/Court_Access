// ============================================
// Court Access — Timeline Conflict Analyzer
// Detects temporal contradictions between events
// reported by different sources/speakers.
// ============================================

import { createHash } from 'node:crypto';
import type {
  TimelineEvent,
  TimelineConflict,
  DetectedConflict,
  ConflictScoringFactors,
} from './types.ts';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface TimelineAnalyzerConfig {
  /** Minimum overlap in ms to flag as conflict (default: 0 — any overlap) */
  minOverlapMs: number;
  /** Maximum gap between events to consider "simultaneous" (default: 60000 — 1 minute) */
  simultaneousThresholdMs: number;
  /** Whether to detect impossible sequences (A after B when A claims before B) */
  detectImpossibleSequences: boolean;
  /** Maximum events to compare (n^2 complexity guard) */
  maxEventsToCompare: number;
}

const DEFAULT_CONFIG: TimelineAnalyzerConfig = {
  minOverlapMs: 0,
  simultaneousThresholdMs: 60_000,
  detectImpossibleSequences: true,
  maxEventsToCompare: 10_000,
};

// ---------------------------------------------------------------------------
// Timeline Conflict Analyzer
// ---------------------------------------------------------------------------

export class TimelineConflictAnalyzer {
  private readonly config: TimelineAnalyzerConfig;

  constructor(config?: Partial<TimelineAnalyzerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Analyze timeline events for temporal conflicts.
   * Groups events by speaker, then cross-compares for contradictions.
   */
  analyzeTimeline(
    events: TimelineEvent[],
    tenantId: string,
  ): { timelineConflicts: TimelineConflict[]; detectedConflicts: DetectedConflict[] } {
    const limited = events.slice(0, this.config.maxEventsToCompare);
    const timelineConflicts: TimelineConflict[] = [];
    const detectedConflicts: DetectedConflict[] = [];

    // Sort events by timestamp
    const sorted = [...limited].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
    );

    // 1. Cross-speaker contradictions: same event described with different timings
    const crossSpeakerConflicts = this.detectCrossSpeakerConflicts(sorted);
    timelineConflicts.push(...crossSpeakerConflicts);

    // 2. Impossible sequences: A claims X happened before Y, B claims Y happened before X
    if (this.config.detectImpossibleSequences) {
      const impossibleSeqs = this.detectImpossibleSequences(sorted);
      timelineConflicts.push(...impossibleSeqs);
    }

    // 3. Simultaneous impossibilities: same person in two places at the same time
    const simultaneousConflicts = this.detectSimultaneousConflicts(sorted);
    timelineConflicts.push(...simultaneousConflicts);

    // Convert timeline conflicts to detected conflicts
    for (const tc of timelineConflicts) {
      detectedConflicts.push(this.toDetectedConflict(tc, tenantId));
    }

    return { timelineConflicts, detectedConflicts };
  }

  // -----------------------------------------------------------------------
  // Detection Methods
  // -----------------------------------------------------------------------

  /**
   * Detect conflicts where different speakers report the same event
   * at significantly different times.
   */
  private detectCrossSpeakerConflicts(events: TimelineEvent[]): TimelineConflict[] {
    const conflicts: TimelineConflict[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < events.length; i++) {
      for (let j = i + 1; j < events.length; j++) {
        const a = events[i];
        const b = events[j];

        // Skip same-speaker comparisons for this check
        if (a.speakerId === b.speakerId) continue;

        // Check if descriptions are similar enough to be about the same event
        if (!this.descriptionsSimilar(a.description, b.description)) continue;

        const timeGapMs = Math.abs(a.timestamp.getTime() - b.timestamp.getTime());

        // If time gap exceeds threshold, this is a conflict
        if (timeGapMs > this.config.simultaneousThresholdMs) {
          const dedupKey = [a.id, b.id].sort().join(':');
          if (seen.has(dedupKey)) continue;
          seen.add(dedupKey);

          conflicts.push({
            eventA: a,
            eventB: b,
            conflictDescription:
              `Cross-speaker timeline conflict: "${a.speakerId}" reports event at ` +
              `${a.timestamp.toISOString()}, "${b.speakerId}" reports same event at ` +
              `${b.timestamp.toISOString()} (gap: ${Math.round(timeGapMs / 60000)}min)`,
            timeGapMs,
            sameSpeaker: false,
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Detect impossible sequences where ordering claims contradict.
   * E.g., Speaker A says X happened before Y, Speaker B says Y happened before X.
   */
  private detectImpossibleSequences(events: TimelineEvent[]): TimelineConflict[] {
    const conflicts: TimelineConflict[] = [];
    const seen = new Set<string>();

    // Group events by speaker
    const bySpeaker = new Map<string, TimelineEvent[]>();
    for (const event of events) {
      const list = bySpeaker.get(event.speakerId) ?? [];
      list.push(event);
      bySpeaker.set(event.speakerId, list);
    }

    const speakerIds = Array.from(bySpeaker.keys());

    for (let si = 0; si < speakerIds.length; si++) {
      for (let sj = si + 1; sj < speakerIds.length; sj++) {
        const eventsA = bySpeaker.get(speakerIds[si])!;
        const eventsB = bySpeaker.get(speakerIds[sj])!;

        for (const ea of eventsA) {
          for (const eb of eventsB) {
            // Look for pairs where descriptions match another pair in reversed order
            for (const ea2 of eventsA) {
              if (ea2.id === ea.id) continue;
              for (const eb2 of eventsB) {
                if (eb2.id === eb.id) continue;

                // Speaker A: ea before ea2
                // Speaker B: eb2 (matches ea) before eb (matches ea2)
                // But B's ordering is reversed
                if (
                  this.descriptionsSimilar(ea.description, eb2.description) &&
                  this.descriptionsSimilar(ea2.description, eb.description) &&
                  ea.timestamp.getTime() < ea2.timestamp.getTime() &&
                  eb2.timestamp.getTime() > eb.timestamp.getTime()
                ) {
                  const dedupKey = [ea.id, ea2.id, eb.id, eb2.id].sort().join(':');
                  if (seen.has(dedupKey)) continue;
                  seen.add(dedupKey);

                  conflicts.push({
                    eventA: ea,
                    eventB: eb2,
                    conflictDescription:
                      `Impossible sequence: "${speakerIds[si]}" claims event ordering ` +
                      `contradicts "${speakerIds[sj]}"'s account`,
                    timeGapMs: Math.abs(ea.timestamp.getTime() - eb2.timestamp.getTime()),
                    sameSpeaker: false,
                  });
                }
              }
            }
          }
        }
      }
    }

    return conflicts;
  }

  /**
   * Detect when the same speaker claims to be involved in events
   * at the same time that are physically incompatible.
   */
  private detectSimultaneousConflicts(events: TimelineEvent[]): TimelineConflict[] {
    const conflicts: TimelineConflict[] = [];
    const seen = new Set<string>();

    // Group by speaker
    const bySpeaker = new Map<string, TimelineEvent[]>();
    for (const event of events) {
      const list = bySpeaker.get(event.speakerId) ?? [];
      list.push(event);
      bySpeaker.set(event.speakerId, list);
    }

    for (const [, speakerEvents] of bySpeaker) {
      const sorted = [...speakerEvents].sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
      );

      for (let i = 0; i < sorted.length; i++) {
        for (let j = i + 1; j < sorted.length; j++) {
          const a = sorted[i];
          const b = sorted[j];

          const timeGapMs = Math.abs(a.timestamp.getTime() - b.timestamp.getTime());

          // If events overlap in time and have different descriptions
          if (
            timeGapMs <= this.config.simultaneousThresholdMs &&
            !this.descriptionsSimilar(a.description, b.description)
          ) {
            const dedupKey = [a.id, b.id].sort().join(':');
            if (seen.has(dedupKey)) continue;
            seen.add(dedupKey);

            conflicts.push({
              eventA: a,
              eventB: b,
              conflictDescription:
                `Simultaneous conflict: same speaker "${a.speakerId}" reports two ` +
                `different events within ${Math.round(timeGapMs / 1000)}s of each other`,
              timeGapMs,
              sameSpeaker: true,
            });
          }
        }
      }
    }

    return conflicts;
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  /**
   * Simple token-overlap similarity check for event descriptions.
   * Returns true if descriptions share enough tokens to be about the same event.
   */
  private descriptionsSimilar(a: string, b: string): boolean {
    const tokensA = this.tokenize(a);
    const tokensB = this.tokenize(b);

    if (tokensA.length === 0 || tokensB.length === 0) return false;

    const setB = new Set(tokensB);
    let overlap = 0;
    for (const token of tokensA) {
      if (setB.has(token)) overlap++;
    }

    const similarity = (2 * overlap) / (tokensA.length + tokensB.length);
    return similarity >= 0.4;
  }

  /**
   * Tokenize text into lowercase words, removing stop words.
   */
  private tokenize(text: string): string[] {
    const stopWords = new Set([
      'the', 'a', 'an', 'is', 'was', 'were', 'are', 'been', 'be',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
      'could', 'should', 'may', 'might', 'shall', 'can', 'to', 'of',
      'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into',
      'through', 'during', 'before', 'after', 'above', 'below',
      'and', 'but', 'or', 'nor', 'not', 'so', 'yet', 'both',
      'that', 'this', 'these', 'those', 'it', 'its',
    ]);

    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(t => t.length > 2 && !stopWords.has(t));
  }

  /**
   * Convert a TimelineConflict to a DetectedConflict.
   */
  private toDetectedConflict(tc: TimelineConflict, tenantId: string): DetectedConflict {
    // Compute severity factors
    const maxGapForCritical = 3600_000; // 1 hour
    const temporalContradictionStrength = Math.min(tc.timeGapMs / maxGapForCritical, 1.0);

    const factors: ConflictScoringFactors = {
      temporalContradictionStrength,
      evidenceReliability: 0.7, // default for timeline events
      policyViolationWeight: 0,
      supportingSourceCount: tc.sameSpeaker ? 1 : 2,
    };

    const severityScore =
      factors.temporalContradictionStrength * 0.35 +
      factors.evidenceReliability * 0.25 +
      factors.policyViolationWeight * 0.25 +
      Math.min(factors.supportingSourceCount / 5, 1.0) * 0.15;

    const id = createHash('sha256')
      .update(`timeline:${tc.eventA.id}:${tc.eventB.id}:${tenantId}`)
      .digest('hex')
      .slice(0, 16);

    return {
      id: `conflict-${id}`,
      conflictType: 'timeline',
      description: tc.conflictDescription,
      severity: {
        severityScore: Math.min(1.0, Math.max(0.0, severityScore)),
        severity: this.scoreToBand(severityScore),
        factors,
        weights: {
          temporalContradictionStrength: 0.35,
          evidenceReliability: 0.25,
          policyViolationWeight: 0.25,
          supportingSourceCount: 0.15,
        },
      },
      sourceNodeIds: [tc.eventA.sourceId],
      targetNodeIds: [tc.eventB.sourceId],
      evidenceIds: [],
      tenantId,
      sourceDocumentIds: [tc.eventA.sourceDocumentId, tc.eventB.sourceDocumentId].filter(
        (v, i, a) => a.indexOf(v) === i,
      ),
      detectedAt: new Date(),
    };
  }

  private scoreToBand(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 0.85) return 'critical';
    if (score >= 0.65) return 'high';
    if (score >= 0.40) return 'medium';
    return 'low';
  }
}
