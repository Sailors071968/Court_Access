// ============================================================================
// Phase 53 — Scene Builder Service
// Creates 3D scene data from location coordinates using OpenStreetMap data.
// ============================================================================

import https from 'node:https';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SceneCoordinates {
  latitude: number;
  longitude: number;
  boundingBox?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

export interface BuildingFootprint {
  id: string;
  type: 'building';
  coordinates: Array<[number, number]>;
  height: number;
  levels: number;
  name?: string;
  buildingType?: string;
}

export interface RoadSegment {
  id: string;
  type: 'road';
  coordinates: Array<[number, number]>;
  width: number;
  roadType: string;
  name?: string;
  lanes: number;
}

export interface TerrainPoint {
  x: number;
  y: number;
  elevation: number;
}

export interface SceneData {
  sceneId: string;
  center: { latitude: number; longitude: number };
  boundingBox: { north: number; south: number; east: number; west: number };
  buildings: BuildingFootprint[];
  roads: RoadSegment[];
  terrain: TerrainPoint[];
  sidewalks: Array<{ id: string; coordinates: Array<[number, number]>; width: number }>;
  parkingLots: Array<{ id: string; coordinates: Array<[number, number]> }>;
  greenSpaces: Array<{ id: string; coordinates: Array<[number, number]>; type: string }>;
  waterFeatures: Array<{ id: string; coordinates: Array<[number, number]>; type: string }>;
  metadata: {
    source: string;
    fetchedAt: string;
    totalFeatures: number;
    areaSquareMeters: number;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  return `feat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Calculate bounding box from center point (default ~200m radius).
 */
function calculateBoundingBox(
  lat: number,
  lon: number,
  radiusMeters = 200,
): { north: number; south: number; east: number; west: number } {
  const latDelta = radiusMeters / 111_320;
  const lonDelta = radiusMeters / (111_320 * Math.cos((lat * Math.PI) / 180));
  return {
    south: lat - latDelta,
    north: lat + latDelta,
    west: lon - lonDelta,
    east: lon + lonDelta,
  };
}

/**
 * Fetch data from Overpass API (OpenStreetMap).
 */
async function queryOverpass(query: string): Promise<Record<string, unknown>> {
  const url = 'https://overpass-api.de/api/interpreter';
  const body = `data=${encodeURIComponent(query)}`;

  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data) as Record<string, unknown>);
        } catch {
          reject(new Error(`Overpass API returned invalid JSON: ${data.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * Convert latitude/longitude to local scene coordinates (meters from center).
 */
function geoToLocal(
  lat: number,
  lon: number,
  centerLat: number,
  centerLon: number,
): [number, number] {
  const x = (lon - centerLon) * 111_320 * Math.cos((centerLat * Math.PI) / 180);
  const y = (lat - centerLat) * 111_320;
  return [x, y];
}

// ---------------------------------------------------------------------------
// Road width estimation by type
// ---------------------------------------------------------------------------

const ROAD_WIDTHS: Record<string, number> = {
  motorway: 14,
  trunk: 12,
  primary: 10,
  secondary: 8,
  tertiary: 7,
  residential: 6,
  service: 4,
  footway: 2,
  cycleway: 2,
  path: 1.5,
  pedestrian: 3,
  unclassified: 5,
};

const ROAD_LANES: Record<string, number> = {
  motorway: 4,
  trunk: 4,
  primary: 2,
  secondary: 2,
  tertiary: 2,
  residential: 2,
  service: 1,
  footway: 1,
  cycleway: 1,
  path: 1,
  pedestrian: 1,
  unclassified: 2,
};

// ---------------------------------------------------------------------------
// Main Scene Builder
// ---------------------------------------------------------------------------

/**
 * Create a 3D scene from location coordinates.
 * Fetches building, road, and terrain data from OpenStreetMap.
 */
export async function create3DScene(coords: SceneCoordinates): Promise<SceneData> {
  const { latitude, longitude } = coords;
  const bbox = coords.boundingBox ?? calculateBoundingBox(latitude, longitude);
  const bboxStr = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;

  console.log(`[SceneBuilder] Creating 3D scene at ${latitude}, ${longitude}`);
  console.log(`[SceneBuilder] Bounding box: ${bboxStr}`);

  // Build Overpass query to fetch buildings, roads, sidewalks, parking, green spaces, water
  const overpassQuery = `
    [out:json][timeout:30];
    (
      way["building"](${bboxStr});
      way["highway"](${bboxStr});
      way["footway"](${bboxStr});
      way["amenity"="parking"](${bboxStr});
      way["leisure"="park"](${bboxStr});
      way["natural"="water"](${bboxStr});
      relation["building"](${bboxStr});
    );
    out body;
    >;
    out skel qt;
  `;

  let osmData: Record<string, unknown>;
  try {
    osmData = await queryOverpass(overpassQuery);
  } catch (_error) {
    console.warn('[SceneBuilder] Overpass API failed, generating synthetic scene');
    return generateSyntheticScene(latitude, longitude, bbox);
  }

  const elements = (osmData.elements ?? []) as Array<Record<string, unknown>>;

  // Build node lookup for resolving way coordinates
  const nodes = new Map<number, { lat: number; lon: number }>();
  for (const el of elements) {
    if (el.type === 'node' && typeof el.lat === 'number' && typeof el.lon === 'number') {
      nodes.set(el.id as number, { lat: el.lat, lon: el.lon });
    }
  }

  // Extract features
  const buildings: BuildingFootprint[] = [];
  const roads: RoadSegment[] = [];
  const sidewalks: Array<{ id: string; coordinates: Array<[number, number]>; width: number }> = [];
  const parkingLots: Array<{ id: string; coordinates: Array<[number, number]> }> = [];
  const greenSpaces: Array<{ id: string; coordinates: Array<[number, number]>; type: string }> = [];
  const waterFeatures: Array<{ id: string; coordinates: Array<[number, number]>; type: string }> = [];

  for (const el of elements) {
    if (el.type !== 'way') continue;
    const tags = (el.tags ?? {}) as Record<string, string>;
    const nodeIds = (el.nodes ?? []) as number[];
    const coords2d: Array<[number, number]> = [];

    for (const nid of nodeIds) {
      const node = nodes.get(nid);
      if (node) {
        coords2d.push(geoToLocal(node.lat, node.lon, latitude, longitude));
      }
    }

    if (coords2d.length < 2) continue;

    // Buildings
    if (tags.building) {
      const levels = parseInt(tags['building:levels'] ?? '2', 10);
      buildings.push({
        id: generateId(),
        type: 'building',
        coordinates: coords2d,
        height: levels * 3.5,
        levels,
        name: tags.name,
        buildingType: tags.building,
      });
    }

    // Roads
    if (tags.highway) {
      const roadType = tags.highway;
      if (roadType === 'footway' || roadType === 'path' || roadType === 'pedestrian') {
        sidewalks.push({
          id: generateId(),
          coordinates: coords2d,
          width: ROAD_WIDTHS[roadType] ?? 2,
        });
      } else {
        roads.push({
          id: generateId(),
          type: 'road',
          coordinates: coords2d,
          width: ROAD_WIDTHS[roadType] ?? 6,
          roadType,
          name: tags.name,
          lanes: parseInt(tags.lanes ?? String(ROAD_LANES[roadType] ?? 2), 10),
        });
      }
    }

    // Parking
    if (tags.amenity === 'parking') {
      parkingLots.push({ id: generateId(), coordinates: coords2d });
    }

    // Green spaces
    if (tags.leisure === 'park' || tags.landuse === 'grass') {
      greenSpaces.push({ id: generateId(), coordinates: coords2d, type: tags.leisure ?? tags.landuse ?? 'park' });
    }

    // Water
    if (tags.natural === 'water' || tags.waterway) {
      waterFeatures.push({ id: generateId(), coordinates: coords2d, type: tags.natural ?? tags.waterway ?? 'water' });
    }
  }

  // Generate flat terrain grid
  const terrain = generateTerrainGrid(bbox, latitude, longitude);

  const areaWidth = (bbox.east - bbox.west) * 111_320 * Math.cos((latitude * Math.PI) / 180);
  const areaHeight = (bbox.north - bbox.south) * 111_320;

  const sceneData: SceneData = {
    sceneId: generateId(),
    center: { latitude, longitude },
    boundingBox: bbox,
    buildings,
    roads,
    terrain,
    sidewalks,
    parkingLots,
    greenSpaces,
    waterFeatures,
    metadata: {
      source: 'OpenStreetMap / Overpass API',
      fetchedAt: new Date().toISOString(),
      totalFeatures: buildings.length + roads.length + sidewalks.length + parkingLots.length + greenSpaces.length + waterFeatures.length,
      areaSquareMeters: Math.round(areaWidth * areaHeight),
    },
  };

  console.log(`[SceneBuilder] Scene created: ${buildings.length} buildings, ${roads.length} roads, ${sidewalks.length} sidewalks`);
  return sceneData;
}

/**
 * Generate a flat terrain grid for the bounding box.
 */
function generateTerrainGrid(
  bbox: { north: number; south: number; east: number; west: number },
  centerLat: number,
  centerLon: number,
  resolution = 10,
): TerrainPoint[] {
  const points: TerrainPoint[] = [];
  const latStep = (bbox.north - bbox.south) / resolution;
  const lonStep = (bbox.east - bbox.west) / resolution;

  for (let i = 0; i <= resolution; i++) {
    for (let j = 0; j <= resolution; j++) {
      const lat = bbox.south + i * latStep;
      const lon = bbox.west + j * lonStep;
      const [x, y] = geoToLocal(lat, lon, centerLat, centerLon);
      points.push({ x, y, elevation: 0 });
    }
  }
  return points;
}

/**
 * Generate a synthetic scene when API is unavailable.
 */
function generateSyntheticScene(
  lat: number,
  lon: number,
  bbox: { north: number; south: number; east: number; west: number },
): SceneData {
  const buildings: BuildingFootprint[] = [];
  const roads: RoadSegment[] = [];

  // Generate a grid of synthetic buildings
  for (let i = -3; i <= 3; i++) {
    for (let j = -3; j <= 3; j++) {
      if (Math.abs(i) <= 1 && Math.abs(j) <= 1) continue; // Leave center open for roads
      const cx = i * 30;
      const cy = j * 30;
      const w = 15 + Math.random() * 10;
      const h = 15 + Math.random() * 10;
      const levels = 1 + Math.floor(Math.random() * 4);
      buildings.push({
        id: generateId(),
        type: 'building',
        coordinates: [
          [cx - w / 2, cy - h / 2],
          [cx + w / 2, cy - h / 2],
          [cx + w / 2, cy + h / 2],
          [cx - w / 2, cy + h / 2],
        ],
        height: levels * 3.5,
        levels,
        buildingType: 'commercial',
      });
    }
  }

  // Generate cross-roads
  roads.push({
    id: generateId(),
    type: 'road',
    coordinates: [[-150, 0], [150, 0]],
    width: 10,
    roadType: 'primary',
    name: 'Main Street',
    lanes: 2,
  });
  roads.push({
    id: generateId(),
    type: 'road',
    coordinates: [[0, -150], [0, 150]],
    width: 8,
    roadType: 'secondary',
    name: 'Cross Street',
    lanes: 2,
  });

  return {
    sceneId: generateId(),
    center: { latitude: lat, longitude: lon },
    boundingBox: bbox,
    buildings,
    roads,
    terrain: generateTerrainGrid(bbox, lat, lon),
    sidewalks: [
      { id: generateId(), coordinates: [[-150, 6], [150, 6]], width: 2 },
      { id: generateId(), coordinates: [[-150, -6], [150, -6]], width: 2 },
      { id: generateId(), coordinates: [[6, -150], [6, 150]], width: 2 },
      { id: generateId(), coordinates: [[-6, -150], [-6, 150]], width: 2 },
    ],
    parkingLots: [],
    greenSpaces: [],
    waterFeatures: [],
    metadata: {
      source: 'Synthetic (API unavailable)',
      fetchedAt: new Date().toISOString(),
      totalFeatures: buildings.length + roads.length + 4,
      areaSquareMeters: 160_000,
    },
  };
}

/**
 * Geocode an address to coordinates using Nominatim.
 */
export async function geocodeAddress(address: string): Promise<{ latitude: number; longitude: number; displayName: string } | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;

  return new Promise((resolve, _reject) => {
    https.get(url, { headers: { 'User-Agent': 'CourtAccess/1.0' } }, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
      res.on('end', () => {
        try {
          const results = JSON.parse(data) as Array<{ lat: string; lon: string; display_name: string }>;
          if (results.length === 0) {
            resolve(null);
            return;
          }
          resolve({
            latitude: parseFloat(results[0].lat),
            longitude: parseFloat(results[0].lon),
            displayName: results[0].display_name,
          });
        } catch {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}
