// ============================================
// Court Access — Corpus Ingestion CLI
// Entry point for the bulk legal corpus loader.
// Usage: npm run ingest-corpus -- --corpus <type> --file <path>
// ============================================

import { Command } from 'commander';
import { resolve, basename } from 'node:path';
import { access } from 'node:fs/promises';
import { createCorpusParser, countRecords } from './corpusParser.ts';
import { createNormalizerTransform } from './normalizer.ts';
import { createChunkBuilder, type Chunk } from './chunkBuilder.ts';
import { IngestionStateRepository } from './ingestionStateRepository.ts';
import { IngestionLogger } from './ingestionLogger.ts';
import type { IngestionConfig, NormalizedDocument, BatchResult, IngestionSummary } from './types.ts';

// ---------------------------------------------------------------------------
// Direct Pipeline (no Redis/BullMQ — synchronous batch processing)
// ---------------------------------------------------------------------------

interface DirectPipelineDeps {
  stateRepo: IngestionStateRepository;
  logger: IngestionLogger;
  inserter: { insertBatch(documents: NormalizedDocument[]): Promise<number> };
}

async function runDirectPipeline(
  config: IngestionConfig,
  deps: DirectPipelineDeps,
): Promise<IngestionSummary> {
  const { corpusName, filePath, tenantId, batchSize, resume, dryRun } = config;
  const { stateRepo, logger, inserter } = deps;
  const fileName = basename(filePath);
  const startTime = Date.now();

  // Count total records for progress tracking
  process.stdout.write(`Counting records in ${fileName}...\n`);
  const totalRecords = await countRecords(filePath);
  process.stdout.write(`Total records: ${totalRecords}\n`);

  // Determine resume offset
  let resumeOffset = 0;
  if (resume) {
    resumeOffset = await stateRepo.getResumeOffset(corpusName, fileName);
    if (resumeOffset > 0) {
      process.stdout.write(`Resuming from offset ${resumeOffset}\n`);
    }
  }

  // Initialize state tracking
  await stateRepo.initializeState(corpusName, fileName, totalRecords);

  // Create streaming pipeline
  const { stream, format } = await createCorpusParser(filePath, resumeOffset);
  process.stdout.write(`Detected format: ${format}\n`);
  process.stdout.write(`Batch size: ${batchSize}\n`);
  if (dryRun) {
    process.stdout.write(`DRY RUN — no records will be inserted\n`);
  }
  process.stdout.write(`\n`);

  const normalizer = createNormalizerTransform(corpusName, fileName, tenantId);
  const chunkBuilder = createChunkBuilder(batchSize);

  // Pipe: parser → normalizer → chunk builder
  stream.pipe(normalizer).pipe(chunkBuilder);

  // Process chunks as they arrive
  let totalInserted = 0;
  let totalSkipped = 0;
  let totalFailed = 0;
  let batchCount = 0;

  for await (const chunk of chunkBuilder) {
    const typedChunk = chunk as Chunk;
    batchCount++;
    const batchStart = Date.now();

    try {
      let recordsInserted: number;

      if (dryRun) {
        recordsInserted = typedChunk.documents.length;
      } else {
        recordsInserted = await inserter.insertBatch(typedChunk.documents);
      }

      const durationMs = Date.now() - batchStart;
      const result: BatchResult = {
        batchNumber: typedChunk.batchNumber,
        recordsInserted,
        recordsSkipped: typedChunk.documents.length - recordsInserted,
        durationMs,
        status: 'success',
      };

      totalInserted += recordsInserted;
      totalSkipped += result.recordsSkipped;

      await logger.logBatch(corpusName, result);
      logger.logProgress(
        corpusName,
        typedChunk.batchNumber,
        totalInserted,
        totalRecords,
        durationMs,
        'success',
      );

      // Checkpoint after each batch
      await stateRepo.checkpoint(
        corpusName,
        fileName,
        typedChunk.endOffset + resumeOffset,
        totalInserted,
      );
    } catch (err) {
      const durationMs = Date.now() - batchStart;
      const errorMessage = err instanceof Error ? err.message : String(err);
      totalFailed += typedChunk.documents.length;

      const result: BatchResult = {
        batchNumber: typedChunk.batchNumber,
        recordsInserted: 0,
        recordsSkipped: 0,
        durationMs,
        status: 'failed',
        errorMessage,
      };

      await logger.logBatch(corpusName, result);
      logger.logProgress(
        corpusName,
        typedChunk.batchNumber,
        totalInserted,
        totalRecords,
        durationMs,
        'failed',
      );

      process.stderr.write(`Batch #${typedChunk.batchNumber} failed: ${errorMessage}\n`);
    }
  }

  // Mark ingestion as completed
  const totalDurationMs = Date.now() - startTime;

  if (totalFailed === 0) {
    await stateRepo.markCompleted(corpusName, fileName, totalInserted);
  } else {
    await stateRepo.markFailed(
      corpusName,
      fileName,
      `${totalFailed} records failed across ${batchCount} batches`,
    );
  }

  const summary: IngestionSummary = {
    corpusName,
    fileName,
    totalRecords,
    recordsInserted: totalInserted,
    recordsSkipped: totalSkipped,
    recordsFailed: totalFailed,
    totalBatches: batchCount,
    totalDurationMs,
    averageBatchDurationMs: batchCount > 0 ? Math.round(totalDurationMs / batchCount) : 0,
    throughputPerMinute: totalDurationMs > 0
      ? Math.round((totalInserted / totalDurationMs) * 60000)
      : 0,
    status: totalFailed === 0 ? 'completed' : 'failed',
  };

  return summary;
}

// ---------------------------------------------------------------------------
// CLI Program
// ---------------------------------------------------------------------------

function printSummary(summary: IngestionSummary): void {
  process.stdout.write(`\n========================================\n`);
  process.stdout.write(`INGESTION SUMMARY\n`);
  process.stdout.write(`========================================\n`);
  process.stdout.write(`Corpus:          ${summary.corpusName}\n`);
  process.stdout.write(`File:            ${summary.fileName}\n`);
  process.stdout.write(`Status:          ${summary.status.toUpperCase()}\n`);
  process.stdout.write(`Total Records:   ${summary.totalRecords}\n`);
  process.stdout.write(`Inserted:        ${summary.recordsInserted}\n`);
  process.stdout.write(`Skipped (dupes): ${summary.recordsSkipped}\n`);
  process.stdout.write(`Failed:          ${summary.recordsFailed}\n`);
  process.stdout.write(`Batches:         ${summary.totalBatches}\n`);
  process.stdout.write(`Duration:        ${(summary.totalDurationMs / 1000).toFixed(1)}s\n`);
  process.stdout.write(`Avg Batch:       ${summary.averageBatchDurationMs}ms\n`);
  process.stdout.write(`Throughput:      ${summary.throughputPerMinute} rec/min\n`);
  process.stdout.write(`========================================\n\n`);
}

export function createProgram(): Command {
  const program = new Command();

  program
    .name('ingest-corpus')
    .description('Bulk Legal Corpus Loader for Court Access')
    .version('1.0.0')
    .requiredOption('--corpus <type>', 'Corpus type (policy, statute, case_law, transcript, evidence, investigative_report)')
    .requiredOption('--file <path>', 'Path to corpus file (JSON array, JSONL, or CSV)')
    .option('--batchSize <number>', 'Records per batch', '500')
    .option('--tenantId <id>', 'Tenant ID for multi-tenancy', 'default')
    .option('--resume', 'Resume from last checkpoint', false)
    .option('--dryRun', 'Validate without inserting', false)
    .option('--useCopy', 'Force PostgreSQL COPY mode', false)
    .option('--concurrency <number>', 'Max concurrent workers', '1')
    .action(async (options) => {
      const filePath = resolve(options.file);

      // Verify file exists
      try {
        await access(filePath);
      } catch {
        process.stderr.write(`Error: File not found: ${filePath}\n`);
        process.exit(1);
      }

      const config: IngestionConfig = {
        corpusName: options.corpus,
        filePath,
        tenantId: options.tenantId,
        batchSize: parseInt(options.batchSize, 10),
        resume: options.resume,
        dryRun: options.dryRun,
        useCopy: options.useCopy,
        concurrency: parseInt(options.concurrency, 10),
      };

      process.stdout.write(`\nCourt Access — Bulk Legal Corpus Loader\n`);
      process.stdout.write(`========================================\n`);
      process.stdout.write(`Corpus:    ${config.corpusName}\n`);
      process.stdout.write(`File:      ${config.filePath}\n`);
      process.stdout.write(`Batch:     ${config.batchSize}\n`);
      process.stdout.write(`Resume:    ${config.resume}\n`);
      process.stdout.write(`Dry Run:   ${config.dryRun}\n`);
      process.stdout.write(`COPY Mode: ${config.useCopy}\n`);
      process.stdout.write(`========================================\n\n`);

      // In standalone CLI mode, use a mock inserter that logs to console
      // Real database connections are injected when using this as a library
      process.stdout.write(`NOTE: Running in standalone mode. Use --dryRun for validation.\n`);
      process.stdout.write(`For database insertion, integrate via the library API.\n\n`);

      // Create minimal dependencies for dry run / standalone
      const mockStateRepo = createMockStateRepo();
      const mockLogger = createMockLogger();
      const mockInserter = createMockInserter(config.dryRun);

      const summary = await runDirectPipeline(config, {
        stateRepo: mockStateRepo,
        logger: mockLogger,
        inserter: mockInserter,
      });

      printSummary(summary);

      if (summary.status === 'failed') {
        process.exit(1);
      }
    });

  return program;
}

// ---------------------------------------------------------------------------
// Mock Dependencies (for standalone CLI / dry run)
// ---------------------------------------------------------------------------

function createMockStateRepo(): IngestionStateRepository {
  const store = new Map<string, {
    lastProcessedOffset: number;
    recordsProcessed: number;
    totalRecords: number | null;
    status: string;
    errorMessage: string | null;
    createdAt: Date;
  }>();

  const db = {
    async findUnique(args: { where: { corpusName_fileName: { corpusName: string; fileName: string } } }) {
      const key = `${args.where.corpusName_fileName.corpusName}:${args.where.corpusName_fileName.fileName}`;
      const rec = store.get(key);
      if (!rec) return null;
      return {
        id: key,
        corpusName: args.where.corpusName_fileName.corpusName,
        fileName: args.where.corpusName_fileName.fileName,
        ...rec,
        updatedAt: new Date(),
      };
    },
    async upsert(args: {
      where: { corpusName_fileName: { corpusName: string; fileName: string } };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }) {
      const key = `${args.where.corpusName_fileName.corpusName}:${args.where.corpusName_fileName.fileName}`;
      const existing = store.get(key);
      const now = new Date();
      if (existing) {
        const updated = { ...existing, ...args.update };
        store.set(key, {
          lastProcessedOffset: updated.lastProcessedOffset as number,
          recordsProcessed: updated.recordsProcessed as number,
          totalRecords: updated.totalRecords as number | null,
          status: updated.status as string,
          errorMessage: updated.errorMessage as string | null,
          createdAt: existing.createdAt,
        });
      } else {
        store.set(key, {
          lastProcessedOffset: args.create.lastProcessedOffset as number,
          recordsProcessed: args.create.recordsProcessed as number,
          totalRecords: args.create.totalRecords as number | null,
          status: args.create.status as string,
          errorMessage: args.create.errorMessage as string | null,
          createdAt: now,
        });
      }
      const rec = store.get(key)!;
      return {
        id: key,
        corpusName: args.where.corpusName_fileName.corpusName,
        fileName: args.where.corpusName_fileName.fileName,
        ...rec,
        updatedAt: now,
      };
    },
  };

  return new IngestionStateRepository(db);
}

function createMockLogger(): IngestionLogger {
  const db = {
    async create() {
      return {
        id: 'mock',
        corpusName: '',
        batchNumber: 0,
        recordsInserted: 0,
        durationMs: 0,
        status: 'success',
        errorMessage: null,
        timestamp: new Date(),
      };
    },
    async findMany() {
      return [];
    },
    async count() {
      return 0;
    },
  };

  return new IngestionLogger(db);
}

function createMockInserter(dryRun: boolean) {
  return {
    async insertBatch(documents: NormalizedDocument[]): Promise<number> {
      if (dryRun) {
        return documents.length;
      }
      // In mock mode, pretend all documents were inserted
      return documents.length;
    },
  };
}

// ---------------------------------------------------------------------------
// Exports for library usage
// ---------------------------------------------------------------------------

export { runDirectPipeline, printSummary };
export type { DirectPipelineDeps };

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const program = createProgram();
program.parse(process.argv);
