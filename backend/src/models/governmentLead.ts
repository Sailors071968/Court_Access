// ============================================================================
// CourtAccess — Government Lead Model
// Phase 215: Government sales tracking for institutional outreach
// ============================================================================

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

// In-memory store (production: migrate to PostgreSQL)
const governmentLeads: GovernmentLead[] = [];

export function createGovernmentLead(data: Omit<GovernmentLead, 'id' | 'createdAt' | 'updatedAt'>): GovernmentLead {
  const lead: GovernmentLead = {
    ...data,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  governmentLeads.push(lead);
  return lead;
}

export function getGovernmentLeads(): GovernmentLead[] {
  return [...governmentLeads];
}

export function getGovernmentLeadById(id: string): GovernmentLead | undefined {
  return governmentLeads.find((l) => l.id === id);
}

export function updateGovernmentLead(id: string, updates: Partial<GovernmentLead>): GovernmentLead | undefined {
  const lead = governmentLeads.find((l) => l.id === id);
  if (lead) {
    Object.assign(lead, updates, { updatedAt: new Date().toISOString() });
  }
  return lead;
}
