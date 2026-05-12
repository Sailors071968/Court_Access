// ============================================================================
// Phase I.1 — Litigation Interoperability Routes
// Prepares interoperable litigation materials.
// NEVER autonomously interacts with courts.
// ============================================================================

import { FastifyInstance } from 'fastify';
import {
  runFullLitigationInteroperabilityAnalysis,
  generateExportPackage,
  assembleCourtDocument,
  generateInterchangeManifest,
  verifyEvidencePackages,
  exportChainOfCustody,
  generateMultiFormatExport,
  validateExhibitBundles,
  verifyExternalIntegrity,
  createLitigationArchive,
  generateProvenanceManifests,
} from '../services/litigationInteroperabilityService.js';
import prisma from '../lib/prisma.js';

export async function registerLitigationInteroperabilityRoutes(fastify: FastifyInstance) {

  // POST — Full interoperability analysis
  fastify.post('/api/interop/analyze/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const result = await runFullLitigationInteroperabilityAnalysis(params.caseId);
      return reply.code(200).send(result);
    } catch (err) {
      fastify.log.error(err, 'Interoperability analysis failed');
      return reply.code(500).send({ error: 'Analysis failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // Export Packages
  fastify.post('/api/interop/packages/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await generateExportPackage(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/interop/packages/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const packages = await prisma.standardizedExportPackage.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, packages, total: packages.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Court Documents
  fastify.post('/api/interop/documents/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await assembleCourtDocument(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/interop/documents/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const documents = await prisma.courtCompatibleDocument.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, documents, total: documents.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Interchange Manifests
  fastify.post('/api/interop/manifests/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await generateInterchangeManifest(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/interop/manifests/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const manifests = await prisma.litigationInterchangeManifest.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 20 });
      return reply.code(200).send({ caseId: params.caseId, manifests, total: manifests.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Package Verification
  fastify.post('/api/interop/verification/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await verifyEvidencePackages(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/interop/verification/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const verifications = await prisma.evidencePackageVerification.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, verifications, total: verifications.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Chain of Custody
  fastify.post('/api/interop/custody/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await exportChainOfCustody(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/interop/custody/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const chains = await prisma.externalChainOfCustodyExport.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, chains, total: chains.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Multi-Format Export
  fastify.post('/api/interop/formats/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await generateMultiFormatExport(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/interop/formats/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const exports = await prisma.multiFormatLitigationExport.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, exports, total: exports.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Exhibit Bundles
  fastify.post('/api/interop/exhibits/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await validateExhibitBundles(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/interop/exhibits/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const bundles = await prisma.exhibitBundleValidation.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 20 });
      return reply.code(200).send({ caseId: params.caseId, bundles, total: bundles.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // External Integrity
  fastify.post('/api/interop/external/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await verifyExternalIntegrity(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/interop/external/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const verifications = await prisma.externalIntegrityVerification.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, verifications, total: verifications.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Archives
  fastify.post('/api/interop/archives/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await createLitigationArchive(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/interop/archives/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const archives = await prisma.litigationArchivePackage.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 20 });
      return reply.code(200).send({ caseId: params.caseId, archives, total: archives.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Provenance
  fastify.post('/api/interop/provenance/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try { return reply.code(200).send(await generateProvenanceManifests(params.caseId)); }
    catch (err) { return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) }); }
  });
  fastify.get('/api/interop/provenance/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    try {
      const manifests = await prisma.exportProvenanceManifest.findMany({ where: { caseId: params.caseId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return reply.code(200).send({ caseId: params.caseId, manifests, total: manifests.length });
    } catch (err) { return reply.code(500).send({ error: 'Failed' }); }
  });

  // Validation
  fastify.get('/api/interop/validation', async (_req, reply) => {
    try {
      const [packages, documents, manifests, verifications, custody, formats, exhibits, external, archives, provenance] = await Promise.all([
        prisma.standardizedExportPackage.count(),
        prisma.courtCompatibleDocument.count(),
        prisma.litigationInterchangeManifest.count(),
        prisma.evidencePackageVerification.count(),
        prisma.externalChainOfCustodyExport.count(),
        prisma.multiFormatLitigationExport.count(),
        prisma.exhibitBundleValidation.count(),
        prisma.externalIntegrityVerification.count(),
        prisma.litigationArchivePackage.count(),
        prisma.exportProvenanceManifest.count(),
      ]);
      return reply.code(200).send({
        phase: 'I.1',
        name: 'Judicial / Evidentiary Interoperability + Litigation Exchange Framework',
        generatedAt: new Date().toISOString(),
        totals: { packages, documents, manifests, verifications, custody, formats, exhibits, external, archives, provenance },
        constraints: {
          noAutonomousCourtFiling: true,
          noUnsupervisedSubmission: true,
          noFakeElectronicFiling: true,
          noUnauthorizedTransmission: true,
          noUnverifiableExportMutation: true,
          corePrinciple: 'CourtAccess prepares interoperable litigation materials. It does NOT autonomously interact with courts.',
        },
      });
    } catch (err) { return reply.code(500).send({ error: 'Validation failed' }); }
  });
}
