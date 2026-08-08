// ============================================================================
// Which build is this?
//
// A deployed release is not a git checkout, so the commit has to travel with
// it. deploy/build-release.sh writes dist/build-info.json beside the bundle;
// this resolves it, and falls back to git when running from a source tree.
//
// Single source of truth on purpose: the certification record, the startup log
// and the health endpoint must all name the same build, or a finding cannot be
// tied to the code that produced it.
// ============================================================================

import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const exec = promisify(execFile);

export interface BuildInfo {
  commit: string | null;
  branch: string | null;
  builtAt: string | null;
  /** Where the answer came from, so an operator can tell a stamp from a guess. */
  source: 'env' | 'stamp' | 'git' | 'unknown';
}

let cached: BuildInfo | null = null;

async function resolve(): Promise<BuildInfo> {
  if (process.env.GIT_COMMIT) {
    return {
      commit: process.env.GIT_COMMIT.trim(),
      branch: process.env.GIT_BRANCH?.trim() ?? null,
      builtAt: null,
      source: 'env',
    };
  }

  try {
    const stamp = path.join(path.dirname(fileURLToPath(import.meta.url)), 'build-info.json');
    const parsed = JSON.parse(await readFile(stamp, 'utf8')) as Partial<BuildInfo>;
    if (parsed.commit) {
      return {
        commit: String(parsed.commit),
        branch: parsed.branch ? String(parsed.branch) : null,
        builtAt: parsed.builtAt ? String(parsed.builtAt) : null,
        source: 'stamp',
      };
    }
  } catch {
    // Not a stamped release — fall through to asking git.
  }

  try {
    const [commit, branch] = await Promise.all([
      exec('git', ['-C', process.cwd(), 'rev-parse', 'HEAD']).then((r) => r.stdout.trim()),
      exec('git', ['-C', process.cwd(), 'rev-parse', '--abbrev-ref', 'HEAD'])
        .then((r) => r.stdout.trim())
        .catch(() => null),
    ]);
    return { commit, branch, builtAt: null, source: 'git' };
  } catch {
    return { commit: null, branch: null, builtAt: null, source: 'unknown' };
  }
}

/** Resolved once; a running process cannot change the build it is running. */
export async function getBuildInfo(): Promise<BuildInfo> {
  cached ??= await resolve();
  return cached;
}

/** Short form for logs and health responses. */
export function describeBuild(info: BuildInfo): string {
  if (!info.commit) return 'unknown build (no stamp, and not a git checkout)';
  const short = info.commit.slice(0, 7);
  const parts = [short];
  if (info.branch) parts.push(info.branch);
  if (info.builtAt) parts.push(`built ${info.builtAt}`);
  return `${parts.join(' · ')} (from ${info.source})`;
}
