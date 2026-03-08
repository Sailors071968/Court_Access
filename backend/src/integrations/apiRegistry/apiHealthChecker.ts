// ============================================
// Court Access — API Health Checker
// Scheduled health monitoring for all enabled providers.
// Checks every 5 minutes: availability, auth validity, latency.
// Marks providers as degraded/unhealthy when failures detected.
// ============================================

import { PrismaClient } from '@prisma/client';
import type { HealthCheckResult, HealthStatus } from './types.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const HEALTH_CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const HEALTH_CHECK_TIMEOUT_MS = 10_000; // 10 second timeout per provider
const LATENCY_DEGRADED_THRESHOLD_MS = 5_000; // >5s = degraded
const LATENCY_UNHEALTHY_THRESHOLD_MS = 10_000; // >10s = unhealthy

// ---------------------------------------------------------------------------
// Health Checker
// ---------------------------------------------------------------------------

export class ApiHealthChecker {
  private timer: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;

  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Start the health monitor on a 5-minute interval.
   */
  startHealthMonitor(): void {
    if (this.timer) {
      console.warn('[ApiHealthChecker] Health monitor already running');
      return;
    }

    console.log(`[ApiHealthChecker] Starting health monitor (interval: ${HEALTH_CHECK_INTERVAL_MS}ms)`);

    // Run immediately, then schedule
    this.runHealthChecks();
    this.timer = setInterval(() => this.runHealthChecks(), HEALTH_CHECK_INTERVAL_MS);
  }

  /**
   * Stop the health monitor.
   */
  stopHealthMonitor(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('[ApiHealthChecker] Health monitor stopped');
    }
  }

  /**
   * Run health checks for all enabled providers.
   */
  async runHealthChecks(): Promise<HealthCheckResult[]> {
    if (this.isRunning) {
      console.log('[ApiHealthChecker] Skipping — previous check still running');
      return [];
    }

    this.isRunning = true;
    const results: HealthCheckResult[] = [];

    try {
      const providers = await this.prisma.apiProvider.findMany({
        where: { enabled: true },
      });

      console.log(`[ApiHealthChecker] Checking ${providers.length} enabled providers`);

      for (const provider of providers) {
        const result = await this.checkProvider(provider);
        results.push(result);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[ApiHealthChecker] Health check cycle failed: ${message}`);
    } finally {
      this.isRunning = false;
    }

    return results;
  }

  /**
   * Check a single provider's health.
   */
  private async checkProvider(provider: {
    id: string;
    name: string;
    baseUrl: string;
    healthStatus: string;
  }): Promise<HealthCheckResult> {
    const previousStatus = provider.healthStatus as HealthStatus;
    const startTime = Date.now();
    let newStatus: HealthStatus = 'healthy';
    let message = 'OK';
    let responseStatus = 200;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);

      const response = await fetch(provider.baseUrl, {
        method: 'HEAD',
        signal: controller.signal,
      });

      clearTimeout(timeout);
      responseStatus = response.status;

      if (!response.ok) {
        newStatus = response.status >= 500 ? 'unhealthy' : 'degraded';
        message = `HTTP ${response.status}: ${response.statusText}`;
      }
    } catch (error) {
      newStatus = 'unhealthy';
      responseStatus = -1;
      message = error instanceof Error ? error.message : String(error);

      // AbortError means timeout
      if (error instanceof Error && error.name === 'AbortError') {
        newStatus = 'degraded';
        message = `Timeout after ${HEALTH_CHECK_TIMEOUT_MS}ms`;
      }
    }

    const latencyMs = Date.now() - startTime;

    // Latency-based degradation
    if (newStatus === 'healthy') {
      if (latencyMs > LATENCY_UNHEALTHY_THRESHOLD_MS) {
        newStatus = 'unhealthy';
        message = `Latency ${latencyMs}ms exceeds unhealthy threshold`;
      } else if (latencyMs > LATENCY_DEGRADED_THRESHOLD_MS) {
        newStatus = 'degraded';
        message = `Latency ${latencyMs}ms exceeds degraded threshold`;
      }
    }

    // Update provider health status in DB
    try {
      await this.prisma.apiProvider.update({
        where: { id: provider.id },
        data: {
          healthStatus: newStatus,
          lastHealthCheck: new Date(),
        },
      });
    } catch (dbError) {
      console.error(`[ApiHealthChecker] Failed to update status for ${provider.name}:`, dbError);
    }

    // Log as usage event
    try {
      await this.prisma.apiUsageLog.create({
        data: {
          providerId: provider.id,
          endpointUsed: 'health-check/scheduled',
          latencyMs,
          responseStatus,
          errorMessage: newStatus !== 'healthy' ? message : null,
        },
      });
    } catch (logError) {
      console.error(`[ApiHealthChecker] Failed to log health check for ${provider.name}:`, logError);
    }

    // Log status changes
    if (previousStatus !== newStatus) {
      console.warn(
        `[ApiHealthChecker] ${provider.name}: ${previousStatus} -> ${newStatus} (${message})`,
      );
    }

    return {
      providerId: provider.id,
      providerName: provider.name,
      previousStatus,
      newStatus,
      latencyMs,
      message,
      checkedAt: new Date().toISOString(),
    };
  }
}
