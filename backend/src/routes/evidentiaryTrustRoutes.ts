// ============================================================================
// Phase J.2 — Evidentiary Trust Assurance Routes
// Deterministic verifiability — no unverifiable trust claims.
// ============================================================================

import { FastifyInstance } from 'fastify';
import {
  runFullEvidentiaryTrustAnalysis,
  generateVerificationProofs,
  createIntegrityAttestations,
  generateReproducibilityProofs,
  buildVerificationChain,
  supportIndependentAudit,
  createValidationCheckpoints,
  certifyTrustAssurance,
  synchronizeCrossLayerVerification,
  runVerificationReplay,
  certifyDefensibility,
} from '../services/evidentiaryTrustService.js';
import prisma from '../lib/prisma.js';

export async function registerEvidentiaryTrustRoutes(fastify: FastifyInstance) {

  // POST — Full trust analysis
  fastify.post('/api/trust/analyze/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const result = await runFullEvidentiaryTrustAnalysis(params.caseId);
      return reply.code(200).send(result);
    } catch (err) {
      fastify.log.error(err, 'Trust analysis failed');
      return reply.code(500).send({ error: 'Analysis failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // Verification Proofs
  fastify.post('/api/trust/proofs/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await generateVerificationProofs(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/trust/proofs/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.deterministicVerificationProof.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, proofs: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Integrity Attestations
  fastify.post('/api/trust/attestations/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await createIntegrityAttestations(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/trust/attestations/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.integrityAttestationRecord.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, attestations: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Reproducibility Proofs
  fastify.post('/api/trust/reproducibility/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await generateReproducibilityProofs(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/trust/reproducibility/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.reproducibilityProof.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, proofs: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Verification Chains
  fastify.post('/api/trust/chains/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await buildVerificationChain(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/trust/chains/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.verificationChainManifest.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 20 });
      return reply.code(200).send({ caseId: params.caseId, chains: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Audit Verification
  fastify.post('/api/trust/audits/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await supportIndependentAudit(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/trust/audits/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.independentAuditVerification.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 20 });
      return reply.code(200).send({ caseId: params.caseId, audits: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Validation Checkpoints
  fastify.post('/api/trust/checkpoints/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await createValidationCheckpoints(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/trust/checkpoints/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.formalValidationCheckpoint.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, checkpoints: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Trust Certifications
  fastify.post('/api/trust/certifications/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await certifyTrustAssurance(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/trust/certifications/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.trustAssuranceCertification.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 20 });
      return reply.code(200).send({ caseId: params.caseId, certifications: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Cross-Layer Sync
  fastify.post('/api/trust/crosslayer/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await synchronizeCrossLayerVerification(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/trust/crosslayer/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.crossLayerVerificationSync.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, syncs: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Verification Replay
  fastify.post('/api/trust/replay/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await runVerificationReplay(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/trust/replay/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.verificationReplayRecord.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 20 });
      return reply.code(200).send({ caseId: params.caseId, replays: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Defensibility Certification
  fastify.post('/api/trust/defensibility/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await certifyDefensibility(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/trust/defensibility/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const records = await prisma.defensibilityCertificationRecord.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 20 });
      return reply.code(200).send({ caseId: params.caseId, certifications: records, total: records.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Validation endpoint
  fastify.get('/api/trust/validation', async (_req, reply) => {
    try {
      const [proofs, attestations, reproducibility, chains, audits, checkpoints, certifications, crossLayer, replays, defensibility] = await Promise.all([
        prisma.deterministicVerificationProof.count(),
        prisma.integrityAttestationRecord.count(),
        prisma.reproducibilityProof.count(),
        prisma.verificationChainManifest.count(),
        prisma.independentAuditVerification.count(),
        prisma.formalValidationCheckpoint.count(),
        prisma.trustAssuranceCertification.count(),
        prisma.crossLayerVerificationSync.count(),
        prisma.verificationReplayRecord.count(),
        prisma.defensibilityCertificationRecord.count(),
      ]);
      return reply.code(200).send({
        phase: 'J.2',
        name: 'Formal Verification + Evidentiary Trust Assurance Framework',
        generatedAt: new Date().toISOString(),
        totals: { proofs, attestations, reproducibility, chains, audits, checkpoints, certifications, crossLayer, replays, defensibility },
        constraints: {
          noFakeForensicCertifications: true,
          noProbabilisticTrustScoring: true,
          noUnverifiableAIConfidence: true,
          noOpaqueEvidentiaryScoring: true,
          noFabricatedReliabilityClaims: true,
          corePrinciple: 'CourtAccess maximizes deterministic verifiability and evidentiary defensibility. It does NOT manufacture unverifiable trust claims.',
        },
      });
    } catch (err) { return reply.code(500).send({ error: 'Validation failed' }); }
  });
}
