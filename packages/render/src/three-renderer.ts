import * as THREE from 'three';
import type { Pick, PresetStore, RenderService, Value, Vec3, World } from '@hm/contracts';
import { MAX_DIST, MIN_DIST, orbitPosition, project, rayFromPixel, stateFromPositionTarget, type OrbitState } from './camera-math';
import { createEnvironment, type EnvironmentRig } from './environment';
import { OverlayManager } from './overlay';
import { pickScene } from './pick-math';
import type { LookLike } from './environment';
import { DecorView, type DecorInstance } from './decor';
import { RoadDecalView, type RoadDecalDef } from './road-decals';
import { TerrainView, type DirtyRectLike, type TerrainLike } from './terrain/terrain-view';
import { pickTerrain } from './terrain/terrain-pick';
import type { SurfaceArray } from './terrain/surface-set';
import { createSceneSync, defineRenderComponents, type SceneSync } from './scene-sync';
import { ThreeSceneAdapter } from './three-scene-adapter';

export type ThreeRenderer = RenderService & {
  /** Call after each simulation tick. */
  step(): void;
  /** Show a terrain (the island ground) with its surface set; null removes it. */
  setTerrain(data: TerrainLike | null, surfaces?: SurfaceArray): TerrainView | null;
  /** Re-upload the nodes a brush stroke touched (everything when omitted). */
  refreshTerrain(dirty?: DirtyRectLike | null): void;
  readonly terrain: TerrainView | null;
  /** Show foliage/rocks as instanced meshes; null clears. */
  setDecor(instances: readonly DecorInstance[] | null): void;
  /** Apply a scene mood (sky, sun, fog, exposure, water). Remembered across mount/unmount. */
  setLook(look: LookLike): void;
  /** Painted strips on the road: start line, rumble strips, boost pads (null removes them). */
  setRoadDecals(defs: readonly RoadDecalDef[] | null): void;
  /** Quality tier for phones: low = pixel ratio 1 and no shadows, medium = up to 1.5 and small shadows, high = up to 2 and full shadows. */
  setQuality(q: 'low' | 'medium' | 'high'): void;
};

export interface RenderOptions {
  readonly assetUrl?: (path: string) => string;
  readonly pixelRatio?: number;
  readonly shadows?: boolean;
  readonly background?: 'sky' | 'dark';
}

const miss = (): Pick => ({ entity: null, point: null, normal: null, distance: Infinity });
const finiteNumber = (value: Value | undefined, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

export function createThreeRenderer(opts: RenderOptions = {}): ThreeRenderer {
  let orbitState: OrbitState = { target: [0, 0, 0], yaw: 0.6, pitch: 0.5, distance: 18, fov: 50 };
  let hostElement: HTMLElement | null = null;
  let webgl: THREE.WebGLRenderer | null = null;
  let scene: THREE.Scene | null = null;
  let viewCamera: THREE.PerspectiveCamera | null = null;
  let sceneSync: SceneSync | null = null;
  let sceneAdapter: ThreeSceneAdapter | null = null;
  let environment: EnvironmentRig | null = null;
  let overlays: OverlayManager | null = null;
  let presetStore: PresetStore | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let removeWindowResize: (() => void) | null = null;
  let previousFrame: number | null = null;
  const listeners = new Set<(dtMs: number) => void>();

  const resize = (): void => {
    if (!hostElement || !webgl || !viewCamera) return;
    const rect = hostElement.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width || hostElement.clientWidth || 1));
    const height = Math.max(1, Math.round(rect.height || hostElement.clientHeight || 1));
    webgl.setSize(width, height, false);
    viewCamera.aspect = width / height;
    viewCamera.updateProjectionMatrix();
  };

  const updateView = (): void => {
    if (!viewCamera) return;
    viewCamera.fov = orbitState.fov;
    viewCamera.position.fromArray(orbitPosition(orbitState));
    viewCamera.up.set(0, 1, 0);
    viewCamera.lookAt(...orbitState.target);
    viewCamera.updateProjectionMatrix();
    environment?.update(orbitState.target);
  };

  const unmount = (): void => {
    resizeObserver?.disconnect();
    resizeObserver = null;
    removeWindowResize?.();
    removeWindowResize = null;
    terrainView?.mesh.removeFromParent();
    terrainView?.dispose();
    terrainView = null;
    decorView?.dispose();
    decorView = null;
    roadView?.dispose();
    roadView = null;
    sceneSync?.dispose();
    sceneAdapter?.dispose();
    overlays?.dispose();
    environment?.dispose();
    if (webgl) {
      const canvas = webgl.domElement;
      webgl.renderLists.dispose();
      webgl.dispose();
      webgl.forceContextLoss();
      canvas.remove();
    }
    hostElement = null;
    webgl = null;
    scene = null;
    viewCamera = null;
    sceneSync = null;
    sceneAdapter = null;
    environment = null;
    overlays = null;
    presetStore = null;
    previousFrame = null;
  };

  let pendingLook: LookLike | null = null;
  let roadView: RoadDecalView | null = null;
  let pendingRoad: readonly RoadDecalDef[] | null = null;
  const applyRoad = (): void => {
    if (roadView) { scene?.remove(roadView.group); roadView.dispose(); roadView = null; }
    if (scene && pendingRoad && pendingRoad.length) { roadView = new RoadDecalView(pendingRoad); scene.add(roadView.group); }
  };
  let decorView: DecorView | null = null;
  let pendingDecor: readonly DecorInstance[] | null = null;
  const applyDecor = (): void => {
    decorView?.dispose();
    decorView = null;
    if (scene && pendingDecor && pendingDecor.length) { decorView = new DecorView(pendingDecor); scene.add(decorView.group); }
  };
  let terrainView: TerrainView | null = null;
  let pendingTerrain: { data: TerrainLike; surfaces: SurfaceArray } | null = null;
  const applyTerrain = (): void => {
    terrainView?.mesh.removeFromParent();
    terrainView?.dispose();
    terrainView = null;
    if (scene && pendingTerrain) {
      terrainView = new TerrainView(pendingTerrain.data, pendingTerrain.surfaces);
      scene.add(terrainView.mesh);
    }
    environment?.setSea(!!terrainView);
  };

  const service: ThreeRenderer = {
    mount(host: HTMLElement, world: World, store: PresetStore): void {
      unmount();
      hostElement = host;
      presetStore = store;
      const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
      const deviceRatio = typeof window === 'undefined' ? 1 : window.devicePixelRatio;
      renderer.setPixelRatio(Math.min(2, Math.max(0.5, opts.pixelRatio ?? deviceRatio)));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.95;
      renderer.shadowMap.enabled = opts.shadows !== false;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      renderer.domElement.style.display = 'block';
      host.append(renderer.domElement);
      webgl = renderer;

      scene = new THREE.Scene();
      viewCamera = new THREE.PerspectiveCamera(orbitState.fov, 1, 0.05, 6000);
      defineRenderComponents(world);
      sceneAdapter = new ThreeSceneAdapter(scene, opts.assetUrl ?? ((path) => path));
      sceneSync = createSceneSync(world, sceneAdapter);
      sceneSync.step();
      overlays = new OverlayManager(scene);
      environment = createEnvironment(scene, renderer, opts.background ?? 'sky', opts.shadows !== false);
      applyTerrain();
      applyDecor();
      applyRoad();
      if (pendingLook) environment.setLook(pendingLook);
      updateView();
      resize();

      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(host);
      } else if (typeof window !== 'undefined') {
        window.addEventListener('resize', resize);
        removeWindowResize = () => window.removeEventListener('resize', resize);
      }
    },
    unmount,
    step(): void {
      sceneSync?.step();
    },
    setTerrain(data: TerrainLike | null, surfaces?: SurfaceArray): TerrainView | null {
      pendingTerrain = data && surfaces ? { data, surfaces } : null;
      applyTerrain();
      return terrainView;
    },
    setDecor(instances: readonly DecorInstance[] | null): void {
      pendingDecor = instances;
      applyDecor();
    },
    setRoadDecals(defs: readonly RoadDecalDef[] | null): void {
      pendingRoad = defs;
      applyRoad();
    },
    setQuality(q: 'low' | 'medium' | 'high'): void {
      const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
      webgl?.setPixelRatio(Math.min(q === 'low' ? 1 : q === 'medium' ? 1.5 : 2, Math.max(0.5, opts.pixelRatio ?? dpr)));
      environment?.setShadows(q !== 'low', q === 'high' ? 2048 : 1024);
      resize();
    },
    setLook(look: LookLike): void {
      pendingLook = look;
      environment?.setLook(look);
    },
    refreshTerrain(dirty?: DirtyRectLike | null): void {
      terrainView?.refresh(dirty ?? null);
    },
    get terrain(): TerrainView | null {
      return terrainView;
    },
    render(alpha: number): void {
      if (!webgl || !scene || !viewCamera) return;
      sceneSync?.present(alpha);
      roadView?.animate(performance.now());
      updateView();
      webgl.render(scene, viewCamera);
      const now = performance.now();
      const dt = previousFrame === null ? 0 : now - previousFrame;
      previousFrame = now;
      for (const listener of [...listeners]) listener(dt);
    },
    pick(clientX: number, clientY: number): Pick {
      if (!webgl || !sceneSync) return miss();
      const rect = webgl.domElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return miss();
      const ray = rayFromPixel(orbitState, clientX - rect.left, clientY - rect.top, rect.width, rect.height);
      const hit = pickScene(ray, sceneSync.items(), pendingTerrain ? null : 0);
      if (!pendingTerrain) return hit;
      const ground = pickTerrain(pendingTerrain.data, ray);
      if (!ground || ground.distance >= hit.distance) return hit;
      return { entity: null, point: ground.point, normal: ground.normal, distance: ground.distance };
    },
    setCamera(cameraPreset: string): void {
      if (!presetStore?.get(cameraPreset)) return;
      try {
        const params = presetStore.resolve(cameraPreset).params;
        const distance = Math.min(MAX_DIST, Math.max(MIN_DIST, finiteNumber(params.distance, orbitState.distance)));
        const fov = Math.min(175, Math.max(1, finiteNumber(params.fov, orbitState.fov)));
        orbitState = {
          target: [
            finiteNumber(params.targetX, orbitState.target[0]),
            finiteNumber(params.targetY, orbitState.target[1]),
            finiteNumber(params.targetZ, orbitState.target[2]),
          ],
          yaw: finiteNumber(params.yaw, orbitState.yaw),
          pitch: Math.min(1.5, Math.max(-1.5, finiteNumber(params.pitch, orbitState.pitch))),
          distance,
          fov,
        };
        updateView();
      } catch {
        // Stores may throw while resolving stale references; camera changes are best-effort.
      }
    },
    camera: {
      get position(): Vec3 {
        return orbitPosition(orbitState);
      },
      get target(): Vec3 {
        return [...orbitState.target];
      },
      set(position: Vec3, target: Vec3): void {
        orbitState = stateFromPositionTarget(position, target, orbitState.fov);
        updateView();
      },
      project(world: Vec3): readonly [number, number] {
        if (!webgl) return [-1, -1];
        const rect = webgl.domElement.getBoundingClientRect();
        const result = project(orbitState, world, rect.width, rect.height);
        return result ?? [-1, -1];
      },
    },
    overlay: {
      show(id, shapes): void {
        overlays?.show(id, shapes);
      },
      hide(id): void {
        overlays?.hide(id);
      },
    },
    onFrame(listener: (dtMs: number) => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return service;
}