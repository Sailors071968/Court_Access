// ============================================
// Court Access — Canonical Agency Model (Phase 1)
// Multi-tenant agency/organization entity.
// ============================================

// ---------------------------------------------------------------------------
// Agency tier (maps to subscription/pricing)
// ---------------------------------------------------------------------------

export type AgencyTier = 'free' | 'professional' | 'enterprise';

// ---------------------------------------------------------------------------
// Agency Entity
// ---------------------------------------------------------------------------

/**
 * Canonical Agency entity.
 * Represents a tenant organization (law firm, public defender office, etc.).
 * All tables reference tenantId which maps to AgencyEntity.id.
 */
export interface AgencyEntity {
  id: string;
  name: string;
  tier: AgencyTier;
  jurisdiction: string;
  contactEmail: string;
  maxUsers: number;
  maxCases: number;
  isActive: boolean;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}
