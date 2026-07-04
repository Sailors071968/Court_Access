// ============================================================================
// Phases 53-64 — Exhibit Routes
// API routes for 3D Trial Exhibit Generator system.
// Scene creation, save/load, geocoding, export.
// ============================================================================

import { PrismaClient } from '@prisma/client';
import type { FastifyInstance, FastifyReply } from 'fastify';
import type { AuthenticatedRequest } from '../security/authMiddleware.js';
import { create3DScene, geocodeAddress } from './sceneBuilderService.js';
import { exportAsPng, exportAsHtml } from './export/exhibitExporter.js';
import type { SceneCoordinates } from './sceneBuilderService.js';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RouteResponse<T = unknown> {
  success: boolean;
  data: T | null;
  error?: string;
}

// ---------------------------------------------------------------------------
// Scene Creation
// ---------------------------------------------------------------------------

/**
 * POST /api/exhibits/create-scene
 * Create a 3D scene from coordinates or address.
 */
export async function handleCreateScene(body: {
  latitude?: number;
  longitude?: number;
  address?: string;
  radiusMeters?: number;
}): Promise<RouteResponse> {
  try {
    let coords: SceneCoordinates;

    if (body.address) {
      const geocoded = await geocodeAddress(body.address);
      if (!geocoded) {
        return { success: false, data: null, error: 'Could not geocode address' };
      }
      coords = { latitude: geocoded.latitude, longitude: geocoded.longitude };
    } else if (body.latitude != null && body.longitude != null) {
      coords = { latitude: body.latitude, longitude: body.longitude };
    } else {
      return { success: false, data: null, error: 'Provide latitude/longitude or address' };
    }

    const sceneData = await create3DScene(coords);
    return { success: true, data: sceneData };
  } catch (error) {
    return { success: false, data: null, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * POST /api/exhibits/geocode
 * Geocode an address to coordinates.
 */
export async function handleGeocode(body: {
  address: string;
}): Promise<RouteResponse> {
  try {
    const result = await geocodeAddress(body.address);
    if (!result) {
      return { success: false, data: null, error: 'Address not found' };
    }
    return { success: true, data: result };
  } catch (error) {
    return { success: false, data: null, error: error instanceof Error ? error.message : String(error) };
  }
}

// ---------------------------------------------------------------------------
// Scene Save / Load (Phase 63)
// ---------------------------------------------------------------------------

/**
 * POST /api/exhibits/scenes
 * Save a new exhibit scene.
 */
export async function handleSaveScene(body: {
  name: string;
  caseId?: string;
  description?: string;
  latitude: number;
  longitude: number;
  address?: string;
  objectSettings: Record<string, unknown>;
  cameraSettings?: Record<string, unknown>;
  markers?: unknown[];
  sceneData?: Record<string, unknown>;
  animationData?: Record<string, unknown>;
  createdBy?: string;
  thumbnail?: string;
}): Promise<RouteResponse> {
  try {
    const scene = await prisma.trialExhibitScene.create({
      data: {
        name: body.name,
        caseId: body.caseId,
        description: body.description,
        latitude: body.latitude,
        longitude: body.longitude,
        address: body.address,
        objectSettings: JSON.stringify(body.objectSettings),
        cameraSettings: body.cameraSettings ? JSON.stringify(body.cameraSettings) : null,
        markers: body.markers ? JSON.stringify(body.markers) : null,
        sceneData: body.sceneData ? JSON.stringify(body.sceneData) : null,
        animationData: body.animationData ? JSON.stringify(body.animationData) : null,
        createdBy: body.createdBy,
        thumbnail: body.thumbnail,
      },
    });

    return { success: true, data: scene };
  } catch (error) {
    return { success: false, data: null, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * GET /api/exhibits/scenes
 * List all saved scenes with optional filtering.
 */
export async function handleListScenes(query: {
  caseId?: string;
  createdBy?: string;
  limit?: number;
  offset?: number;
}): Promise<RouteResponse> {
  try {
    const where: Record<string, unknown> = {};
    if (query.caseId) where.caseId = query.caseId;
    if (query.createdBy) where.createdBy = query.createdBy;

    const [scenes, total] = await Promise.all([
      prisma.trialExhibitScene.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: query.limit ?? 20,
        skip: query.offset ?? 0,
        select: {
          sceneId: true,
          name: true,
          caseId: true,
          description: true,
          latitude: true,
          longitude: true,
          address: true,
          thumbnail: true,
          createdBy: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.trialExhibitScene.count({ where }),
    ]);

    return { success: true, data: { scenes, total } };
  } catch (error) {
    return { success: false, data: null, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * GET /api/exhibits/scenes/:sceneId
 * Load a specific saved scene with all data.
 */
export async function handleGetScene(sceneId: string): Promise<RouteResponse> {
  try {
    const scene = await prisma.trialExhibitScene.findUnique({
      where: { sceneId },
    });

    if (!scene) {
      return { success: false, data: null, error: 'Scene not found' };
    }

    // Parse JSON fields
    const parsed = {
      ...scene,
      objectSettings: JSON.parse(scene.objectSettings),
      cameraSettings: scene.cameraSettings ? JSON.parse(scene.cameraSettings) : null,
      markers: scene.markers ? JSON.parse(scene.markers) : [],
      sceneData: scene.sceneData ? JSON.parse(scene.sceneData) : null,
      animationData: scene.animationData ? JSON.parse(scene.animationData) : null,
    };

    return { success: true, data: parsed };
  } catch (error) {
    return { success: false, data: null, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * PUT /api/exhibits/scenes/:sceneId
 * Update an existing scene.
 */
export async function handleUpdateScene(
  sceneId: string,
  body: Partial<{
    name: string;
    caseId: string;
    description: string;
    objectSettings: Record<string, unknown>;
    cameraSettings: Record<string, unknown>;
    markers: unknown[];
    sceneData: Record<string, unknown>;
    animationData: Record<string, unknown>;
    thumbnail: string;
  }>,
): Promise<RouteResponse> {
  try {
    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.caseId !== undefined) updateData.caseId = body.caseId;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.objectSettings !== undefined) updateData.objectSettings = JSON.stringify(body.objectSettings);
    if (body.cameraSettings !== undefined) updateData.cameraSettings = JSON.stringify(body.cameraSettings);
    if (body.markers !== undefined) updateData.markers = JSON.stringify(body.markers);
    if (body.sceneData !== undefined) updateData.sceneData = JSON.stringify(body.sceneData);
    if (body.animationData !== undefined) updateData.animationData = JSON.stringify(body.animationData);
    if (body.thumbnail !== undefined) updateData.thumbnail = body.thumbnail;

    const scene = await prisma.trialExhibitScene.update({
      where: { sceneId },
      data: updateData,
    });

    return { success: true, data: scene };
  } catch (error) {
    return { success: false, data: null, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * DELETE /api/exhibits/scenes/:sceneId
 * Delete a saved scene.
 */
export async function handleDeleteScene(sceneId: string): Promise<RouteResponse> {
  try {
    await prisma.trialExhibitScene.delete({ where: { sceneId } });
    return { success: true, data: { deleted: true } };
  } catch (error) {
    return { success: false, data: null, error: error instanceof Error ? error.message : String(error) };
  }
}

// ---------------------------------------------------------------------------
// Export (Phase 62)
// ---------------------------------------------------------------------------

/**
 * POST /api/exhibits/export/png
 * Export scene screenshot as PNG.
 */
export async function handleExportPng(body: {
  dataUrl: string;
  exhibitLabel?: string;
  caseId?: string;
  width?: number;
  height?: number;
}): Promise<RouteResponse> {
  try {
    const result = exportAsPng(body.dataUrl, {
      format: 'png',
      width: body.width ?? 1920,
      height: body.height ?? 1080,
      quality: 1,
      exhibitLabel: body.exhibitLabel,
      caseId: body.caseId,
      includeMarkers: true,
      includeTimeline: false,
    });

    return { success: result.success, data: result, error: result.error };
  } catch (error) {
    return { success: false, data: null, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * POST /api/exhibits/export/html
 * Export scene as interactive HTML viewer.
 */
export async function handleExportHtml(body: {
  sceneData: Record<string, unknown>;
  exhibitLabel?: string;
  caseId?: string;
  width?: number;
  height?: number;
}): Promise<RouteResponse> {
  try {
    const result = exportAsHtml(JSON.stringify(body.sceneData), {
      format: 'html',
      width: body.width ?? 1920,
      height: body.height ?? 1080,
      quality: 1,
      exhibitLabel: body.exhibitLabel,
      caseId: body.caseId,
      includeMarkers: true,
      includeTimeline: false,
    });

    return { success: result.success, data: result, error: result.error };
  } catch (error) {
    return { success: false, data: null, error: error instanceof Error ? error.message : String(error) };
  }
}

// ---------------------------------------------------------------------------
// Fastify Route Registration
// ---------------------------------------------------------------------------

async function verifyCaseAccess(caseId: string, tenantId: string): Promise<boolean> {
  const caseRecord = await prisma.criminalCase.findFirst({
    where: { caseId, tenantId, deletedAt: null },
  });
  return !!caseRecord;
}

export async function registerExhibitRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/exhibits/create-scene', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!request.user) return reply.code(401).send({ error: 'Authentication required' });
    const result = await handleCreateScene(request.body as Parameters<typeof handleCreateScene>[0]);
    return result.success ? result : reply.code(400).send(result);
  });

  app.post('/api/exhibits/geocode', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!request.user) return reply.code(401).send({ error: 'Authentication required' });
    const result = await handleGeocode(request.body as { address: string });
    return result.success ? result : reply.code(400).send(result);
  });

  app.post('/api/exhibits/scenes', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) return reply.code(401).send({ error: 'Authentication required' });
    const body = request.body as Parameters<typeof handleSaveScene>[0];
    if (body.caseId && !(await verifyCaseAccess(body.caseId, user.tenantId))) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const result = await handleSaveScene({ ...body, createdBy: body.createdBy ?? user.userId });
    return result.success ? result : reply.code(400).send(result);
  });

  app.get('/api/exhibits/scenes', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) return reply.code(401).send({ error: 'Authentication required' });
    const query = request.query as Parameters<typeof handleListScenes>[0];
    if (query.caseId && !(await verifyCaseAccess(query.caseId, user.tenantId))) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const result = await handleListScenes(query);
    return result.success ? result : reply.code(500).send(result);
  });

  app.get('/api/exhibits/scenes/:sceneId', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!request.user) return reply.code(401).send({ error: 'Authentication required' });
    const { sceneId } = request.params as { sceneId: string };
    const result = await handleGetScene(sceneId);
    return result.success ? result : reply.code(404).send(result);
  });

  app.put('/api/exhibits/scenes/:sceneId', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) return reply.code(401).send({ error: 'Authentication required' });
    const { sceneId } = request.params as { sceneId: string };
    const body = request.body as Parameters<typeof handleUpdateScene>[1];
    if (body.caseId && !(await verifyCaseAccess(body.caseId, user.tenantId))) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const result = await handleUpdateScene(sceneId, body);
    return result.success ? result : reply.code(400).send(result);
  });

  app.delete('/api/exhibits/scenes/:sceneId', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!request.user) return reply.code(401).send({ error: 'Authentication required' });
    const { sceneId } = request.params as { sceneId: string };
    const result = await handleDeleteScene(sceneId);
    return result.success ? result : reply.code(404).send(result);
  });

  app.post('/api/exhibits/export/png', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!request.user) return reply.code(401).send({ error: 'Authentication required' });
    const result = await handleExportPng(request.body as Parameters<typeof handleExportPng>[0]);
    return result.success ? result : reply.code(400).send(result);
  });

  app.post('/api/exhibits/export/html', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!request.user) return reply.code(401).send({ error: 'Authentication required' });
    const result = await handleExportHtml(request.body as Parameters<typeof handleExportHtml>[0]);
    return result.success ? result : reply.code(400).send(result);
  });
}
