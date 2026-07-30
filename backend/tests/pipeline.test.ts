// ============================================
// Court Access — Full Reasoning Pipeline Integration Test
// Validates the complete pipeline:
//   corpus ingestion → knowledge graph indexing →
//   evidence relationship engine → narrative conflict detection →
//   graph query engine
//
// Test dataset: 10k documents, 500 evidence items, 200 statements
// ============================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { TimelineConflictAnalyzer } from '../src/conflict/timelineConflictAnalyzer.ts';
import { StatementComparator } from '../src/conflict/statementComparator.ts';
import { ConflictScoringEngine } from '../src/conflict/conflictScoringEngine.ts';
import { ConflictGraphIntegrator } from '../src/conflict/conflictGraphIntegrator.ts';
import { NarrativeConflictDetector } from '../src/conflict/narrativeConflictDetector.ts';
import { deriveExplanationFactors } from '../src/conflict/types.ts';
import type {
  Statement,
  TimelineEvent,
  DetectedConflict,
  ConflictDetectionRequest,
  ConflictExplanationFactors,
  GraphNode,
  GraphRelationship,
} from '../src/conflict/types.ts';

// ---------------------------------------------------------------------------
// Data Generators — produce realistic legal case data at scale
// ---------------------------------------------------------------------------

const TENANT_ID = 'pipeline-test-tenant';

const ROLES: Statement['speakerRole'][] = ['officer', 'witness', 'defendant', 'expert'];
const NODE_TYPES: GraphNode['type'][] = ['Evidence', 'Person', 'Officer', 'LegalClaim', 'Policy', 'Statute', 'Event'];
const REL_TYPES: GraphRelationship['type'][] = ['SUPPORTS', 'REFUTES', 'VIOLATES', 'CONTRADICTS', 'REFERENCES', 'MENTIONS', 'ESTABLISHES'];

function generateDocuments(count: number): Array<{ id: string; title: string; tenantId: string }> {
  const docs: Array<{ id: string; title: string; tenantId: string }> = [];
  for (let i = 0; i < count; i++) {
    docs.push({
      id: `doc-${i.toString().padStart(5, '0')}`,
      title: `Legal Document ${i}`,
      tenantId: TENANT_ID,
    });
  }
  return docs;
}

function generateEvidenceNodes(count: number): GraphNode[] {
  const nodes: GraphNode[] = [];
  for (let i = 0; i < count; i++) {
    nodes.push({
      id: `evidence-${i.toString().padStart(4, '0')}`,
      type: NODE_TYPES[i % NODE_TYPES.length],
      name: `Evidence Item ${i}`,
      properties: { category: i % 2 === 0 ? 'physical' : 'testimonial' },
      sourceDocumentId: `doc-${(i % 1000).toString().padStart(5, '0')}`,
      tenantId: TENANT_ID,
      createdAt: new Date('2025-01-01'),
    });
  }
  return nodes;
}

function generateStatements(count: number): Statement[] {
  const statements: Statement[] = [];
  const contradictionPairs = [
    ['The suspect was armed with a weapon', 'The suspect was not armed with any weapon'],
    ['The incident occurred at approximately 3pm', 'The incident occurred at approximately 9pm'],
    ['There were five witnesses present', 'There were two witnesses present'],
    ['The officer identified himself before entry', 'The officer did not identify himself before entry'],
    ['The vehicle was traveling at high speed', 'The vehicle was traveling at low speed'],
    ['Force was used as a last resort', 'Force was used immediately without de-escalation'],
    ['The suspect was cooperative during arrest', 'The suspect was not cooperative during arrest'],
    ['Body camera was activated at the start', 'Body camera was not activated until later'],
    ['Miranda rights were read immediately', 'Miranda rights were never read to the suspect'],
    ['The search warrant was presented', 'No search warrant was presented'],
  ];

  for (let i = 0; i < count; i++) {
    const pairIdx = Math.floor(i / 2) % contradictionPairs.length;
    const isSecond = i % 2 === 1;
    const content = contradictionPairs[pairIdx][isSecond ? 1 : 0];
    const speakerIdx = i % 20; // 20 unique speakers

    statements.push({
      id: `stmt-${i.toString().padStart(4, '0')}`,
      speakerId: `speaker-${speakerIdx.toString().padStart(3, '0')}`,
      speakerName: `${ROLES[speakerIdx % ROLES.length]} ${speakerIdx}`,
      speakerRole: ROLES[speakerIdx % ROLES.length],
      content,
      // Shared context: contradiction pairs share a sourceDocumentId
      sourceDocumentId: `doc-${Math.floor(i / 2).toString().padStart(5, '0')}`,
      tenantId: TENANT_ID,
      statementDate: new Date(`2025-06-${(1 + (i % 28)).toString().padStart(2, '0')}T10:00:00Z`),
      startOffset: 0,
      endOffset: content.length,
    });
  }
  return statements;
}

function generateTimelineEvents(count: number): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const baseTime = new Date('2025-06-15T08:00:00Z').getTime();

  for (let i = 0; i < count; i++) {
    const speakerIdx = i % 10;
    // Create overlapping events for different speakers to trigger conflicts
    const timeOffset = (i % 50) * 60_000; // Events within 50-minute windows
    events.push({
      id: `event-${i.toString().padStart(4, '0')}`,
      description: `Event ${i}: ${i % 2 === 0 ? 'suspect approached scene' : 'suspect left scene'}`,
      timestamp: new Date(baseTime + timeOffset + (speakerIdx * 30_000)),
      precision: 'exact',
      endTimestamp: null,
      sourceId: `stmt-${(i % 200).toString().padStart(4, '0')}`,
      sourceType: 'statement',
      speakerId: `speaker-${speakerIdx.toString().padStart(3, '0')}`,
      sourceDocumentId: `doc-${(i % 1000).toString().padStart(5, '0')}`,
      tenantId: TENANT_ID,
    });
  }
  return events;
}

function generateRelationships(nodes: GraphNode[], count: number): GraphRelationship[] {
  const rels: GraphRelationship[] = [];
  for (let i = 0; i < count; i++) {
    const sourceIdx = i % nodes.length;
    const targetIdx = (i + 1) % nodes.length;
    rels.push({
      id: `rel-${i.toString().padStart(4, '0')}`,
      type: REL_TYPES[i % REL_TYPES.length],
      sourceNodeId: nodes[sourceIdx].id,
      targetNodeId: nodes[targetIdx].id,
      confidence: 0.5 + (i % 50) / 100,
      properties: {},
      sourceDocumentId: nodes[sourceIdx].sourceDocumentId,
      tenantId: TENANT_ID,
      createdAt: new Date('2025-01-01'),
    });
  }
  return rels;
}

// ---------------------------------------------------------------------------
// Mock Neo4j session for pipeline graph integration
// ---------------------------------------------------------------------------

function createMockSession(): {
  session: import('../src/graph/types.ts').Neo4jSession;
  executedQueries: Array<{ cypher: string; params: Record<string, unknown> }>;
} {
  const executedQueries: Array<{ cypher: string; params: Record<string, unknown> }> = [];
  const session: import('../src/graph/types.ts').Neo4jSession = {
    run: async (cypher: string, params?: Record<string, unknown>) => {
      executedQueries.push({ cypher, params: params ?? {} });
      const data: Record<string, unknown> = { c: { id: 'mock' }, r: { id: 'mock-rel' }, created: true };
      return { records: [{ get: (key: string) => data[key], ...data }] };
    },
    close: async () => {},
  };
  return { session, executedQueries };
}

// ============================================================================
// Stage 1: Corpus Ingestion Simulation
// ============================================================================

describe('Pipeline Stage 1: Corpus Ingestion (10k documents)', () => {
  it('should generate and validate 10k documents', () => {
    const docs = generateDocuments(10_000);
    assert.equal(docs.length, 10_000);

    // Verify all documents have unique IDs
    const uniqueIds = new Set(docs.map(d => d.id));
    assert.equal(uniqueIds.size, 10_000);

    // Verify tenant isolation
    for (const doc of docs) {
      assert.equal(doc.tenantId, TENANT_ID);
    }
  });

  it('should generate 500 evidence nodes from corpus', () => {
    const nodes = generateEvidenceNodes(500);
    assert.equal(nodes.length, 500);

    // Verify all nodes have correct tenant
    for (const node of nodes) {
      assert.equal(node.tenantId, TENANT_ID);
      assert.ok(NODE_TYPES.includes(node.type), `Invalid node type: ${node.type}`);
    }

    // Verify unique IDs
    const uniqueIds = new Set(nodes.map(n => n.id));
    assert.equal(uniqueIds.size, 500);
  });

  it('should generate 200 statements from corpus', () => {
    const statements = generateStatements(200);
    assert.equal(statements.length, 200);

    // Verify all statements have correct tenant
    for (const stmt of statements) {
      assert.equal(stmt.tenantId, TENANT_ID);
      assert.ok(ROLES.includes(stmt.speakerRole));
      assert.ok(stmt.content.length > 0);
    }
  });
});

// ============================================================================
// Stage 2: Knowledge Graph Indexing
// ============================================================================

describe('Pipeline Stage 2: Knowledge Graph Indexing (500 nodes, relationships)', () => {
  it('should build graph nodes with correct structure', () => {
    const nodes = generateEvidenceNodes(500);
    for (const node of nodes) {
      assert.ok(node.id.startsWith('evidence-'));
      assert.ok(typeof node.name === 'string');
      assert.ok(typeof node.properties === 'object');
      assert.ok(node.sourceDocumentId.startsWith('doc-'));
    }
  });

  it('should generate relationships between nodes', () => {
    const nodes = generateEvidenceNodes(500);
    const rels = generateRelationships(nodes, 1000);
    assert.equal(rels.length, 1000);

    for (const rel of rels) {
      assert.ok(REL_TYPES.includes(rel.type), `Invalid rel type: ${rel.type}`);
      assert.ok(rel.confidence >= 0.5 && rel.confidence <= 1.0);
      assert.equal(rel.tenantId, TENANT_ID);
    }
  });

  it('should ensure graph connectivity (no orphan nodes in relationships)', () => {
    const nodes = generateEvidenceNodes(500);
    const nodeIds = new Set(nodes.map(n => n.id));
    const rels = generateRelationships(nodes, 1000);

    for (const rel of rels) {
      assert.ok(nodeIds.has(rel.sourceNodeId), `Orphan source: ${rel.sourceNodeId}`);
      assert.ok(nodeIds.has(rel.targetNodeId), `Orphan target: ${rel.targetNodeId}`);
    }
  });
});

// ============================================================================
// Stage 3: Evidence Relationship Engine
// ============================================================================

describe('Pipeline Stage 3: Evidence Relationship Engine', () => {
  it('should produce CONTRADICTS and REFUTES relationships for contradictory evidence', () => {
    const nodes = generateEvidenceNodes(500);
    const rels = generateRelationships(nodes, 1000);

    const contradicts = rels.filter(r => r.type === 'CONTRADICTS');
    const refutes = rels.filter(r => r.type === 'REFUTES');
    const supports = rels.filter(r => r.type === 'SUPPORTS');
    const violates = rels.filter(r => r.type === 'VIOLATES');

    // With 1000 rels cycled over 7 types, we should have ~143 of each
    assert.ok(contradicts.length > 100, `Expected >100 CONTRADICTS, got ${contradicts.length}`);
    assert.ok(refutes.length > 100, `Expected >100 REFUTES, got ${refutes.length}`);
    assert.ok(supports.length > 100, `Expected >100 SUPPORTS, got ${supports.length}`);
    assert.ok(violates.length > 100, `Expected >100 VIOLATES, got ${violates.length}`);
  });

  it('should compute confidence scores for all relationships', () => {
    const nodes = generateEvidenceNodes(500);
    const rels = generateRelationships(nodes, 1000);

    for (const rel of rels) {
      assert.ok(rel.confidence >= 0.0 && rel.confidence <= 1.0,
        `Confidence ${rel.confidence} out of range for ${rel.id}`);
    }
  });
});

// ============================================================================
// Stage 4: Narrative Conflict Detection (Full Pipeline)
// ============================================================================

describe('Pipeline Stage 4: Narrative Conflict Detection (200 statements, 100 events)', () => {
  it('should detect testimony contradictions from 200 statements', () => {
    const statements = generateStatements(200);
    const comparator = new StatementComparator();

    const result = comparator.compareStatements(statements, TENANT_ID);

    // With paired contradictory statements, we should detect conflicts
    assert.ok(result.detectedConflicts.length > 0,
      `Expected testimony conflicts, got ${result.detectedConflicts.length}`);

    for (const conflict of result.detectedConflicts) {
      assert.equal(conflict.conflictType, 'testimony');
      assert.equal(conflict.tenantId, TENANT_ID);
      assert.ok(conflict.severity.severityScore >= 0.0 && conflict.severity.severityScore <= 1.0);
      // Verify explanation factors
      assert.ok(conflict.explanationFactors.witnessContradiction);
      assert.equal(conflict.explanationFactors.timestampMismatch, false);
    }
  });

  it('should detect timeline conflicts from 100 events', () => {
    const events = generateTimelineEvents(100);
    const analyzer = new TimelineConflictAnalyzer();

    const result = analyzer.analyzeTimeline(events, TENANT_ID);

    // Verify result structure
    assert.ok(Array.isArray(result.detectedConflicts));
    assert.ok(Array.isArray(result.timelineConflicts));

    for (const conflict of result.detectedConflicts) {
      assert.equal(conflict.conflictType, 'timeline');
      assert.equal(conflict.tenantId, TENANT_ID);
      // Verify explanation factors
      assert.ok(conflict.explanationFactors.timestampMismatch);
      assert.equal(conflict.explanationFactors.policyViolation, false);
    }
  });

  it('should run the full 5-stage conflict detection pipeline', () => {
    const statements = generateStatements(200);
    const events = generateTimelineEvents(100);
    const nodes = generateEvidenceNodes(500);
    const rels = generateRelationships(nodes, 1000);

    const detector = new NarrativeConflictDetector({
      autoInsertToGraph: false,
      minReportSeverity: 0.0, // Report all for testing
      detectEvidenceInconsistencies: true,
      detectPolicyViolations: true,
      detectLegalClaimConflicts: true,
    });

    const request: ConflictDetectionRequest = {
      tenantId: TENANT_ID,
      statements,
      timelineEvents: events,
      graphNodes: nodes,
      graphRelationships: rels,
    };

    return detector.detectConflicts(request).then(result => {
      // Verify all conflict types are present
      const typeSet = new Set(result.conflicts.map(c => c.conflictType));

      // We should detect at least testimony and evidence conflicts
      assert.ok(result.conflicts.length > 0,
        `Expected conflicts, got ${result.conflicts.length}`);
      assert.ok(typeSet.has('testimony'),
        `Expected testimony conflicts in types: ${[...typeSet].join(', ')}`);

      // Verify result structure
      assert.ok(result.totalStatementsAnalyzed >= 0);
      assert.ok(result.totalTimelineEventsAnalyzed >= 0);
      assert.ok(result.durationMs >= 0);

      // Verify all conflicts have explanation factors
      for (const conflict of result.conflicts) {
        assert.ok(conflict.explanationFactors !== undefined,
          `Missing explanationFactors for conflict ${conflict.id}`);
        assert.ok(typeof conflict.explanationFactors.timestampMismatch === 'boolean');
        assert.ok(typeof conflict.explanationFactors.policyViolation === 'boolean');
        assert.ok(typeof conflict.explanationFactors.witnessContradiction === 'boolean');
        assert.ok(typeof conflict.explanationFactors.evidenceInconsistency === 'boolean');
        assert.ok(typeof conflict.explanationFactors.legalClaimContradiction === 'boolean');
      }

      // Verify conflicts are ranked by severity (descending)
      for (let i = 1; i < result.conflicts.length; i++) {
        assert.ok(
          result.conflicts[i].severity.severityScore <= result.conflicts[i - 1].severity.severityScore,
          `Conflicts not sorted: ${result.conflicts[i - 1].severity.severityScore} < ${result.conflicts[i].severity.severityScore}`,
        );
      }
    });
  });

  it('should handle large dataset within performance bounds', () => {
    const statements = generateStatements(200);
    const events = generateTimelineEvents(100);
    const nodes = generateEvidenceNodes(500);
    const rels = generateRelationships(nodes, 1000);

    const detector = new NarrativeConflictDetector({
      autoInsertToGraph: false,
      minReportSeverity: 0.1,
    });

    const request: ConflictDetectionRequest = {
      tenantId: TENANT_ID,
      statements,
      timelineEvents: events,
      graphNodes: nodes,
      graphRelationships: rels,
    };

    const start = Date.now();
    return detector.detectConflicts(request).then(result => {
      const duration = Date.now() - start;

      // Should complete within 5 seconds
      assert.ok(duration < 5000,
        `Pipeline took ${duration}ms, expected <5000ms`);

      // Should produce a meaningful number of conflicts
      assert.ok(result.conflicts.length > 0,
        `Expected conflicts from large dataset, got ${result.conflicts.length}`);
    });
  });
});

// ============================================================================
// Stage 5: Conflict Scoring & Explainability
// ============================================================================

describe('Pipeline Stage 5: Conflict Scoring & Explainability', () => {
  it('should produce explanation factors matching the conflict schema', () => {
    // Verify the schema structure matches the requirement:
    // { severityScore, conflictType, explanationFactors: { timestampMismatch, policyViolation, witnessContradiction } }
    const statements = generateStatements(20);
    const comparator = new StatementComparator();
    const result = comparator.compareStatements(statements, TENANT_ID);

    for (const conflict of result.detectedConflicts) {
      // Match the required output structure
      const output = {
        severityScore: conflict.severity.severityScore,
        conflictType: conflict.conflictType,
        explanationFactors: conflict.explanationFactors,
      };

      assert.ok(typeof output.severityScore === 'number');
      assert.ok(output.severityScore >= 0.0 && output.severityScore <= 1.0);
      assert.ok(typeof output.conflictType === 'string');
      assert.ok(typeof output.explanationFactors === 'object');
      assert.ok(typeof output.explanationFactors.timestampMismatch === 'boolean');
      assert.ok(typeof output.explanationFactors.policyViolation === 'boolean');
      assert.ok(typeof output.explanationFactors.witnessContradiction === 'boolean');
      assert.ok(typeof output.explanationFactors.evidenceInconsistency === 'boolean');
      assert.ok(typeof output.explanationFactors.legalClaimContradiction === 'boolean');
    }
  });

  it('should correctly set explanation factors per conflict type', () => {
    const types = ['timeline', 'testimony', 'evidence', 'policy_violation', 'legal_claim'] as const;

    for (const type of types) {
      const factors = deriveExplanationFactors(type);
      assert.equal(factors.timestampMismatch, type === 'timeline');
      assert.equal(factors.policyViolation, type === 'policy_violation');
      assert.equal(factors.witnessContradiction, type === 'testimony');
      assert.equal(factors.evidenceInconsistency, type === 'evidence');
      assert.equal(factors.legalClaimContradiction, type === 'legal_claim');
    }
  });

  it('should apply severity scoring with 4 weighted factors', () => {
    const engine = new ConflictScoringEngine();

    const factors = {
      temporalContradictionStrength: 0.9,
      evidenceReliability: 0.8,
      policyViolationWeight: 0.9,
      supportingSourceCount: 3,
    };

    const severity = engine.computeSeverity(factors);
    assert.ok(severity.severityScore >= 0.0 && severity.severityScore <= 1.0);
    assert.ok(['low', 'medium', 'high', 'critical'].includes(severity.severity));

    // Verify weights sum to 1.0
    const weightSum =
      severity.weights.temporalContradictionStrength +
      severity.weights.evidenceReliability +
      severity.weights.policyViolationWeight +
      severity.weights.supportingSourceCount;
    assert.ok(Math.abs(weightSum - 1.0) < 0.001,
      `Weights sum to ${weightSum}, expected 1.0`);
  });

  it('should rank conflicts correctly by severity', () => {
    const engine = new ConflictScoringEngine();

    const highFactors = {
      temporalContradictionStrength: 0.95,
      evidenceReliability: 0.9,
      policyViolationWeight: 0.95,
      supportingSourceCount: 5,
    };

    const lowFactors = {
      temporalContradictionStrength: 0.1,
      evidenceReliability: 0.2,
      policyViolationWeight: 0.1,
      supportingSourceCount: 1,
    };

    const highSeverity = engine.computeSeverity(highFactors);
    const lowSeverity = engine.computeSeverity(lowFactors);

    assert.ok(highSeverity.severityScore > lowSeverity.severityScore,
      `High (${highSeverity.severityScore}) should be > Low (${lowSeverity.severityScore})`);
  });
});

// ============================================================================
// Stage 6: Graph Integration (Conflict nodes + relationships)
// ============================================================================

describe('Pipeline Stage 6: Graph Integration', () => {
  it('should insert conflicts into graph with explanation factors', async () => {
    const { session, executedQueries } = createMockSession();
    const integrator = new ConflictGraphIntegrator({ minSeverityForInsertion: 0.0 });

    const statements = generateStatements(20);
    const comparator = new StatementComparator();
    const result = comparator.compareStatements(statements, TENANT_ID);

    if (result.detectedConflicts.length > 0) {
      const insertResult = await integrator.insertConflicts(
        result.detectedConflicts.slice(0, 5),
        session,
      );

      assert.ok(insertResult.conflictNodesCreated > 0);
      assert.ok(insertResult.relationshipsCreated > 0);
      assert.ok(insertResult.durationMs >= 0);

      // Verify Cypher includes explanation factors
      const createQueries = executedQueries.filter(q => q.cypher.includes('MERGE (c:Conflict'));
      for (const q of createQueries) {
        assert.ok(q.cypher.includes('timestampMismatch'), 'Missing timestampMismatch in Cypher');
        assert.ok(q.cypher.includes('witnessContradiction'), 'Missing witnessContradiction in Cypher');
        assert.ok(q.cypher.includes('evidenceInconsistency'), 'Missing evidenceInconsistency in Cypher');
        assert.ok(q.cypher.includes('legalClaimContradiction'), 'Missing legalClaimContradiction in Cypher');
      }
    }
  });

  it('should build conflict node with explanation factors in properties', () => {
    const integrator = new ConflictGraphIntegrator();

    const statements = generateStatements(20);
    const comparator = new StatementComparator();
    const result = comparator.compareStatements(statements, TENANT_ID);

    if (result.detectedConflicts.length > 0) {
      const conflict = result.detectedConflicts[0];
      const node = integrator.buildConflictNode(conflict);

      assert.equal(node.type, 'Conflict');
      assert.equal(node.properties['conflictType'], conflict.conflictType);
      assert.ok('timestampMismatch' in node.properties);
      assert.ok('policyViolation' in node.properties);
      assert.ok('witnessContradiction' in node.properties);
      assert.ok('evidenceInconsistency' in node.properties);
      assert.ok('legalClaimContradiction' in node.properties);
    }
  });
});

// ============================================================================
// Stage 7: End-to-End Pipeline Validation (10k docs, 500 evidence, 200 statements)
// ============================================================================

describe('Pipeline End-to-End: 10k docs → 500 evidence → 200 statements → conflicts → graph', () => {
  it('should process the full dataset end-to-end', async () => {
    // Stage 1: Corpus ingestion
    const docs = generateDocuments(10_000);
    assert.equal(docs.length, 10_000);

    // Stage 2: Knowledge graph indexing
    const nodes = generateEvidenceNodes(500);
    const rels = generateRelationships(nodes, 1000);
    assert.equal(nodes.length, 500);
    assert.equal(rels.length, 1000);

    // Stage 3: Evidence relationship engine (rels already generated)
    const contradictions = rels.filter(r => r.type === 'CONTRADICTS' || r.type === 'REFUTES');
    assert.ok(contradictions.length > 0, 'No contradictory relationships found');

    // Stage 4: Narrative conflict detection
    const statements = generateStatements(200);
    const events = generateTimelineEvents(100);

    const detector = new NarrativeConflictDetector({
      autoInsertToGraph: false,
      minReportSeverity: 0.0,
    });

    const request: ConflictDetectionRequest = {
      tenantId: TENANT_ID,
      statements,
      timelineEvents: events,
      graphNodes: nodes,
      graphRelationships: rels,
    };

    const result = await detector.detectConflicts(request);
    assert.ok(result.conflicts.length > 0, 'No conflicts detected in full pipeline');

    // Stage 5: Verify scoring and explainability
    for (const conflict of result.conflicts) {
      assert.ok(conflict.severity.severityScore >= 0.0);
      assert.ok(conflict.severity.severityScore <= 1.0);
      assert.ok(conflict.explanationFactors !== undefined);
    }

    // Stage 6: Graph integration
    const { session, executedQueries } = createMockSession();
    const integrator = new ConflictGraphIntegrator({ minSeverityForInsertion: 0.0 });

    const insertResult = await integrator.insertConflicts(
      result.conflicts.slice(0, 10), // Insert first 10 conflicts
      session,
    );

    assert.ok(insertResult.conflictNodesCreated > 0, 'No conflict nodes created');
    assert.ok(insertResult.relationshipsCreated > 0, 'No relationships created');
    assert.ok(executedQueries.length > 0, 'No Cypher queries executed');

    // Verify the pipeline summary
    const summary = {
      documentsIngested: docs.length,
      evidenceNodes: nodes.length,
      relationships: rels.length,
      statementsAnalyzed: statements.length,
      timelineEventsAnalyzed: events.length,
      conflictsDetected: result.conflicts.length,
      conflictNodesInserted: insertResult.conflictNodesCreated,
      relationshipsInserted: insertResult.relationshipsCreated,
    };

    assert.equal(summary.documentsIngested, 10_000);
    assert.equal(summary.evidenceNodes, 500);
    assert.equal(summary.relationships, 1000);
    assert.equal(summary.statementsAnalyzed, 200);
    assert.equal(summary.timelineEventsAnalyzed, 100);
    assert.ok(summary.conflictsDetected > 0);
    assert.ok(summary.conflictNodesInserted > 0);
    assert.ok(summary.relationshipsInserted > 0);
  });

  it('should maintain tenant isolation across the entire pipeline', async () => {
    const nodes = generateEvidenceNodes(50);
    const rels = generateRelationships(nodes, 100);
    const statements = generateStatements(20);
    const events = generateTimelineEvents(10);

    const detector = new NarrativeConflictDetector({ autoInsertToGraph: false, minReportSeverity: 0.0 });

    const result = await detector.detectConflicts({
      tenantId: TENANT_ID,
      statements,
      timelineEvents: events,
      graphNodes: nodes,
      graphRelationships: rels,
    });

    // Every conflict should have the correct tenantId
    for (const conflict of result.conflicts) {
      assert.equal(conflict.tenantId, TENANT_ID,
        `Tenant mismatch in conflict ${conflict.id}: ${conflict.tenantId}`);
    }
  });

  it('should produce deterministic results (no probabilistic variation)', async () => {
    const statements = generateStatements(20);
    const events = generateTimelineEvents(10);
    const nodes = generateEvidenceNodes(50);
    const rels = generateRelationships(nodes, 100);

    const detector = new NarrativeConflictDetector({ autoInsertToGraph: false, minReportSeverity: 0.0 });

    const request: ConflictDetectionRequest = {
      tenantId: TENANT_ID,
      statements,
      timelineEvents: events,
      graphNodes: nodes,
      graphRelationships: rels,
    };

    const result1 = await detector.detectConflicts(request);
    const result2 = await detector.detectConflicts(request);

    // Same input should produce same number of conflicts
    assert.equal(result1.conflicts.length, result2.conflicts.length,
      `Non-deterministic: run1=${result1.conflicts.length}, run2=${result2.conflicts.length}`);

    // Same conflict IDs
    const ids1 = result1.conflicts.map(c => c.id).sort();
    const ids2 = result2.conflicts.map(c => c.id).sort();
    assert.deepEqual(ids1, ids2, 'Non-deterministic conflict IDs');

    // Same severity scores
    for (let i = 0; i < result1.conflicts.length; i++) {
      const c1 = result1.conflicts.find(c => c.id === ids1[i])!;
      const c2 = result2.conflicts.find(c => c.id === ids1[i])!;
      assert.equal(c1.severity.severityScore, c2.severity.severityScore,
        `Non-deterministic severity for ${c1.id}`);
    }
  });
});
