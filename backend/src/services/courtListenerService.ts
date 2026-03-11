// ============================================================================
// Phase 293 — CourtListener API Service
// Integrates CourtListener REST API v4 into CourtAccess.
// Environment variable: COURTLISTENER_API_KEY
// Base API: https://www.courtlistener.com/api/rest/v4/
// All responses normalized into CourtAccess format.
// ============================================================================

import { courtListenerCache } from './courtListenerCache.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BASE_URL = 'https://www.courtlistener.com/api/rest/v4';

function getApiKey(): string {
  const key = process.env.COURTLISTENER_API_KEY || process.env.COURT_LISTENER_API || '';
  if (!key) {
    console.warn('[CourtListenerService] No API key found in COURTLISTENER_API_KEY or COURT_LISTENER_API');
  }
  return key;
}

// ---------------------------------------------------------------------------
// Normalized CourtAccess Types
// ---------------------------------------------------------------------------

export interface CourtListenerOpinion {
  id: number;
  caseName: string;
  court: string;
  courtId: string;
  year: number;
  dateFiled: string;
  citation: string;
  holdingSummary: string;
  url: string;
  courtListenerUrl: string;
  clusterId: number;
  docketId: number | null;
  judges: string;
  suitNature: string;
  precedentialStatus: string;
}

export interface CourtListenerSearchResult {
  count: number;
  results: CourtListenerOpinion[];
  query: string;
}

export interface CourtListenerCluster {
  id: number;
  caseName: string;
  dateFiled: string;
  court: string;
  courtId: string;
  citation: string;
  judges: string;
  precedentialStatus: string;
  syllabus: string;
  opinions: Array<{ id: number; type: string }>;
  url: string;
}

export interface CourtListenerDocket {
  id: number;
  caseName: string;
  court: string;
  courtId: string;
  docketNumber: string;
  dateFiled: string;
  dateTerminated: string | null;
  assignedTo: string | null;
  referredTo: string | null;
  suitNature: string;
  cause: string;
  url: string;
  entries: CourtListenerDocketEntry[];
}

export interface CourtListenerDocketEntry {
  id: number;
  dateFiled: string;
  description: string;
  documentNumber: number | null;
}

export interface CourtListenerCitation {
  citingOpinionId: number;
  citedOpinionId: number;
  citingCaseName: string;
  citedCaseName: string;
  depth: number;
}

export interface CitationGraph {
  opinionId: number;
  caseName: string;
  citedBy: CourtListenerCitation[];
  cites: CourtListenerCitation[];
  totalCitedBy: number;
  totalCites: number;
}

export interface JudgeProfile {
  name: string;
  courtId: string;
  court: string;
  rulingCount: number;
  recentRulings: Array<{
    caseName: string;
    dateFiled: string;
    citation: string;
    url: string;
  }>;
  frequentlyCitedCases: Array<{
    caseName: string;
    citation: string;
    url: string;
    citationCount: number;
  }>;
}

// ---------------------------------------------------------------------------
// HTTP Helper
// ---------------------------------------------------------------------------

async function apiRequest<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  // Check cache first
  const cached = courtListenerCache.get<T>(endpoint, params);
  if (cached) {
    return cached;
  }

  const apiKey = getApiKey();
  const queryString = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  const url = `${BASE_URL}/${endpoint}/${queryString ? '?' + queryString : ''}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (apiKey) {
    headers['Authorization'] = `Token ${apiKey}`;
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`CourtListener API error (${response.status}): ${errorText}`);
  }

  const data = await response.json() as T;

  // Cache the result
  courtListenerCache.set(endpoint, params, data);

  return data;
}

// ---------------------------------------------------------------------------
// Raw API Response Types
// ---------------------------------------------------------------------------

interface RawSearchResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: RawOpinionResult[];
}

interface RawOpinionResult {
  id: number;
  absolute_url?: string;
  caseName?: string;
  case_name?: string;
  court?: string;
  court_id?: string;
  court_citation_string?: string;
  dateFiled?: string;
  date_filed?: string;
  citation?: Array<{ volume: number; reporter: string; page: string }>;
  citations?: Array<{ volume: number; reporter: string; page: string }>;
  snippet?: string;
  cluster_id?: number;
  cluster?: string;
  docket?: string;
  docket_id?: number;
  judge?: string;
  judges?: string;
  suitNature?: string;
  suit_nature?: string;
  status?: string;
  precedential_status?: string;
  syllabus?: string;
  type?: string;
  opinions?: Array<{ id: number; type: string }>;
  date_terminated?: string | null;
  docket_number?: string;
  assigned_to_str?: string;
  referred_to_str?: string;
  cause?: string;
  docket_entries?: Array<{
    id: number;
    date_filed: string;
    description: string;
    document_number: number | null;
  }>;
}

interface RawCitationResponse {
  count: number;
  results: Array<{
    citing_opinion: number;
    cited_opinion: number;
    depth: number;
    citing_opinion_case_name?: string;
    cited_opinion_case_name?: string;
  }>;
}

// ---------------------------------------------------------------------------
// Normalization Helpers
// ---------------------------------------------------------------------------

function normalizeOpinion(raw: RawOpinionResult): CourtListenerOpinion {
  const caseName = raw.caseName || raw.case_name || 'Unknown Case';
  const dateFiled = raw.dateFiled || raw.date_filed || '';
  const year = dateFiled ? new Date(dateFiled).getFullYear() : 0;
  const courtId = raw.court_id || raw.court || '';

  // Build citation string from citation array
  let citation = '';
  const citationArr = raw.citation || raw.citations;
  if (citationArr && citationArr.length > 0) {
    const c = citationArr[0];
    citation = `${c.volume} ${c.reporter} ${c.page}`;
  } else if (raw.court_citation_string) {
    citation = raw.court_citation_string;
  }

  // Extract cluster ID from URL if needed
  let clusterId = raw.cluster_id || 0;
  if (!clusterId && raw.cluster) {
    const match = raw.cluster.match(/\/(\d+)\/?$/);
    if (match) clusterId = parseInt(match[1], 10);
  }

  // Extract docket ID
  let docketId = raw.docket_id || null;
  if (!docketId && raw.docket) {
    const match = raw.docket.match(/\/(\d+)\/?$/);
    if (match) docketId = parseInt(match[1], 10);
  }

  const absoluteUrl = raw.absolute_url || '';
  const courtListenerUrl = absoluteUrl.startsWith('http')
    ? absoluteUrl
    : `https://www.courtlistener.com${absoluteUrl}`;

  return {
    id: raw.id,
    caseName,
    court: raw.court || courtId,
    courtId,
    year,
    dateFiled,
    citation,
    holdingSummary: raw.snippet || raw.syllabus || '',
    url: courtListenerUrl,
    courtListenerUrl,
    clusterId,
    docketId,
    judges: raw.judge || raw.judges || '',
    suitNature: raw.suitNature || raw.suit_nature || '',
    precedentialStatus: raw.status || raw.precedential_status || '',
  };
}

// ---------------------------------------------------------------------------
// CourtListenerService
// ---------------------------------------------------------------------------

export class CourtListenerService {
  /**
   * Search opinions by query string.
   * Endpoint: /search/
   */
  static async searchOpinions(query: string, options?: {
    court?: string;
    dateFiled_gte?: string;
    dateFiled_lte?: string;
    pageSize?: number;
  }): Promise<CourtListenerSearchResult> {
    const params: Record<string, string> = {
      q: query,
      type: 'o', // opinions
      order_by: 'score desc',
      page_size: String(options?.pageSize ?? 20),
    };

    if (options?.court) params['court'] = options.court;
    if (options?.dateFiled_gte) params['filed_after'] = options.dateFiled_gte;
    if (options?.dateFiled_lte) params['filed_before'] = options.dateFiled_lte;

    const raw = await apiRequest<RawSearchResponse>('search', params);

    return {
      count: raw.count,
      results: (raw.results || []).map(normalizeOpinion),
      query,
    };
  }

  /**
   * Get a specific opinion by ID.
   * Endpoint: /opinions/{id}/
   */
  static async getOpinionById(id: number): Promise<CourtListenerOpinion> {
    const raw = await apiRequest<RawOpinionResult>(`opinions/${id}`, {});
    return normalizeOpinion(raw);
  }

  /**
   * Get an opinion cluster (group of opinions for a case).
   * Endpoint: /clusters/{id}/
   */
  static async getCluster(clusterId: number): Promise<CourtListenerCluster> {
    const raw = await apiRequest<RawOpinionResult>(`clusters/${clusterId}`, {});

    const caseName = raw.caseName || raw.case_name || 'Unknown Case';
    const dateFiled = raw.dateFiled || raw.date_filed || '';
    const courtId = raw.court_id || raw.court || '';

    let citation = '';
    const citationArr = raw.citation || raw.citations;
    if (citationArr && citationArr.length > 0) {
      const c = citationArr[0];
      citation = `${c.volume} ${c.reporter} ${c.page}`;
    }

    return {
      id: raw.id,
      caseName,
      dateFiled,
      court: raw.court || courtId,
      courtId,
      citation,
      judges: raw.judge || raw.judges || '',
      precedentialStatus: raw.status || raw.precedential_status || '',
      syllabus: raw.syllabus || '',
      opinions: (raw.opinions || []).map((o) => ({ id: o.id, type: o.type || 'lead' })),
      url: `https://www.courtlistener.com/opinion/${raw.id}/${caseName.toLowerCase().replace(/\s+/g, '-')}/`,
    };
  }

  /**
   * Get a docket and its entries.
   * Endpoint: /dockets/{id}/
   */
  static async getDocket(docketId: number): Promise<CourtListenerDocket> {
    const raw = await apiRequest<RawOpinionResult>(`dockets/${docketId}`, {});

    const caseName = raw.caseName || raw.case_name || 'Unknown Case';
    const courtId = raw.court_id || raw.court || '';

    return {
      id: raw.id,
      caseName,
      court: raw.court || courtId,
      courtId,
      docketNumber: raw.docket_number || '',
      dateFiled: raw.dateFiled || raw.date_filed || '',
      dateTerminated: raw.date_terminated || null,
      assignedTo: raw.assigned_to_str || null,
      referredTo: raw.referred_to_str || null,
      suitNature: raw.suitNature || raw.suit_nature || '',
      cause: raw.cause || '',
      url: `https://www.courtlistener.com/docket/${raw.id}/`,
      entries: (raw.docket_entries || []).map((e) => ({
        id: e.id,
        dateFiled: e.date_filed,
        description: e.description,
        documentNumber: e.document_number,
      })),
    };
  }

  /**
   * Get citations for an opinion — both citing and cited opinions.
   * Endpoint: /citations/
   */
  static async getCitationGraph(opinionId: number): Promise<CitationGraph> {
    // Get opinions that cite this one
    const citedByRaw = await apiRequest<RawCitationResponse>('citations', {
      cited_opinion: String(opinionId),
      page_size: '50',
    });

    // Get opinions this one cites
    const citesRaw = await apiRequest<RawCitationResponse>('citations', {
      citing_opinion: String(opinionId),
      page_size: '50',
    });

    const citedBy: CourtListenerCitation[] = (citedByRaw.results || []).map((c) => ({
      citingOpinionId: c.citing_opinion,
      citedOpinionId: c.cited_opinion,
      citingCaseName: c.citing_opinion_case_name || '',
      citedCaseName: c.cited_opinion_case_name || '',
      depth: c.depth || 1,
    }));

    const cites: CourtListenerCitation[] = (citesRaw.results || []).map((c) => ({
      citingOpinionId: c.citing_opinion,
      citedOpinionId: c.cited_opinion,
      citingCaseName: c.citing_opinion_case_name || '',
      citedCaseName: c.cited_opinion_case_name || '',
      depth: c.depth || 1,
    }));

    return {
      opinionId,
      caseName: '', // Will be filled by caller if needed
      citedBy,
      cites,
      totalCitedBy: citedByRaw.count,
      totalCites: citesRaw.count,
    };
  }

  /**
   * Search for judge information based on docket data.
   * Uses the search endpoint filtered to a specific judge.
   */
  static async searchJudgeRulings(judgeName: string, options?: {
    court?: string;
    pageSize?: number;
  }): Promise<CourtListenerSearchResult> {
    const params: Record<string, string> = {
      q: `judge:"${judgeName}"`,
      type: 'o',
      order_by: 'dateFiled desc',
      page_size: String(options?.pageSize ?? 20),
    };

    if (options?.court) params['court'] = options.court;

    const raw = await apiRequest<RawSearchResponse>('search', params);

    return {
      count: raw.count,
      results: (raw.results || []).map(normalizeOpinion),
      query: judgeName,
    };
  }

  /**
   * Verify API authentication works.
   */
  static async verifyAuthentication(): Promise<{ authenticated: boolean; message: string }> {
    try {
      const result = await apiRequest<RawSearchResponse>('search', {
        q: 'test',
        type: 'o',
        page_size: '1',
      });
      return {
        authenticated: true,
        message: `CourtListener API connected. ${result.count} total opinions available.`,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        authenticated: false,
        message: `CourtListener API authentication failed: ${message}`,
      };
    }
  }
}
