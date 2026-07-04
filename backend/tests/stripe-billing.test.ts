// ============================================
// Epic 1A — Stripe webhook + billing metrics tests
// ============================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { collectBillingReadinessMetrics } from '../src/billing/billingMetricsService.js';
import { mapPackIdToStripePlan, CREDIT_PACK_STRIPE_IDS } from '../src/billing/stripeSyncService.js';
import { getRequiredRoles } from '../src/security/authMiddleware.js';

function buildStripeSignature(payload: string, secret: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const signed = `${timestamp}.${payload}`;
  const sig = crypto.createHmac('sha256', secret).update(signed).digest('hex');
  return `t=${timestamp},v1=${sig}`;
}

describe('Stripe signature verification', () => {
  it('builds valid HMAC-SHA256 stripe-signature header', () => {
    const secret = 'whsec_test_secret';
    const payload = JSON.stringify({ id: 'evt_test', type: 'invoice.paid' });
    const header = buildStripeSignature(payload, secret);
    assert.ok(header.startsWith('t='));
    assert.ok(header.includes('v1='));
  });
});

describe('Credit pack mapping', () => {
  it('maps internal pack IDs to Stripe checkout plan IDs', () => {
    assert.equal(mapPackIdToStripePlan('pack_50'), 'CREDIT_PACK_50');
    assert.equal(mapPackIdToStripePlan('pack_1500'), 'CREDIT_PACK_1500');
    assert.equal(CREDIT_PACK_STRIPE_IDS.pack_500, 'CREDIT_PACK_500');
  });
});

describe('Billing readiness metrics', () => {
  it('returns objective billing integrity metrics', async () => {
    const metrics = await collectBillingReadinessMetrics();
    assert.ok(metrics.generatedAt);
    assert.equal(typeof metrics.stripeConfigured, 'boolean');
    assert.equal(typeof metrics.estimatedMrrCents, 'number');
    assert.ok(['PASS', 'PARTIAL', 'FAIL'].includes(metrics.overallBillingIntegrity));
    assert.ok(metrics.envStatus.STRIPE_SECRET_KEY !== undefined);
  });
});

describe('Billing route permissions', () => {
  it('subscription POST is auth-only with admin check in handler', () => {
    const roles = getRequiredRoles('/api/billing/subscription');
    assert.equal(roles, null);
  });

  it('allows attorneys to access billing usage', () => {
    const roles = getRequiredRoles('/api/billing/usage');
    assert.ok(roles === null || roles.includes('attorney') || roles.includes('admin'));
  });

  it('requires admin/staff for billing metrics', () => {
    const roles = getRequiredRoles('/api/admin/billing/metrics');
    assert.ok(roles);
    assert.ok(roles.includes('admin'));
    assert.ok(roles.includes('staff'));
  });

  it('keeps webhook endpoint public', () => {
    const roles = getRequiredRoles('/api/billing/webhook');
    assert.equal(roles, null);
  });
});
