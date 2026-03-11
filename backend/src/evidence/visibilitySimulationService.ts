// ============================================================================
// Phase 169 — Lighting / Visibility Simulation
// Simulates ambient, artificial, and natural lighting conditions at the time
// of an incident. Computes visibility maps, shadow maps, light intensity,
// and "subject visibility at officer position" percentages.
// Inputs: time of day, GPS location, date, weather, street lighting, vehicle lights.
// ============================================================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VisibilitySimulation {
  simulationId?: string;
  caseId: string;
  sceneId?: string;
  inputConditions: LightingConditions;
  visibilityMap: VisibilityMap;
  shadowMap: ShadowMap;
  lightSources: LightSource[];
  subjectVisibility: SubjectVisibility[];
  summary: VisibilitySummary;
  createdAt?: Date;
}

export interface LightingConditions {
  dateTime: string;              // ISO 8601
  latitude: number;
  longitude: number;
  timeOfDay: 'dawn' | 'morning' | 'midday' | 'afternoon' | 'dusk' | 'night';
  sunAltitudeDeg: number;       // degrees above horizon (-90 to 90)
  sunAzimuthDeg: number;        // compass bearing of sun
  weatherCondition: WeatherCondition;
  ambientLightLux: number;
  moonPhase?: string;
  cloudCoverPercent: number;
}

export type WeatherCondition =
  | 'clear'
  | 'partly_cloudy'
  | 'overcast'
  | 'fog'
  | 'rain'
  | 'heavy_rain'
  | 'snow'
  | 'haze'
  | 'smoke';

export interface LightSource {
  sourceId: string;
  sourceType: 'sun' | 'moon' | 'streetlight' | 'vehicle_headlight' | 'vehicle_taillight'
    | 'spotlight' | 'flashlight' | 'building_light' | 'emergency_light' | 'fire';
  position: { x: number; y: number; z: number };
  intensityLumens: number;
  colorTemperatureK: number;
  beamAngleDeg: number;
  directionVector?: { dx: number; dy: number; dz: number };
  isActive: boolean;
}

export interface VisibilityMap {
  gridSizeMeters: number;
  gridWidth: number;
  gridHeight: number;
  cells: VisibilityCell[];
}

export interface VisibilityCell {
  gridX: number;
  gridY: number;
  lightIntensityLux: number;
  visibilityPercent: number;    // 0-100 how visible an object here would be
  dominantLightSource: string;
  inShadow: boolean;
  colorRendering: number;       // 0-100 ability to distinguish colors
}

export interface ShadowMap {
  shadowRegions: ShadowRegion[];
  totalShadowAreaPercent: number;
  shadowDirectionDeg: number;   // direction shadows point
  shadowLengthFactor: number;   // multiplier for object height → shadow length
}

export interface ShadowRegion {
  regionId: string;
  castBy: string;               // what object casts this shadow
  polygon: Array<{ x: number; y: number }>;
  shadowDepthPercent: number;   // 0-100 how dark the shadow is
}

export interface SubjectVisibility {
  observerPosition: { x: number; y: number; z: number; label: string };
  subjectPosition: { x: number; y: number; z: number; label: string };
  visibilityPercent: number;
  factors: VisibilityFactor[];
  canIdentifyFace: boolean;
  canIdentifyClothing: boolean;
  canDetectWeapon: boolean;
  canReadText: boolean;
  effectiveVisualRange: number; // feet
}

export interface VisibilityFactor {
  factor: string;
  impact: 'positive' | 'negative' | 'neutral';
  magnitude: number;            // 0-1 how much this factor affects visibility
  description: string;
}

export interface VisibilitySummary {
  overallVisibilityPercent: number;
  lightingCategory: 'excellent' | 'good' | 'fair' | 'poor' | 'very_poor' | 'near_zero';
  primaryLightSource: string;
  averageLuxLevel: number;
  criticalFindings: string[];
}

// ---------------------------------------------------------------------------
// Solar position calculations
// ---------------------------------------------------------------------------

/**
 * Calculate sun position from date, time, and GPS coordinates.
 * Simplified solar position algorithm.
 */
export function calculateSunPosition(
  dateTime: string,
  latitude: number,
  longitude: number,
): { altitudeDeg: number; azimuthDeg: number } {
  const date = new Date(dateTime);
  const dayOfYear = getDayOfYear(date);
  const hour = date.getUTCHours() + date.getUTCMinutes() / 60;

  // Solar declination (simplified)
  const declination = 23.45 * Math.sin((360 / 365) * (dayOfYear - 81) * (Math.PI / 180));

  // Hour angle
  const solarNoon = 12 - longitude / 15;
  const hourAngle = (hour - solarNoon) * 15;

  // Solar altitude
  const latRad = latitude * (Math.PI / 180);
  const decRad = declination * (Math.PI / 180);
  const haRad = hourAngle * (Math.PI / 180);

  const sinAlt = Math.sin(latRad) * Math.sin(decRad) +
    Math.cos(latRad) * Math.cos(decRad) * Math.cos(haRad);
  const altitude = Math.asin(Math.max(-1, Math.min(1, sinAlt))) * (180 / Math.PI);

  // Solar azimuth
  const cosAz = (Math.sin(decRad) - Math.sin(latRad) * sinAlt) /
    (Math.cos(latRad) * Math.cos(Math.asin(sinAlt)));
  let azimuth = Math.acos(Math.max(-1, Math.min(1, cosAz))) * (180 / Math.PI);
  if (hourAngle > 0) azimuth = 360 - azimuth;

  return {
    altitudeDeg: Math.round(altitude * 100) / 100,
    azimuthDeg: Math.round(azimuth * 100) / 100,
  };
}

function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

// ---------------------------------------------------------------------------
// Ambient light estimation
// ---------------------------------------------------------------------------

/**
 * Estimate ambient light level in lux based on conditions.
 */
export function estimateAmbientLight(
  sunAltitude: number,
  weather: WeatherCondition,
  cloudCover: number,
): number {
  // Base lux from sun altitude
  let baseLux: number;
  if (sunAltitude > 50) baseLux = 100000;       // Direct sunlight
  else if (sunAltitude > 30) baseLux = 50000;    // Bright daylight
  else if (sunAltitude > 10) baseLux = 10000;    // Overcast day
  else if (sunAltitude > 0) baseLux = 1000;      // Dawn/dusk
  else if (sunAltitude > -6) baseLux = 10;       // Civil twilight
  else if (sunAltitude > -12) baseLux = 1;       // Nautical twilight
  else if (sunAltitude > -18) baseLux = 0.1;     // Astronomical twilight
  else baseLux = 0.001;                          // Night

  // Weather reduction factor
  const weatherFactors: Record<WeatherCondition, number> = {
    clear: 1.0,
    partly_cloudy: 0.8,
    overcast: 0.4,
    fog: 0.15,
    rain: 0.3,
    heavy_rain: 0.15,
    snow: 0.5,
    haze: 0.6,
    smoke: 0.3,
  };

  const weatherFactor = weatherFactors[weather] ?? 1.0;
  const cloudFactor = 1 - (cloudCover / 100) * 0.6;

  return Math.round(baseLux * weatherFactor * cloudFactor * 100) / 100;
}

// ---------------------------------------------------------------------------
// Time of day classification
// ---------------------------------------------------------------------------

function classifyTimeOfDay(sunAltitude: number): LightingConditions['timeOfDay'] {
  if (sunAltitude < -6) return 'night';
  if (sunAltitude < 0) return 'dawn'; // or dusk
  if (sunAltitude < 20) return 'morning';
  if (sunAltitude > 50) return 'midday';
  if (sunAltitude > 30) return 'afternoon';
  return 'dusk';
}

// ---------------------------------------------------------------------------
// Core simulation
// ---------------------------------------------------------------------------

/**
 * Run full visibility simulation for an incident scene.
 */
export function simulateVisibility(
  caseId: string,
  input: {
    dateTime: string;
    latitude: number;
    longitude: number;
    weather: WeatherCondition;
    cloudCoverPercent: number;
    additionalLightSources?: Omit<LightSource, 'sourceId'>[];
    observerPositions: Array<{ x: number; y: number; z: number; label: string }>;
    subjectPositions: Array<{ x: number; y: number; z: number; label: string }>;
    obstructions?: Array<{ x: number; y: number; width: number; height: number; label: string }>;
  },
  sceneId?: string,
): VisibilitySimulation {
  // Calculate sun position
  const sunPos = calculateSunPosition(input.dateTime, input.latitude, input.longitude);

  // Estimate ambient light
  const ambientLux = estimateAmbientLight(sunPos.altitudeDeg, input.weather, input.cloudCoverPercent);

  // Classify time of day
  const timeOfDay = classifyTimeOfDay(sunPos.altitudeDeg);

  // Build lighting conditions
  const conditions: LightingConditions = {
    dateTime: input.dateTime,
    latitude: input.latitude,
    longitude: input.longitude,
    timeOfDay,
    sunAltitudeDeg: sunPos.altitudeDeg,
    sunAzimuthDeg: sunPos.azimuthDeg,
    weatherCondition: input.weather,
    ambientLightLux: ambientLux,
    cloudCoverPercent: input.cloudCoverPercent,
  };

  // Generate light sources
  const lightSources = generateLightSources(conditions, input.additionalLightSources);

  // Generate visibility map (10m grid)
  const visibilityMap = generateVisibilityMap(lightSources, ambientLux, 10, 10, 10);

  // Generate shadow map
  const shadowMap = generateShadowMap(sunPos, input.obstructions ?? []);

  // Calculate subject visibility from each observer position
  const subjectVisibility: SubjectVisibility[] = [];
  for (const observer of input.observerPositions) {
    for (const subject of input.subjectPositions) {
      const sv = calculateSubjectVisibility(observer, subject, ambientLux, lightSources, conditions, input.obstructions ?? []);
      subjectVisibility.push(sv);
    }
  }

  // Summary
  const avgVisibility = subjectVisibility.length > 0
    ? subjectVisibility.reduce((sum, sv) => sum + sv.visibilityPercent, 0) / subjectVisibility.length
    : 0;

  const lightingCategory = categorizeLighting(avgVisibility);
  const criticalFindings: string[] = [];

  if (avgVisibility < 30) criticalFindings.push('Visibility critically low — identification unreliable');
  if (ambientLux < 1) criticalFindings.push('Near-darkness conditions — no natural light available');
  if (input.weather === 'fog') criticalFindings.push('Fog significantly reduces visibility range');
  if (input.weather === 'heavy_rain') criticalFindings.push('Heavy rain impairs both visibility and depth perception');
  if (!subjectVisibility.some(sv => sv.canIdentifyFace)) {
    criticalFindings.push('Facial identification not possible under these conditions');
  }

  const summary: VisibilitySummary = {
    overallVisibilityPercent: Math.round(avgVisibility * 10) / 10,
    lightingCategory,
    primaryLightSource: lightSources.length > 0 ? lightSources[0].sourceType : 'none',
    averageLuxLevel: ambientLux,
    criticalFindings,
  };

  return {
    caseId,
    sceneId,
    inputConditions: conditions,
    visibilityMap,
    shadowMap,
    lightSources,
    subjectVisibility,
    summary,
  };
}

/**
 * Store visibility simulation results
 */
export async function storeVisibilitySimulation(sim: VisibilitySimulation): Promise<string> {
  const record = await prisma.visibilitySimulation.create({
    data: {
      caseId: sim.caseId,
      sceneId: sim.sceneId,
      inputConditions: JSON.stringify(sim.inputConditions),
      visibilityMap: JSON.stringify(sim.visibilityMap),
      shadowMap: JSON.stringify(sim.shadowMap),
      lightSources: JSON.stringify(sim.lightSources),
      subjectVisibility: JSON.stringify(sim.subjectVisibility),
      summary: JSON.stringify(sim.summary),
    },
  });
  return record.simulationId;
}

/**
 * Get visibility simulations for a case
 */
export async function getCaseVisibilitySimulations(caseId: string) {
  return prisma.visibilitySimulation.findMany({
    where: { caseId },
    orderBy: { createdAt: 'desc' },
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateLightSources(
  conditions: LightingConditions,
  additional?: Omit<LightSource, 'sourceId'>[],
): LightSource[] {
  const sources: LightSource[] = [];

  // Sun
  if (conditions.sunAltitudeDeg > -6) {
    const sunAzRad = conditions.sunAzimuthDeg * (Math.PI / 180);
    const sunAltRad = conditions.sunAltitudeDeg * (Math.PI / 180);
    sources.push({
      sourceId: 'sun',
      sourceType: 'sun',
      position: {
        x: Math.cos(sunAzRad) * 1000,
        y: Math.sin(sunAzRad) * 1000,
        z: Math.sin(sunAltRad) * 1000,
      },
      intensityLumens: conditions.ambientLightLux * 100,
      colorTemperatureK: conditions.sunAltitudeDeg > 10 ? 5500 : 3000,
      beamAngleDeg: 0.53,  // sun subtends ~0.53 degrees
      isActive: true,
    });
  }

  // Moon (night only)
  if (conditions.timeOfDay === 'night') {
    sources.push({
      sourceId: 'moon',
      sourceType: 'moon',
      position: { x: 500, y: 300, z: 800 },
      intensityLumens: 0.3,
      colorTemperatureK: 4100,
      beamAngleDeg: 0.52,
      isActive: true,
    });
  }

  // Additional sources
  if (additional) {
    additional.forEach((src, idx) => {
      sources.push({ ...src, sourceId: `additional-${idx}` });
    });
  }

  return sources;
}

function generateVisibilityMap(
  lightSources: LightSource[],
  ambientLux: number,
  gridSize: number,
  width: number,
  height: number,
): VisibilityMap {
  const cells: VisibilityCell[] = [];

  for (let gy = 0; gy < height; gy++) {
    for (let gx = 0; gx < width; gx++) {
      let totalLux = ambientLux;
      let dominantSource = 'ambient';
      let maxSourceLux = ambientLux;

      for (const source of lightSources) {
        const dx = gx * gridSize - source.position.x;
        const dy = gy * gridSize - source.position.y;
        const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const sourceLux = source.intensityLumens / (4 * Math.PI * dist * dist);
        totalLux += sourceLux;
        if (sourceLux > maxSourceLux) {
          maxSourceLux = sourceLux;
          dominantSource = source.sourceId;
        }
      }

      const visPercent = luxToVisibilityPercent(totalLux);
      const colorRendering = Math.min(100, totalLux > 50 ? 90 : totalLux * 1.8);

      cells.push({
        gridX: gx,
        gridY: gy,
        lightIntensityLux: Math.round(totalLux * 100) / 100,
        visibilityPercent: visPercent,
        dominantLightSource: dominantSource,
        inShadow: false,
        colorRendering: Math.round(colorRendering),
      });
    }
  }

  return { gridSizeMeters: gridSize, gridWidth: width, gridHeight: height, cells };
}

function generateShadowMap(
  sunPos: { altitudeDeg: number; azimuthDeg: number },
  obstructions: Array<{ x: number; y: number; width: number; height: number; label: string }>,
): ShadowMap {
  const regions: ShadowRegion[] = [];

  if (sunPos.altitudeDeg <= 0) {
    return {
      shadowRegions: [],
      totalShadowAreaPercent: 0,
      shadowDirectionDeg: 0,
      shadowLengthFactor: 0,
    };
  }

  const shadowDirection = (sunPos.azimuthDeg + 180) % 360;
  const shadowLength = sunPos.altitudeDeg > 0
    ? 1 / Math.tan(sunPos.altitudeDeg * (Math.PI / 180))
    : 10;

  for (const [idx, obs] of obstructions.entries()) {
    const shadowDirRad = shadowDirection * (Math.PI / 180);
    const len = obs.height * shadowLength;
    const dx = Math.cos(shadowDirRad) * len;
    const dy = Math.sin(shadowDirRad) * len;

    regions.push({
      regionId: `shadow-${idx}`,
      castBy: obs.label,
      polygon: [
        { x: obs.x - obs.width / 2, y: obs.y },
        { x: obs.x + obs.width / 2, y: obs.y },
        { x: obs.x + obs.width / 2 + dx, y: obs.y + dy },
        { x: obs.x - obs.width / 2 + dx, y: obs.y + dy },
      ],
      shadowDepthPercent: Math.min(80, 40 + (90 - sunPos.altitudeDeg)),
    });
  }

  return {
    shadowRegions: regions,
    totalShadowAreaPercent: Math.min(60, regions.length * 5),
    shadowDirectionDeg: shadowDirection,
    shadowLengthFactor: Math.round(shadowLength * 100) / 100,
  };
}

function calculateSubjectVisibility(
  observer: { x: number; y: number; z: number; label: string },
  subject: { x: number; y: number; z: number; label: string },
  ambientLux: number,
  lightSources: LightSource[],
  conditions: LightingConditions,
  obstructions: Array<{ x: number; y: number; width: number; height: number; label: string }>,
): SubjectVisibility {
  const dx = subject.x - observer.x;
  const dy = subject.y - observer.y;
  const dz = subject.z - observer.z;
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

  // Calculate light at subject position
  let subjectLux = ambientLux;
  for (const source of lightSources) {
    const sdx = subject.x - source.position.x;
    const sdy = subject.y - source.position.y;
    const sdist = Math.max(1, Math.sqrt(sdx * sdx + sdy * sdy));
    subjectLux += source.intensityLumens / (4 * Math.PI * sdist * sdist);
  }

  // Base visibility from light level
  let visPercent = luxToVisibilityPercent(subjectLux);

  // Distance penalty
  const distancePenalty = Math.max(0, (distance - 20) / 200) * 30;
  visPercent = Math.max(0, visPercent - distancePenalty);

  // Weather penalty
  const weatherPenalties: Record<WeatherCondition, number> = {
    clear: 0, partly_cloudy: 2, overcast: 5, fog: 40,
    rain: 15, heavy_rain: 30, snow: 10, haze: 20, smoke: 35,
  };
  visPercent = Math.max(0, visPercent - (weatherPenalties[conditions.weatherCondition] ?? 0));

  // Check line of sight obstructions
  let obstructed = false;
  for (const obs of obstructions) {
    if (isLineObstructed(observer, subject, obs)) {
      obstructed = true;
      visPercent *= 0.1;
      break;
    }
  }

  visPercent = Math.round(Math.min(100, Math.max(0, visPercent)) * 10) / 10;

  // Visibility factors
  const factors: VisibilityFactor[] = [];
  factors.push({
    factor: 'ambient_light',
    impact: ambientLux > 100 ? 'positive' : ambientLux > 1 ? 'neutral' : 'negative',
    magnitude: Math.min(1, ambientLux / 1000),
    description: `Ambient light: ${ambientLux.toFixed(1)} lux`,
  });
  factors.push({
    factor: 'distance',
    impact: distance < 20 ? 'positive' : distance < 50 ? 'neutral' : 'negative',
    magnitude: Math.min(1, distance / 200),
    description: `Distance: ${distance.toFixed(1)} feet`,
  });
  factors.push({
    factor: 'weather',
    impact: weatherPenalties[conditions.weatherCondition] > 10 ? 'negative' : 'neutral',
    magnitude: (weatherPenalties[conditions.weatherCondition] ?? 0) / 40,
    description: `Weather: ${conditions.weatherCondition}`,
  });
  if (obstructed) {
    factors.push({
      factor: 'obstruction',
      impact: 'negative',
      magnitude: 0.9,
      description: 'Line of sight obstructed',
    });
  }

  // Capability assessments
  const canIdentifyFace = visPercent > 60 && distance < 30;
  const canIdentifyClothing = visPercent > 40 && distance < 60;
  const canDetectWeapon = visPercent > 50 && distance < 50;
  const canReadText = visPercent > 70 && distance < 15;

  // Effective visual range
  const effectiveRange = visPercent > 80 ? 100
    : visPercent > 60 ? 60
      : visPercent > 40 ? 30
        : visPercent > 20 ? 15
          : 5;

  return {
    observerPosition: observer,
    subjectPosition: subject,
    visibilityPercent: visPercent,
    factors,
    canIdentifyFace,
    canIdentifyClothing,
    canDetectWeapon,
    canReadText,
    effectiveVisualRange: effectiveRange,
  };
}

function luxToVisibilityPercent(lux: number): number {
  if (lux >= 10000) return 100;
  if (lux >= 1000) return 90;
  if (lux >= 100) return 80;
  if (lux >= 50) return 70;
  if (lux >= 10) return 55;
  if (lux >= 1) return 35;
  if (lux >= 0.1) return 15;
  if (lux >= 0.01) return 5;
  return 1;
}

function categorizeLighting(visPercent: number): VisibilitySummary['lightingCategory'] {
  if (visPercent >= 80) return 'excellent';
  if (visPercent >= 60) return 'good';
  if (visPercent >= 40) return 'fair';
  if (visPercent >= 20) return 'poor';
  if (visPercent >= 5) return 'very_poor';
  return 'near_zero';
}

function isLineObstructed(
  from: { x: number; y: number; z: number },
  to: { x: number; y: number; z: number },
  obs: { x: number; y: number; width: number; height: number },
): boolean {
  // Simple 2D line-rectangle intersection
  const minX = obs.x - obs.width / 2;
  const maxX = obs.x + obs.width / 2;
  const minY = obs.y - obs.width / 2;
  const maxY = obs.y + obs.width / 2;

  const dx = to.x - from.x;
  const dy = to.y - from.y;

  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return false;

  const tMinX = dx !== 0 ? (minX - from.x) / dx : -Infinity;
  const tMaxX = dx !== 0 ? (maxX - from.x) / dx : Infinity;
  const tMinY = dy !== 0 ? (minY - from.y) / dy : -Infinity;
  const tMaxY = dy !== 0 ? (maxY - from.y) / dy : Infinity;

  const tEnter = Math.max(Math.min(tMinX, tMaxX), Math.min(tMinY, tMaxY));
  const tExit = Math.min(Math.max(tMinX, tMaxX), Math.max(tMinY, tMaxY));

  return tExit >= tEnter && tExit >= 0 && tEnter <= 1;
}
