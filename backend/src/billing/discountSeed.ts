// ============================================================================
// CourtAccess — Discount Code Seed Data
// Seeds default discount codes on server startup so they are always available.
// ============================================================================

import { createDiscountCode, getDiscountCodeByValue } from '../models/discountCode.js';

/**
 * Seed default discount codes. Skips any that already exist.
 */
export function seedDefaultDiscountCodes(): void {
  const defaults = [
    {
      codeName: 'Product Hunt Launch',
      codeValue: 'HUNT100',
      discountType: 'percent' as const,
      discountValue: 100,
      active: true,
      usageLimit: null,
      expiresAt: null,
    },
  ];

  for (const code of defaults) {
    const existing = getDiscountCodeByValue(code.codeValue);
    if (!existing) {
      createDiscountCode(code);
      console.log(`[DiscountSeed] Seeded discount code: ${code.codeValue} (${code.codeName})`);
    } else {
      console.log(`[DiscountSeed] Discount code already exists: ${code.codeValue}`);
    }
  }
}
