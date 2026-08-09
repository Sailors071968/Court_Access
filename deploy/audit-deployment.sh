#!/usr/bin/env bash
# ============================================================================
# One command that answers: is this deployment production ready?
#
# Read-only. It starts nothing, stops nothing, edits nothing, and writes only to
# $STATE. Safe to run against a live production host at any time, including
# during an incident.
#
#   export NODE22=/path/to/node22          # or have nvm installed
#   bash deploy/audit-deployment.sh
#
# Exit status is 0 only when every check passes. Anything else means the
# deployment is not certifiable from evidence, and the [FAIL] lines say why.
#
# Thirteen groups, matching the certification checklist:
#   1 interpreter        8 restart behaviour
#   2 process manager    9 reboot persistence
#   3 nginx             10 rollback readiness
#   4 environment       11 environment provenance
#   5 migrations        12 artifact fingerprints
#   6 ports            13 documentation present
#   7 health endpoints
# ============================================================================

STAGE_NAME="Deployment audit"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=stages/_common.sh
. "$DIR/stages/_common.sh"

SITE="${SITE:-}"                       # optional: also audit through the public name
BASE="http://127.0.0.1:${V1_PORT}"
DUMP="${PM2_HOME:-$HOME/.pm2}/dump.pm2"
NGINX_SITE="${NGINX_SITE:-}"
[ -z "$NGINX_SITE" ] && [ -s "$STATE/nginx-site.path" ] && NGINX_SITE="$(cat "$STATE/nginx-site.path")"

# _common.sh counts failures but not passes. An audit is more useful when it
# says how much was checked, not only what broke.
PASSES=0
ok() { printf '    [ OK ] %s\n' "$*"; PASSES=$((PASSES+1)); }

deploy_env || { finish; exit 1; }

# Reads one key from .env exactly as Node will, without exporting anything.
env_get() { env -i "$NODE22" --env-file="$V1/.env" -p "process.env.$1||''" 2>/dev/null; }

pm2_field() {
  pm2 jlist 2>/dev/null | PM2_EXPR="$1" "$NODE22" -e '
    let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{
      let ps=[];try{ps=JSON.parse(d)}catch(e){}
      const p=ps.find(x=>x.name===process.env.V1_PM2_NAME);
      let o="";try{o=p?eval(process.env.PM2_EXPR):""}catch(e){o=""}
      console.log(o===undefined||o===null?"":o);});' 2>/dev/null
}

code() { curl -s -o /dev/null -w '%{http_code}' --max-time "${2:-15}" "$1" 2>/dev/null; }

# --- 1 · Interpreter --------------------------------------------------------
say "1 · INTERPRETER"
kv "NODE22" "$NODE22"
NODE_MAJOR="$("$NODE22" -pe 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
if [ "${NODE_MAJOR:-0}" -ge 22 ]; then ok "Node major $NODE_MAJOR satisfies the node22 bundle target"
else bad "Node major ${NODE_MAJOR:-unknown}; the bundle is compiled --target=node22"; fi
if [ -x "$NODE22BIN/npm" ]; then ok "npm is in the same installation as node"
else bad "no npm at $NODE22BIN/npm — node and npm are from different installations"; fi

# --- 2 · Process manager ----------------------------------------------------
say "2 · PROCESS MANAGER"
if command -v pm2 >/dev/null 2>&1; then
  kv "pm2 version" "$(pm2 --version 2>&1 | tail -1)"
  if pm2 ping >/dev/null 2>&1; then ok "the pm2 daemon is responding"
  else bad "the pm2 daemon is not responding — pm2 delete and pm2 restart would not work"; fi
else bad "pm2 is not installed"; fi

STATUS="$(pm2_field 'p.pm2_env.status')"
PID="$(pm2_field 'p.pid')"
check "$V1_PM2_NAME status" "online" "${STATUS:-absent}"
check_nonempty "$V1_PM2_NAME pid" "$PID"

# --- 3 · nginx --------------------------------------------------------------
say "3 · NGINX"
if command -v nginx >/dev/null 2>&1; then
  if sudo nginx -t 2>&1 | grep -q "successful"; then ok "nginx -t passes"
  else bad "nginx -t FAILS — a reload would not apply"; sudo nginx -t 2>&1 | sed 's/^/      /' | head -3; fi

  # The upstream nginx proxies to must be the port the application binds, or
  # every request is a 502 while the process looks healthy.
  UPSTREAMS="$(sudo nginx -T 2>/dev/null | grep -oE 'proxy_pass +http://127\.0\.0\.1:[0-9]+' | grep -oE '[0-9]+$' | sort -u)"
  kv "proxy_pass upstream port(s)" "${UPSTREAMS:-none found}"
  if printf '%s\n' "$UPSTREAMS" | grep -qx "$V1_PORT"; then ok "nginx proxies to $V1_PORT"
  else bad "no proxy_pass to 127.0.0.1:$V1_PORT — nginx is not routing to this deployment"; fi

  DOCROOTS="$(sudo nginx -T 2>/dev/null | grep -oE '^\s*root\s+\S+' | awk '{print $2}' | tr -d ';' | sort -u)"
  if printf '%s\n' "$DOCROOTS" | grep -qx "$V1/dist/public"; then ok "a server block serves $V1/dist/public"
  else info "[note] no server block roots at $V1/dist/public — document roots: $(printf '%s ' $DOCROOTS)"; fi
else bad "nginx is not installed"; fi

# --- 4 · Environment --------------------------------------------------------
say "4 · ENVIRONMENT"
if [ ! -f "$V1/.env" ]; then
  bad "$V1/.env does not exist"
else
  ok "$V1/.env exists"
  MISSING=""
  for k in NODE_ENV PORT HOST DATABASE_URL JWT_SECRET JWT_REFRESH_SECRET COOKIE_SECRET EVIDENCE_UPLOAD_DIR; do
    [ -n "$(env_get "$k")" ] || MISSING="$MISSING $k"
  done
  if [ -z "$MISSING" ]; then ok "every required variable is readable by Node from the file alone"
  else bad "Node cannot read:$MISSING"; fi

  # Shell-only syntax makes the two readers of this file disagree: stage 2
  # sources it for Prisma, Node reads it here.
  SHELLISMS="$("$NODE22" -e '
    const fs=require("fs"); const bad=[];
    fs.readFileSync(process.argv[1],"utf8").split("\n").forEach((l,i)=>{
      const t=l.trim(); if(!t||t.startsWith("#"))return;
      if(/^export\s/.test(t)){bad.push("line "+(i+1)+": export prefix");return;}
      const m=/^([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/.exec(t); if(!m)return;
      if(/\$\{|\$\(/.test(m[2])) bad.push("line "+(i+1)+": "+m[1]+" uses shell expansion");
    });
    console.log(bad.join("; "));' "$V1/.env" 2>/dev/null)"
  if [ -z "$SHELLISMS" ]; then ok ".env contains no shell-only syntax"
  else bad ".env contains shell-only syntax: $SHELLISMS"; fi

  check "NODE_ENV in .env" "production" "$(env_get NODE_ENV)"
  check "PORT in .env matches the audited port" "$V1_PORT" "$(env_get PORT)"
  check "HOST in .env" "127.0.0.1" "$(env_get HOST)"

  UPLOADS="$(env_get EVIDENCE_UPLOAD_DIR)"
  case "$UPLOADS" in
    "$V1"/*) bad "EVIDENCE_UPLOAD_DIR ($UPLOADS) is inside the release — a deployment would destroy uploaded evidence" ;;
    "") bad "EVIDENCE_UPLOAD_DIR is not set" ;;
    *) if [ -w "$UPLOADS" ]; then ok "EVIDENCE_UPLOAD_DIR is outside the release and writable"
       else bad "EVIDENCE_UPLOAD_DIR ($UPLOADS) is not writable"; fi ;;
  esac

  # The last digit is "other". Anything non-zero means every account on the host
  # can read every secret in this file.
  PERMS="$(stat -c '%a' "$V1/.env" 2>/dev/null)"
  if [ "${PERMS: -1}" = "0" ]; then
    ok ".env mode $PERMS — not readable by other accounts"
  else
    bad ".env mode $PERMS — world-readable, and it holds every secret. Run: chmod 600 $V1/.env"
  fi
fi

# --- 5 · Migrations ---------------------------------------------------------
say "5 · MIGRATIONS"
PGURL="$(env -i "$NODE22" --env-file="$V1/.env" -p 'String(process.env.DATABASE_URL||"").split("?")[0]' 2>/dev/null)"
IN_ARTIFACT="$(artifact_migration_count)"
kv "migrations in the artifact" "$IN_ARTIFACT"
if [ -z "$PGURL" ]; then
  bad "no DATABASE_URL — cannot audit the database"
elif ! psql "$PGURL" -tAc "select 1" >/dev/null 2>&1; then
  bad "cannot connect to the database named in .env"
else
  ok "database reachable"
  APPLIED="$(psql "$PGURL" -tAc "select count(*) filter (where finished_at is not null) from _prisma_migrations" 2>/dev/null | tr -d ' ')"
  UNFIN="$(psql "$PGURL" -tAc "select count(*) filter (where finished_at is null and rolled_back_at is null) from _prisma_migrations" 2>/dev/null | tr -d ' ')"
  ROLLED="$(psql "$PGURL" -tAc "select count(*) filter (where rolled_back_at is not null) from _prisma_migrations" 2>/dev/null | tr -d ' ')"
  TABLES="$(psql "$PGURL" -tAc "select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE'" 2>/dev/null | tr -d ' ')"
  check "migrations applied matches the artifact" "$IN_ARTIFACT" "${APPLIED:-0}"
  check "migrations unfinished" "0" "${UNFIN:-?}"
  check "migrations rolled back" "0" "${ROLLED:-?}"
  kv "tables" "${TABLES:-?}"
  compare_reference "table count" "$REFERENCE_TABLES" "${TABLES:-0}"
  compare_reference "migration count" "$REFERENCE_MIGRATIONS" "$IN_ARTIFACT"
fi

# --- 6 · Ports --------------------------------------------------------------
say "6 · PORTS"
LISTENER="$(sudo ss -lntp 2>/dev/null | grep ":$V1_PORT\b" | head -1)"
if [ -z "$LISTENER" ]; then
  bad "nothing is listening on $V1_PORT — nginx will return 502 immediately"
elif [ -n "$PID" ] && printf '%s' "$LISTENER" | grep -q "pid=$PID"; then
  ok "$V1_PORT is held by the audited process (pid $PID)"
else
  bad "$V1_PORT is held by a process that is not $V1_PM2_NAME"
  info "      $LISTENER"
fi
# Only the local address, which is field 4. The whole line also contains the peer
# column "0.0.0.0:*", which matches a naive search on any listener at all.
BIND_ADDR="$(printf '%s' "$LISTENER" | awk '{print $4}')"
[ -n "$BIND_ADDR" ] && kv "bound on" "$BIND_ADDR"
case "$BIND_ADDR" in
  127.0.0.1:*|\[::1\]:*) ok "bound to loopback — reachable only through nginx" ;;
  "") : ;;
  *) info "[note] bound on $BIND_ADDR — the API is reachable without going through nginx" ;;
esac

# --- 7 · Health endpoints ---------------------------------------------------
say "7 · HEALTH ENDPOINTS"
for p in /api/health /api/health/ready /api/health/deep; do
  check "local $p" "200" "$(code "$BASE$p" 20)"
done
READY_BODY="$(curl -s --max-time 20 "$BASE/api/health/ready" 2>/dev/null)"
UNHEALTHY="$(printf '%s' "$READY_BODY" | "$NODE22" -e '
  let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{
    try{const j=JSON.parse(d);
      console.log(Object.entries(j.components||{}).filter(([,v])=>v.status!=="healthy").map(([k,v])=>k+"="+v.status).join(" "));
    }catch(e){console.log("unparseable")}});' 2>/dev/null)"
if [ -z "$UNHEALTHY" ]; then ok "every readiness component reports healthy"
else bad "readiness components not healthy: $UNHEALTHY"; fi

# A stub returning ok has passed a health check here before while the platform
# was non-functional. 401 is answered only by a build with real auth.
check "login with bad credentials returns 401" "401" \
  "$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 -X POST \
     -H 'Content-Type: application/json' -d '{"email":"nobody@example.com","password":"wrong"}' \
     "$BASE/api/auth/login" 2>/dev/null)"

if [ -n "$SITE" ]; then
  for p in /api/health /api/health/ready /api/health/deep; do
    check "public https://$SITE$p" "200" "$(code "https://$SITE$p" 25)"
  done
fi

# --- 8 · Restart behaviour --------------------------------------------------
say "8 · RESTART BEHAVIOUR"
RESTARTS="$(pm2_field 'p.pm2_env.restart_time')"
UNSTABLE="$(pm2_field 'p.pm2_env.unstable_restarts')"
UPTIME_S=$(( ( $(date +%s%3N) - $(pm2_field 'p.pm2_env.pm_uptime' || echo 0) ) / 1000 ))
kv "restart counter" "${RESTARTS:-?}"
kv "unstable restarts" "${UNSTABLE:-?}"
kv "current uptime" "${UPTIME_S}s"
if [ "${RESTARTS:-0}" -le 3 ]; then ok "restart counter is low — no crash loop"
else bad "restart counter is ${RESTARTS} — check pm2 logs $V1_PM2_NAME for a crash loop"; fi
if [ "${UPTIME_S:-0}" -lt 30 ] && [ "${RESTARTS:-0}" -gt 3 ]; then
  bad "the process restarted within the last 30s with a high counter — likely looping right now"
fi

NODE_ARGS="$(pm2_field 'p.pm2_env.node_args ? [].concat(p.pm2_env.node_args).join(" ") : ""')"
kv "node_args" "${NODE_ARGS:-<none>}"
case "$NODE_ARGS" in
  *"--env-file=$V1/.env"*) ok "the live definition carries --env-file" ;;
  *) bad "the live definition has no --env-file=$V1/.env — a respawn would start with no environment" ;;
esac
EXEC_INT="$(pm2_field 'p.pm2_env.exec_interpreter')"
if [ "$EXEC_INT" = "$NODE22" ]; then ok "interpreter is pinned to $NODE22"
else bad "interpreter is '$EXEC_INT', not the pinned $NODE22"; fi

# --- 9 · Reboot persistence -------------------------------------------------
say "9 · REBOOT PERSISTENCE"
if [ ! -f "$DUMP" ]; then
  bad "no $DUMP — a reboot would start nothing. Run: pm2 save"
else
  kv "dump.pm2" "$DUMP ($(stat -c '%y' "$DUMP" 2>/dev/null | cut -d. -f1))"
  DUMP_REPORT="$(DUMP_PATH="$DUMP" "$NODE22" -e '
    const fs=require("fs");
    let apps=[];try{apps=JSON.parse(fs.readFileSync(process.env.DUMP_PATH,"utf8"))}catch(e){}
    const a=apps.find(x=>x.name===process.env.V1_PM2_NAME);
    if(!a){console.log("ABSENT");process.exit(0)}
    const args=[].concat(a.node_args||[]).join(" ");
    const held=["DATABASE_URL","JWT_SECRET","JWT_REFRESH_SECRET","COOKIE_SECRET"].filter(k=>a.env&&a.env[k]);
    console.log(args+"|"+held.join(","));' 2>/dev/null)"
  if [ "$DUMP_REPORT" = "ABSENT" ]; then
    bad "$V1_PM2_NAME is not in the saved list — a reboot would not start it. Run: pm2 save"
  else
    SAVED_ARGS="${DUMP_REPORT%%|*}"; SAVED_HELD="${DUMP_REPORT##*|}"
    case "$SAVED_ARGS" in
      *"--env-file=$V1/.env"*) ok "the saved definition carries --env-file" ;;
      *) bad "the saved definition has no --env-file — a resurrect would start with no environment" ;;
    esac
    if [ -z "$SAVED_HELD" ]; then ok "the saved definition holds no application secrets — nothing to go stale"
    else bad "the saved definition holds a stale copy of: $SAVED_HELD (it outranks .env)"; fi
    # A dump older than the live definition means pm2 save has not been re-run.
    if [ -n "$NODE_ARGS" ] && [ "$SAVED_ARGS" != "$NODE_ARGS" ]; then
      bad "the saved definition differs from the live one — run pm2 save"
      info "      live:  $NODE_ARGS"
      info "      saved: $SAVED_ARGS"
    fi
  fi
fi

if systemctl list-unit-files 2>/dev/null | grep -q '^pm2-'; then
  UNIT="$(systemctl list-unit-files 2>/dev/null | grep '^pm2-' | awk '{print $1}' | head -1)"
  kv "systemd unit" "$UNIT"
  if systemctl is-enabled "$UNIT" >/dev/null 2>&1; then ok "$UNIT is enabled — the saved list is resurrected at boot"
  else bad "$UNIT exists but is not enabled — nothing starts after a reboot"; fi
  # The unit resurrects whichever PM2_HOME it runs as. A mismatch reads a
  # different dump.pm2 than the one pm2 save wrote.
  UNIT_USER="$(systemctl cat "$UNIT" 2>/dev/null | grep -oE '^User=.*' | cut -d= -f2 | head -1)"
  kv "unit runs as" "${UNIT_USER:-<unset, defaults to root>}"
  if [ -n "$UNIT_USER" ] && [ "$UNIT_USER" != "$(whoami)" ]; then
    bad "the unit runs as '$UNIT_USER' but this audit (and pm2 save) ran as '$(whoami)' — different dump.pm2"
  fi
else
  bad "no pm2 systemd unit — nothing resurrects the saved list after a reboot. Run: pm2 startup"
fi

# --- 10 · Rollback readiness ------------------------------------------------
say "10 · ROLLBACK READINESS"
[ -f "$DIR/stages/rollback.sh" ] && ok "rollback.sh is present" || bad "rollback.sh is missing"
if [ -z "$NGINX_SITE" ]; then
  bad "no nginx site path recorded — rollback.sh would not know what to restore. Run stage 4 precheck"
else
  kv "nginx site" "$NGINX_SITE"
  if [ -f "$STATE/nginx-site.backup" ]; then
    ok "a pre-cut-over nginx backup exists ($(stat -c '%y' "$STATE/nginx-site.backup" 2>/dev/null | cut -d. -f1))"
    # Whether a rollback would actually change what is serving. This is not a
    # defect on its own: on a first deployment the recorded configuration *is*
    # the live one, because there is no previous application to return to. After
    # a cut-over it means the recorded restore point is the post-cut-over file
    # and rollback would keep serving this release. The behavioural gate is in
    # rollback.sh, which asserts the previous application is answering.
    if sudo cmp -s "$STATE/nginx-site.backup" "$NGINX_SITE" 2>/dev/null; then
      info "[note] the backup is identical to the live configuration, so a rollback"
      info "       would not change what is serving. Expected on a first deployment;"
      info "       after a cut-over it means the restore point was taken too late."
    else
      ok "the backup differs from the live configuration — a rollback would change something"
    fi
  else
    bad "no $STATE/nginx-site.backup — rollback.sh cannot restore automatically"
  fi
fi

# --- 11 · Environment provenance --------------------------------------------
say "11 · ENVIRONMENT PROVENANCE"
# --env-file values are applied inside the process and never appear in
# /proc/<pid>/environ. Their absence, with the application healthy, is the
# evidence that PM2 is not holding a copy that would outrank the file.
if [ -n "$PID" ]; then
  PROC_ENV="$(sudo tr '\0' '\n' < /proc/"$PID"/environ 2>/dev/null)"
  if [ -z "$PROC_ENV" ]; then
    info "[note] could not read /proc/$PID/environ — provenance not established"
  else
    LEAKED="$(printf '%s\n' "$PROC_ENV" | grep -cE '^(DATABASE_URL|JWT_SECRET|JWT_REFRESH_SECRET|COOKIE_SECRET)=')"
    if [ "$LEAKED" -eq 0 ]; then ok "PM2 injected none of the application secrets — .env is the only source"
    else bad "PM2 injected $LEAKED secret(s) at exec — those outrank .env and will go stale"; fi
  fi
fi
LIVE_SECRETS="$(pm2_field '["DATABASE_URL","JWT_SECRET","JWT_REFRESH_SECRET","COOKIE_SECRET"].filter(k=>p.pm2_env[k]).length')"
check "secrets held in the live PM2 definition" "0" "${LIVE_SECRETS:-?}"

# --- 12 · Artifact fingerprints ---------------------------------------------
say "12 · ARTIFACT FINGERPRINTS"
if [ -f "$V1/dist/index.js" ]; then
  BUNDLE_SHA="$(sha256sum "$V1/dist/index.js" | cut -d' ' -f1)"
  kv "dist/index.js sha256" "$BUNDLE_SHA"
  compare_reference "bundle sha256" "$REFERENCE_BUNDLE_SHA" "$BUNDLE_SHA"
else bad "$V1/dist/index.js is missing"; fi

STAMP_COMMIT="$("$NODE22" -pe "JSON.parse(require('fs').readFileSync('$V1/dist/build-info.json','utf8')).commit" 2>/dev/null)"
LIVE_COMMIT="$(curl -s --max-time 15 "$BASE/api/health" 2>/dev/null | "$NODE22" -pe 'try{JSON.parse(require("fs").readFileSync(0,"utf8")).commit||""}catch(e){""}' 2>/dev/null)"
check "the running build is the artifact on disk" "$STAMP_COMMIT" "$LIVE_COMMIT"
TS_COUNT="$(find "$V1" -name '*.ts' -not -path '*/node_modules/*' 2>/dev/null | wc -l | tr -d ' ')"
check "TypeScript source files in the release" "0" "$TS_COUNT"

if [ -f "$FREEZE" ]; then
  if [ "$(_artifact_fingerprint)" = "$(cat "$FREEZE")" ]; then ok "the artifact is unchanged since it was verified"
  else bad "the artifact CHANGED since verification — it was rebuilt, reinstalled or .env was edited"; fi
else
  info "[note] no freeze record — stage 3 has not verified this artifact on this host"
fi

# --- 13 · Documentation -----------------------------------------------------
say "13 · DOCUMENTATION"
for d in DEPLOY_FROM_SCRATCH.md DEPLOYMENT_ARCHITECTURE.md DEPLOYMENT_FAILURE_MODES.md \
         OPERATIONS_PLAYBOOK.md DEPLOYMENT_CERTIFICATION.md env.release.example; do
  [ -f "$DIR/$d" ] && ok "$d present" || bad "$d missing"
done

# --- Verdict ----------------------------------------------------------------
say "AUDIT RESULT"
manifest_record "auditFailures" "$FAILURES"
manifest_record "auditBundleSha" "${BUNDLE_SHA:-}"
manifest_record "auditRestarts"  "${RESTARTS:-}"

if [ "$FAILURES" -eq 0 ]; then
  printf '    PRODUCTION READY — %s check(s) passed, 0 failed\n' "$PASSES"
else
  printf '    NOT PRODUCTION READY — %s check(s) failed\n' "$FAILURES"
  printf '    Every [FAIL] above is a reason. None of them are advisory.\n'
fi
finish
