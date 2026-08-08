# OpenAI production integration — Program 176

Design only. Nothing implemented. No application behaviour changes in what is
proposed — the same functions produce the same results, with the failure and
cost characteristics made survivable.

## What exists today

Two call sites, and they are not much alike.

### `cpra/services/cpraClassificationEngine.ts:66-79`

```ts
const response = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
  body: JSON.stringify({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1,
    max_tokens: 500,
    response_format: { type: 'json_object' },
  }),
});
```

A bare `fetch`. No SDK, no shared client.

### `doctrine/doctrineEmbeddingPipeline.ts:69`

```ts
apiKey: config?.apiKey || process.env.OPENAI_API_KEY || '',
```

Reads the key at construction. Note the `|| ''` — an absent key yields an empty
string rather than an error, so the failure surfaces later as a 401 from the API.

## Evaluation

| Aspect | Present | Detail |
|---|---|---|
| Connection pooling | **Implicitly** | `fetch` uses undici's global agent, which pools. Not configured, but not absent. |
| Timeouts | **No** | No `AbortSignal`. This is the significant gap. |
| Retry logic | **No** | Any non-2xx throws at `:81-83`. |
| Rate-limit handling | **No** | A 429 is treated like any other error. `Retry-After` is ignored. |
| Streaming | **No** | Not needed — responses are ≤ 500 tokens of JSON. |
| Model selection | **Hardcoded** | `gpt-4o-mini` at `:73`. |
| Cost monitoring | **No** | Nothing records spend. |
| Token accounting | **No** | The `usage` object in the response is discarded at `:85-88`. |
| Logging | **No** | Not the request, the latency, the outcome, or the failure. |
| Fallback | **Yes, at one site** | `:212` falls back to `classifyWithHeuristics` when the key is absent. |
| API failure handling | **Partial** | Errors propagate; the caller decides. |
| Response validation | **No** | `JSON.parse(content)` at `:89` is unguarded. |

### The timeout gap in context

Every other outbound call in this codebase has a timeout:

| Call | Timeout | Location |
|---|---|---|
| leginfo | 30 s via `AbortSignal.timeout` | `law/officialLawSource.ts:255` |
| ffprobe version | 5 s | `certification/mediaProbe.ts:33` |
| ffprobe measure | 120 s | `mediaProbe.ts:61` |
| ffmpeg volumedetect | 300 s | `mediaProbe.ts:214` |
| Timeline pipeline | 5 min | `timelineReconstructionService.ts:216` |
| Text extraction | 60 s | `evidenceTextExtractionService.ts:102-111` |
| Contradiction workers | 60–180 s | `contradiction/workerQueues.ts:31-58` |

**OpenAI is the only one without.** Node's default `fetch` has no timeout, so a
connection that stalls after the TCP handshake holds the request — and its
database connection — until the peer closes it or the process restarts. Under a
provider incident this exhausts the connection pool.

### The fallback is better than it looks, and narrower than it looks

`:210-216` chooses heuristics when the key is absent:

```ts
if (process.env.OPENAI_API_KEY) {
  result = await classifyWithOpenAI(...);
} else {
  result = classifyWithHeuristics(...);
}
```

The condition is **key absent**, not **call failed**. If the key is set and
OpenAI returns 500, or times out, or rate-limits, the error propagates and the
job fails — even though a working heuristic path is sitting right there. The
fallback exists; it just is not wired to the failure it should catch.

---

## Design

### A single client module

`backend/src/lib/openai.ts`. Both call sites go through it. Nothing else calls
`api.openai.com` directly.

```ts
interface OpenAIResult<T> {
  ok: boolean;
  data?: T;
  error?: 'not_configured' | 'timeout' | 'rate_limited' | 'server_error'
        | 'invalid_response' | 'client_error';
  attempts: number;
  latencyMs: number;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
}
```

Returning a discriminated result rather than throwing is the key decision. It
makes "fall back to heuristics on failure" a two-line change at the call site
instead of a try/catch that has to distinguish retryable from permanent errors.

### 1 · Timeouts

`AbortSignal.timeout(OPENAI_TIMEOUT_MS ?? 30000)`, matching the leginfo
convention already in the codebase. Per-attempt, not per-call, so three retries
cannot exceed roughly 90 seconds plus backoff.

A second, outer budget — `OPENAI_TOTAL_BUDGET_MS`, default 120 s — bounds the
whole operation including retries, so a caller can reason about worst case.

### 2 · Retry logic

Retry only what is worth retrying:

| Response | Retry | Why |
|---|---|---|
| 429 | **Yes** — honour `Retry-After`, else exponential backoff | Transient by definition |
| 500, 502, 503, 504 | **Yes** — up to 3 attempts | Provider-side |
| Timeout / network | **Yes** — up to 3 attempts | Transient |
| 400 | **No** | The prompt is wrong; retrying sends the same prompt |
| 401, 403 | **No** | The key is wrong; retrying will not fix it and may trip abuse detection |
| 404 | **No** | Wrong model name |

Backoff: 1 s, 2 s, 4 s, with full jitter. Fixed backoff synchronises retries
across concurrent jobs and produces a thundering herd against a provider already
in trouble.

Honour `Retry-After` when present. It is the provider telling you the answer.

### 3 · Rate limits

OpenAI returns `x-ratelimit-remaining-requests` and
`x-ratelimit-remaining-tokens` on every response. Read and record them. When
remaining requests fall below a threshold, log a warning — that is the signal
that arrives *before* the 429s, and it is free.

A local concurrency cap of 4 in-flight requests, since the only concurrent
caller is queue-driven and Redis is absent today.

### 4 · Token accounting and cost

The `usage` object is already in every response and is currently discarded at
`:85-88`. Capture it:

```ts
usage: {
  promptTokens: data.usage.prompt_tokens,
  completionTokens: data.usage.completion_tokens,
  totalTokens: data.usage.total_tokens,
}
```

Persist per call: timestamp, model, operation, token counts, latency, outcome,
and tenant. Tenant matters — without it, cost cannot be attributed to a customer,
and this platform bills customers.

Cost is derived from tokens and a price table, kept in configuration rather than
code so a price change is not a deployment. Do not compute cost from a hardcoded
rate; it will be wrong within months and wrong silently.

A daily and monthly spend cap, with the cap enforced *before* the call rather
than reported after it. Above the cap, return `ok: false` and let the caller
fall back to heuristics.

### 5 · Model selection

Move `gpt-4o-mini` to `OPENAI_MODEL_CLASSIFICATION`, defaulting to the current
value so behaviour is unchanged. Record the model used on every call, because
comparing results across a model change is impossible without it — and this
platform's certification history is explicitly meant to support regression
comparison.

### 6 · Streaming

**Not recommended.** Responses are capped at 500 tokens of JSON with
`response_format: { type: 'json_object' }`. Streaming adds complexity and
partial-parse failure modes for no user-visible benefit, since nothing displays
these results token by token.

### 7 · Fallback

Change the condition from "key absent" to "call did not succeed":

```ts
const result = await openai.classify(...);
result.ok
  ? applyClassification(result.data)
  : classifyWithHeuristics(fileName, textContent);
```

**And record which path produced the result.** A heuristic classification and a
model classification are not equivalent evidence, and under this platform's own
constitution — no citation, no finding — a downstream consumer needs to know
which one it is looking at. Silently substituting heuristics for a model result
would be exactly the kind of fabrication the constitution prohibits.

### 8 · Logging

One structured line per call: operation, model, attempts, latency, token counts,
outcome, tenant. **Never the prompt.** Prompts contain document content, which
here is privileged criminal discovery.

### 9 · Response validation

`JSON.parse(content)` at `:89` is unguarded, and `response_format:
json_object` makes valid JSON likely rather than certain. Wrap it, return
`invalid_response` on failure, and treat that as non-retryable — the same prompt
will produce the same malformed shape.

The parsed object is then cast to a shape with every field optional (`:89-95`)
and defaulted (`:97-99`), which is defensive and correct. Keep that.

One field deserves stricter treatment: `policyTopic` is prompted to be one of
the supplied canonical topics, but nothing verifies that it is. A model that
invents a topic gets it stored as though it were canonical. Validate against
`canonicalTopics` and return `invalid_response` when it is not a member.

---

## Roadmap

Ordered so each step is useful alone and nothing depends on a later step.

**Step 1 — Add a timeout to the existing call.** One line, one file. Removes the
unbounded-hang failure mode immediately. Does not require the client module.

**Step 2 — Create `lib/openai.ts`** with the result type, timeout, retry with
jitter, `Retry-After` handling, and response validation. Move both call sites
onto it. Behaviour is unchanged on the success path.

**Step 3 — Wire the fallback to failure rather than to configuration**, and
record which path produced each result.

**Step 4 — Capture usage and log it.** Structured line per call; the `usage`
object is already in the response.

**Step 5 — Persist usage** to a table keyed by tenant, with derived cost from a
configurable price table.

**Step 6 — Enforce spend caps** before the call, falling back to heuristics
above the cap.

**Step 7 — Surface rate-limit headroom** in `/api/health/deep` and warn when
remaining requests fall below a threshold.

Steps 1 through 3 are what production needs. Steps 4 through 6 are what a
platform that bills customers for AI usage needs. Step 7 is convenience.

## What this does not change

No prompt changes, no model change, no new dependency — `fetch` and
`AbortSignal` are both built in. The classification results for a given input
are identical. Only the behaviour under failure differs, and today that
behaviour is "hang, or throw and fail the job."
