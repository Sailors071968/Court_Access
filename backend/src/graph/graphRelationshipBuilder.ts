// ============================================
// Court Access — Graph Relationship Builder
// Converts extracted entities and relationships into
// Neo4j-ready Cypher operations for graph construction.
// ============================================

import { GraphEntityExtractor } from './graphEntityExtractor.ts';
import type {
  ExtractedRelationship,
  DocumentExtractionResult,
  GraphIndexingResult,
  Neo4jSession,
} from './types.ts';

// ---------------------------------------------------------------------------
// Relationship Builder
// ---------------------------------------------------------------------------

export class GraphRelationshipBuilder {

  /**
   * Build graph nodes and relationships from extraction results
   * and persist them to Neo4j.
   */
  async buildGraph(
    session: Neo4jSession,
    extraction: DocumentExtractionResult,
  ): Promise<GraphIndexingResult> {
    const start = performance.now();
    let nodesCreated = 0;
    let nodesReused = 0;
    let relationshipsCreated = 0;

    // Step 1: Upsert all nodes (MERGE ensures dedup)
    for (const entity of extraction.entities) {
      const nodeId = GraphEntityExtractor.generateEntityId(
        entity.type,
        entity.canonicalName,
        extraction.tenantId,
      );

      const result = await this.upsertNode(session, {
        id: nodeId,
        type: entity.type,
        name: entity.name,
        canonicalName: entity.canonicalName,
        properties: entity.properties,
        sourceDocumentId: extraction.documentId,
        tenantId: extraction.tenantId,
      });

      if (result === 'created') {
        nodesCreated++;
      } else {
        nodesReused++;
      }
    }

    // Step 2: Create relationships between nodes
    for (const rel of extraction.relationships) {
      const created = await this.createRelationship(session, rel, extraction);
      if (created) {
        relationshipsCreated++;
      }
    }

    const durationMs = Math.round(performance.now() - start);

    return {
      documentId: extraction.documentId,
      nodesCreated,
      nodesReused,
      relationshipsCreated,
      durationMs,
    };
  }

  /**
   * Upsert a node into Neo4j using MERGE (create if not exists, update if exists).
   */
  private async upsertNode(
    session: Neo4jSession,
    node: {
      id: string;
      type: string;
      name: string;
      canonicalName: string;
      properties: Record<string, string | number | boolean | null>;
      sourceDocumentId: string;
      tenantId: string;
    },
  ): Promise<'created' | 'reused'> {
    const query = `
      MERGE (n:${node.type} {id: $id})
      ON CREATE SET
        n.name = $name,
        n.canonicalName = $canonicalName,
        n.tenantId = $tenantId,
        n.sourceDocumentId = $sourceDocumentId,
        n.properties = $properties,
        n.createdAt = datetime(),
        n._created = true
      ON MATCH SET
        n._created = false
      RETURN n._created AS created
    `;

    const result = await session.run(query, {
      id: node.id,
      name: node.name,
      canonicalName: node.canonicalName,
      tenantId: node.tenantId,
      sourceDocumentId: node.sourceDocumentId,
      properties: JSON.stringify(node.properties),
    });

    if (result.records.length > 0) {
      const created = result.records[0].get('created');
      return created ? 'created' : 'reused';
    }
    return 'created';
  }

  /**
   * Create a relationship between two nodes.
   */
  private async createRelationship(
    session: Neo4jSession,
    rel: ExtractedRelationship,
    extraction: DocumentExtractionResult,
  ): Promise<boolean> {
    // Find the source and target entities to get their node IDs
    // Use both canonicalName AND entity type to avoid collisions
    // (e.g., Officer "brown" vs Person "brown")
    const sourceEntity = extraction.entities.find(
      e => e.canonicalName === rel.sourceEntityName && e.type === rel.sourceEntityType,
    ) ?? extraction.entities.find(
      e => e.canonicalName === rel.sourceEntityName,
    );
    const targetEntity = extraction.entities.find(
      e => e.canonicalName === rel.targetEntityName && e.type === rel.targetEntityType,
    ) ?? extraction.entities.find(
      e => e.canonicalName === rel.targetEntityName,
    );

    if (!sourceEntity || !targetEntity) return false;

    const sourceId = GraphEntityExtractor.generateEntityId(
      sourceEntity.type,
      sourceEntity.canonicalName,
      extraction.tenantId,
    );
    const targetId = GraphEntityExtractor.generateEntityId(
      targetEntity.type,
      targetEntity.canonicalName,
      extraction.tenantId,
    );

    const query = `
      MATCH (source {id: $sourceId})
      MATCH (target {id: $targetId})
      MERGE (source)-[r:${rel.type} {sourceDocumentId: $sourceDocumentId}]->(target)
      ON CREATE SET
        r.confidence = $confidence,
        r.tenantId = $tenantId,
        r.properties = $properties,
        r.createdAt = datetime()
      RETURN r
    `;

    try {
      const result = await session.run(query, {
        sourceId,
        targetId,
        sourceDocumentId: extraction.documentId,
        tenantId: extraction.tenantId,
        confidence: rel.confidence,
        properties: JSON.stringify(rel.properties),
      });
      return result.records.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Build Cypher queries for batch execution without running them.
   * Useful for dry-run mode or bulk operations.
   */
  buildCypherQueries(
    extraction: DocumentExtractionResult,
  ): Array<{ query: string; parameters: Record<string, unknown> }> {
    const queries: Array<{ query: string; parameters: Record<string, unknown> }> = [];

    // Node upsert queries
    for (const entity of extraction.entities) {
      const nodeId = GraphEntityExtractor.generateEntityId(
        entity.type,
        entity.canonicalName,
        extraction.tenantId,
      );

      queries.push({
        query: `
          MERGE (n:${entity.type} {id: $id})
          ON CREATE SET
            n.name = $name,
            n.canonicalName = $canonicalName,
            n.tenantId = $tenantId,
            n.sourceDocumentId = $sourceDocumentId,
            n.properties = $properties,
            n.createdAt = datetime()
        `,
        parameters: {
          id: nodeId,
          name: entity.name,
          canonicalName: entity.canonicalName,
          tenantId: extraction.tenantId,
          sourceDocumentId: extraction.documentId,
          properties: JSON.stringify(entity.properties),
        },
      });
    }

    // Relationship queries
    for (const rel of extraction.relationships) {
      const sourceEntity = extraction.entities.find(
        e => e.canonicalName === rel.sourceEntityName && e.type === rel.sourceEntityType,
      ) ?? extraction.entities.find(
        e => e.canonicalName === rel.sourceEntityName,
      );
      const targetEntity = extraction.entities.find(
        e => e.canonicalName === rel.targetEntityName && e.type === rel.targetEntityType,
      ) ?? extraction.entities.find(
        e => e.canonicalName === rel.targetEntityName,
      );

      if (!sourceEntity || !targetEntity) continue;

      const sourceId = GraphEntityExtractor.generateEntityId(
        sourceEntity.type,
        sourceEntity.canonicalName,
        extraction.tenantId,
      );
      const targetId = GraphEntityExtractor.generateEntityId(
        targetEntity.type,
        targetEntity.canonicalName,
        extraction.tenantId,
      );

      queries.push({
        query: `
          MATCH (source {id: $sourceId})
          MATCH (target {id: $targetId})
          MERGE (source)-[r:${rel.type} {sourceDocumentId: $sourceDocumentId}]->(target)
          ON CREATE SET
            r.confidence = $confidence,
            r.tenantId = $tenantId,
            r.properties = $properties,
            r.createdAt = datetime()
        `,
        parameters: {
          sourceId,
          targetId,
          sourceDocumentId: extraction.documentId,
          tenantId: extraction.tenantId,
          confidence: rel.confidence,
          properties: JSON.stringify(rel.properties),
        },
      });
    }

    return queries;
  }
}
