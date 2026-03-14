// ============================================================================
// CourtAccess — AI Credit Service
// Manages AI compute credits: balance tracking, usage logging, credit packs.
// Now persisted to PostgreSQL via Prisma (replaces in-memory Maps).
// ============================================================================

import prisma from '../lib/prisma.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AnalysisType =
  | 'VIDEO_PROCESSING'
  | 'CONTRADICTION_ENGINE'
  | 'DOCTRINE_ANALYSIS'
  | 'LITIGATION_INTELLIGENCE'
  | 'RELIABILITY_SCORING';

export interface AiCreditBalance {
  id: string;
  userId: string;
  monthlyCredits: number;
  purchasedCredits: number;
  creditsUsed: number;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  createdAt: string;
  updatedAt: string;
}

export interface AiCreditUsageEntry {
  id: string;
  userId: string;
  caseId: string | null;
  analysisType: AnalysisType;
  creditsUsed: number;
  timestamp: string;
}

export interface CreditPackDefinition {
  packId: string;
  credits: number;
  priceCents: number;
  stripePriceId: string | null;
  description: string;
}

export interface CreditCostConfig {
  analysisType: AnalysisType;
  costPerUnit: number;
  unitDescription: string;
}

// ---------------------------------------------------------------------------
// Credit Cost Configuration — configurable rates
// ---------------------------------------------------------------------------

export const CREDIT_COSTS: readonly CreditCostConfig[] = Object.freeze([
  {
    analysisType: 'CONTRADICTION_ENGINE',
    costPerUnit: 1,
    unitDescription: '1 credit per 100 pages analyzed',
  },
  {
    analysisType: 'VIDEO_PROCESSING',
    costPerUnit: 1,
    unitDescription: '1 credit per minute of video',
  },
  {
    analysisType: 'DOCTRINE_ANALYSIS',
    costPerUnit: 1,
    unitDescription: '1 credit per case',
  },
  {
    analysisType: 'LITIGATION_INTELLIGENCE',
    costPerUnit: 2,
    unitDescription: '2 credits per report',
  },
  {
    analysisType: 'RELIABILITY_SCORING',
    costPerUnit: 1,
    unitDescription: '1 credit per 200 events',
  },
]);

// ---------------------------------------------------------------------------
// Credit Pack Definitions — purchasable add-on packs
// ---------------------------------------------------------------------------

export const CREDIT_PACKS: readonly CreditPackDefinition[] = Object.freeze([
  {
    packId: 'pack_50',
    credits: 50,
    priceCents: 2500,
    stripePriceId: null, // Set after Stripe product creation
    description: '50 AI Credits — $25',
  },
  {
    packId: 'pack_150',
    credits: 150,
    priceCents: 6000,
    stripePriceId: null,
    description: '150 AI Credits — $60',
  },
  {
    packId: 'pack_500',
    credits: 500,
    priceCents: 17500,
    stripePriceId: null,
    description: '500 AI Credits — $175',
  },
  {
    packId: 'pack_1500',
    credits: 1500,
    priceCents: 45000,
    stripePriceId: null,
    description: '1,500 AI Credits — $450',
  },
]);

// ---------------------------------------------------------------------------
// Balance Management — persisted to PostgreSQL via Prisma
// ---------------------------------------------------------------------------

function toAiCreditBalance(row: {
  id: string;
  userId: string;
  monthlyCredits: number;
  purchasedCredits: number;
  creditsUsed: number;
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
  createdAt: Date;
  updatedAt: Date;
}): AiCreditBalance {
  return {
    id: row.id,
    userId: row.userId,
    monthlyCredits: row.monthlyCredits,
    purchasedCredits: row.purchasedCredits,
    creditsUsed: row.creditsUsed,
    billingPeriodStart: row.billingPeriodStart.toISOString(),
    billingPeriodEnd: row.billingPeriodEnd.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getCreditBalance(userId: string): Promise<AiCreditBalance> {
  const now = new Date();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const record = await prisma.aiCreditBalance.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      monthlyCredits: 0,
      purchasedCredits: 0,
      creditsUsed: 0,
      billingPeriodStart: now,
      billingPeriodEnd: endOfMonth,
    },
  });
  return toAiCreditBalance(record);
}

/**
 * Set monthly credits for a user (called when subscription changes).
 */
export async function setMonthlyCredits(userId: string, monthlyCredits: number): Promise<AiCreditBalance> {
  // Ensure balance exists first
  await getCreditBalance(userId);
  const updated = await prisma.aiCreditBalance.update({
    where: { userId },
    data: { monthlyCredits },
  });
  return toAiCreditBalance(updated);
}

/**
 * Add purchased credits to a user's balance.
 * Purchased credits roll over for 90 days.
 */
export async function addPurchasedCredits(userId: string, credits: number): Promise<AiCreditBalance> {
  // Ensure balance exists first
  await getCreditBalance(userId);
  const updated = await prisma.aiCreditBalance.update({
    where: { userId },
    data: { purchasedCredits: { increment: credits } },
  });
  return toAiCreditBalance(updated);
}

/**
 * Get available credits (monthly + purchased - used).
 * Purchased credits are consumed before monthly credits.
 */
export async function getAvailableCredits(userId: string): Promise<number> {
  const balance = await getCreditBalance(userId);
  return (balance.monthlyCredits + balance.purchasedCredits) - balance.creditsUsed;
}

/**
 * Check if a user has enough credits for an operation.
 */
export async function hasEnoughCredits(userId: string, requiredCredits: number): Promise<boolean> {
  return (await getAvailableCredits(userId)) >= requiredCredits;
}

/**
 * Deduct credits from a user's balance using a database transaction.
 * Purchased credits are consumed first, then monthly.
 * Returns true if deduction succeeded, false if insufficient credits.
 */
export async function deductCredits(
  userId: string,
  credits: number,
  analysisType: AnalysisType,
  caseId?: string,
): Promise<boolean> {
  if (typeof credits !== 'number' || !Number.isFinite(credits) || credits <= 0) return false;

  // Atomic check-and-deduct inside a single interactive transaction to prevent TOCTOU races
  const result = await prisma.$transaction(async (tx) => {
    const balance = await tx.aiCreditBalance.findUnique({ where: { userId } });
    if (!balance) return false;

    const available = (balance.monthlyCredits + balance.purchasedCredits) - balance.creditsUsed;
    if (available < credits) return false;

    await tx.aiCreditBalance.update({
      where: { userId },
      data: { creditsUsed: { increment: credits } },
    });
    await tx.aiCreditUsage.create({
      data: {
        userId,
        caseId: caseId ?? null,
        analysisType,
        creditsUsed: credits,
      },
    });
    return true;
  });

  return result;
}

// ---------------------------------------------------------------------------
// Usage Queries — persisted to PostgreSQL
// ---------------------------------------------------------------------------

export async function getUserUsageHistory(
  userId: string,
  limit = 50,
): Promise<AiCreditUsageEntry[]> {
  const rows = await prisma.aiCreditUsage.findMany({
    where: { userId },
    orderBy: { timestamp: 'desc' },
    take: limit,
  });
  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    caseId: r.caseId,
    analysisType: r.analysisType as AnalysisType,
    creditsUsed: r.creditsUsed,
    timestamp: r.timestamp.toISOString(),
  }));
}

export async function getUserUsageByType(userId: string): Promise<Record<AnalysisType, number>> {
  const result: Record<AnalysisType, number> = {
    VIDEO_PROCESSING: 0,
    CONTRADICTION_ENGINE: 0,
    DOCTRINE_ANALYSIS: 0,
    LITIGATION_INTELLIGENCE: 0,
    RELIABILITY_SCORING: 0,
  };

  const rows = await prisma.aiCreditUsage.findMany({
    where: { userId },
    select: { analysisType: true, creditsUsed: true },
  });

  for (const row of rows) {
    const key = row.analysisType as AnalysisType;
    if (key in result) {
      result[key] += row.creditsUsed;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Credit Cost Calculator
// ---------------------------------------------------------------------------

/**
 * Calculate credit cost for a specific analysis type and quantity.
 */
export function calculateCreditCost(
  analysisType: AnalysisType,
  units: number,
): number {
  const config = CREDIT_COSTS.find((c) => c.analysisType === analysisType);
  if (!config) return 0;
  return Math.ceil(config.costPerUnit * units);
}

/**
 * Get pack by ID.
 */
export function getCreditPack(packId: string): CreditPackDefinition | null {
  for (const pack of CREDIT_PACKS) {
    if (pack.packId === packId) return pack;
  }
  return null;
}

/**
 * Reset monthly credits at the start of a new billing period.
 */
export async function resetMonthlyCredits(userId: string): Promise<AiCreditBalance> {
  const balance = await getCreditBalance(userId);
  const now = new Date();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  // Deduct consumed purchased credits before resetting the usage counter.
  // Purchased credits are consumed first (per deductCredits contract).
  const purchasedConsumed = Math.min(balance.purchasedCredits, balance.creditsUsed);

  const updated = await prisma.aiCreditBalance.update({
    where: { userId },
    data: {
      purchasedCredits: { decrement: purchasedConsumed },
      creditsUsed: 0,
      billingPeriodStart: now,
      billingPeriodEnd: endOfMonth,
    },
  });
  return toAiCreditBalance(updated);
}
