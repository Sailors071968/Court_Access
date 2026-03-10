// ============================================================================
// Phase 54 — Terrain Generation Service
// Generates base terrain mesh, elevation data, road mesh, and building
// footprints for the 3D scene renderer.
// ============================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TerrainMesh {
  vertices: Float32Array;
  indices: Uint32Array;
  normals: Float32Array;
  uvs: Float32Array;
  width: number;
  height: number;
  resolution: number;
}

export interface ElevationData {
  grid: number[][];
  minElevation: number;
  maxElevation: number;
  resolution: number;
}

export interface RoadMesh {
  vertices: number[];
  indices: number[];
  width: number;
  roadType: string;
  name?: string;
}

export interface BuildingMesh {
  vertices: number[];
  indices: number[];
  height: number;
  footprint: Array<[number, number]>;
  roofType: 'flat' | 'gabled' | 'hipped';
}

export interface GeneratedTerrain {
  terrain: TerrainMesh;
  elevation: ElevationData;
  roads: RoadMesh[];
  buildings: BuildingMesh[];
}

// ---------------------------------------------------------------------------
// Terrain Mesh Generation
// ---------------------------------------------------------------------------

/**
 * Generate a flat terrain mesh for a given area.
 * The mesh is centered at (0, 0) with given width/height in meters.
 */
export function generateTerrainMesh(
  widthMeters: number,
  heightMeters: number,
  resolution = 32,
  elevationFn?: (x: number, y: number) => number,
): TerrainMesh {
  const vertexCount = (resolution + 1) * (resolution + 1);
  const vertices = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);

  const halfW = widthMeters / 2;
  const halfH = heightMeters / 2;
  const stepX = widthMeters / resolution;
  const stepY = heightMeters / resolution;

  let vi = 0;
  let ni = 0;
  let ui = 0;

  for (let row = 0; row <= resolution; row++) {
    for (let col = 0; col <= resolution; col++) {
      const x = -halfW + col * stepX;
      const z = -halfH + row * stepY;
      const y = elevationFn ? elevationFn(x, z) : 0;

      vertices[vi++] = x;
      vertices[vi++] = y;
      vertices[vi++] = z;

      // Default up normal (will be recalculated if elevation varies)
      normals[ni++] = 0;
      normals[ni++] = 1;
      normals[ni++] = 0;

      uvs[ui++] = col / resolution;
      uvs[ui++] = row / resolution;
    }
  }

  // Generate triangle indices
  const indexCount = resolution * resolution * 6;
  const indices = new Uint32Array(indexCount);
  let ii = 0;

  for (let row = 0; row < resolution; row++) {
    for (let col = 0; col < resolution; col++) {
      const topLeft = row * (resolution + 1) + col;
      const topRight = topLeft + 1;
      const bottomLeft = (row + 1) * (resolution + 1) + col;
      const bottomRight = bottomLeft + 1;

      // First triangle
      indices[ii++] = topLeft;
      indices[ii++] = bottomLeft;
      indices[ii++] = topRight;

      // Second triangle
      indices[ii++] = topRight;
      indices[ii++] = bottomLeft;
      indices[ii++] = bottomRight;
    }
  }

  // Recalculate normals if elevation function provided
  if (elevationFn) {
    recalculateNormals(vertices, indices, normals);
  }

  return {
    vertices,
    indices,
    normals,
    uvs,
    width: widthMeters,
    height: heightMeters,
    resolution,
  };
}

/**
 * Recalculate vertex normals from face normals.
 */
function recalculateNormals(
  vertices: Float32Array,
  indices: Uint32Array,
  normals: Float32Array,
): void {
  // Reset normals
  normals.fill(0);

  for (let i = 0; i < indices.length; i += 3) {
    const ia = indices[i] * 3;
    const ib = indices[i + 1] * 3;
    const ic = indices[i + 2] * 3;

    // Edge vectors
    const e1x = vertices[ib] - vertices[ia];
    const e1y = vertices[ib + 1] - vertices[ia + 1];
    const e1z = vertices[ib + 2] - vertices[ia + 2];
    const e2x = vertices[ic] - vertices[ia];
    const e2y = vertices[ic + 1] - vertices[ia + 1];
    const e2z = vertices[ic + 2] - vertices[ia + 2];

    // Cross product
    const nx = e1y * e2z - e1z * e2y;
    const ny = e1z * e2x - e1x * e2z;
    const nz = e1x * e2y - e1y * e2x;

    // Add to each vertex
    for (const idx of [ia, ib, ic]) {
      normals[idx] += nx;
      normals[idx + 1] += ny;
      normals[idx + 2] += nz;
    }
  }

  // Normalize
  for (let i = 0; i < normals.length; i += 3) {
    const len = Math.sqrt(normals[i] ** 2 + normals[i + 1] ** 2 + normals[i + 2] ** 2);
    if (len > 0) {
      normals[i] /= len;
      normals[i + 1] /= len;
      normals[i + 2] /= len;
    }
  }
}

// ---------------------------------------------------------------------------
// Elevation Data
// ---------------------------------------------------------------------------

/**
 * Generate elevation data grid (flat by default, can use real elevation APIs).
 */
export function generateElevationData(
  widthMeters: number,
  heightMeters: number,
  resolution = 32,
): ElevationData {
  const grid: number[][] = [];
  for (let row = 0; row <= resolution; row++) {
    const rowData: number[] = [];
    for (let col = 0; col <= resolution; col++) {
      // Flat terrain by default; real elevation data can be injected
      rowData.push(0);
    }
    grid.push(rowData);
  }

  return {
    grid,
    minElevation: 0,
    maxElevation: 0,
    resolution,
  };
}

// ---------------------------------------------------------------------------
// Road Mesh Generation
// ---------------------------------------------------------------------------

/**
 * Generate a road mesh from a polyline and width.
 */
export function generateRoadMesh(
  coordinates: Array<[number, number]>,
  width: number,
  roadType: string,
  name?: string,
): RoadMesh {
  const vertices: number[] = [];
  const indices: number[] = [];
  const halfWidth = width / 2;

  for (let i = 0; i < coordinates.length; i++) {
    const [x, z] = coordinates[i];

    // Calculate perpendicular direction
    let dx: number;
    let dz: number;

    if (i < coordinates.length - 1) {
      dx = coordinates[i + 1][0] - x;
      dz = coordinates[i + 1][1] - z;
    } else {
      dx = x - coordinates[i - 1][0];
      dz = z - coordinates[i - 1][1];
    }

    const len = Math.sqrt(dx * dx + dz * dz);
    if (len === 0) continue;

    // Perpendicular direction
    const px = -dz / len;
    const pz = dx / len;

    // Two vertices: left and right of road center
    const baseIdx = vertices.length / 3;
    vertices.push(x + px * halfWidth, 0.05, z + pz * halfWidth); // Slightly above terrain
    vertices.push(x - px * halfWidth, 0.05, z - pz * halfWidth);

    // Create triangles with previous segment
    if (i > 0) {
      const prev = baseIdx - 2;
      indices.push(prev, prev + 1, baseIdx);
      indices.push(prev + 1, baseIdx + 1, baseIdx);
    }
  }

  return { vertices, indices, width, roadType, name };
}

// ---------------------------------------------------------------------------
// Building Mesh Generation
// ---------------------------------------------------------------------------

/**
 * Generate a building mesh from a footprint polygon and height.
 */
export function generateBuildingMesh(
  footprint: Array<[number, number]>,
  height: number,
): BuildingMesh {
  const vertices: number[] = [];
  const indices: number[] = [];
  const n = footprint.length;

  // Bottom face vertices
  for (const [x, z] of footprint) {
    vertices.push(x, 0, z);
  }
  // Top face vertices
  for (const [x, z] of footprint) {
    vertices.push(x, height, z);
  }

  // Side faces
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    const bl = i;
    const br = next;
    const tl = i + n;
    const tr = next + n;

    indices.push(bl, br, tl);
    indices.push(br, tr, tl);
  }

  // Top face (simple fan triangulation)
  for (let i = 1; i < n - 1; i++) {
    indices.push(n, n + i, n + i + 1);
  }

  // Bottom face
  for (let i = 1; i < n - 1; i++) {
    indices.push(0, i + 1, i);
  }

  const roofType: 'flat' | 'gabled' | 'hipped' = height > 20 ? 'flat' : height > 10 ? 'gabled' : 'flat';

  return { vertices, indices, height, footprint, roofType };
}

// ---------------------------------------------------------------------------
// Full Terrain Generation
// ---------------------------------------------------------------------------

/**
 * Generate complete terrain data including mesh, roads, and buildings.
 */
export function generateFullTerrain(
  sceneData: {
    buildings: Array<{ coordinates: Array<[number, number]>; height: number }>;
    roads: Array<{ coordinates: Array<[number, number]>; width: number; roadType: string; name?: string }>;
  },
  areaWidth = 400,
  areaHeight = 400,
): GeneratedTerrain {
  const terrain = generateTerrainMesh(areaWidth, areaHeight);
  const elevation = generateElevationData(areaWidth, areaHeight);

  const roads = sceneData.roads.map((r) =>
    generateRoadMesh(r.coordinates, r.width, r.roadType, r.name)
  );

  const buildings = sceneData.buildings.map((b) =>
    generateBuildingMesh(b.coordinates, b.height)
  );

  return { terrain, elevation, roads, buildings };
}
