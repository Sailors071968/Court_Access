// ============================================================================
// Administration → Provider Integrations
// A single in-app place to see the status/health/capabilities of every external
// provider. Status is derived from REAL signals: the live provider registry for
// legal-intelligence sources, environment-variable presence for infrastructure
// and service providers, and live connectivity tests where safe.
//
// SECURITY: secret values are NEVER returned. Only a boolean "configured" flag
// (derived from env presence) and non-secret metadata (base URL, env var names)
// are exposed.
// ============================================================================

import type { FastifyInstance, FastifyReply } from 'fastify';
import type { AuthenticatedRequest } from '../security/authMiddleware.js';
import prisma from '../lib/prisma.js';
import { providerRegistry } from '../providers/registry.js';
import { registerAllProviders } from '../providers/index.js';
import { logSecurityEvent } from '../security/authMiddleware.js';
import { encryptSecret, decryptSecret, maskSecret } from './integrationCrypto.js';

/**
 * Resolve effective config for a provider: a stored (encrypted) app setting
 * overrides the environment. Secret values stay server-side.
 */
async function resolveSetting(providerId: string) {
  try {
    return await prisma.integrationSetting.findUnique({ where: { providerId } });
  } catch {
    return null;
  }
}

type Category = 'Legal Intelligence' | 'AI' | 'Payments' | 'Messaging' | 'Infrastructure' | 'Storage' | 'Developer' | 'Observability';

interface CatalogEntry {
  id: string;
  name: string;
  category: Category;
  description: string;
  docsUrl?: string;
  baseUrlEnv?: string;
  defaultBaseUrl?: string;
  /** Env vars that must be present for this integration to be considered configured. */
  requiredEnv: string[];
  /** Optional (secret) env vars — presence reported but not required. */
  optionalEnv?: string[];
  /** If backed by the live provider registry, its provider id. */
  registryId?: string;
}

// Infrastructure / service providers not covered by the legal provider registry.
const CATALOG: CatalogEntry[] = [
  { id: 'courtlistener', name: 'CourtListener', category: 'Legal Intelligence', description: 'Federal & state case law, opinions, dockets (Free Law Project).', docsUrl: 'https://www.courtlistener.com/help/api/rest/', requiredEnv: [], optionalEnv: ['COURTLISTENER_API_TOKEN'], registryId: 'courtlistener' },
  { id: 'cap', name: 'Harvard Caselaw Access Project (CAP)', category: 'Legal Intelligence', description: 'Historical U.S. case law corpus.', docsUrl: 'https://case.law/', requiredEnv: [], optionalEnv: ['CAP_API_KEY'], registryId: 'cap' },
  { id: 'openlaws', name: 'OpenLaws', category: 'Legal Intelligence', description: 'Structured statutes & regulations.', docsUrl: 'https://openlaws.us/', requiredEnv: [], optionalEnv: ['OPENLAWS_API_KEY'], registryId: 'openlaws' },
  { id: 'california-legislative', name: 'California Repository', category: 'Legal Intelligence', description: 'Hash-verified California codes & sections (local repository).', requiredEnv: [], registryId: 'california-legislative' },
  { id: 'calcrim', name: 'CALCRIM', category: 'Legal Intelligence', description: 'California criminal jury instructions.', requiredEnv: [], registryId: 'calcrim' },
  { id: 'openai', name: 'OpenAI', category: 'AI', description: 'GPT models for drafting & analysis.', docsUrl: 'https://platform.openai.com/docs', defaultBaseUrl: 'https://api.openai.com/v1', requiredEnv: ['OPENAI_API_KEY'] },
  { id: 'anthropic', name: 'Anthropic', category: 'AI', description: 'Claude models for legal reasoning.', docsUrl: 'https://docs.anthropic.com', defaultBaseUrl: 'https://api.anthropic.com', requiredEnv: ['ANTHROPIC_API_KEY'] },
  { id: 'gemini', name: 'Google Gemini', category: 'AI', description: 'Gemini models.', docsUrl: 'https://ai.google.dev/', requiredEnv: ['GEMINI_API_KEY'] },
  { id: 'ocr', name: 'OCR (Textract / Tesseract)', category: 'AI', description: 'Document text extraction pipeline.', requiredEnv: [], optionalEnv: ['AWS_ACCESS_KEY_ID'] },
  { id: 'stripe', name: 'Stripe', category: 'Payments', description: 'Subscriptions & billing.', docsUrl: 'https://stripe.com/docs/api', defaultBaseUrl: 'https://api.stripe.com', requiredEnv: ['STRIPE_SECRET_KEY'], optionalEnv: ['STRIPE_WEBHOOK_SECRET'] },
  { id: 'twilio', name: 'Twilio', category: 'Messaging', description: 'SMS notifications.', docsUrl: 'https://www.twilio.com/docs', requiredEnv: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN'] },
  { id: 'resend', name: 'Resend', category: 'Messaging', description: 'Transactional email delivery.', docsUrl: 'https://resend.com/docs', requiredEnv: ['RESEND_API_KEY'] },
  { id: 'aws', name: 'AWS', category: 'Storage', description: 'SES email, Textract OCR, S3 storage.', docsUrl: 'https://docs.aws.amazon.com', requiredEnv: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'], optionalEnv: ['AWS_REGION'] },
  { id: 'cloudflare', name: 'Cloudflare R2', category: 'Storage', description: 'Evidence object storage (R2).', docsUrl: 'https://developers.cloudflare.com/r2/', requiredEnv: ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'] },
  { id: 'redis', name: 'Redis', category: 'Infrastructure', description: 'BullMQ queues & caching.', defaultBaseUrl: 'redis://localhost:6379', requiredEnv: ['REDIS_URL'] },
  { id: 'postgres', name: 'PostgreSQL', category: 'Infrastructure', description: 'Primary application database.', requiredEnv: ['DATABASE_URL'] },
  { id: 'websearch', name: 'Web Search', category: 'Developer', description: 'External web search for research.', requiredEnv: [], optionalEnv: ['WEB_SEARCH_API_KEY'] },
  { id: 'github', name: 'GitHub', category: 'Developer', description: 'Source control & CI integration.', docsUrl: 'https://docs.github.com/rest', requiredEnv: [], optionalEnv: ['GITHUB_TOKEN'] },
  { id: 'logging', name: 'Logging', category: 'Observability', description: 'Structured application logging (pino).', requiredEnv: [] },
  { id: 'monitoring', name: 'Monitoring', category: 'Observability', description: 'Health, queue backpressure & metrics.', requiredEnv: [] },
];

function envPresent(names: string[]): boolean {
  return names.length > 0 && names.every((n) => !!process.env[n] && process.env[n] !== '');
}

function maskedHint(names: string[]): string | null {
  const first = names.find((n) => process.env[n]);
  if (!first) return null;
  const v = process.env[first] ?? '';
  if (v.length <= 4) return '••••';
  return `••••••••${v.slice(-4)}`;
}

async function buildEntry(e: CatalogEntry) {
  const reg = e.registryId ? providerRegistry.get(e.registryId) : null;
  const setting = await resolveSetting(e.id);
  const dbKey = setting?.apiKeyEnc ? safeDecrypt(setting.apiKeyEnc) : '';
  const envConfigured = e.requiredEnv.length === 0 ? true : envPresent(e.requiredEnv);
  const envSecret = envPresent([...(e.optionalEnv ?? []), ...e.requiredEnv].filter(Boolean));
  const requiredConfigured = !!dbKey || envConfigured;
  const hasSecret = !!dbKey || envSecret;
  const source: 'app' | 'environment' | 'none' = dbKey ? 'app' : envSecret ? 'environment' : 'none';
  const credentialHint = dbKey ? maskSecret(dbKey) : maskedHint([...e.requiredEnv, ...(e.optionalEnv ?? [])]);
  const baseUrl = setting?.baseUrl || (e.baseUrlEnv && process.env[e.baseUrlEnv]) || e.defaultBaseUrl || null;

  let status: 'online' | 'configured' | 'not_configured' | 'degraded' | 'unknown' = requiredConfigured ? 'configured' : 'not_configured';
  let capabilities: string[] = [];
  let rateLimits: unknown = null;
  let health: unknown = null;

  if (setting && setting.enabled === false) status = 'not_configured';

  if (reg) {
    try {
      const caps = reg.capabilities();
      capabilities = Object.entries(caps).filter(([, v]) => v).map(([k]) => k);
      rateLimits = reg.rateLimits();
      const h = await reg.health();
      health = h;
      status = h.status === 'online' ? 'online' : h.status === 'degraded' ? 'degraded' : h.status === 'offline' ? 'not_configured' : 'unknown';
    } catch {
      status = 'unknown';
    }
  }

  return {
    id: e.id,
    name: e.name,
    category: e.category,
    description: e.description,
    docsUrl: e.docsUrl ?? (reg?.documentationUrl),
    baseUrl,
    requiredEnv: e.requiredEnv,
    optionalEnv: e.optionalEnv ?? [],
    configured: requiredConfigured && (e.requiredEnv.length > 0 || hasSecret || !!reg),
    hasCredential: hasSecret,
    credentialHint,
    source,
    enabled: setting?.enabled ?? true,
    editable: true,
    lastSuccessAt: setting?.lastSuccessAt ?? null,
    rotatedAt: setting?.rotatedAt ?? null,
    status,
    capabilities,
    rateLimits,
    health,
    lastCheckedAt: new Date().toISOString(),
  };
}

function safeDecrypt(enc: string): string {
  try { return decryptSecret(enc); } catch { return ''; }
}

export async function registerIntegrationRoutes(app: FastifyInstance): Promise<void> {
  registerAllProviders();

  // GET /api/admin/integrations — full catalog with real status
  app.get('/api/admin/integrations', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const entries = await Promise.all(CATALOG.map(buildEntry));
    const online = entries.filter((e) => e.status === 'online').length;
    const configured = entries.filter((e) => e.configured).length;
    return reply.send({
      checkedAt: new Date().toISOString(),
      total: entries.length,
      configured,
      online,
      integrations: entries,
    });
  });

  // GET /api/admin/integrations/:id — single integration detail
  app.get('/api/admin/integrations/:id', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const e = CATALOG.find((c) => c.id === id);
    if (!e) return reply.code(404).send({ error: 'Integration not found' });
    return reply.send(await buildEntry(e));
  });

  // PUT /api/admin/integrations/:id — save config (base URL, API key, enabled)
  app.put('/api/admin/integrations/:id', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const e = CATALOG.find((c) => c.id === id);
    if (!e) return reply.code(404).send({ error: 'Integration not found' });
    const body = request.body as { baseUrl?: string; apiKey?: string; enabled?: boolean; clearKey?: boolean };

    const data: Record<string, unknown> = {};
    if (body.baseUrl !== undefined) data.baseUrl = body.baseUrl.trim() || null;
    if (body.enabled !== undefined) data.enabled = !!body.enabled;
    if (body.clearKey) {
      data.apiKeyEnc = null;
    } else if (typeof body.apiKey === 'string' && body.apiKey.trim() !== '') {
      data.apiKeyEnc = encryptSecret(body.apiKey.trim());
    }
    if (Object.keys(data).length === 0) return reply.code(400).send({ error: 'No changes provided' });

    await prisma.integrationSetting.upsert({
      where: { providerId: id },
      create: { providerId: id, updatedById: request.user?.userId ?? null, ...data },
      update: { updatedById: request.user?.userId ?? null, ...data },
    });
    const changed = Object.keys(data).map((k) => (k === 'apiKeyEnc' ? (body.clearKey ? 'apiKey=cleared' : 'apiKey=set') : `${k}`)).join(' ');
    void logSecurityEvent('INTEGRATION_CONFIG_UPDATED', request.user?.userId, request.ip, `${id} ${changed}`);
    return reply.send(await buildEntry(e));
  });

  // POST /api/admin/integrations/:id/rotate — rotate the stored secret
  app.post('/api/admin/integrations/:id/rotate', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const e = CATALOG.find((c) => c.id === id);
    if (!e) return reply.code(404).send({ error: 'Integration not found' });
    const body = request.body as { apiKey?: string };
    if (!body.apiKey || body.apiKey.trim() === '') return reply.code(400).send({ error: 'A new API key/secret is required to rotate' });
    await prisma.integrationSetting.upsert({
      where: { providerId: id },
      create: { providerId: id, apiKeyEnc: encryptSecret(body.apiKey.trim()), rotatedAt: new Date(), lastSuccessAt: null, updatedById: request.user?.userId ?? null },
      update: { apiKeyEnc: encryptSecret(body.apiKey.trim()), rotatedAt: new Date(), lastSuccessAt: null, updatedById: request.user?.userId ?? null },
    });
    void logSecurityEvent('INTEGRATION_SECRET_ROTATED', request.user?.userId, request.ip, id);
    return reply.send(await buildEntry(e));
  });

  // POST /api/admin/integrations/:id/test — live connectivity test where safe
  app.post('/api/admin/integrations/:id/test', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const e = CATALOG.find((c) => c.id === id);
    if (!e) return reply.code(404).send({ error: 'Integration not found' });
    const startedAt = Date.now();

    const result = await runTest(e, id);
    result.latencyMs = Date.now() - startedAt;

    // Persist the outcome so "last successful connection" is real.
    try {
      await prisma.integrationSetting.upsert({
        where: { providerId: id },
        create: { providerId: id, lastTestAt: new Date(), lastTestStatus: result.status, lastSuccessAt: result.ok ? new Date() : null },
        update: { lastTestAt: new Date(), lastTestStatus: result.status, ...(result.ok ? { lastSuccessAt: new Date() } : {}) },
      });
    } catch { /* non-fatal */ }

    return reply.send({ id, ...result });
  });
}

async function runTest(e: CatalogEntry, id: string): Promise<{ ok: boolean; status: string; detail: string | null; latencyMs: number }> {
  // Legal providers: live registry health probe.
  if (e.registryId) {
    const reg = providerRegistry.get(e.registryId);
    if (reg) {
      try {
        const h = await reg.health();
        return { ok: h.status === 'online' || h.status === 'degraded', status: h.status, detail: h.detail ?? null, latencyMs: 0 };
      } catch (err) {
        return { ok: false, status: 'error', detail: err instanceof Error ? err.message : 'health check failed', latencyMs: 0 };
      }
    }
  }

  // PostgreSQL: real query.
  if (id === 'postgres') {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { ok: true, status: 'online', detail: 'SELECT 1 succeeded', latencyMs: 0 };
    } catch (err) {
      return { ok: false, status: 'offline', detail: err instanceof Error ? err.message : 'query failed', latencyMs: 0 };
    }
  }

  // Redis: best-effort ping.
  if (id === 'redis') {
    if (!process.env.REDIS_URL) return { ok: false, status: 'not_configured', detail: 'REDIS_URL not set', latencyMs: 0 };
    try {
      const IORedis = (await import('ioredis')).default;
      const client = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, lazyConnect: true, connectTimeout: 3000 });
      await client.connect();
      const pong = await client.ping();
      client.disconnect();
      return { ok: pong === 'PONG', status: 'online', detail: `PING → ${pong}`, latencyMs: 0 };
    } catch (err) {
      return { ok: false, status: 'unknown', detail: err instanceof Error ? err.message : 'ping failed', latencyMs: 0 };
    }
  }

  // Other providers: honest configuration check (app-stored key or env presence).
  const setting = await resolveSetting(id);
  const dbKey = setting?.apiKeyEnc ? safeDecrypt(setting.apiKeyEnc) : '';
  const configured = !!dbKey || (e.requiredEnv.length === 0 ? envPresent(e.optionalEnv ?? []) : envPresent(e.requiredEnv));
  return {
    ok: configured,
    status: configured ? 'configured' : 'not_configured',
    detail: configured ? (dbKey ? 'Credentials stored in application.' : 'Credentials present in environment.') : `Missing: ${e.requiredEnv.filter((n) => !process.env[n]).join(', ') || 'credentials'}`,
    latencyMs: 0,
  };
}
