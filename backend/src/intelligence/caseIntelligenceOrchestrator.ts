// ============================================================================
// Domain U — Case Intelligence Orchestrator (Phases 1–5)
// ============================================================================

import prisma from '../lib/prisma.js';
import { analyzeElementsForCharge } from './elementAnalysis.js';
import { analyzeChargeLegal } from './legalAnalysis.js';
import { buildInvestigativeAnalysis } from './investigativeAnalysis.js';
import { collectUnknowns } from './unknownManagement.js';
import { detectContradictions } from '../services/contradictionEngine.js';
import type {
  AttorneyIntelligenceReport,
  CaseUnderstanding,
  IntelligenceAudit,
  IntelligenceFinding,
} from './types.js';
import { INTELLIGENCE_VERSION } from './types.js';

async function loadCaseContext(caseId: string, tenantId: string) {
  const [caseRecord, charges, evidence, timelineEvents, claims, validations, impeachments] = await Promise.all([
    prisma.criminalCase.findFirst({
      where: { caseId, tenantId, deletedAt: null },
      include: { client: true },
    }),
    prisma.charge.findMany({ where: { caseId }, orderBy: { createdAt: 'asc' } }),
    prisma.evidence.findMany({ where: { caseId, tenantId } }),
    prisma.timelineEvent.findMany({ where: { caseId, tenantId }, orderBy: { timestamp: 'asc' } }),
    prisma.narrativeClaim.findMany({ where: { caseId, tenantId } }),
    prisma.claimValidation.findMany({ where: { caseId, tenantId } }),
    prisma.impeachmentCandidate.findMany({ where: { caseId, tenantId } }),
  ]);

  return { caseRecord, charges, evidence, timelineEvents, claims, validations, impeachments };
}

function toCaseUnderstanding(
  caseRecord: NonNullable<Awaited<ReturnType<typeof loadCaseContext>>['caseRecord']>,
  charges: Awaited<ReturnType<typeof loadCaseContext>>['charges'],
  evidenceCount: number,
  timelineCount: number,
  claimCount: number,
): CaseUnderstanding {
  return {
    caseId: caseRecord.caseId,
    tenantId: caseRecord.tenantId,
    title: caseRecord.title,
    caseNumber: caseRecord.caseNumber,
    status: caseRecord.status,
    phase: caseRecord.phase,
    client: caseRecord.client
      ? {
          clientId: caseRecord.client.clientId,
          name: [caseRecord.client.firstName, caseRecord.client.lastName].filter(Boolean).join(' '),
        }
      : null,
    charges: charges.map((c) => ({
      id: c.id,
      code: c.code,
      section: c.section,
      title: c.title,
      victim: c.victim,
    })),
    evidenceCount,
    timelineEventCount: timelineCount,
    claimCount,
    witnessCount: 0,
  };
}

export async function buildCaseIntelligence(caseId: string, tenantId: string): Promise<AttorneyIntelligenceReport | null> {
  const ctx = await loadCaseContext(caseId, tenantId);
  if (!ctx.caseRecord) return null;

  const caseOverview = toCaseUnderstanding(
    ctx.caseRecord,
    ctx.charges,
    ctx.evidence.length,
    ctx.timelineEvents.length,
    ctx.claims.length,
  );

  const offenseAnalysis = await Promise.all(ctx.charges.map((c) => analyzeChargeLegal(c)));

  const elementMatrices = offenseAnalysis.map((legal, idx) => {
    const charge = ctx.charges[idx];
    const elements = legal.statuteIntelligence?.elements ?? [];
    return analyzeElementsForCharge({
      chargeId: charge.id,
      code: charge.code,
      section: charge.section,
      elements,
      evidence: ctx.evidence.map((e) => ({
        evidenceId: e.evidenceId,
        fileName: e.fileName,
        evidenceType: e.evidenceType,
        processingStatus: e.processingStatus,
      })),
      claims: ctx.claims.map((c) => ({ claimId: c.claimId, claimText: c.claimText, evidenceId: c.evidenceId })),
      validations: ctx.validations.map((v) => ({
        claimId: v.claimId,
        status: v.status,
        supportingEvidenceIds: Array.isArray(v.supportingEvidenceIds)
          ? (v.supportingEvidenceIds as string[])
          : JSON.parse(String(v.supportingEvidenceIds || '[]')),
        contradictingEvidenceIds: Array.isArray(v.contradictingEvidenceIds)
          ? (v.contradictingEvidenceIds as string[])
          : JSON.parse(String(v.contradictingEvidenceIds || '[]')),
        reasoning: v.reasoning,
      })),
      timelineEvents: ctx.timelineEvents.map((e) => ({
        id: e.id,
        description: e.description,
        sourceDoc: e.sourceDoc,
        confidence: e.confidence,
      })),
    });
  });

  const investigative = await buildInvestigativeAnalysis(
    caseId,
    tenantId,
    ctx.timelineEvents.length,
    ctx.evidence.length,
  );

  const contradictions = await detectContradictions(caseId, tenantId).catch(() => []);
  const contradictionAnalysis: IntelligenceFinding[] = contradictions.map((c, i) => ({
    id: `contradiction-${i}`,
    category: 'contradiction',
    finding: c.description,
    status: 'disputed',
    authority: null,
    evidence: [],
    timelineEventIds: c.eventIds,
    claimIds: [],
    audit: {
      generatedAt: new Date().toISOString(),
      intelligenceVersion: INTELLIGENCE_VERSION,
      pipelineVersion: 'contradiction-engine',
      reasoning: c.description,
      sourceType: 'timeline',
    },
  }));

  const evidenceByType: Record<string, number> = {};
  for (const e of ctx.evidence) {
    evidenceByType[e.evidenceType] = (evidenceByType[e.evidenceType] ?? 0) + 1;
  }

  const evidenceFindings: IntelligenceFinding[] = ctx.evidence
    .filter((e) => e.processingStatus === 'pending' || e.processingStatus === 'failed')
    .map((e) => ({
      id: `evidence-${e.evidenceId}`,
      category: 'evidence_processing',
      finding: `Evidence "${e.fileName}" processing status: ${e.processingStatus}`,
      status: e.processingStatus === 'failed' ? 'contradicted' : 'unclear',
      authority: null,
      evidence: [{ evidenceId: e.evidenceId, role: 'source' }],
      timelineEventIds: [],
      claimIds: [],
      audit: {
        generatedAt: new Date().toISOString(),
        intelligenceVersion: INTELLIGENCE_VERSION,
        pipelineVersion: 'evidence-status',
        reasoning: `processingStatus=${e.processingStatus}`,
        sourceType: 'evidence',
        sourceId: e.evidenceId,
      },
    }));

  const calcrimAnalysis: IntelligenceFinding[] = offenseAnalysis.flatMap((o) =>
    o.applicableCalcrim.map((c) => ({
      id: `calcrim-${o.chargeId}-${c.instructionNumber}`,
      category: 'calcrim',
      finding: `CALCRIM ${c.instructionNumber}: ${c.title}`,
      status: c.instructionNumber === 'UNKNOWN' ? ('unknown' as const) : ('established' as const),
      authority: { code: o.code, section: o.section, calcrimId: c.instructionNumber },
      evidence: [],
      timelineEventIds: [],
      claimIds: [],
      audit: c.audit,
    })),
  );

  const riskFactors: IntelligenceFinding[] = [
    ...contradictionAnalysis.filter((c) => c.status === 'disputed'),
    ...elementMatrices.flatMap((m) =>
      m.rows
        .filter((r) => r.status === 'contradicted' || r.status === 'unsatisfied')
        .map((r) => ({
          id: `risk-${r.elementId}`,
          category: 'element_risk',
          finding: `Element "${r.elementLabel}" status: ${r.status}`,
          status: r.status,
          authority: { code: r.code, section: r.section, elementId: r.elementId },
          evidence: r.supportingEvidence,
          timelineEventIds: [],
          claimIds: [],
          audit: r.audit,
        })),
    ),
  ];

  const unknowns = collectUnknowns(offenseAnalysis, elementMatrices, investigative.evidenceGaps.map((g) => g.finding));

  const auditTrail: IntelligenceAudit[] = elementMatrices.flatMap((m) => m.rows.map((r) => r.audit));

  return {
    generatedAt: new Date().toISOString(),
    intelligenceVersion: INTELLIGENCE_VERSION,
    caseId,
    tenantId,
    caseOverview,
    offenseAnalysis,
    elementMatrices,
    evidenceSummary: {
      total: ctx.evidence.length,
      byType: evidenceByType,
      processingPending: ctx.evidence.filter((e) => e.processingStatus === 'pending').length,
      findings: evidenceFindings,
    },
    authorityMatrix: offenseAnalysis.flatMap((o) =>
      o.applicableAuthorities.map((a) => ({
        id: `auth-${a.authorityId ?? a.code}`,
        category: 'authority',
        finding: `Authority ${a.code} §${a.section}`,
        status: 'established' as const,
        authority: a,
        evidence: [],
        timelineEventIds: [],
        claimIds: [],
        audit: {
          generatedAt: new Date().toISOString(),
          intelligenceVersion: INTELLIGENCE_VERSION,
          pipelineVersion: 'legal-analysis-1.0.0',
          reasoning: 'From legislative authority repository',
          sourceType: 'repository',
          sourceId: a.authorityId,
        },
      })),
    ),
    timelineSummary: {
      eventCount: ctx.timelineEvents.length,
      conflictCount: ctx.timelineEvents.filter((e) => e.conflictFlag).length,
      findings: ctx.timelineEvents
        .filter((e) => e.conflictFlag)
        .map((e) => ({
          id: `timeline-conflict-${e.id}`,
          category: 'timeline_conflict',
          finding: e.description,
          status: 'disputed' as const,
          authority: null,
          evidence: e.sourceDoc ? [{ evidenceId: e.sourceDoc, role: 'mentions' as const }] : [],
          timelineEventIds: [e.id],
          claimIds: [],
          audit: {
            generatedAt: new Date().toISOString(),
            intelligenceVersion: INTELLIGENCE_VERSION,
            pipelineVersion: 'timeline',
            reasoning: 'Timeline conflict flag set',
            sourceType: 'timeline',
            sourceId: e.id,
          },
        })),
    },
    contradictionAnalysis,
    unknowns,
    riskFactors,
    recommendedInvestigation: investigative.recommendedInvestigation,
    recommendedMotions: impeachmentToMotions(ctx.impeachments),
    calcrimAnalysis,
    auditTrail,
  };
}

function impeachmentToMotions(
  impeachments: Array<{ severity: string; suggestedQuestion: string | null; claimText: string }>,
): string[] {
  return impeachments
    .filter((i) => i.severity === 'high' || i.severity === 'medium')
    .map((i) => i.suggestedQuestion ?? `Impeachment motion regarding: ${i.claimText.slice(0, 80)}`);
}
