# Staging deployment

Brings up PostgreSQL, Redis, the API, the frontend and a nightly backup on one
host, with data on named volumes so it survives a reboot.

This is the piece that did not exist. The GitHub workflow deploys the frontend
only, which is why `courtaccess.net` serves a bundle whose API predates this
codebase.

## First run

```bash
cd deploy
cp .env.example .env      # fill in; generate secrets with openssl rand
docker compose up -d --build
docker compose exec api npx prisma migrate deploy
docker compose exec api node /app/deploy/bootstrap-admin.mjs
```

`bootstrap-admin.mjs` registers through the same route a customer uses, then
sets the admin role and proves the account signs in.

## TLS

The web container listens on `127.0.0.1:8080`. Terminate TLS in front of it —
Caddy is the least work:

```
staging.example.com {
    reverse_proxy 127.0.0.1:8080
}
```

Behind Cloudflare, use Full (strict) so the origin certificate is verified.
Flexible leaves the last hop unencrypted.

## Verifying persistence

The claim that data survives a reboot should be tested, not assumed:

```bash
docker compose restart          # or reboot the host
curl -sf http://127.0.0.1:8080/api/health
# sign in with the administrator account; the case list should be unchanged
```

## Backups

A dump is written nightly to the `backup-data` volume and kept a fortnight.
Copy it off the host — a backup on the same machine does not survive the
machine.

```bash
docker compose cp backup:/backups ./backups
```

Restoring is in [../docs/DISASTER_RECOVERY_GUIDE.md](../docs/DISASTER_RECOVERY_GUIDE.md).

## After deploying

```bash
CERT_API_BASE=https://staging.example.com \
CERT_WEB_BASE=https://staging.example.com \
  bash scripts/certification/run-all.sh
```

Then open **Admin → Production Readiness**.

## What this does not do

- **No object storage.** Evidence is written to the `evidence-data` volume.
  R2 or S3 has never been exercised by this platform; behaviour against remote
  storage is unproven.
- **No email.** Verification mail and invitations will not send without SES
  credentials.
- **No payments.** Without a Stripe key, subscription flows are inert.

Each is recorded as not measurable in the deployment validation suite rather
than reported as working.
