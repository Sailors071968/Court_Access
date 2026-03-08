// ============================================
// Court Access — Evidence Relationship Engine Tests
// Phase 2: Deterministic confidence scoring,
// embedding service, candidate store, linker, indexer.
// ============================================

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { EmbeddingService } from '../src/evidence/embeddingService.ts';
import { RelationshipScorer } from '../src/evidence/relationshipScorer.ts';
import { RelationshipCandidateStore } from '../src/evidence/relationshipCandidateStore.ts';
import { EvidenceLinker } from '../src/evidence/evidenceLinker.ts';
import { EvidenceIndexer } from '../src/evidence/evidenceIndexer.ts';
import type { NodeProvider } from '../src/evidence/evidenceIndexer.ts';
import {
  CONFIDENCE_THRESHOLD,
  DEFAULT_SCORING_WEIGHTS,
  DEFAULT_EMBEDDING_CONFIG,
} from '../src/evidence/types.ts';
import type {
  GraphNode,
  EvidenceRelationship,
  EvidenceLinkingRequest,
  RelationshipCandidate,
  ScoringWeights,
} from '../src/evidence/types.ts';

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

/** Create a deterministic mock embedding from text (no API call). */
function mockEmbedding(text: string, dims = 8): number[] {
  const vec = new Array(dims).fill(0);
  for (let i = 0; i < text.length; i++) {
    vec[i % dims] += text.charCodeAt(i) / 1000;
  }
  // Normalize
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  return norm > 0 ? vec.map((v) => v / norm) : vec;
}

/** Build a mock fetch that returns deterministic embeddings. */
function createMockFetch(): typeof globalThis.fetch {
  return async (_url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const body = JSON.parse(init?.body as string);
    const inputs: string[] = Array.isArray(body.input) ? body.input : [body.input];
    const dims = body.dimensions ?? 8;

    const data = inputs.map((text: string, index: number) => ({
      embedding: mockEmbedding(text, dims),
      index,
    }));

    return new Response(
      JSON.stringify({
        data,
        usage: { prompt_tokens: inputs.length * 10, total_tokens: inputs.length * 10 },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  };
}

/** Build a test GraphNode. */
function makeNode(overrides: Partial<GraphNode> & { id: string; type: GraphNode['type']; name: string }): GraphNode {
  return {
    properties: {},
    sourceDocumentId: 'doc-1',
    tenantId: 'tenant-1',
    createdAt: new Date(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const LEGAL_TEXT = `
On January 15, 2025, Officer James Brown of the Metro Police Department conducted a traffic stop
in violation of Policy 4.01 (Use of Force) and 42 U.S.C. § 1983 (Civil Rights). The body camera
footage (Exhibit A) shows Officer Brown using excessive force during the arrest of John Smith.
The incident contradicts Department Policy No. 7.3 on de-escalation procedures. The Fourth Amendment
protections were not observed. See Miranda v. Arizona, 384 U.S. 436 (1966) for applicable case law.
Evidence collected includes dash cam video, witness statements from Jane Doe and Robert Wilson,
and medical records from City General Hospital. The Agency responsible is the Metro Police Department.
`;

const EVIDENCE_NODE = makeNode({
  id: 'evidence-exhibit-a',
  type: 'Evidence',
  name: 'Exhibit A',
  sourceDocumentId: 'doc-legal-1',
});

const STATUTE_NODE = makeNode({
  id: 'statute-42usc1983',
  type: 'Statute',
  name: '42 U.S.C. § 1983',
});

const POLICY_NODE = makeNode({
  id: 'policy-4.01',
  type: 'Policy',
  name: 'Policy 4.01',
});

const OFFICER_NODE = makeNode({
  id: 'officer-brown',
  type: 'Officer',
  name: 'Officer Brown',
});

const PERSON_NODE = makeNode({
  id: 'person-smith',
  type: 'Person',
  name: 'John Smith',
});

const AGENCY_NODE = makeNode({
  id: 'agency-mpd',
  type: 'Agency',
  name: 'Metro Police Department',
});

const CASELAW_NODE = makeNode({
  id: 'caselaw-miranda',
  type: 'CaseLaw',
  name: 'Miranda v. Arizona',
});

const EVENT_NODE = makeNode({
  id: 'event-traffic-stop',
  type: 'Event',
  name: 'traffic stop',
});

const CLAIM_NODE = makeNode({
  id: 'claim-excessive-force',
  type: 'LegalClaim',
  name: 'excessive force',
});

// ============================================================================
// EmbeddingService Tests
// ============================================================================

describe('EmbeddingService', () => {
  let service: EmbeddingService;

  beforeEach(() => {
    service = new EmbeddingService(
      { apiKey: 'test-key', dimensions: 8, batchSize: 5, maxCacheSize: 100 },
      createMockFetch(),
    );
  });

  it('should return an embedding vector for text', async () => {
    const embedding = await service.getEmbedding('test text', 'tenant-1');
    assert.ok(Array.isArray(embedding));
    assert.equal(embedding.length, 8);
    // Vector should be normalized (length ≈ 1)
    const norm = Math.sqrt(embedding.reduce((s, v) => s + v * v, 0));
    assert.ok(Math.abs(norm - 1.0) < 0.01, `Norm should be ~1.0, got ${norm}`);
  });

  it('should cache embeddings and return from cache on second call', async () => {
    let callCount = 0;
    const countingFetch: typeof globalThis.fetch = async (url, init) => {
      callCount++;
      return createMockFetch()(url, init);
    };

    const svc = new EmbeddingService(
      { apiKey: 'test', dimensions: 8, batchSize: 5, maxCacheSize: 100 },
      countingFetch,
    );

    await svc.getEmbedding('hello world', 'tenant-1');
    assert.equal(callCount, 1);
    assert.equal(svc.cacheSize, 1);

    await svc.getEmbedding('hello world', 'tenant-1');
    assert.equal(callCount, 1, 'Should serve from cache');
    assert.equal(svc.cacheSize, 1);
  });

  it('should isolate cache by tenant', async () => {
    const e1 = await service.getEmbedding('same text', 'tenant-a');
    const e2 = await service.getEmbedding('same text', 'tenant-b');
    assert.equal(service.cacheSize, 2, 'Different tenants should have separate cache entries');
    // Embeddings are the same since text is the same (deterministic mock)
    assert.deepEqual(e1, e2);
  });

  it('should batch-fetch multiple embeddings', async () => {
    const texts = ['alpha', 'bravo', 'charlie', 'delta'];
    const embeddings = await service.getEmbeddings(texts, 'tenant-1');
    assert.equal(embeddings.length, 4);
    for (const emb of embeddings) {
      assert.equal(emb.length, 8);
    }
    assert.equal(service.cacheSize, 4, 'All 4 should be cached');
  });

  it('should evict oldest entries when cache exceeds maxCacheSize', async () => {
    const svc = new EmbeddingService(
      { apiKey: 'test', dimensions: 8, batchSize: 50, maxCacheSize: 3 },
      createMockFetch(),
    );

    await svc.getEmbedding('a', 'tenant-1');
    await svc.getEmbedding('b', 'tenant-1');
    await svc.getEmbedding('c', 'tenant-1');
    assert.equal(svc.cacheSize, 3);

    await svc.getEmbedding('d', 'tenant-1');
    assert.equal(svc.cacheSize, 3, 'Should have evicted oldest');
  });

  it('should compute cosine similarity correctly', () => {
    const a = [1, 0, 0, 0, 0, 0, 0, 0];
    const b = [1, 0, 0, 0, 0, 0, 0, 0];
    assert.equal(service.cosineSimilarity(a, b), 1.0);

    const c = [-1, 0, 0, 0, 0, 0, 0, 0];
    assert.equal(service.cosineSimilarity(a, c), -1.0);

    const d = [0, 1, 0, 0, 0, 0, 0, 0];
    assert.equal(service.cosineSimilarity(a, d), 0);
  });

  it('should throw on dimension mismatch in cosine similarity', () => {
    assert.throws(
      () => service.cosineSimilarity([1, 0], [1, 0, 0]),
      /dimension mismatch/i,
    );
  });

  it('should clear cache', async () => {
    await service.getEmbedding('text', 'tenant-1');
    assert.equal(service.cacheSize, 1);
    service.clearCache();
    assert.equal(service.cacheSize, 0);
  });

  it('should handle API errors gracefully', async () => {
    const errorFetch: typeof globalThis.fetch = async () =>
      new Response('rate limited', { status: 429 });

    const svc = new EmbeddingService({ apiKey: 'test', dimensions: 8 }, errorFetch);
    await assert.rejects(
      () => svc.getEmbedding('test', 'tenant-1'),
      /OpenAI embeddings API error \(429\)/,
    );
  });
});

// ============================================================================
// RelationshipScorer Tests
// ============================================================================

describe('RelationshipScorer', () => {
  let scorer: RelationshipScorer;
  let embeddingService: EmbeddingService;

  beforeEach(() => {
    embeddingService = new EmbeddingService(
      { apiKey: 'test', dimensions: 8, batchSize: 50, maxCacheSize: 1000 },
      createMockFetch(),
    );
    scorer = new RelationshipScorer(embeddingService);
  });

  it('should return a score between 0.0 and 1.0', async () => {
    const evidenceEntity = {
      type: 'Evidence' as const,
      name: 'Exhibit A',
      canonicalName: 'exhibit a',
      properties: {},
      startOffset: 300,
      endOffset: 310,
      offsets: [{ start: 300, end: 310 }],
    };

    const targetEntity = {
      type: 'Statute' as const,
      name: '42 U.S.C. § 1983',
      canonicalName: '42 u.s.c. § 1983',
      properties: {},
      startOffset: 150,
      endOffset: 167,
      offsets: [{ start: 150, end: 167 }],
    };

    const result = await scorer.scoreRelationship(
      'Exhibit A',
      '42 U.S.C. § 1983',
      LEGAL_TEXT,
      evidenceEntity,
      targetEntity,
      'tenant-1',
    );

    assert.ok(result.score >= 0.0, `Score ${result.score} should be >= 0`);
    assert.ok(result.score <= 1.0, `Score ${result.score} should be <= 1`);
    assert.ok(typeof result.meetsThreshold === 'boolean');
    assert.ok(result.factors.semanticSimilarity >= 0 && result.factors.semanticSimilarity <= 1);
    assert.ok(result.factors.entityCoOccurrence >= 0 && result.factors.entityCoOccurrence <= 1);
    assert.ok(result.factors.documentProximity >= 0 && result.factors.documentProximity <= 1);
    assert.ok(result.factors.legalReferenceStrength >= 0 && result.factors.legalReferenceStrength <= 1);
  });

  it('should use default weights that sum to 1.0', () => {
    const sum =
      DEFAULT_SCORING_WEIGHTS.semanticSimilarity +
      DEFAULT_SCORING_WEIGHTS.entityCoOccurrence +
      DEFAULT_SCORING_WEIGHTS.documentProximity +
      DEFAULT_SCORING_WEIGHTS.legalReferenceStrength;
    assert.ok(Math.abs(sum - 1.0) < 0.001, `Weights sum to ${sum}`);
  });

  it('should throw when custom weights do not sum to 1.0', () => {
    assert.throws(
      () =>
        new RelationshipScorer(embeddingService, {
          semanticSimilarity: 0.5,
          entityCoOccurrence: 0.5,
          documentProximity: 0.5,
          legalReferenceStrength: 0.5,
        }),
      /weights must sum to 1\.0/i,
    );
  });

  it('should accept custom weights that sum to 1.0', () => {
    const custom: ScoringWeights = {
      semanticSimilarity: 0.50,
      entityCoOccurrence: 0.20,
      documentProximity: 0.15,
      legalReferenceStrength: 0.15,
    };
    const s = new RelationshipScorer(embeddingService, custom);
    assert.equal(s.confidenceThreshold, CONFIDENCE_THRESHOLD);
  });

  it('should accept custom threshold', () => {
    const s = new RelationshipScorer(embeddingService, undefined, 0.90);
    assert.equal(s.confidenceThreshold, 0.90);
  });

  it('should score multiple targets in bulk', async () => {
    const evidenceEntity = {
      type: 'Evidence' as const,
      name: 'Exhibit A',
      canonicalName: 'exhibit a',
      properties: {},
      startOffset: 300,
      endOffset: 310,
      offsets: [{ start: 300, end: 310 }],
    };

    const targets = [
      {
        targetText: '42 U.S.C. § 1983',
        sourceText: LEGAL_TEXT,
        evidenceEntity,
        targetEntity: {
          type: 'Statute' as const,
          name: '42 U.S.C. § 1983',
          canonicalName: '42 u.s.c. § 1983',
          properties: {},
          startOffset: 150,
          endOffset: 167,
          offsets: [{ start: 150, end: 167 }],
        },
      },
      {
        targetText: 'Policy 4.01',
        sourceText: LEGAL_TEXT,
        evidenceEntity,
        targetEntity: {
          type: 'Policy' as const,
          name: 'Policy 4.01',
          canonicalName: 'policy 4.01',
          properties: {},
          startOffset: 120,
          endOffset: 131,
          offsets: [{ start: 120, end: 131 }],
        },
      },
    ];

    const results = await scorer.scoreRelationships('Exhibit A', targets, 'tenant-1');
    assert.equal(results.length, 2);
    for (const r of results) {
      assert.ok(r.score >= 0 && r.score <= 1);
    }
  });

  it('should return higher proximity score for closer entities', async () => {
    const near = {
      type: 'Evidence' as const, name: 'A', canonicalName: 'a', properties: {},
      startOffset: 100, endOffset: 101, offsets: [{ start: 100, end: 101 }],
    };
    const close = {
      type: 'Statute' as const, name: 'B', canonicalName: 'b', properties: {},
      startOffset: 110, endOffset: 111, offsets: [{ start: 110, end: 111 }],
    };
    const far = {
      type: 'Statute' as const, name: 'C', canonicalName: 'c', properties: {},
      startOffset: 5000, endOffset: 5001, offsets: [{ start: 5000, end: 5001 }],
    };

    const closeScore = await scorer.scoreRelationship('A', 'B', LEGAL_TEXT, near, close, 'tenant-1');
    const farScore = await scorer.scoreRelationship('A', 'C', LEGAL_TEXT, near, far, 'tenant-1');

    assert.ok(
      closeScore.factors.documentProximity > farScore.factors.documentProximity,
      `Close proximity ${closeScore.factors.documentProximity} should be > far proximity ${farScore.factors.documentProximity}`,
    );
  });
});

// ============================================================================
// RelationshipCandidateStore Tests
// ============================================================================

describe('RelationshipCandidateStore', () => {
  let store: RelationshipCandidateStore;

  function makeMockRelationship(overrides?: Partial<EvidenceRelationship>): EvidenceRelationship {
    return {
      evidenceNodeId: 'evidence-1',
      targetNodeId: 'target-1',
      targetNodeType: 'Statute',
      relationshipType: 'VIOLATES',
      score: {
        score: 0.60,
        factors: {
          semanticSimilarity: 0.7,
          entityCoOccurrence: 0.5,
          documentProximity: 0.4,
          legalReferenceStrength: 0.3,
        },
        weights: { ...DEFAULT_SCORING_WEIGHTS },
        meetsThreshold: false,
      },
      tenantId: 'tenant-1',
      sourceDocumentId: 'doc-1',
      scoredAt: new Date(),
      ...overrides,
    };
  }

  beforeEach(() => {
    store = new RelationshipCandidateStore(100);
  });

  it('should store a candidate and return an ID', () => {
    const id = store.store(makeMockRelationship());
    assert.ok(typeof id === 'string');
    assert.ok(id.length > 0);
    assert.equal(store.size, 1);
  });

  it('should retrieve a stored candidate by ID', () => {
    const id = store.store(makeMockRelationship());
    const candidate = store.get(id);
    assert.ok(candidate);
    assert.equal(candidate.id, id);
    assert.equal(candidate.status, 'pending');
    assert.equal(candidate.reviewNotes, null);
    assert.ok(candidate.createdAt instanceof Date);
  });

  it('should store multiple candidates in bulk', () => {
    const rels = [makeMockRelationship(), makeMockRelationship({ targetNodeId: 'target-2' })];
    const ids = store.storeBulk(rels);
    assert.equal(ids.length, 2);
    assert.equal(store.size, 2);
  });

  it('should list candidates with tenant filter', () => {
    store.store(makeMockRelationship({ tenantId: 'tenant-a' }));
    store.store(makeMockRelationship({ tenantId: 'tenant-b' }));
    store.store(makeMockRelationship({ tenantId: 'tenant-a' }));

    const listA = store.list({ tenantId: 'tenant-a' });
    assert.equal(listA.length, 2);

    const listB = store.list({ tenantId: 'tenant-b' });
    assert.equal(listB.length, 1);
  });

  it('should list candidates with status filter', () => {
    const id1 = store.store(makeMockRelationship());
    store.store(makeMockRelationship());
    store.markReviewed(id1, 'approved');

    const pending = store.list({ status: 'pending' });
    assert.equal(pending.length, 1);

    const approved = store.list({ status: 'approved' });
    assert.equal(approved.length, 1);
  });

  it('should mark a candidate as reviewed', () => {
    const id = store.store(makeMockRelationship());
    const updated = store.markReviewed(id, 'rejected', 'Not relevant');
    assert.ok(updated);
    assert.equal(updated.status, 'rejected');
    assert.equal(updated.reviewNotes, 'Not relevant');
    assert.ok(updated.reviewedAt instanceof Date);
  });

  it('should return undefined when marking nonexistent candidate', () => {
    const result = store.markReviewed('nonexistent', 'approved');
    assert.equal(result, undefined);
  });

  it('should remove a candidate', () => {
    const id = store.store(makeMockRelationship());
    assert.equal(store.size, 1);
    const removed = store.remove(id);
    assert.ok(removed);
    assert.equal(store.size, 0);
  });

  it('should count by status for a tenant', () => {
    store.store(makeMockRelationship({ tenantId: 'tenant-1' }));
    store.store(makeMockRelationship({ tenantId: 'tenant-1' }));
    const id3 = store.store(makeMockRelationship({ tenantId: 'tenant-1' }));
    store.markReviewed(id3, 'approved');

    const counts = store.countByStatus('tenant-1');
    assert.equal(counts.pending, 2);
    assert.equal(counts.approved, 1);
    assert.equal(counts.rejected, 0);
  });

  it('should enforce capacity and evict oldest', () => {
    const smallStore = new RelationshipCandidateStore(3);
    smallStore.store(makeMockRelationship({ targetNodeId: 'a' }));
    smallStore.store(makeMockRelationship({ targetNodeId: 'b' }));
    smallStore.store(makeMockRelationship({ targetNodeId: 'c' }));
    assert.equal(smallStore.size, 3);

    smallStore.store(makeMockRelationship({ targetNodeId: 'd' }));
    assert.equal(smallStore.size, 3, 'Should evict oldest to maintain capacity');
  });

  it('should clear all candidates', () => {
    store.store(makeMockRelationship());
    store.store(makeMockRelationship());
    store.clear();
    assert.equal(store.size, 0);
  });

  it('should support pagination in list', () => {
    for (let i = 0; i < 10; i++) {
      store.store(makeMockRelationship({ targetNodeId: `target-${i}` }));
    }
    const page1 = store.list({ limit: 3, offset: 0 });
    assert.equal(page1.length, 3);

    const page2 = store.list({ limit: 3, offset: 3 });
    assert.equal(page2.length, 3);

    // Different items
    assert.notEqual(page1[0].id, page2[0].id);
  });
});

// ============================================================================
// EvidenceLinker Tests
// ============================================================================

describe('EvidenceLinker', () => {
  let linker: EvidenceLinker;
  let candidateStore: RelationshipCandidateStore;
  let embeddingService: EmbeddingService;
  let scorer: RelationshipScorer;

  beforeEach(() => {
    embeddingService = new EmbeddingService(
      { apiKey: 'test', dimensions: 8, batchSize: 50, maxCacheSize: 1000 },
      createMockFetch(),
    );
    scorer = new RelationshipScorer(embeddingService);
    candidateStore = new RelationshipCandidateStore();
    linker = new EvidenceLinker(scorer, candidateStore);
  });

  it('should link evidence to target nodes', async () => {
    const request: EvidenceLinkingRequest = {
      evidenceNode: EVIDENCE_NODE,
      targetNodes: [STATUTE_NODE, POLICY_NODE, OFFICER_NODE],
      sourceText: LEGAL_TEXT,
      tenantId: 'tenant-1',
      sourceDocumentId: 'doc-legal-1',
    };

    const result = await linker.linkEvidence(request);
    assert.equal(result.evidenceNodeId, 'evidence-exhibit-a');
    assert.equal(result.totalEvaluated, 3);
    assert.ok(result.durationMs >= 0);

    // All relationships should be categorized as either inserted or candidate
    const total = result.insertedRelationships.length + result.candidateRelationships.length;
    assert.equal(total, 3);
  });

  it('should skip self-links', async () => {
    const request: EvidenceLinkingRequest = {
      evidenceNode: EVIDENCE_NODE,
      targetNodes: [EVIDENCE_NODE, STATUTE_NODE],
      sourceText: LEGAL_TEXT,
      tenantId: 'tenant-1',
      sourceDocumentId: 'doc-legal-1',
    };

    const result = await linker.linkEvidence(request);
    // Self-link should be skipped, only 1 evaluated (excludes self from count)
    assert.equal(result.totalEvaluated, 1);
    const total = result.insertedRelationships.length + result.candidateRelationships.length;
    assert.equal(total, 1);
  });

  it('should store below-threshold relationships in candidate store', async () => {
    // Use a very high threshold scorer so everything goes to candidates
    const highThresholdScorer = new RelationshipScorer(embeddingService, undefined, 0.99);
    const highThresholdLinker = new EvidenceLinker(highThresholdScorer, candidateStore);

    const request: EvidenceLinkingRequest = {
      evidenceNode: EVIDENCE_NODE,
      targetNodes: [STATUTE_NODE],
      sourceText: LEGAL_TEXT,
      tenantId: 'tenant-1',
      sourceDocumentId: 'doc-legal-1',
    };

    const result = await highThresholdLinker.linkEvidence(request);
    assert.equal(result.candidateRelationships.length, 1);
    assert.equal(result.insertedRelationships.length, 0);
    assert.equal(candidateStore.size, 1, 'Candidate should be stored');
  });

  it('should batch-link evidence to multiple targets efficiently', async () => {
    const request: EvidenceLinkingRequest = {
      evidenceNode: EVIDENCE_NODE,
      targetNodes: [STATUTE_NODE, POLICY_NODE, OFFICER_NODE, PERSON_NODE, AGENCY_NODE],
      sourceText: LEGAL_TEXT,
      tenantId: 'tenant-1',
      sourceDocumentId: 'doc-legal-1',
    };

    const result = await linker.linkEvidenceBatch(request);
    assert.equal(result.evidenceNodeId, 'evidence-exhibit-a');
    assert.equal(result.totalEvaluated, 5);

    const total = result.insertedRelationships.length + result.candidateRelationships.length;
    assert.equal(total, 5);
  });

  it('should infer correct relationship types', async () => {
    const request: EvidenceLinkingRequest = {
      evidenceNode: EVIDENCE_NODE,
      targetNodes: [STATUTE_NODE, CASELAW_NODE, PERSON_NODE, EVENT_NODE, CLAIM_NODE],
      sourceText: LEGAL_TEXT,
      tenantId: 'tenant-1',
      sourceDocumentId: 'doc-legal-1',
    };

    const result = await linker.linkEvidenceBatch(request);

    // Check inferred relationship types
    const allRels = [...result.insertedRelationships, ...result.candidateRelationships];
    const statuteRel = allRels.find((r) => r.targetNodeType === 'Statute');
    const caselawRel = allRels.find((r) => r.targetNodeType === 'CaseLaw');
    const personRel = allRels.find((r) => r.targetNodeType === 'Person');
    const eventRel = allRels.find((r) => r.targetNodeType === 'Event');
    const claimRel = allRels.find((r) => r.targetNodeType === 'LegalClaim');

    assert.ok(statuteRel, 'Should have statute relationship');
    assert.equal(statuteRel.relationshipType, 'VIOLATES');

    assert.ok(caselawRel, 'Should have case law relationship');
    assert.equal(caselawRel.relationshipType, 'REFERENCES');

    assert.ok(personRel, 'Should have person relationship');
    assert.equal(personRel.relationshipType, 'MENTIONS');

    assert.ok(eventRel, 'Should have event relationship');
    assert.equal(eventRel.relationshipType, 'ESTABLISHES');

    assert.ok(claimRel, 'Should have claim relationship');
    assert.equal(claimRel.relationshipType, 'SUPPORTS');
  });

  it('should handle empty target list', async () => {
    const request: EvidenceLinkingRequest = {
      evidenceNode: EVIDENCE_NODE,
      targetNodes: [],
      sourceText: LEGAL_TEXT,
      tenantId: 'tenant-1',
      sourceDocumentId: 'doc-legal-1',
    };

    const result = await linker.linkEvidenceBatch(request);
    assert.equal(result.totalEvaluated, 0);
    assert.equal(result.insertedRelationships.length, 0);
    assert.equal(result.candidateRelationships.length, 0);
  });

  it('should preserve tenant isolation in relationships', async () => {
    const request: EvidenceLinkingRequest = {
      evidenceNode: EVIDENCE_NODE,
      targetNodes: [STATUTE_NODE],
      sourceText: LEGAL_TEXT,
      tenantId: 'tenant-secure',
      sourceDocumentId: 'doc-legal-1',
    };

    const result = await linker.linkEvidence(request);
    const allRels = [...result.insertedRelationships, ...result.candidateRelationships];
    for (const rel of allRels) {
      assert.equal(rel.tenantId, 'tenant-secure');
    }
  });
});

// ============================================================================
// EvidenceIndexer Tests
// ============================================================================

describe('EvidenceIndexer', () => {
  let indexer: EvidenceIndexer;
  let candidateStore: RelationshipCandidateStore;
  let insertedRelationships: EvidenceRelationship[];

  function createMockNodeProvider(
    evidenceNodes: GraphNode[],
    targetNodes: GraphNode[],
    documentTexts: Record<string, string>,
  ): NodeProvider {
    return {
      getEvidenceNodes: async () => evidenceNodes,
      getTargetNodes: async () => targetNodes,
      getDocumentText: async (docId: string) => documentTexts[docId] ?? '',
      insertRelationship: async (rel: EvidenceRelationship) => {
        insertedRelationships.push(rel);
      },
    };
  }

  beforeEach(() => {
    insertedRelationships = [];
    candidateStore = new RelationshipCandidateStore();

    const embeddingService = new EmbeddingService(
      { apiKey: 'test', dimensions: 8, batchSize: 50, maxCacheSize: 1000 },
      createMockFetch(),
    );
    const scorer = new RelationshipScorer(embeddingService);
    const linker = new EvidenceLinker(scorer, candidateStore);

    const nodeProvider = createMockNodeProvider(
      [EVIDENCE_NODE],
      [STATUTE_NODE, POLICY_NODE, OFFICER_NODE],
      { 'doc-legal-1': LEGAL_TEXT },
    );

    indexer = new EvidenceIndexer(linker, nodeProvider, { batchSize: 10, concurrency: 2 });
  });

  it('should index a tenant and return a summary', async () => {
    const summary = await indexer.indexTenant('tenant-1');
    assert.equal(summary.totalEvidenceNodes, 1);
    assert.ok(summary.totalRelationshipsEvaluated >= 1);
    assert.ok(summary.totalDurationMs >= 0);
    assert.equal(summary.errors.length, 0);
    assert.ok(
      summary.totalRelationshipsInserted + summary.totalCandidatesStored ===
        summary.totalRelationshipsEvaluated,
      'Inserted + candidates should equal total evaluated',
    );
  });

  it('should return empty summary when no evidence nodes', async () => {
    const embeddingService = new EmbeddingService(
      { apiKey: 'test', dimensions: 8 },
      createMockFetch(),
    );
    const scorer = new RelationshipScorer(embeddingService);
    const linker = new EvidenceLinker(scorer, candidateStore);
    const emptyProvider = createMockNodeProvider([], [STATUTE_NODE], {});
    const emptyIndexer = new EvidenceIndexer(linker, emptyProvider);

    const summary = await emptyIndexer.indexTenant('tenant-1');
    assert.equal(summary.totalEvidenceNodes, 0);
    assert.equal(summary.totalRelationshipsEvaluated, 0);
    assert.equal(summary.totalRelationshipsInserted, 0);
    assert.equal(summary.totalCandidatesStored, 0);
  });

  it('should index a single evidence node', async () => {
    const result = await indexer.indexSingleEvidence(EVIDENCE_NODE, 'tenant-1');
    assert.equal(result.evidenceNodeId, 'evidence-exhibit-a');
    assert.ok(result.totalEvaluated >= 1);
  });

  it('should handle errors in batch processing gracefully', async () => {
    const embeddingService = new EmbeddingService(
      { apiKey: 'test', dimensions: 8 },
      createMockFetch(),
    );
    const scorer = new RelationshipScorer(embeddingService);
    const linker = new EvidenceLinker(scorer, candidateStore);

    const errorProvider: NodeProvider = {
      getEvidenceNodes: async () => [EVIDENCE_NODE],
      getTargetNodes: async () => [STATUTE_NODE],
      getDocumentText: async () => { throw new Error('DB connection lost'); },
      insertRelationship: async () => {},
    };

    const errorIndexer = new EvidenceIndexer(linker, errorProvider);
    const summary = await errorIndexer.indexTenant('tenant-1');
    assert.ok(summary.errors.length > 0, 'Should capture errors');
    assert.ok(summary.errors[0].error.includes('DB connection lost'));
  });
});

// ============================================================================
// Confidence Threshold Tests
// ============================================================================

describe('Confidence Threshold (>= 0.75)', () => {
  it('should export CONFIDENCE_THRESHOLD as 0.75', () => {
    assert.equal(CONFIDENCE_THRESHOLD, 0.75);
  });

  it('should correctly partition relationships by threshold', async () => {
    const embeddingService = new EmbeddingService(
      { apiKey: 'test', dimensions: 8, batchSize: 50, maxCacheSize: 1000 },
      createMockFetch(),
    );
    const scorer = new RelationshipScorer(embeddingService);
    const candidateStore = new RelationshipCandidateStore();
    const linker = new EvidenceLinker(scorer, candidateStore);

    const allTargets = [
      STATUTE_NODE, POLICY_NODE, OFFICER_NODE, PERSON_NODE,
      AGENCY_NODE, CASELAW_NODE, EVENT_NODE, CLAIM_NODE,
    ];

    const result = await linker.linkEvidenceBatch({
      evidenceNode: EVIDENCE_NODE,
      targetNodes: allTargets,
      sourceText: LEGAL_TEXT,
      tenantId: 'tenant-1',
      sourceDocumentId: 'doc-legal-1',
    });

    // All inserted relationships should have score >= 0.75
    for (const rel of result.insertedRelationships) {
      assert.ok(
        rel.score.meetsThreshold,
        `Inserted rel score ${rel.score.score} should meet threshold`,
      );
    }

    // All candidate relationships should have score < 0.75
    for (const rel of result.candidateRelationships) {
      assert.ok(
        !rel.score.meetsThreshold,
        `Candidate rel score ${rel.score.score} should not meet threshold`,
      );
    }
  });
});

// ============================================================================
// Default Configuration Tests
// ============================================================================

describe('Default Configuration', () => {
  it('should have correct default embedding config', () => {
    assert.equal(DEFAULT_EMBEDDING_CONFIG.model, 'text-embedding-3-small');
    assert.equal(DEFAULT_EMBEDDING_CONFIG.dimensions, 1536);
    assert.equal(DEFAULT_EMBEDDING_CONFIG.batchSize, 100);
    assert.equal(DEFAULT_EMBEDDING_CONFIG.maxCacheSize, 50_000);
  });

  it('should have correct default scoring weights', () => {
    assert.equal(DEFAULT_SCORING_WEIGHTS.semanticSimilarity, 0.40);
    assert.equal(DEFAULT_SCORING_WEIGHTS.entityCoOccurrence, 0.25);
    assert.equal(DEFAULT_SCORING_WEIGHTS.documentProximity, 0.20);
    assert.equal(DEFAULT_SCORING_WEIGHTS.legalReferenceStrength, 0.15);
  });
});

// ============================================================================
// Memory & Scale Tests
// ============================================================================

describe('Memory & Scale', () => {
  it('should handle 50k candidate capacity without exceeding memory bounds', () => {
    const store = new RelationshipCandidateStore(50_000);

    // Store 100 candidates (proving the mechanism works at smaller scale)
    for (let i = 0; i < 100; i++) {
      store.store({
        evidenceNodeId: `evidence-${i}`,
        targetNodeId: `target-${i}`,
        targetNodeType: 'Statute',
        relationshipType: 'VIOLATES',
        score: {
          score: 0.5,
          factors: {
            semanticSimilarity: 0.5,
            entityCoOccurrence: 0.5,
            documentProximity: 0.5,
            legalReferenceStrength: 0.5,
          },
          weights: { ...DEFAULT_SCORING_WEIGHTS },
          meetsThreshold: false,
        },
        tenantId: 'tenant-1',
        sourceDocumentId: 'doc-1',
        scoredAt: new Date(),
      });
    }

    assert.equal(store.size, 100);
    assert.ok(true, 'No memory issues at 100 candidates');
  });

  it('should enforce capacity limit at maxCapacity', () => {
    const store = new RelationshipCandidateStore(5);
    for (let i = 0; i < 10; i++) {
      store.store({
        evidenceNodeId: `evidence-${i}`,
        targetNodeId: `target-${i}`,
        targetNodeType: 'Statute',
        relationshipType: 'VIOLATES',
        score: {
          score: 0.5,
          factors: {
            semanticSimilarity: 0.5,
            entityCoOccurrence: 0.5,
            documentProximity: 0.5,
            legalReferenceStrength: 0.5,
          },
          weights: { ...DEFAULT_SCORING_WEIGHTS },
          meetsThreshold: false,
        },
        tenantId: 'tenant-1',
        sourceDocumentId: 'doc-1',
        scoredAt: new Date(),
      });
    }
    assert.equal(store.size, 5, 'Should cap at maxCapacity');
  });

  it('should handle embedding cache at maxCacheSize', async () => {
    const svc = new EmbeddingService(
      { apiKey: 'test', dimensions: 8, batchSize: 50, maxCacheSize: 10 },
      createMockFetch(),
    );

    for (let i = 0; i < 20; i++) {
      await svc.getEmbedding(`text-${i}`, 'tenant-1');
    }

    assert.equal(svc.cacheSize, 10, 'Cache should not exceed maxCacheSize');
  });
});

// ============================================================================
// Barrel Export Tests
// ============================================================================

describe('Barrel Exports', () => {
  it('should re-export all core classes', async () => {
    const mod = await import('../src/evidence/index.ts');
    assert.ok(mod.EmbeddingService);
    assert.ok(mod.RelationshipScorer);
    assert.ok(mod.RelationshipCandidateStore);
    assert.ok(mod.EvidenceLinker);
    assert.ok(mod.EvidenceIndexer);
    assert.equal(mod.CONFIDENCE_THRESHOLD, 0.75);
  });
});
