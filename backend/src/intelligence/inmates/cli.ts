#!/usr/bin/env node
// ============================================================================
// CLI trigger for the ingestion engine.
//
// One of several adapters, and deliberately thin: it parses arguments, calls
// runIngestion, and prints. It contains no ingestion logic, so a systemd timer
// (which calls this), cron (which calls this), or a queue worker (which would
// call runIngestion directly) all produce identical results.
//
//   node --env-file=/var/www/courtaccess-v1/.env dist/inmate-cli.js \
//     ingest --file /path/roster.csv --facility example-county --dry-run
//
// Exit status: 0 on success, 1 on failure, 2 when a batch completed but rows need
// human review — so a timer can distinguish "nothing to do" from "someone should
// look at this" without parsing the output.
// ============================================================================

import { Command } from 'commander';

import { runIngestion } from './ingestionEngine.js';
import { listColumnMaps } from './parsers/columnMaps.js';
import type { IngestionTrigger } from './types.js';

const program = new Command();

program
  .name('inmate-intelligence')
  .description('Ingest jail rosters into the CourtAccess inmate intelligence repository')
  .version('1.0.0');

program
  .command('ingest')
  .requiredOption('-f, --file <path>', 'roster file (.csv or .pdf)')
  .requiredOption('-c, --facility <id>', 'facility identifier, selecting the column map')
  .option('--roster-date <date>', 'the date the roster represents (ISO)')
  .option('--dry-run', 'parse, normalize and resolve without writing', false)
  .option('--trigger <origin>', 'manual | cli | timer | queue', 'cli')
  .option('--json', 'emit the outcome as JSON', false)
  .action(async (options: {
    file: string; facility: string; rosterDate?: string;
    dryRun: boolean; trigger: string; json: boolean;
  }) => {
    const outcome = await runIngestion({
      filePath: options.file,
      facility: options.facility,
      trigger: (['manual', 'cli', 'timer', 'queue'].includes(options.trigger)
        ? options.trigger : 'cli') as IngestionTrigger,
      dryRun: options.dryRun,
      rosterDate: options.rosterDate,
    });

    if (options.json) {
      console.log(JSON.stringify(outcome, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2));
    } else {
      print(outcome);
    }

    if (outcome.status === 'failed') process.exit(1);
    if (outcome.counts.needsReview > 0) process.exit(2);
  });

program
  .command('facilities')
  .description('list the registered column maps')
  .action(() => {
    for (const m of listColumnMaps()) console.log(`  ${m.facility.padEnd(20)} ${m.label}`);
  });

function print(outcome: Awaited<ReturnType<typeof runIngestion>>): void {
  const c = outcome.counts;
  console.log('');
  console.log(`  ${outcome.dryRun ? 'DRY RUN' : 'INGESTION'} — ${outcome.status.toUpperCase()}`);
  console.log(`  source           ${outcome.sourceType}  ${outcome.sourceSha256.slice(0, 16)}…`);
  if (outcome.batchId) console.log(`  batch            ${outcome.batchId}`);
  console.log(`  duration         ${outcome.durationMs} ms`);
  console.log('');
  console.log(`  bookings         ${c.total}`);
  console.log(`  new inmates      ${c.newInmates}`);
  console.log(`  matched          ${c.matched}`);
  console.log(`  duplicates       ${c.duplicates}`);
  console.log(`  needs review     ${c.needsReview}`);
  console.log(`  failed           ${c.failed}`);

  if (outcome.extractionStats?.ocrUsed) {
    const s = outcome.extractionStats;
    console.log('');
    console.log(`  OCR used. Pages: ${s.pageCount ?? '?'}, empty: ${s.emptyPages?.length ?? 0}`);
    if ((s.emptyPages?.length ?? 0) > 0) {
      console.log('  An empty OCR page is indistinguishable from a blank page. Confirm before accepting.');
    }
  }

  const errors = outcome.issues.filter((i) => i.severity === 'error');
  const warnings = outcome.issues.filter((i) => i.severity === 'warning');
  if (errors.length || warnings.length) {
    console.log('');
    console.log(`  issues           ${errors.length} error(s), ${warnings.length} warning(s)`);
    for (const issue of [...errors, ...warnings].slice(0, 20)) {
      const where = issue.lineNumber ? ` (line ${issue.lineNumber})` : '';
      console.log(`    ${issue.severity.toUpperCase().padEnd(7)} ${issue.code}${where}: ${issue.message}`);
    }
    if (errors.length + warnings.length > 20) {
      console.log(`    … and ${errors.length + warnings.length - 20} more`);
    }
  }

  if (outcome.preview) {
    const review = outcome.preview.filter((p) => p.humanReviewRequired);
    console.log('');
    console.log('  Sample of what would be written:');
    for (const p of outcome.preview.slice(0, 10)) {
      console.log(`    line ${String(p.lineNumber).padEnd(5)} ${p.name.padEnd(28)} ${p.outcome.padEnd(13)} ${p.tier.padEnd(15)} ${p.confidence}%`);
    }
    if (outcome.preview.length > 10) console.log(`    … and ${outcome.preview.length - 10} more`);

    if (review.length > 0) {
      console.log('');
      console.log(`  ${review.length} row(s) need a human decision and would NOT be written:`);
      for (const p of review.slice(0, 5)) {
        console.log(`    line ${p.lineNumber} ${p.name} — ${p.reviewRationale}`);
      }
    }
  }
  console.log('');
}

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(`[inmate-intelligence] ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
