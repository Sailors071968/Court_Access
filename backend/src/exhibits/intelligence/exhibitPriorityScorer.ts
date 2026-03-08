// ============================================
// Court Access — Exhibit Priority Scorer
// Ranks exhibit ideas using a weighted scoring
// model to surface the most impactful suggestions.
// ============================================

import type {
  ExhibitIdea,
  PatternScoringFactors,
  PriorityWeights,
  PriorityScoreResult,
  PriorityBand,
  DetectedPattern,
} from './types.ts';
import { DEFAULT_PRIORITY_WEIGHTS } from './types.ts';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface PriorityScorerConfig {
  /** Custom weights (must sum to 1.0) */
  weights: PriorityWeights;
  /** Minimum score to include in suggestions (default: 0.20) */
  minimumScore: number;
}

const DEFAULT_CONFIG: PriorityScorerConfig = {
  weights: { ...DEFAULT_PRIORITY_WEIGHTS },
  minimumScore: 0.20,
};

// ---------------------------------------------------------------------------
// Exhibit Priority Scorer
// ---------------------------------------------------------------------------

export class ExhibitPriorityScorer {
  private readonly config: PriorityScorerConfig;

  constructor(config?: Partial<PriorityScorerConfig>) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      weights: {
        ...DEFAULT_CONFIG.weights,
        ...config?.weights,
      },
    };
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Score a single set of pattern factors and return a priority result.
   */
  score(factors: PatternScoringFactors): PriorityScoreResult {
    const { weights } = this.config;

    const rawScore =
      factors.conflictSeverity * weights.conflictSeverity +
      factors.evidenceImportance * weights.evidenceImportance +
      factors.juryClarityImpact * weights.juryClarityImpact +
      factors.noveltyFactor * weights.noveltyFactor;

    const clampedScore = Math.min(1.0, Math.max(0.0, rawScore));

    return {
      score: Math.round(clampedScore * 1000) / 1000,
      factors,
      weights,
      band: this.scoreToBand(clampedScore),
    };
  }

  /**
   * Score and attach priority to exhibit ideas.
   * Ideas below the minimum score threshold are filtered out.
   * Returns ideas sorted by priority score (descending).
   */
  scoreAndRank(
    ideas: ExhibitIdea[],
    patterns: DetectedPattern[],
  ): ExhibitIdea[] {
    // Build a lookup from pattern ID → idea ID
    const patternMap = new Map<string, DetectedPattern>();
    for (const pattern of patterns) {
      patternMap.set(pattern.id, pattern);
    }

    const scoredIdeas: ExhibitIdea[] = [];

    for (const idea of ideas) {
      // Find the pattern that generated this idea
      const pattern = patterns.find(
        p => p.caseId === idea.caseId && p.patternType === idea.exhibitType &&
          this.arraysOverlap(p.evidenceIds, idea.evidenceIds),
      );

      if (pattern) {
        const result = this.score(pattern.rawFactors);
        if (result.score >= this.config.minimumScore) {
          scoredIdeas.push({
            ...idea,
            priorityScore: result.score,
          });
        }
      }
    }

    // Sort by priority score descending
    scoredIdeas.sort((a, b) => b.priorityScore - a.priorityScore);

    return scoredIdeas;
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private scoreToBand(score: number): PriorityBand {
    if (score >= 0.85) return 'critical';
    if (score >= 0.65) return 'high';
    if (score >= 0.40) return 'medium';
    return 'low';
  }

  private arraysOverlap(a: string[], b: string[]): boolean {
    const setB = new Set(b);
    return a.some(item => setB.has(item));
  }
}
