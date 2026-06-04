// ============================================================================
// Phase C.4 — Element-Scoped Contradiction Engine API Routes
// Scoped to: same charge, same element, same factual domain.
// ============================================================================

import { FastifyInstance } from 'fastify';
import {
  analyzeElementContradictions,
  analyzeChargeContradictions,
  generateContradictionValidationReport,
} from '../services/contradictionEngine.js';

export async function registerContradictionRoutes(fastify: FastifyInstance) {
  // Analyze contradictions for a single element within a charge
  fastify.post('/api/contradictions/analyze-element', async (req, reply) => {
    const body = req.body as { chargeId: string; elementId: string };
    if (!body.chargeId || !body.elementId) {
      return reply.code(400).send({ error: 'Required: chargeId, elementId' });
    }

    const result = await analyzeElementContradictions(body.chargeId, body.elementId);
    return result;
  });

  // Analyze all contradictions for a charge (all elements)
  fastify.get('/api/contradictions/charge/:chargeId', async (req, _reply) => {
    const { chargeId } = req.params as { chargeId: string };
    const result = await analyzeChargeContradictions(chargeId);
    return result;
  });

  // Validation report
  fastify.get('/api/contradictions/validation', async (_req, _reply) => {
    const report = await generateContradictionValidationReport();
    return report;
  });
}
