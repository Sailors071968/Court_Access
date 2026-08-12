# Production Deployment Checklist

**Phase:** Release Engineering  
**Rule:** A deployment is incomplete until every step below is evidenced.  

Use for CourtAccess API releases (including INC-001A → INC-001 closure).

## Checklist

| # | Step | Evidence required | Pass? |
|---|---|---|---|
| 1 | **Git checkout** | On deploy host, in the API app directory: `git rev-parse HEAD` and `git status -sb` show the intended release SHA (clean or known deploy state) | ☐ |
| 2 | **Build** | Backend build/artifact mtime ≥ checkout time; or `tsx`/dist path matches checkout (`ls -la` on script target) | ☐ |
| 3 | **Prisma migrate** | `prisma migrate deploy` (or documented no-op) exit 0; record migrate status output | ☐ |
| 4 | **Restart PM2** | `pm2 restart <api-app>` (or delete+start ecosystem); new PID; `pm2 describe` restart time after deploy | ☐ |
| 5 | **Verify commit hash** | `GET https://courtaccess.net/api/health` → `commit` **equals** deployed SHA | ☐ |
| 6 | **Verify API health** | `/api/health` status ok; `/api/health/ready` postgres + uploads healthy | ☐ |
| 7 | **Verify upload** | Import Job upload of realistic PDF (≥500 KB, preferably real SACJAIL) → `uploadedBytes > 0`, timestamps set, JobFile `uploaded` | ☐ |
| 8 | **Verify parser** | `processStartedAt` set / autoProcess started without manual Process | ☐ |
| 9 | **Verify comparison** | Comparison batch exists for the Daily Case / roster date | ☐ |
| 10 | **Verify report** | Printable New Inmate report generated for that case | ☐ |

## Hard gate

If step **5** fails (health commit ≠ intended SHA):

- **STOP**
- Do not run steps 7–10
- Open / continue **INC-001A** (wrong code running)
- Do not debug product symptoms on the old build

## PM2 identity capture (required every deploy)

Record once after restart:

```text
pm2 describe <api-app>
# capture: name, status, pid, cwd, script, exec cwd, created/restart times

git -C <cwd> rev-parse HEAD
git -C <cwd> log -1 --oneline

readlink -f /proc/<pid>/cwd
readlink -f /proc/<pid>/exe
tr '\0' ' ' < /proc/<pid>/cmdline; echo

curl -sS https://courtaccess.net/api/health
```

If `git rev-parse HEAD` ≠ health `commit`, investigate multiple installs / wrong upstream before product testing.

## Known roots to disambiguate on EC2

| Path | Notes |
|---|---|
| `/var/www/courtaccess` | Cutover production API root (ecosystem.production.config.cjs) |
| `/var/www/courtaccess-v1` | Alternate V1 install; evidence dir name suggests v1 data plane |
| `/opt/courtaccess` | GH Actions `dev` website deploy target |

Enumerate which PM2 apps point where. Only one must serve `courtaccess.net` API.
