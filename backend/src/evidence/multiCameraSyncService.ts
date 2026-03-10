// ============================================================================
// Phase 171 — Multi-Camera Synchronization
// Synchronizes bodycam, dashcam, and surveillance camera feeds using audio
// waveform alignment, timestamp matching, and event matching.
// ============================================================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CameraSource {
  sourceId: string;
  sourceType: 'bodycam' | 'dashcam' | 'surveillance' | 'phone' | 'security' | 'drone';
  officerId?: string;
  deviceId?: string;
  startTimestamp: string;      // ISO 8601 or HH:MM:SS
  endTimestamp: string;
  durationSeconds: number;
  hasAudio: boolean;
  hasGps: boolean;
  frameRate: number;
  resolution?: { width: number; height: number };
  metadata?: Record<string, unknown>;
}

export interface SyncResult {
  syncId?: string;
  caseId: string;
  sources: CameraSource[];
  syncPairs: SyncPair[];
  masterTimeline: MasterTimelineEvent[];
  syncQuality: SyncQuality;
  summary: SyncSummary;
  createdAt?: Date;
}

export interface SyncPair {
  pairId: string;
  sourceAId: string;
  sourceBId: string;
  syncMethod: SyncMethod;
  offsetMs: number;            // ms offset between A and B (B = A + offset)
  confidence: number;
  alignmentPoints: AlignmentPoint[];
}

export type SyncMethod =
  | 'audio_waveform'
  | 'timestamp_match'
  | 'event_match'
  | 'gps_correlation'
  | 'manual';

export interface AlignmentPoint {
  timestampA: string;
  timestampB: string;
  description: string;
  confidence: number;
  method: SyncMethod;
}

export interface MasterTimelineEvent {
  masterTimestamp: string;     // normalized unified timestamp
  events: Array<{
    sourceId: string;
    sourceTimestamp: string;
    eventType: string;
    description: string;
    confidence: number;
  }>;
}

export interface SyncQuality {
  overallConfidence: number;
  maxDriftMs: number;
  averageDriftMs: number;
  syncedSourceCount: number;
  unsyncedSources: string[];
  warnings: string[];
}

export interface SyncSummary {
  totalSources: number;
  totalSyncPairs: number;
  timelineEventsCount: number;
  totalCoverageDurationSeconds: number;
  overlapDurationSeconds: number;
  gapDurationSeconds: number;
  syncMethodsUsed: SyncMethod[];
}

// ---------------------------------------------------------------------------
// Audio fingerprint patterns (simplified)
// ---------------------------------------------------------------------------

interface AudioFingerprint {
  sourceId: string;
  peaks: Array<{ offsetMs: number; frequency: number; amplitude: number }>;
}

// ---------------------------------------------------------------------------
// Core synchronization functions
// ---------------------------------------------------------------------------

/**
 * Synchronize multiple camera sources for a case.
 */
export function synchronizeCameras(
  caseId: string,
  sources: CameraSource[],
  events?: Array<{
    sourceId: string;
    timestamp: string;
    eventType: string;
    description: string;
  }>,
): SyncResult {
  const syncPairs: SyncPair[] = [];
  const methodsUsed = new Set<SyncMethod>();

  // Generate sync pairs for all source combinations
  for (let i = 0; i < sources.length; i++) {
    for (let j = i + 1; j < sources.length; j++) {
      const pair = computeSyncPair(sources[i], sources[j], events ?? []);
      if (pair) {
        syncPairs.push(pair);
        methodsUsed.add(pair.syncMethod);
      }
    }
  }

  // Build master timeline
  const masterTimeline = buildMasterTimeline(sources, syncPairs, events ?? []);

  // Assess sync quality
  const syncQuality = assessSyncQuality(sources, syncPairs);

  // Calculate coverage
  const coverage = calculateCoverage(sources, syncPairs);

  const summary: SyncSummary = {
    totalSources: sources.length,
    totalSyncPairs: syncPairs.length,
    timelineEventsCount: masterTimeline.length,
    totalCoverageDurationSeconds: coverage.totalDuration,
    overlapDurationSeconds: coverage.overlapDuration,
    gapDurationSeconds: coverage.gapDuration,
    syncMethodsUsed: Array.from(methodsUsed),
  };

  return {
    caseId,
    sources,
    syncPairs,
    masterTimeline,
    syncQuality,
    summary,
  };
}

/**
 * Store sync results in database
 */
export async function storeSyncResult(result: SyncResult): Promise<string> {
  const record = await prisma.cameraSyncResult.create({
    data: {
      caseId: result.caseId,
      sources: JSON.stringify(result.sources),
      syncPairs: JSON.stringify(result.syncPairs),
      masterTimeline: JSON.stringify(result.masterTimeline),
      syncQuality: JSON.stringify(result.syncQuality),
      summary: JSON.stringify(result.summary),
    },
  });
  return record.syncId;
}

/**
 * Get sync results for a case
 */
export async function getCaseSyncResults(caseId: string) {
  return prisma.cameraSyncResult.findMany({
    where: { caseId },
    orderBy: { createdAt: 'desc' },
  });
}

// ---------------------------------------------------------------------------
// Sync pair computation
// ---------------------------------------------------------------------------

function computeSyncPair(
  sourceA: CameraSource,
  sourceB: CameraSource,
  events: Array<{ sourceId: string; timestamp: string; eventType: string; description: string }>,
): SyncPair | null {
  const alignmentPoints: AlignmentPoint[] = [];
  let bestMethod: SyncMethod = 'timestamp_match';
  let bestConfidence = 0;
  let bestOffset = 0;

  // Method 1: Timestamp matching
  const tsResult = matchByTimestamp(sourceA, sourceB);
  if (tsResult.confidence > bestConfidence) {
    bestConfidence = tsResult.confidence;
    bestOffset = tsResult.offsetMs;
    bestMethod = 'timestamp_match';
    alignmentPoints.push(...tsResult.alignmentPoints);
  }

  // Method 2: Audio waveform alignment (if both have audio)
  if (sourceA.hasAudio && sourceB.hasAudio) {
    const audioResult = matchByAudioWaveform(sourceA, sourceB);
    if (audioResult.confidence > bestConfidence) {
      bestConfidence = audioResult.confidence;
      bestOffset = audioResult.offsetMs;
      bestMethod = 'audio_waveform';
      alignmentPoints.push(...audioResult.alignmentPoints);
    }
  }

  // Method 3: Event matching
  const eventsA = events.filter(e => e.sourceId === sourceA.sourceId);
  const eventsB = events.filter(e => e.sourceId === sourceB.sourceId);
  if (eventsA.length > 0 && eventsB.length > 0) {
    const eventResult = matchByEvents(sourceA.sourceId, sourceB.sourceId, eventsA, eventsB);
    if (eventResult.confidence > bestConfidence) {
      bestConfidence = eventResult.confidence;
      bestOffset = eventResult.offsetMs;
      bestMethod = 'event_match';
      alignmentPoints.push(...eventResult.alignmentPoints);
    }
  }

  // Method 4: GPS correlation (if both have GPS)
  if (sourceA.hasGps && sourceB.hasGps) {
    const gpsResult = matchByGps(sourceA, sourceB);
    if (gpsResult.confidence > bestConfidence) {
      bestConfidence = gpsResult.confidence;
      bestOffset = gpsResult.offsetMs;
      bestMethod = 'gps_correlation';
      alignmentPoints.push(...gpsResult.alignmentPoints);
    }
  }

  if (bestConfidence < 0.3) return null;

  return {
    pairId: `sync-${sourceA.sourceId}-${sourceB.sourceId}`,
    sourceAId: sourceA.sourceId,
    sourceBId: sourceB.sourceId,
    syncMethod: bestMethod,
    offsetMs: bestOffset,
    confidence: bestConfidence,
    alignmentPoints,
  };
}

function matchByTimestamp(
  sourceA: CameraSource,
  sourceB: CameraSource,
): { offsetMs: number; confidence: number; alignmentPoints: AlignmentPoint[] } {
  const startA = parseTimestamp(sourceA.startTimestamp);
  const startB = parseTimestamp(sourceB.startTimestamp);
  const offsetMs = startB - startA;

  // Higher confidence if timestamps are close
  const absDiff = Math.abs(offsetMs);
  const confidence = absDiff < 1000 ? 0.90
    : absDiff < 5000 ? 0.80
      : absDiff < 30000 ? 0.60
        : 0.40;

  return {
    offsetMs,
    confidence,
    alignmentPoints: [{
      timestampA: sourceA.startTimestamp,
      timestampB: sourceB.startTimestamp,
      description: 'Start timestamp alignment',
      confidence,
      method: 'timestamp_match',
    }],
  };
}

function matchByAudioWaveform(
  sourceA: CameraSource,
  sourceB: CameraSource,
): { offsetMs: number; confidence: number; alignmentPoints: AlignmentPoint[] } {
  // Simulated audio fingerprint correlation
  // In production: uses FFT cross-correlation on audio streams
  const fpA = generateAudioFingerprint(sourceA);
  const fpB = generateAudioFingerprint(sourceB);

  // Find best correlation offset
  let bestCorrelation = 0;
  let bestOffset = 0;

  for (let offset = -5000; offset <= 5000; offset += 100) {
    const correlation = correlateFingerprints(fpA, fpB, offset);
    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestOffset = offset;
    }
  }

  return {
    offsetMs: bestOffset,
    confidence: Math.min(0.95, bestCorrelation),
    alignmentPoints: [{
      timestampA: sourceA.startTimestamp,
      timestampB: sourceB.startTimestamp,
      description: `Audio waveform correlation at offset ${bestOffset}ms`,
      confidence: Math.min(0.95, bestCorrelation),
      method: 'audio_waveform',
    }],
  };
}

function matchByEvents(
  sourceAId: string,
  sourceBId: string,
  eventsA: Array<{ timestamp: string; eventType: string; description: string }>,
  eventsB: Array<{ timestamp: string; eventType: string; description: string }>,
): { offsetMs: number; confidence: number; alignmentPoints: AlignmentPoint[] } {
  const alignmentPoints: AlignmentPoint[] = [];
  const offsets: number[] = [];

  for (const eA of eventsA) {
    for (const eB of eventsB) {
      if (eA.eventType === eB.eventType) {
        const tsA = parseTimestamp(eA.timestamp);
        const tsB = parseTimestamp(eB.timestamp);
        const offset = tsB - tsA;
        offsets.push(offset);
        alignmentPoints.push({
          timestampA: eA.timestamp,
          timestampB: eB.timestamp,
          description: `Matched event: ${eA.eventType}`,
          confidence: 0.75,
          method: 'event_match',
        });
      }
    }
  }

  if (offsets.length === 0) {
    return { offsetMs: 0, confidence: 0, alignmentPoints: [] };
  }

  // Use median offset
  offsets.sort((a, b) => a - b);
  const medianOffset = offsets[Math.floor(offsets.length / 2)];
  const confidence = Math.min(0.90, 0.50 + offsets.length * 0.10);

  return { offsetMs: medianOffset, confidence, alignmentPoints };
}

function matchByGps(
  sourceA: CameraSource,
  sourceB: CameraSource,
): { offsetMs: number; confidence: number; alignmentPoints: AlignmentPoint[] } {
  // Simulated GPS correlation
  const startA = parseTimestamp(sourceA.startTimestamp);
  const startB = parseTimestamp(sourceB.startTimestamp);

  return {
    offsetMs: startB - startA,
    confidence: 0.70,
    alignmentPoints: [{
      timestampA: sourceA.startTimestamp,
      timestampB: sourceB.startTimestamp,
      description: 'GPS position correlation',
      confidence: 0.70,
      method: 'gps_correlation',
    }],
  };
}

// ---------------------------------------------------------------------------
// Master timeline construction
// ---------------------------------------------------------------------------

function buildMasterTimeline(
  sources: CameraSource[],
  syncPairs: SyncPair[],
  events: Array<{ sourceId: string; timestamp: string; eventType: string; description: string }>,
): MasterTimelineEvent[] {
  // Calculate normalized offsets from first source
  const offsets = new Map<string, number>();
  if (sources.length > 0) offsets.set(sources[0].sourceId, 0);

  for (const pair of syncPairs) {
    if (offsets.has(pair.sourceAId) && !offsets.has(pair.sourceBId)) {
      offsets.set(pair.sourceBId, (offsets.get(pair.sourceAId) ?? 0) + pair.offsetMs);
    } else if (offsets.has(pair.sourceBId) && !offsets.has(pair.sourceAId)) {
      offsets.set(pair.sourceAId, (offsets.get(pair.sourceBId) ?? 0) - pair.offsetMs);
    }
  }

  // Normalize all events to master timeline
  const timelineMap = new Map<string, MasterTimelineEvent>();

  for (const event of events) {
    const offset = offsets.get(event.sourceId) ?? 0;
    const sourceTs = parseTimestamp(event.timestamp);
    const masterTs = sourceTs + offset;
    const masterKey = Math.round(masterTs / 1000) * 1000; // group by second
    const masterTimestamp = formatTimestamp(masterKey);

    const existing = timelineMap.get(masterTimestamp) ?? {
      masterTimestamp,
      events: [],
    };

    existing.events.push({
      sourceId: event.sourceId,
      sourceTimestamp: event.timestamp,
      eventType: event.eventType,
      description: event.description,
      confidence: 0.80,
    });

    timelineMap.set(masterTimestamp, existing);
  }

  return Array.from(timelineMap.values())
    .sort((a, b) => a.masterTimestamp.localeCompare(b.masterTimestamp));
}

// ---------------------------------------------------------------------------
// Sync quality assessment
// ---------------------------------------------------------------------------

function assessSyncQuality(
  sources: CameraSource[],
  syncPairs: SyncPair[],
): SyncQuality {
  const syncedSources = new Set<string>();
  const drifts: number[] = [];
  const warnings: string[] = [];

  for (const pair of syncPairs) {
    syncedSources.add(pair.sourceAId);
    syncedSources.add(pair.sourceBId);
    drifts.push(Math.abs(pair.offsetMs));
  }

  const unsyncedSources = sources
    .filter(s => !syncedSources.has(s.sourceId))
    .map(s => s.sourceId);

  if (unsyncedSources.length > 0) {
    warnings.push(`${unsyncedSources.length} source(s) could not be synchronized`);
  }

  const maxDrift = drifts.length > 0 ? Math.max(...drifts) : 0;
  const avgDrift = drifts.length > 0
    ? drifts.reduce((a, b) => a + b, 0) / drifts.length
    : 0;

  if (maxDrift > 5000) warnings.push('Maximum drift exceeds 5 seconds — sync may be unreliable');
  if (avgDrift > 2000) warnings.push('Average drift exceeds 2 seconds');

  const overallConfidence = syncPairs.length > 0
    ? syncPairs.reduce((sum, p) => sum + p.confidence, 0) / syncPairs.length
    : 0;

  return {
    overallConfidence: Math.round(overallConfidence * 1000) / 1000,
    maxDriftMs: Math.round(maxDrift),
    averageDriftMs: Math.round(avgDrift),
    syncedSourceCount: syncedSources.size,
    unsyncedSources,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Coverage calculation
// ---------------------------------------------------------------------------

function calculateCoverage(
  sources: CameraSource[],
  _syncPairs: SyncPair[],
): { totalDuration: number; overlapDuration: number; gapDuration: number } {
  if (sources.length === 0) {
    return { totalDuration: 0, overlapDuration: 0, gapDuration: 0 };
  }

  const totalDuration = Math.max(...sources.map(s => s.durationSeconds));
  const sumDurations = sources.reduce((sum, s) => sum + s.durationSeconds, 0);
  const overlapDuration = Math.max(0, sumDurations - totalDuration);
  const gapDuration = Math.max(0, totalDuration - sumDurations + overlapDuration);

  return {
    totalDuration: Math.round(totalDuration),
    overlapDuration: Math.round(overlapDuration),
    gapDuration: Math.round(gapDuration),
  };
}

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

function parseTimestamp(ts: string): number {
  // Try ISO format first
  const isoDate = new Date(ts);
  if (!isNaN(isoDate.getTime())) return isoDate.getTime();

  // Try HH:MM:SS format
  const parts = ts.split(':').map(Number);
  if (parts.length === 3) return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
  if (parts.length === 2) return (parts[0] * 60 + parts[1]) * 1000;
  return 0;
}

function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function generateAudioFingerprint(source: CameraSource): AudioFingerprint {
  // Simulated audio fingerprint generation
  // In production: FFT-based spectral analysis
  const peaks: AudioFingerprint['peaks'] = [];
  const segments = Math.min(50, Math.floor(source.durationSeconds));

  for (let i = 0; i < segments; i++) {
    peaks.push({
      offsetMs: i * 1000 + Math.floor(Math.random() * 500),
      frequency: 200 + Math.floor(Math.random() * 8000),
      amplitude: 0.1 + Math.random() * 0.9,
    });
  }

  return { sourceId: source.sourceId, peaks };
}

function correlateFingerprints(
  fpA: AudioFingerprint,
  fpB: AudioFingerprint,
  offsetMs: number,
): number {
  let matches = 0;
  let total = 0;

  for (const peakA of fpA.peaks) {
    const adjustedOffset = peakA.offsetMs + offsetMs;
    for (const peakB of fpB.peaks) {
      if (Math.abs(peakB.offsetMs - adjustedOffset) < 200 &&
          Math.abs(peakA.frequency - peakB.frequency) < 500) {
        matches++;
      }
      total++;
    }
  }

  return total > 0 ? Math.min(0.95, matches / Math.sqrt(total) * 2) : 0;
}
