// ============================================================================
// Phase 83 — Generate First Intelligence Dataset
// Run coverage matrix generator and produce statewide intelligence report.
// Usage: npx tsx backend/src/policy/pipeline/phase83_intelligenceDataset.ts
// ============================================================================

import { importChpPolicies } from './chpPolicyImportService.js';
import { generateCoverageMatrix } from './coverageMatrixGenerator.js';
import { runClassificationValidation } from './classificationValidator.js';

async function main() {
  console.log('='.repeat(80));
  console.log('Phase 83 — First Intelligence Dataset Generation');
  console.log('='.repeat(80));
  console.log();

  const startTime = Date.now();

  // Step 1: Ensure CHP baseline is imported
  console.log('[Step 1] Importing CHP policy baseline...');
  try {
    const chpResult = await importChpPolicies();
    console.log(`  Status:             ${chpResult.status}`);
    console.log(`  Documents Imported: ${chpResult.totalDocumentsImported}`);
    console.log(`  Topics Seeded:      ${chpResult.totalTopicsSeeded}`);
    console.log(`  Coverage Entries:   ${chpResult.totalCoverageEntries}`);
    console.log(`  Created:            ${chpResult.documentsCreated}`);
    console.log(`  Updated:            ${chpResult.documentsUpdated}`);
    console.log(`  Duration:           ${chpResult.duration}ms`);

    if (chpResult.errors.length > 0) {
      console.log(`  Errors (${chpResult.errors.length}):`);
      for (const err of chpResult.errors.slice(0, 10)) {
        console.log(`    - ${err}`);
      }
      if (chpResult.errors.length > 10) {
        console.log(`    ... and ${chpResult.errors.length - 10} more`);
      }
    }

    console.log();
    console.log('  Topics by Category:');
    for (const [category, count] of Object.entries(chpResult.topicsByCategory)) {
      console.log(`    ${category.padEnd(30)} ${count}`);
    }
  } catch (error) {
    console.error('  CHP import failed:', error);
  }

  // Step 2: Run classification validation
  console.log();
  console.log('[Step 2] Running classification validation...');
  try {
    const validation = await runClassificationValidation();
    console.log(`  Total Documents:    ${validation.totalDocuments}`);
    console.log(`  Matches:            ${validation.matches}`);
    console.log(`  Mismatches:         ${validation.mismatches}`);
    console.log(`  Unclassified:       ${validation.unclassified}`);
    console.log(`  Accuracy:           ${validation.accuracy.toFixed(2)}%`);

    if (validation.documentsChanged.length > 0) {
      console.log();
      console.log(`  Classification Changes (${validation.documentsChanged.length}):`);
      for (const change of validation.documentsChanged.slice(0, 10)) {
        console.log(`    ${change.documentId}: ${change.previousTopicId || 'none'} → ${change.newTopicId || 'none'} (${(change.confidence * 100).toFixed(0)}%)`);
      }
    }

    if (validation.accuracyByCategory) {
      console.log();
      console.log('  Accuracy by Category:');
      for (const [category, stats] of Object.entries(validation.accuracyByCategory)) {
        const s = stats as { total: number; matches: number; accuracy: number };
        console.log(`    ${category.padEnd(30)} ${s.accuracy.toFixed(1)}% (${s.matches}/${s.total})`);
      }
    }
  } catch (error) {
    console.error('  Classification validation failed:', error);
  }

  // Step 3: Generate coverage matrix
  console.log();
  console.log('[Step 3] Generating statewide coverage matrix...');
  try {
    const matrix = await generateCoverageMatrix();

    console.log();
    console.log('='.repeat(80));
    console.log('COVERAGE MATRIX REPORT');
    console.log('='.repeat(80));
    console.log();
    console.log('System-Wide Statistics:');
    console.log(`  Total Topics:       ${matrix.systemStats.totalTopics}`);
    console.log(`  Total Agencies:     ${matrix.systemStats.totalAgencies}`);
    console.log(`  Avg Coverage:       ${matrix.systemStats.averageCoveragePercent.toFixed(1)}%`);
    console.log(`  Full Coverage:      ${matrix.systemStats.agenciesWithFullCoverage}`);
    console.log(`  Partial Coverage:   ${matrix.systemStats.agenciesWithPartialCoverage}`);
    console.log(`  No Coverage:        ${matrix.systemStats.agenciesWithNoCoverage}`);

    console.log();
    console.log('Population Results:');
    console.log(`  Agencies Processed: ${matrix.populationResult.agenciesProcessed}`);
    console.log(`  New Entries:        ${matrix.populationResult.totalNewEntries}`);
    console.log(`  Updated:            ${matrix.populationResult.totalUpdated}`);

    console.log();
    console.log(`Top Agencies (${matrix.topAgencies.length}):`);
    console.log('  ' + 'Agency'.padEnd(35) + 'Coverage'.padEnd(12) + 'Missing Critical');
    console.log('  ' + '-'.repeat(65));
    for (const agency of matrix.topAgencies.slice(0, 20)) {
      const coverage = `${agency.coveragePercent.toFixed(1)}%`;
      const missing = agency.missingCritical.length > 0
        ? agency.missingCritical.join(', ')
        : 'None';
      console.log(`  ${agency.agencyName.padEnd(35)} ${coverage.padEnd(12)} ${missing}`);
    }

    console.log();
    console.log(`Critical Gaps (${matrix.criticalGaps.length}):`);
    console.log('  ' + 'Agency'.padEnd(30) + 'Missing Policy'.padEnd(30) + 'Pop. Affected');
    console.log('  ' + '-'.repeat(75));
    for (const gap of matrix.criticalGaps.slice(0, 20)) {
      console.log(`  ${gap.agencyName.padEnd(30)} ${gap.missingTopicName.padEnd(30)} ${gap.populationAffected.toLocaleString()}`);
    }

    console.log();
    console.log('Category Analysis:');
    console.log('  ' + 'Category'.padEnd(30) + 'Topics'.padEnd(8) + 'Full'.padEnd(8) + 'Partial'.padEnd(10) + 'None'.padEnd(8) + 'Avg %');
    console.log('  ' + '-'.repeat(75));
    for (const cat of matrix.categoryAnalysis) {
      console.log(
        `  ${cat.displayName.padEnd(30)} ${String(cat.totalTopics).padEnd(8)} ` +
        `${String(cat.agenciesWithFullCoverage).padEnd(8)} ` +
        `${String(cat.agenciesWithPartialCoverage).padEnd(10)} ` +
        `${String(cat.agenciesWithNoCoverage).padEnd(8)} ` +
        `${cat.averageCoveragePercent.toFixed(1)}%`,
      );
    }

    console.log();
    console.log('Statewide Coverage by Topic:');
    console.log('  ' + 'Topic'.padEnd(40) + 'With'.padEnd(8) + 'Without'.padEnd(10) + 'Coverage');
    console.log('  ' + '-'.repeat(70));
    for (const topic of matrix.statewideCoverageByTopic.slice(0, 30)) {
      console.log(
        `  ${topic.topicName.substring(0, 38).padEnd(40)} ` +
        `${String(topic.agenciesWithPolicy).padEnd(8)} ` +
        `${String(topic.agenciesWithoutPolicy).padEnd(10)} ` +
        `${topic.coveragePercent.toFixed(1)}%`,
      );
    }

  } catch (error) {
    console.error('  Coverage matrix generation failed:', error);
  }

  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log();
  console.log('='.repeat(80));
  console.log(`Phase 83 Complete — Total Duration: ${totalDuration}s`);
  console.log('='.repeat(80));

  process.exit(0);
}

main();
