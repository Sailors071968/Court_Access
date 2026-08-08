#!/usr/bin/env bash
# ============================================================================
# Stage 1 — Provision the greenfield installation and build the artifact.
#
# Touches nothing in the existing installation. Creates $V1, clones the
# Release Candidate, builds with the pinned Node 22 toolchain, verifies the
# artifact against the certified checksum.
#
#   export NODE22="$HOME/.nvm/versions/node/v22.x.y/bin/node"
#   bash deploy/stages/stage1-provision.sh
#
# Rollback: sudo rm -rf /var/www/courtaccess-v1 /opt/courtaccess-build
# ============================================================================

STAGE_NAME="Stage 1 — provision and build"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_common.sh
. "$DIR/_common.sh"

BRANCH="${BRANCH:-cursor/gold-standard-upload-portal-9f94}"
REPO="${REPO:-https://github.com/Sailors071968/Court_Access.git}"

deploy_env || { finish; exit 1; }
verify_interpreter
manifest_init
baseline_existing

say "PRE-FLIGHT"
kv "existing install" "$APP_EXISTING"
kv "new install"      "$V1"
kv "build scratch"    "$BUILD"
kv "branch"           "$BRANCH"

FREE_VAR_MB=$(df -Pm /var | awk 'NR==2{print $4}')
kv "free on /var (MB)" "$FREE_VAR_MB"
if [ "${FREE_VAR_MB:-0}" -lt 2048 ]; then
  bad "less than 2 GB free on /var; the build needs roughly 1.5 GB transiently"
else ok "sufficient free space"; fi

if [ -e "$V1" ]; then
  bad "$V1 already exists — inspect it before continuing (this stage will not overwrite)"
else ok "$V1 does not exist yet"; fi

[ "$FAILURES" -eq 0 ] || { finish; exit 1; }

say "PROVISION"
sudo mkdir -p "$V1" "$BUILD" || bad "could not create target directories"
sudo chown "$(whoami)":"$(whoami)" "$V1" "$BUILD" || bad "could not take ownership"
ok "created $V1 and $BUILD"

say "CLONE"
if [ -d "$BUILD/src/.git" ]; then
  git -C "$BUILD/src" fetch origin "$BRANCH" --quiet && \
  git -C "$BUILD/src" checkout --quiet "$BRANCH" && \
  git -C "$BUILD/src" reset --hard --quiet "origin/$BRANCH" || bad "could not update the existing clone"
else
  git clone --quiet --branch "$BRANCH" "$REPO" "$BUILD/src" || bad "clone failed"
fi
CLONED_COMMIT="$(git -C "$BUILD/src" rev-parse HEAD 2>/dev/null)"
ROOT_COMMIT="$(git -C "$BUILD/src" rev-list --max-parents=0 HEAD 2>/dev/null | tail -1)"
kv "cloned commit" "$CLONED_COMMIT"
kv "root commit"   "$ROOT_COMMIT"
check "root commit is the Release Candidate lineage" \
      "31200588fa919544608eb40ca2142480109c30a5" "$ROOT_COMMIT"

[ "$FAILURES" -eq 0 ] || { finish; exit 1; }

say "BUILD  (pinned toolchain; this takes a few minutes)"
# PATH is already pinned by deploy_env, so every internal npm call in
# build-release.sh resolves to the Node 22 installation.
( cd "$BUILD/src" && bash deploy/build-release.sh "$V1" ) 2>&1 | tail -8

say "ARTIFACT VERIFICATION"
ACTUAL_SHA="$(sha256sum "$V1/dist/index.js" 2>/dev/null | cut -d' ' -f1)"
check "bundle checksum" "$EXPECTED_BUNDLE_SHA" "$ACTUAL_SHA"

TS_COUNT="$(find "$V1" -name '*.ts' -not -path '*/node_modules/*' 2>/dev/null | wc -l)"
check "TypeScript files outside node_modules" "0" "$TS_COUNT"

MIG_COUNT="$(ls -d "$V1"/prisma/migrations/*/ 2>/dev/null | wc -l)"
check "migrations present" "$EXPECTED_MIGRATIONS" "$MIG_COUNT"

[ -f "$V1/dist/public/index.html" ] && ok "frontend index.html present" || bad "frontend index.html missing"
[ -f "$V1/dist/build-info.json" ]   && ok "build-info.json present"     || bad "build-info.json missing"
[ -d "$V1/node_modules/@prisma/client" ] && ok "@prisma/client present" || bad "@prisma/client missing"

kv "build-info" "$(tr -d '\n ' < "$V1/dist/build-info.json" 2>/dev/null)"
kv "build stamp" "$(grep -o 'CourtAccess build:[^<]*' "$V1/dist/public/index.html" 2>/dev/null)"
kv "installed size" "$(du -sh "$V1" 2>/dev/null | cut -f1)"

STAMP_COMMIT="$("$NODE22" -pe "JSON.parse(require('fs').readFileSync('$V1/dist/build-info.json','utf8')).commit" 2>/dev/null)"
check "build stamp commit matches the clone" "$CLONED_COMMIT" "$STAMP_COMMIT"

manifest_record "gitCommit"     "$CLONED_COMMIT"
manifest_record "gitBranch"     "$BRANCH"
manifest_record "rootCommit"    "$ROOT_COMMIT"
manifest_record "bundleSha256"  "$ACTUAL_SHA"
manifest_record "targetDir"     "$V1"
manifest_record "nodeInterpreter" "$NODE22"
manifest_record "nodeVersion"   "$("$NODE22" --version 2>&1)"
manifest_record "npmVersion"    "$("$NPM22" --version 2>&1)"
manifest_record "pm2Version"    "$(pm2 --version 2>&1 | tail -1)"
manifest_record "opensslVersion" "$(openssl version 2>&1)"
manifest_record "migrationsInArtifact" "$MIG_COUNT"

assert_existing_unchanged
finish
