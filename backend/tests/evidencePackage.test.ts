import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  sealEvidencePackage,
  isPackageSealed,
  loadEvidencePackageManifest,
} from '../src/intelligence/inmates/evidencePackage.js';
import { isForensicModeEnabled, writeForensicArtifacts } from '../src/intelligence/inmates/forensicMode.js';
import { parseManualClassification } from '../src/intelligence/inmates/manualClassification.js';

describe('evidencePackage — immutable seal', () => {
  it('seals a package once and appends certification revisions without rewriting MANIFEST', () => {
    const root = mkdtempSync(join(tmpdir(), 'niis-evpkg-'));
    try {
      const pdfDir = join(root, 'pdfs');
      mkdirSync(pdfDir, { recursive: true });
      const y = join(pdfDir, 'y.pdf');
      const t = join(pdfDir, 't.pdf');
      writeFileSync(y, 'yesterday-pdf-bytes');
      writeFileSync(t, 'today-pdf-bytes');

      const manual = parseManualClassification(`
Roster Date: 2026-08-12
Compared Against: 2026-08-11
### NEW:
SMITH, JOHN
### EXISTING:
### RETURNING:
### REVIEW:
`);

      const first = sealEvidencePackage({
        facility: 'sacramento',
        opsDate: '2026-08-12',
        priorDate: '2026-08-11',
        packagesRoot: root,
        yesterdayPdfPath: y,
        todayPdfPath: t,
        manualClassification: manual,
        niisClassification: { reportableNames: ['SMITH, JOHN'] },
        engineeringCertification: { status: 'pass' },
        disposition: 'PASS',
        certificationId: 'cert-1',
        certificationRevision: 1,
      });

      assert.equal(first.created, true);
      assert.equal(isPackageSealed(first.packageDir), true);
      const manifest1 = readFileSync(join(first.packageDir, 'MANIFEST.json'), 'utf8');

      const second = sealEvidencePackage({
        facility: 'sacramento',
        opsDate: '2026-08-12',
        priorDate: '2026-08-11',
        packagesRoot: root,
        engineeringCertification: { status: 'pass', note: 'corrected' },
        engineeringCertificationMarkdown: '# rev2',
        disposition: 'PASS',
        certificationId: 'cert-2',
        certificationRevision: 2,
        supersedesCertificationId: 'cert-1',
        correctionReason: 'Investigator corrected ambiguous case',
        reviewerName: 'Admin',
      });

      assert.equal(second.created, false);
      // Original MANIFEST unchanged
      assert.equal(readFileSync(join(first.packageDir, 'MANIFEST.json'), 'utf8'), manifest1);
      assert.equal(existsSync(join(first.packageDir, 'MANIFEST.revisions.jsonl')), true);
      assert.equal(existsSync(join(first.packageDir, 'certification', 'revisions', '1')), true);
      assert.equal(existsSync(join(first.packageDir, 'certification', 'revisions', '2')), true);
      // Original PDF evidence preserved
      assert.equal(readFileSync(join(first.packageDir, 'evidence', 'yesterday.pdf'), 'utf8'), 'yesterday-pdf-bytes');

      const current = loadEvidencePackageManifest(first.packageDir);
      assert.equal(current?.certificationRevision, 2);
      assert.equal(current?.supersedesCertificationId, 'cert-1');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('forensicMode', () => {
  it('respects NIIS_FORENSIC_MODE env', () => {
    const prev = process.env.NIIS_FORENSIC_MODE;
    process.env.NIIS_FORENSIC_MODE = '1';
    assert.equal(isForensicModeEnabled(), true);
    process.env.NIIS_FORENSIC_MODE = '0';
    assert.equal(isForensicModeEnabled(), false);
    assert.equal(isForensicModeEnabled(true), true);
    if (prev === undefined) delete process.env.NIIS_FORENSIC_MODE;
    else process.env.NIIS_FORENSIC_MODE = prev;
  });

  it('writes forensic artifacts under forensic/', () => {
    const root = mkdtempSync(join(tmpdir(), 'niis-forensic-'));
    try {
      const { dir, files } = writeForensicArtifacts(root, {
        rawParserCurrent: { records: [{ name: 'SMITH, JOHN' }] },
        reconciliation: { ok: true },
      });
      assert.ok(dir.includes('forensic'));
      assert.ok(files.includes('raw-parser-current.json'));
      assert.ok(existsSync(join(dir, 'MANIFEST.json')));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
