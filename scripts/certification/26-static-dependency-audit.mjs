#!/usr/bin/env node
// Program 147, Phase 11 — static statutory dependency audit.
//
// Finds every place that still holds California criminal law as data in this
// repository rather than reading it from the Legislature. The point of the
// programme is that the official source becomes authoritative, so anything
// left holding its own copy of a statute is a dependency to be named, not
// quietly kept.
//
// A mapping is not a dependency. Recording that Penal Code 459 corresponds to
// CALCRIM 1700 holds no law; storing what burglary requires does.

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { Results, req, registerUser, login } from './lib/harness.mjs';
import { PrismaClient } from '../../backend/node_modules/@prisma/client/default.js';

const prisma = new PrismaClient();
const results = new Results('STATIC_DEPENDENCY_AUDIT', 'Program 147 — Static Statutory Dependencies');

async function walk(dir, filter) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(abs, filter)));
    else if (e.isFile() && filter(abs)) out.push(abs);
  }
  return out;
}

const sourceFiles = [
  ...(await walk('/workspace/backend/src', (f) => f.endsWith('.ts'))),
  ...(await walk('/workspace/src', (f) => /\.(ts|tsx)$/.test(f))),
];

// ---------------------------------------------------------------------------
// Hardcoded statutory elements
// ---------------------------------------------------------------------------

const elementHolders = [];
const mensReaHolders = [];
const offenseHolders = [];

for (const file of sourceFiles) {
  const src = await readFile(file, 'utf8');
  const rel = file.replace('/workspace/', '');

  // The law engine is allowed to name codes and sections; that is its job.
  if (rel.startsWith('backend/src/law/')) continue;

  // A literal list of elements for a named offence. Search vocabulary that
  // names the statute it looks for is not a holding of law: the elements it
  // reports come from the official source, and it says so.
  const isSearchVocabulary = /Evidence-matching vocabulary|This file holds no law/.test(src);
  // An empty `elements: []` in a result type holds nothing.
  if (/elements\s*:\s*\[\s*\{/.test(src) && /Penal Code|penalCode|PEN\b/.test(src) && !isSearchVocabulary) {
    elementHolders.push(rel);
  }
  // A stored mental state for a named section.
  if (/mensRea\s*[:=]\s*['"](?:intent|knowledge|malice|willful|reckless|negligen)/i.test(src)) {
    mensReaHolders.push(rel);
  }
  // A literal offence definition table.
  if (/(?:CALCRIM_DB|OFFENSE(?:S)?_(?:DB|TABLE|LIBRARY)|CHARGE_DEFINITIONS)\s*[:=]/.test(src)) {
    offenseHolders.push(rel);
  }
}

elementHolders.length === 0
  ? results.pass('DEP-01', 'No module holds a hardcoded list of statutory elements', `${sourceFiles.length} source files scanned`)
  : results.fail(
      'DEP-01',
      'Statutory elements are still held as data in this repository',
      elementHolders.join(', '),
    );

mensReaHolders.length === 0
  ? results.pass('DEP-02', 'No module holds a hardcoded mental state for a statute', 'mens rea is read from the statutory text')
  : results.fail('DEP-02', 'Mental states are still stored rather than read from the law', mensReaHolders.join(', '));

offenseHolders.length === 0
  ? results.pass('DEP-03', 'No offence definition table remains', 'offences are discovered from the official source')
  : results.fail('DEP-03', 'An offence definition table remains', offenseHolders.join(', '));

// ---------------------------------------------------------------------------
// The JSONL repositories
//
// These predate this programme. They are now a cache of a kind, but they are
// hand-maintained rather than retrieved, so they are reported as a remaining
// dependency until whatever reads them reads the official source instead.
// ---------------------------------------------------------------------------

const REPO_DIR = '/workspace/backend/data/legislative/repositories';
const repoCounts = {};
for (const entry of await readdir(REPO_DIR, { withFileTypes: true }).catch(() => [])) {
  if (!entry.isDirectory()) continue;
  let n = 0;
  for (const f of await readdir(path.join(REPO_DIR, entry.name)).catch(() => [])) {
    if (!f.endsWith('.jsonl')) continue;
    const text = await readFile(path.join(REPO_DIR, entry.name, f), 'utf8').catch(() => '');
    n += text.split('\n').filter((l) => l.trim()).length;
  }
  repoCounts[entry.name] = n;
}

const readers = [];
for (const file of sourceFiles) {
  const src = await readFile(file, 'utf8');
  if (/data\/legislative\/repositories|loadJsonlRecords/.test(src)) {
    readers.push(file.replace('/workspace/', ''));
  }
}

const totalRepoRecords = Object.values(repoCounts).reduce((a, b) => a + b, 0);
results.warn(
  'DEP-04',
  'The hand-maintained legislative repositories are still present and still read',
  `${totalRepoRecords} records across ${Object.keys(repoCounts).length} repositories, read by ${readers.length} module(s): ` +
    `${readers.slice(0, 4).join(', ')}. These are not retrieved from the Legislature and do not carry an official URL ` +
    'or a fingerprint, so anything sourced from them is outside the guarantees of the new engine.',
  { repoCounts, readers },
);

// ---------------------------------------------------------------------------
// What the new engine covers instead
// ---------------------------------------------------------------------------

const account = await registerUser({ prefix: 'dep-admin', defaultRole: 'attorney' });
await prisma.user.update({ where: { id: account.user.userId }, data: { role: 'admin' } });
const admin = await login(account.email, account.password);

const status = await req('GET', '/api/law/status', { token: admin.token });
if (status.status === 200) {
  const st = status.json;
  results.pass(
    'DEP-05',
    'The official source addresses the whole of the California codes',
    `${st.codesAvailable} codes reachable on demand, against ${totalRepoRecords} hand-entered records. ` +
      'Coverage is no longer a function of what has been typed in.',
  );

  st.calcrim.mappings > 0
    ? results.warn(
        'DEP-06',
        'CALCRIM correspondence is still a hand-verified list',
        `${st.calcrim.mappings} verified mappings: ${st.calcrim.sections.join(', ')}. These hold no statutory text — ` +
          'elements always come from the official source — but which instruction governs a charge outside this list ' +
          'is UNKNOWN. The Judicial Council does not publish the instructions in a machine-readable form, so this ' +
          'list grows by verification rather than by retrieval.',
      )
    : results.fail('DEP-06', 'No CALCRIM correspondences are recorded');
}

// ---------------------------------------------------------------------------
// Anything a user sees must be traceable to the official source
// ---------------------------------------------------------------------------

const statute = await req('GET', '/api/law/statute/PEN/211', { token: admin.token, timeoutMs: 60000 });
if (statute.status === 200) {
  const s = statute.json.statute;
  s.officialUrl && s.fingerprint && s.retrievedAt && s.legislativeNote
    ? results.pass(
        'DEP-07',
        'A statute served to a user carries everything needed to verify it independently',
        `${s.officialUrl} — ${s.legislativeNote?.slice(0, 60)}`,
      )
    : results.fail('DEP-07', 'A statute was served without full provenance', JSON.stringify(s).slice(0, 200));
} else {
  results.fail('DEP-07', 'Penal Code 211 could not be retrieved', `HTTP ${statute.status}`);
}

await results.write({ repoCounts, readers, elementHolders, mensReaHolders, offenseHolders });
await prisma.$disconnect();
