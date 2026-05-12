// ============================================================================
// Phase K.2 — Expert Defensibility Routes
// Independent scrutiny — no manufactured authority claims.
// ============================================================================

import { FastifyInstance } from 'fastify';
import {
  runFullExpertDefensibilityAnalysis,
  initiateExpertReview,
  simulateAdversarialChallenges,
  scoreLitigationDefensibility,
  conductExternalReproducibilityReview,
  reconstructAuditTrace,
  trackEvidentiaryChallenge,
  verifyCrossExpert,
  buildValidationManifest,
  handleDefensibilityExceptions,
  certifyExternalReview,
} from '../services/expertDefensibilityService.js';
import prisma from '../lib/prisma.js';

export async function registerExpertDefensibilityRoutes(fastify: FastifyInstance) {

  // POST — Full defensibility analysis
  fastify.post('/api/defensibility/analyze/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const result = await runFullExpertDefensibilityAnalysis(params.caseId);
      return reply.code(200).send(result);
    } catch (err) {
      fastify.log.error(err, 'Defensibility analysis failed');
      return reply.code(500).send({ error: 'Analysis failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // Expert Reviews
  fastify.post('/api/defensibility/reviews/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await initiateExpertReview(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/defensibility/reviews/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.independentExpertReviewWorkflow.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, reviews: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Adversarial Simulations
  fastify.post('/api/defensibility/simulations/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await simulateAdversarialChallenges(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/defensibility/simulations/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.adversarialChallengeSimulation.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, simulations: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Defensibility Scoring
  fastify.post('/api/defensibility/scoring/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await scoreLitigationDefensibility(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/defensibility/scoring/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.litigationDefensibilityScore.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 20 });
      return reply.code(200).send({ caseId: params.caseId, scores: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Reproducibility Review
  fastify.post('/api/defensibility/reproducibility/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await conductExternalReproducibilityReview(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/defensibility/reproducibility/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.externalReproducibilityReview.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 20 });
      return reply.code(200).send({ caseId: params.caseId, reviews: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Audit Trace
  fastify.post('/api/defensibility/traces/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await reconstructAuditTrace(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/defensibility/traces/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.expertAuditTraceReconstruction.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 20 });
      return reply.code(200).send({ caseId: params.caseId, traces: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Evidentiary Challenges
  fastify.post('/api/defensibility/challenges/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await trackEvidentiaryChallenge(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/defensibility/challenges/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.evidentiaryChallenge.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, challenges: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Cross-Expert Verification
  fastify.post('/api/defensibility/crossexpert/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await verifyCrossExpert(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/defensibility/crossexpert/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.crossExpertVerification.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, verifications: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Validation Manifests
  fastify.post('/api/defensibility/manifests/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await buildValidationManifest(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/defensibility/manifests/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.independentValidationManifest.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 20 });
      return reply.code(200).send({ caseId: params.caseId, manifests: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Defensibility Exceptions
  fastify.post('/api/defensibility/exceptions/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await handleDefensibilityExceptions(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/defensibility/exceptions/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.defensibilityExceptionRecord.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, exceptions: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Review Certification
  fastify.post('/api/defensibility/certification/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await certifyExternalReview(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/defensibility/certification/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.externalReviewCertification.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 20 });
      return reply.code(200).send({ caseId: params.caseId, certifications: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Validation endpoint
  fastify.get('/api/defensibility/validation', async (_req, reply) => {
    try {
      const [reviews, simulations, scores, reproducibility, traces, challenges, crossExpert, manifests, exceptions, certifications] = await Promise.all([
        prisma.independentExpertReviewWorkflow.count(),
        prisma.adversarialChallengeSimulation.count(),
        prisma.litigationDefensibilityScore.count(),
        prisma.externalReproducibilityReview.count(),
        prisma.expertAuditTraceReconstruction.count(),
        prisma.evidentiaryChallenge.count(),
        prisma.crossExpertVerification.count(),
        prisma.independentValidationManifest.count(),
        prisma.defensibilityExceptionRecord.count(),
        prisma.externalReviewCertification.count(),
      ]);
      return reply.code(200).send({
        phase: 'K.2',
        name: 'Independent Expert Review + Litigation Defensibility Framework',
        generatedAt: new Date().toISOString(),
        totals: { reviews, simulations, scores, reproducibility, traces, challenges, crossExpert, manifests, exceptions, certifications },
        constraints: {
          noFakeExpertEndorsements: true,
          noFabricatedCertifications: true,
          noOpaqueDefensibilityScoring: true,
          noSimulatedCourtApproval: true,
          noUnverifiableExpertReviewClaims: true,
          corePrinciple: 'CourtAccess supports independent scrutiny and reproducible expert review. It does NOT manufacture authority or legal legitimacy claims.',
        },
      });
    } catch (err) { return reply.code(500).send({ error: 'Validation failed' }); }
  });
}
