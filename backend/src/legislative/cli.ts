#!/usr/bin/env tsx
// ============================================================================
// CLI — California leginfo code discovery
// Usage: npm run leginfo:discover -- --code PEN [--max-pages 100] [--resume path]
// ============================================================================

import { resolve } from 'node:path';
import { Command } from 'commander';
import { CALIFORNIA_CODES, getCriminalPriorityCodes } from './caCodes.ts';
import { discoverCaliforniaCode } from './discovery.ts';

const program = new Command();

program
  .name('leginfo-discover')
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

program.parseAsync(process.argv).catch((err) => {
  console.error(err);
  process.exit(1);
});
