// ============================================================================
// CourtAccess Master Production Program — Orchestrator
// Evidence-governed assessment of all 22 operational domains
// ============================================================================

import type { PhaseStatus } from './phaseDefinitions.js';
import { MASTER_PRODUCTION_PHASES } from './phaseDefinitions.js';
import { runVersion1ProductionGates } from './version1ProductionGates.js';
import { runProductionGates } from './runProductionGates.js';
import { assessProductionPrograms } from './productionCompletionPrograms.js';

export const MASTER_PROGRAM_VERSION = '11.0';

export interface AssessedCapability {
  id: string;
  name: string;
  status: 'PASS' | 'FAIL';
  blocker?: string;
}

export interface AssessedPhase {
  id: string;
  number: number;
  name: string;
  domain: string;
  status: PhaseStatus;
  completionPercent: number;
  capabilitiesComplete: number;
  capabilitiesTotal: number;
  capabilities: AssessedCapability[];
  blockers: string[];
}

export interface MasterProductionProgramReport {
  program: 'COURTACCESS_MASTER_PRODUCTION_PROGRAM';
  version: string;
  generatedAt: string;
  mission: string;
  overallStatus: 'PRODUCTION_READY' | 'NOT_READY' | 'RELEASE_CANDIDATE';
  overallCompletionPercent: number;
  phasesComplete: number;
  phasesPartial: number;
  phasesNotStarted: number;
  phasesTotal: number;
  capabilitiesComplete: number;
  capabilitiesTotal: number;
  criticalWorkflows: Array<{ id: string; name: string; status: string }>;
  releaseGates: {
    legacy: { pass: number; total: number; status: string };
    version1: { pass: number; total: number; status: string };
  };
  productionPrograms: Array<{ id: string; number: number; name: string; completionPercent: number; capabilitiesComplete: number }>;
  phases: AssessedPhase[];
  topBlockers: string[];
  nextRecommendedTasks: Array<{ priority: string; phase: string; task: string }>;
}

function phaseStatus(complete: number, total: number): PhaseStatus {
  if (complete === total) return 'COMPLETE';
  if (complete === 0) return 'NOT_STARTED';
  return 'PARTIAL';
}

export async function assessMasterProductionProgram(): Promise<MasterProductionProgramReport> {
  const phases: AssessedPhase[] = [];
  let totalCaps = 0;
  let completeCaps = 0;

  for (const phase of MASTER_PRODUCTION_PHASES) {
    const assessed: AssessedCapability[] = [];
    const blockers: string[] = [];

    for (const cap of phase.capabilities) {
      const pass = await cap.verify();
      assessed.push({ id: cap.id, name: cap.name, status: pass ? 'PASS' : 'FAIL', blocker: cap.blocker });
      totalCaps += 1;
      if (pass) completeCaps += 1;
      else if (cap.blocker) blockers.push(cap.blocker);
    }

    const complete = assessed.filter((c) => c.status === 'PASS').length;
    phases.push({
      id: phase.id,
      number: phase.number,
      name: phase.name,
      domain: phase.domain,
      status: phaseStatus(complete, assessed.length),
      completionPercent: Math.round((complete / assessed.length) * 100),
      capabilitiesComplete: complete,
      capabilitiesTotal: assessed.length,
      capabilities: assessed,
      blockers: [...new Set(blockers)],
    });
  }

  const legacyGates = await runProductionGates();
  const v1Gates = await runVersion1ProductionGates();
  const { programs: productionPrograms } = await assessProductionPrograms();

  const phasesComplete = phases.filter((p) => p.status === 'COMPLETE').length;
  const phasesPartial = phases.filter((p) => p.status === 'PARTIAL').length;
  const phasesNotStarted = phases.filter((p) => p.status === 'NOT_STARTED').length;

  const allBlockers = phases.flatMap((p) => p.blockers);
  const topBlockers = [...new Set(allBlockers)].slice(0, 10);

  const criticalWorkflows = [
    { id: 'WF-ATTORNEY', name: 'Attorney intelligence → workbench → report', status: phases.find((p) => p.id === 'PHASE-07')?.status ?? 'UNKNOWN' },
    { id: 'WF-INVESTIGATOR', name: 'Investigator assignments → evidence → field notes', status: phases.find((p) => p.id === 'PHASE-06')?.status ?? 'UNKNOWN' },
    { id: 'WF-LEGAL', name: 'Legislative pipeline → KG → attorney intelligence', status: phases.find((p) => p.id === 'PHASE-08')?.status ?? 'UNKNOWN' },
    { id: 'WF-BILLING', name: 'Stripe checkout → webhook → subscription sync', status: phases.find((p) => p.id === 'PHASE-15')?.status ?? 'UNKNOWN' },
    { id: 'WF-CLIENT', name: 'Client portal experience', status: phases.find((p) => p.id === 'PHASE-11')?.status ?? 'UNKNOWN' },
  ];

  const nextRecommendedTasks = topBlockers.slice(0, 5).map((b, i) => ({
    priority: i === 0 ? 'P0' : 'P1',
    phase: 'See blocker',
    task: b,
  }));

  const overallCompletion = Math.round((completeCaps / totalCaps) * 1000) / 10;
  const productionReady =
    legacyGates.overallResult === 'READY' &&
    v1Gates.overallResult === 'READY' &&
    phasesComplete >= 18;

  return {
    program: 'COURTACCESS_MASTER_PRODUCTION_PROGRAM',
    version: MASTER_PROGRAM_VERSION,
    generatedAt: new Date().toISOString(),
    mission: 'Complete every operational domain required for a production-grade California criminal litigation platform',
    overallStatus: productionReady ? 'PRODUCTION_READY' : overallCompletion >= 70 ? 'RELEASE_CANDIDATE' : 'NOT_READY',
    overallCompletionPercent: overallCompletion,
    phasesComplete,
    phasesPartial,
    phasesNotStarted,
    phasesTotal: phases.length,
    capabilitiesComplete: completeCaps,
    capabilitiesTotal: totalCaps,
    criticalWorkflows,
    releaseGates: {
      legacy: { pass: legacyGates.passCount, total: legacyGates.gates.length, status: legacyGates.overallResult },
      version1: { pass: v1Gates.passCount, total: v1Gates.gates.length, status: v1Gates.overallResult },
    },
    productionPrograms,
    phases,
    topBlockers,
    nextRecommendedTasks,
  };
}
