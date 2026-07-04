// ============================================================================
// Discovery manifest persistence and audit logging
// ============================================================================

import { mkdir, readFile, writeFile, appendFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type {
  DiscoveryAuditEntry,
  DiscoveryCheckpoint,
  DiscoveryManifest,
  DiscoveryStats,
  DiscoveredSection,
} from './types.ts';

export const MANIFEST_VERSION = '1.0.0';

export function createEmptyStats(): DiscoveryStats {
  return {
    pagesFetched: 0,
    expandedBranchPages: 0,
    displayTextPages: 0,
    hierarchyNodes: 0,
    sectionsDiscovered: 0,
    sectionsFromRanges: 0,
    sectionsFromLinks: 0,
    anomalies: 0,
  };
}

export function createAuditEntry(action: string, detail?: string, url?: string): DiscoveryAuditEntry {
  return {
    timestamp: new Date().toISOString(),
    action,
    detail,
    url,
  };
}

export function sectionKey(section: DiscoveredSection): string {
  return `${section.code}:${section.section}`;
}

export function mergeSections(
  existing: DiscoveredSection[],
  incoming: DiscoveredSection[],
): DiscoveredSection[] {
  const map = new Map<string, DiscoveredSection>();
  for (const section of existing) {
    map.set(sectionKey(section), section);
  }
  for (const section of incoming) {
    const key = sectionKey(section);
    if (!map.has(key)) {
      map.set(key, section);
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    const aNum = parseFloat(a.section);
    const bNum = parseFloat(b.section);
    if (!Number.isNaN(aNum) && !Number.isNaN(bNum) && aNum !== bNum) {
      return aNum - bNum;
    }
    return a.section.localeCompare(b.section);
  });
}

export async function writeDiscoveryManifest(
  outputPath: string,
  manifest: DiscoveryManifest,
): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(manifest, null, 2), 'utf-8');
}

export async function writeDiscoveryCheckpoint(
  outputPath: string,
  checkpoint: DiscoveryCheckpoint,
): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(checkpoint, null, 2), 'utf-8');
}

export async function readDiscoveryCheckpoint(path: string): Promise<DiscoveryCheckpoint> {
  const raw = await readFile(path, 'utf-8');
  return JSON.parse(raw) as DiscoveryCheckpoint;
}

export function defaultManifestPaths(outputDir: string, code: string): {
  manifest: string;
  checkpoint: string;
  audit: string;
} {
  const base = join(outputDir, code.toUpperCase());
  return {
    manifest: `${base}-discovery-manifest.json`,
    checkpoint: `${base}-discovery-checkpoint.json`,
    audit: `${base}-discovery-audit.jsonl`,
  };
}

export async function appendAuditLog(auditPath: string, entry: DiscoveryAuditEntry): Promise<void> {
  await mkdir(dirname(auditPath), { recursive: true });
  await appendFile(auditPath, `${JSON.stringify(entry)}\n`, 'utf-8');
}

export function finalizeManifest(
  partial: Omit<DiscoveryManifest, 'version' | 'completedAt' | 'status'> & {
    status?: DiscoveryManifest['status'];
  },
): DiscoveryManifest {
  return {
    version: MANIFEST_VERSION,
    completedAt: new Date().toISOString(),
    status: partial.status ?? 'completed',
    code: partial.code,
    codeName: partial.codeName,
    discoveredAt: partial.discoveredAt,
    audit: partial.audit,
    hierarchyNodes: partial.hierarchyNodes,
    sections: partial.sections,
    stats: {
      ...partial.stats,
      sectionsDiscovered: partial.sections.length,
      hierarchyNodes: partial.hierarchyNodes.length,
      anomalies: partial.anomalies.length,
    },
    anomalies: partial.anomalies,
  };
}
