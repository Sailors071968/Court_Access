# INC-001 Production Deployment State

**Measured:** 2026-08-12T19:35:15.013443+00:00  
**Document type:** Direct deployment evidence (not symptom inference)

## INC-001 STATUS

| Gate | State |
|---|---|
| ROOT CAUSE VERIFIED | YES |
| FIX WRITTEN | YES (`cdaa823`) |
| FIX TESTED | YES (size-matrix 50KB–30MB) |
| **FIX NOT DEPLOYED** | **YES** |
| **PRODUCTION STILL RUNNING PREVIOUS BUILD** | **YES** |

**RESOLVED:** NO · **Status:** OPEN  
**Stop:** No further upload-symptom debugging until deployment state is corrected.

## Direct evidence

### 1. Production Git commit hash
- **Source:** `GET https://courtaccess.net/api/health` → `commit`
- **Value:** `b52e9aadfa35c3547327985bd13e411f217ae0e9`
- **Version:** `1.1.0` · env `production`

### 2. Production process lifetime
- **Source:** `uptimeSeconds` on `/api/health`
- **Value:** `181990` seconds (~50.5 hours)
- **Inferred process start (UTC):** `2026-08-10T17:02:05.013415+00:00`
- Not restarted for PR #167 fix (fix committed 2026-08-12T19:04:06Z).

### 3. Frontend build artifact timestamp
- **Source:** `Last-Modified` on `GET /`
- **Value:** `Mon, 10 Aug 2026 17:00:28 GMT`

### 4. PR #167 identity
- **URL:** https://github.com/Sailors071968/Court_Access/pull/167
- **HEAD:** `5e012e99d2d08fc4fa185328de7641d27c87a7a1`
- **Fix commit:** `cdaa823e09eecf52c2099589ff5523fff0aecb83` (2026-08-12T19:04:06Z)

### 5. Version of `importJobRoutes.ts` on production commit
- **Method:** `git show b52e9aadfa35c3547327985bd13e411f217ae0e9:backend/src/intelligence/inmates/importJobRoutes.ts`
- Contains deferred-stream bug: `pending.push({ jobFileId, filename: part.filename, file: part.file })`
- Does **not** contain `processImportJobMultipartUpload`

### 6. Presence of multipart stream fix
| Artifact at commit | Production `b52e9aad` | PR #167 HEAD |
|---|---|---|
| `importJobMultipartUpload.ts` | **ABSENT** | PRESENT |
| `processImportJobMultipartUpload` in routes | **ABSENT** | PRESENT |
| `pending.push` deferred streams | **PRESENT (bug)** | ABSENT |

### 7. `fix commit ⊆ production commit`?
- **Method:** `git merge-base --is-ancestor cdaa823 b52e9aad`
- **Result:** **NO**

### 8. PM2 restart / host build artifact timestamps
- **Unavailable** from this agent (no host shell).  
- **Not required** to conclude FIX NOT DEPLOYED: the running API **self-reports** its git commit, and that commit’s tree lacks the fix.

### 9. Is the running Node process using the newly built code?
- **NO** — basis: self-reported commit + git tree comparison above.

## Engineering question

> Why is production still running code that produces `uploadedBytes = 0`?

**Answer from evidence:** The production API advertises commit `b52e9aad`, which predates PR #167 and still contains the deferred multipart stream handler.

## Next allowed action

1. Deploy PR #167 (minimum fix commit `cdaa823`) by any mechanism.  
2. Re-check `/api/health` commit == deployed SHA.  
3. Upload real `SACJAILSCAN08-12-2026.pdf`.  
4. Capture closure Tests 1–11.  
5. Publish consolidated production evidence report → only then mark INC-001 **RESOLVED**.

Raw JSON: `INC001_DEPLOYMENT_STATE.json`
