// ============================================
// Court Access — AI Defense Insights Service
// Returns empty results — real AI analysis will populate
// data only after evidence is uploaded and processed.
// ============================================

import type { DefenseInsight } from '../../models/IntelligenceModel';

export interface DefenseInsightsRequest {
  caseId: string;
  chargeId?: string;
}

export interface DefenseInsightsResponse {
  insights: DefenseInsight[];
  generatedAt: string;
}

export async function getDefenseInsights(
  _request: DefenseInsightsRequest
): Promise<DefenseInsightsResponse> {
  // No mock data — returns empty until real AI pipeline is wired
  return {
    insights: [],
    generatedAt: new Date().toISOString(),
  };
}
