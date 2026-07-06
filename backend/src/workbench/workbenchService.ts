// ============================================================================
// Domain V — Attorney Workbench Service
// Composes intelligence, case data, and workbench persistence
// ============================================================================

import prisma from '../lib/prisma.js';
import { buildCaseIntelligence } from '../intelligence/caseIntelligenceOrchestrator.js';
import { buildInvestigativeAnalysis } from '../intelligence/investigativeAnalysis.js';
import { generateAttorneyReport } from '../intelligence/reportGenerator.js';
import { runProductionGates } from '../productionGates/runProductionGates.js';
import { buildTrialPreparation } from './trialPrepService.js';
import type {
  AttorneyWorkbenchBundle,
  CitationRef,
  CommandCenterSection,
  EvidenceWorkbenchSection,
  InvestigationWorkbenchSection,
  LegalAuthoritySection,
} from './types.js';
import { WORKBENCH_VERSION } from './types.js';

function evidenceConfidence(status: string): 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN' {
  if (status === 'analyzed') return 'HIGH';
  if (status === 'normalized') return 'MEDIUM';
  if (status === 'pending' || status === 'ingesting') return 'LOW';
  return 'UNKNOWN';
}

function buildEvidenceWorkbench(
  evidence: Array<{
    evidenceId: string;
    fileName: string;
    evidenceType: string;
    processingStatus: string;
    analysisStatus: string;
    uploadedAt: Date;
    s3Key: string | null;
  }>,
  claims: Array<{ evidenceId: string | null; claimId: string }>,
  intelligence: NonNullable<Awaited<ReturnType<typeof buildCaseIntelligence>>>,
): EvidenceWorkbenchSection {
  const byFileName = new Map<string, string[]>();
  for (const e of evidence) {
    const key = e.fileName.toLowerCase();
    const list = byFileName.get(key) ?? [];
    list.push(e.evidenceId);
    byFileName.set(key, list);
  }

  const duplicates = [...byFileName.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([name, evidenceIds]) => ({ evidenceIds, reason: `Duplicate filename: ${name}` }));

  const nodes: EvidenceWorkbenchSection['graph']['nodes'] = evidence.map((e) => ({
    id: e.evidenceId,
    type: 'evidence',
    label: e.fileName,
  }));
  const edges: EvidenceWorkbenchSection['graph']['edges'] = [];

  for (const c of claims) {
    if (!c.evidenceId) continue;
    nodes.push({ id: c.claimId, type: 'claim', label: `Claim ${c.claimId.slice(0, 8)}` });
    edges.push({ from: c.evidenceId, to: c.claimId, relation: 'supports' });
  }

  for (const t of intelligence.timelineSummary.findings) {
    for (const ev of t.evidence) {
      edges.push({ from: ev.evidenceId, to: t.timelineEventIds[0] ?? t.id, relation: 'timeline_source' });
    }
  }

  const types = [...new Set(evidence.map((e) => e.evidenceType))];
  const statuses = [...new Set(evidence.map((e) => e.processingStatus))];

  return {
    items: evidence.map((e) => ({
      evidenceId: e.evidenceId,
      fileName: e.fileName,
      evidenceType: e.evidenceType,
      processingStatus: e.processingStatus,
      analysisStatus: e.analysisStatus,
      uploadedAt: e.uploadedAt.toISOString(),
      confidence: evidenceConfidence(e.analysisStatus),
      chainOfCustody: {
        status: e.s3Key ? 'partial' : 'unknown',
        notes: e.s3Key ? 'Stored in evidence repository' : 'Chain of custody UNKNOWN — no storage key',
      },
      citations: [cite('evidence', e.evidenceId, e.fileName)],
    })),
    timeline: evidence
      .map((e) => ({ evidenceId: e.evidenceId, uploadedAt: e.uploadedAt.toISOString(), fileName: e.fileName }))
      .sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt)),
    graph: { nodes, edges },
    contradictions: intelligence.contradictionAnalysis,
    duplicates,
    missing: intelligence.unknowns.evidence,
    filters: { types, statuses },
  };
}

function cite(type: CitationRef['type'], id: string, label?: string): CitationRef {
  return { type, id, label };
}

function buildLegalAuthority(intelligence: NonNullable<Awaited<ReturnType<typeof buildCaseIntelligence>>>): LegalAuthoritySection {
  const enhancements: string[] = [];
  const exceptions: string[] = [];
  const defenses: string[] = [];
  const relatedOffenses: string[] = [];
  const crossReferences: LegalAuthoritySection['crossReferences'] = [];

  for (const o of intelligence.offenseAnalysis) {
    enhancements.push(...o.enhancements);
    exceptions.push(...o.exceptions);
    defenses.push(...o.defenses);
    crossReferences.push(
      ...o.crossReferences.map((cr) => ({
        code: cr.code,
        section: cr.section,
        citations: [cite('authority', `${cr.code}-${cr.section}`, `${cr.code} §${cr.section}`)],
      })),
    );
    if (o.statuteIntelligence?.offenses) {
      for (const off of o.statuteIntelligence.offenses) {
        relatedOffenses.push(`${off.code ?? o.code} §${off.section ?? o.section}: ${off.title ?? 'UNKNOWN'}`);
      }
    }
  }

  return {
    statutes: intelligence.offenseAnalysis,
    authorities: intelligence.authorityMatrix,
    calcrim: intelligence.calcrimAnalysis,
    crossReferences,
    enhancements: [...new Set(enhancements)],
    exceptions: [...new Set(exceptions)],
    defenses: [...new Set(defenses)],
    relatedOffenses: [...new Set(relatedOffenses)],
  };
}

async function buildCommandCenter(
  intelligence: NonNullable<Awaited<ReturnType<typeof buildCaseIntelligence>>>,
  evidencePending: number,
  evidenceFailed: number,
  discoveryPending: number,
  discoveryTotal: number,
  taskCounts: { open: number; inProgress: number; completed: number },
): Promise<CommandCenterSection> {
  const offensesTotal = intelligence.offenseAnalysis.length;
  const offensesCovered = intelligence.offenseAnalysis.filter((o) => o.statuteIntelligence !== null).length;

  const elementRows = intelligence.elementMatrices.flatMap((m) => m.rows);
  const satisfied = elementRows.filter((r) => r.status === 'satisfied').length;
  const elementScore = elementRows.length > 0 ? Math.round((satisfied / elementRows.length) * 100) : 0;

  const evidenceScore = intelligence.evidenceSummary.total > 0
    ? Math.max(0, 100 - evidencePending * 10 - evidenceFailed * 20)
    : 0;

  const timelineScore = intelligence.timelineSummary.eventCount > 0
    ? Math.max(0, 100 - intelligence.timelineSummary.conflictCount * 15)
    : 0;

  const trialReadiness = Math.round((elementScore + evidenceScore + timelineScore) / 3);

  let gatePass = 0;
  let gateTotal = 15;
  let gateStatus = 'UNKNOWN';
  try {
    const gates = await runProductionGates();
    gatePass = gates.passCount;
    gateTotal = gates.gates.length;
    gateStatus = gates.overallResult;
  } catch {
    gateStatus = 'UNAVAILABLE';
  }

  return {
    caseHealth: {
      score: Math.round((elementScore + (offensesCovered / Math.max(offensesTotal, 1)) * 100) / 2),
      label: intelligence.unknowns.all.length > 5 ? 'Needs attention' : 'Stable',
      factors: intelligence.riskFactors.slice(0, 5).map((r) => r.finding),
    },
    evidenceHealth: {
      score: evidenceScore,
      label: evidenceFailed > 0 ? 'Processing failures' : evidencePending > 0 ? 'Processing pending' : 'Healthy',
      pending: evidencePending,
      failed: evidenceFailed,
    },
    legalCoverage: {
      score: offensesTotal > 0 ? Math.round((offensesCovered / offensesTotal) * 100) : 0,
      label: offensesCovered < offensesTotal ? 'Repository gaps' : 'Complete',
      offensesCovered,
      offensesTotal,
    },
    timelineCoverage: {
      score: timelineScore,
      label: intelligence.timelineSummary.conflictCount > 0 ? 'Conflicts detected' : 'No conflicts',
      eventCount: intelligence.timelineSummary.eventCount,
      conflictCount: intelligence.timelineSummary.conflictCount,
    },
    unknownCount: intelligence.unknowns.all.length,
    contradictionCount: intelligence.contradictionAnalysis.length,
    motionOpportunities: intelligence.recommendedMotions.length,
    discoveryStatus: {
      pending: discoveryPending,
      acknowledged: discoveryTotal - discoveryPending,
      total: discoveryTotal,
    },
    investigationStatus: taskCounts,
    trialReadiness: {
      score: trialReadiness,
      label: trialReadiness >= 70 ? 'Approaching ready' : trialReadiness >= 40 ? 'In progress' : 'Early stage',
    },
    productionGateStatus: { pass: gatePass, total: gateTotal, status: gateStatus },
  };
}

export async function buildAttorneyWorkbench(
  caseId: string,
  tenantId: string,
  userId: string,
): Promise<AttorneyWorkbenchBundle | null> {
  const [caseRecord, evidence, timelineEvents, claims, impeachments, notes, pins, tasks, evidenceRequestsRaw] =
    await Promise.all([
      prisma.criminalCase.findFirst({
        where: { caseId, tenantId, deletedAt: null },
        include: { client: true },
      }),
      prisma.evidence.findMany({ where: { caseId, tenantId }, orderBy: { uploadedAt: 'asc' } }),
      prisma.timelineEvent.findMany({ where: { caseId, tenantId }, orderBy: { timestamp: 'asc' } }),
      prisma.narrativeClaim.findMany({ where: { caseId, tenantId } }),
      prisma.impeachmentCandidate.findMany({ where: { caseId, tenantId } }),
      prisma.attorneyNote.findMany({ where: { caseId, tenantId, userId }, orderBy: { updatedAt: 'desc' } }),
      prisma.workbenchPin.findMany({ where: { caseId, tenantId, userId }, orderBy: { createdAt: 'desc' } }),
      prisma.investigationTask.findMany({ where: { caseId, tenantId }, orderBy: { createdAt: 'desc' } }),
      prisma.evidenceRequest.findMany({ where: { caseId, tenantId } }).catch(() => []),
    ]);

  const evidenceRequests = evidenceRequestsRaw;

  if (!caseRecord) return null;

  const intelligence = await buildCaseIntelligence(caseId, tenantId);
  if (!intelligence) return null;

  const investigative = await buildInvestigativeAnalysis(
    caseId,
    tenantId,
    timelineEvents.length,
    evidence.length,
  );

  const renderedReport = generateAttorneyReport(intelligence);

  const caseOverview = {
    client: caseRecord.client
      ? {
          clientId: caseRecord.client.clientId,
          name: [caseRecord.client.firstName, caseRecord.client.lastName].filter(Boolean).join(' '),
        }
      : null,
    case: {
      caseId: caseRecord.caseId,
      title: caseRecord.title,
      caseNumber: caseRecord.caseNumber,
      status: caseRecord.status,
      phase: caseRecord.phase,
      jurisdiction: caseRecord.jurisdiction,
      caseType: caseRecord.caseType,
    },
    charges: intelligence.caseOverview.charges,
    court: caseRecord.court,
    judge: caseRecord.judge,
    prosecutor: null as string | null,
    defenseTeam: [{ userId: caseRecord.ownerId, role: 'lead_counsel' }],
    currentStatus: `${caseRecord.status} — ${caseRecord.phase}`,
    upcomingHearings: [
      {
        date: caseRecord.nextHearing?.toISOString() ?? null,
        note: caseRecord.nextHearingNote,
      },
    ],
    caseTimeline: timelineEvents.map((e) => ({
      id: e.id,
      timestamp: e.timestamp?.toISOString() ?? null,
      description: e.description,
      actor: e.actor,
      conflictFlag: e.conflictFlag,
      citations: e.sourceDoc
        ? [cite('evidence', e.sourceDoc)]
        : [cite('timeline', e.id, e.description)],
    })),
    evidenceSummary: intelligence.evidenceSummary,
    intelligenceSummary: {
      unknownCount: intelligence.unknowns.all.length,
      riskCount: intelligence.riskFactors.length,
      contradictionCount: intelligence.contradictionAnalysis.length,
      offenseCount: intelligence.offenseAnalysis.length,
    },
    outstandingUnknowns: intelligence.unknowns.all,
  };

  const evidenceWorkbench = buildEvidenceWorkbench(evidence, claims, intelligence);
  const legalAuthority = buildLegalAuthority(intelligence);

  const investigation: InvestigationWorkbenchSection = {
    ...investigative,
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      assignedTo: t.assignedTo,
      dueDate: t.dueDate?.toISOString() ?? null,
      sourceType: t.sourceType,
      sourceId: t.sourceId,
      citations: t.sourceId ? [cite(t.sourceType === 'evidence_gap' ? 'evidence' : 'audit', t.sourceId)] : [],
    })),
    discoveryRequests: evidenceRequests.map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      priority: r.priority,
    })),
    outstandingSubpoenas: investigative.recommendedSubpoenas,
  };

  const trialPreparation = buildTrialPreparation(
    intelligence,
    evidence.map((e) => ({ evidenceId: e.evidenceId, fileName: e.fileName, evidenceType: e.evidenceType })),
    timelineEvents.map((e) => ({ id: e.id, actor: e.actor, description: e.description })),
    impeachments.map((i) => ({
      id: i.impeachmentId,
      claimText: i.claimText,
      severity: i.severity,
      suggestedQuestion: i.suggestedQuestion,
    })),
  );

  const taskCounts = {
    open: tasks.filter((t) => t.status === 'open').length,
    inProgress: tasks.filter((t) => t.status === 'in_progress').length,
    completed: tasks.filter((t) => t.status === 'completed').length,
  };

  const commandCenter = await buildCommandCenter(
    intelligence,
    intelligence.evidenceSummary.processingPending,
    evidence.filter((e) => e.processingStatus === 'failed').length,
    evidenceRequests.filter((r) => r.status === 'pending').length,
    evidenceRequests.length,
    taskCounts,
  );

  return {
    generatedAt: new Date().toISOString(),
    workbenchVersion: WORKBENCH_VERSION,
    caseId,
    tenantId,
    caseOverview,
    offenseAnalysis: intelligence.offenseAnalysis,
    elementMatrices: intelligence.elementMatrices,
    evidenceWorkbench,
    legalAuthority,
    investigation,
    trialPreparation,
    attorneyNotes: {
      notes: notes.map((n) => ({
        id: n.id,
        title: n.title,
        content: n.content,
        entityType: n.entityType,
        entityId: n.entityId,
        isPrivate: n.isPrivate,
        createdAt: n.createdAt.toISOString(),
        updatedAt: n.updatedAt.toISOString(),
      })),
      pins: pins.map((p) => ({
        id: p.id,
        pinType: p.pinType,
        entityId: p.entityId,
        label: p.label,
        createdAt: p.createdAt.toISOString(),
      })),
    },
    commandCenter,
    intelligence,
    renderedReport,
  };
}
