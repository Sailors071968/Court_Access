// ============================================================================
// Phase 65 — Stable Schema Registry
// Centralized registry of all locked database tables with version tracking,
// column definitions, and CI enforcement rules.
// Schema changes to registered tables require manual approval.
// ============================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ColumnDefinition {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: string;
  isId?: boolean;
  isUnique?: boolean;
  isIndex?: boolean;
  description?: string;
}

export interface LockedTableDefinition {
  modelName: string;
  tableName: string;
  version: string;
  lockedAt: string;
  lockedBy: string;
  lastModifiedPhase: string;
  columns: ColumnDefinition[];
  consumers: string[];
  relations: string[];
  notes?: string;
}

export interface SchemaRegistryStatus {
  totalLockedTables: number;
  registryVersion: string;
  lastUpdated: string;
  tables: LockedTableDefinition[];
  ciRuleActive: boolean;
}

// ---------------------------------------------------------------------------
// Locked Table Registry
// ---------------------------------------------------------------------------

export const LOCKED_TABLES_REGISTRY: LockedTableDefinition[] = [
  // ----- Agency -----
  {
    modelName: 'Agency',
    tableName: 'agencies',
    version: '1.2.0',
    lockedAt: '2026-03-09',
    lockedBy: 'Phase 65 — Schema Lock',
    lastModifiedPhase: 'Phase 46 (CPRA relations)',
    columns: [
      { name: 'agencyId', type: 'String', nullable: false, isId: true, defaultValue: 'uuid()', description: 'Primary key' },
      { name: 'agencyName', type: 'String', nullable: false, description: 'Official agency name' },
      { name: 'agencyType', type: 'String', nullable: true, description: 'Type of agency (PD, SO, etc.)' },
      { name: 'city', type: 'String', nullable: true },
      { name: 'county', type: 'String', nullable: true },
      { name: 'populationEstimate', type: 'Int', nullable: true },
      { name: 'jurisdictionRank', type: 'Int', nullable: true },
      { name: 'website', type: 'String', nullable: true },
      { name: 'postDirectoryUrl', type: 'String', nullable: true },
      { name: 'recordsRequestUrl', type: 'String', nullable: true },
      { name: 'policyCollectionUrl', type: 'String', nullable: true },
      { name: 'policiesDiscovered', type: 'Boolean', nullable: false, defaultValue: 'false' },
      { name: 'crawlStatus', type: 'String', nullable: false, defaultValue: '"pending"' },
      { name: 'crawlError', type: 'String', nullable: true },
      { name: 'lastCrawledAt', type: 'DateTime', nullable: true },
      { name: 'pagesFound', type: 'Int', nullable: false, defaultValue: '0' },
      { name: 'policyPagesFound', type: 'Int', nullable: false, defaultValue: '0' },
      { name: 'createdAt', type: 'DateTime', nullable: false, defaultValue: 'now()' },
      { name: 'updatedAt', type: 'DateTime', nullable: false },
    ],
    consumers: [
      'agencyCrawlerWorker',
      'policyDiscoveryService',
      'cpraRoutes',
      'taxonomyRoutes',
      'comparativePolicyEngine',
      'policyCoverageTracker',
    ],
    relations: ['PolicyDocument[]', 'PolicyCoverage[]', 'CPRAAgencyRequest[]', 'CPRAAnnualUpdate[]'],
  },

  // ----- PolicyDocument -----
  {
    modelName: 'PolicyDocument',
    tableName: 'policy_documents',
    version: '1.1.0',
    lockedAt: '2026-03-09',
    lockedBy: 'Phase 65 — Schema Lock',
    lastModifiedPhase: 'Phase 10 (taxonomy integration)',
    columns: [
      { name: 'documentId', type: 'String', nullable: false, isId: true, defaultValue: 'uuid()' },
      { name: 'agencyId', type: 'String', nullable: false },
      { name: 'topicId', type: 'String', nullable: true },
      { name: 'documentType', type: 'String', nullable: true },
      { name: 'title', type: 'String', nullable: true },
      { name: 'policyNumber', type: 'String', nullable: true },
      { name: 'sourceUrl', type: 'String', nullable: false },
      { name: 's3Url', type: 'String', nullable: true },
      { name: 'mimeType', type: 'String', nullable: true },
      { name: 'fileSizeBytes', type: 'Int', nullable: true },
      { name: 'textExtracted', type: 'Boolean', nullable: false, defaultValue: 'false' },
      { name: 'textContent', type: 'String', nullable: true },
      { name: 'ocrStatus', type: 'String', nullable: false, defaultValue: '"pending"' },
      { name: 'ocrError', type: 'String', nullable: true },
      { name: 'classificationStatus', type: 'String', nullable: false, defaultValue: '"pending"' },
      { name: 'classificationScore', type: 'Float', nullable: true },
      { name: 'isChpCanonical', type: 'Boolean', nullable: false, defaultValue: 'false' },
      { name: 'matchedTopicConfidence', type: 'Float', nullable: true },
      { name: 'createdAt', type: 'DateTime', nullable: false, defaultValue: 'now()' },
      { name: 'updatedAt', type: 'DateTime', nullable: false },
    ],
    consumers: [
      'classificationPipeline',
      'ocrWorker',
      'documentTextExtractor',
      'policyMatchingEngine',
      'taxonomyRoutes',
      'pipelineRoutes',
    ],
    relations: ['Agency'],
  },

  // ----- PolicyTopic -----
  {
    modelName: 'PolicyTopic',
    tableName: 'policy_topics',
    version: '1.0.0',
    lockedAt: '2026-03-09',
    lockedBy: 'Phase 65 — Schema Lock',
    lastModifiedPhase: 'Phase 1 (initial creation)',
    columns: [
      { name: 'id', type: 'String', nullable: false, isId: true, defaultValue: 'uuid()' },
      { name: 'topicName', type: 'String', nullable: false, isUnique: true },
      { name: 'category', type: 'String', nullable: false },
      { name: 'keywords', type: 'String', nullable: false },
      { name: 'description', type: 'String', nullable: true },
      { name: 'chpReference', type: 'String', nullable: true },
      { name: 'sortOrder', type: 'Int', nullable: false, defaultValue: '0' },
      { name: 'createdAt', type: 'DateTime', nullable: false, defaultValue: 'now()' },
      { name: 'updatedAt', type: 'DateTime', nullable: false },
    ],
    consumers: ['taxonomyRoutes', 'policyMatchingEngine', 'coveragePopulator', 'classificationPipeline'],
    relations: ['PolicyTopicMapping[]', 'PolicyCoverage[]'],
  },

  // ----- PolicyCoverage -----
  {
    modelName: 'PolicyCoverage',
    tableName: 'policy_coverage',
    version: '1.0.0',
    lockedAt: '2026-03-09',
    lockedBy: 'Phase 65 — Schema Lock',
    lastModifiedPhase: 'Phase 5 (initial creation)',
    columns: [
      { name: 'id', type: 'String', nullable: false, isId: true, defaultValue: 'uuid()' },
      { name: 'agencyId', type: 'String', nullable: false },
      { name: 'topicId', type: 'String', nullable: false },
      { name: 'policyFound', type: 'Boolean', nullable: false, defaultValue: 'false' },
      { name: 'documentId', type: 'String', nullable: true },
      { name: 'sourceUrl', type: 'String', nullable: true },
      { name: 'notes', type: 'String', nullable: true },
      { name: 'createdAt', type: 'DateTime', nullable: false, defaultValue: 'now()' },
      { name: 'updatedAt', type: 'DateTime', nullable: false },
    ],
    consumers: ['policyCoverageTracker', 'comparativePolicyEngine', 'taxonomyRoutes', 'coveragePopulator'],
    relations: ['Agency', 'PolicyTopic'],
  },

  // ----- CPRAAgencyRequest -----
  {
    modelName: 'CPRAAgencyRequest',
    tableName: 'cpra_agency_requests',
    version: '1.1.0',
    lockedAt: '2026-03-09',
    lockedBy: 'Phase 65 — Schema Lock',
    lastModifiedPhase: 'Phase 46 (FK relation fix)',
    columns: [
      { name: 'requestId', type: 'String', nullable: false, isId: true, defaultValue: 'uuid()' },
      { name: 'campaignId', type: 'String', nullable: false },
      { name: 'agencyId', type: 'String', nullable: false },
      { name: 'status', type: 'String', nullable: false, defaultValue: '"draft"' },
      { name: 'sentAt', type: 'DateTime', nullable: true },
      { name: 'lastFollowUpAt', type: 'DateTime', nullable: true },
      { name: 'responseReceived', type: 'Boolean', nullable: false, defaultValue: 'false' },
      { name: 'responseReceivedAt', type: 'DateTime', nullable: true },
      { name: 'policyReceivedAt', type: 'DateTime', nullable: true },
      { name: 'annualUpdateDue', type: 'DateTime', nullable: true },
      { name: 'closed', type: 'Boolean', nullable: false, defaultValue: 'false' },
      { name: 'followUpCount', type: 'Int', nullable: false, defaultValue: '0' },
      { name: 'createdAt', type: 'DateTime', nullable: false, defaultValue: 'now()' },
      { name: 'updatedAt', type: 'DateTime', nullable: false },
    ],
    consumers: ['cpraCampaignWorker', 'cpraRoutes', 'cpraResponseProcessor', 'cpraAnnualUpdateService'],
    relations: ['Agency', 'CPRARequestCampaign'],
  },

  // ----- CPRAAnnualUpdate -----
  {
    modelName: 'CPRAAnnualUpdate',
    tableName: 'cpra_annual_updates',
    version: '1.1.0',
    lockedAt: '2026-03-09',
    lockedBy: 'Phase 65 — Schema Lock',
    lastModifiedPhase: 'Phase 46 (FK relation fix)',
    columns: [
      { name: 'updateId', type: 'String', nullable: false, isId: true, defaultValue: 'uuid()' },
      { name: 'agencyId', type: 'String', nullable: false },
      { name: 'requestedAt', type: 'DateTime', nullable: false },
      { name: 'responseReceived', type: 'Boolean', nullable: false, defaultValue: 'false' },
      { name: 'responseReceivedAt', type: 'DateTime', nullable: true },
      { name: 'policyReceivedAt', type: 'DateTime', nullable: true },
      { name: 'annualUpdateDue', type: 'DateTime', nullable: true },
      { name: 'followUpCount', type: 'Int', nullable: false, defaultValue: '0' },
      { name: 'lastFollowUpAt', type: 'DateTime', nullable: true },
      { name: 'closed', type: 'Boolean', nullable: false, defaultValue: 'false' },
      { name: 'status', type: 'String', nullable: false, defaultValue: '"scheduled"' },
      { name: 'createdAt', type: 'DateTime', nullable: false, defaultValue: 'now()' },
      { name: 'updatedAt', type: 'DateTime', nullable: false },
    ],
    consumers: ['cpraAnnualUpdateWorker', 'cpraAnnualUpdateService', 'cpraRoutes'],
    relations: ['Agency'],
  },

  // ----- TrialExhibitScene -----
  {
    modelName: 'TrialExhibitScene',
    tableName: 'trial_exhibit_scenes',
    version: '1.0.0',
    lockedAt: '2026-03-09',
    lockedBy: 'Phase 65 — Schema Lock',
    lastModifiedPhase: 'Phase 63 (initial creation)',
    columns: [
      { name: 'sceneId', type: 'String', nullable: false, isId: true, defaultValue: 'uuid()' },
      { name: 'caseId', type: 'String', nullable: true },
      { name: 'name', type: 'String', nullable: false },
      { name: 'description', type: 'String', nullable: true },
      { name: 'latitude', type: 'Float', nullable: false },
      { name: 'longitude', type: 'Float', nullable: false },
      { name: 'address', type: 'String', nullable: true },
      { name: 'objectSettings', type: 'String', nullable: false, description: 'JSON blob' },
      { name: 'cameraSettings', type: 'String', nullable: true, description: 'JSON blob' },
      { name: 'markers', type: 'String', nullable: true, description: 'JSON blob' },
      { name: 'sceneData', type: 'String', nullable: true, description: 'JSON blob' },
      { name: 'animationData', type: 'String', nullable: true, description: 'JSON blob' },
      { name: 'createdBy', type: 'String', nullable: true },
      { name: 'thumbnail', type: 'String', nullable: true, description: 'base64 PNG' },
      { name: 'isPublic', type: 'Boolean', nullable: false, defaultValue: 'false' },
      { name: 'createdAt', type: 'DateTime', nullable: false, defaultValue: 'now()' },
      { name: 'updatedAt', type: 'DateTime', nullable: false },
    ],
    consumers: ['exhibitRoutes', 'ExhibitViewer'],
    relations: [],
  },
];

// ---------------------------------------------------------------------------
// CI Approval Rule
// ---------------------------------------------------------------------------

export const CI_SCHEMA_RULE = {
  name: 'schema-change-approval',
  description: 'Schema changes to locked tables require manual approval via PR label',
  requiredLabel: 'schema-change-approved',
  blocksOnViolation: true,
  enforcedTables: LOCKED_TABLES_REGISTRY.map((t) => t.modelName),
  sqlTableNames: LOCKED_TABLES_REGISTRY.map((t) => t.tableName),
  checkCommand: 'npx tsx backend/prisma/schema/schemaGuard.ts',
  violationMessage:
    'Schema change detected on a locked table. Add the "schema-change-approved" label to proceed.',
};

// ---------------------------------------------------------------------------
// Registry API
// ---------------------------------------------------------------------------

/**
 * Get the full schema registry status.
 */
export function getSchemaRegistryStatus(): SchemaRegistryStatus {
  return {
    totalLockedTables: LOCKED_TABLES_REGISTRY.length,
    registryVersion: '2.0.0',
    lastUpdated: '2026-03-09',
    tables: LOCKED_TABLES_REGISTRY,
    ciRuleActive: true,
  };
}

/**
 * Get a specific locked table definition by model name.
 */
export function getLockedTable(modelName: string): LockedTableDefinition | null {
  return LOCKED_TABLES_REGISTRY.find((t) => t.modelName === modelName) ?? null;
}

/**
 * Check if a table is locked.
 */
export function isTableLocked(modelName: string): boolean {
  return LOCKED_TABLES_REGISTRY.some((t) => t.modelName === modelName);
}

/**
 * Get all table names that are locked (SQL names).
 */
export function getLockedSqlTableNames(): string[] {
  return LOCKED_TABLES_REGISTRY.map((t) => t.tableName);
}

/**
 * Get all model names that are locked.
 */
export function getLockedModelNames(): string[] {
  return LOCKED_TABLES_REGISTRY.map((t) => t.modelName);
}

/**
 * Validate that a proposed column change is compatible with the locked schema.
 * Returns list of violations.
 */
export function validateSchemaChange(
  modelName: string,
  proposedColumns: string[],
): string[] {
  const table = getLockedTable(modelName);
  if (!table) return [];

  const violations: string[] = [];
  const existingColumnNames = new Set(table.columns.map((c) => c.name));

  // Check for removed columns (breaking change)
  for (const col of table.columns) {
    if (!col.nullable && !proposedColumns.includes(col.name)) {
      violations.push(
        `Cannot remove required column "${col.name}" from locked table "${modelName}"`
      );
    }
  }

  return violations;
}

/**
 * Get all consumers of a locked table.
 */
export function getTableConsumers(modelName: string): string[] {
  const table = getLockedTable(modelName);
  return table?.consumers ?? [];
}

/**
 * Summary for dashboard display.
 */
export function getRegistrySummary(): {
  lockedCount: number;
  totalColumns: number;
  totalConsumers: number;
  tables: Array<{ name: string; columns: number; consumers: number; version: string }>;
} {
  let totalColumns = 0;
  const consumerSet = new Set<string>();
  const tables = LOCKED_TABLES_REGISTRY.map((t) => {
    totalColumns += t.columns.length;
    for (const c of t.consumers) consumerSet.add(c);
    return {
      name: t.modelName,
      columns: t.columns.length,
      consumers: t.consumers.length,
      version: t.version,
    };
  });

  return {
    lockedCount: LOCKED_TABLES_REGISTRY.length,
    totalColumns,
    totalConsumers: consumerSet.size,
    tables,
  };
}
