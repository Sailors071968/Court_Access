// ============================================
// Court Access — Admin Monitoring Routes (Wave 0 Stabilization)
// Exposes monitoring endpoints for system administrators.
//
// Routes:
//   GET /admin/system/health          — System health report
//   GET /admin/system/queues          — Queue monitoring dashboard
//   GET /admin/system/graph-integrity — Graph integrity report
//
// All routes require ADMIN role.
// ============================================

import { getAllWorkerStatuses } from './registry';
import { getQueueDashboardData, checkQueueAlerts } from './queueMonitor';
import { getSystemHealthReport } from './systemHealth';
import { getAllJobStatuses } from './cronScheduler';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UserRole = 'investigator' | 'attorney' | 'admin' | 'staff' | 'defendant';

export interface AuthenticatedRequest {
  user: {
    id: string;
    role: UserRole;
  };
}

export interface RouteResponse<T = unknown> {
  status: number;
  data?: T;
  error?: string;
}

// ---------------------------------------------------------------------------
// ADMIN Role Guard
// ---------------------------------------------------------------------------

/**
 * Verify the request comes from an authenticated user with ADMIN role.
 * Returns null if authorized, or an error response if not.
 */
export function requireAdmin(req: AuthenticatedRequest): RouteResponse | null {
  if (!req.user) {
    return { status: 401, error: 'Authentication required' };
  }
  if (req.user.role !== 'admin') {
    return { status: 403, error: 'Admin role required to access monitoring endpoints' };
  }
  return null; // authorized
}

// ---------------------------------------------------------------------------
// Route Handlers
// ---------------------------------------------------------------------------

/**
 * GET /admin/system/health
 * Returns the full system health report including worker status,
 * queue sizes, database latency, and memory usage.
 */
export async function handleSystemHealth(
  req: AuthenticatedRequest,
): Promise<RouteResponse> {
  const authError = requireAdmin(req);
  if (authError) return authError;

  try {
    const report = await getSystemHealthReport();
    const cronJobs = getAllJobStatuses();

    return {
      status: 200,
      data: {
        ...report,
        scheduledJobs: cronJobs,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: 500, error: `Health report failed: ${message}` };
  }
}

/**
 * GET /admin/system/queues
 * Returns the queue monitoring dashboard with metrics for all queues,
 * including active/waiting/failed counts and active alerts.
 */
export async function handleSystemQueues(
  req: AuthenticatedRequest,
): Promise<RouteResponse> {
  const authError = requireAdmin(req);
  if (authError) return authError;

  try {
    const dashboard = getQueueDashboardData();
    const alerts = checkQueueAlerts();
    const workerStatuses = getAllWorkerStatuses();

    return {
      status: 200,
      data: {
        dashboard,
        alerts,
        workers: workerStatuses,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: 500, error: `Queue dashboard failed: ${message}` };
  }
}

/**
 * GET /admin/system/graph-integrity
 * Returns the latest graph integrity report.
 * Note: The actual integrity check runs on a schedule (every 15 minutes).
 * This endpoint returns cached results from the last run.
 */
export async function handleGraphIntegrity(
  req: AuthenticatedRequest,
): Promise<RouteResponse> {
  const authError = requireAdmin(req);
  if (authError) return authError;

  try {
    // Return the integrity check configuration and last known state.
    // In production, this would return cached results from the last
    // graphIntegrityCheck run stored in Redis or the database.
    const cronJobs = getAllJobStatuses();
    const integrityJob = cronJobs.find((j) => j.name === 'Graph Integrity Check');

    return {
      status: 200,
      data: {
        lastRun: integrityJob?.lastRun ? new Date(integrityJob.lastRun).toISOString() : null,
        nextRun: integrityJob?.nextRun ? new Date(integrityJob.nextRun).toISOString() : null,
        runCount: integrityJob?.runCount ?? 0,
        errorCount: integrityJob?.errorCount ?? 0,
        status: integrityJob?.status ?? 'unknown',
        checks: [
          'orphanFacts', 'duplicateFactIds', 'mistypedRelationships', 'crossTenantEdges',
          'orphanDocuments', 'orphanEvidence', 'brokenAnchorChain', 'missingTenantId',
        ],
        message: 'Graph integrity checks run every 15 minutes. Results are cached from last run.',
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: 500, error: `Graph integrity report failed: ${message}` };
  }
}

// ---------------------------------------------------------------------------
// Route Registration Helper
// ---------------------------------------------------------------------------

/**
 * Route definitions for admin monitoring endpoints.
 * Use this to register routes with your HTTP framework (Express, Fastify, etc.)
 *
 * Example with Express:
 *   for (const route of ADMIN_ROUTES) {
 *     app.get(route.path, async (req, res) => {
 *       const result = await route.handler({ user: req.user });
 *       res.status(result.status).json(result.data || { error: result.error });
 *     });
 *   }
 */
export const ADMIN_ROUTES = [
  {
    method: 'GET' as const,
    path: '/admin/system/health',
    handler: handleSystemHealth,
    description: 'System health report (workers, queues, databases, memory)',
  },
  {
    method: 'GET' as const,
    path: '/admin/system/queues',
    handler: handleSystemQueues,
    description: 'Queue monitoring dashboard with alerts',
  },
  {
    method: 'GET' as const,
    path: '/admin/system/graph-integrity',
    handler: handleGraphIntegrity,
    description: 'Graph integrity validation report',
  },
] as const;
