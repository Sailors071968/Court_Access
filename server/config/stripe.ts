// ============================================
// Court Access — Stripe Configuration
// ============================================

import Stripe from 'stripe';
import { env } from './env.js';

let stripeClient: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (!stripeClient) {
    if (!env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    stripeClient = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-06-20' as Stripe.LatestApiVersion,
    });
  }
  return stripeClient;
}

export const STRIPE_PRICES = {
  basic: env.STRIPE_PRICE_BASIC,
  pro: env.STRIPE_PRICE_PRO,
  enterprise: env.STRIPE_PRICE_ENTERPRISE,
} as const;
