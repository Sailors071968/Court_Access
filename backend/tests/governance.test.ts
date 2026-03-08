// ============================================
// Court Access — Corpus Governance Layer Acceptance Tests
// Tests: duplicate detection, version updates, concurrent lock prevention, safe resume
// ============================================

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { CorpusRegistryRepository } from '../src/governance/corpusRegistry.ts';
import type { CorpusRegistryDb, CorpusRegistryRecord } from '../src/governance/corpusRegistry.ts';
import { CorpusLockManager } from '../src/governance/corpusLock.ts';
import type { CorpusLockDb, CorpusLockRecord } from '../src/governance/corpusLock.ts';
import { DuplicateDetector } from '../src/governance/duplicateDetector.ts';
import type { DuplicateCheckDb } from '../src/governance/duplicateDetector.ts';
import { CorpusVersionManager } from '../src/governance/corpusVersioning.ts';
import type { VersioningDb } from '../src/governance/corpusVersioning.ts';
import { GovernancePipeline } from '../src/governance/governancePipeline.ts';
import { GovernanceApiHandlers } from '../src/governance/governanceApi.ts';
import type { NormalizedDocument } from '../src/ingestion/types.ts';

// ---------------------------------------------------------------------------
// In-Memory Database Mocks
// ---------------------------------------------------------------------------

function createInMemoryRegistryDb(): CorpusRegistryDb {
  const store = new Map<string, CorpusRegistryRecord>();

  return {
    async findUnique(args) {
      const key = `${args.where.corpusName_version.corpusName}:${args.where.corpusName_version.version}`;
      return store.get(key) ?? null;
    },
    async findMany(args) {
      let records = Array.from(store.values());
      if (args?.where) {
        if (args.where.corpusName) records = records.filter(r => r.corpusName === args.where!.corpusName);
        if (args.where.jurisdiction) records = records.filter(r => r.jurisdiction === args.where!.jurisdiction);
        if (args.where.ingestionStatus) records = records.filter(r => r.ingestionStatus === args.where!.ingestionStatus);
      }
      if (args?.orderBy?.createdAt === 'desc') {
        records.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      } else {
        records.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      }
      return records;
    },
    async create(args) {
      const now = new Date();
      const record: CorpusRegistryRecord = {
        id: randomUUID(),
        ...args.data,
        createdAt: now,
        updatedAt: now,
      };
      const key = `${record.corpusName}:${record.version}`;
      if (store.has(key)) throw new Error('Unique constraint violation');
      store.set(key, record);
      return record;
    },
    async update(args) {
      const key = `${args.where.corpusName_version.corpusName}:${args.where.corpusName_version.version}`;
      const existing = store.get(key);
      if (!existing) throw new Error('Record not found');
      const updated = { ...existing, ...args.data, updatedAt: new Date() };
      store.set(key, updated);
      return updated;
    },
    async count(args) {
      let records = Array.from(store.values());
      if (args?.where) {
        if (args.where.corpusName) records = records.filter(r => r.corpusName === args.where!.corpusName);
        if (args.where.ingestionStatus) records = records.filter(r => r.ingestionStatus === args.where!.ingestionStatus);
      }
      return records.length;
    },
  };
}

function createInMemoryLockDb(): CorpusLockDb {
  const store = new Map<string, CorpusLockRecord>();

  return {
    async findUnique(args) {
      return store.get(args.where.corpusName) ?? null;
    },
    async create(args) {
      const record: CorpusLockRecord = {
        id: randomUUID(),
        ...args.data,
      };
      if (store.has(record.corpusName)) throw new Error('Unique constraint violation');
      store.set(record.corpusName, record);
      return record;
    },
    async update(args) {
      const existing = store.get(args.where.corpusName);
      if (!existing) throw new Error('Record not found');
      const updated = { ...existing, ...args.data };
      store.set(args.where.corpusName, updated);
      return updated;
    },
    async delete(args) {
      const existing = store.get(args.where.corpusName);
      if (!existing) throw new Error('Record not found');
      store.delete(args.where.corpusName);
      return existing;
    },
    async deleteMany(args) {
      let count = 0;
      for (const [key, record] of store) {
        if (record.expiresAt < args.where.expiresAt.lt) {
          store.delete(key);
          count++;
        }
      }
      return { count };
    },
  };
}

function createInMemoryDuplicateDb(): DuplicateCheckDb & { _insertedHashes: Set<string> } {
  const insertedHashes = new Set<string>();

  return {
    _insertedHashes: insertedHashes,
    async findMany(args) {
      const results: Array<{ contentHash: string }> = [];
      for (const hash of args.where.contentHash.in) {
        if (insertedHashes.has(`${hash}:${args.where.tenantId}`)) {
          results.push({ contentHash: hash });
        }
      }
      return results;
    },
    async count() {
      return insertedHashes.size;
    },
  };
}

function createInMemoryVersioningDb(): VersioningDb & {
  _documents: Map<string, { id: string; contentHash: string; corpusVersion: string | null; supersededBy?: string }>;
} {
  const documents = new Map<string, { id: string; contentHash: string; corpusVersion: string | null; supersededBy?: string }>();

  return {
    _documents: documents,
    async findMany(args) {
      const results: Array<{ id: string; contentHash: string; corpusVersion: string | null }> = [];
      for (const doc of documents.values()) {
        if (args.where.corpusVersion !== undefined && doc.corpusVersion !== args.where.corpusVersion) continue;
        results.push({ id: doc.id, contentHash: doc.contentHash, corpusVersion: doc.corpusVersion });
      }
      return results;
    },
    async updateMany(args) {
      let count = 0;
      const ids = new Set(args.where.id.in);
      for (const [key, doc] of documents) {
        if (ids.has(doc.id)) {
          documents.set(key, { ...doc, supersededBy: args.data.supersededBy });
          count++;
        }
      }
      return { count };
    },
  };
}

function createMockDocument(overrides: Partial<NormalizedDocument> = {}): NormalizedDocument {
  const id = randomUUID();
  const now = new Date();
  return {
    id,
    tenantId: 'tenant-1',
    title: `Test Document ${id.slice(0, 8)}`,
    content: `Content for document ${id}`,
    jurisdiction: 'CA',
    documentType: 'statute',
    source: 'test',
    version: '1.0',
    corpusName: 'test-corpus',
    sourceFile: 'test.jsonl',
    contentHash: `hash-${id}`,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Corpus Registry Tests
// ---------------------------------------------------------------------------

describe('Corpus Registry', () => {
  let registryDb: CorpusRegistryDb;
  let registry: CorpusRegistryRepository;

  beforeEach(() => {
    registryDb = createInMemoryRegistryDb();
    registry = new CorpusRegistryRepository(registryDb);
  });

  it('should register a new corpus', async () => {
    const entry = await registry.register({
      corpusName: 'penal_code',
      jurisdiction: 'CA',
      sourceAuthority: 'California Legislature',
      version: '2024.1',
    });

    assert.equal(entry.corpusName, 'penal_code');
    assert.equal(entry.jurisdiction, 'CA');
    assert.equal(entry.sourceAuthority, 'California Legislature');
    assert.equal(entry.version, '2024.1');
    assert.equal(entry.ingestionStatus, 'pending');
    assert.equal(entry.totalDocuments, 0);
  });

  it('should reject duplicate completed corpus registration', async () => {
    await registry.register({
      corpusName: 'penal_code',
      jurisdiction: 'CA',
      sourceAuthority: 'California Legislature',
      version: '2024.1',
    });

    await registry.markCompleted('penal_code', '2024.1', 100, 50000);

    await assert.rejects(
      () => registry.register({
        corpusName: 'penal_code',
        jurisdiction: 'CA',
        sourceAuthority: 'California Legislature',
        version: '2024.1',
      }),
      (err: Error) => {
        assert.ok(err.message.includes('already ingested'));
        return true;
      },
    );
  });

  it('should allow re-registration of failed corpus', async () => {
    await registry.register({
      corpusName: 'penal_code',
      jurisdiction: 'CA',
      sourceAuthority: 'California Legislature',
      version: '2024.1',
    });

    await registry.markFailed('penal_code', '2024.1');

    // Should NOT throw — re-registration of failed corpus is allowed
    const entry = await registry.register({
      corpusName: 'penal_code',
      jurisdiction: 'CA',
      sourceAuthority: 'California Legislature',
      version: '2024.1',
    });

    assert.equal(entry.ingestionStatus, 'failed');
  });

  it('should track corpus status transitions', async () => {
    await registry.register({
      corpusName: 'evidence_code',
      jurisdiction: 'CA',
      sourceAuthority: 'California Legislature',
      version: '1.0',
    });

    let entry = await registry.get('evidence_code', '1.0');
    assert.equal(entry?.ingestionStatus, 'pending');

    await registry.markInProgress('evidence_code', '1.0');
    entry = await registry.get('evidence_code', '1.0');
    assert.equal(entry?.ingestionStatus, 'in_progress');

    await registry.markCompleted('evidence_code', '1.0', 500, 250000);
    entry = await registry.get('evidence_code', '1.0');
    assert.equal(entry?.ingestionStatus, 'completed');
    assert.equal(entry?.totalDocuments, 500);
    assert.equal(entry?.totalBytes, 250000);
  });

  it('should list corpora with filters', async () => {
    await registry.register({ corpusName: 'penal_code', jurisdiction: 'CA', sourceAuthority: 'CA Leg', version: '1.0' });
    await registry.register({ corpusName: 'evidence_code', jurisdiction: 'CA', sourceAuthority: 'CA Leg', version: '1.0' });
    await registry.register({ corpusName: 'us_code', jurisdiction: 'US', sourceAuthority: 'Congress', version: '1.0' });

    const all = await registry.list();
    assert.equal(all.length, 3);

    const caCorpora = await registry.list({ jurisdiction: 'CA' });
    assert.equal(caCorpora.length, 2);

    const penalOnly = await registry.list({ corpusName: 'penal_code' });
    assert.equal(penalOnly.length, 1);
  });

  it('should support multiple versions of the same corpus', async () => {
    await registry.register({ corpusName: 'penal_code', jurisdiction: 'CA', sourceAuthority: 'CA Leg', version: '2024.1' });
    await registry.markCompleted('penal_code', '2024.1', 100, 50000);

    // Small delay ensures createdAt ordering is deterministic in the in-memory store
    await new Promise(r => setTimeout(r, 5));

    await registry.register({ corpusName: 'penal_code', jurisdiction: 'CA', sourceAuthority: 'CA Leg', version: '2024.2' });

    const versions = await registry.getVersions('penal_code');
    assert.equal(versions.length, 2);

    const latest = await registry.getLatestVersion('penal_code');
    assert.ok(latest);
    assert.equal(latest.version, '2024.2');
  });

  it('should check if corpus is ingested', async () => {
    await registry.register({ corpusName: 'penal_code', jurisdiction: 'CA', sourceAuthority: 'CA Leg', version: '1.0' });

    assert.equal(await registry.isIngested('penal_code', '1.0'), false);
    await registry.markCompleted('penal_code', '1.0', 100, 50000);
    assert.equal(await registry.isIngested('penal_code', '1.0'), true);
  });
});

// ---------------------------------------------------------------------------
// Corpus Lock Tests
// ---------------------------------------------------------------------------

describe('Corpus Lock Manager', () => {
  let lockDb: CorpusLockDb;
  let lockManager: CorpusLockManager;

  beforeEach(() => {
    lockDb = createInMemoryLockDb();
    lockManager = new CorpusLockManager(lockDb);
  });

  it('should acquire a lock on an unlocked corpus', async () => {
    const lock = await lockManager.acquire({
      corpusName: 'penal_code',
      workerId: 'worker-1',
    });

    assert.ok(lock);
    assert.equal(lock.corpusName, 'penal_code');
    assert.equal(lock.workerId, 'worker-1');
    assert.ok(lock.expiresAt > new Date());
  });

  it('should prevent concurrent lock acquisition', async () => {
    // Worker 1 acquires lock
    const lock1 = await lockManager.acquire({
      corpusName: 'penal_code',
      workerId: 'worker-1',
    });
    assert.ok(lock1);

    // Worker 2 tries to acquire — should fail
    const lock2 = await lockManager.acquire({
      corpusName: 'penal_code',
      workerId: 'worker-2',
    });
    assert.equal(lock2, null, 'Worker 2 should not acquire a lock that Worker 1 holds');
  });

  it('should allow different corpora to be locked independently', async () => {
    const lock1 = await lockManager.acquire({ corpusName: 'penal_code', workerId: 'worker-1' });
    const lock2 = await lockManager.acquire({ corpusName: 'evidence_code', workerId: 'worker-2' });

    assert.ok(lock1);
    assert.ok(lock2);
    assert.equal(lock1.corpusName, 'penal_code');
    assert.equal(lock2.corpusName, 'evidence_code');
  });

  it('should release a lock by the owning worker', async () => {
    await lockManager.acquire({ corpusName: 'penal_code', workerId: 'worker-1' });

    const released = await lockManager.release('penal_code', 'worker-1');
    assert.equal(released, true);

    const isLocked = await lockManager.isLocked('penal_code');
    assert.equal(isLocked, false);
  });

  it('should reject lock release by non-owner', async () => {
    await lockManager.acquire({ corpusName: 'penal_code', workerId: 'worker-1' });

    await assert.rejects(
      () => lockManager.release('penal_code', 'worker-2'),
      (err: Error) => {
        assert.ok(err.message.includes('Cannot release lock'));
        return true;
      },
    );
  });

  it('should allow lock acquisition after release', async () => {
    await lockManager.acquire({ corpusName: 'penal_code', workerId: 'worker-1' });
    await lockManager.release('penal_code', 'worker-1');

    const lock2 = await lockManager.acquire({ corpusName: 'penal_code', workerId: 'worker-2' });
    assert.ok(lock2);
    assert.equal(lock2.workerId, 'worker-2');
  });

  it('should allow lock acquisition after expiry', async () => {
    // Acquire with 1ms duration (essentially immediate expiry)
    await lockManager.acquire({
      corpusName: 'penal_code',
      workerId: 'worker-1',
      durationMs: 1,
    });

    // Wait for expiry
    await new Promise(resolve => setTimeout(resolve, 10));

    // Another worker should be able to acquire now
    const lock2 = await lockManager.acquire({
      corpusName: 'penal_code',
      workerId: 'worker-2',
    });
    assert.ok(lock2, 'Should acquire lock after expiry');
    assert.equal(lock2.workerId, 'worker-2');
  });

  it('should force-release a lock regardless of owner', async () => {
    await lockManager.acquire({ corpusName: 'penal_code', workerId: 'worker-1' });

    const released = await lockManager.forceRelease('penal_code');
    assert.equal(released, true);

    const isLocked = await lockManager.isLocked('penal_code');
    assert.equal(isLocked, false);
  });

  it('should check lock status correctly', async () => {
    assert.equal(await lockManager.isLocked('penal_code'), false);

    await lockManager.acquire({ corpusName: 'penal_code', workerId: 'worker-1' });
    assert.equal(await lockManager.isLocked('penal_code'), true);

    await lockManager.release('penal_code', 'worker-1');
    assert.equal(await lockManager.isLocked('penal_code'), false);
  });
});

// ---------------------------------------------------------------------------
// Duplicate Detection Tests
// ---------------------------------------------------------------------------

describe('Duplicate Detector', () => {
  let dupDb: DuplicateCheckDb & { _insertedHashes: Set<string> };
  let detector: DuplicateDetector;

  beforeEach(() => {
    dupDb = createInMemoryDuplicateDb();
    detector = new DuplicateDetector(dupDb);
  });

  it('should detect no duplicates in empty database', async () => {
    const docs = [createMockDocument(), createMockDocument()];
    const existingHashes = await detector.findExistingHashes(
      docs.map(d => d.contentHash),
      'tenant-1',
    );
    assert.equal(existingHashes.size, 0);
  });

  it('should detect existing documents as duplicates', async () => {
    const doc1 = createMockDocument({ contentHash: 'hash-abc' });
    const doc2 = createMockDocument({ contentHash: 'hash-def' });
    const doc3 = createMockDocument({ contentHash: 'hash-ghi' });

    // Simulate doc1 and doc3 already in database
    dupDb._insertedHashes.add('hash-abc:tenant-1');
    dupDb._insertedHashes.add('hash-ghi:tenant-1');

    const { newDocuments, skippedCount } = await detector.filterDuplicates(
      [doc1, doc2, doc3],
      'tenant-1',
    );

    assert.equal(skippedCount, 2, 'Should skip 2 duplicates');
    assert.equal(newDocuments.length, 1, 'Should have 1 new document');
    assert.equal(newDocuments[0].contentHash, 'hash-def');
  });

  it('should skip all documents when entire corpus is duplicate', async () => {
    const docs = [
      createMockDocument({ contentHash: 'hash-1' }),
      createMockDocument({ contentHash: 'hash-2' }),
      createMockDocument({ contentHash: 'hash-3' }),
    ];

    // All already exist
    dupDb._insertedHashes.add('hash-1:tenant-1');
    dupDb._insertedHashes.add('hash-2:tenant-1');
    dupDb._insertedHashes.add('hash-3:tenant-1');

    const { newDocuments, skippedCount } = await detector.filterDuplicates(docs, 'tenant-1');

    assert.equal(skippedCount, 3, 'Should skip all 3');
    assert.equal(newDocuments.length, 0, 'No new documents');
  });

  it('should generate a duplicate report', async () => {
    const docs = [
      createMockDocument({ contentHash: 'hash-a' }),
      createMockDocument({ contentHash: 'hash-b' }),
    ];

    dupDb._insertedHashes.add('hash-a:tenant-1');

    const report = await detector.generateReport('penal_code', '2024.1', docs, 'tenant-1');

    assert.equal(report.corpusName, 'penal_code');
    assert.equal(report.version, '2024.1');
    assert.equal(report.totalDocuments, 2);
    assert.equal(report.duplicatesSkipped, 1);
    assert.equal(report.newDocuments, 1);
  });

  it('should compute deterministic hashes', () => {
    const hash1 = DuplicateDetector.computeHash('hello world', 'tenant-1');
    const hash2 = DuplicateDetector.computeHash('hello world', 'tenant-1');
    const hash3 = DuplicateDetector.computeHash('hello world', 'tenant-2');

    assert.equal(hash1, hash2, 'Same content+tenant should produce same hash');
    assert.notEqual(hash1, hash3, 'Different tenant should produce different hash');
  });

  it('should handle empty document batch', async () => {
    const { newDocuments, skippedCount } = await detector.filterDuplicates([], 'tenant-1');
    assert.equal(skippedCount, 0);
    assert.equal(newDocuments.length, 0);
  });
});

// ---------------------------------------------------------------------------
// Corpus Versioning Tests
// ---------------------------------------------------------------------------

describe('Corpus Version Manager', () => {
  let versioningDb: VersioningDb & {
    _documents: Map<string, { id: string; contentHash: string; corpusVersion: string | null; supersededBy?: string }>;
  };
  let versionManager: CorpusVersionManager;

  beforeEach(() => {
    versioningDb = createInMemoryVersioningDb();
    versionManager = new CorpusVersionManager(versioningDb);
  });

  it('should stamp documents with corpus version', () => {
    const docs = [createMockDocument(), createMockDocument()];
    const stamped = versionManager.stampVersion(docs, '2024.1');

    assert.equal(stamped[0].corpusVersion, '2024.1');
    assert.equal(stamped[1].corpusVersion, '2024.1');
  });

  it('should compute version diff between corpus versions', async () => {
    // Add some documents for version 1.0
    const doc1 = { id: 'id-1', contentHash: 'hash-1', corpusVersion: '1.0' };
    const doc2 = { id: 'id-2', contentHash: 'hash-2', corpusVersion: '1.0' };
    const doc3 = { id: 'id-3', contentHash: 'hash-3', corpusVersion: '1.0' };
    versioningDb._documents.set('id-1', doc1);
    versioningDb._documents.set('id-2', doc2);
    versioningDb._documents.set('id-3', doc3);

    // New version has hash-1 (unchanged), hash-4 (new), hash-5 (new) — hash-2, hash-3 removed
    const newDocs = [
      createMockDocument({ contentHash: 'hash-1', version: '2.0' }),
      createMockDocument({ contentHash: 'hash-4', version: '2.0' }),
      createMockDocument({ contentHash: 'hash-5', version: '2.0' }),
    ];

    const diff = await versionManager.computeVersionDiff('test-corpus', 'tenant-1', '1.0', '2.0', newDocs);

    assert.equal(diff.unchanged, 1, '1 unchanged (hash-1)');
    assert.equal(diff.added, 2, '2 added (hash-4, hash-5)');
    assert.equal(diff.removed, 2, '2 removed (hash-2, hash-3)');
  });

  it('should supersede previous version documents', async () => {
    const doc1 = { id: 'id-1', contentHash: 'hash-1', corpusVersion: '1.0' };
    const doc2 = { id: 'id-2', contentHash: 'hash-2', corpusVersion: '1.0' };
    versioningDb._documents.set('id-1', doc1);
    versioningDb._documents.set('id-2', doc2);

    const count = await versionManager.supersedePreviousVersion('test-corpus', 'tenant-1', '1.0', '2.0');
    assert.equal(count, 2, 'Should supersede 2 documents');

    // Verify supersededBy is set
    const updated1 = versioningDb._documents.get('id-1');
    const updated2 = versioningDb._documents.get('id-2');
    assert.equal(updated1?.supersededBy, '2.0');
    assert.equal(updated2?.supersededBy, '2.0');
  });

  it('should compute deterministic corpus checksum', () => {
    const hashes1 = ['hash-a', 'hash-b', 'hash-c'];
    const hashes2 = ['hash-c', 'hash-a', 'hash-b']; // Different order

    const checksum1 = CorpusVersionManager.computeCorpusChecksum(hashes1);
    const checksum2 = CorpusVersionManager.computeCorpusChecksum(hashes2);

    assert.equal(checksum1, checksum2, 'Same hashes in different order should produce same checksum');
  });
});

// ---------------------------------------------------------------------------
// Governance Pipeline Integration Tests
// ---------------------------------------------------------------------------

describe('Governance Pipeline', () => {
  let registryDb: CorpusRegistryDb;
  let lockDb: CorpusLockDb;
  let dupDb: DuplicateCheckDb & { _insertedHashes: Set<string> };
  let versioningDb: VersioningDb & {
    _documents: Map<string, { id: string; contentHash: string; corpusVersion: string | null; supersededBy?: string }>;
  };
  let pipeline: GovernancePipeline;

  beforeEach(() => {
    registryDb = createInMemoryRegistryDb();
    lockDb = createInMemoryLockDb();
    dupDb = createInMemoryDuplicateDb();
    versioningDb = createInMemoryVersioningDb();

    const registry = new CorpusRegistryRepository(registryDb);
    const lockManager = new CorpusLockManager(lockDb);
    const duplicateDetector = new DuplicateDetector(dupDb);
    const versionManager = new CorpusVersionManager(versioningDb);

    pipeline = new GovernancePipeline(registry, lockManager, duplicateDetector, versionManager, 'test-worker');
  });

  it('should execute full pipeline: register → lock → ingest → unlock', async () => {
    const docs = [createMockDocument(), createMockDocument(), createMockDocument()];

    const result = await pipeline.execute(
      {
        corpusName: 'penal_code',
        jurisdiction: 'CA',
        sourceAuthority: 'California Legislature',
        version: '2024.1',
        filePath: '/data/penal_code.jsonl',
        tenantId: 'tenant-1',
        batchSize: 500,
        resume: false,
        dryRun: false,
        useCopy: false,
        concurrency: 1,
      },
      async (filteredDocs) => filteredDocs.length,
      docs,
    );

    assert.equal(result.status, 'completed');
    assert.equal(result.totalDocuments, 3);
    assert.equal(result.newDocuments, 3);
    assert.equal(result.duplicatesSkipped, 0);
    assert.equal(result.workerId, 'test-worker');
  });

  it('should skip already-ingested corpus', async () => {
    const docs = [createMockDocument()];
    const config = {
      corpusName: 'penal_code',
      jurisdiction: 'CA',
      sourceAuthority: 'California Legislature',
      version: '2024.1',
      filePath: '/data/penal_code.jsonl',
      tenantId: 'tenant-1',
      batchSize: 500,
      resume: false,
      dryRun: false,
      useCopy: false,
      concurrency: 1,
    };

    // First ingestion
    await pipeline.execute(config, async (d) => d.length, docs);

    // Second attempt — should be skipped
    const result = await pipeline.execute(config, async (d) => d.length, docs);

    assert.equal(result.status, 'skipped');
    assert.ok(result.errorMessage?.includes('already ingested'));
  });

  it('should skip duplicate documents within a batch', async () => {
    const doc1 = createMockDocument({ contentHash: 'hash-existing' });
    const doc2 = createMockDocument({ contentHash: 'hash-new' });

    // Mark doc1 as already in database
    dupDb._insertedHashes.add('hash-existing:tenant-1');

    const result = await pipeline.execute(
      {
        corpusName: 'evidence_code',
        jurisdiction: 'CA',
        sourceAuthority: 'California Legislature',
        version: '1.0',
        filePath: '/data/evidence.jsonl',
        tenantId: 'tenant-1',
        batchSize: 500,
        resume: false,
        dryRun: false,
        useCopy: false,
        concurrency: 1,
      },
      async (filteredDocs) => filteredDocs.length,
      [doc1, doc2],
    );

    assert.equal(result.status, 'completed');
    assert.equal(result.duplicatesSkipped, 1, 'Should skip 1 duplicate');
    assert.equal(result.newDocuments, 1, 'Should insert 1 new document');
  });

  it('should fail when lock cannot be acquired (concurrent ingestion)', async () => {
    const docs = [createMockDocument()];
    const config = {
      corpusName: 'penal_code',
      jurisdiction: 'CA',
      sourceAuthority: 'California Legislature',
      version: '2024.1',
      filePath: '/data/penal_code.jsonl',
      tenantId: 'tenant-1',
      batchSize: 500,
      resume: false,
      dryRun: false,
      useCopy: false,
      concurrency: 1,
    };

    // Create a separate pipeline (worker-2) that holds the lock
    const registry2 = new CorpusRegistryRepository(registryDb);
    const lockManager2 = new CorpusLockManager(lockDb);
    const dupDetector2 = new DuplicateDetector(dupDb);
    const verManager2 = new CorpusVersionManager(versioningDb);
    const pipeline2 = new GovernancePipeline(registry2, lockManager2, dupDetector2, verManager2, 'worker-2');

    // Worker-2 starts ingestion (holds lock via registry registration + lock)
    const lockResult = await lockManager2.acquire({ corpusName: 'penal_code', workerId: 'worker-2' });
    assert.ok(lockResult, 'Worker-2 should acquire lock');

    // Pipeline (worker-1) tries to ingest — should fail due to lock
    // First, register the corpus so the pipeline can proceed past registration
    await registry2.register({
      corpusName: 'penal_code',
      jurisdiction: 'CA',
      sourceAuthority: 'California Legislature',
      version: '2024.1',
    });

    const result = await pipeline.execute(config, async (d) => d.length, docs);

    assert.equal(result.status, 'failed');
    assert.ok(result.errorMessage?.includes('Failed to acquire lock'));
  });

  it('should release lock even if ingestion fails', async () => {
    const docs = [createMockDocument()];
    const lockManager = new CorpusLockManager(lockDb);

    const result = await pipeline.execute(
      {
        corpusName: 'bad_corpus',
        jurisdiction: 'CA',
        sourceAuthority: 'CA Leg',
        version: '1.0',
        filePath: '/data/bad.jsonl',
        tenantId: 'tenant-1',
        batchSize: 500,
        resume: false,
        dryRun: false,
        useCopy: false,
        concurrency: 1,
      },
      async () => { throw new Error('Simulated ingestion failure'); },
      docs,
    );

    assert.equal(result.status, 'failed');
    assert.ok(result.errorMessage?.includes('Simulated ingestion failure'));

    // Lock should be released
    const isLocked = await lockManager.isLocked('bad_corpus');
    assert.equal(isLocked, false, 'Lock should be released after failure');
  });

  it('should handle dry run without inserting', async () => {
    const docs = [createMockDocument(), createMockDocument()];

    const result = await pipeline.execute(
      {
        corpusName: 'penal_code',
        jurisdiction: 'CA',
        sourceAuthority: 'California Legislature',
        version: '1.0',
        filePath: '/data/penal_code.jsonl',
        tenantId: 'tenant-1',
        batchSize: 500,
        resume: false,
        dryRun: true,
        useCopy: false,
        concurrency: 1,
      },
      async () => { throw new Error('Should not be called in dry run'); },
      docs,
    );

    assert.equal(result.status, 'completed');
    assert.equal(result.newDocuments, 2);
  });
});

// ---------------------------------------------------------------------------
// Governance API Tests
// ---------------------------------------------------------------------------

describe('Governance API Handlers', () => {
  let registryDb: CorpusRegistryDb;
  let lockDb: CorpusLockDb;
  let api: GovernanceApiHandlers;

  beforeEach(() => {
    registryDb = createInMemoryRegistryDb();
    lockDb = createInMemoryLockDb();
    const registry = new CorpusRegistryRepository(registryDb);
    const lockManager = new CorpusLockManager(lockDb);
    api = new GovernanceApiHandlers(registry, lockManager);
  });

  it('GET /api/corpus/registry — should list registered corpora', async () => {
    // Register a corpus first
    await api.registerCorpus({
      body: {
        corpusName: 'penal_code',
        jurisdiction: 'CA',
        sourceAuthority: 'California Legislature',
        version: '2024.1',
      },
    });

    const response = await api.listRegistry({ query: {} });
    assert.equal(response.status, 200);
    const body = response.body as { corpora: unknown[]; total: number };
    assert.equal(body.total, 1);
    assert.equal(body.corpora.length, 1);
  });

  it('POST /api/corpus/register — should register new corpus', async () => {
    const response = await api.registerCorpus({
      body: {
        corpusName: 'penal_code',
        jurisdiction: 'CA',
        sourceAuthority: 'California Legislature',
        version: '2024.1',
      },
    });

    assert.equal(response.status, 201);
  });

  it('POST /api/corpus/register — should reject missing fields', async () => {
    const response = await api.registerCorpus({
      body: { corpusName: 'penal_code' },
    });

    assert.equal(response.status, 400);
  });

  it('GET /api/corpus/status — should return corpus status', async () => {
    await api.registerCorpus({
      body: {
        corpusName: 'penal_code',
        jurisdiction: 'CA',
        sourceAuthority: 'CA Leg',
        version: '1.0',
      },
    });

    const response = await api.getCorpusStatus({
      query: { corpusName: 'penal_code', version: '1.0' },
    });

    assert.equal(response.status, 200);
    const body = response.body as { corpus: { ingestionStatus: string }; locked: boolean };
    assert.equal(body.corpus.ingestionStatus, 'pending');
    assert.equal(body.locked, false);
  });

  it('POST /api/corpus/lock — should acquire lock', async () => {
    const response = await api.acquireLock({
      body: { corpusName: 'penal_code', workerId: 'worker-1' },
    });

    assert.equal(response.status, 200);
    const body = response.body as { lock: { workerId: string } };
    assert.equal(body.lock.workerId, 'worker-1');
  });

  it('POST /api/corpus/lock — should reject concurrent lock', async () => {
    await api.acquireLock({ body: { corpusName: 'penal_code', workerId: 'worker-1' } });

    const response = await api.acquireLock({
      body: { corpusName: 'penal_code', workerId: 'worker-2' },
    });

    assert.equal(response.status, 409);
  });

  it('POST /api/corpus/unlock — should release lock', async () => {
    await api.acquireLock({ body: { corpusName: 'penal_code', workerId: 'worker-1' } });

    const response = await api.releaseLock({
      body: { corpusName: 'penal_code', workerId: 'worker-1' },
    });

    assert.equal(response.status, 200);
  });

  it('POST /api/corpus/unlock — should reject unauthorized release', async () => {
    await api.acquireLock({ body: { corpusName: 'penal_code', workerId: 'worker-1' } });

    const response = await api.releaseLock({
      body: { corpusName: 'penal_code', workerId: 'worker-2' },
    });

    assert.equal(response.status, 403);
  });

  it('GET /api/corpus/versions — should return version history', async () => {
    await api.registerCorpus({
      body: { corpusName: 'penal_code', jurisdiction: 'CA', sourceAuthority: 'CA Leg', version: '1.0' },
    });
    await api.registerCorpus({
      body: { corpusName: 'penal_code', jurisdiction: 'CA', sourceAuthority: 'CA Leg', version: '2.0' },
    });

    const response = await api.getCorpusVersions({
      query: { corpusName: 'penal_code' },
    });

    assert.equal(response.status, 200);
    const body = response.body as { versions: unknown[]; total: number };
    assert.equal(body.total, 2);
  });
});
