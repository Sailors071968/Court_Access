// ============================================
// Court Access — Evidence Linker
// Links evidence nodes to statutes, policies,
// case law, and other graph entities using
// deterministic multi-factor scoring.
// ============================================

import type {
  GraphNode,
  GraphRelationshipType,
  ExtractedEntity,
} from '../graph/types.ts';
import type {
  EvidenceRelationship,
  EvidenceLinkingRequest,
  EvidenceLinkingResult,
  RelationshipScore,
} from './types.ts';
import type { RelationshipScorer } from './relationshipScorer.ts';
import type { RelationshipCandidateStore } from './relationshipCandidateStore.ts';

// ---------------------------------------------------------------------------
// Relationship type inference rules
// ---------------------------------------------------------------------------

const RELATIONSHIP_INFERENCE_RULES: ReadonlyArray<{
  evidenceType: string;
  targetType: string;
  defaultRelType: GraphRelationshipType;
}> = [
  { evidenceType: 'Evidence', targetType: 'Statute', defaultRelType: 'VIOLATES' },
  { evidenceType: 'Evidence', targetType: 'Policy', defaultRelType: 'VIOLATES' },
  { evidenceType: 'Evidence', targetType: 'CaseLaw', defaultRelType: 'REFERENCES' },
  { evidenceType: 'Evidence', targetType: 'Person', defaultRelType: 'MENTIONS' },
  { evidenceType: 'Evidence', targetType: 'Officer', defaultRelType: 'MENTIONS' },
  { evidenceType: 'Evidence', targetType: 'Agency', defaultRelType: 'REFERENCES' },
  { evidenceType: 'Evidence', targetType: 'Event', defaultRelType: 'ESTABLISHES' },
  { evidenceType: 'Evidence', targetType: 'LegalClaim', defaultRelType: 'SUPPORTS' },
];

// ---------------------------------------------------------------------------
// EvidenceLinker
// ---------------------------------------------------------------------------

export class EvidenceLinker {
  private readonly scorer: RelationshipScorer;
  private readonly candidateStore: RelationshipCandidateStore;

  constructor(
    scorer: RelationshipScorer,
    candidateStore: RelationshipCandidateStore,
  ) {
    this.scorer = scorer;
    this.candidateStore = candidateStore;
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Evaluate and link an evidence node to candidate target nodes.
   * Relationships scoring >= threshold are marked for graph insertion.
   * Below-threshold relationships are stored as review candidates.
   */
  async linkEvidence(
    request: EvidenceLinkingRequest,
  ): Promise<EvidenceLinkingResult> {
    const startTime = Date.now();
    const { evidenceNode, targetNodes, sourceText, tenantId, sourceDocumentId } = request;

    const insertedRelationships: EvidenceRelationship[] = [];
    const candidateRelationships: EvidenceRelationship[] = [];

    // Build extracted entity representations for scoring
    const evidenceEntity = this.nodeToExtractedEntity(evidenceNode, sourceText);

    for (const targetNode of targetNodes) {
      // Skip self-links
      if (targetNode.id === evidenceNode.id) continue;

      const targetEntity = this.nodeToExtractedEntity(targetNode, sourceText);
      const relationshipType = this.inferRelationshipType(evidenceNode, targetNode);

      const score = await this.scorer.scoreRelationship(
        evidenceNode.name,
        targetNode.name,
        sourceText,
        evidenceEntity,
        targetEntity,
        tenantId,
      );

      const relationship = this.buildEvidenceRelationship(
        evidenceNode,
        targetNode,
        relationshipType,
        score,
        tenantId,
        sourceDocumentId,
      );

      if (score.meetsThreshold) {
        insertedRelationships.push(relationship);
      } else {
        candidateRelationships.push(relationship);
        this.candidateStore.store(relationship);
      }
    }

    return {
      evidenceNodeId: evidenceNode.id,
      insertedRelationships,
      candidateRelationships,
      totalEvaluated: targetNodes.length,
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Batch-link an evidence node to multiple targets using bulk scoring.
   * More efficient than individual linkEvidence calls due to batch embedding.
   */
  async linkEvidenceBatch(
    request: EvidenceLinkingRequest,
  ): Promise<EvidenceLinkingResult> {
    const startTime = Date.now();
    const { evidenceNode, targetNodes, sourceText, tenantId, sourceDocumentId } = request;

    const insertedRelationships: EvidenceRelationship[] = [];
    const candidateRelationships: EvidenceRelationship[] = [];

    // Filter self-links
    const validTargets = targetNodes.filter((t) => t.id !== evidenceNode.id);
    if (validTargets.length === 0) {
      return {
        evidenceNodeId: evidenceNode.id,
        insertedRelationships: [],
        candidateRelationships: [],
        totalEvaluated: 0,
        durationMs: Date.now() - startTime,
      };
    }

    // Build entity representations
    const evidenceEntity = this.nodeToExtractedEntity(evidenceNode, sourceText);
    const targets = validTargets.map((targetNode) => ({
      targetText: targetNode.name,
      sourceText,
      evidenceEntity,
      targetEntity: this.nodeToExtractedEntity(targetNode, sourceText),
    }));

    // Bulk score
    const scores = await this.scorer.scoreRelationships(
      evidenceNode.name,
      targets,
      tenantId,
    );

    // Partition by threshold
    for (let i = 0; i < validTargets.length; i++) {
      const targetNode = validTargets[i];
      const score = scores[i];
      const relationshipType = this.inferRelationshipType(evidenceNode, targetNode);

      const relationship = this.buildEvidenceRelationship(
        evidenceNode,
        targetNode,
        relationshipType,
        score,
        tenantId,
        sourceDocumentId,
      );

      if (score.meetsThreshold) {
        insertedRelationships.push(relationship);
      } else {
        candidateRelationships.push(relationship);
        this.candidateStore.store(relationship);
      }
    }

    return {
      evidenceNodeId: evidenceNode.id,
      insertedRelationships,
      candidateRelationships,
      totalEvaluated: validTargets.length,
      durationMs: Date.now() - startTime,
    };
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /**
   * Infer the most likely relationship type between an evidence node
   * and a target node based on their types.
   */
  private inferRelationshipType(
    evidenceNode: GraphNode,
    targetNode: GraphNode,
  ): GraphRelationshipType {
    const rule = RELATIONSHIP_INFERENCE_RULES.find(
      (r) =>
        r.evidenceType === evidenceNode.type &&
        r.targetType === targetNode.type,
    );
    return rule?.defaultRelType ?? 'REFERENCES';
  }

  /**
   * Convert a GraphNode to an ExtractedEntity for scoring.
   * Uses the node's name to find offsets in the source text.
   */
  private nodeToExtractedEntity(
    node: GraphNode,
    sourceText: string,
  ): ExtractedEntity {
    const offsets = this.findOffsets(node.name, sourceText);
    const firstOffset = offsets[0] ?? { start: 0, end: 0 };

    return {
      type: node.type,
      name: node.name,
      canonicalName: node.name.toLowerCase().trim(),
      properties: node.properties,
      startOffset: firstOffset.start,
      endOffset: firstOffset.end,
      offsets,
    };
  }

  /**
   * Find all character offsets of a name within source text (case-insensitive).
   */
  private findOffsets(
    name: string,
    sourceText: string,
  ): Array<{ start: number; end: number }> {
    const offsets: Array<{ start: number; end: number }> = [];
    const lowerSource = sourceText.toLowerCase();
    const lowerName = name.toLowerCase();

    if (lowerName.length === 0) return offsets;

    let pos = 0;
    while (pos < lowerSource.length) {
      const idx = lowerSource.indexOf(lowerName, pos);
      if (idx === -1) break;
      offsets.push({ start: idx, end: idx + lowerName.length });
      pos = idx + 1;
    }

    return offsets;
  }

  /**
   * Build an EvidenceRelationship from scoring results.
   */
  private buildEvidenceRelationship(
    evidenceNode: GraphNode,
    targetNode: GraphNode,
    relationshipType: GraphRelationshipType,
    score: RelationshipScore,
    tenantId: string,
    sourceDocumentId: string,
  ): EvidenceRelationship {
    return {
      evidenceNodeId: evidenceNode.id,
      targetNodeId: targetNode.id,
      targetNodeType: targetNode.type,
      relationshipType,
      score,
      tenantId,
      sourceDocumentId,
      scoredAt: new Date(),
    };
  }
}
