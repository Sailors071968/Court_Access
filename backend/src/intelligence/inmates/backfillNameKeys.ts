#!/usr/bin/env node
// ============================================================================
// Backfill the derived blocking keys.
//
// `phoneticLast` and `collapsedLast` are computed at write time, so rows created
// before migration 34 have none — and a null key matches nothing, which means
// those people are invisible to phonetic and collapsed candidate generation. A
// missed match is silent, so the backfill is not optional.
//
// It is also required after any change to nameKeys.ts, which is what
// NAME_KEY_VERSION is for: rows whose stored version differs from the current one
// were keyed by different rules and must be recomputed.
//
//   node --env-file=.env --import tsx src/intelligence/inmates/backfillNameKeys.ts
//   node … backfillNameKeys.ts --check     # report only, write nothing
//
// Idempotent, batched, and safe to run against a live database: it updates only
// the three derived columns and never touches a canonical name.
// ============================================================================

import prisma from '../../lib/prisma.js';
import { deriveNameKeys, NAME_KEY_VERSION } from './nameKeys.js';

const BATCH = 1000;

interface Progress { scanned: number; updated: number; alreadyCurrent: number }

async function backfillInmates(check: boolean): Promise<Progress> {
  const progress: Progress = { scanned: 0, updated: 0, alreadyCurrent: 0 };
  let cursor: string | undefined;

  for (;;) {
    const rows = await prisma.inmate.findMany({
      where: { OR: [{ nameKeyVersion: null }, { nameKeyVersion: { not: NAME_KEY_VERSION } }] },
      select: { inmateId: true, canonicalLast: true, phoneticLast: true, collapsedLast: true },
      orderBy: { inmateId: 'asc' },
      take: BATCH,
      ...(cursor ? { cursor: { inmateId: cursor }, skip: 1 } : {}),
    });
    if (rows.length === 0) break;

    for (const row of rows) {
      progress.scanned++;
      const keys = deriveNameKeys(row.canonicalLast);
      if (row.phoneticLast === keys.phonetic && row.collapsedLast === keys.collapsed) {
        progress.alreadyCurrent++;
        // Still stamp the version, so the row is not rescanned next time.
        if (!check) {
          await prisma.inmate.update({
            where: { inmateId: row.inmateId },
            data: { nameKeyVersion: NAME_KEY_VERSION },
          });
        }
        continue;
      }
      if (!check) {
        await prisma.inmate.update({
          where: { inmateId: row.inmateId },
          data: {
            phoneticLast: keys.phonetic,
            collapsedLast: keys.collapsed,
            nameKeyVersion: NAME_KEY_VERSION,
          },
        });
      }
      progress.updated++;
    }

    cursor = rows[rows.length - 1].inmateId;
    if (check) break;   // one page is enough to report the scale
  }

  return progress;
}

async function backfillAliases(check: boolean): Promise<Progress> {
  const progress: Progress = { scanned: 0, updated: 0, alreadyCurrent: 0 };
  let cursor: string | undefined;

  for (;;) {
    const rows = await prisma.inmateAlias.findMany({
      where: { OR: [{ nameKeyVersion: null }, { nameKeyVersion: { not: NAME_KEY_VERSION } }] },
      select: { aliasId: true, last: true, phoneticLast: true, collapsedLast: true },
      orderBy: { aliasId: 'asc' },
      take: BATCH,
      ...(cursor ? { cursor: { aliasId: cursor }, skip: 1 } : {}),
    });
    if (rows.length === 0) break;

    for (const row of rows) {
      progress.scanned++;
      const keys = deriveNameKeys(row.last);
      const current = row.phoneticLast === keys.phonetic && row.collapsedLast === keys.collapsed;
      if (current) progress.alreadyCurrent++; else progress.updated++;
      if (!check) {
        await prisma.inmateAlias.update({
          where: { aliasId: row.aliasId },
          data: {
            phoneticLast: keys.phonetic,
            collapsedLast: keys.collapsed,
            nameKeyVersion: NAME_KEY_VERSION,
          },
        });
      }
    }

    cursor = rows[rows.length - 1].aliasId;
    if (check) break;
  }

  return progress;
}

async function main(): Promise<void> {
  const check = process.argv.includes('--check');

  const [pendingInmates, pendingAliases] = await Promise.all([
    prisma.inmate.count({ where: { OR: [{ nameKeyVersion: null }, { nameKeyVersion: { not: NAME_KEY_VERSION } }] } }),
    prisma.inmateAlias.count({ where: { OR: [{ nameKeyVersion: null }, { nameKeyVersion: { not: NAME_KEY_VERSION } }] } }),
  ]);

  console.log('');
  console.log(`  name key version   ${NAME_KEY_VERSION}`);
  console.log(`  people needing keys ${pendingInmates}`);
  console.log(`  aliases needing keys ${pendingAliases}`);

  if (check) {
    console.log('');
    console.log('  --check: nothing was written.');
    if (pendingInmates > 0 || pendingAliases > 0) {
      console.log('  Those rows are invisible to phonetic and collapsed candidate generation');
      console.log('  until the backfill runs. A missed match is silent.');
    }
    console.log('');
    return;
  }

  const started = Date.now();
  const inmates = await backfillInmates(false);
  const aliases = await backfillAliases(false);

  console.log('');
  console.log(`  people    scanned ${inmates.scanned}, keys written ${inmates.updated}, already current ${inmates.alreadyCurrent}`);
  console.log(`  aliases   scanned ${aliases.scanned}, keys written ${aliases.updated}, already current ${aliases.alreadyCurrent}`);
  console.log(`  duration  ${Date.now() - started} ms`);
  console.log('');
}

main()
  .catch((err: unknown) => {
    console.error(`[backfillNameKeys] ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
