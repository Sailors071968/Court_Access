# Phase 0 — Operator Commands

Copy/paste execution. No explanations.

---

## PRE-DEPLOY BACKUPS

```bash
cd /var/www/courtaccess_repo
TIMESTAMP=$(date -u +%Y%m%d_%H%M%S)
EVIDENCE_DIR="/var/www/courtaccess_repo/phase-logs/phase0_${TIMESTAMP}"
mkdir -p "$EVIDENCE_DIR"

cp backend/.env backend/.env.pre-phase0
cp backend/src/server.ts backend/src/server.ts.pre-phase0
cp ecosystem.config.cjs ecosystem.config.cjs.pre-phase0
sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.pre-phase0
pm2 save
cp ~/.pm2/dump.pm2 ~/.pm2/dump.pm2.pre-phase0

ls -la backend/.env.pre-phase0 backend/src/server.ts.pre-phase0 ecosystem.config.cjs.pre-phase0 /etc/nginx/nginx.conf.pre-phase0 ~/.pm2/dump.pm2.pre-phase0
```

Expected: all 5 files listed with non-zero size.

---

## PRE-DEPLOY EVIDENCE

```bash
curl -s https://courtaccess.net/api/health > "$EVIDENCE_DIR/pre-deploy-health.json"
curl -sI https://courtaccess.net > "$EVIDENCE_DIR/pre-deploy-headers.txt"
pm2 status > "$EVIDENCE_DIR/pre-deploy-pm2-status.txt" 2>&1
pm2 logs courtaccess-api --lines 50 --nostream > "$EVIDENCE_DIR/pre-deploy-pm2-logs.txt" 2>&1
```

---

## DEPLOY

```bash
cd /var/www/courtaccess_repo
git fetch origin devin/1778357361-courtaccess-recovery-stabilization
git checkout devin/1778357361-courtaccess-recovery-stabilization
git pull origin devin/1778357361-courtaccess-recovery-stabilization
cd backend && npm install && cd ..
sudo mkdir -p /var/log/pm2 && sudo chown $(whoami):$(whoami) /var/log/pm2
pm2 delete courtaccess-api
pm2 start ecosystem.config.cjs --only courtaccess-api
sleep 10
pm2 save
```

---

## CHECKPOINT A

```bash
curl -s https://courtaccess.net/api/health | python3 -m json.tool | tee "$EVIDENCE_DIR/checkpoint-a.txt"
```

Expected: `"environment": "production"`

---

## CHECKPOINT B

```bash
curl -sI https://courtaccess.net | tee "$EVIDENCE_DIR/checkpoint-b-headers.txt"
curl -sI -H 'Origin: http://localhost:3000' https://courtaccess.net/api/health | grep -i 'access-control' | tee "$EVIDENCE_DIR/checkpoint-b-cors.txt"
```

Expected: No `unsafe-eval` in CSP. No `localhost` in CSP. No `X-Powered-By`. No `access-control-allow-origin` for localhost.

---

## CHECKPOINT C

```bash
pm2 status | tee "$EVIDENCE_DIR/checkpoint-c-status.txt"
pm2 show courtaccess-api | grep -E 'status|restarts|memory|NODE_ENV|DOTENV' | tee "$EVIDENCE_DIR/checkpoint-c-details.txt"
```

Expected: status=online, restarts=0, NODE_ENV=production.

---

## CHECKPOINT D

```bash
pm2 logs courtaccess-api --lines 50 --nostream 2>&1 | tee "$EVIDENCE_DIR/checkpoint-d-logs.txt"
sudo systemctl status nginx --no-pager 2>&1 | tee "$EVIDENCE_DIR/checkpoint-d-nginx.txt"
```

Expected: Logs show `CourtAccess API running on http://0.0.0.0:3001`. No `FATAL` or `ECONNREFUSED`. NGINX active.

---

## CHECKPOINT D2

```bash
curl -s https://courtaccess.net/api/health/deep | python3 -m json.tool | tee "$EVIDENCE_DIR/checkpoint-d2-deep.txt"
curl -s https://courtaccess.net/api/metrics/failures | python3 -m json.tool | tee "$EVIDENCE_DIR/checkpoint-d2-failures.txt"
```

Expected: Deep health returns infrastructure + components. Failure visibility returns all zeros.

---

## CHECKPOINT E

```bash
ls -la backend/.env.pre-phase0 backend/src/server.ts.pre-phase0 ecosystem.config.cjs.pre-phase0 /etc/nginx/nginx.conf.pre-phase0 ~/.pm2/dump.pm2.pre-phase0 | tee "$EVIDENCE_DIR/checkpoint-e.txt"
```

Expected: all 5 files exist.

---

## 10-MINUTE STABILITY GATE

```bash
START_RESTARTS=$(pm2 show courtaccess-api 2>/dev/null | grep 'restarts' | awk '{print $NF}')
for i in $(seq 1 10); do
  sleep 60
  H=$(curl -s -o /dev/null -w "%{http_code}" https://courtaccess.net/api/health)
  S=$(pm2 show courtaccess-api 2>/dev/null | grep '│ status' | awk '{print $NF}')
  R=$(pm2 show courtaccess-api 2>/dev/null | grep 'restarts' | awk '{print $NF}')
  echo "[$i/10] health=$H status=$S restarts=$R"
done | tee "$EVIDENCE_DIR/stability-gate.txt"
```

Expected: all 10 checks show health=200, status=online, restarts unchanged.

---

## FINAL EVIDENCE

```bash
curl -s https://courtaccess.net/api/health | python3 -m json.tool > "$EVIDENCE_DIR/final-health.json"
curl -s https://courtaccess.net/api/health/deep | python3 -m json.tool > "$EVIDENCE_DIR/final-health-deep.json"
curl -s https://courtaccess.net/api/metrics/failures | python3 -m json.tool > "$EVIDENCE_DIR/final-failures.json"
curl -sI https://courtaccess.net > "$EVIDENCE_DIR/final-headers.txt"
pm2 status > "$EVIDENCE_DIR/final-pm2-status.txt" 2>&1
pm2 show courtaccess-api > "$EVIDENCE_DIR/final-pm2-show.txt" 2>&1
pm2 logs courtaccess-api --lines 200 --nostream > "$EVIDENCE_DIR/final-pm2-logs.txt" 2>&1
echo "Evidence: $EVIDENCE_DIR" && ls -la "$EVIDENCE_DIR"
```

---

## ROLLBACK (if anything fails)

```bash
cd /var/www/courtaccess_repo
pm2 delete courtaccess-api
cp backend/src/server.ts.pre-phase0 backend/src/server.ts
cp ecosystem.config.cjs.pre-phase0 ecosystem.config.cjs
pm2 start ecosystem.config.cjs --only courtaccess-api
pm2 save
sleep 10
curl -s https://courtaccess.net/api/health | python3 -m json.tool
pm2 status
```
