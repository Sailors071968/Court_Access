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
# Stage 4 recorded the path it backed up, so a rollback works from any shell.
if [ -z "${NGINX_SITE:-}" ] && [ -s "$STATE/nginx-site.path" ]; then
  NGINX_SITE="$(cat "$STATE/nginx-site.path")"
  info "NGINX_SITE taken from the cut-over record: $NGINX_SITE"
fi
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

# systemctl is how nginx is managed on the production host, but a rollback is
# the last thing that should fail for want of an init system. If systemd is not
# managing it, ask nginx directly rather than stopping here.
if sudo systemctl reload nginx 2>/dev/null; then
  ok "nginx reloaded (systemd)"
elif sudo nginx -s reload 2>/dev/null; then
  ok "nginx reloaded (signalled directly — systemd did not answer)"
else
  bad "nginx reload failed — the restored configuration is on disk but not live"
fi
sleep 3

say "VERIFY THE PREVIOUS APPLICATION IS SERVING AGAIN"
BODY="$(curl -s --max-time 20 "https://$SITE/api/health")"
CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "https://$SITE/api/health")"
check "https://$SITE/api/health responds" "200" "$CODE"
kv "health body" "$(printf '%s' "$BODY" | head -c 200)"

# A 200 alone proves nothing here: the application being rolled back answers
# this URL too, so a reload that silently did not take still returns 200 and the
# rollback would report success while the new release kept serving. Observed
# exactly that during a rehearsal where the reload failed. The releases are
# distinguishable because only the new one stamps its commit into /api/health.
if printf '%s' "$BODY" | grep -q '"commit"'; then
  bad "the NEW release is still serving — this rollback has not taken effect"
  info "  commit still reported: $(printf '%s' "$BODY" | grep -o '"commit":"[^\"]*"' | head -1)"
  info "  The configuration was restored on disk, so the reload is what to check:"
  info "    sudo nginx -t && sudo systemctl reload nginx"
  info "  Until that succeeds, traffic is still going to the release you are rolling back."
elif [ "$CODE" = "200" ]; then
  ok "the previous application is serving again — no commit field in /api/health"
fi

say "PROCESS STATE"
pm2 list 2>/dev/null | sed 's/^/    /' | head -12

say "WHAT WAS DELIBERATELY NOT DONE"
info "The Version 1.0 installation at $V1 is still present and running on port $V1_PORT."
info "Its database ($V1_DB) is untouched. Both are kept for diagnosis."
info "Only remove them once the cause of the rollback is understood."

finish
