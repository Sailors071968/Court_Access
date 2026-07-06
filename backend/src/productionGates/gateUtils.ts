// ============================================================================
// Production gate utilities — file/module existence checks
// ============================================================================

import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const WORKSPACE_ROOT = resolve(import.meta.dirname ?? '.', '../../..');

export async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export function workspacePath(...segments: string[]): string {
  return resolve(WORKSPACE_ROOT, ...segments);
}

export async function readJsonReport<T>(relativePath: string): Promise<T | null> {
  const path = workspacePath(relativePath);
  if (!(await fileExists(path))) return null;
  const raw = await readFile(path, 'utf-8');
  return JSON.parse(raw) as T;
}

export function resultFromChecks(
  checks: Array<{ label: string; pass: boolean }>,
): { result: 'PASS' | 'FAIL' | 'PARTIAL'; pass: number; total: number; failed: string[] } {
  const pass = checks.filter((c) => c.pass).length;
  const total = checks.length;
  const failed = checks.filter((c) => !c.pass).map((c) => c.label);
  if (pass === total) return { result: 'PASS', pass, total, failed };
  if (pass === 0) return { result: 'FAIL', pass, total, failed };
  return { result: 'PARTIAL', pass, total, failed };
}
