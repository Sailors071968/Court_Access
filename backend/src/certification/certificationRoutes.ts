// ============================================================================
// Gold Standard Certification — administrator-only API.
//
// Every route here is behind /api/certification, which ROUTE_PERMISSIONS
// restricts to the admin role. Attorneys, investigators, paralegals,
// defendants, family members, office administrators, experts and consultants
// have no path to it. Each handler re-checks the role rather than relying on
// the prefix alone, so the module stays closed even if the map is edited.
// ============================================================================

import type { FastifyInstance, FastifyReply } from 'fastify';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { AuthenticatedRequest } from '../security/authMiddleware.js';
import prisma from '../lib/prisma.js';
import { buildInventory, discoverFiles, importCertificationCase } from './certificationImport.js';
import { compareRuns, runCertification, type CertificationMetrics } from './certificationRun.js';
import { DOCUMENT_CLASSES } from './documentClassifier.js';

/** Second gate: the module is administrator-only regardless of the route map. */
function requireAdministrator(request: AuthenticatedRequest, reply: FastifyReply): boolean {
  const user = request.user;
  if (!user) {
    void reply.code(401).send({ error: 'Authentication required' });
    return false;
  }
  if (user.role !== 'admin') {
    void reply.code(403).send({
      error: 'Forbidden',
      message: 'Gold Standard Certification is available to administrators only.',
    });
    return false;
  }
  return true;
}

import { buildReadinessReport } from './readinessService.js';

export async function registerCertificationRoutes(app: FastifyInstance): Promise<void> {
  // -------------------------------------------------------------------------
  // Module status — what the administrator lands on
  // -------------------------------------------------------------------------
  app.get('/api/certification/status', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;

    const cases = await prisma.certificationCase.findMany({
      where: { tenantId: request.user!.tenantId },
      orderBy: { importStartedAt: 'desc' },
      include: { _count: { select: { files: true, runs: true } } },
    });

    const runs = await prisma.certificationRun.count({
      where: { certificationCase: { tenantId: request.user!.tenantId } },
    });

    return reply.send({
      module: 'Gold Standard Certification',
      corpora: cases.length,
      totalRuns: runs,
      documentClasses: DOCUMENT_CLASSES.length,
      cases: cases.map((c) => ({
        certificationCaseId: c.certificationCaseId,
        reference: c.reference,
        label: c.label,
        status: c.status,
        caseId: c.caseId,
        fileCount: c._count.files,
        runCount: c._count.runs,
        corpusHash: c.corpusHash,
        totalBytes: c.totalBytes.toString(),
        importedAt: c.importStartedAt,
        importCompletedAt: c.importCompletedAt,
      })),
    });
  });

  // -------------------------------------------------------------------------
  // Preview a delivery before importing it
  // -------------------------------------------------------------------------
  app.post('/api/certification/preview', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;

    const body = (request.body ?? {}) as { sourceDirectory?: string; expandArchives?: boolean };
    if (!body.sourceDirectory) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'Provide sourceDirectory — the folder holding the discovery as it was delivered.',
      });
    }

    const root = path.resolve(body.sourceDirectory);
    const stat = await fs.stat(root).catch(() => null);
    if (!stat?.isDirectory()) {
      return reply.code(400).send({
        error: 'Folder not found',
        message: `"${body.sourceDirectory}" is not a readable folder on the server.`,
      });
    }

    const { files, warnings } = await discoverFiles(root, {
      expandArchives: body.expandArchives ?? true,
      scratchDir: path.join('/tmp', 'courtaccess-certification-preview'),
    });

    const byExtension: Record<string, number> = {};
    for (const f of files) byExtension[f.extension || 'none'] = (byExtension[f.extension || 'none'] ?? 0) + 1;

    return reply.send({
      sourceDirectory: root,
      fileCount: files.length,
      totalBytes: files.reduce((s, f) => s + f.sizeBytes, 0),
      byExtension,
      warnings,
      files: files.slice(0, 500).map((f) => ({
        relativePath: f.relativePath,
        fileName: f.fileName,
        sizeBytes: f.sizeBytes,
        modifiedAt: f.modifiedAt,
        fromArchive: f.extractedFromArchive ?? null,
      })),
      truncated: files.length > 500,
    });
  });

  // -------------------------------------------------------------------------
  // Import a certification corpus
  // -------------------------------------------------------------------------
  app.post('/api/certification/import', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;

    const body = (request.body ?? {}) as {
      reference?: string;
      label?: string;
      description?: string;
      authorizationNote?: string;
      sourceDirectory?: string;
      expandArchives?: boolean;
    };

    if (!body.reference || !body.label || !body.sourceDirectory) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'reference, label and sourceDirectory are all required.',
      });
    }

    const existing = await prisma.certificationCase.findUnique({ where: { reference: body.reference } });
    if (existing) {
      return reply.code(409).send({
        error: 'Conflict',
        message:
          `A certification corpus with reference "${body.reference}" already exists. ` +
          'Certification corpora are permanent; choose a new reference rather than overwriting one.',
      });
    }

    try {
      const result = await importCertificationCase({
        reference: body.reference,
        label: body.label,
        description: body.description,
        sourceDirectory: body.sourceDirectory,
        expandArchives: body.expandArchives ?? true,
        user: { userId: request.user!.userId, tenantId: request.user!.tenantId },
      });
      return reply.code(201).send(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      request.log.error({ err }, '[Certification] Import failed');
      return reply.code(400).send({ error: 'Import failed', message });
    }
  });

  // -------------------------------------------------------------------------
  // Inventory
  // -------------------------------------------------------------------------
  app.get('/api/certification/cases/:certificationCaseId/inventory', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;
    const { certificationCaseId } = request.params as { certificationCaseId: string };

    const inventory = await buildInventory(certificationCaseId);
    if (!inventory) {
      return reply.code(404).send({ error: 'Not Found', message: 'No such certification corpus.' });
    }
    return reply.send(inventory);
  });

  // -------------------------------------------------------------------------
  // Run a certification
  // -------------------------------------------------------------------------
  app.post('/api/certification/cases/:certificationCaseId/run', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;
    const { certificationCaseId } = request.params as { certificationCaseId: string };

    try {
      const result = await runCertification(certificationCaseId);
      return reply.send(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      request.log.error({ err }, '[Certification] Run failed');
      return reply.code(400).send({ error: 'Certification run failed', message });
    }
  });

  // -------------------------------------------------------------------------
  // Run history and the report for a single run
  // -------------------------------------------------------------------------
  app.get('/api/certification/cases/:certificationCaseId/runs', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;
    const { certificationCaseId } = request.params as { certificationCaseId: string };

    const runs = await prisma.certificationRun.findMany({
      where: { certificationCaseId },
      orderBy: { startedAt: 'desc' },
      select: {
        certificationRunId: true,
        gitCommit: true,
        startedAt: true,
        completedAt: true,
        status: true,
        isBaseline: true,
        metrics: true,
        regressions: true,
      },
    });

    return reply.send({
      certificationCaseId,
      runCount: runs.length,
      runs,
    });
  });

  app.get('/api/certification/runs/:certificationRunId', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;
    const { certificationRunId } = request.params as { certificationRunId: string };

    const run = await prisma.certificationRun.findUnique({
      where: { certificationRunId },
      include: { certificationCase: true },
    });
    if (!run) return reply.code(404).send({ error: 'Not Found', message: 'No such certification run.' });

    return reply.send({
      certificationRunId: run.certificationRunId,
      reference: run.certificationCase.reference,
      label: run.certificationCase.label,
      gitCommit: run.gitCommit,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      status: run.status,
      isBaseline: run.isBaseline,
      metrics: run.metrics,
      failures: run.failures,
      regressions: run.regressions,
    });
  });

  // -------------------------------------------------------------------------
  // Compare any two runs
  // -------------------------------------------------------------------------
  app.get('/api/certification/compare', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;
    const { baselineRunId, currentRunId } = request.query as {
      baselineRunId?: string;
      currentRunId?: string;
    };

    if (!baselineRunId || !currentRunId) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'Provide baselineRunId and currentRunId.',
      });
    }

    const [baseline, current] = await Promise.all([
      prisma.certificationRun.findUnique({ where: { certificationRunId: baselineRunId } }),
      prisma.certificationRun.findUnique({ where: { certificationRunId: currentRunId } }),
    ]);

    if (!baseline || !current) {
      return reply.code(404).send({ error: 'Not Found', message: 'One or both runs do not exist.' });
    }
    if (!baseline.metrics || !current.metrics) {
      return reply.code(409).send({
        error: 'Cannot compare',
        message: 'One or both runs did not record metrics, so there is nothing to compare.',
      });
    }

    const regressions = compareRuns(
      baseline.metrics as unknown as CertificationMetrics,
      current.metrics as unknown as CertificationMetrics,
    );

    return reply.send({
      baselineRunId,
      currentRunId,
      baselineCommit: baseline.gitCommit,
      currentCommit: current.gitCommit,
      differences: regressions.length,
      regressions: regressions.filter((r) => r.severity === 'regression'),
      improvements: regressions.filter((r) => r.severity === 'improvement'),
      changes: regressions.filter((r) => r.severity === 'change'),
    });
  });

  // -------------------------------------------------------------------------
  // Mark a run as the reference for future comparisons
  // -------------------------------------------------------------------------
  app.post('/api/certification/runs/:certificationRunId/baseline', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;
    const { certificationRunId } = request.params as { certificationRunId: string };

    const run = await prisma.certificationRun.findUnique({ where: { certificationRunId } });
    if (!run) return reply.code(404).send({ error: 'Not Found', message: 'No such certification run.' });
    if (run.status !== 'completed') {
      return reply.code(409).send({
        error: 'Cannot set baseline',
        message: 'Only a completed run can be the reference for future comparisons.',
      });
    }

    await prisma.$transaction([
      prisma.certificationRun.updateMany({
        where: { certificationCaseId: run.certificationCaseId },
        data: { isBaseline: false },
      }),
      prisma.certificationRun.update({
        where: { certificationRunId },
        data: { isBaseline: true },
      }),
    ]);

    return reply.send({ certificationRunId, isBaseline: true });
  });

  // -------------------------------------------------------------------------
  // Production readiness — the release gate, evaluated on measured evidence
  // -------------------------------------------------------------------------
  app.get('/api/certification/readiness', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;
    try {
      return reply.send(await buildReadinessReport());
    } catch (err) {
      return reply.code(500).send({
        error: 'Readiness unavailable',
        message: `The readiness report could not be assembled: ${(err as Error).message}`,
      });
    }
  });

  // -------------------------------------------------------------------------
  // Attest a corpus as attorney-authorized
  //
  // The release gate counts only corpora attested here. It is deliberately a
  // separate, explicit act: a corpus is a test fixture until somebody with
  // authority says otherwise and records who authorised the use of the
  // material.
  // -------------------------------------------------------------------------
  app.post('/api/certification/cases/:certificationCaseId/authorize', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;
    const { certificationCaseId } = request.params as { certificationCaseId: string };
    const body = (request.body ?? {}) as { authorizationNote?: string; authorized?: boolean };

    const corpus = await prisma.certificationCase.findUnique({ where: { certificationCaseId } });
    if (!corpus || corpus.tenantId !== request.user!.tenantId) {
      return reply.code(404).send({ error: 'Not Found', message: 'No such certification corpus.' });
    }

    // Withdrawing an attestation needs no note; making one does.
    if (body.authorized === false) {
      await prisma.certificationCase.update({
        where: { certificationCaseId },
        data: { authorized: false, authorizedAt: null, authorizedById: null, authorizationNote: null },
      });
      return reply.send({ certificationCaseId, authorized: false, message: 'Attestation withdrawn.' });
    }

    const note = body.authorizationNote?.trim();
    if (!note || note.length < 20) {
      return reply.code(400).send({
        error: 'Attestation required',
        message:
          'Record who authorised the use of this discovery and on what basis, in at least twenty characters. ' +
          'The release gate treats an attested corpus as real criminal material, so the attestation is the only ' +
          'thing standing between a test fixture and a certification claim.',
      });
    }

    await prisma.certificationCase.update({
      where: { certificationCaseId },
      data: {
        authorized: true,
        authorizedAt: new Date(),
        authorizedById: request.user!.userId,
        authorizationNote: note,
      },
    });

    return reply.send({
      certificationCaseId,
      reference: corpus.reference,
      authorized: true,
      message: 'Attested. This corpus now counts towards the release gate.',
    });
  });

  console.log('[Server] Gold Standard Certification routes registered (administrator only): /api/certification/*');
}
