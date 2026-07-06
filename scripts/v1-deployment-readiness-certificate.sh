#!/usr/bin/env bash
# ==============================================================================
# CourtAccess V1 — Deployment Readiness Certificate (Blocker 1)
# Read-only audit + certificate JSON. Does NOT modify production repos.
# Run from /tmp origin/dev clone per GREENFIELD_V1_DEPLOYMENT.md Phase 0.
# Usage: bash scripts/v1-deployment-readiness-certificate.sh [--out /path/cert.json]
# ==============================================================================
set -uo pipefail

OUT="${1:-/tmp/v1-deployment-readiness-certificate.json}"
[[ "${1:-}" == "--out" && -n "${2:-}" ]] && OUT="$2"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PREFLIGHT="${SCRIPT_DIR}/v1-greenfield-preflight.sh"
TMP_REPORT="$(mktemp)"

if [[ ! -f "$PREFLIGHT" ]]; then
  echo "FATAL: v1-greenfield-preflight.sh not found beside this script" >&2
  exit 1
fi

echo "==> Running Phase 0 preflight (read-only)"
set +e
bash "$PREFLIGHT" --json "$TMP_REPORT"
PREFLIGHT_EXIT=$?
set -e

TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
READINESS="FAIL"
[[ "$PREFLIGHT_EXIT" -eq 0 ]] && READINESS="PASS"

PASS="$(grep -o '"pass": [0-9]*' "$TMP_REPORT" 2>/dev/null | head -1 | grep -o '[0-9]*' || echo 0)"
WARN="$(grep -o '"warn": [0-9]*' "$TMP_REPORT" 2>/dev/null | head -1 | grep -o '[0-9]*' || echo 0)"
FAIL="$(grep -o '"fail": [0-9]*' "$TMP_REPORT" 2>/dev/null | head -1 | grep -o '[0-9]*' || echo 0)"

cat >"$OUT" <<EOF
{
  "certificate": "CourtAccess V1 Deployment Readiness",
  "blocker": "BLOCKER-1-GREENFIELD",
  "issuedAt": "${TS}",
  "readiness": "${READINESS}",
  "preflightExitCode": ${PREFLIGHT_EXIT},
  "summary": { "pass": ${PASS}, "warn": ${WARN}, "fail": ${FAIL} },
  "architecture": {
    "v1Path": "/var/www/courtaccess-v1",
    "productionFrozen": "/var/www/courtaccess",
    "cloneSource": "origin/dev"
  },
  "prerequisites": [
    "PostgreSQL courtaccess_v1",
    "Redis (optional REDIS_URL)",
    "Upload directories writable",
    "OCR tesseract.js + optional system binaries",
    "PM2 courtaccess-v1 on ports 3101/8080",
    "Nginx courtaccess-v1 site",
    "ENV_SOURCE read-only from production .env",
    "Stripe keys for billing:readiness (optional at install)"
  ],
  "preflightReport": "${TMP_REPORT}",
  "nextPhase": "bash scripts/v1-greenfield-install.sh (from /tmp clone bootstrap)"
}
EOF

echo "==> Certificate written: $OUT"
echo "==> READINESS: $READINESS"

rm -f "$TMP_REPORT"
exit "$PREFLIGHT_EXIT"
