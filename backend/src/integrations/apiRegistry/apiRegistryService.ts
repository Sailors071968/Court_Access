// ============================================
// Court Access — API Registry Service
// Runtime credential resolution, rate limiting, and usage logging.
// Application services call this to resolve provider credentials.
// ============================================

import { PrismaClient } from '@prisma/client';
import { decrypt } from './credentialEncryption.js';
import type { UsageLogEntry, UsageStats, TestConnectionResult } from './types.js';

// ---------------------------------------------------------------------------
// In-memory rate limit tracker
// ---------------------------------------------------------------------------

interface RateLimitBucket {
  count: number;
  windowStart: number;
}

const rateLimitBuckets = new Map<string, RateLimitBucket>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute

// ---------------------------------------------------------------------------
// API Registry Service
// ---------------------------------------------------------------------------

export class ApiRegistryService {
  constructor(private readonly prisma: PrismaClient) {}

  // -------------------------------------------------------------------------
  // Credential Resolution
  // -------------------------------------------------------------------------

  /**
   * Resolve credentials for a provider by name.
   * This is the primary entry point for application services:
   *   const creds = await registry.getProvider("NotebookLM");
   */
  async getProvider(name: string): Promise<{
    providerId: string;
    baseUrl: string;
    apiKey: string;
    rateLimitPerMinute: number;
  } | null> {
    const provider = await this.prisma.apiProvider.findUnique({
      where: { name },
      include: {
        credentials: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!provider || !provider.enabled || provider.credentials.length === 0) {
      return null;
    }

    const credential = provider.credentials[0];
    const apiKey = decrypt(credential.apiKeyEncrypted);

    return {
      providerId: provider.id,
      baseUrl: provider.baseUrl,
      apiKey,
      rateLimitPerMinute: credential.rateLimitPerMinute,
    };
  }

  // -------------------------------------------------------------------------
  // Rate Limiting
  // -------------------------------------------------------------------------

  /**
   * Check if a request is within rate limits for a provider.
   * Returns true if the request can proceed, false if rate-limited.
   */
  applyRateLimit(providerId: string, rateLimitPerMinute: number): boolean {
    const now = Date.now();
    const bucket = rateLimitBuckets.get(providerId);

    if (!bucket || now - bucket.windowStart >= RATE_LIMIT_WINDOW_MS) {
      // New window
      rateLimitBuckets.set(providerId, { count: 1, windowStart: now });
      return true;
    }

    if (bucket.count >= rateLimitPerMinute) {
      return false; // rate-limited
    }

    bucket.count += 1;
    return true;
  }

  // -------------------------------------------------------------------------
  // Usage Logging
  // -------------------------------------------------------------------------

  /**
   * Log a usage event for a provider.
   */
  async logUsage(
    providerId: string,
    endpointUsed: string,
    latencyMs: number,
    responseStatus: number,
    errorMessage?: string,
  ): Promise<void> {
    await this.prisma.apiUsageLog.create({
      data: {
        providerId,
        endpointUsed,
        latencyMs,
        responseStatus,
        errorMessage: errorMessage ?? null,
      },
    });
  }

  /**
   * Get usage logs with optional filtering.
   */
  async getUsageLogs(options: {
    providerId?: string;
    limit?: number;
    offset?: number;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{ logs: UsageLogEntry[]; total: number }> {
    const where: Record<string, unknown> = {};
    if (options.providerId) where.providerId = options.providerId;
    if (options.startDate || options.endDate) {
      const timestampFilter: Record<string, Date> = {};
      if (options.startDate) timestampFilter.gte = options.startDate;
      if (options.endDate) timestampFilter.lte = options.endDate;
      where.requestTimestamp = timestampFilter;
    }

    const [logs, total] = await Promise.all([
      this.prisma.apiUsageLog.findMany({
        where,
        include: { provider: { select: { name: true } } },
        orderBy: { requestTimestamp: 'desc' },
        take: options.limit ?? 50,
        skip: options.offset ?? 0,
      }),
      this.prisma.apiUsageLog.count({ where }),
    ]);

    return {
      logs: logs.map((log) => ({
        id: log.id,
        providerId: log.providerId,
        providerName: log.provider.name,
        endpointUsed: log.endpointUsed,
        requestTimestamp: log.requestTimestamp.toISOString(),
        responseStatus: log.responseStatus,
        latencyMs: log.latencyMs,
        errorMessage: log.errorMessage,
      })),
      total,
    };
  }

  /**
   * Get usage stats for a provider (bounded to last 7 days, max 10k records).
   */
  async getUsageStats(providerId: string): Promise<UsageStats> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const where = { providerId, requestTimestamp: { gte: sevenDaysAgo } };

    const [totalRequests, aggregation] = await Promise.all([
      this.prisma.apiUsageLog.count({ where }),
      this.prisma.apiUsageLog.aggregate({
        where,
        _avg: { latencyMs: true },
      }),
    ]);

    if (totalRequests === 0) {
      return { totalRequests: 0, successCount: 0, errorCount: 0, avgLatencyMs: 0, p95LatencyMs: 0 };
    }

    // Bounded sample for p95 and counts (max 10k most recent records)
    const logs = await this.prisma.apiUsageLog.findMany({
      where,
      select: { responseStatus: true, latencyMs: true },
      orderBy: { requestTimestamp: 'desc' },
      take: 10_000,
    });

    const successCount = logs.filter((l: { responseStatus: number }) => l.responseStatus >= 200 && l.responseStatus < 300).length;
    const errorCount = logs.filter((l: { responseStatus: number }) => l.responseStatus >= 400 || l.responseStatus < 0).length;
    const latencies = logs.map((l: { latencyMs: number }) => l.latencyMs).sort((a: number, b: number) => a - b);
    const p95Index = Math.floor(latencies.length * 0.95);
    const p95LatencyMs = latencies[p95Index] ?? latencies[latencies.length - 1] ?? 0;

    return {
      totalRequests,
      successCount,
      errorCount,
      avgLatencyMs: Math.round(aggregation._avg.latencyMs ?? 0),
      p95LatencyMs,
    };
  }

  // -------------------------------------------------------------------------
  // Connection Test
  // -------------------------------------------------------------------------

  /**
   * Test connectivity to a provider.
   * Performs a lightweight check (HEAD/GET to baseUrl) and logs the result.
   */
  async testConnection(providerId: string): Promise<TestConnectionResult> {
    const provider = await this.prisma.apiProvider.findUnique({
      where: { id: providerId },
    });

    if (!provider) {
      return {
        providerId,
        providerName: 'Unknown',
        status: 'error',
        latencyMs: 0,
        message: 'Provider not found',
        timestamp: new Date().toISOString(),
      };
    }

    const startTime = Date.now();
    let status: 'success' | 'error' = 'success';
    let message = 'Connection successful';
    let responseStatus = 200;

    try {
      // Attempt a HEAD request to the base URL
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      const response = await fetch(provider.baseUrl, {
        method: 'HEAD',
        signal: controller.signal,
      });

      clearTimeout(timeout);
      responseStatus = response.status;

      if (!response.ok) {
        status = 'error';
        message = `HTTP ${response.status}: ${response.statusText}`;
      }
    } catch (error) {
      status = 'error';
      responseStatus = -1;
      message = error instanceof Error ? error.message : String(error);
    }

    const latencyMs = Date.now() - startTime;

    // Log the test as a usage event
    await this.logUsage(providerId, 'health-check/test', latencyMs, responseStatus, status === 'error' ? message : undefined);

    return {
      providerId,
      providerName: provider.name,
      status,
      latencyMs,
      message,
      timestamp: new Date().toISOString(),
    };
  }
}
