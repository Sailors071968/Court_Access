// ============================================
// Court Access — Ingestion Pipeline Acceptance Tests
// Tests: 50k corpus, crash recovery, batch integrity, dedup, throughput
// ============================================

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createWriteStream } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

import { createCorpusParser, countRecords } from '../src/ingestion/corpusParser.ts';
import { createChunkBuilder, collectChunks, type Chunk } from '../src/ingestion/chunkBuilder.ts';
import { createNormalizerTransform, normalizeDocument } from '../src/ingestion/normalizer.ts';
import { IngestionStateRepository } from '../src/ingestion/ingestionStateRepository.ts';
import { IngestionLogger } from '../src/ingestion/ingestionLogger.ts';
import type { RawDocument, NormalizedDocument, BatchResult } from '../src/ingestion/types.ts';
import type { ParsedRecord } from '../src/ingestion/corpusParser.ts';

// ---------------------------------------------------------------------------
// Test Data Directory
// ---------------------------------------------------------------------------

const TEST_DIR = resolve(import.meta.dirname ?? '.', '../test-data');
const SMALL_CORPUS = resolve(TEST_DIR, 'test-small.jsonl');
const MEDIUM_CORPUS = resolve(TEST_DIR, 'test-medium.jsonl');
const LARGE_CORPUS = resolve(TEST_DIR, 'test-50k.jsonl');
const JSON_ARRAY_CORPUS = resolve(TEST_DIR, 'test-array.json');
const CSV_CORPUS = resolve(TEST_DIR, 'test-corpus.csv');

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

async function generateJsonlCorpus(path: string, count: number): Promise<void> {
  await mkdir(TEST_DIR, { recursive: true });
  const ws = createWriteStream(path, { encoding: 'utf-8' });

  for (let i = 0; i < count; i++) {
    const doc = {
      title: `Test Document ${i + 1}`,
      content: `Content for document ${i + 1}. This is test content with enough text to be realistic.`,
      jurisdiction: ['CA', 'NY', 'TX', 'FL'][i % 4],
      type: ['policy', 'statute', 'case_law', 'transcript'][i % 4],
      source: 'test-generator',
    };
    const canWrite = ws.write(JSON.stringify(doc) + '\n');
    if (!canWrite) {
      await new Promise<void>((r) => ws.once('drain', r));
    }
  }

  ws.end();
  await new Promise<void>((r) => ws.once('finish', r));
}

async function generateJsonArrayCorpus(path: string, count: number): Promise<void> {
  await mkdir(TEST_DIR, { recursive: true });
  const ws = createWriteStream(path, { encoding: 'utf-8' });
  ws.write('[\n');

  for (let i = 0; i < count; i++) {
    const doc = {
      title: `Array Doc ${i + 1}`,
      content: `Array content ${i + 1}`,
      jurisdiction: 'CA',
      type: 'policy',
    };
    const comma = i < count - 1 ? ',\n' : '\n';
    ws.write(JSON.stringify(doc) + comma);
  }

  ws.write(']\n');
  ws.end();
  await new Promise<void>((r) => ws.once('finish', r));
}

async function generateCsvCorpus(path: string, count: number): Promise<void> {
  await mkdir(TEST_DIR, { recursive: true });
  const ws = createWriteStream(path, { encoding: 'utf-8' });
  ws.write('title,content,jurisdiction,type,source\n');

  for (let i = 0; i < count; i++) {
    ws.write(`"CSV Doc ${i + 1}","CSV content ${i + 1}","CA","statute","csv-gen"\n`);
  }

  ws.end();
  await new Promise<void>((r) => ws.once('finish', r));
}

function createInMemoryStateDb() {
  const store = new Map<string, {
    id: string;
    corpusName: string;
    fileName: string;
    lastProcessedOffset: number;
    recordsProcessed: number;
    totalRecords: number | null;
    status: string;
    errorMessage: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>();

  return {
    async findUnique(args: { where: { corpusName_fileName: { corpusName: string; fileName: string } } }) {
      const key = `${args.where.corpusName_fileName.corpusName}:${args.where.corpusName_fileName.fileName}`;
      return store.get(key) ?? null;
    },
    async upsert(args: {
      where: { corpusName_fileName: { corpusName: string; fileName: string } };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }) {
      const key = `${args.where.corpusName_fileName.corpusName}:${args.where.corpusName_fileName.fileName}`;
      const now = new Date();
      const existing = store.get(key);

      if (existing) {
        const updated = { ...existing, ...args.update, updatedAt: now };
        store.set(key, updated as typeof existing);
        return store.get(key)!;
      }

      const created = {
        id: key,
        corpusName: args.where.corpusName_fileName.corpusName,
        fileName: args.where.corpusName_fileName.fileName,
        lastProcessedOffset: args.create.lastProcessedOffset as number,
        recordsProcessed: args.create.recordsProcessed as number,
        totalRecords: args.create.totalRecords as number | null,
        status: args.create.status as string,
        errorMessage: args.create.errorMessage as string | null,
        createdAt: now,
        updatedAt: now,
      };
      store.set(key, created);
      return created;
    },
    _store: store,
  };
}

function createInMemoryLogDb() {
  const logs: Array<{
    id: string;
    corpusName: string;
    batchNumber: number;
    recordsInserted: number;
    durationMs: number;
    status: string;
    errorMessage: string | null;
    timestamp: Date;
  }> = [];

  return {
    async create(args: { data: Record<string, unknown> }) {
      const log = {
        id: `log-${logs.length + 1}`,
        corpusName: args.data.corpusName as string,
        batchNumber: args.data.batchNumber as number,
        recordsInserted: args.data.recordsInserted as number,
        durationMs: args.data.durationMs as number,
        status: args.data.status as string,
        errorMessage: args.data.errorMessage as string | null,
        timestamp: new Date(),
      };
      logs.push(log);
      return log;
    },
    async findMany(args: { where: { corpusName: string }; orderBy: { timestamp: string }; take?: number }) {
      const filtered = logs
        .filter(l => l.corpusName === args.where.corpusName)
        .sort((a, b) =>
          args.orderBy.timestamp === 'desc'
            ? b.timestamp.getTime() - a.timestamp.getTime()
            : a.timestamp.getTime() - b.timestamp.getTime(),
        );
      return args.take ? filtered.slice(0, args.take) : filtered;
    },
    async count(args: { where: { corpusName: string; status?: string } }) {
      return logs.filter(l =>
        l.corpusName === args.where.corpusName &&
        (!args.where.status || l.status === args.where.status),
      ).length;
    },
    _logs: logs,
  };
}

function createInMemoryInserter() {
  const inserted: NormalizedDocument[] = [];
  const hashes = new Set<string>();

  return {
    async insertBatch(documents: NormalizedDocument[]): Promise<number> {
      let count = 0;
      for (const doc of documents) {
        const key = `${doc.contentHash}:${doc.tenantId}`;
        if (!hashes.has(key)) {
          hashes.add(key);
          inserted.push(doc);
          count++;
        }
      }
      return count;
    },
    getInserted: () => inserted,
    getCount: () => inserted.length,
    getHashes: () => hashes,
    clear: () => { inserted.length = 0; hashes.clear(); },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Corpus Parser', () => {
  before(async () => {
    await generateJsonlCorpus(SMALL_CORPUS, 100);
    await generateJsonArrayCorpus(JSON_ARRAY_CORPUS, 50);
    await generateCsvCorpus(CSV_CORPUS, 75);
  });

  it('should detect and parse JSONL format', async () => {
    const { stream, format } = await createCorpusParser(SMALL_CORPUS);
    assert.equal(format, 'jsonl');

    let count = 0;
    for await (const record of stream) {
      const parsed = record as ParsedRecord;
      assert.ok(parsed.doc);
      assert.ok(parsed.doc.title);
      count++;
    }
    assert.equal(count, 100);
  });

  it('should detect and parse JSON array format', async () => {
    const { stream, format } = await createCorpusParser(JSON_ARRAY_CORPUS);
    assert.equal(format, 'json_array');

    let count = 0;
    for await (const _record of stream) {
      count++;
    }
    assert.equal(count, 50);
  });

  it('should detect and parse CSV format', async () => {
    const { stream, format } = await createCorpusParser(CSV_CORPUS);
    assert.equal(format, 'csv');

    let count = 0;
    for await (const record of stream) {
      const parsed = record as ParsedRecord;
      assert.ok(parsed.doc.title);
      count++;
    }
    assert.equal(count, 75);
  });

  it('should count records correctly', async () => {
    const jsonlCount = await countRecords(SMALL_CORPUS);
    assert.equal(jsonlCount, 100);

    const jsonCount = await countRecords(JSON_ARRAY_CORPUS);
    assert.equal(jsonCount, 50);

    const csvCount = await countRecords(CSV_CORPUS);
    assert.equal(csvCount, 75);
  });

  it('should support resume offset for JSONL', async () => {
    const { stream } = await createCorpusParser(SMALL_CORPUS, 50);
    let count = 0;
    for await (const _record of stream) {
      count++;
    }
    // JSONL starts from byte offset, so count depends on format
    assert.ok(count > 0, 'Should parse some records after offset');
  });
});

describe('Document Normalizer', () => {
  it('should normalize raw documents to canonical form', () => {
    const raw: RawDocument = {
      title: 'Test Policy',
      content: 'Policy content here',
      jurisdiction: 'CA',
      type: 'policy',
      source: 'manual',
    };

    const normalized = normalizeDocument(raw, 'test-corpus', 'test.jsonl', 'tenant-1');

    assert.equal(normalized.title, 'Test Policy');
    assert.equal(normalized.content, 'Policy content here');
    assert.equal(normalized.jurisdiction, 'CA');
    assert.equal(normalized.documentType, 'policy');
    assert.equal(normalized.tenantId, 'tenant-1');
    assert.equal(normalized.corpusName, 'test-corpus');
    assert.equal(normalized.sourceFile, 'test.jsonl');
    assert.ok(normalized.contentHash, 'Should have content hash');
    assert.ok(normalized.id, 'Should have ID');
  });

  it('should produce deterministic content hashes', () => {
    const raw: RawDocument = {
      title: 'Same Document',
      content: 'Same content',
    };

    const doc1 = normalizeDocument(raw, 'corpus', 'file.jsonl', 'tenant-1');
    const doc2 = normalizeDocument(raw, 'corpus', 'file.jsonl', 'tenant-1');

    assert.equal(doc1.contentHash, doc2.contentHash);
    assert.equal(doc1.id, doc2.id);
  });

  it('should handle missing fields gracefully', () => {
    const raw: RawDocument = {};
    const normalized = normalizeDocument(raw, 'corpus', 'file.jsonl', 'tenant-1');

    assert.equal(normalized.title, 'Untitled');
    assert.equal(normalized.content, '');
    assert.equal(normalized.jurisdiction, 'unknown');
    assert.ok(normalized.contentHash);
  });

  it('should resolve corpus types correctly', () => {
    const cases: Array<[string, string]> = [
      ['policy', 'policy'],
      ['chp_policy', 'policy'],
      ['statute', 'statute'],
      ['penal_code', 'statute'],
      ['case_law', 'case_law'],
      ['transcript', 'transcript'],
      ['evidence', 'evidence'],
      ['investigative_report', 'investigative_report'],
    ];

    for (const [input, expected] of cases) {
      const raw: RawDocument = { type: input, content: `type-${input}` };
      const normalized = normalizeDocument(raw, 'test', 'test.jsonl', 'tenant-1');
      assert.equal(normalized.documentType, expected, `${input} → ${expected}`);
    }
  });

  it('should create normalizer transform stream', async () => {
    const transform = createNormalizerTransform('test-corpus', 'test.jsonl', 'tenant-1');
    const records: ParsedRecord[] = [
      { doc: { title: 'Doc 1', content: 'Content 1' }, offset: 1 },
      { doc: { title: 'Doc 2', content: 'Content 2' }, offset: 2 },
    ];

    const results: NormalizedDocument[] = [];
    transform.on('data', (doc: NormalizedDocument) => results.push(doc));

    for (const record of records) {
      transform.write(record);
    }
    transform.end();

    await new Promise<void>((r) => transform.on('end', r));

    assert.equal(results.length, 2);
    assert.equal(results[0].title, 'Doc 1');
    assert.equal(results[1].title, 'Doc 2');
  });
});

describe('Chunk Builder', () => {
  it('should group documents into fixed-size batches', async () => {
    const chunkBuilder = createChunkBuilder(10);
    const docs: NormalizedDocument[] = [];

    for (let i = 0; i < 25; i++) {
      docs.push(normalizeDocument(
        { title: `Doc ${i}`, content: `Content ${i}` },
        'test', 'test.jsonl', 'tenant-1',
      ));
    }

    for (const doc of docs) {
      chunkBuilder.write(doc);
    }
    chunkBuilder.end();

    const chunks = await collectChunks(chunkBuilder);

    assert.equal(chunks.length, 3, 'Should produce 3 chunks (10 + 10 + 5)');
    assert.equal(chunks[0].documents.length, 10);
    assert.equal(chunks[1].documents.length, 10);
    assert.equal(chunks[2].documents.length, 5);
    assert.equal(chunks[0].batchNumber, 1);
    assert.equal(chunks[1].batchNumber, 2);
    assert.equal(chunks[2].batchNumber, 3);
  });

  it('should handle exact batch size boundaries', async () => {
    const chunkBuilder = createChunkBuilder(5);
    const docs: NormalizedDocument[] = [];

    for (let i = 0; i < 10; i++) {
      docs.push(normalizeDocument(
        { title: `Doc ${i}`, content: `Content ${i}` },
        'test', 'test.jsonl', 'tenant-1',
      ));
    }

    for (const doc of docs) {
      chunkBuilder.write(doc);
    }
    chunkBuilder.end();

    const chunks = await collectChunks(chunkBuilder);

    assert.equal(chunks.length, 2, 'Should produce exactly 2 chunks');
    assert.equal(chunks[0].documents.length, 5);
    assert.equal(chunks[1].documents.length, 5);
  });

  it('should handle empty input', async () => {
    const chunkBuilder = createChunkBuilder(10);
    chunkBuilder.end();

    const chunks = await collectChunks(chunkBuilder);
    assert.equal(chunks.length, 0, 'Should produce no chunks for empty input');
  });
});

describe('Ingestion State Repository', () => {
  it('should track ingestion state', async () => {
    const db = createInMemoryStateDb();
    const repo = new IngestionStateRepository(db);

    // No initial state
    const initial = await repo.getState('test-corpus', 'test.jsonl');
    assert.equal(initial, null);

    // Initialize
    const state = await repo.initializeState('test-corpus', 'test.jsonl', 1000);
    assert.equal(state.status, 'in_progress');
    assert.equal(state.totalRecords, 1000);
    assert.equal(state.recordsProcessed, 0);
  });

  it('should checkpoint progress', async () => {
    const db = createInMemoryStateDb();
    const repo = new IngestionStateRepository(db);

    await repo.initializeState('test-corpus', 'test.jsonl', 1000);
    await repo.checkpoint('test-corpus', 'test.jsonl', 500, 500);

    const state = await repo.getState('test-corpus', 'test.jsonl');
    assert.ok(state);
    assert.equal(state.lastProcessedOffset, 500);
    assert.equal(state.recordsProcessed, 500);
    assert.equal(state.status, 'in_progress');
  });

  it('should support resume from checkpoint', async () => {
    const db = createInMemoryStateDb();
    const repo = new IngestionStateRepository(db);

    await repo.initializeState('test-corpus', 'test.jsonl', 1000);
    await repo.checkpoint('test-corpus', 'test.jsonl', 500, 500);

    // Simulate crash — mark as failed
    await repo.markFailed('test-corpus', 'test.jsonl', 'Process killed');

    // Get resume offset
    const offset = await repo.getResumeOffset('test-corpus', 'test.jsonl');
    assert.equal(offset, 500, 'Should resume from last checkpoint');
  });

  it('should mark completed', async () => {
    const db = createInMemoryStateDb();
    const repo = new IngestionStateRepository(db);

    await repo.initializeState('test-corpus', 'test.jsonl', 100);
    await repo.markCompleted('test-corpus', 'test.jsonl', 100);

    const state = await repo.getState('test-corpus', 'test.jsonl');
    assert.ok(state);
    assert.equal(state.status, 'completed');

    // Completed runs should return offset 0 (start fresh)
    const offset = await repo.getResumeOffset('test-corpus', 'test.jsonl');
    assert.equal(offset, 0);
  });

  it('should mark failed with error message', async () => {
    const db = createInMemoryStateDb();
    const repo = new IngestionStateRepository(db);

    await repo.initializeState('test-corpus', 'test.jsonl', 100);
    await repo.markFailed('test-corpus', 'test.jsonl', 'Connection lost');

    const state = await repo.getState('test-corpus', 'test.jsonl');
    assert.ok(state);
    assert.equal(state.status, 'failed');
  });
});

describe('Ingestion Logger', () => {
  it('should log batch results', async () => {
    const db = createInMemoryLogDb();
    const logger = new IngestionLogger(db);

    const result: BatchResult = {
      batchNumber: 1,
      recordsInserted: 500,
      recordsSkipped: 0,
      durationMs: 150,
      status: 'success',
    };

    await logger.logBatch('test-corpus', result);

    const logs = await logger.getRecentLogs('test-corpus');
    assert.equal(logs.length, 1);
    assert.equal(logs[0].batchNumber, 1);
    assert.equal(logs[0].recordsInserted, 500);
    assert.equal(logs[0].status, 'success');
  });

  it('should track batch counts by status', async () => {
    const db = createInMemoryLogDb();
    const logger = new IngestionLogger(db);

    await logger.logBatch('test-corpus', { batchNumber: 1, recordsInserted: 100, recordsSkipped: 0, durationMs: 50, status: 'success' });
    await logger.logBatch('test-corpus', { batchNumber: 2, recordsInserted: 100, recordsSkipped: 0, durationMs: 50, status: 'success' });
    await logger.logBatch('test-corpus', { batchNumber: 3, recordsInserted: 0, recordsSkipped: 0, durationMs: 10, status: 'failed', errorMessage: 'error' });

    const counts = await logger.getBatchCounts('test-corpus');
    assert.equal(counts.success, 2);
    assert.equal(counts.failed, 1);
    assert.equal(counts.skipped, 0);
  });
});

describe('Bulk Inserter (In-Memory)', () => {
  it('should insert documents and count correctly', async () => {
    const inserter = createInMemoryInserter();

    const docs: NormalizedDocument[] = [];
    for (let i = 0; i < 10; i++) {
      docs.push(normalizeDocument(
        { title: `Doc ${i}`, content: `Unique content ${i}` },
        'test', 'test.jsonl', 'tenant-1',
      ));
    }

    const count = await inserter.insertBatch(docs);
    assert.equal(count, 10);
    assert.equal(inserter.getCount(), 10);
  });

  it('should skip duplicate documents', async () => {
    const inserter = createInMemoryInserter();

    const doc = normalizeDocument(
      { title: 'Duplicate', content: 'Same content' },
      'test', 'test.jsonl', 'tenant-1',
    );

    // Insert same document twice
    await inserter.insertBatch([doc]);
    const count = await inserter.insertBatch([doc]);

    assert.equal(count, 0, 'Second insert should return 0 (duplicate)');
    assert.equal(inserter.getCount(), 1, 'Should only have 1 unique document');
  });

  it('should handle mixed new and duplicate documents', async () => {
    const inserter = createInMemoryInserter();

    const doc1 = normalizeDocument({ title: 'A', content: 'Content A' }, 'test', 'test.jsonl', 'tenant-1');
    const doc2 = normalizeDocument({ title: 'B', content: 'Content B' }, 'test', 'test.jsonl', 'tenant-1');
    const doc3 = normalizeDocument({ title: 'C', content: 'Content C' }, 'test', 'test.jsonl', 'tenant-1');

    await inserter.insertBatch([doc1, doc2]);
    const count = await inserter.insertBatch([doc2, doc3]);

    assert.equal(count, 1, 'Should insert 1 new and skip 1 duplicate');
    assert.equal(inserter.getCount(), 3);
  });
});

describe('End-to-End Pipeline (Small Corpus)', () => {
  before(async () => {
    await generateJsonlCorpus(MEDIUM_CORPUS, 1000);
  });

  it('should ingest 1000 documents through full pipeline', async () => {
    const inserter = createInMemoryInserter();
    const stateDb = createInMemoryStateDb();
    const logDb = createInMemoryLogDb();
    const stateRepo = new IngestionStateRepository(stateDb);
    const logger = new IngestionLogger(logDb);
    const batchSize = 100;
    const corpusName = 'e2e-test';
    const fileName = 'test-medium.jsonl';

    // Initialize state
    await stateRepo.initializeState(corpusName, fileName, 1000);

    // Parse and normalize
    const { stream } = await createCorpusParser(MEDIUM_CORPUS);
    const normalizer = createNormalizerTransform(corpusName, fileName, 'tenant-1');
    const chunkBuilder = createChunkBuilder(batchSize);

    stream.pipe(normalizer).pipe(chunkBuilder);

    let totalInserted = 0;
    let batchCount = 0;

    for await (const chunk of chunkBuilder) {
      const typedChunk = chunk as Chunk;
      batchCount++;

      const startTime = Date.now();
      const count = await inserter.insertBatch(typedChunk.documents);
      const durationMs = Date.now() - startTime;

      totalInserted += count;

      await logger.logBatch(corpusName, {
        batchNumber: typedChunk.batchNumber,
        recordsInserted: count,
        recordsSkipped: typedChunk.documents.length - count,
        durationMs,
        status: 'success',
      });

      await stateRepo.checkpoint(
        corpusName, fileName,
        typedChunk.endOffset,
        totalInserted,
      );
    }

    await stateRepo.markCompleted(corpusName, fileName, totalInserted);

    // Verify
    assert.equal(totalInserted, 1000, 'Should insert all 1000 documents');
    assert.equal(batchCount, 10, 'Should produce 10 batches of 100');
    assert.equal(inserter.getCount(), 1000);

    const state = await stateRepo.getState(corpusName, fileName);
    assert.ok(state);
    assert.equal(state.status, 'completed');

    const logCounts = await logger.getBatchCounts(corpusName);
    assert.equal(logCounts.success, 10);
    assert.equal(logCounts.failed, 0);
  });
});

describe('Crash Recovery', () => {
  it('should resume from checkpoint after simulated crash', async () => {
    await generateJsonlCorpus(MEDIUM_CORPUS, 500);

    const inserter = createInMemoryInserter();
    const stateDb = createInMemoryStateDb();
    const logDb = createInMemoryLogDb();
    const stateRepo = new IngestionStateRepository(stateDb);
    const _logger = new IngestionLogger(logDb);
    const batchSize = 50;
    const corpusName = 'crash-test';
    const fileName = 'test-medium.jsonl';

    // --- First run: process 5 batches then "crash" ---
    await stateRepo.initializeState(corpusName, fileName, 500);

    const { stream: stream1 } = await createCorpusParser(MEDIUM_CORPUS);
    const normalizer1 = createNormalizerTransform(corpusName, fileName, 'tenant-1');
    const chunkBuilder1 = createChunkBuilder(batchSize);

    stream1.pipe(normalizer1).pipe(chunkBuilder1);

    let batchesProcessed = 0;
    let totalInserted = 0;

    for await (const chunk of chunkBuilder1) {
      const typedChunk = chunk as Chunk;
      batchesProcessed++;

      if (batchesProcessed > 5) {
        // Simulate crash — stop processing
        break;
      }

      const count = await inserter.insertBatch(typedChunk.documents);
      totalInserted += count;

      await stateRepo.checkpoint(
        corpusName, fileName,
        typedChunk.endOffset,
        totalInserted,
      );
    }

    // Simulate crash
    await stateRepo.markFailed(corpusName, fileName, 'Process killed');
    const firstRunInserted = totalInserted;
    assert.equal(firstRunInserted, 250, 'Should have inserted 5 batches x 50 = 250');

    // --- Second run: resume from checkpoint ---
    const resumeOffset = await stateRepo.getResumeOffset(corpusName, fileName);
    assert.equal(resumeOffset, 250, 'Should resume from offset 250');

    await stateRepo.initializeState(corpusName, fileName, 500);

    const { stream: stream2 } = await createCorpusParser(MEDIUM_CORPUS, resumeOffset);
    const normalizer2 = createNormalizerTransform(corpusName, fileName, 'tenant-1');
    const chunkBuilder2 = createChunkBuilder(batchSize);

    stream2.pipe(normalizer2).pipe(chunkBuilder2);

    for await (const chunk of chunkBuilder2) {
      const typedChunk = chunk as Chunk;
      const count = await inserter.insertBatch(typedChunk.documents);
      totalInserted += count;

      await stateRepo.checkpoint(
        corpusName, fileName,
        typedChunk.endOffset + resumeOffset,
        totalInserted,
      );
    }

    await stateRepo.markCompleted(corpusName, fileName, totalInserted);

    // Verify no duplicates
    assert.equal(inserter.getCount(), 500, 'Should have exactly 500 unique documents');

    const state = await stateRepo.getState(corpusName, fileName);
    assert.ok(state);
    assert.equal(state.status, 'completed');
  });
});

describe('Batch Integrity', () => {
  it('should maintain document order within batches', async () => {
    await generateJsonlCorpus(SMALL_CORPUS, 30);

    const { stream } = await createCorpusParser(SMALL_CORPUS);
    const normalizer = createNormalizerTransform('test', 'test.jsonl', 'tenant-1');
    const chunkBuilder = createChunkBuilder(10);

    stream.pipe(normalizer).pipe(chunkBuilder);

    const chunks = await collectChunks(chunkBuilder);

    assert.equal(chunks.length, 3);

    // Verify sequential batch numbers
    for (let i = 0; i < chunks.length; i++) {
      assert.equal(chunks[i].batchNumber, i + 1);
    }

    // Verify no gaps in offsets
    let expectedStart = 0;
    for (const chunk of chunks) {
      assert.equal(chunk.startOffset, expectedStart);
      expectedStart = chunk.endOffset;
    }
    assert.equal(expectedStart, 30, 'Total documents should be 30');
  });

  it('should never produce empty batches', async () => {
    await generateJsonlCorpus(SMALL_CORPUS, 7);

    const { stream } = await createCorpusParser(SMALL_CORPUS);
    const normalizer = createNormalizerTransform('test', 'test.jsonl', 'tenant-1');
    const chunkBuilder = createChunkBuilder(3);

    stream.pipe(normalizer).pipe(chunkBuilder);

    const chunks = await collectChunks(chunkBuilder);

    for (const chunk of chunks) {
      assert.ok(chunk.documents.length > 0, `Batch #${chunk.batchNumber} should not be empty`);
    }
  });
});

describe('Duplicate Protection', () => {
  it('should reject duplicate documents across batches', async () => {
    const inserter = createInMemoryInserter();

    // Create 10 unique docs
    const uniqueDocs: NormalizedDocument[] = [];
    for (let i = 0; i < 10; i++) {
      uniqueDocs.push(normalizeDocument(
        { title: `Doc ${i}`, content: `Unique ${i}` },
        'test', 'test.jsonl', 'tenant-1',
      ));
    }

    // Insert first batch
    const count1 = await inserter.insertBatch(uniqueDocs.slice(0, 5));
    assert.equal(count1, 5);

    // Insert second batch with overlap
    const count2 = await inserter.insertBatch(uniqueDocs.slice(3, 8));
    assert.equal(count2, 3, 'Should only insert 3 new (skip docs 3,4)');

    // Insert remaining
    const count3 = await inserter.insertBatch(uniqueDocs.slice(7, 10));
    assert.equal(count3, 2, 'Should only insert 2 new (skip doc 7)');

    assert.equal(inserter.getCount(), 10, 'Total should be 10 unique documents');
  });
});

describe('50k Corpus Test', () => {
  before(async () => {
    process.stdout.write('Generating 50k test corpus...\n');
    await generateJsonlCorpus(LARGE_CORPUS, 50000);
    process.stdout.write('50k corpus generated.\n');
  });

  it('should ingest 50k documents with constant memory', async () => {
    const inserter = createInMemoryInserter();
    const stateDb = createInMemoryStateDb();
    const stateRepo = new IngestionStateRepository(stateDb);
    const batchSize = 500;
    const corpusName = 'large-test';
    const fileName = 'test-50k.jsonl';

    // Count records
    const totalRecords = await countRecords(LARGE_CORPUS);
    assert.equal(totalRecords, 50000);

    await stateRepo.initializeState(corpusName, fileName, totalRecords);

    // Track memory
    const memorySnapshots: number[] = [];
    const _startMemory = process.memoryUsage().heapUsed;

    const { stream } = await createCorpusParser(LARGE_CORPUS);
    const normalizer = createNormalizerTransform(corpusName, fileName, 'tenant-1');
    const chunkBuilder = createChunkBuilder(batchSize);

    stream.pipe(normalizer).pipe(chunkBuilder);

    let totalInserted = 0;
    let batchCount = 0;
    const startTime = Date.now();

    for await (const chunk of chunkBuilder) {
      const typedChunk = chunk as Chunk;
      batchCount++;

      const count = await inserter.insertBatch(typedChunk.documents);
      totalInserted += count;

      // Sample memory every 10 batches
      if (batchCount % 10 === 0) {
        memorySnapshots.push(process.memoryUsage().heapUsed);
      }

      await stateRepo.checkpoint(corpusName, fileName, typedChunk.endOffset, totalInserted);
    }

    const totalDurationMs = Date.now() - startTime;
    const throughput = Math.round((totalInserted / totalDurationMs) * 60000);

    await stateRepo.markCompleted(corpusName, fileName, totalInserted);

    // Verify completeness
    assert.equal(totalInserted, 50000, 'Should insert all 50k documents');
    assert.equal(batchCount, 100, 'Should produce 100 batches of 500');

    // Verify memory stays bounded (< 500MB)
    const peakMemory = Math.max(...memorySnapshots);
    const memoryMB = Math.round(peakMemory / 1024 / 1024);
    process.stdout.write(`Peak memory: ${memoryMB}MB\n`);
    assert.ok(peakMemory < 500 * 1024 * 1024, `Memory should stay under 500MB (was ${memoryMB}MB)`);

    // Verify throughput
    process.stdout.write(`Throughput: ${throughput} rec/min\n`);
    process.stdout.write(`Duration: ${(totalDurationMs / 1000).toFixed(1)}s\n`);
    assert.ok(throughput > 5000, `Throughput should exceed 5k rec/min (was ${throughput})`);

    // Verify state
    const state = await stateRepo.getState(corpusName, fileName);
    assert.ok(state);
    assert.equal(state.status, 'completed');
  });

  after(async () => {
    // Clean up test data
    try {
      await rm(TEST_DIR, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });
});
