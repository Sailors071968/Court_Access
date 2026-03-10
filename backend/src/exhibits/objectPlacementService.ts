// ============================================================================
// Phase 58 — Object Placement Service
// Procedurally places trees, cars, pedestrians, and streetlights in a scene
// based on road/sidewalk geometry. Placement is random but realistic.
// ============================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlacedObject {
  id: string;
  type: 'tree' | 'bush' | 'car' | 'policeVehicle' | 'person' | 'streetlight' | 'stopSign' | 'fireHydrant';
  position: [number, number, number];
  rotation: number;
  scale: number;
  variant?: string;
  color?: number;
}

export interface PlacementConfig {
  showTrees: boolean;
  showBushes: boolean;
  showVehicles: boolean;
  showPedestrians: boolean;
  showStreetlights: boolean;
  vehicleDensity: 'low' | 'medium' | 'high';
  seed?: number;
}

interface RoadData {
  coordinates: Array<[number, number]>;
  width: number;
  roadType: string;
  name?: string;
}

interface SidewalkData {
  coordinates: Array<[number, number]>;
  width: number;
}

// ---------------------------------------------------------------------------
// Seeded Random Number Generator
// ---------------------------------------------------------------------------

class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 1664525 + 1013904223) & 0xffffffff;
    return (this.seed >>> 0) / 0xffffffff;
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  return `obj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Get direction angle between two consecutive road points.
 */
function getSegmentAngle(p1: [number, number], p2: [number, number]): number {
  return Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
}

/**
 * Get perpendicular offset point from a road segment.
 */
function getOffsetPoint(
  point: [number, number],
  angle: number,
  offset: number,
  side: 'left' | 'right',
): [number, number] {
  const perpAngle = side === 'left' ? angle + Math.PI / 2 : angle - Math.PI / 2;
  return [
    point[0] + Math.cos(perpAngle) * offset,
    point[1] + Math.sin(perpAngle) * offset,
  ];
}

/**
 * Check minimum distance from existing placed objects.
 */
function isFarEnough(
  x: number,
  z: number,
  existing: PlacedObject[],
  minDistance: number,
): boolean {
  for (const obj of existing) {
    const dx = obj.position[0] - x;
    const dz = obj.position[2] - z;
    if (dx * dx + dz * dz < minDistance * minDistance) {
      return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Vehicle Colors
// ---------------------------------------------------------------------------

const CAR_COLORS = [
  0xcc3333, // Red
  0x3333cc, // Blue
  0x33cc33, // Green
  0xcccc33, // Yellow
  0x888888, // Gray
  0xffffff, // White
  0x222222, // Black
  0x884422, // Brown
  0xcc8833, // Orange
];

// ---------------------------------------------------------------------------
// Density Multipliers
// ---------------------------------------------------------------------------

const DENSITY: Record<string, { vehicles: number; trees: number; people: number }> = {
  low: { vehicles: 0.3, trees: 0.5, people: 0.2 },
  medium: { vehicles: 0.6, trees: 0.8, people: 0.5 },
  high: { vehicles: 1.0, trees: 1.0, people: 0.8 },
};

// ---------------------------------------------------------------------------
// Main Placement Function
// ---------------------------------------------------------------------------

/**
 * Generate procedural object placements for a scene.
 */
export function generateObjectPlacements(
  roads: RoadData[],
  sidewalks: SidewalkData[],
  config: PlacementConfig,
): PlacedObject[] {
  const rng = new SeededRandom(config.seed ?? Date.now());
  const density = DENSITY[config.vehicleDensity];
  const placed: PlacedObject[] = [];

  // --- Trees along roads ---
  if (config.showTrees) {
    for (const road of roads) {
      if (road.roadType === 'motorway' || road.roadType === 'trunk') continue;
      const spacing = 15 / density.trees;

      for (let i = 0; i < road.coordinates.length - 1; i++) {
        const p1 = road.coordinates[i];
        const p2 = road.coordinates[i + 1];
        const segLen = Math.sqrt((p2[0] - p1[0]) ** 2 + (p2[1] - p1[1]) ** 2);
        const angle = getSegmentAngle(p1, p2);
        const count = Math.floor(segLen / spacing);

        for (let j = 0; j < count; j++) {
          const t = (j + 0.5) / count;
          const x = p1[0] + (p2[0] - p1[0]) * t;
          const z = p1[1] + (p2[1] - p1[1]) * t;
          const offset = road.width / 2 + rng.range(2, 5);

          // Place on both sides with some randomness
          for (const side of ['left', 'right'] as const) {
            if (!rng.chance(0.6 * density.trees)) continue;
            const [px, pz] = getOffsetPoint([x, z], angle, offset, side);
            if (isFarEnough(px, pz, placed, 4)) {
              placed.push({
                id: generateId(),
                type: 'tree',
                position: [px, 0, pz],
                rotation: rng.range(0, Math.PI * 2),
                scale: rng.range(0.7, 1.3),
                variant: rng.pick(['deciduous', 'small', 'large']),
              });
            }
          }
        }
      }
    }
  }

  // --- Bushes along sidewalks ---
  if (config.showBushes) {
    for (const road of roads) {
      const spacing = 20 / density.trees;

      for (let i = 0; i < road.coordinates.length - 1; i++) {
        const p1 = road.coordinates[i];
        const p2 = road.coordinates[i + 1];
        const segLen = Math.sqrt((p2[0] - p1[0]) ** 2 + (p2[1] - p1[1]) ** 2);
        const angle = getSegmentAngle(p1, p2);
        const count = Math.floor(segLen / spacing);

        for (let j = 0; j < count; j++) {
          if (!rng.chance(0.4)) continue;
          const t = (j + 0.5) / count;
          const x = p1[0] + (p2[0] - p1[0]) * t;
          const z = p1[1] + (p2[1] - p1[1]) * t;
          const side = rng.pick(['left', 'right'] as const);
          const offset = road.width / 2 + rng.range(1, 2.5);
          const [px, pz] = getOffsetPoint([x, z], angle, offset, side);

          if (isFarEnough(px, pz, placed, 2)) {
            placed.push({
              id: generateId(),
              type: 'bush',
              position: [px, 0, pz],
              rotation: rng.range(0, Math.PI * 2),
              scale: rng.range(0.5, 1.2),
            });
          }
        }
      }
    }
  }

  // --- Vehicles on roads ---
  if (config.showVehicles) {
    for (const road of roads) {
      if (['footway', 'path', 'pedestrian', 'cycleway'].includes(road.roadType)) continue;

      const spacing = 30 / density.vehicles;

      for (let i = 0; i < road.coordinates.length - 1; i++) {
        const p1 = road.coordinates[i];
        const p2 = road.coordinates[i + 1];
        const segLen = Math.sqrt((p2[0] - p1[0]) ** 2 + (p2[1] - p1[1]) ** 2);
        const angle = getSegmentAngle(p1, p2);
        const count = Math.floor(segLen / spacing);

        for (let j = 0; j < count; j++) {
          if (!rng.chance(density.vehicles * 0.7)) continue;
          const t = rng.range(0, 1);
          const x = p1[0] + (p2[0] - p1[0]) * t;
          const z = p1[1] + (p2[1] - p1[1]) * t;

          // Place in a lane
          const laneOffset = (rng.chance(0.5) ? 1 : -1) * road.width / 4;
          const [px, pz] = getOffsetPoint([x, z], angle, laneOffset, 'right');
          const vehicleAngle = rng.chance(0.5) ? angle : angle + Math.PI; // Direction of travel

          if (isFarEnough(px, pz, placed, 6)) {
            const isPolice = rng.chance(0.1);
            placed.push({
              id: generateId(),
              type: isPolice ? 'policeVehicle' : 'car',
              position: [px, 0, pz],
              rotation: vehicleAngle,
              scale: 1.0,
              color: isPolice ? 0x1a1a6c : rng.pick(CAR_COLORS),
            });
          }
        }
      }
    }
  }

  // --- Pedestrians on sidewalks ---
  if (config.showPedestrians) {
    for (const sw of sidewalks) {
      const spacing = 15 / density.people;

      for (let i = 0; i < sw.coordinates.length - 1; i++) {
        const p1 = sw.coordinates[i];
        const p2 = sw.coordinates[i + 1];
        const segLen = Math.sqrt((p2[0] - p1[0]) ** 2 + (p2[1] - p1[1]) ** 2);
        const count = Math.floor(segLen / spacing);

        for (let j = 0; j < count; j++) {
          if (!rng.chance(density.people * 0.5)) continue;
          const t = rng.range(0, 1);
          const x = p1[0] + (p2[0] - p1[0]) * t + rng.range(-1, 1);
          const z = p1[1] + (p2[1] - p1[1]) * t + rng.range(-1, 1);

          if (isFarEnough(x, z, placed, 2)) {
            placed.push({
              id: generateId(),
              type: 'person',
              position: [x, 0, z],
              rotation: rng.range(0, Math.PI * 2),
              scale: rng.range(0.9, 1.1),
            });
          }
        }
      }
    }
  }

  // --- Streetlights along roads ---
  if (config.showStreetlights) {
    for (const road of roads) {
      if (['path', 'cycleway'].includes(road.roadType)) continue;
      const spacing = 40;

      for (let i = 0; i < road.coordinates.length - 1; i++) {
        const p1 = road.coordinates[i];
        const p2 = road.coordinates[i + 1];
        const segLen = Math.sqrt((p2[0] - p1[0]) ** 2 + (p2[1] - p1[1]) ** 2);
        const angle = getSegmentAngle(p1, p2);
        const count = Math.floor(segLen / spacing);

        for (let j = 0; j < count; j++) {
          const t = (j + 0.5) / Math.max(count, 1);
          const x = p1[0] + (p2[0] - p1[0]) * t;
          const z = p1[1] + (p2[1] - p1[1]) * t;
          const offset = road.width / 2 + 1;
          const side = j % 2 === 0 ? 'left' : 'right';
          const [px, pz] = getOffsetPoint([x, z], angle, offset, side as 'left' | 'right');

          if (isFarEnough(px, pz, placed, 10)) {
            placed.push({
              id: generateId(),
              type: 'streetlight',
              position: [px, 0, pz],
              rotation: angle,
              scale: 1.0,
            });
          }
        }
      }
    }
  }

  return placed;
}
