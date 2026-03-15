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
  const codeId = validation.codeId;
  const applied = await prisma.$transaction(async (tx) => {
    const code = await tx.discountCode.findUnique({ where: { id: codeId } });
    if (!code || !code.active) return false;
    if (code.usageLimit !== null && code.usageCount >= code.usageLimit) return false;

    await tx.discountCode.update({
      where: { id: codeId },
      data: { usageCount: { increment: 1 } },
    });
    await tx.discountUsage.create({
      data: { discountCodeId: codeId, userId },
    });
    return true;
  }, { isolationLevel: 'Serializable' });

  if (!applied) {
    return { valid: false, errorReason: 'This discount code has reached its usage limit' };
  }

  return validation;
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
