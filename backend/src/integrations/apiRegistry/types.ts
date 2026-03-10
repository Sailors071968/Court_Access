// ============================================
// Court Access — API Integration Registry Types
// Shared type definitions for the API registry system.
// ============================================

// ---------------------------------------------------------------------------
// Provider Types (categories)
// ---------------------------------------------------------------------------

export type ProviderType =
  | 'AI_REASONING'
  | 'AI_PRESENTATION'
  | 'LEGAL_DATA'
  | 'MEDIA_ANALYSIS'
  | 'GRAPH'
  | 'ANALYTICS';

export const PROVIDER_TYPES: ProviderType[] = [
  'AI_REASONING',
  'AI_PRESENTATION',
  'LEGAL_DATA',
  'MEDIA_ANALYSIS',
  'GRAPH',
  'ANALYTICS',
];

// ---------------------------------------------------------------------------
// Health Status
// ---------------------------------------------------------------------------

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

export type CredentialEnvironment = 'production' | 'staging' | 'development';

// ---------------------------------------------------------------------------
// Request/Response Shapes
// ---------------------------------------------------------------------------

export interface AddProviderRequest {
  name: string;
  providerType: ProviderType;
  baseUrl: string;
  documentationUrl?: string;
}

export interface UpdateProviderRequest {
  enabled?: boolean;
  baseUrl?: string;
  documentationUrl?: string;
}

export interface AddCredentialRequest {
  apiKey: string;
  environment?: CredentialEnvironment;
  rateLimitPerMinute?: number;
}

export interface RotateCredentialRequest {
  newApiKey: string;
}

export interface ProviderSummary {
  id: string;
  name: string;
  providerType: ProviderType;
  baseUrl: string;
  documentationUrl: string | null;
  enabled: boolean;
  healthStatus: HealthStatus;
  lastHealthCheck: string | null;
  credentialCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CredentialSummary {
  id: string;
  providerId: string;
  environment: string;
  rateLimitPerMinute: number;
  lastValidatedAt: string | null;
  isActive: boolean;
  maskedKey: string;
  createdAt: string;
}

export interface UsageLogEntry {
  id: string;
  providerId: string;
  providerName: string;
  endpointUsed: string;
  requestTimestamp: string;
  responseStatus: number;
  latencyMs: number;
  errorMessage: string | null;
}

export interface TestConnectionResult {
  providerId: string;
  providerName: string;
  status: 'success' | 'error';
  latencyMs: number;
  message: string;
  timestamp: string;
}

export interface HealthCheckResult {
  providerId: string;
  providerName: string;
  previousStatus: HealthStatus;
  newStatus: HealthStatus;
  latencyMs: number;
  message: string;
  checkedAt: string;
}

export interface UsageStats {
  totalRequests: number;
  successCount: number;
  errorCount: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
}
