// ============================================================================
// CourtAccess — Enterprise License Model
// Phase 210: Enterprise licensing for government and institutional deployment
// ============================================================================

export interface EnterpriseLicense {
  licenseId: string;
  organizationName: string;
  agencyType: 'district_attorney' | 'public_defender' | 'defense_firm' | 'state_agency' | 'federal_defender' | 'investigation_agency' | 'other';
  seatCount: number;
  licenseStart: string; // ISO date
  licenseEnd: string;   // ISO date
  billingTier: 'starter' | 'professional' | 'enterprise' | 'government';
  status: 'active' | 'expired' | 'suspended' | 'pending';
  adminEmail: string;
  county?: string;
  state?: string;
  createdAt: string;
  updatedAt: string;
}

// In-memory store (production: migrate to PostgreSQL)
const licenses: EnterpriseLicense[] = [];

export function createEnterpriseLicense(data: Omit<EnterpriseLicense, 'licenseId' | 'createdAt' | 'updatedAt' | 'status'>): EnterpriseLicense {
  const license: EnterpriseLicense = {
    ...data,
    licenseId: crypto.randomUUID(),
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  licenses.push(license);
  return license;
}

export function getEnterpriseLicenses(): EnterpriseLicense[] {
  return [...licenses];
}

export function getEnterpriseLicenseById(licenseId: string): EnterpriseLicense | undefined {
  return licenses.find((l) => l.licenseId === licenseId);
}

export function updateEnterpriseLicenseStatus(licenseId: string, status: EnterpriseLicense['status']): EnterpriseLicense | undefined {
  const license = licenses.find((l) => l.licenseId === licenseId);
  if (license) {
    license.status = status;
    license.updatedAt = new Date().toISOString();
  }
  return license;
}
