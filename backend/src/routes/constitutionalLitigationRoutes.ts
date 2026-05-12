// ============================================================================
// Phase G.1 — Constitutional Litigation Intelligence Routes
// Organizes provable constitutional issue structures.
// NEVER functions as constitutional litigation counsel.
// ============================================================================

import { FastifyInstance } from 'fastify';
import {
  runFullConstitutionalAnalysis,
  analyzeFourthAmendmentIssues,
  trackFifthAmendmentIssues,
  analyzeSixthAmendmentConfrontation,
  analyzeDueProcessIntegrity,
  categorizeStructuralErrors,
  mapSuppressionIssues,
  buildSearchSeizureChronology,
  trackCustodialInterrogations,
  indexConfrontationWitnesses,
  buildConstitutionalPreservationGraph,
} from '../services/constitutionalLitigationService.js';
import prisma from '../lib/prisma.js';

export async function registerConstitutionalLitigationRoutes(fastify: FastifyInstance) {

  // POST /api/constitutional/analyze/:caseId — Full analysis
  fastify.post('/api/constitutional/analyze/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const result = await runFullConstitutionalAnalysis(params.caseId);
      return reply.code(200).send(result);
    } catch (err) {
      fastify.log.error(err, 'Constitutional analysis failed');
      return reply.code(500).send({ error: 'Analysis failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // Fourth Amendment
  fastify.post('/api/constitutional/fourth/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await analyzeFourthAmendmentIssues(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/constitutional/fourth/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const issues = await prisma.fourthAmendmentIssue.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' } });
      return reply.code(200).send({ caseId: params.caseId, issues, total: issues.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Fifth Amendment
  fastify.post('/api/constitutional/fifth/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await trackFifthAmendmentIssues(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/constitutional/fifth/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const issues = await prisma.fifthAmendmentIssue.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' } });
      return reply.code(200).send({ caseId: params.caseId, issues, total: issues.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Sixth Amendment
  fastify.post('/api/constitutional/sixth/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await analyzeSixthAmendmentConfrontation(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/constitutional/sixth/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const confrontations = await prisma.sixthAmendmentConfrontation.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' } });
      return reply.code(200).send({ caseId: params.caseId, confrontations, total: confrontations.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Due Process
  fastify.post('/api/constitutional/dueprocess/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await analyzeDueProcessIntegrity(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/constitutional/dueprocess/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const issues = await prisma.dueProcessIntegrity.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' } });
      return reply.code(200).send({ caseId: params.caseId, issues, total: issues.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Structural Errors
  fastify.post('/api/constitutional/structural/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await categorizeStructuralErrors(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/constitutional/structural/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const errors = await prisma.structuralErrorCategory.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' } });
      return reply.code(200).send({ caseId: params.caseId, errors, total: errors.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Suppression
  fastify.post('/api/constitutional/suppression/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await mapSuppressionIssues(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/constitutional/suppression/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const issues = await prisma.suppressionIssueMap.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' } });
      return reply.code(200).send({ caseId: params.caseId, issues, total: issues.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Search/Seizure Chronology
  fastify.post('/api/constitutional/search-seizure/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await buildSearchSeizureChronology(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/constitutional/search-seizure/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const events = await prisma.searchSeizureChronology.findMany({ where: { caseId: params.caseId }, orderBy: { sequenceNumber: 'asc' } });
      return reply.code(200).send({ caseId: params.caseId, events, total: events.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Custodial Interrogation
  fastify.post('/api/constitutional/interrogation/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await trackCustodialInterrogations(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/constitutional/interrogation/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const interrogations = await prisma.custodialInterrogation.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' } });
      return reply.code(200).send({ caseId: params.caseId, interrogations, total: interrogations.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Confrontation Witness Index
  fastify.post('/api/constitutional/confrontation-index/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await indexConfrontationWitnesses(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/constitutional/confrontation-index/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const witnesses = await prisma.confrontationWitnessIndex.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' } });
      return reply.code(200).send({ caseId: params.caseId, witnesses, total: witnesses.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Preservation Graph
  fastify.post('/api/constitutional/preservation/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await buildConstitutionalPreservationGraph(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/constitutional/preservation/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const graphs = await prisma.constitutionalPreservationGraph.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' } });
      return reply.code(200).send({ caseId: params.caseId, graphs, total: graphs.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Validation
  fastify.get('/api/constitutional/validation', async (_req, reply) => {
    try {
      const [fourth, fifth, sixth, dueProcess, structural, suppression, searchSeizure, interrogation, confrontationIndex, preservation] = await Promise.all([
        prisma.fourthAmendmentIssue.count(),
        prisma.fifthAmendmentIssue.count(),
        prisma.sixthAmendmentConfrontation.count(),
        prisma.dueProcessIntegrity.count(),
        prisma.structuralErrorCategory.count(),
        prisma.suppressionIssueMap.count(),
        prisma.searchSeizureChronology.count(),
        prisma.custodialInterrogation.count(),
        prisma.confrontationWitnessIndex.count(),
        prisma.constitutionalPreservationGraph.count(),
      ]);
      return reply.code(200).send({
        phase: 'G.1',
        name: 'Constitutional Litigation Intelligence + Structural Rights Analysis',
        generatedAt: new Date().toISOString(),
        totals: {
          fourthAmendmentIssues: fourth, fifthAmendmentIssues: fifth,
          sixthAmendmentConfrontations: sixth, dueProcessIssues: dueProcess,
          structuralErrors: structural, suppressionIssues: suppression,
          searchSeizureEvents: searchSeizure, custodialInterrogations: interrogation,
          confrontationWitnesses: confrontationIndex, preservationGraphs: preservation,
        },
        constraints: {
          noFabricatedPoliceMisconduct: true,
          noInventedConstitutionalClaims: true,
          noHallucinatedSuppressionTheories: true,
          noFakeBradyClaims: true,
          noSpeculativeRightsViolations: true,
          noAIGeneratedConstitutionalOpinions: true,
          corePrinciple: 'CourtAccess organizes provable constitutional issue structures. It does NOT function as constitutional litigation counsel.',
        },
      });
    } catch (err) { return reply.code(500).send({ error: 'Validation failed' }); }
  });
}
