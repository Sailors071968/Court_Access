// ============================================================================
// Phase D.1 — Evidence Segmentation Routes
// Deterministic extraction with exact citation preservation.
// NO hallucinated facts. NO generative summaries. NO semantic rewriting.
// ============================================================================

import { FastifyInstance } from 'fastify';
import {
  segmentDocument,
  getDocumentStatements,
  getStatementById,
  rebuildDocumentIndex,
  generateSegmentationValidationReport,
} from '../services/evidenceSegmentationService.js';

export async function registerEvidenceSegmentationRoutes(fastify: FastifyInstance) {

  // POST /api/evidence/segment
  // Segment a full document into normalized evidence statements
  fastify.post('/api/evidence/segment', async (req, reply) => {
    const body = req.body as {
      caseId: string;
      tenantId: string;
      fileName: string;
      fileType: string;
      documentType: string;
      fullText: string;
      evidenceId?: string;
    };

    if (!body.caseId || !body.tenantId || !body.fileName || !body.fileType || !body.documentType || !body.fullText) {
      return reply.code(400).send({
        error: 'Required: caseId, tenantId, fileName, fileType, documentType, fullText',
      });
    }

    const validTypes = ['police_report', 'transcript', 'bodycam', 'interrogation', 'dispatch', 'witness_statement'];
    if (!validTypes.includes(body.documentType)) {
      return reply.code(400).send({
        error: `Invalid documentType. Must be one of: ${validTypes.join(', ')}`,
      });
    }

    try {
      const result = await segmentDocument(
        body.caseId,
        body.tenantId,
        body.fileName,
        body.fileType,
        body.documentType as 'police_report' | 'transcript' | 'bodycam' | 'interrogation' | 'dispatch' | 'witness_statement',
        body.fullText,
        body.evidenceId,
      );
      return reply.code(200).send(result);
    } catch (err) {
      fastify.log.error(err, 'Evidence segmentation failed');
      return reply.code(500).send({
        error: 'Segmentation failed',
        details: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // POST /api/evidence/extract-statements
  // Alias for /segment with simplified interface
  fastify.post('/api/evidence/extract-statements', async (req, reply) => {
    const body = req.body as {
      caseId: string;
      tenantId: string;
      fileName?: string;
      fileType?: string;
      documentType: string;
      fullText: string;
      evidenceId?: string;
    };

    if (!body.caseId || !body.tenantId || !body.documentType || !body.fullText) {
      return reply.code(400).send({
        error: 'Required: caseId, tenantId, documentType, fullText',
      });
    }

    const validTypes = ['police_report', 'transcript', 'bodycam', 'interrogation', 'dispatch', 'witness_statement'];
    if (!validTypes.includes(body.documentType)) {
      return reply.code(400).send({
        error: `Invalid documentType. Must be one of: ${validTypes.join(', ')}`,
      });
    }

    try {
      const result = await segmentDocument(
        body.caseId,
        body.tenantId,
        body.fileName ?? 'unknown',
        body.fileType ?? 'text',
        body.documentType as 'police_report' | 'transcript' | 'bodycam' | 'interrogation' | 'dispatch' | 'witness_statement',
        body.fullText,
        body.evidenceId,
      );
      return reply.code(200).send(result);
    } catch (err) {
      fastify.log.error(err, 'Statement extraction failed');
      return reply.code(500).send({
        error: 'Extraction failed',
        details: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // GET /api/evidence/statements/:documentId
  // Retrieve all statements for a given document
  fastify.get('/api/evidence/statements/:documentId', async (req, reply) => {
    const params = req.params as { documentId: string };
    const query = req.query as {
      page?: string;
      speaker?: string;
      statementType?: string;
      minConfidence?: string;
      limit?: string;
      offset?: string;
    };

    if (!params.documentId) {
      return reply.code(400).send({ error: 'Required: documentId' });
    }

    try {
      const result = await getDocumentStatements(params.documentId, {
        page: query.page ? parseInt(query.page, 10) : undefined,
        speaker: query.speaker,
        statementType: query.statementType,
        minConfidence: query.minConfidence ? parseFloat(query.minConfidence) : undefined,
        limit: query.limit ? parseInt(query.limit, 10) : undefined,
        offset: query.offset ? parseInt(query.offset, 10) : undefined,
      });
      return reply.code(200).send(result);
    } catch (err) {
      fastify.log.error(err, 'Failed to retrieve statements');
      return reply.code(500).send({
        error: 'Failed to retrieve statements',
        details: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // GET /api/evidence/statement/:statementId
  // Retrieve a single statement with full citation details
  fastify.get('/api/evidence/statement/:statementId', async (req, reply) => {
    const params = req.params as { statementId: string };

    if (!params.statementId) {
      return reply.code(400).send({ error: 'Required: statementId' });
    }

    try {
      const result = await getStatementById(params.statementId);
      if (!result) {
        return reply.code(404).send({ error: 'Statement not found' });
      }
      return reply.code(200).send(result);
    } catch (err) {
      fastify.log.error(err, 'Failed to retrieve statement');
      return reply.code(500).send({
        error: 'Failed to retrieve statement',
        details: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // POST /api/evidence/rebuild-index
  // Re-segment an existing document (delete and recreate all statements)
  fastify.post('/api/evidence/rebuild-index', async (req, reply) => {
    const body = req.body as { documentId: string };

    if (!body.documentId) {
      return reply.code(400).send({ error: 'Required: documentId' });
    }

    try {
      const result = await rebuildDocumentIndex(body.documentId);
      return reply.code(200).send(result);
    } catch (err) {
      fastify.log.error(err, 'Index rebuild failed');
      return reply.code(500).send({
        error: 'Index rebuild failed',
        details: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // GET /api/evidence/segmentation/validation
  // Generate validation report with coverage metrics
  fastify.get('/api/evidence/segmentation/validation', async (_req, reply) => {
    try {
      const report = await generateSegmentationValidationReport();
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
