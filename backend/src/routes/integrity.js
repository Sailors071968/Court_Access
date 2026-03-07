// ============================================
// Court Access — Phase D: Evidence Integrity Certificates API
// Generate and retrieve forensic integrity certificates.
// ============================================

import express from 'express';
import prisma from '../services/prismaClient.js';
import { authenticate } from '../middleware/auth.js';
import { verifyCaseOwnership } from '../middleware/tenantIsolation.js';

const router = express.Router();

// Phase 94: All integrity routes require authentication + case ownership
router.use(authenticate);

// ---------------------------------------------------------------------------
// GET /api/integrity/:caseId — List all integrity reports for a case
// ---------------------------------------------------------------------------

router.get('/:caseId', verifyCaseOwnership, async (req, res) => {
  try {
    const { caseId } = req.params;

    const reports = await prisma.evidenceIntegrityReport.findMany({
      where: { caseId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ reports, count: reports.length });
  } catch (err) {
    console.error('[Integrity] List error:', err.message);
    res.status(500).json({ error: 'Failed to fetch integrity reports' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/integrity/:caseId/:evidenceId — Get integrity certificate
// ---------------------------------------------------------------------------

router.get('/:caseId/:evidenceId', verifyCaseOwnership, async (req, res) => {
  try {
    const { caseId, evidenceId } = req.params;

    const report = await prisma.evidenceIntegrityReport.findFirst({
      where: { evidenceId, caseId },
    });

    if (!report) {
      return res.status(404).json({ error: 'Integrity report not found' });
    }

    res.json({ certificate: report });
  } catch (err) {
    console.error('[Integrity] Get error:', err.message);
    res.status(500).json({ error: 'Failed to fetch integrity certificate' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/integrity/:caseId/:evidenceId/export — Export as JSON certificate
// ---------------------------------------------------------------------------

router.get('/:caseId/:evidenceId/export', verifyCaseOwnership, async (req, res) => {
  try {
    const { caseId, evidenceId } = req.params;

    const report = await prisma.evidenceIntegrityReport.findFirst({
      where: { evidenceId, caseId },
    });

    if (!report) {
      return res.status(404).json({ error: 'Integrity report not found' });
    }

    const certificate = {
      certificateVersion: '1.0',
      platform: 'Court Access',
      issuedAt: new Date().toISOString(),
      evidence: {
        evidenceId: report.evidenceId,
        caseId: report.caseId,
        fileName: report.fileName,
        uploadTimestamp: report.uploadTimestamp.toISOString(),
      },
      integrity: {
        sha256: report.sha256Hash,
        sha3_256: report.sha3Hash,
        verificationStatus: report.verificationStatus,
        dualHashVerified: report.verificationStatus === 'verified',
      },
      chainOfCustody: report.chainOfCustody,
      disclaimer: 'This certificate verifies the cryptographic integrity of the evidence file at the time of upload. SHA-256 and SHA3-256 hashes were computed from the original file bytes.',
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="integrity-cert-${evidenceId}.json"`);
    res.json(certificate);
  } catch (err) {
    console.error('[Integrity] Export error:', err.message);
    res.status(500).json({ error: 'Failed to export integrity certificate' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/integrity/:caseId — Create integrity report for evidence
// ---------------------------------------------------------------------------

router.post('/:caseId', verifyCaseOwnership, async (req, res) => {
  try {
    const { caseId } = req.params;
    const {
      evidenceId,
      fileName,
      sha256Hash,
      sha3Hash,
      uploadTimestamp,
      verificationStatus,
      chainOfCustody,
    } = req.body;

    if (!evidenceId || !sha256Hash || !sha3Hash) {
      return res.status(400).json({ error: 'evidenceId, sha256Hash, and sha3Hash are required' });
    }

    // Verify caseId ownership: if report already exists for this evidenceId,
    // it must belong to the same case to prevent cross-case data corruption
    const existing = await prisma.evidenceIntegrityReport.findUnique({
      where: { evidenceId },
    });
    if (existing && existing.caseId !== caseId) {
      return res.status(409).json({
        error: 'Evidence integrity report already exists under a different case',
      });
    }

    const report = await prisma.evidenceIntegrityReport.upsert({
      where: { evidenceId },
      update: {
        sha256Hash,
        sha3Hash,
        verificationStatus: verificationStatus || 'verified',
        chainOfCustody: chainOfCustody || [],
      },
      create: {
        evidenceId,
        caseId,
        fileName: fileName || '',
        sha256Hash,
        sha3Hash,
        uploadTimestamp: new Date(uploadTimestamp || Date.now()),
        verificationStatus: verificationStatus || 'verified',
        chainOfCustody: chainOfCustody || [],
      },
    });

    console.log(JSON.stringify({
      event: 'integrity_report_created',
      evidenceId,
      caseId,
      verificationStatus: report.verificationStatus,
      timestamp: new Date().toISOString(),
    }));

    res.status(201).json(report);
  } catch (err) {
    console.error('[Integrity] Create error:', err.message);
    res.status(500).json({ error: 'Failed to create integrity report' });
  }
});

export default router;
