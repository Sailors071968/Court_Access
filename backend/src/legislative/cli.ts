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
    const prisma = (await import('../lib/prisma.ts')).default;
    const result = await processStatutePipeline({
      code,
      rawHtmlDir: resolve(opts.rawDir),
      repositoryDir: resolve(opts.repoDir),
      sections: opts.section?.length ? opts.section : undefined,
      maxSections: opts.maxSections,
      prisma,
    });

    console.log(`Processed: ${result.processed}`);
    console.log(`Rejected: ${result.rejected}`);
    console.log(`Offenses identified: ${result.offenses}`);
    console.log(`Classified: ${result.classified}`);
    console.log(`Likely criminal: ${result.likelyCriminal}`);
    console.log(`Repositories: ${result.repositoryDir}`);
    console.log(`Coverage report: ${result.coverageReportPath}`);
    console.log(`Liability report: ${result.liabilityReportPath}`);
  });

program
  .command('classify')
  .description('Run Criminal Liability Discovery classification on acquired statutes')
  .requiredOption('-c, --code <abbrev>', 'California code abbreviation')
  .option('--raw-dir <path>', 'Raw HTML directory', 'data/legislative/raw')
  .option('--repo-dir <path>', 'Repository output directory', 'data/legislative/repositories')
  .option('--max-sections <n>', 'Maximum sections to classify', (v) => parseInt(v, 10))
  .action(async (opts) => {
    const code = opts.code.toUpperCase();
    console.log(`\n=== Criminal Liability Discovery for ${code} ===`);

    const { processStatutePipeline } = await import('./knowledgeGraph/pipeline.ts');
    const { collectLiabilityDiscoveryMetrics } = await import('./liabilityDiscovery/metrics.ts');
    const prisma = (await import('../lib/prisma.ts')).default;
    const result = await processStatutePipeline({
      code,
      rawHtmlDir: resolve(opts.rawDir),
      repositoryDir: resolve(opts.repoDir),
      maxSections: opts.maxSections,
      prisma,
    });

    const metrics = await collectLiabilityDiscoveryMetrics({ repositoryDir: resolve(opts.repoDir) });
    console.log(`Classified: ${result.classified}`);
    console.log(`Likely criminal statutes: ${metrics.likelyCriminalStatutes}`);
    console.log(`Confirmed offenses: ${metrics.confirmedCriminalOffenses}`);
    console.log(`Manual review queue: ${metrics.manualReviewQueue}`);
    console.log(`Liability report: ${result.liabilityReportPath}`);
  });

program
  .command('discover-criminal')
  .description('Criminal Liability Discovery Engine — targeted acquisition of high-criminality sections first (no sequential crawl)')
  .requiredOption('-c, --code <abbrev>', 'California code abbreviation (VEH, HSC, BPC, PEN, WIC)')
  .option('--raw-dir <path>', 'Raw HTML output directory', 'data/legislative/raw')
  .option('--repo-dir <path>', 'Repository output directory', 'data/legislative/repositories')
  .option('--output-dir <path>', 'Manifest output directory', 'data/legislative/discovery')
  .option('--acquire', 'Acquire the targeted sections after writing the manifest', false)
  .option('--process', 'Process acquired sections into the knowledge graph', false)
  .action(async (opts) => {
    const code = opts.code.toUpperCase();
    const { writeCriminalManifest, buildCriminalManifest } = await import('./criminalDiscoveryEngine.ts');
    const manifest = buildCriminalManifest(code);
    const manifestPath = await writeCriminalManifest(code, resolve(opts.outputDir));

    console.log(`\n=== Criminal Liability Discovery — ${manifest.codeName} (${code}) ===`);
    console.log(`Targeted criminal-priority seed sections: ${manifest.sections.length}`);
    console.log(`Manifest: ${manifestPath}`);

    if (opts.acquire) {
      console.log(`\n--- Acquiring ${manifest.sections.length} targeted sections directly ---`);
      const acq = await acquireStatuteHtml({
        code,
        manifestPath,
        rawHtmlDir: resolve(opts.rawDir),
        resume: false,
        skipExisting: true,
      });
      console.log(`Acquired: ${acq.acquired}  Failed: ${acq.failed}  Skipped: ${acq.skipped}`);
    }

    if (opts.process) {
      console.log(`\n--- Processing into Criminal Knowledge Graph ---`);
      const { processStatutePipeline } = await import('./knowledgeGraph/pipeline.ts');
      const prisma = (await import('../lib/prisma.ts')).default;
      const result = await processStatutePipeline({
        code,
        rawHtmlDir: resolve(opts.rawDir),
        repositoryDir: resolve(opts.repoDir),
        prisma,
      });
      console.log(`Processed: ${result.processed}  Offenses: ${result.offenses}  Likely criminal: ${result.likelyCriminal}`);
    }
  });

program
  .command('expand-criminal')
  .description('Phase 3 — Discover cross-reference expansion targets from confirmed criminal statutes')
  .option('-c, --code <abbrev>', 'Restrict targets to a single code')
  .option('--repo-dir <path>', 'Repository directory', 'data/legislative/repositories')
  .option('--only-from-criminal', 'Only expand references originating from confirmed criminal statutes', false)
  .option('--write-manifest', 'Write discovered targets into that code\'s discovery manifest for acquisition', false)
  .action(async (opts) => {
    const { discoverCrossReferenceTargets } = await import('./criminalLiabilityRegistry.ts');
    const { targets, alreadyAcquired, total } = await discoverCrossReferenceTargets(resolve(opts.repoDir), {
      code: opts.code,
      onlyFromCriminal: opts.onlyFromCriminal,
    });

    console.log(`\n=== Cross-reference Expansion ===`);
    console.log(`Cross-references scanned: ${total}`);
    console.log(`Already acquired: ${alreadyAcquired}`);
    console.log(`New criminal-code targets to expand: ${targets.length}`);
    const byCode = new Map<string, number>();
    for (const t of targets) byCode.set(t.code, (byCode.get(t.code) ?? 0) + 1);
    for (const [c, n] of [...byCode.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${c}: ${n} sections`);
    }
    if (targets.length) {
      console.log('Sample targets:', targets.slice(0, 15).map((t) => `${t.code} ${t.section}`).join(', '));
    }
  });

program
  .command('dashboard')
  .description('Phase 5 — Build the Criminal Liability Coverage Dashboard + repository intelligence registry')
  .option('--repo-dir <path>', 'Repository directory', 'data/legislative/repositories')
  .action(async (opts) => {
    const { buildCoverageDashboard } = await import('./criminalLiabilityRegistry.ts');
    const { dashboard, jsonPath, markdownPath } = await buildCoverageDashboard(resolve(opts.repoDir));

    console.log(`\n=== Criminal Liability Coverage Dashboard ===`);
    console.log(`Sections classified: ${dashboard.totals.total}`);
    console.log(`Known criminal: ${dashboard.totals.criminalSections}`);
    console.log(`Known administrative: ${dashboard.totals.administrativeSections}`);
    console.log(`Pending review: ${dashboard.totals.pending}`);
    console.log(`Unknown: ${dashboard.totals.unknown}`);
    console.log(`Offenses: ${dashboard.totals.offenses}`);
    console.log(`Discovery rate: ${dashboard.totals.discoveryRate}`);
    console.log(`Hash verification: ${(dashboard.totals.hashVerification * 100).toFixed(1)}%`);
    console.log(`Cross-reference completeness: ${(dashboard.totals.crossReferenceCompleteness * 100).toFixed(1)}%`);
    console.log(`JSON: ${jsonPath}`);
    console.log(`Markdown: ${markdownPath}`);
  });

program.parseAsync(process.argv).catch((err) => {
  console.error(err);
  process.exit(1);
});
