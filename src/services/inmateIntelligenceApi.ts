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

export const intelligenceApi = {
  dashboard: (date?: string) => call<DashboardSummary>(`/dashboard${query({ date })}`),

  /**
   * Upload roster files.
   *
   * Not routed through `call`: a multipart body must not carry a JSON content type,
   * because the browser has to set its own boundary. `authorizedFetch` is used
   * directly so the token renewal behaviour is still there.
   */
  async upload(
    files: File[],
    options: { facility?: string; rosterDate?: string; rosterKind?: string } = {},
  ): Promise<{ accepted: UploadAccepted[]; rejected: { filename: string; reason: string }[] }> {
    const form = new FormData();
    for (const file of files) form.append('files', file, file.name);

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
      // A partial failure still returns the accepted files, so surface those rather
      // than throwing away work the operator already waited for.
      try {
        const parsed = JSON.parse(body) as { accepted?: UploadAccepted[]; rejected?: { filename: string; reason: string }[]; message?: string };
        if (parsed.rejected?.length) {
          return { accepted: parsed.accepted ?? [], rejected: parsed.rejected };
        }
      } catch {
        // Fall through to the generic message.
      }
      throw new Error(await describeFailure(res, body));
    }
    return JSON.parse(body) as { accepted: UploadAccepted[]; rejected: { filename: string; reason: string }[] };
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
};
