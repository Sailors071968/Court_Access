// ============================================
// Court Access — AI Expert Recommendations Service
// ============================================

import type { Expert } from '../../types';

export interface ExpertRecommendationsRequest {
  caseId: string;
}

export interface ExpertRecommendationsResponse {
  experts: Expert[];
  generatedAt: string;
}

export async function getExpertRecommendations(
  request: ExpertRecommendationsRequest
): Promise<ExpertRecommendationsResponse> {
  // Mock implementation — will be replaced with real API
  await new Promise((resolve) => setTimeout(resolve, 500));

  void request;

  return {
    experts: [
      {
        id: '1',
        title: 'Forensic Toxicologist',
        recommendation: 'recommended',
        reason:
          "The victim's blood alcohol level was 0.18% at the time of the incident. A toxicologist can testify about impaired perception, memory formation, and reliability of eyewitness testimony under intoxication. This directly challenges the victim's account of events.",
        costRange: '$5,000 - $12,000',
      },
      {
        id: '2',
        title: 'Digital Forensics Expert',
        recommendation: 'recommended',
        reason:
          'Cell phone location data and timestamps are critical to establishing your alibi. An expert can authenticate records and explain technical details to the jury in understandable terms.',
        costRange: '$7,000 - $15,000',
      },
      {
        id: '3',
        title: 'Use of Force Expert',
        recommendation: 'consider',
        reason:
          'If self-defense is raised, an expert can testify about reasonable force standards and whether your response was proportionate to the perceived threat.',
        costRange: '$6,000 - $14,000',
      },
      {
        id: '4',
        title: 'Medical Expert (Injury Analysis)',
        recommendation: 'consider',
        reason:
          "The prosecution's injury photos may not accurately represent the severity claimed. A medical expert can provide objective analysis of injury patterns.",
        costRange: '$8,000 - $18,000',
      },
    ],
    generatedAt: new Date().toISOString(),
  };
}
