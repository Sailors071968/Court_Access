// ============================================================================
// Phase G.2 — Prosecutorial Conduct Intelligence + Discovery Integrity Routes
// Organizes provable disclosure and discovery structures.
// NEVER accuses prosecutors of misconduct.
// ============================================================================

import { FastifyInstance } from 'fastify';
import {
  runFullProsecutorialConductAnalysis,
  trackDiscoveryDisclosures,
  analyzeBradyMateriality,
  trackGiglioImpeachmentDisclosures,
  reconstructDisclosureChronology,
  detectLateDisclosures,
  auditMissingEvidence,
  indexProsecutorialConduct,
  buildDisclosurePreservationGraph,
  trackWitnessBenefitDisclosures,
  escalateDiscoveryViolations,
} from '../services/prosecutorialConductService.js';
import prisma from '../lib/prisma.js';

export async function registerProsecutorialConductRoutes(fastify: FastifyInstance) {

  // POST /api/discovery/analyze/:caseId — Full analysis
  fastify.post('/api/discovery/analyze/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const result = await runFullProsecutorialConductAnalysis(params.caseId);
      return reply.code(200).send(result);
    } catch (err) {
      fastify.log.error(err, 'Discovery analysis failed');
      return reply.code(500).send({ error: 'Analysis failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // Discovery Disclosures
  fastify.post('/api/discovery/disclosures/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await trackDiscoveryDisclosures(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/discovery/disclosures/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const disclosures = await prisma.discoveryDisclosureTracker.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' } });
      return reply.code(200).send({ caseId: params.caseId, disclosures, total: disclosures.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Brady Materiality
  fastify.post('/api/discovery/brady/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await analyzeBradyMateriality(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/discovery/brady/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const frameworks = await prisma.bradyMaterialityFramework.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' } });
      return reply.code(200).send({ caseId: params.caseId, frameworks, total: frameworks.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Giglio Impeachment
  fastify.post('/api/discovery/giglio/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await trackGiglioImpeachmentDisclosures(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/discovery/giglio/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const disclosures = await prisma.giglioImpeachmentDisclosure.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' } });
      return reply.code(200).send({ caseId: params.caseId, disclosures, total: disclosures.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Disclosure Chronology
  fastify.post('/api/discovery/chronology/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await reconstructDisclosureChronology(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/discovery/chronology/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const events = await prisma.disclosureChronology.findMany({ where: { caseId: params.caseId }, orderBy: { sequenceNumber: 'asc' } });
      return reply.code(200).send({ caseId: params.caseId, events, total: events.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Late Disclosures
  fastify.post('/api/discovery/late/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await detectLateDisclosures(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/discovery/late/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const lateDisclosures = await prisma.lateDisclosureDetection.findMany({ where: { caseId: params.caseId }, orderBy: { daysLate: 'desc' } });
      return reply.code(200).send({ caseId: params.caseId, lateDisclosures, total: lateDisclosures.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Missing Evidence
  fastify.post('/api/discovery/missing/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await auditMissingEvidence(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/discovery/missing/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const missingItems = await prisma.missingEvidenceAudit.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' } });
      return reply.code(200).send({ caseId: params.caseId, missingItems, total: missingItems.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Prosecutorial Conduct
  fastify.post('/api/discovery/conduct/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await indexProsecutorialConduct(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/discovery/conduct/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const conductItems = await prisma.prosecutorialConductIndex.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' } });
      return reply.code(200).send({ caseId: params.caseId, conductItems, total: conductItems.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Disclosure Preservation
  fastify.post('/api/discovery/preservation/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await buildDisclosurePreservationGraph(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/discovery/preservation/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const graphs = await prisma.disclosurePreservationGraph.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' } });
      return reply.code(200).send({ caseId: params.caseId, graphs, total: graphs.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Witness Benefits
  fastify.post('/api/discovery/benefits/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await trackWitnessBenefitDisclosures(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/discovery/benefits/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const benefits = await prisma.witnessBenefitDisclosure.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' } });
      return reply.code(200).send({ caseId: params.caseId, benefits, total: benefits.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Discovery Violation Escalation
  fastify.post('/api/discovery/escalation/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await escalateDiscoveryViolations(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/discovery/escalation/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const escalations = await prisma.discoveryViolationEscalation.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' } });
      return reply.code(200).send({ caseId: params.caseId, escalations, total: escalations.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Validation
  fastify.get('/api/discovery/validation', async (_req, reply) => {
    try {
      const [disclosures, brady, giglio, chronology, late, missing, conduct, preservation, benefits, escalation] = await Promise.all([
        prisma.discoveryDisclosureTracker.count(),
        prisma.bradyMaterialityFramework.count(),
        prisma.giglioImpeachmentDisclosure.count(),
        prisma.disclosureChronology.count(),
        prisma.lateDisclosureDetection.count(),
        prisma.missingEvidenceAudit.count(),
        prisma.prosecutorialConductIndex.count(),
        prisma.disclosurePreservationGraph.count(),
        prisma.witnessBenefitDisclosure.count(),
        prisma.discoveryViolationEscalation.count(),
      ]);
      return reply.code(200).send({
        phase: 'G.2',
        name: 'Prosecutorial Conduct Intelligence + Discovery Integrity Framework',
        generatedAt: new Date().toISOString(),
        totals: {
          discoveryDisclosures: disclosures, bradyFrameworks: brady,
          giglioDisclosures: giglio, chronologyEvents: chronology,
          lateDisclosures: late, missingEvidence: missing,
          conductItems: conduct, preservationGraphs: preservation,
          witnessBenefits: benefits, violationEscalations: escalation,
        },
        constraints: {
          noFabricatedMisconductAllegations: true,
          noInventedBradyViolations: true,
          noHallucinatedEthicsClaims: true,
          noSpeculativeCorruptionAccusations: true,
          noAIGeneratedDisciplinaryConclusions: true,
          corePrinciple: 'CourtAccess organizes provable disclosure and discovery structures. It does NOT accuse prosecutors of misconduct.',
        },
      });
    } catch (err) { return reply.code(500).send({ error: 'Validation failed' }); }
  });
}
