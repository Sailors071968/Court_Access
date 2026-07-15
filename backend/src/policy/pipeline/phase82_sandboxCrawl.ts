// ============================================================================
// Phase 82 — Execute Sandbox Crawl
// Run the full pipeline for 10 pilot California agencies.
// Usage: npx tsx backend/src/policy/pipeline/phase82_sandboxCrawl.ts
// ============================================================================

import { executeSandboxCrawl, getSandboxExecutionStatus } from './sandboxCrawlExecutor.js';

async function main() {
  console.log('='.repeat(80));
  console.log('Phase 82 — Sandbox Crawl Execution');
  console.log('Target: 10 California pilot agencies');
  console.log('='.repeat(80));
  console.log();

  const startTime = Date.now();

  try {
    const result = await executeSandboxCrawl();

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log();
    console.log('='.repeat(80));
    console.log('SANDBOX CRAWL REPORT');
    console.log('='.repeat(80));
    console.log();
    console.log(`Status:               ${result.status}`);
    console.log(`Duration:             ${duration}s`);
    console.log(`Agencies Processed:   ${result.agenciesProcessed}`);
    console.log(`Agencies Succeeded:   ${result.agenciesSucceeded}`);
    console.log(`Agencies Failed:      ${result.agenciesFailed}`);
    console.log(`Policies Discovered:  ${result.totalPoliciesDiscovered}`);
    console.log(`Documents Downloaded: ${result.totalDocumentsDownloaded}`);
    console.log(`Documents Classified: ${result.totalDocumentsClassified}`);
    console.log(`Coverage Mappings:    ${result.totalCoverageMappings}`);

    console.log();
    console.log('--- Per-Agency Results ---');
    for (const agency of result.agencyResults) {
      console.log();
      console.log(`  ${agency.agencyName}`);
      console.log(`    Status:      ${agency.status}`);
      console.log(`    Policies:    ${agency.policiesDiscovered}`);
      console.log(`    Downloaded:  ${agency.documentsDownloaded}`);
      console.log(`    Classified:  ${agency.documentsClassified}`);
      console.log(`    Coverage:    ${agency.coverageMappings}`);
      if (agency.errors.length > 0) {
        console.log(`    Errors:      ${agency.errors.join('; ')}`);
      }
    }

    // Also print current execution status
    const status = getSandboxExecutionStatus();
    if (status) {
      console.log();
      console.log('--- Execution Status Snapshot ---');
      console.log(`  Run ID:    ${status.runId}`);
      console.log(`  Started:   ${status.startedAt}`);
      console.log(`  Completed: ${status.completedAt || 'N/A'}`);
    }

    console.log();
    console.log('='.repeat(80));
    console.log('Phase 82 Complete');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('Phase 82 FAILED:', error);
    process.exit(1);
  }

  process.exit(0);
}

main();
