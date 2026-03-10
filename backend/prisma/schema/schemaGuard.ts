// ============================================================================
// Phase 53 — Schema Guard
// Validates that locked tables are not modified without approval.
// Run as part of CI or pre-commit hook.
// ============================================================================

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Tables locked by Phase 53 Schema Freeze
const LOCKED_TABLES = [
  'Agency',
  'PolicyDocument',
  'PolicyTopic',
  'PolicyCoverage',
  'CPRAAgencyRequest',
  'CPRAAnnualUpdate',
] as const;

// Patterns that indicate a locked table is being modified
const MODIFICATION_PATTERNS = LOCKED_TABLES.map((table) => ({
  table,
  // Match lines that modify column definitions inside the model block
  addColumn: new RegExp(`model\\s+${table}\\s*\\{[^}]*?\\n\\+.*?\\w+\\s+\\w+`, 's'),
  removeColumn: new RegExp(`model\\s+${table}\\s*\\{[^}]*?\\n-.*?\\w+\\s+\\w+`, 's'),
  renameModel: new RegExp(`-model\\s+${table}`, 'm'),
}));

export interface SchemaGuardResult {
  passed: boolean;
  violations: Array<{
    table: string;
    description: string;
    severity: 'error' | 'warning';
  }>;
}

/**
 * Check if the current git diff modifies any locked schema tables.
 * Returns violations if locked tables are changed without approval.
 */
export function checkSchemaChanges(mergeBase?: string): SchemaGuardResult {
  const result: SchemaGuardResult = {
    passed: true,
    violations: [],
  };

  try {
    // Get the diff for schema.prisma
    const base = mergeBase ?? 'HEAD~1';
    const diff = execSync(
      `git diff ${base} -- backend/prisma/schema.prisma`,
      { encoding: 'utf-8', cwd: resolve(__dirname, '../../..') }
    );

    if (!diff || diff.trim().length === 0) {
      // No schema changes — all good
      return result;
    }

    // Parse diff for locked table modifications
    const diffLines = diff.split('\n');
    const addedLines = diffLines.filter((l) => l.startsWith('+') && !l.startsWith('+++'));
    const removedLines = diffLines.filter((l) => l.startsWith('-') && !l.startsWith('---'));

    for (const table of LOCKED_TABLES) {
      // Check if any added/removed lines reference the locked model
      const modelPattern = new RegExp(`model\\s+${table}\\b`);
      const fieldPattern = new RegExp(`^[+-]\\s+\\w+\\s+\\w+`);

      // Track if we're inside a locked model block in the diff
      let insideLockedModel = false;
      let braceDepth = 0;

      for (const line of diffLines) {
        // Check if we're entering a locked model
        if (modelPattern.test(line)) {
          insideLockedModel = true;
          braceDepth = 0;
        }

        if (insideLockedModel) {
          // Track brace depth
          for (const char of line) {
            if (char === '{') braceDepth++;
            if (char === '}') braceDepth--;
          }

          // Check for modifications inside the locked model
          if ((line.startsWith('+') || line.startsWith('-')) &&
              !line.startsWith('+++') && !line.startsWith('---')) {
            const trimmed = line.slice(1).trim();
            // Skip empty lines and comments
            if (trimmed.length > 0 && !trimmed.startsWith('//')) {
              result.violations.push({
                table,
                description: `Locked table "${table}" has been modified: ${trimmed}`,
                severity: 'error',
              });
              result.passed = false;
            }
          }

          // Exit model block
          if (braceDepth <= 0 && insideLockedModel && line.includes('}')) {
            insideLockedModel = false;
          }
        }
      }
    }

    // Check for new migration files that affect locked tables
    try {
      const migrationDiff = execSync(
        `git diff ${base} --name-only -- backend/prisma/migrations/`,
        { encoding: 'utf-8', cwd: resolve(__dirname, '../../..') }
      );

      if (migrationDiff.trim().length > 0) {
        const newMigrations = migrationDiff.trim().split('\n').filter(Boolean);
        for (const migration of newMigrations) {
          if (migration.endsWith('.sql')) {
            try {
              const sqlContent = readFileSync(
                resolve(__dirname, '../../..', migration),
                'utf-8'
              );

              for (const table of LOCKED_TABLES) {
                const tableMap: Record<string, string> = {
                  'Agency': 'agencies',
                  'PolicyDocument': 'policy_documents',
                  'PolicyTopic': 'policy_topics',
                  'PolicyCoverage': 'policy_coverage',
                  'CPRAAgencyRequest': 'cpra_agency_requests',
                  'CPRAAnnualUpdate': 'cpra_annual_updates',
                };
                const sqlTable = tableMap[table] ?? table.toLowerCase();

                if (sqlContent.includes(`ALTER TABLE "${sqlTable}"`) ||
                    sqlContent.includes(`DROP TABLE "${sqlTable}"`)) {
                  result.violations.push({
                    table,
                    description: `Migration "${migration}" modifies locked table "${table}" (${sqlTable})`,
                    severity: 'error',
                  });
                  result.passed = false;
                }
              }
            } catch {
              // Migration file might not exist yet in working tree
            }
          }
        }
      }
    } catch {
      // No migration changes
    }
  } catch (error) {
    // Git command failed — likely not in a git repo during testing
    result.violations.push({
      table: 'N/A',
      description: `Schema guard check failed: ${error instanceof Error ? error.message : String(error)}`,
      severity: 'warning',
    });
  }

  return result;
}

/**
 * Run schema guard as CLI.
 */
function main(): void {
  console.log('[Schema Guard] Checking for locked table modifications...');
  console.log(`[Schema Guard] Locked tables: ${LOCKED_TABLES.join(', ')}`);

  const mergeBase = process.argv[2] ?? 'HEAD~1';
  const result = checkSchemaChanges(mergeBase);

  if (result.passed) {
    console.log('[Schema Guard] ✓ No locked tables modified. Schema check passed.');
  } else {
    console.error('[Schema Guard] ✗ Schema violations detected:');
    for (const violation of result.violations) {
      console.error(`  [${violation.severity.toUpperCase()}] ${violation.description}`);
    }
    console.error('');
    console.error('[Schema Guard] To proceed, add the "schema-change-approved" label to your PR.');
    process.exit(1);
  }
}

// Run if executed directly
const isMainModule = process.argv[1]?.includes('schemaGuard');
if (isMainModule) {
  main();
}
