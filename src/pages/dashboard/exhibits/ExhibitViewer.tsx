// ============================================================================
// Phase 64 — Exhibit Viewer Page
// Full 3D courtroom exhibit builder and viewer at /dashboard/exhibits/viewer.
// Capabilities: location search, 3D scene, rotate, zoom, toggle layers,
// place markers, camera presets, animation, export.
// ============================================================================

import { useState, useCallback, useRef, useEffect } from 'react';
import ThreeSceneRenderer, { type ThreeSceneAPI, type SceneMarker } from '../../../components/exhibits/ThreeSceneRenderer';
import SceneControls, { type ObjectSettings } from '../../../components/exhibits/SceneControls';
import SceneMarkerTool from '../../../components/exhibits/SceneMarkerTool';
import CameraPresets, { type CameraPreset, type SavedCameraView } from '../../../components/exhibits/CameraPresets';
import AnimationTools, { type AnimationTimeline, type AnimationKeyframe, interpolatePositions } from '../../../components/exhibits/AnimationTools';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SceneData {
  sceneId: string;
  center: { latitude: number; longitude: number };
  buildings: Array<{ id: string; coordinates: Array<[number, number]>; height: number; buildingType?: string }>;
  roads: Array<{ id: string; coordinates: Array<[number, number]>; width: number; roadType: string; name?: string }>;
  sidewalks: Array<{ id: string; coordinates: Array<[number, number]>; width: number }>;
  parkingLots?: Array<{ id: string; coordinates: Array<[number, number]> }>;
  greenSpaces?: Array<{ id: string; coordinates: Array<[number, number]>; type: string }>;
  waterFeatures?: Array<{ id: string; coordinates: Array<[number, number]>; type: string }>;
  metadata: { source: string; fetchedAt: string; totalFeatures: number; areaSquareMeters: number };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ExhibitViewer() {
  // Scene state
  const [sceneData, setSceneData] = useState<SceneData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [address, setAddress] = useState('');
  const [sceneName, setSceneName] = useState('');

  // Object settings
  const [objectSettings, setObjectSettings] = useState<ObjectSettings>({
    showTrees: true,
    showBushes: true,
    showVehicles: true,
    showPedestrians: true,
    showStreetlights: true,
    vehicleDensity: 'medium',
  });

  // Markers
  const [markers, setMarkers] = useState<SceneMarker[]>([]);

  // Camera
  const [cameraPreset, setCameraPreset] = useState<CameraPreset | null>(null);
  const [savedViews, setSavedViews] = useState<SavedCameraView[]>([]);

  // Animation
  const [timeline, setTimeline] = useState<AnimationTimeline>({
    id: 'main',
    name: 'Main Timeline',
    duration: 30,
    keyframes: [],
    isPlaying: false,
    currentTime: 0,
    playbackSpeed: 1,
  });

  // Scene API ref
  const sceneApiRef = useRef<ThreeSceneAPI | null>(null);
  const animFrameRef = useRef<number>(0);

  // Refs for animation loop to avoid stale closures
  const playbackSpeedRef = useRef(timeline.playbackSpeed);
  const durationRef = useRef(timeline.duration);
  const keyframesRef = useRef(timeline.keyframes);

  useEffect(() => {
    playbackSpeedRef.current = timeline.playbackSpeed;
    durationRef.current = timeline.duration;
    keyframesRef.current = timeline.keyframes;
  }, [timeline.playbackSpeed, timeline.duration, timeline.keyframes]);

  // ---------------------------------------------------------------------------
  // Scene Creation
  // ---------------------------------------------------------------------------

  const handleCreateScene = useCallback(async () => {
    if (!address.trim()) return;
    setIsLoading(true);
    setError(null);

    try {
      // Use backend API to create scene
      const response = await fetch('/api/exhibits/create-scene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: address.trim() }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setSceneData(result.data);
          setSceneName(address.trim());
          return;
        }
      }

      // Fallback: generate synthetic scene for demo
      console.warn('[ExhibitViewer] API unavailable, generating demo scene');
      setSceneData(generateDemoScene(address));
      setSceneName(address.trim());
    } catch {
      // Fallback to demo scene
      console.warn('[ExhibitViewer] API unavailable, generating demo scene');
      setSceneData(generateDemoScene(address));
      setSceneName(address.trim());
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  // ---------------------------------------------------------------------------
  // Marker Management
  // ---------------------------------------------------------------------------

  const handleAddMarker = useCallback((marker: Omit<SceneMarker, 'id'>) => {
    const newMarker: SceneMarker = { ...marker, id: generateId() };
    setMarkers((prev) => [...prev, newMarker]);
  }, []);

  const handleRemoveMarker = useCallback((id: string) => {
    setMarkers((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const handleUpdateMarker = useCallback((id: string, updates: Partial<SceneMarker>) => {
    setMarkers((prev) => prev.map((m) => (m.id === id ? { ...m, ...updates } : m)));
  }, []);

  const handleClearMarkers = useCallback(() => {
    setMarkers([]);
  }, []);

  // ---------------------------------------------------------------------------
  // Camera
  // ---------------------------------------------------------------------------

  const handleSelectPreset = useCallback((preset: CameraPreset) => {
    setCameraPreset(preset);
  }, []);

  const handleSaveView = useCallback((name: string) => {
    if (!sceneApiRef.current) return;
    const cam = sceneApiRef.current.getCamera();
    const view: SavedCameraView = {
      id: generateId(),
      name,
      position: [cam.position.x, cam.position.y, cam.position.z],
      target: [0, 0, 0],
      createdAt: new Date().toISOString(),
    };
    setSavedViews((prev) => [...prev, view]);
  }, []);

  const handleLoadView = useCallback((view: SavedCameraView) => {
    setCameraPreset({ name: view.name, position: view.position, target: view.target });
  }, []);

  const handleDeleteView = useCallback((id: string) => {
    setSavedViews((prev) => prev.filter((v) => v.id !== id));
  }, []);

  // ---------------------------------------------------------------------------
  // Animation
  // ---------------------------------------------------------------------------

  const handlePlay = useCallback(() => {
    setTimeline((prev) => ({ ...prev, isPlaying: true }));
    // Animation loop handled by requestAnimationFrame
    const startTime = performance.now();
    const startOffset = timeline.currentTime;

    function tick() {
      const elapsed = (performance.now() - startTime) / 1000 * playbackSpeedRef.current;
      const newTime = startOffset + elapsed;

      if (newTime >= durationRef.current) {
        setTimeline((prev) => ({ ...prev, isPlaying: false, currentTime: 0 }));
        return;
      }

      setTimeline((prev) => ({ ...prev, currentTime: newTime }));

      // Interpolate marker positions
      const positions = interpolatePositions(keyframesRef.current, newTime);
      setMarkers((prev) =>
        prev.map((m) => {
          const newPos = positions.get(m.id);
          return newPos ? { ...m, position: newPos } : m;
        })
      );

      animFrameRef.current = requestAnimationFrame(tick);
    }
    animFrameRef.current = requestAnimationFrame(tick);
  }, [timeline.currentTime]);

  const handlePause = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    setTimeline((prev) => ({ ...prev, isPlaying: false }));
  }, []);

  const handleStop = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    setTimeline((prev) => ({ ...prev, isPlaying: false, currentTime: 0 }));
  }, []);

  const handleSeek = useCallback((time: number) => {
    setTimeline((prev) => ({ ...prev, currentTime: time }));
  }, []);

  const handleAddKeyframe = useCallback((kf: Omit<AnimationKeyframe, 'id'>) => {
    const newKf: AnimationKeyframe = { ...kf, id: generateId() };
    setTimeline((prev) => ({ ...prev, keyframes: [...prev.keyframes, newKf] }));
  }, []);

  const handleRemoveKeyframe = useCallback((id: string) => {
    setTimeline((prev) => ({
      ...prev,
      keyframes: prev.keyframes.filter((kf) => kf.id !== id),
    }));
  }, []);

  // ---------------------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------------------

  const handleExportPng = useCallback(() => {
    if (!sceneApiRef.current) return;
    const dataUrl = sceneApiRef.current.captureScreenshot();
    const link = document.createElement('a');
    link.download = `exhibit_${sceneName.replace(/\s+/g, '_')}_${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  }, [sceneName]);

  const handleExportHtml = useCallback(async () => {
    if (!sceneData) return;
    try {
      const response = await fetch('/api/exhibits/export/html', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sceneData,
          exhibitLabel: sceneName || 'Trial Exhibit',
        }),
      });
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data?.dataUrl) {
          const link = document.createElement('a');
          link.download = `exhibit_${sceneName.replace(/\s+/g, '_')}_${Date.now()}.html`;
          link.href = result.data.dataUrl;
          link.click();
          return;
        }
      }
    } catch {
      // Fallback: generate client-side
    }

    // Client-side fallback: generate minimal HTML
    const htmlContent = generateClientSideHtml(sceneData, sceneName);
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const link = document.createElement('a');
    link.download = `exhibit_${sceneName.replace(/\s+/g, '_')}_${Date.now()}.html`;
    link.href = URL.createObjectURL(blob);
    link.click();
  }, [sceneData, sceneName]);

  // ---------------------------------------------------------------------------
  // Scene Ready Callback
  // ---------------------------------------------------------------------------

  const handleSceneReady = useCallback((api: ThreeSceneAPI) => {
    sceneApiRef.current = api;
  }, []);

  // Marker labels for animation tools
  const markerLabels: Record<string, string> = {};
  for (const m of markers) {
    markerLabels[m.id] = m.label;
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold text-white">3D Trial Exhibit Generator</h1>
          {sceneName && (
            <span className="text-sm text-gray-400">{sceneName}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {sceneData && (
            <>
              <button
                onClick={handleExportPng}
                className="px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-500 transition-colors"
              >
                Export PNG
              </button>
              <button
                onClick={handleExportHtml}
                className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-500 transition-colors"
              >
                Export HTML Viewer
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* 3D Viewport */}
        <div className="flex-1 relative">
          {!sceneData ? (
            // Location Search / Welcome
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="max-w-md w-full px-6">
                <div className="text-center mb-8">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-600 flex items-center justify-center">
                    <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">Create 3D Scene</h2>
                  <p className="text-gray-400 text-sm">
                    Enter an address or location to generate an interactive 3D courtroom exhibit.
                  </p>
                </div>

                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Enter address (e.g., 123 Main St Sacramento)"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateScene()}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
                  />
                  <button
                    onClick={handleCreateScene}
                    disabled={isLoading || !address.trim()}
                    className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-500 disabled:bg-gray-600 disabled:text-gray-400 transition-colors text-sm"
                  >
                    {isLoading ? 'Generating Scene...' : 'Generate 3D Scene'}
                  </button>
                  {error && (
                    <p className="text-red-400 text-xs text-center">{error}</p>
                  )}
                </div>

                {/* Quick Examples */}
                <div className="mt-6">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 text-center">Quick Examples</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      '1100 Broadway, Sacramento, CA',
                      '200 N Spring St, Los Angeles, CA',
                      '1401 Broadway, San Diego, CA',
                      '250 W Shoreline Dr, Long Beach, CA',
                    ].map((addr) => (
                      <button
                        key={addr}
                        onClick={() => { setAddress(addr); }}
                        className="text-left py-2 px-3 bg-gray-800 border border-gray-700 rounded text-xs text-gray-400 hover:text-white hover:border-gray-600 transition-colors"
                      >
                        {addr}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // 3D Scene
            <ThreeSceneRenderer
              sceneData={sceneData}
              objectSettings={objectSettings}
              markers={markers}
              cameraPreset={cameraPreset}
              onSceneReady={handleSceneReady}
              className="w-full h-full"
            />
          )}

          {/* Scene info overlay */}
          {sceneData && (
            <div className="absolute bottom-4 left-4 bg-black/60 rounded px-3 py-2 text-xs text-gray-300">
              <span>{sceneData.metadata.totalFeatures} features</span>
              <span className="mx-2 text-gray-600">|</span>
              <span>{sceneData.buildings.length} buildings</span>
              <span className="mx-2 text-gray-600">|</span>
              <span>{sceneData.roads.length} roads</span>
              <span className="mx-2 text-gray-600">|</span>
              <span className="text-gray-500">{sceneData.metadata.source}</span>
            </div>
          )}
        </div>

        {/* Right Sidebar — Controls */}
        {sceneData && (
          <div className="w-72 bg-gray-850 border-l border-gray-700 overflow-y-auto flex flex-col gap-2 p-2">
            {/* New Scene */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="New address..."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateScene()}
                  className="flex-1 px-2 py-1.5 text-xs bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={handleCreateScene}
                  disabled={isLoading}
                  className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-500 disabled:bg-gray-600 transition-colors"
                >
                  Go
                </button>
              </div>
            </div>

            {/* Object Controls */}
            <SceneControls
              settings={objectSettings}
              onSettingsChange={setObjectSettings}
            />

            {/* Evidence Markers */}
            <SceneMarkerTool
              markers={markers}
              onAddMarker={handleAddMarker}
              onRemoveMarker={handleRemoveMarker}
              onUpdateMarker={handleUpdateMarker}
              onClearAll={handleClearMarkers}
            />

            {/* Camera Presets */}
            <CameraPresets
              onSelectPreset={handleSelectPreset}
              onSaveView={handleSaveView}
              savedViews={savedViews}
              onLoadView={handleLoadView}
              onDeleteView={handleDeleteView}
            />

            {/* Animation Tools */}
            <AnimationTools
              timeline={timeline}
              markerLabels={markerLabels}
              onUpdateTimeline={setTimeline}
              onPlay={handlePlay}
              onPause={handlePause}
              onStop={handleStop}
              onSeek={handleSeek}
              onAddKeyframe={handleAddKeyframe}
              onRemoveKeyframe={handleRemoveKeyframe}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Demo Scene Generator (when API is unavailable)
// ---------------------------------------------------------------------------

function generateDemoScene(address: string): SceneData {
  const buildings: SceneData['buildings'] = [];
  const roads: SceneData['roads'] = [];

  // Generate a grid of buildings
  for (let i = -3; i <= 3; i++) {
    for (let j = -3; j <= 3; j++) {
      if (Math.abs(i) <= 1 && Math.abs(j) <= 1) continue;
      const cx = i * 30;
      const cy = j * 30;
      const w = 12 + Math.random() * 8;
      const h = 12 + Math.random() * 8;
      const levels = 1 + Math.floor(Math.random() * 4);
      buildings.push({
        id: `b_${i}_${j}`,
        coordinates: [
          [cx - w / 2, cy - h / 2],
          [cx + w / 2, cy - h / 2],
          [cx + w / 2, cy + h / 2],
          [cx - w / 2, cy + h / 2],
        ],
        height: levels * 3.5,
        buildingType: Math.random() > 0.5 ? 'commercial' : 'residential',
      });
    }
  }

  // Roads
  roads.push(
    { id: 'r1', coordinates: [[-150, 0], [-50, 0], [50, 0], [150, 0]], width: 10, roadType: 'primary', name: 'Main Street' },
    { id: 'r2', coordinates: [[0, -150], [0, -50], [0, 50], [0, 150]], width: 8, roadType: 'secondary', name: 'Cross Street' },
    { id: 'r3', coordinates: [[-150, 60], [150, 60]], width: 6, roadType: 'residential' },
    { id: 'r4', coordinates: [[-150, -60], [150, -60]], width: 6, roadType: 'residential' },
  );

  return {
    sceneId: `demo_${Date.now()}`,
    center: { latitude: 38.5816, longitude: -121.4944 },
    buildings,
    roads,
    sidewalks: [
      { id: 'sw1', coordinates: [[-150, 6], [150, 6]], width: 2 },
      { id: 'sw2', coordinates: [[-150, -6], [150, -6]], width: 2 },
      { id: 'sw3', coordinates: [[6, -150], [6, 150]], width: 2 },
      { id: 'sw4', coordinates: [[-6, -150], [-6, 150]], width: 2 },
    ],
    parkingLots: [],
    greenSpaces: [
      { id: 'park1', coordinates: [[-25, -25], [-15, -25], [-15, -15], [-25, -15]], type: 'park' },
    ],
    waterFeatures: [],
    metadata: {
      source: `Demo Scene (${address})`,
      fetchedAt: new Date().toISOString(),
      totalFeatures: buildings.length + roads.length + 5,
      areaSquareMeters: 160000,
    },
  };
}

// ---------------------------------------------------------------------------
// Client-side HTML Export Fallback
// ---------------------------------------------------------------------------

function generateClientSideHtml(sceneData: SceneData, label: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${label} — CourtAccess Exhibit</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #1a1a2e; overflow: hidden; }
    #header { position: fixed; top: 0; left: 0; right: 0; z-index: 10; background: rgba(0,0,0,0.8); padding: 12px 20px; color: white; font-family: system-ui; font-size: 14px; border-bottom: 1px solid rgba(255,255,255,0.1); }
    canvas { width: 100vw; height: 100vh; display: block; }
    #controls { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.7); border-radius: 8px; padding: 8px 16px; font-size: 12px; color: #888; font-family: system-ui; }
  </style>
</head>
<body>
  <div id="header">${label} — CourtAccess 3D Exhibit</div>
  <canvas id="c"></canvas>
  <div id="controls">Drag to rotate | Right-click to pan | Scroll to zoom</div>
  <script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js"}}</script>
  <script type="module">
    import*as T from'three';const d=${JSON.stringify(sceneData)};const c=document.getElementById('c');const r=new T.WebGLRenderer({canvas:c,antialias:true});r.setSize(innerWidth,innerHeight);r.setPixelRatio(devicePixelRatio);const s=new T.Scene();s.background=new T.Color(0x87ceeb);const cam=new T.PerspectiveCamera(60,innerWidth/innerHeight,0.1,1000);cam.position.set(100,80,100);cam.lookAt(0,0,0);s.add(new T.AmbientLight(0xffffff,0.5));const sun=new T.DirectionalLight(0xffffff,0.8);sun.position.set(100,150,80);s.add(sun);s.add(new T.Mesh(new T.PlaneGeometry(800,800),new T.MeshLambertMaterial({color:0x8fbc8f})).rotateX(-Math.PI/2));if(d.buildings)for(const b of d.buildings){if(b.coordinates&&b.coordinates.length>=3){const sh=new T.Shape();sh.moveTo(b.coordinates[0][0],b.coordinates[0][1]);for(let i=1;i<b.coordinates.length;i++)sh.lineTo(b.coordinates[i][0],b.coordinates[i][1]);sh.closePath();const g=new T.ExtrudeGeometry(sh,{depth:b.height||10,bevelEnabled:false});g.rotateX(-Math.PI/2);s.add(new T.Mesh(g,new T.MeshLambertMaterial({color:0xd4c5a9})))}}let rot=false,pan=false,lx=0,ly=0,sR=150,sT=0,sP=Math.PI/4;const tgt=new T.Vector3();function uc(){cam.position.set(sR*Math.sin(sP)*Math.sin(sT)+tgt.x,sR*Math.cos(sP)+tgt.y,sR*Math.sin(sP)*Math.cos(sT)+tgt.z);cam.lookAt(tgt)}uc();c.onmousedown=e=>{if(e.button===0)rot=true;if(e.button===2)pan=true;lx=e.clientX;ly=e.clientY};c.onmousemove=e=>{const dx=e.clientX-lx,dy=e.clientY-ly;lx=e.clientX;ly=e.clientY;if(rot){sT-=dx*.005;sP=Math.max(.1,Math.min(Math.PI/2-.01,sP+dy*.005));uc()}if(pan){const ps=sR*.002;const ri=new T.Vector3().crossVectors(cam.getWorldDirection(new T.Vector3()),new T.Vector3(0,1,0)).normalize();const fw=new T.Vector3().crossVectors(new T.Vector3(0,1,0),ri).normalize();tgt.addScaledVector(ri,-dx*ps);tgt.addScaledVector(fw,dy*ps);uc()}};onmouseup=()=>{rot=false;pan=false};c.onwheel=e=>{e.preventDefault();sR=Math.max(20,Math.min(500,sR+e.deltaY*.3));uc()};c.oncontextmenu=e=>e.preventDefault();onresize=()=>{cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix();r.setSize(innerWidth,innerHeight)};(function a(){requestAnimationFrame(a);r.render(s,cam)})()
  </script>
</body>
</html>`;
}
