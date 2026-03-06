// ============================================
// Court Access — Phase E: Cold Archive System API
// Archive/restore cases with immutable audit ledger.
// ============================================

import express from 'express';
import crypto from 'crypto';
import prisma from '../services/prismaClient.js';

const router = express.Router();

// ---------------------------------------------------------------------------
// GET /api/archives/:caseId — Get archive status for a case
// ---------------------------------------------------------------------------

router.get('/:caseId', async (req, res) => {
  try {
    const { caseId } = req.params;

    const archive = await prisma.archiveRecord.findUnique({
      where: { caseId },
    });

    const auditLog = await prisma.archiveAuditLog.findMany({
      where: { caseId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json({
      archive: archive || null,
      auditLog,
      status: archive ? archive.status : 'active',
    });
  } catch (err) {
    console.error('[Archive] Status error:', err.message);
    res.status(500).json({ error: 'Failed to fetch archive status' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/archives/:caseId/archive — Initiate archive for a case
// ---------------------------------------------------------------------------

router.post('/:caseId/archive', async (req, res) => {
  try {
    const { caseId } = req.params;
    const { actor, reason } = req.body;

    // Check if already archived
    const existing = await prisma.archiveRecord.findUnique({
      where: { caseId },
    });

    if (existing && existing.status === 'archived') {
      return res.status(409).json({ error: 'Case is already archived' });
    }

    // Gather evidence data for the archive manifest
    const integrityReports = await prisma.evidenceIntegrityReport.findMany({
      where: { caseId },
    });

    const timelineCount = await prisma.timelineEvent.count({ where: { caseId } });
    const entityCount = await prisma.entity.count({ where: { caseId } });
    const narrativeCount = await prisma.caseNarrative.count({ where: { caseId } });

    const manifest = {
      caseId,
      archivedAt: new Date().toISOString(),
      reason: reason || 'subscription_cancellation',
      evidenceFiles: integrityReports.map((r) => ({
        evidenceId: r.evidenceId,
        fileName: r.fileName,
        sha256: r.sha256Hash,
        sha3: r.sha3Hash,
      })),
      counts: {
        evidence: integrityReports.length,
        timelineEvents: timelineCount,
        entities: entityCount,
        narratives: narrativeCount,
      },
    };

    // Compute archive hash from manifest
    const manifestString = JSON.stringify(manifest, Object.keys(manifest).sort());
    const archiveHash = crypto.createHash('sha256').update(manifestString).digest('hex');

    const archive = await prisma.archiveRecord.upsert({
      where: { caseId },
      update: {
        archiveHash,
        archiveLocation: `cold-archive/${caseId}/${archiveHash}`,
        archiveManifest: manifest,
        status: 'archived',
        fileCount: integrityReports.length,
      },
      create: {
        caseId,
        archiveHash,
        archiveLocation: `cold-archive/${caseId}/${archiveHash}`,
        archiveManifest: manifest,
        status: 'archived',
        fileCount: integrityReports.length,
        totalSizeBytes: 0,
      },
    });

    // Audit log entry
    await prisma.archiveAuditLog.create({
      data: {
        caseId,
        action: 'archive_completed',
        actor: actor || 'system',
        details: {
          archiveHash,
          fileCount: integrityReports.length,
          reason: reason || 'subscription_cancellation',
        },
      },
    });

    console.log(JSON.stringify({
      event: 'case_archived',
      caseId,
      archiveHash,
      fileCount: integrityReports.length,
      timestamp: new Date().toISOString(),
    }));

    res.status(201).json({ archive });
  } catch (err) {
    console.error('[Archive] Archive error:', err.message);
    res.status(500).json({ error: 'Failed to archive case' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/archives/:caseId/restore — Restore from cold archive
// ---------------------------------------------------------------------------

router.post('/:caseId/restore', async (req, res) => {
  try {
    const { caseId } = req.params;
    const { actor } = req.body;

    const archive = await prisma.archiveRecord.findUnique({
      where: { caseId },
    });

    if (!archive) {
      return res.status(404).json({ error: 'No archive found for this case' });
    }

    if (archive.status === 'restored') {
      return res.status(409).json({ error: 'Case is already restored' });
    }

    if (archive.status === 'restoring') {
      return res.status(409).json({ error: 'Case restoration is already in progress' });
    }

    // Verify archive hash
    const manifest = archive.archiveManifest;
    const manifestString = JSON.stringify(manifest, Object.keys(manifest).sort());
    const computedHash = crypto.createHash('sha256').update(manifestString).digest('hex');

    if (computedHash !== archive.archiveHash) {
      await prisma.archiveAuditLog.create({
        data: {
          caseId,
          action: 'hash_failed',
          actor: actor || 'system',
          details: {
            storedHash: archive.archiveHash,
            computedHash,
          },
        },
      });

      return res.status(500).json({
        error: 'Archive integrity verification failed',
        storedHash: archive.archiveHash,
        computedHash,
      });
    }

    // Hash verified — proceed with restore
    await prisma.archiveAuditLog.create({
      data: {
        caseId,
        action: 'hash_verified',
        actor: actor || 'system',
        details: { archiveHash: archive.archiveHash },
      },
    });

    const updated = await prisma.archiveRecord.update({
      where: { caseId },
      data: { status: 'restored' },
    });

    await prisma.archiveAuditLog.create({
      data: {
        caseId,
        action: 'restore_completed',
        actor: actor || 'system',
        details: {
          archiveHash: archive.archiveHash,
          fileCount: archive.fileCount,
        },
      },
    });

    console.log(JSON.stringify({
      event: 'case_restored',
      caseId,
      archiveHash: archive.archiveHash,
      timestamp: new Date().toISOString(),
    }));

    res.json({ archive: updated });
  } catch (err) {
    console.error('[Archive] Restore error:', err.message);
    res.status(500).json({ error: 'Failed to restore case' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/archives/:caseId/audit — Get audit log for a case
// ---------------------------------------------------------------------------

router.get('/:caseId/audit', async (req, res) => {
  try {
    const { caseId } = req.params;

    const auditLog = await prisma.archiveAuditLog.findMany({
      where: { caseId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ auditLog, count: auditLog.length });
  } catch (err) {
    console.error('[Archive] Audit error:', err.message);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

export default router;
