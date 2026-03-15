// ============================================================================
// CourtAccess — Demo Request Model
// Phase 211: Government demonstration request storage
// Now persisted to PostgreSQL via Prisma (replaces in-memory array).
// ============================================================================

import prisma from '../lib/prisma.js';

// ---------------------------------------------------------------------------
// Types (kept for backward compatibility with existing route handlers)
// ---------------------------------------------------------------------------

export interface DemoRequest {
  id: string;
  name: string;
  organization: string;
  role: string;
  email: string;
  county: string;
  agencyType: string;
  message: string;
  status: 'new' | 'contacted' | 'scheduled' | 'completed' | 'declined';
  submittedAt: string;
  updatedAt: string;
}

type DemoRequestStatus = DemoRequest['status'];

// ---------------------------------------------------------------------------
// Prisma row → interface mapper
// ---------------------------------------------------------------------------

function toDemoRequest(row: {
  id: string;
  name: string;
  organization: string;
  role: string;
  email: string;
  county: string;
  agencyType: string;
  message: string;
  status: string;
  submittedAt: Date;
  updatedAt: Date;
}): DemoRequest {
  return {
    id: row.id,
    name: row.name,
    organization: row.organization,
    role: row.role,
    email: row.email,
    county: row.county,
    agencyType: row.agencyType,
    message: row.message,
    status: row.status as DemoRequestStatus,
    submittedAt: row.submittedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// CRUD — persisted to PostgreSQL via Prisma
// ---------------------------------------------------------------------------

export async function createDemoRequest(data: Omit<DemoRequest, 'id' | 'status' | 'submittedAt' | 'updatedAt'>): Promise<DemoRequest> {
  const row = await prisma.demoRequest.create({
    data: {
      name: data.name,
      organization: data.organization,
      role: data.role,
      email: data.email,
      county: data.county,
      agencyType: data.agencyType,
      message: data.message,
    },
  });
  return toDemoRequest(row);
}

export async function getDemoRequests(): Promise<DemoRequest[]> {
  const rows = await prisma.demoRequest.findMany({ orderBy: { submittedAt: 'desc' } });
  return rows.map(toDemoRequest);
}

export async function getDemoRequestById(id: string): Promise<DemoRequest | undefined> {
  const row = await prisma.demoRequest.findUnique({ where: { id } });
  return row ? toDemoRequest(row) : undefined;
}

export async function updateDemoRequestStatus(id: string, status: DemoRequestStatus): Promise<DemoRequest | undefined> {
  try {
    const row = await prisma.demoRequest.update({
      where: { id },
      data: { status },
    });
    return toDemoRequest(row);
  } catch {
    return undefined;
  }
}
