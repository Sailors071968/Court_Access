// ---------------------------------------------------------------------------
// Agency Registry — Type definitions
// ---------------------------------------------------------------------------

export interface PostAgencyEntry {
  agencyName: string;
  website: string | null;
  postDirectoryUrl: string;
  isPostParticipating: boolean;
  contractCity: string | null; // e.g. "see Humboldt County Sheriff's Office"
}

export type AgencyType =
  | 'Police'
  | 'Sheriff'
  | 'State'
  | 'TaskForce'
  | 'Probation'
  | 'Corrections'
  | 'District_Attorney'
  | 'University'
  | 'Transit'
  | 'Communications'
  | 'Coroner'
  | 'School_District'
  | 'Community_College'
  | 'Harbor'
  | 'Airport'
  | 'Park_Ranger'
  | 'Other';

export interface AgencyRecord {
  agencyName: string;
  agencyType: AgencyType;
  city: string | null;
  county: string | null;
  website: string | null;
  postDirectoryUrl: string;
  populationEstimate: number | null;
  jurisdictionRank: number | null;
}

export interface CrawlResult {
  agencyId: string;
  pagesFound: number;
  policyPagesFound: number;
  policyUrls: string[];
  documentUrls: DocumentUrl[];
  error: string | null;
}

export interface DocumentUrl {
  url: string;
  title: string | null;
  mimeType: string | null;
  estimatedType: string | null;
}

export interface PolicyClassification {
  documentType: string;
  confidence: number;
}

export const DOCUMENT_TYPES = [
  'USE_OF_FORCE',
  'INTERNAL_AFFAIRS',
  'BODY_CAMERA',
  'DISCIPLINE',
  'TRAINING',
  'GENERAL_POLICY',
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const CRAWL_STATUSES = [
  'pending',
  'in_progress',
  'completed',
  'failed',
  'skipped',
] as const;

export type CrawlStatus = (typeof CRAWL_STATUSES)[number];

export interface PipelineStats {
  totalAgencies: number;
  websitesFound: number;
  sitesCrawled: number;
  documentsFound: number;
  documentsDownloaded: number;
  documentsOcr: number;
  documentsClassified: number;
  crawlInProgress: number;
  crawlFailed: number;
}

// Crawler safety configuration
export interface CrawlerConfig {
  maxConcurrentSites: number;
  requestsPerSecondPerSite: number;
  maxPagesPerSite: number;
  maxDocumentSizeBytes: number;
  userAgent: string;
  requestTimeoutMs: number;
}

export const DEFAULT_CRAWLER_CONFIG: CrawlerConfig = {
  maxConcurrentSites: 2,
  requestsPerSecondPerSite: 1,
  maxPagesPerSite: 200,
  maxDocumentSizeBytes: 50 * 1024 * 1024, // 50MB
  userAgent:
    'CourtAccess-PolicyCrawler/1.0 (Legal Research; contact@courtaccess.com)',
  requestTimeoutMs: 30000,
};

// Policy keywords for page identification
export const POLICY_KEYWORDS = [
  'policy',
  'policies',
  'policy manual',
  'use of force',
  'use-of-force',
  'internal affairs',
  'discipline',
  'training manual',
  'body camera',
  'body-worn camera',
  'body worn camera',
  'records request',
  'cpra',
  'general orders',
  'general order',
  'standard operating',
  'sop',
  'department manual',
  'operations manual',
  'rules and regulations',
  'discipline matrix',
  'training bulletin',
];

// Document type classification keywords
export const CLASSIFICATION_KEYWORDS: Record<DocumentType, string[]> = {
  USE_OF_FORCE: [
    'use of force',
    'use-of-force',
    'force continuum',
    'force options',
    'deadly force',
    'less lethal',
    'force report',
    'response to resistance',
    'control techniques',
    'de-escalation',
    'force review',
  ],
  INTERNAL_AFFAIRS: [
    'internal affairs',
    'internal investigation',
    'citizen complaint',
    'personnel complaint',
    'misconduct',
    'ia investigation',
    'professional standards',
    'office of inspector',
    'complaint investigation',
  ],
  BODY_CAMERA: [
    'body camera',
    'body-worn camera',
    'body worn camera',
    'bwc',
    'video recording',
    'audio video',
    'recording device',
    'in-car camera',
    'dash camera',
    'dashcam',
  ],
  DISCIPLINE: [
    'discipline',
    'discipline matrix',
    'disciplinary',
    'corrective action',
    'penalty guide',
    'progressive discipline',
    'suspension',
    'termination',
    'demotion',
  ],
  TRAINING: [
    'training manual',
    'training bulletin',
    'training guide',
    'academy',
    'field training',
    'continuing education',
    'fto',
    'field training officer',
    'in-service training',
  ],
  GENERAL_POLICY: [
    'general order',
    'general orders',
    'policy manual',
    'department manual',
    'operations manual',
    'standard operating',
    'rules and regulations',
    'department policy',
    'administrative policy',
  ],
};
