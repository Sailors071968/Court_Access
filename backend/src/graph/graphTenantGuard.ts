// ============================================
// Court Access — Graph Tenant Guard
// PR 5: Graph Leak Prevention
//
// Wraps Neo4j operations with mandatory tenant isolation.
// Every Cypher query MUST include tenantId filtering.
// This guard validates queries at runtime and rejects
// any operation that could leak data across tenants.
// ============================================

import type { Neo4jSession, Neo4jResult } from './types.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Patterns that indicate a query has tenant isolation */
const TENANT_FILTER_PATTERNS = [
  /tenantId\s*[:=]\s*\$tenantId/i,
  /\{[^}]*tenantId\s*:\s*\$tenantId[^}]*\}/,
  /WHERE[^]*?\.tenantId\s*=\s*\$tenantId/i,
  /n\.tenantId\s*=\s*\$tenantId/i,
] as const;

/** Read-only system queries that are exempt from tenant filtering */
const SYSTEM_QUERY_PREFIXES = [
  'CREATE CONSTRAINT',
  'CREATE INDEX',
  'DROP CONSTRAINT',
  'DROP INDEX',
  'CALL DB.',
  'SHOW ',
  'RETURN 1',
] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TenantGuardConfig {
  /** If true, reject queries without tenant filtering (default: true) */
  enforceStrict: boolean;
  /** If true, log all rejected queries for audit (default: true) */
  auditLog: boolean;
  /** Maximum query result count to prevent full-graph dumps (default: 10000) */
  maxResultCount: number;
}

export interface TenantGuardViolation {
  timestamp: Date;
  query: string;
  tenantId: string | undefined;
  reason: string;
}

// ---------------------------------------------------------------------------
// Graph Tenant Guard
// ---------------------------------------------------------------------------

export class GraphTenantGuard {
  private readonly config: TenantGuardConfig;
  private readonly violations: TenantGuardViolation[] = [];
  private static readonly MAX_VIOLATION_LOG = 1000;

  constructor(config?: Partial<TenantGuardConfig>) {
    this.config = {
      enforceStrict: true,
      auditLog: true,
      maxResultCount: 10000,
      ...config,
    };
  }

  // =========================================================================
  // Query Validation
  // =========================================================================

  /**
   * Validate that a Cypher query includes proper tenant isolation.
   * Returns null if valid, or an error message if invalid.
   */
  validateQuery(
    query: string,
    parameters?: Record<string, unknown>,
  ): string | null {
    const normalizedQuery = query.trim();

    // System queries are exempt
    if (this.isSystemQuery(normalizedQuery)) {
      return null;
    }

    // Check that the query contains tenant filtering
    const hasTenantFilter = TENANT_FILTER_PATTERNS.some(pattern =>
      pattern.test(normalizedQuery),
    );

    if (!hasTenantFilter) {
      return `Query missing tenant isolation: no tenantId filter found in query. ` +
        `All graph queries MUST include {tenantId: $tenantId} or WHERE n.tenantId = $tenantId`;
    }

    // Check that tenantId parameter is actually provided
    if (!parameters || !parameters['tenantId']) {
      return `Query has tenant filter pattern but tenantId parameter is missing or empty`;
    }

    // Validate tenantId is a non-empty string
    const tenantId = parameters['tenantId'];
    if (typeof tenantId !== 'string' || tenantId.trim().length === 0) {
      return `tenantId parameter must be a non-empty string, got: ${typeof tenantId}`;
    }

    return null;
  }

  /**
   * Check if a query is a system/schema management query (exempt from tenant filtering).
   */
  private isSystemQuery(query: string): boolean {
    const upper = query.toUpperCase().trim();
    return SYSTEM_QUERY_PREFIXES.some(prefix => upper.startsWith(prefix));
  }

  // =========================================================================
  // Guarded Session Wrapper
  // =========================================================================

  /**
   * Wrap a Neo4j session with tenant guard protection.
   * Every query run through this session will be validated for tenant isolation.
   */
  wrapSession(session: Neo4jSession, tenantId: string): GuardedNeo4jSession {
    return new GuardedNeo4jSession(session, tenantId, this);
  }

  // =========================================================================
  // Violation Tracking
  // =========================================================================

  /**
   * Record a tenant isolation violation.
   */
  recordViolation(violation: TenantGuardViolation): void {
    if (this.violations.length >= GraphTenantGuard.MAX_VIOLATION_LOG) {
      this.violations.shift(); // Circular buffer
    }
    this.violations.push(violation);

    if (this.config.auditLog) {
      console.error(
        `[GRAPH-TENANT-GUARD] VIOLATION: ${violation.reason} | ` +
        `tenant=${violation.tenantId ?? 'NONE'} | ` +
        `query=${violation.query.substring(0, 200)}`,
      );
    }
  }

  /**
   * Get all recorded violations.
   */
  getViolations(): ReadonlyArray<TenantGuardViolation> {
    return this.violations;
  }

  /**
   * Get violation count.
   */
  getViolationCount(): number {
    return this.violations.length;
  }

  /**
   * Clear violation log.
   */
  clearViolations(): void {
    this.violations.length = 0;
  }

  /**
   * Get current configuration.
   */
  getConfig(): Readonly<TenantGuardConfig> {
    return this.config;
  }
}

// ---------------------------------------------------------------------------
// Guarded Neo4j Session
// ---------------------------------------------------------------------------

/**
 * A Neo4j session wrapper that enforces tenant isolation on every query.
 * If a query lacks tenant filtering, it is rejected before reaching Neo4j.
 */
export class GuardedNeo4jSession implements Neo4jSession {
  constructor(
    private readonly innerSession: Neo4jSession,
    private readonly tenantId: string,
    private readonly guard: GraphTenantGuard,
  ) {}

  /**
   * Run a Cypher query with tenant isolation enforcement.
   * Automatically injects tenantId into parameters if not present.
   */
  async run(
    query: string,
    parameters?: Record<string, unknown>,
  ): Promise<Neo4jResult> {
    // Auto-inject tenantId into parameters
    const enrichedParams = {
      ...parameters,
      tenantId: this.tenantId,
    };

    // Validate the query
    const violation = this.guard.validateQuery(query, enrichedParams);

    if (violation && this.guard.getConfig().enforceStrict) {
      this.guard.recordViolation({
        timestamp: new Date(),
        query,
        tenantId: this.tenantId,
        reason: violation,
      });
      throw new Error(`[GraphTenantGuard] Blocked: ${violation}`);
    }

    if (violation) {
      // Warn-only mode
      this.guard.recordViolation({
        timestamp: new Date(),
        query,
        tenantId: this.tenantId,
        reason: `[WARN] ${violation}`,
      });
    }

    // Execute with tenant-enriched parameters
    const result = await this.innerSession.run(query, enrichedParams);

    // Post-execution: validate result count doesn't exceed safety limit
    if (result.records.length > this.guard.getConfig().maxResultCount) {
      this.guard.recordViolation({
        timestamp: new Date(),
        query,
        tenantId: this.tenantId,
        reason: `Result count ${result.records.length} exceeds safety limit ${this.guard.getConfig().maxResultCount}. Possible full-graph dump.`,
      });
    }

    return result;
  }

  async close(): Promise<void> {
    return this.innerSession.close();
  }
}
