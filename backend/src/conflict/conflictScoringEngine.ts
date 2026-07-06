// ============================================
// Court Access — Conflict Scoring Engine
// Computes composite severity scores for detected
// conflicts using weighted factor analysis.
// ============================================

import type {
  ConflictScoringFactors,
  ConflictScoringWeights,
  ConflictSeverity,
  ConflictSeverityScore,
  ConflictType,
  DetectedConflict,
} from './types.ts';
import {
  DEFAULT_CONFLICT_SCORING_WEIGHTS as DEFAULTS,
} from './types.ts';

// ---------------------------------------------------------------------------
// Scoring Engine
// ---------------------------------------------------------------------------

export class ConflictScoringEngine {
  private readonly weights: ConflictScoringWeights;

  constructor(weights?: Partial<ConflictScoringWeights>) {
    this.weights = { ...DEFAULTS, ...weights };
    this.validateWeights(this.weights);
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Compute a severity score from raw scoring factors.
   */
  computeSeverity(factors: ConflictScoringFactors): ConflictSeverityScore {
    const normalized = this.normalizeFactors(factors);
    const severityScore = this.computeWeightedScore(normalized);

    return {
      severityScore,
      severity: this.scoreToBand(severityScore),
      factors: normalized,
      weights: { ...this.weights },
    };
  }

  /**
   * Re-score an existing detected conflict with updated factors.
   */
  rescoreConflict(conflict: DetectedConflict, updatedFactors?: Partial<ConflictScoringFactors>): DetectedConflict {
    const factors: ConflictScoringFactors = {
      ...conflict.severity.factors,
      ...updatedFactors,
    };

    const severity = this.computeSeverity(factors);

    return {
      ...conflict,
      severity,
    };
  }

  /**
   * Batch-score multiple conflicts and sort by severity (highest first).
   */
  rankConflicts(conflicts: DetectedConflict[]): DetectedConflict[] {
    return [...conflicts].sort(
      (a, b) => b.severity.severityScore - a.severity.severityScore,
    );
  }

  /**
   * Apply conflict-type-specific adjustments to base factors.
   * Different conflict types warrant different scoring emphasis.
   */
  adjustFactorsForType(
    factors: ConflictScoringFactors,
    conflictType: ConflictType,
  ): ConflictScoringFactors {
    const adjusted = { ...factors };

    switch (conflictType) {
      case 'timeline':
        // Timeline conflicts emphasize temporal contradiction strength
        adjusted.temporalContradictionStrength = Math.min(
          1.0,
          adjusted.temporalContradictionStrength * 1.2,
        );
        break;

      case 'testimony':
        // Testimony conflicts emphasize evidence reliability
        adjusted.evidenceReliability = Math.min(
          1.0,
          adjusted.evidenceReliability * 1.15,
        );
        break;

      case 'policy_violation':
        // Policy violations emphasize the policy weight
        adjusted.policyViolationWeight = Math.min(
          1.0,
          adjusted.policyViolationWeight * 1.3,
        );
        break;

      case 'evidence':
        // Evidence inconsistencies emphasize source count and reliability
        adjusted.evidenceReliability = Math.min(
          1.0,
          adjusted.evidenceReliability * 1.1,
        );
        adjusted.supportingSourceCount = Math.max(
          adjusted.supportingSourceCount,
          2,
        );
        break;

      case 'legal_claim':
        // Legal claim conflicts emphasize policy and temporal factors
        adjusted.policyViolationWeight = Math.min(
          1.0,
          adjusted.policyViolationWeight * 1.2,
        );
        adjusted.temporalContradictionStrength = Math.min(
          1.0,
          adjusted.temporalContradictionStrength * 1.1,
        );
        break;
    }

    return adjusted;
  }

  // -----------------------------------------------------------------------
  // Internal Methods
  // -----------------------------------------------------------------------

  /**
   * Normalize factors to 0.0–1.0 range.
   */
  private normalizeFactors(factors: ConflictScoringFactors): ConflictScoringFactors {
    return {
      temporalContradictionStrength: this.clamp(factors.temporalContradictionStrength),
      evidenceReliability: this.clamp(factors.evidenceReliability),
      policyViolationWeight: this.clamp(factors.policyViolationWeight),
      // Normalize source count: cap at 5 sources for max score
      supportingSourceCount: Math.max(0, factors.supportingSourceCount),
    };
  }

  /**
   * Compute weighted composite score.
   */
  private computeWeightedScore(factors: ConflictScoringFactors): number {
    const raw =
      factors.temporalContradictionStrength * this.weights.temporalContradictionStrength +
      factors.evidenceReliability * this.weights.evidenceReliability +
      factors.policyViolationWeight * this.weights.policyViolationWeight +
      Math.min(factors.supportingSourceCount / 5, 1.0) * this.weights.supportingSourceCount;

    return this.clamp(raw);
  }

  /**
   * Convert numeric score to severity band.
   */
  private scoreToBand(score: number): ConflictSeverity {
    if (score >= 0.85) return 'critical';
    if (score >= 0.65) return 'high';
    if (score >= 0.40) return 'medium';
    return 'low';
  }

  /**
   * Clamp a value to [0.0, 1.0].
   */
  private clamp(value: number): number {
    return Math.min(1.0, Math.max(0.0, value));
  }

  /**
   * Validate that weights sum to approximately 1.0.
   */
  private validateWeights(weights: ConflictScoringWeights): void {
    const sum =
      weights.temporalContradictionStrength +
      weights.evidenceReliability +
      weights.policyViolationWeight +
      weights.supportingSourceCount;

    if (Math.abs(sum - 1.0) > 0.01) {
      throw new Error(
        `Conflict scoring weights must sum to 1.0 (got ${sum.toFixed(4)})`,
      );
    }
  }
}
