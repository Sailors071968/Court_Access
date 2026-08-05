#!/usr/bin/env node
// Phase 3/4/5 — Document, media and failure-handling ingestion certification.
//
// Uploads every fixture through the real POST /api/evidence/upload endpoint,
// waits for the ingestion pipeline to reach a terminal state, then checks the
// outcome against what that fixture should produce. Extraction is verified by
// reading the EvidenceChunk rows the pipeline wrote, not by trusting a status
// field.

import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { Results, req, registerUser, API, ROOT } from './lib/harness.mjs';
import { PrismaClient } from '../../backend/node_modules/@prisma/client/default.js';

const FIXTURES = '/tmp/courtaccess-fixtures';
const prisma = new PrismaClient();

const manifest = JSON.parse(await readFile(path.join(FIXTURES, 'MANIFEST.json'), 'utf8'));

// Which evidence type to declare for each fixture kind.
function evidenceTypeFor(file) {
  if (/bodycam/i.test(file)) return 'bodycam';
  if (/dashcam/i.test(file)) return 'dashcam';
  if (/(witness|interview|surveillance)/i.test(file) && /\.(mp4|mov|avi|mkv|m4v)$/i.test(file))
    return 'witness_video';
  if (/transcript/i.test(file)) return 'transcript';
  if (/police-report/i.test(file)) return 'police_report';
  if (/dispatch|cad/i.test(file)) return 'dispatch_log';
  if (/(lab|dna|ballistics|forensic)/i.test(file)) return 'forensic_report';
  if (/photo|scan|\.(png|jpe?g|tiff?)$/i.test(file)) return 'photo';
  return 'other_document';
}

// The words a user-facing explanation must contain for each failure mode, so
// that "why did this fail" is answerable without reading server logs.
const EXPLANATION_KEYWORDS = {
  'explain-password-protected': [/password/i, /encrypt/i],
  'explain-corrupt': [/corrupt/i, /damaged/i, /truncat/i, /incomplete/i, /not a valid/i, /unreadable/i],
  'explain-empty': [/empty/i, /zero bytes/i, /no content/i],
  'explain-unsupported': [/unsupported/i, /not supported/i, /cannot be read/i],
  'no-text-explained': [/no (extractable |readable |detectable )?text/i, /blank/i, /image contains no/i],
  'explain-no-speech': [/no (detectable )?speech/i, /no audio/i, /silent/i],
  'low-confidence-warning': [/confidence/i, /manual review/i, /scan quality/i, /illegible/i],
};

// The content types a browser would attach, so the suite exercises the same
// input the product actually receives.
const BROWSER_MIME = {
  pdf: 'application/pdf',
  txt: 'text/plain',
  csv: 'text/csv',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  tiff: 'image/tiff',
  tif: 'image/tiff',
  zip: 'application/zip',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  avi: 'video/x-msvideo',
  mkv: 'video/x-matroska',
  m4v: 'video/x-m4v',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  aac: 'audio/aac',
  m4a: 'audio/mp4',
  flac: 'audio/flac',
  exe: 'application/x-msdownload',
};

/** Strip the quoted file name so keyword matching scores the explanation only. */
function withoutFileName(message, file) {
  const base = file.replace(/\.[^.]+$/, '');
  return message.split(file).join(' ').split(base).join(' ');
}

async function uploadFixture(token, caseId, file) {
  const buf = await readFile(path.join(FIXTURES, file));
  const ext = file.split('.').pop().toLowerCase();
  const type = BROWSER_MIME[ext] ?? 'application/octet-stream';
  const form = new FormData();
  form.append('caseId', caseId);
  form.append('evidenceType', evidenceTypeFor(file));
  form.append('file', new Blob([buf], { type }), file);

  const started = performance.now();
  const res = await fetch(`${API}/api/evidence/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    /* keep raw text */
  }
  return {
    status: res.status,
    json,
    text,
    ms: Math.round(performance.now() - started),
    bytes: buf.length,
  };
}

async function waitForTerminal(evidenceId, timeoutMs = 180000) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    const row = await prisma.evidence.findUnique({
      where: { evidenceId },
      select: {
        processingStatus: true,
        processingError: true,
        normalizedPageCount: true,
        mimeType: true,
        size: true,
      },
    });
    last = row;
    if (!row) break;
    if (row.processingStatus !== 'ingesting' && row.processingStatus !== 'processing') break;
    await new Promise((r) => setTimeout(r, 750));
  }
  const chunks = await prisma.evidenceChunk.count({ where: { evidenceId } });
  const sample = await prisma.evidenceChunk.findFirst({
    where: { evidenceId },
    select: { text: true },
  });
  return { ...last, chunkCount: chunks, sampleText: sample?.text ?? null };
}

// ---------------------------------------------------------------------------

const results = new Results('INGESTION_CERTIFICATION', 'Phase 3/4/5 — Ingestion, Media, Failure Handling');

const owner = await registerUser({ prefix: 'ingest', defaultRole: 'attorney' });
if (!owner.token) throw new Error(`could not register: ${owner.status} ${owner.raw?.text}`);

const caseRes = await req('POST', '/api/cases', {
  token: owner.token,
  body: {
    title: 'People v. Doe — ingestion certification',
    caseNumber: `CERT-INGEST-${Date.now()}`,
    defendantName: 'John Doe',
    jurisdiction: 'Alameda County',
    caseType: 'felony',
  },
});
if (caseRes.status !== 201) throw new Error(`could not create case: ${caseRes.status} ${caseRes.text}`);
const caseId = caseRes.json.case.caseId;
console.log(`case ${caseId}\n`);

const details = [];

for (const entry of manifest) {
  const { file, kind, expectation } = entry;
  const size = (await stat(path.join(FIXTURES, file))).size;
  const up = await uploadFixture(owner.token, caseId, file);

  const record = {
    file,
    kind,
    expectation,
    bytes: size,
    uploadStatus: up.status,
    uploadMs: up.ms,
  };

  if (up.status !== 201) {
    record.rejectionBody = up.json ?? up.text?.slice(0, 300);
    const msg = [record.rejectionBody?.error, record.rejectionBody?.message]
      .filter(Boolean)
      .join(' — ');
    record.rejectionMessage = msg;

    // Rejecting at the door is the right answer for dangerous or unsupported
    // files, provided the response says which file and why.
    const namesFile = msg.includes(file);
    const wanted = EXPLANATION_KEYWORDS[expectation] ?? [];
    const specific = wanted.length === 0 || wanted.some((kw) => kw.test(withoutFileName(msg, file)));
    const generic = /^(upload failed|unknown error|internal server error)\.?$/i.test(msg.trim());

    if (expectation === 'reject' || expectation.startsWith('explain-')) {
      if (!generic && namesFile && specific) {
        results.pass(`ING-${file}`, `${file} rejected with a specific reason`, `HTTP ${up.status}: ${msg.slice(0, 150)}`, record);
      } else if (!generic) {
        results.warn(
          `ING-${file}`,
          `${file} rejected but the reason is incomplete`,
          `HTTP ${up.status}: ${msg.slice(0, 150)}`,
          record,
        );
      } else {
        results.fail(`ING-${file}`, `${file} rejected with a generic message`, `HTTP ${up.status}: ${msg}`, record);
      }
    } else {
      results.fail(
        `ING-${file}`,
        `${file} rejected although it should have been ingested`,
        `HTTP ${up.status}: ${msg.slice(0, 180)}`,
        record,
      );
    }
    details.push(record);
    continue;
  }

  const evidenceId = up.json.evidence.evidenceId;
  const final = await waitForTerminal(evidenceId);
  Object.assign(record, {
    evidenceId,
    processingStatus: final.processingStatus,
    processingError: final.processingError,
    chunkCount: final.chunkCount,
    storedMimeType: final.mimeType,
    extractedSample: final.sampleText ? final.sampleText.slice(0, 160) : null,
  });

  const gotText = final.chunkCount > 0;

  switch (expectation) {
    case 'extract-text':
    case 'ocr-text': {
      if (gotText) {
        results.pass(
          `ING-${file}`,
          `${file} ingested with text`,
          `${final.chunkCount} chunks, status=${final.processingStatus}`,
          record,
        );
      } else {
        results.fail(
          `ING-${file}`,
          `${file} produced no searchable text`,
          `status=${final.processingStatus} error=${final.processingError ?? 'none'}`,
          record,
        );
      }
      break;
    }
    case 'container-handled': {
      // A ZIP should either be expanded or clearly explained as a container.
      const explained = Boolean(final.processingError);
      results[gotText || explained ? 'warn' : 'fail'](
        `ING-${file}`,
        `${file} archive handling`,
        gotText
          ? `expanded into ${final.chunkCount} chunks`
          : `status=${final.processingStatus} error=${final.processingError ?? 'none'}`,
        record,
      );
      break;
    }
    case 'accepted-queued': {
      // Media is accepted here and transcribed elsewhere; the record must say so.
      const explained = Boolean(final.processingError);
      results[explained ? 'pass' : 'warn'](
        `ING-${file}`,
        `${file} accepted as media`,
        `status=${final.processingStatus} error=${final.processingError ?? 'none'}`,
        record,
      );
      break;
    }
    default: {
      // Every remaining fixture is a failure mode. The requirement from Phase 5
      // is that the explanation names the actual problem rather than being a
      // generic failure string.
      const want = EXPLANATION_KEYWORDS[expectation] ?? [];
      const explanation = final.processingError ?? '';
      // The message quotes the file name, and fixture names contain words like
      // "corrupt" and "silent". Matching against the name would let a generic
      // message score as specific, so it is removed before matching.
      const named = want.some((kw) => kw.test(withoutFileName(explanation, file)));
      record.explanation = explanation;
      record.requiredKeywords = want.map(String);

      if (named) {
        results.pass(
          `ING-${file}`,
          `${file} failure explained`,
          `"${explanation}"`,
          record,
        );
      } else if (explanation) {
        results.fail(
          `ING-${file}`,
          `${file} failure not explained specifically`,
          `stored message "${explanation}" does not identify the cause (${expectation})`,
          record,
        );
      } else {
        results.fail(
          `ING-${file}`,
          `${file} failed silently`,
          `status=${final.processingStatus} with no explanation recorded`,
          record,
        );
      }
    }
  }
  details.push(record);
}

await results.write({ caseId, fixtureCount: manifest.length, details });
await prisma.$disconnect();
