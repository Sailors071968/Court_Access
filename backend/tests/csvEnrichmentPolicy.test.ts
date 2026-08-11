import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { applyCsvEnrichmentPolicy } from '../src/intelligence/inmates/csvEnrichmentPolicy.js';

describe('CSV enrichment policy (PDF primary)', () => {
  it('does not alter PDF outcomes', () => {
    const d = applyCsvEnrichmentPolicy({
      sourceType: 'pdf_text',
      identityOutcome: 'new_inmate',
      pdfPrimaryAlreadyPresent: true,
    });
    assert.equal(d.outcome, 'new_inmate');
    assert.equal(d.forcedException, false);
  });

  it('demotes CSV new_inmate to needs_review when PDF primary exists', () => {
    const d = applyCsvEnrichmentPolicy({
      sourceType: 'csv',
      identityOutcome: 'new_inmate',
      pdfPrimaryAlreadyPresent: true,
    });
    assert.equal(d.outcome, 'needs_review');
    assert.equal(d.forcedException, true);
    assert.match(d.reason, /must not determine newness/i);
  });

  it('allows CSV matched enrichment when PDF primary exists', () => {
    const d = applyCsvEnrichmentPolicy({
      sourceType: 'csv',
      identityOutcome: 'matched',
      pdfPrimaryAlreadyPresent: true,
    });
    assert.equal(d.outcome, 'matched');
    assert.equal(d.forcedException, false);
  });

  it('does not demote CSV new_inmate when no PDF primary for the day', () => {
    const d = applyCsvEnrichmentPolicy({
      sourceType: 'csv',
      identityOutcome: 'new_inmate',
      pdfPrimaryAlreadyPresent: false,
    });
    assert.equal(d.outcome, 'new_inmate');
    assert.equal(d.forcedException, false);
  });
});
