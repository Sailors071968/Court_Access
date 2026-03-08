// ============================================
// Court Access — API Integration Registry (Barrel Export)
// Central entry point for all API registry components.
// ============================================

export { encrypt, decrypt, maskApiKey } from './credentialEncryption.js';
export { ProviderManager } from './providerManager.js';
export { ApiRegistryService } from './apiRegistryService.js';
export { ApiHealthChecker } from './apiHealthChecker.js';
export { createApiRegistryRoutes } from './routes.js';
export type {
  ProviderType,
  HealthStatus,
  CredentialEnvironment,
  AddProviderRequest,
  UpdateProviderRequest,
  AddCredentialRequest,
  RotateCredentialRequest,
  ProviderSummary,
  CredentialSummary,
  UsageLogEntry,
  TestConnectionResult,
  HealthCheckResult,
  UsageStats,
} from './types.js';
export { PROVIDER_TYPES } from './types.js';
