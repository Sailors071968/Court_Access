# Live production database verification — commands only

Program 166. Commands to run on the EC2 production server. Nothing here is
interpreted, and no readiness classification is made — that waits for the
output.

**Nothing in this document assumes `psql` is installed, and nothing assumes
RDS.** The primary path uses the `pg` client that ships inside the release's
`node_modules`, because `pg` is a production dependency of the backend. The
`psql` alternatives are given for completeness and marked as such.

---

## Read-only guarantees

"Read-only" here means enforced by PostgreSQL, not promised by me.

| Mechanism | Guarantee |
|---|---|
| `BEGIN TRANSACTION READ ONLY` | The server refuses every write with SQLSTATE **25006** |
| `PGOPTIONS='-c default_transaction_read_only=on'` | Same, applied to a whole `psql` session |

Both were tested. Inside a read-only transaction, each of these was refused
individually with `25006`, and the database was unchanged afterwards:

```
[25006] CREATE TABLE      cannot execute CREATE TABLE in a read-only transaction
[25006] INSERT            cannot execute INSERT in a read-only transaction
[25006] UPDATE            cannot execute UPDATE in a read-only transaction
[25006] DELETE            cannot execute DELETE in a read-only transaction
[25006] TRUNCATE          cannot execute TRUNCATE TABLE in a read-only transaction
[25006] DROP TABLE        cannot execute DROP TABLE in a read-only transaction
[25006] ALTER TABLE       cannot execute ALTER TABLE in a read-only transaction
[25006] CREATE INDEX      cannot execute CREATE INDEX in a read-only transaction
```

And under `PGOPTIONS`:

```
$ psql "$PGURL" -c "CREATE TABLE should_fail(id int);"
ERROR:  cannot execute CREATE TABLE in a read-only transaction
```

---

## Step 0 — Get to a directory that has `node_modules`

```bash
cd /var/www/courtaccess
ls -d node_modules >/dev/null && echo "node_modules present" || echo "NOT PRESENT"
node --version
```

**Why:** every command below needs either the `pg` client or the Prisma CLI,
both of which live in `node_modules`. Nothing needs to be installed and nothing
needs network access.

**Expected:** `node_modules present`, and a Node version.

**Blocking:** `NOT PRESENT` in both `/var/www/courtaccess` and the staged
release directory — then use the `psql` alternatives instead.

**Read-only:** yes, `ls` and `--version`.

---

## Step 1 — Confirm `DATABASE_URL` is readable, with the password masked

```bash
set -a; . /var/www/courtaccess/.env 2>/dev/null; set +a
echo "${DATABASE_URL:-<EMPTY>}" | sed -E 's#(//[^:]+):[^@]*@#\1:***@#'

# Prisma's URL carries ?schema=public. psql and pg_dump reject that outright
# with: invalid URI query parameter: "schema". Strip the query string for
# them; Prisma commands keep using DATABASE_URL unchanged.
export PGURL="${DATABASE_URL%%\?*}"
psql "$PGURL" -tAc "select 1"
```

**Expected:** the masked URL, then `1`. If `psql` errors on the URI, the strip
did not apply — check that `PGURL` has no `?` in it.

**Why:** everything else depends on it, and the host portion is what determines
whether the server is on this machine or elsewhere. The `sed` masks the password
so the output is safe to paste back.

**Expected:** something of the form
`postgresql://user:***@host:5432/dbname?schema=public`.

**Blocking:** `<EMPTY>`, or the `.env` cannot be read. Then try reading it from
the running process:

```bash
PID=$(pgrep -f 'dist/index.js' | head -1)
sudo tr '\0' '\n' < /proc/$PID/environ | grep '^DATABASE_URL=' | sed -E 's#(//[^:]+):[^@]*@#\1:***@#'
```

**Read-only:** yes, nothing connects to the database.

---

## Step 2 — The main inspection — Phases 1, 2 and 3 in one command

This is the command that matters. It answers every field the program asks for
and prints one report.

```bash
cd /var/www/courtaccess
node /path/to/inspect-database.mjs
```

`inspect-database.mjs` is in this branch at `deploy/inspect-database.mjs`. If
the release has not been staged, copy just that one file to the host; it has no
dependencies beyond `pg`.

**Why:** it collects the PostgreSQL version, database name, current and session
user, current schema, search path, server address and port, whether the server
is a read replica, size, owner, encoding, collation, counts of tables, indexes,
views, materialised views, functions, triggers, foreign keys and enums, the
installed extensions, the connection breakdown, the full `_prisma_migrations`
state, and a table-by-table comparison against the Release Candidate schema.

**Read-only: guaranteed.** Every statement runs inside
`BEGIN TRANSACTION READ ONLY`, and the transaction ends in `ROLLBACK` — there is
no `COMMIT` anywhere in the file. Tested against all three database states.

**Expected output** — one of three shapes. The `SUMMARY` block states which.

<details>
<summary>Shape A — a database already carrying the RC schema</summary>

```
PHASE 1 — DATABASE DISCOVERY
  server version                 PostgreSQL 16.14 …
  database name                  courtaccess
  current user                   courtaccess
  current schema                 public
  search path                    "$user", public
  server address                 127.0.0.1/32
  read replica                   no
  database size                  14 MB
  encoding                       UTF8

PHASE 1 — OBJECT COUNTS
  tables                         116
  indexes                        484
  views                          0
  functions                      0
  triggers                       0
  fkeys                          53
  enums                          0
  extensions                     plpgsql 1.0

PHASE 2 — PRISMA STATE
  _prisma_migrations exists      YES
  applied                        30 of 30 expected
  unfinished                     0
  rolled back                    0

PHASE 3 — SCHEMA COMPARISON …
  MISSING                        0

SUMMARY
  state                          PRISMA-MANAGED, SCHEMA COMPLETE
```

Exit code 0.
</details>

<details>
<summary>Shape B — an empty database</summary>

```
PHASE 2 — PRISMA STATE
  _prisma_migrations exists      NO

PHASE 3 — SCHEMA COMPARISON …
  tables the RC needs            115
  present                        0
  MISSING                        115

SUMMARY
  state                          EMPTY DATABASE
```

Exit code 0.
</details>

<details>
<summary>Shape C — populated by something else</summary>

```
PHASE 1 — OBJECT COUNTS
  tables                         2
  views                          1

PHASE 2 — PRISMA STATE
  _prisma_migrations exists      NO

PHASE 3 — SCHEMA COMPARISON …
  MISSING                        114
  tables not in the RC schema    1
  tables with too few columns    1

  tables present that the RC does not define (1):
    - Session
  tables missing columns (1):
    - users (has 2, RC needs 17)

SUMMARY
  state                          POPULATED BUT NOT PRISMA-MANAGED
```

Exit code 1.
</details>

**Blocking output:**

| Output | Meaning |
|---|---|
| `CONNECTION FAILED: … ECONNREFUSED` | Nothing listening at that address |
| `CONNECTION FAILED: … timeout` | Reachable name, blocked port — a security group, if external |
| `CONNECTION FAILED: password authentication failed` | Credentials in `.env` are wrong or rotated |
| `CONNECTION FAILED: database "…" does not exist` | The URL names a database that was never created |
| `read replica  YES — this is a standby` | Writable primary is elsewhere; migrations cannot run here |
| `unfinished  N  <-- BLOCKS DEPLOYMENT` | A previous migration was interrupted |
| `Could not load the 'pg' client` | Wrong directory — use the `psql` path below |

---

## Step 3 — Prisma's own view of migration state

```bash
cd /var/www/courtaccess          # or the staged release directory
DATABASE_URL="$DATABASE_URL" npx prisma migrate status
```

**Why:** Step 2 reads `_prisma_migrations` directly. This is Prisma's own
reading of the same table, compared against the 30 migration directories on
disk, and it names the pending ones. Two independent readings agreeing is worth
more than either alone.

**Read-only: verified by test.** Run against an empty database, the table count
was 0 before and 0 after, and `_prisma_migrations` was **not** created. Run
against a foreign schema, 3 tables before and 3 after.

**Expected:**

- `Database schema is up to date!` — nothing to apply
- or `N migrations have not yet been applied`, followed by their names

**Blocking output:**

- `Following migration have failed: …` — a prior migration is in a failed state
- `The database schema is not empty` / `P3005` — not Prisma-managed
- `Error: P1001: Can't reach database server` — connectivity

---

## Step 4 — Full schema difference against the Release Candidate

Requires the RC's `prisma/schema.prisma` on the host. Staging the release is
enough; the release is inert until PM2 points at it.

```bash
cd "$RELEASE"
npx prisma migrate diff \
  --from-url "$DATABASE_URL" \
  --to-schema-datamodel prisma/schema.prisma
```

And to capture the exact SQL that would close the gap — still without running
any of it:

```bash
npx prisma migrate diff \
  --from-url "$DATABASE_URL" \
  --to-schema-datamodel prisma/schema.prisma \
  --script > /tmp/schema-gap.sql
wc -l /tmp/schema-gap.sql
```

**Why:** this is the authoritative Phase 3 comparison. Step 2 compares table
names and column counts; this compares columns, types, indexes, constraints,
foreign keys, enums and defaults, and classifies each as added, removed or
changed.

**Read-only: verified by test.** Run twice against a populated database that
Prisma did not manage; the table count was identical before and after, and no
`_prisma_migrations` appeared. `--script` writes only to the file you redirect
to.

**Expected:**

- `No difference detected.` — production already matches the RC
- or a list beginning `[+] Added tables`, `[*] Changed the … table`

**Blocking output:** any `[-] Removed` entry, or a changed column type, on a
table the RC uses.

---

## Step 5 — Backup capability

```bash
pg_dump --version
pg_dump "$PGURL" --schema-only --no-owner -f /tmp/schema-probe.sql && wc -l /tmp/schema-probe.sql
```

**Why:** the migration chain has no down migrations, so a dump is the only
mechanism for database rollback. This also proves the credentials in `.env` have
enough privilege to read the whole schema.

**Read-only:** yes — `pg_dump` issues only `SELECT` and catalogue reads. Output
goes to `/tmp`.

**Expected:** a version, then a file of a few thousand lines.

**Blocking output:**

- `pg_dump: command not found` — no local client; if the server is RDS, confirm
  automated snapshots are enabled and record the latest restore point instead
- `server version mismatch` — the local `pg_dump` is older than the server;
  a matching or newer client is required
- `permission denied for table …` — the application role cannot dump everything,
  so this dump would not be a complete backup

---

## Alternative path — if `node_modules` is unavailable

Only if Step 0 reported `NOT PRESENT`. Requires `psql` on the host.

Set the guard once. It makes the entire session read-only at the server:

```bash
export PGOPTIONS='-c default_transaction_read_only=on'
```

**Read-only: guaranteed while this is exported.** Verified — a `CREATE TABLE`
attempt under it returned `ERROR: cannot execute CREATE TABLE in a read-only
transaction`.

### Phase 1

```bash
psql "$PGURL" -c "
select version() as version,
       current_database() as db,
       current_user, session_user,
       current_schema() as schema,
       current_setting('search_path') as search_path,
       inet_server_addr()::text as server_addr,
       inet_server_port() as server_port,
       pg_is_in_recovery() as is_replica;"

psql "$PGURL" -c "
select pg_size_pretty(pg_database_size(current_database())) as size,
       pg_get_userbyid(datdba) as owner,
       pg_encoding_to_char(encoding) as encoding,
       datcollate, datctype
from pg_database where datname = current_database();"

psql "$PGURL" -c "
select (select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE') as tables,
       (select count(*) from pg_indexes where schemaname='public') as indexes,
       (select count(*) from information_schema.views where table_schema='public') as views,
       (select count(*) from pg_matviews where schemaname='public') as matviews,
       (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public') as functions,
       (select count(*) from pg_trigger where not tgisinternal) as triggers,
       (select count(*) from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public' and c.contype='f') as fkeys,
       (select count(*) from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typtype='e') as enums;"

psql "$PGURL" -c "select extname, extversion from pg_extension order by extname;"
```

**Why:** the same fields Step 2 collects. **Expected:** PostgreSQL 14 or later,
`UTF8`, schema `public`. **Read-only:** guaranteed under `PGOPTIONS`.

### Phase 2

```bash
psql "$PGURL" -tAc "select to_regclass('public._prisma_migrations') is not null as prisma_managed;"

psql "$PGURL" -c "
select count(*) as total,
       count(*) filter (where finished_at is not null) as applied,
       count(*) filter (where finished_at is null and rolled_back_at is null) as unfinished,
       count(*) filter (where rolled_back_at is not null) as rolled_back
from _prisma_migrations;"

psql "$PGURL" -c "
select migration_name, started_at, finished_at, rolled_back_at, applied_steps_count
from _prisma_migrations order by started_at;"
```

**Why:** existence, applied count, latest, failed and pending. **Expected:**
`t`, then applied between 1 and 30 with `unfinished` and `rolled_back` both `0`.
**Blocking:** either non-zero. **Read-only:** guaranteed under `PGOPTIONS`.

The second and third commands error with `relation "_prisma_migrations" does not
exist` if the first returned `f`. That is the expected consequence, not a fault.

### Phase 3

```bash
psql "$PGURL" -c "\dt public.*"
psql "$PGURL" -c "
select table_name, count(column_name) as columns
from information_schema.columns
where table_schema='public'
group by table_name order by table_name;"
```

**Why:** without the Prisma CLI, a table and column-count listing is the most
that can be compared by hand. **Expected for a matching schema:** 116 tables.
**Read-only:** guaranteed under `PGOPTIONS`.

Unset the guard when finished:

```bash
unset PGOPTIONS
```

---

## Order

```
0  node_modules present?
1  DATABASE_URL readable, masked
2  node deploy/inspect-database.mjs      <-- Phases 1, 2 and 3
3  npx prisma migrate status
4  npx prisma migrate diff
5  pg_dump --schema-only probe
```

Steps 2 and 4 together answer every question in Phases 1 to 3. Steps 3 and 5
are corroboration and backup capability.

---

## What to send back

The complete output of steps 2, 3 and 4, and the version line from step 5. The
inspector masks the database password; the `psql` and Prisma commands do not
print it. **Check the output for credentials before pasting it anywhere.**

Nothing will be classified until that output arrives.
