// ============================================
// Court Access — Test Corpus Generator
// Generates a 50k document test corpus for acceptance testing.
// Output: JSONL format (one JSON object per line).
// ============================================

import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DEFAULT_COUNT = 50000;
const OUTPUT_DIR = resolve(import.meta.dirname ?? '.', '../../test-data');

// ---------------------------------------------------------------------------
// Document Templates
// ---------------------------------------------------------------------------

const JURISDICTIONS = [
  'CA', 'NY', 'TX', 'FL', 'IL', 'PA', 'OH', 'GA', 'NC', 'MI',
  'NJ', 'VA', 'WA', 'AZ', 'MA', 'TN', 'IN', 'MO', 'MD', 'WI',
];

const DOCUMENT_TYPES = [
  'policy', 'statute', 'case_law', 'transcript', 'evidence', 'investigative_report',
];

const POLICY_TITLES = [
  'Use of Force Policy', 'Vehicle Pursuit Policy', 'Body Camera Policy',
  'Evidence Handling Procedures', 'Internal Affairs Protocol',
  'Traffic Stop Procedures', 'DUI Enforcement Manual',
  'Officer Training Requirements', 'Radio Communication Standards',
  'Uniform and Equipment Standards',
];

const STATUTE_TITLES = [
  'Penal Code Section', 'Vehicle Code Section', 'Evidence Code Section',
  'Health and Safety Code', 'Business and Professions Code',
  'Government Code Section', 'Civil Code Section',
  'Code of Civil Procedure', 'Family Code Section',
  'Labor Code Section',
];

const CASE_LAW_TITLES = [
  'People v. Smith', 'People v. Johnson', 'People v. Williams',
  'State v. Brown', 'State v. Davis', 'State v. Martinez',
  'In re Application of', 'Matter of Estate of',
  'County of Sacramento v.', 'City of Los Angeles v.',
];

function getTitles(docType: string): string[] {
  switch (docType) {
    case 'policy': return POLICY_TITLES;
    case 'statute': return STATUTE_TITLES;
    case 'case_law': return CASE_LAW_TITLES;
    default: return POLICY_TITLES;
  }
}

// ---------------------------------------------------------------------------
// Content Generator
// ---------------------------------------------------------------------------

function generateContent(docType: string, index: number): string {
  const paragraphs: string[] = [];
  const numParagraphs = 3 + (index % 5);

  for (let i = 0; i < numParagraphs; i++) {
    switch (docType) {
      case 'policy':
        paragraphs.push(
          `Section ${index}.${i + 1}: This policy establishes guidelines and procedures for ` +
          `law enforcement officers regarding standard operating procedures. All officers must ` +
          `comply with these requirements as outlined in the department manual. Violations of ` +
          `this policy may result in disciplinary action up to and including termination. ` +
          `Training on this policy shall be conducted annually.`
        );
        break;
      case 'statute':
        paragraphs.push(
          `(a) Any person who commits the act described in subdivision (b) is guilty of a ` +
          `misdemeanor punishable by imprisonment in a county jail not exceeding six months, ` +
          `or by a fine not exceeding one thousand dollars ($1,000), or by both that fine and ` +
          `imprisonment. (b) The prohibited conduct includes but is not limited to actions ` +
          `specified in Section ${1000 + index}.`
        );
        break;
      case 'case_law':
        paragraphs.push(
          `The court finds that the defendant's Fourth Amendment rights were not violated ` +
          `during the traffic stop. The officer had reasonable suspicion based on the observed ` +
          `traffic violation. The subsequent search was conducted pursuant to a valid warrant. ` +
          `The evidence obtained is admissible under the good faith exception. Case No. ${index}.`
        );
        break;
      case 'transcript':
        paragraphs.push(
          `Q: Officer, can you describe what happened on the night in question? ` +
          `A: Yes, at approximately 2300 hours, I observed the vehicle traveling at an ` +
          `excessive rate of speed on Highway 101. I initiated a traffic stop and the vehicle ` +
          `pulled over to the right shoulder. Upon making contact with the driver, I detected ` +
          `the odor of alcohol. Transcript page ${i + 1} of ${numParagraphs}.`
        );
        break;
      case 'evidence':
        paragraphs.push(
          `Evidence Item #${index}-${i + 1}: Collected at scene on date of incident. ` +
          `Chain of custody maintained from collection through laboratory analysis. ` +
          `Item was sealed in evidence bag with tamper-evident seal number TE-${100000 + index}. ` +
          `Stored in evidence locker at department headquarters.`
        );
        break;
      case 'investigative_report':
        paragraphs.push(
          `Investigation Report IR-${index}: On the above date, this investigator was assigned ` +
          `to conduct a follow-up investigation regarding the incident report filed on the ` +
          `previous date. Contact was made with all witnesses identified in the initial report. ` +
          `Statements were obtained and are attached as exhibits A through ${String.fromCharCode(65 + (i % 10))}.`
        );
        break;
    }
  }

  return paragraphs.join('\n\n');
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

async function generateCorpus(count: number, outputPath: string): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true });

  const writeStream = createWriteStream(outputPath, { encoding: 'utf-8' });
  let written = 0;

  process.stdout.write(`Generating ${count} test documents...\n`);

  for (let i = 0; i < count; i++) {
    const docType = DOCUMENT_TYPES[i % DOCUMENT_TYPES.length];
    const jurisdiction = JURISDICTIONS[i % JURISDICTIONS.length];
    const titles = getTitles(docType);
    const title = `${titles[i % titles.length]} ${Math.floor(i / titles.length) + 1}`;
    const content = generateContent(docType, i);

    const doc = {
      title,
      content,
      jurisdiction,
      type: docType,
      source: `test-corpus-generator`,
      version: '1.0',
    };

    const line = JSON.stringify(doc) + '\n';
    const canContinue = writeStream.write(line);

    if (!canContinue) {
      await new Promise<void>((resolve) => writeStream.once('drain', resolve));
    }

    written++;
    if (written % 10000 === 0) {
      process.stdout.write(`  ${written}/${count} documents generated\n`);
    }
  }

  writeStream.end();
  await new Promise<void>((resolve) => writeStream.once('finish', resolve));

  process.stdout.write(`\nGenerated ${count} documents to ${outputPath}\n`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const count = parseInt(process.argv[2] ?? String(DEFAULT_COUNT), 10);
const outputPath = process.argv[3] ?? resolve(OUTPUT_DIR, 'test-corpus-50k.jsonl');

generateCorpus(count, outputPath).catch((err) => {
  process.stderr.write(`Error: ${err}\n`);
  process.exit(1);
});
