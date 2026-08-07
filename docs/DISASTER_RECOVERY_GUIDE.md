# Disaster Recovery Guide

## What must survive

In order of how hard each is to reconstruct:

1. **PostgreSQL.** Everything. Cases, charges, charging documents, the audit
   trail, cached statutes with their fingerprints, and the case snapshots that
   make an old analysis reproducible. Lose this and you lose the ability to say
   what a case was analysed against.
2. **Evidence files.** The discovery itself. Every file is fingerprinted with
   SHA-256 on upload, so after a restore you can prove the files are the files
   that were analysed. Verify the hashes; do not assume.
3. **Redis.** Queues only. Losing it loses in-flight processing, which can be
   re-run. Do not back it up at the expense of the other two.

The statutory cache is recoverable: it is retrieved from
leginfo.legislature.ca.gov and will refill on demand. **But** the pinned
versions in `case_statute_snapshots` are not recoverable, because the law may
have changed since. Those live in PostgreSQL and are part of why point 1 is
first.

## Restoring

```bash
pg_restore --clean --if-exists -d "$DATABASE_URL" backup.dump
cd backend && npx prisma migrate deploy
```

`migrate deploy` after a restore is not optional — the backup may predate a
migration.

Then verify no drift:

```bash
npx prisma migrate diff --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma --script
```

An empty migration means the restored database matches the code. Anything else
means the restore and the deployment disagree, and you should stop.

## Verifying evidence after a restore

Every evidence row carries `sha256`. Re-hash the restored files and compare. A
mismatch means the file is not the one that was analysed, and any finding
citing it is no longer supported — that is a disclosure problem, not just an
IT one.

## Verifying the platform

```bash
bash scripts/certification/run-all.sh
```

Then check **Admin → Production Readiness**. The gate reads the suite results,
so a restore that broke something will show there rather than being discovered
by a user.

## Interrupted uploads

Upload staging directories survive a restart. A partially received corpus can
be resumed by reselecting the same folder — the server reports how much of each
file it holds. Staging directories for cancelled sessions are removed; those
for interrupted ones are not, so check `CERTIFICATION_STAGING_DIR` for orphans
after an incident.

## What has not been rehearsed

No disaster recovery drill has been performed against production
infrastructure. The procedures above follow from how the system is built and
have been reasoned through, not executed end to end on a real failure. Rehearse
them before you need them.
