// ============================================================================
// Phase 295 — Motion Precedent Linking
// Enhances motion recommendations by automatically retrieving:
//   - supporting case law
//   - relevant precedent
//   - citation references
// Links CourtListener case law to MotionRecommendationEngine outputs.
// ============================================================================

import { LegalResearchEngine, type CaseLawPrecedent } from './legalResearchEngine.js';
import type { MotionRecommendation } from './motionRecommendationEngine.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MotionWithPrecedent {
  recommendation: MotionRecommendation;
  supportingCaseLaw: CaseLawPrecedent[];
  searchQuery: string;
  searchedAt: string;
}

// ---------------------------------------------------------------------------
// Motion Precedent Linker
// ---------------------------------------------------------------------------

export class MotionPrecedentLinker {
  /**
   * Enrich a single motion recommendation with supporting case law.
   */
  static async linkPrecedent(
    recommendation: MotionRecommendation,
    jurisdiction?: string,
  ): Promise<MotionWithPrecedent> {
    const result = await LegalResearchEngine.searchMotionPrecedent(
      recommendation.motionType,
      recommendation.observation,
      jurisdiction,
    );

    return {
      recommendation,
      supportingCaseLaw: result.precedents,
      searchQuery: result.query,
      searchedAt: result.searchedAt,
    };
  }

  /**
   * Enrich all motion recommendations with case law.
   */
  static async linkAllPrecedents(
    recommendations: MotionRecommendation[],
    jurisdiction?: string,
  ): Promise<MotionWithPrecedent[]> {
    const results: MotionWithPrecedent[] = [];

    for (const rec of recommendations) {
      const linked = await MotionPrecedentLinker.linkPrecedent(rec, jurisdiction);
      results.push(linked);
    }

    return results;
  }
}
