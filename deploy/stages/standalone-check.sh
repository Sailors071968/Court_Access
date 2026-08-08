#!/usr/bin/env bash
# ============================================================================
# Standalone startup check — does the artifact start on `node --env-file` alone?
#
# This is the gate that has to pass before the PM2 definition is changed. It
# separates two failures that look identical in a PM2 log: an application that
# cannot start, and an application that starts fine but is being launched
# without an environment. PM2 is not involved here at all, so whatever this
# reports is a property of the artifact and the file.
#
# The probe runs with a deliberately emptied environment, so `.env` is the only
# place its configuration can come from. That reproduces the condition after a
# reboot or a daemon reload — the case where the old shell-export approach left
# the process with nothing — and it means a PASS is evidence about the file
# rather than about the shell that happened to run this script.
#
#   export NODE22=...
#   bash deploy/stages/standalone-check.sh
#   PROBE_PORT=3198 bash deploy/stages/standalone-check.sh
#
# Touches nothing that serves traffic: no PM2 command, no nginx change, no edit
# to .env, and a scratch port that is checked to be free first. It does connect
# to the database named in .env and, like any boot of this artifact, records a
# row in schema_versions and seeds the default discount codes there. Point it at
# the V1 database, never at the legacy one.
#
# Rollback: none needed — the probe is killed when the script exits.
# ============================================================================

STAGE_NAME="Standalone startup check — node --env-file, without PM2"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_common.sh
. "$DIR/_common.sh"

# A port of its own. V1_PORT belongs to the PM2 process this check exists to
# reason about, and binding it would either collide or, worse, appear to succeed
# while answers came from the other process.
PROBE_PORT="${PROBE_PORT:-3198}"
BASE="http://127.0.0.1:$PROBE_PORT"
LOG="$STATE/standalone-check-$(date +%Y%m%d-%H%M%S).log"

deploy_env || { finish; exit 1; }
verify_interpreter
baseline_existing

PROBE_PID=""
cleanup() {
  if [ -n "$PROBE_PID" ] && kill -0 "$PROBE_PID" 2>/dev/null; then
    kill "$PROBE_PID" 2>/dev/null
    for _ in 1 2 3 4 5; do kill -0 "$PROBE_PID" 2>/dev/null || break; sleep 1; done
    kill -9 "$PROBE_PID" 2>/dev/null
    info "probe process $PROBE_PID stopped"
  fi
}
trap cleanup EXIT INT TERM

# Launches its argument in the background as the backgrounded process itself,
# so $! is the interpreter and not a shell wrapping it. Backgrounding a function
# or a pipeline gives back the subshell's pid instead; killing that leaves the
# real process orphaned, holding the port and a database connection. Observed
# while writing this check.
spawn_probe() {
  ( exec env -i \
      PATH="$PATH" \
      HOME="$HOME" \
      PORT="$PROBE_PORT" \
      HOST=127.0.0.1 \
      "$@" ) &
}

say "PRE-FLIGHT"
[ -f "$V1/dist/index.js" ] || { bad "$V1/dist/index.js missing — run stage 1"; finish; exit 1; }
[ -f "$V1/.env" ]          || { bad "$V1/.env missing"; finish; exit 1; }
ok "artifact and .env are present"

if sudo ss -lntp 2>/dev/null | grep -q ":$PROBE_PORT\b"; then
  bad "probe port $PROBE_PORT is in use — set PROBE_PORT to a free port"
  finish; exit 1
else ok "probe port $PROBE_PORT is free"; fi

# Which database this will write to, named so the operator can see it is the V1
# one before anything connects. Credentials are never printed.
kv "database in .env" "$(
  "$NODE22" -e '
    const fs=require("fs");
    const m=/^\s*DATABASE_URL\s*=\s*(.*)$/m.exec(fs.readFileSync(process.argv[1],"utf8"));
    if(!m){console.log("<DATABASE_URL not present>");process.exit(0)}
    let v=m[1].trim().replace(/^["\x27]|["\x27]$/g,"");
    try{const u=new URL(v);console.log(`${u.pathname.replace(/^\//,"")} on ${u.hostname}:${u.port||5432}`)}
    catch{console.log("<unparseable>")}
  ' "$V1/.env" 2>/dev/null)"

# The probe environment is built inside spawn_probe above: everything stripped
# except what a process genuinely cannot run without, plus two deliberate
# overrides. Node's --env-file does not replace a variable that is already set —
# the existing value wins — so PORT and HOST take precedence over the file on
# purpose: the probe must not try to bind the live port, and must not listen on a
# public interface. Every other variable, including DATABASE_URL and every
# secret, can only come from --env-file.

say "START  (no PM2; environment comes only from $V1/.env)"
kv "command" "node --env-file=$V1/.env dist/index.js"
kv "inherited environment" "emptied except PATH, HOME, and the PORT/HOST overrides"
kv "log" "$LOG"

cd "$V1" || { bad "cannot enter $V1"; finish; exit 1; }
spawn_probe "$NODE22" --env-file="$V1/.env" "$V1/dist/index.js" > "$LOG" 2>&1
PROBE_PID=$!
kv "probe pid" "$PROBE_PID"

info "waiting for the port to answer (up to 60s)..."
STARTED=no
for _ in $(seq 1 60); do
  if ! kill -0 "$PROBE_PID" 2>/dev/null; then break; fi
  if curl -sf --max-time 2 "$BASE/api/health" >/dev/null 2>&1; then STARTED=yes; break; fi
  sleep 1
done

# --- Question 1: does the application start? -------------------------------
say "QUESTION 1 — DOES IT START?"
if kill -0 "$PROBE_PID" 2>/dev/null; then
  ok "process is still alive after startup"
else
  wait "$PROBE_PID" 2>/dev/null; EXIT_CODE=$?
  bad "process exited during startup with code $EXIT_CODE"
  info "first fatal error from the log:"
  grep -m1 -E "\[Startup\] FAILED|\[Schema Assert\] +ERROR|Error:|error:|FATAL" "$LOG" \
    | sed 's/^/      /' || info "      (no recognisable error line — see $LOG)"
  info "last 25 log lines:"; tail -25 "$LOG" | sed 's/^/      /'
  say "VERDICT"
  info "The application does NOT start on --env-file alone."
  info "This is a startup fault, not a PM2 fault. Fix the error above before"
  info "changing the PM2 definition."
  manifest_record "standaloneStarts" "no"
  manifest_record "standaloneExitCode" "$EXIT_CODE"
  assert_existing_unchanged
  finish; exit 1
fi

# The validator and the schema guard both run before the port binds, so their
# lines prove the file supplied a usable configuration, not merely a parseable one.
grep -q "Configuration OK" "$LOG" \
  && ok "startup validator passed on the file alone" \
  || bad "startup validator did not report Configuration OK"

if grep -q "\[Startup\] FAILED" "$LOG"; then
  bad "the validator reported fatal configuration problems"
  grep -E "^ +(FAIL|WARNING) " "$LOG" | sed 's/^/      /' | head -12
fi

MIG_EXPECT="$(artifact_migration_count)"
if grep -q "Migrations: $MIG_EXPECT/$MIG_EXPECT applied" "$LOG"; then
  ok "schema guard reports $MIG_EXPECT/$MIG_EXPECT applied"
else
  bad "schema guard did not report $MIG_EXPECT/$MIG_EXPECT applied"
  grep -o "Migrations:[^,)]*" "$LOG" | head -3 | sed 's/^/      observed: /'
fi

grep -q "CourtAccess API running" "$LOG" \
  && ok "reached app.listen()" \
  || bad "never logged 'CourtAccess API running'"

# --- Question 2: does it bind the port? ------------------------------------
say "QUESTION 2 — DOES IT BIND THE PORT?"
check "port answered within the timeout" "yes" "$STARTED"
if sudo ss -lntp 2>/dev/null | grep ":$PROBE_PORT\b" | grep -q "pid=$PROBE_PID"; then
  ok "port $PROBE_PORT is held by the probe process itself (pid $PROBE_PID)"
else
  # Worth distinguishing: something answering on this port that is not the probe
  # would make every check below meaningless.
  LISTENER="$(sudo ss -lntp 2>/dev/null | grep ":$PROBE_PORT\b" | head -1)"
  if [ -n "$LISTENER" ]; then
    bad "port $PROBE_PORT is held by another process — results would not be about the probe"
    info "      $LISTENER"
  else
    bad "nothing is listening on $PROBE_PORT"
  fi
fi

# --- Question 3: do the health endpoints answer? ---------------------------
say "QUESTION 3 — DO THE HEALTH ENDPOINTS RETURN 200?"
HEALTH_CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$BASE/api/health")"
READY_CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$BASE/api/health/ready")"
DEEP_CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$BASE/api/health/deep")"
check "/api/health"       "200" "$HEALTH_CODE"
check "/api/health/ready" "200" "$READY_CODE"
check "/api/health/deep"  "200" "$DEEP_CODE"
kv "readiness body" "$(curl -s --max-time 15 "$BASE/api/health/ready" | head -c 220)"

# A stub returning ok has passed a health check here before while the platform
# was not functional, so the gate includes something only a real build answers.
LOGIN_CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 -X POST \
  -H 'Content-Type: application/json' -d '{"email":"nobody@example.com","password":"wrong"}' \
  "$BASE/api/auth/login")"
check "login with bad credentials returns 401" "401" "$LOGIN_CODE"

# --- Negative control ------------------------------------------------------
# Everything above is consistent with the probe having found its configuration
# somewhere other than --env-file. Removing only that flag settles it: the same
# artifact, the same emptied environment, no file. It must fail.
say "NEGATIVE CONTROL — the same probe without --env-file"
NEG_LOG="$LOG.no-env-file"
spawn_probe "$NODE22" "$V1/dist/index.js" > "$NEG_LOG" 2>&1
NEG_PID=$!
for _ in $(seq 1 25); do kill -0 "$NEG_PID" 2>/dev/null || break; sleep 1; done

if kill -0 "$NEG_PID" 2>/dev/null; then
  kill -9 "$NEG_PID" 2>/dev/null
  bad "it also started WITHOUT --env-file — the environment is coming from somewhere else"
  info "Find that source before trusting --env-file; the file is not what is"
  info "configuring this process."
else
  wait "$NEG_PID" 2>/dev/null; NEG_CODE=$?
  ok "refused to start without --env-file (exit $NEG_CODE) — the file is the source"
  grep -m1 -E "\[Startup\] FAILED" "$NEG_LOG" | sed 's/^/      /'
  grep -E "^ +FAIL " "$NEG_LOG" | sed 's/^/      /' | head -6
fi

say "STARTUP LOG"
grep -E "^\[Server\] CourtAccess|^\[Startup\]|Schema Assert|PipelineWorkers|Redis|Security hardening" "$LOG" \
  | sed 's/^/    /' | head -16

manifest_record "standaloneStarts"    "yes"
manifest_record "standalonePort"      "$PROBE_PORT"
manifest_record "standaloneHealth"    "$HEALTH_CODE"
manifest_record "standaloneReady"     "$READY_CODE"
manifest_record "standaloneDeep"      "$DEEP_CODE"
manifest_record "standaloneLog"       "$LOG"

cleanup
PROBE_PID=""

# A probe that survives the script would hold the port and a database connection
# indefinitely, and the next run would find the port busy and stop. Confirm the
# host is back to how it was found rather than assuming the kill worked.
say "CLEAN-UP"
sleep 1
if sudo ss -lntp 2>/dev/null | grep -q ":$PROBE_PORT\b"; then
  bad "something is still listening on $PROBE_PORT — a probe process leaked"
  sudo ss -lntp 2>/dev/null | grep ":$PROBE_PORT\b" | sed 's/^/      /'
  info "Kill it before re-running: sudo fuser -k $PROBE_PORT/tcp"
else
  ok "probe port $PROBE_PORT released; no process left behind"
fi

say "VERDICT"
if [ "$FAILURES" -eq 0 ]; then
  info "The artifact starts, binds, and serves health on --env-file alone, with"
  info "nothing inherited from the shell. A PM2 crash loop with this artifact is"
  info "therefore a fault in how PM2 launches it, not in the application."
  info "Next: bash deploy/stages/stage3-start.sh"
else
  info "Do not change the PM2 definition yet. Resolve the [FAIL] lines above —"
  info "they are startup faults that PM2 would only reproduce."
fi

assert_existing_unchanged
finish
