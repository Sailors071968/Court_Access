#!/usr/bin/env bash
# ============================================================================
# Operational verification — is CourtAccess a usable administrative system?
#
# Ten criteria, each answered with a command and its output rather than an
# assertion. Builds a release from the current checkout the documented way,
# starts it with Node's --env-file, creates a permanent administrator, signs in,
# reaches the administrative routes, restarts the service, and checks that the
# session survived.
#
# This verifies THE INSTANCE IT BUILDS. It says nothing about any other host: a
# remote deployment is only verified by running this against that host.
#
# Usage:
#   deploy/verify-operational.sh [evidence-dir]
#
# Requires: node 22+, npm, psql reachable as the configured superuser.
# ============================================================================

set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EVIDENCE="${1:-$REPO/reports/operational-verification}"
RELEASE="${VERIFY_RELEASE_DIR:-/tmp/verify/courtaccess-v1}"
DB_NAME="${VERIFY_DB_NAME:-courtaccess_verify}"
DB_OWNER="${VERIFY_DB_OWNER:-courtaccess}"
DB_PASSWORD="${VERIFY_DB_PASSWORD:-labpassword}"
DB_HOST="${VERIFY_DB_HOST:-127.0.0.1}"
DB_PORT="${VERIFY_DB_PORT:-5432}"
# Deliberately not 3100: a PM2-managed release from earlier deployment testing
# holds that port in this sandbox, and a verification that silently answered on
# another process's health endpoint would be worse than no verification at all.
APP_PORT="${VERIFY_APP_PORT:-3110}"
ADMIN_EMAIL="${VERIFY_ADMIN_EMAIL:-admin@courtaccess.local}"
ADMIN_NAME="${VERIFY_ADMIN_NAME:-CourtAccess Administrator}"

mkdir -p "$EVIDENCE"
PASSES=0
FAILURES=()

say() { printf '%s\n' "$*"; }
hr() { printf '%s\n' "----------------------------------------------------------------------"; }

# Each criterion prints its own evidence; this only records the verdict.
ok()   { PASSES=$((PASSES + 1)); say "  RESULT: PASS — $1"; }
bad()  { FAILURES+=("$1"); say "  RESULT: FAIL — $1"; }

# Runs a command, echoing it first, so the log is a transcript rather than a summary.
run() {
  say "\$ $*"
  "$@" 2>&1 | sed 's/^/  /'
  return "${PIPESTATUS[0]}"
}

NODE_BIN="$(command -v node)"
say "======================================================================"
say "CourtAccess operational verification"
say "started:   $(date -u +%Y-%m-%dT%H:%M:%SZ)"
say "commit:    $(git -C "$REPO" rev-parse --short HEAD) on $(git -C "$REPO" rev-parse --abbrev-ref HEAD)"
say "node:      $("$NODE_BIN" --version) at $NODE_BIN"
say "release:   $RELEASE"
say "database:  $DB_NAME on $DB_HOST:$DB_PORT"
say "evidence:  $EVIDENCE"
say "scope:     the instance built by this script, and nothing else"
say "======================================================================"

# ---------------------------------------------------------------------------
hr; say "CRITERION 4 (first, because everything else needs it): Prisma migrations"
hr

PSQL_ADMIN="postgresql://$DB_OWNER:$DB_PASSWORD@$DB_HOST:$DB_PORT/postgres"
DB_URL="postgresql://$DB_OWNER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME"

say "Recreating the database so migrations run from nothing."
run psql "$PSQL_ADMIN" -c "DROP DATABASE IF EXISTS $DB_NAME"
run psql "$PSQL_ADMIN" -c "CREATE DATABASE $DB_NAME OWNER $DB_OWNER"

cd "$REPO/backend"
say "\$ DATABASE_URL=<$DB_NAME> npx prisma migrate deploy"
DATABASE_URL="$DB_URL?schema=public" npx prisma migrate deploy 2>&1 | tee "$EVIDENCE/migrate-deploy.log" | sed 's/^/  /'
MIGRATE_STATUS="${PIPESTATUS[0]}"

MIGRATION_FILES="$(find "$REPO/backend/prisma/migrations" -maxdepth 1 -mindepth 1 -type d | wc -l | tr -d ' ')"
MIGRATIONS_APPLIED="$(psql "$DB_URL" -tAc "SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL" 2>/dev/null | tr -d ' ')"
MIGRATIONS_FAILED="$(psql "$DB_URL" -tAc "SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL" 2>/dev/null | tr -d ' ')"
TABLES="$(psql "$DB_URL" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'" 2>/dev/null | tr -d ' ')"

say "  migration directories in the repository: $MIGRATION_FILES"
say "  migrations recorded as applied:          $MIGRATIONS_APPLIED"
say "  migrations failed or rolled back:        $MIGRATIONS_FAILED"
say "  tables created:                          $TABLES"

if [ "$MIGRATE_STATUS" -eq 0 ] && [ "$MIGRATIONS_APPLIED" = "$MIGRATION_FILES" ] && [ "$MIGRATIONS_FAILED" = "0" ]; then
  ok "all $MIGRATIONS_APPLIED migrations applied, none failed, $TABLES tables created"
else
  bad "migrations did not complete cleanly (exit $MIGRATE_STATUS, applied $MIGRATIONS_APPLIED of $MIGRATION_FILES, failed $MIGRATIONS_FAILED)"
fi

# Prisma's own view, which reports drift the counts above would miss.
say "\$ npx prisma migrate status"
DATABASE_URL="$DB_URL?schema=public" npx prisma migrate status 2>&1 | tee "$EVIDENCE/migrate-status.log" | sed 's/^/  /'

# ---------------------------------------------------------------------------
hr; say "CRITERION 3: database connects"
hr

say "\$ psql <database> -c 'select version(), current_database(), current_user'"
psql "$DB_URL" -c "SELECT version(), current_database(), current_user" 2>&1 | sed 's/^/  /'
PSQL_OK="${PIPESTATUS[0]}"

# A connection from psql is not the same as one from the application's client:
# different driver, different connection string parsing. Both are checked.
say "\$ node -e '<prisma client connects and counts users>'"
PRISMA_PROBE="$(cd "$REPO/backend" && DATABASE_URL="$DB_URL?schema=public" "$NODE_BIN" --input-type=module -e '
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
try {
  const [{ now }] = await prisma.$queryRawUnsafe("SELECT now() AS now");
  const users = await prisma.user.count();
  console.log(`connected=true server_time=${new Date(now).toISOString()} users=${users}`);
} catch (err) {
  console.log(`connected=false error=${err.message}`);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
' 2>&1)"
say "  $PRISMA_PROBE"

if [ "$PSQL_OK" -eq 0 ] && [[ "$PRISMA_PROBE" == *"connected=true"* ]]; then
  ok "the database accepts connections from psql and from the application's Prisma client"
else
  bad "the database did not accept a connection (psql exit $PSQL_OK; probe: $PRISMA_PROBE)"
fi

# ---------------------------------------------------------------------------
hr; say "Building the release artifact"
hr

rm -rf "$RELEASE"
mkdir -p "$RELEASE"

cd "$REPO/backend"
say "\$ npm run build"
npm run build 2>&1 | tee "$EVIDENCE/build.log" | sed 's/^/  /'
BUILD_STATUS="${PIPESTATUS[0]}"

if [ "$BUILD_STATUS" -ne 0 ] || [ ! -f dist/index.js ]; then
  bad "the release artifact did not build"
  say "Cannot continue without an artifact."
  exit 1
fi

# The generated Prisma client must be the one matching this schema. A release
# carrying an older client fails at the first query against a new table, which
# reads as a database error rather than a stale build.
say "\$ npx prisma generate"
npx prisma generate 2>&1 | tail -2 | sed 's/^/  /'

cp dist/index.js "$RELEASE/index.js"
mkdir -p "$RELEASE/dist"
cp dist/index.js "$RELEASE/dist/index.js"
cp -R prisma "$RELEASE/prisma"
cp -R node_modules "$RELEASE/node_modules"
cp "$REPO/deploy/bootstrap-admin.mjs" "$RELEASE/bootstrap-admin.mjs"

say "  artifact:        $RELEASE/dist/index.js"
say "  artifact bytes:  $(stat -c%s "$RELEASE/dist/index.js")"
say "  artifact sha256: $(sha256sum "$RELEASE/dist/index.js" | cut -d' ' -f1)"

# ---------------------------------------------------------------------------
hr; say "CRITERION 2: environment variables load correctly"
hr

# Written from the documented template's required set. Node reads this file
# itself at every spawn, so it is the single source of configuration — no shell
# sourcing, which is what caused the original restart loop.
EVIDENCE_DIR_APP="${VERIFY_EVIDENCE_UPLOAD_DIR:-/var/tmp/courtaccess-verify/evidence}"
mkdir -p "$EVIDENCE_DIR_APP"

cat > "$RELEASE/.env" <<ENVFILE
NODE_ENV=production
PORT=$APP_PORT
HOST=127.0.0.1
DATABASE_URL=$DB_URL?schema=public
JWT_SECRET=$(openssl rand -base64 48 | tr -d '\n')
JWT_REFRESH_SECRET=$(openssl rand -base64 48 | tr -d '\n')
COOKIE_SECRET=$(openssl rand -base64 32 | tr -d '\n')
EVIDENCE_UPLOAD_DIR=$EVIDENCE_DIR_APP
DISABLE_WORKERS=true
NIIS_UPLOAD_DIR=/var/tmp/courtaccess-verify/niis-uploads
ENVFILE
chmod 600 "$RELEASE/.env"

say "  wrote $RELEASE/.env  (mode $(stat -c%a "$RELEASE/.env"))"
say "  keys present: $(grep -cE '^[A-Za-z_][A-Za-z0-9_]*=' "$RELEASE/.env")"
say "  keys:         $(grep -oE '^[A-Za-z_][A-Za-z0-9_]*' "$RELEASE/.env" | tr '\n' ' ')"

# The keys the file defines, stripped from the environment before the probe runs.
# See the long note above start_app: --env-file loses to an ambient value, so a
# probe that inherits this shell's NODE_ENV reports the shell's configuration and
# calls it the file's.
PROBE_KEYS="$(grep -oE '^[A-Za-z_][A-Za-z0-9_]*' "$RELEASE/.env" | tr '\n' ' ')"
PROBE_UNSET=()
for k in $PROBE_KEYS; do PROBE_UNSET+=( -u "$k" ); done

# Proof that Node itself parses the file, rather than that a shell could.
say "\$ env -u <every .env key> node --env-file=.env -e '<report which required keys are visible>'"
ENV_PROBE="$(cd "$RELEASE" && env "${PROBE_UNSET[@]}" "$NODE_BIN" --env-file=.env -e '
const required = ["NODE_ENV","PORT","HOST","DATABASE_URL","JWT_SECRET","JWT_REFRESH_SECRET","COOKIE_SECRET","EVIDENCE_UPLOAD_DIR","DISABLE_WORKERS"];
const missing = required.filter((k) => !process.env[k]);
const shown = required.map((k) => {
  const v = process.env[k] ?? "";
  const secret = /SECRET|PASSWORD|DATABASE_URL/.test(k);
  return `${k}=${v ? (secret ? `<set, ${v.length} chars>` : v) : "<MISSING>"}`;
});
console.log(shown.join("\n"));
console.log(missing.length === 0 ? "ALL_REQUIRED_PRESENT" : `MISSING: ${missing.join(",")}`);
' 2>&1)"
printf '%s\n' "$ENV_PROBE" | sed 's/^/  /'

# The negative control. If the process has the variables without --env-file,
# they are leaking from the shell and the file is not proven to be the source.
say "\$ node -e '<same probe, WITHOUT --env-file>'   (negative control)"
NEG_PROBE="$(cd "$RELEASE" && env -u NODE_ENV -u PORT -u DATABASE_URL -u JWT_SECRET -u JWT_REFRESH_SECRET -u COOKIE_SECRET "$NODE_BIN" -e '
console.log(process.env.DATABASE_URL ? "LEAKED: DATABASE_URL present without --env-file" : "CLEAN: no DATABASE_URL without --env-file");
' 2>&1)"
say "  $NEG_PROBE"

# Present is not the same as correct. These two are checked by value because they
# are the ones an ambient override silently changes, and both have consequences:
# the wrong PORT is a 502 behind nginx while the process looks healthy, and a
# NODE_ENV other than production downgrades every fatal configuration error to a
# warning and leaves cookies without the secure flag.
say "\$ env -u <keys> node --env-file=.env -e 'print NODE_ENV and PORT'   (values must match the file)"
VALUE_CHECK="$(cd "$RELEASE" && env "${PROBE_UNSET[@]}" "$NODE_BIN" --env-file=.env -e '
console.log(`NODE_ENV=${process.env.NODE_ENV} PORT=${process.env.PORT}`);
' 2>&1)"
say "  from the file:      $VALUE_CHECK"
say "  file declares:      NODE_ENV=$(grep -E '^NODE_ENV=' "$RELEASE/.env" | cut -d= -f2) PORT=$(grep -E '^PORT=' "$RELEASE/.env" | cut -d= -f2)"

# And a demonstration of the hazard itself, so the mitigation is not taken on
# trust: with NODE_ENV already set, the file does not win.
OVERRIDE_DEMO="$(cd "$RELEASE" && NODE_ENV=development PORT=9999 "$NODE_BIN" --env-file=.env -e '
console.log(`NODE_ENV=${process.env.NODE_ENV} PORT=${process.env.PORT}`);
' 2>&1)"
say "  with an ambient NODE_ENV=development PORT=9999 already set: $OVERRIDE_DEMO"
say "  ^ --env-file does not override an existing variable. This is why the service"
say "    is started with those keys stripped, here and in stage3-start.sh."

EXPECTED_ENV="NODE_ENV=$(grep -E '^NODE_ENV=' "$RELEASE/.env" | cut -d= -f2) PORT=$(grep -E '^PORT=' "$RELEASE/.env" | cut -d= -f2)"

if [[ "$ENV_PROBE" == *"ALL_REQUIRED_PRESENT"* ]] && [[ "$NEG_PROBE" == "CLEAN:"* ]] && [ "$VALUE_CHECK" = "$EXPECTED_ENV" ]; then
  ok "every required variable loads from the file with the value the file declares, and none is present without it"
else
  bad "environment loading is not proven (probe: $(printf '%s' "$ENV_PROBE" | tail -1); values: '$VALUE_CHECK' expected '$EXPECTED_ENV'; control: $NEG_PROBE)"
fi

# ---------------------------------------------------------------------------
hr; say "CRITERION 1: boots without startup errors"
hr

APP_LOG="$EVIDENCE/app-boot.log"
: > "$APP_LOG"

# Every key the .env file defines, so they can be removed from the environment
# before the process starts.
#
# This is not tidiness. Node's --env-file does NOT override a variable that is
# already set: an ambient NODE_ENV=development or PORT=3001 — from a login shell,
# from a CI runner, from PM2's snapshot of whoever ran the deploy — silently wins
# over the file, and the service comes up on the wrong port with production
# guards disabled while every check that reads the file reports success. That is
# the same class of failure as the original crash loop, and stage3-start.sh
# strips these keys for exactly this reason. The verification must do the same or
# it is testing the shell it was launched from rather than the release.
ENV_KEYS="$(grep -oE '^[A-Za-z_][A-Za-z0-9_]*' "$RELEASE/.env" | tr '\n' ' ')"
UNSET_ARGS=()
for k in $ENV_KEYS; do UNSET_ARGS+=( -u "$k" ); done

start_app() {
  ( cd "$RELEASE" && exec env "${UNSET_ARGS[@]}" "$NODE_BIN" --env-file="$RELEASE/.env" "$RELEASE/dist/index.js" >>"$APP_LOG" 2>&1 ) &
  echo $!
}

# A previous run of this script leaves its service running for the browser checks.
# Reclaiming that is safe and makes the script repeatable; reclaiming anything else
# is not, so a process this script did not start is a hard refusal rather than a
# kill. The distinction is drawn on the executable path, not the port.
PRE_EXISTING="$(ss -ltnp 2>/dev/null | grep ":$APP_PORT " || true)"
if [ -n "$PRE_EXISTING" ]; then
  HOLDER_PID="$(printf '%s' "$PRE_EXISTING" | grep -oE 'pid=[0-9]+' | head -1 | cut -d= -f2)"
  HOLDER_CMD="$(tr '\0' ' ' < "/proc/${HOLDER_PID:-0}/cmdline" 2>/dev/null || true)"
  say "  port $APP_PORT is held by pid ${HOLDER_PID:-unknown}: ${HOLDER_CMD:-<unreadable>}"

  if [ -n "$HOLDER_PID" ] && [[ "$HOLDER_CMD" == *"$RELEASE/dist/index.js"* ]]; then
    say "  that is this script's own release from a previous run; stopping it"
    kill "$HOLDER_PID" 2>/dev/null || true
    for _ in $(seq 1 20); do kill -0 "$HOLDER_PID" 2>/dev/null || break; sleep 1; done
    say "  stopped: $(kill -0 "$HOLDER_PID" 2>/dev/null && echo no || echo yes)"
  else
    bad "port $APP_PORT is held by a process this script did not start, so nothing answering on it could be attributed to this release"
    say "Refusing to kill an unrelated process. Choose another port with VERIFY_APP_PORT."
    exit 1
  fi
fi

if ss -ltnp 2>/dev/null | grep -q ":$APP_PORT "; then
  bad "port $APP_PORT is still occupied"
  exit 1
fi
say "  port $APP_PORT is free before starting"

say "\$ cd $RELEASE && env -u <every .env key> node --env-file=.env dist/index.js   (backgrounded)"
APP_PID="$(start_app)"
say "  pid $APP_PID"

# Wait for the port rather than for a fixed sleep, so a slow boot is not
# mistaken for a failed one and a fast failure is not waited out.
BOOT_OK=1
for _ in $(seq 1 60); do
  if curl -fsS -o /dev/null "http://127.0.0.1:$APP_PORT/api/health" 2>/dev/null; then BOOT_OK=0; break; fi
  if ! kill -0 "$APP_PID" 2>/dev/null; then break; fi
  sleep 1
done

say "  boot log (last 20 lines):"
tail -20 "$APP_LOG" | sed 's/^/    /'

# Anything the application itself calls an error, a failure, or a crash.
ERROR_LINES="$(grep -icE 'Failed to start|FATAL|Unhandled|UnhandledPromiseRejection|ECONNREFUSED|Cannot find module|SyntaxError|TypeError|Error: ' "$APP_LOG" || true)"
say "  lines matching error patterns: $ERROR_LINES"
if [ "$ERROR_LINES" != "0" ]; then
  say "  matching lines:"
  grep -inE 'Failed to start|FATAL|Unhandled|ECONNREFUSED|Cannot find module|SyntaxError|TypeError|Error: ' "$APP_LOG" | head -20 | sed 's/^/    /'
fi

LISTENING="$(ss -ltnp 2>/dev/null | grep ":$APP_PORT " || true)"
say "  listener: ${LISTENING:-none}"

# The listener must be the process we started. Without this the check passes
# whenever anything at all answers on the port, which is how a stale release
# from a previous session came to certify this one.
LISTENER_PID="$(printf '%s' "$LISTENING" | grep -oE 'pid=[0-9]+' | head -1 | cut -d= -f2)"
say "  listener pid: ${LISTENER_PID:-none}   started pid: $APP_PID"
OWNS_PORT=1
if [ -n "$LISTENER_PID" ] && [ "$LISTENER_PID" = "$APP_PID" ]; then OWNS_PORT=0; fi

# The running process's own view of its configuration, read back from the
# service rather than from the file, so an ambient override cannot hide here.
CONFIG_ECHO="$(curl -fsS "http://127.0.0.1:$APP_PORT/api/health" 2>/dev/null | head -c 300 || true)"
say "  health payload: ${CONFIG_ECHO:-<none>}"

if [ "$BOOT_OK" -eq 0 ] && [ "$ERROR_LINES" = "0" ] && [ "$OWNS_PORT" -eq 0 ] && kill -0 "$APP_PID" 2>/dev/null; then
  ok "the process we started is listening on $APP_PORT and logged no errors"
elif [ "$OWNS_PORT" -ne 0 ]; then
  bad "something other than the process we started is listening on $APP_PORT (listener pid ${LISTENER_PID:-none}, ours $APP_PID)"
else
  bad "boot was not clean (health reachable: $([ $BOOT_OK -eq 0 ] && echo yes || echo no); error lines: $ERROR_LINES; alive: $(kill -0 "$APP_PID" 2>/dev/null && echo yes || echo no))"
fi

# The application's own opinion of its configuration and dependencies.
say "\$ curl /api/health/deep"
curl -fsS "http://127.0.0.1:$APP_PORT/api/health/deep" 2>&1 | head -c 900 | sed 's/^/  /'
say ""

# ---------------------------------------------------------------------------
hr; say "CRITERION 5: a permanent administrator account is created"
hr

ADMIN_PASSWORD="$(openssl rand -base64 24 | tr -d '\n/+=' | head -c 20)Aa1!"

# bootstrap-admin.mjs registers through the application's own /api/auth/register
# route so the password hash is produced exactly as every other one is, then sets
# the role directly because nothing in the product grants it. It reads
# ADMIN_EMAIL/ADMIN_PASSWORD/ADMIN_NAME from the environment, and API_URL must
# point at this release's port rather than its 3001 default.
say "\$ ADMIN_EMAIL=... ADMIN_PASSWORD=... API_URL=http://127.0.0.1:$APP_PORT node --env-file=.env bootstrap-admin.mjs"
( cd "$RELEASE" && ADMIN_EMAIL="$ADMIN_EMAIL" ADMIN_PASSWORD="$ADMIN_PASSWORD" ADMIN_NAME="$ADMIN_NAME" \
    API_URL="http://127.0.0.1:$APP_PORT" \
    "$NODE_BIN" --env-file="$RELEASE/.env" bootstrap-admin.mjs ) 2>&1 \
  | tee "$EVIDENCE/bootstrap-admin.log" | sed 's/^/  /'
BOOTSTRAP_STATUS="${PIPESTATUS[0]}"

# Read back from the database rather than trusting the script's own output.
ADMIN_ROW="$(psql "$DB_URL" -tAc "SELECT id || '|' || email || '|' || role || '|' || COALESCE(\"emailVerifiedAt\"::text,'null') FROM users WHERE email = '$ADMIN_EMAIL'" 2>/dev/null | tr -d ' ')"
say "  User row: ${ADMIN_ROW:-<not found>}"
HASH_ALGO="$(psql "$DB_URL" -tAc "SELECT left(\"passwordHash\", 4) FROM users WHERE email = '$ADMIN_EMAIL'" 2>/dev/null | tr -d ' ')"
say "  password hash prefix: ${HASH_ALGO:-<none>}  (bcrypt hashes begin \$2a/\$2b)"

if [ "$BOOTSTRAP_STATUS" -eq 0 ] && [[ "$ADMIN_ROW" == *"|admin|"* ]] && [[ "$HASH_ALGO" == "\$2"* ]]; then
  ok "an administrator exists in the database with role=admin and a bcrypt password hash"
else
  bad "the administrator was not created as expected (exit $BOOTSTRAP_STATUS, row: ${ADMIN_ROW:-none}, hash: ${HASH_ALGO:-none})"
fi

# ---------------------------------------------------------------------------
hr; say "CRITERION 6: login succeeds"
hr

LOGIN_BODY="$EVIDENCE/login-response.json"
say "\$ curl -X POST /api/auth/login  (as $ADMIN_EMAIL)"
LOGIN_CODE="$(curl -sS -o "$LOGIN_BODY" -w '%{http_code}' \
  -X POST "http://127.0.0.1:$APP_PORT/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")"
say "  HTTP $LOGIN_CODE"

ACCESS_TOKEN="$("$NODE_BIN" -e '
const fs = require("fs");
try {
  const b = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  process.stdout.write(b.accessToken ?? b.token ?? "");
} catch { process.stdout.write(""); }
' "$LOGIN_BODY")"
REFRESH_TOKEN="$("$NODE_BIN" -e '
const fs = require("fs");
try {
  const b = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  process.stdout.write(b.refreshToken ?? "");
} catch { process.stdout.write(""); }
' "$LOGIN_BODY")"

say "  access token:  $([ -n "$ACCESS_TOKEN" ] && echo "issued, ${#ACCESS_TOKEN} chars" || echo "NOT ISSUED")"
say "  refresh token: $([ -n "$REFRESH_TOKEN" ] && echo "issued, ${#REFRESH_TOKEN} chars" || echo "NOT ISSUED")"
say "  returned role: $("$NODE_BIN" -e 'const fs=require("fs");try{const b=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(b.user?.role??"<none>")}catch{process.stdout.write("<unparseable>")}' "$LOGIN_BODY")"

# A wrong password must be refused, or "login succeeds" means nothing.
WRONG_CODE="$(curl -sS -o /dev/null -w '%{http_code}' \
  -X POST "http://127.0.0.1:$APP_PORT/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"definitely-not-the-password\"}")"
say "  wrong password is refused with HTTP $WRONG_CODE   (control)"

if [ "$LOGIN_CODE" = "200" ] && [ -n "$ACCESS_TOKEN" ] && [ "$WRONG_CODE" != "200" ]; then
  ok "login returns 200 with a token, and a wrong password does not"
else
  bad "login did not behave correctly (correct password: HTTP $LOGIN_CODE, token: $([ -n "$ACCESS_TOKEN" ] && echo yes || echo no), wrong password: HTTP $WRONG_CODE)"
fi

# ---------------------------------------------------------------------------
hr; say "CRITERION 8: administrative routes are accessible"
hr

ADMIN_ROUTES=(
  "/api/admin/stats"
  "/api/admin/intelligence/overview"
  "/api/admin/intelligence/dashboard"
  "/api/admin/intelligence/settings"
  "/api/admin/intelligence/uploads"
  "/api/admin/intelligence/new-inmates"
  "/api/admin/intelligence/review"
  "/api/admin/intelligence/import-history"
  "/api/admin/intelligence/engines"
  "/api/admin/intelligence/statistics"
)

ROUTE_OK=0
ROUTE_BAD=0
for route in "${ADMIN_ROUTES[@]}"; do
  code="$(curl -sS -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $ACCESS_TOKEN" "http://127.0.0.1:$APP_PORT$route")"
  # Unauthenticated, to prove the route is actually guarded rather than open.
  anon="$(curl -sS -o /dev/null -w '%{http_code}' "http://127.0.0.1:$APP_PORT$route")"
  if [ "$code" = "200" ] && { [ "$anon" = "401" ] || [ "$anon" = "403" ]; }; then
    ROUTE_OK=$((ROUTE_OK + 1))
    say "  PASS  $route  authenticated=$code  anonymous=$anon"
  else
    ROUTE_BAD=$((ROUTE_BAD + 1))
    say "  FAIL  $route  authenticated=$code  anonymous=$anon"
  fi
done

if [ "$ROUTE_BAD" -eq 0 ]; then
  ok "$ROUTE_OK administrative routes answer 200 for the administrator and refuse anonymous callers"
else
  bad "$ROUTE_BAD of $((ROUTE_OK + ROUTE_BAD)) administrative routes did not behave correctly"
fi

# ---------------------------------------------------------------------------
hr; say "CRITERION 9: session persistence survives restart"
hr

say "Refresh tokens must be stored, not held in memory, or every restart signs everyone out."
STORED_TOKENS="$(psql "$DB_URL" -tAc "SELECT count(*) FROM refresh_tokens" 2>/dev/null | tr -d ' ')"
say "  RefreshToken rows before restart: ${STORED_TOKENS:-<table missing>}"

say "\$ kill $APP_PID   (stop the service)"
kill "$APP_PID" 2>/dev/null || true
for _ in $(seq 1 20); do kill -0 "$APP_PID" 2>/dev/null || break; sleep 1; done
say "  process alive after stop: $(kill -0 "$APP_PID" 2>/dev/null && echo yes || echo no)"

say "\$ cd $RELEASE && node --env-file=.env dist/index.js   (start again)"
APP_PID2="$(start_app)"
say "  new pid $APP_PID2"
for _ in $(seq 1 60); do
  curl -fsS -o /dev/null "http://127.0.0.1:$APP_PORT/api/health" 2>/dev/null && break
  sleep 1
done
say "  health after restart: $(curl -sS -o /dev/null -w '%{http_code}' "http://127.0.0.1:$APP_PORT/api/health")"

# The token issued by the OLD process, presented to the NEW one. This is the
# real test: it only works if the signing secret came from .env both times and
# the token store is the database.
say "\$ curl -X POST /api/auth/refresh   (with the refresh token from before the restart)"
REFRESH_BODY="$EVIDENCE/refresh-after-restart.json"
REFRESH_CODE="$(curl -sS -o "$REFRESH_BODY" -w '%{http_code}' \
  -X POST "http://127.0.0.1:$APP_PORT/api/auth/refresh" \
  -H 'Content-Type: application/json' \
  -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}")"
say "  HTTP $REFRESH_CODE"

NEW_ACCESS="$("$NODE_BIN" -e '
const fs = require("fs");
try {
  const b = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  process.stdout.write(b.accessToken ?? b.token ?? "");
} catch { process.stdout.write(""); }
' "$REFRESH_BODY")"
say "  new access token: $([ -n "$NEW_ACCESS" ] && echo "issued, ${#NEW_ACCESS} chars" || echo "NOT ISSUED")"

# And the renewed token must actually work on a guarded route.
POST_RESTART_CODE="$(curl -sS -o /dev/null -w '%{http_code}' \
  -H "Authorization: Bearer ${NEW_ACCESS:-none}" \
  "http://127.0.0.1:$APP_PORT/api/admin/intelligence/settings")"
say "  admin route with the renewed token: HTTP $POST_RESTART_CODE"

# The pre-restart access token is also checked: it is signed with the same
# secret, so it should still be honoured until it expires. If it is not, the
# secret changed across the restart — the original defect.
OLD_TOKEN_CODE="$(curl -sS -o /dev/null -w '%{http_code}' \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  "http://127.0.0.1:$APP_PORT/api/admin/intelligence/settings")"
say "  pre-restart access token after restart: HTTP $OLD_TOKEN_CODE  (200 proves the signing secret is stable)"

if [ "$REFRESH_CODE" = "200" ] && [ -n "$NEW_ACCESS" ] && [ "$POST_RESTART_CODE" = "200" ] && [ "$OLD_TOKEN_CODE" = "200" ]; then
  ok "a session established before the restart still works after it, without signing in again"
else
  bad "the session did not survive the restart (refresh HTTP $REFRESH_CODE, renewed token HTTP $POST_RESTART_CODE, pre-restart token HTTP $OLD_TOKEN_CODE)"
fi

# ---------------------------------------------------------------------------
hr; say "CRITERION 7: the administrative dashboard loads"
hr

# The API half is verified here; the rendered page is verified in a browser and
# recorded as a screenshot, because "loads" is a claim about the UI.
DASHBOARD_PAYLOAD="$(curl -sS -H "Authorization: Bearer ${NEW_ACCESS:-$ACCESS_TOKEN}" "http://127.0.0.1:$APP_PORT/api/admin/intelligence/dashboard")"
say "  dashboard payload (first 400 chars):"
printf '%s\n' "${DASHBOARD_PAYLOAD:0:400}" | sed 's/^/    /'

if [[ "$DASHBOARD_PAYLOAD" == *'"session"'* ]] && [[ "$DASHBOARD_PAYLOAD" == *'"results"'* ]]; then
  ok "the dashboard endpoint returns a well-formed payload (the rendered page is verified separately in a browser)"
else
  bad "the dashboard endpoint did not return the expected payload"
fi

# ---------------------------------------------------------------------------
hr; say "CRITERION 10: the system is ready to accept work"
hr

# Not in the original list, and added because the browser check found it: a fresh
# instance passes every criterion above and still cannot ingest anything, because
# no facility and no parser profile exist. The Settings screen says so and names
# the script — but a system that tells its operator to go and run a script is not
# yet operational, so the step belongs in the deployment and therefore here.
say "\$ npx tsx scripts/seed-sacramento.ts"
( cd "$REPO/backend" && env "${UNSET_ARGS[@]}" DATABASE_URL="$DB_URL?schema=public" \
    npx tsx scripts/seed-sacramento.ts ) 2>&1 | tee "$EVIDENCE/seed-sacramento.log" | sed 's/^/  /'
SEED_STATUS="${PIPESTATUS[0]}"

FACILITIES="$(psql "$DB_URL" -tAc "SELECT count(*) FROM inmate_facilities WHERE active = true" 2>/dev/null | tr -d ' ')"
PROFILES="$(psql "$DB_URL" -tAc "SELECT count(*) FROM inmate_parser_profiles WHERE active = true" 2>/dev/null | tr -d ' ')"
say "  active facilities:      ${FACILITIES:-0}"
say "  active parser profiles: ${PROFILES:-0}"

# And the running service must see them, which is what the operator's Settings
# screen reads.
SETTINGS_PAYLOAD="$(curl -sS -H "Authorization: Bearer ${NEW_ACCESS:-$ACCESS_TOKEN}" "http://127.0.0.1:$APP_PORT/api/admin/intelligence/settings")"
SETTINGS_FACILITIES="$("$NODE_BIN" -e '
let raw = "";
process.stdin.on("data", (c) => { raw += c; });
process.stdin.on("end", () => {
  try {
    const b = JSON.parse(raw);
    console.log(`facilities=${(b.facilities ?? []).length} profiles=${(b.parserProfiles ?? []).length}`);
  } catch { console.log("unparseable"); }
});' <<<"$SETTINGS_PAYLOAD")"
say "  as the Settings screen sees it: $SETTINGS_FACILITIES"

if [ "$SEED_STATUS" -eq 0 ] && [ "${FACILITIES:-0}" -ge 1 ] && [ "${PROFILES:-0}" -ge 2 ] && [[ "$SETTINGS_FACILITIES" != *"facilities=0"* ]]; then
  ok "a facility and its CSV and PDF parser profiles are registered and visible to the service"
else
  bad "the instance is not ready to accept work (seed exit $SEED_STATUS, facilities ${FACILITIES:-0}, profiles ${PROFILES:-0}, service sees $SETTINGS_FACILITIES)"
fi

# ---------------------------------------------------------------------------
hr; say "SUMMARY"
hr

say "credentials for the browser check are written to $EVIDENCE/admin-credentials.txt"
cat > "$EVIDENCE/admin-credentials.txt" <<CREDS
email=$ADMIN_EMAIL
password=$ADMIN_PASSWORD
backend=http://127.0.0.1:$APP_PORT
pid=$APP_PID2
CREDS
chmod 600 "$EVIDENCE/admin-credentials.txt"

say ""
say "passed:   $PASSES"
say "failed:   ${#FAILURES[@]}"
if [ "${#FAILURES[@]}" -gt 0 ]; then
  say ""
  say "FAILURES:"
  for f in "${FAILURES[@]}"; do say "  - $f"; done
fi
say ""
say "The service is left running as pid $APP_PID2 for the browser checks."
say "finished: $(date -u +%Y-%m-%dT%H:%M:%SZ)"

[ "${#FAILURES[@]}" -eq 0 ]
