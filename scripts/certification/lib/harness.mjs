// Shared helpers for the certification harness: HTTP client with timing,
// result accumulation, and report writing.

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const OUT_DIR = path.join(ROOT, 'reports/certification');
export const API = process.env.CERT_API_BASE || 'http://127.0.0.1:3001';

// Every API path this process touches, with ids collapsed back to :param, so
// suite reports can state exactly which routes they exercised instead of the
// master report having to guess from prose.
export const exercisedApiRoutes = new Set();
export const exercisedSpaRoutes = new Set();

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

export function normalisePath(url) {
  return url
    .split('?')[0]
    .replace(UUID_RE, ':id')
    .replace(/\/tenant-:id/g, '/:id');
}

export async function req(method, url, { token, body, headers = {}, raw, timeoutMs = 30000 } = {}) {
  exercisedApiRoutes.add(`${method.toUpperCase()} ${normalisePath(url)}`);
  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const init = { method, headers: { ...headers }, signal: controller.signal };
  if (token) init.headers.Authorization = `Bearer ${token}`;
  if (raw !== undefined) {
    init.body = raw;
  } else if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  try {
    const res = await fetch(`${API}${url}`, init);
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      /* non-JSON response body is kept as text */
    }
    return {
      ok: res.ok,
      status: res.status,
      json,
      text,
      ms: Math.round(performance.now() - started),
      headers: Object.fromEntries(res.headers.entries()),
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: err.name === 'AbortError' ? `timeout after ${timeoutMs}ms` : String(err),
      ms: Math.round(performance.now() - started),
    };
  } finally {
    clearTimeout(timer);
  }
}

export class Results {
  constructor(reportName, phase) {
    this.reportName = reportName;
    this.phase = phase;
    this.checks = [];
  }

  add(id, name, status, detail, evidence) {
    this.checks.push({ id, name, status, detail, evidence });
    const icon = { PASS: 'PASS', FAIL: 'FAIL', WARNING: 'WARN', UNKNOWN: 'UNKN' }[status] || status;
    console.log(`  [${icon}] ${id} ${name}${detail ? ` — ${detail}` : ''}`);
    return status;
  }

  pass(id, name, detail, evidence) {
    return this.add(id, name, 'PASS', detail, evidence);
  }
  fail(id, name, detail, evidence) {
    return this.add(id, name, 'FAIL', detail, evidence);
  }
  warn(id, name, detail, evidence) {
    return this.add(id, name, 'WARNING', detail, evidence);
  }
  unknown(id, name, detail, evidence) {
    return this.add(id, name, 'UNKNOWN', detail, evidence);
  }

  get summary() {
    const s = { total: this.checks.length, PASS: 0, FAIL: 0, WARNING: 0, UNKNOWN: 0 };
    for (const c of this.checks) s[c.status] = (s[c.status] || 0) + 1;
    s.passRate = s.total ? Math.round((s.PASS / s.total) * 1000) / 10 : 0;
    return s;
  }

  async write(extra = {}) {
    await mkdir(OUT_DIR, { recursive: true });
    const payload = {
      report: this.reportName,
      phase: this.phase,
      generatedAt: new Date().toISOString(),
      apiBase: API,
      summary: this.summary,
      exercisedApiRoutes: [...exercisedApiRoutes].sort(),
      exercisedSpaRoutes: [...exercisedSpaRoutes].sort(),
      ...extra,
      checks: this.checks,
    };
    const file = path.join(OUT_DIR, `${this.reportName}.json`);
    await writeFile(file, JSON.stringify(payload, null, 2));
    const s = this.summary;
    console.log(
      `\n${this.reportName}: ${s.PASS} PASS / ${s.FAIL} FAIL / ${s.WARNING} WARN / ${s.UNKNOWN} UNKNOWN (${s.passRate}%)`,
    );
    console.log(`Wrote ${file}`);
    return payload;
  }
}

let userSeq = 0;
export function uniqueEmail(prefix = 'cert') {
  userSeq += 1;
  return `${prefix}-${Date.now()}-${userSeq}-${Math.random().toString(36).slice(2, 8)}@certification.test`;
}

// Registers a user and returns { token, user, email, password }.
export async function registerUser(opts = {}) {
  const email = opts.email || uniqueEmail(opts.prefix);
  const password = opts.password || 'CertPass!2026xyz';
  const res = await req('POST', '/api/auth/register', {
    body: {
      name: opts.name || 'Certification User',
      email,
      password,
      defaultRole: opts.defaultRole || 'attorney',
      termsAccepted: true,
      privacyAccepted: true,
    },
  });
  return {
    ok: res.ok,
    status: res.status,
    raw: res,
    email,
    password,
    token: res.json?.accessToken,
    refreshToken: res.json?.refreshToken,
    user: res.json?.user,
  };
}

export async function login(email, password) {
  const res = await req('POST', '/api/auth/login', { body: { email, password } });
  return { ok: res.ok, status: res.status, raw: res, token: res.json?.accessToken, user: res.json?.user };
}
