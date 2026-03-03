// ============================================
// Court Access — AI Motion Recommendations Service (Phase 1)
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
  request: MotionRecommendationsRequest
): Promise<MotionRecommendationsResponse> {
  // Mock implementation — will be replaced with real API in Phase 6
  await new Promise((resolve) => setTimeout(resolve, 500));

  void request;

  return {
    motions: [
      {
        id: '1',
        title: 'Motion to Suppress Evidence',
        code: 'PC 1538.5',
        priority: 'high',
        description:
          'The search of your vehicle may have been conducted without proper consent or warrant. Filing this motion could exclude the physical evidence found, which is central to the prosecution\'s case.',
      },
      {
        id: '2',
        title: 'Motion to Dismiss',
        code: 'PC 995',
        priority: 'medium',
        description:
          'The preliminary hearing transcript shows insufficient evidence to establish probable cause for Count 2. This motion challenges whether the case should proceed.',
      },
      {
        id: '3',
        title: 'Motion for Discovery',
        code: 'PC 1054',
        priority: 'high',
        description:
          'The prosecution has not provided body camera footage referenced in the police report. This evidence may contain exculpatory information.',
      },
      {
        id: '4',
        title: 'Motion in Limine',
        code: null,
        priority: 'medium',
        description:
          'To exclude prior bad acts evidence that would unfairly prejudice the jury.',
      },
    ],
    generatedAt: '2024-01-22T00:00:00Z', // Deterministic — no Date.now()
  };
}
