# CourtAccess V1 — Greenfield Deployment Plan

**Status:** Preparation complete — ready for server execution  
**Source branch:** `origin/dev`  
**Production constraint:** Legacy `/var/www/courtaccess` and `https://courtaccess.net` remain untouched until cutover.

---

## Overview

V1 deploys as a **parallel greenfield installation** beside existing production. The new stack runs on alternate ports and paths, is fully verified, then promoted via a controlled cutover with rollback.

| Phase | Script | Touches production? |
|-------|--------|---------------------|
| 1. Install | `scripts/v1-greenfield-install.sh` | No |
| 2. Verify | `scripts/v1-greenfield-verify.sh` | No (read-only smoke on prod URL) |
| 3. Cutover | `scripts/v1-production-cutover.sh` | Yes — only after verify PASS |

---

## Architecture

```
Legacy (untouched during phases 1–2)          V1 parallel install
────────────────────────────────────          ────────────────────
/var/www/courtaccess                          /var/www/courtaccess-v1
API :3001                                     API :3101
nginx → courtaccess.net (443)                 nginx → :8080 (local)
PM2: courtaccess                              PM2: courtaccess-v1
DB: courtaccess                               DB: courtaccess_v1
```

After cutover, V1 is promoted to `/var/www/courtaccess` on standard ports.

---

## Prerequisites (server operator)

Run on the production server **before** phase 1:

### 1. System packages
```bash
sudo apt update
sudo apt install -y git nginx postgresql-client build-essential
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

### 2. Separate V1 database
```bash
sudo -u postgres psql <<'SQL'
CREATE DATABASE courtaccess_v1;
CREATE USER courtaccess WITH ENCRYPTED PASSWORD '<STRONG_PASSWORD>';
GRANT ALL PRIVILEGES ON DATABASE courtaccess_v1 TO courtaccess;
SQL
```

### 3. Secrets
Copy production secrets into V1 without modifying legacy `.env`:

```bash
export ENV_SOURCE=/var/www/courtaccess/backend/.env   # read-only copy source
```

Edit `/var/www/courtaccess-v1/backend/.env` after install to set:
- `DATABASE_URL` → `postgresql://courtaccess:<PASSWORD>@localhost:5432/courtaccess_v1?schema=public`
- `JWT_SECRET`, `OPENAI_API_KEY`, `STRIPE_SECRET_KEY`, etc.

### 4. Repository access
Server must reach `git@github.com:Sailors071968/Court_Access.git` (SSH deploy key) or override:
```bash
export GIT_REMOTE=https://github.com/Sailors071968/Court_Access.git
```

---

## Phase 0 — Preflight (read-only)

On the production EC2 server:

```bash
cd /var/www/courtaccess   # or your discovered production path
git fetch origin dev && git checkout dev && git pull origin dev
bash scripts/v1-greenfield-preflight.sh
# Optional JSON report:
bash scripts/v1-greenfield-preflight.sh --json /tmp/v1-preflight-report.json
```

**READINESS: PASS** required before Phase 1. The script makes no modifications.

## Phase 1 — Greenfield install

```bash
cd /tmp
git clone --branch dev https://github.com/Sailors071968/Court_Access.git courtaccess-deploy
cd courtaccess-deploy

# Optional: copy secrets from legacy (does not modify legacy)
export ENV_SOURCE=/var/www/courtaccess/backend/.env

sudo bash scripts/v1-greenfield-install.sh
```

**Expected output:** `V1_INSTALL_MANIFEST.json` at `/var/www/courtaccess-v1/`

**Smoke test (local only — does not affect courtaccess.net):**
```bash
curl http://127.0.0.1:8080/ | grep "Criminal Case Intelligence Platform"
curl http://127.0.0.1:8080/api/health
```

---

## Phase 2 — Verification

```bash
bash /var/www/courtaccess-v1/scripts/v1-greenfield-verify.sh
```

All checks must PASS (SKIP is acceptable for Stripe if keys not configured).  
Fix any FAIL before proceeding.

---

## Phase 3 — Production cutover

**Only run after phase 2 PASS.** Creates full backup and rollback script.

```bash
bash /var/www/courtaccess-v1/scripts/v1-production-cutover.sh
```

Rollback (if needed):
```bash
bash /root/courtaccess-cutover/<TIMESTAMP>/rollback-to-legacy.sh
```

---

## CI/CD relationship

GitHub Actions `Deploy Production Website` workflow still requires `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY` for automated frontend deploys to legacy paths. The greenfield path is **independent** and does not require those secrets for phases 1–2.

For frontend-only hotfixes after cutover, either:
- Re-run cutover from an updated V1 install, or
- Configure GitHub production environment secrets and use `scripts/deploy-production-website.sh`

---

## Checklist

- [ ] `origin/dev` at expected commit (see `V1_INSTALL_MANIFEST.json` after install)
- [ ] `v1-greenfield-preflight.sh` PASS
- [ ] `v1-greenfield-install.sh` completed
- [ ] `v1-greenfield-verify.sh` PASS
- [ ] Stripe billing readiness (if billing required at launch)
- [ ] Stakeholder sign-off for cutover window
- [ ] `v1-production-cutover.sh` executed
- [ ] Post-cutover: `https://courtaccess.net/api/health` returns `"version":"1.1.0"`

---

## Files

| File | Purpose |
|------|---------|
| `scripts/v1-greenfield-preflight.sh` | Read-only Phase 0 audit (runtime, DB, PM2, nginx, ports) |
| `scripts/v1-greenfield-install.sh` | Fresh clone, build, nginx :8080, PM2 :3101 |
| `scripts/v1-greenfield-verify.sh` | End-to-end verification without prod changes |
| `scripts/v1-production-cutover.sh` | Promote V1 to production with rollback |
| `backend/.env.production.template` | Environment variable reference |
