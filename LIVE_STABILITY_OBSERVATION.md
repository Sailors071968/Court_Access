# Live Stability Observation — 10-Minute Procedure

---

## Setup

Open 3 terminal tabs:

- **Tab 1**: Polling loop
- **Tab 2**: PM2 log stream
- **Tab 3**: Ad-hoc commands

---

## Tab 2: Start Log Stream (run first)

```bash
pm2 logs courtaccess-api --lines 0
```

Leave running. Watch for:

| Pattern | Severity | Action |
|---------|----------|--------|
| `[Redis] Connection error` | LOW (if DISABLE_WORKERS=true) | Expected. Ignore unless flooding. |
| `ECONNREFUSED` | MEDIUM | Note frequency. If > 1/min, investigate. |
| `FATAL` | CRITICAL | Immediate rollback. |
| `process.exit` | CRITICAL | Immediate rollback. |
| `PrismaClientInitializationError` | CRITICAL | Immediate rollback. |
| `UnhandledPromiseRejection` | HIGH | Note. Rollback if > 5 in 10 min. |
| `Error: listen EADDRINUSE` | CRITICAL | Port conflict. Rollback. |
| `heap out of memory` | CRITICAL | Immediate rollback. |

---

## Tab 1: Polling Loop

```bash
START_RESTARTS=$(pm2 show courtaccess-api 2>/dev/null | grep 'restarts' | awk '{print $NF}')
START_TIME=$(date -u +%s)

echo "Starting 10-minute observation. Initial restarts: $START_RESTARTS"
echo "Time | Health | Status | Restarts | Memory"
echo "-----|--------|--------|----------|---------"

for i in $(seq 1 10); do
  sleep 60
  NOW=$(date -u +%H:%M:%S)
  HEALTH=$(curl -s -o /dev/null -w "%{http_code}" https://courtaccess.net/api/health)
  STATUS=$(pm2 show courtaccess-api 2>/dev/null | grep '│ status' | awk '{print $NF}')
  RESTARTS=$(pm2 show courtaccess-api 2>/dev/null | grep 'restarts' | awk '{print $NF}')
  MEM=$(pm2 show courtaccess-api 2>/dev/null | grep 'heap size' | awk '{print $NF}')
  echo "$NOW | $HEALTH | $STATUS | $RESTARTS | $MEM"

  # Auto-fail checks
  if [ "$STATUS" != "online" ]; then
    echo "FAIL: Process not online. ROLLBACK."
    break
  fi
  if [ "$RESTARTS" != "$START_RESTARTS" ]; then
    echo "FAIL: Restart detected ($START_RESTARTS → $RESTARTS). ROLLBACK."
    break
  fi
  if [ "$HEALTH" != "200" ]; then
    echo "WARNING: Health returned $HEALTH"
  fi
done

echo ""
echo "Observation complete."
```

---

## Thresholds

### Memory

| Value | Status | Action |
|-------|--------|--------|
| < 200MB heap | Normal | Continue |
| 200-300MB heap | Elevated | Monitor closely |
| 300-400MB heap | Warning | Document. Check for leak. |
| > 400MB heap | Critical | Rollback if growing. |
| > 50MB growth in 10 min | Abnormal | Potential leak. Rollback. |

### Restarts

| Value | Status | Action |
|-------|--------|--------|
| 0 | Normal | Continue |
| 1 | Investigate | Check logs immediately. Continue if explained. |
| 2+ | Fail | Rollback. |

### Health Response

| Code | Status | Action |
|------|--------|--------|
| 200 | Normal | Continue |
| 503 | Degraded | Check `/api/health/deep` for which component. |
| 500 | Error | Check PM2 logs. Rollback if persistent. |
| No response | Critical | Backend down. Rollback. |

### Log Patterns

| Pattern | Acceptable Frequency | Rollback If |
|---------|---------------------|-------------|
| `[Redis] Connection error` | ≤ 1/min (workers disabled) | > 10/min |
| `warn` level logs | Any frequency | Never (warnings are informational) |
| `error` level logs | ≤ 1/min | > 5/min sustained |
| `FATAL` / `process.exit` | Never | Any occurrence |

---

## NGINX Monitoring (Tab 3, ad-hoc)

```bash
# Check NGINX is serving
curl -s -o /dev/null -w "%{http_code}" https://courtaccess.net
# Expected: 200

# Check NGINX error log for new entries
sudo tail -5 /var/log/nginx/error.log

# Check NGINX status
sudo systemctl status nginx --no-pager | head -5
```

---

## Browser Refresh Cadence

During the 10-minute observation:

| Minute | Browser Action |
|--------|---------------|
| 0 | Open site. Open DevTools. Check Console. |
| 3 | Refresh page. Check Console for new errors. |
| 5 | Navigate to a different page (e.g., login). Check Network tab. |
| 7 | Hard refresh (Ctrl+Shift+R). Check Console. |
| 10 | Final check. Screenshot Console. Screenshot Network. |

---

## Pass / Fail Summary

After 10 minutes, ALL must be true:

```
[ ] Health returned 200 on all 10 checks
[ ] PM2 status was online on all 10 checks
[ ] Restart count did not change
[ ] Memory growth was < 50MB
[ ] Zero FATAL/process.exit in logs
[ ] Unhandled rejections ≤ 2
[ ] Browser Console has zero CSP violations
[ ] Frontend rendered correctly on all refreshes
```

If all YES: stability gate PASSED. Proceed to final evidence collection.
If any NO: stability gate FAILED. Execute rollback. Report findings.
