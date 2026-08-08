# Deployment Guide

## What has been validated, and where

Deployment validation runs as a certification suite
(`scripts/certification/39-deployment-validation.mjs`). It reports 18 passing
checks and **five items it cannot answer from inside a development
environment**. Those five are real gaps in what has been proven, not paperwork:

| Not validated | Why it matters |
|---|---|
| Object storage (R2/S3) | Uploads have only been exercised against local disk. Latency, partial writes and credential expiry against remote storage are unproven. |
| Payment processing | No Stripe key present. No subscription, renewal, refund or chargeback has been exercised. |
| Email delivery | No SES credentials. Verification mail, invitations and notifications have never been sent. |
| HTTPS and Cloudflare at the edge | Review has been through a temporary tunnel, which is not the production edge. Certificate handling, WAF rules, caching and edge rate limiting are unproven. |
| Browsers other than Chromium | Every browser check runs in Chromium. Safari and Firefox matter most for the upload portal, where directory selection and resumable upload differ by engine. |

Validate each of these on the target infrastructure before launch. Do not treat
the passing checks as covering them.

## Requirements

- PostgreSQL 16
- Redis 7
- Node 22
- **ffmpeg** — without it, media durations report as unknown and silent
  recordings cannot be told apart from untranscribed ones
- Outbound HTTPS to `leginfo.legislature.ca.gov` — statutory retrieval depends
  on it, and without it every charged section falls back to cache or reports
  unavailable

## Deploying

```bash
cd backend
npx prisma migrate deploy      # never `migrate dev` against production
npx prisma generate
npx tsx src/server.ts

npm run build                   # frontend, served behind the same origin as /api
```

The frontend must be served same-origin with the API. Session renewal and
upload chunking both assume it.

## Environment

Required: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`.

Optional but consequential:

- `CERTIFICATION_STAGING_DIR` — where upload chunks are assembled. Needs space
  for the largest expected corpus. Defaults to `/var/tmp`.
- `LAW_CACHE_MAX_AGE_MS` — how long a cached statute is served before being
  re-read. Defaults to a day.
- `LEGINFO_MIN_GAP_MS` — spacing between requests to the Legislature's servers.
  Do not lower it; it exists to be a good citizen of a public service.

## After deploying

Run the certification suite against the deployment:

```bash
bash scripts/certification/run-all.sh
```

Then open **Admin → Production Readiness**. If the release gate reports
anything other than what you expect, believe the gate: it is derived from the
suites rather than asserted.
