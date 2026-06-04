// ============================================================================
// Phase E.1 — Appellate Intelligence Routes
// Organizes provable appellate issue structures. NEVER functions as appellate counsel.
// ============================================================================

import { FastifyInstance } from 'fastify';
import {
  runFullAppellateIntelligence,
  trackErrorPreservation,
  buildObjectionHistory,
  modelHarmlessPrejudicialError,
  detectWaiverForfeiture,
  preserveConstitutionalClaims,
  analyzeRecordCompleteness,
  buildAppellateIssueIndex,
  trackInstructionalErrors,
  indexProsecutorialMisconduct,
} from '../services/appellateIntelligenceService.js';
import prisma from '../lib/prisma.js';

export async function registerAppellateIntelligenceRoutes(fastify: FastifyInstance) {

  // POST /api/appellate/analyze/:caseId — Full appellate intelligence analysis
  fastify.post('/api/appellate/analyze/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const result = await runFullAppellateIntelligence(params.caseId);
      return reply.code(200).send(result);
    } catch (err) {
      fastify.log.error(err, 'Appellate intelligence analysis failed');
      return reply.code(500).send({ error: 'Analysis failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // POST /api/appellate/preservation/:caseId
  fastify.post('/api/appellate/preservation/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await trackErrorPreservation(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });

  // GET /api/appellate/preservation/:caseId
  fastify.get('/api/appellate/preservation/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.errorPreservationRecord.findMany({ where: { caseId: params.caseId }, orderBy: { appellateRelevance: 'asc' } });
      return reply.code(200).send({ caseId: params.caseId, records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // POST /api/appellate/objections/:caseId
  fastify.post('/api/appellate/objections/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await buildObjectionHistory(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });

  // GET /api/appellate/objections/:caseId
  fastify.get('/api/appellate/objections/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const entries = await prisma.objectionHistoryEntry.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'asc' } });
      return reply.code(200).send({ caseId: params.caseId, entries, total: entries.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // POST /api/appellate/harmless/:caseId
  fastify.post('/api/appellate/harmless/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await modelHarmlessPrejudicialError(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });

  // GET /api/appellate/harmless/:caseId
  fastify.get('/api/appellate/harmless/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const analyses = await prisma.harmlessPrejudicialError.findMany({ where: { caseId: params.caseId }, orderBy: { prejudiceLevel: 'asc' } });
      return reply.code(200).send({ caseId: params.caseId, analyses, total: analyses.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // POST /api/appellate/waiver/:caseId
  fastify.post('/api/appellate/waiver/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await detectWaiverForfeiture(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });

  // GET /api/appellate/waiver/:caseId
  fastify.get('/api/appellate/waiver/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const issues = await prisma.waiverForfeitureIssue.findMany({ where: { caseId: params.caseId } });
      return reply.code(200).send({ caseId: params.caseId, issues, total: issues.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // POST /api/appellate/constitutional/:caseId
  fastify.post('/api/appellate/constitutional/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await preserveConstitutionalClaims(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });

  // GET /api/appellate/constitutional/:caseId
  fastify.get('/api/appellate/constitutional/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const claims = await prisma.constitutionalClaimPreservation.findMany({ where: { caseId: params.caseId }, orderBy: { appellateStrength: 'asc' } });
      return reply.code(200).send({ caseId: params.caseId, claims, total: claims.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // POST /api/appellate/completeness/:caseId
  fastify.post('/api/appellate/completeness/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await analyzeRecordCompleteness(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });

  // GET /api/appellate/completeness/:caseId
  fastify.get('/api/appellate/completeness/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const entries = await prisma.recordCompletenessEntry.findMany({ where: { caseId: params.caseId } });
      return reply.code(200).send({ caseId: params.caseId, entries, total: entries.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // POST /api/appellate/index/:caseId
  fastify.post('/api/appellate/index/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await buildAppellateIssueIndex(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });

  // GET /api/appellate/index/:caseId
  fastify.get('/api/appellate/index/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const issues = await prisma.appellateIssueIndex.findMany({ where: { caseId: params.caseId }, orderBy: { appellateRanking: 'asc' } });
      return reply.code(200).send({ caseId: params.caseId, issues, total: issues.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // POST /api/appellate/instructional/:caseId
  fastify.post('/api/appellate/instructional/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await trackInstructionalErrors(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });

  // GET /api/appellate/instructional/:caseId
  fastify.get('/api/appellate/instructional/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const errors = await prisma.instructionalError.findMany({ where: { caseId: params.caseId } });
      return reply.code(200).send({ caseId: params.caseId, errors, total: errors.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // POST /api/appellate/misconduct/:caseId
  fastify.post('/api/appellate/misconduct/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await indexProsecutorialMisconduct(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });

  // GET /api/appellate/misconduct/:caseId
  fastify.get('/api/appellate/misconduct/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const entries = await prisma.prosecutorialMisconductEntry.findMany({ where: { caseId: params.caseId }, orderBy: { prejudiceLevel: 'asc' } });
      return reply.code(200).send({ caseId: params.caseId, entries, total: entries.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // GET /api/appellate/validation — Live validation
  fastify.get('/api/appellate/validation', async (_req, reply) => {
    try {
      const [preservation, objections, harmless, waiver, constitutional, completeness, index, instructional, misconduct] = await Promise.all([
        prisma.errorPreservationRecord.count(),
        prisma.objectionHistoryEntry.count(),
        prisma.harmlessPrejudicialError.count(),
        prisma.waiverForfeitureIssue.count(),
        prisma.constitutionalClaimPreservation.count(),
        prisma.recordCompletenessEntry.count(),
        prisma.appellateIssueIndex.count(),
        prisma.instructionalError.count(),
        prisma.prosecutorialMisconductEntry.count(),
      ]);
      return reply.code(200).send({
        phase: 'E.1',
        name: 'Appellate Record Intelligence + Error Preservation Framework',
        generatedAt: new Date().toISOString(),
        totals: { errorPreservationRecords: preservation, objectionHistoryEntries: objections, harmlessPrejudicialErrors: harmless, waiverForfeitureIssues: waiver, constitutionalClaimPreservations: constitutional, recordCompletenessEntries: completeness, appellateIssueIndexes: index, instructionalErrors: instructional, prosecutorialMisconductEntries: misconduct },
        deterministicConstraints: {
          noInventedReversibleError: true,
          noFabricatedAppellateClaims: true,
          noHallucinatedMisconduct: true,
          noFakeConstitutionalAnalysis: true,
          noAIGeneratedAppellateOpinions: true,
          corePrinciple: 'CourtAccess organizes provable appellate issue structures. It does NOT function as appellate counsel.',
        },
      });
    } catch (err) { return reply.code(500).send({ error: 'Validation failed' }); }
  });
}
