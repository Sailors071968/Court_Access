// ============================================================================
// Program 21 — Production Operations Types
// ============================================================================

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface ComponentHealth {
  status: HealthStatus;
  latencyMs?: number;
  message?: string;
  details?: Record<string, unknown>;
}

export interface OperationsAlert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  category: string;
  message: string;
  source: string;
  triggeredAt: string;
  recoveryBehavior: string;
}

export interface AuditRecord {
  id: string;
  timestamp: string;
  source: 'security_db' | 'security_memory' | 'legislative' | 'billing' | 'admin';
  category: string;
  event: string;
  userId?: string | null;
  ip?: string | null;
  details?: string | null;
  severity?: string;
}

export interface ChangeRecord {
  id: string;
  type: 'release' | 'migration' | 'schema' | 'deployment';
  version?: string;
  description: string;
  timestamp: string;
  path?: string;
}

export interface BackupStatus {
  database: ComponentHealth;
  repositories: ComponentHealth;
  knowledgeGraph: ComponentHealth;
  configuration: ComponentHealth;
  lastVerifiedAt?: string;
  restoreDrillStatus: 'PASS' | 'FAIL' | 'NOT_RUN';
}

export interface OperationsDashboard {
  generatedAt: string;
  overallStatus: HealthStatus;
  productionGates: {
    overallResult: string;
    passCount: number;
    failCount: number;
    partialCount: number;
    deploymentBlocked: boolean;
    gates: Array<{ id: string; name: string; result: string }>;
  };
  systemHealth: ComponentHealth;
  apiHealth: ComponentHealth;
  database: ComponentHealth;
  redis: ComponentHealth;
  queues: ComponentHealth & { queues: Record<string, { waiting: number; active: number; completed: number; failed: number }> };
  ocrWorkers: ComponentHealth;
  aiWorkers: ComponentHealth;
  legislativePipeline: ComponentHealth;
  knowledgeGraph: ComponentHealth;
  repositoryIntegrity: ComponentHealth;
  stripeHealth: ComponentHealth;
  emailHealth: ComponentHealth;
  backgroundJobs: ComponentHealth;
  storage: ComponentHealth;
  resources: {
    cpu: { userMicros: number; systemMicros: number; status: HealthStatus };
    memory: { heapUsedMB: number; heapTotalMB: number; rssMB: number; status: HealthStatus };
    disk: { status: HealthStatus; message?: string };
    network: { status: HealthStatus; message?: string };
  };
  performance: {
    errorRate: number;
    responseTimeP50Ms: number;
    responseTimeP95Ms: number;
  };
  alerts: OperationsAlert[];
  observability: {
    productionGatesCoverage: number;
    repositoryCoveragePercent: number;
    legislativeCoveragePercent: number;
    knowledgeGraphCoveragePercent: number;
    attorneyWorkflowCoveragePercent: number;
    systemAvailability: HealthStatus;
    apiAvailability: HealthStatus;
    billingAvailability: HealthStatus;
  };
}

export interface AuditCenterQuery {
  source?: string;
  category?: string;
  event?: string;
  userId?: string;
  since?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface AuditCenterResult {
  generatedAt: string;
  total: number;
  records: AuditRecord[];
}

export interface ChangeManagementReport {
  generatedAt: string;
  releases: ChangeRecord[];
  migrations: ChangeRecord[];
  schemaHistory: ChangeRecord[];
  deployments: ChangeRecord[];
  rollbackProcedures: string[];
}

export interface BackupOperationsReport {
  generatedAt: string;
  status: BackupStatus;
  automated: {
    databaseBackups: boolean;
    repositorySnapshots: boolean;
    knowledgeGraphSnapshots: boolean;
    configurationBackups: boolean;
    restoreVerification: boolean;
    recoveryDrills: boolean;
  };
  blockers: string[];
}
