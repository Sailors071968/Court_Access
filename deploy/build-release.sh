#!/usr/bin/env bash
#
# Assemble a release in the exact layout production expects:
#
#   dist/index.js     the API, bundled — PM2 runs this
#   dist/public/      the frontend, served by nginx
#
# Run from the repository root. Produces ./release/ ready to copy to the host.

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${1:-$ROOT/release}"

# Production hosts commonly export NODE_ENV=production, and npm then skips
# devDependencies. TypeScript, Vite and esbuild are all devDependencies, so the
# build would fail with "tsc: not found". Force them in for the build itself;
# the artifact is unaffected because nothing dev-only is bundled.
export npm_config_include=dev
unset NODE_ENV

echo "==> Frontend"
cd "$ROOT"
npm ci --include=dev
npm run build
[ -f dist/index.html ] || { echo "Frontend build produced no index.html" >&2; exit 1; }

echo "==> Backend"
cd "$ROOT/backend"
npm ci --include=dev
npx prisma generate
npm run build
[ -f dist/index.js ] || { echo "Backend build produced no dist/index.js" >&2; exit 1; }

echo "==> Assembling into $OUT"

# rm -rf on the output is destructive. Refuse if the target looks like a live
# release rather than a build directory: a .env or an evidence directory there
# means somebody pointed this at a running deployment, and the rehearsal proved
# how easily that removes the configuration the service needs.
if [ -e "$OUT/.env" ] || [ -d "$OUT/evidence" ] || [ -d "$OUT/staging" ]; then
  echo "Refusing to overwrite $OUT: it contains .env or uploaded data." >&2
  echo "That looks like a live release. Build to a new directory instead." >&2
  exit 1
fi

# Clear the contents rather than the directory. Removing $OUT itself needs write
# permission on its parent, and a deployment target under /var/www is created by
# an administrator inside a root-owned parent — so the unlink fails even though
# the build user owns the directory. Emptying it achieves the same result and
# preserves the ownership the administrator set.
if [ -d "$OUT" ]; then
  find "$OUT" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
fi
mkdir -p "$OUT/dist/public"
cp "$ROOT/backend/dist/index.js" "$OUT/dist/index.js"
cp -a "$ROOT/dist/." "$OUT/dist/public/"

# The bundle keeps node_modules external, so they ship with it, along with the
# Prisma schema and migrations the runtime and deployment need.
cp -a "$ROOT/backend/node_modules" "$OUT/node_modules"

# Only what the release actually needs: schemaAssert reads schema.prisma for
# drift detection and migrations/ for the checksum and pending count, and
# `prisma migrate deploy` needs both. Copying the whole prisma/ tree also
# shipped prisma/schema/, which holds CI-only TypeScript tooling — source
# files have no business in a production release.
mkdir -p "$OUT/prisma"
cp "$ROOT/backend/prisma/schema.prisma" "$OUT/prisma/schema.prisma"
cp -a "$ROOT/backend/prisma/migrations" "$OUT/prisma/migrations"

cp "$ROOT/backend/package.json" "$OUT/package.json"

# A release is not a git checkout, so the commit has to travel with it. Without
# this, every certification record stores a null commit and the permanent
# history cannot say which build produced a finding.
cat > "$OUT/dist/build-info.json" <<EOF
{
  "commit": "$(git -C "$ROOT" rev-parse HEAD)",
  "branch": "$(git -C "$ROOT" rev-parse --abbrev-ref HEAD)",
  "builtAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

echo
echo "Release assembled at $OUT"
echo "  dist/index.js      $(du -h "$OUT/dist/index.js" | cut -f1)"
echo "  dist/public/       $(find "$OUT/dist/public" -type f | wc -l) files"
echo "  node_modules/      $(du -sh "$OUT/node_modules" | cut -f1)"
