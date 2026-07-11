// ============================================================================
// Phase 61 — Animation interpolation engine + shared animation types.
// Extracted from AnimationTools.tsx so the component module only exports a
// component (keeps React Fast Refresh boundaries clean).
// ============================================================================

export interface AnimationKeyframe {
  id: string;
  markerId: string;
  time: number; // seconds from start
  position: [number, number, number];
  rotation?: number;
  label?: string;
}

export interface AnimationTimeline {
  id: string;
  name: string;
  duration: number; // total seconds
  keyframes: AnimationKeyframe[];
  isPlaying: boolean;
  currentTime: number;
  playbackSpeed: number;
}

/**
 * Interpolate marker positions at a given time based on keyframes.
 * Returns a map of markerId -> interpolated position.
 */
export function interpolatePositions(
  keyframes: AnimationKeyframe[],
  currentTime: number,
): Map<string, [number, number, number]> {
  const result = new Map<string, [number, number, number]>();

  // Group keyframes by markerId
  const grouped = new Map<string, AnimationKeyframe[]>();
  for (const kf of keyframes) {
    const existing = grouped.get(kf.markerId) ?? [];
    existing.push(kf);
    grouped.set(kf.markerId, existing);
  }

  // For each marker, interpolate between keyframes
  for (const [markerId, markerKfs] of grouped) {
    const sorted = [...markerKfs].sort((a, b) => a.time - b.time);

    if (sorted.length === 0) continue;

    // Before first keyframe
    if (currentTime <= sorted[0].time) {
      result.set(markerId, sorted[0].position);
      continue;
    }

    // After last keyframe
    if (currentTime >= sorted[sorted.length - 1].time) {
      result.set(markerId, sorted[sorted.length - 1].position);
      continue;
    }

    // Find surrounding keyframes
    for (let i = 0; i < sorted.length - 1; i++) {
      const prev = sorted[i];
      const next = sorted[i + 1];

      if (currentTime >= prev.time && currentTime <= next.time) {
        const t = (currentTime - prev.time) / (next.time - prev.time);
        // Linear interpolation
        const position: [number, number, number] = [
          prev.position[0] + (next.position[0] - prev.position[0]) * t,
          prev.position[1] + (next.position[1] - prev.position[1]) * t,
          prev.position[2] + (next.position[2] - prev.position[2]) * t,
        ];
        result.set(markerId, position);
        break;
      }
    }
  }

  return result;
}
