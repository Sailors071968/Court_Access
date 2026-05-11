# Phase 0 — FINAL EXECUTION RUNBOOK

**This is the canonical execution procedure for Phase 0 deployment.**

Read every step. Do not skip steps. Do not improvise.

If any step fails: STOP. Read the rollback section. Execute rollback. Report what happened.

---

## Pre-Flight Checklist

Before you begin, verify ALL of these. Do not proceed until all are YES.

```
[ ] You have SSH access to the EC2 instance
[ ] You know the current working directory: /var/www/courtaccess_repo
[ ] You can reach the backend: curl -s https://courtaccess.net/api/health returns JSON
[ ] PM2 is installed: pm2 --version returns a version number
[ ] Git is available: git --version returns a version number
[ ] You have sudo access (needed for NGINX only)
[ ] You know the git branch: devin/1778357361-courtaccess-recovery-stabilization
[ ] The backend .env file exists: ls -la /var/www/courtaccess_repo/backend/.env
[ ] The PM2 log directory exists (or you will create it): ls -la /var/log/pm2/
```

---

## STEP 1: Create Evidence Directory

```bash
TIMESTAMP=$(date -u +%Y%m%d_%H%M%S)
EVIDENCE_DIR="/var/www/courtaccess_repo/phase-logs/phase0_${TIMESTAMP}"
mkdir -p "$EVIDENCE_DIR"
echo "Evidence directory: $EVIDENCE_DIR"
```

Write down the evidence directory path. You will use it throughout.

---

## STEP 2: Capture Pre-Deployment State

This is your safety net. Do not skip any backup.

```bash
cd /var/www/courtaccess_repo

# Backup files
cp backend/.env backend/.env.pre-phase0
cp backend/src/server.ts backend/src/server.ts.pre-phase0
cp ecosystem.config.cjs ecosystem.config.cjs.pre-phase0
sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.pre-phase0

# Backup PM2 process list
pm2 save
cp ~/.pm2/dump.pm2 ~/.pm2/dump.pm2.pre-phase0

# Capture current state as evidence
curl -s https://courtaccess.net/api/health > "$EVIDENCE_DIR/pre-deploy-health.json" 2>&1
curl -sI https://courtaccess.net > "$EVIDENCE_DIR/pre-deploy-headers.txt" 2>&1
pm2 status > "$EVIDENCE_DIR/pre-deploy-pm2-status.txt" 2>&1
pm2 show courtaccess-api > "$EVIDENCE_DIR/pre-deploy-pm2-show.txt" 2>&1
pm2 logs courtaccess-api --lines 50 --nostream > "$EVIDENCE_DIR/pre-deploy-pm2-logs.txt" 2>&1
```

**VERIFY** — All 5 backup files exist:

```bash
ls -la backend/.env.pre-phase0
ls -la backend/src/server.ts.pre-phase0
ls -la ecosystem.config.cjs.pre-phase0
ls -la /etc/nginx/nginx.conf.pre-phase0
ls -la ~/.pm2/dump.pm2.pre-phase0
```

If any file is missing: STOP. Fix it before continuing.

---

## STEP 3: Pull Code Changes

```bash
cd /var/www/courtaccess_repo
git fetch origin devin/1778357361-courtaccess-recovery-stabilization
git checkout devin/1778357361-courtaccess-recovery-stabilization
git pull origin devin/1778357361-courtaccess-recovery-stabilization
```

**VERIFY** — The pull was successful:

```bash
git log --oneline -3
```

You should see the Stage 1 observability commit at the top.

---

## STEP 4: Install Dependencies

```bash
cd /var/www/courtaccess_repo/backend
npm install
```

**VERIFY** — No errors in the output. If you see `npm ERR!`, STOP and diagnose.

---

## STEP 5: Create PM2 Log Directory

```bash
sudo mkdir -p /var/log/pm2
sudo chown $(whoami):$(whoami) /var/log/pm2
```

---

## STEP 6: Stop Current Process

```bash
pm2 delete courtaccess-api
```

If PM2 says "process not found", that's OK. Continue.

**The API is now DOWN.** Proceed immediately to Step 7.

---

## STEP 7: Start with New Configuration

```bash
cd /var/www/courtaccess_repo
pm2 start ecosystem.config.cjs --only courtaccess-api
```

**Wait 10 seconds.**

```bash
sleep 10
```

---

## STEP 8: Verify Process Started

```bash
pm2 status
```

**Expected:** `courtaccess-api` shows `online` status.

If status is `errored` or `stopped`:
- Run `pm2 logs courtaccess-api --lines 50 --nostream` to see what happened
- Save the output: `pm2 logs courtaccess-api --lines 100 --nostream > "$EVIDENCE_DIR/startup-failure.txt" 2>&1`
- Go to ROLLBACK SECTION below

---

## STEP 9: Save PM2 State

```bash
pm2 save
```

---

## CHECKPOINT A — Environment Validation

```bash
echo "=== CHECKPOINT A ===" | tee "$EVIDENCE_DIR/checkpoint-a.txt"
curl -s https://courtaccess.net/api/health | python3 -m json.tool | tee -a "$EVIDENCE_DIR/checkpoint-a.txt"
```

**CHECK:** The JSON output must contain:
```
"environment": "production"
```

If it says `"environment": "development"` → Phase 0 fix DID NOT TAKE EFFECT.
- Save evidence: already captured above
- Go to ROLLBACK SECTION

If the curl fails entirely (connection refused, timeout):
- The server may still be starting. Wait 15 more seconds and retry.
- If still failing after 30s total, go to ROLLBACK SECTION.

---

## CHECKPOINT B — Security Headers Validation

```bash
echo "=== CHECKPOINT B ===" | tee "$EVIDENCE_DIR/checkpoint-b.txt"

echo "--- Response Headers ---" | tee -a "$EVIDENCE_DIR/checkpoint-b.txt"
curl -sI https://courtaccess.net | tee -a "$EVIDENCE_DIR/checkpoint-b.txt"

echo "" | tee -a "$EVIDENCE_DIR/checkpoint-b.txt"
echo "--- CORS Rejection Test ---" | tee -a "$EVIDENCE_DIR/checkpoint-b.txt"
curl -sI -H 'Origin: http://localhost:3000' https://courtaccess.net/api/health | grep -i 'access-control' | tee -a "$EVIDENCE_DIR/checkpoint-b.txt"
```

**CHECK:**
- `Content-Security-Policy` header should NOT contain `unsafe-eval`
- `Content-Security-Policy` header should NOT contain `localhost`
- `X-Powered-By` header should NOT appear
- `Strict-Transport-Security` header should be present
- CORS rejection: The `access-control-allow-origin` header should NOT appear for localhost origin

If CSP still contains `unsafe-eval` or `localhost` → NODE_ENV fix did not take effect. Go to ROLLBACK SECTION.

---

## CHECKPOINT C — PM2 Stability Validation

```bash
echo "=== CHECKPOINT C ===" | tee "$EVIDENCE_DIR/checkpoint-c.txt"

pm2 status | tee -a "$EVIDENCE_DIR/checkpoint-c.txt"
echo "---" | tee -a "$EVIDENCE_DIR/checkpoint-c.txt"
pm2 show courtaccess-api | grep -E 'status|restarts|memory|uptime|NODE_ENV|DOTENV' | tee -a "$EVIDENCE_DIR/checkpoint-c.txt"
```

**CHECK:**
- Status: `online`
- Restarts: `0` (no restarts since step 7)
- NODE_ENV in env: `production`

If restarts > 0: The process crashed and restarted. Check logs:
```bash
pm2 logs courtaccess-api --lines 100 --nostream > "$EVIDENCE_DIR/checkpoint-c-crashlogs.txt" 2>&1
```
If crash-looping, go to ROLLBACK SECTION.

---

## CHECKPOINT D — Runtime Validation

```bash
echo "=== CHECKPOINT D ===" | tee "$EVIDENCE_DIR/checkpoint-d.txt"

echo "--- PM2 Logs (last 50 lines) ---" | tee -a "$EVIDENCE_DIR/checkpoint-d.txt"
pm2 logs courtaccess-api --lines 50 --nostream 2>&1 | tee -a "$EVIDENCE_DIR/checkpoint-d.txt"

echo "" | tee -a "$EVIDENCE_DIR/checkpoint-d.txt"
echo "--- NGINX Status ---" | tee -a "$EVIDENCE_DIR/checkpoint-d.txt"
sudo systemctl status nginx --no-pager 2>&1 | tee -a "$EVIDENCE_DIR/checkpoint-d.txt"
```

**CHECK:**
- PM2 logs should show `[Server] CourtAccess API running on http://0.0.0.0:3001`
- PM2 logs should NOT show `ECONNREFUSED`, `FATAL`, or `process.exit(1)` errors
- PM2 logs should show `[Schema Assert] Skipped via SKIP_SCHEMA_ASSERT env var` (because ecosystem config sets this flag)
- NGINX should show `active (running)`

---

## CHECKPOINT D2 — Deep Health Validation (Stage 1)

```bash
echo "=== CHECKPOINT D2 ===" | tee "$EVIDENCE_DIR/checkpoint-d2.txt"

echo "--- Deep Health ---" | tee -a "$EVIDENCE_DIR/checkpoint-d2.txt"
curl -s https://courtaccess.net/api/health/deep | python3 -m json.tool | tee -a "$EVIDENCE_DIR/checkpoint-d2.txt"

echo "" | tee -a "$EVIDENCE_DIR/checkpoint-d2.txt"
echo "--- Failure Visibility ---" | tee -a "$EVIDENCE_DIR/checkpoint-d2.txt"
curl -s https://courtaccess.net/api/metrics/failures | python3 -m json.tool | tee -a "$EVIDENCE_DIR/checkpoint-d2.txt"

echo "" | tee -a "$EVIDENCE_DIR/checkpoint-d2.txt"
echo "--- Metrics JSON ---" | tee -a "$EVIDENCE_DIR/checkpoint-d2.txt"
curl -s https://courtaccess.net/api/metrics/json | python3 -m json.tool | tee -a "$EVIDENCE_DIR/checkpoint-d2.txt"
```

**CHECK:**
- Deep health returns a full report with `infrastructure`, `components` sections
- Postgres shows `healthy` or connection info
- Redis shows `disabled` (DISABLE_WORKERS=true) or `healthy`
- Failure visibility returns all-zero counters
- Metrics JSON returns structured metric data

If `/api/health/deep` returns 404: the observability routes may not have loaded. Check PM2 logs for import errors.

---

## CHECKPOINT E — Rollback Artifact Verification

```bash
echo "=== CHECKPOINT E ===" | tee "$EVIDENCE_DIR/checkpoint-e.txt"

echo "--- Rollback Files ---" | tee -a "$EVIDENCE_DIR/checkpoint-e.txt"
ls -la backend/.env.pre-phase0 | tee -a "$EVIDENCE_DIR/checkpoint-e.txt"
ls -la backend/src/server.ts.pre-phase0 | tee -a "$EVIDENCE_DIR/checkpoint-e.txt"
ls -la ecosystem.config.cjs.pre-phase0 | tee -a "$EVIDENCE_DIR/checkpoint-e.txt"
ls -la /etc/nginx/nginx.conf.pre-phase0 | tee -a "$EVIDENCE_DIR/checkpoint-e.txt"
ls -la ~/.pm2/dump.pm2.pre-phase0 | tee -a "$EVIDENCE_DIR/checkpoint-e.txt"
```

**CHECK:** All 5 backup files exist and have non-zero size.

---

## 10-MINUTE STABILITY GATE

Wait 10 minutes. Then verify nothing has changed:

```bash
echo "=== 10-MINUTE GATE ===" | tee "$EVIDENCE_DIR/stability-gate.txt"

# Record start state
START_RESTARTS=$(pm2 show courtaccess-api 2>/dev/null | grep 'restarts' | awk '{print $NF}')
echo "Start restarts: $START_RESTARTS" | tee -a "$EVIDENCE_DIR/stability-gate.txt"

echo "Waiting 10 minutes (checking every 60 seconds)..."

for i in $(seq 1 10); do
  sleep 60
  CURRENT_TIME=$(date -u +%H:%M:%S)
  HEALTH=$(curl -s -o /dev/null -w "%{http_code}" https://courtaccess.net/api/health)
  STATUS=$(pm2 show courtaccess-api 2>/dev/null | grep '│ status' | awk '{print $NF}')
  RESTARTS=$(pm2 show courtaccess-api 2>/dev/null | grep 'restarts' | awk '{print $NF}')
  MEM=$(pm2 show courtaccess-api 2>/dev/null | grep 'heap size' | awk '{print $NF}')
  echo "[$CURRENT_TIME] Check $i/10: health=$HEALTH status=$STATUS restarts=$RESTARTS memory=$MEM" | tee -a "$EVIDENCE_DIR/stability-gate.txt"

  if [ "$STATUS" != "online" ]; then
    echo "FAIL: Process not online at check $i" | tee -a "$EVIDENCE_DIR/stability-gate.txt"
    echo "STABILITY GATE FAILED" | tee -a "$EVIDENCE_DIR/stability-gate.txt"
    echo "Go to ROLLBACK SECTION"
    break
  fi

  if [ "$RESTARTS" != "$START_RESTARTS" ]; then
    echo "FAIL: Restart count changed ($START_RESTARTS → $RESTARTS) at check $i" | tee -a "$EVIDENCE_DIR/stability-gate.txt"
    echo "STABILITY GATE FAILED" | tee -a "$EVIDENCE_DIR/stability-gate.txt"
    echo "Go to ROLLBACK SECTION"
    break
  fi
done

echo "" | tee -a "$EVIDENCE_DIR/stability-gate.txt"
echo "Stability gate complete." | tee -a "$EVIDENCE_DIR/stability-gate.txt"
```

---

## BROWSER VALIDATION

After the stability gate passes:

1. Open `https://courtaccess.net` in a browser
2. Open DevTools (F12)
3. Check Console tab — should be zero CSP violations (red errors mentioning "Content-Security-Policy")
4. Check Network tab — verify requests to `/api/health` return 200
5. Check Application tab → Cookies — verify cookies have `Secure` and `HttpOnly` flags if present
6. Navigate to the login page — verify it renders correctly
7. Take a screenshot of the Console tab (even if empty — proof of no errors)

Save browser evidence:
- Console tab → Right-click → "Save as..." → `browser-console.txt`
- Copy to evidence directory

---

## FINAL EVIDENCE COLLECTION

```bash
echo "=== FINAL STATE ===" | tee "$EVIDENCE_DIR/final-state.txt"

curl -s https://courtaccess.net/api/health | python3 -m json.tool > "$EVIDENCE_DIR/final-health.json"
curl -s https://courtaccess.net/api/health/deep | python3 -m json.tool > "$EVIDENCE_DIR/final-health-deep.json"
curl -s https://courtaccess.net/api/metrics/json | python3 -m json.tool > "$EVIDENCE_DIR/final-metrics.json"
curl -s https://courtaccess.net/api/metrics/failures | python3 -m json.tool > "$EVIDENCE_DIR/final-failures.json"
curl -sI https://courtaccess.net > "$EVIDENCE_DIR/final-headers.txt"
pm2 status > "$EVIDENCE_DIR/final-pm2-status.txt" 2>&1
pm2 show courtaccess-api > "$EVIDENCE_DIR/final-pm2-show.txt" 2>&1
pm2 logs courtaccess-api --lines 200 --nostream > "$EVIDENCE_DIR/final-pm2-logs.txt" 2>&1

echo "Evidence collection complete."
echo "Directory: $EVIDENCE_DIR"
ls -la "$EVIDENCE_DIR"
```

---

## GO / NO-GO DECISION

All of the following must be YES:

```
[ ] Checkpoint A: environment = "production"
[ ] Checkpoint B: CSP has no unsafe-eval, no localhost; CORS rejects localhost
[ ] Checkpoint C: PM2 online, 0 restarts, NODE_ENV = production
[ ] Checkpoint D: No FATAL errors in logs, NGINX active
[ ] Checkpoint D2: Deep health returns full report, failure visibility returns zeros
[ ] Checkpoint E: All 5 rollback files exist
[ ] Stability Gate: 10 checks over 10 minutes, all passing
[ ] Browser: Zero CSP violations, login page renders
```

If ALL items are YES: **Phase 0 is COMPLETE.** Proceed to report evidence for go/no-go review.

If ANY item is NO: **Do NOT proceed.** Report which items failed and the evidence.

---

## ROLLBACK SECTION

If anything went wrong, execute these steps IN ORDER:

### Step R1: Stop the broken process

```bash
pm2 delete courtaccess-api
```

### Step R2: Restore all backed-up files

```bash
cd /var/www/courtaccess_repo
cp backend/src/server.ts.pre-phase0 backend/src/server.ts
cp ecosystem.config.cjs.pre-phase0 ecosystem.config.cjs
```

### Step R3: Restart with original configuration

```bash
cd /var/www/courtaccess_repo
pm2 start ecosystem.config.cjs --only courtaccess-api
pm2 save
```

### Step R4: Verify rollback

```bash
sleep 10
curl -s https://courtaccess.net/api/health | python3 -m json.tool
pm2 status
```

The health endpoint should return whatever it was returning before Phase 0.

### Step R5: Capture rollback evidence

```bash
curl -s https://courtaccess.net/api/health > "$EVIDENCE_DIR/rollback-health.json"
pm2 status > "$EVIDENCE_DIR/rollback-pm2-status.txt" 2>&1
pm2 logs courtaccess-api --lines 50 --nostream > "$EVIDENCE_DIR/rollback-pm2-logs.txt" 2>&1
echo "Rollback complete at $(date -u)" > "$EVIDENCE_DIR/rollback-timestamp.txt"
```

### Step R6: Report

Report what happened, which step failed, and attach the evidence directory contents.

---

## STOP CONDITIONS

Execute IMMEDIATE ROLLBACK if ANY of these occur at ANY point:

1. **PM2 restart count increases** — process is crash-looping
2. **`curl /api/health` returns connection refused** — backend is completely down
3. **`curl /api/health` returns 500** — backend has internal errors
4. **PM2 status shows `errored`** — process failed to start
5. **PM2 logs show `process.exit(1)` or `FATAL`** — hard failure
6. **Browser shows white screen** — frontend is broken
7. **Browser console shows flood of CSP violations** — security headers misconfigured
8. **Login page does not render** — routing is broken
9. **Memory exceeds 400MB within 5 minutes** — memory leak

---

## WHAT NOT TO DO

- Do NOT apply the NGINX config changes during Phase 0. NGINX changes are a separate step.
- Do NOT restart NGINX. Phase 0 is backend-only.
- Do NOT rotate secrets. That is Phase A.
- Do NOT uncomment auth hooks. That is Phase B.
- Do NOT uncomment CSRF hooks. That is Phase B Step 2.
- Do NOT change DISABLE_WORKERS. That is post-Phase C.
- Do NOT modify any file other than pulling from git.
- Do NOT run `prisma migrate deploy`. Schema assertion is skipped via SKIP_SCHEMA_ASSERT.
- Do NOT run `npm run build` in the frontend directory. Frontend deployment is separate.

---

## TIMING

Expected total time:
- Pre-flight checks: 2 minutes
- Backups: 1 minute
- Git pull + npm install: 2 minutes
- PM2 restart + initial checks: 2 minutes
- Checkpoint A-E: 5 minutes
- 10-minute stability gate: 10 minutes
- Browser validation: 5 minutes
- Final evidence collection: 2 minutes

**Total: ~30 minutes**

Perform this during lowest-traffic window available.
