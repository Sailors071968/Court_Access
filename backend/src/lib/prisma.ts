// ============================================================================
// CourtAccess — Prisma Client Singleton (Hardened for Scale)
// Single shared PrismaClient instance for all database operations.
// Includes connection pooling config, query timeout, transaction timeout.
//
// IMPORTANT: All modules MUST import from this file.
// Do NOT create new PrismaClient() anywhere else in the codebase.
// ============================================================================

import { PrismaClient } from '@prisma/client';

// ---------------------------------------------------------------------------
// Timeout Configuration (tuneable via env vars)
// ---------------------------------------------------------------------------

const QUERY_TIMEOUT_MS = parseInt(process.env.PRISMA_QUERY_TIMEOUT_MS || '30000', 10);
const TRANSACTION_TIMEOUT_MS = parseInt(process.env.PRISMA_TRANSACTION_TIMEOUT_MS || '60000', 10);

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? ['warn', 'error']
      : ['error'],
    transactionOptions: {
      maxWait: QUERY_TIMEOUT_MS,
      timeout: TRANSACTION_TIMEOUT_MS,
      isolationLevel: 'ReadCommitted',
    },
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// ---------------------------------------------------------------------------
// Connection Health Check
// ---------------------------------------------------------------------------

/**
 * Check if the database connection is alive.
 * Returns latency in ms, or throws if connection fails.
 */
export async function checkDatabaseHealth(): Promise<{ latencyMs: number }> {
  const start = performance.now();
  await prisma.$queryRaw`SELECT 1`;
  return { latencyMs: Math.round(performance.now() - start) };
}

// ---------------------------------------------------------------------------
// Graceful Disconnect
// ---------------------------------------------------------------------------

/**
 * Gracefully disconnect the Prisma client.
 * Call this during server shutdown to release all connections.
 */
export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
  console.log('[Prisma] Disconnected from database');
}

export default prisma;
