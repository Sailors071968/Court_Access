// ============================================================================
// Phase C.2 — Evidence Statement API Routes
// Deterministic extraction, no summarization, no LLM rewriting.
// ============================================================================

import { FastifyInstance } from 'fastify';
import {
  extractStatements,
  createStatementsFromSegments,
  getStatements,
  generateStatementValidationReport,
  segmentDocument,
} from '../services/evidenceStatementService.js';

export async function registerEvidenceStatementRoutes(fastify: FastifyInstance) {
  // Extract statements from full text (deterministic segmentation)
  fastify.post('/api/evidence-statements/extract', async (req, reply) => {
    const body = req.body as {
      caseId: string;
      tenantId: string;
      sourceDocumentId: string;
      fullText: string;
      extractionMethod?: string;
      startPage?: number;
    };

    if (!body.caseId || !body.tenantId || !body.sourceDocumentId || !body.fullText) {
      return reply.code(400).send({
        error: 'Required: caseId, tenantId, sourceDocumentId, fullText',
      });
    }

    const result = await extractStatements(
      body.caseId,
      body.tenantId,
      body.sourceDocumentId,
      body.fullText,
      body.extractionMethod,
      body.startPage,
    );

    return result;
  });

  // Create statements from pre-segmented input
  fastify.post('/api/evidence-statements/create', async (req, reply) => {
    const body = req.body as {
      caseId: string;
      tenantId: string;
      sourceDocumentId: string;
      segments: Array<{
        page?: number;
        lineStart?: number;
        lineEnd?: number;
        timestamp?: string;
        speaker?: string;
        rawText: string;
      }>;
      extractionMethod?: string;
    };

    if (!body.caseId || !body.tenantId || !body.sourceDocumentId || !body.segments?.length) {
      return reply.code(400).send({
        error: 'Required: caseId, tenantId, sourceDocumentId, segments (non-empty array)',
      });
    }

    const result = await createStatementsFromSegments({
      caseId: body.caseId,
      tenantId: body.tenantId,
      sourceDocumentId: body.sourceDocumentId,
      segments: body.segments,
      extractionMethod: body.extractionMethod,
    });

    return result;
  });

  // Preview segmentation without persisting (dry run)
  fastify.post('/api/evidence-statements/preview', async (req, reply) => {
    const body = req.body as { fullText: string; startPage?: number };
    if (!body.fullText) {
      return reply.code(400).send({ error: 'Required: fullText' });
    }

    const segments = segmentDocument(body.fullText, body.startPage);
    return {
      segmentCount: segments.length,
      segments: segments.map((s, i) => ({
        index: i,
        page: s.page ?? null,
        lineStart: s.lineStart ?? null,
        lineEnd: s.lineEnd ?? null,
        speaker: s.speaker ?? null,
        timestamp: s.timestamp ?? null,
        rawTextPreview: s.rawText.slice(0, 200) + (s.rawText.length > 200 ? '...' : ''),
        rawTextLength: s.rawText.length,
      })),
    };
  });

  // Get statements for a case
  fastify.get('/api/evidence-statements/:caseId', async (req, reply) => {
    const { caseId } = req.params as { caseId: string };
    const query = req.query as {
      tenantId?: string;
      sourceDocumentId?: string;
      speaker?: string;
      page?: string;
      minConfidence?: string;
    };

    if (!query.tenantId) {
      return reply.code(400).send({ error: 'Query parameter tenantId required' });
    }

    const result = await getStatements(caseId, query.tenantId, {
      sourceDocumentId: query.sourceDocumentId,
      speaker: query.speaker,
      page: query.page ? parseInt(query.page, 10) : undefined,
      minConfidence: query.minConfidence ? parseFloat(query.minConfidence) : undefined,
    });

    return result;
  });

  // Validation report
  fastify.get('/api/evidence-statements/validation', async (_req, _reply) => {
    const report = await generateStatementValidationReport();
    return report;
  });
}
