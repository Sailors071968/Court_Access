// ============================================================================
// Phase 294 — Legal Research Engine
// Automatically searches CourtListener when:
//   - litigation recommendations are generated
//   - motion opportunities are identified
//   - policy inconsistencies are detected
// Extracts: case name, court, year, holding summary, citation, URL
// ============================================================================

import { CourtListenerService, type CourtListenerOpinion } from './courtListenerService.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CaseLawPrecedent {
  id: string;
  caseName: string;
  court: string;
  year: number;
  citation: string;
  holdingSummary: string;
  url: string;
  courtListenerOpinionId: number;
  relevanceScore: number;
  matchedQuery: string;
  category: 'suppression' | 'brady' | 'pitchess' | 'use_of_force' | 'pursuit' | 'miranda' | 'discovery' | 'general';
}

export interface LegalResearchResult {
  query: string;
  precedents: CaseLawPrecedent[];
  totalAvailable: number;
  searchedAt: string;
}

// ---------------------------------------------------------------------------
// Query Builder
// ---------------------------------------------------------------------------

/**
 * Build a targeted legal search query from an observation and context.
 */
function buildSearchQuery(observation: string, context?: {
  motionType?: string;
  jurisdiction?: string;
  charges?: string[];
}): string {
  const lower = observation.toLowerCase();
  const parts: string[] = [];

  // Detect motion-relevant keywords and add legal terms
  if (lower.includes('search') && (lower.includes('probable cause') || lower.includes('without warrant'))) {
    parts.push('vehicle search probable cause suppression');
  } else if (lower.includes('search') || lower.includes('suppression')) {
    parts.push('search seizure suppression motion');
  }

  if (lower.includes('miranda') || lower.includes('rights') || lower.includes('interrogat')) {
    parts.push('Miranda warning suppression statements');
  }

  if (lower.includes('force') || lower.includes('restrain') || lower.includes('taser')) {
    parts.push('excessive force qualified immunity');
  }

  if (lower.includes('pursuit') || lower.includes('chase')) {
    parts.push('police pursuit liability');
  }

  if (lower.includes('brady') || lower.includes('not disclosed') || lower.includes('withheld')) {
    parts.push('Brady disclosure obligation');
  }

  if (lower.includes('pitchess') || lower.includes('personnel record') || lower.includes('prior complaint')) {
    parts.push('Pitchess motion officer records');
  }

  if (lower.includes('discovery') || lower.includes('redacted') || lower.includes('incomplete')) {
    parts.push('motion to compel discovery');
  }

  // Add motion type context
  if (context?.motionType) {
    const motionMap: Record<string, string> = {
      suppression: 'motion to suppress evidence',
      brady: 'Brady material disclosure',
      pitchess: 'Pitchess motion officer personnel',
      discovery: 'motion to compel production',
      dismiss: 'motion to dismiss charges',
    };
    const mapped = motionMap[context.motionType];
    if (mapped && !parts.some(p => p.includes(context.motionType!))) {
      parts.push(mapped);
    }
  }

  // Add jurisdiction
  if (context?.jurisdiction) {
    parts.push(context.jurisdiction);
  }

  // Fallback: extract key legal phrases from observation
  if (parts.length === 0) {
    // Extract first meaningful phrase
    const phrases = observation
      .replace(/[^a-zA-Z\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3)
      .slice(0, 6)
      .join(' ');
    parts.push(phrases || 'criminal defense evidence');
  }

  return parts.join(' ').trim();
}

/**
 * Categorize a precedent based on the search context.
 */
function categorizePrecedent(query: string, opinion: CourtListenerOpinion): CaseLawPrecedent['category'] {
  const lower = (query + ' ' + opinion.caseName + ' ' + opinion.holdingSummary).toLowerCase();

  if (lower.includes('suppress')) return 'suppression';
  if (lower.includes('brady')) return 'brady';
  if (lower.includes('pitchess')) return 'pitchess';
  if (lower.includes('force') || lower.includes('restrain')) return 'use_of_force';
  if (lower.includes('pursuit') || lower.includes('chase')) return 'pursuit';
  if (lower.includes('miranda')) return 'miranda';
  if (lower.includes('discovery') || lower.includes('compel')) return 'discovery';
  return 'general';
}

/**
 * Calculate a relevance score based on opinion metadata.
 */
function calculateRelevance(opinion: CourtListenerOpinion, jurisdiction?: string): number {
  let score = 0.5; // base

  // Prefer cases with citations
  if (opinion.citation) score += 0.1;

  // Prefer recent cases
  const currentYear = new Date().getFullYear();
  const age = currentYear - opinion.year;
  if (age <= 5) score += 0.15;
  else if (age <= 15) score += 0.1;
  else if (age <= 30) score += 0.05;

  // Prefer same jurisdiction
  if (jurisdiction && opinion.courtId.toLowerCase().includes(jurisdiction.toLowerCase())) {
    score += 0.15;
  }

  // Prefer published/precedential opinions
  const status = opinion.precedentialStatus.toLowerCase();
  if (status.includes('published') || status.includes('precedential')) {
    score += 0.1;
  }

  return Math.min(score, 1.0);
}

// ---------------------------------------------------------------------------
// Legal Research Engine
// ---------------------------------------------------------------------------

export class LegalResearchEngine {
  /**
   * Search CourtListener for relevant case law based on an observation.
   */
  static async searchForPrecedent(
    observation: string,
    options?: {
      motionType?: string;
      jurisdiction?: string;
      charges?: string[];
      maxResults?: number;
    },
  ): Promise<LegalResearchResult> {
    const query = buildSearchQuery(observation, options);
    const maxResults = options?.maxResults ?? 5;

    try {
      const searchResult = await CourtListenerService.searchOpinions(query, {
        court: options?.jurisdiction === 'California' ? 'cal' : undefined,
        pageSize: maxResults,
      });

      const precedents: CaseLawPrecedent[] = searchResult.results
        .filter(op => op.caseName && op.caseName !== 'Unknown Case')
        .map((op, idx) => ({
          id: `cl-${op.id}`,
          caseName: op.caseName,
          court: op.court,
          year: op.year,
          citation: op.citation,
          holdingSummary: op.holdingSummary,
          url: op.courtListenerUrl,
          courtListenerOpinionId: op.id,
          relevanceScore: calculateRelevance(op, options?.jurisdiction),
          matchedQuery: query,
          category: categorizePrecedent(query, op),
        }))
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, maxResults);

      return {
        query,
        precedents,
        totalAvailable: searchResult.count,
        searchedAt: new Date().toISOString(),
      };
    } catch (err) {
      console.error('[LegalResearchEngine] Search failed:', err);
      return {
        query,
        precedents: [],
        totalAvailable: 0,
        searchedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Search for precedent related to a specific motion type.
   */
  static async searchMotionPrecedent(
    motionType: string,
    evidenceObservation: string,
    jurisdiction?: string,
  ): Promise<LegalResearchResult> {
    return LegalResearchEngine.searchForPrecedent(evidenceObservation, {
      motionType,
      jurisdiction,
      maxResults: 5,
    });
  }

  /**
   * Search for precedent related to policy inconsistencies.
   */
  static async searchPolicyPrecedent(
    policyIssue: string,
    jurisdiction?: string,
  ): Promise<LegalResearchResult> {
    const query = `${policyIssue} police policy violation department regulation`;
    return LegalResearchEngine.searchForPrecedent(query, {
      jurisdiction,
      maxResults: 3,
    });
  }

  /**
   * Batch search: run multiple queries and merge results.
   */
  static async batchSearch(
    queries: Array<{ observation: string; motionType?: string }>,
    jurisdiction?: string,
  ): Promise<CaseLawPrecedent[]> {
    const allPrecedents: CaseLawPrecedent[] = [];
    const seenIds = new Set<string>();

    for (const q of queries) {
      const result = await LegalResearchEngine.searchForPrecedent(q.observation, {
        motionType: q.motionType,
        jurisdiction,
        maxResults: 3,
      });

      for (const p of result.precedents) {
        if (!seenIds.has(p.id)) {
          seenIds.add(p.id);
          allPrecedents.push(p);
        }
      }
    }

    return allPrecedents.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }
}
