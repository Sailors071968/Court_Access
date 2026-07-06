// ============================================
// Court Access — Doctrine Intelligence Module
// Public API barrel file
// ============================================

export { doctrineStore } from './doctrineStore.ts';
export { doctrineEmbeddingPipeline } from './doctrineEmbeddingPipeline.ts';
export { DoctrineComplianceEngine } from './doctrineComplianceEngine.ts';
export { DoctrineIngestionService } from './doctrineIngestionService.ts';
export { registerDoctrineRoutes } from './doctrineRoutes.ts';
export { parseDoctrineText, generateDoctrineId } from './doctrinePdfParser.ts';
export { LD15_DOCTRINE_RULES, SEED_RULE_COUNT } from './doctrineSeedData.ts';
export { LD16_DOCTRINE_RULES, LD16_RULE_COUNT } from './seedLD16.ts';
export { LD17_DOCTRINE_RULES, LD17_RULE_COUNT } from './seedLD17.ts';
export { LD18_DOCTRINE_RULES, LD18_RULE_COUNT } from './seedLD18.ts';
export { LD20_DOCTRINE_RULES, LD20_RULE_COUNT } from './seedLD20.ts';
export { LD21_DOCTRINE_RULES, LD21_RULE_COUNT } from './seedLD21.ts';
export { LD24_DOCTRINE_RULES, LD24_RULE_COUNT } from './seedLD24.ts';
export { LD30_DOCTRINE_RULES, LD30_RULE_COUNT } from './seedLD30.ts';

export type {
  DoctrineRule,
  DoctrineSourceType,
  DoctrineCategory,
  DoctrineFlagType,
  DoctrineMatch,
  DoctrineComplianceResult,
  DoctrineSearchOptions,
  DoctrineIngestionResult,
  DoctrineStats,
  ParsedDoctrineChunk,
} from './types.ts';
