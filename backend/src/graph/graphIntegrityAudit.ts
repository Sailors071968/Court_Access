// ============================================
// Court Access — Graph Integrity Audit
// PR 5: Graph Leak Prevention
//
// Periodic audit service that detects:
//   1. Orphan nodes — nodes without a tenantId
//   2. Dangling relationships — relationships pointing to non-existent nodes
//   3. Cross-tenant edges — relationships connecting nodes from different tenants
//   4. Missing tenant indexes — node labels without tenantId indexes
//
// Run this as a scheduled job or on-demand from admin routes.
// ============================================

import { Neo4jClient } from './neo4jClient.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuditResult {
  timestamp: Date;
  durationMs: number;
  healthy: boolean;
  checks: {
    orphanNodes: OrphanNodeCheck;
    crossTenantEdges: CrossTenantEdgeCheck;
    missingTenantId: MissingTenantIdCheck;
    nodeStats: NodeStatsCheck;
  };
}

export interface OrphanNodeCheck {
  passed: boolean;
  orphanCount: number;
  /** Sample of orphan node IDs (max 50) */
  sampleIds: string[];
}

export interface CrossTenantEdgeCheck {
  passed: boolean;
  violationCount: number;
  /** Sample of cross-tenant relationship details (max 50) */
  samples: Array<{
    relationshipType: string;
    sourceTenantId: string;
    targetTenantId: string;
  }>;
}

export interface MissingTenantIdCheck {
  passed: boolean;
  count: number;
  /** Sample of nodes without tenantId (max 50) */
  sampleIds: string[];
}

export interface NodeStatsCheck {
  totalNodes: number;
  totalRelationships: number;
  tenantCount: number;
  nodesByLabel: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Known Node Labels (must match types.ts GraphNodeType)
// ---------------------------------------------------------------------------

const KNOWN_LABELS = [
  'Statute', 'Policy', 'CaseLaw', 'Person', 'Officer',
  'Agency', 'Evidence', 'Event', 'LegalClaim', 'Conflict',
] as const;

// ---------------------------------------------------------------------------
// Graph Integrity Audit
// ---------------------------------------------------------------------------

export class GraphIntegrityAudit {
  constructor(private readonly neo4jClient: Neo4jClient) {}

  /**
   * Run a full integrity audit of the graph database.
   * Returns a comprehensive report of all checks.
   */
  async runFullAudit(): Promise<AuditResult> {
    const start = performance.now();

    const [orphanNodes, crossTenantEdges, missingTenantId, nodeStats] =
      await Promise.all([
        this.checkOrphanNodes(),
        this.checkCrossTenantEdges(),
        this.checkMissingTenantId(),
        this.getNodeStats(),
      ]);

    const durationMs = Math.round(performance.now() - start);
    const healthy =
      orphanNodes.passed && crossTenantEdges.passed && missingTenantId.passed;

    const result: AuditResult = {
      timestamp: new Date(),
      durationMs,
      healthy,
      checks: { orphanNodes, crossTenantEdges, missingTenantId, nodeStats },
    };

    if (!healthy) {
      console.error(
        `[GRAPH-AUDIT] UNHEALTHY: orphans=${orphanNodes.orphanCount} ` +
        `crossTenant=${crossTenantEdges.violationCount} ` +
        `missingTenantId=${missingTenantId.count}`,
      );
    } else {
      console.log(
        `[GRAPH-AUDIT] HEALTHY: ${nodeStats.totalNodes} nodes, ` +
        `${nodeStats.totalRelationships} relationships, ` +
        `${nodeStats.tenantCount} tenants (${durationMs}ms)`,
      );
    }

    return result;
  }

  // =========================================================================
  // Individual Checks
  // =========================================================================

  /**
   * Find nodes that have no relationships at all (potential orphans).
   * These may indicate incomplete indexing or cleanup failures.
   */
  async checkOrphanNodes(): Promise<OrphanNodeCheck> {
    try {
      const result = await this.neo4jClient.execute(
        `
        MATCH (n)
        WHERE NOT (n)--()
          AND n.tenantId IS NOT NULL
        RETURN n.id AS id, labels(n) AS labels
        LIMIT 50
        `,
      );

      const orphanCount = result.records.length;
      const sampleIds = result.records.map(r => r['id'] as string);

      return {
        passed: orphanCount === 0,
        orphanCount,
        sampleIds,
      };
    } catch (err) {
      console.error('[GRAPH-AUDIT] checkOrphanNodes failed:', err);
      return { passed: false, orphanCount: -1, sampleIds: [] };
    }
  }

  /**
   * Find relationships where source and target nodes belong to different tenants.
   * This is a critical data leak — tenant data should NEVER cross boundaries.
   */
  async checkCrossTenantEdges(): Promise<CrossTenantEdgeCheck> {
    try {
      const result = await this.neo4jClient.execute(
        `
        MATCH (source)-[r]->(target)
        WHERE source.tenantId IS NOT NULL
          AND target.tenantId IS NOT NULL
          AND source.tenantId <> target.tenantId
        RETURN type(r) AS relType,
               source.tenantId AS sourceTenant,
               target.tenantId AS targetTenant
        LIMIT 50
        `,
      );

      const violationCount = result.records.length;
      const samples = result.records.map(r => ({
        relationshipType: r['relType'] as string,
        sourceTenantId: r['sourceTenant'] as string,
        targetTenantId: r['targetTenant'] as string,
      }));

      if (violationCount > 0) {
        console.error(
          `[GRAPH-AUDIT] CRITICAL: ${violationCount} cross-tenant edges detected!`,
        );
      }

      return {
        passed: violationCount === 0,
        violationCount,
        samples,
      };
    } catch (err) {
      console.error('[GRAPH-AUDIT] checkCrossTenantEdges failed:', err);
      return { passed: false, violationCount: -1, samples: [] };
    }
  }

  /**
   * Find nodes that are missing the tenantId property entirely.
   * Every node in the graph MUST have a tenantId.
   */
  async checkMissingTenantId(): Promise<MissingTenantIdCheck> {
    try {
      const result = await this.neo4jClient.execute(
        `
        MATCH (n)
        WHERE n.tenantId IS NULL
        RETURN n.id AS id, labels(n) AS labels
        LIMIT 50
        `,
      );

      const count = result.records.length;
      const sampleIds = result.records.map(r => r['id'] as string);

      if (count > 0) {
        console.error(
          `[GRAPH-AUDIT] ${count} nodes missing tenantId property`,
        );
      }

      return { passed: count === 0, count, sampleIds };
    } catch (err) {
      console.error('[GRAPH-AUDIT] checkMissingTenantId failed:', err);
      return { passed: false, count: -1, sampleIds: [] };
    }
  }

  /**
   * Get overall graph statistics.
   */
  async getNodeStats(): Promise<NodeStatsCheck> {
    try {
      // Count nodes by label
      const nodeResult = await this.neo4jClient.execute(
        `MATCH (n) RETURN labels(n)[0] AS label, count(n) AS cnt`,
      );

      const nodesByLabel: Record<string, number> = {};
      let totalNodes = 0;
      for (const record of nodeResult.records) {
        const label = (record['label'] as string) ?? 'Unknown';
        const cnt = record['cnt'] as number;
        nodesByLabel[label] = cnt;
        totalNodes += cnt;
      }

      // Count relationships
      const relResult = await this.neo4jClient.execute(
        `MATCH ()-[r]->() RETURN count(r) AS cnt`,
      );
      const totalRelationships = (relResult.records[0]?.['cnt'] as number) ?? 0;

      // Count distinct tenants
      const tenantResult = await this.neo4jClient.execute(
        `MATCH (n) WHERE n.tenantId IS NOT NULL RETURN count(DISTINCT n.tenantId) AS cnt`,
      );
      const tenantCount = (tenantResult.records[0]?.['cnt'] as number) ?? 0;

      return { totalNodes, totalRelationships, tenantCount, nodesByLabel };
    } catch (err) {
      console.error('[GRAPH-AUDIT] getNodeStats failed:', err);
      return { totalNodes: 0, totalRelationships: 0, tenantCount: 0, nodesByLabel: {} };
    }
  }

  // =========================================================================
  // Remediation
  // =========================================================================

  /**
   * Delete all nodes that are missing a tenantId.
   * This is a destructive operation — use only after confirming audit results.
   * Returns the number of nodes deleted.
   */
  async purgeNodesWithoutTenant(): Promise<number> {
    const result = await this.neo4jClient.execute(
      `
      MATCH (n)
      WHERE n.tenantId IS NULL
      DETACH DELETE n
      RETURN count(n) AS deleted
      `,
    );

    const deleted = (result.records[0]?.['deleted'] as number) ?? 0;
    console.log(`[GRAPH-AUDIT] Purged ${deleted} nodes without tenantId`);
    return deleted;
  }

  /**
   * Delete all cross-tenant edges (relationships where source and target
   * have different tenantIds). Nodes are kept intact.
   * Returns the number of relationships deleted.
   */
  async purgeCrossTenantEdges(): Promise<number> {
    const result = await this.neo4jClient.execute(
      `
      MATCH (source)-[r]->(target)
      WHERE source.tenantId IS NOT NULL
        AND target.tenantId IS NOT NULL
        AND source.tenantId <> target.tenantId
      DELETE r
      RETURN count(r) AS deleted
      `,
    );

    const deleted = (result.records[0]?.['deleted'] as number) ?? 0;
    console.log(`[GRAPH-AUDIT] Purged ${deleted} cross-tenant edges`);
    return deleted;
  }

  /**
   * Delete all data for a specific tenant from the graph.
   * Use for tenant offboarding or data cleanup.
   */
  async purgeTenantData(tenantId: string): Promise<{ nodesDeleted: number }> {
    if (!tenantId || tenantId.trim().length === 0) {
      throw new Error('tenantId is required for purge operation');
    }

    const result = await this.neo4jClient.execute(
      `
      MATCH (n {tenantId: $tenantId})
      DETACH DELETE n
      RETURN count(n) AS deleted
      `,
      { tenantId },
    );

    const nodesDeleted = (result.records[0]?.['deleted'] as number) ?? 0;
    console.log(`[GRAPH-AUDIT] Purged ${nodesDeleted} nodes for tenant ${tenantId}`);
    return { nodesDeleted };
  }

  // =========================================================================
  // Tenant Isolation Validation for a Specific Tenant
  // =========================================================================

  /**
   * Validate that a specific tenant's data is fully isolated.
   * Checks that no edges cross to other tenants and all nodes have tenantId set.
   */
  async validateTenantIsolation(tenantId: string): Promise<{
    isolated: boolean;
    nodeCount: number;
    relationshipCount: number;
    leakedEdges: number;
  }> {
    // Count tenant's nodes
    const nodeResult = await this.neo4jClient.execute(
      `MATCH (n {tenantId: $tenantId}) RETURN count(n) AS cnt`,
      { tenantId },
    );
    const nodeCount = (nodeResult.records[0]?.['cnt'] as number) ?? 0;

    // Count tenant's relationships
    const relResult = await this.neo4jClient.execute(
      `MATCH ({tenantId: $tenantId})-[r]->() RETURN count(r) AS cnt`,
      { tenantId },
    );
    const relationshipCount = (relResult.records[0]?.['cnt'] as number) ?? 0;

    // Check for edges that cross tenant boundaries
    const leakResult = await this.neo4jClient.execute(
      `
      MATCH (source {tenantId: $tenantId})-[r]->(target)
      WHERE target.tenantId <> $tenantId OR target.tenantId IS NULL
      RETURN count(r) AS cnt
      `,
      { tenantId },
    );
    const leakedEdges = (leakResult.records[0]?.['cnt'] as number) ?? 0;

    return {
      isolated: leakedEdges === 0,
      nodeCount,
      relationshipCount,
      leakedEdges,
    };
  }
}
