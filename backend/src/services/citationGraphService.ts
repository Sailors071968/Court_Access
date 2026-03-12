// ============================================================================
// Phase 298 — Citation Graph Service
// Uses CourtListener citation data to identify:
//   - most influential precedents
//   - frequently cited cases
//   - recent appellate rulings
// Helps surface stronger precedent automatically.
// ============================================================================

import { CourtListenerService } from './courtListenerService.js';
import type { CaseLawPrecedent } from './legalResearchEngine.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InfluentialPrecedent {
  opinionId: number;
  caseName: string;
  citation: string;
  court: string;
  year: number;
  url: string;
  citedByCount: number;
  influenceScore: number;
}

export interface CitationAnalysis {
  targetOpinionId: number;
  targetCaseName: string;
  influentialPrecedents: InfluentialPrecedent[];
  recentAppellateRulings: InfluentialPrecedent[];
  citationDepthMap: Map<number, number>;
  analyzedAt: string;
}

// ---------------------------------------------------------------------------
// Citation Graph Service
// ---------------------------------------------------------------------------

export class CitationGraphService {
  /**
   * Analyze citation graph for a given opinion to find influential precedents.
   */
  static async analyzeCitations(opinionId: number): Promise<CitationAnalysis> {
    try {
      const graph = await CourtListenerService.getCitationGraph(opinionId);

      // Get details of the most-citing opinions
      const influentialPrecedents: InfluentialPrecedent[] = [];
      const depthMap = new Map<number, number>();

      // Track citation depth
      for (const cite of graph.cites) {
        depthMap.set(cite.citedOpinionId, cite.depth);
      }

      // Score opinions that this one cites (these are the precedents)
      for (const cite of graph.cites.slice(0, 10)) {
        try {
          const opinion = await CourtListenerService.getOpinionById(cite.citedOpinionId);
          // Get how many times this precedent is cited overall
          const precedentGraph = await CourtListenerService.getCitationGraph(cite.citedOpinionId);

          influentialPrecedents.push({
            opinionId: opinion.id,
            caseName: opinion.caseName,
            citation: opinion.citation,
            court: opinion.court,
            year: opinion.year,
            url: opinion.courtListenerUrl,
            citedByCount: precedentGraph.totalCitedBy,
            influenceScore: calculateInfluenceScore(precedentGraph.totalCitedBy, opinion.year),
          });
        } catch {
          // Skip opinions we can't retrieve
        }
      }

      // Sort by influence score
      influentialPrecedents.sort((a, b) => b.influenceScore - a.influenceScore);

      // Filter recent appellate rulings (last 5 years)
      const currentYear = new Date().getFullYear();
      const recentAppellateRulings = influentialPrecedents
        .filter(p => p.year >= currentYear - 5)
        .sort((a, b) => b.year - a.year);

      return {
        targetOpinionId: opinionId,
        targetCaseName: graph.caseName,
        influentialPrecedents: influentialPrecedents.slice(0, 10),
        recentAppellateRulings: recentAppellateRulings.slice(0, 5),
        citationDepthMap: depthMap,
        analyzedAt: new Date().toISOString(),
      };
    } catch (err) {
      console.error('[CitationGraphService] Analysis failed:', err);
      return {
        targetOpinionId: opinionId,
        targetCaseName: '',
        influentialPrecedents: [],
        recentAppellateRulings: [],
        citationDepthMap: new Map(),
        analyzedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * From a list of case law precedents, rank them by citation influence.
   */
  static async rankByInfluence(precedents: CaseLawPrecedent[]): Promise<CaseLawPrecedent[]> {
    const ranked: Array<CaseLawPrecedent & { citedByCount: number }> = [];

    for (const p of precedents) {
      try {
        const graph = await CourtListenerService.getCitationGraph(p.courtListenerOpinionId);
        ranked.push({ ...p, citedByCount: graph.totalCitedBy });
      } catch {
        ranked.push({ ...p, citedByCount: 0 });
      }
    }

    // Re-score with citation data
    return ranked
      .map(r => ({
        ...r,
        relevanceScore: Math.min(
          r.relevanceScore + (r.citedByCount > 100 ? 0.2 : r.citedByCount > 50 ? 0.15 : r.citedByCount > 10 ? 0.1 : 0.05),
          1.0,
        ),
      }))
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function calculateInfluenceScore(citedByCount: number, year: number): number {
  const currentYear = new Date().getFullYear();
  const age = currentYear - year;

  // Base score from citations
  let score = 0;
  if (citedByCount > 500) score = 0.95;
  else if (citedByCount > 200) score = 0.85;
  else if (citedByCount > 100) score = 0.75;
  else if (citedByCount > 50) score = 0.65;
  else if (citedByCount > 20) score = 0.55;
  else if (citedByCount > 5) score = 0.45;
  else score = 0.3;

  // Boost for recent cases
  if (age <= 3) score += 0.05;
  else if (age <= 10) score += 0.02;

  return Math.min(score, 1.0);
}
