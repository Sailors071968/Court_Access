#!/usr/bin/env bash
# ============================================================================
# Stage 2 — Provision the Version 1.0 database and apply migrations.
#
# The existing database is never opened for writing. This creates a separate
# database because the existing one belongs to the disjoint phase10q lineage:
# the Release Candidate's migrations would either be refused (P3005) or, if
# forced, would damage an application that is not this one.
#
# Requires $V1/.env to exist and contain DATABASE_URL pointing at the NEW
# database. Stage 2 will not create or edit that file.
#
#   export NODE22=...
#   bash deploy/stages/stage2-database.sh
#
# Rollback: sudo -u postgres dropdb courtaccess_v1
# ============================================================================

STAGE_NAME="Stage 2 — database and migrations"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_common.sh
. "$DIR/_common.sh"

deploy_env || { finish; exit 1; }
verify_interpreter
baseline_existing

say "PRE-FLIGHT"
[ -f "$V1/.env" ] || { bad "$V1/.env does not exist — create it before this stage"; finish; exit 1; }
[ -f "$V1/dist/index.js" ] || { bad "$V1/dist/index.js missing — run stage 1 first"; finish; exit 1; }

# Load ONLY the release env file, not the shell's.
set -a; . "$V1/.env"; set +a
[ -n "${DATABASE_URL:-}" ] || { bad "DATABASE_URL not set in $V1/.env"; finish; exit 1; }

# Prisma understands ?schema=public; psql and pg_dump reject it outright with
# 'invalid URI query parameter: "schema"'.
PGURL="${DATABASE_URL%%\?*}"
MASKED="$(printf '%s' "$PGURL" | sed -E 's#(//[^:]+):[^@]*@#\1:***@#')"
kv "DATABASE_URL (masked)" "$MASKED"
kv "PORT in release env"   "${PORT:-<unset>}"

check "release port is the isolated port" "$V1_PORT" "${PORT:-}"

# The new database must not be the one the existing application uses.
NEWDB="$(printf '%s' "$PGURL" | sed -E 's#.*/([^/?]+)$#\1#')"
kv "target database" "$NEWDB"
if [ "$NEWDB" = "$V1_DB" ]; then ok "target database is the dedicated V1 database"
else bad "target database '$NEWDB' is not '$V1_DB' — refusing to migrate an unexpected database"; fi

[ "$FAILURES" -eq 0 ] || { finish; exit 1; }

say "DATABASE EXISTS AND IS REACHABLE"
if psql "$PGURL" -tAc "select 1" >/dev/null 2>&1; then
  ok "connected to $NEWDB"
else
  bad "cannot connect to $NEWDB"
  info "create it first, without touching the existing database:"
  info "  sudo -u postgres createdb $V1_DB -O <role>"
  finish; exit 1
fi
kv "server version" "$(psql "$PGURL" -tAc 'select version()' 2>&1 | head -1)"

say "IS IT EMPTY?  (it must be — this is a greenfield database)"
PRE_TABLES="$(psql "$PGURL" -tAc "select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE'" 2>/dev/null | tr -d ' ')"
kv "tables before migration" "$PRE_TABLES"
if [ "${PRE_TABLES:-1}" -eq 0 ]; then
  ok "database is empty, as expected for greenfield"
else
  bad "database already has $PRE_TABLES tables — this is not a fresh database"
  info "Stage 2 refuses to migrate a non-empty database. Investigate what is in it."
  finish; exit 1
fi

say "APPLY MIGRATIONS  (pinned interpreter; no npx)"
cd "$V1" || { bad "cannot cd to $V1"; finish; exit 1; }
"$NODE22" node_modules/.bin/prisma migrate deploy 2>&1 | tail -6

say "POST-MIGRATION VERIFICATION"
TABLES="$(psql "$PGURL" -tAc "select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE'" 2>/dev/null | tr -d ' ')"
check "table count" "$EXPECTED_TABLES" "$TABLES"

APPLIED="$(psql "$PGURL" -tAc "select count(*) filter (where finished_at is not null) from _prisma_migrations" 2>/dev/null | tr -d ' ')"
UNFIN="$(psql "$PGURL" -tAc "select count(*) filter (where finished_at is null and rolled_back_at is null) from _prisma_migrations" 2>/dev/null | tr -d ' ')"
check "migrations applied"   "$EXPECTED_MIGRATIONS" "$APPLIED"
check "migrations unfinished" "0" "$UNFIN"

INDEXES="$(psql "$PGURL" -tAc "select count(*) from pg_indexes where schemaname='public'" 2>/dev/null | tr -d ' ')"
FKEYS="$(psql "$PGURL" -tAc "select count(*) from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public' and c.contype='f'" 2>/dev/null | tr -d ' ')"
kv "indexes"      "$INDEXES"
kv "foreign keys" "$FKEYS"

say "SCHEMA DRIFT"
DIFF="$("$NODE22" node_modules/.bin/prisma migrate diff \
        --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma 2>&1 | head -3)"
kv "migrate diff" "$(printf '%s' "$DIFF" | tr '\n' ' ')"
if printf '%s' "$DIFF" | grep -q "No difference detected"; then
  ok "no drift between the database and the datamodel"
else
  bad "drift detected between the database and schema.prisma"
fi

manifest_record "databaseName"  "$NEWDB"
manifest_record "databaseHost"  "$(printf '%s' "$PGURL" | sed -E 's#.*@([^/]+)/.*#\\1#')"
manifest_record "tablesCreated" "$TABLES"
manifest_record "migrationsApplied" "$APPLIED"

assert_existing_unchanged
finish
