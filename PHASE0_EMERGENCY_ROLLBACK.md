# Phase 0 — Emergency Rollback

Target: full rollback in under 60 seconds.

---

## ROLLBACK — EXECUTE NOW

```bash
cd /var/www/courtaccess_repo

# 1. Kill broken process (5s)
pm2 delete courtaccess-api

# 2. Restore files (5s)
cp backend/src/server.ts.pre-phase0 backend/src/server.ts
cp ecosystem.config.cjs.pre-phase0 ecosystem.config.cjs

# 3. Restart with original config (10s)
pm2 start ecosystem.config.cjs --only courtaccess-api
pm2 save

# 4. Wait for startup (10s)
sleep 10

# 5. Verify (5s)
curl -s https://courtaccess.net/api/health | python3 -m json.tool
pm2 status
```

Total: ~35 seconds.

---

## NGINX ROLLBACK (only if NGINX was changed)

```bash
sudo cp /etc/nginx/nginx.conf.pre-phase0 /etc/nginx/nginx.conf
sudo nginx -t
sudo systemctl reload nginx
curl -sI https://courtaccess.net | head -5
```

Total: ~10 seconds.

---

## ENVIRONMENT ROLLBACK (only if .env was changed)

```bash
cp backend/.env.pre-phase0 backend/.env
pm2 restart courtaccess-api
sleep 5
curl -s https://courtaccess.net/api/health | python3 -m json.tool
```

---

## PM2 PROCESS LIST ROLLBACK

```bash
pm2 delete all
pm2 resurrect --dump-path ~/.pm2/dump.pm2.pre-phase0
pm2 save
pm2 status
```

---

## FULL NUCLEAR ROLLBACK (everything at once)

```bash
cd /var/www/courtaccess_repo

pm2 delete courtaccess-api
cp backend/src/server.ts.pre-phase0 backend/src/server.ts
cp ecosystem.config.cjs.pre-phase0 ecosystem.config.cjs
cp backend/.env.pre-phase0 backend/.env
sudo cp /etc/nginx/nginx.conf.pre-phase0 /etc/nginx/nginx.conf
sudo nginx -t && sudo systemctl reload nginx

pm2 start ecosystem.config.cjs --only courtaccess-api
pm2 save
sleep 10

curl -s https://courtaccess.net/api/health | python3 -m json.tool
pm2 status
curl -sI https://courtaccess.net | head -5
```

Total: ~45 seconds.

---

## VERIFY ROLLBACK SUCCEEDED

```bash
# Health returns response (any response = backend alive)
curl -s https://courtaccess.net/api/health

# PM2 shows online
pm2 status

# NGINX serves frontend
curl -s -o /dev/null -w "%{http_code}" https://courtaccess.net
# Expected: 200

# No crash loop
sleep 30 && pm2 show courtaccess-api | grep 'restarts'
# Expected: 0
```

---

## ROLLBACK EVIDENCE CAPTURE

```bash
EVIDENCE_DIR="/var/www/courtaccess_repo/phase-logs/phase0_rollback_$(date -u +%Y%m%d_%H%M%S)"
mkdir -p "$EVIDENCE_DIR"
curl -s https://courtaccess.net/api/health > "$EVIDENCE_DIR/rollback-health.json"
pm2 status > "$EVIDENCE_DIR/rollback-pm2-status.txt" 2>&1
pm2 logs courtaccess-api --lines 100 --nostream > "$EVIDENCE_DIR/rollback-pm2-logs.txt" 2>&1
echo "Rollback evidence: $EVIDENCE_DIR"
```

---

## IF ROLLBACK ALSO FAILS

```bash
# Last resort: restore PM2 dump from before any changes
pm2 delete all
pm2 resurrect --dump-path ~/.pm2/dump.pm2.pre-phase0

# If PM2 dump is corrupted, manual start:
cd /var/www/courtaccess_repo
pm2 start "npx tsx backend/src/server.ts" --name courtaccess-api
pm2 save
```
