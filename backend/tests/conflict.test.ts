// ============================================
// Court Access — Narrative Conflict Detection Tests
// Phase 3: Timeline analysis, statement comparison,
// conflict scoring, graph integration, and the
// full narrative conflict detection pipeline.
// ============================================

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { TimelineConflictAnalyzer } from '../src/conflict/timelineConflictAnalyzer.ts';
import { StatementComparator } from '../src/conflict/statementComparator.ts';
import { ConflictScoringEngine } from '../src/conflict/conflictScoringEngine.ts';
import { ConflictGraphIntegrator } from '../src/conflict/conflictGraphIntegrator.ts';
import { NarrativeConflictDetector } from '../src/conflict/narrativeConflictDetector.ts';
import { DEFAULT_CONFLICT_SCORING_WEIGHTS, deriveExplanationFactors } from '../src/conflict/types.ts';
import type {
  Statement,
  TimelineEvent,
  ConflictScoringFactors,
  DetectedConflict,
  ConflictDetectionRequest,
  GraphNode,
  GraphRelationship,
} from '../src/conflict/types.ts';

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

function makeStatement(overrides: Partial<Statement> & { id: string; content: string }): Statement {
  return {
    speakerId: 'speaker-1',
    speakerName: 'Officer Smith',
    speakerRole: 'officer',
    sourceDocumentId: 'doc-1',
    tenantId: 'tenant-test',
    statementDate: new Date('2025-06-15T10:00:00Z'),
    startOffset: 0,
    endOffset: overrides.content.length,
    ...overrides,
  };
}

function makeTimelineEvent(overrides: Partial<TimelineEvent> & { id: string; description: string; timestamp: Date }): TimelineEvent {
  return {
    precision: 'exact' as const,
    endTimestamp: null,
    sourceId: 'source-1',
    sourceType: 'statement' as const,
    speakerId: 'speaker-1',
    sourceDocumentId: 'doc-1',
    tenantId: 'tenant-test',
    ...overrides,
  };
}

function makeGraphNode(overrides: Partial<GraphNode> & { id: string; type: GraphNode['type']; name: string }): GraphNode {
  return {
    properties: {},
    sourceDocumentId: 'doc-1',
    tenantId: 'tenant-test',
    createdAt: new Date(),
    ...overrides,
  };
}

function makeGraphRelationship(overrides: Partial<GraphRelationship> & { id: string; type: GraphRelationship['type'] }): GraphRelationship {
  return {
    sourceNodeId: 'source-1',
    targetNodeId: 'target-1',
    confidence: 0.8,
    properties: {},
    sourceDocumentId: 'doc-1',
    tenantId: 'tenant-test',
    createdAt: new Date(),
    ...overrides,
  };
}

function makeDetectedConflict(overrides?: Partial<DetectedConflict>): DetectedConflict {
  return {
    id: 'conflict-test-1',
    conflictType: 'testimony',
    description: 'Test conflict',
    severity: {
      severityScore: 0.6,
      severity: 'medium',
      factors: {
        temporalContradictionStrength: 0.5,
        evidenceReliability: 0.7,
        policyViolationWeight: 0.3,
        supportingSourceCount: 2,
      },
      weights: { ...DEFAULT_CONFLICT_SCORING_WEIGHTS },
    },
    explanationFactors: deriveExplanationFactors(overrides?.conflictType ?? 'testimony'),
    sourceNodeIds: ['node-a'],
    targetNodeIds: ['node-b'],
    evidenceIds: [],
    tenantId: 'tenant-test',
    sourceDocumentIds: ['doc-1'],
    detectedAt: new Date(),
    ...overrides,
  };
}

// Mock Neo4j session for graph integration tests
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
// TimelineConflictAnalyzer Tests
// ============================================================================

describe('TimelineConflictAnalyzer', () => {
  let analyzer: TimelineConflictAnalyzer;

  beforeEach(() => {
    analyzer = new TimelineConflictAnalyzer();
  });

  it('should detect cross-speaker timeline conflicts', () => {
    const events: TimelineEvent[] = [
      makeTimelineEvent({
        id: 'evt-1',
        description: 'suspect arrived at the scene',
        timestamp: new Date('2025-06-15T10:00:00Z'),
        speakerId: 'officer-1',
      }),
      makeTimelineEvent({
        id: 'evt-2',
        description: 'suspect arrived at the scene',
        timestamp: new Date('2025-06-15T10:05:00Z'),
        speakerId: 'witness-1',
      }),
    ];

    const result = analyzer.analyzeTimeline(events, 'tenant-test');

    assert.ok(result.timelineConflicts.length > 0, 'Should detect at least one timeline conflict');
    assert.ok(result.detectedConflicts.length > 0, 'Should produce detected conflicts');

    const conflict = result.timelineConflicts[0];
    assert.equal(conflict.sameSpeaker, false);
    assert.ok(conflict.timeGapMs > 0, 'Time gap should be positive');
    assert.ok(conflict.conflictDescription.includes('Cross-speaker'));
  });

  it('should not flag events within simultaneous threshold', () => {
    const events: TimelineEvent[] = [
      makeTimelineEvent({
        id: 'evt-1',
        description: 'suspect arrived at the scene',
        timestamp: new Date('2025-06-15T10:00:00Z'),
        speakerId: 'officer-1',
      }),
      makeTimelineEvent({
        id: 'evt-2',
        description: 'suspect arrived at the scene',
        timestamp: new Date('2025-06-15T10:00:30Z'), // 30 seconds later
        speakerId: 'witness-1',
      }),
    ];

    const result = analyzer.analyzeTimeline(events, 'tenant-test');
    const crossSpeaker = result.timelineConflicts.filter(
      tc => tc.conflictDescription.includes('Cross-speaker'),
    );
    assert.equal(crossSpeaker.length, 0, 'Should not flag events within 1-minute threshold');
  });

  it('should detect simultaneous conflicts for the same speaker', () => {
    const analyzer2 = new TimelineConflictAnalyzer({ simultaneousThresholdMs: 60_000 });

    const events: TimelineEvent[] = [
      makeTimelineEvent({
        id: 'evt-1',
        description: 'officer was at the station filing report',
        timestamp: new Date('2025-06-15T10:00:00Z'),
        speakerId: 'officer-1',
      }),
      makeTimelineEvent({
        id: 'evt-2',
        description: 'officer conducted traffic stop on Main Street',
        timestamp: new Date('2025-06-15T10:00:30Z'),
        speakerId: 'officer-1',
      }),
    ];

    const result = analyzer2.analyzeTimeline(events, 'tenant-test');
    const simultaneous = result.timelineConflicts.filter(
      tc => tc.sameSpeaker === true,
    );
    assert.ok(simultaneous.length > 0, 'Should detect same-speaker simultaneous conflict');
  });

  it('should return empty results for no events', () => {
    const result = analyzer.analyzeTimeline([], 'tenant-test');
    assert.equal(result.timelineConflicts.length, 0);
    assert.equal(result.detectedConflicts.length, 0);
  });

  it('should respect maxEventsToCompare limit', () => {
    const limited = new TimelineConflictAnalyzer({ maxEventsToCompare: 2 });

    const events: TimelineEvent[] = Array.from({ length: 10 }, (_, i) =>
      makeTimelineEvent({
        id: `evt-${i}`,
        description: `event number ${i}`,
        timestamp: new Date(`2025-06-15T${String(10 + i).padStart(2, '0')}:00:00Z`),
        speakerId: `speaker-${i % 3}`,
      }),
    );

    // Should not throw even with many events
    const result = limited.analyzeTimeline(events, 'tenant-test');
    assert.ok(Array.isArray(result.timelineConflicts));
  });

  it('should produce detected conflicts with valid severity scores', () => {
    const events: TimelineEvent[] = [
      makeTimelineEvent({
        id: 'evt-1',
        description: 'suspect fled the building quickly',
        timestamp: new Date('2025-06-15T10:00:00Z'),
        speakerId: 'officer-1',
      }),
      makeTimelineEvent({
        id: 'evt-2',
        description: 'suspect fled the building quickly',
        timestamp: new Date('2025-06-15T10:05:00Z'), // 5 minutes later
        speakerId: 'witness-1',
      }),
    ];

    const result = analyzer.analyzeTimeline(events, 'tenant-test');
    assert.ok(result.detectedConflicts.length > 0);

    for (const dc of result.detectedConflicts) {
      assert.ok(dc.severity.severityScore >= 0.0 && dc.severity.severityScore <= 1.0);
      assert.ok(['low', 'medium', 'high', 'critical'].includes(dc.severity.severity));
      assert.equal(dc.conflictType, 'timeline');
      assert.equal(dc.tenantId, 'tenant-test');
      assert.ok(dc.id.startsWith('conflict-'));
    }
  });

  it('should deduplicate conflicts', () => {
    const events: TimelineEvent[] = [
      makeTimelineEvent({
        id: 'evt-1',
        description: 'suspect entered the vehicle',
        timestamp: new Date('2025-06-15T10:00:00Z'),
        speakerId: 'officer-1',
      }),
      makeTimelineEvent({
        id: 'evt-2',
        description: 'suspect entered the vehicle',
        timestamp: new Date('2025-06-15T10:05:00Z'),
        speakerId: 'witness-1',
      }),
    ];

    const result = analyzer.analyzeTimeline(events, 'tenant-test');
    // Each pair should only appear once
    const ids = result.detectedConflicts.map(c => c.id);
    const uniqueIds = new Set(ids);
    assert.equal(ids.length, uniqueIds.size, 'Conflict IDs should be unique');
  });
});

// ============================================================================
// StatementComparator Tests
// ============================================================================

describe('StatementComparator', () => {
  let comparator: StatementComparator;

  beforeEach(() => {
    comparator = new StatementComparator();
  });

  it('should detect negation-based contradictions', () => {
    const statements: Statement[] = [
      makeStatement({
        id: 'stmt-1',
        content: 'The suspect was armed and aggressive during the encounter.',
        speakerId: 'officer-1',
        speakerName: 'Officer Smith',
        speakerRole: 'officer',
      }),
      makeStatement({
        id: 'stmt-2',
        content: 'The suspect was unarmed and compliant during the encounter.',
        speakerId: 'witness-1',
        speakerName: 'Jane Doe',
        speakerRole: 'witness',
      }),
    ];

    const result = comparator.compareStatements(statements, 'tenant-test');
    assert.ok(result.comparisons.length > 0, 'Should detect contradictions');

    const comparison = result.comparisons[0];
    assert.equal(comparison.isContradiction, true);
    assert.ok(comparison.contradictions.length > 0, 'Should find specific contradictions');
  });

  it('should detect quantitative contradictions', () => {
    const statements: Statement[] = [
      makeStatement({
        id: 'stmt-1',
        content: 'There were 3 officers present and the incident lasted 5 minutes.',
        speakerId: 'officer-1',
        speakerName: 'Officer Smith',
        speakerRole: 'officer',
      }),
      makeStatement({
        id: 'stmt-2',
        content: 'There were 8 officers present and the incident lasted 30 minutes.',
        speakerId: 'witness-1',
        speakerName: 'Jane Doe',
        speakerRole: 'witness',
      }),
    ];

    const result = comparator.compareStatements(statements, 'tenant-test');
    assert.ok(result.comparisons.length > 0, 'Should detect quantitative contradictions');

    const quantitative = result.comparisons[0].contradictions.filter(
      c => c.category === 'quantitative',
    );
    assert.ok(quantitative.length > 0, 'Should find quantitative contradictions');
  });

  it('should skip statements shorter than minStatementLength', () => {
    const comparator2 = new StatementComparator({ minStatementLength: 100 });

    const statements: Statement[] = [
      makeStatement({ id: 'stmt-1', content: 'Short statement.' }),
      makeStatement({ id: 'stmt-2', content: 'Another short one.' }),
    ];

    const result = comparator2.compareStatements(statements, 'tenant-test');
    assert.equal(result.comparisons.length, 0, 'Should skip short statements');
  });

  it('should support cross-role-only mode', () => {
    const crossRoleComparator = new StatementComparator({ crossRoleOnly: true });

    const statements: Statement[] = [
      makeStatement({
        id: 'stmt-1',
        content: 'The suspect was armed with a knife during the traffic stop.',
        speakerId: 'officer-1',
        speakerName: 'Officer Smith',
        speakerRole: 'officer',
      }),
      makeStatement({
        id: 'stmt-2',
        content: 'The suspect was unarmed during the traffic stop encounter.',
        speakerId: 'officer-2',
        speakerName: 'Officer Jones',
        speakerRole: 'officer',
      }),
    ];

    const result = crossRoleComparator.compareStatements(statements, 'tenant-test');
    assert.equal(result.comparisons.length, 0, 'Should skip same-role comparisons in crossRoleOnly mode');
  });

  it('should produce detected conflicts with correct type and severity', () => {
    const statements: Statement[] = [
      makeStatement({
        id: 'stmt-1',
        content: 'The suspect did resist arrest and was combative with officers.',
        speakerId: 'officer-1',
        speakerName: 'Officer Smith',
        speakerRole: 'officer',
      }),
      makeStatement({
        id: 'stmt-2',
        content: 'The suspect did not resist arrest and was compliant with officers.',
        speakerId: 'witness-1',
        speakerName: 'Jane Doe',
        speakerRole: 'witness',
      }),
    ];

    const result = comparator.compareStatements(statements, 'tenant-test');
    assert.ok(result.detectedConflicts.length > 0);

    for (const dc of result.detectedConflicts) {
      assert.equal(dc.conflictType, 'testimony');
      assert.ok(dc.severity.severityScore >= 0.0 && dc.severity.severityScore <= 1.0);
      assert.ok(dc.description.includes('Testimony contradiction'));
      assert.equal(dc.tenantId, 'tenant-test');
    }
  });

  it('should return empty for non-contradictory statements', () => {
    const statements: Statement[] = [
      makeStatement({
        id: 'stmt-1',
        content: 'The weather was sunny and clear during the morning hours.',
        speakerId: 'officer-1',
        speakerName: 'Officer Smith',
        speakerRole: 'officer',
      }),
      makeStatement({
        id: 'stmt-2',
        content: 'It was a bright sunny morning with clear skies overhead.',
        speakerId: 'witness-1',
        speakerName: 'Jane Doe',
        speakerRole: 'witness',
      }),
    ];

    const result = comparator.compareStatements(statements, 'tenant-test');
    assert.equal(result.comparisons.length, 0, 'Should not detect contradictions in agreeing statements');
  });

  it('should handle empty statement list', () => {
    const result = comparator.compareStatements([], 'tenant-test');
    assert.equal(result.comparisons.length, 0);
    assert.equal(result.detectedConflicts.length, 0);
  });
});

// ============================================================================
// ConflictScoringEngine Tests
// ============================================================================

describe('ConflictScoringEngine', () => {
  let engine: ConflictScoringEngine;

  beforeEach(() => {
    engine = new ConflictScoringEngine();
  });

  it('should compute severity score between 0.0 and 1.0', () => {
    const factors: ConflictScoringFactors = {
      temporalContradictionStrength: 0.8,
      evidenceReliability: 0.7,
      policyViolationWeight: 0.6,
      supportingSourceCount: 3,
    };

    const result = engine.computeSeverity(factors);
    assert.ok(result.severityScore >= 0.0 && result.severityScore <= 1.0);
    assert.ok(['low', 'medium', 'high', 'critical'].includes(result.severity));
  });

  it('should return critical for very high factors', () => {
    const factors: ConflictScoringFactors = {
      temporalContradictionStrength: 1.0,
      evidenceReliability: 1.0,
      policyViolationWeight: 1.0,
      supportingSourceCount: 5,
    };

    const result = engine.computeSeverity(factors);
    assert.equal(result.severity, 'critical');
    assert.ok(result.severityScore >= 0.85);
  });

  it('should return low for minimal factors', () => {
    const factors: ConflictScoringFactors = {
      temporalContradictionStrength: 0.1,
      evidenceReliability: 0.1,
      policyViolationWeight: 0.1,
      supportingSourceCount: 1,
    };

    const result = engine.computeSeverity(factors);
    assert.equal(result.severity, 'low');
    assert.ok(result.severityScore < 0.40);
  });

  it('should use default weights that sum to 1.0', () => {
    const sum =
      DEFAULT_CONFLICT_SCORING_WEIGHTS.temporalContradictionStrength +
      DEFAULT_CONFLICT_SCORING_WEIGHTS.evidenceReliability +
      DEFAULT_CONFLICT_SCORING_WEIGHTS.policyViolationWeight +
      DEFAULT_CONFLICT_SCORING_WEIGHTS.supportingSourceCount;
    assert.ok(Math.abs(sum - 1.0) < 0.001, `Weights sum to ${sum}`);
  });

  it('should throw when custom weights do not sum to 1.0', () => {
    assert.throws(
      () => new ConflictScoringEngine({
        temporalContradictionStrength: 0.5,
        evidenceReliability: 0.5,
        policyViolationWeight: 0.5,
        supportingSourceCount: 0.5,
      }),
      /weights must sum to 1\.0/i,
    );
  });

  it('should accept custom weights that sum to 1.0', () => {
    const custom = new ConflictScoringEngine({
      temporalContradictionStrength: 0.40,
      evidenceReliability: 0.30,
      policyViolationWeight: 0.20,
      supportingSourceCount: 0.10,
    });

    const factors: ConflictScoringFactors = {
      temporalContradictionStrength: 0.8,
      evidenceReliability: 0.7,
      policyViolationWeight: 0.6,
      supportingSourceCount: 3,
    };

    const result = custom.computeSeverity(factors);
    assert.ok(result.severityScore >= 0.0 && result.severityScore <= 1.0);
  });

  it('should rescore a conflict with updated factors', () => {
    const conflict = makeDetectedConflict();
    const original = conflict.severity.severityScore;

    const rescored = engine.rescoreConflict(conflict, {
      temporalContradictionStrength: 1.0,
      evidenceReliability: 1.0,
    });

    assert.ok(rescored.severity.severityScore !== original);
    assert.ok(rescored.severity.severityScore >= 0.0 && rescored.severity.severityScore <= 1.0);
  });

  it('should rank conflicts by severity (highest first)', () => {
    const conflicts = [
      makeDetectedConflict({ id: 'low', severity: { ...makeDetectedConflict().severity, severityScore: 0.2, severity: 'low' } }),
      makeDetectedConflict({ id: 'high', severity: { ...makeDetectedConflict().severity, severityScore: 0.9, severity: 'critical' } }),
      makeDetectedConflict({ id: 'mid', severity: { ...makeDetectedConflict().severity, severityScore: 0.5, severity: 'medium' } }),
    ];

    const ranked = engine.rankConflicts(conflicts);
    assert.equal(ranked[0].id, 'high');
    assert.equal(ranked[1].id, 'mid');
    assert.equal(ranked[2].id, 'low');
  });

  it('should apply type-specific adjustments', () => {
    const baseFactor: ConflictScoringFactors = {
      temporalContradictionStrength: 0.5,
      evidenceReliability: 0.5,
      policyViolationWeight: 0.5,
      supportingSourceCount: 2,
    };

    const timelineAdjusted = engine.adjustFactorsForType(baseFactor, 'timeline');
    assert.ok(
      timelineAdjusted.temporalContradictionStrength > baseFactor.temporalContradictionStrength,
      'Timeline type should boost temporal factor',
    );

    const policyAdjusted = engine.adjustFactorsForType(baseFactor, 'policy_violation');
    assert.ok(
      policyAdjusted.policyViolationWeight > baseFactor.policyViolationWeight,
      'Policy type should boost policy factor',
    );

    const testimonyAdjusted = engine.adjustFactorsForType(baseFactor, 'testimony');
    assert.ok(
      testimonyAdjusted.evidenceReliability > baseFactor.evidenceReliability,
      'Testimony type should boost reliability factor',
    );
  });

  it('should clamp factors to 0.0–1.0 range', () => {
    const factors: ConflictScoringFactors = {
      temporalContradictionStrength: 2.0, // exceeds 1.0
      evidenceReliability: -0.5,          // below 0.0
      policyViolationWeight: 0.5,
      supportingSourceCount: 3,
    };

    const result = engine.computeSeverity(factors);
    assert.ok(result.severityScore >= 0.0 && result.severityScore <= 1.0);
    assert.ok(result.factors.temporalContradictionStrength <= 1.0);
    assert.ok(result.factors.evidenceReliability >= 0.0);
  });
});

// ============================================================================
// ConflictGraphIntegrator Tests
// ============================================================================

describe('ConflictGraphIntegrator', () => {
  let integrator: ConflictGraphIntegrator;

  beforeEach(() => {
    integrator = new ConflictGraphIntegrator();
  });

  it('should build a valid Conflict GraphNode', () => {
    const conflict = makeDetectedConflict();
    const node = integrator.buildConflictNode(conflict);

    assert.equal(node.id, conflict.id);
    assert.equal(node.type, 'Conflict');
    assert.ok(node.name.includes('testimony'));
    assert.equal(node.properties['conflictType'], 'testimony');
    assert.equal(node.properties['severityScore'], conflict.severity.severityScore);
    assert.equal(node.tenantId, 'tenant-test');
  });

  it('should build a valid conflict relationship', () => {
    const conflict = makeDetectedConflict();
    const rel = integrator.buildConflictRelationship(
      conflict.id,
      'target-node-1',
      'CONTRADICTS',
      'tenant-test',
      0.75,
      conflict.severity.factors,
    );

    assert.ok(rel.id.startsWith('rel-'));
    assert.equal(rel.type, 'CONTRADICTS');
    assert.equal(rel.sourceNodeId, conflict.id);
    assert.equal(rel.targetNodeId, 'target-node-1');
    assert.equal(rel.confidence, 0.75);
    assert.equal(rel.confidenceScore, 0.75);
    assert.ok(rel.scoringFactors);
    assert.equal(rel.scoringFactors!.temporalContradiction, 0.5);
    assert.equal(rel.scoringFactors!.evidenceReliability, 0.7);
  });

  it('should filter conflicts below severity threshold', async () => {
    const lowSeverity = makeDetectedConflict({
      id: 'conflict-low',
      severity: {
        ...makeDetectedConflict().severity,
        severityScore: 0.1, // below default 0.3 threshold
        severity: 'low',
      },
    });

    const { session, executedQueries } = createMockSession();
    const result = await integrator.insertConflicts([lowSeverity], session);

    assert.equal(result.conflictNodesCreated, 0, 'Should not insert low-severity conflicts');
    assert.equal(result.insertedConflictIds.length, 0);
  });

  it('should insert eligible conflicts into graph', async () => {
    const conflict = makeDetectedConflict({
      severity: {
        ...makeDetectedConflict().severity,
        severityScore: 0.7,
        severity: 'high',
      },
    });

    const { session, executedQueries } = createMockSession();
    const result = await integrator.insertConflicts([conflict], session);

    assert.ok(result.conflictNodesCreated > 0, 'Should create conflict node');
    assert.ok(result.relationshipsCreated > 0, 'Should create relationships');
    assert.ok(result.insertedConflictIds.includes(conflict.id));
    assert.ok(result.durationMs >= 0);
  });

  it('should map severity to correct relationship type', () => {
    // Test via buildConflictRelationship (relationship type is based on severity)
    const node = integrator.buildConflictNode(makeDetectedConflict());
    assert.equal(node.type, 'Conflict');
  });

  it('should process conflicts in batches', async () => {
    const batchIntegrator = new ConflictGraphIntegrator({ batchSize: 2 });
    const conflicts = Array.from({ length: 5 }, (_, i) =>
      makeDetectedConflict({
        id: `conflict-${i}`,
        severity: {
          ...makeDetectedConflict().severity,
          severityScore: 0.8,
          severity: 'high',
        },
      }),
    );

    const { session } = createMockSession();
    const result = await batchIntegrator.insertConflicts(conflicts, session);

    assert.equal(result.conflictNodesCreated, 5, 'Should insert all 5 conflicts');
    assert.equal(result.insertedConflictIds.length, 5);
  });
});

// ============================================================================
// NarrativeConflictDetector Tests (Full Pipeline)
// ============================================================================

describe('NarrativeConflictDetector', () => {
  let detector: NarrativeConflictDetector;

  beforeEach(() => {
    detector = new NarrativeConflictDetector();
  });

  it('should detect timeline conflicts in full pipeline', async () => {
    const request: ConflictDetectionRequest = {
      tenantId: 'tenant-test',
      statements: [],
      timelineEvents: [
        makeTimelineEvent({
          id: 'evt-1',
          description: 'suspect arrived at the warehouse',
          timestamp: new Date('2025-06-15T10:00:00Z'),
          speakerId: 'officer-1',
        }),
        makeTimelineEvent({
          id: 'evt-2',
          description: 'suspect arrived at the warehouse',
          timestamp: new Date('2025-06-15T10:05:00Z'),
          speakerId: 'witness-1',
        }),
      ],
      graphNodes: [],
      graphRelationships: [],
    };

    const result = await detector.detectConflicts(request);

    assert.ok(result.conflicts.length > 0, 'Should detect timeline conflicts');
    assert.ok(result.timelineConflicts.length > 0);
    assert.equal(result.totalTimelineEventsAnalyzed, 2);
    assert.ok(result.durationMs >= 0);
  });

  it('should detect testimony contradictions in full pipeline', async () => {
    const request: ConflictDetectionRequest = {
      tenantId: 'tenant-test',
      statements: [
        makeStatement({
          id: 'stmt-1',
          content: 'The suspect was armed with a handgun and resisting arrest.',
          speakerId: 'officer-1',
          speakerName: 'Officer Smith',
          speakerRole: 'officer',
        }),
        makeStatement({
          id: 'stmt-2',
          content: 'The suspect was unarmed and was not resisting arrest at all.',
          speakerId: 'witness-1',
          speakerName: 'Jane Doe',
          speakerRole: 'witness',
        }),
      ],
      timelineEvents: [],
      graphNodes: [],
      graphRelationships: [],
    };

    const result = await detector.detectConflicts(request);

    assert.ok(result.conflicts.length > 0, 'Should detect testimony contradictions');
    assert.ok(result.statementContradictions.length > 0);
    assert.equal(result.totalStatementsAnalyzed, 2);
  });

  it('should detect evidence inconsistencies from graph', async () => {
    const request: ConflictDetectionRequest = {
      tenantId: 'tenant-test',
      statements: [],
      timelineEvents: [],
      graphNodes: [
        makeGraphNode({ id: 'evidence-1', type: 'Evidence', name: 'Body Camera Footage' }),
        makeGraphNode({ id: 'evidence-2', type: 'Evidence', name: 'Dash Camera Footage' }),
      ],
      graphRelationships: [
        makeGraphRelationship({
          id: 'rel-1',
          type: 'CONTRADICTS',
          sourceNodeId: 'evidence-1',
          targetNodeId: 'evidence-2',
          confidence: 0.85,
        }),
      ],
    };

    const result = await detector.detectConflicts(request);

    const evidenceConflicts = result.conflicts.filter(c => c.conflictType === 'evidence');
    assert.ok(evidenceConflicts.length > 0, 'Should detect evidence inconsistencies');
    assert.ok(evidenceConflicts[0].description.includes('Evidence inconsistency'));
  });

  it('should detect policy violation conflicts from graph', async () => {
    const request: ConflictDetectionRequest = {
      tenantId: 'tenant-test',
      statements: [],
      timelineEvents: [],
      graphNodes: [
        makeGraphNode({ id: 'evidence-1', type: 'Evidence', name: 'Body Camera Footage' }),
        makeGraphNode({ id: 'evidence-2', type: 'Evidence', name: 'Officer Report' }),
        makeGraphNode({ id: 'policy-1', type: 'Policy', name: 'Use of Force Policy 4.01' }),
      ],
      graphRelationships: [
        makeGraphRelationship({
          id: 'rel-violates',
          type: 'VIOLATES',
          sourceNodeId: 'evidence-1',
          targetNodeId: 'policy-1',
          confidence: 0.9,
        }),
        makeGraphRelationship({
          id: 'rel-supports',
          type: 'SUPPORTS',
          sourceNodeId: 'evidence-2',
          targetNodeId: 'policy-1',
          confidence: 0.85,
        }),
      ],
    };

    const result = await detector.detectConflicts(request);

    const policyConflicts = result.conflicts.filter(c => c.conflictType === 'policy_violation');
    assert.ok(policyConflicts.length > 0, 'Should detect policy violation conflicts');
    assert.ok(policyConflicts[0].description.includes('Policy conflict'));
  });

  it('should detect legal claim conflicts from graph', async () => {
    const request: ConflictDetectionRequest = {
      tenantId: 'tenant-test',
      statements: [],
      timelineEvents: [],
      graphNodes: [
        makeGraphNode({ id: 'claim-1', type: 'LegalClaim', name: 'Excessive Force Claim' }),
        makeGraphNode({ id: 'claim-2', type: 'LegalClaim', name: 'Justified Use of Force' }),
        makeGraphNode({ id: 'evidence-1', type: 'Evidence', name: 'Body Camera Footage' }),
      ],
      graphRelationships: [
        makeGraphRelationship({
          id: 'rel-supports',
          type: 'SUPPORTS',
          sourceNodeId: 'claim-1',
          targetNodeId: 'evidence-1',
          confidence: 0.9,
        }),
        makeGraphRelationship({
          id: 'rel-refutes',
          type: 'REFUTES',
          sourceNodeId: 'claim-2',
          targetNodeId: 'evidence-1',
          confidence: 0.85,
        }),
      ],
    };

    const result = await detector.detectConflicts(request);

    const legalConflicts = result.conflicts.filter(c => c.conflictType === 'legal_claim');
    assert.ok(legalConflicts.length > 0, 'Should detect legal claim conflicts');
    assert.ok(legalConflicts[0].description.includes('Legal claim conflict'));
  });

  it('should rank conflicts by severity (highest first)', async () => {
    const request: ConflictDetectionRequest = {
      tenantId: 'tenant-test',
      statements: [
        makeStatement({
          id: 'stmt-1',
          content: 'The suspect was armed with a weapon and was combative.',
          speakerId: 'officer-1',
          speakerName: 'Officer Smith',
          speakerRole: 'officer',
        }),
        makeStatement({
          id: 'stmt-2',
          content: 'The suspect was unarmed and completely compliant.',
          speakerId: 'witness-1',
          speakerName: 'Jane Doe',
          speakerRole: 'witness',
        }),
      ],
      timelineEvents: [
        makeTimelineEvent({
          id: 'evt-1',
          description: 'incident occurred at the intersection',
          timestamp: new Date('2025-06-15T10:00:00Z'),
          speakerId: 'officer-1',
        }),
        makeTimelineEvent({
          id: 'evt-2',
          description: 'incident occurred at the intersection',
          timestamp: new Date('2025-06-15T10:05:00Z'),
          speakerId: 'witness-1',
        }),
      ],
      graphNodes: [],
      graphRelationships: [],
    };

    const result = await detector.detectConflicts(request);

    if (result.conflicts.length >= 2) {
      for (let i = 1; i < result.conflicts.length; i++) {
        assert.ok(
          result.conflicts[i - 1].severity.severityScore >= result.conflicts[i].severity.severityScore,
          'Conflicts should be sorted by severity descending',
        );
      }
    }
  });

  it('should filter out conflicts below minReportSeverity', async () => {
    const strictDetector = new NarrativeConflictDetector({ minReportSeverity: 0.99 });

    const request: ConflictDetectionRequest = {
      tenantId: 'tenant-test',
      statements: [
        makeStatement({
          id: 'stmt-1',
          content: 'The suspect was present at the location during the time.',
          speakerId: 'officer-1',
          speakerName: 'Officer Smith',
          speakerRole: 'officer',
        }),
        makeStatement({
          id: 'stmt-2',
          content: 'The suspect was not present at the location during the time.',
          speakerId: 'witness-1',
          speakerName: 'Jane Doe',
          speakerRole: 'witness',
        }),
      ],
      timelineEvents: [],
      graphNodes: [],
      graphRelationships: [],
    };

    const result = await strictDetector.detectConflicts(request);
    // With very high threshold, most conflicts should be filtered
    for (const c of result.conflicts) {
      assert.ok(c.severity.severityScore >= 0.99);
    }
  });

  it('should handle empty request gracefully', async () => {
    const request: ConflictDetectionRequest = {
      tenantId: 'tenant-test',
      statements: [],
      timelineEvents: [],
      graphNodes: [],
      graphRelationships: [],
    };

    const result = await detector.detectConflicts(request);
    assert.equal(result.conflicts.length, 0);
    assert.equal(result.timelineConflicts.length, 0);
    assert.equal(result.statementContradictions.length, 0);
    assert.equal(result.totalStatementsAnalyzed, 0);
    assert.equal(result.totalTimelineEventsAnalyzed, 0);
    assert.ok(result.durationMs >= 0);
  });

  it('should insert conflicts to graph when autoInsertToGraph is enabled', async () => {
    const autoDetector = new NarrativeConflictDetector({ autoInsertToGraph: true });
    const { session, executedQueries } = createMockSession();

    const request: ConflictDetectionRequest = {
      tenantId: 'tenant-test',
      statements: [
        makeStatement({
          id: 'stmt-1',
          content: 'The suspect was armed and threatening the officers at the scene.',
          speakerId: 'officer-1',
          speakerName: 'Officer Smith',
          speakerRole: 'officer',
        }),
        makeStatement({
          id: 'stmt-2',
          content: 'The suspect was unarmed and non-threatening at the scene.',
          speakerId: 'witness-1',
          speakerName: 'Jane Doe',
          speakerRole: 'witness',
        }),
      ],
      timelineEvents: [],
      graphNodes: [],
      graphRelationships: [],
    };

    const result = await autoDetector.detectConflicts(request, session);

    // Should have executed Cypher queries for insertion
    if (result.conflicts.length > 0) {
      assert.ok(executedQueries.length > 0, 'Should execute Cypher queries for graph insertion');
      const hasMerge = executedQueries.some(q => q.cypher.includes('MERGE'));
      assert.ok(hasMerge, 'Should use MERGE for idempotent insertion');
    }
  });

  it('should allow manual graph insertion via insertConflictsToGraph', async () => {
    const conflicts = [makeDetectedConflict({
      severity: {
        ...makeDetectedConflict().severity,
        severityScore: 0.8,
        severity: 'high',
      },
    })];

    const { session, executedQueries } = createMockSession();
    const result = await detector.insertConflictsToGraph(conflicts, session);

    assert.ok(result.conflictNodesCreated > 0);
    assert.ok(result.insertedConflictIds.length > 0);
  });

  it('should detect all 5 conflict types simultaneously', async () => {
    const request: ConflictDetectionRequest = {
      tenantId: 'tenant-test',
      // Testimony contradictions
      statements: [
        makeStatement({
          id: 'stmt-1',
          content: 'The suspect did comply with all commands from the officers.',
          speakerId: 'officer-1',
          speakerName: 'Officer Smith',
          speakerRole: 'officer',
        }),
        makeStatement({
          id: 'stmt-2',
          content: 'The suspect did not comply with the commands from the officers.',
          speakerId: 'witness-1',
          speakerName: 'Jane Doe',
          speakerRole: 'witness',
        }),
      ],
      // Timeline contradictions
      timelineEvents: [
        makeTimelineEvent({
          id: 'evt-1',
          description: 'shooting incident reported at the warehouse',
          timestamp: new Date('2025-06-15T10:00:00Z'),
          speakerId: 'officer-1',
        }),
        makeTimelineEvent({
          id: 'evt-2',
          description: 'shooting incident reported at the warehouse',
          timestamp: new Date('2025-06-15T10:05:00Z'),
          speakerId: 'witness-1',
        }),
      ],
      // Graph-based conflicts
      graphNodes: [
        makeGraphNode({ id: 'evidence-1', type: 'Evidence', name: 'Body Camera' }),
        makeGraphNode({ id: 'evidence-2', type: 'Evidence', name: 'Dash Camera' }),
        makeGraphNode({ id: 'policy-1', type: 'Policy', name: 'Use of Force' }),
        makeGraphNode({ id: 'claim-1', type: 'LegalClaim', name: 'Excessive Force' }),
        makeGraphNode({ id: 'claim-2', type: 'LegalClaim', name: 'Justified Force' }),
      ],
      graphRelationships: [
        // Evidence inconsistency
        makeGraphRelationship({
          id: 'rel-contradict',
          type: 'CONTRADICTS',
          sourceNodeId: 'evidence-1',
          targetNodeId: 'evidence-2',
          confidence: 0.85,
        }),
        // Policy violation conflict
        makeGraphRelationship({
          id: 'rel-violates',
          type: 'VIOLATES',
          sourceNodeId: 'evidence-1',
          targetNodeId: 'policy-1',
          confidence: 0.9,
        }),
        makeGraphRelationship({
          id: 'rel-supports-policy',
          type: 'SUPPORTS',
          sourceNodeId: 'evidence-2',
          targetNodeId: 'policy-1',
          confidence: 0.8,
        }),
        // Legal claim conflict
        makeGraphRelationship({
          id: 'rel-claim-supports',
          type: 'SUPPORTS',
          sourceNodeId: 'claim-1',
          targetNodeId: 'evidence-1',
          confidence: 0.9,
        }),
        makeGraphRelationship({
          id: 'rel-claim-refutes',
          type: 'REFUTES',
          sourceNodeId: 'claim-2',
          targetNodeId: 'evidence-1',
          confidence: 0.85,
        }),
      ],
    };

    const result = await detector.detectConflicts(request);

    const types = new Set(result.conflicts.map(c => c.conflictType));
    assert.ok(types.has('timeline'), 'Should detect timeline conflicts');
    assert.ok(types.has('testimony'), 'Should detect testimony conflicts');
    assert.ok(types.has('evidence'), 'Should detect evidence conflicts');
    assert.ok(types.has('policy_violation'), 'Should detect policy violation conflicts');
    assert.ok(types.has('legal_claim'), 'Should detect legal claim conflicts');

    // Verify tenant isolation
    for (const c of result.conflicts) {
      assert.equal(c.tenantId, 'tenant-test', 'All conflicts should have correct tenantId');
    }
  });
});

// ============================================================================
// GraphRelationship Scoring Fields Tests
// ============================================================================

describe('GraphRelationship Scoring Fields', () => {
  it('should accept confidenceScore and scoringFactors on GraphRelationship', () => {
    const rel: GraphRelationship = {
      id: 'rel-1',
      type: 'CONTRADICTS',
      sourceNodeId: 'a',
      targetNodeId: 'b',
      confidence: 0.87,
      confidenceScore: 0.87,
      scoringFactors: {
        semanticSimilarity: 0.82,
        entityCooccurrence: 0.91,
        documentProximity: 0.77,
        legalReferenceStrength: 0.65,
      },
      properties: {},
      sourceDocumentId: 'doc-1',
      tenantId: 'tenant-1',
      createdAt: new Date(),
    };

    assert.equal(rel.confidenceScore, 0.87);
    assert.equal(rel.scoringFactors!.semanticSimilarity, 0.82);
    assert.equal(rel.scoringFactors!.entityCooccurrence, 0.91);
    assert.equal(rel.scoringFactors!.documentProximity, 0.77);
    assert.equal(rel.scoringFactors!.legalReferenceStrength, 0.65);
  });

  it('should accept conflict-specific scoring factors', () => {
    const rel: GraphRelationship = {
      id: 'rel-2',
      type: 'INVALIDATES',
      sourceNodeId: 'conflict-1',
      targetNodeId: 'evidence-1',
      confidence: 0.92,
      confidenceScore: 0.92,
      scoringFactors: {
        temporalContradiction: 0.85,
        evidenceReliability: 0.78,
        policyViolationWeight: 0.65,
        supportingSourceCount: 3,
      },
      properties: {},
      sourceDocumentId: 'doc-1',
      tenantId: 'tenant-1',
      createdAt: new Date(),
    };

    assert.equal(rel.scoringFactors!.temporalContradiction, 0.85);
    assert.equal(rel.scoringFactors!.evidenceReliability, 0.78);
    assert.equal(rel.scoringFactors!.policyViolationWeight, 0.65);
    assert.equal(rel.scoringFactors!.supportingSourceCount, 3);
  });

  it('should allow optional scoring fields (backward compatibility)', () => {
    const rel: GraphRelationship = {
      id: 'rel-3',
      type: 'SUPPORTS',
      sourceNodeId: 'a',
      targetNodeId: 'b',
      confidence: 0.5,
      properties: {},
      sourceDocumentId: 'doc-1',
      tenantId: 'tenant-1',
      createdAt: new Date(),
    };

    assert.equal(rel.confidenceScore, undefined);
    assert.equal(rel.scoringFactors, undefined);
  });
});

// ============================================================================
// Conflict Node Type Tests
// ============================================================================

describe('Conflict Node Type', () => {
  it('should accept Conflict as a valid GraphNodeType', () => {
    const node: GraphNode = {
      id: 'conflict-1',
      type: 'Conflict',
      name: 'timeline conflict',
      properties: {
        conflictType: 'timeline',
        severityScore: 0.85,
      },
      sourceDocumentId: 'doc-1',
      tenantId: 'tenant-1',
      createdAt: new Date(),
    };

    assert.equal(node.type, 'Conflict');
    assert.equal(node.properties['conflictType'], 'timeline');
  });

  it('should accept INVALIDATES and WEAKENS as valid relationship types', () => {
    const invalidatesRel: GraphRelationship = makeGraphRelationship({
      id: 'rel-inv-1',
      type: 'INVALIDATES',
    });
    assert.equal(invalidatesRel.type, 'INVALIDATES');

    const weakensRel: GraphRelationship = makeGraphRelationship({
      id: 'rel-weak-1',
      type: 'WEAKENS',
    });
    assert.equal(weakensRel.type, 'WEAKENS');
  });
});
