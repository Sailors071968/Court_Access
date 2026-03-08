// ============================================
// Court Access — Corpus Governance Layer
// Public API for the governance system.
// ============================================

export { CorpusRegistryRepository } from './corpusRegistry.ts';
export { CorpusLockManager } from './corpusLock.ts';
export { DuplicateDetector } from './duplicateDetector.ts';
export { CorpusVersionManager } from './corpusVersioning.ts';
export { GovernancePipeline } from './governancePipeline.ts';
export { GovernanceApiHandlers } from './governanceApi.ts';

export type {
  CorpusRegistryEntry,
  RegisterCorpusInput,
  UpdateCorpusInput,
  CorpusIngestionStatus,
  CorpusLock,
  AcquireLockInput,
  GovernedIngestionConfig,
  DuplicateReport,
  VersionDiff,
} from './types.ts';

export type { GovernancePipelineResult } from './governancePipeline.ts';
export type { ApiRequest, ApiResponse } from './governanceApi.ts';
export type { CorpusRegistryDb } from './corpusRegistry.ts';
export type { CorpusLockDb } from './corpusLock.ts';
export type { DuplicateCheckDb } from './duplicateDetector.ts';
export type { VersioningDb } from './corpusVersioning.ts';
