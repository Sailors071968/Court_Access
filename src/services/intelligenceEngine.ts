// ============================================
// Court Access — Intelligence Engine (Scaffold)
// Phase 1 will implement deterministic intelligence modeling.
// ============================================

import type { Case } from '../types';
import type { IntelligenceSnapshot } from '../models/IntelligenceModel';

export function buildIntelligenceSnapshot(input: { primaryCase: Case }): IntelligenceSnapshot {
  return {
    caseId: input.primaryCase.id,
    signals: [],
    notes: 'Placeholder scaffold (Phase 0/Pre-Phase 1)',
  };
}
