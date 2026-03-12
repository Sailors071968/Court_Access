// ============================================================================
// CourtAccess — AI Credit Service
// Manages AI compute credits: balance tracking, usage logging, credit packs.
// ============================================================================

import { v4 as uuidv4 } from 'uuid';

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
// In-Memory Stores (production uses Prisma)
// ---------------------------------------------------------------------------

const balanceStore = new Map<string, AiCreditBalance>();
const usageStore: AiCreditUsageEntry[] = [];

// ---------------------------------------------------------------------------
// Balance Management
// ---------------------------------------------------------------------------

export function getCreditBalance(userId: string): AiCreditBalance {
  const existing = balanceStore.get(userId);
  if (existing) return existing;

  const now = new Date();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const balance: AiCreditBalance = {
    id: uuidv4(),
    userId,
    monthlyCredits: 0,
    purchasedCredits: 0,
    creditsUsed: 0,
    billingPeriodStart: now.toISOString(),
    billingPeriodEnd: endOfMonth.toISOString(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  balanceStore.set(userId, balance);
  return balance;
}

/**
 * Set monthly credits for a user (called when subscription changes).
 */
export function setMonthlyCredits(userId: string, monthlyCredits: number): AiCreditBalance {
  const balance = getCreditBalance(userId);
  balance.monthlyCredits = monthlyCredits;
  balance.updatedAt = new Date().toISOString();
  balanceStore.set(userId, balance);
  return balance;
}

/**
 * Add purchased credits to a user's balance.
 * Purchased credits roll over for 90 days.
 */
export function addPurchasedCredits(userId: string, credits: number): AiCreditBalance {
  const balance = getCreditBalance(userId);
  balance.purchasedCredits += credits;
  balance.updatedAt = new Date().toISOString();
  balanceStore.set(userId, balance);
  return balance;
}

/**
 * Get available credits (monthly + purchased - used).
 * Purchased credits are consumed before monthly credits.
 */
export function getAvailableCredits(userId: string): number {
  const balance = getCreditBalance(userId);
  return (balance.monthlyCredits + balance.purchasedCredits) - balance.creditsUsed;
}

/**
 * Check if a user has enough credits for an operation.
 */
export function hasEnoughCredits(userId: string, requiredCredits: number): boolean {
  return getAvailableCredits(userId) >= requiredCredits;
}

/**
 * Deduct credits from a user's balance.
 * Purchased credits are consumed first, then monthly.
 * Returns true if deduction succeeded, false if insufficient credits.
 */
export function deductCredits(
  userId: string,
  credits: number,
  analysisType: AnalysisType,
  caseId?: string,
): boolean {
  if (!hasEnoughCredits(userId, credits)) return false;

  const balance = getCreditBalance(userId);
  balance.creditsUsed += credits;
  balance.updatedAt = new Date().toISOString();
  balanceStore.set(userId, balance);

  // Record usage
  const usage: AiCreditUsageEntry = {
    id: uuidv4(),
    userId,
    caseId: caseId ?? null,
    analysisType,
    creditsUsed: credits,
    timestamp: new Date().toISOString(),
  };
  usageStore.push(usage);

  return true;
}

// ---------------------------------------------------------------------------
// Usage Queries
// ---------------------------------------------------------------------------

export function getUserUsageHistory(
  userId: string,
  limit = 50,
): AiCreditUsageEntry[] {
  return usageStore
    .filter((u) => u.userId === userId)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, limit);
}

export function getUserUsageByType(userId: string): Record<AnalysisType, number> {
  const result: Record<AnalysisType, number> = {
    VIDEO_PROCESSING: 0,
    CONTRADICTION_ENGINE: 0,
    DOCTRINE_ANALYSIS: 0,
    LITIGATION_INTELLIGENCE: 0,
    RELIABILITY_SCORING: 0,
  };

  for (const entry of usageStore) {
    if (entry.userId === userId) {
      result[entry.analysisType] += entry.creditsUsed;
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
export function resetMonthlyCredits(userId: string): AiCreditBalance {
  const balance = getCreditBalance(userId);
  const now = new Date();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  balance.creditsUsed = 0;
  balance.billingPeriodStart = now.toISOString();
  balance.billingPeriodEnd = endOfMonth.toISOString();
  balance.updatedAt = now.toISOString();
  balanceStore.set(userId, balance);
  return balance;
}
