// ============================================================================
// Program 97 — Stripe key resolution (in-app configurable)
//
// Resolves the Stripe secret from the encrypted admin-configured
// IntegrationSetting (providerId 'stripe') first, falling back to the
// STRIPE_SECRET_KEY environment variable. This lets an administrator configure
// Stripe through the application (Admin → Provider Integrations) without a
// redeploy. If neither source is present, callers return an honest 503 — a key
// is never fabricated and connectivity is never assumed.
// ============================================================================

import prisma from '../lib/prisma.js';
import { decryptSecret } from '../admin/integrationCrypto.js';

async function dbSecret(providerId: string): Promise<string> {
  try {
    const s = await prisma.integrationSetting.findUnique({ where: { providerId } });
    if (s?.enabled && s.apiKeyEnc) {
      try { return decryptSecret(s.apiKeyEnc) || ''; } catch { return ''; }
    }
  } catch {
    // DB unavailable — fall through to env.
  }
  return '';
}

/** Stripe secret key: admin-configured (DB) takes precedence, then env. */
export async function resolveStripeSecret(): Promise<string> {
  return (await dbSecret('stripe')) || process.env.STRIPE_SECRET_KEY || '';
}

/** True when a Stripe secret is available from either source. */
export async function isStripeConfiguredAsync(): Promise<boolean> {
  return Boolean(await resolveStripeSecret());
}
