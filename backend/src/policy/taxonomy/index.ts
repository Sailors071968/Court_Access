/**
 * Policy Taxonomy Module — exports for the CHP-centric policy intelligence system
 */

// Phase 1-2: Canonical taxonomy definitions
export {
  POLICY_CATEGORIES,
  CATEGORY_DEFINITIONS,
  buildKeywordCategoryMap,
  getAllExpectedTopics,
  getTaxonomySummary,
  type PolicyCategory,
  type CategoryDefinition,
  type FlatTopic,
} from './chpPolicyTaxonomy.js';

// Phase 3: CHP topic extraction
export {
  seedPolicyTopics,
  extractTopicsFromChpDocuments,
  runChpTopicExtraction,
  type ExtractedTopic,
  type ExtractionResult,
} from './extractChpPolicyTopics.js';

// Phase 5: Policy-to-topic mapping
export {
  mapDocumentToTopic,
  mapAgencyDocuments,
  classifyTextToCategory,
  type TopicMatch,
  type MappingResult,
} from './policyTopicMapper.js';

// Phase 6: Agency policy discovery
export {
  discoverAgencyPolicies,
  discoverPoliciesByRank,
  type DiscoveryResult,
} from './agencyPolicyDiscovery.js';

// Phase 7: Policy matching engine
export {
  matchDocumentToTopic,
  matchAgencyDocuments,
  updateAgencyCoverage,
  matchAllPendingDocuments,
  type MatchResult,
  type BatchMatchResult,
} from './policyMatchingEngine.js';

// Phase 8: Comparative policy engine
export {
  compareAgencies,
  compareMultipleAgencies,
  compareAgainstChp,
  getAgencyGapAnalysis,
  getCategoryCoverage,
  getCoverageMatrix,
  type AgencyPolicySnapshot,
  type PolicyComparison,
  type ComparisonResult,
  type GapAnalysis,
} from './comparativePolicyEngine.js';

// Phase 9: Coverage tracking
export {
  getAgencyCoverageReport,
  getSystemCoverageStats,
  getCoverageHeatmap,
  initializeAgencyCoverage,
  type AgencyCoverageReport,
  type CategoryCoverage,
  type TopicCoverageEntry,
  type SystemCoverageStats,
} from './policyCoverageTracker.js';

// Phase 15: Classification pipeline
export {
  classifyDocumentText,
  classifyDocument,
  classifyAgencyDocuments,
  classifyAllPendingDocuments,
  classifyAfterOcr,
  type ClassificationResult,
  type BatchClassificationResult,
} from './classificationPipeline.js';

// Phase 16: Coverage populator
export {
  populateAgencyCoverage,
  populateAllAgencyCoverage,
  updateCoverageAfterClassification,
  getCoverageSummary,
  type CoveragePopulationResult,
  type SystemCoveragePopulationResult,
} from './coveragePopulator.js';

// Phase 19: Intelligence flag detector
export {
  detectAgencyFlags,
  detectSystemFlags,
  type IntelligenceFlag,
  type AgencyFlagReport,
  type SystemFlagSummary,
  type FlagSeverity,
} from './intelligenceFlagDetector.js';

// Phase 20: System safety
export {
  SAFETY_LIMITS,
  getSystemSafetyStatus,
  validateDocumentSize,
  validatePageCount,
  calculateRetry,
  getSafeJobOptions,
  rateLimitDelay,
  incrementActiveCrawls,
  decrementActiveCrawls,
  type SafetyLimits,
  type SafetyStatus,
  type RetryConfig,
} from './systemSafety.js';

// API Route Handlers
export {
  POLICY_INTELLIGENCE_ROUTES,
  handleDashboard,
  handleTaxonomySummary,
  handleTaxonomyCategories,
  handleTaxonomyTopics,
  handleTaxonomySeed,
  handleAgenciesList,
  handleAgencyDetail,
  handleAgencyGapAnalysis,
  handleMatchDocument,
  handleMatchAgency,
  handleMatchAll,
  handleCompareAgencies,
  handleCompareAgainstChp,
  handleCoverageStats,
  handleCoverageMatrix,
  handleCoverageHeatmap,
  handleCategoryDetail,
  handleAgencyFlags,
  handleSystemFlags,
  handleSafetyStatus,
  handleClassifyAgency,
  handleClassifyAll,
  handleCoverageSummary,
  type RouteResponse,
} from './taxonomyRoutes.js';
