// ============================================================================
// CALCRIM Module — Public API
// ============================================================================

export { CALCRIM_DATABASE, findByCalcrimNumber, findByPenalCode, findByCategory, searchCalcrim, getCategories } from './calcrimDatabase';
export type { CalcrimInstruction, CalcrimElement } from './calcrimDatabase';

export { analyzeCharge, analyzeFullCase, getAllCalcrimInstructions } from './calcrimAnalysisEngine';
export type {
  ElementStrength,
  ElementAnalysis,
  InvestigativeTask,
  LegalInstrument,
  DefenseStrategy,
  Inconsistency,
  ChargeAnalysisResult,
  FullCaseAnalysis,
} from './calcrimAnalysisEngine';
