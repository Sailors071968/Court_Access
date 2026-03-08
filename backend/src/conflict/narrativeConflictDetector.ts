// ============================================
// Court Access — Narrative Conflict Detector
// Main orchestrator for Phase 3 conflict detection.
// Coordinates timeline analysis, statement comparison,
// conflict scoring, and graph integration.
// ============================================

import { TimelineConflictAnalyzer } from './timelineConflictAnalyzer.ts';
import { StatementComparator } from './statementComparator.ts';
import { ConflictScoringEngine } from './conflictScoringEngine.ts';
import { ConflictGraphIntegrator } from './conflictGraphIntegrator.ts';
import type {
  ConflictDetectionRequest,
  ConflictDetectionResult,
  DetectedConflict,
  ConflictScoringFactors,
  GraphNode,
  GraphRelationship,
} from './types.ts';
import type { Neo4jSession } from '../graph/types.ts';
import { createHash } from 'node:crypto';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface NarrativeConflictDetectorConfig {
  /** Whether to insert conflicts into the graph automatically */
  autoInsertToGraph: boolean;
  /** Minimum severity to report (skip noise) */
  minReportSeverity: number;
  /** Whether to detect evidence inconsistencies */
  detectEvidenceInconsistencies: boolean;
  /** Whether to detect policy violations */
  detectPolicyViolations: boolean;
  /** Whether to detect legal claim conflicts */
  detectLegalClaimConflicts: boolean;
}

const DEFAULT_CONFIG: NarrativeConflictDetectorConfig = {
  autoInsertToGraph: false,
  minReportSeverity: 0.1,
  detectEvidenceInconsistencies: true,
  detectPolicyViolations: true,
  detectLegalClaimConflicts: true,
};

// ---------------------------------------------------------------------------
// Narrative Conflict Detector
// ---------------------------------------------------------------------------

export class NarrativeConflictDetector {
  private readonly config: NarrativeConflictDetectorConfig;
  private readonly timelineAnalyzer: TimelineConflictAnalyzer;
  private readonly statementComparator: StatementComparator;
  private readonly scoringEngine: ConflictScoringEngine;
  private readonly graphIntegrator: ConflictGraphIntegrator;

  constructor(config?: Partial<NarrativeConflictDetectorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.timelineAnalyzer = new TimelineConflictAnalyzer();
    this.statementComparator = new StatementComparator();
    this.scoringEngine = new ConflictScoringEngine();
    this.graphIntegrator = new ConflictGraphIntegrator();
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Run the full conflict detection pipeline.
   *
   * Pipeline stages:
   * 1. Timeline analysis — detect temporal contradictions
   * 2. Statement comparison — detect testimony contradictions
   * 3. Evidence inconsistency detection — cross-reference evidence metadata
   * 4. Policy violation detection — check against policy/statute nodes
   * 5. Legal claim conflict detection — find contradictory legal claims
   * 6. Scoring — apply type-specific adjustments and rank
   * 7. Graph integration — insert conflict nodes (if autoInsert enabled)
   */
  async detectConflicts(
    request: ConflictDetectionRequest,
    session?: Neo4jSession,
  ): Promise<ConflictDetectionResult> {
    const startTime = Date.now();
    const allConflicts: DetectedConflict[] = [];

    // Stage 1: Timeline analysis
    const timelineResult = this.timelineAnalyzer.analyzeTimeline(
      request.timelineEvents,
      request.tenantId,
    );
    allConflicts.push(...timelineResult.detectedConflicts);

    // Stage 2: Statement comparison
    const statementResult = this.statementComparator.compareStatements(
      request.statements,
      request.tenantId,
    );
    allConflicts.push(...statementResult.detectedConflicts);

    // Stage 3: Evidence inconsistencies
    if (this.config.detectEvidenceInconsistencies) {
      const evidenceConflicts = this.detectEvidenceInconsistencies(
        request.graphNodes,
        request.graphRelationships,
        request.tenantId,
      );
      allConflicts.push(...evidenceConflicts);
    }

    // Stage 4: Policy violations
    if (this.config.detectPolicyViolations) {
      const policyConflicts = this.detectPolicyViolationConflicts(
        request.graphNodes,
        request.graphRelationships,
        request.tenantId,
      );
      allConflicts.push(...policyConflicts);
    }

    // Stage 5: Legal claim conflicts
    if (this.config.detectLegalClaimConflicts) {
      const legalConflicts = this.detectLegalClaimConflictsFromGraph(
        request.graphNodes,
        request.graphRelationships,
        request.tenantId,
      );
      allConflicts.push(...legalConflicts);
    }

    // Stage 6: Apply type-specific scoring adjustments and rank
    const adjusted = allConflicts.map(conflict => {
      const adjustedFactors = this.scoringEngine.adjustFactorsForType(
        conflict.severity.factors,
        conflict.conflictType,
      );
      return this.scoringEngine.rescoreConflict(conflict, adjustedFactors);
    });

    // Filter by minimum severity
    const filtered = adjusted.filter(
      c => c.severity.severityScore >= this.config.minReportSeverity,
    );

    // Rank by severity
    const ranked = this.scoringEngine.rankConflicts(filtered);

    // Stage 7: Graph integration (if enabled and session provided)
    if (this.config.autoInsertToGraph && session) {
      await this.graphIntegrator.insertConflicts(ranked, session);
    }

    return {
      conflicts: ranked,
      timelineConflicts: timelineResult.timelineConflicts,
      statementContradictions: statementResult.comparisons,
      totalStatementsAnalyzed: request.statements.length,
      totalTimelineEventsAnalyzed: request.timelineEvents.length,
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Insert already-detected conflicts into the graph.
   * Use this when autoInsertToGraph is false but you want manual control.
   */
  async insertConflictsToGraph(
    conflicts: DetectedConflict[],
    session: Neo4jSession,
  ) {
    return this.graphIntegrator.insertConflicts(conflicts, session);
  }

  // -----------------------------------------------------------------------
  // Stage 3: Evidence Inconsistencies
  // -----------------------------------------------------------------------

  /**
   * Detect inconsistencies in evidence metadata by examining
   * REFUTES and CONTRADICTS relationships in the existing graph.
   */
  private detectEvidenceInconsistencies(
    nodes: GraphNode[],
    relationships: GraphRelationship[],
    tenantId: string,
  ): DetectedConflict[] {
    const conflicts: DetectedConflict[] = [];

    // Find existing REFUTES or CONTRADICTS relationships between Evidence nodes
    const evidenceNodes = new Map(
      nodes.filter(n => n.type === 'Evidence').map(n => [n.id, n]),
    );

    for (const rel of relationships) {
      if (rel.type !== 'REFUTES' && rel.type !== 'CONTRADICTS') continue;

      const sourceNode = evidenceNodes.get(rel.sourceNodeId);
      const targetNode = evidenceNodes.get(rel.targetNodeId);

      if (!sourceNode || !targetNode) continue;

      const factors: ConflictScoringFactors = {
        temporalContradictionStrength: 0.3,
        evidenceReliability: rel.confidence,
        policyViolationWeight: 0.1,
        supportingSourceCount: 2,
      };

      const severity = this.scoringEngine.computeSeverity(
        this.scoringEngine.adjustFactorsForType(factors, 'evidence'),
      );

      const id = createHash('sha256')
        .update(`evidence:${rel.sourceNodeId}:${rel.targetNodeId}:${tenantId}`)
        .digest('hex')
        .slice(0, 16);

      conflicts.push({
        id: `conflict-${id}`,
        conflictType: 'evidence',
        description:
          `Evidence inconsistency: "${sourceNode.name}" ${rel.type.toLowerCase()} ` +
          `"${targetNode.name}" (confidence: ${rel.confidence.toFixed(2)})`,
        severity,
        sourceNodeIds: [rel.sourceNodeId],
        targetNodeIds: [rel.targetNodeId],
        evidenceIds: [rel.sourceNodeId, rel.targetNodeId],
        tenantId,
        sourceDocumentIds: [sourceNode.sourceDocumentId, targetNode.sourceDocumentId].filter(
          (v, i, a) => a.indexOf(v) === i,
        ),
        detectedAt: new Date(),
      });
    }

    return conflicts;
  }

  // -----------------------------------------------------------------------
  // Stage 4: Policy Violation Conflicts
  // -----------------------------------------------------------------------

  /**
   * Detect conflicts where evidence or events VIOLATE policies/statutes
   * but other evidence SUPPORTS compliance — indicating contradictory claims.
   */
  private detectPolicyViolationConflicts(
    nodes: GraphNode[],
    relationships: GraphRelationship[],
    tenantId: string,
  ): DetectedConflict[] {
    const conflicts: DetectedConflict[] = [];
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    // Find VIOLATES relationships
    const violations = relationships.filter(r => r.type === 'VIOLATES');
    // Find SUPPORTS relationships to the same policy/statute
    const supports = relationships.filter(r => r.type === 'SUPPORTS');

    for (const violation of violations) {
      // Find any SUPPORTS relationship pointing to the same target
      const contradictingSupports = supports.filter(
        s => s.targetNodeId === violation.targetNodeId && s.sourceNodeId !== violation.sourceNodeId,
      );

      for (const support of contradictingSupports) {
        const violatingNode = nodeMap.get(violation.sourceNodeId);
        const supportingNode = nodeMap.get(support.sourceNodeId);
        const policyNode = nodeMap.get(violation.targetNodeId);

        if (!violatingNode || !supportingNode || !policyNode) continue;

        const factors: ConflictScoringFactors = {
          temporalContradictionStrength: 0.4,
          evidenceReliability: (violation.confidence + support.confidence) / 2,
          policyViolationWeight: 0.9,
          supportingSourceCount: 2,
        };

        const severity = this.scoringEngine.computeSeverity(
          this.scoringEngine.adjustFactorsForType(factors, 'policy_violation'),
        );

        const id = createHash('sha256')
          .update(`policy:${violation.sourceNodeId}:${support.sourceNodeId}:${violation.targetNodeId}:${tenantId}`)
          .digest('hex')
          .slice(0, 16);

        conflicts.push({
          id: `conflict-${id}`,
          conflictType: 'policy_violation',
          description:
            `Policy conflict: "${violatingNode.name}" violates "${policyNode.name}" ` +
            `but "${supportingNode.name}" supports compliance`,
          severity,
          sourceNodeIds: [violation.sourceNodeId],
          targetNodeIds: [support.sourceNodeId, violation.targetNodeId],
          evidenceIds: [violation.sourceNodeId, support.sourceNodeId],
          tenantId,
          sourceDocumentIds: [
            violatingNode.sourceDocumentId,
            supportingNode.sourceDocumentId,
          ].filter((v, i, a) => a.indexOf(v) === i),
          detectedAt: new Date(),
        });
      }
    }

    return conflicts;
  }

  // -----------------------------------------------------------------------
  // Stage 5: Legal Claim Conflicts
  // -----------------------------------------------------------------------

  /**
   * Detect conflicts between legal claims by finding LegalClaim nodes
   * that have contradictory relationships to the same evidence.
   */
  private detectLegalClaimConflictsFromGraph(
    nodes: GraphNode[],
    relationships: GraphRelationship[],
    tenantId: string,
  ): DetectedConflict[] {
    const conflicts: DetectedConflict[] = [];
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    const legalClaims = nodes.filter(n => n.type === 'LegalClaim');

    for (let i = 0; i < legalClaims.length; i++) {
      for (let j = i + 1; j < legalClaims.length; j++) {
        const claimA = legalClaims[i];
        const claimB = legalClaims[j];

        // Find relationships from each claim
        const relsA = relationships.filter(r => r.sourceNodeId === claimA.id);
        const relsB = relationships.filter(r => r.sourceNodeId === claimB.id);

        // Check if they reference the same evidence with contradictory relationship types
        for (const relA of relsA) {
          for (const relB of relsB) {
            if (relA.targetNodeId !== relB.targetNodeId) continue;

            const isContradictory =
              (relA.type === 'SUPPORTS' && relB.type === 'REFUTES') ||
              (relA.type === 'REFUTES' && relB.type === 'SUPPORTS') ||
              (relA.type === 'ESTABLISHES' && relB.type === 'CONTRADICTS') ||
              (relA.type === 'CONTRADICTS' && relB.type === 'ESTABLISHES');

            if (!isContradictory) continue;

            const sharedTarget = nodeMap.get(relA.targetNodeId);
            if (!sharedTarget) continue;

            const factors: ConflictScoringFactors = {
              temporalContradictionStrength: 0.5,
              evidenceReliability: (relA.confidence + relB.confidence) / 2,
              policyViolationWeight: 0.7,
              supportingSourceCount: 2,
            };

            const severity = this.scoringEngine.computeSeverity(
              this.scoringEngine.adjustFactorsForType(factors, 'legal_claim'),
            );

            const id = createHash('sha256')
              .update(`legal:${claimA.id}:${claimB.id}:${relA.targetNodeId}:${tenantId}`)
              .digest('hex')
              .slice(0, 16);

            conflicts.push({
              id: `conflict-${id}`,
              conflictType: 'legal_claim',
              description:
                `Legal claim conflict: "${claimA.name}" and "${claimB.name}" make ` +
                `contradictory assertions about "${sharedTarget.name}"`,
              severity,
              sourceNodeIds: [claimA.id],
              targetNodeIds: [claimB.id, relA.targetNodeId],
              evidenceIds: [relA.targetNodeId],
              tenantId,
              sourceDocumentIds: [
                claimA.sourceDocumentId,
                claimB.sourceDocumentId,
              ].filter((v, i, a) => a.indexOf(v) === i),
              detectedAt: new Date(),
            });
          }
        }
      }
    }

    return conflicts;
  }
}
