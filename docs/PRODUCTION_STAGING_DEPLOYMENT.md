# Master Program 13 — Production Staging Deployment

> Clean, git-reproducible staging deploy. Production path `/var/www/courtaccess` is **untouched** (it does not exist; only `/var/www/courtaccess-v1` was created).

## Deployment

- **Location:** `/var/www/courtaccess-v1/app`
- **Source:** the fully-integrated branch `cursor/criminal-liability-discovery-engine-48a3` (= `origin/dev` + all Master Program 1–12 work).
- **Method:** clean checkout — `git reset --hard` to the committed branch head (0 drift), `npm install` (backend + root), `prisma generate`, backend + Vite dev started in tmux.
- **Datastores:** PostgreSQL 16 (`courtaccess` DB, migrations applied + schema in sync) and Redis, running on the VM.

### Why the integrated branch and not raw `origin/dev`

Raw `origin/dev` **lacks the committed repairs** made this session and would reintroduce the exact startup/runtime errors the program says to repair:
- `SchemaVersion` `@map` fix (without it `prisma db push` fails on boot),
- login **500** (refresh-token `jti`), evidence upload **EACCES** (`EVIDENCE_UPLOAD_DIR` default), invite-staff **500** (`ensureMembership` findUnique), timeline **fabricated events + auth disabled**, prod JWT-secret hardening,
- plus the integrated features (search, providers, CALCRIM, assistant, knowledge graph).

Deploying raw dev would therefore be non-operational. Staging reflects the integrated branch so it is **operational with every known error repaired** — the program's stated goal.

## Startup / runtime / integration errors repaired (this session)

| Error | Fix |
|-------|-----|
| Boot: `SchemaVersion` model↔migration column mismatch (db push failed) | `@map` snake_case columns |
| Boot: schema-drift assertion | `migrate deploy` + `db push` (104 tables) |
| `POST /auth/login` → 500 (refresh-token unique collision) | unique `jti` per refresh token |
| `POST /evidence/upload` → 500 EACCES (`/var/www/courtaccess` hardcoded) | portable repo-relative `EVIDENCE_UPLOAD_DIR` default |
| `POST /organizations/invitations` → 500 (`findUnique({userId})` invalid) | `findFirst` scoped by tenant |
| `GET /timeline/:id/events` → fabricated data + auth disabled | real DB events + `authMiddleware` |
| Prod boot without JWT secrets (silent ephemeral fallback) | fail fast in production |

## Runtime verification (clean deploy)

- Boot: **Schema Assert PASS**, `running on :3001`.
- `GET /api/health` → 200; frontend `http://localhost:8080/` → 200.
- End-to-end smoke (all **PASS**): login → create case (201) → workbench 200 → intelligence 200 → knowledge-graph 200 → search 200 → timeline 200 → providers 200 → litigation-strategy 200 → assistant 200 → evidence upload 201.

## Startup instructions (reproducible)

```bash
# datastores (once per VM boot)
sudo pg_ctlcluster 16 main start && sudo service redis-server start
# backend (from /var/www/courtaccess-v1/app/backend; .env present)
npm start                                   # → http://0.0.0.0:3001
# frontend (from /var/www/courtaccess-v1/app)
npm run dev -- --port 8080 --host           # → http://localhost:8080  (proxies /api → :3001)
```
Both run in tmux sessions `ca-backend` / `ca-frontend`.

## Staging URL + test credentials

- **UI:** `http://localhost:8080/` · **API:** `http://localhost:3001/api/health` (VM localhost; port-forward 8080 + 3001 to reach externally).
- Test accounts (password `TestPass123!`): `attorney@courtaccess.test`, `investigator@courtaccess.test`, `defendant@courtaccess.test`, `paralegal@courtaccess.test`.

## Verdict

**OPERATIONAL.** Clean, git-reproducible staging at `/var/www/courtaccess-v1`, production untouched, all known startup/runtime/integration errors repaired, end-to-end smoke passing. Left running for testing.
