#!/usr/bin/env node
// Program 153, Phase 11 — administrative quality assurance.
//
// Looks for the things that put something in front of a user which the record
// does not support: invented data written into a view, numbers that never
// change, pages nobody can reach, routes that render nothing, and findings
// served without a citation.
//
// Three fabricated widgets have been found in this codebase by hand across two
// programmes, every one of them in a view an attorney saw on sign-in. Hand
// searching found them late. This is the sweep that should find the next one
// first, and it is wired into the release gate so a breach blocks certification
// rather than being noted and forgotten.

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { Results, req, registerUser, OUT_DIR } from './lib/harness.mjs';
import { PrismaClient } from '../../backend/node_modules/@prisma/client/default.js';
import { writeFile } from 'node:fs/promises';

const prisma = new PrismaClient();
const results = new Results('QUALITY_ASSURANCE', 'Program 153 — Administrative Quality Assurance');
const SRC = '/workspace/src';
const BACKEND = '/workspace/backend/src';
const WEB = process.env.CERT_WEB_BASE || 'http://127.0.0.1:4180';

async function walk(dir, filter) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(abs, filter)));
    else if (e.isFile() && filter(abs)) out.push(abs);
  }
  return out;
}

const components = await walk(SRC, (f) => f.endsWith('.tsx'));
const findings = { fabricated: [], fixedMetrics: [], placeholders: [], deadRoutes: [], unreachable: [], uncited: [] };

// ---------------------------------------------------------------------------
// Invented data written into a view
// ---------------------------------------------------------------------------

// Language a reader takes as a statement about their own case.
const READS_AS_FACT =
  /\b(?:People v\.|Case #|hours ago|days ago|minutes ago|recommendation signal|deadline approaching|Filing Deadline|Evidence dispute)\b/i;

for (const file of components) {
  const src = await readFile(file, 'utf8');
  const rel = file.replace('/workspace/', '');

  // A named literal dataset.
  for (const m of src.matchAll(/const\s+(\w*(?:mock|sample|dummy|fake|demo|seed)\w*)\s*(?::[^=]+)?=\s*\[/gi)) {
    findings.fabricated.push({ file: rel, line: src.slice(0, m.index).split('\n').length, what: `named dataset "${m[1]}"` });
  }

  // An array of object literals mapped straight into the page. This is how all
  // three found so far actually reached a screen.
  for (const m of src.matchAll(/\{\s*\[\s*\n([\s\S]{40,6000}?)\]\s*\.map\(/g)) {
    const block = m[1];
    if (!/^\s*\{/m.test(block)) continue;
    const line = src.slice(0, m.index).split('\n').length;

    if (READS_AS_FACT.test(block)) {
      findings.fabricated.push({ file: rel, line, what: 'inline dataset reading as fact about a case' });
      continue;
    }
    // A fixed number beside a label is a finding as far as the reader knows.
    if (/\blabel\s*:\s*['"][^'"]{4,60}['"]/.test(block) && /\bvalue\s*:\s*['"]?\d/.test(block)) {
      findings.fixedMetrics.push({ file: rel, line, what: 'fixed number rendered beside a label' });
    }
  }

  // Surfaces that admit they do nothing.
  for (const [i, lineText] of src.split('\n').entries()) {
    if (/placeholder\s*=/.test(lineText)) continue; // a form hint is legitimate
    if (/\b(Coming soon|Not yet implemented|Under construction|Lorem ipsum)\b/i.test(lineText)) {
      findings.placeholders.push({ file: rel, line: i + 1, what: lineText.trim().slice(0, 90) });
    }
  }
}

findings.fabricated.length === 0
  ? results.pass('QA-01', 'No view writes invented case data into the page', `${components.length} components scanned`)
  : results.fail(
      'QA-01',
      'A view writes invented case data into the page',
      findings.fabricated.map((f) => `${f.file}:${f.line} — ${f.what}`).join('; '),
    );

findings.fixedMetrics.length === 0
  ? results.pass('QA-02', 'No view renders a fixed number as though it were a measurement', 'no static metrics')
  : results.fail(
      'QA-02',
      'A view renders a fixed number as a measurement',
      findings.fixedMetrics.map((f) => `${f.file}:${f.line}`).join('; '),
    );

findings.placeholders.length === 0
  ? results.pass('QA-03', 'No surface tells the user it is unfinished', 'no placeholder surfaces')
  : results.warn(
      'QA-03',
      'A surface admits it is unfinished',
      findings.placeholders.map((f) => `${f.file}:${f.line}`).join('; '),
    );

// ---------------------------------------------------------------------------
// Routes that render nothing, and pages nobody can reach
// ---------------------------------------------------------------------------

const app = await readFile(path.join(SRC, 'App.tsx'), 'utf8');
const routePaths = [...app.matchAll(/path="([^"]+)"/g)].map((m) => m[1]);

// A route whose element is not an imported or lazily loaded component.
const elements = [...new Set([...app.matchAll(/element=\{<([A-Z][A-Za-z0-9_]*)/g)].map((m) => m[1]))];
const imported = new Set(
  [...app.matchAll(/import\s+(?:\{([^}]+)\}|([A-Z][A-Za-z0-9_]*))/g)].flatMap((m) =>
    (m[1] ?? m[2] ?? '').split(',').map((x) => x.trim().split(/\s+as\s+/).pop()).filter(Boolean),
  ),
);
const lazy = new Set([...app.matchAll(/const\s+([A-Z][A-Za-z0-9_]*)\s*=\s*(?:React\.)?lazy/g)].map((m) => m[1]));
findings.deadRoutes = elements.filter((e) => !imported.has(e) && !lazy.has(e));

findings.deadRoutes.length === 0
  ? results.pass('QA-04', 'Every route renders a component that exists', `${routePaths.length} routes`)
  : results.fail('QA-04', 'A route renders nothing', findings.deadRoutes.join(', '));

// Administrator pages must be reachable by clicking, not only by typing a URL.
const sidebar = await readFile(path.join(SRC, 'components/layout/Sidebar.tsx'), 'utf8');
const navTargets = new Set([...sidebar.matchAll(/path:\s*'([^']+)'/g)].map((m) => m[1]));
findings.unreachable = routePaths
  .filter((p) => p.includes('admin') && !p.includes(':'))
  .map((p) => (p.startsWith('/') ? p : `/${p}`))
  .filter((p) => !navTargets.has(p));

findings.unreachable.length === 0
  ? results.pass('QA-05', 'Every administrator page can be reached from the navigation', 'no URL-only pages')
  : results.fail('QA-05', 'An administrator page is reachable only by typing its URL', findings.unreachable.join(', '));

// ---------------------------------------------------------------------------
// Every route the application declares must actually serve
// ---------------------------------------------------------------------------

const sampled = ['/dashboard', '/cases', '/admin', '/admin/gold-standard', '/admin/readiness', '/admin/statutory-intelligence'];
let served = 0;
for (const route of sampled) {
  const res = await fetch(`${WEB}${route}`).catch(() => null);
  if (res?.ok) served++;
}
served === sampled.length
  ? results.pass('QA-06', 'Every sampled route is served by the application', `${served}/${sampled.length}`)
  : results.fail('QA-06', 'A declared route is not served', `${served}/${sampled.length}`);

// ---------------------------------------------------------------------------
// Findings served without a citation
//
// The constitution's whole point: nothing appears without the evidence behind
// it. This checks the live API rather than the source.
// ---------------------------------------------------------------------------

const account = await registerUser({ prefix: 'qa-atty', defaultRole: 'attorney' });
const token = account.token;

const made = await req('POST', '/api/cases', {
  token,
  body: { title: 'People v. Quality', caseNumber: `QA-${Date.now()}`, jurisdiction: 'Los Angeles County', caseType: 'felony' },
});
const caseId = made.json?.case?.caseId ?? made.json?.caseId;

const report = `
LOS ANGELES POLICE DEPARTMENT — INVESTIGATIVE REPORT
I detained the driver and conducted a warrantless search of the vehicle. The item was booked into evidence and
transferred to the laboratory. The subject was advised of his Miranda rights and stated he did not know the
backpack was there and that other people had access to the vehicle.
`;
const { createHash } = await import('node:crypto');
const evidence = await prisma.evidence.create({
  data: {
    caseId,
    tenantId: account.user.tenantId,
    uploadedBy: account.user.userId,
    fileName: 'QA Report.pdf',
    size: BigInt(report.length),
    mimeType: 'application/pdf',
    evidenceType: 'police_report',
    processingStatus: 'completed',
  },
});
await prisma.evidenceChunk.create({
  data: {
    evidenceId: evidence.evidenceId,
    tenantId: account.user.tenantId,
    chunkIndex: 0,
    text: report,
    startOffset: 0,
    endOffset: report.length,
    charCount: report.length,
    checksum: createHash('sha256').update(report).digest('hex').slice(0, 16),
  },
});

// Every theme reported as supported must cite a document that exists.
const themes = await req('GET', `/api/cases/${caseId}/defense-themes`, { token, timeoutMs: 120000 });
const supported = (themes.json?.themes ?? []).filter((t) => t.status === 'supported');
const uncitedThemes = supported.filter((t) => t.citations.length === 0 || t.citations.some((c) => !c.fileName || !c.excerpt));
uncitedThemes.length === 0 && supported.length > 0
  ? results.pass('QA-07', 'Every finding served is accompanied by the passage that produced it', `${supported.length} findings, all cited`)
  : results.fail(
      'QA-07',
      'A finding was served without a citation',
      uncitedThemes.length > 0 ? uncitedThemes.map((t) => t.label).join(', ') : 'no findings produced at all',
    );

// A citation must point at a document that is genuinely in the case.
const caseEvidence = await prisma.evidence.findMany({ where: { caseId }, select: { evidenceId: true } });
const realIds = new Set(caseEvidence.map((e) => e.evidenceId));
const broken = supported.flatMap((t) => t.citations).filter((c) => !realIds.has(c.evidenceId));
broken.length === 0
  ? results.pass('QA-08', 'Every citation points at a document that exists in the case', `${supported.flatMap((t) => t.citations).length} citations resolved`)
  : results.fail('QA-08', 'A citation points at a document that is not in the case', broken.slice(0, 3).map((c) => c.fileName).join(', '));

// And the quoted words must genuinely be in that document.
const chunkText = new Map();
for (const e of caseEvidence) {
  const chunks = await prisma.evidenceChunk.findMany({ where: { evidenceId: e.evidenceId }, select: { text: true } });
  chunkText.set(e.evidenceId, chunks.map((c) => c.text).join('\n').replace(/\s+/g, ' '));
}
const misquoted = supported.flatMap((t) => t.citations).filter((c) => {
  const core = c.excerpt.replace(/^…|…$/g, '').slice(0, 60).trim().replace(/\s+/g, ' ');
  return core.length > 20 && !(chunkText.get(c.evidenceId) ?? '').includes(core);
});
misquoted.length === 0
  ? results.pass('QA-09', 'Every quoted passage genuinely appears in the document it is attributed to', 'no misquotation')
  : results.fail('QA-09', 'A quoted passage is not in the document it is attributed to', misquoted[0].excerpt.slice(0, 110));

// Motion issues must carry their support too.
const motions = await req('GET', `/api/cases/${caseId}/motion-issues`, { token, timeoutMs: 120000 });
const issues = motions.json?.issues ?? [];
issues.length > 0 && issues.every((i) => i.supportingEvidence.length > 0 && i.whyItAppears)
  ? results.pass('QA-10', 'Every issue explains why it appears and cites what raised it', `${issues.length} issues`)
  : results.fail('QA-10', 'An issue was served without support or explanation', `${issues.length} issues`);

// ---------------------------------------------------------------------------
// Nothing anywhere may state a conclusion
// ---------------------------------------------------------------------------

const surfaces = ['defense-themes', 'motion-issues', 'war-room', 'family-view', 'executive-summary'];
const conclusory = [];
for (const surface of surfaces) {
  const r = await req('GET', `/api/cases/${caseId}/${surface}`, { token, timeoutMs: 120000 });
  if (r.status !== 200) continue;
  // The caveat's job is to name what the page does not do.
  const { caveat: _c, ...content } = r.json;
  const body = JSON.stringify(content);
  if (/\bshould (?:file|be filed|plead)\b|\blikely to (?:succeed|prevail|win)\b|\bis (?:guilty|innocent)\b|\bwe recommend\b/i.test(body)) {
    conclusory.push(surface);
  }
}
conclusory.length === 0
  ? results.pass('QA-11', 'No surface states a conclusion about guilt, merits or outcome', `${surfaces.length} surfaces checked`)
  : results.fail('QA-11', 'A surface stated a conclusion', conclusory.join(', '));

// ---------------------------------------------------------------------------
// Backend engines nothing calls
// ---------------------------------------------------------------------------

const backendFiles = await walk(BACKEND, (f) => f.endsWith('.ts'));
const allBackend = await Promise.all(backendFiles.map((f) => readFile(f, 'utf8')));
const orphans = [];
for (const [i, file] of backendFiles.entries()) {
  const base = path.basename(file, '.ts');
  if (/^(index|server|types|constants)$/.test(base)) continue;
  if (!/Service|Engine|Generator|Analyzer|Analysis/.test(base)) continue;
  const referenced = allBackend.some((src, j) => j !== i && src.includes(base));
  if (!referenced) orphans.push(file.replace('/workspace/', ''));
}
orphans.length === 0
  ? results.pass('QA-12', 'No analysis engine is shipped that nothing calls', `${backendFiles.length} modules scanned`)
  : results.warn(
      'QA-12',
      'An analysis engine is shipped that nothing calls',
      `${orphans.length}: ${orphans.slice(0, 5).join(', ')}. Dead code invites someone to wire it up later without ` +
        'knowing whether it was ever correct.',
    );

// ---------------------------------------------------------------------------
// The verdict, written where the release gate can read it
// ---------------------------------------------------------------------------

const blocking =
  findings.fabricated.length + findings.fixedMetrics.length + findings.deadRoutes.length + findings.unreachable.length;

blocking === 0
  ? results.pass(
      'QA-13',
      'Nothing found that would put unsupported content in front of a user',
      'no fabricated data, no fixed metrics, no dead routes, no unreachable pages',
    )
  : results.fail('QA-13', 'Quality assurance found content a user cannot rely on', `${blocking} blocking finding(s)`);

await writeFile(path.join(OUT_DIR, 'QUALITY_FINDINGS.json'), JSON.stringify(findings, null, 2));
await results.write({ findings, componentsScanned: components.length, backendModulesScanned: backendFiles.length });
await prisma.$disconnect();
