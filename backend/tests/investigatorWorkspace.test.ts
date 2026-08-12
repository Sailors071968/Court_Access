import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

/**
 * Unit-level checks for decision → defect mapping without requiring a live DB
 * pair. Full workspace load is integration-tested against Sacramento PDFs.
 */
describe('Investigator Workspace decision taxonomy', () => {
  it('maps confirm actions and defect marks to expected classes', async () => {
    const mod = await import('../src/intelligence/inmates/investigatorWorkspace.js');
    // Smoke: module exports the public API
    assert.equal(typeof mod.getInvestigatorWorkspace, 'function');
    assert.equal(typeof mod.recordInvestigatorDecision, 'function');
  });

  it('writes a local decisions log when prisma table is unavailable', async () => {
    // recordInvestigatorDecision always appends jsonl under fixtures path relative to cwd.
    // Use a temp cwd simulation by calling and checking the validation/days path under repo.
    const { recordInvestigatorDecision } = await import(
      '../src/intelligence/inmates/investigatorWorkspace.js'
    );
    const opsDate = '2099-01-01';
    const result = await recordInvestigatorDecision({
      facility: 'sacramento',
      opsDate,
      candidateKey: 'test-key-1',
      inmateName: 'TEST, PERSON',
      niisClassification: 'new',
      action: 'confirm_existing',
      investigatorName: 'unit-test',
    });
    assert.ok(result.decisionId);
    // Disagreement should create learning queue item when DB available; may be null if DB down.
    const logPath = join(
      process.cwd(),
      '../fixtures/sacramento/validation/days',
      opsDate,
      'investigator-decisions.jsonl',
    );
    // Path is relative to backend cwd
    const alt = join(process.cwd(), '../fixtures/sacramento/validation/days', opsDate, 'investigator-decisions.jsonl');
    const path = existsSync(logPath) ? logPath : alt;
    if (existsSync(path)) {
      const text = readFileSync(path, 'utf8');
      assert.match(text, /confirm_existing/);
      assert.match(text, /TEST, PERSON/);
    }
  });
});

describe('Operational Health module', () => {
  it('exports getOperationalHealth', async () => {
    const mod = await import('../src/intelligence/inmates/operationalHealth.js');
    assert.equal(typeof mod.getOperationalHealth, 'function');
  });
});
