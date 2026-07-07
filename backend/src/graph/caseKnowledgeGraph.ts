// ============================================================================
// Master Program 8 — Canonical Case Knowledge Graph
// Assembles ONE typed graph from the already-aggregated attorney intelligence
// bundle (real DB + repository data): cases, charges, evidence, witnesses,
// defendants, attorneys, courts, judges, statutes, authorities, jury
// instructions, motions, reports, citations, timeline events — plus derived
// sub-graphs (relationships / citation / evidence / timeline / authority).
// Nothing is fabricated: nodes exist only where the case has real records.
// ============================================================================

import { buildAttorneyWorkbench } from '../workbench/workbenchService.js';

export type KgNodeType =
  | 'case' | 'defendant' | 'attorney' | 'court' | 'judge' | 'charge' | 'evidence'
  | 'witness' | 'timeline_event' | 'statute' | 'authority' | 'jury_instruction'
  | 'motion' | 'report' | 'contradiction';

export interface KgNode {
  id: string;
  type: KgNodeType;
  label: string;
  repositorySource: string;
  citations?: string[];
  timestamp?: string | null;
}
export interface KgEdge { from: string; to: string; relation: string; strength?: number }

export interface CaseKnowledgeGraph {
  caseId: string;
  generatedAt: string;
  nodes: KgNode[];
  edges: KgEdge[];
  counts: { nodes: number; edges: number; byType: Record<string, number> };
  subGraphs: {
    relationships: { nodes: number; edges: number };
    citation: { nodes: KgNode[]; edges: KgEdge[] };
    evidence: { nodes: KgNode[]; edges: KgEdge[] };
    timeline: { nodes: KgNode[]; edges: KgEdge[] };
    authority: { nodes: KgNode[]; edges: KgEdge[] };
  };
}

export async function buildCaseKnowledgeGraph(caseId: string, tenantId: string, userId: string): Promise<CaseKnowledgeGraph | null> {
  const wb = await buildAttorneyWorkbench(caseId, tenantId, userId);
  if (!wb) return null;

  const nodes: KgNode[] = [];
  const edges: KgEdge[] = [];
  const seen = new Set<string>();
  const add = (n: KgNode) => { if (!seen.has(n.id)) { seen.add(n.id); nodes.push(n); } };
  const link = (from: string, to: string, relation: string, strength = 0.6) => {
    if (seen.has(from) && seen.has(to)) edges.push({ from, to, relation, strength });
  };

  const co = wb.caseOverview;
  const caseNodeId = `case:${caseId}`;
  add({ id: caseNodeId, type: 'case', label: `${co.case.title} (${co.case.caseNumber})`, repositorySource: 'CriminalCase' });

  // Defendant / client
  if (co.client) { const id = `defendant:${co.client.clientId}`; add({ id, type: 'defendant', label: co.client.name, repositorySource: 'Client' }); link(caseNodeId, id, 'defendant'); }
  // Court / judge
  if (co.court) { const id = `court:${co.court}`; add({ id, type: 'court', label: co.court, repositorySource: 'CriminalCase' }); link(id, caseNodeId, 'presides_over'); }
  if (co.judge) { const id = `judge:${co.judge}`; add({ id, type: 'judge', label: co.judge, repositorySource: 'CriminalCase' }); link(id, caseNodeId, 'assigned'); if (co.court) link(id, `court:${co.court}`, 'sits_in'); }
  // Attorneys / defense team
  for (const m of co.defenseTeam ?? []) { const id = `attorney:${m.userId}`; add({ id, type: 'attorney', label: `${m.role}`, repositorySource: 'CaseTeam' }); link(id, caseNodeId, m.role); }

  // Charges → statutes → CALCRIM (citation + authority graph)
  for (const c of co.charges ?? []) {
    const id = `charge:${c.id}`;
    add({ id, type: 'charge', label: `${c.code} ${c.section}${c.title ? ' — ' + c.title : ''}`, repositorySource: 'Charge', citations: [`${c.code} ${c.section}`] });
    link(caseNodeId, id, 'charged_with');
    const statuteId = `statute:${c.code} ${c.section}`;
    add({ id: statuteId, type: 'statute', label: `${c.code} § ${c.section}`, repositorySource: 'CaliforniaCodes', citations: [`${c.code} ${c.section}`] });
    link(id, statuteId, 'defined_by', 0.9);
  }

  // Authorities + CALCRIM (authority graph)
  for (const a of wb.intelligence.authorityMatrix ?? []) {
    const id = `authority:${a.id}`;
    add({ id, type: 'authority', label: a.finding.slice(0, 60), repositorySource: 'AuthorityMatrix' });
    link(caseNodeId, id, 'authority');
  }
  for (const j of wb.intelligence.calcrimAnalysis ?? []) {
    const id = `calcrim:${j.id}`;
    add({ id, type: 'jury_instruction', label: j.finding.slice(0, 60), repositorySource: 'CALCRIM' });
    link(caseNodeId, id, 'jury_instruction');
  }

  // Evidence (evidence graph) + contradictions
  for (const e of wb.evidenceWorkbench.items ?? []) {
    const id = `evidence:${e.evidenceId}`;
    add({ id, type: 'evidence', label: e.fileName, repositorySource: 'EvidenceRepository' });
    link(id, caseNodeId, 'evidence_in');
  }
  for (const f of wb.intelligence.contradictionAnalysis ?? []) {
    const id = `contradiction:${f.id}`;
    add({ id, type: 'contradiction', label: f.finding.slice(0, 60), repositorySource: 'ContradictionAnalysis' });
    for (const ev of f.evidence ?? []) link(`evidence:${ev.evidenceId}`, id, ev.role);
  }

  // Witnesses
  for (let i = 0; i < (wb.trialPreparation.witnessList ?? []).length; i++) {
    const w = wb.trialPreparation.witnessList[i];
    const id = `witness:${i}:${w.title}`;
    add({ id, type: 'witness', label: w.title, repositorySource: 'TrialPreparation' });
    link(id, caseNodeId, 'witness_in');
  }

  // Timeline events (timeline graph — chronological chain)
  const tlIds: string[] = [];
  for (const t of co.caseTimeline ?? []) {
    const id = `timeline:${t.id}`;
    add({ id, type: 'timeline_event', label: t.description.slice(0, 60), repositorySource: 'CaseTimeline', timestamp: t.timestamp });
    link(caseNodeId, id, 'event');
    tlIds.push(id);
  }
  for (let i = 1; i < tlIds.length; i++) link(tlIds[i - 1], tlIds[i], 'then', 0.4);

  // Motions + report
  let mi = 0;
  for (const m of wb.intelligence.recommendedMotions ?? []) {
    const id = `motion:${mi++}`;
    add({ id, type: 'motion', label: m.slice(0, 60), repositorySource: 'MotionIntelligence' });
    link(caseNodeId, id, 'motion_opportunity');
  }
  const reportId = `report:${caseId}`;
  add({ id: reportId, type: 'report', label: 'Attorney Report', repositorySource: 'ReportEngine' });
  link(caseNodeId, reportId, 'report');

  const byType: Record<string, number> = {};
  for (const n of nodes) byType[n.type] = (byType[n.type] || 0) + 1;

  const pick = (types: KgNodeType[]) => {
    const ns = nodes.filter((n) => types.includes(n.type));
    const ids = new Set(ns.map((n) => n.id));
    return { nodes: ns, edges: edges.filter((e) => ids.has(e.from) && ids.has(e.to)) };
  };

  return {
    caseId,
    generatedAt: wb.generatedAt,
    nodes,
    edges,
    counts: { nodes: nodes.length, edges: edges.length, byType },
    subGraphs: {
      relationships: { nodes: nodes.length, edges: edges.length },
      citation: pick(['charge', 'statute', 'authority', 'jury_instruction']),
      evidence: pick(['evidence', 'contradiction', 'case']),
      timeline: pick(['timeline_event', 'case']),
      authority: pick(['statute', 'authority', 'jury_instruction', 'charge']),
    },
  };
}
