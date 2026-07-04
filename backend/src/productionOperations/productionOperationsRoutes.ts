// ============================================================================
// Program 21 — Production Operations API Routes
// ============================================================================

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { AuthenticatedRequest } from '../security/authMiddleware.js';
import { buildOperationsDashboard, buildSystemHealthAdapter } from './operationsDashboard.js';
import { queryAuditCenter } from './auditCenter.js';
import { buildChangeManagementReport } from './changeManagement.js';
import { buildBackupOperationsReport, runBackupVerificationDrill } from './backupOperations.js';
import { generateEngineeringDashboard } from '../legislative/engineeringDashboard.js';
import { generateRepositoryIntegrityDashboard } from '../legislative/repositoryIntegrityDashboard.ts';
import type { AuditCenterQuery } from './types.js';

function requireAdminStaff(request: AuthenticatedRequest, reply: FastifyReply): boolean {
  const user = request.user;
  if (!user) {
    void reply.code(401).send({ error: 'Authentication required' });
    return false;
  }
  if (user.role !== 'admin' && user.role !== 'staff') {
    void reply.code(403).send({ error: 'Admin or staff access required' });
    return false;
  }
  return true;
}

export async function registerProductionOperationsRoutes(app: FastifyInstance): Promise<void> {
  // Unified operations dashboard (admin)
  app.get('/api/admin/operations/dashboard', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdminStaff(request, reply)) return;
    try {
      return reply.send(await buildOperationsDashboard());
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.code(500).send({ error: 'Failed to build operations dashboard', message });
    }
  });

  // Legacy system health adapter for SystemHealthDashboard.tsx
  app.get('/api/system/health', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      return reply.send(await buildSystemHealthAdapter());
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.code(500).send({ error: 'Failed to build system health', message });
    }
  });

  // Deployment checks for BetaDeploymentVerification.tsx
  app.get('/api/admin/deployment-checks', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdminStaff(request, reply)) return;
    const dashboard = await buildOperationsDashboard();
    return reply.send({
      generatedAt: dashboard.generatedAt,
      deploymentBlocked: dashboard.productionGates.deploymentBlocked,
      overallStatus: dashboard.overallStatus,
      gates: dashboard.productionGates,
      checks: dashboard.productionGates.gates.map((g) => ({
        id: g.id,
        name: g.name,
        status: g.result === 'PASS' ? 'pass' : g.result === 'FAIL' ? 'fail' : 'partial',
      })),
      alerts: dashboard.alerts,
    });
  });

  // Engineering dashboard live API
  app.get('/api/admin/engineering-dashboard', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdminStaff(request, reply)) return;
    return reply.send(await generateEngineeringDashboard());
  });

  // Audit center
  app.get('/api/admin/audit', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdminStaff(request, reply)) return;
    const q = request.query as AuditCenterQuery;
    return reply.send(await queryAuditCenter(q));
  });

  // Change management
  app.get('/api/admin/changes', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdminStaff(request, reply)) return;
    return reply.send(await buildChangeManagementReport());
  });

  // Repository integrity dashboard (Epic H)
  app.get('/api/admin/repository-integrity', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdminStaff(request, reply)) return;
    return reply.send(await generateRepositoryIntegrityDashboard());
  });

  // Backup operations
  app.get('/api/admin/backup/status', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdminStaff(request, reply)) return;
    return reply.send(await buildBackupOperationsReport());
  });

  app.post('/api/admin/backup/verify', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdminStaff(request, reply)) return;
    const result = await runBackupVerificationDrill();
    return reply.send({ generatedAt: new Date().toISOString(), ...result });
  });

  // Active alerts
  app.get('/api/admin/alerts', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdminStaff(request, reply)) return;
    const dashboard = await buildOperationsDashboard();
    return reply.send({
      generatedAt: dashboard.generatedAt,
      count: dashboard.alerts.length,
      alerts: dashboard.alerts,
    });
  });

  console.log('[ProductionOperations] Routes registered: /api/admin/operations/*, /api/system/health');
}
