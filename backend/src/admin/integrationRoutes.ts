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
  const requiredConfigured = e.requiredEnv.length === 0 ? true : envPresent(e.requiredEnv);
  const hasSecret = envPresent([...(e.optionalEnv ?? []), ...e.requiredEnv].filter(Boolean));

  let status: 'online' | 'configured' | 'not_configured' | 'degraded' | 'unknown' = requiredConfigured ? 'configured' : 'not_configured';
  let capabilities: string[] = [];
  let rateLimits: unknown = null;
  let health: unknown = null;

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
    baseUrl: (e.baseUrlEnv && process.env[e.baseUrlEnv]) || e.defaultBaseUrl || null,
    requiredEnv: e.requiredEnv,
    optionalEnv: e.optionalEnv ?? [],
    configured: requiredConfigured && (e.requiredEnv.length > 0 || hasSecret || !!reg),
    hasCredential: hasSecret,
    credentialHint: maskedHint([...e.requiredEnv, ...(e.optionalEnv ?? [])]),
    status,
    capabilities,
    rateLimits,
    health,
    lastCheckedAt: new Date().toISOString(),
  };
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

  // POST /api/admin/integrations/:id/test — live connectivity test where safe
  app.post('/api/admin/integrations/:id/test', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const e = CATALOG.find((c) => c.id === id);
    if (!e) return reply.code(404).send({ error: 'Integration not found' });
    const startedAt = Date.now();

    // Legal providers: use the live registry health probe.
    if (e.registryId) {
      const reg = providerRegistry.get(e.registryId);
      if (reg) {
        try {
          const h = await reg.health();
          return reply.send({ id, ok: h.status === 'online' || h.status === 'degraded', status: h.status, detail: h.detail ?? null, latencyMs: Date.now() - startedAt });
        } catch (err) {
          return reply.send({ id, ok: false, status: 'error', detail: err instanceof Error ? err.message : 'health check failed', latencyMs: Date.now() - startedAt });
        }
      }
    }

    // PostgreSQL: real query.
    if (id === 'postgres') {
      try {
        await prisma.$queryRaw`SELECT 1`;
        return reply.send({ id, ok: true, status: 'online', detail: 'SELECT 1 succeeded', latencyMs: Date.now() - startedAt });
      } catch (err) {
        return reply.send({ id, ok: false, status: 'offline', detail: err instanceof Error ? err.message : 'query failed', latencyMs: Date.now() - startedAt });
      }
    }

    // Redis: best-effort ping if a client is available.
    if (id === 'redis') {
      if (!process.env.REDIS_URL) return reply.send({ id, ok: false, status: 'not_configured', detail: 'REDIS_URL not set', latencyMs: Date.now() - startedAt });
      try {
        const IORedis = (await import('ioredis')).default;
        const client = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, lazyConnect: true, connectTimeout: 3000 });
        await client.connect();
        const pong = await client.ping();
        client.disconnect();
        return reply.send({ id, ok: pong === 'PONG', status: 'online', detail: `PING → ${pong}`, latencyMs: Date.now() - startedAt });
      } catch (err) {
        return reply.send({ id, ok: false, status: 'unknown', detail: err instanceof Error ? err.message : 'ping failed', latencyMs: Date.now() - startedAt });
      }
    }

    // Other providers: honest configuration check (no external call → no secret leakage/latency).
    const configured = e.requiredEnv.length === 0 ? envPresent(e.optionalEnv ?? []) : envPresent(e.requiredEnv);
    return reply.send({
      id,
      ok: configured,
      status: configured ? 'configured' : 'not_configured',
      detail: configured ? 'Credentials present in environment.' : `Missing: ${e.requiredEnv.filter((n) => !process.env[n]).join(', ') || 'credentials'}`,
      latencyMs: Date.now() - startedAt,
    });
  });
}
