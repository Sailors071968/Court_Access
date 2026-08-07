# Deployment audit — courtaccess.net

Performed 7 August 2026 by remote probe. No SSH access to the host was
available, so everything below is observed from outside.

## What is running

| | |
|---|---|
| Host | `44.209.225.79` (AWS, us-east-1 range) |
| Web server | nginx/1.28.1, serving directly |
| Cloudflare | **Not in front of it.** DNS resolves straight to the EC2 address, and no `CF-Ray` or `CF-Cache-Status` header is returned. |
| TLS | Present and valid |
| Frontend bundle | `index-HSm04BBy.js`, `Last-Modified: 26 June 2026` |
| Backend | Answers `/api/health` only |
| Backend uptime | 3,963,107s — started about **22 June 2026** |
| API subdomains | `api.`, `staging.` and `app.` do not resolve |

## The finding that matters

**There is no functioning backend deployed.** `/api/health` returns
`{"status":"ok"}` with Helmet security headers, so something Node-shaped is
running behind nginx. Every other route returns 404:

| Route | Status |
|---|---|
| `/api/auth/register` | 404 |
| `/api/auth/login` | 404 |
| `/api/cases` | 404 |
| `/api/evidence/upload` | 404 |
| `/api/certification/status` | 404 |
| `/api/law/status` | 404 |
| `/api/charging/codes` | 404 |
| `/api/billing/subscription` | 404 |

A visitor to courtaccess.net today **cannot register, cannot sign in, and
cannot upload anything.** The site is a static shell in front of a health
check. It has been in that state for roughly six weeks.

## Why the frontend is stale

`.github/workflows/deploy-production.yml` deploys the frontend and only the
frontend. Its trigger paths are `src/**`, `index.html`, `package.json`,
`vite.config.ts` and `public/**` — nothing under `backend/`. It builds with
Vite and copies `dist` to the host over SSH using `DEPLOY_HOST`, `DEPLOY_USER`
and `DEPLOY_SSH_KEY`.

It also only fires on pushes to `dev`. This branch has not been merged, so no
deployment has been triggered by any of the work in Programs 145–155.

**There has never been a backend deployment path.** No workflow, script or
manifest in this repository deploys `backend/`, runs migrations, or starts
workers. That is the gap, and it is why the health endpoint predates the
codebase: whatever is answering was put there by hand months ago and never
replaced.

## What deploying properly requires

The application needs PostgreSQL, Redis, the Fastify API, the built frontend
and background workers, with ffmpeg present for media measurement and outbound
HTTPS to `leginfo.legislature.ca.gov` for statutory retrieval. None of that
exists on the host today.

[`bootstrap-ec2.sh`](bootstrap-ec2.sh) does the whole thing in one command.
[`README.md`](README.md) covers the compose stack it brings up.
