# Priority Zero — Production Website Investigation

**Date:** July 5, 2026  
**Site:** https://courtaccess.net  
**Status:** ROOT CAUSE IDENTIFIED — DEPLOYMENT REQUIRED  
**Branch:** `cursor/priority-zero-production-website-b98a`

---

## Executive Summary

Production at https://courtaccess.net is serving a **stale frontend build from June 26, 2026** that does not exist in the current repository. The live site shows a legacy shell titled **"Court Access System"** with a **"Loading Court Access..."** spinner — not the **Criminal Case Intelligence Platform** landing page implemented in the codebase.

The correct landing page **exists in git** but was **never merged to `dev` or deployed** to the production server.

---

## Root Cause Analysis

| Check | Result | Evidence |
|-------|--------|----------|
| Old frontend build | **YES** | `Last-Modified: Fri, 26 Jun 2026 19:17:43 GMT` |
| Incorrect deployment | **YES** | No deploy after landing page recovery (Jul 5) |
| Incorrect build output | **YES** | Production HTML ≠ current `dist/index.html` |
| Nginx configuration | **OK** | nginx/1.28.1 serves static `dist/` correctly |
| PM2 serving stale build | **POSSIBLE** | `ecosystem.config.cjs` runs vite preview on 4173; nginx serves `dist/` directly |
| Cloudflare cache | **UNLIKELY PRIMARY** | No CF cache headers; stale `Last-Modified` on origin |
| Old React bundle | **YES** | `/assets/index-HSm04BBy.js` contains `Loading Court Access...` |
| Missing frontend merge | **YES — PRIMARY** | `origin/dev` at `376d6bc`; landing recovery never merged |
| Incorrect routing | **NO** | nginx `try_files` pattern is standard SPA |
| Incorrect environment | **NO** | Server responds; content is simply outdated |

### Primary Root Cause

**Missing frontend merge + no production redeploy.**

1. Landing page recovery (`cursor/landing-page-recovery-b98a`, commits `e12ec0e` + `507d158`) was completed in a parallel branch.
2. `origin/dev` remains at merge-base `376d6bc` — **27 commits behind** the current implementation branch.
3. Production nginx serves `/opt/courtaccess/dist` built on **June 26, 2026**.
4. That build's React bundle (`index-HSm04BBy.js`) contains `Loading Court Access...` — a string **not present anywhere** in the current codebase.

### What Production Serves Today

```html
<title>Court Access System</title>
<script type="module" crossorigin src="/assets/index-HSm04BBy.js"></script>
```

### What the Codebase Builds Today

```html
<title>CourtAccess — Criminal Case Intelligence Platform</title>
<!-- Vite bundle with LandingPage.tsx: Criminal Case Intelligence Platform -->
```

---

## Verification (Local)

After `npm run build` on `cursor/priority-zero-production-website-b98a` (2026-07-05T15:56:50Z):

| Check | Result |
|-------|--------|
| `dist/index.html` title | **Criminal Case Intelligence Platform** |
| Landing headline | **Criminal Case Intelligence Platform** |
| Stale bundle string | **Absent** (`Loading Court Access` not in `dist/assets/*.js`) |
| Build bundle | `index-BsMoi7YC.js` (replaces production `index-HSm04BBy.js`) |
| Program 0 routes | **13/13 PASS** (`scripts/program-00-verify.mjs`) |
| Headline assertion | **PASS** |
| Screenshots | 7 captured in `reports/screenshots/program-00/` |

### Production (pre-deploy, 2026-07-05)

| Check | Result |
|-------|--------|
| Title | `Court Access System` (stale) |
| Bundle | `/assets/index-HSm04BBy.js` |
| Last-Modified | `Fri, 26 Jun 2026 19:17:43 GMT` |
| Criminal Case Intelligence Platform | **Not present** |

---

## Resolution

### Step 1 — Merge to `dev`

Merge PRs containing:
- Landing page recovery (`cursor/landing-page-recovery-b98a`)
- Program 0 public website pages
- Priority zero index.html branding fix

### Step 2 — Deploy on production server

```bash
# On production server
export DEPLOY_DIR=/opt/courtaccess
export DEPLOY_BRANCH=dev
bash scripts/deploy-production-website.sh
```

Or manually:

```bash
cd /opt/courtaccess
git fetch origin dev && git checkout dev && git pull origin dev
npm ci && npm run build
sudo nginx -t && sudo systemctl reload nginx
# Optional: purge Cloudflare cache if enabled
```

### Step 3 — Verify production

```bash
curl -s https://courtaccess.net/ | grep "Criminal Case Intelligence Platform"
curl -sI https://courtaccess.net/ | grep Last-Modified  # should be current date
```

Expected: landing page shows navy/amber **Criminal Case Intelligence Platform** design with pricing tiers and 30-day trial CTA.

---

## Screenshots

Captured locally after build (see `reports/screenshots/program-00/`):

| File | Viewport |
|------|----------|
| `landing-desktop.png` | 1440×900 |
| `landing-tablet.png` | 768×1024 |
| `landing-mobile.png` | 390×844 |

Production screenshots require post-deploy capture on courtaccess.net.

---

## Prevention

1. **Deploy frontend on every merge to `dev`** affecting `src/pages/LandingPage.tsx` or `index.html`.
2. **CI gate:** `npm run build && npm run program-00:verify` before deploy.
3. **Version stamp** in `dist/index.html` comment with git SHA and build timestamp.
4. **Single deploy path:** nginx `root` → `/opt/courtaccess/dist` only (not mixed with vite preview).

---

## Checklist

- [x] Root cause identified
- [x] Local build verified
- [x] Deploy script created (`scripts/deploy-production-website.sh`)
- [x] index.html branding updated
- [x] Local screenshots captured
- [ ] Merge to `dev`
- [ ] Production deploy executed
- [ ] Production screenshots captured
- [ ] Cloudflare cache purged (if applicable)
