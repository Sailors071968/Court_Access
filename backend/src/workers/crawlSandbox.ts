// ============================================================================
// Phase 71 — Controlled Crawl Sandbox
// Test crawl configuration for 10 pilot agencies before full 714-agency run.
// Verifies full pipeline: crawl → discover → download → OCR → classify → coverage.
// ============================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SandboxAgency {
  name: string;
  city: string;
  state: string;
  expectedWebsite: string;
  populationEstimate: number;
  priority: number; // 1 = highest
}

export interface SandboxPipelineStep {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt: string | null;
  completedAt: string | null;
  itemsProcessed: number;
  errors: string[];
  duration: number | null; // milliseconds
}

export interface SandboxAgencyResult {
  agency: SandboxAgency;
  agencyId: string | null; // DB id once created
  steps: {
    crawl: SandboxPipelineStep;
    discover: SandboxPipelineStep;
    download: SandboxPipelineStep;
    ocr: SandboxPipelineStep;
    classification: SandboxPipelineStep;
    coverageMapping: SandboxPipelineStep;
  };
  overallStatus: 'pending' | 'running' | 'completed' | 'partial' | 'failed';
  startedAt: string | null;
  completedAt: string | null;
  totalDuration: number | null;
}

export interface SandboxRunConfig {
  maxPagesPerAgency: number;
  maxCrawlTimeMs: number;
  requestDelayMs: number;
  respectRobotsTxt: boolean;
  maxConcurrentAgencies: number;
  dryRun: boolean; // if true, log actions but don't execute
}

export interface SandboxRunResult {
  runId: string;
  config: SandboxRunConfig;
  agencies: SandboxAgencyResult[];
  startedAt: string;
  completedAt: string | null;
  overallStatus: 'pending' | 'running' | 'completed' | 'partial' | 'failed';
  summary: {
    totalAgencies: number;
    completedAgencies: number;
    failedAgencies: number;
    totalPoliciesFound: number;
    totalDocumentsDownloaded: number;
    totalDocumentsOcrd: number;
    totalDocumentsClassified: number;
    totalCoverageMappings: number;
  };
}

// ---------------------------------------------------------------------------
// Sandbox Agencies (10 pilot agencies)
// ---------------------------------------------------------------------------

export const SANDBOX_AGENCIES: SandboxAgency[] = [
  {
    name: 'Los Angeles Police Department',
    city: 'Los Angeles',
    state: 'CA',
    expectedWebsite: 'https://www.lapdonline.org',
    populationEstimate: 3_900_000,
    priority: 1,
  },
  {
    name: 'San Diego Police Department',
    city: 'San Diego',
    state: 'CA',
    expectedWebsite: 'https://www.sandiego.gov/police',
    populationEstimate: 1_400_000,
    priority: 2,
  },
  {
    name: 'San Jose Police Department',
    city: 'San Jose',
    state: 'CA',
    expectedWebsite: 'https://www.sjpd.org',
    populationEstimate: 1_030_000,
    priority: 3,
  },
  {
    name: 'Sacramento Police Department',
    city: 'Sacramento',
    state: 'CA',
    expectedWebsite: 'https://www.cityofsacramento.gov/police',
    populationEstimate: 525_000,
    priority: 4,
  },
  {
    name: 'Oakland Police Department',
    city: 'Oakland',
    state: 'CA',
    expectedWebsite: 'https://www.oaklandca.gov/departments/police',
    populationEstimate: 433_000,
    priority: 5,
  },
  {
    name: 'Long Beach Police Department',
    city: 'Long Beach',
    state: 'CA',
    expectedWebsite: 'https://www.longbeach.gov/police',
    populationEstimate: 466_000,
    priority: 6,
  },
  {
    name: 'Fresno Police Department',
    city: 'Fresno',
    state: 'CA',
    expectedWebsite: 'https://www.fresno.gov/police',
    populationEstimate: 542_000,
    priority: 7,
  },
  {
    name: 'Riverside Police Department',
    city: 'Riverside',
    state: 'CA',
    expectedWebsite: 'https://www.riversideca.gov/rpd',
    populationEstimate: 314_000,
    priority: 8,
  },
  {
    name: 'Stockton Police Department',
    city: 'Stockton',
    state: 'CA',
    expectedWebsite: 'https://www.stocktonca.gov/government/departments/police',
    populationEstimate: 320_000,
    priority: 9,
  },
  {
    name: 'Santa Ana Police Department',
    city: 'Santa Ana',
    state: 'CA',
    expectedWebsite: 'https://www.santa-ana.org/police-department',
    populationEstimate: 310_000,
    priority: 10,
  },
];

// ---------------------------------------------------------------------------
// Default Run Config
// ---------------------------------------------------------------------------

export const DEFAULT_SANDBOX_CONFIG: SandboxRunConfig = {
  maxPagesPerAgency: 200,
  maxCrawlTimeMs: 5 * 60 * 1000, // 5 minutes
  requestDelayMs: 1000, // 1 req/sec
  respectRobotsTxt: true,
  maxConcurrentAgencies: 2,
  dryRun: false,
};

// ---------------------------------------------------------------------------
// Sandbox State
// ---------------------------------------------------------------------------

let currentRun: SandboxRunResult | null = null;

function createEmptyStep(): SandboxPipelineStep {
  return {
    name: '',
    status: 'pending',
    startedAt: null,
    completedAt: null,
    itemsProcessed: 0,
    errors: [],
    duration: null,
  };
}

function createAgencyResult(agency: SandboxAgency): SandboxAgencyResult {
  return {
    agency,
    agencyId: null,
    steps: {
      crawl: { ...createEmptyStep(), name: 'crawl' },
      discover: { ...createEmptyStep(), name: 'discover' },
      download: { ...createEmptyStep(), name: 'download' },
      ocr: { ...createEmptyStep(), name: 'ocr' },
      classification: { ...createEmptyStep(), name: 'classification' },
      coverageMapping: { ...createEmptyStep(), name: 'coverageMapping' },
    },
    overallStatus: 'pending',
    startedAt: null,
    completedAt: null,
    totalDuration: null,
  };
}

// ---------------------------------------------------------------------------
// Sandbox Operations
// ---------------------------------------------------------------------------

/**
 * Initialize a new sandbox run.
 */
export function initializeSandboxRun(
  config: SandboxRunConfig = DEFAULT_SANDBOX_CONFIG,
): SandboxRunResult {
  const run: SandboxRunResult = {
    runId: `sandbox_${Date.now()}`,
    config,
    agencies: SANDBOX_AGENCIES.map(createAgencyResult),
    startedAt: new Date().toISOString(),
    completedAt: null,
    overallStatus: 'pending',
    summary: {
      totalAgencies: SANDBOX_AGENCIES.length,
      completedAgencies: 0,
      failedAgencies: 0,
      totalPoliciesFound: 0,
      totalDocumentsDownloaded: 0,
      totalDocumentsOcrd: 0,
      totalDocumentsClassified: 0,
      totalCoverageMappings: 0,
    },
  };

  currentRun = run;
  return run;
}

/**
 * Update a step status for a specific agency in the current run.
 */
export function updateAgencyStep(
  agencyIndex: number,
  stepName: keyof SandboxAgencyResult['steps'],
  update: Partial<SandboxPipelineStep>,
): void {
  if (!currentRun || agencyIndex >= currentRun.agencies.length) return;

  const step = currentRun.agencies[agencyIndex].steps[stepName];
  Object.assign(step, update);

  // Calculate duration if completed
  if (update.status === 'completed' && step.startedAt) {
    step.duration = new Date(step.completedAt ?? new Date().toISOString()).getTime() -
                    new Date(step.startedAt).getTime();
  }
}

/**
 * Mark an agency's overall status.
 */
export function updateAgencyStatus(
  agencyIndex: number,
  status: SandboxAgencyResult['overallStatus'],
): void {
  if (!currentRun || agencyIndex >= currentRun.agencies.length) return;

  const agency = currentRun.agencies[agencyIndex];
  agency.overallStatus = status;

  if (status === 'completed' || status === 'failed' || status === 'partial') {
    agency.completedAt = new Date().toISOString();
    if (agency.startedAt) {
      agency.totalDuration =
        new Date(agency.completedAt).getTime() - new Date(agency.startedAt).getTime();
    }
  }

  if (status === 'running' && !agency.startedAt) {
    agency.startedAt = new Date().toISOString();
  }

  // Update summary
  updateSummary();
}

/**
 * Update the run summary based on current agency statuses.
 */
function updateSummary(): void {
  if (!currentRun) return;

  let completed = 0;
  let failed = 0;
  let policiesFound = 0;
  let downloaded = 0;
  let ocrd = 0;
  let classified = 0;
  let coverage = 0;

  for (const a of currentRun.agencies) {
    if (a.overallStatus === 'completed') completed++;
    if (a.overallStatus === 'failed') failed++;
    policiesFound += a.steps.discover.itemsProcessed;
    downloaded += a.steps.download.itemsProcessed;
    ocrd += a.steps.ocr.itemsProcessed;
    classified += a.steps.classification.itemsProcessed;
    coverage += a.steps.coverageMapping.itemsProcessed;
  }

  currentRun.summary = {
    totalAgencies: currentRun.agencies.length,
    completedAgencies: completed,
    failedAgencies: failed,
    totalPoliciesFound: policiesFound,
    totalDocumentsDownloaded: downloaded,
    totalDocumentsOcrd: ocrd,
    totalDocumentsClassified: classified,
    totalCoverageMappings: coverage,
  };

  // Overall status
  if (completed + failed === currentRun.agencies.length) {
    currentRun.overallStatus = failed > 0 ? 'partial' : 'completed';
    currentRun.completedAt = new Date().toISOString();
  }
}

// ---------------------------------------------------------------------------
// Sandbox Query
// ---------------------------------------------------------------------------

/**
 * Get the current sandbox run status.
 */
export function getSandboxRunStatus(): SandboxRunResult | null {
  return currentRun;
}

/**
 * Get sandbox agency list with their websites.
 */
export function getSandboxAgencies(): SandboxAgency[] {
  return [...SANDBOX_AGENCIES];
}

/**
 * Get pipeline verification checklist.
 */
export function getPipelineChecklist(): Array<{
  step: string;
  description: string;
  verificationCriteria: string;
}> {
  return [
    {
      step: 'crawl',
      description: 'Crawl agency website',
      verificationCriteria: 'Pages discovered > 0, no timeout, respects robots.txt',
    },
    {
      step: 'discover',
      description: 'Discover policy documents',
      verificationCriteria: 'Policy URLs found > 0, valid URLs, no duplicates',
    },
    {
      step: 'download',
      description: 'Download policy documents',
      verificationCriteria: 'Files downloaded to S3, correct MIME types, within size limits',
    },
    {
      step: 'ocr',
      description: 'Extract text via OCR',
      verificationCriteria: 'Text extracted from PDFs, non-empty content, reasonable confidence',
    },
    {
      step: 'classification',
      description: 'Classify by policy topic',
      verificationCriteria: 'Topics assigned with confidence > 0.65, low-confidence flagged for review',
    },
    {
      step: 'coverageMapping',
      description: 'Map to coverage matrix',
      verificationCriteria: 'PolicyCoverage rows created, policyFound=true for matched topics',
    },
  ];
}

/**
 * Reset sandbox state.
 */
export function resetSandbox(): void {
  currentRun = null;
}
