import { readFile } from 'node:fs/promises';
import { req, registerUser, API, exercisedApiRoutes } from '../lib/harness.mjs';
import { PrismaClient } from '../../../backend/node_modules/@prisma/client/default.js';
const prisma = new PrismaClient();
const u = await registerUser({ prefix: 'p11', defaultRole: 'attorney' });
const r = await req('POST', '/api/cases', { token: u.token, body: { title: 'Phase 11', caseNumber: `P11-${Date.now()}`, jurisdiction: 'Alameda County', caseType: 'felony' } });
const caseId = r.json.case.caseId;
const MIME = { png: 'image/png', pdf: 'application/pdf' };
for (const f of ['rotated-page-scan.png', 'missing-pages-production.pdf', 'handwritten-statement.png']) {
  const form = new FormData();
  form.append('caseId', caseId);
  form.append('evidenceType', 'police_report');
  form.append('file', new Blob([await readFile(`/tmp/courtaccess-fixtures/${f}`)], { type: MIME[f.split('.').pop()] }), f);
  exercisedApiRoutes.add('POST /api/evidence/upload');
  const res = await fetch(`${API}/api/evidence/upload`, { method: 'POST', headers: { Authorization: `Bearer ${u.token}` }, body: form });
  const j = await res.json().catch(() => ({}));
  const id = j.evidence?.evidenceId;
  for (let i = 0; i < 200 && id; i++) {
    const row = await prisma.evidence.findUnique({ where: { evidenceId: id } });
    if (row && row.processingStatus !== 'ingesting') {
      const chunks = await prisma.evidenceChunk.count({ where: { evidenceId: id } });
      console.log(`\n${f}\n  status : ${row.processingStatus}\n  chunks : ${chunks}\n  message: ${row.processingError ?? '(none)'}`);
      break;
    }
    await new Promise((x) => setTimeout(x, 500));
  }
}
await prisma.$disconnect();
