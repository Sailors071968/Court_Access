// ============================================================================
// Phase D.6 — Evidentiary Objection Routes
// Citation-backed objection intelligence. NEVER acts as litigation counsel.
// ============================================================================

import { FastifyInstance } from 'fastify';
import {
  runFullObjectionAnalysis,
  analyzeHearsay,
  detectFoundationDefects,
  detectAuthenticationChallenges,
  detectChainOfCustodyIssues,
  detectConstitutionalIssues,
  detectDiscoveryViolations,
  detectBradyGiglioIssues,
  identifySuppressionIssues,
  generateEvidentiaryObjections,
} from '../services/evidentiaryObjectionService.js';
import prisma from '../lib/prisma.js';

export async function registerEvidentiaryObjectionRoutes(fastify: FastifyInstance) {

  // POST /api/objections/analyze/:caseId — Full objection analysis
  fastify.post('/api/objections/analyze/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    if (!params.caseId) return reply.code(400).send({ error: 'Required: caseId' });
    try {
      const result = await runFullObjectionAnalysis(params.caseId);
      return reply.code(200).send(result);
    } catch (err) {
      fastify.log.error(err, 'Objection analysis failed');
      return reply.code(500).send({ error: 'Analysis failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // POST /api/objections/hearsay/:caseId — Hearsay analysis
  fastify.post('/api/objections/hearsay/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await analyzeHearsay(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });

  // GET /api/objections/hearsay/:caseId
  fastify.get('/api/objections/hearsay/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const issues = await prisma.hearsayIssue.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' } });
      return reply.code(200).send({ caseId: params.caseId, issues, total: issues.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // POST /api/objections/foundation/:caseId
  fastify.post('/api/objections/foundation/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await detectFoundationDefects(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });

  // GET /api/objections/foundation/:caseId
  fastify.get('/api/objections/foundation/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const defects = await prisma.foundationDefect.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' } });
      return reply.code(200).send({ caseId: params.caseId, defects, total: defects.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // POST /api/objections/authentication/:caseId
  fastify.post('/api/objections/authentication/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await detectAuthenticationChallenges(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });

  // GET /api/objections/authentication/:caseId
  fastify.get('/api/objections/authentication/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const challenges = await prisma.authenticationChallenge.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' } });
      return reply.code(200).send({ caseId: params.caseId, challenges, total: challenges.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // POST /api/objections/custody/:caseId — Chain of custody
  fastify.post('/api/objections/custody/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await detectChainOfCustodyIssues(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });

  // GET /api/objections/custody/:caseId
  fastify.get('/api/objections/custody/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const issues = await prisma.chainOfCustodyIssue.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' } });
      return reply.code(200).send({ caseId: params.caseId, issues, total: issues.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // POST /api/objections/constitutional/:caseId
  fastify.post('/api/objections/constitutional/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await detectConstitutionalIssues(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });

  // GET /api/objections/constitutional/:caseId
  fastify.get('/api/objections/constitutional/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const issues = await prisma.constitutionalIssue.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' } });
      return reply.code(200).send({ caseId: params.caseId, issues, total: issues.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // POST /api/objections/discovery/:caseId
  fastify.post('/api/objections/discovery/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await detectDiscoveryViolations(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });

  // GET /api/objections/discovery/:caseId
  fastify.get('/api/objections/discovery/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const violations = await prisma.discoveryViolation.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' } });
      return reply.code(200).send({ caseId: params.caseId, violations, total: violations.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // POST /api/objections/brady/:caseId
  fastify.post('/api/objections/brady/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await detectBradyGiglioIssues(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });

  // GET /api/objections/brady/:caseId
  fastify.get('/api/objections/brady/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const issues = await prisma.bradyGiglioIssue.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' } });
      return reply.code(200).send({ caseId: params.caseId, issues, total: issues.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // POST /api/objections/suppression/:caseId
  fastify.post('/api/objections/suppression/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await identifySuppressionIssues(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });

  // GET /api/objections/suppression/:caseId
  fastify.get('/api/objections/suppression/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const issues = await prisma.suppressionIssue.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' } });
      return reply.code(200).send({ caseId: params.caseId, issues, total: issues.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // POST /api/objections/general/:caseId — Generate general evidentiary objections
  fastify.post('/api/objections/general/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await generateEvidentiaryObjections(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });

  // GET /api/objections/general/:caseId
  fastify.get('/api/objections/general/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    const query = req.query as { type?: string; strength?: string };
    try {
      const objections = await prisma.evidentiaryObjection.findMany({
        where: {
          caseId: params.caseId,
          ...(query.type ? { objectionType: query.type } : {}),
          ...(query.strength ? { strength: query.strength } : {}),
        },
        orderBy: { createdAt: 'desc' },
      });
      return reply.code(200).send({ caseId: params.caseId, objections, total: objections.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // GET /api/objections/validation — Live validation report
  fastify.get('/api/objections/validation', async (_req, reply) => {
    try {
      const [objections, hearsay, foundation, auth, custody, constitutional, discovery, brady, suppression] = await Promise.all([
        prisma.evidentiaryObjection.count(),
        prisma.hearsayIssue.count(),
        prisma.foundationDefect.count(),
        prisma.authenticationChallenge.count(),
        prisma.chainOfCustodyIssue.count(),
        prisma.constitutionalIssue.count(),
        prisma.discoveryViolation.count(),
        prisma.bradyGiglioIssue.count(),
        prisma.suppressionIssue.count(),
      ]);
      return reply.code(200).send({
        phase: 'D.6',
        name: 'Judicial Motion Intelligence + Evidentiary Objection Framework',
        generatedAt: new Date().toISOString(),
        totals: { evidentiaryObjections: objections, hearsayIssues: hearsay, foundationDefects: foundation, authenticationChallenges: auth, chainOfCustodyIssues: custody, constitutionalIssues: constitutional, discoveryViolations: discovery, bradyGiglioIssues: brady, suppressionIssues: suppression },
        deterministicConstraints: {
          noFabricatedBradyClaims: true,
          noInventedConstitutionalViolations: true,
          noHallucinatedSuppressionArguments: true,
          noFakeCaseLaw: true,
          noAIGeneratedLegalOpinions: true,
          corePrinciple: 'CourtAccess identifies and organizes provable evidentiary and procedural issues. It does NOT act as litigation counsel.',
        },
      });
    } catch (err) { return reply.code(500).send({ error: 'Validation failed' }); }
  });
}
