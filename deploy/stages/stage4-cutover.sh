#!/usr/bin/env bash
# ============================================================================
# Stage 4 — Switch nginx to the Version 1.0 upstream.
#
# THE ONLY USER-VISIBLE CHANGE IN THIS DEPLOYMENT.
#
# Everything before this was additive and reversed by deleting a directory.
# This stage edits one nginx server block. Rollback is restoring that one file
# and reloading — the existing application is still running on its own port
# with its own database and receives traffic again immediately.
#
# This script does NOT edit nginx for you. It verifies the preconditions,
# backs up the file, prints exactly what to change, and then verifies the
# result after you have made the change and reloaded.
#
#   export NODE22=...
#   bash deploy/stages/stage4-cutover.sh precheck     # before editing
#   bash deploy/stages/stage4-cutover.sh verify       # after reloading
# ============================================================================

STAGE_NAME="Stage 4 — nginx cut-over"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_common.sh
. "$DIR/_common.sh"

MODE="${1:-precheck}"
SITE="${SITE:-courtaccess.net}"

deploy_env || { finish; exit 1; }

# ---------------------------------------------------------------------------
if [ "$MODE" = "precheck" ]; then
  verify_interpreter
  baseline_existing

  assert_artifact_frozen

  say "GATE — the new installation must be fully healthy first"
  BASE="http://127.0.0.1:$V1_PORT"
  for pair in "health:/api/health" "ready:/api/health/ready" "deep:/api/health/deep"; do
    name="${pair%%:*}"; path="${pair#*:}"
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$BASE$path")"
    check "new install $name" "200" "$code"
  done
  LOGIN="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 -X POST \
    -H 'Content-Type: application/json' -d '{"email":"nobody@example.com","password":"wrong"}' \
    "$BASE/api/auth/login")"
  check "new install login (bad credentials)" "401" "$LOGIN"

  RESTARTS="$(pm2 jlist 2>/dev/null | "$NODE22" -e '
    let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{
      let ps=[];try{ps=JSON.parse(d)}catch(e){}
      const p=ps.find(x=>x.name===process.env.V1_PM2_NAME);
      console.log(p?p.pm2_env.restart_time:"missing");});' 2>/dev/null)"
  check "new install restart count" "0" "$RESTARTS"

  [ "$FAILURES" -eq 0 ] || { info "The new installation is not healthy. Do not cut over."; finish; exit 1; }

  say "LOCATE THE LIVE SERVER BLOCK"
  sudo nginx -T 2>/dev/null | grep -nE "server_name.*$SITE" | sed 's/^/    /' | head -5
  info "nginx -T shows which file each directive came from; find the one for $SITE:"
  sudo nginx -T 2>/dev/null | grep -E '^# configuration file' | sed 's/^/    /' | head -10

  say "BACK UP THE FILE FIRST"
  mkdir -p "$STATE"
  info "Set NGINX_SITE to the file you identified, then:"
  info "  sudo cp \"\$NGINX_SITE\" $STATE/nginx-site.backup"
  info "  ls -l $STATE/nginx-site.backup"

  say "THEN CHANGE EXACTLY THESE THREE THINGS"
  cat <<EOF
    root $V1/dist/public;                    # was $APP_EXISTING/dist/public

    location /api {
        proxy_pass http://127.0.0.1:$V1_PORT;    # was the old port
        client_max_body_size 64m;                # was the 1 MB default
        proxy_request_buffering off;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
EOF
  info ""
  info "client_max_body_size matters as much as the port: at the 1 MB default"
  info "every 8 MB upload chunk is rejected with 413."

  say "THEN, BEFORE RELOADING"
  info "  sudo nginx -t          # must say 'syntax is ok' and 'test is successful'"
  info "  sudo systemctl reload nginx"
  info ""
  info "If nginx -t fails: sudo cp $STATE/nginx-site.backup \"\$NGINX_SITE\"  and do NOT reload."
  info ""
  info "Then run:  bash deploy/stages/stage4-cutover.sh verify"

  assert_existing_unchanged
  finish
  exit $?
fi

# ---------------------------------------------------------------------------
if [ "$MODE" = "verify" ]; then
  say "POST-CUT-OVER VERIFICATION  (public, over HTTPS)"

  HEALTH="$(curl -s --max-time 15 "https://$SITE/api/health" 2>/dev/null)"
  kv "/api/health" "$(printf '%s' "$HEALTH" | head -c 200)"

  LIVE_COMMIT="$(printf '%s' "$HEALTH" | "$NODE22" -pe 'let s="";try{s=JSON.parse(require("fs").readFileSync(0,"utf8")).commit||""}catch(e){};s' 2>/dev/null)"
  STAMP_COMMIT="$("$NODE22" -pe "JSON.parse(require('fs').readFileSync('$V1/dist/build-info.json','utf8')).commit" 2>/dev/null)"
  check_nonempty "health reports a commit (the old stub has no commit field)" "$LIVE_COMMIT"
  check "live commit matches the deployed build" "$STAMP_COMMIT" "$LIVE_COMMIT"

  READY="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "https://$SITE/api/health/ready")"
  DEEP="$(curl -s -o /dev/null -w '%{http_code}' --max-time 25 "https://$SITE/api/health/deep")"
  check "/api/health/ready" "200" "$READY"
  check "/api/health/deep"  "200" "$DEEP"

  # 404 here means the OLD stub is still answering: it 404s every route.
  LOGIN="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 -X POST \
    -H 'Content-Type: application/json' -d '{"email":"nobody@example.com","password":"wrong"}' \
    "https://$SITE/api/auth/login")"
  check "login with bad credentials (404 = old app still live)" "401" "$LOGIN"

  STAMP="$(curl -s --max-time 20 "https://$SITE/" | grep -o 'CourtAccess build:[^<]*' | head -1)"
  check_nonempty "frontend build stamp" "$STAMP"

  say "UPLOAD LIMIT  (404 expected, NOT 413)"
  head -c 2000000 /dev/zero > /tmp/cutover-2mb.bin
  BODY="$(curl -s -o /dev/null -w '%{http_code}' --max-time 40 -X POST \
    --data-binary @/tmp/cutover-2mb.bin "https://$SITE/api/health")"
  rm -f /tmp/cutover-2mb.bin
  check "2 MB POST passes nginx" "404" "$BODY"
  [ "$BODY" = "413" ] && info "413 means client_max_body_size was not raised; every upload chunk will be rejected."

  say "TLS"
  echo | timeout 20 openssl s_client -servername "$SITE" -connect "$SITE:443" 2>/dev/null \
    | openssl x509 -noout -dates -serial 2>&1 | sed 's/^/    /'

  say "PROCESS HEALTH"
  pm2 list 2>/dev/null | sed 's/^/    /' | head -12

  assert_existing_unchanged
  info ""
  info "The previous application is still running and untouched."
  info "Rollback: bash deploy/stages/rollback.sh"
  finish
  exit $?
fi

bad "unknown mode '$MODE' — use 'precheck' or 'verify'"
finish
