// ============================================
// Court Access — Conflict Graph Integrator
// Inserts Conflict nodes and relationships
// (CONTRADICTS, INVALIDATES, WEAKENS, SUPPORTS)
// into the Neo4j knowledge graph.
// ============================================

import { createHash } from 'node:crypto';
import type {
  DetectedConflict,
  ConflictGraphInsertionResult,
  ConflictRelationshipType,
  GraphNode,
  GraphRelationship,
  GraphNodeType,
  GraphRelationshipType,
} from './types.ts';
import type { Neo4jSession } from '../graph/types.ts';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface ConflictGraphIntegratorConfig {
  /** Minimum severity score to insert into graph (skip low-severity conflicts) */
  minSeverityForInsertion: number;
  /** Whether to create SUPPORTS relationships for corroborating evidence */
  createSupportsRelationships: boolean;
  /** Batch size for Cypher operations */
  batchSize: number;
}

const DEFAULT_CONFIG: ConflictGraphIntegratorConfig = {
  minSeverityForInsertion: 0.3,
  createSupportsRelationships: true,
  batchSize: 50,
};

// ---------------------------------------------------------------------------
// Conflict-to-Relationship Type Mapping
// ---------------------------------------------------------------------------

/**
 * Determine the relationship type based on conflict severity.
 * - critical/high → CONTRADICTS or INVALIDATES
 * - medium → WEAKENS
 * - low → WEAKENS (if above insertion threshold)
 */
function conflictToRelationshipType(
  severity: number,
): ConflictRelationshipType {
  if (severity >= 0.85) return 'INVALIDATES';
  if (severity >= 0.65) return 'CONTRADICTS';
  return 'WEAKENS';
}

// ---------------------------------------------------------------------------
// Conflict Graph Integrator
// ---------------------------------------------------------------------------

export class ConflictGraphIntegrator {
  private readonly config: ConflictGraphIntegratorConfig;

  constructor(config?: Partial<ConflictGraphIntegratorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Insert detected conflicts into the graph as Conflict nodes
   * with appropriate relationships to source and target nodes.
   */
  async insertConflicts(
    conflicts: DetectedConflict[],
    session: Neo4jSession,
  ): Promise<ConflictGraphInsertionResult> {
    const startTime = Date.now();
    const insertedConflictIds: string[] = [];
    let conflictNodesCreated = 0;
    let relationshipsCreated = 0;

    // Filter by minimum severity
    const eligible = conflicts.filter(
      c => c.severity.severityScore >= this.config.minSeverityForInsertion,
    );

    // Process in batches
    for (let i = 0; i < eligible.length; i += this.config.batchSize) {
      const batch = eligible.slice(i, i + this.config.batchSize);

      for (const conflict of batch) {
        // 1. Create Conflict node
        const nodeCreated = await this.createConflictNode(conflict, session);
        if (nodeCreated) {
          conflictNodesCreated++;
          insertedConflictIds.push(conflict.id);
        }

        // 2. Create relationships from Conflict to source nodes
        for (const sourceNodeId of conflict.sourceNodeIds) {
          const relType = conflictToRelationshipType(
            conflict.severity.severityScore,
          );
          const created = await this.createConflictRelationship(
            conflict.id,
            sourceNodeId,
            relType,
            conflict.tenantId,
            conflict.severity.severityScore,
            conflict.severity.factors,
            session,
          );
          if (created) relationshipsCreated++;
        }

        // 3. Create relationships from Conflict to target nodes
        for (const targetNodeId of conflict.targetNodeIds) {
          const relType = conflictToRelationshipType(
            conflict.severity.severityScore,
          );
          const created = await this.createConflictRelationship(
            conflict.id,
            targetNodeId,
            relType,
            conflict.tenantId,
            conflict.severity.severityScore,
            conflict.severity.factors,
            session,
          );
          if (created) relationshipsCreated++;
        }
      }
    }

    return {
      conflictNodesCreated,
      relationshipsCreated,
      insertedConflictIds,
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Build a Conflict GraphNode from a DetectedConflict (for testing/inspection).
   */
  buildConflictNode(conflict: DetectedConflict): GraphNode {
    return {
      id: conflict.id,
      type: 'Conflict' as GraphNodeType,
      name: `${conflict.conflictType} conflict`,
      properties: {
        conflictType: conflict.conflictType,
        description: conflict.description,
        severityScore: conflict.severity.severityScore,
        severity: conflict.severity.severity,
        temporalContradictionStrength: conflict.severity.factors.temporalContradictionStrength,
        evidenceReliability: conflict.severity.factors.evidenceReliability,
        policyViolationWeight: conflict.severity.factors.policyViolationWeight,
        supportingSourceCount: conflict.severity.factors.supportingSourceCount,
      },
      sourceDocumentId: conflict.sourceDocumentIds[0] ?? '',
      tenantId: conflict.tenantId,
      createdAt: conflict.detectedAt,
    };
  }

  /**
   * Build a conflict GraphRelationship (for testing/inspection).
   */
  buildConflictRelationship(
    conflictId: string,
    targetNodeId: string,
    relType: ConflictRelationshipType,
    tenantId: string,
    severityScore: number,
    factors: DetectedConflict['severity']['factors'],
  ): GraphRelationship {
    const id = createHash('sha256')
      .update(`${conflictId}:${targetNodeId}:${relType}:${tenantId}`)
      .digest('hex')
      .slice(0, 16);

    return {
      id: `rel-${id}`,
      type: relType as GraphRelationshipType,
      sourceNodeId: conflictId,
      targetNodeId,
      confidence: severityScore,
      confidenceScore: severityScore,
      scoringFactors: {
        temporalContradiction: factors.temporalContradictionStrength,
        evidenceReliability: factors.evidenceReliability,
        policyViolationWeight: factors.policyViolationWeight,
        supportingSourceCount: factors.supportingSourceCount,
      },
      properties: {
        conflictRelation: true,
      },
      sourceDocumentId: '',
      tenantId,
      createdAt: new Date(),
    };
  }

  // -----------------------------------------------------------------------
  // Private — Neo4j Operations
  // -----------------------------------------------------------------------

  /**
   * Create a Conflict node in Neo4j.
   */
  private async createConflictNode(
    conflict: DetectedConflict,
    session: Neo4jSession,
  ): Promise<boolean> {
    const cypher = `
      MERGE (c:Conflict {id: $id, tenantId: $tenantId})
      ON CREATE SET
        c.conflictType = $conflictType,
        c.description = $description,
        c.severityScore = $severityScore,
        c.severity = $severity,
        c.temporalContradictionStrength = $temporalContradictionStrength,
        c.evidenceReliability = $evidenceReliability,
        c.policyViolationWeight = $policyViolationWeight,
        c.supportingSourceCount = $supportingSourceCount,
        c.detectedAt = datetime($detectedAt),
        c._created = true
      ON MATCH SET
        c._created = false
      WITH c, c._created AS created
      REMOVE c._created
      RETURN created
    `;

    const result = await session.run(cypher, {
      id: conflict.id,
      tenantId: conflict.tenantId,
      conflictType: conflict.conflictType,
      description: conflict.description,
      severityScore: conflict.severity.severityScore,
      severity: conflict.severity.severity,
      temporalContradictionStrength: conflict.severity.factors.temporalContradictionStrength,
      evidenceReliability: conflict.severity.factors.evidenceReliability,
      policyViolationWeight: conflict.severity.factors.policyViolationWeight,
      supportingSourceCount: conflict.severity.factors.supportingSourceCount,
      detectedAt: conflict.detectedAt.toISOString(),
    });

    if (result.records.length > 0) {
      const created = result.records[0].get('created');
      return !!created;
    }
    return true;
  }

  /**
   * Create a relationship from a Conflict node to another node.
   */
  private async createConflictRelationship(
    conflictId: string,
    targetNodeId: string,
    relType: ConflictRelationshipType,
    tenantId: string,
    severityScore: number,
    factors: DetectedConflict['severity']['factors'],
    session: Neo4jSession,
  ): Promise<boolean> {
    // Use MERGE to avoid duplicates
    // Note: relationship type must be interpolated since Cypher doesn't support parameterized types
    // We validate relType is in our whitelist before interpolation
    const allowedTypes: ReadonlySet<string> = new Set(['CONTRADICTS', 'INVALIDATES', 'WEAKENS', 'SUPPORTS']);
    if (!allowedTypes.has(relType)) {
      throw new Error(`Invalid conflict relationship type: ${relType}`);
    }

    const cypher = `
      MATCH (c:Conflict {id: $conflictId, tenantId: $tenantId})
      MATCH (t {id: $targetNodeId, tenantId: $tenantId})
      MERGE (c)-[r:${relType}]->(t)
      ON CREATE SET
        r.confidence = $confidence,
        r.confidenceScore = $confidenceScore,
        r.temporalContradiction = $temporalContradiction,
        r.evidenceReliability = $evidenceReliability,
        r.policyViolationWeight = $policyViolationWeight,
        r.supportingSourceCount = $supportingSourceCount,
        r.createdAt = datetime()
      RETURN r
    `;

    const result = await session.run(cypher, {
      conflictId,
      targetNodeId,
      tenantId,
      confidence: severityScore,
      confidenceScore: severityScore,
      temporalContradiction: factors.temporalContradictionStrength,
      evidenceReliability: factors.evidenceReliability,
      policyViolationWeight: factors.policyViolationWeight,
      supportingSourceCount: factors.supportingSourceCount,
    });

    return result.records.length > 0;
  }
}
