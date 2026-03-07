// ============================================
// Court Access — Graph Integrity Validator (Wave 0 Stabilization)
// Nightly validation job for Neo4j graph consistency.
// Checks: orphan nodes, duplicate fact_id, invalid edges, cross-tenant edges.
// ============================================

// ---------------------------------------------------------------------------
// Graph Integrity Check Types
// ---------------------------------------------------------------------------

export interface IntegrityCheckResult {
  checkName: string;
  passed: boolean;
  issueCount: number;
  details: string[];
  query: string;
  executedAt: string;
}

export interface GraphIntegrityReport {
  timestamp: string;
  overallPassed: boolean;
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  totalIssues: number;
  checks: IntegrityCheckResult[];
  executionDurationMs: number;
}

// ---------------------------------------------------------------------------
// Cypher Queries for Integrity Checks
// ---------------------------------------------------------------------------

/**
 * All integrity check queries.
 * Each query is designed to return rows only when an issue is detected.
 * An empty result set means the check passed.
 */
export const INTEGRITY_CHECKS = {
  /**
   * Check 1: Orphan Fact nodes — Facts without a source document.
   * Every Fact must be linked to a Document via [:EXTRACTED_FROM].
   */
  orphanFacts: {
    name: 'Orphan Fact Nodes',
    description: 'Facts that are not linked to any source document',
    severity: 'critical' as const,
    query: `
      MATCH (f:Fact)
      WHERE NOT EXISTS { MATCH (f)-[:EXTRACTED_FROM]->(:Document) }
      RETURN f.fact_id AS factId, f.content AS content
      LIMIT 100
    `,
  },

  /**
   * Check 2: Duplicate fact_id — Each fact_id must be globally unique.
   * Deterministic processing requires no collisions.
   */
  duplicateFactIds: {
    name: 'Duplicate Fact IDs',
    description: 'Multiple Fact nodes sharing the same fact_id',
    severity: 'critical' as const,
    query: `
      MATCH (f:Fact)
      WITH f.fact_id AS factId, count(*) AS cnt
      WHERE cnt > 1
      RETURN factId, cnt
      LIMIT 100
    `,
  },

  /**
   * Check 3: Mistyped relationship targets — EXTRACTED_FROM must point to a Document node.
   * Neo4j enforces relationship endpoint existence natively, so dangling edges cannot occur.
   * Instead, this checks for relationships pointing to nodes of the wrong type
   * (e.g., a Fact EXTRACTED_FROM a non-Document node), which indicates a data integrity bug.
   */
  mistypedRelationships: {
    name: 'Mistyped Relationship Targets',
    description: 'EXTRACTED_FROM relationships pointing to non-Document nodes',
    severity: 'critical' as const,
    query: `
      MATCH (f:Fact)-[:EXTRACTED_FROM]->(target)
      WHERE NOT target:Document
      RETURN f.fact_id AS factId, labels(target) AS targetLabels, id(target) AS targetId
      LIMIT 100
    `,
  },

  /**
   * Check 4: Cross-tenant edges — Relationships that cross tenant boundaries.
   * Multi-tenant isolation requires all edges stay within a single tenant.
   */
  crossTenantEdges: {
    name: 'Cross-Tenant Edges',
    description: 'Relationships connecting nodes from different tenants',
    severity: 'critical' as const,
    query: `
      MATCH (a)-[r]->(b)
      WHERE a.tenant_id IS NOT NULL
        AND b.tenant_id IS NOT NULL
        AND a.tenant_id <> b.tenant_id
      RETURN type(r) AS relType, a.tenant_id AS tenantA, b.tenant_id AS tenantB, id(r) AS relId
      LIMIT 100
    `,
  },

  /**
   * Check 5: Orphan Document nodes — Documents not linked to any Case.
   */
  orphanDocuments: {
    name: 'Orphan Document Nodes',
    description: 'Documents not linked to any case',
    severity: 'warning' as const,
    query: `
      MATCH (d:Document)
      WHERE NOT EXISTS { MATCH (d)<-[:HAS_DOCUMENT]-(:Case) }
      RETURN d.document_id AS documentId, d.title AS title
      LIMIT 100
    `,
  },

  /**
   * Check 6: Orphan Evidence nodes — Evidence not linked to any Document or Fact.
   */
  orphanEvidence: {
    name: 'Orphan Evidence Nodes',
    description: 'Evidence nodes not connected to any document or fact',
    severity: 'warning' as const,
    query: `
      MATCH (e:Evidence)
      WHERE NOT EXISTS { MATCH (e)-[:SUPPORTS|:CONTRADICTS|:DERIVED_FROM]->() }
        AND NOT EXISTS { MATCH ()-[:SUPPORTS|:CONTRADICTS|:DERIVED_FROM]->(e) }
      RETURN e.evidence_id AS evidenceId
      LIMIT 100
    `,
  },

  /**
   * Check 7: Anchor chain integrity — Every anchored fact must have a valid hash.
   */
  brokenAnchorChain: {
    name: 'Broken Anchor Chain',
    description: 'Anchored facts with missing or empty hash values',
    severity: 'critical' as const,
    query: `
      MATCH (f:Fact)-[:ANCHORED_BY]->(a:Anchor)
      WHERE a.hash IS NULL OR a.hash = ''
      RETURN f.fact_id AS factId, id(a) AS anchorId
      LIMIT 100
    `,
  },

  /**
   * Check 8: Nodes without tenant_id — All primary nodes must have tenant isolation.
   */
  missingTenantId: {
    name: 'Missing Tenant ID',
    description: 'Primary nodes without tenant_id property',
    severity: 'warning' as const,
    query: `
      MATCH (n)
      WHERE (n:Case OR n:Document OR n:Fact OR n:Evidence)
        AND n.tenant_id IS NULL
      RETURN labels(n) AS nodeLabels, id(n) AS nodeId
      LIMIT 100
    `,
  },
} as const;

// ---------------------------------------------------------------------------
// Check Execution
// ---------------------------------------------------------------------------

/**
 * Execute a single integrity check against Neo4j.
 * In production, this would use the Neo4j driver. For now, returns the query
 * and structure for integration.
 *
 * @param checkKey - Key from INTEGRITY_CHECKS
 * @param executeQuery - Function that runs a Cypher query and returns rows
 */
export async function runIntegrityCheck(
  checkKey: keyof typeof INTEGRITY_CHECKS,
  executeQuery: (cypher: string) => Promise<Record<string, unknown>[]>,
): Promise<IntegrityCheckResult> {
  const check = INTEGRITY_CHECKS[checkKey];
  const executedAt = new Date().toISOString();

  try {
    const rows = await executeQuery(check.query);
    const issueCount = rows.length;
    const details = rows.map((row) => JSON.stringify(row));

    return {
      checkName: check.name,
      passed: issueCount === 0,
      issueCount,
      details,
      query: check.query.trim(),
      executedAt,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      checkName: check.name,
      passed: false,
      issueCount: -1,
      details: [`Query execution failed: ${message}`],
      query: check.query.trim(),
      executedAt,
    };
  }
}

/**
 * Run all integrity checks and produce a full report.
 * This is the main entry point for the nightly validation job.
 *
 * @param executeQuery - Function that runs a Cypher query and returns rows
 */
export async function runFullIntegrityReport(
  executeQuery: (cypher: string) => Promise<Record<string, unknown>[]>,
): Promise<GraphIntegrityReport> {
  const startTime = Date.now();
  const checks: IntegrityCheckResult[] = [];

  const checkKeys = Object.keys(INTEGRITY_CHECKS) as (keyof typeof INTEGRITY_CHECKS)[];

  for (const key of checkKeys) {
    const result = await runIntegrityCheck(key, executeQuery);
    checks.push(result);
  }

  const passedChecks = checks.filter((c) => c.passed).length;
  const failedChecks = checks.filter((c) => !c.passed).length;
  const totalIssues = checks.reduce((sum, c) => sum + Math.max(0, c.issueCount), 0);

  return {
    timestamp: new Date().toISOString(),
    overallPassed: failedChecks === 0,
    totalChecks: checks.length,
    passedChecks,
    failedChecks,
    totalIssues,
    checks,
    executionDurationMs: Date.now() - startTime,
  };
}

// ---------------------------------------------------------------------------
// Alert Integration
// ---------------------------------------------------------------------------

export interface GraphIntegrityAlert {
  checkName: string;
  severity: 'warning' | 'critical';
  issueCount: number;
  message: string;
  timestamp: string;
}

/**
 * Convert a report into actionable alerts for the monitoring system.
 * Only failed checks produce alerts.
 */
export function extractAlerts(report: GraphIntegrityReport): GraphIntegrityAlert[] {
  const alerts: GraphIntegrityAlert[] = [];

  for (const check of report.checks) {
    if (check.passed) continue;

    const checkDef = Object.values(INTEGRITY_CHECKS).find((c) => c.name === check.checkName);
    const severity = checkDef?.severity ?? 'warning';

    alerts.push({
      checkName: check.checkName,
      severity,
      issueCount: Math.max(0, check.issueCount),
      message: check.issueCount < 0
        ? `Graph integrity check "${check.checkName}" failed: query execution error`
        : `Graph integrity check "${check.checkName}" failed with ${check.issueCount} issues`,
      timestamp: check.executedAt,
    });
  }

  return alerts;
}
