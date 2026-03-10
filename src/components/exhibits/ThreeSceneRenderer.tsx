// ============================================================================
// Phase 55 — Three.js 3D Scene Renderer
// Interactive 3D courtroom exhibit renderer with orbit controls.
// Capabilities: orbit camera, scene rotation, zoom, pan, 360 rotation, tilt.
// ============================================================================

import { useEffect, useRef, useCallback, useState } from 'react';
import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SceneObject {
  id: string;
  type: 'building' | 'road' | 'sidewalk' | 'tree' | 'bush' | 'car' | 'person' | 'streetlight' | 'policeVehicle' | 'marker' | 'parking' | 'greenSpace' | 'water';
  mesh?: THREE.Mesh | THREE.Group;
  visible: boolean;
  position?: [number, number, number];
  data?: Record<string, unknown>;
}

export interface CameraPreset {
  name: string;
  position: [number, number, number];
  target: [number, number, number];
}

export interface SceneMarker {
  id: string;
  type: 'pin' | 'number' | 'evidence';
  label: string;
  position: [number, number, number];
  color: string;
  number?: number;
}

interface ThreeSceneRendererProps {
  sceneData: {
    buildings: Array<{ id: string; coordinates: Array<[number, number]>; height: number; buildingType?: string }>;
    roads: Array<{ id: string; coordinates: Array<[number, number]>; width: number; roadType: string; name?: string }>;
    sidewalks: Array<{ id: string; coordinates: Array<[number, number]>; width: number }>;
    parkingLots?: Array<{ id: string; coordinates: Array<[number, number]> }>;
    greenSpaces?: Array<{ id: string; coordinates: Array<[number, number]>; type: string }>;
    waterFeatures?: Array<{ id: string; coordinates: Array<[number, number]>; type: string }>;
  } | null;
  objectSettings: {
    showTrees: boolean;
    showBushes: boolean;
    showVehicles: boolean;
    showPedestrians: boolean;
    showStreetlights: boolean;
    vehicleDensity: 'low' | 'medium' | 'high';
  };
  markers: SceneMarker[];
  cameraPreset?: CameraPreset | null;
  onSceneReady?: (renderer: ThreeSceneAPI) => void;
  className?: string;
}

export interface ThreeSceneAPI {
  getCamera: () => THREE.PerspectiveCamera;
  getScene: () => THREE.Scene;
  getRenderer: () => THREE.WebGLRenderer;
  setCameraPosition: (pos: [number, number, number], target?: [number, number, number]) => void;
  captureScreenshot: () => string;
  getSceneObjects: () => SceneObject[];
}

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

const COLORS = {
  terrain: 0x8fbc8f,
  building: 0xd4c5a9,
  buildingRoof: 0xc9b896,
  road: 0x555555,
  sidewalk: 0xbbbbbb,
  parking: 0x777777,
  grass: 0x5da35d,
  water: 0x4a90d9,
  tree: 0x2d8a2d,
  treeTrunk: 0x8b4513,
  bush: 0x3a7a3a,
  car: 0xcc3333,
  policeCar: 0x1a1a6c,
  person: 0xffcc88,
  streetlight: 0x888888,
  lightBulb: 0xffff99,
  sky: 0x87ceeb,
  marker: 0xff0000,
};

// ---------------------------------------------------------------------------
// Orbit Controls (simplified inline implementation)
// ---------------------------------------------------------------------------

class SimpleOrbitControls {
  camera: THREE.PerspectiveCamera;
  domElement: HTMLElement;
  target = new THREE.Vector3(0, 0, 0);
  private spherical = new THREE.Spherical(150, Math.PI / 4, 0);
  private isRotating = false;
  private isPanning = false;
  private lastMouse = { x: 0, y: 0 };
  private disposed = false;

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.camera = camera;
    this.domElement = domElement;
    this.bindEvents();
    this.updateCamera();
  }

  private bindEvents(): void {
    this.domElement.addEventListener('mousedown', this.onMouseDown);
    this.domElement.addEventListener('mousemove', this.onMouseMove);
    this.domElement.addEventListener('mouseup', this.onMouseUp);
    this.domElement.addEventListener('wheel', this.onWheel);
    this.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private onMouseDown = (e: MouseEvent): void => {
    if (this.disposed) return;
    if (e.button === 0) this.isRotating = true;
    if (e.button === 2) this.isPanning = true;
    this.lastMouse = { x: e.clientX, y: e.clientY };
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (this.disposed) return;
    const dx = e.clientX - this.lastMouse.x;
    const dy = e.clientY - this.lastMouse.y;
    this.lastMouse = { x: e.clientX, y: e.clientY };

    if (this.isRotating) {
      this.spherical.theta -= dx * 0.005;
      this.spherical.phi = Math.max(0.1, Math.min(Math.PI / 2 - 0.01, this.spherical.phi + dy * 0.005));
      this.updateCamera();
    }

    if (this.isPanning) {
      const panSpeed = this.spherical.radius * 0.002;
      const right = new THREE.Vector3();
      const up = new THREE.Vector3(0, 1, 0);
      right.crossVectors(this.camera.getWorldDirection(new THREE.Vector3()), up).normalize();
      const forward = new THREE.Vector3();
      forward.crossVectors(up, right).normalize();

      this.target.addScaledVector(right, -dx * panSpeed);
      this.target.addScaledVector(forward, dy * panSpeed);
      this.updateCamera();
    }
  };

  private onMouseUp = (): void => {
    this.isRotating = false;
    this.isPanning = false;
  };

  private onWheel = (e: WheelEvent): void => {
    if (this.disposed) return;
    e.preventDefault();
    this.spherical.radius = Math.max(20, Math.min(500, this.spherical.radius + e.deltaY * 0.3));
    this.updateCamera();
  };

  updateCamera(): void {
    const pos = new THREE.Vector3().setFromSpherical(this.spherical).add(this.target);
    this.camera.position.copy(pos);
    this.camera.lookAt(this.target);
  }

  setPosition(pos: [number, number, number], target?: [number, number, number]): void {
    if (target) {
      this.target.set(target[0], target[1], target[2]);
    }
    const offset = new THREE.Vector3(pos[0], pos[1], pos[2]).sub(this.target);
    this.spherical.setFromVector3(offset);
    this.updateCamera();
  }

  dispose(): void {
    this.disposed = true;
    this.domElement.removeEventListener('mousedown', this.onMouseDown);
    this.domElement.removeEventListener('mousemove', this.onMouseMove);
    this.domElement.removeEventListener('mouseup', this.onMouseUp);
    this.domElement.removeEventListener('wheel', this.onWheel);
  }
}

// ---------------------------------------------------------------------------
// Object Generators (Low-Poly 3D Models)
// ---------------------------------------------------------------------------

function createTree(x: number, z: number): THREE.Group {
  const group = new THREE.Group();

  // Trunk
  const trunkGeo = new THREE.CylinderGeometry(0.3, 0.4, 3, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: COLORS.treeTrunk });
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.set(0, 1.5, 0);
  group.add(trunk);

  // Canopy (cone)
  const canopyGeo = new THREE.ConeGeometry(2.5, 5, 6);
  const canopyMat = new THREE.MeshLambertMaterial({ color: COLORS.tree });
  const canopy = new THREE.Mesh(canopyGeo, canopyMat);
  canopy.position.set(0, 5.5, 0);
  group.add(canopy);

  group.position.set(x, 0, z);
  return group;
}

function createBush(x: number, z: number): THREE.Mesh {
  const geo = new THREE.SphereGeometry(1, 6, 4);
  const mat = new THREE.MeshLambertMaterial({ color: COLORS.bush });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, 0.8, z);
  mesh.scale.set(1, 0.7, 1);
  return mesh;
}

function createCar(x: number, z: number, rotation = 0, color = COLORS.car): THREE.Group {
  const group = new THREE.Group();

  // Body
  const bodyGeo = new THREE.BoxGeometry(4, 1.2, 2);
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.set(0, 0.8, 0);
  group.add(body);

  // Cabin
  const cabinGeo = new THREE.BoxGeometry(2.2, 1, 1.8);
  const cabinMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
  const cabin = new THREE.Mesh(cabinGeo, cabinMat);
  cabin.position.set(-0.3, 1.7, 0);
  group.add(cabin);

  // Wheels
  const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 8);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
  const wheelPositions = [
    [1.2, 0.4, 1.1],
    [1.2, 0.4, -1.1],
    [-1.2, 0.4, 1.1],
    [-1.2, 0.4, -1.1],
  ];
  for (const [wx, wy, wz] of wheelPositions) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(wx, wy, wz);
    group.add(wheel);
  }

  group.position.set(x, 0, z);
  group.rotation.y = rotation;
  return group;
}

function createPoliceVehicle(x: number, z: number, rotation = 0): THREE.Group {
  const group = createCar(x, z, rotation, COLORS.policeCar);

  // Light bar
  const lightBarGeo = new THREE.BoxGeometry(1.5, 0.3, 0.4);
  const lightBarMat = new THREE.MeshLambertMaterial({ color: 0xcccccc });
  const lightBar = new THREE.Mesh(lightBarGeo, lightBarMat);
  lightBar.position.set(-0.3, 2.35, 0);
  group.add(lightBar);

  // Red light
  const redGeo = new THREE.SphereGeometry(0.15, 6, 6);
  const redMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  const red = new THREE.Mesh(redGeo, redMat);
  red.position.set(-0.7, 2.45, 0);
  group.add(red);

  // Blue light
  const blueGeo = new THREE.SphereGeometry(0.15, 6, 6);
  const blueMat = new THREE.MeshBasicMaterial({ color: 0x0000ff });
  const blue = new THREE.Mesh(blueGeo, blueMat);
  blue.position.set(0.1, 2.45, 0);
  group.add(blue);

  return group;
}

function createPerson(x: number, z: number): THREE.Group {
  const group = new THREE.Group();

  // Body
  const bodyGeo = new THREE.CylinderGeometry(0.25, 0.3, 1.2, 6);
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x4466aa });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.set(0, 1.2, 0);
  group.add(body);

  // Head
  const headGeo = new THREE.SphereGeometry(0.25, 6, 6);
  const headMat = new THREE.MeshLambertMaterial({ color: COLORS.person });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.set(0, 2.1, 0);
  group.add(head);

  // Legs
  const legGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.7, 4);
  const legMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
  const leftLeg = new THREE.Mesh(legGeo, legMat);
  leftLeg.position.set(0.12, 0.35, 0);
  group.add(leftLeg);
  const rightLeg = new THREE.Mesh(legGeo, legMat);
  rightLeg.position.set(-0.12, 0.35, 0);
  group.add(rightLeg);

  group.position.set(x, 0, z);
  return group;
}

function createStreetlight(x: number, z: number): THREE.Group {
  const group = new THREE.Group();

  // Pole
  const poleGeo = new THREE.CylinderGeometry(0.08, 0.12, 6, 6);
  const poleMat = new THREE.MeshLambertMaterial({ color: COLORS.streetlight });
  const pole = new THREE.Mesh(poleGeo, poleMat);
  pole.position.set(0, 3, 0);
  group.add(pole);

  // Arm
  const armGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.5, 4);
  const arm = new THREE.Mesh(armGeo, poleMat);
  arm.rotation.z = Math.PI / 2;
  arm.position.set(0.75, 5.8, 0);
  group.add(arm);

  // Light
  const lightGeo = new THREE.SphereGeometry(0.2, 6, 6);
  const lightMat = new THREE.MeshBasicMaterial({ color: COLORS.lightBulb });
  const light = new THREE.Mesh(lightGeo, lightMat);
  light.position.set(1.5, 5.6, 0);
  group.add(light);

  group.position.set(x, 0, z);
  return group;
}

function createMarkerMesh(marker: SceneMarker): THREE.Group {
  const group = new THREE.Group();
  const color = new THREE.Color(marker.color);

  if (marker.type === 'pin') {
    // Pin shape
    const coneGeo = new THREE.ConeGeometry(0.5, 2, 8);
    const coneMat = new THREE.MeshLambertMaterial({ color });
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.rotation.x = Math.PI;
    cone.position.set(0, 1, 0);
    group.add(cone);

    const sphereGeo = new THREE.SphereGeometry(0.6, 8, 8);
    const sphere = new THREE.Mesh(sphereGeo, coneMat);
    sphere.position.set(0, 2.5, 0);
    group.add(sphere);
  } else if (marker.type === 'number') {
    // Number marker (flag post with sphere)
    const poleGeo = new THREE.CylinderGeometry(0.05, 0.05, 4, 4);
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(0, 2, 0);
    group.add(pole);

    const flagGeo = new THREE.BoxGeometry(1.2, 0.8, 0.05);
    const flagMat = new THREE.MeshLambertMaterial({ color });
    const flag = new THREE.Mesh(flagGeo, flagMat);
    flag.position.set(0.6, 3.8, 0);
    group.add(flag);
  } else {
    // Evidence icon (diamond shape)
    const diamondGeo = new THREE.OctahedronGeometry(0.8, 0);
    const diamondMat = new THREE.MeshLambertMaterial({ color });
    const diamond = new THREE.Mesh(diamondGeo, diamondMat);
    diamond.position.set(0, 2, 0);
    group.add(diamond);

    const poleGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.5, 4);
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(0, 0.75, 0);
    group.add(pole);
  }

  group.position.set(marker.position[0], marker.position[1], marker.position[2]);
  return group;
}

// ---------------------------------------------------------------------------
// Building Mesh from Coordinates
// ---------------------------------------------------------------------------

function createBuildingMesh(
  coordinates: Array<[number, number]>,
  height: number,
  buildingType?: string,
): THREE.Mesh {
  const shape = new THREE.Shape();
  if (coordinates.length < 3) {
    // Fallback box
    shape.moveTo(-5, -5);
    shape.lineTo(5, -5);
    shape.lineTo(5, 5);
    shape.lineTo(-5, 5);
    shape.closePath();
  } else {
    shape.moveTo(coordinates[0][0], coordinates[0][1]);
    for (let i = 1; i < coordinates.length; i++) {
      shape.lineTo(coordinates[i][0], coordinates[i][1]);
    }
    shape.closePath();
  }

  const extrudeSettings = { depth: height, bevelEnabled: false };
  const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geometry.rotateX(-Math.PI / 2);

  const color = buildingType === 'commercial' ? 0xc4b5a0 : buildingType === 'industrial' ? 0xaaaaaa : COLORS.building;
  const material = new THREE.MeshLambertMaterial({ color });
  const mesh = new THREE.Mesh(geometry, material);
  return mesh;
}

// ---------------------------------------------------------------------------
// Road Mesh from Coordinates
// ---------------------------------------------------------------------------

function createRoadMesh(
  coordinates: Array<[number, number]>,
  width: number,
): THREE.Mesh {
  if (coordinates.length < 2) return new THREE.Mesh();

  const points: THREE.Vector3[] = [];
  for (const [x, z] of coordinates) {
    points.push(new THREE.Vector3(x, 0.02, z));
  }

  // Create road as a flat ribbon
  const vertices: number[] = [];
  const indices: number[] = [];
  const halfW = width / 2;

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    let dir: THREE.Vector3;

    if (i < points.length - 1) {
      dir = new THREE.Vector3().subVectors(points[i + 1], p).normalize();
    } else {
      dir = new THREE.Vector3().subVectors(p, points[i - 1]).normalize();
    }

    const perp = new THREE.Vector3(-dir.z, 0, dir.x);
    const left = new THREE.Vector3().addVectors(p, perp.clone().multiplyScalar(halfW));
    const right = new THREE.Vector3().addVectors(p, perp.clone().multiplyScalar(-halfW));

    vertices.push(left.x, left.y, left.z);
    vertices.push(right.x, right.y, right.z);

    if (i > 0) {
      const base = (i - 1) * 2;
      indices.push(base, base + 1, base + 2);
      indices.push(base + 1, base + 3, base + 2);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const material = new THREE.MeshLambertMaterial({ color: COLORS.road });
  return new THREE.Mesh(geometry, material);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ThreeSceneRenderer({
  sceneData,
  objectSettings,
  markers,
  cameraPreset,
  onSceneReady,
  className = '',
}: ThreeSceneRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<SimpleOrbitControls | null>(null);
  const animFrameRef = useRef<number>(0);
  const objectGroupsRef = useRef<Record<string, THREE.Group>>({});
  const markerGroupRef = useRef<THREE.Group | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize Three.js scene
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(COLORS.sky);
    scene.fog = new THREE.Fog(COLORS.sky, 300, 600);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controls
    const controls = new SimpleOrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
    sunLight.position.set(100, 150, 80);
    sunLight.castShadow = true;
    sunLight.shadow.camera.left = -200;
    sunLight.shadow.camera.right = 200;
    sunLight.shadow.camera.top = 200;
    sunLight.shadow.camera.bottom = -200;
    scene.add(sunLight);

    const fillLight = new THREE.DirectionalLight(0x8888ff, 0.3);
    fillLight.position.set(-50, 80, -50);
    scene.add(fillLight);

    // Ground plane
    const groundGeo = new THREE.PlaneGeometry(800, 800);
    const groundMat = new THREE.MeshLambertMaterial({ color: COLORS.terrain });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    ground.receiveShadow = true;
    scene.add(ground);

    // Object groups
    const groups: Record<string, THREE.Group> = {
      buildings: new THREE.Group(),
      roads: new THREE.Group(),
      sidewalks: new THREE.Group(),
      trees: new THREE.Group(),
      bushes: new THREE.Group(),
      vehicles: new THREE.Group(),
      pedestrians: new THREE.Group(),
      streetlights: new THREE.Group(),
      parking: new THREE.Group(),
      greenSpaces: new THREE.Group(),
      water: new THREE.Group(),
    };

    for (const group of Object.values(groups)) {
      scene.add(group);
    }
    objectGroupsRef.current = groups;

    // Marker group
    const markerGroup = new THREE.Group();
    scene.add(markerGroup);
    markerGroupRef.current = markerGroup;

    // Animation loop
    function animate() {
      animFrameRef.current = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    }
    animate();

    // Handle resize
    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    setIsInitialized(true);

    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(animFrameRef.current);
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Build scene from sceneData
  useEffect(() => {
    if (!isInitialized || !sceneData) return;
    const groups = objectGroupsRef.current;

    // Clear existing
    for (const group of Object.values(groups)) {
      while (group.children.length > 0) {
        const child = group.children[0];
        group.remove(child);
      }
    }

    // Buildings
    for (const b of sceneData.buildings) {
      const mesh = createBuildingMesh(b.coordinates, b.height, b.buildingType);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      groups.buildings.add(mesh);
    }

    // Roads
    for (const r of sceneData.roads) {
      const mesh = createRoadMesh(r.coordinates, r.width);
      groups.roads.add(mesh);
    }

    // Sidewalks
    for (const s of sceneData.sidewalks) {
      const mesh = createRoadMesh(s.coordinates, s.width);
      mesh.material = new THREE.MeshLambertMaterial({ color: COLORS.sidewalk });
      groups.sidewalks.add(mesh);
    }

    // Parking lots
    for (const p of sceneData.parkingLots ?? []) {
      if (p.coordinates.length >= 3) {
        const shape = new THREE.Shape();
        shape.moveTo(p.coordinates[0][0], p.coordinates[0][1]);
        for (let i = 1; i < p.coordinates.length; i++) {
          shape.lineTo(p.coordinates[i][0], p.coordinates[i][1]);
        }
        shape.closePath();
        const geo = new THREE.ShapeGeometry(shape);
        geo.rotateX(-Math.PI / 2);
        const mat = new THREE.MeshLambertMaterial({ color: COLORS.parking });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.y = 0.03;
        groups.parking.add(mesh);
      }
    }

    // Green spaces
    for (const g of sceneData.greenSpaces ?? []) {
      if (g.coordinates.length >= 3) {
        const shape = new THREE.Shape();
        shape.moveTo(g.coordinates[0][0], g.coordinates[0][1]);
        for (let i = 1; i < g.coordinates.length; i++) {
          shape.lineTo(g.coordinates[i][0], g.coordinates[i][1]);
        }
        shape.closePath();
        const geo = new THREE.ShapeGeometry(shape);
        geo.rotateX(-Math.PI / 2);
        const mat = new THREE.MeshLambertMaterial({ color: COLORS.grass });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.y = 0.01;
        groups.greenSpaces.add(mesh);
      }
    }

    // Water features
    for (const w of sceneData.waterFeatures ?? []) {
      if (w.coordinates.length >= 3) {
        const shape = new THREE.Shape();
        shape.moveTo(w.coordinates[0][0], w.coordinates[0][1]);
        for (let i = 1; i < w.coordinates.length; i++) {
          shape.lineTo(w.coordinates[i][0], w.coordinates[i][1]);
        }
        shape.closePath();
        const geo = new THREE.ShapeGeometry(shape);
        geo.rotateX(-Math.PI / 2);
        const mat = new THREE.MeshLambertMaterial({ color: COLORS.water, transparent: true, opacity: 0.8 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.y = -0.05;
        groups.water.add(mesh);
      }
    }
  }, [isInitialized, sceneData]);

  // Place procedural objects (trees, bushes, vehicles, people, streetlights)
  useEffect(() => {
    if (!isInitialized || !sceneData) return;
    const groups = objectGroupsRef.current;

    // Clear procedural objects
    for (const key of ['trees', 'bushes', 'vehicles', 'pedestrians', 'streetlights']) {
      const g = groups[key];
      while (g.children.length > 0) g.remove(g.children[0]);
    }

    const densityMultiplier = objectSettings.vehicleDensity === 'high' ? 3 : objectSettings.vehicleDensity === 'medium' ? 2 : 1;

    // Place trees along roads and in green spaces
    if (objectSettings.showTrees) {
      for (const road of sceneData.roads) {
        for (let i = 0; i < road.coordinates.length; i += 3) {
          const [x, z] = road.coordinates[i];
          const offset = road.width / 2 + 3;
          groups.trees.add(createTree(x + offset, z));
          if (Math.random() > 0.4) {
            groups.trees.add(createTree(x - offset, z));
          }
        }
      }
    }

    // Place bushes
    if (objectSettings.showBushes) {
      for (const road of sceneData.roads) {
        for (let i = 1; i < road.coordinates.length; i += 4) {
          const [x, z] = road.coordinates[i];
          const offset = road.width / 2 + 1.5;
          if (Math.random() > 0.5) {
            groups.bushes.add(createBush(x + offset, z + 1));
          }
        }
      }
    }

    // Place vehicles on roads
    if (objectSettings.showVehicles) {
      const carColors = [0xcc3333, 0x3333cc, 0x33cc33, 0xcccc33, 0x888888, 0xffffff, 0x111111];
      for (const road of sceneData.roads) {
        if (road.roadType === 'footway' || road.roadType === 'path') continue;
        const count = Math.min(road.coordinates.length, densityMultiplier * 2);
        for (let i = 0; i < count; i++) {
          const idx = Math.floor(Math.random() * road.coordinates.length);
          const [x, z] = road.coordinates[idx];
          const laneOffset = (Math.random() > 0.5 ? 1 : -1) * road.width / 4;

          // Calculate rotation from road direction
          let rotation = 0;
          if (idx < road.coordinates.length - 1) {
            const [nx, nz] = road.coordinates[idx + 1];
            rotation = Math.atan2(nz - z, nx - x);
          }

          if (Math.random() > 0.85) {
            groups.vehicles.add(createPoliceVehicle(x + laneOffset, z, rotation));
          } else {
            const carGroup = createCar(x + laneOffset, z, rotation, carColors[Math.floor(Math.random() * carColors.length)]);
            groups.vehicles.add(carGroup);
          }
        }
      }
    }

    // Place pedestrians on sidewalks
    if (objectSettings.showPedestrians) {
      for (const sw of sceneData.sidewalks) {
        for (let i = 0; i < sw.coordinates.length; i += 3) {
          if (Math.random() > 0.6) {
            const [x, z] = sw.coordinates[i];
            groups.pedestrians.add(createPerson(x + Math.random() * 2 - 1, z + Math.random() * 2 - 1));
          }
        }
      }
    }

    // Place streetlights along roads
    if (objectSettings.showStreetlights) {
      for (const road of sceneData.roads) {
        for (let i = 0; i < road.coordinates.length; i += 5) {
          const [x, z] = road.coordinates[i];
          const offset = road.width / 2 + 1;
          groups.streetlights.add(createStreetlight(x + offset, z));
        }
      }
    }
  }, [isInitialized, sceneData, objectSettings]);

  // Update visibility based on toggle settings
  useEffect(() => {
    if (!isInitialized) return;
    const groups = objectGroupsRef.current;
    groups.trees.visible = objectSettings.showTrees;
    groups.bushes.visible = objectSettings.showBushes;
    groups.vehicles.visible = objectSettings.showVehicles;
    groups.pedestrians.visible = objectSettings.showPedestrians;
    groups.streetlights.visible = objectSettings.showStreetlights;
  }, [isInitialized, objectSettings]);

  // Update markers
  useEffect(() => {
    if (!isInitialized || !markerGroupRef.current) return;
    const group = markerGroupRef.current;
    while (group.children.length > 0) group.remove(group.children[0]);

    for (const marker of markers) {
      group.add(createMarkerMesh(marker));
    }
  }, [isInitialized, markers]);

  // Apply camera preset
  useEffect(() => {
    if (!isInitialized || !cameraPreset || !controlsRef.current) return;
    controlsRef.current.setPosition(cameraPreset.position, cameraPreset.target);
  }, [isInitialized, cameraPreset]);

  // Expose API
  useEffect(() => {
    if (!isInitialized || !onSceneReady) return;
    const api: ThreeSceneAPI = {
      getCamera: () => cameraRef.current!,
      getScene: () => sceneRef.current!,
      getRenderer: () => rendererRef.current!,
      setCameraPosition: (pos, target) => {
        controlsRef.current?.setPosition(pos, target);
      },
      captureScreenshot: () => {
        rendererRef.current!.render(sceneRef.current!, cameraRef.current!);
        return rendererRef.current!.domElement.toDataURL('image/png');
      },
      getSceneObjects: () => [],
    };
    onSceneReady(api);
  }, [isInitialized, onSceneReady]);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full min-h-96 bg-gray-900 rounded-lg overflow-hidden ${className}`}
      style={{ touchAction: 'none' }}
    />
  );
}
