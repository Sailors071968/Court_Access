// ============================================================================
// Phase 170 — Officer Line-of-Sight Reconstruction
// Using 3D scene geometry, camera location, and obstacle detection, determines
// what an officer could see and could not see at any given moment.
// Outputs visibility obstruction maps.
// ============================================================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LineOfSightAnalysis {
  analysisId?: string;
  caseId: string;
  sceneId?: string;
  observerPosition: Position3D;
  observerHeightFeet: number;
  viewDirection: ViewDirection;
  fieldOfView: FieldOfView;
  obstacles: SceneObstacle[];
  visibilityResults: VisibilityResult[];
  obstructionMap: ObstructionMap;
  summary: LineOfSightSummary;
  createdAt?: Date;
}

export interface Position3D {
  x: number;
  y: number;
  z: number;
  label?: string;
}

export interface ViewDirection {
  azimuthDeg: number;     // 0=North, 90=East
  elevationDeg: number;   // 0=horizontal, positive=up
  headTurnDeg: number;    // relative to body facing
}

export interface FieldOfView {
  horizontalDeg: number;  // typical human ~120° (but clear focus ~60°)
  verticalDeg: number;    // typical ~135°
  focusConeDeg: number;   // sharp focus ~5°
  peripheralDeg: number;  // peripheral awareness
}

export interface SceneObstacle {
  obstacleId: string;
  obstacleType: 'building' | 'vehicle' | 'wall' | 'fence' | 'tree' | 'pole' | 'dumpster' | 'person' | 'other';
  position: Position3D;
  dimensions: { width: number; height: number; depth: number };
  isOpaque: boolean;
  transparency: number;   // 0=opaque, 1=fully transparent
  label: string;
}

export interface VisibilityResult {
  targetPosition: Position3D;
  targetLabel: string;
  isVisible: boolean;
  visibilityPercent: number;  // 0-100 accounting for partial obstructions
  obstructedBy: string[];     // obstacle labels that block view
  inFieldOfView: boolean;
  inFocusCone: boolean;
  distanceFeet: number;
  angleDeg: number;           // angle from center of view
  apparentSizeDeg: number;    // how large the target appears
}

export interface ObstructionMap {
  resolution: number;         // degrees per cell
  horizontalCells: number;
  verticalCells: number;
  cells: ObstructionCell[];
}

export interface ObstructionCell {
  azimuthDeg: number;
  elevationDeg: number;
  isObstructed: boolean;
  obstructedBy?: string;
  distanceToObstruction?: number;
  visibilityPercent: number;
}

export interface LineOfSightSummary {
  totalTargetsChecked: number;
  visibleTargets: number;
  partiallyVisibleTargets: number;
  fullyObstructedTargets: number;
  fieldOfViewCoverage: number;  // percent of FOV that is clear
  criticalObstructions: string[];
  unobstructedSectors: Array<{ fromDeg: number; toDeg: number }>;
}

// ---------------------------------------------------------------------------
// Default human vision parameters
// ---------------------------------------------------------------------------

const DEFAULT_FOV: FieldOfView = {
  horizontalDeg: 120,
  verticalDeg: 135,
  focusConeDeg: 5,
  peripheralDeg: 170,
};

const DEFAULT_OBSERVER_HEIGHT = 5.75; // feet (average officer eye height)

// ---------------------------------------------------------------------------
// Core analysis functions
// ---------------------------------------------------------------------------

/**
 * Run line-of-sight analysis from an observer position.
 */
export function analyzeLineOfSight(
  caseId: string,
  observerPosition: Position3D,
  viewDirection: ViewDirection,
  obstacles: SceneObstacle[],
  targets: Array<Position3D & { label: string; heightFeet?: number }>,
  options?: {
    observerHeightFeet?: number;
    fieldOfView?: Partial<FieldOfView>;
    sceneId?: string;
    obstructionMapResolution?: number;
  },
): LineOfSightAnalysis {
  const observerHeight = options?.observerHeightFeet ?? DEFAULT_OBSERVER_HEIGHT;
  const fov: FieldOfView = { ...DEFAULT_FOV, ...options?.fieldOfView };
  const mapResolution = options?.obstructionMapResolution ?? 5;

  // Adjust observer position for eye height
  const eyePosition: Position3D = {
    x: observerPosition.x,
    y: observerPosition.y,
    z: observerPosition.z + observerHeight,
    label: 'observer_eye',
  };

  // Check visibility to each target
  const visibilityResults: VisibilityResult[] = [];
  for (const target of targets) {
    const targetCenter: Position3D = {
      x: target.x,
      y: target.y,
      z: target.z + (target.heightFeet ?? 5) / 2,
    };
    const result = checkTargetVisibility(eyePosition, targetCenter, target.label, viewDirection, fov, obstacles);
    visibilityResults.push(result);
  }

  // Generate obstruction map
  const obstructionMap = generateObstructionMap(eyePosition, viewDirection, fov, obstacles, mapResolution);

  // Calculate summary
  const visible = visibilityResults.filter(r => r.isVisible && r.visibilityPercent >= 80);
  const partial = visibilityResults.filter(r => r.visibilityPercent > 0 && r.visibilityPercent < 80);
  const obstructed = visibilityResults.filter(r => r.visibilityPercent === 0);

  const totalMapCells = obstructionMap.cells.length;
  const clearCells = obstructionMap.cells.filter(c => !c.isObstructed).length;
  const fovCoverage = totalMapCells > 0 ? (clearCells / totalMapCells) * 100 : 100;

  const criticalObstructions: string[] = [];
  for (const result of visibilityResults) {
    if (!result.isVisible && result.inFieldOfView) {
      for (const obs of result.obstructedBy) {
        if (!criticalObstructions.includes(obs)) criticalObstructions.push(obs);
      }
    }
  }

  const unobstructedSectors = findUnobstructedSectors(obstructionMap, viewDirection, fov);

  return {
    caseId,
    sceneId: options?.sceneId,
    observerPosition,
    observerHeightFeet: observerHeight,
    viewDirection,
    fieldOfView: fov,
    obstacles,
    visibilityResults,
    obstructionMap,
    summary: {
      totalTargetsChecked: visibilityResults.length,
      visibleTargets: visible.length,
      partiallyVisibleTargets: partial.length,
      fullyObstructedTargets: obstructed.length,
      fieldOfViewCoverage: Math.round(fovCoverage * 10) / 10,
      criticalObstructions,
      unobstructedSectors,
    },
  };
}

/**
 * Store line-of-sight analysis in database
 */
export async function storeLineOfSightAnalysis(analysis: LineOfSightAnalysis): Promise<string> {
  const record = await prisma.lineOfSightAnalysis.create({
    data: {
      caseId: analysis.caseId,
      sceneId: analysis.sceneId,
      observerPosition: JSON.stringify(analysis.observerPosition),
      viewDirection: JSON.stringify(analysis.viewDirection),
      fieldOfView: JSON.stringify(analysis.fieldOfView),
      obstacles: JSON.stringify(analysis.obstacles),
      visibilityResults: JSON.stringify(analysis.visibilityResults),
      obstructionMap: JSON.stringify(analysis.obstructionMap),
      summary: JSON.stringify(analysis.summary),
    },
  });
  return record.analysisId;
}

/**
 * Get line-of-sight analyses for a case
 */
export async function getCaseLineOfSightAnalyses(caseId: string) {
  return prisma.lineOfSightAnalysis.findMany({
    where: { caseId },
    orderBy: { createdAt: 'desc' },
  });
}

// ---------------------------------------------------------------------------
// Visibility checking
// ---------------------------------------------------------------------------

function checkTargetVisibility(
  eyePos: Position3D,
  targetPos: Position3D,
  targetLabel: string,
  viewDir: ViewDirection,
  fov: FieldOfView,
  obstacles: SceneObstacle[],
): VisibilityResult {
  // Calculate distance and angle to target
  const dx = targetPos.x - eyePos.x;
  const dy = targetPos.y - eyePos.y;
  const dz = targetPos.z - eyePos.z;
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const horizontalDist = Math.sqrt(dx * dx + dy * dy);

  // Calculate azimuth and elevation to target
  const targetAzimuth = Math.atan2(dx, dy) * (180 / Math.PI);
  const targetElevation = Math.atan2(dz, horizontalDist) * (180 / Math.PI);

  // Calculate angle from center of view
  const viewAzRad = viewDir.azimuthDeg * (Math.PI / 180);
  const viewElRad = viewDir.elevationDeg * (Math.PI / 180);
  const targetAzRad = targetAzimuth * (Math.PI / 180);
  const targetElRad = targetElevation * (Math.PI / 180);

  // Angular separation using great-circle formula
  const cosAngle = Math.sin(viewElRad) * Math.sin(targetElRad) +
    Math.cos(viewElRad) * Math.cos(targetElRad) * Math.cos(targetAzRad - viewAzRad);
  const angleDeg = Math.acos(Math.max(-1, Math.min(1, cosAngle))) * (180 / Math.PI);

  // Check if in field of view
  const inFov = angleDeg <= fov.horizontalDeg / 2;
  const inFocusCone = angleDeg <= fov.focusConeDeg / 2;

  // Apparent size (assuming 5.5 foot person at distance)
  const apparentSize = distance > 0 ? Math.atan2(5.5, distance) * (180 / Math.PI) : 90;

  // Ray-cast for obstructions
  const obstructedBy: string[] = [];
  let totalObstructionFactor = 0;

  for (const obs of obstacles) {
    if (rayIntersectsObstacle(eyePos, targetPos, obs)) {
      obstructedBy.push(obs.label);
      totalObstructionFactor += (1 - obs.transparency);
    }
  }

  const visibilityPercent = Math.max(0, Math.min(100,
    inFov
      ? Math.round((1 - Math.min(1, totalObstructionFactor)) * 100)
      : 0,
  ));

  return {
    targetPosition: targetPos,
    targetLabel,
    isVisible: visibilityPercent > 50,
    visibilityPercent,
    obstructedBy,
    inFieldOfView: inFov,
    inFocusCone,
    distanceFeet: Math.round(distance * 10) / 10,
    angleDeg: Math.round(angleDeg * 10) / 10,
    apparentSizeDeg: Math.round(apparentSize * 100) / 100,
  };
}

function rayIntersectsObstacle(
  origin: Position3D,
  target: Position3D,
  obstacle: SceneObstacle,
): boolean {
  // Simplified AABB ray intersection
  const dir = {
    x: target.x - origin.x,
    y: target.y - origin.y,
    z: target.z - origin.z,
  };

  const halfW = obstacle.dimensions.width / 2;
  const halfD = obstacle.dimensions.depth / 2;
  const boxMin = {
    x: obstacle.position.x - halfW,
    y: obstacle.position.y - halfD,
    z: obstacle.position.z,
  };
  const boxMax = {
    x: obstacle.position.x + halfW,
    y: obstacle.position.y + halfD,
    z: obstacle.position.z + obstacle.dimensions.height,
  };

  const invDirX = dir.x !== 0 ? 1 / dir.x : 1e10;
  const invDirY = dir.y !== 0 ? 1 / dir.y : 1e10;
  const invDirZ = dir.z !== 0 ? 1 / dir.z : 1e10;

  const t1 = (boxMin.x - origin.x) * invDirX;
  const t2 = (boxMax.x - origin.x) * invDirX;
  const t3 = (boxMin.y - origin.y) * invDirY;
  const t4 = (boxMax.y - origin.y) * invDirY;
  const t5 = (boxMin.z - origin.z) * invDirZ;
  const t6 = (boxMax.z - origin.z) * invDirZ;

  const tMin = Math.max(Math.min(t1, t2), Math.min(t3, t4), Math.min(t5, t6));
  const tMax = Math.min(Math.max(t1, t2), Math.max(t3, t4), Math.max(t5, t6));

  return tMax >= tMin && tMax >= 0 && tMin <= 1;
}

// ---------------------------------------------------------------------------
// Obstruction map generation
// ---------------------------------------------------------------------------

function generateObstructionMap(
  eyePos: Position3D,
  viewDir: ViewDirection,
  fov: FieldOfView,
  obstacles: SceneObstacle[],
  resolution: number,
): ObstructionMap {
  const halfH = fov.horizontalDeg / 2;
  const halfV = fov.verticalDeg / 2;
  const hCells = Math.ceil(fov.horizontalDeg / resolution);
  const vCells = Math.ceil(fov.verticalDeg / resolution);
  const cells: ObstructionCell[] = [];

  for (let v = 0; v < vCells; v++) {
    for (let h = 0; h < hCells; h++) {
      const azimuth = viewDir.azimuthDeg - halfH + h * resolution + resolution / 2;
      const elevation = viewDir.elevationDeg - halfV + v * resolution + resolution / 2;

      // Cast ray in this direction
      const azRad = azimuth * (Math.PI / 180);
      const elRad = elevation * (Math.PI / 180);
      const rayDir = {
        x: Math.cos(elRad) * Math.sin(azRad),
        y: Math.cos(elRad) * Math.cos(azRad),
        z: Math.sin(elRad),
      };

      const rayTarget: Position3D = {
        x: eyePos.x + rayDir.x * 500,
        y: eyePos.y + rayDir.y * 500,
        z: eyePos.z + rayDir.z * 500,
      };

      let obstructed = false;
      let obstructedBy: string | undefined;
      let minDist = Infinity;

      for (const obs of obstacles) {
        if (rayIntersectsObstacle(eyePos, rayTarget, obs) && obs.isOpaque) {
          const dist = Math.sqrt(
            (obs.position.x - eyePos.x) ** 2 +
            (obs.position.y - eyePos.y) ** 2 +
            (obs.position.z - eyePos.z) ** 2,
          );
          if (dist < minDist) {
            minDist = dist;
            obstructedBy = obs.label;
            obstructed = true;
          }
        }
      }

      cells.push({
        azimuthDeg: Math.round(azimuth * 10) / 10,
        elevationDeg: Math.round(elevation * 10) / 10,
        isObstructed: obstructed,
        obstructedBy: obstructed ? obstructedBy : undefined,
        distanceToObstruction: obstructed ? Math.round(minDist * 10) / 10 : undefined,
        visibilityPercent: obstructed ? 0 : 100,
      });
    }
  }

  return { resolution, horizontalCells: hCells, verticalCells: vCells, cells };
}

function findUnobstructedSectors(
  map: ObstructionMap,
  viewDir: ViewDirection,
  fov: FieldOfView,
): Array<{ fromDeg: number; toDeg: number }> {
  const sectors: Array<{ fromDeg: number; toDeg: number }> = [];
  const halfH = fov.horizontalDeg / 2;

  // Group cells by azimuth columns and find clear ranges
  let sectorStart: number | null = null;

  for (let h = 0; h < map.horizontalCells; h++) {
    const colCells = map.cells.filter((_, idx) => idx % map.horizontalCells === h);
    const clearRatio = colCells.filter(c => !c.isObstructed).length / colCells.length;

    const azimuth = viewDir.azimuthDeg - halfH + h * map.resolution + map.resolution / 2;

    if (clearRatio > 0.7) {
      if (sectorStart === null) sectorStart = azimuth;
    } else {
      if (sectorStart !== null) {
        sectors.push({
          fromDeg: Math.round(sectorStart * 10) / 10,
          toDeg: Math.round((azimuth - map.resolution) * 10) / 10,
        });
        sectorStart = null;
      }
    }
  }

  if (sectorStart !== null) {
    sectors.push({
      fromDeg: Math.round(sectorStart * 10) / 10,
      toDeg: Math.round((viewDir.azimuthDeg + halfH) * 10) / 10,
    });
  }

  return sectors;
}
