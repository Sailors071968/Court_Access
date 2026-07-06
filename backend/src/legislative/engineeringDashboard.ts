// ============================================
// Mission 8 — Engineering dashboard aggregator
// ============================================

import { readFile, access } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { collectProductionMetrics } from './productionMetrics.ts';
import { getExtractionAuditStats } from './extractionAuditLog.ts';
import { collectLiabilityDiscoveryMetrics } from './liabilityDiscovery/metrics.ts';
import prisma from '../lib/prisma.ts';
import { runProductionGates } from '../productionGates/runProductionGates.ts';

export interface BacklogItem {
  id: string;
  priority: string;
  title: string;
  status: string;
  dependencies?: string[];
}

export interface EngineeringDashboard {
  generatedAt: string;
  operationalWebsite: {
    backendApi: 'OPERATIONAL' | 'PARTIAL' | 'UNKNOWN';
    legislativePipeline: 'OPERATIONAL' | 'PARTIAL' | 'UNKNOWN';
    corpusGovernance: 'OPERATIONAL' | 'PARTIAL' | 'UNKNOWN';
  };
  attorneyWorkflows: {
    authenticate: boolean;
    createClients: boolean;
    createCases: boolean;
    uploadEvidence: boolean;
    processEvidence: boolean;
    reviewFacts: boolean;
    reviewTimelines: boolean;
    reviewContradictions: boolean;
    reviewAuthorities: boolean;
    reviewOffenses: boolean;
    reviewCalcrim: boolean;
    generateReports: boolean;
    exportPackages: boolean;
    completionPercent: number;
  };
  californiaLegalCoverage: {
    codesDiscovered: number;
    codesTotal: number;
    sectionsDiscovered: number;
    sectionsAcquired: number;
    sectionsParsed: number;
    criminalOffenses: number;
  };
  repositoryIntegrity: 'PASS' | 'FAIL' | 'UNKNOWN';
  knowledgeGraphCoverage: {
    statutes: number;
    offenses: number;
    elements: number;
    mensRea: number;
    crossReferences: number;
    calcrimLinks: number;
    authorities: number;
  };
  calcrimCoveragePercent: number;
  authorityCoveragePercent: number;
  evidenceCoverage: {
    repositoryRecords: number;
    status: 'PARTIAL' | 'UNKNOWN';
  };
  extractionAudit: {
    total: number;
    success: number;
    rejected: number;
    partial: number;
    withOffenses: number;
  };
  liabilityDiscovery: Awaited<ReturnType<typeof collectLiabilityDiscoveryMetrics>>;
  outstandingBlockers: string[];
  technicalDebt: string[];
  productionMetrics: Awaited<ReturnType<typeof collectProductionMetrics>>;
  nextRecommendedTasks: Array<{ id: string; priority: string; title: string }>;
  productionGates: {
    overallResult: 'READY' | 'NOT_READY';
    passCount: number;
    failCount: number;
    partialCount: number;
    skipCount: number;
    deploymentBlocked: boolean;
    gates: Array<{ id: string; name: string; result: string }>;
  };
}

const BACKLOG_PATHS = [
  resolve(import.meta.dirname ?? '.', '../../../reports/epic-2a/IMPLEMENTATION_BACKLOG.json'),
  resolve(import.meta.dirname ?? '.', '../../../reports/stripe/IMPLEMENTATION_BACKLOG.json'),
];

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function loadBacklog(): Promise<{ items: BacklogItem[] } | null> {
  const items: BacklogItem[] = [];
  for (const path of BACKLOG_PATHS) {
    if (!(await fileExists(path))) continue;
    const raw = await readFile(path, 'utf-8');
    const parsed = JSON.parse(raw) as { items: BacklogItem[] };
    items.push(...(parsed.items ?? []));
  }
  return items.length ? { items } : null;
}

function computeAttorneyWorkflowCompletion(): EngineeringDashboard['attorneyWorkflows'] {
  const workflows = {
    authenticate: true,
    createClients: true,
    createCases: true,
    uploadEvidence: true,
    processEvidence: true,
    reviewFacts: true,
    reviewTimelines: true,
    reviewContradictions: true,
    reviewAuthorities: false,
    reviewOffenses: false,
    reviewCalcrim: false,
    generateReports: true,
    exportPackages: true,
  };
  const values = Object.values(workflows);
  const completionPercent = Math.round((values.filter(Boolean).length / values.length) * 100);
  return { ...workflows, completionPercent };
}

function deriveBlockers(backlog: BacklogItem[] | null): string[] {
  if (!backlog) return ['Backlog file not found'];
  return backlog
    .filter((item) => item.status === 'pending' && item.priority === 'P0')
    .map((item) => `${item.id}: ${item.title}`);
}

function deriveTechnicalDebt(backlog: BacklogItem[] | null): string[] {
  if (!backlog) return [];
  return backlog
    .filter((item) => item.status === 'pending' && (item.priority === 'P1' || item.priority === 'P2'))
    .slice(0, 5)
    .map((item) => `${item.id}: ${item.title}`);
}

function nextTasks(backlog: BacklogItem[] | null): EngineeringDashboard['nextRecommendedTasks'] {
  if (!backlog) return [];
  return backlog
    .filter((item) => item.status === 'pending')
    .sort((a, b) => a.priority.localeCompare(b.priority))
    .slice(0, 5)
    .map((item) => ({ id: item.id, priority: item.priority, title: item.title }));
}

export async function generateEngineeringDashboard(): Promise<EngineeringDashboard> {
  const metrics = await collectProductionMetrics();
  const backlog = await loadBacklog();

  let auditStats = { total: 0, success: 0, rejected: 0, partial: 0, withOffenses: 0 };
  try {
    auditStats = await getExtractionAuditStats({ prisma });
  } catch {
    try {
      auditStats = await getExtractionAuditStats();
    } catch {
      // audit not yet populated
    }
  }

  const repos = metrics.repositories;
  const legislativeOperational =
    metrics.sectionsParsed > 0 && metrics.repositoryIntegrity === 'PASS' ? 'OPERATIONAL' : 'PARTIAL';

  let productionGates: EngineeringDashboard['productionGates'] = {
    overallResult: 'NOT_READY',
    passCount: 0,
    failCount: 0,
    partialCount: 0,
    skipCount: 0,
    deploymentBlocked: true,
    gates: [],
  };
  try {
    const gatesReport = await runProductionGates();
    productionGates = {
      overallResult: gatesReport.overallResult,
      passCount: gatesReport.passCount,
      failCount: gatesReport.failCount,
      partialCount: gatesReport.partialCount,
      skipCount: gatesReport.skipCount,
      deploymentBlocked: gatesReport.deploymentBlocked,
      gates: gatesReport.gates.map((g) => ({ id: g.id, name: g.name, result: g.result })),
    };
  } catch {
    // gates evaluation failed — leave defaults
  }

  return {
    generatedAt: new Date().toISOString(),
    operationalWebsite: {
      backendApi: 'OPERATIONAL',
      legislativePipeline: legislativeOperational,
      corpusGovernance: 'OPERATIONAL',
    },
    attorneyWorkflows: computeAttorneyWorkflowCompletion(),
    californiaLegalCoverage: {
      codesDiscovered: metrics.californiaCodes.discovered,
      codesTotal: metrics.californiaCodes.total,
      sectionsDiscovered: metrics.sectionsDiscovered,
      sectionsAcquired: metrics.sectionsAcquired,
      sectionsParsed: metrics.sectionsParsed,
      criminalOffenses: metrics.criminalOffenses,
    },
    repositoryIntegrity: metrics.repositoryIntegrity,
    knowledgeGraphCoverage: {
      statutes: repos.statutes ?? 0,
      offenses: repos.offenses ?? 0,
      elements: repos.elements ?? 0,
      mensRea: repos.mens_rea ?? 0,
      crossReferences: repos.cross_references ?? 0,
      calcrimLinks: repos.calcrim_links ?? 0,
      authorities: repos.authorities ?? 0,
    },
    calcrimCoveragePercent: metrics.calcrimCoveragePercent,
    authorityCoveragePercent: metrics.authorityCoveragePercent,
    evidenceCoverage: {
      repositoryRecords: repos.statutes ?? 0,
      status: 'PARTIAL',
    },
    extractionAudit: auditStats,
    liabilityDiscovery: metrics.liabilityDiscovery,
    outstandingBlockers: deriveBlockers(backlog?.items ?? null),
    technicalDebt: deriveTechnicalDebt(backlog?.items ?? null),
    productionMetrics: metrics,
    nextRecommendedTasks: nextTasks(backlog?.items ?? null),
    productionGates,
  };
}
