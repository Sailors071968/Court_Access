// ============================================================================
// Phase 299 — Recommendation Strengthening
// Enhances litigation recommendations by attaching:
//   - supporting precedent
//   - case citation
//   - court
//   - year
// Connects LitigationRecommendationGenerator output to LegalResearchEngine.
// ============================================================================

import { LegalResearchEngine, type CaseLawPrecedent } from './legalResearchEngine.js';
import type { LitigationRecommendation, RecommendationType } from './litigationRecommendationSchema.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SupportingPrecedent {
  caseName: string;
  citation: string;
  court: string;
  year: number;
  holdingSummary: string;
  url: string;
  relevanceScore: number;
}

export interface StrengthenedRecommendation {
  recommendation: LitigationRecommendation;
  supportingPrecedents: SupportingPrecedent[];
  precedentSearchQuery: string;
  strengthenedAt: string;
}

export interface StrengthenedRecommendationSet {
  caseId: string;
  recommendations: StrengthenedRecommendation[];
  totalPrecedentsFound: number;
  strengthenedAt: string;
}

// ---------------------------------------------------------------------------
// Motion Type Mapping
// ---------------------------------------------------------------------------

function getMotionTypeFromRecommendation(rec: LitigationRecommendation): string | undefined {
  const lower = rec.suggestedOpportunity.toLowerCase();
  if (lower.includes('suppress')) return 'suppression';
  if (lower.includes('brady') || lower.includes('disclosure')) return 'brady';
  if (lower.includes('pitchess') || lower.includes('personnel')) return 'pitchess';
  if (lower.includes('discovery') || lower.includes('compel')) return 'discovery';
  if (lower.includes('dismiss')) return 'dismiss';
  return undefined;
}

// ---------------------------------------------------------------------------
// Recommendation Strengthener
// ---------------------------------------------------------------------------

export class RecommendationStrengthener {
  /**
   * Strengthen a single recommendation with supporting case law.
   */
  static async strengthenRecommendation(
    rec: LitigationRecommendation,
    jurisdiction?: string,
  ): Promise<StrengthenedRecommendation> {
    const motionType = getMotionTypeFromRecommendation(rec);

    const result = await LegalResearchEngine.searchForPrecedent(
      rec.observation,
      {
        motionType,
        jurisdiction,
        maxResults: 3,
      },
    );

    const supportingPrecedents: SupportingPrecedent[] = result.precedents.map(p => ({
      caseName: p.caseName,
      citation: p.citation,
      court: p.court,
      year: p.year,
      holdingSummary: p.holdingSummary,
      url: p.url,
      relevanceScore: p.relevanceScore,
    }));

    return {
      recommendation: rec,
      supportingPrecedents,
      precedentSearchQuery: result.query,
      strengthenedAt: new Date().toISOString(),
    };
  }

  /**
   * Strengthen all recommendations in a set.
   * Prioritizes MOTION and INVESTIGATION types.
   */
  static async strengthenAll(
    caseId: string,
    recommendations: LitigationRecommendation[],
    jurisdiction?: string,
  ): Promise<StrengthenedRecommendationSet> {
    // Priority order: MOTION first (most benefit from case law), then others
    const priorityOrder: RecommendationType[] = ['MOTION', 'INVESTIGATION', 'SUBPOENA', 'PUBLIC_RECORD', 'EXPERT'];

    const sorted = [...recommendations].sort((a, b) => {
      const aIdx = priorityOrder.indexOf(a.recommendationType);
      const bIdx = priorityOrder.indexOf(b.recommendationType);
      return aIdx - bIdx;
    });

    const strengthened: StrengthenedRecommendation[] = [];
    let totalPrecedents = 0;

    for (const rec of sorted) {
      const result = await RecommendationStrengthener.strengthenRecommendation(rec, jurisdiction);
      strengthened.push(result);
      totalPrecedents += result.supportingPrecedents.length;
    }

    return {
      caseId,
      recommendations: strengthened,
      totalPrecedentsFound: totalPrecedents,
      strengthenedAt: new Date().toISOString(),
    };
  }
}
