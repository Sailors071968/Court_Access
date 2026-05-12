// ============================================================================
// Phase F.1 — Unified Intelligence Graph Routes
// Organizes lawful litigation intelligence relationships.
// NEVER becomes a surveillance or predictive-enforcement system.
// ============================================================================

import { FastifyInstance } from 'fastify';
import {
  runFullUnifiedIntelligenceAnalysis,
  buildUnifiedIntelligenceGraph,
  indexCrossCaseWitnesses,
  detectCrossCaseForensicPatterns,
  buildGlobalContradictionGraph,
  indexProsecutorTheoryRecurrence,
  trackRecurringBradyPatterns,
  indexLawEnforcementCredibility,
  buildEvidenceProvenanceGraph,
  correlateMultiCaseTimelines,
} from '../services/unifiedIntelligenceGraphService.js';
import prisma from '../lib/prisma.js';

export async function registerUnifiedIntelligenceRoutes(fastify: FastifyInstance) {

  // POST /api/intelligence/analyze/:caseId — Full unified analysis
  fastify.post('/api/intelligence/analyze/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const result = await runFullUnifiedIntelligenceAnalysis(params.caseId);
      return reply.code(200).send(result);
    } catch (err) {
      fastify.log.error(err, 'Unified intelligence analysis failed');
      return reply.code(500).send({ error: 'Analysis failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // POST/GET /api/intelligence/graph/:caseId
  fastify.post('/api/intelligence/graph/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await buildUnifiedIntelligenceGraph(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/intelligence/graph/nodes/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const nodes = await prisma.intelligenceGraphNode.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' } });
      return reply.code(200).send({ caseId: params.caseId, nodes, total: nodes.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });
  fastify.get('/api/intelligence/graph/edges/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const edges = await prisma.intelligenceGraphEdge.findMany({ where: { caseId: params.caseId } });
      return reply.code(200).send({ caseId: params.caseId, edges, total: edges.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // POST/GET /api/intelligence/witnesses/:caseId
  fastify.post('/api/intelligence/witnesses/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await indexCrossCaseWitnesses(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/intelligence/witnesses/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const witnesses = await prisma.crossCaseWitnessIndex.findMany({ orderBy: { totalAppearances: 'desc' } });
      return reply.code(200).send({ caseId: params.caseId, witnesses, total: witnesses.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // POST/GET /api/intelligence/forensic/:caseId
  fastify.post('/api/intelligence/forensic/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await detectCrossCaseForensicPatterns(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/intelligence/forensic/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const patterns = await prisma.crossCaseForensicPattern.findMany({ orderBy: { totalOccurrences: 'desc' } });
      return reply.code(200).send({ caseId: params.caseId, patterns, total: patterns.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // POST/GET /api/intelligence/contradictions/:caseId
  fastify.post('/api/intelligence/contradictions/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await buildGlobalContradictionGraph(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/intelligence/contradictions/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const networks = await prisma.globalContradictionNetwork.findMany({ where: { caseId: params.caseId }, orderBy: { severity: 'asc' } });
      return reply.code(200).send({ caseId: params.caseId, networks, total: networks.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // POST/GET /api/intelligence/theories/:caseId
  fastify.post('/api/intelligence/theories/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await indexProsecutorTheoryRecurrence(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/intelligence/theories/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const theories = await prisma.prosecutorTheoryRecurrence.findMany({ orderBy: { totalOccurrences: 'desc' } });
      return reply.code(200).send({ caseId: params.caseId, theories, total: theories.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // POST/GET /api/intelligence/brady/:caseId
  fastify.post('/api/intelligence/brady/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await trackRecurringBradyPatterns(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/intelligence/brady/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const patterns = await prisma.recurringBradyPattern.findMany({ orderBy: { totalOccurrences: 'desc' } });
      return reply.code(200).send({ caseId: params.caseId, patterns, total: patterns.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // POST/GET /api/intelligence/le-credibility/:caseId
  fastify.post('/api/intelligence/le-credibility/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await indexLawEnforcementCredibility(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/intelligence/le-credibility/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const officers = await prisma.lawEnforcementCredibilityIndex.findMany({ orderBy: { totalCaseAppearances: 'desc' } });
      return reply.code(200).send({ caseId: params.caseId, officers, total: officers.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // POST/GET /api/intelligence/provenance/:caseId
  fastify.post('/api/intelligence/provenance/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await buildEvidenceProvenanceGraph(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/intelligence/provenance/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const chains = await prisma.evidenceProvenanceGraph.findMany({ where: { caseId: params.caseId } });
      return reply.code(200).send({ caseId: params.caseId, chains, total: chains.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // POST/GET /api/intelligence/timelines/:caseId
  fastify.post('/api/intelligence/timelines/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await correlateMultiCaseTimelines(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/intelligence/timelines/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const correlations = await prisma.multiCaseTimelineCorrelation.findMany({
        where: { OR: [{ caseIdA: params.caseId }, { caseIdB: params.caseId }] },
        orderBy: { correlationStrength: 'desc' },
      });
      return reply.code(200).send({ caseId: params.caseId, correlations, total: correlations.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // GET /api/intelligence/validation
  fastify.get('/api/intelligence/validation', async (_req, reply) => {
    try {
      const [nodes, edges, witnesses, forensic, contradictions, theories, brady, le, provenance, timelines] = await Promise.all([
        prisma.intelligenceGraphNode.count(),
        prisma.intelligenceGraphEdge.count(),
        prisma.crossCaseWitnessIndex.count(),
        prisma.crossCaseForensicPattern.count(),
        prisma.globalContradictionNetwork.count(),
        prisma.prosecutorTheoryRecurrence.count(),
        prisma.recurringBradyPattern.count(),
        prisma.lawEnforcementCredibilityIndex.count(),
        prisma.evidenceProvenanceGraph.count(),
        prisma.multiCaseTimelineCorrelation.count(),
      ]);
      return reply.code(200).send({
        phase: 'F.1',
        name: 'Unified Criminal Defense Intelligence Graph + Cross-Case Pattern Engine',
        generatedAt: new Date().toISOString(),
        totals: {
          graphNodes: nodes, graphEdges: edges, crossCaseWitnesses: witnesses,
          forensicPatterns: forensic, contradictionNetworks: contradictions,
          prosecutorTheories: theories, bradyPatterns: brady,
          lawEnforcementCredibility: le, provenanceChains: provenance,
          timelineCorrelations: timelines,
        },
        deterministicConstraints: {
          noPredictivePolicing: true,
          noCriminalRiskScoring: true,
          noUnlawfulSurveillance: true,
          noSpeculativeMisconductAllegations: true,
          noPersonalProfilingSystems: true,
          noHiddenLETargeting: true,
          corePrinciple: 'CourtAccess organizes lawful litigation intelligence relationships. It does NOT become a surveillance or predictive-enforcement system.',
        },
      });
    } catch (err) { return reply.code(500).send({ error: 'Validation failed' }); }
  });
}
