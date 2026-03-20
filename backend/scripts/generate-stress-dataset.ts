// ============================================================================
// Scale Validation — Synthetic Stress Dataset Generator
//
// Generates synthetic large-scale evidence datasets for stress testing.
// Simulates real criminal discovery: scanned PDFs, body cam transcripts,
// interview transcripts, email chains, forensic reports.
//
// Usage:
//   npx tsx backend/scripts/generate-stress-dataset.ts --level 1
//   npx tsx backend/scripts/generate-stress-dataset.ts --level 2
//   npx tsx backend/scripts/generate-stress-dataset.ts --level 3
//
// Levels:
//   1 — Single 50-100 GB case (1000+ page PDFs, videos, mixed)
//   2 — 3-5 concurrent cases totaling 200-300 GB
//   3 — 500+ GB soak test (continuous uploads over 48-72 hours)
// ============================================================================

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EvidenceItem {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sizeMB: number;
  category: 'pdf' | 'video' | 'audio' | 'email' | 'image' | 'transcript';
  description: string;
  pageCount?: number;
  durationMinutes?: number;
  textContent: string; // Simulated text extraction
}

interface SyntheticCase {
  caseId: string;
  caseName: string;
  tenantId: string;
  evidence: EvidenceItem[];
  totalSizeMB: number;
  totalSizeGB: number;
  evidenceCount: number;
}

interface DatasetManifest {
  level: number;
  cases: SyntheticCase[];
  totalSizeGB: number;
  totalEvidenceCount: number;
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Text Generation — Realistic legal document content
// ---------------------------------------------------------------------------

const LEGAL_SENTENCES = [
  'The officer approached the vehicle from the driver side and made contact with the occupant.',
  'Witness stated they observed the suspect exit the building at approximately 2300 hours.',
  'Body camera footage shows the officer drawing their service weapon at timestamp 00:04:23.',
  'The evidence was collected from the scene and placed into evidence locker #4521.',
  'Toxicology report indicates blood alcohol content of 0.12 at time of arrest.',
  'The defendant was read Miranda rights at 22:47 and acknowledged understanding.',
  'Forensic analysis of the firearm revealed three latent fingerprints on the grip.',
  'GPS data from the patrol vehicle confirms the officer arrived on scene at 21:15.',
  'The surveillance camera at 1425 Main Street captured footage from 20:00 to 23:59.',
  'Chain of custody documentation shows the evidence was transferred three times.',
  'Internal affairs investigation report number IA-2025-0847 details the use of force incident.',
  'The complainant alleges excessive force was used during the traffic stop on Highway 101.',
  'Dispatch records indicate the call was received at 20:32 and units were dispatched at 20:34.',
  'Medical records from County General Hospital document injuries consistent with blunt force trauma.',
  'The officer reported that the suspect made furtive movements toward the center console.',
  'Dashboard camera from unit 47 recorded continuously from the beginning of the shift.',
  'Witness interview conducted at the station on March 15 at 14:00 hours.',
  'The search warrant was executed at 0600 hours by a team of six officers.',
  'Ballistic analysis confirms the projectile was fired from the service weapon serial number SIG-4829.',
  'The policy manual section 4.7.2 requires officers to activate body cameras during all contacts.',
];

function generateLegalText(charCount: number): string {
  let text = '';
  while (text.length < charCount) {
    const sentence = LEGAL_SENTENCES[Math.floor(Math.random() * LEGAL_SENTENCES.length)];
    text += sentence + ' ';
  }
  return text.slice(0, charCount);
}

function generateId(): string {
  return crypto.randomUUID();
}

// ---------------------------------------------------------------------------
// Evidence Generators
// ---------------------------------------------------------------------------

function generatePDF(pages: number): EvidenceItem {
  const charsPerPage = 3000;
  const sizeBytes = pages * charsPerPage;
  return {
    id: generateId(),
    fileName: `discovery_dump_${pages}pages_${Date.now()}.pdf`,
    mimeType: 'application/pdf',
    sizeBytes,
    sizeMB: Math.round(sizeBytes / 1024 / 1024 * 100) / 100,
    category: 'pdf',
    description: `Scanned discovery PDF — ${pages} pages`,
    pageCount: pages,
    textContent: generateLegalText(sizeBytes),
  };
}

function generateVideo(durationMinutes: number): EvidenceItem {
  // ~50MB per minute for body cam footage
  const sizeBytes = durationMinutes * 50 * 1024 * 1024;
  return {
    id: generateId(),
    fileName: `bodycam_${durationMinutes}min_${Date.now()}.mp4`,
    mimeType: 'video/mp4',
    sizeBytes,
    sizeMB: Math.round(sizeBytes / 1024 / 1024),
    category: 'video',
    description: `Body camera footage — ${durationMinutes} minutes`,
    durationMinutes,
    textContent: generateLegalText(durationMinutes * 500), // Simulated transcript
  };
}

function generateAudio(durationMinutes: number): EvidenceItem {
  // ~10MB per minute for interview audio
  const sizeBytes = durationMinutes * 10 * 1024 * 1024;
  return {
    id: generateId(),
    fileName: `interview_${durationMinutes}min_${Date.now()}.wav`,
    mimeType: 'audio/wav',
    sizeBytes,
    sizeMB: Math.round(sizeBytes / 1024 / 1024),
    category: 'audio',
    description: `Interview recording — ${durationMinutes} minutes`,
    durationMinutes,
    textContent: generateLegalText(durationMinutes * 800),
  };
}

function generateEmail(): EvidenceItem {
  const sizeBytes = Math.floor(Math.random() * 50000) + 5000;
  return {
    id: generateId(),
    fileName: `email_chain_${Date.now()}.eml`,
    mimeType: 'message/rfc822',
    sizeBytes,
    sizeMB: Math.round(sizeBytes / 1024 / 1024 * 100) / 100,
    category: 'email',
    description: 'Email chain — internal communications',
    textContent: generateLegalText(sizeBytes),
  };
}

function generateImage(): EvidenceItem {
  const sizeBytes = Math.floor(Math.random() * 10 * 1024 * 1024) + 1024 * 1024;
  return {
    id: generateId(),
    fileName: `scene_photo_${Date.now()}.jpg`,
    mimeType: 'image/jpeg',
    sizeBytes,
    sizeMB: Math.round(sizeBytes / 1024 / 1024 * 100) / 100,
    category: 'image',
    description: 'Scene photograph',
    textContent: '', // Images don't have text content
  };
}

// ---------------------------------------------------------------------------
// Case Generators
// ---------------------------------------------------------------------------

function generateCase(
  name: string,
  tenantId: string,
  targetSizeGB: number,
): SyntheticCase {
  const evidence: EvidenceItem[] = [];
  let totalBytes = 0;
  const targetBytes = targetSizeGB * 1024 * 1024 * 1024;

  // Mix of evidence types (realistic proportions for criminal discovery)
  // 60% video/audio, 30% PDFs, 10% emails/images
  while (totalBytes < targetBytes) {
    const roll = Math.random();

    if (roll < 0.3) {
      // Large PDF (100-500 pages)
      const pages = Math.floor(Math.random() * 400) + 100;
      const item = generatePDF(pages);
      evidence.push(item);
      totalBytes += item.sizeBytes;
    } else if (roll < 0.6) {
      // Body cam video (30-120 minutes)
      const minutes = Math.floor(Math.random() * 90) + 30;
      const item = generateVideo(minutes);
      evidence.push(item);
      totalBytes += item.sizeBytes;
    } else if (roll < 0.8) {
      // Interview audio (15-60 minutes)
      const minutes = Math.floor(Math.random() * 45) + 15;
      const item = generateAudio(minutes);
      evidence.push(item);
      totalBytes += item.sizeBytes;
    } else if (roll < 0.95) {
      // Email chain
      const item = generateEmail();
      evidence.push(item);
      totalBytes += item.sizeBytes;
    } else {
      // Scene photo
      const item = generateImage();
      evidence.push(item);
      totalBytes += item.sizeBytes;
    }
  }

  const totalSizeMB = Math.round(totalBytes / 1024 / 1024);
  return {
    caseId: generateId(),
    caseName: name,
    tenantId,
    evidence,
    totalSizeMB,
    totalSizeGB: Math.round(totalSizeMB / 1024 * 100) / 100,
    evidenceCount: evidence.length,
  };
}

// ---------------------------------------------------------------------------
// Level Generators
// ---------------------------------------------------------------------------

function generateLevel1(): DatasetManifest {
  console.log('[StressDataset] Generating Level 1: Single 50-100 GB case...');
  const targetGB = 50 + Math.random() * 50;
  const case1 = generateCase('Homicide Case #2025-H-0847', 'tenant-stress-1', targetGB);
  return {
    level: 1,
    cases: [case1],
    totalSizeGB: case1.totalSizeGB,
    totalEvidenceCount: case1.evidenceCount,
    generatedAt: new Date().toISOString(),
  };
}

function generateLevel2(): DatasetManifest {
  console.log('[StressDataset] Generating Level 2: 3-5 concurrent cases (200-300 GB)...');
  const caseCount = 3 + Math.floor(Math.random() * 3);
  const cases: SyntheticCase[] = [];
  const perCaseGB = (200 + Math.random() * 100) / caseCount;

  for (let i = 0; i < caseCount; i++) {
    const tenantId = `tenant-stress-${i + 1}`;
    const caseName = [
      'DUI Felony #2025-DUI-1234',
      'Assault Case #2025-A-5678',
      'Homicide Case #2025-H-9012',
      'Officer-Involved Shooting #2025-OIS-3456',
      'Civil Rights Complaint #2025-CR-7890',
    ][i % 5];
    cases.push(generateCase(caseName, tenantId, perCaseGB));
  }

  const totalSizeGB = cases.reduce((sum, c) => sum + c.totalSizeGB, 0);
  const totalEvidenceCount = cases.reduce((sum, c) => sum + c.evidenceCount, 0);

  return {
    level: 2,
    cases,
    totalSizeGB: Math.round(totalSizeGB * 100) / 100,
    totalEvidenceCount,
    generatedAt: new Date().toISOString(),
  };
}

function generateLevel3(): DatasetManifest {
  console.log('[StressDataset] Generating Level 3: 500+ GB soak test...');
  const caseCount = 8 + Math.floor(Math.random() * 5);
  const cases: SyntheticCase[] = [];
  const perCaseGB = (500 + Math.random() * 200) / caseCount;

  for (let i = 0; i < caseCount; i++) {
    const tenantId = `tenant-stress-${i + 1}`;
    const caseName = `Stress Case #${2025}-${i + 1}`;
    cases.push(generateCase(caseName, tenantId, perCaseGB));
  }

  const totalSizeGB = cases.reduce((sum, c) => sum + c.totalSizeGB, 0);
  const totalEvidenceCount = cases.reduce((sum, c) => sum + c.evidenceCount, 0);

  return {
    level: 3,
    cases,
    totalSizeGB: Math.round(totalSizeGB * 100) / 100,
    totalEvidenceCount,
    generatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Main — Generate manifest (metadata only, no actual large files)
// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);
  const levelIdx = args.indexOf('--level');
  const level = levelIdx >= 0 ? parseInt(args[levelIdx + 1], 10) : 1;

  if (![1, 2, 3].includes(level)) {
    console.error('Usage: npx tsx backend/scripts/generate-stress-dataset.ts --level [1|2|3]');
    process.exit(1);
  }

  let manifest: DatasetManifest;
  switch (level) {
    case 1: manifest = generateLevel1(); break;
    case 2: manifest = generateLevel2(); break;
    case 3: manifest = generateLevel3(); break;
    default: manifest = generateLevel1();
  }

  // Write manifest (metadata only — actual file content is generated on-demand during upload)
  const outDir = path.resolve(process.cwd(), 'stress-data');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const manifestPath = path.join(outDir, `manifest-level${level}.json`);
  // Write manifest without textContent to keep file size manageable
  const slimManifest = {
    ...manifest,
    cases: manifest.cases.map(c => ({
      ...c,
      evidence: c.evidence.map(e => ({
        ...e,
        textContent: `[${e.textContent.length} chars — generated on demand]`,
      })),
    })),
  };

  fs.writeFileSync(manifestPath, JSON.stringify(slimManifest, null, 2));

  console.log('\n========================================');
  console.log(`Level ${level} Dataset Manifest Generated`);
  console.log('========================================');
  console.log(`Cases: ${manifest.cases.length}`);
  console.log(`Total evidence items: ${manifest.totalEvidenceCount}`);
  console.log(`Total size: ${manifest.totalSizeGB} GB`);
  console.log(`Manifest: ${manifestPath}`);
  console.log('');
  for (const c of manifest.cases) {
    console.log(`  Case: ${c.caseName}`);
    console.log(`    Tenant: ${c.tenantId}`);
    console.log(`    Evidence: ${c.evidenceCount} items (${c.totalSizeGB} GB)`);
    const byCategory = c.evidence.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log(`    Breakdown: ${Object.entries(byCategory).map(([k, v]) => `${k}=${v}`).join(', ')}`);
  }
}

main();
