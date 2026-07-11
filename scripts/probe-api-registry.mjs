// ============================================================================
// Runtime status enrichment for the Canonical API Registry (Phase 4A)
// Probes the LIVE server. GET endpoints are probed with seeded params; mutating
// methods are NOT probed (side effects) and marked REGISTERED. Status is
// evidence-based from real HTTP responses — never fabricated.
//
// Env: API_BASE (default http://localhost:3001), TOKEN, SEED_CASE, SEED_CLIENT
// ============================================================================

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const API = process.env.API_BASE || 'http://localhost:3001';
const TOKEN = process.env.TOKEN || '';
const SEED_CASE = process.env.SEED_CASE || '';
const SEED_CLIENT = process.env.SEED_CLIENT || '';
const REG = join(process.cwd(), 'docs', 'api-registry', 'canonical-api-registry.json');

function fillParams(route) {
  return route
    .replace(/:caseId/g, SEED_CASE || 'test')
    .replace(/:clientId/g, SEED_CLIENT || 'test')
    .replace(/:[A-Za-z0-9_]+/g, 'test');
}

function classify(code) {
  if (code === 0) return 'UNKNOWN';
  // The route IS registered (it came from the registry). A 404 therefore means
  // the handler returned not-found for the seeded param — NOT a missing route.
  if (code === 404) return 'NOT_FOUND_FOR_SEED';
  if (code === 401 || code === 403) return 'CONNECTED'; // exists; auth/authz enforced
  if (code >= 200 && code < 500) return 'CONNECTED';     // exists and responds
  return 'BROKEN';                                        // 5xx
}

async function probe(method, url) {
  try {
    const res = await fetch(`${API}${url}`, { method, headers: TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {} });
    return res.status;
  } catch { return 0; }
}

const registry = JSON.parse(readFileSync(REG, 'utf-8'));
const counts = {};
let probed = 0;
for (const e of registry.endpoints) {
  if (e.method === 'GET') {
    const code = await probe('GET', fillParams(e.route));
    e.runtimeStatusCode = code;
    e.runtimeStatus = classify(code);
    probed++;
  } else {
    // Mutating endpoint — exists in code; not probed to avoid side effects.
    e.runtimeStatusCode = null;
    e.runtimeStatus = 'REGISTERED';
  }
  counts[e.runtimeStatus] = (counts[e.runtimeStatus] || 0) + 1;
}

registry.runtimeProbedAt = new Date().toISOString();
registry.runtimeProbedGetEndpoints = probed;
registry.runtimeStatusCounts = counts;
writeFileSync(REG, JSON.stringify(registry, null, 2));
console.log('Probed GET endpoints:', probed);
console.log('Runtime status counts:', JSON.stringify(counts, null, 2));
