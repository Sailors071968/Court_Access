// ============================================================================
// Phases 167-176 — Forensic Reconstruction Engine Routes
// Registers all API endpoints for the forensic reconstruction system.
// ============================================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { analyzeBodycamFootage, getCaseVisionEvents, getCriticalMoments } from './bodycamVisionService.js';
import { computeTrajectoryAnalysis, storeTrajectoryAnalysis, getCaseTrajectoryAnalysis, getBallisticProfiles } from './trajectoryAnalysisService.js';
import { simulateVisibility, storeVisibilitySimulation, getCaseVisibilitySimulations } from './visibilitySimulationService.js';
import { analyzeLineOfSight, storeLineOfSightAnalysis, getCaseLineOfSightAnalyses } from './lineOfSightEngine.js';
import { synchronizeCameras, storeSyncResult, getCaseSyncResults } from './multiCameraSyncService.js';
import { buildSceneGeometry, storeSceneGeometry, getCaseSceneGeometry, exportForTrialExhibit } from './sceneGeometryService.js';
import { buildEvidenceGraph, storeEvidenceGraph, getCaseEvidenceGraphs } from './evidenceSynchronizationEngine.js';
import { generateExpertWitnessPackage, storeExpertWitnessPackage, getCaseExpertPackages } from './expertWitnessPackageExporter.js';
import { generateJuryVisualization, storeJuryVisualization, getCaseJuryVisualizations } from './juryVisualizationService.js';

export async function registerForensicRoutes(app: FastifyInstance): Promise<void> {

  // =========================================================================
  // Phase 167 — Bodycam Vision Analysis
  // =========================================================================

  app.post(
    '/api/forensic/vision/analyze',
    async (
      request: FastifyRequest<{
        Body: {
          caseId: string;
          sourceId: string;
          durationSeconds: number;
          fps?: number;
          description?: string;
        };
      }>,
      reply: FastifyReply,
    ) => {
      try {
        const { caseId, sourceId, durationSeconds, fps, description } = request.body;
        const result = await analyzeBodycamFootage(
          caseId,
          sourceId,
          { durationSeconds, description },
          fps !== undefined ? { frameRate: fps } : {},
        );
        return reply.send({ success: true, data: result });
      } catch (error) {
        return reply.status(500).send({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    },
  );

  app.get(
    '/api/forensic/vision/:caseId',
    async (request: FastifyRequest<{ Params: { caseId: string } }>, reply: FastifyReply) => {
      try {
        const events = await getCaseVisionEvents(request.params.caseId);
        return reply.send({ success: true, data: events });
      } catch (error) {
        return reply.status(500).send({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    },
  );

  app.get(
    '/api/forensic/vision/:caseId/critical',
    async (
      request: FastifyRequest<{
        Params: { caseId: string };
        Querystring: { threshold?: string };
      }>,
      reply: FastifyReply,
    ) => {
      try {
        const moments = await getCriticalMoments(
          request.params.caseId,
          request.query.threshold as Parameters<typeof getCriticalMoments>[1],
        );
        return reply.send({ success: true, data: moments });
      } catch (error) {
        return reply.status(500).send({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    },
  );

  // =========================================================================
  // Phase 168 — Trajectory Analysis
  // =========================================================================

  app.post(
    '/api/forensic/trajectory/analyze',
    async (
      request: FastifyRequest<{
        Body: {
          caseId: string;
          sceneId?: string;
          officerPositions: Array<{ officerId: string; position: { x: number; y: number; z: number }; aimDirection: { dx: number; dy: number; dz: number }; weaponType?: string }>;
          sceneObstacles?: Array<{ obstacleId: string; position: { x: number; y: number; z: number }; dimensions: { width: number; height: number; depth: number }; material: string }>;
          targetPositions?: Array<{ x: number; y: number; z: number }>;
          bystanderPositions?: Array<{ x: number; y: number; z: number }>;
        };
      }>,
      reply: FastifyReply,
    ) => {
      try {
        const { caseId, sceneId, officerPositions, sceneObstacles } = request.body;
        const result = computeTrajectoryAnalysis(
          caseId,
          officerPositions.map(o => ({
            shotId: o.officerId,
            shooterPosition: o.position,
            aimDirection: o.aimDirection,
            weaponProfile: o.weaponType,
          })),
          (sceneObstacles ?? []).map(ob => ({
            obstructionType: ob.material,
            position: ob.position,
            dimensions: ob.dimensions,
            materialType: ob.material,
            penetrableByProjectile: false,
          })) as Parameters<typeof computeTrajectoryAnalysis>[2],
          sceneId,
        );
        const analysisId = await storeTrajectoryAnalysis(result);
        return reply.send({ success: true, data: { analysisId, ...result } });
      } catch (error) {
        return reply.status(500).send({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    },
  );

  app.get(
    '/api/forensic/trajectory/:caseId',
    async (request: FastifyRequest<{ Params: { caseId: string } }>, reply: FastifyReply) => {
      try {
        const analyses = await getCaseTrajectoryAnalysis(request.params.caseId);
        return reply.send({ success: true, data: analyses });
      } catch (error) {
        return reply.status(500).send({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    },
  );

  app.get(
    '/api/forensic/trajectory/profiles',
    async (_req: FastifyRequest, reply: FastifyReply) => {
      try {
        const profiles = getBallisticProfiles();
        return reply.send({ success: true, data: profiles });
      } catch (error) {
        return reply.status(500).send({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    },
  );

  // =========================================================================
  // Phase 169 — Visibility Simulation
  // =========================================================================

  app.post(
    '/api/forensic/visibility/simulate',
    async (
      request: FastifyRequest<{
        Body: {
          caseId: string;
          sceneId?: string;
          conditions: {
            dateTime: string;
            latitude: number;
            longitude: number;
            weatherCondition: string;
            streetLighting: boolean;
            additionalLightSources?: Array<{ type: string; position: { x: number; y: number; z: number }; intensityLumens: number; colorTemperature: number; beamAngleDeg?: number; direction?: { dx: number; dy: number; dz: number } }>;
          };
          observerPosition: { x: number; y: number; z: number };
          subjectPositions: Array<{ subjectId: string; label: string; position: { x: number; y: number; z: number }; heightMeters?: number }>;
          obstacles?: Array<{ obstacleId: string; position: { x: number; y: number; z: number }; dimensions: { width: number; height: number; depth: number }; opacity: number }>;
        };
      }>,
      reply: FastifyReply,
    ) => {
      try {
        const { caseId, sceneId, conditions, observerPosition, subjectPositions, obstacles } = request.body;
        const result = simulateVisibility(
          caseId,
          {
            dateTime: conditions.dateTime,
            latitude: conditions.latitude,
            longitude: conditions.longitude,
            weather: conditions.weatherCondition,
            cloudCoverPercent: 0,
            additionalLightSources: conditions.additionalLightSources,
            observerPositions: [{ ...observerPosition, label: 'observer' }],
            subjectPositions: subjectPositions.map(s => ({ ...s.position, label: s.label })),
            obstructions: obstacles?.map(o => ({
              x: o.position.x,
              y: o.position.y,
              width: o.dimensions.width,
              height: o.dimensions.height,
              label: o.obstacleId,
            })),
          } as Parameters<typeof simulateVisibility>[1],
          sceneId,
        );
        const simulationId = await storeVisibilitySimulation(result);
        return reply.send({ success: true, data: { simulationId, ...result } });
      } catch (error) {
        return reply.status(500).send({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    },
  );

  app.get(
    '/api/forensic/visibility/:caseId',
    async (request: FastifyRequest<{ Params: { caseId: string } }>, reply: FastifyReply) => {
      try {
        const simulations = await getCaseVisibilitySimulations(request.params.caseId);
        return reply.send({ success: true, data: simulations });
      } catch (error) {
        return reply.status(500).send({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    },
  );

  // =========================================================================
  // Phase 170 — Line-of-Sight Analysis
  // =========================================================================

  app.post(
    '/api/forensic/line-of-sight/analyze',
    async (
      request: FastifyRequest<{
        Body: {
          caseId: string;
          sceneId?: string;
          observerPosition: { x: number; y: number; z: number };
          viewDirection: { dx: number; dy: number; dz: number };
          obstacles: Array<{ obstacleId: string; position: { x: number; y: number; z: number }; dimensions: { width: number; height: number; depth: number }; material: string; transparency: number }>;
          targets: Array<{ targetId: string; label: string; position: { x: number; y: number; z: number }; heightMeters: number }>;
          fieldOfViewConfig?: { horizontalDeg: number; verticalDeg: number; focusConeDeg: number };
        };
      }>,
      reply: FastifyReply,
    ) => {
      try {
        const { caseId, sceneId, observerPosition, viewDirection, obstacles, targets, fieldOfViewConfig } = request.body;
        const result = analyzeLineOfSight(
          caseId,
          observerPosition as Parameters<typeof analyzeLineOfSight>[1],
          viewDirection as unknown as Parameters<typeof analyzeLineOfSight>[2],
          obstacles as unknown as Parameters<typeof analyzeLineOfSight>[3],
          targets as unknown as Parameters<typeof analyzeLineOfSight>[4],
          { fieldOfView: fieldOfViewConfig, sceneId },
        );
        const analysisId = await storeLineOfSightAnalysis(result);
        return reply.send({ success: true, data: { analysisId, ...result } });
      } catch (error) {
        return reply.status(500).send({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    },
  );

  app.get(
    '/api/forensic/line-of-sight/:caseId',
    async (request: FastifyRequest<{ Params: { caseId: string } }>, reply: FastifyReply) => {
      try {
        const analyses = await getCaseLineOfSightAnalyses(request.params.caseId);
        return reply.send({ success: true, data: analyses });
      } catch (error) {
        return reply.status(500).send({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    },
  );

  // =========================================================================
  // Phase 171 — Multi-Camera Synchronization
  // =========================================================================

  app.post(
    '/api/forensic/camera-sync/synchronize',
    async (
      request: FastifyRequest<{
        Body: {
          caseId: string;
          sources: Array<{
            sourceId: string;
            sourceType: string;
            label: string;
            startTimestamp: string;
            endTimestamp: string;
            fps: number;
            hasAudio: boolean;
            audioSampleRate?: number;
            gpsCoordinates?: { lat: number; lon: number };
            events: Array<{ timestamp: string; eventType: string; description: string }>;
            audioFingerprint?: number[];
          }>;
        };
      }>,
      reply: FastifyReply,
    ) => {
      try {
        const { caseId, sources } = request.body;
        const result = synchronizeCameras(
          caseId,
          sources.map(s => ({
            ...s,
            sourceType: s.sourceType as 'bodycam' | 'dashcam' | 'surveillance' | 'bystander',
          })) as unknown as Parameters<typeof synchronizeCameras>[1],
        );
        const syncId = await storeSyncResult(result);
        return reply.send({ success: true, data: { syncId, ...result } });
      } catch (error) {
        return reply.status(500).send({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    },
  );

  app.get(
    '/api/forensic/camera-sync/:caseId',
    async (request: FastifyRequest<{ Params: { caseId: string } }>, reply: FastifyReply) => {
      try {
        const results = await getCaseSyncResults(request.params.caseId);
        return reply.send({ success: true, data: results });
      } catch (error) {
        return reply.status(500).send({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    },
  );

  // =========================================================================
  // Phase 172 — Scene Geometry
  // =========================================================================

  app.post(
    '/api/forensic/scene/build',
    async (
      request: FastifyRequest<{
        Body: {
          caseId: string;
          centerLat: number;
          centerLon: number;
          radiusMeters: number;
          aerialImageryUrl?: string;
          lidarDataUrl?: string;
          manualAnnotations?: Array<{
            annotationType: string;
            position: { x: number; y: number; z?: number };
            dimensions?: { width: number; height: number; depth?: number };
            label: string;
            properties?: Record<string, string>;
          }>;
        };
      }>,
      reply: FastifyReply,
    ) => {
      try {
        const input = request.body;
        const geometry = buildSceneGeometry({
          ...input,
          manualAnnotations: input.manualAnnotations?.map(a => ({
            ...a,
            annotationType: a.annotationType as 'building' | 'vehicle' | 'obstacle' | 'road' | 'vegetation',
          })),
        });
        const geometryId = await storeSceneGeometry(geometry);
        return reply.send({ success: true, data: { geometryId, ...geometry } });
      } catch (error) {
        return reply.status(500).send({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    },
  );

  app.get(
    '/api/forensic/scene/:caseId',
    async (request: FastifyRequest<{ Params: { caseId: string } }>, reply: FastifyReply) => {
      try {
        const geometries = await getCaseSceneGeometry(request.params.caseId);
        return reply.send({ success: true, data: geometries });
      } catch (error) {
        return reply.status(500).send({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    },
  );

  app.get(
    '/api/forensic/scene/:caseId/exhibit',
    async (request: FastifyRequest<{ Params: { caseId: string } }>, reply: FastifyReply) => {
      try {
        const geometries = await getCaseSceneGeometry(request.params.caseId);
        if (geometries.length === 0) {
          return reply.status(404).send({ success: false, error: 'No scene geometry found for this case' });
        }
        const latest = geometries[0];
        const parsed = {
          caseId: latest.caseId,
          bounds: JSON.parse(latest.bounds),
          buildings: JSON.parse(latest.buildings),
          roads: JSON.parse(latest.roads),
          sidewalks: JSON.parse(latest.sidewalks),
          vehicles: JSON.parse(latest.vehicles),
          vegetation: JSON.parse(latest.vegetation),
          obstacles: JSON.parse(latest.obstacles),
          terrain: JSON.parse(latest.terrain),
          metadata: JSON.parse(latest.metadata),
        };
        const exhibit = exportForTrialExhibit(parsed);
        return reply.send({ success: true, data: exhibit });
      } catch (error) {
        return reply.status(500).send({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    },
  );

  // =========================================================================
  // Phase 173 — Event Timeline (API for frontend page)
  // =========================================================================

  app.get(
    '/api/forensic/timeline/:caseId',
    async (request: FastifyRequest<{ Params: { caseId: string } }>, reply: FastifyReply) => {
      try {
        const { PrismaClient } = await import('@prisma/client');
        const prisma = new PrismaClient();
        const events = await prisma.evidenceEvent.findMany({
          where: { caseId: request.params.caseId },
          orderBy: { timestamp: 'asc' },
        });

        const timelineEvents = events.map(e => ({
          eventId: e.eventId,
          timestamp: e.timestamp,
          eventType: e.eventType,
          description: e.description,
          sourceType: e.sourceType,
          confidence: e.confidence,
          policyReferences: [],
          significance: e.confidence > 0.85 ? 'notable' : 'routine',
        }));

        const timestamps = events.map(e => {
          const p = e.timestamp.split(':').map(Number);
          return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : 0;
        });
        const duration = timestamps.length > 1
          ? Math.max(...timestamps) - Math.min(...timestamps)
          : 0;

        return reply.send({
          success: true,
          data: {
            events: timelineEvents,
            clusters: [],
            cameras: [],
            totalDurationSeconds: duration,
            startTime: events[0]?.timestamp ?? '00:00:00',
            endTime: events[events.length - 1]?.timestamp ?? '00:00:00',
          },
        });
      } catch (error) {
        return reply.status(500).send({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    },
  );

  // =========================================================================
  // Phase 174 — Evidence Graph
  // =========================================================================

  app.post(
    '/api/forensic/evidence-graph/build',
    async (
      request: FastifyRequest<{
        Body: {
          caseId: string;
          videoSources?: Array<{ sourceId: string; sourceType: string; timestamps: Array<{ time: string; description: string; eventType: string }> }>;
          audioTranscripts?: Array<{ sourceId: string; segments: Array<{ time: string; speaker: string; text: string }> }>;
          policyRefs?: Array<{ ruleId: string; policySection: string; ruleText: string; applicableActions: string[] }>;
          sceneData?: { sceneId: string; elements: Array<{ elementId: string; type: string; position: string; description: string }> };
          visionEvents?: Array<{ timestamp: string; category: string; confidence: number; description: string }>;
        };
      }>,
      reply: FastifyReply,
    ) => {
      try {
        const { caseId, videoSources, audioTranscripts, policyRefs, sceneData, visionEvents } = request.body;
        const graph = buildEvidenceGraph(
          caseId,
          (videoSources ?? []).map(v => ({ ...v, sourceType: v.sourceType as 'bodycam' | 'dashcam' | 'surveillance' })),
          audioTranscripts ?? [],
          policyRefs ?? [],
          sceneData,
          visionEvents,
        );
        const graphId = await storeEvidenceGraph(graph);
        return reply.send({ success: true, data: { graphId, ...graph } });
      } catch (error) {
        return reply.status(500).send({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    },
  );

  app.get(
    '/api/forensic/evidence-graph/:caseId',
    async (request: FastifyRequest<{ Params: { caseId: string } }>, reply: FastifyReply) => {
      try {
        const graphs = await getCaseEvidenceGraphs(request.params.caseId);
        return reply.send({ success: true, data: graphs });
      } catch (error) {
        return reply.status(500).send({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    },
  );

  // =========================================================================
  // Phase 175 — Expert Witness Package
  // =========================================================================

  app.post(
    '/api/forensic/expert-package/generate',
    async (
      request: FastifyRequest<{
        Body: {
          caseId: string;
          expertInfo: { name?: string; credentials?: string; specialization?: string; caseRole: string; preparedFor: string };
          options?: { includeScene?: boolean; includeTrajectory?: boolean; includeVisibility?: boolean; includeLineOfSight?: boolean; exportFormat?: string };
        };
      }>,
      reply: FastifyReply,
    ) => {
      try {
        const { caseId, expertInfo, options } = request.body;
        const pkg = await generateExpertWitnessPackage(caseId, expertInfo, options as Parameters<typeof generateExpertWitnessPackage>[2]);
        const packageId = await storeExpertWitnessPackage(pkg);
        return reply.send({ success: true, data: { packageId, ...pkg } });
      } catch (error) {
        return reply.status(500).send({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    },
  );

  app.get(
    '/api/forensic/expert-package/:caseId',
    async (request: FastifyRequest<{ Params: { caseId: string } }>, reply: FastifyReply) => {
      try {
        const packages = await getCaseExpertPackages(request.params.caseId);
        return reply.send({ success: true, data: packages });
      } catch (error) {
        return reply.status(500).send({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    },
  );

  // =========================================================================
  // Phase 176 — Jury Visualization
  // =========================================================================

  app.post(
    '/api/forensic/jury-view/generate',
    async (
      request: FastifyRequest<{
        Body: {
          caseId: string;
          title: string;
          options?: {
            simplificationLevel?: string;
            theme?: string;
            fontSize?: string;
          };
        };
      }>,
      reply: FastifyReply,
    ) => {
      try {
        const { caseId, title, options } = request.body;
        const viz = await generateJuryVisualization(caseId, title, options as Parameters<typeof generateJuryVisualization>[2]);
        const visualizationId = await storeJuryVisualization(viz);
        return reply.send({ success: true, data: { visualizationId, ...viz } });
      } catch (error) {
        return reply.status(500).send({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    },
  );

  app.get(
    '/api/forensic/jury-view/:caseId',
    async (request: FastifyRequest<{ Params: { caseId: string } }>, reply: FastifyReply) => {
      try {
        const visualizations = await getCaseJuryVisualizations(request.params.caseId);
        return reply.send({ success: true, data: visualizations });
      } catch (error) {
        return reply.status(500).send({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    },
  );
}
