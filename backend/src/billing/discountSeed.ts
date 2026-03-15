// ============================================================================
// CourtAccess — Discount Code Seed Data
// Seeds default discount codes on server startup so they are always available.
// ============================================================================

import { createDiscountCode, getDiscountCodeByValue } from '../models/discountCode.js';

/**
 * Seed default discount codes. Skips any that already exist.
 */
export async function seedDefaultDiscountCodes(): Promise<void> {
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
    const existing = await getDiscountCodeByValue(code.codeValue);
    if (!existing) {
      try {
        await createDiscountCode(code);
        console.log(`[DiscountSeed] Seeded discount code: ${code.codeValue} (${code.codeName})`);
      } catch (err: unknown) {
        // P2002 = unique constraint violation (another instance seeded concurrently)
        if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'P2002') {
          console.log(`[DiscountSeed] Discount code already exists (concurrent seed): ${code.codeValue}`);
        } else {
          throw err;
        }
      }
    } else {
      console.log(`[DiscountSeed] Discount code already exists: ${code.codeValue}`);
    }
  }
}
