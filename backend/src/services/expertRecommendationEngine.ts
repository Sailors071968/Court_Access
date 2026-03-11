// ============================================================================
// Phase 280 — Expert Witness Recommendation Engine
// Suggests relevant expert types based on evidence observations.
// All outputs framed as "Potential Expert Consultation"
// ============================================================================

export interface ExpertRecommendation {
  id: string;
  caseId: string;
  evidenceSource: string;
  observation: string;
  suggestedOpportunity: string;
  expertType: 'use_of_force' | 'accident_reconstruction' | 'forensic_video' | 'forensic_audio' | 'medical' | 'digital_forensics' | 'police_practices' | 'other';
  category: 'EXPERT';
  confidenceScore: number;
  timestamp: string;
}

export class ExpertRecommendationEngine {
  /**
   * Analyze evidence for expert consultation needs.
   */
  static generateRecommendations(caseId: string, evidenceObservations: { source: string; observation: string }[]): ExpertRecommendation[] {
    const recommendations: ExpertRecommendation[] = [];

    for (const obs of evidenceObservations) {
      const matches = ExpertRecommendationEngine.detectExpertPatterns(obs.observation);
      for (const match of matches) {
        recommendations.push({
          id: `exp-${caseId}-${recommendations.length + 1}`,
          caseId,
          evidenceSource: obs.source,
          observation: obs.observation,
          suggestedOpportunity: match.opportunity,
          expertType: match.expertType,
          category: 'EXPERT',
          confidenceScore: match.confidence,
          timestamp: new Date().toISOString(),
        });
      }
    }

    return recommendations;
  }

  /**
   * Detect expert consultation patterns in observations.
   */
  private static detectExpertPatterns(observation: string): { opportunity: string; expertType: ExpertRecommendation['expertType']; confidence: number }[] {
    const results: { opportunity: string; expertType: ExpertRecommendation['expertType']; confidence: number }[] = [];
    const lower = observation.toLowerCase();

    // Use-of-force expert
    if (lower.includes('force') || lower.includes('restraint') || lower.includes('taser') || lower.includes('weapon') || lower.includes('chokehold') || lower.includes('takedown')) {
      results.push({
        opportunity: 'Consult police practices / use-of-force expert.',
        expertType: 'use_of_force',
        confidence: 0.90,
      });
    }

    // Accident reconstruction
    if (lower.includes('collision') || lower.includes('crash') || lower.includes('vehicle accident') || lower.includes('impact') || lower.includes('skid')) {
      results.push({
        opportunity: 'Consult accident reconstruction specialist.',
        expertType: 'accident_reconstruction',
        confidence: 0.88,
      });
    }

    // Forensic video analysis
    if (lower.includes('low-quality') || lower.includes('blurry') || lower.includes('dark footage') || lower.includes('enhance') || lower.includes('surveillance footage')) {
      results.push({
        opportunity: 'Consult video forensic analyst for enhancement and analysis.',
        expertType: 'forensic_video',
        confidence: 0.82,
      });
    }

    // Forensic audio analysis
    if (lower.includes('audio') || lower.includes('recording quality') || lower.includes('inaudible') || lower.includes('background noise')) {
      results.push({
        opportunity: 'Consult forensic audio analyst for enhancement and transcription verification.',
        expertType: 'forensic_audio',
        confidence: 0.78,
      });
    }

    // Medical expert
    if (lower.includes('injur') || lower.includes('medical') || lower.includes('wound') || lower.includes('trauma') || lower.includes('autopsy') || lower.includes('toxicolog')) {
      results.push({
        opportunity: 'Consult medical expert for injury analysis and causation.',
        expertType: 'medical',
        confidence: 0.85,
      });
    }

    // Digital forensics
    if (lower.includes('digital') || lower.includes('metadata') || lower.includes('timestamp') && lower.includes('altere') || lower.includes('file modif')) {
      results.push({
        opportunity: 'Consult digital forensics expert for metadata and authenticity analysis.',
        expertType: 'digital_forensics',
        confidence: 0.80,
      });
    }

    // General police practices
    if (lower.includes('policy') || lower.includes('procedure') || lower.includes('standard') || lower.includes('training')) {
      results.push({
        opportunity: 'Consult police practices expert regarding departmental standards.',
        expertType: 'police_practices',
        confidence: 0.75,
      });
    }

    return results;
  }
}
