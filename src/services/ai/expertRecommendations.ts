// ============================================
// Court Access — AI Expert Recommendations Service
// Returns empty results — real AI analysis will populate
// data only after evidence is uploaded and processed.
// ============================================

import type { ExpertEntity } from '../../models/CaseModel';

export interface ExpertRecommendationsRequest {
  caseId: string;
}

export interface ExpertRecommendationsResponse {
  experts: ExpertEntity[];
  generatedAt: string;
}

export async function getExpertRecommendations(
  _request: ExpertRecommendationsRequest
): Promise<ExpertRecommendationsResponse> {
  // No mock data — returns empty until real AI pipeline is wired
  return {
    experts: [],
    generatedAt: new Date().toISOString(),
  };
}
