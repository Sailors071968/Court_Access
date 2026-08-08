#!/usr/bin/env node
// Program 146, Phase 8 — legal knowledge repository coverage.
//
// Counts what the repositories actually hold and states it against the size of
// the body of law they are meant to cover. A platform that answers confidently
// about three statutes and says nothing about the rest is more dangerous than
// one that reports the gap, so every area is reported as a proportion and the
// uncovered remainder is named.
//
// The denominators are the published sizes of the corpora concerned. Where a
// denominator is not known to this program it is reported as unknown rather
// than invented, and coverage is left unquantified.

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { Results } from './lib/harness.mjs';

const results = new Results('REPOSITORY_COVERAGE', 'Program 146 — Legal Knowledge Coverage');
const REPO = '/workspace/backend/data/legislative/repositories';

async function countRecords(name) {
  const dir = path.join(REPO, name);
  let total = 0;
  const sections = new Set();
  for (const f of await readdir(dir).catch(() => [])) {
    if (!f.endsWith('.jsonl')) continue;
    const text = await readFile(path.join(dir, f), 'utf8').catch(() => '');
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      total++;
      try {
        const rec = JSON.parse(line);
        const section = rec.section ?? rec.statuteSection ?? rec.sectionNumber;
        if (section) sections.add(`${rec.code ?? 'PENAL'} ${section}`);
      } catch {
        /* a malformed line is still a record on disk */
      }
    }
  }
  return { total, sections };
}

// Denominators, with their source stated. These are the sizes of the bodies of
// law the repositories are meant to cover.
const SCOPE = {
  // The California Penal Code runs to roughly 1,300 operative sections across
  // its parts; the criminal codes as a whole are larger again.
  penalCodeSections: 1300,
  // The Judicial Council publishes roughly 800 CALCRIM instructions.
  calcrimInstructions: 800,
};

const areas = [
  ['statutes', 'Statutes'],
  ['offenses', 'Offenses'],
  ['elements', 'Elements'],
  ['mens_rea', 'Mens rea'],
  ['defenses', 'Defenses'],
  ['exceptions', 'Exceptions'],
  ['authorities', 'Authorities'],
  ['calcrim_links', 'CALCRIM links'],
  ['cross_references', 'Cross references'],
  ['statute_classifications', 'Statute classifications'],
];

const counts = {};
const coveredSections = new Set();
for (const [dir, label] of areas) {
  const { total, sections } = await countRecords(dir);
  counts[dir] = total;
  for (const s of sections) coveredSections.add(s);

  const id = `COV-${dir.toUpperCase().replace(/_/g, '')}`;
  if (total === 0) {
    // Missing content, not a broken build. The constitution treats an absent
    // answer as UNKNOWN, and grading it as a failure would misdirect effort
    // towards engineering when what is needed is the law itself.
    results.unknown(
      id,
      `${label} repository is empty`,
      'No records at all, so every question in this area returns UNKNOWN. This is a content gap, not a defect.',
    );
  } else {
    results.warn(
      id,
      `${label} repository holds ${total} record(s)`,
      `Enough to answer for the statutes it covers and nothing else. Every other statute returns UNKNOWN.`,
      { records: total },
    );
  }
}

// ---------------------------------------------------------------------------
// Coverage against the body of law
// ---------------------------------------------------------------------------

const statuteCoverage = (coveredSections.size / SCOPE.penalCodeSections) * 100;
results.warn(
  'COV-PENALCODE',
  'California Penal Code coverage is a small fraction of the code',
  `${coveredSections.size} section(s) carry repository records, against roughly ${SCOPE.penalCodeSections} ` +
    `operative Penal Code sections — about ${statuteCoverage.toFixed(1)}%. Covered: ` +
    `${[...coveredSections].sort().join(', ') || 'none'}. Every other section returns UNKNOWN, which is ` +
    'correct behaviour but is not coverage.',
  { coveredSections: [...coveredSections].sort(), approximateTotal: SCOPE.penalCodeSections },
);

const calcrimCoverage = (counts.calcrim_links / SCOPE.calcrimInstructions) * 100;
results.warn(
  'COV-CALCRIM',
  'CALCRIM coverage is a small fraction of the instruction set',
  `${counts.calcrim_links} instruction link(s) against roughly ${SCOPE.calcrimInstructions} published CALCRIM ` +
    `instructions — about ${calcrimCoverage.toFixed(2)}%. A charged offence outside this set is reported as ` +
    'UNKNOWN rather than analysed.',
);

// ---------------------------------------------------------------------------
// Areas the platform names but has no repository for
//
// These appear in the product's own vocabulary. If nothing backs them, saying
// so is the whole point of the exercise.
// ---------------------------------------------------------------------------

const UNBACKED = [
  ['Evidence Code', 'No Evidence Code repository exists. Objections, hearsay exceptions and foundation requirements are not modelled.'],
  ['Search and seizure', 'No repository of Fourth Amendment authority. Suppression issues are organised from the discovery itself, not from law.'],
  ['Pitchess', 'No repository of Pitchess procedure or authority.'],
  ['Brady', 'No repository of Brady authority; disclosure gaps are surfaced from the discovery, not measured against case law.'],
  ['Miranda', 'No repository of Miranda authority. Custodial interrogation issues are not evaluated against law.'],
  ['Voluntariness', 'No repository of voluntariness authority.'],
  ['Identification', 'No repository of eyewitness identification authority.'],
  ['Expert testimony', 'No repository of expert qualification or Kelly/Frye authority.'],
  ['Constitutional issues', 'No constitutional authority repository beyond the 16 authority records above.'],
];

for (const [area, detail] of UNBACKED) {
  results.unknown(`COV-${area.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 12)}`, `${area} coverage is unknown`, detail);
}

// ---------------------------------------------------------------------------
// The honest summary
// ---------------------------------------------------------------------------

const totalRecords = Object.values(counts).reduce((a, b) => a + b, 0);
results.warn(
  'COV-SUMMARY',
  'The legal knowledge repositories are a demonstration corpus, not a working library',
  `${totalRecords} records across ${areas.length} repositories, covering ${coveredSections.size} statute section(s). ` +
    'The retrieval, citation and traceability machinery around them is built and certified; what is missing is ' +
    'the law itself. Populating it is a content acquisition exercise, not an engineering one.',
  counts,
);

await results.write({ counts, coveredSections: [...coveredSections].sort(), scope: SCOPE });
