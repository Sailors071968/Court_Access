// ============================================
// Court Access — Neo4j Client
// Manages Neo4j driver lifecycle, session creation,
// and connection health checks.
// ============================================

import type {
  Neo4jDriver,
  Neo4jSession,
  GraphConfig,
} from './types.ts';

// ---------------------------------------------------------------------------
// Default Configuration
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: GraphConfig = {
  neo4jUri: 'bolt://localhost:7687',
  neo4jUser: 'neo4j',
  neo4jPassword: 'neo4j',
  writeConcurrency: 4,
  batchSize: 500,
};

// ---------------------------------------------------------------------------
// Neo4j Client
// ---------------------------------------------------------------------------

export class Neo4jClient {
  private driver: Neo4jDriver | null = null;
  private readonly config: GraphConfig;

  constructor(
    config?: Partial<GraphConfig>,
    private readonly driverFactory?: (uri: string, user: string, password: string) => Neo4jDriver,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the Neo4j driver and verify connectivity.
   */
  async connect(): Promise<void> {
    if (this.driver) return;

    if (this.driverFactory) {
      const driver = this.driverFactory(
        this.config.neo4jUri,
        this.config.neo4jUser,
        this.config.neo4jPassword,
      );
      await driver.verifyConnectivity();
      this.driver = driver;
    } else {
      throw new Error(
        'Neo4j driver factory not provided. Pass a driverFactory to the constructor ' +
        'or use Neo4jClient.createWithDriver() for production usage.',
      );
    }
  }

  /**
   * Create a new session for executing queries.
   */
  session(): Neo4jSession {
    if (!this.driver) {
      throw new Error('Neo4j client not connected. Call connect() first.');
    }
    return this.driver.session();
  }

  /**
   * Execute a Cypher query within an auto-managed session.
   */
  async execute(
    query: string,
    parameters?: Record<string, unknown>,
  ): Promise<{ records: Array<Record<string, unknown>> }> {
    const session = this.session();
    try {
      const result = await session.run(query, parameters);
      return {
        records: result.records.map(r => r.toObject()),
      };
    } finally {
      await session.close();
    }
  }

  /**
   * Execute multiple queries in a batch within a single session.
   */
  async executeBatch(
    queries: Array<{ query: string; parameters?: Record<string, unknown> }>,
  ): Promise<void> {
    const session = this.session();
    try {
      for (const { query, parameters } of queries) {
        await session.run(query, parameters);
      }
    } finally {
      await session.close();
    }
  }

  /**
   * Initialize graph constraints and indexes for the legal knowledge graph.
   */
  async initializeSchema(): Promise<void> {
    const constraints = [
      'CREATE CONSTRAINT IF NOT EXISTS FOR (s:Statute) REQUIRE s.id IS UNIQUE',
      'CREATE CONSTRAINT IF NOT EXISTS FOR (p:Policy) REQUIRE p.id IS UNIQUE',
      'CREATE CONSTRAINT IF NOT EXISTS FOR (c:CaseLaw) REQUIRE c.id IS UNIQUE',
      'CREATE CONSTRAINT IF NOT EXISTS FOR (p:Person) REQUIRE p.id IS UNIQUE',
      'CREATE CONSTRAINT IF NOT EXISTS FOR (o:Officer) REQUIRE o.id IS UNIQUE',
      'CREATE CONSTRAINT IF NOT EXISTS FOR (a:Agency) REQUIRE a.id IS UNIQUE',
      'CREATE CONSTRAINT IF NOT EXISTS FOR (e:Evidence) REQUIRE e.id IS UNIQUE',
      'CREATE CONSTRAINT IF NOT EXISTS FOR (ev:Event) REQUIRE ev.id IS UNIQUE',
      'CREATE CONSTRAINT IF NOT EXISTS FOR (lc:LegalClaim) REQUIRE lc.id IS UNIQUE',
    ];

    const indexes = [
      'CREATE INDEX IF NOT EXISTS FOR (n:Statute) ON (n.tenantId)',
      'CREATE INDEX IF NOT EXISTS FOR (n:Policy) ON (n.tenantId)',
      'CREATE INDEX IF NOT EXISTS FOR (n:CaseLaw) ON (n.tenantId)',
      'CREATE INDEX IF NOT EXISTS FOR (n:Person) ON (n.tenantId)',
      'CREATE INDEX IF NOT EXISTS FOR (n:Officer) ON (n.tenantId)',
      'CREATE INDEX IF NOT EXISTS FOR (n:Agency) ON (n.tenantId)',
      'CREATE INDEX IF NOT EXISTS FOR (n:Evidence) ON (n.tenantId)',
      'CREATE INDEX IF NOT EXISTS FOR (n:Event) ON (n.tenantId)',
      'CREATE INDEX IF NOT EXISTS FOR (n:LegalClaim) ON (n.tenantId)',
      'CREATE INDEX IF NOT EXISTS FOR (n:Statute) ON (n.canonicalName)',
      'CREATE INDEX IF NOT EXISTS FOR (n:Policy) ON (n.canonicalName)',
      'CREATE INDEX IF NOT EXISTS FOR (n:Officer) ON (n.canonicalName)',
      'CREATE INDEX IF NOT EXISTS FOR (n:Agency) ON (n.canonicalName)',
    ];

    const session = this.session();
    try {
      for (const constraint of constraints) {
        await session.run(constraint);
      }
      for (const index of indexes) {
        await session.run(index);
      }
    } finally {
      await session.close();
    }
  }

  /**
   * Check connectivity health.
   */
  async healthCheck(): Promise<{ connected: boolean; latencyMs: number }> {
    if (!this.driver) {
      return { connected: false, latencyMs: -1 };
    }

    const start = performance.now();
    try {
      await this.driver.verifyConnectivity();
      return { connected: true, latencyMs: Math.round(performance.now() - start) };
    } catch {
      return { connected: false, latencyMs: Math.round(performance.now() - start) };
    }
  }

  /**
   * Get the current configuration.
   */
  getConfig(): Readonly<GraphConfig> {
    return this.config;
  }

  /**
   * Close the driver and release resources.
   */
  async close(): Promise<void> {
    if (this.driver) {
      await this.driver.close();
      this.driver = null;
    }
  }
}
