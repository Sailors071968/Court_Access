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

echo "==> Frontend"
cd "$ROOT"
npm ci
npm run build
[ -f dist/index.html ] || { echo "Frontend build produced no index.html" >&2; exit 1; }

echo "==> Backend"
cd "$ROOT/backend"
npm ci
npx prisma generate
npm run build
[ -f dist/index.js ] || { echo "Backend build produced no dist/index.js" >&2; exit 1; }

echo "==> Assembling into $OUT"
rm -rf "$OUT"
mkdir -p "$OUT/dist/public"
cp "$ROOT/backend/dist/index.js" "$OUT/dist/index.js"
cp -a "$ROOT/dist/." "$OUT/dist/public/"

# The bundle keeps node_modules external, so they ship with it, along with the
# Prisma schema and migrations the runtime and deployment need.
cp -a "$ROOT/backend/node_modules" "$OUT/node_modules"
cp -a "$ROOT/backend/prisma" "$OUT/prisma"
cp "$ROOT/backend/package.json" "$OUT/package.json"

echo
echo "Release assembled at $OUT"
echo "  dist/index.js      $(du -h "$OUT/dist/index.js" | cut -f1)"
echo "  dist/public/       $(find "$OUT/dist/public" -type f | wc -l) files"
echo "  node_modules/      $(du -sh "$OUT/node_modules" | cut -f1)"
