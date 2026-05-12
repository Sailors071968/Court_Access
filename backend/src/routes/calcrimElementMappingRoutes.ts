// ============================================================================
// Phase D.2 — CALCRIM Element Mapping Routes
// Deterministic statement-to-element mapping with prosecutor theory organization.
// NO hallucination. NO LLM. NO generative reasoning.
// ============================================================================

import { FastifyInstance } from 'fastify';
import {
  mapStatement,
  mapDocumentStatements,
  getStatementMappings,
  getCaseNarratives,
  rebuildCaseMappings,
  getProsecutorTheory,
  generateMappingValidationReport,
} from '../services/calcrimElementMappingService.js';

export async function registerCalcrimElementMappingRoutes(fastify: FastifyInstance) {

  // POST /api/calcrim/map-statement
  // Map a single statement to CALCRIM elements
  fastify.post('/api/calcrim/map-statement', async (req, reply) => {
    const body = req.body as { statementId: string; caseId: string };

    if (!body.statementId || !body.caseId) {
      return reply.code(400).send({ error: 'Required: statementId, caseId' });
    }

    try {
      const result = await mapStatement(body.statementId, body.caseId);
      return reply.code(200).send(result);
    } catch (err) {
      fastify.log.error(err, 'Statement mapping failed');
      return reply.code(500).send({
        error: 'Statement mapping failed',
        details: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // POST /api/calcrim/map-document
  // Map all statements in a document to CALCRIM elements
  fastify.post('/api/calcrim/map-document', async (req, reply) => {
    const body = req.body as {
      documentId: string;
      caseId: string;
      limit?: number;
      offset?: number;
    };

    if (!body.documentId || !body.caseId) {
      return reply.code(400).send({ error: 'Required: documentId, caseId' });
    }

    try {
      const result = await mapDocumentStatements(body.documentId, body.caseId, {
        limit: body.limit,
        offset: body.offset,
      });
      return reply.code(200).send(result);
    } catch (err) {
      fastify.log.error(err, 'Document mapping failed');
      return reply.code(500).send({
        error: 'Document mapping failed',
        details: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // GET /api/calcrim/mappings/:statementId
  // Get all CALCRIM mappings for a specific statement
  fastify.get('/api/calcrim/mappings/:statementId', async (req, reply) => {
    const params = req.params as { statementId: string };

    if (!params.statementId) {
      return reply.code(400).send({ error: 'Required: statementId' });
    }

    try {
      const result = await getStatementMappings(params.statementId);
      return reply.code(200).send(result);
    } catch (err) {
      fastify.log.error(err, 'Failed to retrieve mappings');
      return reply.code(500).send({
        error: 'Failed to retrieve mappings',
        details: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // GET /api/calcrim/narratives/:caseId
  // Get narrative clusters for a case
  fastify.get('/api/calcrim/narratives/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };

    if (!params.caseId) {
      return reply.code(400).send({ error: 'Required: caseId' });
    }

    try {
      const result = await getCaseNarratives(params.caseId);
      return reply.code(200).send(result);
    } catch (err) {
      fastify.log.error(err, 'Failed to retrieve narratives');
      return reply.code(500).send({
        error: 'Failed to retrieve narratives',
        details: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // POST /api/calcrim/rebuild-mappings/:caseId
  // Delete and rebuild all mappings + clusters for a case
  fastify.post('/api/calcrim/rebuild-mappings/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };

    if (!params.caseId) {
      return reply.code(400).send({ error: 'Required: caseId' });
    }

    try {
      const result = await rebuildCaseMappings(params.caseId);
      return reply.code(200).send(result);
    } catch (err) {
      fastify.log.error(err, 'Mapping rebuild failed');
      return reply.code(500).send({
        error: 'Mapping rebuild failed',
        details: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // GET /api/calcrim/prosecutor-theory/:caseId
  // Get full prosecutor theory organization for a case
  fastify.get('/api/calcrim/prosecutor-theory/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };

    if (!params.caseId) {
      return reply.code(400).send({ error: 'Required: caseId' });
    }

    try {
      const result = await getProsecutorTheory(params.caseId);
      return reply.code(200).send(result);
    } catch (err) {
      fastify.log.error(err, 'Prosecutor theory retrieval failed');
      return reply.code(500).send({
        error: 'Prosecutor theory retrieval failed',
        details: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // GET /api/calcrim/mapping/validation
  // Live validation report for mapping metrics
  fastify.get('/api/calcrim/mapping/validation', async (_req, reply) => {
    try {
      const report = await generateMappingValidationReport();
      return reply.code(200).send(report);
    } catch (err) {
      fastify.log.error(err, 'Validation report generation failed');
      return reply.code(500).send({
        error: 'Validation report generation failed',
        details: err instanceof Error ? err.message : String(err),
      });
    }
  });
}
