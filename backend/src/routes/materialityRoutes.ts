// ============================================================================
// Phase C.5 — Materiality Scoring API Routes
// LOW | MEDIUM | HIGH | CRITICAL based on prosecution burden impact.
// NO legal conclusions. NO innocence/guilt claims.
// ============================================================================

import { FastifyInstance } from 'fastify';
import { analyzeChargeContradictions } from '../services/contradictionEngine.js';
import { scoreChargeContradictions } from '../services/materialityScoring.js';

export async function registerMaterialityRoutes(fastify: FastifyInstance) {
  // Score contradictions with materiality for a charge
  fastify.get('/api/materiality/charge/:chargeId', async (req, _reply) => {
    const { chargeId } = req.params as { chargeId: string };

    // First run contradiction analysis
    const contradictions = await analyzeChargeContradictions(chargeId);

    // Then score for materiality
    const result = await scoreChargeContradictions(chargeId, contradictions);
    return result;
  });

  // Materiality scoring validation
  fastify.get('/api/materiality/validation', async (_req, _reply) => {
    return {
      generatedAt: new Date().toISOString(),
      validation: {
        levels: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
        factors: [
          'prosecution_burden_impact',
          'witness_inconsistency',
          'timeline_incompatibility',
          'evidentiary_impossibility',
          'missing_corroboration',
        ],
        thresholds: {
          LOW: '0.00 - 0.24',
          MEDIUM: '0.25 - 0.44',
          HIGH: '0.45 - 0.69',
          CRITICAL: '0.70 - 1.00',
        },
        constraints: {
          noLegalConclusions: true,
          noInnocenceGuiltClaims: true,
          evidenceGroundedOnly: true,
          prosecutionBurdenFocused: true,
        },
      },
    };
  });
}
