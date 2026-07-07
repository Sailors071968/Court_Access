// ============================================================================
// Phase 4A — Canonical connection of reachable UI views to real backend data.
// Two case-scoped UI pages (Litigation Strategy, Trial Exhibits) previously
// called endpoints that did not exist (runtime-confirmed 404). These endpoints
// connect them to REAL data derived from the already-computed attorney
// intelligence bundle + the case's real evidence. Nothing is fabricated:
// values come from existing repositories; absent data yields empty arrays.
// ============================================================================

import type { FastifyInstance, FastifyReply } from 'fastify';
import type { AuthenticatedRequest } from '../security/authMiddleware.js';
import { guardAuth, guardCaseAccess } from '../membership/resourceAuthMiddleware.js';
import { buildAttorneyWorkbench } from './workbenchService.js';

type RecType = 'INVESTIGATION' | 'MOTION' | 'SUBPOENA' | 'PUBLIC_RECORD' | 'EXPERT';

const EVIDENCE_TO_EXHIBIT_TYPE: Record<string, string> = {
  bodycam: 'officer_action',
  dashcam: 'officer_action',
  police_report: 'policy_comparison',
  dispatch_log: 'timeline',
  forensic_report: 'scene_reconstruction',
  autopsy_report: 'scene_reconstruction',
  witness_video: 'evidence_relationship',
  photo: 'scene_reconstruction',
  transcript: 'timeline',
};

export async function registerCaseViewRoutes(app: FastifyInstance): Promise<void> {
  // ── Litigation Strategy — derived from the real attorney intelligence bundle ─
  app.get('/api/cases/:caseId/litigation-strategy', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!(await guardAuth(user, reply))) return;
    const { caseId } = request.params as { caseId: string };
    if (!(await guardCaseAccess(user!, caseId, 'view', reply))) return;

    const wb = await buildAttorneyWorkbench(caseId, user!.tenantId, user!.userId);
    if (!wb) return reply.code(404).send({ error: 'Case not found' });

    const cc = wb.commandCenter;
    const intel = wb.intelligence;

    // Observations ← real intelligence findings (contradictions + evidence findings)
    const findings = [...intel.contradictionAnalysis, ...intel.evidenceSummary.findings];
    const observations = findings.slice(0, 50).map((f) => ({
      id: f.id,
      evidenceSource: f.evidence[0]?.evidenceId ?? f.category ?? 'Case Intelligence',
      observation: f.finding,
      timestamp: f.audit?.generatedAt ?? wb.generatedAt,
    }));

    // Recommendations ← real recommended motions / investigation / discovery.
    // confidenceScore reflects the relevant case-level coverage metric (real,
    // command-center derived) — not a fabricated per-item score.
    let rid = 0;
    const rec = (type: RecType, text: string, score: number) => ({
      id: `rec-${type}-${rid++}`,
      type,
      suggestedOpportunity: text,
      evidenceSource: 'Attorney intelligence',
      confidenceScore: Math.round(score),
      status: 'pending' as const,
    });
    const recommendations = [
      ...intel.recommendedMotions.map((m) => rec('MOTION', m, cc.legalCoverage.score)),
      ...intel.recommendedInvestigation.map((m) => rec('INVESTIGATION', m, cc.evidenceHealth.score)),
      ...wb.investigation.recommendedSubpoenas.map((m) => rec('SUBPOENA', m, cc.evidenceHealth.score)),
      ...wb.investigation.recommendedDiscovery.map((m) => rec('PUBLIC_RECORD', m, cc.evidenceHealth.score)),
    ];

    // Readiness ← real command-center scores (0–100 each).
    const readiness = [
      { label: 'Case Health', score: cc.caseHealth.score, maxScore: 100 },
      { label: 'Evidence', score: cc.evidenceHealth.score, maxScore: 100 },
      { label: 'Legal Coverage', score: cc.legalCoverage.score, maxScore: 100 },
      { label: 'Timeline', score: cc.timelineCoverage.score, maxScore: 100 },
      { label: 'Trial Readiness', score: cc.trialReadiness.score, maxScore: 100 },
    ];

    // Roadmap ← real recommended steps, ordered; all pending (none executed yet).
    let step = 0;
    const roadmap = [
      ...intel.recommendedInvestigation.map((d) => ({ stepNumber: ++step, description: d, category: 'INVESTIGATION' as RecType, status: 'pending' as const })),
      ...intel.recommendedMotions.map((d) => ({ stepNumber: ++step, description: d, category: 'MOTION' as RecType, status: 'pending' as const })),
      ...wb.investigation.recommendedDiscovery.map((d) => ({ stepNumber: ++step, description: d, category: 'PUBLIC_RECORD' as RecType, status: 'pending' as const })),
    ];

    return reply.send({
      caseId,
      generatedAt: wb.generatedAt,
      source: 'AttorneyWorkbench',
      observations,
      recommendations,
      readiness,
      roadmap,
    });
  });

  // ── Trial Exhibits — real evidence presented as candidate exhibits ──────────
  app.get('/api/cases/:caseId/trial-exhibits', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!(await guardAuth(user, reply))) return;
    const { caseId } = request.params as { caseId: string };
    if (!(await guardCaseAccess(user!, caseId, 'view', reply))) return;

    const wb = await buildAttorneyWorkbench(caseId, user!.tenantId, user!.userId);
    if (!wb) return reply.code(404).send({ error: 'Case not found' });

    // Candidate exhibits are the case's real evidence items. Status is honest:
    // 'ready' only when the evidence was fully analyzed, else 'draft' — no
    // exhibit is claimed "generated" that was not.
    const exhibits = wb.evidenceWorkbench.items.map((e, i) => ({
      id: e.evidenceId,
      exhibitNumber: i + 1,
      title: e.fileName,
      type: EVIDENCE_TO_EXHIBIT_TYPE[e.evidenceType] ?? 'evidence_relationship',
      generatedDate: e.uploadedAt,
      sourceCount: 1,
      status: e.analysisStatus === 'completed' ? 'ready' : 'draft',
      thumbnail: '',
    }));

    return reply.send({ caseId, generatedAt: wb.generatedAt, source: 'CaseEvidence', exhibits });
  });
}
