// ============================================================================
// CourtAccess — Government Lead Model
// Phase 215: Government sales tracking for institutional outreach
// Now persisted to PostgreSQL via Prisma (replaces in-memory array).
// ============================================================================

import prisma from '../lib/prisma.js';

// ---------------------------------------------------------------------------
// Types (kept for backward compatibility with existing route handlers)
// ---------------------------------------------------------------------------

export interface GovernmentLead {
  id: string;
  agencyName: string;
  contactName: string;
  role: string;
  email: string;
  county: string;
  status: 'new' | 'contacted' | 'demo_scheduled' | 'demo_completed' | 'contract_discussion' | 'pilot_active' | 'closed_won' | 'closed_lost';
  notes: string;
  agencyType: string;
  seatEstimate: number;
  createdAt: string;
  updatedAt: string;
}

type LeadStatus = GovernmentLead['status'];

// ---------------------------------------------------------------------------
// Prisma row → interface mapper
// ---------------------------------------------------------------------------

function toGovernmentLead(row: {
  id: string;
  agencyName: string;
  contactName: string;
  role: string;
  email: string;
  county: string;
  status: string;
  notes: string;
  agencyType: string;
  seatEstimate: number;
  createdAt: Date;
  updatedAt: Date;
}): GovernmentLead {
  return {
    id: row.id,
    agencyName: row.agencyName,
    contactName: row.contactName,
    role: row.role,
    email: row.email,
    county: row.county,
    status: row.status as LeadStatus,
    notes: row.notes,
    agencyType: row.agencyType,
    seatEstimate: row.seatEstimate,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// CRUD — persisted to PostgreSQL via Prisma
// ---------------------------------------------------------------------------

export async function createGovernmentLead(data: Omit<GovernmentLead, 'id' | 'createdAt' | 'updatedAt'>): Promise<GovernmentLead> {
  const row = await prisma.governmentLead.create({
    data: {
      agencyName: data.agencyName,
      contactName: data.contactName,
      role: data.role,
      email: data.email,
      county: data.county,
      status: data.status,
      notes: data.notes,
      agencyType: data.agencyType,
      seatEstimate: data.seatEstimate,
    },
  });
  return toGovernmentLead(row);
}

export async function getGovernmentLeads(): Promise<GovernmentLead[]> {
  const rows = await prisma.governmentLead.findMany({ orderBy: { createdAt: 'desc' } });
  return rows.map(toGovernmentLead);
}

export async function getGovernmentLeadById(id: string): Promise<GovernmentLead | undefined> {
  const row = await prisma.governmentLead.findUnique({ where: { id } });
  return row ? toGovernmentLead(row) : undefined;
}

export async function updateGovernmentLead(id: string, updates: Partial<GovernmentLead>): Promise<GovernmentLead | undefined> {
  try {
    const data: Record<string, unknown> = {};
    if (updates.agencyName !== undefined) data.agencyName = updates.agencyName;
    if (updates.contactName !== undefined) data.contactName = updates.contactName;
    if (updates.role !== undefined) data.role = updates.role;
    if (updates.email !== undefined) data.email = updates.email;
    if (updates.county !== undefined) data.county = updates.county;
    if (updates.status !== undefined) data.status = updates.status;
    if (updates.notes !== undefined) data.notes = updates.notes;
    if (updates.agencyType !== undefined) data.agencyType = updates.agencyType;
    if (updates.seatEstimate !== undefined) data.seatEstimate = updates.seatEstimate;

    const row = await prisma.governmentLead.update({
      where: { id },
      data,
    });
    return toGovernmentLead(row);
  } catch {
    return undefined;
  }
}
