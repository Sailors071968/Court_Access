// ============================================
// Court Access — Graph Query Engine
// Provides high-level query capabilities over the
// legal knowledge graph for intelligence operations.
// ============================================

import { Neo4jClient } from './neo4jClient.ts';
import type {
  GraphNode,
  GraphRelationship,
  GraphQueryResult,
  PolicyViolationResult,
  EvidenceRelationshipResult,
  StatuteApplicabilityResult,
  GraphNodeType,
  GraphRelationshipType,
} from './types.ts';

// ---------------------------------------------------------------------------
// Graph Query Engine
// ---------------------------------------------------------------------------

export class GraphQueryEngine {
  constructor(private readonly neo4jClient: Neo4jClient) {}

  // =========================================================================
  // Core Queries
  // =========================================================================

  /**
   * Find all policy violations for a tenant.
   * Returns officers/persons who violated policies, with supporting evidence.
   */
  async findPolicyViolations(tenantId: string): Promise<PolicyViolationResult[]> {
    const result = await this.neo4jClient.execute(
      `
      MATCH (violator {tenantId: $tenantId})-[v:VIOLATES]->(policy:Policy {tenantId: $tenantId})
      OPTIONAL MATCH (evidence:Evidence {tenantId: $tenantId})-[:SUPPORTS]->(claim:LegalClaim)
      WHERE claim.canonicalName CONTAINS 'violation' AND (evidence)-[:MENTIONS]->(violator)
      RETURN violator, policy, v, collect(DISTINCT evidence) AS evidence
      ORDER BY v.confidence DESC
      `,
      { tenantId },
    );

    return result.records.map(record => ({
      policy: this.recordToNode(record['policy'] as Record<string, unknown>),
      violator: this.recordToNode(record['violator'] as Record<string, unknown>),
      evidence: this.extractNodeList(record['evidence'] as Array<Record<string, unknown>>),
      confidence: (record['v'] as Record<string, unknown>)?.['confidence'] as number ?? 0,
    }));
  }

  /**
   * Find all relationships for a specific piece of evidence.
   */
  async findEvidenceRelationships(
    tenantId: string,
    evidenceNodeId?: string,
  ): Promise<EvidenceRelationshipResult[]> {
    const whereClause = evidenceNodeId
      ? 'WHERE e.tenantId = $tenantId AND e.id = $evidenceNodeId'
      : 'WHERE e.tenantId = $tenantId';

    const result = await this.neo4jClient.execute(
      `
      MATCH (e:Evidence)-[r]->(target {tenantId: $tenantId})
      ${whereClause}
      RETURN e, r, target
      ORDER BY r.confidence DESC
      `,
      { tenantId, evidenceNodeId },
    );

    // Group by evidence node
    const grouped = new Map<string, EvidenceRelationshipResult>();

    for (const record of result.records) {
      const evidence = this.recordToNode(record['e'] as Record<string, unknown>);
      const target = this.recordToNode(record['target'] as Record<string, unknown>);
      const relationship = this.recordToRelationship(record['r'] as Record<string, unknown>);

      if (!grouped.has(evidence.id)) {
        grouped.set(evidence.id, { evidence, relatedNodes: [] });
      }
      grouped.get(evidence.id)!.relatedNodes.push({ node: target, relationship });
    }

    return Array.from(grouped.values());
  }

  /**
   * Find statutes applicable to a case/investigation.
   */
  async findStatuteApplicability(tenantId: string): Promise<StatuteApplicabilityResult[]> {
    const result = await this.neo4jClient.execute(
      `
      MATCH (statute:Statute {tenantId: $tenantId})
      OPTIONAL MATCH (statute)<-[:REFERENCES]-(caselaw:CaseLaw {tenantId: $tenantId})
      OPTIONAL MATCH (evidence:Evidence {tenantId: $tenantId})-[:SUPPORTS]->(claim:LegalClaim {tenantId: $tenantId})-[:REFERENCES]->(statute)
      RETURN statute,
             collect(DISTINCT caselaw) AS applicableTo,
             collect(DISTINCT evidence) AS supportingEvidence
      `,
      { tenantId },
    );

    return result.records.map(record => ({
      statute: this.recordToNode(record['statute'] as Record<string, unknown>),
      applicableTo: this.extractNodeList(record['applicableTo'] as Array<Record<string, unknown>>),
      supportingEvidence: this.extractNodeList(record['supportingEvidence'] as Array<Record<string, unknown>>),
      confidence: 1.0,
    }));
  }

  // =========================================================================
  // Generic Graph Queries
  // =========================================================================

  /**
   * Find all nodes of a specific type for a tenant.
   */
  async findNodesByType(
    tenantId: string,
    nodeType: GraphNodeType,
  ): Promise<GraphNode[]> {
    const result = await this.neo4jClient.execute(
      `MATCH (n:${nodeType} {tenantId: $tenantId}) RETURN n ORDER BY n.name`,
      { tenantId },
    );
    return result.records.map(r => this.recordToNode(r['n'] as Record<string, unknown>));
  }

  /**
   * Find all relationships of a specific type for a tenant.
   */
  async findRelationshipsByType(
    tenantId: string,
    relType: GraphRelationshipType,
  ): Promise<Array<{ source: GraphNode; target: GraphNode; relationship: GraphRelationship }>> {
    const result = await this.neo4jClient.execute(
      `
      MATCH (source {tenantId: $tenantId})-[r:${relType}]->(target)
      RETURN source, r, target
      ORDER BY r.confidence DESC
      `,
      { tenantId },
    );

    return result.records.map(record => ({
      source: this.recordToNode(record['source'] as Record<string, unknown>),
      target: this.recordToNode(record['target'] as Record<string, unknown>),
      relationship: this.recordToRelationship(record['r'] as Record<string, unknown>),
    }));
  }

  /**
   * Find the neighborhood of a specific node (all connected nodes within N hops).
   */
  async findNeighborhood(
    tenantId: string,
    nodeId: string,
    depth: number = 2,
  ): Promise<GraphQueryResult> {
    const safeDepth = Math.max(1, Math.min(10, Math.floor(depth)));
    if (!Number.isFinite(safeDepth)) throw new Error('Invalid depth parameter');

    const result = await this.neo4jClient.execute(
      `
      MATCH path = (start {id: $nodeId, tenantId: $tenantId})-[*1..${safeDepth}]-(connected)
      WHERE all(n IN nodes(path) WHERE n.tenantId = $tenantId)
      UNWIND nodes(path) AS n
      UNWIND relationships(path) AS r
      RETURN collect(DISTINCT n) AS nodes, collect(DISTINCT r) AS relationships
      `,
      { tenantId, nodeId },
    );

    if (result.records.length === 0) {
      return { nodes: [], relationships: [] };
    }

    const record = result.records[0];
    return {
      nodes: this.extractNodeList(record['nodes'] as Array<Record<string, unknown>>),
      relationships: this.extractRelationshipList(record['relationships'] as Array<Record<string, unknown>>),
    };
  }

  /**
   * Search for nodes by name (fuzzy match).
   */
  async searchNodes(
    tenantId: string,
    searchTerm: string,
    nodeType?: GraphNodeType,
  ): Promise<GraphNode[]> {
    const typeFilter = nodeType ? `:${nodeType}` : '';
    const result = await this.neo4jClient.execute(
      `
      MATCH (n${typeFilter} {tenantId: $tenantId})
      WHERE toLower(n.name) CONTAINS toLower($searchTerm)
         OR toLower(n.canonicalName) CONTAINS toLower($searchTerm)
      RETURN n
      ORDER BY n.name
      LIMIT 50
      `,
      { tenantId, searchTerm },
    );
    return result.records.map(r => this.recordToNode(r['n'] as Record<string, unknown>));
  }

  /**
   * Find shortest path between two nodes.
   */
  async findShortestPath(
    tenantId: string,
    sourceNodeId: string,
    targetNodeId: string,
  ): Promise<GraphQueryResult> {
    const result = await this.neo4jClient.execute(
      `
      MATCH (source {id: $sourceNodeId, tenantId: $tenantId}), (target {id: $targetNodeId, tenantId: $tenantId})
      MATCH path = shortestPath((source)-[*..10]-(target))
      WHERE all(n IN nodes(path) WHERE n.tenantId = $tenantId)
      UNWIND nodes(path) AS n
      UNWIND relationships(path) AS r
      RETURN collect(DISTINCT n) AS nodes, collect(DISTINCT r) AS relationships
      `,
      { tenantId, sourceNodeId, targetNodeId },
    );

    if (result.records.length === 0) {
      return { nodes: [], relationships: [] };
    }

    const record = result.records[0];
    return {
      nodes: this.extractNodeList(record['nodes'] as Array<Record<string, unknown>>),
      relationships: this.extractRelationshipList(record['relationships'] as Array<Record<string, unknown>>),
    };
  }

  // =========================================================================
  // Intelligence Queries
  // =========================================================================

  /**
   * Find contradictions: evidence that both supports and refutes claims.
   */
  async findContradictions(tenantId: string): Promise<Array<{
    claim: GraphNode;
    supporting: GraphNode[];
    refuting: GraphNode[];
  }>> {
    const result = await this.neo4jClient.execute(
      `
      MATCH (supporting:Evidence {tenantId: $tenantId})-[:SUPPORTS]->(claim:LegalClaim {tenantId: $tenantId})
      MATCH (refuting:Evidence {tenantId: $tenantId})-[:REFUTES]->(claim)
      RETURN claim,
             collect(DISTINCT supporting) AS supporting,
             collect(DISTINCT refuting) AS refuting
      `,
      { tenantId },
    );

    return result.records.map(record => ({
      claim: this.recordToNode(record['claim'] as Record<string, unknown>),
      supporting: this.extractNodeList(record['supporting'] as Array<Record<string, unknown>>),
      refuting: this.extractNodeList(record['refuting'] as Array<Record<string, unknown>>),
    }));
  }

  /**
   * Find evidence chains: sequences of evidence connected through entities.
   */
  async findEvidenceChains(
    tenantId: string,
    maxLength: number = 5,
  ): Promise<Array<{ chain: GraphNode[]; relationships: GraphRelationship[] }>> {
    const safeMaxLength = Math.max(2, Math.min(10, Math.floor(maxLength)));
    if (!Number.isFinite(safeMaxLength)) throw new Error('Invalid maxLength parameter');

    const result = await this.neo4jClient.execute(
      `
      MATCH path = (e1:Evidence {tenantId: $tenantId})-[*2..${safeMaxLength}]-(e2:Evidence)
      WHERE e1.id < e2.id
      UNWIND nodes(path) AS n
      UNWIND relationships(path) AS r
      RETURN collect(DISTINCT n) AS chain, collect(DISTINCT r) AS relationships
      LIMIT 100
      `,
      { tenantId },
    );

    return result.records.map(record => ({
      chain: this.extractNodeList(record['chain'] as Array<Record<string, unknown>>),
      relationships: this.extractRelationshipList(record['relationships'] as Array<Record<string, unknown>>),
    }));
  }

  // =========================================================================
  // Helpers
  // =========================================================================

  private recordToNode(raw: Record<string, unknown>): GraphNode {
    return {
      id: (raw['id'] as string) ?? '',
      type: (raw['type'] as string ?? (Array.isArray(raw['labels']) ? (raw['labels'] as string[])[0] : undefined) ?? 'Unknown') as GraphNode['type'],
      name: (raw['name'] as string) ?? '',
      properties: (typeof raw['properties'] === 'string' ? JSON.parse(raw['properties'] as string) : raw['properties'] as Record<string, string | number | boolean | null>) ?? {},
      sourceDocumentId: (raw['sourceDocumentId'] as string) ?? '',
      tenantId: (raw['tenantId'] as string) ?? '',
      createdAt: raw['createdAt'] ? new Date(raw['createdAt'] as string) : new Date(),
    };
  }

  private recordToRelationship(raw: Record<string, unknown>): GraphRelationship {
    return {
      id: (raw['id'] as string) ?? '',
      type: (raw['type'] as string ?? 'UNKNOWN') as GraphRelationship['type'],
      sourceNodeId: (raw['sourceNodeId'] as string) ?? '',
      targetNodeId: (raw['targetNodeId'] as string) ?? '',
      confidence: (raw['confidence'] as number) ?? 0,
      properties: (typeof raw['properties'] === 'string' ? JSON.parse(raw['properties'] as string) : raw['properties'] as Record<string, string | number | boolean | null>) ?? {},
      sourceDocumentId: (raw['sourceDocumentId'] as string) ?? '',
      tenantId: (raw['tenantId'] as string) ?? '',
      createdAt: raw['createdAt'] ? new Date(raw['createdAt'] as string) : new Date(),
    };
  }

  private extractNodeList(raw: Array<Record<string, unknown>>): GraphNode[] {
    if (!Array.isArray(raw)) return [];
    return raw.filter(Boolean).map(r => this.recordToNode(r));
  }

  private extractRelationshipList(raw: Array<Record<string, unknown>>): GraphRelationship[] {
    if (!Array.isArray(raw)) return [];
    return raw.filter(Boolean).map(r => this.recordToRelationship(r));
  }
}
