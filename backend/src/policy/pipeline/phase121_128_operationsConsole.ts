// ============================================================================
// Phases 121-128 — Policy Intelligence Operations Console
// Creates operational intelligence tables, CPRA deadline engine, staff
// dashboard API endpoints, and up-to-the-minute report generation.
// ============================================================================

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Phase 125 — CPRA Deadline Countdown Engine
// ---------------------------------------------------------------------------

const BUSINESS_DAYS_DEADLINE = 10;
const FOLLOW_UP_DAY = 8;
const ANNUAL_UPDATE_DAYS = 365;

function addBusinessDays(start: Date, days: number): Date {
  const result = new Date(start);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return result;
}

function businessDaysBetween(start: Date, end: Date): number {
  let count = 0;
  const current = new Date(start);
  while (current < end) {
    current.setDate(current.getDate() + 1);
    const dow = current.getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}

export interface DeadlineInfo {
  agencyId: string;
  agencyName: string;
  requestId: string;
  emailSentDate: Date;
  deadline: Date;
  daysRemaining: number;
  overdue: boolean;
  nextAction: string;
  status: string;
}

export function computeDeadline(sentDate: Date): {
  deadline: Date;
  followUpDate: Date;
  daysRemaining: number;
  overdue: boolean;
  nextAction: string;
} {
  const now = new Date();
  const deadline = addBusinessDays(sentDate, BUSINESS_DAYS_DEADLINE);
  const followUpDate = addBusinessDays(sentDate, FOLLOW_UP_DAY);
  const daysRemaining = businessDaysBetween(now, deadline);
  const overdue = now > deadline;

  let nextAction = 'wait';
  if (overdue) {
    nextAction = 'escalate — overdue';
  } else if (now >= followUpDate) {
    nextAction = 'send follow-up reminder';
  } else if (daysRemaining <= 3) {
    nextAction = 'prepare follow-up';
  }

  return { deadline, followUpDate, daysRemaining: overdue ? -daysRemaining : daysRemaining, overdue, nextAction };
}

export function computeAnnualUpdateDeadline(receivedDate: Date): {
  annualDeadline: Date;
  daysUntilUpdate: number;
  updateDue: boolean;
} {
  const annualDeadline = new Date(receivedDate);
  annualDeadline.setDate(annualDeadline.getDate() + ANNUAL_UPDATE_DAYS);
  const now = new Date();
  const diffMs = annualDeadline.getTime() - now.getTime();
  const daysUntilUpdate = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return { annualDeadline, daysUntilUpdate, updateDue: daysUntilUpdate <= 0 };
}

// ---------------------------------------------------------------------------
// Phase 121 — Populate AgencyPolicyStatus for all agencies
// ---------------------------------------------------------------------------

export async function populateAgencyPolicyStatus(): Promise<{
  total: number;
  created: number;
  updated: number;
}> {
  const agencies = await prisma.agency.findMany({
    include: {
      PolicyDocuments: { select: { documentId: true, ocrStatus: true, classificationStatus: true } },
      PolicyCoverage: { select: { policyFound: true } },
      CPRAAgencyRequests: {
        select: { status: true, sentAt: true, responseReceived: true, policyReceivedAt: true, annualUpdateDue: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  let created = 0;
  let updated = 0;

  for (const agency of agencies) {
    const discovered = agency.PolicyDocuments.length;
    const downloaded = agency.PolicyDocuments.filter(d => d.ocrStatus !== 'pending' || d.classificationStatus !== 'pending').length;
    const ingested = agency.PolicyDocuments.filter(d => d.classificationStatus === 'completed').length;

    const totalCoverage = agency.PolicyCoverage.length;
    const foundCoverage = agency.PolicyCoverage.filter(c => c.policyFound).length;
    const coverageScore = totalCoverage > 0 ? (foundCoverage / totalCoverage) * 100 : 0;

    const cpraReq = agency.CPRAAgencyRequests[0];
    const cpraStatus = cpraReq?.status ?? 'none';
    const lastCpraEmailSent = cpraReq?.sentAt ?? null;

    let cpraDeadline: Date | null = null;
    let annualUpdateDeadline: Date | null = null;

    if (cpraReq?.sentAt && !cpraReq.responseReceived) {
      cpraDeadline = addBusinessDays(cpraReq.sentAt, BUSINESS_DAYS_DEADLINE);
    }
    if (cpraReq?.policyReceivedAt) {
      const annualInfo = computeAnnualUpdateDeadline(cpraReq.policyReceivedAt);
      annualUpdateDeadline = annualInfo.annualDeadline;
    }
    if (cpraReq?.annualUpdateDue) {
      annualUpdateDeadline = cpraReq.annualUpdateDue;
    }

    const data = {
      agencyName: agency.agencyName,
      city: agency.city,
      county: agency.county,
      website: agency.website,
      lastCrawledAt: agency.lastCrawledAt,
      policiesDiscovered: discovered,
      policiesDownloaded: downloaded,
      policiesIngested: ingested,
      coverageScore: Math.round(coverageScore * 10) / 10,
      cpraStatus,
      lastCpraEmailSent,
      cpraDeadline,
      annualUpdateDeadline,
    };

    const existing = await prisma.agencyPolicyStatus.findUnique({
      where: { agencyId: agency.agencyId },
    });

    if (existing) {
      await prisma.agencyPolicyStatus.update({
        where: { agencyId: agency.agencyId },
        data,
      });
      updated++;
    } else {
      await prisma.agencyPolicyStatus.create({
        data: { agencyId: agency.agencyId, ...data },
      });
      created++;
    }
  }

  return { total: agencies.length, created, updated };
}

// ---------------------------------------------------------------------------
// Phase 122 — Populate PolicyInventory from PolicyDocument records
// ---------------------------------------------------------------------------

export async function populatePolicyInventory(): Promise<{
  total: number;
  created: number;
}> {
  const docs = await prisma.policyDocument.findMany({
    include: { Topic: { select: { topicName: true, category: true } } },
  });

  let created = 0;

  for (const doc of docs) {
    const existing = await prisma.policyInventory.findFirst({
      where: { policyId: doc.documentId },
    });

    if (!existing) {
      let ingestionStatus = 'discovered';
      if (doc.classificationStatus === 'completed') ingestionStatus = 'ingested';
      else if (doc.ocrStatus === 'completed') ingestionStatus = 'classified';
      else if (doc.textExtracted) ingestionStatus = 'ocr_complete';
      else if (doc.s3Url || doc.fileSizeBytes) ingestionStatus = 'downloaded';
      else if (doc.ocrStatus === 'failed' || doc.classificationStatus === 'failed') ingestionStatus = 'failed';

      await prisma.policyInventory.create({
        data: {
          policyId: doc.documentId,
          agencyId: doc.agencyId,
          policyTitle: doc.title,
          policyTopic: doc.Topic?.category ?? null,
          sourceUrl: doc.sourceUrl,
          fileHash: null,
          discoveredAt: doc.createdAt,
          downloadedAt: doc.s3Url ? doc.createdAt : null,
          ocrProcessedAt: doc.textExtracted ? doc.updatedAt : null,
          classificationConfidence: doc.classificationScore,
          ingestionStatus,
        },
      });
      created++;
    }
  }

  return { total: docs.length, created };
}

// ---------------------------------------------------------------------------
// Phase 123 — Populate PolicyTopicCoverage matrix
// ---------------------------------------------------------------------------

export async function populateTopicCoverageMatrix(): Promise<{
  total: number;
  found: number;
  missing: number;
  cpraRequested: number;
}> {
  const agencies = await prisma.agency.findMany({ select: { agencyId: true } });
  const topics = await prisma.policyTopic.findMany({ select: { id: true, topicName: true } });

  // Get coverage data
  const coverageRows = await prisma.policyCoverage.findMany({
    select: { agencyId: true, topicId: true, policyFound: true },
  });

  // Get CPRA requests
  const cpraRequests = await prisma.cPRAAgencyRequest.findMany({
    where: { status: { notIn: ['draft', 'closed'] } },
    select: { agencyId: true },
  });
  const cpraAgencyIds = new Set(cpraRequests.map(r => r.agencyId));

  // Build lookup
  const coverageLookup = new Map<string, boolean>();
  for (const row of coverageRows) {
    coverageLookup.set(`${row.agencyId}:${row.topicId}`, row.policyFound);
  }

  let total = 0;
  let found = 0;
  let missing = 0;
  let cpraRequested = 0;

  for (const agency of agencies) {
    for (const topic of topics) {
      const key = `${agency.agencyId}:${topic.id}`;
      const hasCoverage = coverageLookup.get(key);

      let status = 'MISSING';
      if (hasCoverage === true) {
        status = 'FOUND';
        found++;
      } else if (cpraAgencyIds.has(agency.agencyId)) {
        status = 'CPRA_REQUESTED';
        cpraRequested++;
      } else {
        missing++;
      }

      await prisma.policyTopicCoverage.upsert({
        where: {
          agencyId_topic: { agencyId: agency.agencyId, topic: topic.topicName },
        },
        create: {
          agencyId: agency.agencyId,
          topic: topic.topicName,
          status,
        },
        update: { status },
      });
      total++;
    }
  }

  return { total, found, missing, cpraRequested };
}

// ---------------------------------------------------------------------------
// Phase 124 — Populate CpraRequestLog from CPRAAgencyRequest records
// ---------------------------------------------------------------------------

export async function populateCpraRequestLog(): Promise<{
  total: number;
  created: number;
}> {
  const requests = await prisma.cPRAAgencyRequest.findMany({
    include: { Agency: { select: { website: true } } },
  });

  let created = 0;

  for (const req of requests) {
    const existing = await prisma.cpraRequestLog.findFirst({
      where: { requestId: req.requestId },
    });

    if (!existing) {
      const domain = req.Agency.website ? new URL(req.Agency.website).hostname : '';
      const recipientEmail = domain ? `records@${domain}` : null;

      let followUpRequired = false;
      let followUpDate: Date | null = null;
      if (req.sentAt && !req.responseReceived) {
        followUpRequired = true;
        followUpDate = addBusinessDays(req.sentAt, FOLLOW_UP_DAY);
      }

      await prisma.cpraRequestLog.create({
        data: {
          requestId: req.requestId,
          agencyId: req.agencyId,
          emailSentDate: req.sentAt,
          emailTemplateUsed: req.followUpCount > 0 ? `follow_up_${req.followUpCount}` : 'initial_request',
          recipientEmail,
          responseReceived: req.responseReceived,
          responseDate: req.responseReceivedAt,
          documentsReceived: 0,
          followUpRequired,
          followUpDate,
        },
      });
      created++;
    }
  }

  return { total: requests.length, created };
}

// ---------------------------------------------------------------------------
// Phase 125 — Get all pending CPRA deadlines
// ---------------------------------------------------------------------------

export async function getCpraDeadlines(): Promise<DeadlineInfo[]> {
  const requests = await prisma.cPRAAgencyRequest.findMany({
    where: { closed: false, sentAt: { not: null } },
    include: { Agency: { select: { agencyName: true } } },
  });

  const deadlines: DeadlineInfo[] = [];

  for (const req of requests) {
    if (!req.sentAt) continue;
    const info = computeDeadline(req.sentAt);
    deadlines.push({
      agencyId: req.agencyId,
      agencyName: req.Agency.agencyName,
      requestId: req.requestId,
      emailSentDate: req.sentAt,
      deadline: info.deadline,
      daysRemaining: info.daysRemaining,
      overdue: info.overdue,
      nextAction: info.nextAction,
      status: req.status,
    });
  }

  return deadlines.sort((a, b) => a.daysRemaining - b.daysRemaining);
}

// ---------------------------------------------------------------------------
// Phase 126 — Staff Operations Dashboard API data
// ---------------------------------------------------------------------------

export interface OperationsDashboardFilters {
  county?: string;
  agencySize?: 'large' | 'medium' | 'small';
  minCoverage?: number;
  maxCoverage?: number;
  cpraStatus?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export async function getOperationsDashboardData(filters: OperationsDashboardFilters = {}) {
  const { county, agencySize, minCoverage, maxCoverage, cpraStatus, search, page = 1, limit = 50 } = filters;

  // Build where clause for AgencyPolicyStatus
  const where: Record<string, unknown> = {};
  if (county) where.county = county;
  if (cpraStatus && cpraStatus !== 'all') where.cpraStatus = cpraStatus;
  if (minCoverage !== undefined || maxCoverage !== undefined) {
    where.coverageScore = {};
    if (minCoverage !== undefined) (where.coverageScore as Record<string, number>).gte = minCoverage;
    if (maxCoverage !== undefined) (where.coverageScore as Record<string, number>).lte = maxCoverage;
  }
  if (search) {
    where.agencyName = { contains: search, mode: 'insensitive' };
  }

  // Agency size filter via population
  if (agencySize) {
    // Need to join with Agency for population
    const popFilter = agencySize === 'large' ? { gte: 100000 }
      : agencySize === 'medium' ? { gte: 25000, lt: 100000 }
      : { lt: 25000 };
    where.Agency = { populationEstimate: popFilter };
  }

  const [agencies, totalCount] = await Promise.all([
    prisma.agencyPolicyStatus.findMany({
      where,
      orderBy: { coverageScore: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { Agency: { select: { populationEstimate: true, agencyType: true } } },
    }),
    prisma.agencyPolicyStatus.count({ where }),
  ]);

  // Get available counties for filter dropdown
  const counties = await prisma.agencyPolicyStatus.findMany({
    distinct: ['county'],
    where: { county: { not: null } },
    select: { county: true },
    orderBy: { county: 'asc' },
  });

  // Get summary stats
  const [totalAgencies, totalPoliciesDiscovered, totalPoliciesIngested] = await Promise.all([
    prisma.agencyPolicyStatus.count(),
    prisma.agencyPolicyStatus.aggregate({ _sum: { policiesDiscovered: true } }),
    prisma.agencyPolicyStatus.aggregate({ _sum: { policiesIngested: true } }),
  ]);

  const avgCoverage = await prisma.agencyPolicyStatus.aggregate({ _avg: { coverageScore: true } });

  const cpraStatusCounts = await prisma.agencyPolicyStatus.groupBy({
    by: ['cpraStatus'],
    _count: true,
  });

  return {
    agencies: agencies.map((a: typeof agencies[number]) => ({
      agencyId: a.agencyId,
      agencyName: a.agencyName,
      city: a.city,
      county: a.county,
      website: a.website,
      population: a.Agency?.populationEstimate ?? null,
      agencyType: a.Agency?.agencyType ?? null,
      policiesFound: a.policiesDiscovered,
      policiesMissing: Math.max(0, 334 - a.policiesIngested), // 334 canonical topics
      coverageScore: a.coverageScore,
      lastCrawl: a.lastCrawledAt?.toISOString() ?? null,
      cpraStatus: a.cpraStatus,
      cpraDeadline: a.cpraDeadline?.toISOString() ?? null,
      annualUpdateCountdown: a.annualUpdateDeadline
        ? Math.ceil((a.annualUpdateDeadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : null,
    })),
    pagination: {
      page,
      limit,
      total: totalCount,
      pages: Math.ceil(totalCount / limit),
    },
    summary: {
      totalAgencies,
      totalPoliciesDiscovered: totalPoliciesDiscovered._sum.policiesDiscovered ?? 0,
      totalPoliciesIngested: totalPoliciesIngested._sum.policiesIngested ?? 0,
      averageCoverage: Math.round((avgCoverage._avg.coverageScore ?? 0) * 10) / 10,
      cpraBreakdown: Object.fromEntries(cpraStatusCounts.map((c: { cpraStatus: string; _count: number }) => [c.cpraStatus, c._count])),
    },
    filters: {
      counties: counties.map((c: { county: string | null }) => c.county).filter(Boolean) as string[],
    },
  };
}

// ---------------------------------------------------------------------------
// Phase 127 — Policy Topic Status Viewer API data
// ---------------------------------------------------------------------------

export async function getAgencyTopicStatus(agencyId: string) {
  const agency = await prisma.agency.findUnique({
    where: { agencyId },
    select: { agencyId: true, agencyName: true, city: true, county: true },
  });

  if (!agency) return null;

  const topics = await prisma.policyTopicCoverage.findMany({
    where: { agencyId },
    orderBy: { topic: 'asc' },
  });

  const statusCounts = { FOUND: 0, MISSING: 0, CPRA_REQUESTED: 0, RECEIVED: 0 };
  for (const t of topics) {
    const key = t.status as keyof typeof statusCounts;
    if (key in statusCounts) statusCounts[key]++;
  }

  return {
    agency: {
      agencyId: agency.agencyId,
      agencyName: agency.agencyName,
      city: agency.city,
      county: agency.county,
    },
    topics: topics.map(t => ({
      topic: t.topic,
      status: t.status,
    })),
    summary: statusCounts,
    coveragePercent: topics.length > 0
      ? Math.round((statusCounts.FOUND / topics.length) * 1000) / 10
      : 0,
  };
}

export async function getAllTopicStatusSummary(filters: { county?: string; search?: string } = {}) {
  const where: Record<string, unknown> = {};
  if (filters.county) where.county = filters.county;
  if (filters.search) where.agencyName = { contains: filters.search, mode: 'insensitive' };

  const agencies = await prisma.agency.findMany({
    where,
    select: { agencyId: true, agencyName: true, city: true, county: true },
    orderBy: { agencyName: 'asc' },
    take: 100,
  });

  const agencyIds = agencies.map(a => a.agencyId);

  const allTopics = await prisma.policyTopicCoverage.findMany({
    where: { agencyId: { in: agencyIds } },
    select: { agencyId: true, topic: true, status: true },
  });

  // Group by agency
  const byAgency = new Map<string, { topic: string; status: string }[]>();
  for (const t of allTopics) {
    if (!byAgency.has(t.agencyId)) byAgency.set(t.agencyId, []);
    byAgency.get(t.agencyId)!.push({ topic: t.topic, status: t.status });
  }

  return agencies.map(a => {
    const topics = byAgency.get(a.agencyId) ?? [];
    const found = topics.filter(t => t.status === 'FOUND').length;
    return {
      agencyId: a.agencyId,
      agencyName: a.agencyName,
      city: a.city,
      county: a.county,
      totalTopics: topics.length,
      found,
      missing: topics.filter(t => t.status === 'MISSING').length,
      cpraRequested: topics.filter(t => t.status === 'CPRA_REQUESTED').length,
      coveragePercent: topics.length > 0 ? Math.round((found / topics.length) * 1000) / 10 : 0,
    };
  });
}

// ---------------------------------------------------------------------------
// Phase 127 — CSV/PDF export helpers
// ---------------------------------------------------------------------------

export function exportTopicStatusCsv(agencyData: {
  agency: { agencyName: string };
  topics: { topic: string; status: string }[];
}): string {
  const lines = ['Topic,Status'];
  for (const t of agencyData.topics) {
    lines.push(`"${t.topic}","${t.status}"`);
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Phase 128 — Up-to-the-Minute Operations Report
// ---------------------------------------------------------------------------

export async function generateOperationsReport(): Promise<{
  report: Record<string, unknown>;
  filePath: string;
}> {
  const [
    agencyCount,
    docStats,
    topicCount,
    coverageStats,
    cpraStats,
    annualStats,
  ] = await Promise.all([
    prisma.agency.count(),
    prisma.policyDocument.groupBy({
      by: ['classificationStatus'],
      _count: true,
    }),
    prisma.policyTopic.count(),
    prisma.policyCoverage.groupBy({
      by: ['policyFound'],
      _count: true,
    }),
    prisma.cPRAAgencyRequest.groupBy({
      by: ['status'],
      _count: true,
    }),
    prisma.cPRAAnnualUpdate.count({ where: { closed: false } }),
  ]);

  const totalDocs = docStats.reduce((sum, s) => sum + s._count, 0);
  const classifiedDocs = docStats.find(s => s.classificationStatus === 'completed')?._count ?? 0;
  const pendingOcr = docStats.find(s => s.classificationStatus === 'pending')?._count ?? 0;

  const foundPolicies = coverageStats.find(s => s.policyFound === true)?._count ?? 0;
  const missingPolicies = coverageStats.find(s => s.policyFound === false)?._count ?? 0;

  const cpraSent = cpraStats.filter(s => s.status !== 'draft' && s.status !== 'closed').reduce((sum, s) => sum + s._count, 0);
  const cpraAwaitingResponse = cpraStats.filter(s => ['sent', 'awaiting_response', 'follow_up_1', 'follow_up_2', 'follow_up_final'].includes(s.status)).reduce((sum, s) => sum + s._count, 0);

  // Get deadline-specific counts
  const deadlines = await getCpraDeadlines();
  const overdueCount = deadlines.filter(d => d.overdue).length;
  const dueSoon = deadlines.filter(d => !d.overdue && d.daysRemaining <= 3).length;

  const report = {
    title: 'Policy Acquisition Status Report',
    generatedAt: new Date().toISOString(),
    phase: 'Phase 128',

    agenciesIndexed: agencyCount,
    topicsTracked: topicCount,

    policiesDiscovered: totalDocs,
    policiesIngested: classifiedDocs,
    policiesMissing: missingPolicies,
    policiesFound: foundPolicies,
    pendingOcr,

    cpraRequestsSent: cpraSent,
    cpraDeadlinesPending: cpraAwaitingResponse,
    cpraOverdue: overdueCount,
    cpraDueSoon: dueSoon,

    annualUpdateRequestsPending: annualStats,

    cpraStatusBreakdown: Object.fromEntries(cpraStats.map(s => [s.status, s._count])),

    summary: {
      totalAgencies: agencyCount,
      totalPolicies: totalDocs,
      ingestionRate: totalDocs > 0 ? `${Math.round((classifiedDocs / totalDocs) * 1000) / 10}%` : '0%',
      coverageRate: (foundPolicies + missingPolicies) > 0
        ? `${Math.round((foundPolicies / (foundPolicies + missingPolicies)) * 1000) / 10}%`
        : '0%',
    },
  };

  // Write report to file
  const reportsDir = path.resolve(__dirname, '../../../reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
  const filePath = path.join(reportsDir, 'policy_acquisition_status.json');
  fs.writeFileSync(filePath, JSON.stringify(report, null, 2));

  return { report, filePath };
}

// ---------------------------------------------------------------------------
// Master population — run all phases
// ---------------------------------------------------------------------------

export async function runOperationsConsoleSetup(): Promise<{
  phase121: { total: number; created: number; updated: number };
  phase122: { total: number; created: number };
  phase123: { total: number; found: number; missing: number; cpraRequested: number };
  phase124: { total: number; created: number };
  phase128: { filePath: string };
}> {
  console.log('='.repeat(80));
  console.log('Phases 121-128 — Operations Console Setup');
  console.log('='.repeat(80));

  console.log('\n[Phase 121] Populating AgencyPolicyStatus...');
  const phase121 = await populateAgencyPolicyStatus();
  console.log(`  Total: ${phase121.total}, Created: ${phase121.created}, Updated: ${phase121.updated}`);

  console.log('\n[Phase 122] Populating PolicyInventory...');
  const phase122 = await populatePolicyInventory();
  console.log(`  Total docs: ${phase122.total}, Inventory entries created: ${phase122.created}`);

  console.log('\n[Phase 123] Populating PolicyTopicCoverage matrix...');
  const phase123 = await populateTopicCoverageMatrix();
  console.log(`  Total: ${phase123.total}, Found: ${phase123.found}, Missing: ${phase123.missing}, CPRA Requested: ${phase123.cpraRequested}`);

  console.log('\n[Phase 124] Populating CpraRequestLog...');
  const phase124 = await populateCpraRequestLog();
  console.log(`  Total requests: ${phase124.total}, Log entries created: ${phase124.created}`);

  console.log('\n[Phase 128] Generating operations report...');
  const { filePath } = await generateOperationsReport();
  console.log(`  Report written to: ${filePath}`);

  console.log('\n' + '='.repeat(80));
  console.log('Operations Console Setup Complete');
  console.log('='.repeat(80));

  return { phase121, phase122, phase123, phase124, phase128: { filePath } };
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

async function main() {
  try {
    const result = await runOperationsConsoleSetup();
    console.log('\nFinal results:', JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Operations console setup failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
