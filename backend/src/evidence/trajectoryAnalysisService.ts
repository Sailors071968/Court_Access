// ============================================================================
// Phase 168 — Bullet / Projectile Trajectory Analysis
// Calculates bullet paths, officer line of fire, impact angles, distance
// estimation. Uses scene geometry, weapon type, and ballistic parameters.
// Outputs trajectory vectors and impact predictions.
// ============================================================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TrajectoryAnalysis {
  analysisId?: string;
  caseId: string;
  sceneId?: string;
  trajectories: TrajectoryVector[];
  impactPredictions: ImpactPrediction[];
  lineOfFire: LineOfFire[];
  ballisticParams: BallisticParameters;
  summary: TrajectorySummary;
  createdAt?: Date;
}

export interface TrajectoryVector {
  trajectoryId: string;
  originPoint: Point3D;
  directionVector: Vector3D;
  terminalPoint: Point3D;
  distanceFeet: number;
  elevationAngleDeg: number;
  azimuthAngleDeg: number;
  projectileType: string;
  velocityFps: number;       // feet per second at origin
  terminalVelocityFps: number;
  timeOfFlightMs: number;
  confidence: number;
}

export interface Point3D {
  x: number;
  y: number;
  z: number;
  label?: string;
}

export interface Vector3D {
  dx: number;
  dy: number;
  dz: number;
}

export interface ImpactPrediction {
  impactId: string;
  trajectoryId: string;
  impactPoint: Point3D;
  impactAngleDeg: number;
  impactVelocityFps: number;
  impactEnergy: number;       // foot-pounds
  surfaceType: 'soft_tissue' | 'bone' | 'vehicle_panel' | 'glass' | 'wall' | 'ground' | 'unknown';
  penetrationDepthInches: number;
  ricocheted: boolean;
  confidence: number;
}

export interface LineOfFire {
  fireId: string;
  shooterPosition: Point3D;
  targetPosition: Point3D;
  clearanceAngleDeg: number;
  obstructions: Obstruction[];
  lineIsClear: boolean;
  crossfireRisk: boolean;
  bystanderRisk: BystanderRisk;
}

export interface Obstruction {
  obstructionType: string;
  position: Point3D;
  dimensions: { width: number; height: number; depth: number };
  materialType: 'concrete' | 'wood' | 'metal' | 'glass' | 'vehicle' | 'vegetation' | 'other';
  penetrableByProjectile: boolean;
}

export interface BystanderRisk {
  riskLevel: 'none' | 'low' | 'moderate' | 'high' | 'extreme';
  estimatedBystandersInCone: number;
  coneAngleDeg: number;
  maxRangeOfDanger: number;
}

export interface BallisticParameters {
  weaponType: string;
  caliber: string;
  muzzleVelocityFps: number;
  bulletWeightGrains: number;
  ballisticCoefficient: number;
  effectiveRangeYards: number;
  maxRangeYards: number;
}

export interface TrajectorySummary {
  totalShots: number;
  totalImpacts: number;
  averageDistanceFeet: number;
  maxDistanceFeet: number;
  minDistanceFeet: number;
  crossfireIncidents: number;
  bystanderRiskEvents: number;
  ricochetEvents: number;
}

// ---------------------------------------------------------------------------
// Weapon ballistic profiles
// ---------------------------------------------------------------------------

const BALLISTIC_PROFILES: Record<string, BallisticParameters> = {
  'glock_17_9mm': {
    weaponType: 'Glock 17',
    caliber: '9mm Luger',
    muzzleVelocityFps: 1180,
    bulletWeightGrains: 124,
    ballisticCoefficient: 0.169,
    effectiveRangeYards: 55,
    maxRangeYards: 2300,
  },
  'glock_22_40sw': {
    weaponType: 'Glock 22',
    caliber: '.40 S&W',
    muzzleVelocityFps: 1050,
    bulletWeightGrains: 180,
    ballisticCoefficient: 0.164,
    effectiveRangeYards: 50,
    maxRangeYards: 2100,
  },
  'sig_p320_9mm': {
    weaponType: 'SIG P320',
    caliber: '9mm Luger',
    muzzleVelocityFps: 1200,
    bulletWeightGrains: 115,
    ballisticCoefficient: 0.151,
    effectiveRangeYards: 55,
    maxRangeYards: 2200,
  },
  'ar15_223': {
    weaponType: 'AR-15 / Patrol Rifle',
    caliber: '.223 Remington',
    muzzleVelocityFps: 3150,
    bulletWeightGrains: 55,
    ballisticCoefficient: 0.243,
    effectiveRangeYards: 500,
    maxRangeYards: 3800,
  },
  'remington_870_12ga': {
    weaponType: 'Remington 870',
    caliber: '12 Gauge Slug',
    muzzleVelocityFps: 1600,
    bulletWeightGrains: 437,
    ballisticCoefficient: 0.067,
    effectiveRangeYards: 75,
    maxRangeYards: 900,
  },
  'taser_x26': {
    weaponType: 'TASER X26',
    caliber: 'probe',
    muzzleVelocityFps: 180,
    bulletWeightGrains: 10,
    ballisticCoefficient: 0.01,
    effectiveRangeYards: 12,
    maxRangeYards: 12,
  },
  'default_handgun': {
    weaponType: 'Service Handgun',
    caliber: '9mm',
    muzzleVelocityFps: 1150,
    bulletWeightGrains: 124,
    ballisticCoefficient: 0.160,
    effectiveRangeYards: 50,
    maxRangeYards: 2000,
  },
};

// ---------------------------------------------------------------------------
// Core analysis functions
// ---------------------------------------------------------------------------

/**
 * Compute projectile trajectory analysis for an incident.
 */
export function computeTrajectoryAnalysis(
  caseId: string,
  shots: Array<{
    shotId: string;
    shooterPosition: Point3D;
    aimDirection: Vector3D;
    weaponProfile?: string;
    timestamp?: string;
  }>,
  sceneObstructions: Obstruction[],
  sceneId?: string,
): TrajectoryAnalysis {
  const trajectories: TrajectoryVector[] = [];
  const impacts: ImpactPrediction[] = [];
  const linesOfFire: LineOfFire[] = [];

  const defaultProfile = BALLISTIC_PROFILES['default_handgun'];

  for (const shot of shots) {
    const profile = BALLISTIC_PROFILES[shot.weaponProfile ?? ''] ?? defaultProfile;

    // Calculate trajectory vector
    const trajectory = calculateTrajectory(shot, profile);
    trajectories.push(trajectory);

    // Calculate impact prediction
    const impact = calculateImpact(trajectory, profile, sceneObstructions);
    impacts.push(impact);

    // Calculate line of fire
    const lof = calculateLineOfFire(shot, sceneObstructions);
    linesOfFire.push(lof);
  }

  const distances = trajectories.map(t => t.distanceFeet);
  const summary: TrajectorySummary = {
    totalShots: trajectories.length,
    totalImpacts: impacts.length,
    averageDistanceFeet: distances.length > 0
      ? Math.round(distances.reduce((a, b) => a + b, 0) / distances.length * 10) / 10
      : 0,
    maxDistanceFeet: distances.length > 0 ? Math.max(...distances) : 0,
    minDistanceFeet: distances.length > 0 ? Math.min(...distances) : 0,
    crossfireIncidents: linesOfFire.filter(l => l.crossfireRisk).length,
    bystanderRiskEvents: linesOfFire.filter(l => l.bystanderRisk.riskLevel !== 'none').length,
    ricochetEvents: impacts.filter(i => i.ricocheted).length,
  };

  return {
    caseId,
    sceneId,
    trajectories,
    impactPredictions: impacts,
    lineOfFire: linesOfFire,
    ballisticParams: BALLISTIC_PROFILES[shots[0]?.weaponProfile ?? ''] ?? defaultProfile,
    summary,
  };
}

/**
 * Store trajectory analysis results
 */
export async function storeTrajectoryAnalysis(analysis: TrajectoryAnalysis): Promise<string> {
  const record = await prisma.trajectoryAnalysis.create({
    data: {
      caseId: analysis.caseId,
      sceneId: analysis.sceneId,
      trajectories: JSON.stringify(analysis.trajectories),
      impactPredictions: JSON.stringify(analysis.impactPredictions),
      lineOfFire: JSON.stringify(analysis.lineOfFire),
      ballisticParams: JSON.stringify(analysis.ballisticParams),
      summary: JSON.stringify(analysis.summary),
    },
  });
  return record.analysisId;
}

/**
 * Get trajectory analysis for a case
 */
export async function getCaseTrajectoryAnalysis(caseId: string) {
  return prisma.trajectoryAnalysis.findMany({
    where: { caseId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get available ballistic profiles
 */
export function getBallisticProfiles(): Record<string, BallisticParameters> {
  return { ...BALLISTIC_PROFILES };
}

// ---------------------------------------------------------------------------
// Calculation helpers
// ---------------------------------------------------------------------------

function calculateTrajectory(
  shot: { shotId: string; shooterPosition: Point3D; aimDirection: Vector3D },
  profile: BallisticParameters,
): TrajectoryVector {
  const { shooterPosition, aimDirection } = shot;

  // Normalize direction vector
  const mag = Math.sqrt(aimDirection.dx ** 2 + aimDirection.dy ** 2 + aimDirection.dz ** 2);
  const norm = mag > 0
    ? { dx: aimDirection.dx / mag, dy: aimDirection.dy / mag, dz: aimDirection.dz / mag }
    : { dx: 1, dy: 0, dz: 0 };

  // Calculate effective range in feet
  const rangeFeet = profile.effectiveRangeYards * 3;

  // Terminal point
  const terminalPoint: Point3D = {
    x: shooterPosition.x + norm.dx * rangeFeet,
    y: shooterPosition.y + norm.dy * rangeFeet,
    z: shooterPosition.z + norm.dz * rangeFeet - calculateBulletDrop(rangeFeet, profile),
    label: 'predicted_impact',
  };

  // Calculate distance
  const dx = terminalPoint.x - shooterPosition.x;
  const dy = terminalPoint.y - shooterPosition.y;
  const dz = terminalPoint.z - shooterPosition.z;
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

  // Elevation and azimuth
  const elevationAngle = Math.atan2(norm.dz, Math.sqrt(norm.dx * norm.dx + norm.dy * norm.dy)) * (180 / Math.PI);
  const azimuthAngle = Math.atan2(norm.dy, norm.dx) * (180 / Math.PI);

  // Terminal velocity (approximate drag model)
  const dragFactor = 1 - (distance / (profile.maxRangeYards * 3));
  const terminalVelocity = profile.muzzleVelocityFps * Math.max(0.1, dragFactor);

  // Time of flight
  const avgVelocity = (profile.muzzleVelocityFps + terminalVelocity) / 2;
  const timeOfFlight = avgVelocity > 0 ? (distance / avgVelocity) * 1000 : 0;

  return {
    trajectoryId: shot.shotId,
    originPoint: { ...shooterPosition, label: 'shooter_position' },
    directionVector: norm,
    terminalPoint,
    distanceFeet: Math.round(distance * 10) / 10,
    elevationAngleDeg: Math.round(elevationAngle * 100) / 100,
    azimuthAngleDeg: Math.round(azimuthAngle * 100) / 100,
    projectileType: profile.caliber,
    velocityFps: profile.muzzleVelocityFps,
    terminalVelocityFps: Math.round(terminalVelocity),
    timeOfFlightMs: Math.round(timeOfFlight * 100) / 100,
    confidence: 0.80,
  };
}

function calculateBulletDrop(distanceFeet: number, profile: BallisticParameters): number {
  // Simplified bullet drop calculation: drop = 0.5 * g * t^2
  const g = 32.174; // ft/s^2
  const avgVelocity = profile.muzzleVelocityFps * 0.85;
  const time = avgVelocity > 0 ? distanceFeet / avgVelocity : 0;
  return 0.5 * g * time * time;
}

function calculateImpact(
  trajectory: TrajectoryVector,
  profile: BallisticParameters,
  obstructions: Obstruction[],
): ImpactPrediction {
  // Check if trajectory intersects any obstruction
  let hitObstruction = false;
  let ricocheted = false;

  for (const obs of obstructions) {
    if (trajectoryIntersectsBox(trajectory, obs)) {
      hitObstruction = true;
      if (!obs.penetrableByProjectile && obs.materialType !== 'glass') {
        ricocheted = true;
      }
      break;
    }
  }

  // Impact energy calculation: KE = 0.5 * m * v^2 (converted from grains to pounds)
  const massLbs = profile.bulletWeightGrains / 7000;
  const impactEnergy = 0.5 * massLbs * (trajectory.terminalVelocityFps ** 2) / 32.174;

  // Penetration depth estimation (simplified)
  const penetrationDepth = estimatePenetration(impactEnergy, profile.caliber);

  return {
    impactId: `impact-${trajectory.trajectoryId}`,
    trajectoryId: trajectory.trajectoryId,
    impactPoint: trajectory.terminalPoint,
    impactAngleDeg: Math.abs(trajectory.elevationAngleDeg),
    impactVelocityFps: trajectory.terminalVelocityFps,
    impactEnergy: Math.round(impactEnergy * 10) / 10,
    surfaceType: hitObstruction ? 'wall' : 'unknown',
    penetrationDepthInches: penetrationDepth,
    ricocheted,
    confidence: trajectory.confidence * 0.9,
  };
}

function trajectoryIntersectsBox(trajectory: TrajectoryVector, obs: Obstruction): boolean {
  // Simplified AABB intersection test
  const origin = trajectory.originPoint;
  const dir = trajectory.directionVector;
  const boxMin = {
    x: obs.position.x - obs.dimensions.width / 2,
    y: obs.position.y - obs.dimensions.depth / 2,
    z: obs.position.z,
  };
  const boxMax = {
    x: obs.position.x + obs.dimensions.width / 2,
    y: obs.position.y + obs.dimensions.depth / 2,
    z: obs.position.z + obs.dimensions.height,
  };

  // Ray-AABB intersection
  const tMin = Math.max(
    Math.min((boxMin.x - origin.x) / (dir.dx || 1e-10), (boxMax.x - origin.x) / (dir.dx || 1e-10)),
    Math.min((boxMin.y - origin.y) / (dir.dy || 1e-10), (boxMax.y - origin.y) / (dir.dy || 1e-10)),
    Math.min((boxMin.z - origin.z) / (dir.dz || 1e-10), (boxMax.z - origin.z) / (dir.dz || 1e-10)),
  );
  const tMax = Math.min(
    Math.max((boxMin.x - origin.x) / (dir.dx || 1e-10), (boxMax.x - origin.x) / (dir.dx || 1e-10)),
    Math.max((boxMin.y - origin.y) / (dir.dy || 1e-10), (boxMax.y - origin.y) / (dir.dy || 1e-10)),
    Math.max((boxMin.z - origin.z) / (dir.dz || 1e-10), (boxMax.z - origin.z) / (dir.dz || 1e-10)),
  );

  return tMax >= tMin && tMax >= 0;
}

function estimatePenetration(impactEnergy: number, caliber: string): number {
  // FBI-standard ballistic gelatin penetration estimation
  const baseDepth = caliber.includes('.223') ? 10 : caliber.includes('12 Gauge') ? 15 : 12;
  const energyFactor = Math.min(1.5, impactEnergy / 300);
  return Math.round(baseDepth * energyFactor * 10) / 10;
}

function calculateLineOfFire(
  shot: { shotId: string; shooterPosition: Point3D; aimDirection: Vector3D },
  obstructions: Obstruction[],
): LineOfFire {
  const { shooterPosition, aimDirection } = shot;

  // Calculate target position (100 feet along aim direction)
  const mag = Math.sqrt(aimDirection.dx ** 2 + aimDirection.dy ** 2 + aimDirection.dz ** 2);
  const norm = mag > 0
    ? { dx: aimDirection.dx / mag, dy: aimDirection.dy / mag, dz: aimDirection.dz / mag }
    : { dx: 1, dy: 0, dz: 0 };

  const targetPosition: Point3D = {
    x: shooterPosition.x + norm.dx * 100,
    y: shooterPosition.y + norm.dy * 100,
    z: shooterPosition.z + norm.dz * 100,
    label: 'target_position',
  };

  // Check for obstructions along the line
  const lineObstructions: Obstruction[] = [];
  const trajectory: TrajectoryVector = {
    trajectoryId: shot.shotId,
    originPoint: shooterPosition,
    directionVector: norm,
    terminalPoint: targetPosition,
    distanceFeet: 100,
    elevationAngleDeg: 0,
    azimuthAngleDeg: 0,
    projectileType: '',
    velocityFps: 0,
    terminalVelocityFps: 0,
    timeOfFlightMs: 0,
    confidence: 0.8,
  };

  for (const obs of obstructions) {
    if (trajectoryIntersectsBox(trajectory, obs)) {
      lineObstructions.push(obs);
    }
  }

  // Clearance angle
  const clearanceAngle = lineObstructions.length > 0
    ? Math.atan2(2, 50) * (180 / Math.PI)
    : 180;

  // Bystander risk assessment
  const bystanderRisk = assessBystanderRisk(obstructions, shooterPosition, norm);

  return {
    fireId: `lof-${shot.shotId}`,
    shooterPosition,
    targetPosition,
    clearanceAngleDeg: Math.round(clearanceAngle * 100) / 100,
    obstructions: lineObstructions,
    lineIsClear: lineObstructions.length === 0,
    crossfireRisk: false, // Would need multiple shooter positions to determine
    bystanderRisk,
  };
}

function assessBystanderRisk(
  obstructions: Obstruction[],
  shooterPos: Point3D,
  aimDir: Vector3D,
): BystanderRisk {
  // Simplified bystander risk — in production would use scene population model
  const hasNearbyObstructions = obstructions.some(obs => {
    const dist = Math.sqrt(
      (obs.position.x - shooterPos.x) ** 2 +
      (obs.position.y - shooterPos.y) ** 2,
    );
    return dist < 50; // within 50 feet
  });

  if (!hasNearbyObstructions) {
    return { riskLevel: 'none', estimatedBystandersInCone: 0, coneAngleDeg: 5, maxRangeOfDanger: 0 };
  }

  // Use aim direction to determine cone of danger
  const _coneAngle = 5; // degrees

  return {
    riskLevel: 'low',
    estimatedBystandersInCone: 0,
    coneAngleDeg: _coneAngle,
    maxRangeOfDanger: 200,
  };
}
