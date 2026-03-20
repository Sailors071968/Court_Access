#!/usr/bin/env bash
# ============================================================================
# PR 1 — Safe Database Migration Wrapper
# Runs Prisma migrations with pre-flight checks and rollback safety.
#
# Usage:
#   ./scripts/db-safe-migrate.sh [deploy|status|reset]
#
# Modes:
#   deploy  — Apply pending migrations (production-safe, default)
#   status  — Check migration status without applying
#   reset   — Reset database (DEVELOPMENT ONLY — requires confirmation)
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${BLUE}[db-safe-migrate]${NC} $*"; }
ok()   { echo -e "${GREEN}[db-safe-migrate] ✓${NC} $*"; }
warn() { echo -e "${YELLOW}[db-safe-migrate] ⚠${NC} $*"; }
err()  { echo -e "${RED}[db-safe-migrate] ✗${NC} $*" >&2; }

MODE="${1:-deploy}"

cd "$BACKEND_DIR"

# ---------------------------------------------------------------------------
# Pre-flight checks
# ---------------------------------------------------------------------------

log "Running pre-flight checks..."

# 1. Check DATABASE_URL is set
if [ -z "${DATABASE_URL:-}" ]; then
  # Try loading .env
  if [ -f .env ]; then
    log "Loading .env file..."
    set -a
    source .env
    set +a
  fi

  if [ -z "${DATABASE_URL:-}" ]; then
    err "DATABASE_URL is not set. Cannot proceed."
    exit 1
  fi
fi
ok "DATABASE_URL is set"

# 2. Check Prisma CLI is available
if ! npx prisma --version > /dev/null 2>&1; then
  err "Prisma CLI not found. Run 'npm install' first."
  exit 1
fi
ok "Prisma CLI available"

# 3. Generate Prisma client (ensures schema is parsed)
log "Generating Prisma client..."
npx prisma generate
ok "Prisma client generated"

# ---------------------------------------------------------------------------
# Mode: status
# ---------------------------------------------------------------------------

if [ "$MODE" = "status" ]; then
  log "Checking migration status..."
  npx prisma migrate status
  exit $?
fi

# ---------------------------------------------------------------------------
# Mode: reset (DEVELOPMENT ONLY)
# ---------------------------------------------------------------------------

if [ "$MODE" = "reset" ]; then
  if [ "${NODE_ENV:-development}" = "production" ]; then
    err "Cannot reset in production! Aborting."
    exit 1
  fi

  warn "This will DESTROY all data and re-run all migrations."
  read -r -p "Type 'RESET' to confirm: " confirm
  if [ "$confirm" != "RESET" ]; then
    log "Aborted."
    exit 0
  fi

  log "Resetting database..."
  npx prisma migrate reset --force
  ok "Database reset complete"
  exit 0
fi

# ---------------------------------------------------------------------------
# Mode: deploy (production-safe)
# ---------------------------------------------------------------------------

if [ "$MODE" != "deploy" ]; then
  err "Unknown mode: $MODE (expected: deploy|status|reset)"
  exit 1
fi

# 4. Check current migration status before deploying
log "Checking current migration status..."
STATUS_OUTPUT=$(npx prisma migrate status 2>&1) || true

# Check for failed migrations
if echo "$STATUS_OUTPUT" | grep -qi "failed"; then
  err "Failed migrations detected! Resolve manually before deploying."
  echo "$STATUS_OUTPUT"
  exit 1
fi

# 5. Create a backup marker (timestamp) for rollback reference
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
log "Migration deployment starting at: $TIMESTAMP"

# 6. Deploy migrations
log "Deploying pending migrations..."
if npx prisma migrate deploy; then
  ok "All migrations applied successfully"
else
  err "Migration deployment failed!"
  err "Check the output above for errors."
  err "The database may be in a partially-migrated state."
  err "Run 'npx prisma migrate status' to check."
  exit 1
fi

# 7. Post-deploy verification
log "Running post-deploy verification..."
FINAL_STATUS=$(npx prisma migrate status 2>&1) || true

if echo "$FINAL_STATUS" | grep -qi "pending\|failed"; then
  warn "Post-deploy check found issues:"
  echo "$FINAL_STATUS"
  exit 1
fi

ok "Post-deploy verification passed"

# 8. Verify Prisma client matches deployed schema
log "Re-generating Prisma client to match deployed schema..."
npx prisma generate
ok "Prisma client regenerated"

echo ""
ok "Database migration complete. Safe to start the server."
echo ""
log "Deployed at: $TIMESTAMP"
log "Run 'npx prisma migrate status' to verify."
