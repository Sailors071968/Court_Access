#!/usr/bin/env bash
# ============================================================================
# Rollback — return traffic to the existing application.
#
# By design this is one file restore and one nginx reload. The previous
# application has been running untouched on its own port, with its own
# database, for the whole deployment, so it resumes serving immediately.
#
# Nothing here stops, deletes, or modifies the Version 1.0 installation:
# leaving it in place preserves the evidence needed to diagnose why the
# cut-over was reverted.
#
#   export NODE22=...
#   export NGINX_SITE=/etc/nginx/...        # the file changed at cut-over
#   bash deploy/stages/rollback.sh
# ============================================================================

STAGE_NAME="Rollback — restore the previous application"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_common.sh
. "$DIR/_common.sh"

SITE="${SITE:-courtaccess.net}"
BACKUP="$STATE/nginx-site.backup"

deploy_env || true   # rollback must work even if the toolchain is unhappy

say "PRE-FLIGHT"
if [ -z "${NGINX_SITE:-}" ]; then
  bad "NGINX_SITE is not set — export the path to the server block changed at cut-over"
  finish; exit 1
fi
[ -f "$BACKUP" ] || { bad "no backup at $BACKUP — cannot restore automatically"; finish; exit 1; }
kv "site file" "$NGINX_SITE"
kv "backup"    "$BACKUP  ($(stat -c '%y' "$BACKUP" 2>/dev/null))"

say "RESTORE"
sudo cp "$NGINX_SITE" "$STATE/nginx-site.rolledback-$(date +%s)" 2>/dev/null
sudo cp "$BACKUP" "$NGINX_SITE" && ok "restored the previous nginx configuration" \
  || { bad "restore failed"; finish; exit 1; }

if sudo nginx -t 2>&1 | grep -q "successful"; then
  ok "nginx -t passes"
else
  bad "nginx -t FAILED after restore — do not reload; inspect $NGINX_SITE"
  sudo nginx -t 2>&1 | sed 's/^/    /'
  finish; exit 1
fi

sudo systemctl reload nginx && ok "nginx reloaded" || bad "nginx reload failed"
sleep 3

say "VERIFY THE PREVIOUS APPLICATION IS SERVING AGAIN"
CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "https://$SITE/api/health")"
check "https://$SITE/api/health responds" "200" "$CODE"
kv "health body" "$(curl -s --max-time 20 "https://$SITE/api/health" | head -c 200)"
info "the previous application returns no 'commit' field — that is how you know it is back"

say "PROCESS STATE"
pm2 list 2>/dev/null | sed 's/^/    /' | head -12

say "WHAT WAS DELIBERATELY NOT DONE"
info "The Version 1.0 installation at $V1 is still present and running on port $V1_PORT."
info "Its database ($V1_DB) is untouched. Both are kept for diagnosis."
info "Only remove them once the cause of the rollback is understood."

finish
