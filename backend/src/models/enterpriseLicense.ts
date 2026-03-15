// ============================================================================
// CourtAccess — Enterprise License Model
// Phase 210: Enterprise licensing for government and institutional deployment
// Now persisted to PostgreSQL via Prisma (replaces in-memory array).
// ============================================================================

import prisma from '../lib/prisma.js';

// ---------------------------------------------------------------------------
// Types (kept for backward compatibility with existing route handlers)
// ---------------------------------------------------------------------------

export interface EnterpriseLicense {
  licenseId: string;
  organizationName: string;
  agencyType: 'district_attorney' | 'public_defender' | 'defense_firm' | 'state_agency' | 'federal_defender' | 'investigation_agency' | 'other';
  seatCount: number;
  licenseStart: string;
  licenseEnd: string;
  billingTier: 'starter' | 'professional' | 'enterprise' | 'government';
  status: 'active' | 'expired' | 'suspended' | 'pending';
  adminEmail: string;
  county?: string;
  state?: string;
  createdAt: string;
  updatedAt: string;
}

type LicenseAgencyType = EnterpriseLicense['agencyType'];
type LicenseBillingTier = EnterpriseLicense['billingTier'];
type LicenseStatus = EnterpriseLicense['status'];

// ---------------------------------------------------------------------------
// Prisma row → interface mapper
// ---------------------------------------------------------------------------

function toEnterpriseLicense(row: {
  id: string;
  organizationName: string;
  agencyType: string;
  seatCount: number;
  licenseStart: Date;
  licenseEnd: Date;
  billingTier: string;
  status: string;
  adminEmail: string;
  county: string | null;
  state: string | null;
  createdAt: Date;
  updatedAt: Date;
}): EnterpriseLicense {
  return {
    licenseId: row.id,
    organizationName: row.organizationName,
    agencyType: row.agencyType as LicenseAgencyType,
    seatCount: row.seatCount,
    licenseStart: row.licenseStart.toISOString(),
    licenseEnd: row.licenseEnd.toISOString(),
    billingTier: row.billingTier as LicenseBillingTier,
    status: row.status as LicenseStatus,
    adminEmail: row.adminEmail,
    county: row.county ?? undefined,
    state: row.state ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// CRUD — persisted to PostgreSQL via Prisma
// ---------------------------------------------------------------------------

export async function createEnterpriseLicense(data: Omit<EnterpriseLicense, 'licenseId' | 'createdAt' | 'updatedAt' | 'status'>): Promise<EnterpriseLicense> {
  const row = await prisma.enterpriseLicense.create({
    data: {
      organizationName: data.organizationName,
      agencyType: data.agencyType,
      seatCount: data.seatCount,
      licenseStart: new Date(data.licenseStart),
      licenseEnd: new Date(data.licenseEnd),
      billingTier: data.billingTier,
      adminEmail: data.adminEmail,
      county: data.county ?? null,
      state: data.state ?? null,
    },
  });
  return toEnterpriseLicense(row);
}

export async function getEnterpriseLicenses(): Promise<EnterpriseLicense[]> {
  const rows = await prisma.enterpriseLicense.findMany({ orderBy: { createdAt: 'desc' } });
  return rows.map(toEnterpriseLicense);
}

export async function getEnterpriseLicenseById(licenseId: string): Promise<EnterpriseLicense | undefined> {
  const row = await prisma.enterpriseLicense.findUnique({ where: { id: licenseId } });
  return row ? toEnterpriseLicense(row) : undefined;
}

export async function updateEnterpriseLicenseStatus(licenseId: string, status: LicenseStatus): Promise<EnterpriseLicense | undefined> {
  try {
    const row = await prisma.enterpriseLicense.update({
      where: { id: licenseId },
      data: { status },
    });
    return toEnterpriseLicense(row);
  } catch {
    return undefined;
  }
}
