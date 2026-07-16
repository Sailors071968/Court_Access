// ============================================================================
// Program 140 — API Command Center provider catalog
// Declares every external/enterprise provider CourtAccess can integrate with,
// its category, the credential env var(s) it requires, and whether a real
// runtime verification is currently feasible in-process. Provider *status* is
// derived from credential presence only; *connectivity* is asserted only after
// a real check — otherwise it is UNKNOWN. Nothing here is fabricated.
// ============================================================================

export type ProviderCategory =
  | 'ai' | 'litigation-data' | 'geo' | 'communications' | 'payments'
  | 'cloud' | 'datastore' | 'devops';

export interface ProviderCatalogEntry {
  id: string;
  label: string;
  category: ProviderCategory;
  envVars: string[];
  /** True when the backend can verify connectivity in-process (no external key needed). */
  runtimeCheckable: boolean;
  docNote?: string;
}

export const PROVIDER_CATALOG: readonly ProviderCatalogEntry[] = [
  // AI providers (detailed status also comes from the AI provider registry).
  { id: 'openai', label: 'OpenAI', category: 'ai', envVars: ['OPENAI_API_KEY'], runtimeCheckable: false },
  { id: 'anthropic', label: 'Anthropic', category: 'ai', envVars: ['ANTHROPIC_API_KEY'], runtimeCheckable: false },
  { id: 'gemini', label: 'Google Gemini', category: 'ai', envVars: ['GEMINI_API_KEY'], runtimeCheckable: false },
  { id: 'perplexity', label: 'Perplexity', category: 'ai', envVars: ['PERPLEXITY_API_KEY'], runtimeCheckable: false },
  { id: 'local-model', label: 'Local / Self-Hosted Model', category: 'ai', envVars: ['LOCAL_MODEL_URL'], runtimeCheckable: false },

  // Litigation data sources.
  { id: 'courtlistener', label: 'CourtListener', category: 'litigation-data', envVars: ['COURTLISTENER_API_KEY'], runtimeCheckable: false },
  { id: 'cap', label: 'Harvard Caselaw Access Project', category: 'litigation-data', envVars: ['CAP_API_KEY'], runtimeCheckable: false },
  { id: 'openlaws', label: 'OpenLaws', category: 'litigation-data', envVars: ['OPENLAWS_API_KEY'], runtimeCheckable: false },

  // Geospatial.
  { id: 'google-maps', label: 'Google Maps', category: 'geo', envVars: ['GOOGLE_MAPS_API_KEY'], runtimeCheckable: false },
  { id: 'google-streetview', label: 'Google Street View', category: 'geo', envVars: ['GOOGLE_MAPS_API_KEY', 'GOOGLE_STREETVIEW_API_KEY'], runtimeCheckable: false },
  { id: 'google-places', label: 'Google Places', category: 'geo', envVars: ['GOOGLE_MAPS_API_KEY', 'GOOGLE_PLACES_API_KEY'], runtimeCheckable: false },

  // Communications.
  { id: 'twilio', label: 'Twilio', category: 'communications', envVars: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN'], runtimeCheckable: false },
  { id: 'resend', label: 'Resend', category: 'communications', envVars: ['RESEND_API_KEY'], runtimeCheckable: false },

  // Payments.
  { id: 'stripe', label: 'Stripe', category: 'payments', envVars: ['STRIPE_SECRET_KEY'], runtimeCheckable: false },

  // Cloud.
  { id: 'aws', label: 'AWS', category: 'cloud', envVars: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'], runtimeCheckable: false },
  { id: 'cloudflare', label: 'Cloudflare', category: 'cloud', envVars: ['CLOUDFLARE_API_TOKEN'], runtimeCheckable: false },

  // Datastores (runtime-verifiable in-process via deep health check).
  { id: 'postgres', label: 'PostgreSQL', category: 'datastore', envVars: ['DATABASE_URL'], runtimeCheckable: true },
  { id: 'redis', label: 'Redis', category: 'datastore', envVars: ['REDIS_URL'], runtimeCheckable: true },
  { id: 'neo4j', label: 'Neo4j', category: 'datastore', envVars: ['NEO4J_URI'], runtimeCheckable: true },
  { id: 'prisma', label: 'Prisma ORM', category: 'datastore', envVars: ['DATABASE_URL'], runtimeCheckable: true },

  // DevOps.
  { id: 'github', label: 'GitHub', category: 'devops', envVars: ['GITHUB_TOKEN'], runtimeCheckable: false },
  { id: 'github-actions', label: 'GitHub Actions', category: 'devops', envVars: ['GITHUB_TOKEN'], runtimeCheckable: false },
] as const;

export type ProviderConnectivity = 'verified' | 'unavailable' | 'not_configured' | 'unknown';

export function credentialPresent(entry: ProviderCatalogEntry, env: NodeJS.ProcessEnv = process.env): boolean {
  return entry.envVars.every((v) => {
    const value = env[v];
    return value !== undefined && value.trim().length > 0;
  });
}
