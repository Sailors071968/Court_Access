# Production database compatibility certification

Program 165. Read-only throughout. No production database was contacted, no
migration was applied to anything outside a local sandbox, and the three
sandbox databases created for the tests below were dropped afterwards.

---

## The shape of this report

Compatibility is a comparison between two schemas. I hold one of them
completely and none of the other.

**The Release Candidate side is fully characterised** — 30 migrations, 116
tables, every destructive statement identified by file and line, and three
deployment scenarios tested empirically against a real PostgreSQL 16 rather
than reasoned about.

**The production side has not been observed.** No output from the production
database has reached me. Phase 1 asks for version, encoding, collation, owner
and size "using the verified production `DATABASE_URL`" — I have no access to
that server and no one has pasted its output. Every Phase 1 field is therefore
**UNKNOWN**, and I will not infer them.

This is not a stalemate. Two of the three realistic scenarios are now proven
safe, one command distinguishes between them, and that command is at the top of
the list at the end of this document.

---

## Two of my earlier assumptions were wrong

Both were mine, both were stated as blockers, and both are now disproven by
test rather than by argument.

### Disproven 1 — "Prisma will fail partway through, leaving a half-migrated schema"

I wrote this in Programs 163 and 164 and classified it a hard blocker: if
production has tables but no `_prisma_migrations`, Prisma would treat every
migration as pending, attempt to create tables that already exist, and fail
mid-chain.

**Tested.** A database with two pre-existing tables and no `_prisma_migrations`:

```
$ npx prisma migrate deploy
30 migrations found in prisma/migrations

Error: P3005
The database schema is not empty.
```

Exit code 1. Then, immediately after:

```
$ psql -d scen_c -tAc "select table_name from information_schema.tables where table_schema='public';"
cases
users
$ ... to_regclass('public._prisma_migrations') is not null
f
```

**Nothing was executed.** Not one `CREATE TABLE`, not one `ALTER`. Prisma
detects the non-empty schema *before* running any DDL and refuses. The database
is byte-for-byte unchanged.

The half-migrated schema I warned about **cannot occur through this path.** The
failure mode is a clean refusal, which is the best possible behaviour. That
blocker is withdrawn.

### Disproven 2 — the audit commands assumed a local PostgreSQL

Every database command in Programs 163 and 164 was written as
`sudo -u postgres psql -d courtaccess`. That form only works if PostgreSQL runs
**on the EC2 instance**, connecting over the local socket as the `postgres`
superuser.

You have verified that `DATABASE_URL` is configured. You have **not** said the
database is local, and the reconciliation you asked for names this explicitly.
If `DATABASE_URL` points at RDS or any external host, every one of those
commands fails with "role postgres does not exist" or a missing socket — and
would be misread as "no database", which is exactly the wrong conclusion.

**All commands in this document use `psql "$DATABASE_URL"` instead**, which is
correct whether the server is local or remote. Determining which it is takes one
command and is step 1.

---

## Phase 1 — Database discovery

| Field | Value | Basis |
|---|---|---|
| PostgreSQL version | **UNKNOWN** | Not observed |
| Database name | **UNKNOWN** | Not observed |
| Current schema | **UNKNOWN** | Not observed |
| Active search path | **UNKNOWN** | Not observed |
| Encoding | **UNKNOWN** | Not observed |
| Collation | **UNKNOWN** | Not observed |
| Database size | **UNKNOWN** | Not observed |
| Owner | **UNKNOWN** | Not observed |
| Connection status | **UNKNOWN** | Not observed |
| Local or external | **UNKNOWN** | Not observed |

Nothing here is inferred, per the instruction. Commands are at the end.

**What the Release Candidate requires of these fields**, so the answers can be
judged when they arrive:

| Requirement | Value | Evidence |
|---|---|---|
| PostgreSQL major | 14 or later | Prisma 6 datasource; verified working on 16.14 |
| Encoding | UTF8 | Evidence text is arbitrary Unicode |
| Extensions | **None** | 0 `CREATE EXTENSION` in 30 migrations; 0 non-`plpgsql` extensions in the built database |
| Collation | No dependency | No collation-sensitive constraint or index in the datamodel |
| Schema | `public` | `?schema=public` in the connection string |
| Enums | **None** | 0 `enum` blocks in `schema.prisma`; 0 `pg_type` enums in the built database |

The absence of extensions and enums is worth dwelling on, because it removes
two entire categories of incompatibility. There is no `uuid-ossp`, no `pgcrypto`,
no `citext`, no `pg_trgm`, no custom type to reconcile. The RC needs an ordinary
UTF8 PostgreSQL database and nothing else.

---

## Phase 2 — Prisma compatibility

### Production side

| Question | Answer | Basis |
|---|---|---|
| `_prisma_migrations` exists | **UNKNOWN** | Not observed |
| Applied migrations | **UNKNOWN** | Not observed |
| Latest migration | **UNKNOWN** | Not observed |
| Pending migrations | **UNKNOWN** | Not observed |
| Failed migrations | **UNKNOWN** | Not observed |
| Drift | **UNKNOWN** | Not observed |

### Release Candidate side — fully characterised

| | |
|---|---|
| Migrations in the chain | **30** |
| Tables after a full apply | **116** (115 models + `_prisma_migrations`) |
| Indexes | **484** |
| Foreign keys | **53** |
| Enums / extensions / functions / triggers / views | **0 each** |
| Down migrations | **0** — Prisma generates none |

**Does deployment require schema changes?** Yes, unless production already
carries all 30. The RC queries 115 tables unconditionally; it cannot run against
a schema that lacks them.

### Every statement in the chain that modifies existing data

Phase 2 asks for these explicitly. This is the complete list across all 30
migrations, found by scanning for `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`,
`DROP`, and type or nullability changes:

| Statement | Location | Effect |
|---|---|---|
| `INSERT INTO "schema_versions"` | `20260320133000_schema_version_control:20` | Seeds one row into a table the same migration creates |
| `UPDATE "schema_versions"` | `20260805200000_v1_schema_drift_repair:73` | Copies four snake_case columns into their camelCase replacements |
| `DROP COLUMN` ×4 | `20260805200000_v1_schema_drift_repair:82-85` | Removes `applied_at`, `applied_by`, `drift_checked`, `migration_name` — **irreversible** |
| `ALTER COLUMN … SET DATA TYPE TIMESTAMP(3)` ×4 | `20260805200000_v1_schema_drift_repair:50,52,53,55` | Truncates timestamp precision from microseconds to milliseconds on `evidence_chunks` and `verified_facts` — **irreversible** |
| `ADD COLUMN … NOT NULL DEFAULT` ×5 | `20260805200000_v1_schema_drift_repair:22,62-65` | Writes a default into every existing row of `subscriptions` and `schema_versions` |
| `DROP NOT NULL` ×5 | `20260805200000_v1_schema_drift_repair:38-43` | Relaxes constraints on `timeline_events`; no data change |
| `DROP INDEX` ×2 | `…role_onboarding…:7`, `…drift_repair:81` | No data change |

And the counts that matter as much as the list:

| | |
|---|---|
| `DROP TABLE` | **0** |
| `DELETE FROM` | **0** |
| `TRUNCATE` | **0** |
| `DROP CONSTRAINT` | **0** |
| `SET NOT NULL` | **0** |

**No migration in this chain deletes, truncates, or drops any user, case,
evidence, document or timeline data.** The only destructive statements target
four columns of `schema_versions`, an internal bookkeeping table, and their
contents are copied into the replacement columns first.

`20260805200000_v1_schema_drift_repair` is the only migration in the chain that
carries any risk at all. Everything else is pure creation.

---

## Phase 3 — Schema comparison

The production schema is unobserved, so a difference report cannot be produced
here. It can be produced **on the host, read-only**, and that is step 8.

`prisma migrate diff --from-url … --to-schema-datamodel` connects, introspects,
and prints the differences **without executing anything**. I confirmed this
rather than assuming it: after running it against the foreign-schema sandbox,
the database still held exactly its original two tables.

Its output already uses the classification Phase 3 asks for — added tables,
changed tables, added columns, added indexes, added foreign keys — and
`--script` emits the exact SQL that would close the gap, still without running
it.

What the classification will mean when you have it:

| Diff output | Classification | Consequence |
|---|---|---|
| "No difference detected" | **Compatible** | Production already carries the RC schema. Deploy the application; run no migrations. |
| Only `[+] Added` entries | **Additive** | Production is a strict subset. `migrate deploy` completes the chain. |
| Any `[-] Removed` on a table the RC uses | **Breaking** | Production holds a different schema. Migration cannot reconcile it. |
| Type changes on existing columns | **Breaking** | Same. |

---

## Phase 4 — Release Candidate readiness

**Can the RC run against the existing production database without schema
modification?** Only if production already holds all 116 tables. Otherwise the
RC fails on first query — it reads 115 tables unconditionally.

Which outcome applies depends entirely on the state of the production database,
so I tested the three states it can be in. All three were run against a real
PostgreSQL 16.14 in a local sandbox.

### Scenario 1 — empty database

```
$ npx prisma migrate deploy
All migrations have been successfully applied.

tables: 116        applied migrations: 30
```

Zero drift against the datamodel: `migrate diff` against `schema.prisma`
reported **"No difference detected"**.

**Classification: READY WITH MIGRATIONS.**

### Scenario 2 — partially migrated, Prisma-managed

Constructed by holding back the last 10 migrations, deploying, then restoring
them and deploying again — the exact shape of "production is running an older
release".

```
after first 20 migrations:   98 tables
after remaining 10:         116 tables, 30 applied
```

Two independent verifications that this is not merely close but identical:

- `migrate diff` against the datamodel → **"No difference detected"**
- `migrate diff` between the incrementally-built database and the
  all-at-once one → **"No difference detected"**

Incremental deployment produces a structurally identical database. If
production is Prisma-managed and behind, the chain simply completes.

**Classification: READY WITH MIGRATIONS.**

### Scenario 3 — populated, not Prisma-managed

Two pre-existing tables, no `_prisma_migrations`:

```
Error: P3005
The database schema is not empty.
```

Nothing executed, nothing modified.

**Classification: NOT READY.** And note carefully that **baselining is not the
remedy here.** `prisma migrate resolve --applied` marks migrations as applied
*without running them*. If production's schema genuinely matches the RC's, that
is correct and sufficient. If it is a different schema — which the tRPC evidence
makes likely — baselining would record 30 migrations as applied against a
database missing 113 tables, and the RC would fail on first query with a schema
Prisma now believes is correct. **That is the one action in this whole
deployment capable of producing an unrecoverable mess, and it is the action the
P3005 error message invites.** Run the diff in step 8 before considering it.

---

## Phase 5 — Rollback compatibility

Two different questions hide inside this one, and they have opposite answers.

### Is the migration chain reversible?

**No.** There are zero down migrations — Prisma does not generate them — and
`20260805200000_v1_schema_drift_repair` contains four `DROP COLUMN` statements
and four timestamp-precision reductions. Once applied, the pre-migration
`schema_versions` columns and sub-millisecond timestamps do not exist to be
restored.

**Rolling the database back requires restoring from a dump.** There is no other
mechanism. This is why the `pg_dump` step is not optional.

### Would the currently deployed application still work after the RC migrations?

**Yes — and for a reason that makes the question nearly moot.**

The application currently running does not use the database in any observable
way. Every route except `/api/health` returns 404, including `/api/auth/login`
and `/api/auth/register` — verified by remote probe. It is a health-check stub.
A stub that issues no queries cannot be broken by an additive schema change.

Even setting that aside, the changes are compatible in the direction that
matters: no table dropped, no column dropped outside `schema_versions`, no
constraint tightened, and the five constraint changes all *relax* nullability.
An older application reading these tables would find every column it knew about
still present.

**The honest framing:** rollback restores a health-check stub in front of a
frontend calling `/api/trpc/auth.me`, which the stub 404s. Nobody has been able
to sign in for roughly six weeks. Rollback is worth having as a known state, but
it does not restore service, because there is no service to restore.

**When a database restore is genuinely required:** only if `migrate deploy`
applies some migrations and you then decide to abandon the deployment. P3005
aborts cleanly before touching anything, so the window is narrower than I
previously described — but it is not zero, and I have not tested what a
mid-chain failure leaves behind. Take the dump.

---

## Phase 6 — Risk assessment

### Reconciliations requested

**External vs. local PostgreSQL.** Previously assumed local, implicitly, by
using `sudo -u postgres psql`. **Disproven as a safe assumption** — nothing
establishes locality. All commands here use `psql "$DATABASE_URL"`. Step 1
settles it. This matters beyond syntax: an external database means backups may
be RDS snapshots rather than `pg_dump`, and network reachability from the EC2
instance becomes its own precondition.

**Prisma migration assumptions.** Previously: a half-migrated schema was a
likely failure mode. **Disproven by test** — P3005 aborts before executing any
DDL. Withdrawn as a blocker.

**Existing production schema.** **UNKNOWN.** The one fact bearing on it is
indirect but strong: the deployed frontend calls `/api/trpc/auth.me`, and tRPC
appears nowhere in this repository, so the database — if the previous generation
used one — likely belongs to a different application. This raises the prior
probability of Scenario 3 considerably. It remains a probability, not a finding.

**Release Candidate schema.** **Fully characterised.** 116 tables, 484 indexes,
53 foreign keys, no extensions, no enums, no functions, no triggers, no views.

**Rollback compatibility.** **Application-compatible, database-irreversible.**
Covered in Phase 5.

### Genuine blockers

| | Blocker | Status |
|---|---|---|
| 1 | Production database state unobserved | **UNKNOWN** — one command settles it |
| 2 | No verified backup mechanism | **UNKNOWN** — irreversible statements exist, so this is required |

### Withdrawn

| Previously claimed | Why withdrawn |
|---|---|
| Half-migrated schema risk | P3005 aborts before executing anything — tested |
| Migrations unrehearsed against a populated database | Incremental application tested, structurally identical result, zero drift |
| Migrations might destroy production data | 0 `DROP TABLE`, 0 `DELETE`, 0 `TRUNCATE` across all 30 |
| Local PostgreSQL assumed | Replaced with `DATABASE_URL`-based commands |

---

## Phase 7 — Final certification

# NOT READY

Not because a defect was found. Because compatibility is a comparison, one side
of it has not been observed, and one of the three possible states of that side
cannot be resolved by migration at all.

**Evidence for the recommendation:**

- Every Phase 1 field is UNKNOWN. No production database output exists in this
  conversation.
- `_prisma_migrations` state is UNKNOWN, and it is the single field that selects
  between "deploy proceeds" and "deploy refuses".
- Scenario 3 is live: `P3005`, tested, and the RC cannot run.
- The tRPC evidence raises the likelihood that production's schema belongs to a
  different application generation.
- Irreversible statements exist (`DROP COLUMN` ×4, timestamp precision ×4) with
  no down migrations, and no backup mechanism has been verified.

**What converts this to READY WITH MIGRATIONS:** steps 1–8 below, with the
diff at step 8 returning either "No difference detected" or additions only, and
a verified dump in hand. If step 8 shows removals or type changes on tables the
RC uses, the recommendation stays NOT READY and the question becomes which
database the RC should point at — a question this program is not scoped to
answer.

**Limitations, each with its evidence:**

| Limitation | Evidence |
|---|---|
| Production schema unobserved | No output provided |
| Migration chain untested against *this* production database | Only empty and synthetic-partial states tested |
| Chain is irreversible | 0 down migrations; `DROP COLUMN` at `…drift_repair:82-85` |
| Backup capability unverified | Not observed; may be RDS snapshots rather than `pg_dump` |
| Timestamp precision loss is silent | `SET DATA TYPE TIMESTAMP(3)` at lines 50, 52, 53, 55 — no error, no warning |

---

## Read-only commands, in execution order

None of these modify the database. There is no `CREATE`, no `ALTER`, no
`INSERT`, no `migrate deploy`, and no `migrate resolve`. `pg_dump` reads only.

Run them as the user PM2 runs as, from `/var/www/courtaccess`, so `.env` is in
reach.

### 1 · Determine whether the database is local or external

```bash
set -a; . /var/www/courtaccess/.env; set +a
echo "$DATABASE_URL" | sed -E 's#(//[^:]+):[^@]*@#\1:***@#'
```

**Why:** every subsequent command depends on it, and it decides whether backups
are `pg_dump` or RDS snapshots. **Expected:** a URL with the password masked.
**Blocks if:** `DATABASE_URL` is empty — the RC cannot start.

### 2 · Confirm the database is reachable

```bash
psql "$DATABASE_URL" -tAc "select 1;"
```

**Why:** `DATABASE_URL` being set proves nothing about reachability.
**Expected:** `1`. **Blocks if:** timeout or authentication failure.

### 3 · Phase 1 discovery, in one query

```bash
psql "$DATABASE_URL" -c "
select version() as server_version,
       current_database()      as database_name,
       current_schema()        as current_schema,
       current_setting('search_path') as search_path,
       current_user            as connected_as,
       pg_encoding_to_char(encoding) as encoding,
       datcollate, datctype,
       pg_size_pretty(pg_database_size(current_database())) as size,
       pg_get_userbyid(datdba) as owner
from pg_database where datname = current_database();"
```

**Why:** answers every Phase 1 field at once. **Expected:** PostgreSQL 14+,
`UTF8`, schema `public`. **Blocks if:** below 14, or encoding is not UTF8.

### 4 · Connection count

```bash
psql "$DATABASE_URL" -c "select state, count(*) from pg_stat_activity where datname = current_database() group by state;"
```

**Why:** shows whether anything else is using this database — another
application on the same database changes the risk picture entirely.
**Expected:** a small number, mostly `idle`.

### 5 · Is it Prisma-managed? — **the decisive question**

```bash
psql "$DATABASE_URL" -tAc "select to_regclass('public._prisma_migrations') is not null as prisma_managed;"
psql "$DATABASE_URL" -tAc "select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE';"
```

**Why:** these two values select the scenario, and the scenario is the answer.

| `prisma_managed` | tables | Scenario | Meaning |
|---|---|---|---|
| `f` | `0` | 1 | Empty. Chain applies cleanly. **READY WITH MIGRATIONS** |
| `t` | any | 2 | Prisma-managed. Chain completes. **READY WITH MIGRATIONS** |
| `f` | `> 0` | 3 | Foreign schema. `P3005`. **NOT READY** |

**Blocks if:** Scenario 3. Do not baseline. Go to step 8 first.

### 6 · Migration state, if Prisma-managed

```bash
psql "$DATABASE_URL" -c "
select migration_name, started_at, finished_at, rolled_back_at, applied_steps_count
from _prisma_migrations order by started_at;"
psql "$DATABASE_URL" -tAc "select count(*) filter (where finished_at is not null) as applied,
                                  count(*) filter (where finished_at is null) as unfinished,
                                  count(*) filter (where rolled_back_at is not null) as rolled_back
                           from _prisma_migrations;"
```

**Why:** identifies applied, pending and failed migrations, and the latest.
**Expected:** applied between 1 and 30, unfinished `0`, rolled back `0`. If
applied is 30, no migration is required at all. **Blocks if:** unfinished or
rolled back is non-zero — a previous migration was interrupted and must be
resolved before any deploy.

### 7 · Table inventory

```bash
psql "$DATABASE_URL" -c "\dt public.*" | head -40
psql "$DATABASE_URL" -c "select count(*) from pg_indexes where schemaname='public';"
psql "$DATABASE_URL" -c "select extname from pg_extension;"
```

**Why:** shows at a glance whether the tables look like CourtAccess or like a
different application. **Expected for a matching schema:** 116 tables, ~484
indexes, `plpgsql` only. **Blocks if:** table names bear no resemblance —
that is Scenario 3 confirmed.

### 8 · The full schema difference — read-only

Requires the RC's `prisma/` directory on the host. Stage the release first; it
is inert until PM2 points at it.

```bash
cd "$RELEASE"
npx prisma migrate diff \
  --from-url "$DATABASE_URL" \
  --to-schema-datamodel prisma/schema.prisma
```

For the exact SQL, still without executing it:

```bash
npx prisma migrate diff \
  --from-url "$DATABASE_URL" \
  --to-schema-datamodel prisma/schema.prisma \
  --script > /tmp/schema-gap.sql
wc -l /tmp/schema-gap.sql
```

**Why:** this is the Phase 3 difference report, produced against the real
database. **Verified read-only:** run against the foreign-schema sandbox, the
database still held exactly its original two tables afterwards.

**Expected:** "No difference detected", or `[+] Added` entries only.
**Blocks if:** any `[-] Removed` or type change on a table the RC uses.

### 9 · Backup capability

```bash
pg_dump --version
pg_dump "$DATABASE_URL" --schema-only --no-owner -f /tmp/schema-probe.sql && wc -l /tmp/schema-probe.sql
```

**Why:** the chain is irreversible, so a restorable dump is the only rollback.
`--schema-only` is a read; it writes only to `/tmp`. **Expected:** a file of a
few thousand lines. **Blocks if:** `pg_dump` is unavailable or its major version
is older than the server's — and if the database is RDS, confirm automated
snapshots are enabled and note the latest restore point instead.

### 10 · Record the answer

Paste the output of steps 3, 5, 6 and 8. Those four settle every UNKNOWN in
this document, and the recommendation can move off NOT READY the same day.
