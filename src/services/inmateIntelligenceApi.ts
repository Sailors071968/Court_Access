// New Inmate Intelligence System API client. Administrator-only; the server
// enforces that independently on every route, so nothing here is a security
// boundary — it exists so eight pages agree on the shape of the data.

import { authorizedFetch, describeFailure } from './session';

const API_BASE = '/api/admin/intelligence';

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await authorizedFetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers as Record<string, string> | undefined) },
  });
  const body = await res.text();
  if (!res.ok) throw new Error(await describeFailure(res, body));
  return body ? (JSON.parse(body) as T) : ({} as T);
}

const query = (params: Record<string, string | number | boolean | undefined>): string => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DashboardSummary {
  session: {
    date: string;
    isToday: boolean;
    batchIds: string[];
    filesProcessed: number;
    processingTimeMs: number;
    facilities: string[];
    rosterDates: string[];
  };
  results: {
    recordsRead: number;
    newInmates: number;
    returningInmates: number;
    knownInmates: number;
    reviewRequired: number;
    conflicts: number;
    departures: number;
    failed: number;
  };
  repository: {
    people: number;
    bookings: number;
    inCustody: number;
    awaitingReview: number;
    unresolvedConflicts: number;
  };
  issues: { severity: string; code: string; message: string; batchId: string; lineNumber: number | null }[];
  uploads: {
    uploadId: string;
    filename: string;
    fileKind: string;
    status: string;
    stage: string | null;
    sizeBytes: number;
    uploadedByName: string | null;
    uploadedAt: string;
    durationMs: number | null;
  }[];
}

export interface RosterUpload {
  uploadId: string;
  facility: string;
  filename: string;
  fileKind: string;
  sizeBytes: number;
  sha256: string;
  rosterDate: string | null;
  rosterKind: string;
  uploadedAt: string;
  uploadedById: string;
  uploadedByName: string | null;
  status: string;
  stage: string | null;
  progressDone: number | null;
  progressTotal: number | null;
  batchId: string | null;
  processedAt: string | null;
  durationMs: number | null;
  failureReason: string | null;
  counts: Record<string, number> | null;
}

export interface UploadAccepted {
  uploadId: string;
  originalName: string;
  sizeBytes: number;
  sha256: string;
  fileKind: string;
  duplicateOf?: { uploadId: string; uploadedAt: string; status: string };
}

export interface NewInmateRow {
  inmateId: string;
  name: string;
  dateOfBirth: string | null;
  sex: string | null;
  race: string | null;
  identityConfidence: number;
  discoveredOn: string;
  facility: string;
  externalBookingId: string | null;
  arrestingAgency: string | null;
  bailAmount: string | null;
  charges: { statute: string | null; description: string | null; severity: string; counts: number; rawText: string }[];
  priorArrestCount: number;
  totalArrestCount: number;
  provenance: { batchId: string; filename: string; rosterDate: string | null };
}

export interface PersonSearchRow {
  inmateId: string;
  name: string;
  first: string;
  last: string;
  middle: string | null;
  dateOfBirth: string | null;
  sex: string | null;
  race: string | null;
  bookingCount: number;
  aliasCount: number;
  externalIds: string[];
  onWatchList: boolean;
  identityConfidence: number;
  firstSeenAt: string;
  lastSeenAt: string;
  latestBooking: {
    bookingId: string;
    bookedAt: string | null;
    releasedAt: string | null;
    facility: string;
    externalBookingId: string | null;
    housingLocation: string | null;
    bailAmount: string | null;
    inCustody: boolean;
  } | null;
}

export interface BookingView {
  bookingId: string;
  facility: string;
  externalBookingId: string | null;
  bookedAt: string | null;
  releasedAt: string | null;
  custodyStatus: string | null;
  housingLocation: string | null;
  arrestingAgency: string | null;
  bailAmount: string | null;
  isFirstAppearance: boolean;
  departedRosterAt: string | null;
  lastObservedAt: string | null;
  observationCount: number;
  charges: {
    chargeId: string;
    statuteCode: string | null;
    statuteSection: string | null;
    description: string | null;
    severity: string;
    counts: number;
    bailAmount: string | null;
    rawText: string;
  }[];
}

export interface PersonDetail {
  identity: {
    inmateId: string;
    name: string;
    first: string;
    last: string;
    middle: string | null;
    suffix: string | null;
    dateOfBirth: string | null;
    sex: string | null;
    race: string | null;
    identityConfidence: number;
    bookingCount: number;
    firstSeenAt: string;
    lastSeenAt: string;
    onWatchList: boolean;
    mergedIntoId: string | null;
    externalIds: { facility: string; externalId: string; occurrences: number }[];
  };
  aliases: {
    aliasId: string;
    name: string;
    first: string;
    last: string;
    middle: string | null;
    dateOfBirth: string | null;
    occurrences: number;
    firstSeenBatchId: string | null;
  }[];
  currentBooking: BookingView | null;
  historicalBookings: BookingView[];
  timeline: { at: string; kind: string; label: string; detail: string | null; bookingId: string | null }[];
  bailHistory: { at: string; source: string; amount: string | null; bookingId: string }[];
  housingHistory: { at: string; source: string; location: string | null; bookingId: string }[];
  evidence: {
    observationId: string;
    bookingId: string;
    observedAt: string;
    rosterDate: string | null;
    sourceType: string;
    sourcePage: number | null;
    sourceRow: number | null;
    document: { filename: string; sha256: string } | null;
  }[];
  importHistory: {
    batchId: string;
    filename: string;
    sourceType: string;
    facility: string;
    rosterDate: string | null;
    startedAt: string;
    resolution: string;
    confidence: number | null;
    tier: string | null;
    recordId: string;
    lineNumber: number;
  }[];
  intelligence: {
    itemId: string;
    type: string;
    engine: string;
    confidence: number;
    explanation: string;
    disposition: string;
    severity: string;
    createdAt: string;
  }[];
}

export interface MatchReason { code: string; detail: string; weight: number }
export interface MatchConflict { code: string; detail: string; existing?: string; incoming?: string; blocking: boolean }

export interface ReviewItem {
  recordId: string;
  lineNumber: number;
  createdAt: string;
  confidence: number | null;
  tier: string | null;
  evidence: {
    confidence?: number;
    tier?: string;
    reasons?: MatchReason[];
    conflicts?: MatchConflict[];
    rejectedCandidates?: { inmateId: string; name?: string; reason?: string }[];
    reviewRationale?: string;
    policyRule?: string;
    foundBy?: string[];
    candidateSetTruncated?: boolean;
  } | null;
  subject: {
    last: string;
    first: string;
    middle: string | null;
    dateOfBirth: string | null;
    sex: string | null;
    race: string | null;
    bookedAt: string;
    externalBookingId: string | null;
    externalPersonId: string | null;
    facility: string;
    housingLocation: string | null;
    bailAmountCents: number | null;
    charges: { statuteCode: string | null; description: string | null; severity: string; rawText: string }[];
  } | null;
  candidate: {
    inmateId: string;
    name: string;
    middle: string | null;
    dateOfBirth: string | null;
    sex: string | null;
    race: string | null;
    bookingCount: number;
    identityConfidence: number;
    firstSeenAt: string;
    lastSeenAt: string;
    aliases: { name: string; dateOfBirth: string | null }[];
    externalIds: string[];
    recentBookings: {
      bookingId: string;
      bookedAt: string | null;
      releasedAt: string | null;
      facility: string;
      externalBookingId: string | null;
      housingLocation: string | null;
    }[];
  } | null;
  batch: { batchId: string; filename: string; facility: string; sourceType: string; rosterDate: string | null };
}

export interface ImportHistoryRow {
  batchId: string;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  operator: string | null;
  operatorId: string | null;
  trigger: string;
  facility: string;
  filename: string;
  fileKind: string;
  sizeBytes: number | null;
  sourceType: string;
  sha256: string;
  rosterDate: string | null;
  rosterKind: string;
  status: string;
  failureReason: string | null;
  parserVersion: number | null;
  normalizationVersion: string | null;
  recordsTotal: number;
  newInmates: number;
  matched: number;
  duplicates: number;
  reviewRequired: number;
  failed: number;
  errors: number;
  warnings: number;
  issueCount: number;
}

export interface IntelligenceSettings {
  scope: {
    facilities: string[];
    manualUploadsOnly: boolean;
    schedulerEnabled: boolean;
    watchListNotificationsEnabled: boolean;
    maxUploadBytes: number;
    acceptedFileTypes: string[];
  };
  facilities: { code: string; name: string; county: string | null; rostersAreFullPopulation: boolean; active: boolean }[];
  parserProfiles: {
    profileId: string;
    facility: string;
    sourceType: string;
    version: number;
    label: string;
    effectiveFrom: string | null;
    effectiveTo: string | null;
    changeNote: string | null;
  }[];
  totals: { uploads: number; imports: number };
}

// ---------------------------------------------------------------------------
// Calls
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Import Inspection Mode
// ---------------------------------------------------------------------------

export interface TypeInference {
  type: string;
  confidence: number;
  rationale: string;
  detectedFormats?: string[];
  statistics: {
    rowsSeen: number;
    rowsPopulated: number;
    distinctValues: number;
    looksUnique: boolean;
    minLength: number;
    maxLength: number;
    samples: string[];
  };
}

export interface ColumnFinding {
  position: number;
  header: string;
  mappedTo: string | null;
  mappedBy: string;
  inference: TypeInference;
  suggestions: { field: string; confidence: number; reason: string }[];
  duplicate: boolean;
  typeMismatch: string | null;
}

export interface InspectionReport {
  inspectionId?: string;
  file: { filename: string; sizeBytes: number; sha256: string; kind: string };
  facility: string;
  profile: {
    profileId: string | null;
    version: number | null;
    label: string;
    sourceType: string;
    isFallback: boolean;
    expectedHeaders: string[];
  };
  structure: {
    rowsSampled: number;
    headerRow: string[];
    ragged: { line: number; fields: number }[];
    encodingWarnings: string[];
    pageCount?: number;
    hasTextLayer?: boolean;
    ocrWouldBeUsed?: boolean;
    sampleLines?: string[];
  };
  columns: ColumnFinding[];
  summary: {
    recognized: string[];
    unknown: string[];
    missingRequired: string[];
    duplicated: string[];
    emptyThoughMapped: string[];
    suggestedMappings: { header: string; field: string; confidence: number }[];
  };
  compatibility: {
    verdict: 'would_import' | 'would_import_with_warnings' | 'would_be_refused';
    reasons: string[];
    parserConfidence: number;
  };
  suggestedProfileUpdate: {
    basedOnVersion: number | null;
    addedAliases: { field: string; alias: string }[];
  } | null;
  inspectedAt: string;
}

export interface InspectionSummaryRow {
  inspectionId: string;
  facility: string;
  filename: string;
  sha256: string;
  sizeBytes: number;
  fileKind: string;
  profileVersion: number | null;
  verdict: string;
  parserConfidence: number;
  inspectedById: string | null;
  inspectedAt: string;
}

export interface MappingEditorState {
  facility: string;
  sourceType: string;
  active: {
    profileId: string | null;
    version: number | null;
    label: string;
    isFallback: boolean;
    expectedHeaders: string[];
    dateFormats: string[];
    nameOrder: string;
    chargeSeparator: string;
    mappings: { field: string; label: string; note: string; aliases: string[]; required: boolean }[];
  };
  versionHistory: {
    profileId: string;
    version: number;
    label: string;
    effectiveFrom: string | null;
    effectiveTo: string | null;
    changeNote: string | null;
    mappedFields: number;
  }[];
  canonicalFields: { field: string; label: string; note: string }[];
}

// ---------------------------------------------------------------------------
// Operations console
// ---------------------------------------------------------------------------

export interface MorningSummary {
  headline: string;
  posture: 'ok' | 'attention' | 'action_required';
  lastSuccessfulImport: {
    batchId: string; at: string; rosterDate: string | null;
    filename: string; operator: string | null; hoursAgo: number;
  } | null;
  today: {
    date: string; processed: boolean; batchesStarted: number;
    batchesCompleted: number; batchesFailed: number; batchesInProgress: number;
    todaysRosterImported: boolean;
  };
  intelligence: {
    newInmates: number; returningInmates: number; watchListMatches: number;
    unresolvedReviewItems: number; unresolvedConflicts: number; significantChanges: number;
  };
  parserWarnings: { facility: string; sourceType: string; message: string; severity: string }[];
  health: {
    database: string; facilitiesConfigured: number; activeParserProfiles: number;
    stalledBatches: number; oldestUnresolvedReviewDays: number | null;
    repository: { people: number; bookings: number; observations: number };
  };
  reports: { draft: number; reviewed: number; approvedNotPrinted: number };
}

/** Seven morning questions for the operational command center. */
export interface MorningOperationsBoard {
  opsDate: string;
  priorDate: string;
  facility: string;
  headline: string;
  posture: 'ok' | 'attention' | 'action_required';
  questions: {
    todaysPdfUploaded: { answer: boolean; detail: string };
    yesterdaysRosterIdentified: { answer: boolean; detail: string };
    comparisonCompleted: { answer: boolean; detail: string };
    newInmatesFound: { answer: number; detail: string };
    requireManualReview: { answer: number; detail: string };
    reportCertification: {
      answer: 'certified' | 'provisional' | 'missing' | 'failed';
      detail: string;
    };
    canPrintReport: { answer: boolean; detail: string; reportId: string | null };
  };
  readiness: {
    consecutivePassStreak: number;
    required: number;
    productionReady: boolean;
  };
  openLearningQueueItems: number;
  links: {
    upload: string;
    newInmates: string;
    review: string;
    reports: string;
    learningQueue: string;
    dailyDifference: string;
  };
}

export type DifferenceColor = 'green' | 'blue' | 'yellow' | 'gray' | 'red';
export type DifferenceClass =
  | 'new'
  | 'returning'
  | 'changed'
  | 'unchanged'
  | 'review'
  | 'departed'
  | 'unclassified'
  | 'failed';

export interface DailyDifferenceRow {
  key: string;
  name: string;
  color: DifferenceColor;
  classification: DifferenceClass;
  onPrior: boolean;
  onCurrent: boolean;
  inmateId: string | null;
  bookingId: string | null;
  prior: {
    recordId: string;
    lineNumber: number;
    name: string;
    bookingNumber: string | null;
    housing: string | null;
    bail: string | null;
    charges: string | null;
    bookedAt: string | null;
    resolution: string;
    confidence: number | null;
    matchTier: string | null;
    sourcePage: number | null;
    inmateId: string | null;
    bookingId: string | null;
  } | null;
  current: DailyDifferenceRow['prior'];
  why: {
    summary: string;
    rules: string[];
    presence: string | null;
    identity: string | null;
    attributeChanges: { field: string; from: string | null; to: string | null }[];
  };
  evidence: {
    uploadId: string | null;
    filename: string;
    sha256: string | null;
    page: number | null;
    row: number | null;
    side: 'prior' | 'current';
    href: string | null;
  }[];
}

export interface DailyDifferenceView {
  facility: string;
  opsDate: string;
  priorDate: string;
  caseId: string | null;
  status: string | null;
  reportCertification: 'certified' | 'provisional' | 'missing' | 'failed';
  prior: {
    batchId: string;
    uploadId: string | null;
    filename: string | null;
    rosterDate: string | null;
    count: number;
  };
  current: {
    batchId: string;
    uploadId: string | null;
    filename: string | null;
    rosterDate: string | null;
    count: number;
  };
  counts: Record<DifferenceClass, number>;
  rows: DailyDifferenceRow[];
  unclassifiedCount: number;
  reconcileOk: boolean;
}

export interface LearningQueueItem {
  itemId: string;
  date: string;
  facility: string;
  inmate: string;
  errorType: string;
  rootCause: string;
  status: string;
  stage: string | null;
  rule: string | null;
  evidence: string | null;
  why: string | null;
  regressionPath: string | null;
  openedAt: string;
  fixedAt: string | null;
  verifiedAt: string | null;
  note: string | null;
}

export interface BatchLifecycle {
  batchId: string;
  facility: string;
  filename: string;
  sourceType: string;
  rosterDate: string | null;
  lifecycleState: string;
  status: string;
  isTerminal: boolean;
  operator: string | null;
  parserProfile: string | null;
  parserConfidence: number | null;
  startedAt: string;
  finishedAt: string | null;
  totalDurationMs: number | null;
  closedAt: string | null;
  cancelReason: string | null;
  failureReason: string | null;
  transitions: {
    fromState: string | null; toState: string; reason: string | null;
    actor: string; actorId: string | null; durationMs: number | null; occurredAt: string;
    versions: {
      parserVersion: number | null; normalizationVersion: string | null;
      resolverVersion: string | null; mergePolicyVersion: string | null;
    };
  }[];
  progress: { step: number; total: number; label: string };
}

export interface ComparisonDetail {
  kind: string;
  inmateId: string | null;
  name: string;
  bookingNumber: string | null;
  from: string | null;
  to: string | null;
  note: string | null;
}

export interface BatchComparison {
  ok: boolean;
  comparisonId: string | null;
  counts: Record<string, number>;
  detail: ComparisonDetail[];
  truncated: boolean;
}

export interface ReportRecord {
  reportId: string;
  reportType: string;
  rowCount: number;
  approvalState: string;
  generatedById: string;
  generatedAt: string;
  reviewedById: string | null;
  reviewedAt: string | null;
  approvedById: string | null;
  approvedAt: string | null;
  printedById: string | null;
  printedAt: string | null;
  printCount: number;
  archivedAt: string | null;
  approvalNote: string | null;
}

export interface BatchMetric {
  batchId: string;
  facility: string;
  filename: string;
  sourceType: string;
  rosterDate: string | null;
  startedAt: string;
  lifecycleState: string;
  status: string;
  filesProcessed: number;
  recordsParsed: number;
  observationsCreated: number;
  identitiesMatched: number;
  newInmates: number;
  conflictsGenerated: number;
  reviewItems: number;
  parserConfidence: number | null;
  importDurationMs: number | null;
  parsingMs: number | null;
  identityAnalysisMs: number | null;
  intelligenceMs: number | null;
}

export interface MetricTrendDay {
  date: string;
  imports: number;
  failed: number;
  records: number;
  matched: number;
  reviews: number;
  averageParserConfidence: number | null;
  averageDurationMs: number | null;
}

export const intelligenceApi = {
  dashboard: (date?: string) => call<DashboardSummary>(`/dashboard${query({ date })}`),

  /**
   * Upload roster files.
   *
   * Not routed through `call`: a multipart body must not carry a JSON content type,
   * because the browser has to set its own boundary. `authorizedFetch` is used
   * directly so the token renewal behaviour is still there.
   */
  /**
   * Upload roster files in chunks.
   *
   * A single FormData with hundreds of files was rejected by nginx (413) and by
   * the multipart `files` cap. Chunking keeps each request small enough to land
   * and lets the operator see progress as batches complete.
   */
  async upload(
    files: File[],
    options: {
      facility?: string;
      rosterDate?: string;
      rosterKind?: string;
      onChunk?: (done: number, total: number) => void;
    } = {},
  ): Promise<{ accepted: UploadAccepted[]; rejected: { filename: string; reason: string }[] }> {
    const CHUNK = 25;
    const accepted: UploadAccepted[] = [];
    const rejected: { filename: string; reason: string }[] = [];

    for (let i = 0; i < files.length; i += CHUNK) {
      const slice = files.slice(i, i + CHUNK);
      const form = new FormData();
      for (const file of slice) form.append('files', file, file.name);

      const res = await authorizedFetch(
        `${API_BASE}/uploads${query({
          facility: options.facility ?? 'sacramento',
          rosterDate: options.rosterDate,
          rosterKind: options.rosterKind,
        })}`,
        { method: 'POST', body: form },
      );

      const body = await res.text();
      if (!res.ok) {
        if (res.status === 413) {
          throw new Error(
            `Upload rejected as too large (HTTP 413) after ${accepted.length} file(s) stored. ` +
            `Try fewer files at once, or upload in smaller batches.`,
          );
        }
        try {
          const parsed = JSON.parse(body) as {
            accepted?: UploadAccepted[];
            rejected?: { filename: string; reason: string }[];
            message?: string;
          };
          if (parsed.accepted?.length || parsed.rejected?.length) {
            accepted.push(...(parsed.accepted ?? []));
            rejected.push(...(parsed.rejected ?? []));
            if (parsed.message && !parsed.accepted?.length) {
              rejected.push({ filename: slice[0]?.name ?? 'batch', reason: parsed.message });
            }
          } else {
            throw new Error(await describeFailure(res, body));
          }
        } catch (err) {
          if (err instanceof Error && err.message.startsWith('Upload rejected')) throw err;
          if (accepted.length > 0) {
            rejected.push({
              filename: `(batch starting ${slice[0]?.name ?? 'files'})`,
              reason: err instanceof Error ? err.message : await describeFailure(res, body),
            });
            break;
          }
          throw new Error(await describeFailure(res, body));
        }
      } else {
        const parsed = JSON.parse(body) as { accepted: UploadAccepted[]; rejected: { filename: string; reason: string }[] };
        accepted.push(...(parsed.accepted ?? []));
        rejected.push(...(parsed.rejected ?? []));
      }

      options.onChunk?.(Math.min(i + slice.length, files.length), files.length);
    }

    return { accepted, rejected };
  },

  listUploads: (params: { limit?: number; offset?: number; status?: string } = {}) =>
    call<{ total: number; uploads: RosterUpload[] }>(`/uploads${query(params)}`),

  queue: () => call<{ active: RosterUpload[]; recent: RosterUpload[] }>('/uploads/queue'),

  deleteUpload: (uploadId: string) =>
    call<{ uploadId: string; deleted: boolean }>(`/uploads/${uploadId}`, { method: 'DELETE' }),

  /** Process Import. Returns as soon as the files are claimed. */
  process: (uploadIds?: string[]) =>
    call<{ started: string[]; skipped: { uploadId: string; reason: string }[] }>('/process', {
      method: 'POST',
      body: JSON.stringify({ uploadIds: uploadIds ?? [] }),
    }),

  newInmates: (params: { from?: string; to?: string; facility?: string; limit?: number; offset?: number } = {}) =>
    call<{ total: number; results: NewInmateRow[] }>(`/new-inmates${query(params)}`),

  person: (inmateId: string) => call<PersonDetail>(`/persons/${inmateId}`),

  searchPersons: (params: {
    name?: string; last?: string; first?: string; dateOfBirth?: string;
    bookingNumber?: string; externalPersonId?: string; facility?: string;
    limit?: number; offset?: number;
  }) => call<{ total: number; results: PersonSearchRow[] }>(`/persons${query(params)}`),

  reviewQueue: (params: { limit?: number; offset?: number } = {}) =>
    call<{ total: number; results: ReviewItem[] }>(`/review${query(params)}`),

  decideReview: (recordId: string, decision: 'approve_merge' | 'reject_merge' | 'create_new_person', note?: string) =>
    call<{ ok: boolean; inmateId?: string; bookingId?: string; createdPerson?: boolean }>(
      `/review/${recordId}/decide`,
      { method: 'POST', body: JSON.stringify({ decision, note }) },
    ),

  importHistory: (params: { limit?: number; offset?: number } = {}) =>
    call<{ total: number; results: ImportHistoryRow[] }>(`/import-history${query(params)}`),

  batchIssues: (batchId: string) =>
    call<{ batchId: string; issues: { severity: string; code: string; message: string; lineNumber: number | null }[] }>(
      `/batches/${batchId}/issues`,
    ),


  /**
   * Inspect files without importing them.
   *
   * Multipart, so it bypasses `call` for the same reason upload does: the browser must
   * set its own boundary.
   */
  async inspect(
    files: File[],
    options: { facility?: string; rosterDate?: string } = {},
  ): Promise<{ inspections: InspectionReport[]; rejected: { filename: string; reason: string }[] }> {
    const form = new FormData();
    for (const file of files) form.append('files', file, file.name);

    const res = await authorizedFetch(
      `${API_BASE}/inspect${query({ facility: options.facility ?? 'sacramento', rosterDate: options.rosterDate })}`,
      { method: 'POST', body: form },
    );
    const body = await res.text();
    if (!res.ok) throw new Error(await describeFailure(res, body));
    return JSON.parse(body) as { inspections: InspectionReport[]; rejected: { filename: string; reason: string }[] };
  },

  inspections: (params: { facility?: string; limit?: number } = {}) =>
    call<{ inspections: InspectionSummaryRow[] }>(`/inspections${query(params)}`),

  inspection: (inspectionId: string) => call<InspectionReport>(`/inspections/${inspectionId}`),

  publishFromInspection: (inspectionId: string, changeNote?: string) =>
    call<{ profileId: string; version: number; message: string; addedAliases: { field: string; alias: string }[] }>(
      `/inspections/${inspectionId}/publish`,
      { method: 'POST', body: JSON.stringify({ changeNote }) },
    ),

  mappings: (facility: string, sourceType = 'csv') =>
    call<MappingEditorState>(`/mappings/${facility}${query({ sourceType })}`),

  publishMapping: (facility: string, body: {
    sourceType?: string;
    label?: string;
    mappings: Record<string, string[]>;
    dateFormats?: string[];
    nameOrder?: string;
    chargeSeparator?: string;
    expectedHeaders?: string[];
    changeNote: string;
    effectiveFrom?: string;
  }) =>
    call<{ profileId: string; version: number; message: string; disabledFields: string[] }>(
      `/mappings/${facility}/publish`,
      { method: 'POST', body: JSON.stringify(body) },
    ),


  morning: () => call<MorningSummary>('/morning'),

  morningBoard: (facility = 'sacramento') =>
    call<MorningOperationsBoard>(`/morning-board${query({ facility })}`),

  dailyDifference: (params: {
    facility?: string;
    opsDate?: string;
    caseId?: string;
    priorBatchId?: string;
    currentBatchId?: string;
  } = {}) =>
    call<DailyDifferenceView>(`/daily-difference${query(params)}`),

  learningQueue: (params: { facility?: string; status?: string; limit?: number; offset?: number } = {}) =>
    call<{ total: number; items: LearningQueueItem[] }>(`/learning-queue${query(params)}`),

  updateLearningQueueItem: (
    itemId: string,
    body: {
      status?: 'open' | 'in_progress' | 'fixed' | 'verified_regression';
      rootCause?: 'parser' | 'normalization' | 'identity' | 'classification' | 'report' | 'unknown';
      note?: string;
      regressionPath?: string;
    },
  ) =>
    call<{
      itemId: string;
      status: string;
      rootCause: string;
      regressionPath: string | null;
      fixedAt: string | null;
      verifiedAt: string | null;
    }>(`/learning-queue/${itemId}`, { method: 'PATCH', body: JSON.stringify(body) }),

  batchLifecycle: (batchId: string) => call<BatchLifecycle>(`/batches/${batchId}/lifecycle`),

  closeBatch: (batchId: string) =>
    call<{ batchId: string; closed: boolean }>(`/batches/${batchId}/close`, { method: 'POST' }),

  cancelBatch: (batchId: string, reason: string) =>
    call<{ batchId: string; cancelled: boolean }>(`/batches/${batchId}/cancel`, {
      method: 'POST', body: JSON.stringify({ reason }),
    }),

  compareLatest: (facility = 'sacramento') =>
    call<BatchComparison>(`/comparison/latest${query({ facility })}`),

  compare: (baselineBatchId: string, currentBatchId: string) =>
    call<BatchComparison>('/comparison', {
      method: 'POST', body: JSON.stringify({ baselineBatchId, currentBatchId }),
    }),

  reportList: (params: { state?: string; limit?: number } = {}) =>
    call<{ reports: ReportRecord[] }>(`/reports/list${query(params)}`),

  setReportState: (reportId: string, state: string, note?: string) =>
    call<{ reportId: string; state: string; printCount: number }>(`/reports/${reportId}/state`, {
      method: 'POST', body: JSON.stringify({ state, note }),
    }),

  metrics: (params: { limit?: number; facility?: string; trendDays?: number } = {}) =>
    call<{ batches: BatchMetric[]; days: MetricTrendDay[] }>(`/metrics${query(params)}`),

  settings: () => call<IntelligenceSettings>('/settings'),

  conflicts: (params: { limit?: number; offset?: number; resolution?: string } = {}) =>
    call<{ total: number; results: Record<string, unknown>[] }>(`/conflicts${query(params)}`),

  /**
   * The printable report.
   *
   * Returns HTML rather than JSON — the server renders it with a print stylesheet, so
   * what is reviewed on screen is exactly what prints. Fetched as text and handed to
   * a print window rather than parsed.
   */
  async report(params: { date?: string; facility?: string } = {}): Promise<string> {
    const res = await authorizedFetch(`${API_BASE}/reports/daily${query(params)}`, {
      headers: { Accept: 'text/html' },
    });
    const body = await res.text();
    if (!res.ok) throw new Error(await describeFailure(res, body));
    return body;
  },

  // -------------------------------------------------------------------------
  // Bulk Import Jobs
  // -------------------------------------------------------------------------

  createImportJob: (body: {
    facility?: string;
    rosterDate?: string;
    label?: string;
    autoProcess?: boolean;
    files: { name: string; sizeBytes: number; sha256: string }[];
  }) =>
    call<{ job: ImportJob; decisions: ImportJobDecision[] }>('/import-jobs', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  listImportJobs: (params: { limit?: number; offset?: number; status?: string } = {}) =>
    call<{ total: number; jobs: ImportJob[] }>(`/import-jobs${query(params)}`),

  importJob: (jobId: string) => call<ImportJob>(`/import-jobs/${jobId}`),

  importJobFiles: (jobId: string, params: { status?: string; limit?: number; offset?: number } = {}) =>
    call<{ total: number; files: ImportJobFile[] }>(`/import-jobs/${jobId}/files${query(params)}`),

  importJobPending: (jobId: string) =>
    call<{ files: ImportJobFile[] }>(`/import-jobs/${jobId}/pending`),

  processImportJob: (jobId: string) =>
    call<{ started: string[]; skipped: { uploadId: string; reason: string }[] }>(
      `/import-jobs/${jobId}/process`,
      { method: 'POST', body: '{}' },
    ),

  cancelImportJob: (jobId: string, reason?: string) =>
    call<ImportJob>(`/import-jobs/${jobId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  /**
   * Upload one chunk of an import job. Each file must be paired with its jobFileId.
   */
  async uploadImportJobBatch(
    jobId: string,
    items: { jobFileId: string; file: File }[],
    batchIndex: number,
  ): Promise<{
    accepted: unknown[];
    rejected: { jobFileId?: string; filename: string; reason: string }[];
    autoProcessStarted: boolean;
    job: ImportJob;
  }> {
    const form = new FormData();
    form.append('batchIndex', String(batchIndex));
    for (const item of items) {
      form.append('jobFileId', item.jobFileId);
      form.append('files', item.file, item.file.name);
    }
    const res = await authorizedFetch(`${API_BASE}/import-jobs/${jobId}/uploads`, {
      method: 'POST',
      body: form,
    });
    const body = await res.text();
    if (!res.ok) {
      if (res.status === 413) {
        throw new Error('Upload batch rejected as too large (HTTP 413).');
      }
      throw new Error(await describeFailure(res, body));
    }
    return JSON.parse(body) as {
      accepted: unknown[];
      rejected: { jobFileId?: string; filename: string; reason: string }[];
      autoProcessStarted: boolean;
      job: ImportJob;
    };
  },
};

export interface ImportJobMetrics {
  uploadDurationMs: number | null;
  processingDurationMs: number | null;
  filesPerMinute: number | null;
  rowsPerSecond: number | null;
  parserThroughputRowsPerSec: number | null;
  importQueueDepth: number;
  averageFileSizeBytes: number | null;
  totalRowsRead: number;
  lastUpdatedAt: string;
}

export interface ImportJob {
  jobId: string;
  facility: string;
  rosterDate: string | null;
  label: string | null;
  status: string;
  autoProcess: boolean;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
  totalFiles: number;
  filesPending: number;
  filesUploading: number;
  filesUploaded: number;
  filesSkippedDuplicate: number;
  filesFailedUpload: number;
  filesQueued: number;
  filesProcessing: number;
  filesCompleted: number;
  filesFailedProcessing: number;
  totalBytes: number;
  uploadedBytes: number;
  currentFilename: string | null;
  progressPercent: number;
  metrics: ImportJobMetrics | null;
  failureReason: string | null;
}

export interface ImportJobDecision {
  name: string;
  sha256: string;
  action: 'upload' | 'skip_duplicate';
  existingUploadId?: string;
  jobFileId: string;
}

export interface ImportJobFile {
  jobFileId: string;
  originalName: string;
  sizeBytes: number;
  sha256: string;
  fileKind: string;
  status: string;
  uploadId: string | null;
  batchIndex: number | null;
  error: string | null;
  duplicateOfUploadId: string | null;
  uploadDurationMs: number | null;
  processDurationMs: number | null;
  rowsRead: number | null;
}
