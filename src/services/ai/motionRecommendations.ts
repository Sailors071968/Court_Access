// ============================================
// Court Access — AI Motion Recommendations Service
// Returns empty results — real AI analysis will populate
// data only after evidence is uploaded and processed.
// ============================================

import type { MotionEntity } from '../../models/CaseModel';

export interface MotionRecommendationsRequest {
  caseId: string;
}

export interface MotionRecommendationsResponse {
  motions: MotionEntity[];
  generatedAt: string;
}

export async function getMotionRecommendations(
  _request: MotionRecommendationsRequest
): Promise<MotionRecommendationsResponse> {
  // No mock data — returns empty until real AI pipeline is wired
  return {
    motions: [],
    generatedAt: new Date().toISOString(),
  };
}
