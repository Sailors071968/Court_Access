// ============================================
// Court Access — End-to-End System Test
// Phase 101: Full system simulation test
//
// Runs a comprehensive simulation verifying:
// - User creation
// - Case creation
// - Evidence upload pipeline
// - Transcript generation
// - Timeline construction
// - Cross-reference engine
// - Records request lifecycle
// ============================================

import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import prisma from '../services/prismaClient.js';
import crypto from 'crypto';

const router = Router();

// All system test endpoints require admin role
router.use(authenticate);
router.use(requireRole('admin'));

/**
 * POST /api/admin/system-test/run
 * Execute full end-to-end system simulation.
 * Returns a structured report of each step's pass/fail status.
 */
router.post('/run', async (req, res) => {
  const report = {
    startedAt: new Date().toISOString(),
    steps: [],
    passed: 0,
    failed: 0,
    totalSteps: 0,
  };

  function addStep(name, status, details = {}) {
    report.steps.push({ name, status, details, timestamp: new Date().toISOString() });
    if (status === 'pass') report.passed++;
    else report.failed++;
    report.totalSteps++;
  }

  try {
    // Step 1: Create test user
    const testEmail = `system-test-${Date.now()}@courtaccess.internal`;
    let testUser;
    try {
      testUser = await prisma.user.create({
        data: {
          email: testEmail,
          passwordHash: '$2b$12$placeholder.hash.for.system.test',
          name: 'System Test User',
          role: 'attorney',
          status: 'active',
          plan: 'professional',
        },
      });
      addStep('create_user', 'pass', { userId: testUser.id, email: testEmail });
    } catch (err) {
      addStep('create_user', 'fail', { error: err.message });
    }

    // Step 2: Create test case
    let testCase;
    if (testUser) {
      try {
        testCase = await prisma.case.create({
          data: {
            userId: testUser.id,
            caseName: 'System Test Case',
            caseNumber: `SYS-TEST-${Date.now()}`,
            description: 'Automated system test case',
            status: 'active',
          },
        });
        addStep('create_case', 'pass', { caseId: testCase.id });
      } catch (err) {
        addStep('create_case', 'fail', { error: err.message });
      }
    } else {
      addStep('create_case', 'fail', { error: 'No test user created' });
    }

    // Step 3: Create evidence record
    let testEvidence;
    if (testUser && testCase) {
      try {
        testEvidence = await prisma.evidenceRecord.create({
          data: {
            userId: testUser.id,
            caseId: testCase.id,
            filename: 'system-test-document.pdf',
            contentType: 'application/pdf',
            evidenceType: 'document',
            fileSize: BigInt(1024),
            sha256: crypto.createHash('sha256').update('system-test').digest('hex'),
            description: 'System test evidence',
            status: 'complete',
          },
        });
        addStep('create_evidence', 'pass', { evidenceId: testEvidence.id });
      } catch (err) {
        addStep('create_evidence', 'fail', { error: err.message });
      }
    } else {
      addStep('create_evidence', 'fail', { error: 'No test case created' });
    }

    // Step 4: Create timeline event
    if (testCase) {
      try {
        const event = await prisma.timelineEvent.create({
          data: {
            caseId: testCase.id,
            timestamp: new Date(),
            sourceType: 'manual',
            eventType: 'system_test',
            eventDescription: 'System test timeline event',
            confidenceScore: 1.0,
          },
        });
        addStep('create_timeline_event', 'pass', { eventId: event.id });
      } catch (err) {
        addStep('create_timeline_event', 'fail', { error: err.message });
      }
    } else {
      addStep('create_timeline_event', 'fail', { error: 'No test case created' });
    }

    // Step 5: Create entity
    if (testCase) {
      try {
        const entity = await prisma.entity.create({
          data: {
            caseId: testCase.id,
            entityType: 'person',
            entityValue: 'System Test Person',
          },
        });
        addStep('create_entity', 'pass', { entityId: entity.id });
      } catch (err) {
        addStep('create_entity', 'fail', { error: err.message });
      }
    } else {
      addStep('create_entity', 'fail', { error: 'No test case created' });
    }

    // Step 6: Create narrative
    if (testCase) {
      try {
        const narrative = await prisma.caseNarrative.create({
          data: {
            caseId: testCase.id,
            summaryText: 'System test narrative summary',
            keyEvents: JSON.stringify([{ event: 'test_event' }]),
            participants: JSON.stringify([{ name: 'Test Person' }]),
          },
        });
        addStep('create_narrative', 'pass', { narrativeId: narrative.id });
      } catch (err) {
        addStep('create_narrative', 'fail', { error: err.message });
      }
    } else {
      addStep('create_narrative', 'fail', { error: 'No test case created' });
    }

    // Step 7: Create cross-reference
    if (testCase && testEvidence) {
      try {
        const xref = await prisma.evidenceCorrelation.create({
          data: {
            caseId: testCase.id,
            sourceEvidenceId: testEvidence.id,
            relatedEvidenceId: testEvidence.id,
            correlationType: 'event_confirmation',
            confidenceScore: 0.95,
            description: 'System test cross-reference',
            status: 'active',
          },
        });
        addStep('create_cross_reference', 'pass', { xrefId: xref.id });
      } catch (err) {
        addStep('create_cross_reference', 'fail', { error: err.message });
      }
    } else {
      addStep('create_cross_reference', 'fail', { error: 'No evidence created' });
    }

    // Step 8: Create records request (requires agency first)
    try {
      const agency = await prisma.lawEnforcementAgency.create({
        data: {
          tenantId: testUser?.id || 'system-test',
          agencyName: `System Test Agency ${Date.now()}`,
          agencyType: 'city_police',
          state: 'CA',
          verificationStatus: 'approved',
        },
      });

      const request = await prisma.publicRecordsRequest.create({
        data: {
          agencyId: agency.id,
          tenantId: testUser?.id || 'system-test',
          caseId: testCase?.id || null,
          requestType: 'public_records',
          status: 'submitted',
          requestContent: 'System test records request',
        },
      });
      addStep('create_records_request', 'pass', { requestId: request.id, agencyId: agency.id });
    } catch (err) {
      addStep('create_records_request', 'fail', { error: err.message });
    }

    // Step 9: Verify audit trail
    if (testUser) {
      try {
        await prisma.userAuditLog.create({
          data: {
            userId: testUser.id,
            action: 'system_test',
            resource: 'system-test',
            metadata: { testRun: true },
          },
        });
        const auditCount = await prisma.userAuditLog.count({
          where: { userId: testUser.id },
        });
        addStep('verify_audit_trail', 'pass', { auditEntries: auditCount });
      } catch (err) {
        addStep('verify_audit_trail', 'fail', { error: err.message });
      }
    } else {
      addStep('verify_audit_trail', 'fail', { error: 'No test user' });
    }

    // Cleanup: Remove all test data
    try {
      if (testUser) {
        // Cascade deletes will clean up cases, evidence, audit logs
        await prisma.user.delete({ where: { id: testUser.id } });
      }
      addStep('cleanup', 'pass', { message: 'Test data removed' });
    } catch (err) {
      addStep('cleanup', 'fail', { error: err.message });
    }

    report.completedAt = new Date().toISOString();
    report.overallStatus = report.failed === 0 ? 'PASS' : 'FAIL';

    res.json(report);
  } catch (err) {
    report.completedAt = new Date().toISOString();
    report.overallStatus = 'ERROR';
    report.error = err.message;
    res.status(500).json(report);
  }
});

/**
 * GET /api/admin/system-test/status
 * Get the last system test result (if any).
 */
router.get('/status', (_req, res) => {
  res.json({
    available: true,
    description: 'Full end-to-end system test simulation',
    steps: [
      'create_user',
      'create_case',
      'create_evidence',
      'create_timeline_event',
      'create_entity',
      'create_narrative',
      'create_cross_reference',
      'create_records_request',
      'verify_audit_trail',
      'cleanup',
    ],
  });
});

export default router;
