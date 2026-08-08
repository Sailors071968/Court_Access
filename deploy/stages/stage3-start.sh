#!/usr/bin/env bash
# ============================================================================
# Stage 3 — Start Version 1.0 on the isolated port and verify it completely.
#
# The existing application keeps serving the live site throughout. Nothing
# user-facing changes in this stage: the new process listens on $V1_PORT and
# nginx is untouched.
#
# The interpreter is pinned explicitly with --interpreter, because PM2
# otherwise records the bare string "node" and resolves it from PATH at spawn.
#
#   export NODE22=...
#   bash deploy/stages/stage3-start.sh
#
# Rollback: pm2 delete courtaccess-v1
# ============================================================================

STAGE_NAME="Stage 3 — start and verify on the isolated port"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_common.sh
. "$DIR/_common.sh"

deploy_env || { finish; exit 1; }
verify_interpreter
baseline_existing

BASE="http://127.0.0.1:$V1_PORT"

say "PRE-FLIGHT"
[ -f "$V1/dist/index.js" ] || { bad "$V1/dist/index.js missing — run stage 1"; finish; exit 1; }
[ -f "$V1/.env" ]          || { bad "$V1/.env missing"; finish; exit 1; }

if sudo ss -lntp 2>/dev/null | grep -q ":$V1_PORT\b"; then
  bad "port $V1_PORT is already in use — choose another or stop what is on it"
  finish; exit 1
else ok "port $V1_PORT is free"; fi

# Rollback is `pm2 delete`, which needs a responsive daemon and needs the name
# to belong to this deployment. A process already carrying that name but
# running something outside $V1 would be destroyed by both the start below and
# the rollback, so it stops the stage instead.
ROLLBACK_READY=no
if ! pm2 ping >/dev/null 2>&1; then
  info "pm2 daemon is not responding — 'pm2 delete' would not work"
else
  FOREIGN="$(pm2 jlist 2>/dev/null | "$NODE22" -e '
    let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{
      let ps=[];try{ps=JSON.parse(d)}catch(e){}
      const p=ps.find(x=>x.name===process.env.V1_PM2_NAME);
      const path=p&&p.pm2_env?String(p.pm2_env.pm_exec_path||""):"";
      console.log(path && !path.startsWith(process.env.V1) ? path : "");});' 2>/dev/null)"
  if [ -n "$FOREIGN" ]; then
    info "a PM2 process named $V1_PM2_NAME already runs $FOREIGN — that is not this deployment"
  else
    ROLLBACK_READY=yes
  fi
fi
go_no_go "1 to 2 minutes" "Low — new process on port $V1_PORT; nginx still routes to the existing application" \
         "$ROLLBACK_READY" "pm2 delete $V1_PM2_NAME" \
  || { finish; exit 1; }

say "START  (pinned interpreter, environment loaded by Node itself)"
# Node reads .env at every spawn via --env-file, and PM2 persists node_args in
# both its live definition and dump.pm2. That makes the environment a function
# of the file rather than state held in the PM2 daemon's memory.
#
# The previous form exported .env into this shell and let PM2 snapshot it. The
# snapshot lived only in the daemon: a daemon restart, a resurrect, a reboot, or
# a `pm2 restart --update-env` from a shell without those exports replaced it
# with an empty environment. The process then reached enforceSchemaOnBoot with
# no DATABASE_URL and exited 1 on every respawn — observed as a 578-restart
# crash loop after the daemon reloaded its saved definition.
#
# .env is still sourced here because later checks in this stage read PORT.
set -a; . "$V1/.env"; set +a
pm2 delete "$V1_PM2_NAME" >/dev/null 2>&1 || true
pm2 start "$V1/dist/index.js" \
  --name "$V1_PM2_NAME" \
  --cwd "$V1" \
  --interpreter "$NODE22" \
  --node-args="--env-file=$V1/.env" 2>&1 | tail -4

info "waiting for startup..."
for _ in $(seq 1 40); do
  curl -sf --max-time 2 "$BASE/api/health" >/dev/null 2>&1 && break
  sleep 1
done

say "PROCESS VERIFICATION"
V1PID="$(pm2 jlist 2>/dev/null | "$NODE22" -e '
  let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{
    let ps=[];try{ps=JSON.parse(d)}catch(e){}
    const p=ps.find(x=>x.name===process.env.V1_PM2_NAME);
    console.log(p&&p.pid?p.pid:"");});' 2>/dev/null)"
check_nonempty "new process pid" "$V1PID"

if [ -n "$V1PID" ]; then
  ACTUAL_EXE="$(sudo readlink -f /proc/"$V1PID"/exe 2>/dev/null)"
  check "process runs the pinned interpreter" "$(readlink -f "$NODE22")" "$ACTUAL_EXE"
  kv "process cwd" "$(sudo readlink /proc/"$V1PID"/cwd 2>/dev/null)"
fi

RESTARTS="$(pm2 jlist 2>/dev/null | "$NODE22" -e '
  let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{
    let ps=[];try{ps=JSON.parse(d)}catch(e){}
    const p=ps.find(x=>x.name===process.env.V1_PM2_NAME);
    console.log(p?p.pm2_env.restart_time:"");});' 2>/dev/null)"
check "restart count" "0" "$RESTARTS"

say "STARTUP LOG"
pm2 logs "$V1_PM2_NAME" --lines 200 --nostream 2>/dev/null \
  | grep -E "^\[Server\] CourtAccess|^\[Startup\]|Schema Assert|PipelineWorkers|Security hardening" \
  | sed 's/^/    /' | head -14

LOGS="$(pm2 logs "$V1_PM2_NAME" --lines 200 --nostream 2>/dev/null)"
printf '%s' "$LOGS" | grep -q "Configuration OK"            && ok "startup validator passed"        || bad "startup validator did not report Configuration OK"

# The schema guard must report the artifact's own migration count applied.
# 'no-migrations' or '0/0' means the guard could not find prisma/ and is inert.
MIG_EXPECT="$(artifact_migration_count)"
if printf '%s' "$LOGS" | grep -q "Migrations: $MIG_EXPECT/$MIG_EXPECT applied"; then
  ok "schema guard reports $MIG_EXPECT/$MIG_EXPECT applied"
else
  bad "schema guard did not report $MIG_EXPECT/$MIG_EXPECT applied"
  printf '%s' "$LOGS" | grep -o "Migrations:[^,)]*" | head -3 | sed 's/^/      observed: /'
fi
printf '%s' "$LOGS" | grep -q "Security hardening active"    && ok "security hardening active"       || bad "security hardening line absent"

say "HEALTH ENDPOINTS"
HEALTH="$(curl -s --max-time 10 "$BASE/api/health" 2>/dev/null)"
kv "/api/health" "$(printf '%s' "$HEALTH" | head -c 180)"

LIVE_COMMIT="$(printf '%s' "$HEALTH" | "$NODE22" -pe 'let s="";try{s=JSON.parse(require("fs").readFileSync(0,"utf8")).commit||""}catch(e){};s' 2>/dev/null)"
STAMP_COMMIT="$("$NODE22" -pe "JSON.parse(require('fs').readFileSync('$V1/dist/build-info.json','utf8')).commit" 2>/dev/null)"
check "health commit matches the build stamp" "$STAMP_COMMIT" "$LIVE_COMMIT"

READY_CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$BASE/api/health/ready")"
DEEP_CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$BASE/api/health/deep")"
LOGIN_CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 -X POST \
  -H 'Content-Type: application/json' -d '{"email":"nobody@example.com","password":"wrong"}' \
  "$BASE/api/auth/login")"
check "/api/health/ready"  "200" "$READY_CODE"
check "/api/health/deep"   "200" "$DEEP_CODE"
check "login with bad credentials returns 401" "401" "$LOGIN_CODE"
kv "readiness body" "$(curl -s --max-time 15 "$BASE/api/health/ready" | head -c 220)"

say "OUTBOUND DEPENDENCIES  (needed before any upload)"
JSD="$(curl -s -o /dev/null -w '%{http_code}' --max-time 25 \
  https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0/eng.traineddata.gz)"
LEG="$(curl -s -o /dev/null -w '%{http_code}' --max-time 25 \
  'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=PEN&sectionNum=459.')"
check "jsDelivr (OCR language model)" "200" "$JSD"
check "leginfo (statute retrieval)"   "200" "$LEG"
[ "$JSD" != "200" ] && info "OCR will report every scanned page as blank — indistinguishable from a genuinely blank page."

say "FUNCTIONAL SMOKE TEST — exercises the running application"
if "$NODE22" "$DIR/smoke-test.mjs" "$BASE"; then
  ok "functional smoke test passed"
else
  bad "functional smoke test FAILED — cut-over must not begin"
fi

manifest_record "v1Pid"          "$V1PID"
manifest_record "v1Interpreter"  "$ACTUAL_EXE"
manifest_record "v1Port"         "$V1_PORT"
manifest_record "liveCommit"     "$LIVE_COMMIT"
manifest_record "jsDelivrReachable" "$JSD"
manifest_record "leginfoReachable"  "$LEG"

# Standards 4 and 5: the artifact verified here is the artifact that deploys.
[ "$FAILURES" -eq 0 ] && freeze_artifact

assert_existing_unchanged
finish
