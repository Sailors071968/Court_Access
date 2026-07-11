// ============================================================================
// CourtListener API client (Free Law Project REST v4)
// Canonical low-level HTTP client with: optional token auth, request rate
// limiting, in-memory TTL caching, timeouts, bounded retry on 429/5xx, and
// structured (never-throwing) error handling. No fabrication — every result is
// the real API response; failures return a typed error the caller can surface.
// Docs: https://www.courtlistener.com/help/api/rest/
// ============================================================================

const BASE_URL = process.env.COURTLISTENER_BASE_URL || 'https://www.courtlistener.com/api/rest/v4';
const TOKEN = process.env.COURTLISTENER_API_TOKEN || '';
const TIMEOUT_MS = Number(process.env.COURTLISTENER_TIMEOUT_MS || 20000);
const MIN_INTERVAL_MS = Number(process.env.COURTLISTENER_MIN_INTERVAL_MS || 1100); // polite rate limit
const CACHE_TTL_MS = Number(process.env.COURTLISTENER_CACHE_TTL_MS || 5 * 60 * 1000);
const MAX_CACHE = 500;

export const COURTLISTENER_CLIENT_VERSION = '1.0.0';

export interface ClResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  error: string | null;
  cached: boolean;
  tookMs: number;
  source: 'courtlistener';
  retrievedAt: string;
}

interface CacheEntry {
  at: number;
  status: number;
  data: unknown;
}
const cache = new Map<string, CacheEntry>();

// ── Rate limiter: serialize requests with a minimum inter-request interval ────
let lastRequestAt = 0;
let chain: Promise<void> = Promise.resolve();
function rateGate(): Promise<void> {
  const run = chain.then(async () => {
    const wait = Math.max(0, lastRequestAt + MIN_INTERVAL_MS - Date.now());
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastRequestAt = Date.now();
  });
  chain = run.catch(() => undefined);
  return run;
}

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = { Accept: 'application/json', 'User-Agent': 'CourtAccess/1.0 (+legal-research)' };
  if (TOKEN) h.Authorization = `Token ${TOKEN}`;
  return h;
}

function pruneCache() {
  if (cache.size <= MAX_CACHE) return;
  const oldest = [...cache.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, cache.size - MAX_CACHE);
  for (const [k] of oldest) cache.delete(k);
}

export function isTokenConfigured(): boolean {
  return TOKEN.length > 0;
}

export function baseUrl(): string {
  return BASE_URL;
}

async function request<T>(method: 'GET' | 'POST', path: string, opts: { body?: unknown; cacheable?: boolean } = {}): Promise<ClResult<T>> {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
  const started = Date.now();
  const key = `${method} ${url} ${opts.body ? JSON.stringify(opts.body) : ''}`;

  if (method === 'GET' && opts.cacheable !== false) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
      return { ok: hit.status >= 200 && hit.status < 300, status: hit.status, data: hit.data as T, error: null, cached: true, tookMs: 0, source: 'courtlistener', retrievedAt: new Date(hit.at).toISOString() };
    }
  }

  const maxAttempts = 2;
  let lastErr = 'unknown error';
  let status = 0;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await rateGate();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method,
        headers: { ...authHeaders(), ...(opts.body ? { 'Content-Type': 'application/json' } : {}) },
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        signal: controller.signal,
      });
      clearTimeout(timer);
      status = res.status;
      const text = await res.text();
      let data: unknown = null;
      try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text.slice(0, 500) }; }

      if (res.status === 429 || res.status >= 500) {
        lastErr = `CourtListener HTTP ${res.status}`;
        if (attempt < maxAttempts) { await new Promise((r) => setTimeout(r, 1500 * attempt)); continue; }
      }

      if (method === 'GET' && res.ok && opts.cacheable !== false) {
        cache.set(key, { at: Date.now(), status: res.status, data });
        pruneCache();
      }
      return {
        ok: res.ok,
        status: res.status,
        data: (res.ok ? data : null) as T,
        error: res.ok ? null : `CourtListener HTTP ${res.status}`,
        cached: false,
        tookMs: Date.now() - started,
        source: 'courtlistener',
        retrievedAt: new Date().toISOString(),
      };
    } catch (e) {
      clearTimeout(timer);
      lastErr = e instanceof Error ? (e.name === 'AbortError' ? `timeout after ${TIMEOUT_MS}ms` : e.message) : String(e);
      if (attempt < maxAttempts) { await new Promise((r) => setTimeout(r, 1000 * attempt)); continue; }
    }
  }
  return { ok: false, status, data: null, error: lastErr, cached: false, tookMs: Date.now() - started, source: 'courtlistener', retrievedAt: new Date().toISOString() };
}

export interface ClSearchParams {
  q: string;
  type?: 'o' | 'r' | 'p' | 'oa'; // opinions | RECAP dockets | people | oral args
  court?: string;
  pageSize?: number;
}

export function searchRaw(params: ClSearchParams): Promise<ClResult<{ count: number; next: string | null; results: unknown[] }>> {
  const qs = new URLSearchParams({ q: params.q, type: params.type || 'o' });
  if (params.court) qs.set('court', params.court);
  if (params.pageSize) qs.set('page_size', String(params.pageSize));
  return request('GET', `/search/?${qs.toString()}`);
}

export function getOpinion(id: string | number): Promise<ClResult<Record<string, unknown>>> {
  return request('GET', `/opinions/${id}/`);
}

export function getCluster(id: string | number): Promise<ClResult<Record<string, unknown>>> {
  return request('GET', `/clusters/${id}/`);
}

export function getDocket(id: string | number): Promise<ClResult<Record<string, unknown>>> {
  return request('GET', `/dockets/${id}/`);
}

export function citationLookup(text: string): Promise<ClResult<unknown>> {
  return request('POST', `/citation-lookup/`, { body: { text } });
}
