// ============================================
// Court Access — Risk Scoring Engine (Phase 1)
// Accepts CaseEntity + ChargeEntity[], returns RiskScoreResult.
// Deterministic — score is null until Phase 2+ scoring contract.
// ============================================

import type { CaseEntity, ChargeEntity } from '../models/CaseModel';
import type { RiskScoreResult } from '../models/IntelligenceModel';

/**
 * Compute a deterministic risk score for a case.
 * Phase 1: returns null score with empty factors.
 * Phase 2+ will implement the scoring contract.
 */
export function computeRiskScore(_input: {
  primaryCase: CaseEntity;
  charges: ChargeEntity[];
}): RiskScoreResult {
  return {
    caseId: _input.primaryCase.id,
    score: null,
    maxScore: 100,
    rationale: 'Phase 1 scaffold — scoring contract will be defined in Phase 2',
    factors: [],
    generatedAt: '2024-01-22T00:00:00Z', // Deterministic — no Date.now()
  };
}
