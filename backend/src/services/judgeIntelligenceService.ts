// ============================================================================
// Phase 297 — Judge Intelligence Service
// If CourtListener returns judge information, display:
//   - judge name
//   - prior rulings
//   - frequently cited cases
// This information appears in the Litigation Strategy view.
// ============================================================================

import { CourtListenerService } from './courtListenerService.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface JudgeIntelligenceResult {
  judgeName: string;
  court: string;
  totalRulings: number;
  recentRulings: Array<{
    caseName: string;
    dateFiled: string;
    citation: string;
    url: string;
    year: number;
  }>;
  motionStats: {
    suppressionRulings: number;
    bradyRulings: number;
    discoveryRulings: number;
    totalMotionRulings: number;
  };
  frequentlyCitedCases: Array<{
    caseName: string;
    citation: string;
    url: string;
    citationCount: number;
  }>;
  searchedAt: string;
}

// ---------------------------------------------------------------------------
// Judge Intelligence Service
// ---------------------------------------------------------------------------

export class JudgeIntelligenceService {
  /**
   * Look up judge rulings and patterns from CourtListener.
   */
  static async getJudgeProfile(
    judgeName: string,
    options?: { court?: string },
  ): Promise<JudgeIntelligenceResult> {
    try {
      const searchResult = await CourtListenerService.searchJudgeRulings(judgeName, {
        court: options?.court,
        pageSize: 20,
      });

      const rulings = searchResult.results;

      // Analyze motion-related rulings
      const motionStats = {
        suppressionRulings: 0,
        bradyRulings: 0,
        discoveryRulings: 0,
        totalMotionRulings: 0,
      };

      for (const ruling of rulings) {
        const lower = (ruling.caseName + ' ' + ruling.holdingSummary).toLowerCase();
        let matchedAny = false;
        if (lower.includes('suppress') || lower.includes('motion to suppress')) {
          motionStats.suppressionRulings++;
          matchedAny = true;
        }
        if (lower.includes('brady') || lower.includes('disclosure')) {
          motionStats.bradyRulings++;
          matchedAny = true;
        }
        if (lower.includes('discovery') || lower.includes('compel')) {
          motionStats.discoveryRulings++;
          matchedAny = true;
        }
        if (matchedAny) {
          motionStats.totalMotionRulings++;
        }
      }

      // Build recent rulings list
      const recentRulings = rulings
        .filter(r => r.dateFiled)
        .sort((a, b) => b.dateFiled.localeCompare(a.dateFiled))
        .slice(0, 10)
        .map(r => ({
          caseName: r.caseName,
          dateFiled: r.dateFiled,
          citation: r.citation,
          url: r.courtListenerUrl,
          year: r.year,
        }));

      // Build frequently cited cases (by looking at citations in results)
      const citationCounts = new Map<string, { caseName: string; citation: string; url: string; count: number }>();
      for (const ruling of rulings) {
        if (ruling.citation) {
          const key = ruling.citation;
          const existing = citationCounts.get(key);
          if (existing) {
            existing.count++;
          } else {
            citationCounts.set(key, {
              caseName: ruling.caseName,
              citation: ruling.citation,
              url: ruling.courtListenerUrl,
              count: 1,
            });
          }
        }
      }

      const frequentlyCitedCases = Array.from(citationCounts.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        .map(c => ({
          caseName: c.caseName,
          citation: c.citation,
          url: c.url,
          citationCount: c.count,
        }));

      return {
        judgeName,
        court: options?.court || '',
        totalRulings: searchResult.count,
        recentRulings,
        motionStats,
        frequentlyCitedCases,
        searchedAt: new Date().toISOString(),
      };
    } catch (err) {
      console.error('[JudgeIntelligenceService] Failed to get judge profile:', err);
      return {
        judgeName,
        court: options?.court || '',
        totalRulings: 0,
        recentRulings: [],
        motionStats: {
          suppressionRulings: 0,
          bradyRulings: 0,
          discoveryRulings: 0,
          totalMotionRulings: 0,
        },
        frequentlyCitedCases: [],
        searchedAt: new Date().toISOString(),
      };
    }
  }
}
