// ============================================================================
// Phase 279 — Public Records Recommendation Engine
// Suggests public records requests based on evidence observations.
// All outputs framed as "Potential Public Records to Obtain"
// ============================================================================

export interface PublicRecordsRecommendation {
  id: string;
  caseId: string;
  evidenceSource: string;
  observation: string;
  suggestedOpportunity: string;
  recordCategory: 'policy_manual' | 'training_records' | 'dispatch_logs' | 'statistics' | 'complaints' | 'body_camera_policy' | 'other';
  category: 'PUBLIC_RECORD';
  confidenceScore: number;
  timestamp: string;
}

export class PublicRecordsRecommendationEngine {
  /**
   * Analyze evidence for public records that should be requested.
   */
  static generateRecommendations(caseId: string, evidenceObservations: { source: string; observation: string }[]): PublicRecordsRecommendation[] {
    const recommendations: PublicRecordsRecommendation[] = [];

    for (const obs of evidenceObservations) {
      const matches = PublicRecordsRecommendationEngine.detectPublicRecordPatterns(obs.observation);
      for (const match of matches) {
        recommendations.push({
          id: `pub-${caseId}-${recommendations.length + 1}`,
          caseId,
          evidenceSource: obs.source,
          observation: obs.observation,
          suggestedOpportunity: match.opportunity,
          recordCategory: match.recordCategory,
          category: 'PUBLIC_RECORD',
          confidenceScore: match.confidence,
          timestamp: new Date().toISOString(),
        });
      }
    }

    return recommendations;
  }

  /**
   * Detect public records patterns in observations.
   */
  private static detectPublicRecordPatterns(observation: string): { opportunity: string; recordCategory: PublicRecordsRecommendation['recordCategory']; confidence: number }[] {
    const results: { opportunity: string; recordCategory: PublicRecordsRecommendation['recordCategory']; confidence: number }[] = [];
    const lower = observation.toLowerCase();

    // Police policy manuals
    if (lower.includes('policy') || lower.includes('procedure') || lower.includes('guideline') || lower.includes('protocol')) {
      results.push({
        opportunity: 'Request updated agency policy manuals effective on the incident date.',
        recordCategory: 'policy_manual',
        confidence: 0.90,
      });
    }

    // Training records
    if (lower.includes('training') || lower.includes('technique') || lower.includes('restraint') || lower.includes('taser') || lower.includes('firearm')) {
      results.push({
        opportunity: 'Request training records for the specific technique or equipment used.',
        recordCategory: 'training_records',
        confidence: 0.85,
      });
    }

    // Dispatch/911 logs
    if (lower.includes('911') || lower.includes('dispatch') || lower.includes('call')) {
      results.push({
        opportunity: 'Request 911 call recordings and dispatch audio logs.',
        recordCategory: 'dispatch_logs',
        confidence: 0.88,
      });
    }

    // Use-of-force statistics
    if (lower.includes('force') || lower.includes('arrest') || lower.includes('detention')) {
      results.push({
        opportunity: 'Request agency use-of-force statistics and annual reports.',
        recordCategory: 'statistics',
        confidence: 0.72,
      });
    }

    // Complaint history
    if (lower.includes('complaint') || lower.includes('prior incident') || lower.includes('disciplin')) {
      results.push({
        opportunity: 'Request public complaint records for involved officers.',
        recordCategory: 'complaints',
        confidence: 0.80,
      });
    }

    // Body camera policy
    if (lower.includes('bodycam') || lower.includes('body camera') || lower.includes('bwc') || lower.includes('activation')) {
      results.push({
        opportunity: 'Request body camera activation policy and retention schedule.',
        recordCategory: 'body_camera_policy',
        confidence: 0.85,
      });
    }

    return results;
  }
}
