// ============================================================================
// CourtAccess — Discount Code Model
// Phase 221: Flexible discount code management for promotional access
// Phase 226: Usage tracking per code per user
// ============================================================================

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

// In-memory stores (production: migrate to PostgreSQL)
const discountCodes: DiscountCode[] = [];
const discountUsages: DiscountUsage[] = [];

// ---------------------------------------------------------------------------
// Discount Code CRUD
// ---------------------------------------------------------------------------

export function createDiscountCode(
  data: Omit<DiscountCode, 'codeId' | 'usageCount' | 'createdAt'>
): DiscountCode {
  const existing = discountCodes.find(
    (c) => c.codeValue.toUpperCase() === data.codeValue.toUpperCase()
  );
  if (existing) {
    throw new Error(`Discount code "${data.codeValue}" already exists`);
  }

  const code: DiscountCode = {
    ...data,
    codeId: crypto.randomUUID(),
    codeValue: data.codeValue.toUpperCase(),
    usageCount: 0,
    createdAt: new Date().toISOString(),
  };
  discountCodes.push(code);
  return code;
}

export function getDiscountCodes(): DiscountCode[] {
  return [...discountCodes];
}

export function getDiscountCodeById(codeId: string): DiscountCode | undefined {
  return discountCodes.find((c) => c.codeId === codeId);
}

export function getDiscountCodeByValue(codeValue: string): DiscountCode | undefined {
  return discountCodes.find(
    (c) => c.codeValue.toUpperCase() === codeValue.toUpperCase()
  );
}

export function updateDiscountCode(
  codeId: string,
  updates: Partial<Pick<DiscountCode, 'codeName' | 'codeValue' | 'active' | 'expiresAt' | 'usageLimit' | 'discountValue' | 'discountType'>>
): DiscountCode | undefined {
  const code = discountCodes.find((c) => c.codeId === codeId);
  if (!code) return undefined;
  Object.assign(code, updates);
  return code;
}

export function deleteDiscountCode(codeId: string): boolean {
  const idx = discountCodes.findIndex((c) => c.codeId === codeId);
  if (idx === -1) return false;
  discountCodes.splice(idx, 1);
  return true;
}

export function incrementUsageCount(codeId: string): void {
  const code = discountCodes.find((c) => c.codeId === codeId);
  if (code) {
    code.usageCount += 1;
  }
}

// ---------------------------------------------------------------------------
// Discount Usage Tracking (Phase 226)
// ---------------------------------------------------------------------------

export function recordDiscountUsage(discountCodeId: string, userId: string): DiscountUsage {
  const usage: DiscountUsage = {
    usageId: crypto.randomUUID(),
    discountCodeId,
    userId,
    usedAt: new Date().toISOString(),
  };
  discountUsages.push(usage);
  return usage;
}

export function getDiscountUsages(): DiscountUsage[] {
  return [...discountUsages];
}

export function getUsagesByCodeId(discountCodeId: string): DiscountUsage[] {
  return discountUsages.filter((u) => u.discountCodeId === discountCodeId);
}

export function getUsagesByUserId(userId: string): DiscountUsage[] {
  return discountUsages.filter((u) => u.userId === userId);
}

// ---------------------------------------------------------------------------
// Expiration automation helper (Phase 228)
// ---------------------------------------------------------------------------

export function deactivateExpiredCodes(): number {
  const now = new Date();
  let deactivated = 0;
  for (const code of discountCodes) {
    if (code.active && code.expiresAt && new Date(code.expiresAt) < now) {
      code.active = false;
      deactivated++;
    }
  }
  return deactivated;
}
