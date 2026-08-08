#!/usr/bin/env node
// Distinguishes "OCR is broken" from "the MIME type never reached the OCR
// branch" by uploading the same scan twice: once with the content type the
// browser would send, once with none at all.

import { readFile } from 'node:fs/promises';
import { req, registerUser, API } from '../lib/harness.mjs';
import { PrismaClient } from '../../../backend/node_modules/@prisma/client/default.js';

const prisma = new PrismaClient();
const owner = await registerUser({ prefix: 'ocrprobe' });
const caseRes = await req('POST', '/api/cases', {
  token: owner.token,
  body: {
    title: 'OCR probe',
    caseNumber: `OCR-${Date.now()}`,
    jurisdiction: 'Alameda County',
    caseType: 'felony',
  },
});
const caseId = caseRes.json.case.caseId;

async function upload(file, contentType) {
  const buf = await readFile(`/tmp/courtaccess-fixtures/${file}`);
  const form = new FormData();
  form.append('caseId', caseId);
  form.append('evidenceType', 'photo');
  form.append('file', new Blob([buf], contentType ? { type: contentType } : {}), file);
  const res = await fetch(`${API}/api/evidence/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${owner.token}` },
    body: form,
  });
  const json = await res.json();
  const id = json.evidence?.evidenceId;
  for (let i = 0; i < 200; i++) {
    const row = await prisma.evidence.findUnique({ where: { evidenceId: id } });
    if (row && row.processingStatus !== 'ingesting') {
      const chunks = await prisma.evidenceChunk.count({ where: { evidenceId: id } });
      const first = await prisma.evidenceChunk.findFirst({ where: { evidenceId: id } });
      return {
        storedMime: row.mimeType,
        status: row.processingStatus,
        error: row.processingError,
        chunks,
        text: first?.text?.slice(0, 200) ?? null,
      };
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return { timeout: true };
}

for (const [label, ct] of [
  ['content-type image/png (what a browser sends)', 'image/png'],
  ['no content-type at all', null],
]) {
  const r = await upload('scanned-police-report.png', ct);
  console.log(`\n--- ${label}`);
  console.log(`    stored mimeType : ${r.storedMime}`);
  console.log(`    status          : ${r.status}`);
  console.log(`    processingError : ${r.error}`);
  console.log(`    chunks          : ${r.chunks}`);
  console.log(`    text sample     : ${r.text ? JSON.stringify(r.text.slice(0, 120)) : 'none'}`);
}

await prisma.$disconnect();
