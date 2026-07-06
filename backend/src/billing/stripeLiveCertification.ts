// ============================================================================
// Epic 1A-FINAL — Live Stripe Test Mode API certification
// Verifies REST integration against api.stripe.com when sk_test_ is configured
// ============================================================================

import type { WorkflowCertification } from './stripeCertification.js';

interface StripeApiError {
  error?: { message?: string };
}

async function stripePost(
  path: string,
  params: URLSearchParams,
): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const stripeKey = process.env.STRIPE_SECRET_KEY!;
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${stripeKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const data = (await res.json()) as Record<string, unknown> & StripeApiError;
  return { ok: res.ok && !data.error, data };
}

async function stripeDelete(path: string): Promise<void> {
  const stripeKey = process.env.STRIPE_SECRET_KEY!;
  await fetch(`https://api.stripe.com/v1${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${stripeKey}` },
  }).catch(() => undefined);
}

export function isLiveStripeTestModeReady(): boolean {
  if (!process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) return false;
  return Boolean(process.env.STRIPE_PRICE_STARTER);
}

export async function runLiveStripeApiCertification(): Promise<WorkflowCertification> {
  const steps: string[] = [];
  const stripeObjects: string[] = [];
  let customerId: string | null = null;

  try {
    steps.push('Create Stripe test customer via POST /v1/customers');
    const customerRes = await stripePost(
      '/customers',
      new URLSearchParams({
        email: `cert-live-${Date.now()}@cert.courtaccess.test`,
        name: 'Epic 1A Live Cert',
        'metadata[certification]': '1A-FINAL',
      }),
    );
    if (!customerRes.ok || typeof customerRes.data.id !== 'string') {
      return failWorkflow(steps, stripeObjects, customerRes.data.error?.message ?? 'Customer creation failed');
    }
    customerId = customerRes.data.id;
    stripeObjects.push(`cus:${customerId}`);

    steps.push('Retrieve STARTER price via configured STRIPE_PRICE_STARTER');
    const priceId = process.env.STRIPE_PRICE_STARTER!;
    const priceRes = await fetch(`https://api.stripe.com/v1/prices/${priceId}`, {
      headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
    });
    if (!priceRes.ok) {
      return failWorkflow(steps, stripeObjects, `Price ${priceId} not found in Stripe test account`);
    }
    stripeObjects.push(`price:${priceId}`);

    steps.push('Create checkout session via POST /v1/checkout/sessions');
    const checkoutParams = new URLSearchParams();
    checkoutParams.append('mode', 'subscription');
    checkoutParams.append('customer', customerId);
    checkoutParams.append('line_items[0][price]', priceId);
    checkoutParams.append('line_items[0][quantity]', '1');
    checkoutParams.append('success_url', 'https://courtaccess.net/dashboard/usage?checkout=success');
    checkoutParams.append('cancel_url', 'https://courtaccess.net/pricing?checkout=canceled');
    checkoutParams.append('subscription_data[metadata][certification]', '1A-FINAL');
    const checkoutRes = await stripePost('/checkout/sessions', checkoutParams);
    if (!checkoutRes.ok || typeof checkoutRes.data.id !== 'string') {
      return failWorkflow(steps, stripeObjects, checkoutRes.data.error?.message ?? 'Checkout session creation failed');
    }
    stripeObjects.push(`cs:${checkoutRes.data.id}`);

    steps.push('Create billing portal session via POST /v1/billing_portal/sessions');
    const portalParams = new URLSearchParams();
    portalParams.append('customer', customerId);
    portalParams.append('return_url', 'https://courtaccess.net/dashboard/usage');
    const portalRes = await stripePost('/billing_portal/sessions', portalParams);
    if (!portalRes.ok || typeof portalRes.data.url !== 'string') {
      return failWorkflow(steps, stripeObjects, portalRes.data.error?.message ?? 'Portal session creation failed');
    }

    return {
      workflow: 'Live Stripe Test Mode API',
      result: 'PASS',
      mode: 'live',
      testSteps: steps,
      stripeObjects,
      databaseChanges: [],
      webhookEvents: [],
      emailsSent: [],
      recoveryBehavior: 'Test customer deleted after certification',
    };
  } catch (err) {
    return failWorkflow(steps, stripeObjects, err instanceof Error ? err.message : String(err));
  } finally {
    if (customerId) await stripeDelete(`/customers/${customerId}`);
  }
}

function failWorkflow(
  steps: string[],
  stripeObjects: string[],
  error: string,
): WorkflowCertification {
  return {
    workflow: 'Live Stripe Test Mode API',
    result: 'FAIL',
    mode: 'live',
    testSteps: steps,
    stripeObjects,
    databaseChanges: [],
    webhookEvents: [],
    emailsSent: [],
    recoveryBehavior: 'Fix Stripe test account configuration and re-run billing:certify',
    error,
  };
}
