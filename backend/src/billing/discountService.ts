// ============================================================================
// CourtAccess — Discount Code Validation Service
// Phase 222: Validate discount codes during registration/billing
// ============================================================================

import {
  getDiscountCodeByValue,
  incrementUsageCount,
  recordDiscountUsage,
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
export function validateDiscountCode(codeValue: string): DiscountValidationResult {
  if (!codeValue || codeValue.trim().length === 0) {
    return { valid: false, errorReason: 'No discount code provided' };
  }

  const code = getDiscountCodeByValue(codeValue.trim());

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
export function applyDiscountCode(codeValue: string, userId: string): DiscountValidationResult {
  const validation = validateDiscountCode(codeValue);
  if (!validation.valid || !validation.codeId) {
    return validation;
  }

  incrementUsageCount(validation.codeId);
  recordDiscountUsage(validation.codeId, userId);

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
