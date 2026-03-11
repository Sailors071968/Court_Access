// ============================================================================
// Phase 277 — Motion Recommendation Engine
// Detects circumstances suggesting potential motions.
// All outputs framed as "Potential Procedural Opportunity"
// ============================================================================

export interface MotionRecommendation {
  id: string;
  caseId: string;
  evidenceSource: string;
  observation: string;
  suggestedOpportunity: string;
  motionType: 'suppression' | 'brady' | 'pitchess' | 'discovery' | 'dismiss' | 'other';
  category: 'MOTION';
  confidenceScore: number;
  timestamp: string;
}

export class MotionRecommendationEngine {
  /**
   * Analyze evidence for circumstances suggesting potential motions.
   */
  static generateRecommendations(caseId: string, evidenceObservations: { source: string; observation: string }[]): MotionRecommendation[] {
    const recommendations: MotionRecommendation[] = [];

    for (const obs of evidenceObservations) {
      const matches = MotionRecommendationEngine.detectMotionPatterns(obs.observation);
      for (const match of matches) {
        recommendations.push({
          id: `mot-${caseId}-${recommendations.length + 1}`,
          caseId,
          evidenceSource: obs.source,
          observation: obs.observation,
          suggestedOpportunity: match.opportunity,
          motionType: match.motionType,
          category: 'MOTION',
          confidenceScore: match.confidence,
          timestamp: new Date().toISOString(),
        });
      }
    }

    return recommendations;
  }

  /**
   * Detect motion-worthy patterns in observations.
   */
  private static detectMotionPatterns(observation: string): { opportunity: string; motionType: MotionRecommendation['motionType']; confidence: number }[] {
    const results: { opportunity: string; motionType: MotionRecommendation['motionType']; confidence: number }[] = [];
    const lower = observation.toLowerCase();

    // Suppression motion patterns
    if (lower.includes('search') && (lower.includes('prior to') || lower.includes('without') || lower.includes('before'))) {
      results.push({
        opportunity: 'Review for potential suppression motion regarding search legality.',
        motionType: 'suppression',
        confidence: 0.85,
      });
    }

    if (lower.includes('probable cause') || lower.includes('reasonable suspicion')) {
      results.push({
        opportunity: 'Evaluate probable cause documentation for potential suppression motion.',
        motionType: 'suppression',
        confidence: 0.80,
      });
    }

    // Brady motion patterns
    if (lower.includes('not included in discovery') || lower.includes('missing from') || lower.includes('not disclosed') || lower.includes('referenced') && lower.includes('not present')) {
      results.push({
        opportunity: 'Request disclosure of referenced evidence not included in discovery.',
        motionType: 'brady',
        confidence: 0.90,
      });
    }

    // Pitchess motion patterns (California)
    if (lower.includes('use-of-force') || lower.includes('use of force') || lower.includes('excessive force') || lower.includes('personnel record') || lower.includes('prior complaint')) {
      results.push({
        opportunity: 'Consider officer personnel record discovery review (Pitchess motion).',
        motionType: 'pitchess',
        confidence: 0.75,
      });
    }

    // Discovery motion patterns
    if (lower.includes('withheld') || lower.includes('incomplete') || lower.includes('redacted') || lower.includes('missing pages')) {
      results.push({
        opportunity: 'File motion to compel production of complete, unredacted records.',
        motionType: 'discovery',
        confidence: 0.82,
      });
    }

    // Miranda/statement patterns
    if (lower.includes('miranda') || lower.includes('rights') && lower.includes('not advised') || lower.includes('interrogat')) {
      results.push({
        opportunity: 'Review for potential suppression of statements obtained without Miranda advisement.',
        motionType: 'suppression',
        confidence: 0.88,
      });
    }

    return results;
  }
}
