// ============================================================================
// Master Program 1 — Repository Consolidation analysis (deterministic).
// Builds the import/dependency graph, detects orphan modules, duplicate Prisma
// @@map, duplicate route registrations, and duplicate service basenames.
// No estimation — reads real files. Outputs machine-readable graphs + candidates.
// ============================================================================

import { readdirSync, statSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative, basename, dirname } from 'node:path';

const ROOT = process.cwd();
const OUT = join(ROOT, 'docs', 'consolidation');
const SCAN_ROOTS = ['src', 'backend/src', 'workers', 'scripts', 'tests'];
const ENTRY = new Set(['src/main.tsx', 'src/App.tsx', 'src/vite-env.d.ts', 'backend/src/server.ts']);

function walk(dir, acc = []) {
  let es; try { es = readdirSync(dir, { withFileTypes: true }); } catch { return acc; }
  for (const e of es) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (!/node_modules|dist|\.git|coverage/.test(p)) walk(p, acc); }
    else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(e.name)) acc.push(p);
  }
  return acc;
}

const files = [];
for (const r of SCAN_ROOTS) walk(join(ROOT, r), files);
const rel = (f) => relative(ROOT, f);
const contents = new Map(files.map((f) => [f, readFileSync(f, 'utf-8')]));

// ── Import graph: file -> imported LOCAL files (resolved by basename ref) ─────
const byBase = new Map(); // basename(no ext) -> [files]
for (const f of files) {
  const b = basename(f).replace(/\.(ts|tsx|js|jsx|mjs|cjs)$/, '');
  if (!byBase.has(b)) byBase.set(b, []);
  byBase.get(b).push(f);
}

const importGraph = {}; // rel(file) -> [rel(importedFile)]
const referencedBy = new Map(files.map((f) => [f, new Set()]));
for (const f of files) {
  const src = contents.get(f);
  const deps = new Set();
  // static + dynamic import specifiers (relative)
  for (const m of src.matchAll(/(?:from|import|require)\s*\(?\s*['"](\.\.?\/[^'"]+)['"]/g)) {
    const spec = m[1];
    const target = basename(spec).replace(/\.(ts|tsx|js|jsx|mjs|cjs)$/, '');
    for (const cand of byBase.get(target) ?? []) {
      if (cand !== f) { deps.add(cand); referencedBy.get(cand).add(f); }
    }
  }
  importGraph[rel(f)] = [...deps].map(rel);
}

// ── Entry points from package.json scripts (NOT dead even if unimported) ──────
const entryFromScripts = new Set();
for (const pkgPath of ['package.json', 'backend/package.json']) {
  try {
    const scripts = JSON.parse(readFileSync(join(ROOT, pkgPath), 'utf-8')).scripts ?? {};
    const prefix = pkgPath.startsWith('backend') ? 'backend/' : '';
    for (const cmd of Object.values(scripts)) {
      for (const m of String(cmd).matchAll(/(?:src|scripts|workers)\/[\w./-]+\.(?:ts|tsx|mjs|cjs|js|sh)/g)) {
        entryFromScripts.add(prefix + m[0]);
      }
    }
  } catch { /* ignore */ }
}
function isEntryPoint(r) {
  return ENTRY.has(r)
    || /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(r)
    || /(^|\/)scripts\//.test(r)
    || /(^|\/)cli\.ts$/.test(r)
    || /(^|\/)server\.ts$/.test(r)
    || /(^|\/)__tests__\//.test(r)
    || entryFromScripts.has(r);
}

// ── Orphans: not referenced by any file (and not an entry point) ─────────────
const orphans = [];
for (const f of files) {
  const r = rel(f);
  if (isEntryPoint(r)) continue;
  if (basename(f).replace(/\.\w+$/, '') === 'index') continue; // barrels
  if (referencedBy.get(f).size === 0) orphans.push({ file: r, size: statSync(f).size, area: r.startsWith('src/') ? 'frontend' : (r.startsWith('backend/') ? 'backend' : 'other') });
}
orphans.sort((a, b) => b.size - a.size);
const removableFrontend = orphans.filter((o) => o.area === 'frontend');
const backendCandidates = orphans.filter((o) => o.area === 'backend');

// ── Duplicate Prisma @@map ────────────────────────────────────────────────────
const schema = readFileSync(join(ROOT, 'backend/prisma/schema.prisma'), 'utf-8');
const maps = [...schema.matchAll(/@@map\("([^"]+)"\)/g)].map((m) => m[1]);
const mapCounts = {};
for (const m of maps) mapCounts[m] = (mapCounts[m] || 0) + 1;
const dupMaps = Object.entries(mapCounts).filter(([, n]) => n > 1);
const modelsNoMap = [...schema.matchAll(/model\s+(\w+)\s*\{([\s\S]*?)\n\}/g)].filter((m) => !/@@map/.test(m[2])).map((m) => m[1]);

// ── Duplicate route registrations (method+route) ──────────────────────────────
const routeRe = /app\.(get|post|put|delete|patch)\(\s*['"`]([^'"`]+)['"`]/g;
const routeSeen = new Map();
for (const f of files) {
  if (!/backend\/src/.test(f)) continue;
  const src = contents.get(f);
  let m; routeRe.lastIndex = 0;
  while ((m = routeRe.exec(src))) {
    const key = `${m[1].toUpperCase()} ${m[2]}`;
    if (!routeSeen.has(key)) routeSeen.set(key, []);
    routeSeen.get(key).push(rel(f));
  }
}
const dupRoutes = [...routeSeen.entries()].filter(([, fs]) => fs.length > 1).map(([k, fs]) => ({ route: k, files: fs }));

// ── Duplicate service basenames across directories ────────────────────────────
const svc = new Map();
for (const f of files) {
  const b = basename(f);
  if (!/[Ss]ervice\.(ts|js)$/.test(b)) continue;
  if (!svc.has(b)) svc.set(b, []);
  svc.get(b).push(rel(f));
}
const dupServices = [...svc.entries()].filter(([, fs]) => fs.length > 1).map(([name, fs]) => ({ name, files: fs }));

// ── Repository graph: top-level dir -> file count + edges to other dirs ────────
function topDir(f) { const r = rel(f); const parts = r.split('/'); return parts.slice(0, r.startsWith('backend/src') ? 3 : 2).join('/'); }
const repoGraph = {};
for (const f of files) {
  const d = topDir(f);
  repoGraph[d] ??= { files: 0, dependsOn: {} };
  repoGraph[d].files++;
  for (const dep of importGraph[rel(f)]) {
    const dd = topDir(join(ROOT, dep));
    if (dd !== d) repoGraph[d].dependsOn[dd] = (repoGraph[d].dependsOn[dd] || 0) + 1;
  }
}

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'import-graph.json'), JSON.stringify({ files: files.length, graph: importGraph }, null, 2));
writeFileSync(join(OUT, 'repository-graph.json'), JSON.stringify(repoGraph, null, 2));
writeFileSync(join(OUT, 'orphans.json'), JSON.stringify(orphans, null, 2));
writeFileSync(join(OUT, 'duplicates.json'), JSON.stringify({ prismaMap: dupMaps, prismaModelsWithoutMap: modelsNoMap, routes: dupRoutes, services: dupServices }, null, 2));

writeFileSync(join(OUT, 'orphans.json'), JSON.stringify({ removableFrontend, backendCandidates, entryPointsExcluded: [...entryFromScripts].length }, null, 2));
console.log('Files scanned:', files.length);
console.log('Frontend removable orphans:', removableFrontend.length, '(' + (removableFrontend.reduce((s, o) => s + o.size, 0) / 1024).toFixed(0) + 'KB)');
console.log('Backend orphan CANDIDATES (review, not auto-removed):', backendCandidates.length);
console.log('Entry points excluded from orphan set:', entryFromScripts.size, 'script-referenced');
console.log('Duplicate Prisma @@map:', dupMaps.length, '| models without @@map:', modelsNoMap.join(','));
console.log('Duplicate route registrations:', dupRoutes.length, '| duplicate service basenames:', dupServices.length);
console.log('\n=== Frontend removable orphans ===');
for (const o of removableFrontend) console.log(`  ${(o.size/1024).toFixed(1)}KB  ${o.file}`);
console.log('\n=== Backend candidates (top 15, REVIEW) ===');
for (const o of backendCandidates.slice(0, 15)) console.log(`  ${(o.size/1024).toFixed(1)}KB  ${o.file}`);
