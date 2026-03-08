// ============================================
// Court Access — API Integration Registry Routes
// Staff-admin-only route handlers for managing API providers,
// credentials, connection testing, and usage logs.
// ============================================

import { PrismaClient } from '@prisma/client';
import { ProviderManager } from './providerManager.js';
import { ApiRegistryService } from './apiRegistryService.js';
import { ApiHealthChecker } from './apiHealthChecker.js';
import { PROVIDER_TYPES } from './types.js';
import type {
  AddProviderRequest,
  UpdateProviderRequest,
  AddCredentialRequest,
  ProviderType,
} from './types.js';

// ---------------------------------------------------------------------------
// Types (compatible with existing adminRoutes.ts pattern)
// ---------------------------------------------------------------------------

export type UserRole = 'investigator' | 'attorney' | 'admin' | 'staff' | 'defendant';

export interface AuthenticatedRequest {
  user: {
    id: string;
    role: UserRole;
  };
  body?: unknown;
  params?: Record<string, string>;
  query?: Record<string, string>;
}

export interface RouteResponse<T = unknown> {
  status: number;
  data?: T;
  error?: string;
}

// ---------------------------------------------------------------------------
// Staff/Admin Role Guard
// ---------------------------------------------------------------------------

function requireStaffOrAdmin(req: AuthenticatedRequest): RouteResponse | null {
  if (!req.user) {
    return { status: 401, error: 'Authentication required' };
  }
  if (req.user.role !== 'admin' && req.user.role !== 'staff') {
    return { status: 403, error: 'Staff or Admin role required to access API registry' };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Route Handler Factory
// ---------------------------------------------------------------------------

export function createApiRegistryRoutes(prisma: PrismaClient) {
  const providerManager = new ProviderManager(prisma);
  const registryService = new ApiRegistryService(prisma);
  const healthChecker = new ApiHealthChecker(prisma);

  // -----------------------------------------------------------------------
  // POST /api/integrations/providers — Add a new provider
  // -----------------------------------------------------------------------
  async function handleAddProvider(req: AuthenticatedRequest): Promise<RouteResponse> {
    const authError = requireStaffOrAdmin(req);
    if (authError) return authError;

    const body = req.body as AddProviderRequest | undefined;
    if (!body?.name || !body?.providerType || !body?.baseUrl) {
      return { status: 400, error: 'Missing required fields: name, providerType, baseUrl' };
    }

    if (!PROVIDER_TYPES.includes(body.providerType as ProviderType)) {
      return { status: 400, error: `Invalid providerType. Must be one of: ${PROVIDER_TYPES.join(', ')}` };
    }

    try {
      const provider = await providerManager.addProvider(body);
      return { status: 201, data: provider };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('Unique constraint')) {
        return { status: 409, error: `Provider with name "${body.name}" already exists` };
      }
      return { status: 500, error: `Failed to add provider: ${message}` };
    }
  }

  // -----------------------------------------------------------------------
  // GET /api/integrations/providers — List all providers
  // -----------------------------------------------------------------------
  async function handleListProviders(req: AuthenticatedRequest): Promise<RouteResponse> {
    const authError = requireStaffOrAdmin(req);
    if (authError) return authError;

    try {
      const providers = await providerManager.listProviders();
      return { status: 200, data: providers };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { status: 500, error: `Failed to list providers: ${message}` };
    }
  }

  // -----------------------------------------------------------------------
  // GET /api/integrations/providers/:id — Get a single provider
  // -----------------------------------------------------------------------
  async function handleGetProvider(req: AuthenticatedRequest): Promise<RouteResponse> {
    const authError = requireStaffOrAdmin(req);
    if (authError) return authError;

    const id = req.params?.id;
    if (!id) return { status: 400, error: 'Missing provider ID' };

    try {
      const provider = await providerManager.getProvider(id);
      if (!provider) return { status: 404, error: 'Provider not found' };
      return { status: 200, data: provider };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { status: 500, error: `Failed to get provider: ${message}` };
    }
  }

  // -----------------------------------------------------------------------
  // PATCH /api/integrations/providers/:id — Update provider (enable/disable)
  // -----------------------------------------------------------------------
  async function handleUpdateProvider(req: AuthenticatedRequest): Promise<RouteResponse> {
    const authError = requireStaffOrAdmin(req);
    if (authError) return authError;

    const id = req.params?.id;
    if (!id) return { status: 400, error: 'Missing provider ID' };

    const body = req.body as UpdateProviderRequest | undefined;
    if (!body) return { status: 400, error: 'Missing request body' };

    try {
      const provider = await providerManager.updateProvider(id, body);
      return { status: 200, data: provider };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { status: 500, error: `Failed to update provider: ${message}` };
    }
  }

  // -----------------------------------------------------------------------
  // DELETE /api/integrations/providers/:id — Delete a provider
  // -----------------------------------------------------------------------
  async function handleDeleteProvider(req: AuthenticatedRequest): Promise<RouteResponse> {
    const authError = requireStaffOrAdmin(req);
    if (authError) return authError;

    const id = req.params?.id;
    if (!id) return { status: 400, error: 'Missing provider ID' };

    try {
      await providerManager.deleteProvider(id);
      return { status: 200, data: { message: 'Provider deleted' } };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { status: 500, error: `Failed to delete provider: ${message}` };
    }
  }

  // -----------------------------------------------------------------------
  // POST /api/integrations/credentials/:providerId — Add credential
  // -----------------------------------------------------------------------
  async function handleAddCredential(req: AuthenticatedRequest): Promise<RouteResponse> {
    const authError = requireStaffOrAdmin(req);
    if (authError) return authError;

    const providerId = req.params?.providerId;
    if (!providerId) return { status: 400, error: 'Missing provider ID' };

    const body = req.body as AddCredentialRequest | undefined;
    if (!body?.apiKey) return { status: 400, error: 'Missing required field: apiKey' };

    try {
      const credential = await providerManager.addCredential(providerId, body);
      return { status: 201, data: credential };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { status: 500, error: `Failed to add credential: ${message}` };
    }
  }

  // -----------------------------------------------------------------------
  // GET /api/integrations/credentials/:providerId — List credentials
  // -----------------------------------------------------------------------
  async function handleListCredentials(req: AuthenticatedRequest): Promise<RouteResponse> {
    const authError = requireStaffOrAdmin(req);
    if (authError) return authError;

    const providerId = req.params?.providerId;
    if (!providerId) return { status: 400, error: 'Missing provider ID' };

    try {
      const credentials = await providerManager.listCredentials(providerId);
      return { status: 200, data: credentials };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { status: 500, error: `Failed to list credentials: ${message}` };
    }
  }

  // -----------------------------------------------------------------------
  // POST /api/integrations/credentials/:providerId/rotate — Rotate key
  // -----------------------------------------------------------------------
  async function handleRotateCredential(req: AuthenticatedRequest): Promise<RouteResponse> {
    const authError = requireStaffOrAdmin(req);
    if (authError) return authError;

    const providerId = req.params?.providerId;
    if (!providerId) return { status: 400, error: 'Missing provider ID' };

    const body = req.body as { credentialId?: string; newApiKey?: string } | undefined;
    if (!body?.credentialId || !body?.newApiKey) {
      return { status: 400, error: 'Missing required fields: credentialId, newApiKey' };
    }

    try {
      const credential = await providerManager.rotateCredential(providerId, body.credentialId, body.newApiKey);
      return { status: 200, data: credential };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { status: 500, error: `Failed to rotate credential: ${message}` };
    }
  }

  // -----------------------------------------------------------------------
  // POST /api/integrations/test/:providerId — Test connection
  // -----------------------------------------------------------------------
  async function handleTestConnection(req: AuthenticatedRequest): Promise<RouteResponse> {
    const authError = requireStaffOrAdmin(req);
    if (authError) return authError;

    const providerId = req.params?.providerId;
    if (!providerId) return { status: 400, error: 'Missing provider ID' };

    try {
      const result = await registryService.testConnection(providerId);
      return { status: 200, data: result };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { status: 500, error: `Failed to test connection: ${message}` };
    }
  }

  // -----------------------------------------------------------------------
  // GET /api/integrations/usage-logs — View usage logs with filtering
  // -----------------------------------------------------------------------
  async function handleGetUsageLogs(req: AuthenticatedRequest): Promise<RouteResponse> {
    const authError = requireStaffOrAdmin(req);
    if (authError) return authError;

    const query = req.query ?? {};
    const options: {
      providerId?: string;
      limit?: number;
      offset?: number;
      startDate?: Date;
      endDate?: Date;
    } = {};

    if (query.providerId) options.providerId = query.providerId;
    if (query.limit) options.limit = parseInt(query.limit, 10);
    if (query.offset) options.offset = parseInt(query.offset, 10);
    if (query.startDate) options.startDate = new Date(query.startDate);
    if (query.endDate) options.endDate = new Date(query.endDate);

    try {
      const result = await registryService.getUsageLogs(options);
      return { status: 200, data: result };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { status: 500, error: `Failed to get usage logs: ${message}` };
    }
  }

  // -----------------------------------------------------------------------
  // GET /api/integrations/usage-stats/:providerId — Usage statistics
  // -----------------------------------------------------------------------
  async function handleGetUsageStats(req: AuthenticatedRequest): Promise<RouteResponse> {
    const authError = requireStaffOrAdmin(req);
    if (authError) return authError;

    const providerId = req.params?.providerId;
    if (!providerId) return { status: 400, error: 'Missing provider ID' };

    try {
      const stats = await registryService.getUsageStats(providerId);
      return { status: 200, data: stats };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { status: 500, error: `Failed to get usage stats: ${message}` };
    }
  }

  // -----------------------------------------------------------------------
  // POST /api/integrations/health-check — Trigger health check now
  // -----------------------------------------------------------------------
  async function handleTriggerHealthCheck(req: AuthenticatedRequest): Promise<RouteResponse> {
    const authError = requireStaffOrAdmin(req);
    if (authError) return authError;

    try {
      const results = await healthChecker.runHealthChecks();
      return { status: 200, data: results };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { status: 500, error: `Failed to run health checks: ${message}` };
    }
  }

  // -----------------------------------------------------------------------
  // Route Table
  // -----------------------------------------------------------------------

  const API_REGISTRY_ROUTES = [
    { method: 'POST' as const, path: '/api/integrations/providers', handler: handleAddProvider, description: 'Add a new API provider' },
    { method: 'GET' as const, path: '/api/integrations/providers', handler: handleListProviders, description: 'List all API providers' },
    { method: 'GET' as const, path: '/api/integrations/providers/:id', handler: handleGetProvider, description: 'Get a single provider' },
    { method: 'PATCH' as const, path: '/api/integrations/providers/:id', handler: handleUpdateProvider, description: 'Update provider (enable/disable)' },
    { method: 'DELETE' as const, path: '/api/integrations/providers/:id', handler: handleDeleteProvider, description: 'Delete a provider' },
    { method: 'POST' as const, path: '/api/integrations/credentials/:providerId', handler: handleAddCredential, description: 'Add credential for provider' },
    { method: 'GET' as const, path: '/api/integrations/credentials/:providerId', handler: handleListCredentials, description: 'List credentials for provider' },
    { method: 'POST' as const, path: '/api/integrations/credentials/:providerId/rotate', handler: handleRotateCredential, description: 'Rotate API key' },
    { method: 'POST' as const, path: '/api/integrations/test/:providerId', handler: handleTestConnection, description: 'Test provider connection' },
    { method: 'GET' as const, path: '/api/integrations/usage-logs', handler: handleGetUsageLogs, description: 'View usage logs' },
    { method: 'GET' as const, path: '/api/integrations/usage-stats/:providerId', handler: handleGetUsageStats, description: 'Provider usage statistics' },
    { method: 'POST' as const, path: '/api/integrations/health-check', handler: handleTriggerHealthCheck, description: 'Trigger health check' },
  ] as const;

  return {
    routes: API_REGISTRY_ROUTES,
    providerManager,
    registryService,
    healthChecker,
  };
}
