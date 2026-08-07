# Health endpoint and logging — Programs 173, 174

Analysis only. Nothing implemented, no production system contacted.

---

# PROGRAM 173 — Health endpoint evaluation

## What exists

Two endpoints.

### `/api/health` — `server.ts:204-210`

```ts
app.get('/api/health', async () => ({
  status: 'ok',
  timestamp: new Date().toISOString(),
  version: '1.1.0',
  service: 'court-access-backend',
  environment: process.env.NODE_ENV || 'development',
}));
```

### `/api/health/deep` — `observability/deepHealthCheck.ts:59-81`

Checks PostgreSQL, Redis, Neo4j and memory in parallel, and reports the worst
component status as the overall.

## Does `/api/health` accurately represent production health?

**No. It cannot, by construction.**

It is a function that returns a literal. It performs no I/O, touches no
dependency, and has no failure mode short of the process being dead or the event
loop being blocked. `status: 'ok'` is not a measurement — it is a constant in
the source.

### Exactly why it can report healthy while critical services are down

| Service | State it can be in | What `/api/health` says |
|---|---|---|
| PostgreSQL | unreachable | `ok` |
| Redis | unreachable | `ok` |
| Filesystem | uploads directory read-only | `ok` |
| Disk | 100% full | `ok` |
| Workers | none running | `ok` |
| Migrations | pending, schema drifted | `ok` |
| OpenAI | unreachable | `ok` |
| `JWT_SECRET` | absent, random key in use | `ok` |
| Memory | at the heap ceiling | `ok` |

Two of those are not hypothetical for this deployment. The certified
configuration runs with **Redis absent** and, per Program 170 finding H2, with
**a schema guard that cannot detect a pending migration**. `/api/health` reports
`ok` in both cases.

**This is not a theoretical concern — it already happened.** The production
audit found a health-check stub answering `/api/health` with `{"status":"ok"}`
while every other route 404'd, and it stayed that way for roughly six weeks. A
green health check is precisely what allowed a completely non-functional
deployment to go unnoticed.

There is one mitigating detail. Because the endpoint is registered at
`server.ts:204`, inside `startServer()` and after `enforceSchemaOnBoot()`, a
response of any kind proves the process got past the database connectivity
check at boot. That is a real signal, but a weak one: it says the database was
reachable at startup, not that it is reachable now.

### Is `/api/health/deep` sufficient instead?

Closer, and genuinely useful — the memory check in particular is well
constructed, comparing against the V8 heap ceiling rather than `heapTotal`, with
a comment (`:182-186`) explaining that the naive version reported healthy
processes as unhealthy. That is the right instinct.

But it has three problems.

**It will report `unhealthy` in the certified configuration.** `checkRedis()`
(`:108-134`) pings Redis and returns `unhealthy` on failure. The overall status
is the worst component (`:68-71`). With Redis deliberately absent and
`DISABLE_WORKERS=true`, `/api/health/deep` reports the entire platform
unhealthy while it is working correctly. Anything monitoring it alarms
continuously, and an alarm that is always on is an alarm nobody reads.

**Its own header comment promises a check it does not implement.** Lines 9-10
list "Disk space" and "Memory usage". The `HealthReport` type (`:37-42`) has
`postgres`, `redis`, `neo4j`, `memory`. **There is no disk check.** For a
platform whose primary operation is uploading multi-gigabyte discovery, disk is
the resource most likely to run out.

**The Neo4j check does not check Neo4j.** `checkNeo4j()` (`:140-168`) returns
`unknown` in every branch — either "NEO4J_URI not configured" or "Neo4j health
check requires graph module client". It never connects. It is a placeholder that
reads as a check.

## Evaluation against the requested list

| Aspect | `/api/health` | `/api/health/deep` |
|---|---|---|
| Database | Not checked | **Checked** — `SELECT 1` with latency |
| Filesystem | Not checked | Not checked |
| Uploads | Not checked | Not checked |
| OpenAI | Not checked | Not checked |
| Worker status | Not checked | Not checked |
| Memory | Not checked | **Checked, well** |
| Disk | Not checked | **Not checked** — despite the header comment |
| Environment | Reported | Reported |
| Migrations | Not checked | Not checked |
| Version | Hardcoded `'1.1.0'` | `APP_VERSION` or `'1.1.0'` |
| Uptime | Not reported | **Reported** |

Note the version in `/api/health` is a string literal in the source, not the
deployed commit. It says `1.1.0` for every build ever made, so it cannot
distinguish the Release Candidate from a future release. `dist/build-info.json`,
added on this branch, carries the actual commit — the health endpoint does not
read it.

## Design — a production-grade health endpoint

Three endpoints with three different jobs, because one endpoint cannot serve a
load balancer and a human at the same time.

### 1 · `/api/health` — liveness. Keep it exactly as it is.

Its job is to answer "is this process alive and serving?" for PM2 and for nginx.
It must be cheap, must not touch a dependency, and **must not fail when a
dependency is down** — otherwise a brief database blip triggers a restart storm,
turning a recoverable outage into a compounding one.

The current endpoint is correct for this purpose. The defect is not the
endpoint; it is treating it as evidence of anything more.

One change: report the real build. Read `dist/build-info.json` at startup and
serve the commit, so an operator can confirm what is deployed.

```json
{ "status": "ok", "service": "court-access-backend",
  "version": "1.1.0", "commit": "4bdaca1", "environment": "production",
  "uptimeSeconds": 3421, "timestamp": "…" }
```

### 2 · `/api/health/ready` — readiness. New.

"Should this instance receive traffic?" Checks only what a request needs:

| Component | Healthy | Degraded | Unhealthy |
|---|---|---|---|
| Database | `SELECT 1` < 500 ms | 500 ms–2 s | fails |
| Migrations | 0 pending | — | pending or failed |
| Uploads directory | writable | — | not writable |
| Disk | > 10 GB | 2–10 GB | < 2 GB |

HTTP 200 when healthy or degraded, 503 when unhealthy. **Redis, OpenAI and Neo4j
are excluded** — a request can be served without any of them.

### 3 · `/api/health/deep` — diagnostic. Extend the existing one.

For humans and dashboards. Never used for automated routing, so a `degraded`
here costs nothing.

Add:

- **Disk** — free bytes and percentage on the volumes holding uploads, staging
  and the database if local. The check the header already claims.
- **Uploads and staging** — resolved path, writable via a probe file, and
  **whether the path falls inside the application directory**, which is a
  misconfiguration worth surfacing permanently rather than only at startup.
- **Migrations** — applied against expected, and the checksum. Reuse
  `assertSchemaIntegrity()`. Depends on fixing H2 first, or it reports
  `no-migrations` forever.
- **Workers** — how many BullMQ workers are running, and whether
  `DISABLE_WORKERS` explains a count of zero.
- **OpenAI** — configured or not. Do **not** call the API; a health check that
  costs money per poll is its own defect.
- **Configuration** — which of the required variables are present, names only.
  This is where a missing `JWT_SECRET` becomes visible, and today it is visible
  nowhere.

Fix the three existing problems:

- **Redis must not make the platform unhealthy.** When `DISABLE_WORKERS=true`,
  report Redis as `unknown` with "workers disabled" rather than `unhealthy`, and
  exclude it from the overall status. Redis unreachable while workers are
  *enabled* is a genuine `unhealthy`.
- **Neo4j** should report `not_configured` rather than `unknown`, or be removed.
  A placeholder that looks like a check is worse than no check.
- **The overall status** should be computed only from components the deployment
  actually depends on.

### Worked example

```json
{
  "status": "degraded",
  "commit": "4bdaca1",
  "uptimeSeconds": 3421,
  "components": {
    "postgres":  { "status": "healthy", "latencyMs": 3 },
    "migrations":{ "status": "healthy", "message": "30/30 applied, checksum a1b2c3d4" },
    "uploads":   { "status": "healthy", "message": "/var/lib/courtaccess/evidence writable, outside app dir" },
    "disk":      { "status": "degraded", "message": "6.2 GB free on /var (8%)" },
    "memory":    { "status": "healthy", "message": "heap=180/4096MB (4%)" },
    "redis":     { "status": "unknown", "message": "unreachable; workers disabled by configuration" },
    "workers":   { "status": "unknown", "message": "0 running; DISABLE_WORKERS=true" },
    "openai":    { "status": "unknown", "message": "OPENAI_API_KEY not set" },
    "config":    { "status": "healthy", "message": "all required variables present" }
  }
}
```

`degraded` on disk, and the platform is still serving. That is the distinction
the current design cannot express.

---

# PROGRAM 174 — Logging evaluation

## What exists

Two logging systems in one process.

**Pino**, via `Fastify({ logger: true })` (`server.ts:84`) — request and
response lines with an automatic `reqId`, as structured JSON.

**`console.*`** — everything else: startup, workers, Redis, schema assertion.
Plain text.

They interleave in the same stream, so the PM2 log is half JSON and half prose.
Any log shipper has to handle both, and the `console` lines carry no timestamp
of their own, no level field, and no request context.

## Assessment against the requested list

### Startup logs — **good, with one gap**

Genuinely thorough. The route table is enumerated (`server.ts:383-463`), schema
assertion reports version, checksum and migration counts
(`schemaAssert.ts:319-322`), and there is a clear terminal line:

```
[Server] Security hardening active: JWT auth, rate limiting, CSRF,
         security headers, upload protection, security logging
```

That last line is a good pattern — one unambiguous marker that startup
completed, easy to grep for after a deployment.

**Missing:** the build identity. Nothing logs the commit, the build time, or the
resolved configuration at startup. `dist/build-info.json` exists on this branch
and is not read at boot. After a deployment the log cannot answer "which build
is this?"

**Missing:** which environment variables were resolved, names only. When
something misbehaves, the first question is what configuration it started with,
and the log cannot say.

### Fatal errors — **partial**

`enforceSchemaOnBoot` logs clearly before exiting (`schemaAssert.ts:324-330`),
including the remedy — `Run: npx prisma migrate deploy`. That is the right shape
for a fatal message.

**Missing:** the failure described in Program 170 H4. Anything throwing between
`server.ts:80` and the `try` at `:379` becomes an unhandled rejection, logged by
the handler at `:67-70` as "server kept running" — which is *wrong* in that
case, because the server never started. The log actively misdescribes the
situation.

**Missing:** no log distinguishes a clean shutdown from a crash. `shutdown()`
logs the signal (`:475`), but a process killed by the OOM-killer leaves nothing.

### Error handling — **good**

`server.ts:124-173` is the strongest part of the logging. Every unhandled error
gets an 8-character `reference`, logged with the error, path and method, and
returned to the client so a user can quote it. Prisma codes are mapped to
sensible statuses and messages. No stack traces reach the client.

### Upload logs — **thin**

One line on success: `[DirectUpload] Evidence … saved: name (bytes)`
(`evidenceDirectUpload.ts:743`). Multipart parse failures log at `:791`.

**Missing:** nothing logs the start of an upload, so a failure that never
completes leaves no trace of having been attempted. For a 40 GB corpus that is
the difference between "it failed at file 812" and silence. Chunked uploads
through the portal log nothing per chunk. No throughput, no duration.

For a platform handling privileged discovery, upload logging should be an audit
trail, not a debug aid: who uploaded what, when, from where, with which
checksum, and whether it completed.

### AI logs — **absent**

`cpraClassificationEngine.ts:66-79` logs nothing at all: not the request, not
the model, not the latency, not the token usage, not the failure. The response
`usage` object is discarded. There is no way to answer what was sent to OpenAI,
what it cost, or how often it failed. See Program 176.

### Authentication logs — **good, and the best-designed part**

There is a `SecurityLog` model in the schema and a `securityLogs` relation on
`User`. `registerSecurityLogging` runs as a hook (`server.ts:201`). Auth events
are persisted to the database rather than only written to a log file, which is
the right choice for an audit trail — file logs rotate away.

**Missing:** nothing logs a *successful* configuration of the signing keys, so
the H1 silent-random-secret failure produces no authentication log either. The
audit trail would show users being signed out with no cause recorded.

### Migration logs — **good at startup, absent at apply time**

`schemaAssert.ts:319-322` reports counts and checksum on boot. Migrations
themselves are applied by the Prisma CLI outside the application, so their
output lands in whatever shell ran the deployment and is not retained anywhere.

**Recommendation:** capture `prisma migrate deploy` output to a file under
`~/rollback/` during deployment. It is the only record of what changed the
database, and Stage E1 of the runbook currently lets it scroll past.

### Database logs — **deliberately minimal**

`lib/prisma.ts:13` sets `log: ['error']` in production, `['warn','error']` in
development. Reasonable — query logging in production would be enormous and
would put evidence content into the logs, which for privileged discovery is a
genuine confidentiality problem, not just noise.

**Missing:** no slow-query logging. There is no middle ground between "errors
only" and "everything". Prisma's `$on('query')` with a duration threshold would
give one.

### Request correlation IDs — **partial**

Pino assigns each request a `reqId`, and it appears on Fastify's own request
lines. The error handler mints a separate `reference` (`:126`) returned to the
client.

**Two gaps.** The `reference` and the `reqId` are different identifiers, so a
support ticket quoting a reference requires finding the error line first, then
pivoting to the `reqId` for everything else in that request. And every
`console.*` line — all startup and worker logging — has no request context at
all, so work triggered by a request cannot be tied back to it.

### Version logging — **absent**

Nothing logs the running version or commit, anywhere, at any time. The health
endpoint reports a hardcoded `'1.1.0'` that has never changed. After a
deployment, neither the log nor the API can confirm which build is running.
`dist/build-info.json` makes this a small fix.

## Recommendations, in priority order

**1. Log build identity at startup.** Read `dist/build-info.json` and log commit,
branch and build time as the first line. Everything else in this section is
harder to act on without knowing which build produced it. **Size S.**

**2. Log resolved configuration at startup, names and safe values only.**
`PORT`, `HOST`, `NODE_ENV`, `DISABLE_WORKERS`, resolved upload and staging
paths, and the *presence* of each secret. Never values. This makes H1 visible
and answers the first question of every incident. **Size S.** Overlaps the
Program 172 validator — implement there.

**3. Log upload start and completion with an audit shape.** User, tenant, case,
filename, size, checksum, duration, outcome. For chunked uploads, log at start,
completion and failure. **Size M.**

**4. Unify on one logger.** Move `console.*` to Pino via
`app.log`/`fastify.log`, so everything is structured JSON with consistent levels
and timestamps. Mechanical but touches many files — and worth doing before
anyone tries to ship these logs anywhere. **Size L.**

**5. Propagate the correlation ID.** Use Fastify's `reqId` as the `reference`
returned to clients rather than minting a second identifier, and pass it into
service calls so downstream work is attributable. **Size M.**

**6. Add slow-query logging.** Prisma `$on('query')` above a threshold, logging
the duration and the model but **not** parameters, which would contain evidence
content. **Size S.**

**7. Capture migration output during deployment.** A runbook change, not a code
change. **Size S.**

**8. Log OpenAI requests.** Model, latency, token usage, outcome. Program 176.
**Size S** once the client is centralised.
