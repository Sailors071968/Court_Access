// ============================================================================
// CourtAccess — Discount Code Validation Service
// Phase 222: Validate discount codes during registration/billing
// ============================================================================

import prisma from '../lib/prisma.js';
import {
  getDiscountCodeByValue,
} from '../models/discountCode';

export interface DiscountValidationResult {
  valid: boolean;
  discountType?: 'percent' | 'fixed';
  discountValue?: number;
  codeName?: string;
  codeId?: string;
  errorReason?: string;
}

/**
 * Validates a discount code and returns the discount details if valid.
 * Does NOT consume the code — call applyDiscountCode() after successful validation.
 */
export async function validateDiscountCode(codeValue: string): Promise<DiscountValidationResult> {
  if (!codeValue || codeValue.trim().length === 0) {
    return { valid: false, errorReason: 'No discount code provided' };
  }

  const code = await getDiscountCodeByValue(codeValue.trim());

  if (!code) {
    return { valid: false, errorReason: 'Invalid discount code' };
  }

  if (!code.active) {
    return { valid: false, errorReason: 'This discount code is no longer active' };
  }

  if (code.usageLimit !== null && code.usageCount >= code.usageLimit) {
    return { valid: false, errorReason: 'This discount code has reached its usage limit' };
  }

  if (code.expiresAt && new Date(code.expiresAt) < new Date()) {
    return { valid: false, errorReason: 'This discount code has expired' };
  }

  return {
    valid: true,
    discountType: code.discountType,
    discountValue: code.discountValue,
    codeName: code.codeName,
    codeId: code.codeId,
  };
}

/**
 * Applies a validated discount code — increments usage count and records the usage.
 * Call this AFTER validateDiscountCode() returns valid: true.
 */
export async function applyDiscountCode(codeValue: string, userId: string): Promise<DiscountValidationResult> {
  const validation = await validateDiscountCode(codeValue);
  if (!validation.valid || !validation.codeId) {
    return validation;
  }

  // Atomic transaction: conditionally increment usage only if still under limit.
  // Prevents TOCTOU race where two concurrent requests both pass validation.
  // Retries up to 3 times on P2034 (Serializable write conflict) so that
  // unlimited codes aren't falsely rejected by transient SSI conflicts.
  const codeId = validation.codeId;
  const MAX_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const failReason = await prisma.$transaction(async (tx) => {
        const code = await tx.discountCode.findUnique({ where: { id: codeId } });
        if (!code || !code.active) return 'inactive';
        if (code.usageLimit !== null && code.usageCount >= code.usageLimit) return 'usage_limit';
        if (code.expiresAt && code.expiresAt < new Date()) return 'expired';

        await tx.discountCode.update({
          where: { id: codeId },
          data: { usageCount: { increment: 1 } },
        });
        await tx.discountUsage.create({
          data: { discountCodeId: codeId, userId },
        });
        return null;
      }, { isolationLevel: 'Serializable' });

      if (failReason) {
        const messages: Record<string, string> = {
          inactive: 'This discount code is no longer active',
          usage_limit: 'This discount code has reached its usage limit',
          expired: 'This discount code has expired',
        };
        return { valid: false, errorReason: messages[failReason] ?? 'Discount code could not be applied' };
      }

      return validation;
    } catch (err: unknown) {
      const isP2034 = typeof err === 'object' && err !== null && 'code' in err
        && (err as { code: string }).code === 'P2034';
      if (isP2034 && attempt < MAX_RETRIES) {
        // Transient serialization conflict — wait briefly and retry
        await new Promise((resolve) => setTimeout(resolve, 50 * attempt));
        continue;
      }
      // Either not a P2034, or we've exhausted retries — re-throw for the route handler
      throw err;
    }
  }

  // Should never reach here, but satisfy TypeScript
  return { valid: false, errorReason: 'Failed to apply discount code after retries' };
}

/**
 * Calculates the discounted price given an original price and a valid discount.
 */
export function calculateDiscountedPrice(
  originalPrice: number,
  discountType: 'percent' | 'fixed',
  discountValue: number
): number {
  if (discountType === 'percent') {
    const discount = Math.min(discountValue, 100);
    return Math.max(0, originalPrice * (1 - discount / 100));
  }
  return Math.max(0, originalPrice - discountValue);
}
