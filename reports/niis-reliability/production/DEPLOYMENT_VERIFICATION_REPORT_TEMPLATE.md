# Deployment Verification Report — Template

**Purpose:** Before any debugging or feature work after a production deploy, prove the server runs the expected code.  
**Rule:** If Section 3 running commit ≠ Section 1 deployed commit → **FAILED**. No manual / operational testing.

Fill one report per production deploy attempt.

---

## Header

| Field | Value |
|---|---|
| Report ID | DVR-YYYYMMDD-NNN |
| Incident / release | e.g. INC-001A → INC-001 |
| Operator | |
| Report generated at (UTC) | |

---

## Section 1 — Source

| Field | Value |
|---|---|
| Git branch deployed | |
| Git commit SHA (full) | |
| Short SHA | |
| Build timestamp (UTC) | |
| Build machine | e.g. `github-actions` / `ec2-…` / laptop |
| PR number | e.g. `#167` |

Example:

```text
Branch: cursor/prod-pipeline-first-fail-54dc   # or whatever was actually checked out on the API host
Commit: cdaa823e09eecf52c2099589ff5523fff0aecb83
PR: #167
Build Time: 2026-08-14T05:12:44Z
```

---

## Section 2 — Deployment

| Field | Value |
|---|---|
| Target host | e.g. production EC2 / `courtaccess.net` origin |
| Deployment directory (API cwd) | |
| Ecosystem / PM2 app name | |
| Build completed | ☐ yes / ☐ no — log excerpt |
| Prisma migrations | ☐ yes / ☐ n/a / ☐ failed — command + exit |
| PM2 restart | ☐ yes — command |
| PM2 process ID | |
| PM2 start / restart time (UTC) | |
| Deploy mechanism | ☐ GH Actions · ☐ SSH/manual · ☐ other: ___ |

Capture:

```text
pm2 describe <api-app>
git -C <cwd> rev-parse HEAD
readlink -f /proc/<pid>/cwd
```

---

## Section 3 — Runtime Verification

**Do not trust deploy logs alone.** Query the running app.

| Check | Expected | Observed | Pass? |
|---|---|---|---|
| `GET /api/health` → `commit` | = Section 1 SHA | | ☐ |
| `GET /api/health` → `environment` | `production` | | ☐ |
| Process uptime / inferred start | After Section 2 PM2 restart | | ☐ |
| Build timestamp (if exposed) | ≥ Section 1 build time | | ☐ |
| Version endpoint (if any) | Matches release | | ☐ |

```bash
curl -sS https://courtaccess.net/api/health
curl -sS https://courtaccess.net/api/health/ready
```

**Hard fail:** any running commit other than the deployed SHA → **Deployment Status: FAILED**.

---

## Section 4 — Smoke Test (automated)

Use a **small** synthetic PDF via Import Job upload (not the operational Sacramento file yet).

| Step | Pass? | Evidence |
|---|---|---|
| Upload accepted (HTTP 2xx) | ☐ | |
| `uploadedBytes > 0` | ☐ | |
| Parser starts (`processStartedAt` / autoProcess) | ☐ | |
| Parser completes | ☐ | |
| Canonical roster exists | ☐ | |
| Comparison executes | ☐ | |

If **any** fail → **Deployment Status: FAILED**. No manual / operator testing proceeds.

---

## Section 5 — Production Acceptance (operator)

Only after Section 4 passes:

1. Upload real `SACJAILSCAN08-12-2026.pdf` (or current morning file)  
2. Produce full operational evidence chain:

```text
Upload → Bytes Stored → Parser → Canonical Roster → Comparison
  → Today's New Inmates → Morning Operations → Printable Report
```

3. Attach ledger JSON / screenshots  
4. Then (and only then) close the related product incident (e.g. INC-001)

---

## Final status

| Field | Value |
|---|---|
| Deployment Status | ☐ PASSED · ☐ FAILED |
| Blocking failure (if any) | |
| Next incident allowed | e.g. INC-001 closure / INC-002 / none |

---

## Known gap (as of 2026-08-14)

Existing `Deploy Production Website` workflow does **not** satisfy this report for API releases. See `INC001A_PIPELINE_INVESTIGATION.md`. Until an API deploy path exists, Section 2 must be filled from an on-host procedure, then Sections 3–5 still apply unchanged.
