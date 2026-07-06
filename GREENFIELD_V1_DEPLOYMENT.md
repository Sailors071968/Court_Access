# CourtAccess V1 — Greenfield Deployment Plan

**Program 1A architecture**  
**Source branch:** `origin/dev` (cloned only into `/var/www/courtaccess-v1`)  
**Production constraint:** `/var/www/courtaccess` is **never** checked out to `origin/dev` and remains untouched until cutover succeeds.

---

## Architecture rules

| Rule | Detail |
|------|--------|
| **R1** | `/var/www/courtaccess` is the **live production** tree. No `git fetch`, `checkout`, `pull`, or `reset` on this path during Phases 0–2. |
| **R2** | Greenfield always deploys by cloning `origin/dev` into **`/var/www/courtaccess-v1`** (fresh clone or hard-reset **only** that path). |
| **R3** | Secrets may be **read** from `/var/www/courtaccess/backend/.env` (`ENV_SOURCE`). Never write to the production `.env`. |
| **R4** | Only `scripts/v1-production-cutover.sh` modifies production paths — and only after `v1-greenfield-verify.sh` returns PASS. |
| **R5** | Legacy paths `/var/www/courtaccess_repo` and PM2/nginx serving `courtaccess.net` stay live through Phases 0–2. |

```
PRODUCTION (frozen git state)              GREENFIELD (origin/dev clone)
────────────────────────────             ────────────────────────────────
/var/www/courtaccess                       /var/www/courtaccess-v1
  └── never checkout origin/dev              └── git clone origin/dev
API :3001                                    API :3101
nginx → courtaccess.net :443                 nginx → :8080 (localhost)
PM2: courtaccess                             PM2: courtaccess-v1
DB: courtaccess                              DB: courtaccess_v1
```

After successful cutover, the verified V1 tree is promoted to `/var/www/courtaccess`.

---

## Deployment sequence

### Phase 0 — Preflight (read-only)

Run from a **temporary** `origin/dev` clone. Do **not** run `git` operations inside `/var/www/courtaccess`.

```bash
export PROD_DIR=/var/www/courtaccess
export ENV_SOURCE=/var/www/courtaccess/backend/.env   # read-only

TMPDIR="$(mktemp -d)"
git clone --depth 1 --branch dev https://github.com/Sailors071968/Court_Access.git "${TMPDIR}/courtaccess-preflight"
bash "${TMPDIR}/courtaccess-preflight/scripts/v1-greenfield-preflight.sh" \
  --json /tmp/v1-preflight-report.json
rm -rf "${TMPDIR}"
```

**Checkpoint:** `READINESS: PASS` — resolve all FAIL items before Phase 1.

---

### Phase 1 — Greenfield install

Clones `origin/dev` into `/var/www/courtaccess-v1`. Does not touch `/var/www/courtaccess`.

```bash
export INSTALL_DIR=/var/www/courtaccess-v1
export ENV_SOURCE=/var/www/courtaccess/backend/.env   # read-only copy into V1 .env
export GIT_REMOTE=https://github.com/Sailors071968/Court_Access.git
export GIT_BRANCH=dev

# Bootstrap install script from origin/dev (no git ops on production repo)
TMPDIR="$(mktemp -d)"
git clone --depth 1 --branch dev "$GIT_REMOTE" "${TMPDIR}/courtaccess-install"
bash "${TMPDIR}/courtaccess-install/scripts/v1-greenfield-install.sh"
rm -rf "${TMPDIR}"
```

**Checkpoint:**

```bash
test -f /var/www/courtaccess-v1/V1_INSTALL_MANIFEST.json
curl -fsS http://127.0.0.1:8080/api/health | grep -q '"version":"1.1.0"'
# Production still on legacy build:
curl -fsS https://courtaccess.net/api/health | grep -q '"status":"ok"'
```

---

### Phase 2 — Verification

```bash
bash /var/www/courtaccess-v1/scripts/v1-greenfield-verify.sh
```

**Checkpoint:** `RESULT: PASS — ready for cutover planning` (FAIL count must be 0).

---

### Phase 3 — Production cutover

**Only after Phase 2 PASS.** This is the **only** step that modifies `/var/www/courtaccess` and live `courtaccess.net` routing.

```bash
bash /var/www/courtaccess-v1/scripts/v1-production-cutover.sh
```

**Checkpoint:**

```bash
curl -fsS https://courtaccess.net/ | grep -q "Criminal Case Intelligence Platform"
curl -fsS https://courtaccess.net/api/health | grep -q '"version":"1.1.0"'
```

**Rollback** (if cutover fails):

```bash
bash /root/courtaccess-cutover/<TIMESTAMP>/rollback-to-legacy.sh
```

---

## Prerequisites (before Phase 0)

1. **System:** Node ≥20, npm, PM2, nginx, PostgreSQL client, git, curl  
2. **Database:** `courtaccess_v1` created (separate from legacy `courtaccess`)  
3. **Secrets:** Production `.env` at `/var/www/courtaccess/backend/.env` (read-only source)  
4. **Ports:** `:3101` and `:8080` free; `:3001` and `:443` remain in use by production  
5. **Git access:** Server can clone `https://github.com/Sailors071968/Court_Access.git`

---

## Superseded paths (do not use for V1 greenfield)

These modify production directly and **must not** be used while `/var/www/courtaccess` must remain frozen:

| Path | Reason |
|------|--------|
| `scripts/deploy-production-website.sh` on `/var/www/courtaccess` | Checks out `origin/dev` on production repo |
| `scripts/deploy-dist-artifact.sh` with `DEPLOY_DIR=/var/www/courtaccess` | Overwrites production `dist/` |
| GitHub Actions SSH deploy to `/var/www/courtaccess` | Checks out `origin/dev` on production |

Use the greenfield sequence above instead. After cutover, routine deploys may target the promoted `/var/www/courtaccess` tree (now running V1 code).

---

## Checklist

- [ ] Phase 0 preflight PASS (from `/tmp` clone — production repo git untouched)
- [ ] `courtaccess_v1` database exists
- [ ] Phase 1 install complete at `/var/www/courtaccess-v1`
- [ ] Phase 2 verify PASS
- [ ] Stakeholder sign-off for cutover window
- [ ] Phase 3 cutover PASS
- [ ] Post-cutover: `https://courtaccess.net/api/health` returns `"version":"1.1.0"`

---

## Scripts

| File | Purpose |
|------|---------|
| `scripts/v1-greenfield-preflight.sh` | Read-only Phase 0 audit (run from `/tmp` clone) |
| `scripts/v1-greenfield-install.sh` | Clone `origin/dev` → `/var/www/courtaccess-v1`, build, nginx :8080 |
| `scripts/v1-greenfield-verify.sh` | End-to-end V1 verification; production smoke read-only |
| `scripts/v1-production-cutover.sh` | **Only** script that promotes V1 to production |
| `backend/.env.production.template` | Environment variable reference |
