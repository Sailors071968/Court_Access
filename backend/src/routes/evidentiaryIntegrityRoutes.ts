// ============================================================================
// Phase H.2 — Enterprise Evidentiary Integrity Routes
// Maximizes evidentiary integrity and deterministic reproducibility.
// NEVER creates unverifiable forensic claims.
// ============================================================================

import { FastifyInstance } from 'fastify';
import {
  runFullEvidentiaryIntegrityAnalysis,
  hashEvidenceIntegrity,
  verifyChainOfAnalysis,
  runDeterministicReplay,
  detectEvidenceCorruption,
  verifyAnalysisReproducibility,
  generateExportSignature,
  trackMultiVersionEvidence,
  certifyForensicAudit,
  detectIntegrityBreaches,
  trackTransformationLineage,
} from '../services/evidentiaryIntegrityService.js';
import prisma from '../lib/prisma.js';

export async function registerEvidentiaryIntegrityRoutes(fastify: FastifyInstance) {

  // POST — Full integrity analysis
  fastify.post('/api/integrity/analyze/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const result = await runFullEvidentiaryIntegrityAnalysis(params.caseId);
      return reply.code(200).send(result);
    } catch (err) {
      fastify.log.error(err, 'Integrity analysis failed');
      return reply.code(500).send({ error: 'Analysis failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // Evidence Hashes
  fastify.post('/api/integrity/hashes/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await hashEvidenceIntegrity(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/integrity/hashes/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const hashes = await prisma.evidenceIntegrityHash.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 100 });
      return reply.code(200).send({ caseId: params.caseId, hashes, total: hashes.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Chain of Analysis
  fastify.post('/api/integrity/chains/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await verifyChainOfAnalysis(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/integrity/chains/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const chains = await prisma.chainOfAnalysisVerification.findMany({ where: { caseId: params.caseId }, orderBy: { chainPosition: 'asc' }, take: 100 });
      return reply.code(200).send({ caseId: params.caseId, chains, total: chains.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Deterministic Replay
  fastify.post('/api/integrity/replays/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await runDeterministicReplay(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/integrity/replays/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const replays = await prisma.deterministicReplayRecord.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 100 });
      return reply.code(200).send({ caseId: params.caseId, replays, total: replays.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Corruption Detection
  fastify.post('/api/integrity/corruption/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await detectEvidenceCorruption(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/integrity/corruption/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const detections = await prisma.evidenceCorruptionDetection.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 100 });
      return reply.code(200).send({ caseId: params.caseId, detections, total: detections.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Reproducibility
  fastify.post('/api/integrity/reproducibility/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await verifyAnalysisReproducibility(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/integrity/reproducibility/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.analysisReproducibilityRecord.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Export Signatures
  fastify.post('/api/integrity/exports/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await generateExportSignature(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/integrity/exports/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const signatures = await prisma.exportVerificationSignature.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, signatures, total: signatures.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Multi-Version
  fastify.post('/api/integrity/versions/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await trackMultiVersionEvidence(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/integrity/versions/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const versions = await prisma.multiVersionEvidenceTracker.findMany({ where: { caseId: params.caseId }, orderBy: { versionNumber: 'desc' }, take: 100 });
      return reply.code(200).send({ caseId: params.caseId, versions, total: versions.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Forensic Certification
  fastify.post('/api/integrity/certifications/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await certifyForensicAudit(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/integrity/certifications/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const certifications = await prisma.forensicAuditCertification.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 20 });
      return reply.code(200).send({ caseId: params.caseId, certifications, total: certifications.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Integrity Breaches
  fastify.post('/api/integrity/breaches/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await detectIntegrityBreaches(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/integrity/breaches/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const alerts = await prisma.integrityBreachAlert.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, alerts, total: alerts.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Transformation Lineage
  fastify.post('/api/integrity/lineage/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await trackTransformationLineage(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/integrity/lineage/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const lineages = await prisma.evidenceTransformationLineage.findMany({ where: { caseId: params.caseId }, orderBy: { lineagePosition: 'asc' }, take: 100 });
      return reply.code(200).send({ caseId: params.caseId, lineages, total: lineages.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Validation
  fastify.get('/api/integrity/validation', async (_req, reply) => {
    try {
      const [hashes, chains, replays, corruptions, reproducibility, exports, versions, certifications, breaches, lineages] = await Promise.all([
        prisma.evidenceIntegrityHash.count(),
        prisma.chainOfAnalysisVerification.count(),
        prisma.deterministicReplayRecord.count(),
        prisma.evidenceCorruptionDetection.count(),
        prisma.analysisReproducibilityRecord.count(),
        prisma.exportVerificationSignature.count(),
        prisma.multiVersionEvidenceTracker.count(),
        prisma.forensicAuditCertification.count(),
        prisma.integrityBreachAlert.count(),
        prisma.evidenceTransformationLineage.count(),
      ]);
      return reply.code(200).send({
        phase: 'H.2',
        name: 'Enterprise Evidentiary Integrity + Reliability Assurance Framework',
        generatedAt: new Date().toISOString(),
        totals: {
          evidenceHashes: hashes, chainVerifications: chains,
          replayRecords: replays, corruptionDetections: corruptions,
          reproducibilityRecords: reproducibility, exportSignatures: exports,
          versionTrackers: versions, auditCertifications: certifications,
          breachAlerts: breaches, transformationLineages: lineages,
        },
        constraints: {
          noUnverifiableAITransformations: true,
          noOpaqueEvidenceMutation: true,
          noProbabilisticEvidenceRewriting: true,
          noHiddenEvidenceManipulation: true,
          noBlockchainGimmicks: true,
          corePrinciple: 'CourtAccess maximizes evidentiary integrity and deterministic reproducibility. It does NOT create unverifiable forensic claims.',
        },
      });
    } catch (err) { return reply.code(500).send({ error: 'Validation failed' }); }
  });
}
