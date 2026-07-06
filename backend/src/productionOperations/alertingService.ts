// ============================================================================
// Program 21 — Operations Alerting
// ============================================================================

import type { BillingReadinessMetrics } from '../billing/billingMetricsService.js';
import type { ProductionMetrics } from '../legislative/productionMetrics.js';
import type { OperationsAlert, OperationsDashboard } from './types.js';

export function evaluateOperationsAlerts(
  dashboard: OperationsDashboard,
  billing: BillingReadinessMetrics,
  legislative: ProductionMetrics,
): OperationsAlert[] {
  const alerts: OperationsAlert[] = [];
  const now = new Date().toISOString();

  const push = (
    id: string,
    severity: OperationsAlert['severity'],
    category: string,
    message: string,
    source: string,
    recoveryBehavior: string,
  ) => {
    alerts.push({ id, severity, category, message, source, triggeredAt: now, recoveryBehavior });
  };

  if (dashboard.queues.status !== 'healthy') {
    const failed = Object.values(dashboard.queues.queues).reduce((s, q) => s + Math.max(0, q.failed), 0);
    const waiting = Object.values(dashboard.queues.queues).reduce((s, q) => s + Math.max(0, q.waiting), 0);
    if (failed > 10) {
      push('queue-failed-jobs', failed > 50 ? 'critical' : 'warning', 'background_jobs', `${failed} failed background jobs`, 'queues', 'Inspect failed jobs and retry or clean dead-letter queue');
    }
    if (waiting > 100) {
      push('queue-backlog', waiting > 500 ? 'critical' : 'warning', 'queue_backlog', `${waiting} jobs waiting in queues`, 'queues', 'Scale workers or investigate processing bottlenecks');
    }
  }

  if (dashboard.database.status === 'unhealthy') {
    push('database-connectivity', 'critical', 'database', 'Database connectivity failure', 'postgres', 'Check DATABASE_URL and PostgreSQL availability');
  }

  if (dashboard.redis.status === 'unhealthy') {
    push('redis-connectivity', 'critical', 'redis', 'Redis connectivity or memory critical', 'redis', 'Check REDIS_URL and memory limits');
  } else if (dashboard.redis.status === 'degraded') {
    push('redis-memory', 'warning', 'redis', dashboard.redis.message ?? 'Redis memory elevated', 'redis', 'Review Redis memory usage and eviction policy');
  }

  if (billing.overallBillingIntegrity === 'FAIL') {
    push('stripe-failures', 'critical', 'stripe', 'Stripe billing integrity FAIL', 'billing', 'Run npm run billing:certify and fix failing workflows');
  } else if (dashboard.productionGates.deploymentBlocked) {
    push('production-gates-blocked', 'warning', 'production_gates', 'Production deployment blocked by gate failures', 'productionGates', 'Run npm run gates:run and resolve blockers');
  }

  if (billing.webhookEventsLast24h === 0 && billing.stripeConfigured) {
    push('webhook-silence', 'warning', 'stripe', 'No Stripe webhook events in last 24h', 'billing', 'Verify webhook endpoint and Stripe dashboard configuration');
  }

  if (billing.emailSync === 'NOT_IMPLEMENTED') {
    push('email-not-configured', 'warning', 'email', 'Billing email delivery not fully configured', 'email', 'Configure AWS SES or accept simulated audit logging');
  }

  if (legislative.repositoryIntegrity === 'FAIL') {
    push('repository-validation', 'critical', 'repository', 'Repository integrity validation failed', 'legislative', 'Run leginfo:classify and fix parsing failures');
  }

  if (legislative.parsingFailures > 0) {
    push('legislative-ingestion', 'warning', 'legislative', `${legislative.parsingFailures} legislative parsing failures`, 'legislative', 'Review extraction audit log and reprocess failed sections');
  }

  if (dashboard.performance.errorRate > 0.05) {
    push('high-error-rate', 'critical', 'api', `API error rate ${(dashboard.performance.errorRate * 100).toFixed(1)}%`, 'api', 'Review security logs and application errors');
  } else if (dashboard.performance.errorRate > 0.01) {
    push('elevated-error-rate', 'warning', 'api', `API error rate ${(dashboard.performance.errorRate * 100).toFixed(1)}%`, 'api', 'Monitor error trends');
  }

  if (dashboard.resources.memory.status === 'unhealthy') {
    push('high-memory', 'critical', 'resources', `Memory pressure heap=${dashboard.resources.memory.heapUsedMB}MB`, 'resources', 'Restart workers or scale instance memory');
  }

  if (dashboard.resources.cpu.status === 'unhealthy') {
    push('high-cpu', 'critical', 'resources', 'CPU load elevated', 'resources', 'Scale horizontally or reduce worker concurrency');
  }

  if (dashboard.resources.disk.status === 'unhealthy') {
    push('low-disk', 'critical', 'resources', 'Low disk space', 'resources', 'Free disk space or expand volume');
  }

  return alerts;
}
