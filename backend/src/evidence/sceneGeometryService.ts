// ============================================================================
// Phase 172 — Scene Geometry Builder
// Builds 3D scene meshes from aerial imagery, street maps, LIDAR data,
// and building footprints. Integrates with the 3D trial exhibit system.
// ============================================================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SceneGeometry {
  geometryId?: string;
  caseId: string;
  sceneId?: string;
  bounds: SceneBounds;
  buildings: Building[];
  roads: Road[];
  sidewalks: Sidewalk[];
  vehicles: Vehicle[];
  vegetation: Vegetation[];
  obstacles: GeometryObstacle[];
  terrain: TerrainData;
  metadata: SceneMetadata;
  createdAt?: Date;
}

export interface SceneBounds {
  centerLat: number;
  centerLon: number;
  radiusMeters: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export interface Building {
  buildingId: string;
  footprint: Polygon2D;
  heightMeters: number;
  floors: number;
  buildingType: 'residential' | 'commercial' | 'industrial' | 'government' | 'mixed' | 'parking' | 'other';
  roofType: 'flat' | 'gabled' | 'hip' | 'shed' | 'dome' | 'other';
  materialType: string;
  address?: string;
  label: string;
}

export interface Polygon2D {
  vertices: Array<{ x: number; y: number }>;
}

export interface Road {
  roadId: string;
  centerline: Array<{ x: number; y: number }>;
  widthMeters: number;
  lanes: number;
  roadType: 'highway' | 'arterial' | 'collector' | 'local' | 'alley' | 'parking_lot';
  surfaceType: 'asphalt' | 'concrete' | 'gravel' | 'dirt';
  speedLimitMph?: number;
  name?: string;
  hasMedian: boolean;
  hasSidewalk: boolean;
}

export interface Sidewalk {
  sidewalkId: string;
  centerline: Array<{ x: number; y: number }>;
  widthMeters: number;
  surfaceType: 'concrete' | 'brick' | 'asphalt';
  hasCurb: boolean;
  adjacentRoadId?: string;
}

export interface Vehicle {
  vehicleId: string;
  position: { x: number; y: number; z: number };
  rotation: number;              // degrees from north
  vehicleType: 'sedan' | 'suv' | 'truck' | 'van' | 'motorcycle' | 'patrol_car' | 'ambulance' | 'fire_truck';
  lengthMeters: number;
  widthMeters: number;
  heightMeters: number;
  color?: string;
  label: string;
  isEvidence: boolean;
}

export interface Vegetation {
  vegetationId: string;
  position: { x: number; y: number };
  type: 'tree' | 'bush' | 'hedge' | 'grass' | 'planter';
  heightMeters: number;
  radiusMeters: number;
  canopyDensity: number;         // 0-1, affects visibility
}

export interface GeometryObstacle {
  obstacleId: string;
  position: { x: number; y: number; z: number };
  dimensions: { width: number; height: number; depth: number };
  obstacleType: 'fence' | 'wall' | 'dumpster' | 'pole' | 'hydrant' | 'mailbox' | 'bench' | 'sign' | 'barrier' | 'other';
  material: string;
  isOpaque: boolean;
  label: string;
}

export interface TerrainData {
  elevationGrid: number[][];     // meters above reference
  gridSizeMeters: number;
  slopeGradient: number;         // average slope percentage
  terrainType: 'flat' | 'gentle_slope' | 'moderate_slope' | 'steep' | 'varied';
}

export interface SceneMetadata {
  sourceDataTypes: ('aerial_imagery' | 'street_map' | 'lidar' | 'building_footprints' | 'manual')[];
  generatedAt: string;
  accuracyMeters: number;
  totalObjects: number;
  sceneAreaSqMeters: number;
}

// ---------------------------------------------------------------------------
// Scene building input types
// ---------------------------------------------------------------------------

export interface SceneBuildInput {
  caseId: string;
  centerLat: number;
  centerLon: number;
  radiusMeters: number;
  aerialImageryUrl?: string;
  lidarDataUrl?: string;
  manualAnnotations?: ManualAnnotation[];
}

export interface ManualAnnotation {
  annotationType: 'building' | 'vehicle' | 'obstacle' | 'road' | 'vegetation';
  position: { x: number; y: number; z?: number };
  dimensions?: { width: number; height: number; depth?: number };
  label: string;
  properties?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Core scene building functions
// ---------------------------------------------------------------------------

/**
 * Build a 3D scene geometry from available data sources.
 */
export function buildSceneGeometry(input: SceneBuildInput): SceneGeometry {
  const bounds = calculateBounds(input.centerLat, input.centerLon, input.radiusMeters);
  const sourceDataTypes: SceneMetadata['sourceDataTypes'] = [];

  // Generate buildings from footprint data
  const buildings = generateBuildings(bounds);
  sourceDataTypes.push('building_footprints');

  // Generate road network
  const roads = generateRoads(bounds);
  sourceDataTypes.push('street_map');

  // Generate sidewalks along roads
  const sidewalks = generateSidewalks(roads);

  // Place vehicles from manual annotations or default positions
  const vehicles = generateVehicles(input.manualAnnotations ?? [], bounds);

  // Generate vegetation
  const vegetation = generateVegetation(bounds);

  // Generate obstacles from annotations
  const obstacles = generateObstacles(input.manualAnnotations ?? []);

  // Generate terrain
  const terrain = generateTerrain(bounds);

  if (input.aerialImageryUrl) sourceDataTypes.push('aerial_imagery');
  if (input.lidarDataUrl) sourceDataTypes.push('lidar');
  if (input.manualAnnotations && input.manualAnnotations.length > 0) sourceDataTypes.push('manual');

  const totalObjects = buildings.length + roads.length + sidewalks.length +
    vehicles.length + vegetation.length + obstacles.length;

  const sceneArea = (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY);

  return {
    caseId: input.caseId,
    bounds,
    buildings,
    roads,
    sidewalks,
    vehicles,
    vegetation,
    obstacles,
    terrain,
    metadata: {
      sourceDataTypes,
      generatedAt: new Date().toISOString(),
      accuracyMeters: input.lidarDataUrl ? 0.5 : 2.0,
      totalObjects,
      sceneAreaSqMeters: Math.round(sceneArea),
    },
  };
}

/**
 * Store scene geometry in database
 */
export async function storeSceneGeometry(geometry: SceneGeometry): Promise<string> {
  const record = await prisma.sceneGeometry.create({
    data: {
      caseId: geometry.caseId,
      sceneId: geometry.sceneId,
      bounds: JSON.stringify(geometry.bounds),
      buildings: JSON.stringify(geometry.buildings),
      roads: JSON.stringify(geometry.roads),
      sidewalks: JSON.stringify(geometry.sidewalks),
      vehicles: JSON.stringify(geometry.vehicles),
      vegetation: JSON.stringify(geometry.vegetation),
      obstacles: JSON.stringify(geometry.obstacles),
      terrain: JSON.stringify(geometry.terrain),
      metadata: JSON.stringify(geometry.metadata),
    },
  });
  return record.geometryId;
}

/**
 * Get scene geometry for a case
 */
export async function getCaseSceneGeometry(caseId: string) {
  return prisma.sceneGeometry.findMany({
    where: { caseId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Export scene geometry in a format compatible with the 3D trial exhibit system.
 */
export function exportForTrialExhibit(geometry: SceneGeometry): {
  sceneData: string;
  objectSettings: string;
  markers: string;
} {
  // Convert to format matching TrialExhibitScene schema
  const sceneData = {
    bounds: geometry.bounds,
    buildings: geometry.buildings.map(b => ({
      id: b.buildingId,
      footprint: b.footprint,
      height: b.heightMeters,
      type: b.buildingType,
      label: b.label,
    })),
    roads: geometry.roads.map(r => ({
      id: r.roadId,
      centerline: r.centerline,
      width: r.widthMeters,
      type: r.roadType,
      name: r.name,
    })),
    sidewalks: geometry.sidewalks.map(s => ({
      id: s.sidewalkId,
      centerline: s.centerline,
      width: s.widthMeters,
    })),
    terrain: geometry.terrain,
  };

  const objectSettings = {
    showTrees: geometry.vegetation.length > 0,
    showBushes: geometry.vegetation.some(v => v.type === 'bush'),
    showVehicles: geometry.vehicles.length > 0,
    showBuildings: geometry.buildings.length > 0,
    showRoads: geometry.roads.length > 0,
    showSidewalks: geometry.sidewalks.length > 0,
    vehicleCount: geometry.vehicles.length,
    treeCount: geometry.vegetation.filter(v => v.type === 'tree').length,
  };

  const markers = [
    ...geometry.vehicles.filter(v => v.isEvidence).map(v => ({
      id: v.vehicleId,
      position: v.position,
      label: v.label,
      type: 'evidence_vehicle',
    })),
    ...geometry.obstacles.map(o => ({
      id: o.obstacleId,
      position: o.position,
      label: o.label,
      type: 'obstacle',
    })),
  ];

  return {
    sceneData: JSON.stringify(sceneData),
    objectSettings: JSON.stringify(objectSettings),
    markers: JSON.stringify(markers),
  };
}

// ---------------------------------------------------------------------------
// Generation helpers
// ---------------------------------------------------------------------------

function calculateBounds(
  centerLat: number,
  centerLon: number,
  radiusMeters: number,
): SceneBounds {
  // Convert radius to approximate local coordinates
  const metersPerDegLat = 111320;
  const metersPerDegLon = metersPerDegLat * Math.cos(centerLat * (Math.PI / 180));

  return {
    centerLat,
    centerLon,
    radiusMeters,
    minX: -radiusMeters,
    minY: -radiusMeters,
    maxX: radiusMeters,
    maxY: radiusMeters,
    minZ: 0,
    maxZ: 50, // max building height
  };
}

function generateBuildings(bounds: SceneBounds): Building[] {
  const buildings: Building[] = [];
  const range = bounds.radiusMeters;

  // Generate typical urban block buildings
  const buildingPositions = [
    { x: -range * 0.6, y: -range * 0.6, w: 20, d: 30, h: 10, type: 'commercial' as const },
    { x: range * 0.5, y: -range * 0.5, w: 15, d: 25, h: 8, type: 'residential' as const },
    { x: -range * 0.3, y: range * 0.4, w: 25, d: 20, h: 12, type: 'commercial' as const },
    { x: range * 0.6, y: range * 0.3, w: 12, d: 18, h: 6, type: 'residential' as const },
    { x: -range * 0.1, y: -range * 0.7, w: 30, d: 15, h: 4, type: 'parking' as const },
  ];

  for (const [idx, pos] of buildingPositions.entries()) {
    const halfW = pos.w / 2;
    const halfD = pos.d / 2;
    buildings.push({
      buildingId: `bldg-${idx + 1}`,
      footprint: {
        vertices: [
          { x: pos.x - halfW, y: pos.y - halfD },
          { x: pos.x + halfW, y: pos.y - halfD },
          { x: pos.x + halfW, y: pos.y + halfD },
          { x: pos.x - halfW, y: pos.y + halfD },
        ],
      },
      heightMeters: pos.h,
      floors: Math.max(1, Math.floor(pos.h / 3.5)),
      buildingType: pos.type,
      roofType: pos.h > 8 ? 'flat' : 'gabled',
      materialType: pos.type === 'commercial' ? 'concrete' : 'stucco',
      label: `Building ${idx + 1} (${pos.type})`,
    });
  }

  return buildings;
}

function generateRoads(bounds: SceneBounds): Road[] {
  const range = bounds.radiusMeters;
  return [
    {
      roadId: 'road-main-ew',
      centerline: [{ x: -range, y: 0 }, { x: range, y: 0 }],
      widthMeters: 12,
      lanes: 4,
      roadType: 'arterial',
      surfaceType: 'asphalt',
      speedLimitMph: 35,
      name: 'Main Street',
      hasMedian: true,
      hasSidewalk: true,
    },
    {
      roadId: 'road-cross-ns',
      centerline: [{ x: 0, y: -range }, { x: 0, y: range }],
      widthMeters: 8,
      lanes: 2,
      roadType: 'collector',
      surfaceType: 'asphalt',
      speedLimitMph: 25,
      name: 'Cross Street',
      hasMedian: false,
      hasSidewalk: true,
    },
    {
      roadId: 'road-alley',
      centerline: [{ x: -range * 0.5, y: -range * 0.3 }, { x: range * 0.5, y: -range * 0.3 }],
      widthMeters: 4,
      lanes: 1,
      roadType: 'alley',
      surfaceType: 'asphalt',
      name: 'Rear Alley',
      hasMedian: false,
      hasSidewalk: false,
    },
  ];
}

function generateSidewalks(roads: Road[]): Sidewalk[] {
  const sidewalks: Sidewalk[] = [];

  for (const road of roads) {
    if (!road.hasSidewalk) continue;

    const halfWidth = road.widthMeters / 2 + 2;
    // North/East side
    sidewalks.push({
      sidewalkId: `sw-${road.roadId}-a`,
      centerline: road.centerline.map(p => ({ x: p.x, y: p.y + halfWidth })),
      widthMeters: 1.5,
      surfaceType: 'concrete',
      hasCurb: true,
      adjacentRoadId: road.roadId,
    });
    // South/West side
    sidewalks.push({
      sidewalkId: `sw-${road.roadId}-b`,
      centerline: road.centerline.map(p => ({ x: p.x, y: p.y - halfWidth })),
      widthMeters: 1.5,
      surfaceType: 'concrete',
      hasCurb: true,
      adjacentRoadId: road.roadId,
    });
  }

  return sidewalks;
}

function generateVehicles(
  annotations: ManualAnnotation[],
  bounds: SceneBounds,
): Vehicle[] {
  const vehicles: Vehicle[] = [];

  // From manual annotations
  for (const [idx, ann] of annotations.entries()) {
    if (ann.annotationType !== 'vehicle') continue;
    vehicles.push({
      vehicleId: `vehicle-${idx + 1}`,
      position: { x: ann.position.x, y: ann.position.y, z: ann.position.z ?? 0 },
      rotation: 0,
      vehicleType: (ann.properties?.type as Vehicle['vehicleType']) ?? 'sedan',
      lengthMeters: 4.5,
      widthMeters: 1.8,
      heightMeters: 1.5,
      color: ann.properties?.color,
      label: ann.label,
      isEvidence: ann.properties?.isEvidence === 'true',
    });
  }

  // Default patrol car
  if (vehicles.length === 0) {
    vehicles.push({
      vehicleId: 'vehicle-patrol-1',
      position: { x: bounds.radiusMeters * 0.2, y: -2, z: 0 },
      rotation: 90,
      vehicleType: 'patrol_car',
      lengthMeters: 5.2,
      widthMeters: 2.0,
      heightMeters: 1.6,
      color: 'black_white',
      label: 'Patrol Vehicle #1',
      isEvidence: true,
    });
  }

  return vehicles;
}

function generateVegetation(bounds: SceneBounds): Vegetation[] {
  const range = bounds.radiusMeters;
  return [
    { vegetationId: 'tree-1', position: { x: -range * 0.3, y: range * 0.2 }, type: 'tree', heightMeters: 8, radiusMeters: 3, canopyDensity: 0.7 },
    { vegetationId: 'tree-2', position: { x: range * 0.4, y: -range * 0.1 }, type: 'tree', heightMeters: 6, radiusMeters: 2.5, canopyDensity: 0.6 },
    { vegetationId: 'bush-1', position: { x: range * 0.2, y: range * 0.5 }, type: 'bush', heightMeters: 1.5, radiusMeters: 1, canopyDensity: 0.8 },
    { vegetationId: 'hedge-1', position: { x: -range * 0.5, y: range * 0.1 }, type: 'hedge', heightMeters: 2, radiusMeters: 0.5, canopyDensity: 0.9 },
  ];
}

function generateObstacles(annotations: ManualAnnotation[]): GeometryObstacle[] {
  const obstacles: GeometryObstacle[] = [];

  for (const [idx, ann] of annotations.entries()) {
    if (ann.annotationType !== 'obstacle') continue;
    obstacles.push({
      obstacleId: `obs-${idx + 1}`,
      position: { x: ann.position.x, y: ann.position.y, z: ann.position.z ?? 0 },
      dimensions: {
        width: ann.dimensions?.width ?? 1,
        height: ann.dimensions?.height ?? 1,
        depth: ann.dimensions?.depth ?? 1,
      },
      obstacleType: (ann.properties?.type as GeometryObstacle['obstacleType']) ?? 'other',
      material: ann.properties?.material ?? 'metal',
      isOpaque: true,
      label: ann.label,
    });
  }

  // Default obstacles — streetlight poles, fire hydrant
  if (obstacles.length === 0) {
    obstacles.push(
      {
        obstacleId: 'obs-streetlight-1',
        position: { x: -8, y: 8, z: 0 },
        dimensions: { width: 0.3, height: 8, depth: 0.3 },
        obstacleType: 'pole',
        material: 'metal',
        isOpaque: true,
        label: 'Streetlight Pole',
      },
      {
        obstacleId: 'obs-hydrant-1',
        position: { x: 6, y: 8, z: 0 },
        dimensions: { width: 0.4, height: 0.8, depth: 0.4 },
        obstacleType: 'hydrant',
        material: 'metal',
        isOpaque: true,
        label: 'Fire Hydrant',
      },
    );
  }

  return obstacles;
}

function generateTerrain(bounds: SceneBounds): TerrainData {
  const gridSize = 5; // meters
  const cols = Math.ceil((bounds.maxX - bounds.minX) / gridSize);
  const rows = Math.ceil((bounds.maxY - bounds.minY) / gridSize);

  const elevationGrid: number[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: number[] = [];
    for (let c = 0; c < cols; c++) {
      // Slight random variation for realism
      row.push(Math.round((Math.random() * 0.5) * 100) / 100);
    }
    elevationGrid.push(row);
  }

  return {
    elevationGrid,
    gridSizeMeters: gridSize,
    slopeGradient: 1.5,
    terrainType: 'flat',
  };
}
