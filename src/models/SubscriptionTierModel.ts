// ============================================
// Court Access — Subscription Tier Model (Phase 12)
// Hybrid Pricing + Deterministic Archive Module
//
// Static deterministic tier configuration.
// No dynamic pricing. No floating point. No runtime mutation.
//
// Architectural boundary:
//   - Does NOT import exportEngine
//   - Does NOT import anchorIntegrationEngine
//   - Does NOT import issueIndexEngine
//   - Does NOT import officerIndexEngine
//   - No circular dependencies
//
// Constitutional boundaries:
//   - No probability
//   - No scoring
//   - No randomness
//   - No Date.now
//   - No localeCompare
//   - No floating point (all monetary values in integer cents)
//   - No runtime mutation of tier configuration
//   - No dynamic pricing
// ============================================

// ---------------------------------------------------------------------------
// Subscription Tier Identifier
// ---------------------------------------------------------------------------

/**
 * Subscription tier identifiers.
 * Fixed set. Additive-only — new tiers may be added, none removed.
 */
export type SubscriptionTierId =
  | 'FREE'
  | 'STARTER'
  | 'PROFESSIONAL'
  | 'ADVANCED_INVESTIGATOR'
  | 'LITIGATION_INTELLIGENCE_PRO'
  | 'ENTERPRISE_FIRM'
  // Legacy IDs (kept for backward compatibility)
  | 'TIER_2'
  | 'TIER_3'
  | 'TIER_4'
  | 'TIER_5'
  | 'TIER_6'
  | 'TIER_7';

// ---------------------------------------------------------------------------
// Subscription Tier Configuration
// ---------------------------------------------------------------------------

/**
 * Static configuration for a subscription tier.
 *
 * All monetary values are in integer cents (no floating point).
 * All size limits are in integer megabytes.
 * All time limits are in integer days.
 *
 * This structure is immutable at runtime.
 * Tier configuration is static and deterministic.
 */
export interface SubscriptionTierConfig {
  id: SubscriptionTierId;
  name: string;
  maxUploadMB: number;                // Integer — maximum upload size in MB
  archiveEligible: boolean;           // Whether this tier supports archival
  retentionDays: number;              // Integer — document retention in days
  watermarkExport: boolean;           // Whether exports are watermarked
  creditPriceCents: number;           // Integer — price per credit in cents (USD)
  monthlyPageLimit: number;           // Pages per month (cumulative across cases)
  monthlyAiCredits: number;           // AI credits per month
  monthlyPriceCents: number;          // Monthly subscription price in cents
  isLifetime: boolean;                // True for free tier (lifetime limit)
}

// ---------------------------------------------------------------------------
// Static Tier Registry — deterministic, immutable at runtime
// ---------------------------------------------------------------------------

/**
 * Static tier configuration registry.
 *
 * Rules:
 *   - All values are deterministic constants
 *   - No floating point — all monetary values in integer cents
 *   - No dynamic computation — all values are static
 *   - No runtime mutation — this array is frozen
 *   - Additive-only — new tiers may be appended, none removed
 *   - Sorted by tier order (FREE first, ascending)
 *
 * Tier hierarchy:
 *   FREE    — limited, no archive, watermarked, 90-day retention
 *   TIER_2  — basic paid tier
 *   TIER_3  — standard tier
 *   TIER_4  — professional tier
 *   TIER_5  — enterprise tier
 *   TIER_6  — premium enterprise
 *   TIER_7  — unlimited enterprise
 */
const SUBSCRIPTION_TIER_CONFIGS: readonly SubscriptionTierConfig[] = Object.freeze([
  {
    id: 'FREE',
    name: 'Free',
    maxUploadMB: 50,
    archiveEligible: false,
    retentionDays: 90,
    watermarkExport: true,
    creditPriceCents: 0,
    monthlyPageLimit: 10,
    monthlyAiCredits: 0,
    monthlyPriceCents: 0,
    isLifetime: true,
  },
  {
    id: 'STARTER',
    name: 'Starter',
    maxUploadMB: 200,
    archiveEligible: true,
    retentionDays: 365,
    watermarkExport: true,
    creditPriceCents: 500,
    monthlyPageLimit: 300,
    monthlyAiCredits: 20,
    monthlyPriceCents: 3900,
    isLifetime: false,
  },
  {
    id: 'PROFESSIONAL',
    name: 'Professional',
    maxUploadMB: 500,
    archiveEligible: true,
    retentionDays: 730,
    watermarkExport: false,
    creditPriceCents: 1000,
    monthlyPageLimit: 2000,
    monthlyAiCredits: 100,
    monthlyPriceCents: 12900,
    isLifetime: false,
  },
  {
    id: 'ADVANCED_INVESTIGATOR',
    name: 'Advanced Investigator',
    maxUploadMB: 1000,
    archiveEligible: true,
    retentionDays: 1095,
    watermarkExport: false,
    creditPriceCents: 2500,
    monthlyPageLimit: 6000,
    monthlyAiCredits: 250,
    monthlyPriceCents: 24900,
    isLifetime: false,
  },
  {
    id: 'LITIGATION_INTELLIGENCE_PRO',
    name: 'Litigation Intelligence Pro',
    maxUploadMB: 2000,
    archiveEligible: true,
    retentionDays: 1825,
    watermarkExport: false,
    creditPriceCents: 5000,
    monthlyPageLimit: 12000,
    monthlyAiCredits: 500,
    monthlyPriceCents: 39900,
    isLifetime: false,
  },
  {
    id: 'ENTERPRISE_FIRM',
    name: 'Enterprise Firm',
    maxUploadMB: 5000,
    archiveEligible: true,
    retentionDays: 3650,
    watermarkExport: false,
    creditPriceCents: 10000,
    monthlyPageLimit: 25000,
    monthlyAiCredits: 1500,
    monthlyPriceCents: 69900,
    isLifetime: false,
  },
  // Legacy TIER_7 preserved with original maxUploadMB: 10000 to avoid
  // downgrading existing Unlimited Enterprise users.
  {
    id: 'TIER_7',
    name: 'Unlimited Enterprise (Legacy)',
    maxUploadMB: 10000,
    archiveEligible: true,
    retentionDays: 3650,
    watermarkExport: false,
    creditPriceCents: 25000,
    monthlyPageLimit: 25000,
    monthlyAiCredits: 1500,
    monthlyPriceCents: 69900,
    isLifetime: false,
  },
] as SubscriptionTierConfig[]);

// ---------------------------------------------------------------------------
// Legacy Tier Mapping — maps old TIER_N IDs to new named IDs
// ---------------------------------------------------------------------------

const LEGACY_TIER_MAP: Readonly<Record<string, SubscriptionTierId>> = Object.freeze({
  TIER_2: 'STARTER',
  TIER_3: 'PROFESSIONAL',
  TIER_4: 'ADVANCED_INVESTIGATOR',
  TIER_5: 'LITIGATION_INTELLIGENCE_PRO',
  TIER_6: 'ENTERPRISE_FIRM',
  // TIER_7 is a first-class entry in SUBSCRIPTION_TIER_CONFIGS (maxUploadMB: 10000)
  // so it resolves directly and does not need a mapping here.
});

// ---------------------------------------------------------------------------
// Tier Access Functions — read-only
// ---------------------------------------------------------------------------

/**
 * Get the full tier configuration registry.
 * Returns a frozen readonly array — no mutation possible.
 */
export function getSubscriptionTierRegistry(): readonly SubscriptionTierConfig[] {
  return SUBSCRIPTION_TIER_CONFIGS;
}

/**
 * Get a specific tier configuration by ID.
 * Returns null if the tier ID is not registered.
 * Supports legacy TIER_2–TIER_7 IDs via mapping to new named tiers.
 */
export function getSubscriptionTierById(
  tierId: SubscriptionTierId
): SubscriptionTierConfig | null {
  for (const tier of SUBSCRIPTION_TIER_CONFIGS) {
    if (tier.id === tierId) {
      return tier;
    }
  }
  // Check legacy tier mapping
  const mappedId = LEGACY_TIER_MAP[tierId];
  if (mappedId) {
    for (const tier of SUBSCRIPTION_TIER_CONFIGS) {
      if (tier.id === mappedId) {
        return tier;
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Tenant Subscription Entity
// ---------------------------------------------------------------------------

/**
 * A tenant's active subscription record.
 *
 * Immutable once created. Subscription changes produce new records
 * (append-only ledger pattern — old records are never mutated).
 */
export interface TenantSubscriptionEntity {
  tenantId: string;
  tierId: SubscriptionTierId;
  activatedAt: string;                  // ISO 8601 UTC — deterministic input, not Date.now()
  creditBalance: number;                // Integer — current credit balance
}
