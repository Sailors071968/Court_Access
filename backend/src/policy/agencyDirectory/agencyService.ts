// ============================================
// Court Access — Agency Directory Service
// CRUD operations for the Agency table.
// ============================================

import { PrismaClient } from '@prisma/client';
import type {
  AgencyRecord,
  AgencyFilter,
  PaginatedAgencyResult,
  CreateAgencyInput,
  UpdateAgencyInput,
  AgencyStats,
} from './types.js';

// ---------------------------------------------------------------------------
// Singleton Prisma Client
// ---------------------------------------------------------------------------

let prisma: PrismaClient | null = null;

function getPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}

// ---------------------------------------------------------------------------
// List Agencies (paginated, filterable, searchable)
// ---------------------------------------------------------------------------

export async function listAgencies(filter: AgencyFilter = {}): Promise<PaginatedAgencyResult> {
  const db = getPrisma();
  const page = filter.page ?? 1;
  const limit = filter.limit ?? 25;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};

  if (filter.county) {
    where.county = filter.county;
  }
  if (filter.agencyType) {
    where.agencyType = filter.agencyType;
  }
  if (filter.search) {
    where.OR = [
      { agencyName: { contains: filter.search, mode: 'insensitive' } },
      { city: { contains: filter.search, mode: 'insensitive' } },
      { county: { contains: filter.search, mode: 'insensitive' } },
    ];
  }

  const [agencies, total] = await Promise.all([
    db.agency.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ county: 'asc' }, { agencyName: 'asc' }],
    }),
    db.agency.count({ where }),
  ]);

  return {
    agencies: agencies as AgencyRecord[],
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

// ---------------------------------------------------------------------------
// Get Single Agency
// ---------------------------------------------------------------------------

export async function getAgencyById(id: string): Promise<AgencyRecord | null> {
  const db = getPrisma();
  const agency = await db.agency.findUnique({ where: { id } });
  return agency as AgencyRecord | null;
}

// ---------------------------------------------------------------------------
// Create Agency
// ---------------------------------------------------------------------------

export async function createAgency(input: CreateAgencyInput): Promise<AgencyRecord> {
  const db = getPrisma();
  const agency = await db.agency.create({
    data: {
      agencyName: input.agencyName,
      agencyType: input.agencyType,
      county: input.county,
      city: input.city ?? null,
      recordsEmail: input.recordsEmail ?? null,
      recordsRequestUrl: input.recordsRequestUrl ?? null,
      phoneNumber: input.phoneNumber ?? null,
      website: input.website ?? null,
      policyUrl: input.policyUrl ?? null,
      notes: input.notes ?? null,
    },
  });
  return agency as AgencyRecord;
}

// ---------------------------------------------------------------------------
// Update Agency
// ---------------------------------------------------------------------------

export async function updateAgency(id: string, input: UpdateAgencyInput): Promise<AgencyRecord> {
  const db = getPrisma();

  // Build update data — only include fields that are explicitly provided
  const data: Record<string, unknown> = {};
  if (input.agencyName !== undefined) data.agencyName = input.agencyName;
  if (input.agencyType !== undefined) data.agencyType = input.agencyType;
  if (input.county !== undefined) data.county = input.county;
  if (input.city !== undefined) data.city = input.city;
  if (input.recordsEmail !== undefined) data.recordsEmail = input.recordsEmail;
  if (input.recordsRequestUrl !== undefined) data.recordsRequestUrl = input.recordsRequestUrl;
  if (input.phoneNumber !== undefined) data.phoneNumber = input.phoneNumber;
  if (input.website !== undefined) data.website = input.website;
  if (input.policyUrl !== undefined) data.policyUrl = input.policyUrl;
  if (input.lastRequestSent !== undefined) data.lastRequestSent = input.lastRequestSent;
  if (input.lastResponse !== undefined) data.lastResponse = input.lastResponse;
  if (input.notes !== undefined) data.notes = input.notes;

  const agency = await db.agency.update({ where: { id }, data });
  return agency as AgencyRecord;
}

// ---------------------------------------------------------------------------
// Delete Agency
// ---------------------------------------------------------------------------

export async function deleteAgency(id: string): Promise<void> {
  const db = getPrisma();
  await db.agency.delete({ where: { id } });
}

// ---------------------------------------------------------------------------
// Get Agency Stats
// ---------------------------------------------------------------------------

export async function getAgencyStats(): Promise<AgencyStats> {
  const db = getPrisma();

  const [total, byTypeRaw, byCountyRaw, withEmail, withWebsite, withPolicyUrl] = await Promise.all([
    db.agency.count(),
    db.agency.groupBy({ by: ['agencyType'], _count: { id: true }, orderBy: { _count: { id: 'desc' } } }),
    db.agency.groupBy({ by: ['county'], _count: { id: true }, orderBy: { _count: { id: 'desc' } } }),
    db.agency.count({ where: { recordsEmail: { not: null } } }),
    db.agency.count({ where: { website: { not: null } } }),
    db.agency.count({ where: { policyUrl: { not: null } } }),
  ]);

  const byType: Record<string, number> = {};
  for (const row of byTypeRaw) {
    byType[row.agencyType] = row._count.id;
  }

  const byCounty = byCountyRaw.map((row) => ({
    county: row.county,
    count: row._count.id,
  }));

  return { total, byType, byCounty, withEmail, withWebsite, withPolicyUrl };
}

// ---------------------------------------------------------------------------
// Get Distinct Counties (for filter dropdown)
// ---------------------------------------------------------------------------

export async function getDistinctCounties(): Promise<string[]> {
  const db = getPrisma();
  const results = await db.agency.findMany({
    select: { county: true },
    distinct: ['county'],
    orderBy: { county: 'asc' },
  });
  return results.map((r) => r.county);
}
