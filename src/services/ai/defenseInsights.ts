// ============================================
// Court Access — AI Defense Insights Service (Phase 1)
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
  request: DefenseInsightsRequest
): Promise<DefenseInsightsResponse> {
  // Mock implementation — will be replaced with real API in Phase 6
  await new Promise((resolve) => setTimeout(resolve, 500));

  return {
    insights: [
      {
        id: '1',
        content: `Element 2 (intent) is the weakest point in prosecution case for case ${request.caseId}`,
        sourceChargeId: '1',
        sourceDocumentId: null,
      },
      {
        id: '2',
        content: 'Motion to suppress may eliminate key evidence for Element 1',
        sourceChargeId: '1',
        sourceDocumentId: '1',
      },
      {
        id: '3',
        content: 'Consider challenging nighttime enhancement if time cannot be proven',
        sourceChargeId: '1',
        sourceDocumentId: null,
      },
    ],
    generatedAt: '2024-01-22T00:00:00Z', // Deterministic — no Date.now()
  };
}
