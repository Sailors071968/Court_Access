// ============================================
// Court Access — Graph Indexer
// Orchestrates document-to-graph indexing pipeline:
// document → entity extraction → relationship detection → graph insert
// ============================================

import { Neo4jClient } from './neo4jClient.ts';
import { GraphEntityExtractor } from './graphEntityExtractor.ts';
import { GraphRelationshipBuilder } from './graphRelationshipBuilder.ts';
import type {
  DocumentExtractionResult,
  GraphIndexingResult,
  BatchIndexingSummary,
} from './types.ts';

// ---------------------------------------------------------------------------
// Document Input (from LegalDocument table)
// ---------------------------------------------------------------------------

export interface DocumentInput {
  id: string;
  tenantId: string;
  content: string;
  documentType: string;
  title: string;
}

// ---------------------------------------------------------------------------
// Graph Indexer
// ---------------------------------------------------------------------------

export class GraphIndexer {
  private readonly extractor: GraphEntityExtractor;
  private readonly relationshipBuilder: GraphRelationshipBuilder;

  constructor(
    private readonly neo4jClient: Neo4jClient,
    extractor?: GraphEntityExtractor,
    relationshipBuilder?: GraphRelationshipBuilder,
  ) {
    this.extractor = extractor ?? new GraphEntityExtractor();
    this.relationshipBuilder = relationshipBuilder ?? new GraphRelationshipBuilder();
  }

  /**
   * Index a single document into the knowledge graph.
   */
  async indexDocument(document: DocumentInput): Promise<GraphIndexingResult> {
    // Step 1: Extract entities and relationships
    const extraction = this.extractor.extract(
      document.id,
      document.tenantId,
      document.content,
      document.documentType,
    );

    // Step 2: Build graph nodes and relationships in Neo4j
    const session = this.neo4jClient.session();
    try {
      return await this.relationshipBuilder.buildGraph(session, extraction);
    } finally {
      await session.close();
    }
  }

  /**
   * Index a batch of documents into the knowledge graph.
   * Processes documents sequentially to avoid Neo4j write contention.
   */
  async indexBatch(documents: DocumentInput[]): Promise<BatchIndexingSummary> {
    const start = performance.now();
    let totalNodesCreated = 0;
    let totalNodesReused = 0;
    let totalRelationshipsCreated = 0;
    let failedDocuments = 0;
    const errors: Array<{ documentId: string; error: string }> = [];

    for (const document of documents) {
      try {
        const result = await this.indexDocument(document);
        totalNodesCreated += result.nodesCreated;
        totalNodesReused += result.nodesReused;
        totalRelationshipsCreated += result.relationshipsCreated;
      } catch (err) {
        failedDocuments++;
        errors.push({
          documentId: document.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return {
      totalDocuments: documents.length,
      totalNodesCreated,
      totalNodesReused,
      totalRelationshipsCreated,
      totalDurationMs: Math.round(performance.now() - start),
      failedDocuments,
      errors,
    };
  }

  /**
   * Extract entities and relationships without persisting to Neo4j.
   * Useful for dry-run mode, testing, or previewing extraction results.
   */
  extractOnly(document: DocumentInput): DocumentExtractionResult {
    return this.extractor.extract(
      document.id,
      document.tenantId,
      document.content,
      document.documentType,
    );
  }

  /**
   * Generate Cypher queries for a document without executing them.
   * Useful for auditing and debugging.
   */
  generateQueries(
    document: DocumentInput,
  ): Array<{ query: string; parameters: Record<string, unknown> }> {
    const extraction = this.extractor.extract(
      document.id,
      document.tenantId,
      document.content,
      document.documentType,
    );
    return this.relationshipBuilder.buildCypherQueries(extraction);
  }

  /**
   * Get statistics about the current graph state.
   */
  async getGraphStats(tenantId: string): Promise<{
    totalNodes: number;
    totalRelationships: number;
    nodesByType: Record<string, number>;
    relationshipsByType: Record<string, number>;
  }> {
    const nodeCountResult = await this.neo4jClient.execute(
      'MATCH (n {tenantId: $tenantId}) RETURN labels(n)[0] AS type, count(n) AS count',
      { tenantId },
    );

    const relCountResult = await this.neo4jClient.execute(
      'MATCH ({tenantId: $tenantId})-[r]->() RETURN type(r) AS type, count(r) AS count',
      { tenantId },
    );

    const nodesByType: Record<string, number> = {};
    let totalNodes = 0;
    for (const record of nodeCountResult.records) {
      const type = record['type'] as string;
      const count = record['count'] as number;
      nodesByType[type] = count;
      totalNodes += count;
    }

    const relationshipsByType: Record<string, number> = {};
    let totalRelationships = 0;
    for (const record of relCountResult.records) {
      const type = record['type'] as string;
      const count = record['count'] as number;
      relationshipsByType[type] = count;
      totalRelationships += count;
    }

    return { totalNodes, totalRelationships, nodesByType, relationshipsByType };
  }
}
