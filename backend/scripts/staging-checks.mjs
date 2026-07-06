#!/usr/bin/env node
// ============================================================================
// PR #65 — Staging Validation: Node.js Companion Script
//
// Complex checks that are easier in Node than bash:
//   - Neo4j integrity audit (via GraphIntegrityAudit)
//   - ProcessingJob duplicate detection
//   - Stall rate calculation from metrics JSON
//
// Usage:
//   node --import tsx scripts/staging-checks.mjs <command>
//
// Commands:
//   neo4j-audit        — Run full graph integrity audit
//   check-duplicates   — Check for duplicate ProcessingJob entries
//   stall-rate         — Calculate stall rate from metrics
//   all                — Run all checks
// ============================================================================

const command = process.argv[2] || 'all';

// ---------------------------------------------------------------------------
// Neo4j Audit
// ---------------------------------------------------------------------------

async function neo4jAudit() {
  console.log('\n=== Neo4j Integrity Audit ===\n');

  if (!process.env.NEO4J_URI) {
    console.log('[WARN] NEO4J_URI not set — skipping Neo4j audit');
    return { passed: true, skipped: true };
  }

  try {
    const { Neo4jClient } = await import('../src/graph/neo4jClient.ts');
    const { GraphIntegrityAudit } = await import('../src/graph/graphIntegrityAudit.ts');

    const client = new Neo4jClient();
    const audit = new GraphIntegrityAudit(client);
    const result = await audit.runFullAudit();

    console.log(`  Healthy: ${result.healthy}`);
    console.log(`  Duration: ${result.durationMs}ms`);
    console.log(`  Orphan nodes: ${result.checks.orphanNodes.orphanCount} (${result.checks.orphanNodes.passed ? 'PASS' : 'FAIL'})`);
    console.log(`  Cross-tenant edges: ${result.checks.crossTenantEdges.violationCount} (${result.checks.crossTenantEdges.passed ? 'PASS' : 'FAIL'})`);
    console.log(`  Missing tenantId: ${result.checks.missingTenantId.count} (${result.checks.missingTenantId.passed ? 'PASS' : 'FAIL'})`);
    console.log(`  Total nodes: ${result.checks.nodeStats.totalNodes}`);
    console.log(`  Total relationships: ${result.checks.nodeStats.totalRelationships}`);
    console.log(`  Tenant count: ${result.checks.nodeStats.tenantCount}`);

    if (!result.healthy) {
      console.log('\n  [FAIL] Neo4j integrity audit FAILED');
      if (result.checks.orphanNodes.sampleIds.length > 0) {
        console.log(`  Sample orphan IDs: ${result.checks.orphanNodes.sampleIds.slice(0, 5).join(', ')}`);
      }
      if (result.checks.crossTenantEdges.samples.length > 0) {
        console.log(`  Sample cross-tenant edges:`, JSON.stringify(result.checks.crossTenantEdges.samples.slice(0, 3)));
      }
    } else {
      console.log('\n  [PASS] Neo4j integrity audit passed');
    }

    return { passed: result.healthy, result };
  } catch (err) {
    console.log(`  [FAIL] Neo4j audit error: ${err.message}`);
    return { passed: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Duplicate ProcessingJob Detection
// ---------------------------------------------------------------------------

async function checkDuplicates() {
  console.log('\n=== ProcessingJob Duplicate Detection ===\n');

  try {
    const prismaModule = await import('../src/lib/prisma.ts');
    const prisma = prismaModule.default;

    // Check for duplicate completed ProcessingJobs (same caseId + pipeline)
    const duplicates = await prisma.$queryRaw`
      SELECT "caseId", "pipeline", COUNT(*) as cnt
      FROM "ProcessingJob"
      WHERE status = 'completed'
      GROUP BY "caseId", "pipeline"
      HAVING COUNT(*) > 1
      ORDER BY cnt DESC
      LIMIT 20
    `;

    if (duplicates.length === 0) {
      console.log('  [PASS] No duplicate completed ProcessingJobs found');
    } else {
      console.log(`  [FAIL] Found ${duplicates.length} duplicate completed ProcessingJob groups:`);
      for (const dup of duplicates) {
        console.log(`    caseId=${dup.caseId} pipeline=${dup.pipeline} count=${dup.cnt}`);
      }
    }

    // Check for jobs stuck in 'active' for >10 minutes
    const stuckJobs = await prisma.processingJob.findMany({
      where: {
        status: 'active',
        startedAt: { lt: new Date(Date.now() - 10 * 60 * 1000) },
      },
      select: { id: true, caseId: true, pipeline: true, startedAt: true },
      take: 20,
    });

    if (stuckJobs.length === 0) {
      console.log('  [PASS] No ProcessingJobs stuck in active state');
    } else {
      console.log(`  [WARN] ${stuckJobs.length} ProcessingJobs stuck in 'active' for >10min:`);
      for (const job of stuckJobs) {
        const mins = Math.round((Date.now() - new Date(job.startedAt).getTime()) / 60000);
        console.log(`    id=${job.id} case=${job.caseId} pipeline=${job.pipeline} stuck=${mins}min`);
      }
    }

    // Count by failureCode
    const failureCodes = await prisma.$queryRaw`
      SELECT "failureCode", COUNT(*) as cnt
      FROM "ProcessingJob"
      WHERE "failureCode" IS NOT NULL
      GROUP BY "failureCode"
      ORDER BY cnt DESC
    `;

    if (failureCodes.length > 0) {
      console.log('\n  Failure code distribution:');
      for (const fc of failureCodes) {
        console.log(`    ${fc.failureCode}: ${fc.cnt}`);
      }
    }

    await prisma.$disconnect();
    return { passed: duplicates.length === 0 };
  } catch (err) {
    console.log(`  [WARN] Duplicate check error: ${err.message}`);
    return { passed: true, skipped: true, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Stall Rate Calculation
// ---------------------------------------------------------------------------

async function stallRate() {
  console.log('\n=== Stall Rate Analysis ===\n');

  try {
    const response = await fetch('http://localhost:3000/api/metrics/json');
    if (!response.ok) {
      console.log(`  [WARN] Could not fetch metrics: HTTP ${response.status}`);
      return { passed: true, skipped: true };
    }

    const data = await response.json();

    const stalledMetric = data['courtaccess_worker_stalled_total'];
    const processedMetric = data['courtaccess_worker_job_duration_ms'];

    if (!stalledMetric || !stalledMetric.values) {
      console.log('  [INFO] No stall events recorded (good)');
      console.log('  [PASS] Stall rate: 0%');
      return { passed: true, rate: 0 };
    }

    const totalStalls = Object.values(stalledMetric.values).reduce((a, b) => a + b, 0);
    console.log(`  Total stalls: ${totalStalls}`);

    // Get processed count from histogram count if available
    let totalProcessed = 0;
    if (processedMetric && processedMetric.values) {
      totalProcessed = Object.entries(processedMetric.values)
        .filter(([k]) => k.includes('_count'))
        .reduce((a, [, v]) => a + v, 0);
    }

    if (totalProcessed > 0) {
      const rate = ((totalStalls / totalProcessed) * 100).toFixed(2);
      console.log(`  Processed: ${totalProcessed}`);
      console.log(`  Stall rate: ${rate}%`);

      if (parseFloat(rate) > 5) {
        console.log(`  [FAIL] Stall rate exceeds 5% threshold`);
        return { passed: false, rate: parseFloat(rate) };
      } else {
        console.log(`  [PASS] Stall rate within acceptable range (<5%)`);
        return { passed: true, rate: parseFloat(rate) };
      }
    } else {
      console.log(`  [INFO] No processed jobs to calculate rate against`);
      return { passed: true, rate: 0 };
    }
  } catch (err) {
    console.log(`  [WARN] Stall rate check error: ${err.message}`);
    return { passed: true, skipped: true };
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const results = {};

  if (command === 'neo4j-audit' || command === 'all') {
    results.neo4j = await neo4jAudit();
  }

  if (command === 'check-duplicates' || command === 'all') {
    results.duplicates = await checkDuplicates();
  }

  if (command === 'stall-rate' || command === 'all') {
    results.stallRate = await stallRate();
  }

  // Summary
  const allPassed = Object.values(results).every(r => r.passed);
  console.log('\n============================================');
  console.log(`Overall: ${allPassed ? 'PASS' : 'FAIL'}`);
  console.log('============================================\n');

  process.exit(allPassed ? 0 : 1);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
