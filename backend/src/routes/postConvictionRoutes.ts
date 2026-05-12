// ============================================================================
// Phase E.2 — Post-Conviction Intelligence Routes
// Organizes provable post-conviction issue structures. NEVER acts as habeas counsel.
// ============================================================================

import { FastifyInstance } from 'fastify';
import {
  runFullPostConvictionIntelligence,
  trackNewlyDiscoveredEvidence,
  assessActualInnocenceIndicators,
  trackIneffectiveAssistance,
  reassessBradyGiglio,
  reassessForensicReliability,
  analyzeWitnessRecantations,
  analyzeCumulativeConstitutionalError,
  reconstructPostConvictionTimeline,
  indexDnaForensicTestingIssues,
} from '../services/postConvictionIntelligenceService.js';
import prisma from '../lib/prisma.js';

export async function registerPostConvictionRoutes(fastify: FastifyInstance) {

  // POST /api/postconviction/analyze/:caseId — Full post-conviction analysis
  fastify.post('/api/postconviction/analyze/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const result = await runFullPostConvictionIntelligence(params.caseId);
      return reply.code(200).send(result);
    } catch (err) {
      fastify.log.error(err, 'Post-conviction analysis failed');
      return reply.code(500).send({ error: 'Analysis failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // POST /api/postconviction/evidence/:caseId
  fastify.post('/api/postconviction/evidence/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await trackNewlyDiscoveredEvidence(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });

  // GET /api/postconviction/evidence/:caseId
  fastify.get('/api/postconviction/evidence/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const entries = await prisma.newlyDiscoveredEvidence.findMany({ where: { caseId: params.caseId }, orderBy: { materialityAssessment: 'asc' } });
      return reply.code(200).send({ caseId: params.caseId, entries, total: entries.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // POST /api/postconviction/innocence/:caseId
  fastify.post('/api/postconviction/innocence/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await assessActualInnocenceIndicators(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });

  // GET /api/postconviction/innocence/:caseId
  fastify.get('/api/postconviction/innocence/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const indicators = await prisma.actualInnocenceIndicator.findMany({ where: { caseId: params.caseId }, orderBy: { strength: 'asc' } });
      return reply.code(200).send({ caseId: params.caseId, indicators, total: indicators.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // POST /api/postconviction/iac/:caseId
  fastify.post('/api/postconviction/iac/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await trackIneffectiveAssistance(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });

  // GET /api/postconviction/iac/:caseId
  fastify.get('/api/postconviction/iac/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const issues = await prisma.ineffectiveAssistanceIssue.findMany({ where: { caseId: params.caseId }, orderBy: { meritAssessment: 'asc' } });
      return reply.code(200).send({ caseId: params.caseId, issues, total: issues.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // POST /api/postconviction/brady/:caseId
  fastify.post('/api/postconviction/brady/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await reassessBradyGiglio(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });

  // GET /api/postconviction/brady/:caseId
  fastify.get('/api/postconviction/brady/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const reassessments = await prisma.bradyGiglioReassessment.findMany({ where: { caseId: params.caseId } });
      return reply.code(200).send({ caseId: params.caseId, reassessments, total: reassessments.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // POST /api/postconviction/forensic/:caseId
  fastify.post('/api/postconviction/forensic/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await reassessForensicReliability(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });

  // GET /api/postconviction/forensic/:caseId
  fastify.get('/api/postconviction/forensic/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const reassessments = await prisma.forensicReliabilityReassessment.findMany({ where: { caseId: params.caseId }, orderBy: { reliabilityScore: 'asc' } });
      return reply.code(200).send({ caseId: params.caseId, reassessments, total: reassessments.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // POST /api/postconviction/recantation/:caseId
  fastify.post('/api/postconviction/recantation/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await analyzeWitnessRecantations(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });

  // GET /api/postconviction/recantation/:caseId
  fastify.get('/api/postconviction/recantation/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const recantations = await prisma.witnessRecantation.findMany({ where: { caseId: params.caseId } });
      return reply.code(200).send({ caseId: params.caseId, recantations, total: recantations.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // POST /api/postconviction/cumulative/:caseId
  fastify.post('/api/postconviction/cumulative/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await analyzeCumulativeConstitutionalError(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });

  // GET /api/postconviction/cumulative/:caseId
  fastify.get('/api/postconviction/cumulative/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const analyses = await prisma.cumulativeConstitutionalError.findMany({ where: { caseId: params.caseId } });
      return reply.code(200).send({ caseId: params.caseId, analyses, total: analyses.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // POST /api/postconviction/timeline/:caseId
  fastify.post('/api/postconviction/timeline/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await reconstructPostConvictionTimeline(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });

  // GET /api/postconviction/timeline/:caseId
  fastify.get('/api/postconviction/timeline/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const events = await prisma.postConvictionTimeline.findMany({ where: { caseId: params.caseId }, orderBy: { eventDate: 'asc' } });
      return reply.code(200).send({ caseId: params.caseId, events, total: events.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // POST /api/postconviction/dna/:caseId
  fastify.post('/api/postconviction/dna/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await indexDnaForensicTestingIssues(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });

  // GET /api/postconviction/dna/:caseId
  fastify.get('/api/postconviction/dna/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const issues = await prisma.dnaForensicTestingIssue.findMany({ where: { caseId: params.caseId } });
      return reply.code(200).send({ caseId: params.caseId, issues, total: issues.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // GET /api/postconviction/validation
  fastify.get('/api/postconviction/validation', async (_req, reply) => {
    try {
      const [newEvidence, innocence, iac, brady, forensic, recantation, cumulative, timeline, dna] = await Promise.all([
        prisma.newlyDiscoveredEvidence.count(),
        prisma.actualInnocenceIndicator.count(),
        prisma.ineffectiveAssistanceIssue.count(),
        prisma.bradyGiglioReassessment.count(),
        prisma.forensicReliabilityReassessment.count(),
        prisma.witnessRecantation.count(),
        prisma.cumulativeConstitutionalError.count(),
        prisma.postConvictionTimeline.count(),
        prisma.dnaForensicTestingIssue.count(),
      ]);
      return reply.code(200).send({
        phase: 'E.2',
        name: 'Habeas / Post-Conviction Intelligence + Innocence Review Framework',
        generatedAt: new Date().toISOString(),
        totals: { newlyDiscoveredEvidence: newEvidence, actualInnocenceIndicators: innocence, ineffectiveAssistanceIssues: iac, bradyGiglioReassessments: brady, forensicReliabilityReassessments: forensic, witnessRecantations: recantation, cumulativeConstitutionalErrors: cumulative, postConvictionTimelineEvents: timeline, dnaForensicTestingIssues: dna },
        deterministicConstraints: {
          noFabricatedInnocenceClaims: true,
          noHallucinatedPoliceCorruption: true,
          noFakeBradyViolations: true,
          noInventedIneffectiveAssistance: true,
          noSpeculativeExoneration: true,
          noAIGeneratedHabeasOpinions: true,
          corePrinciple: 'CourtAccess organizes provable post-conviction issue structures. It does NOT act as habeas counsel.',
        },
      });
    } catch (err) { return reply.code(500).send({ error: 'Validation failed' }); }
  });
}
