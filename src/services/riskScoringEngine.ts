// ============================================
// Court Access — Risk Scoring Engine (Scaffold)
// Placeholder only. Phase 1 will define the deterministic contract.
// ============================================

import type { Case } from '../types';

export interface RiskScoreResult {
  score: null;
  rationale: string;
}

export function computeRiskScore(_input: { primaryCase: Case }): RiskScoreResult {
  return {
    score: null,
    rationale: 'Placeholder scaffold (no scoring in Phase 0)',
  };
}
