// Verifies the boot-time schema assertion detects column-level drift.
// Runs the assertion against the repaired database, then drops a column that
// application code depends on and re-runs it.

import { assertSchemaIntegrity } from '../../../backend/src/database/schemaAssert.js';
import { prisma } from '../../../backend/src/lib/prisma.js';

const clean = await assertSchemaIntegrity();
console.log('repaired database  -> ok=%s  missingColumns=%d', clean.ok, clean.missingColumns.length);
if (!clean.ok) console.log('  errors:', clean.errors);

await prisma.$executeRawUnsafe('ALTER TABLE "users" DROP COLUMN "termsAcceptedAt"');
const drifted = await assertSchemaIntegrity();
console.log('after dropping users.termsAcceptedAt -> ok=%s  missingColumns=%d', drifted.ok, drifted.missingColumns.length);
console.log('  detected:', drifted.missingColumns.slice(0, 5));

await prisma.$executeRawUnsafe('ALTER TABLE "users" ADD COLUMN "termsAcceptedAt" TIMESTAMP(3)');
const restored = await assertSchemaIntegrity();
console.log('after restoring    -> ok=%s  missingColumns=%d', restored.ok, restored.missingColumns.length);

const verdict =
  clean.ok && !drifted.ok && drifted.missingColumns.includes('users.termsAcceptedAt') && restored.ok;
console.log(verdict ? 'RESULT: PASS — drift detection works' : 'RESULT: FAIL — drift not detected');
await prisma.$disconnect();
process.exit(verdict ? 0 : 1);
