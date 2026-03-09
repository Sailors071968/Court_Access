// ============================================================================
// Phase 62 — Trial Exhibit Export Service
// Exports 3D scenes as PNG images, and interactive web viewer HTML bundles.
// MP4 animation export is stubbed for future ffmpeg integration.
// ============================================================================

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExportOptions {
  format: 'png' | 'mp4' | 'html';
  width: number;
  height: number;
  quality: number; // 0-1
  exhibitLabel?: string;
  caseId?: string;
  includeMarkers: boolean;
  includeTimeline: boolean;
}

export interface ExportResult {
  success: boolean;
  format: string;
  filePath?: string;
  dataUrl?: string;
  fileSize?: number;
  error?: string;
  metadata: {
    exportedAt: string;
    exhibitLabel: string;
    dimensions: { width: number; height: number };
    format: string;
  };
}

// ---------------------------------------------------------------------------
// Export Functions
// ---------------------------------------------------------------------------

/**
 * Export scene as PNG image from a base64 data URL.
 */
export function exportAsPng(
  dataUrl: string,
  options: ExportOptions,
  outputDir?: string,
): ExportResult {
  const metadata = {
    exportedAt: new Date().toISOString(),
    exhibitLabel: options.exhibitLabel ?? 'Untitled Exhibit',
    dimensions: { width: options.width, height: options.height },
    format: 'png',
  };

  try {
    if (outputDir) {
      if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
      }
      const fileName = `exhibit_${Date.now()}.png`;
      const filePath = join(outputDir, fileName);
      const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
      writeFileSync(filePath, Buffer.from(base64Data, 'base64'));

      return {
        success: true,
        format: 'png',
        filePath,
        fileSize: Buffer.from(base64Data, 'base64').length,
        metadata,
      };
    }

    // Return data URL for browser-side download
    return {
      success: true,
      format: 'png',
      dataUrl,
      metadata,
    };
  } catch (error) {
    return {
      success: false,
      format: 'png',
      error: error instanceof Error ? error.message : String(error),
      metadata,
    };
  }
}

/**
 * Export scene as interactive HTML viewer.
 * Generates a self-contained HTML file with embedded Three.js scene.
 */
export function exportAsHtml(
  sceneJson: string,
  options: ExportOptions,
  outputDir?: string,
): ExportResult {
  const metadata = {
    exportedAt: new Date().toISOString(),
    exhibitLabel: options.exhibitLabel ?? 'Untitled Exhibit',
    dimensions: { width: options.width, height: options.height },
    format: 'html',
  };

  try {
    const html = generateInteractiveViewer(sceneJson, options);

    if (outputDir) {
      if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
      }
      const fileName = `exhibit_${Date.now()}.html`;
      const filePath = join(outputDir, fileName);
      writeFileSync(filePath, html, 'utf-8');

      return {
        success: true,
        format: 'html',
        filePath,
        fileSize: Buffer.from(html).length,
        metadata,
      };
    }

    return {
      success: true,
      format: 'html',
      dataUrl: `data:text/html;base64,${Buffer.from(html).toString('base64')}`,
      metadata,
    };
  } catch (error) {
    return {
      success: false,
      format: 'html',
      error: error instanceof Error ? error.message : String(error),
      metadata,
    };
  }
}

/**
 * Export scene as MP4 animation (stub — requires server-side ffmpeg).
 */
export function exportAsMp4(
  _frames: string[],
  options: ExportOptions,
): ExportResult {
  return {
    success: false,
    format: 'mp4',
    error: 'MP4 export requires server-side ffmpeg integration. This feature will be available in a future update.',
    metadata: {
      exportedAt: new Date().toISOString(),
      exhibitLabel: options.exhibitLabel ?? 'Untitled Exhibit',
      dimensions: { width: options.width, height: options.height },
      format: 'mp4',
    },
  };
}

// ---------------------------------------------------------------------------
// Security Helpers
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------------------------------------------------------------------------
// Interactive HTML Viewer Generator
// ---------------------------------------------------------------------------

function generateInteractiveViewer(sceneJson: string, options: ExportOptions): string {
  const label = escapeHtml(options.exhibitLabel ?? 'Trial Exhibit');
  const caseLabel = options.caseId ? ` | Case: ${escapeHtml(options.caseId)}` : '';
  // encodeURIComponent doesn't encode backticks, $, or \ which can break template literals
  const encodedSceneJson = encodeURIComponent(sceneJson)
    .replace(/`/g, '%60')
    .replace(/\$/g, '%24')
    .replace(/\\/g, '%5C')
    .replace(/</g, '%3C');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${label}${caseLabel} — CourtAccess Exhibit</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #1a1a2e; color: #fff; font-family: system-ui, sans-serif; overflow: hidden; }
    #header {
      position: fixed; top: 0; left: 0; right: 0; z-index: 10;
      background: rgba(0,0,0,0.8); padding: 12px 20px;
      display: flex; justify-content: space-between; align-items: center;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    #header h1 { font-size: 16px; font-weight: 600; }
    #header .meta { font-size: 12px; color: #888; }
    #canvas { width: 100vw; height: 100vh; display: block; }
    #controls {
      position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
      background: rgba(0,0,0,0.8); border-radius: 8px; padding: 8px 16px;
      font-size: 12px; color: #888;
    }
  </style>
</head>
<body>
  <div id="header">
    <h1>${label}</h1>
    <span class="meta">CourtAccess 3D Exhibit${caseLabel} | Generated ${new Date().toLocaleDateString()}</span>
  </div>
  <canvas id="canvas"></canvas>
  <div id="controls">
    Left-click + drag to rotate | Right-click + drag to pan | Scroll to zoom
  </div>
  <script type="importmap">
    { "imports": { "three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js" } }
  </script>
  <script type="module">
    import * as THREE from 'three';

    const sceneData = JSON.parse(decodeURIComponent("${encodedSceneJson}"));
    const canvas = document.getElementById('canvas');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(100, 80, 100);
    camera.lookAt(0, 0, 0);

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const sun = new THREE.DirectionalLight(0xffffff, 0.8);
    sun.position.set(100, 150, 80);
    scene.add(sun);

    // Ground
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(800, 800),
      new THREE.MeshLambertMaterial({ color: 0x8fbc8f })
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    // Build scene from data
    if (sceneData.buildings) {
      for (const b of sceneData.buildings) {
        if (b.coordinates && b.coordinates.length >= 3) {
          const shape = new THREE.Shape();
          shape.moveTo(b.coordinates[0][0], b.coordinates[0][1]);
          for (let i = 1; i < b.coordinates.length; i++) {
            shape.lineTo(b.coordinates[i][0], b.coordinates[i][1]);
          }
          shape.closePath();
          const geo = new THREE.ExtrudeGeometry(shape, { depth: b.height || 10, bevelEnabled: false });
          geo.rotateX(-Math.PI / 2);
          const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0xd4c5a9 }));
          scene.add(mesh);
        }
      }
    }

    // Simple orbit controls
    let isRotating = false, isPanning = false;
    let lastX = 0, lastY = 0;
    let sphericalR = 150, sphericalTheta = 0, sphericalPhi = Math.PI / 4;
    const target = new THREE.Vector3(0, 0, 0);

    function updateCam() {
      const x = sphericalR * Math.sin(sphericalPhi) * Math.sin(sphericalTheta);
      const y = sphericalR * Math.cos(sphericalPhi);
      const z = sphericalR * Math.sin(sphericalPhi) * Math.cos(sphericalTheta);
      camera.position.set(x + target.x, y + target.y, z + target.z);
      camera.lookAt(target);
    }
    updateCam();

    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) isRotating = true;
      if (e.button === 2) isPanning = true;
      lastX = e.clientX; lastY = e.clientY;
    });
    canvas.addEventListener('mousemove', (e) => {
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      if (isRotating) {
        sphericalTheta -= dx * 0.005;
        sphericalPhi = Math.max(0.1, Math.min(Math.PI / 2 - 0.01, sphericalPhi + dy * 0.005));
        updateCam();
      }
      if (isPanning) {
        const panSpeed = sphericalR * 0.002;
        const right = new THREE.Vector3();
        right.crossVectors(camera.getWorldDirection(new THREE.Vector3()), new THREE.Vector3(0,1,0)).normalize();
        const forward = new THREE.Vector3();
        forward.crossVectors(new THREE.Vector3(0,1,0), right).normalize();
        target.addScaledVector(right, -dx * panSpeed);
        target.addScaledVector(forward, dy * panSpeed);
        updateCam();
      }
    });
    window.addEventListener('mouseup', () => { isRotating = false; isPanning = false; });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      sphericalR = Math.max(20, Math.min(500, sphericalR + e.deltaY * 0.3));
      updateCam();
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    function animate() {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    }
    animate();
  </script>
</body>
</html>`;
}
