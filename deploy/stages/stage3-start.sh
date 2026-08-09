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

say "ENVIRONMENT FILE — CAN NODE READ IT?"
# Node's --env-file parser is not the shell. It does not honour an `export`
# prefix, does not expand ${VAR}, and does not run $(command) — so a file that
# `set -a; . .env` reads correctly can still leave Node with nothing. This is
# checked before PM2 is touched, with an emptied environment so a value present
# in this shell cannot stand in for one missing from the file.
ENV_READBACK="$(env -i "$NODE22" --env-file="$V1/.env" -p '
  JSON.stringify(["NODE_ENV","PORT","DATABASE_URL","JWT_SECRET","JWT_REFRESH_SECRET","COOKIE_SECRET"]
    .reduce((a,k)=>(a[k]=process.env[k]?"set":"MISSING",a),{}))' 2>&1)"

if printf '%s' "$ENV_READBACK" | grep -q '^{'; then
  ok "Node parsed $V1/.env"
  # Names only, never values: this output belongs in a deployment record.
  printf '%s' "$ENV_READBACK" | "$NODE22" -e '
    let d="";process.stdin.on("data",c=>c&&(d+=c)).on("end",()=>{
      const o=JSON.parse(d);
      for (const [k,v] of Object.entries(o)) console.log(`    ${k.padEnd(22)} ${v}`);
    });'
  if printf '%s' "$ENV_READBACK" | grep -q 'MISSING'; then
    bad "Node cannot see every required variable in .env"
    info "Rewrite those entries as plain KEY=value — no 'export', no \${VAR}, no \$(command)."
  else
    ok "every required variable is readable by Node from the file alone"
  fi
else
  bad "Node could not parse $V1/.env"
  printf '%s\n' "$ENV_READBACK" | head -4 | sed 's/^/      /'
fi

# Shell-only syntax parses differently in the two readers of this same file:
# stage 2 sources it for Prisma, Node reads it here. A divergence means the
# migrations and the running application disagree about the database.
if grep -qE '^\s*export\s|\$\{|\$\(' "$V1/.env" 2>/dev/null; then
  bad "$V1/.env contains shell-only syntax that Node will read differently"
  grep -nE '^\s*export\s|\$\{|\$\(' "$V1/.env" | cut -d= -f1 | head -6 | sed 's/^/      line /'
else
  ok ".env has no shell-only syntax — both readers see the same values"
fi

# The file's PORT is what the application will bind; $V1_PORT is what every
# check below probes. Sourcing .env used to hide a disagreement between them.
ENV_PORT="$(env -i "$NODE22" --env-file="$V1/.env" -p 'process.env.PORT||""' 2>/dev/null)"
check "PORT in .env matches the port under test" "$V1_PORT" "$ENV_PORT"

say "START  (pinned interpreter, environment loaded by Node itself)"
# Node reads .env at every spawn via --env-file, and PM2 persists node_args in
# both its live definition and dump.pm2 [verified]. That makes the environment a
# function of the file rather than state held in the PM2 daemon's memory.
#
# The previous form exported .env into this shell and let PM2 snapshot it, so
# the environment was daemon state and a definition holding none of it produced
# the 578-restart crash loop: the process reached enforceSchemaOnBoot with no
# DATABASE_URL and exited 1 on every respawn.
#
# It was believed that a daemon restart, a resurrect or a `pm2 restart
# --update-env` from a shell without the exports is what emptied the definition.
# That does not reproduce: on PM2 7.0.3 all of restart, restart --update-env,
# reload --update-env, save/kill/resurrect and `pm2 update` preserve the
# captured environment, including into dump.pm2 [measured]. So a snapshot does
# not decay — it is either never taken, or a boot-time resurrect reads a
# different dump.pm2 than the one pm2 save wrote, which happens when the
# pm2 startup unit runs as another user. See ROOT_CAUSE_CRASH_LOOP.md §6.
#
# Either way the conclusion is the same, and stronger for it: an environment
# that lives in the daemon can be absent at a spawn nobody is watching, and
# nothing about the file would tell you.
#
# Adding --env-file was not enough on its own. Node's --env-file does not
# replace a variable that is already set: the inherited value wins [verified,
# node v22]. While .env was still exported into this shell, PM2 snapshotted
# those values, injected them at every spawn, and --env-file could never
# override them. Measured: editing .env and running `pm2 restart` left the old
# value in the process, and it survived save, daemon kill and resurrect. The
# environment was still daemon state; the file only appeared to be in charge
# because the two agreed.
#
# So the variables .env defines are removed from the environment PM2 snapshots.
# Whatever the operator's shell holds — OPERATIONS.md used to instruct sourcing
# .env before running anything — PM2 gets none of them, leaving --env-file as
# the only source. Verified: after this change the running process tracks edits
# to the file across restart, save, daemon kill and resurrect.
ENV_KEYS="$("$NODE22" -e '
  const fs=require("fs");
  // Variables the PM2 client and the daemon need to function. Unsetting these
  // would break the tooling rather than isolate the application.
  const keep=new Set(["PATH","HOME","PM2_HOME","USER","LOGNAME","SHELL","TERM","LANG","LC_ALL"]);
  const keys=new Set();
  for (const line of fs.readFileSync(process.argv[1],"utf8").split("\n")) {
    const m=/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line);
    if (m && !keep.has(m[1])) keys.add(m[1]);
  }
  console.log([...keys].join(" "));
' "$V1/.env" 2>/dev/null)"

UNSET_ARGS=()
for k in $ENV_KEYS; do UNSET_ARGS+=( -u "$k" ); done
kv "variables withheld from PM2" "$(printf '%s' "$ENV_KEYS" | wc -w) defined in .env"

pm2 delete "$V1_PM2_NAME" >/dev/null 2>&1 || true
env "${UNSET_ARGS[@]}" pm2 start "$V1/dist/index.js" \
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

say "ENVIRONMENT PROVENANCE — WHERE DID THE RUNNING CONFIG COME FROM?"
# The point of --env-file is that the file, not the daemon, decides the
# environment. That is only true if PM2 holds no copy of these variables, so it
# is asserted rather than assumed.
#
# /proc/PID/environ is the environment handed to the process at exec, which is
# exactly what PM2 injected. Variables Node loads from --env-file are added to
# process.env inside the process and never appear there [verified]. So absence
# here, combined with a healthy application below, is the evidence: the process
# has a working DATABASE_URL that PM2 did not give it.
if [ -n "$V1PID" ]; then
  PROC_ENV="$(sudo tr '\0' '\n' < /proc/"$V1PID"/environ 2>/dev/null)"
  if [ -z "$PROC_ENV" ]; then
    info "could not read /proc/$V1PID/environ — provenance not established"
  else
    LEAKED="$(printf '%s\n' "$PROC_ENV" | grep -cE '^(DATABASE_URL|JWT_SECRET|JWT_REFRESH_SECRET|COOKIE_SECRET)=')"
    if [ "$LEAKED" -eq 0 ]; then
      ok "PM2 injected none of the application secrets — the file is the only source"
    else
      bad "PM2 injected $LEAKED application secret(s) into the process"
      printf '%s\n' "$PROC_ENV" | grep -oE '^(DATABASE_URL|JWT_SECRET|JWT_REFRESH_SECRET|COOKIE_SECRET)' \
        | sed 's/^/      snapshotted: /'
      info "A snapshotted value takes precedence over --env-file, so editing .env"
      info "will not change this process. Re-run this stage from a shell that has"
      info "not sourced .env."
    fi
  fi
fi

# node_args is what makes the environment reload on every spawn, including the
# spawns PM2 performs by itself after a crash or a resurrect.
NODE_ARGS="$(pm2 jlist 2>/dev/null | "$NODE22" -e '
  let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{
    let ps=[];try{ps=JSON.parse(d)}catch(e){}
    const p=ps.find(x=>x.name===process.env.V1_PM2_NAME);
    const a=p&&p.pm2_env?(p.pm2_env.node_args||[]):[];
    console.log(Array.isArray(a)?a.join(" "):String(a));});' 2>/dev/null)"
kv "node_args in the live definition" "${NODE_ARGS:-<none>}"
case "$NODE_ARGS" in
  *"--env-file=$V1/.env"*) ok "the definition carries --env-file" ;;
  *) bad "the definition does not carry --env-file=$V1/.env" ;;
esac

info "Reboot survivability is not established by this stage — run"
info "  bash deploy/stages/verify-restart-survival.sh"
info "after pm2 save to confirm the saved definition behaves the same way."

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
