#!/usr/bin/env tsx
// ============================================================================
// CLI — California leginfo legislative intelligence
// Usage:
//   npm run leginfo:discover -- discover --code PEN
//   npm run leginfo:discover -- acquire --code PEN --max-sections 5
// ============================================================================

import { resolve } from 'node:path';
import { Command } from 'commander';
import { CALIFORNIA_CODES, getCriminalPriorityCodes } from './caCodes.ts';
import { discoverCaliforniaCode } from './discovery.ts';
import { acquireStatuteHtml } from './acquisition.ts';
import { defaultManifestPaths } from './discoveryManifest.ts';

const program = new Command();

program.name('leginfo').description('California leginfo legislative intelligence CLI');

program
  .command('discover')
  .description('Discover California code sections from leginfo.legislature.ca.gov')
  .option('-c, --code <abbrev>', 'California code abbreviation (e.g. PEN, EVID)')
  .option('--criminal-only', 'Discover all criminal-priority codes (PEN, EVID, HSC, VEH, BPC)')
  .option('--max-pages <n>', 'Maximum pages to fetch (for dev/testing)', (v) => parseInt(v, 10))
  .option('--output-dir <path>', 'Output directory for manifest/checkpoint', 'data/legislative/discovery')
  .option('--resume <path>', 'Resume from checkpoint JSON')
  .action(async (opts) => {
    const codes: string[] = [];

    if (opts.criminalOnly) {
      codes.push(...getCriminalPriorityCodes().map((c) => c.abbrev));
    } else if (opts.code) {
      codes.push(opts.code.toUpperCase());
    } else {
      console.error('Specify --code <abbrev> or --criminal-only');
      process.exit(1);
    }

    for (const code of codes) {
      const known = CALIFORNIA_CODES.find((c) => c.abbrev === code);
      if (!known) {
        console.error(`Unknown code: ${code}`);
        process.exit(1);
      }

      console.log(`\n=== Discovering ${known.name} (${code}) ===`);
      const result = await discoverCaliforniaCode({
        code,
        maxPages: opts.maxPages,
        outputDir: resolve(opts.outputDir),
        resumeFrom: opts.resume ? resolve(opts.resume) : undefined,
      });

      console.log(`Status: ${result.manifest.status}`);
      console.log(`Sections: ${result.manifest.sections.length}`);
      console.log(`Pages fetched: ${result.manifest.stats.pagesFetched}`);
      console.log(`Manifest: ${result.manifestPath}`);
      console.log(`Checkpoint: ${result.checkpointPath}`);
      console.log(`Audit log: ${result.auditPath}`);
    }
  });

program
  .command('acquire')
  .description('Acquire raw HTML for discovered statute sections')
  .requiredOption('-c, --code <abbrev>', 'California code abbreviation')
  .option('--manifest <path>', 'Discovery manifest path')
  .option('--raw-dir <path>', 'Raw HTML output directory', 'data/legislative/raw')
  .option('--max-sections <n>', 'Maximum sections to acquire', (v) => parseInt(v, 10))
  .option('--resume', 'Resume from acquisition checkpoint')
  .option('--no-skip-existing', 'Re-fetch even if raw HTML already exists')
  .action(async (opts) => {
    const code = opts.code.toUpperCase();
    const paths = defaultManifestPaths('data/legislative/discovery', code);
    const manifestPath = opts.manifest ? resolve(opts.manifest) : resolve(paths.manifest);

    console.log(`\n=== Acquiring ${code} statute HTML ===`);
    console.log(`Manifest: ${manifestPath}`);

    const result = await acquireStatuteHtml({
      code,
      manifestPath,
      rawHtmlDir: resolve(opts.rawDir),
      maxSections: opts.maxSections,
      resume: opts.resume ?? false,
      skipExisting: opts.skipExisting,
    });

    console.log(`Status: ${result.status}`);
    console.log(`Acquired: ${result.acquired}`);
    console.log(`Failed: ${result.failed}`);
    console.log(`Skipped: ${result.skipped}`);
    console.log(`Total in manifest: ${result.totalSections}`);
    console.log(`Raw HTML dir: ${result.rawHtmlDir}`);
    console.log(`Index: ${result.indexPath}`);
    console.log(`Checkpoint: ${result.checkpointPath}`);
  });

program
  .command('process')
  .description('Parse acquired HTML and build California Criminal Knowledge Graph repositories')
  .requiredOption('-c, --code <abbrev>', 'California code abbreviation')
  .option('--raw-dir <path>', 'Raw HTML directory', 'data/legislative/raw')
  .option('--repo-dir <path>', 'Repository output directory', 'data/legislative/repositories')
  .option('--max-sections <n>', 'Maximum sections to process', (v) => parseInt(v, 10))
  .option('--section <sections...>', 'Specific sections to process')
  .action(async (opts) => {
    const code = opts.code.toUpperCase();
    console.log(`\n=== Processing ${code} into Criminal Knowledge Graph ===`);

    const { processStatutePipeline } = await import('./knowledgeGraph/pipeline.ts');
    const result = await processStatutePipeline({
      code,
      rawHtmlDir: resolve(opts.rawDir),
      repositoryDir: resolve(opts.repoDir),
      sections: opts.section?.length ? opts.section : undefined,
      maxSections: opts.maxSections,
    });

    console.log(`Processed: ${result.processed}`);
    console.log(`Rejected: ${result.rejected}`);
    console.log(`Offenses identified: ${result.offenses}`);
    console.log(`Repositories: ${result.repositoryDir}`);
    console.log(`Coverage report: ${result.coverageReportPath}`);
  });

program.parseAsync(process.argv).catch((err) => {
  console.error(err);
  process.exit(1);
});
