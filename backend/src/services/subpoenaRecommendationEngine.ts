// ============================================================================
// Phase 278 — Subpoena Recommendation Engine
// Suggests records to obtain via subpoena based on evidence observations.
// All outputs framed as "Potential Records to Obtain"
// ============================================================================

export interface SubpoenaRecommendation {
  id: string;
  caseId: string;
  evidenceSource: string;
  observation: string;
  suggestedOpportunity: string;
  recordType: 'dispatch' | 'surveillance' | 'medical' | 'telecom' | 'financial' | 'personnel' | 'other';
  category: 'SUBPOENA';
  confidenceScore: number;
  timestamp: string;
}

export class SubpoenaRecommendationEngine {
  /**
   * Analyze evidence for records that should be subpoenaed.
   */
  static generateRecommendations(caseId: string, evidenceObservations: { source: string; observation: string }[]): SubpoenaRecommendation[] {
    const recommendations: SubpoenaRecommendation[] = [];

    for (const obs of evidenceObservations) {
      const matches = SubpoenaRecommendationEngine.detectSubpoenaPatterns(obs.observation);
      for (const match of matches) {
        recommendations.push({
          id: `sub-${caseId}-${recommendations.length + 1}`,
          caseId,
          evidenceSource: obs.source,
          observation: obs.observation,
          suggestedOpportunity: match.opportunity,
          recordType: match.recordType,
          category: 'SUBPOENA',
          confidenceScore: match.confidence,
          timestamp: new Date().toISOString(),
        });
      }
    }

    return recommendations;
  }

  /**
   * Detect subpoena-worthy patterns in observations.
   */
  private static detectSubpoenaPatterns(observation: string): { opportunity: string; recordType: SubpoenaRecommendation['recordType']; confidence: number }[] {
    const results: { opportunity: string; recordType: SubpoenaRecommendation['recordType']; confidence: number }[] = [];
    const lower = observation.toLowerCase();

    // Dispatch records
    if (lower.includes('dispatch') || lower.includes('radio') || lower.includes('cad') || lower.includes('911')) {
      results.push({
        opportunity: 'Obtain full dispatch log, CAD records, and 911 call recordings.',
        recordType: 'dispatch',
        confidence: 0.90,
      });
    }

    // Surveillance video
    if (lower.includes('commercial') || lower.includes('business') || lower.includes('surveillance') || lower.includes('nearby')) {
      results.push({
        opportunity: 'Obtain nearby surveillance camera recordings from businesses in the area.',
        recordType: 'surveillance',
        confidence: 0.80,
      });
    }

    // Cell phone/telecom data
    if (lower.includes('phone') || lower.includes('cell') || lower.includes('communication') || lower.includes('text message')) {
      results.push({
        opportunity: 'Obtain relevant telecommunications records.',
        recordType: 'telecom',
        confidence: 0.75,
      });
    }

    // Medical records
    if (lower.includes('injur') || lower.includes('hospital') || lower.includes('medical') || lower.includes('treatment') || lower.includes('ambulance')) {
      results.push({
        opportunity: 'Obtain medical records and treatment documentation.',
        recordType: 'medical',
        confidence: 0.85,
      });
    }

    // Personnel records
    if (lower.includes('officer') && (lower.includes('prior') || lower.includes('complaint') || lower.includes('history') || lower.includes('multiple'))) {
      results.push({
        opportunity: 'Obtain officer personnel records and complaint history.',
        recordType: 'personnel',
        confidence: 0.78,
      });
    }

    // Financial records
    if (lower.includes('financial') || lower.includes('bank') || lower.includes('transaction')) {
      results.push({
        opportunity: 'Obtain relevant financial transaction records.',
        recordType: 'financial',
        confidence: 0.70,
      });
    }

    return results;
  }
}
