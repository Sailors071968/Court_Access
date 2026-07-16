// ============================================================================
// Program 135 — AI orchestration tests (deterministic, offline)
// Verifies provider status/routing/failover, caching, usage accounting, prompt
// optimization, and citation metadata extraction — with no network calls.
// ============================================================================

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  getProviderStatus, getRoutingOrder, estimateCost,
} from '../src/ai/providerRegistry.js';
import { chat, setCaller, estimateTokens, type ProviderCaller } from '../src/ai/providerOrchestrator.js';
import { responseCache, semanticCache, hashKey, AiCache } from '../src/ai/aiCache.js';
import { usageAccounting } from '../src/ai/usageAccounting.js';
import { buildOptimizedContext } from '../src/ai/promptBuilder.js';
import { extractCitationLocators } from '../src/ai/citationMetadata.js';

describe('providerRegistry — status is credential-derived, never fabricated', () => {
  it('reports not_configured when env var absent', () => {
    assert.equal(getProviderStatus('openai', {}), 'not_configured');
    assert.equal(getProviderStatus('anthropic', {}), 'not_configured');
  });
  it('reports configured when env var present and non-empty', () => {
    assert.equal(getProviderStatus('openai', { OPENAI_API_KEY: 'sk-x' }), 'configured');
    assert.equal(getProviderStatus('openai', { OPENAI_API_KEY: '   ' }), 'not_configured');
  });
  it('routing order puts configured providers first, then by preference', () => {
    const order = getRoutingOrder('chat', { ANTHROPIC_API_KEY: 'x' }).map((p) => p.id);
    assert.equal(order[0], 'anthropic'); // only configured one first
    assert.ok(order.includes('openai') && order.includes('gemini') && order.includes('local'));
  });
  it('embedding routing excludes chat-only providers', () => {
    const order = getRoutingOrder('embedding', {}).map((p) => p.id);
    assert.ok(!order.includes('anthropic'));
    assert.ok(order.includes('openai') && order.includes('gemini'));
  });
  it('estimateCost uses per-MTok pricing', () => {
    // gpt-4o-mini: 0.15 in / 0.6 out per 1M
    const c = estimateCost('openai', 'gpt-4o-mini', 1_000_000, 1_000_000);
    assert.equal(c, +(0.15 + 0.6).toFixed(6));
  });
});

describe('AiCache — LRU + TTL + hit accounting', () => {
  it('hits and misses tracked; hitRate computed', () => {
    const c = new AiCache<string>(2, 1000);
    assert.equal(c.get('a'), undefined); // miss
    c.set('a', '1');
    assert.equal(c.get('a'), '1'); // hit
    const s = c.stats();
    assert.equal(s.hits, 1);
    assert.equal(s.misses, 1);
    assert.equal(s.hitRate, 0.5);
  });
  it('evicts oldest beyond capacity', () => {
    const c = new AiCache<string>(2, 1000);
    c.set('a', '1'); c.set('b', '2'); c.set('c', '3');
    assert.equal(c.has('a'), false);
    assert.equal(c.has('c'), true);
  });
  it('hashKey is stable and normalized', () => {
    assert.equal(hashKey('Hello  World'), hashKey('hello world'));
  });
});

describe('orchestrator — routing, failover, caching, accounting', () => {
  beforeEach(() => {
    responseCache.clear();
    semanticCache.clear();
    usageAccounting.reset();
    setCaller('openai', undefined);
    setCaller('anthropic', undefined);
  });

  it('returns not_configured when no providers configured', async () => {
    const res = await chat({ messages: [{ role: 'user', content: 'hi' }] }, { env: {} });
    assert.equal(res.status, 'not_configured');
    assert.ok(res.routedThrough.every((a) => a.outcome === 'not_configured'));
  });

  it('routes to the configured provider and records usage', async () => {
    const caller: ProviderCaller = async () => ({ text: 'answer', promptTokens: 10, completionTokens: 5 });
    setCaller('openai', caller);
    const res = await chat({ messages: [{ role: 'user', content: 'q1' }] }, { env: { OPENAI_API_KEY: 'sk-x' } });
    assert.equal(res.status, 'ok');
    if (res.status === 'ok') {
      assert.equal(res.provider, 'openai');
      assert.equal(res.cached, false);
    }
    const snap = usageAccounting.snapshot();
    assert.equal(snap.totals.totalTokens, 15);
    assert.ok(snap.totals.costUsd > 0);
  });

  it('fails over to the next configured provider on error', async () => {
    setCaller('openai', async () => { throw new Error('rate limit'); });
    setCaller('anthropic', async () => ({ text: 'ok2', promptTokens: 3, completionTokens: 2 }));
    const res = await chat({ messages: [{ role: 'user', content: 'q2' }] }, { env: { OPENAI_API_KEY: 'x', ANTHROPIC_API_KEY: 'y' } });
    assert.equal(res.status, 'ok');
    if (res.status === 'ok') assert.equal(res.provider, 'anthropic');
    const attempts = res.routedThrough.map((a) => `${a.provider}:${a.outcome}`);
    assert.ok(attempts.includes('openai:error'));
    assert.ok(attempts.includes('anthropic:ok'));
  });

  it('serves identical requests from cache (no second upstream call)', async () => {
    let calls = 0;
    setCaller('openai', async () => { calls += 1; return { text: 'cached-answer', promptTokens: 8, completionTokens: 4 }; });
    const env = { OPENAI_API_KEY: 'x' };
    const req = { messages: [{ role: 'user' as const, content: 'same question' }] };
    const a = await chat(req, { env });
    const b = await chat(req, { env });
    assert.equal(calls, 1);
    assert.equal(a.status, 'ok');
    assert.equal(b.status, 'ok');
    if (b.status === 'ok') assert.equal(b.cached, true);
    assert.ok(usageAccounting.snapshot().cacheHitRate > 0);
  });
});

describe('promptBuilder — only unresolved questions require AI', () => {
  it('excludes resolved questions and includes provided context sections', () => {
    const out = buildOptimizedContext({
      repositoryIntelligence: ['PEN 459 elements'],
      calcrim: ['CALCRIM 1700'],
      questions: [
        { id: 'q1', question: 'Is element X supported?', resolved: true, answer: 'yes' },
        { id: 'q2', question: 'Is intent established?', resolved: false },
      ],
    });
    assert.equal(out.unresolvedQuestions.length, 1);
    assert.equal(out.unresolvedQuestions[0].id, 'q2');
    assert.ok(out.includedSections.includes('Repository Intelligence'));
    assert.ok(out.includedSections.includes('CALCRIM'));
    assert.ok(out.estimatedPromptTokens > 0);
    assert.equal(out.fullyResolved, false);
  });
  it('fullyResolved when nothing is unresolved', () => {
    const out = buildOptimizedContext({ questions: [{ id: 'q', question: 'x', resolved: true }] });
    assert.equal(out.fullyResolved, true);
    assert.equal(out.unresolvedQuestions.length, 0);
  });
  it('estimateTokens approximates 4 chars/token', () => {
    assert.equal(estimateTokens('abcd'), 1);
    assert.equal(estimateTokens('abcdefgh'), 2);
  });
});

describe('citationMetadata — deterministic locators, UNKNOWN never fabricated', () => {
  it('extracts page/paragraph from police reports', () => {
    const r = extractCitationLocators('police_report', 'Page 1\n\nOfficer arrived. Suspect fled.\n\nPage 2\n\nWitness stated X.');
    assert.ok(r.locators.some((l) => l.kind === 'page_paragraph' && l.page === 2));
    assert.ok(r.navigable > 0);
  });
  it('extracts page/line from transcripts', () => {
    const r = extractCitationLocators('preliminary_hearing_transcript', 'Page 12 Line 4: Q. Where were you?');
    const loc = r.locators.find((l) => l.kind === 'page_line');
    assert.ok(loc);
    assert.equal(loc?.page, 12);
    assert.equal(loc?.line, 4);
    assert.equal(loc?.anchor, 'p12#l4');
  });
  it('extracts timestamps from bodycam', () => {
    const r = extractCitationLocators('bodycam', 'At 00:04:21 the officer says stop. Later 01:12:09 he leaves.');
    const ts = r.locators.filter((l) => l.kind === 'timestamp' && l.provenance === 'repository');
    assert.equal(ts.length, 2);
    assert.equal(ts[0].anchor, 't=00:04:21');
  });
  it('reports UNKNOWN bounding region for photos without hints', () => {
    const r = extractCitationLocators('photograph', 'a photo');
    assert.ok(r.locators.some((l) => l.kind === 'bounding_region' && l.provenance === 'unknown'));
  });
  it('uses provided bounding regions when present', () => {
    const r = extractCitationLocators('photograph', 'a photo', { regions: [{ x: 1, y: 2, w: 3, h: 4, label: 'weapon' }] });
    const bb = r.locators.find((l) => l.kind === 'bounding_region');
    assert.equal(bb?.provenance, 'repository');
    assert.equal(bb?.anchor, 'bbox=1,2,3,4');
  });
});
