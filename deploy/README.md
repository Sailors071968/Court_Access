# Deployment

> ## Deploying the service? Read [DEPLOY_FROM_SCRATCH.md](DEPLOY_FROM_SCRATCH.md).
>
> It is the clone-to-healthy procedure for the **PM2 deployment, which is what
> production runs**, and it has been executed end to end against a clean clone
> and an empty database.
>
> **The rest of this file describes a Docker Compose stack.** That is a
> different architecture with a *different environment file*. `.env.example`
> here is the compose environment — it has no `DATABASE_URL`, because compose
> builds one from the `POSTGRES_*` parts. Copying it into a PM2 release gives
> you a service that cannot start and a crash loop whose error message blames
> the database. Use `env.release.example` for that deployment.

> **For the existing production host, read
> [DEPLOYMENT_PLAN.md](DEPLOYMENT_PLAN.md).** That host runs Amazon Linux 2023
> with an established layout. `bootstrap-ec2.sh` below targets Debian/Ubuntu
> with `apt-get` and Docker, and **must not be run there.** It remains valid
> for a fresh host only.

**Read [AUDIT.md](AUDIT.md) first.** It records what is running on
courtaccess.net today: a June frontend in front of a health check that answers
nothing else. Registration, sign-in and upload all return 404 and have done for
about six weeks.

## One command

On the EC2 instance, as a user with sudo:

```bash
curl -fsSL https://raw.githubusercontent.com/Sailors071968/Court_Access/cursor/gold-standard-upload-portal-9f94/deploy/bootstrap-ec2.sh \
  | bash -s -- --domain courtaccess.net --email you@example.com
```

It installs Docker if missing, fetches this branch, generates secrets, brings
up the stack, applies migrations, creates the administrator, points the host's
nginx at the application, requests a certificate, then **restarts everything
and re-checks** — because a deployment that survives a reboot should be tested
rather than claimed. It prints the administrator credentials at the end and is
safe to re-run.

## If you would rather I did it

Add these as Cloud Agent secrets in the Cursor dashboard and I can deploy
without you touching the box:

| Secret | What it is |
|---|---|
| `DEPLOY_HOST` | The EC2 address, e.g. `44.209.225.79` |
| `DEPLOY_USER` | The SSH user, e.g. `ubuntu` |
| `DEPLOY_SSH_KEY` | The private key, whole file including the header and footer lines |

Those are the same three the existing frontend workflow already uses. With them
I can run the bootstrap, verify it from outside, and hand you back a working
URL rather than instructions.

## The compose stack

Brings up PostgreSQL, Redis, the API, the frontend and a nightly backup on one
host, with data on named volumes so it survives a reboot.

This is the piece that did not exist. The GitHub workflow deploys the frontend
only, which is why `courtaccess.net` serves a bundle whose API predates this
codebase.

## Running it by hand instead

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
