// ============================================================================
// Phases 109-114 -- Document Ingestion Repair
// Repair the download and validation pipeline so the real PDFs discovered
// during Phase 103 crawling can be successfully ingested.
//
// Phase 109: Failure diagnostics with detailed logging
// Phase 110: Relaxed MIME validation (applied to documentValidationService.ts)
// Phase 111: Redirect support (maxRedirects=5, chain logging)
// Phase 112: Retry logic (3 retries, exponential backoff 2s/4s/8s)
// Phase 113: File size handling (100MB max, streaming downloads)
// Phase 114: Reprocess 1,798 existing policy URLs
//
// Reports generated:
//   reports/pdf_download_failure_analysis.json   (Phase 109)
//   reports/pdf_ingestion_repair_results.json    (Phase 114)
//
// IMPORTANT: No new crawl. Reprocesses existing dataset only.
//
// Usage: npx tsx backend/src/policy/pipeline/phase109_114_ingestionRepair.ts
// ============================================================================

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { classifyDocumentText } from '../taxonomy/classificationPipeline.js';
import { populateAgencyCoverage } from '../taxonomy/coveragePopulator.js';
import {
  validateDocument,
} from '../../workers/documentValidationService.js';

const prisma = new PrismaClient();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPORTS_DIR = path.resolve(__dirname, '../../../reports');

function ensureReportsDir(): void {
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }
}

function writeReport(filename: string, data: unknown): void {
  const filePath = path.join(REPORTS_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`  -> Report saved: reports/${filename}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const USER_AGENT = 'CourtAccess-PolicyCrawler/1.0 (+https://courtaccess.app/crawler-info)';

// ---------------------------------------------------------------------------
// Phase 109 — Diagnostic Types
// ---------------------------------------------------------------------------

interface DownloadDiagnostics {
  url: string;
  httpStatus: number | null;
  contentType: string | null;
  contentLength: number | null;
  redirectChain: string[];
  downloadDurationMs: number;
  failureReason: string | null;
  failureCategory:
    | 'timeout'
    | 'redirect_failure'
    | 'mime_mismatch'
    | 'file_size_rejection'
    | 'network_reset'
    | 'invalid_pdf_parse'
    | 'http_error'
    | 'success'
    | null;
  bytesReceived: number;
  retryAttempts: number;
}

interface IngestionResult {
  agencyId: string;
  agencyName: string;
  sourceUrl: string;
  title: string;
  status: 'downloaded' | 'validated' | 'ocr_success' | 'classified' | 'download_failed' | 'validation_failed' | 'ocr_failed' | 'classification_failed';
  fileSizeBytes: number;
  mimeType: string | null;
  ocrMethod: string | null;
  ocrPages: number;
  textLength: number;
  topicName: string | null;
  confidence: number;
  runtimeMs: number;
  error: string | null;
  diagnostics: DownloadDiagnostics;
}

// ---------------------------------------------------------------------------
// Domain Rate Limiter (1 req/sec per domain)
// ---------------------------------------------------------------------------

const domainLastRequest = new Map<string, number>();

async function rateLimitDomain(url: string): Promise<void> {
  let domain: string;
  try {
    domain = new URL(url).hostname;
  } catch {
    return;
  }

  const lastRequest = domainLastRequest.get(domain) || 0;
  const elapsed = Date.now() - lastRequest;
  const delay = 1000; // 1 req/sec per domain

  if (elapsed < delay) {
    await sleep(delay - elapsed);
  }

  domainLastRequest.set(domain, Date.now());
}

// ---------------------------------------------------------------------------
// Phase 111 — Enhanced Fetch with Redirect Tracking
// Phase 112 — Retry Logic (3 retries, exponential backoff)
// Phase 113 — Streaming Download (100MB max)
// ---------------------------------------------------------------------------

interface FetchOptions {
  maxRetries: number;
  maxRedirects: number;
  timeoutMs: number;
  maxSizeBytes: number;
}

const DEFAULT_FETCH_OPTIONS: FetchOptions = {
  maxRetries: 3,
  maxRedirects: 5,
  timeoutMs: 60000,       // 60s timeout (up from 15s)
  maxSizeBytes: 100 * 1024 * 1024, // 100MB
};

async function enhancedFetchBuffer(
  url: string,
  options: FetchOptions = DEFAULT_FETCH_OPTIONS,
): Promise<{
  buffer: Buffer | null;
  diagnostics: DownloadDiagnostics;
}> {
  const diagnostics: DownloadDiagnostics = {
    url,
    httpStatus: null,
    contentType: null,
    contentLength: null,
    redirectChain: [],
    downloadDurationMs: 0,
    failureReason: null,
    failureCategory: null,
    bytesReceived: 0,
    retryAttempts: 0,
  };

  const startTime = Date.now();

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    if (attempt > 0) {
      diagnostics.retryAttempts = attempt;
      const backoffMs = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
      await sleep(backoffMs);
    }

    try {
      // Phase 111: Manual redirect following to track chain
      let currentUrl = url;
      let redirectCount = 0;
      let finalResponse: Response | null = null;
      diagnostics.redirectChain = [];

      while (redirectCount <= options.maxRedirects) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), options.timeoutMs);

        let resp: Response;
        try {
          resp = await fetch(currentUrl, {
            headers: {
              'User-Agent': USER_AGENT,
              'Accept': 'application/pdf,application/octet-stream,*/*',
            },
            signal: controller.signal,
            redirect: 'manual',
          });
          clearTimeout(timer);
        } catch (fetchErr) {
          clearTimeout(timer);
          const errorMsg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);

          if (errorMsg.includes('abort') || errorMsg.includes('AbortError') || errorMsg.includes('timeout')) {
            diagnostics.failureReason = `Timeout after ${options.timeoutMs}ms`;
            diagnostics.failureCategory = 'timeout';
          } else if (errorMsg.includes('ECONNRESET') || errorMsg.includes('ECONNREFUSED') || errorMsg.includes('ENOTFOUND')) {
            diagnostics.failureReason = `Connection error: ${errorMsg.substring(0, 200)}`;
            diagnostics.failureCategory = 'network_reset';
          } else {
            diagnostics.failureReason = `Network error: ${errorMsg.substring(0, 200)}`;
            diagnostics.failureCategory = 'network_reset';
          }

          // Retry on timeout, ECONNRESET, 5xx
          if (attempt < options.maxRetries) break; // break inner loop, retry outer
          diagnostics.downloadDurationMs = Date.now() - startTime;
          return { buffer: null, diagnostics };
        }

        diagnostics.httpStatus = resp.status;
        diagnostics.contentType = resp.headers.get('content-type');
        const clHeader = resp.headers.get('content-length');
        diagnostics.contentLength = clHeader ? parseInt(clHeader, 10) : null;

        // Handle redirects
        if ([301, 302, 303, 307, 308].includes(resp.status)) {
          const location = resp.headers.get('location');
          if (!location) {
            diagnostics.failureReason = `Redirect ${resp.status} without Location header`;
            diagnostics.failureCategory = 'redirect_failure';
            diagnostics.downloadDurationMs = Date.now() - startTime;
            return { buffer: null, diagnostics };
          }

          diagnostics.redirectChain.push(currentUrl);

          try {
            currentUrl = new URL(location, currentUrl).href;
          } catch {
            diagnostics.failureReason = `Invalid redirect URL: ${location.substring(0, 200)}`;
            diagnostics.failureCategory = 'redirect_failure';
            diagnostics.downloadDurationMs = Date.now() - startTime;
            return { buffer: null, diagnostics };
          }

          redirectCount++;
          if (redirectCount > options.maxRedirects) {
            diagnostics.failureReason = `Too many redirects (>${options.maxRedirects})`;
            diagnostics.failureCategory = 'redirect_failure';
            diagnostics.downloadDurationMs = Date.now() - startTime;
            return { buffer: null, diagnostics };
          }
          continue;
        }

        // Handle server errors (retryable)
        if (resp.status >= 500) {
          diagnostics.failureReason = `HTTP ${resp.status} server error`;
          diagnostics.failureCategory = 'http_error';
          if (attempt < options.maxRetries) break; // retry
          diagnostics.downloadDurationMs = Date.now() - startTime;
          return { buffer: null, diagnostics };
        }

        // Handle client errors (not retryable)
        if (!resp.ok) {
          diagnostics.failureReason = `HTTP ${resp.status}`;
          diagnostics.failureCategory = 'http_error';
          diagnostics.downloadDurationMs = Date.now() - startTime;
          return { buffer: null, diagnostics };
        }

        finalResponse = resp;
        break;
      }

      if (!finalResponse) {
        // If we broke out of the redirect loop to retry, continue outer loop
        if (attempt < options.maxRetries && diagnostics.failureCategory !== 'redirect_failure') {
          continue;
        }
        diagnostics.downloadDurationMs = Date.now() - startTime;
        return { buffer: null, diagnostics };
      }

      // Phase 113: Streaming download with size limit
      const declaredSize = diagnostics.contentLength;
      if (declaredSize && declaredSize > options.maxSizeBytes) {
        diagnostics.failureReason = `File too large: ${(declaredSize / 1024 / 1024).toFixed(1)}MB (max ${(options.maxSizeBytes / 1024 / 1024).toFixed(0)}MB)`;
        diagnostics.failureCategory = 'file_size_rejection';
        diagnostics.downloadDurationMs = Date.now() - startTime;
        return { buffer: null, diagnostics };
      }

      // Stream the response body
      const chunks: Buffer[] = [];
      let totalBytes = 0;

      try {
        if (finalResponse.body) {
          const reader = (finalResponse.body as ReadableStream<Uint8Array>).getReader();

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            totalBytes += value.length;
            diagnostics.bytesReceived = totalBytes;

            if (totalBytes > options.maxSizeBytes) {
              reader.cancel();
              diagnostics.failureReason = `File exceeded size limit during download: ${(totalBytes / 1024 / 1024).toFixed(1)}MB`;
              diagnostics.failureCategory = 'file_size_rejection';
              diagnostics.downloadDurationMs = Date.now() - startTime;
              return { buffer: null, diagnostics };
            }

            chunks.push(Buffer.from(value));
          }
        } else {
          const arrayBuf = await finalResponse.arrayBuffer();
          chunks.push(Buffer.from(arrayBuf));
          totalBytes = chunks[0].length;
          diagnostics.bytesReceived = totalBytes;
        }
      } catch (streamErr) {
        const errorMsg = streamErr instanceof Error ? streamErr.message : String(streamErr);
        diagnostics.failureReason = `Stream error: ${errorMsg.substring(0, 200)}`;
        diagnostics.failureCategory = 'network_reset';
        if (attempt < options.maxRetries) continue; // retry
        diagnostics.downloadDurationMs = Date.now() - startTime;
        return { buffer: null, diagnostics };
      }

      if (totalBytes === 0) {
        diagnostics.failureReason = 'Empty response body (0 bytes)';
        diagnostics.failureCategory = 'network_reset';
        if (attempt < options.maxRetries) continue; // retry
        diagnostics.downloadDurationMs = Date.now() - startTime;
        return { buffer: null, diagnostics };
      }

      const buffer = Buffer.concat(chunks);
      diagnostics.bytesReceived = buffer.length;
      diagnostics.failureCategory = 'success';
      diagnostics.downloadDurationMs = Date.now() - startTime;
      return { buffer, diagnostics };

    } catch (outerErr) {
      const errorMsg = outerErr instanceof Error ? outerErr.message : String(outerErr);
      diagnostics.failureReason = `Unexpected error: ${errorMsg.substring(0, 200)}`;
      diagnostics.failureCategory = 'network_reset';
      if (attempt < options.maxRetries) continue;
    }
  }

  diagnostics.downloadDurationMs = Date.now() - startTime;
  return { buffer: null, diagnostics };
}

// ---------------------------------------------------------------------------
// Improved PDF Text Extraction
// ---------------------------------------------------------------------------

async function extractPdfText(buffer: Buffer): Promise<{ text: string; pages: number; method: string; error?: string }> {
  try {
    const pdfParse = (await import('pdf-parse')).default;
    const result = await pdfParse(buffer);

    const text = (result.text || '').trim();
    const pages = result.numpages || 1;

    if (text.length >= 10) {
      return { text, pages, method: 'pdf-parse' };
    }

    // PDF parsed but very little text -- likely scanned
    return {
      text,
      pages,
      method: 'pdf-parse-minimal',
      error: `Only ${text.length} chars extracted (likely scanned PDF)`,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      text: '',
      pages: 0,
      method: 'failed',
      error: `pdf-parse error: ${errorMsg.substring(0, 200)}`,
    };
  }
}

// ---------------------------------------------------------------------------
// Infer policy title from URL
// ---------------------------------------------------------------------------

function inferPolicyTitle(url: string, linkText: string): string {
  if (linkText && linkText.length > 3 && linkText.length < 200) {
    return linkText;
  }
  try {
    const urlPath = new URL(url).pathname;
    const filename = path.basename(urlPath, '.pdf');
    return filename
      .replace(/[-_]/g, ' ')
      .replace(/%20/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim() || 'Policy Document';
  } catch {
    return 'Policy Document';
  }
}

// ---------------------------------------------------------------------------
// Load existing crawl data (1,798 PDF URLs from Phase 103-108 reports)
// ---------------------------------------------------------------------------

interface CrawlEntry {
  agency: string;
  title: string;
  url: string;
  status: string;
}

function loadExistingUrls(): CrawlEntry[] {
  const reportPath = path.join(REPORTS_DIR, 'live_policy_ingestion_report.json');
  if (!fs.existsSync(reportPath)) {
    throw new Error(`Cannot find existing ingestion report at ${reportPath}`);
  }

  const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
  const allResults: CrawlEntry[] = report.allResults || [];

  console.log(`  Loaded ${allResults.length} URLs from live_policy_ingestion_report.json`);
  return allResults;
}

// ---------------------------------------------------------------------------
// Build agency name -> agencyId lookup
// ---------------------------------------------------------------------------

async function buildAgencyLookup(): Promise<Map<string, string>> {
  const agencies = await prisma.agency.findMany({
    select: { agencyId: true, agencyName: true },
  });
  const lookup = new Map<string, string>();
  for (const a of agencies) {
    lookup.set(a.agencyName, a.agencyId);
  }
  console.log(`  Built agency lookup: ${lookup.size} agencies`);
  return lookup;
}

// ---------------------------------------------------------------------------
// Phase 109 + 114 — Combined Diagnostic Pass + Full Reprocessing
// ---------------------------------------------------------------------------

async function runIngestionRepair(): Promise<void> {
  const startTime = Date.now();
  ensureReportsDir();

  console.log('');
  console.log('================================================================================');
  console.log('  DOCUMENT INGESTION REPAIR — Phases 109-114');
  console.log('================================================================================');
  console.log('');

  // Load existing URLs
  console.log('[Setup] Loading existing crawl data...');
  const existingUrls = loadExistingUrls();

  // Build agency lookup
  const agencyLookup = await buildAgencyLookup();

  // Deduplicate URLs
  const seen = new Set<string>();
  const toProcess: Array<{ agency: string; agencyId: string; url: string; title: string }> = [];

  for (const entry of existingUrls) {
    if (seen.has(entry.url)) continue;
    seen.add(entry.url);

    const agencyId = agencyLookup.get(entry.agency);
    if (!agencyId) {
      continue; // skip if agency not found
    }

    toProcess.push({
      agency: entry.agency,
      agencyId,
      url: entry.url,
      title: entry.title,
    });
  }

  console.log(`  ${toProcess.length} unique URLs to reprocess`);
  console.log('');

  // ---------------------------------------------------------------------------
  // Phase 109 Banner
  // ---------------------------------------------------------------------------
  console.log('+---------------------------------------------------------------------------+');
  console.log('|  Phase 109 — Failure Diagnostics (instrumented download)                  |');
  console.log('+---------------------------------------------------------------------------+');
  console.log('');
  console.log('  Downloading with: maxRetries=3, maxRedirects=5, timeout=60s, maxSize=100MB');
  console.log('');

  // ---------------------------------------------------------------------------
  // Process all URLs with enhanced pipeline
  // ---------------------------------------------------------------------------

  const results: IngestionResult[] = [];
  let downloadSucceeded = 0;
  let downloadFailed = 0;
  let validationPassed = 0;
  let validationFailed = 0;
  let ocrSucceeded = 0;
  let ocrFailed = 0;
  let classificationSucceeded = 0;
  let classificationFailed = 0;
  const ocrMethods: Record<string, number> = {};
  let ocrTotalMs = 0;
  let ocrCount = 0;

  // Failure category counts for Phase 109
  const failureCategories: Record<string, number> = {
    timeout: 0,
    redirect_failure: 0,
    mime_mismatch: 0,
    file_size_rejection: 0,
    network_reset: 0,
    invalid_pdf_parse: 0,
    http_error: 0,
  };

  for (let i = 0; i < toProcess.length; i++) {
    const item = toProcess[i];
    const docStart = Date.now();

    const result: IngestionResult = {
      agencyId: item.agencyId,
      agencyName: item.agency,
      sourceUrl: item.url,
      title: item.title,
      status: 'download_failed',
      fileSizeBytes: 0,
      mimeType: null,
      ocrMethod: null,
      ocrPages: 0,
      textLength: 0,
      topicName: null,
      confidence: 0,
      runtimeMs: 0,
      error: null,
      diagnostics: {
        url: item.url,
        httpStatus: null,
        contentType: null,
        contentLength: null,
        redirectChain: [],
        downloadDurationMs: 0,
        failureReason: null,
        failureCategory: null,
        bytesReceived: 0,
        retryAttempts: 0,
      },
    };

    try {
      // Rate limit per domain
      await rateLimitDomain(item.url);

      // Step 1: Enhanced download (Phases 111-113)
      if ((i + 1) % 50 === 1 || i === 0) {
        console.log(`  [${i + 1}/${toProcess.length}] Downloading: ${item.url.substring(0, 80)}...`);
      }

      const { buffer, diagnostics } = await enhancedFetchBuffer(item.url);
      result.diagnostics = diagnostics;

      if (!buffer) {
        result.status = 'download_failed';
        result.error = diagnostics.failureReason || 'Download returned empty or failed';
        downloadFailed++;
        if (diagnostics.failureCategory && diagnostics.failureCategory !== 'success') {
          failureCategories[diagnostics.failureCategory] = (failureCategories[diagnostics.failureCategory] || 0) + 1;
        }
        result.runtimeMs = Date.now() - docStart;
        results.push(result);
        continue;
      }

      downloadSucceeded++;
      result.fileSizeBytes = buffer.length;

      // Step 2: Validate document (Phase 110: relaxed MIME, Phase 113: 100MB)
      const validation = validateDocument(buffer, undefined, undefined, item.url);
      result.mimeType = validation.metadata.mimeType;

      if (!validation.valid) {
        result.status = 'validation_failed';
        result.error = validation.errors.join('; ');
        validationFailed++;
        if (validation.errors.some(e => e.includes('MIME'))) {
          failureCategories['mime_mismatch']++;
        } else if (validation.errors.some(e => e.includes('size'))) {
          failureCategories['file_size_rejection']++;
        }
        result.runtimeMs = Date.now() - docStart;
        results.push(result);
        continue;
      }

      validationPassed++;
      result.status = 'validated';

      // Step 3: Create or update PolicyDocument record
      // Check if document already exists by sourceUrl
      let policyDoc = await prisma.policyDocument.findFirst({
        where: { sourceUrl: item.url },
      });

      if (policyDoc) {
        // Update existing
        await prisma.policyDocument.update({
          where: { documentId: policyDoc.documentId },
          data: {
            mimeType: validation.metadata.mimeType,
            fileSizeBytes: buffer.length,
            ocrStatus: 'pending',
            classificationStatus: 'pending',
          },
        });
      } else {
        // Create new
        policyDoc = await prisma.policyDocument.create({
          data: {
            agencyId: item.agencyId,
            title: inferPolicyTitle(item.url, item.title),
            sourceUrl: item.url,
            mimeType: validation.metadata.mimeType,
            fileSizeBytes: buffer.length,
            ocrStatus: 'pending',
            classificationStatus: 'pending',
          },
        });
      }

      // Step 4: OCR text extraction
      const ocrStart = Date.now();
      let extractedText = '';
      let ocrMethod = 'none';
      let ocrPages = 0;
      let ocrError: string | undefined;

      if (validation.metadata.mimeType === 'application/pdf' ||
          validation.metadata.mimeType === 'application/x-pdf' ||
          validation.metadata.mimeType === 'text/pdf' ||
          /\.pdf(\?.*)?$/i.test(item.url)) {
        const extraction = await extractPdfText(buffer);
        extractedText = extraction.text;
        ocrMethod = extraction.method;
        ocrPages = extraction.pages;
        ocrError = extraction.error;
      } else if (validation.metadata.mimeType === 'application/octet-stream' ||
                 validation.metadata.mimeType === 'binary/octet-stream') {
        // Try pdf-parse anyway for octet-stream (likely mislabeled PDFs)
        const extraction = await extractPdfText(buffer);
        extractedText = extraction.text;
        ocrMethod = extraction.method;
        ocrPages = extraction.pages;
        ocrError = extraction.error;
      } else if (validation.metadata.mimeType === 'text/plain') {
        extractedText = buffer.toString('utf-8');
        ocrMethod = 'plain-text';
        ocrPages = 1;
      } else if (validation.metadata.mimeType === 'text/html') {
        extractedText = buffer.toString('utf-8').replace(/<[^>]+>/g, ' ').trim();
        ocrMethod = 'html-strip';
        ocrPages = 1;
      }

      const ocrTime = Date.now() - ocrStart;
      ocrTotalMs += ocrTime;
      ocrCount++;

      result.ocrMethod = ocrMethod;
      result.ocrPages = ocrPages;
      result.textLength = extractedText.length;
      ocrMethods[ocrMethod] = (ocrMethods[ocrMethod] || 0) + 1;

      if (!extractedText || extractedText.trim().length < 10) {
        result.status = 'ocr_failed';
        result.error = ocrError || `OCR extraction returned insufficient text (${extractedText.length} chars)`;
        ocrFailed++;
        failureCategories['invalid_pdf_parse']++;

        await prisma.policyDocument.update({
          where: { documentId: policyDoc.documentId },
          data: {
            ocrStatus: 'failed',
            ocrError: result.error.substring(0, 500),
          },
        });

        result.runtimeMs = Date.now() - docStart;
        results.push(result);
        continue;
      }

      ocrSucceeded++;
      result.status = 'ocr_success';

      // Update document with extracted text
      await prisma.policyDocument.update({
        where: { documentId: policyDoc.documentId },
        data: {
          textContent: extractedText.substring(0, 100000),
          textExtracted: true,
          ocrStatus: 'completed',
        },
      });

      // Step 5: Classification
      try {
        const classResult = await classifyDocumentText(
          policyDoc.documentId,
          extractedText.substring(0, 50000),
          result.title,
        );

        result.topicName = classResult.topicName;
        result.confidence = classResult.confidence;
        result.status = 'classified';
        classificationSucceeded++;

        if (!classResult.topicId) {
          await prisma.policyDocument.update({
            where: { documentId: policyDoc.documentId },
            data: { classificationStatus: 'completed', classificationScore: 0 },
          });
        }
      } catch (classErr) {
        result.status = 'classification_failed';
        result.error = classErr instanceof Error ? classErr.message : String(classErr);
        classificationFailed++;

        await prisma.policyDocument.update({
          where: { documentId: policyDoc.documentId },
          data: { classificationStatus: 'failed' },
        });

        result.runtimeMs = Date.now() - docStart;
        results.push(result);
        continue;
      }

      // Step 6: Update coverage
      try {
        await populateAgencyCoverage(item.agencyId);
      } catch {
        // Coverage update failure is non-fatal
      }

    } catch (outerErr) {
      result.status = 'download_failed';
      result.error = outerErr instanceof Error ? outerErr.message : String(outerErr);
      downloadFailed++;
    }

    result.runtimeMs = Date.now() - docStart;
    results.push(result);

    // Log progress
    if ((i + 1) % 50 === 0) {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      console.log(
        `  Progress: ${i + 1}/${toProcess.length} | ` +
        `DL OK: ${downloadSucceeded} | DL Fail: ${downloadFailed} | ` +
        `Valid: ${validationPassed} | OCR OK: ${ocrSucceeded} | OCR Fail: ${ocrFailed} | ` +
        `Classified: ${classificationSucceeded} | ${elapsed}s elapsed`
      );
    }
  }

  const totalDuration = Date.now() - startTime;

  // ---------------------------------------------------------------------------
  // Generate Phase 109 Report: pdf_download_failure_analysis.json
  // ---------------------------------------------------------------------------

  console.log('');
  console.log('+---------------------------------------------------------------------------+');
  console.log('|  Phase 109 Report — Failure Analysis                                      |');
  console.log('+---------------------------------------------------------------------------+');

  const failedResults = results.filter(r => r.status !== 'classified' && r.status !== 'ocr_success' && r.status !== 'validated');

  const phase109Report = {
    phase: 109,
    title: 'PDF Download Failure Analysis',
    generatedAt: new Date().toISOString(),
    summary: {
      totalUrls: toProcess.length,
      downloadSucceeded,
      downloadFailed,
      validationPassed,
      validationFailed,
      ocrSucceeded,
      ocrFailed,
      classificationSucceeded,
      classificationFailed,
      downloadSuccessRate: toProcess.length > 0
        ? `${((downloadSucceeded / toProcess.length) * 100).toFixed(1)}%`
        : '0%',
      ingestionSuccessRate: toProcess.length > 0
        ? `${((classificationSucceeded / toProcess.length) * 100).toFixed(1)}%`
        : '0%',
    },
    failureCategoryBreakdown: failureCategories,
    failuresByType: {
      timeout: failedResults.filter(r => r.diagnostics.failureCategory === 'timeout').length,
      redirect_failure: failedResults.filter(r => r.diagnostics.failureCategory === 'redirect_failure').length,
      mime_mismatch: failureCategories['mime_mismatch'],
      file_size_rejection: failureCategories['file_size_rejection'],
      network_reset: failedResults.filter(r => r.diagnostics.failureCategory === 'network_reset').length,
      invalid_pdf_parse: failureCategories['invalid_pdf_parse'],
      http_error: failedResults.filter(r => r.diagnostics.failureCategory === 'http_error').length,
    },
    downloadFailures: results
      .filter(r => r.status === 'download_failed')
      .map(r => ({
        url: r.sourceUrl,
        agency: r.agencyName,
        httpStatus: r.diagnostics.httpStatus,
        contentType: r.diagnostics.contentType,
        contentLength: r.diagnostics.contentLength,
        redirectChain: r.diagnostics.redirectChain,
        downloadDurationMs: r.diagnostics.downloadDurationMs,
        failureReason: r.diagnostics.failureReason,
        failureCategory: r.diagnostics.failureCategory,
        retryAttempts: r.diagnostics.retryAttempts,
      })),
    validationFailures: results
      .filter(r => r.status === 'validation_failed')
      .map(r => ({
        url: r.sourceUrl,
        agency: r.agencyName,
        mimeType: r.mimeType,
        fileSizeBytes: r.fileSizeBytes,
        error: r.error,
      })),
    ocrFailures: results
      .filter(r => r.status === 'ocr_failed')
      .slice(0, 200)
      .map(r => ({
        url: r.sourceUrl,
        agency: r.agencyName,
        mimeType: r.mimeType,
        fileSizeBytes: r.fileSizeBytes,
        ocrMethod: r.ocrMethod,
        textLength: r.textLength,
        error: r.error,
      })),
    httpStatusDistribution: results.reduce((acc, r) => {
      const status = r.diagnostics.httpStatus ? String(r.diagnostics.httpStatus) : 'null';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    contentTypeDistribution: results.reduce((acc, r) => {
      const ct = r.diagnostics.contentType || 'null';
      acc[ct] = (acc[ct] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    redirectStats: {
      documentsWithRedirects: results.filter(r => r.diagnostics.redirectChain.length > 0).length,
      avgRedirectsPerDoc: results.filter(r => r.diagnostics.redirectChain.length > 0).length > 0
        ? (results.reduce((sum, r) => sum + r.diagnostics.redirectChain.length, 0) /
          results.filter(r => r.diagnostics.redirectChain.length > 0).length).toFixed(1)
        : '0',
    },
    retryStats: {
      documentsRetried: results.filter(r => r.diagnostics.retryAttempts > 0).length,
      avgRetriesPerDoc: results.filter(r => r.diagnostics.retryAttempts > 0).length > 0
        ? (results.reduce((sum, r) => sum + r.diagnostics.retryAttempts, 0) /
          results.filter(r => r.diagnostics.retryAttempts > 0).length).toFixed(1)
        : '0',
      retriesRecoveredSuccess: results.filter(r => r.diagnostics.retryAttempts > 0 && r.diagnostics.failureCategory === 'success').length,
    },
  };

  writeReport('pdf_download_failure_analysis.json', phase109Report);

  console.log(`  Download success: ${downloadSucceeded}/${toProcess.length} (${phase109Report.summary.downloadSuccessRate})`);
  console.log(`  Validation passed: ${validationPassed}`);
  console.log(`  OCR succeeded: ${ocrSucceeded}`);
  console.log(`  Classified: ${classificationSucceeded}`);
  console.log(`  Failure categories: ${JSON.stringify(failureCategories)}`);

  // ---------------------------------------------------------------------------
  // Generate Phase 114 Report: pdf_ingestion_repair_results.json
  // ---------------------------------------------------------------------------

  console.log('');
  console.log('+---------------------------------------------------------------------------+');
  console.log('|  Phase 114 Report — Ingestion Repair Results                              |');
  console.log('+---------------------------------------------------------------------------+');

  const phase114Report = {
    phase: 114,
    title: 'PDF Ingestion Repair Results',
    generatedAt: new Date().toISOString(),
    improvements: {
      phase110: 'Relaxed MIME validation: added application/octet-stream, binary/octet-stream, text/pdf, application/x-pdf; URL .pdf override',
      phase111: 'Redirect support: maxRedirects=5 with chain logging',
      phase112: 'Retry logic: 3 retries with exponential backoff (2s, 4s, 8s) on timeout, ECONNRESET, 5xx',
      phase113: 'File size: 100MB max with streaming downloads, 60s timeout',
    },
    summary: {
      totalUrlsProcessed: toProcess.length,
      documentsDownloaded: downloadSucceeded,
      documentsValidated: validationPassed,
      ocrProcessed: ocrSucceeded,
      documentsClassified: classificationSucceeded,
      documentsRejected: downloadFailed + validationFailed,
      downloadSuccessRate: toProcess.length > 0
        ? `${((downloadSucceeded / toProcess.length) * 100).toFixed(1)}%`
        : '0%',
      fullIngestionRate: toProcess.length > 0
        ? `${((classificationSucceeded / toProcess.length) * 100).toFixed(1)}%`
        : '0%',
      runtimeMs: totalDuration,
      runtimeMinutes: Math.round(totalDuration / 60000),
    },
    ocrMethodDistribution: ocrMethods,
    avgOcrRuntimeMs: ocrCount > 0 ? Math.round(ocrTotalMs / ocrCount) : 0,
    topClassifiedDocuments: results
      .filter(r => r.status === 'classified' && r.topicName)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 50)
      .map(r => ({
        agency: r.agencyName,
        title: r.title,
        topic: r.topicName,
        confidence: r.confidence,
        textLength: r.textLength,
        ocrMethod: r.ocrMethod,
        fileSizeBytes: r.fileSizeBytes,
      })),
    statusBreakdown: {
      classified: results.filter(r => r.status === 'classified').length,
      ocr_success: results.filter(r => r.status === 'ocr_success').length,
      validated: results.filter(r => r.status === 'validated').length,
      ocr_failed: results.filter(r => r.status === 'ocr_failed').length,
      validation_failed: results.filter(r => r.status === 'validation_failed').length,
      download_failed: results.filter(r => r.status === 'download_failed').length,
      classification_failed: results.filter(r => r.status === 'classification_failed').length,
    },
    comparisonWithPrevious: {
      previousDownloadFailed: 218,
      currentDownloadFailed: downloadFailed,
      previousValidationFailed: 6,
      currentValidationFailed: validationFailed,
      previousOcrFailed: 1574,
      currentOcrFailed: ocrFailed,
      previousSucceeded: 0,
      currentSucceeded: classificationSucceeded,
      downloadRecovery: `${218 - downloadFailed} documents recovered via retry/redirect`,
      validationRecovery: `${6 - validationFailed} documents recovered via relaxed MIME`,
    },
    allResults: results.map(r => ({
      agency: r.agencyName,
      title: r.title,
      url: r.sourceUrl,
      status: r.status,
      mimeType: r.mimeType,
      fileSizeBytes: r.fileSizeBytes,
      ocrMethod: r.ocrMethod,
      textLength: r.textLength,
      topic: r.topicName,
      confidence: r.confidence,
      runtimeMs: r.runtimeMs,
      error: r.error,
      httpStatus: r.diagnostics.httpStatus,
      contentType: r.diagnostics.contentType,
      redirectChain: r.diagnostics.redirectChain,
      retryAttempts: r.diagnostics.retryAttempts,
    })),
  };

  writeReport('pdf_ingestion_repair_results.json', phase114Report);

  // ---------------------------------------------------------------------------
  // Final Summary
  // ---------------------------------------------------------------------------

  console.log('');
  console.log('================================================================================');
  console.log('  DOCUMENT INGESTION REPAIR COMPLETE');
  console.log('================================================================================');
  console.log('');
  console.log(`  Phase 109 (Diagnostics):    ${toProcess.length} URLs analyzed, ${downloadFailed} download failures categorized`);
  console.log(`  Phase 110 (MIME Relaxed):    ${4} new MIME types added + URL .pdf override`);
  console.log(`  Phase 111 (Redirects):       maxRedirects=5, ${results.filter(r => r.diagnostics.redirectChain.length > 0).length} docs had redirects`);
  console.log(`  Phase 112 (Retry):           ${results.filter(r => r.diagnostics.retryAttempts > 0).length} docs retried, ${phase109Report.retryStats.retriesRecoveredSuccess} recovered`);
  console.log(`  Phase 113 (Size/Streaming):  100MB max, 60s timeout, streaming downloads`);
  console.log(`  Phase 114 (Reprocessing):    ${downloadSucceeded} downloaded, ${validationPassed} validated, ${ocrSucceeded} OCR'd, ${classificationSucceeded} classified`);
  console.log('');
  console.log(`  Total Runtime: ${Math.round(totalDuration / 1000)}s (${Math.round(totalDuration / 60000)}m)`);
  console.log('');
  console.log('  Reports generated:');
  console.log('    reports/pdf_download_failure_analysis.json');
  console.log('    reports/pdf_ingestion_repair_results.json');
  console.log('');
  console.log('  No new crawl performed. No CPRA emails sent.');
  console.log('================================================================================');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  try {
    await runIngestionRepair();
  } catch (err) {
    console.error('FATAL ERROR:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
