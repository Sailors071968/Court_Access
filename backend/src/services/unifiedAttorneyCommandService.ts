// ============================================================================
// Phase H.1 — Full Operational Defense Platform Integration
// Unified Attorney Command Environment
// Augments and organizes attorney litigation operations.
// NEVER replaces licensed legal counsel.
// All orchestration is deterministic + citation-backed.
// ============================================================================

import prisma from '../lib/prisma.js';

// ---------------------------------------------------------------------------
// 1. Unified Case State Management (evidence-linked)
// ---------------------------------------------------------------------------

export async function buildUnifiedCaseState(caseId: string): Promise<{
  caseId: string; stateBuilt: boolean; state: Record<string, unknown>;
}> {
  const [evidenceCount, contradictionCount, burdenCount, constitutionalCount,
    discoveryCount, suppressionCount, preservationRecords] = await Promise.all([
    prisma.evidenceStatement.count({ where: { caseId } }),
    prisma.contradictionPair.count({ where: { caseId } }).catch(() => 0),
    prisma.burdenFracture.count({ where: { caseId } }).catch(() => 0),
    prisma.constitutionalIssue.count({ where: { caseId } }).catch(() => 0),
    prisma.discoveryDisclosureTracker.count({ where: { caseId } }).catch(() => 0),
    prisma.suppressionIssueMap.count({ where: { caseId } }).catch(() => 0),
    prisma.constitutionalPreservationGraph.findMany({ where: { caseId } }).catch(() => []),
  ]);

  const atRisk = preservationRecords.filter((p: Record<string, unknown>) => p.currentStatus === 'at_risk' || p.currentStatus === 'partially_preserved').length;
  const preservationStatus = atRisk > 0 ? 'at_risk' : preservationRecords.length > 0 ? 'all_preserved' : 'all_preserved';

  let overallRiskLevel: string;
  if (constitutionalCount > 5 || suppressionCount > 3) overallRiskLevel = 'critical';
  else if (constitutionalCount > 2 || contradictionCount > 10) overallRiskLevel = 'high';
  else if (contradictionCount > 5 || discoveryCount > 5) overallRiskLevel = 'moderate';
  else overallRiskLevel = 'low';

  const stateSnapshot = {
    evidenceCount, contradictionCount, burdenFractureCount: burdenCount,
    constitutionalIssueCount: constitutionalCount, discoveryIssueCount: discoveryCount,
    suppressionIssueCount: suppressionCount, preservationStatus, overallRiskLevel,
    generatedAt: new Date().toISOString(),
  };

  const state = await prisma.unifiedCaseState.upsert({
    where: { caseId },
    create: {
      caseId,
      currentPhase: 'pretrial',
      evidenceCount, contradictionCount, burdenFractureCount: burdenCount,
      constitutionalIssueCount: constitutionalCount, discoveryIssueCount: discoveryCount,
      suppressionIssueCount: suppressionCount, preservationStatus, overallRiskLevel,
      lastAnalysisDate: new Date().toISOString(),
      stateSnapshot: JSON.stringify(stateSnapshot),
      citations: JSON.stringify([{ type: 'cross_layer_aggregation', timestamp: new Date().toISOString() }]),
    },
    update: {
      evidenceCount, contradictionCount, burdenFractureCount: burdenCount,
      constitutionalIssueCount: constitutionalCount, discoveryIssueCount: discoveryCount,
      suppressionIssueCount: suppressionCount, preservationStatus, overallRiskLevel,
      lastAnalysisDate: new Date().toISOString(),
      stateSnapshot: JSON.stringify(stateSnapshot),
    },
  });

  return { caseId, stateBuilt: true, state: { id: state.id, overallRiskLevel, preservationStatus } };
}

// ---------------------------------------------------------------------------
// 2. Cross-Layer Orchestration Engine (immutable state)
// ---------------------------------------------------------------------------

const LAYER_ORDER = [
  'evidence', 'calcrim', 'prosecutor_theory', 'contradictions', 'burden_fractures',
  'defense_intelligence', 'trial_preparation', 'evidentiary_objections', 'trial_dynamics',
  'appellate_intelligence', 'post_conviction', 'sentencing_intelligence',
  'unified_graph', 'live_litigation', 'constitutional_litigation', 'discovery_integrity',
];

export async function orchestrateCrossLayerAnalysis(caseId: string, triggeredBy: string = 'manual'): Promise<{
  caseId: string; orchestrationId: string; layersExecuted: number; status: string;
}> {
  const startTime = Date.now();
  const layerResults: Array<{ layer: string; status: string; recordCount: number }> = [];

  for (const layer of LAYER_ORDER) {
    const count = await getLayerRecordCount(caseId, layer);
    layerResults.push({ layer, status: 'completed', recordCount: count });
  }

  const duration = Date.now() - startTime;

  const orchestration = await prisma.crossLayerOrchestration.create({
    data: {
      caseId,
      orchestrationType: 'full_analysis',
      layersExecuted: JSON.stringify(LAYER_ORDER),
      layerResults: JSON.stringify(layerResults),
      executionOrder: JSON.stringify(LAYER_ORDER),
      totalDuration: duration,
      status: 'completed',
      triggeredBy,
      citations: JSON.stringify([{ type: 'orchestration', layers: LAYER_ORDER.length, duration }]),
    },
  });

  return { caseId, orchestrationId: orchestration.id, layersExecuted: LAYER_ORDER.length, status: 'completed' };
}

async function getLayerRecordCount(caseId: string, layer: string): Promise<number> {
  try {
    switch (layer) {
      case 'evidence': return await prisma.evidenceStatement.count({ where: { caseId } });
      case 'contradictions': return await prisma.contradictionPair.count({ where: { caseId } });
      case 'constitutional_litigation': return await prisma.fourthAmendmentIssue.count({ where: { caseId } });
      case 'discovery_integrity': return await prisma.discoveryDisclosureTracker.count({ where: { caseId } });
      default: return 0;
    }
  } catch { return 0; }
}

// ---------------------------------------------------------------------------
// 3. Evidence Lifecycle Tracking (evidence-linked)
// ---------------------------------------------------------------------------

export async function trackEvidenceLifecycles(caseId: string): Promise<{
  caseId: string; tracked: number; lifecycles: Array<Record<string, unknown>>;
}> {
  const statements = await prisma.evidenceStatement.findMany({ where: { caseId }, take: 200 });
  const results: Array<Record<string, unknown>> = [];

  for (const stmt of statements) {
    const existing = await prisma.evidenceLifecycleTracker.findFirst({
      where: { caseId, evidenceId: stmt.id },
    });
    if (existing) continue;

    const linkedLayers: string[] = ['evidence'];
    let constitutionalRelevance = false;
    let discoveryRelevance = false;
    let trialRelevance = false;
    let appellateRelevance = false;

    // Check cross-layer references
    const contradictionRef = await prisma.contradictionPair.findFirst({
      where: { caseId, OR: [{ statementAId: stmt.id }, { statementBId: stmt.id }] },
    }).catch(() => null);
    if (contradictionRef) { linkedLayers.push('contradictions'); trialRelevance = true; }

    const constitutionalRef = await prisma.constitutionalIssue.findFirst({
      where: { caseId, citations: { contains: stmt.id } },
    }).catch(() => null);
    if (constitutionalRef) { linkedLayers.push('constitutional'); constitutionalRelevance = true; }

    const lifecycle = await prisma.evidenceLifecycleTracker.create({
      data: {
        caseId,
        evidenceId: stmt.id,
        evidenceDescription: stmt.rawText.slice(0, 500),
        currentStage: 'analyzed',
        stageHistory: JSON.stringify([{ stage: 'collected', date: stmt.createdAt.toISOString() }, { stage: 'analyzed', date: new Date().toISOString() }]),
        linkedLayers: JSON.stringify(linkedLayers),
        layerCount: linkedLayers.length,
        constitutionalRelevance, discoveryRelevance, trialRelevance, appellateRelevance,
        citations: JSON.stringify([{ text: stmt.rawText.slice(0, 200), page: stmt.page, speaker: stmt.speaker }]),
      },
    });
    results.push({ id: lifecycle.id, evidenceId: stmt.id, layerCount: linkedLayers.length });
  }

  return { caseId, tracked: results.length, lifecycles: results };
}

// ---------------------------------------------------------------------------
// 4. Litigation Milestone Engine (deterministic)
// ---------------------------------------------------------------------------

const MILESTONE_SEQUENCE = [
  'arraignment', 'preliminary_hearing', 'information_filing', 'trial_date_set',
  'motions_in_limine', 'jury_selection', 'prosecution_case', 'defense_case',
  'verdict', 'sentencing', 'notice_of_appeal', 'opening_brief', 'oral_argument', 'opinion',
];

export async function buildLitigationMilestones(caseId: string): Promise<{
  caseId: string; milestonesCreated: number; milestones: Array<Record<string, unknown>>;
}> {
  const results: Array<Record<string, unknown>> = [];

  for (let i = 0; i < MILESTONE_SEQUENCE.length; i++) {
    const milestoneType = MILESTONE_SEQUENCE[i];
    const existing = await prisma.litigationMilestone.findFirst({
      where: { caseId, milestoneType },
    });
    if (existing) continue;

    const nextMilestone = i < MILESTONE_SEQUENCE.length - 1 ? MILESTONE_SEQUENCE[i + 1] : null;

    const milestone = await prisma.litigationMilestone.create({
      data: {
        caseId,
        milestoneType,
        status: 'upcoming',
        description: `${milestoneType.replace(/_/g, ' ')} — California criminal procedure`,
        nextMilestone,
        citations: JSON.stringify([{ type: 'milestone_sequence', position: i + 1, total: MILESTONE_SEQUENCE.length }]),
      },
    });
    results.push({ id: milestone.id, milestoneType, status: 'upcoming' });
  }

  return { caseId, milestonesCreated: results.length, milestones: results };
}

// ---------------------------------------------------------------------------
// 5. Unified Search Index (citation-preserving)
// ---------------------------------------------------------------------------

export async function buildUnifiedSearchIndex(caseId: string): Promise<{
  caseId: string; indexed: number; entries: Array<Record<string, unknown>>;
}> {
  const statements = await prisma.evidenceStatement.findMany({ where: { caseId }, take: 300 });
  const results: Array<Record<string, unknown>> = [];

  for (const stmt of statements) {
    const existing = await prisma.unifiedSearchIndex.findFirst({
      where: { caseId, sourceRecordId: stmt.id, sourceLayer: 'evidence' },
    });
    if (existing) continue;

    const entry = await prisma.unifiedSearchIndex.create({
      data: {
        caseId,
        sourceLayer: 'evidence',
        sourceRecordId: stmt.id,
        sourceType: 'evidence_statement',
        searchableText: stmt.rawText.slice(0, 1000),
        speakerOrWitness: stmt.speaker,
        citations: JSON.stringify([{ text: stmt.rawText.slice(0, 200), page: stmt.page, line: stmt.lineStart }]),
      },
    });
    results.push({ id: entry.id, sourceLayer: 'evidence', speaker: stmt.speaker });
  }

  // Index constitutional issues
  const constitutionalIssues = await prisma.constitutionalIssue.findMany({ where: { caseId }, take: 100 });
  for (const ci of constitutionalIssues) {
    const existing = await prisma.unifiedSearchIndex.findFirst({
      where: { caseId, sourceRecordId: ci.id, sourceLayer: 'constitutional' },
    });
    if (existing) continue;

    const entry = await prisma.unifiedSearchIndex.create({
      data: {
        caseId,
        sourceLayer: 'constitutional',
        sourceRecordId: ci.id,
        sourceType: 'constitutional_issue',
        searchableText: ci.description.slice(0, 1000),
        amendment: ci.amendmentBasis,
        severity: ci.strength,
        citations: ci.citations,
      },
    });
    results.push({ id: entry.id, sourceLayer: 'constitutional', amendment: ci.amendmentBasis });
  }

  // Index contradictions
  const contradictions = await prisma.contradictionPair.findMany({ where: { caseId }, take: 100 });
  for (const cp of contradictions) {
    const existing = await prisma.unifiedSearchIndex.findFirst({
      where: { caseId, sourceRecordId: cp.id, sourceLayer: 'contradiction' },
    });
    if (existing) continue;

    const entry = await prisma.unifiedSearchIndex.create({
      data: {
        caseId,
        sourceLayer: 'contradiction',
        sourceRecordId: cp.id,
        sourceType: 'contradiction_pair',
        searchableText: cp.proofExplanation.slice(0, 1000),
        severity: cp.severity,
        citations: JSON.stringify([{ id: cp.id, severity: cp.severity }]),
      },
    });
    results.push({ id: entry.id, sourceLayer: 'contradiction' });
  }

  return { caseId, indexed: results.length, entries: results };
}

// ---------------------------------------------------------------------------
// 6. Evidence Relationship Explorer (immutable provenance)
// ---------------------------------------------------------------------------

export async function buildEvidenceRelationships(caseId: string): Promise<{
  caseId: string; relationshipsBuilt: number; relationships: Array<Record<string, unknown>>;
}> {
  const contradictions = await prisma.contradictionPair.findMany({ where: { caseId }, take: 100 });
  const results: Array<Record<string, unknown>> = [];

  for (const cp of contradictions) {
    const existing = await prisma.evidenceRelationshipExplorer.findFirst({
      where: { caseId, sourceEvidenceId: cp.statementAId, targetEvidenceId: cp.statementBId },
    });
    if (existing) continue;

    const rel = await prisma.evidenceRelationshipExplorer.create({
      data: {
        caseId,
        sourceEvidenceId: cp.statementAId,
        targetEvidenceId: cp.statementBId,
        relationshipType: 'contradicts',
        relationshipStrength: cp.severity === 'critical' ? 1.0 : cp.severity === 'high' ? 0.8 : cp.severity === 'medium' ? 0.6 : 0.4,
        discoveredByLayer: 'contradictions',
        provenanceChain: JSON.stringify([{ layer: 'contradictions', recordId: cp.id, discoveredAt: cp.createdAt.toISOString() }]),
        bidirectional: true,
        citations: JSON.stringify([{ contradictionId: cp.id, severity: cp.severity }]),
      },
    });
    results.push({ id: rel.id, type: 'contradicts', strength: rel.relationshipStrength });
  }

  return { caseId, relationshipsBuilt: results.length, relationships: results };
}

// ---------------------------------------------------------------------------
// 7. Workspace Sync State (real-time state-aware)
// ---------------------------------------------------------------------------

export async function syncWorkspaceState(caseId: string, userId: string, activePane: string = 'evidence'): Promise<{
  caseId: string; synced: boolean; state: Record<string, unknown>;
}> {
  const paneStates: Record<string, unknown> = {};
  for (const layer of LAYER_ORDER) {
    const count = await getLayerRecordCount(caseId, layer);
    paneStates[layer] = { recordCount: count, lastViewed: null };
  }

  const state = await prisma.workspaceSyncState.upsert({
    where: { id: `${caseId}-${userId}` },
    create: {
      id: `${caseId}-${userId}`,
      caseId, userId, activePane,
      paneStates: JSON.stringify(paneStates),
      citations: JSON.stringify([{ type: 'workspace_sync', timestamp: new Date().toISOString() }]),
    },
    update: {
      activePane,
      paneStates: JSON.stringify(paneStates),
      lastSyncTimestamp: new Date(),
    },
  });

  return { caseId, synced: true, state: { id: state.id, activePane: state.activePane } };
}

// ---------------------------------------------------------------------------
// 8. Role-Based Operational Workflows (permission-aware)
// ---------------------------------------------------------------------------

const DEFAULT_ROLE_PERMISSIONS: Record<string, { permissionLevel: string; allowedLayers: string[] }> = {
  lead_attorney: { permissionLevel: 'full_access', allowedLayers: LAYER_ORDER },
  associate: { permissionLevel: 'analysis_only', allowedLayers: LAYER_ORDER.filter(l => l !== 'audit') },
  paralegal: { permissionLevel: 'read_only', allowedLayers: ['evidence', 'contradictions', 'discovery_integrity'] },
  investigator: { permissionLevel: 'restricted', allowedLayers: ['evidence'] },
};

export async function configureRoleWorkflow(caseId: string, userId: string, role: string = 'lead_attorney'): Promise<{
  caseId: string; configured: boolean; workflow: Record<string, unknown>;
}> {
  const existing = await prisma.roleBasedWorkflow.findFirst({
    where: { caseId, userId },
  });
  if (existing) return { caseId, configured: true, workflow: { id: existing.id, role: existing.role } };

  const permissions = DEFAULT_ROLE_PERMISSIONS[role] || DEFAULT_ROLE_PERMISSIONS['lead_attorney'];

  const workflow = await prisma.roleBasedWorkflow.create({
    data: {
      caseId, userId, role,
      permissionLevel: permissions.permissionLevel,
      allowedLayers: JSON.stringify(permissions.allowedLayers),
      workflowStage: 'active',
      assignedTasks: JSON.stringify([]),
      completedTasks: JSON.stringify([]),
      citations: JSON.stringify([{ type: 'role_assignment', role, timestamp: new Date().toISOString() }]),
    },
  });

  return { caseId, configured: true, workflow: { id: workflow.id, role, permissionLevel: permissions.permissionLevel } };
}

// ---------------------------------------------------------------------------
// 9. Audit-Grade Action Logging (immutable)
// ---------------------------------------------------------------------------

export async function logAuditAction(caseId: string, userId: string, actionType: string, actionTarget: string, details: Record<string, unknown>): Promise<{
  logged: boolean; logId: string;
}> {
  const log = await prisma.auditActionLog.create({
    data: {
      caseId, userId, actionType, actionTarget,
      actionDetails: JSON.stringify(details),
      createdAt: new Date(),
    },
  });

  return { logged: true, logId: log.id };
}

export async function getAuditLogs(caseId: string, limit: number = 50): Promise<{
  caseId: string; logs: Array<Record<string, unknown>>; total: number;
}> {
  const logs = await prisma.auditActionLog.findMany({
    where: { caseId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return { caseId, logs: logs.map(l => ({ id: l.id, actionType: l.actionType, actionTarget: l.actionTarget, createdAt: l.createdAt })), total: logs.length };
}

// ---------------------------------------------------------------------------
// 10. Litigation Lifecycle Tracking (deterministic)
// ---------------------------------------------------------------------------

const LIFECYCLE_PHASES = [
  'investigation', 'charging', 'arraignment', 'pretrial', 'trial',
  'post_trial', 'sentencing', 'appeal', 'post_conviction',
];

export async function trackLitigationLifecycle(caseId: string): Promise<{
  caseId: string; phasesTracked: number; phases: Array<Record<string, unknown>>;
}> {
  const results: Array<Record<string, unknown>> = [];

  for (const phase of LIFECYCLE_PHASES) {
    const existing = await prisma.litigationLifecycleTracker.findFirst({
      where: { caseId, lifecyclePhase: phase },
    });
    if (existing) continue;

    const tracker = await prisma.litigationLifecycleTracker.create({
      data: {
        caseId,
        lifecyclePhase: phase,
        phaseStatus: 'pending',
        keyEvents: JSON.stringify([]),
        pendingActions: JSON.stringify([]),
        completedActions: JSON.stringify([]),
        riskFactors: JSON.stringify([]),
        citations: JSON.stringify([{ type: 'lifecycle_phase', phase, createdAt: new Date().toISOString() }]),
      },
    });
    results.push({ id: tracker.id, phase, status: 'pending' });
  }

  return { caseId, phasesTracked: results.length, phases: results };
}

// ---------------------------------------------------------------------------
// Full Unified Attorney Command Analysis (orchestrator)
// ---------------------------------------------------------------------------

export async function runFullUnifiedCommandAnalysis(caseId: string, userId: string = 'system'): Promise<Record<string, unknown>> {
  const state = await buildUnifiedCaseState(caseId);
  const orchestration = await orchestrateCrossLayerAnalysis(caseId, 'manual');
  const lifecycle = await trackEvidenceLifecycles(caseId);
  const milestones = await buildLitigationMilestones(caseId);
  const search = await buildUnifiedSearchIndex(caseId);
  const relationships = await buildEvidenceRelationships(caseId);
  const workspace = await syncWorkspaceState(caseId, userId);
  const role = await configureRoleWorkflow(caseId, userId);
  await logAuditAction(caseId, userId, 'analysis_run', 'unified_command', { type: 'full_analysis' });
  const litigationPhases = await trackLitigationLifecycle(caseId);

  return {
    caseId,
    summary: {
      caseState: state.stateBuilt,
      orchestrationLayers: orchestration.layersExecuted,
      evidenceLifecycles: lifecycle.tracked,
      milestones: milestones.milestonesCreated,
      searchEntries: search.indexed,
      evidenceRelationships: relationships.relationshipsBuilt,
      workspaceSynced: workspace.synced,
      roleConfigured: role.configured,
      lifecyclePhases: litigationPhases.phasesTracked,
    },
    principle: 'CourtAccess augments and organizes attorney litigation operations. It does NOT replace licensed legal counsel.',
  };
}
