# Epic 1A — Stripe Production Architecture

## Overview

CourtAccess billing uses Stripe Checkout for subscriptions and one-time credit packs. Webhooks synchronize state to PostgreSQL. No Stripe SDK — REST API with HMAC signature verification.

## Components

| Module | Responsibility |
|--------|----------------|
| `stripeWebhookHandler.ts` | Webhooks, checkout sessions, billing portal |
| `billingRoutes.ts` | Plans, usage, credits API |
| `subscriptionService.ts` | Plan registry + Prisma subscription CRUD |
| `aiCreditService.ts` | Credit balances, deduction, monthly reset |
| `stripeSyncService.ts` | Plan→credit sync, customer lookup |
| `billingMetricsService.ts` | Production readiness metrics |
| `discountService.ts` | Internal promo codes (not Stripe coupons) |

## Customer Lifecycle

```
Register → FREE subscription (DB)
    ↓
Checkout (Stripe) → checkout.session.completed webhook
    ↓
Subscription upsert + monthly credits synced
    ↓
invoice.paid (renewal) → credits reset
    ↓
invoice.payment_failed → past_due
    ↓
customer.subscription.deleted → FREE tier
    ↓
Billing Portal → cancel / update payment method
```

## Webhook Events Handled

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Subscription or credit pack fulfillment |
| `customer.subscription.created` | Upsert subscription + sync credits |
| `customer.subscription.updated` | Update plan/status + sync credits |
| `customer.subscription.deleted` | Downgrade to FREE |
| `invoice.paid` | Mark active + reset monthly credits |
| `invoice.payment_failed` | Mark past_due + security log |
| `charge.refunded` | Security audit log |
| `payment_intent.succeeded` | Audit log |
| `payment_intent.payment_failed` | Security audit log |

All events use `stripe_webhook_events` idempotency by Stripe event ID.

## Database Models

- `subscriptions` — planId, stripeCustomerId, stripeSubscriptionId, status, tier
- `ai_credit_balances` — monthly + purchased credits
- `stripe_webhook_events` — idempotency ledger
- `discount_codes` / `discount_usages` — internal promos

## API Endpoints

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `POST /api/billing/create-checkout-session` | JWT | Start Stripe Checkout |
| `POST /api/billing/create-portal-session` | JWT | Stripe Billing Portal |
| `POST /api/billing/webhook` | Signature | Stripe webhooks |
| `GET /api/billing/usage` | JWT | Usage + credit packs |
| `GET /api/admin/billing/metrics` | admin/staff | MRR, churn, readiness |

## Environment Variables

See `backend/.env.production.template` for full list including `STRIPE_PRICE_*` price IDs.

## Known Gaps

- Billing confirmation emails not implemented (SES is CPRA-only)
- Internal discount codes not applied to Stripe checkout prices
- `STRIPE_PUBLISHABLE_KEY` unused (Checkout redirect pattern)

## Testing

```bash
cd backend && node --import tsx --test tests/stripe-billing.test.ts
npm run billing:readiness
```

Use Stripe CLI for webhook testing:

```bash
stripe listen --forward-to localhost:3001/api/billing/webhook
stripe trigger checkout.session.completed
```
