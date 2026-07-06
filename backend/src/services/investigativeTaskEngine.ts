// ============================================================================
// Phase 276 — Investigative Task Engine
// Analyzes evidence to suggest investigative steps.
// All outputs framed as "Potential Investigative Opportunity"
// ============================================================================

export interface InvestigativeTask {
  id: string;
  caseId: string;
  evidenceSource: string;
  observation: string;
  suggestedOpportunity: string;
  category: 'INVESTIGATION';
  confidenceScore: number;
  timestamp: string;
}

export class InvestigativeTaskEngine {
  /**
   * Analyze evidence observations and generate investigative task suggestions.
   * Each suggestion is tied to a specific evidence source.
   */
  static generateTasks(caseId: string, evidenceObservations: { source: string; observation: string }[]): InvestigativeTask[] {
    const tasks: InvestigativeTask[] = [];

    for (const obs of evidenceObservations) {
      const suggestions = InvestigativeTaskEngine.matchPatterns(obs.observation);
      for (const suggestion of suggestions) {
        tasks.push({
          id: `inv-${caseId}-${tasks.length + 1}`,
          caseId,
          evidenceSource: obs.source,
          observation: obs.observation,
          suggestedOpportunity: suggestion.opportunity,
          category: 'INVESTIGATION',
          confidenceScore: suggestion.confidence,
          timestamp: new Date().toISOString(),
        });
      }
    }

    return tasks;
  }

  /**
   * Pattern matching for investigative opportunities.
   * Returns matched investigation suggestions based on observation text.
   */
  private static matchPatterns(observation: string): { opportunity: string; confidence: number }[] {
    const results: { opportunity: string; confidence: number }[] = [];
    const lower = observation.toLowerCase();

    // Discarded/recovered object pattern
    if (lower.includes('discard') || lower.includes('recovered object') || lower.includes('dropped')) {
      results.push({
        opportunity: 'Search for evidence logs or photographs documenting the recovered object.',
        confidence: 0.85,
      });
    }

    // Missing witness pattern
    if (lower.includes('witness') && (lower.includes('not interviewed') || lower.includes('unidentified') || lower.includes('additional'))) {
      results.push({
        opportunity: 'Identify and interview additional witnesses referenced in evidence.',
        confidence: 0.80,
      });
    }

    // Surveillance/camera pattern
    if (lower.includes('surveillance') || lower.includes('camera') || lower.includes('cctv') || lower.includes('security footage')) {
      results.push({
        opportunity: 'Obtain and review available surveillance recordings from the area.',
        confidence: 0.90,
      });
    }

    // Vehicle/pursuit pattern
    if (lower.includes('vehicle') || lower.includes('pursuit') || lower.includes('traffic stop')) {
      results.push({
        opportunity: 'Review dashcam footage and GPS/AVL data for involved vehicles.',
        confidence: 0.85,
      });
    }

    // Communication/phone pattern
    if (lower.includes('phone') || lower.includes('communication') || lower.includes('text') || lower.includes('call')) {
      results.push({
        opportunity: 'Obtain relevant telecommunications records referenced in evidence.',
        confidence: 0.75,
      });
    }

    // Timeline gap pattern
    if (lower.includes('gap') || lower.includes('unaccounted') || lower.includes('missing time')) {
      results.push({
        opportunity: 'Investigate timeline gaps by cross-referencing dispatch logs, bodycam timestamps, and radio traffic.',
        confidence: 0.88,
      });
    }

    // Generic fallback for any observation
    if (results.length === 0) {
      results.push({
        opportunity: 'Further investigate circumstances described in evidence source.',
        confidence: 0.50,
      });
    }

    return results;
  }
}
