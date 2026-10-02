import * as THREE from 'three';
import type { Pick, PresetStore, RenderService, Value, Vec3, World } from '@hm/contracts';
import { MAX_DIST, MIN_DIST, orbitPosition, project, rayFromPixel, stateFromPositionTarget, type OrbitState } from './camera-math';
import { QUALITY, type LightSetup, type Quality } from '@hm/lighting';
import { createEnvironment, type EnvironmentRig } from './environment';
import { LightingRig } from './lighting-rig';
import { PostChain } from './post-chain';
import { OverlayManager } from './overlay';
import { pickScene } from './pick-math';
import type { LookLike } from './environment';
import { DecorView, type DecorInstance } from './decor';
import { RoadDecalView, type RoadDecalDef } from './road-decals';
import { ModelsView, type ModelPlacement } from './voxel-view';
import { Bursts, type BurstDef } from './bursts';
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
  /** The world ray under a screen point (for tools that edit things the picker does not know, like voxels). */
  ray(clientX: number, clientY: number): { readonly origin: Vec3; readonly direction: Vec3 } | null;
  /** Move one of the models given to setModels (an avatar walking about) without rebuilding it. */
  setModelPose(index: number, x: number, y: number, z: number, yawDeg: number): void;
  /** A puff, spark or chip burst at a point in the world (the juice on every edit). */
  burst(def: BurstDef): void;
  /** Lens in degrees for the next camera.set (cameras rigs zoom with speed). */
  setFov(deg: number): void;
  /** Voxel models placed in the world (statues, props, avatars); null clears. */
  setModels(items: readonly ModelPlacement[] | null): void;
  /**
   * Focus on one thing: everything beyond it fades to white (`veil` = 'white' or 'both'), and with `hideNear` whatever sits between the camera
   * and the thing is sliced away so you can orbit it freely. `radius` is how big the thing is; `falloff` how soon the white sets in (metres).
   * null leaves focus. Follows the camera while you orbit and zoom.
   */
  setFocus(focus: { readonly target: Vec3; readonly radius: number; readonly veil: boolean; readonly hideNear: boolean; readonly falloff: number } | null): void;
  /**
   * Light the scene with a lighting setup (a `light-setup` preset): sun, sky, haze, lamps, sea tint, tone mapping and the picture effects.
   * The change is a short blend. null goes back to the plain `setLook` mood. Remembered across mount/unmount.
   */
  setLighting(setup: LightSetup | null, blendSeconds?: number): void;
  /** Where the action is: lamps without a prop hang near `focus`, and named props (lantern, torch, campfire, barrel) pin lamps to them. */
  setLightFocus(focus: Vec3, anchors?: LightAnchors): void;
  /** The lighting setup as it is right now (mid-blend values included), or null while a plain look is in charge. */
  readonly lighting: LightSetup | null;
  /**
   * Quality tier. low = pixel ratio 1, no shadows and no picture effects; medium = up to 1.5, 1024 shadows, glow; high = up to 2, 2048
   * shadows, contact shadows, smooth edges; ultra = supersampled, 4096 shadows, all effects.
   */
  setQuality(q: Quality): void;
};

export type LightAnchors = Partial<Record<'focus' | 'lantern' | 'torch' | 'campfire' | 'barrel', Vec3>>;

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
  const defaultNear = 0.05;
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
    post?.setSize(width, height, webgl.getPixelRatio());
    viewCamera.aspect = width / height;
    viewCamera.updateProjectionMatrix();
  };

  let focus: { readonly target: Vec3; readonly radius: number; readonly veil: boolean; readonly hideNear: boolean; readonly falloff: number } | null = null;
  const applyFocus = (): void => {
    if (!viewCamera) return;
    if (!focus) { viewCamera.near = defaultNear; environment?.setVeil(null); return; }
    const p = orbitPosition(orbitState);
    const d = Math.hypot(p[0] - focus.target[0], p[1] - focus.target[1], p[2] - focus.target[2]);
    viewCamera.near = focus.hideNear ? Math.max(defaultNear, d - focus.radius * 1.3) : defaultNear;
    environment?.setVeil(focus.veil ? { color: 0xffffff, near: d + focus.radius * 1.1, far: d + focus.radius * 1.1 + Math.max(2, focus.falloff) } : null);
  };
  const updateView = (): void => {
    if (!viewCamera) return;
    viewCamera.fov = orbitState.fov;
    viewCamera.position.fromArray(orbitPosition(orbitState));
    viewCamera.up.set(0, 1, 0);
    viewCamera.lookAt(...orbitState.target);
    applyFocus();
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
    modelsView?.dispose();
    modelsView = null;
    bursts?.dispose();
    bursts = null;
    roadView = null;
    sceneSync?.dispose();
    sceneAdapter?.dispose();
    overlays?.dispose();
    post?.dispose();
    post = null;
    rig?.dispose();
    rig = null;
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
  let quality: Quality = 'high';
  let pendingSetup: LightSetup | null = null;
  let rig: LightingRig | null = null;
  let post: PostChain | null = null;
  let lightFocus: Vec3 = [0, 0, 0];
  let lightAnchors: LightAnchors | undefined;
  let postStale = true;
  /** Picture effects need the lighting rig and a tier above low. Rebuilt when the tier changes (multisampling is fixed at creation). */
  const buildPost = (): void => {
    post?.dispose();
    post = null;
    if (!webgl || !scene || !viewCamera || !rig || quality === 'low') return;
    post = new PostChain(webgl, scene, viewCamera, quality === 'high' || quality === 'ultra' ? 4 : 0);
    const sky = rig.skyMesh;
    post.hideForAo = sky ? [sky] : [];
    const rect = hostElement?.getBoundingClientRect();
    post.setSize(Math.max(1, Math.round(rect?.width || 1)), Math.max(1, Math.round(rect?.height || 1)), webgl.getPixelRatio());
    postStale = true;
  };
  const buildRig = (): void => {
    rig?.dispose();
    rig = null;
    if (environment && webgl && scene && pendingSetup) {
      rig = new LightingRig(scene, webgl, environment, pendingSetup);
      rig.setShadowCap(quality === 'low' ? 0 : quality === 'ultra' ? 4096 : quality === 'high' ? 2048 : 1024);
    }
    buildPost();
  };
  let roadView: RoadDecalView | null = null;
  let pendingRoad: readonly RoadDecalDef[] | null = null;
  const applyRoad = (): void => {
    if (roadView) { scene?.remove(roadView.group); roadView.dispose(); roadView = null; }
    if (scene && pendingRoad && pendingRoad.length) { roadView = new RoadDecalView(pendingRoad); scene.add(roadView.group); }
  };
  let bursts: Bursts | null = null;
  let modelsView: ModelsView | null = null;
  let pendingModels: readonly ModelPlacement[] | null = null;
  const applyModels = (): void => {
    if (modelsView) { scene?.remove(modelsView.group); modelsView.dispose(); modelsView = null; }
    if (scene && pendingModels && pendingModels.length) { modelsView = new ModelsView(pendingModels); scene.add(modelsView.group); }
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
      viewCamera = new THREE.PerspectiveCamera(orbitState.fov, 1, defaultNear, 6000);
      defineRenderComponents(world);
      sceneAdapter = new ThreeSceneAdapter(scene, opts.assetUrl ?? ((path) => path));
      sceneSync = createSceneSync(world, sceneAdapter);
      sceneSync.step();
      overlays = new OverlayManager(scene);
      bursts = new Bursts();
      scene.add(bursts.points);
      environment = createEnvironment(scene, renderer, opts.background ?? 'sky', opts.shadows !== false);
      applyTerrain();
      applyDecor();
      applyRoad();
      applyModels();
      if (pendingLook) environment.setLook(pendingLook);
      buildRig();
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
    burst(def: BurstDef): void { bursts?.emit(def); },
    setModelPose(index: number, x: number, y: number, z: number, yawDeg: number): void {
      modelsView?.pose(index, x, y, z, yawDeg);
    },
    setFov(deg: number): void {
      orbitState = { ...orbitState, fov: Math.min(150, Math.max(10, deg)) };
    },
    setFocus(f): void {
      focus = f;
      applyFocus();
      viewCamera?.updateProjectionMatrix();
    },
    setModels(items: readonly ModelPlacement[] | null): void {
      pendingModels = items;
      applyModels();
    },
    setRoadDecals(defs: readonly RoadDecalDef[] | null): void {
      pendingRoad = defs;
      applyRoad();
    },
    setQuality(q: Quality): void {
      const changed = q !== quality;
      quality = q;
      const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
      const wanted = opts.pixelRatio ?? dpr;
      // ultra supersamples on ordinary screens: it renders more pixels than the screen has and the picture comes out smoother
      const ratio = q === 'ultra' ? Math.min(2, Math.max(1.5, wanted)) : Math.min(q === 'low' ? 1 : q === 'medium' ? 1.5 : 2, Math.max(0.5, wanted));
      webgl?.setPixelRatio(ratio);
      const shadowSize = q === 'ultra' ? 4096 : q === 'high' ? 2048 : 1024;
      if (rig) rig.setShadowCap(q === 'low' ? 0 : shadowSize);
      else environment?.setShadows(q !== 'low', shadowSize);
      if (changed) buildPost();
      resize();
      postStale = true;
    },
    setLighting(setup: LightSetup | null, blendSeconds = 0.6): void {
      pendingSetup = setup;
      if (!setup) { buildRig(); if (pendingLook) environment?.setLook(pendingLook); return; }
      if (rig) { rig.set(setup, blendSeconds); postStale = true; }
      else buildRig();
    },
    setLightFocus(focus: Vec3, anchors?: LightAnchors): void {
      lightFocus = focus;
      lightAnchors = anchors;
    },
    get lighting(): LightSetup | null {
      return rig ? rig.current : null;
    },
    setLook(look: LookLike): void {
      pendingLook = look;
      if (!rig) environment?.setLook(look);
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
      bursts?.update(previousFrame === null ? 16 : performance.now() - previousFrame);
      updateView();
      const frameSeconds = previousFrame === null ? 0.016 : Math.min(0.1, (performance.now() - previousFrame) / 1000);
      if (rig) {
        const changed = rig.update(frameSeconds, { focus: lightFocus, anchors: lightAnchors, time: performance.now() / 1000 });
        if (post && (changed || postStale)) { post.apply(rig.current.post, QUALITY[quality]); postStale = false; }
      }
      if (post) post.render(frameSeconds);
      else webgl.render(scene, viewCamera);
      const now = performance.now();
      const dt = previousFrame === null ? 0 : now - previousFrame;
      previousFrame = now;
      for (const listener of [...listeners]) listener(dt);
    },
    ray(clientX: number, clientY: number) {
      if (!webgl) return null;
      const rect = webgl.domElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      return rayFromPixel(orbitState, clientX - rect.left, clientY - rect.top, rect.width, rect.height);
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