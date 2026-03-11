// ============================================================================
// Phase 291.6 — Case Analysis Cache Service
// Prevents regeneration on every page load by caching analysis results.
// Cache invalidation is triggered by RegenerationBus events.
// ============================================================================

import type { CaseAnalysisOutput } from './evidenceIntelligenceIntegration';
import type { RecommendationGeneratorOutput } from './litigationRecommendationGenerator';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CachedAnalysis {
  caseId: string;
  analysis: CaseAnalysisOutput;
  cachedAt: string;
  expiresAt: string;
  analysisVersion: number;
  evidenceFingerprint: string;
}

export interface CachedRecommendations {
  caseId: string;
  recommendations: RecommendationGeneratorOutput;
  cachedAt: string;
  expiresAt: string;
  recommendationVersion: number;
  evidenceFingerprint: string;
}

export interface CacheStats {
  analysisEntries: number;
  recommendationEntries: number;
  hitCount: number;
  missCount: number;
  invalidationCount: number;
  hitRate: number;
}

// ---------------------------------------------------------------------------
// Cache Configuration
// ---------------------------------------------------------------------------

const ANALYSIS_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const RECOMMENDATION_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_CACHE_ENTRIES = 500;

// ---------------------------------------------------------------------------
// Case Analysis Cache
// ---------------------------------------------------------------------------

class CaseAnalysisCacheStore {
  private analysisCache = new Map<string, CachedAnalysis>();
  private recommendationCache = new Map<string, CachedRecommendations>();
  private hitCount = 0;
  private missCount = 0;
  private invalidationCount = 0;

  // -----------------------------------------------------------------------
  // Analysis Cache
  // -----------------------------------------------------------------------

  /**
   * Get cached analysis for a case. Returns null on cache miss.
   */
  getAnalysis(caseId: string): CaseAnalysisOutput | null {
    const cached = this.analysisCache.get(caseId);
    if (!cached) {
      this.missCount++;
      return null;
    }

    // Check TTL
    if (new Date(cached.expiresAt).getTime() < Date.now()) {
      this.analysisCache.delete(caseId);
      this.missCount++;
      return null;
    }

    this.hitCount++;
    return cached.analysis;
  }

  /**
   * Store analysis in cache
   */
  setAnalysis(caseId: string, analysis: CaseAnalysisOutput, evidenceFingerprint: string): void {
    // Enforce max cache size with LRU eviction
    if (this.analysisCache.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = this.analysisCache.keys().next().value;
      if (oldestKey !== undefined) {
        this.analysisCache.delete(oldestKey);
      }
    }

    this.analysisCache.set(caseId, {
      caseId,
      analysis,
      cachedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + ANALYSIS_CACHE_TTL_MS).toISOString(),
      analysisVersion: analysis.analysisVersion,
      evidenceFingerprint,
    });
  }

  // -----------------------------------------------------------------------
  // Recommendation Cache
  // -----------------------------------------------------------------------

  /**
   * Get cached recommendations for a case. Returns null on cache miss.
   */
  getRecommendations(caseId: string): RecommendationGeneratorOutput | null {
    const cached = this.recommendationCache.get(caseId);
    if (!cached) {
      this.missCount++;
      return null;
    }

    if (new Date(cached.expiresAt).getTime() < Date.now()) {
      this.recommendationCache.delete(caseId);
      this.missCount++;
      return null;
    }

    this.hitCount++;
    return cached.recommendations;
  }

  /**
   * Store recommendations in cache
   */
  setRecommendations(caseId: string, recommendations: RecommendationGeneratorOutput, evidenceFingerprint: string): void {
    if (this.recommendationCache.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = this.recommendationCache.keys().next().value;
      if (oldestKey !== undefined) {
        this.recommendationCache.delete(oldestKey);
      }
    }

    this.recommendationCache.set(caseId, {
      caseId,
      recommendations,
      cachedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + RECOMMENDATION_CACHE_TTL_MS).toISOString(),
      recommendationVersion: Date.now(),
      evidenceFingerprint,
    });
  }

  // -----------------------------------------------------------------------
  // Cache Invalidation
  // -----------------------------------------------------------------------

  /**
   * Invalidate all cached data for a specific case.
   * Called when evidence changes or is reprocessed.
   */
  invalidateCase(caseId: string): void {
    const hadAnalysis = this.analysisCache.delete(caseId);
    const hadRecs = this.recommendationCache.delete(caseId);
    if (hadAnalysis || hadRecs) {
      this.invalidationCount++;
      console.log(`[CaseAnalysisCache] Invalidated cache for case ${caseId}`);
    }
  }

  /**
   * Invalidate all cached analysis data.
   * Called when policy database is updated (affects all cases).
   */
  invalidateAll(): void {
    const totalEntries = this.analysisCache.size + this.recommendationCache.size;
    this.analysisCache.clear();
    this.recommendationCache.clear();
    this.invalidationCount += totalEntries;
    console.log(`[CaseAnalysisCache] Invalidated all ${totalEntries} cache entries`);
  }

  /**
   * Invalidate only recommendation cache for a specific case.
   * Used when policy changes affect recommendations but not analysis.
   */
  invalidateRecommendations(caseId: string): void {
    if (this.recommendationCache.delete(caseId)) {
      this.invalidationCount++;
      console.log(`[CaseAnalysisCache] Invalidated recommendation cache for case ${caseId}`);
    }
  }

  // -----------------------------------------------------------------------
  // Cache Metadata
  // -----------------------------------------------------------------------

  /**
   * Check if a case has valid cached analysis
   */
  hasValidAnalysis(caseId: string): boolean {
    const cached = this.analysisCache.get(caseId);
    if (!cached) return false;
    return new Date(cached.expiresAt).getTime() >= Date.now();
  }

  /**
   * Check if a case has valid cached recommendations
   */
  hasValidRecommendations(caseId: string): boolean {
    const cached = this.recommendationCache.get(caseId);
    if (!cached) return false;
    return new Date(cached.expiresAt).getTime() >= Date.now();
  }

  /**
   * Get the evidence fingerprint used for the cached analysis.
   * Callers compare this against the current evidence state to detect staleness.
   */
  getAnalysisFingerprint(caseId: string): string | null {
    return this.analysisCache.get(caseId)?.evidenceFingerprint ?? null;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.hitCount + this.missCount;
    return {
      analysisEntries: this.analysisCache.size,
      recommendationEntries: this.recommendationCache.size,
      hitCount: this.hitCount,
      missCount: this.missCount,
      invalidationCount: this.invalidationCount,
      hitRate: total > 0 ? this.hitCount / total : 0,
    };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.hitCount = 0;
    this.missCount = 0;
    this.invalidationCount = 0;
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const caseAnalysisCache = new CaseAnalysisCacheStore();

// ---------------------------------------------------------------------------
// Evidence Fingerprint Utility
// ---------------------------------------------------------------------------

/**
 * Compute a fingerprint of the current evidence state for a case.
 * Used to detect when evidence has changed and cache should be invalidated.
 */
export function computeEvidenceFingerprint(
  fileIds: string[],
  fileTimestamps: string[],
): string {
  const sorted = [...fileIds].sort();
  const combined = sorted.join(':') + '|' + [...fileTimestamps].sort().join(':');
  // Simple hash for fingerprint comparison
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `fp-${Math.abs(hash).toString(36)}`;
}
