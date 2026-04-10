// ============================================================================
// Phase 291.7 — Case Analysis Data Service (Frontend)
// Provides data hooks for CaseAnalysisSection and LitigationIntelligencePanel.
// Connects frontend components to the backend evidence processing pipeline.
// All sample data removed — fetches from backend API.
// ============================================================================

// ---------------------------------------------------------------------------
// Types (mirror backend output types for frontend consumption)
// ---------------------------------------------------------------------------

export interface EvidenceSummaryItem {
  type: string;
  count: number;
  iconType: string;
}

export interface TimelineEvent {
  id: string;
  timestamp: string;
  source: string;
  sourceFileId: string;
  description: string;
  sourceType: 'bodycam' | 'dispatch' | '911' | 'officer_report' | 'witness';
  confidence: number;
}

export interface CrossDocComparison {
  id: string;
  sourceA: string;
  sourceAFileId: string;
  sourceB: string;
  sourceBFileId: string;
  observation: string;
  severity: 'high' | 'medium' | 'low';
}

export interface OfficerAction {
  id: string;
  officerId: string;
  actionType: string;
  timestamp: string;
  evidenceSource: string;
  evidenceFileId: string;
  confidence: number;
}

export interface PolicyComparison {
  id: string;
  officerAction: string;
  policyReference: string;
  observation: string;
  evidenceFileId: string;
  findingId: string;
  confidence: number;
}

export interface Inconsistency {
  id: string;
  type: string;
  description: string;
  sources: Array<{ label: string; fileId: string; timestamp?: string; paragraph?: string }>;
  severity: 'high' | 'medium' | 'low';
}

export interface RecommendedExhibit {
  id: string;
  title: string;
  type: string;
  linkedEvidence: Array<{ label: string; fileId: string }>;
}

export interface CaseAnalysisData {
  caseId: string;
  generatedAt: string;
  analysisVersion: number;
  evidenceSummary: EvidenceSummaryItem[];
  timelineEvents: TimelineEvent[];
  crossDocComparisons: CrossDocComparison[];
  officerActions: OfficerAction[];
  policyComparisons: PolicyComparison[];
  inconsistencies: Inconsistency[];
  recommendedExhibits: RecommendedExhibit[];
  pipelineStatus: PipelineStageStatus[];
  cached: boolean;
}

export interface PipelineStageStatus {
  stage: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  durationMs?: number;
}

// ---------------------------------------------------------------------------
// Recommendation Types (for LitigationIntelligencePanel)
// ---------------------------------------------------------------------------

export type RecommendationType = 'INVESTIGATION' | 'MOTION' | 'SUBPOENA' | 'PUBLIC_RECORD' | 'EXPERT';
export type FeedbackStatus = 'relevant' | 'already_handled' | 'not_relevant' | null;

export interface EvidenceCitation {
  evidenceFileId: string;
  evidenceFileName: string;
  timestamp?: string;
  documentParagraph?: string;
  pageNumber?: number;
}

export interface Recommendation {
  id: string;
  type: RecommendationType;
  observation: string;
  suggestedOpportunity: string;
  evidenceSource: string;
  evidenceLinks: EvidenceCitation[];
  confidenceScore: number;
  feedbackStatus: FeedbackStatus;
  duplicateCount?: number;
  deduplicationKey?: string;
}

export interface RecommendationData {
  caseId: string;
  generatedAt: string;
  disclaimer: string;
  recommendations: Recommendation[];
  duplicatesRemoved: number;
  totalByType: Record<RecommendationType, number>;
  cached: boolean;
}


// ---------------------------------------------------------------------------
// Data Service API
// ---------------------------------------------------------------------------

// In-memory cache (frontend layer — complements backend CaseAnalysisCacheService)
const analysisCache = new Map<string, { data: CaseAnalysisData; fetchedAt: number }>();
const recommendationCache = new Map<string, { data: RecommendationData; fetchedAt: number }>();
const FRONTEND_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch case analysis data for a given case ID.
 * Uses frontend cache first, then falls back to API.
 */
export async function fetchCaseAnalysis(caseId: string): Promise<CaseAnalysisData> {
  // Check frontend cache
  const cached = analysisCache.get(caseId);
  if (cached && Date.now() - cached.fetchedAt < FRONTEND_CACHE_TTL_MS) {
    return { ...cached.data, cached: true };
  }

  const res = await fetch(`/api/cases/${caseId}/analysis`);
  if (!res.ok) {
    throw new Error(`Failed to fetch case analysis: ${res.status}`);
  }
  const data: CaseAnalysisData = await res.json();

  // Store in frontend cache
  analysisCache.set(caseId, { data, fetchedAt: Date.now() });

  return data;
}

/**
 * Fetch litigation recommendations for a given case ID.
 * Uses frontend cache first, then falls back to API.
 */
export async function fetchRecommendations(caseId: string): Promise<RecommendationData> {
  // Check frontend cache
  const cached = recommendationCache.get(caseId);
  if (cached && Date.now() - cached.fetchedAt < FRONTEND_CACHE_TTL_MS) {
    return { ...cached.data, cached: true };
  }

  const res = await fetch(`/api/cases/${caseId}/recommendations`);
  if (!res.ok) {
    throw new Error(`Failed to fetch recommendations: ${res.status}`);
  }
  const data: RecommendationData = await res.json();

  // Store in frontend cache
  recommendationCache.set(caseId, { data, fetchedAt: Date.now() });

  return data;
}

/**
 * Invalidate frontend cache for a case.
 * Called when evidence changes or user requests refresh.
 */
export function invalidateCaseCache(caseId: string): void {
  analysisCache.delete(caseId);
  recommendationCache.delete(caseId);
}

/**
 * Submit attorney feedback for a recommendation.
 */
export async function submitFeedback(
  caseId: string,
  recommendationId: string,
  feedback: 'relevant' | 'already_handled' | 'not_relevant',
): Promise<void> {
  await fetch(`/api/cases/${caseId}/recommendations/${recommendationId}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ feedback }),
  });
}

/**
 * Trigger regeneration of case analysis.
 */
export async function triggerRegeneration(caseId: string, reason: string): Promise<void> {
  invalidateCaseCache(caseId);
  await fetch(`/api/cases/${caseId}/analysis/regenerate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
}
