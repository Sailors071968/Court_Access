// ============================================
// Court Access — Evidence Indexer
// Orchestrates the evidence relationship pipeline:
// extract -> embed -> score -> insert/candidate.
// ============================================

import type { GraphNode } from '../graph/types.ts';
import type {
  EvidenceLinkingResult,
  EvidenceIndexingSummary,
  EvidenceRelationship,
} from './types.ts';
import type { EvidenceLinker } from './evidenceLinker.ts';

// ---------------------------------------------------------------------------
// EvidenceIndexer Configuration
// ---------------------------------------------------------------------------

export interface EvidenceIndexerConfig {
  /** Maximum evidence nodes to process per batch */
  batchSize: number;
  /** Maximum concurrent link evaluations */
  concurrency: number;
}

const DEFAULT_CONFIG: Readonly<EvidenceIndexerConfig> = {
  batchSize: 50,
  concurrency: 5,
} as const;

// ---------------------------------------------------------------------------
// Node Provider — abstraction over graph query layer
// ---------------------------------------------------------------------------

export interface NodeProvider {
  /** Retrieve all evidence nodes for a tenant */
  getEvidenceNodes(tenantId: string): Promise<GraphNode[]>;
  /** Retrieve all non-evidence nodes for a tenant (potential link targets) */
  getTargetNodes(tenantId: string): Promise<GraphNode[]>;
  /** Get source document text for a given document ID */
  getDocumentText(documentId: string): Promise<string>;
  /** Persist a scored relationship into the graph */
  insertRelationship(relationship: EvidenceRelationship): Promise<void>;
}

// ---------------------------------------------------------------------------
// EvidenceIndexer
// ---------------------------------------------------------------------------

export class EvidenceIndexer {
  private readonly linker: EvidenceLinker;
  private readonly nodeProvider: NodeProvider;
  private readonly config: EvidenceIndexerConfig;

  constructor(
    linker: EvidenceLinker,
    nodeProvider: NodeProvider,
    config?: Partial<EvidenceIndexerConfig>,
  ) {
    this.linker = linker;
    this.nodeProvider = nodeProvider;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Run the full evidence indexing pipeline for a tenant.
   * 1. Fetch all evidence nodes and target nodes
   * 2. For each evidence node, score relationships to all targets
   * 3. Insert high-confidence relationships into the graph
   * 4. Store low-confidence relationships as candidates
   */
  async indexTenant(tenantId: string): Promise<EvidenceIndexingSummary> {
    const startTime = Date.now();
    const errors: Array<{ evidenceNodeId: string; error: string }> = [];

    // 1. Fetch nodes
    const [evidenceNodes, targetNodes] = await Promise.all([
      this.nodeProvider.getEvidenceNodes(tenantId),
      this.nodeProvider.getTargetNodes(tenantId),
    ]);

    if (evidenceNodes.length === 0 || targetNodes.length === 0) {
      return this.buildSummary(0, 0, 0, 0, [], [], Date.now() - startTime, errors);
    }

    // 2. Process in batches
    const allResults: EvidenceLinkingResult[] = [];

    for (let i = 0; i < evidenceNodes.length; i += this.config.batchSize) {
      const batch = evidenceNodes.slice(i, i + this.config.batchSize);
      const batchResults = await this.processBatch(
        batch,
        targetNodes,
        tenantId,
        errors,
      );
      allResults.push(...batchResults);
    }

    // 3. Aggregate results
    const allInserted = allResults.flatMap((r) => r.insertedRelationships);
    const allCandidates = allResults.flatMap((r) => r.candidateRelationships);
    const totalEvaluated = allResults.reduce((sum, r) => sum + r.totalEvaluated, 0);

    return this.buildSummary(
      evidenceNodes.length,
      totalEvaluated,
      allInserted.length,
      allCandidates.length,
      allInserted,
      allCandidates,
      Date.now() - startTime,
      errors,
    );
  }

  /**
   * Index a single evidence node against all target nodes.
   */
  async indexSingleEvidence(
    evidenceNode: GraphNode,
    tenantId: string,
  ): Promise<EvidenceLinkingResult> {
    const targetNodes = await this.nodeProvider.getTargetNodes(tenantId);
    const sourceText = await this.nodeProvider.getDocumentText(
      evidenceNode.sourceDocumentId,
    );

    const result = await this.linker.linkEvidenceBatch({
      evidenceNode,
      targetNodes,
      sourceText,
      tenantId,
      sourceDocumentId: evidenceNode.sourceDocumentId,
    });

    // Persist high-confidence relationships
    for (const rel of result.insertedRelationships) {
      await this.nodeProvider.insertRelationship(rel);
    }

    return result;
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private async processBatch(
    evidenceNodes: GraphNode[],
    targetNodes: GraphNode[],
    tenantId: string,
    errors: Array<{ evidenceNodeId: string; error: string }>,
  ): Promise<EvidenceLinkingResult[]> {
    const results: EvidenceLinkingResult[] = [];

    // Process with limited concurrency
    const queue = [...evidenceNodes];
    const running: Array<Promise<void>> = [];

    const processOne = async (node: GraphNode): Promise<void> => {
      try {
        const sourceText = await this.nodeProvider.getDocumentText(
          node.sourceDocumentId,
        );

        const result = await this.linker.linkEvidenceBatch({
          evidenceNode: node,
          targetNodes,
          sourceText,
          tenantId,
          sourceDocumentId: node.sourceDocumentId,
        });

        // Persist high-confidence relationships
        for (const rel of result.insertedRelationships) {
          await this.nodeProvider.insertRelationship(rel);
        }

        results.push(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push({ evidenceNodeId: node.id, error: message });
      }
    };

    for (const node of queue) {
      const p = processOne(node);
      running.push(p);

      if (running.length >= this.config.concurrency) {
        await Promise.race(running);
        // Remove settled promises
        for (let i = running.length - 1; i >= 0; i--) {
          const settled = await Promise.race([
            running[i].then(() => true),
            Promise.resolve(false),
          ]);
          if (settled) running.splice(i, 1);
        }
      }
    }

    // Wait for remaining
    await Promise.allSettled(running);

    return results;
  }

  private buildSummary(
    totalEvidenceNodes: number,
    totalRelationshipsEvaluated: number,
    totalRelationshipsInserted: number,
    totalCandidatesStored: number,
    inserted: EvidenceRelationship[],
    candidates: EvidenceRelationship[],
    totalDurationMs: number,
    errors: Array<{ evidenceNodeId: string; error: string }>,
  ): EvidenceIndexingSummary {
    const avgInserted =
      inserted.length > 0
        ? inserted.reduce((sum, r) => sum + r.score.score, 0) / inserted.length
        : 0;

    const avgCandidate =
      candidates.length > 0
        ? candidates.reduce((sum, r) => sum + r.score.score, 0) / candidates.length
        : 0;

    return {
      totalEvidenceNodes,
      totalRelationshipsEvaluated,
      totalRelationshipsInserted,
      totalCandidatesStored,
      averageInsertedScore: avgInserted,
      averageCandidateScore: avgCandidate,
      totalDurationMs,
      errors,
    };
  }
}
