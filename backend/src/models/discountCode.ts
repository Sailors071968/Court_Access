// ============================================================================
// CourtAccess — Discount Code Model
// Phase 221: Flexible discount code management for promotional access
// Phase 226: Usage tracking per code per user
// Now persisted to PostgreSQL via Prisma (replaces in-memory arrays).
// ============================================================================

import prisma from '../lib/prisma.js';

// ---------------------------------------------------------------------------
// Types (kept for backward compatibility with existing route handlers)
// ---------------------------------------------------------------------------

export interface DiscountCode {
  codeId: string;
  codeName: string;
  codeValue: string;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  active: boolean;
  usageLimit: number | null;
  usageCount: number;
  expiresAt: string | null;
  createdAt: string;
}

export interface DiscountUsage {
  usageId: string;
  discountCodeId: string;
  userId: string;
  usedAt: string;
}

// ---------------------------------------------------------------------------
// Prisma row → interface mapper
// ---------------------------------------------------------------------------

function toDiscountCode(row: {
  id: string;
  codeName: string;
  codeValue: string;
  discountType: string;
  discountValue: number;
  active: boolean;
  usageLimit: number | null;
  usageCount: number;
  expiresAt: Date | null;
  createdAt: Date;
}): DiscountCode {
  return {
    codeId: row.id,
    codeName: row.codeName,
    codeValue: row.codeValue,
    discountType: row.discountType as 'percent' | 'fixed',
    discountValue: row.discountValue,
    active: row.active,
    usageLimit: row.usageLimit,
    usageCount: row.usageCount,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

function toDiscountUsage(row: {
  id: string;
  discountCodeId: string;
  userId: string;
  usedAt: Date;
}): DiscountUsage {
  return {
    usageId: row.id,
    discountCodeId: row.discountCodeId,
    userId: row.userId,
    usedAt: row.usedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Discount Code CRUD — persisted to PostgreSQL via Prisma
// ---------------------------------------------------------------------------

export async function createDiscountCode(
  data: Omit<DiscountCode, 'codeId' | 'usageCount' | 'createdAt'>
): Promise<DiscountCode> {
  const row = await prisma.discountCode.create({
    data: {
      codeName: data.codeName,
      codeValue: data.codeValue.toUpperCase(),
      discountType: data.discountType,
      discountValue: data.discountValue,
      active: data.active,
      usageLimit: data.usageLimit,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
    },
  });
  return toDiscountCode(row);
}

export async function getDiscountCodes(): Promise<DiscountCode[]> {
  const rows = await prisma.discountCode.findMany({ orderBy: { createdAt: 'desc' } });
  return rows.map(toDiscountCode);
}

export async function getDiscountCodeById(codeId: string): Promise<DiscountCode | undefined> {
  const row = await prisma.discountCode.findUnique({ where: { id: codeId } });
  return row ? toDiscountCode(row) : undefined;
}

export async function getDiscountCodeByValue(codeValue: string): Promise<DiscountCode | undefined> {
  const row = await prisma.discountCode.findUnique({
    where: { codeValue: codeValue.toUpperCase() },
  });
  return row ? toDiscountCode(row) : undefined;
}

export async function updateDiscountCode(
  codeId: string,
  updates: Partial<Pick<DiscountCode, 'codeName' | 'codeValue' | 'active' | 'expiresAt' | 'usageLimit' | 'discountValue' | 'discountType'>>
): Promise<DiscountCode | undefined> {
  try {
    const data: Record<string, unknown> = {};
    if (updates.codeName !== undefined) data.codeName = updates.codeName;
    if (updates.codeValue !== undefined) data.codeValue = updates.codeValue.toUpperCase();
    if (updates.active !== undefined) data.active = updates.active;
    if (updates.expiresAt !== undefined) data.expiresAt = updates.expiresAt ? new Date(updates.expiresAt) : null;
    if (updates.usageLimit !== undefined) data.usageLimit = updates.usageLimit;
    if (updates.discountValue !== undefined) data.discountValue = updates.discountValue;
    if (updates.discountType !== undefined) data.discountType = updates.discountType;

    const row = await prisma.discountCode.update({
      where: { id: codeId },
      data,
    });
    return toDiscountCode(row);
  } catch (err: unknown) {
    // P2025 = record not found → return undefined (caller sends 404)
    if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'P2025') {
      return undefined;
    }
    // P2002 = unique constraint violation → re-throw so caller can send 409
    throw err;
  }
}

export async function deleteDiscountCode(codeId: string): Promise<boolean> {
  try {
    // Delete related usage records first to avoid FK constraint violations
    await prisma.$transaction(async (tx) => {
      await tx.discountUsage.deleteMany({ where: { discountCodeId: codeId } });
      await tx.discountCode.delete({ where: { id: codeId } });
    });
    return true;
  } catch (err: unknown) {
    // P2025 = record not found → return false (caller sends 404)
    if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'P2025') {
      return false;
    }
    throw err;
  }
}

export async function incrementUsageCount(codeId: string): Promise<void> {
  try {
    await prisma.discountCode.update({
      where: { id: codeId },
      data: { usageCount: { increment: 1 } },
    });
  } catch {
    // Silently ignore if code not found
  }
}

// ---------------------------------------------------------------------------
// Discount Usage Tracking (Phase 226) — persisted to PostgreSQL
// ---------------------------------------------------------------------------

export async function recordDiscountUsage(discountCodeId: string, userId: string): Promise<DiscountUsage> {
  const row = await prisma.discountUsage.create({
    data: { discountCodeId, userId },
  });
  return toDiscountUsage(row);
}

export async function getDiscountUsages(): Promise<DiscountUsage[]> {
  const rows = await prisma.discountUsage.findMany({ orderBy: { usedAt: 'desc' } });
  return rows.map(toDiscountUsage);
}

export async function getUsagesByCodeId(discountCodeId: string): Promise<DiscountUsage[]> {
  const rows = await prisma.discountUsage.findMany({
    where: { discountCodeId },
    orderBy: { usedAt: 'desc' },
  });
  return rows.map(toDiscountUsage);
}

export async function getUsagesByUserId(userId: string): Promise<DiscountUsage[]> {
  const rows = await prisma.discountUsage.findMany({
    where: { userId },
    orderBy: { usedAt: 'desc' },
  });
  return rows.map(toDiscountUsage);
}

// ---------------------------------------------------------------------------
// Expiration automation helper (Phase 228)
// ---------------------------------------------------------------------------

export async function deactivateExpiredCodes(): Promise<number> {
  const result = await prisma.discountCode.updateMany({
    where: {
      active: true,
      expiresAt: { lt: new Date() },
    },
    data: { active: false },
  });
  return result.count;
}
