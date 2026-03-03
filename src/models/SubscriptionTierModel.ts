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
  },
  {
    id: 'TIER_2',
    name: 'Basic',
    maxUploadMB: 200,
    archiveEligible: true,
    retentionDays: 365,
    watermarkExport: true,
    creditPriceCents: 500,
  },
  {
    id: 'TIER_3',
    name: 'Standard',
    maxUploadMB: 500,
    archiveEligible: true,
    retentionDays: 730,
    watermarkExport: false,
    creditPriceCents: 1000,
  },
  {
    id: 'TIER_4',
    name: 'Professional',
    maxUploadMB: 1000,
    archiveEligible: true,
    retentionDays: 1095,
    watermarkExport: false,
    creditPriceCents: 2500,
  },
  {
    id: 'TIER_5',
    name: 'Enterprise',
    maxUploadMB: 2000,
    archiveEligible: true,
    retentionDays: 1825,
    watermarkExport: false,
    creditPriceCents: 5000,
  },
  {
    id: 'TIER_6',
    name: 'Premium Enterprise',
    maxUploadMB: 5000,
    archiveEligible: true,
    retentionDays: 2555,
    watermarkExport: false,
    creditPriceCents: 10000,
  },
  {
    id: 'TIER_7',
    name: 'Unlimited Enterprise',
    maxUploadMB: 10000,
    archiveEligible: true,
    retentionDays: 3650,
    watermarkExport: false,
    creditPriceCents: 25000,
  },
] as SubscriptionTierConfig[]);

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
 */
export function getSubscriptionTierById(
  tierId: SubscriptionTierId
): SubscriptionTierConfig | null {
  for (const tier of SUBSCRIPTION_TIER_CONFIGS) {
    if (tier.id === tierId) {
      return tier;
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
