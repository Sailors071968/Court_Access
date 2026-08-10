// ============================================================================
// The engine registry.
//
// Every engine that can run on the platform, in one place. The registry exists so
// that adding an engine is a registration rather than an edit to the ingestion
// pipeline: reprocessing, dry runs, and the administrative surface all enumerate
// engines from here, so none of them need to know which engines exist.
//
// The names are stable identifiers stored on every intelligence item. Renaming one
// would orphan the findings it produced, so a name is fixed once it has written
// anything.
// ============================================================================

import type { IntelligenceEngine } from './types.js';

const engines = new Map<string, IntelligenceEngine>();

/**
 * Make an engine available to the platform.
 *
 * Rejects a duplicate name outright. Two engines under one name would make every
 * item that name produced ambiguous about which code drew the conclusion, and
 * that is unrecoverable after the fact.
 */
export function registerEngine(engine: IntelligenceEngine): void {
  const existing = engines.get(engine.name);
  if (existing && existing !== engine) {
    throw new Error(
      `Two engines registered as "${engine.name}". An engine name is stored on every item it produces, so it must identify exactly one implementation.`,
    );
  }
  engines.set(engine.name, engine);
}

export function getEngine(name: string): IntelligenceEngine | undefined {
  return engines.get(name);
}

/** Deterministic order, so an enumeration is stable across processes. */
export function listEngines(): IntelligenceEngine[] {
  return [...engines.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** What the administrative surface shows: which engines exist and what they do. */
export function describeEngines() {
  return listEngines().map((e) => ({
    name: e.name,
    version: e.version,
    produces: e.produces,
    description: e.description,
  }));
}

/** Test isolation only. */
export function clearRegistry(): void {
  engines.clear();
}
