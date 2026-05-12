// ============================================================================
// Phase C.3 — Element Mapping Engine API Routes
// Deterministic mapping of EvidenceStatements to CALCRIM elements.
// ============================================================================

import { FastifyInstance } from 'fastify';
import {
  mapStatementToCharge,
  mapCaseStatementsToCharge,
  getElementCoverage,
  generateMappingValidationReport,
} from '../services/elementMappingEngine.js';

export async function registerElementMappingRoutes(fastify: FastifyInstance) {
  // Map a single statement to a charge
  fastify.post('/api/element-mapping/map', async (req, reply) => {
    const body = req.body as { statementId: string; chargeId: string };
    if (!body.statementId || !body.chargeId) {
      return reply.code(400).send({ error: 'Required: statementId, chargeId' });
    }

    const result = await mapStatementToCharge(body.statementId, body.chargeId);
    return result;
  });

  // Map all statements for a case to a charge (batch)
  fastify.post('/api/element-mapping/map-case', async (req, reply) => {
    const body = req.body as { caseId: string; chargeId: string; tenantId: string };
    if (!body.caseId || !body.chargeId || !body.tenantId) {
      return reply.code(400).send({ error: 'Required: caseId, chargeId, tenantId' });
    }

    const result = await mapCaseStatementsToCharge(body.caseId, body.chargeId, body.tenantId);
    return result;
  });

  // Get element coverage for a charge
  fastify.get('/api/element-mapping/coverage/:chargeId', async (req, _reply) => {
    const { chargeId } = req.params as { chargeId: string };
    const result = await getElementCoverage(chargeId);
    return result;
  });

  // Get all links for a charge
  fastify.get('/api/element-mapping/links/:chargeId', async (req, _reply) => {
    const { chargeId } = req.params as { chargeId: string };

    const links = await (await import('../lib/prisma.js')).default.elementStatementLink.findMany({
      where: { chargeId },
      include: {
        statement: {
          select: {
            id: true,
            sourceDocumentId: true,
            page: true,
            lineStart: true,
            lineEnd: true,
            speaker: true,
            rawText: true,
            normalizedText: true,
            extractionConfidence: true,
          },
        },
        element: {
          select: {
            id: true,
            elementNumber: true,
            label: true,
            prosecutionBurden: true,
            isEssential: true,
          },
        },
      },
      orderBy: [{ confidence: 'desc' }],
    });

    return { chargeId, count: links.length, links };
  });

  // Validation report
  fastify.get('/api/element-mapping/validation', async (_req, _reply) => {
    const report = await generateMappingValidationReport();
    return report;
  });
}
