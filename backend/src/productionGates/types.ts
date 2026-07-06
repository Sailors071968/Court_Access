// ============================================================================
// Program 1 — Production Gates (Master Production Program v4.0)
// ============================================================================

export type GateResult = 'PASS' | 'FAIL' | 'PARTIAL' | 'SKIP';

export interface ProductionGate {
  id: string;
  name: string;
  program: string;
  result: GateResult;
  checks: { pass: number; total: number };
  testSteps: string[];
  evidence: string[];
  blockers: string[];
  recoveryBehavior: string;
}

export interface ProductionGatesReport {
  generatedAt: string;
  version: string;
  program: 'PRODUCTION_CERTIFICATION';
  overallResult: 'READY' | 'NOT_READY';
  deploymentBlocked: boolean;
  passCount: number;
  failCount: number;
  partialCount: number;
  skipCount: number;
  gates: ProductionGate[];
  blockers: string[];
}

export function gatePasses(result: GateResult): boolean {
  return result === 'PASS';
}

export function summarizeGates(gates: ProductionGate[]): Pick<
  ProductionGatesReport,
  'passCount' | 'failCount' | 'partialCount' | 'skipCount' | 'blockers' | 'overallResult' | 'deploymentBlocked'
> {
  const passCount = gates.filter((g) => g.result === 'PASS').length;
  const failCount = gates.filter((g) => g.result === 'FAIL').length;
  const partialCount = gates.filter((g) => g.result === 'PARTIAL').length;
  const skipCount = gates.filter((g) => g.result === 'SKIP').length;
  const blockers = gates
    .filter((g) => g.result !== 'PASS')
    .flatMap((g) => g.blockers.map((b) => `${g.id}: ${b}`));
  const deploymentBlocked = failCount > 0 || partialCount > 0 || skipCount > 0;
  return {
    passCount,
    failCount,
    partialCount,
    skipCount,
    blockers,
    deploymentBlocked,
    overallResult: deploymentBlocked ? 'NOT_READY' : 'READY',
  };
}
