// ============================================
// Court Access — Intelligence Engine (Phase 1)
// Accepts CaseEntity, returns IntelligenceSnapshot.
// Deterministic — no probabilistic logic.
// ============================================

import type { CaseEntity, ChargeEntity } from '../models/CaseModel';
import type { IntelligenceSnapshot, ElementCoverageMap } from '../models/IntelligenceModel';

/**
 * Compute element coverage from an array of charges.
 * Pure function — deterministic output for identical input.
 */
export function computeElementCoverage(charges: ChargeEntity[]): ElementCoverageMap {
  const allElements = charges.flatMap((c) => c.elements);
  return {
    totalElements: allElements.length,
    established: allElements.filter((e) => e.status === 'established').length,
    disputed: allElements.filter((e) => e.status === 'disputed').length,
    weak: allElements.filter((e) => e.status === 'weak').length,
    unclear: allElements.filter((e) => e.status === 'unclear').length,
  };
}

/**
 * Build an IntelligenceSnapshot for a case.
 * Phase 1: returns deterministic placeholder with computed element coverage.
 * Phase 2+ will populate signals from structured analysis.
 */
export function buildIntelligenceSnapshot(input: {
  primaryCase: CaseEntity;
  charges: ChargeEntity[];
}): IntelligenceSnapshot {
  const elementCoverage = computeElementCoverage(input.charges);

  return {
    caseId: input.primaryCase.id,
    tenantId: input.primaryCase.tenantId,
    generatedAt: '2024-01-22T00:00:00Z', // Deterministic — no Date.now()
    signals: [],
    elementCoverage,
    notes: 'Phase 1 scaffold — signals will be populated in Phase 2',
  };
}
