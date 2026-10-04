import * as THREE from 'three';
import type { Pick, PresetStore, RenderService, Value, Vec3, World } from '@hm/contracts';
import { MAX_DIST, MIN_DIST, orbitPosition, project, rayFromPixel, stateFromPositionTarget, type OrbitState } from './camera-math';
import type { LightSetup, Quality } from '@hm/lighting';
import { createEnvironment, type EnvironmentRig } from './environment';
import { LightingRig } from './lighting-rig';
import { AvatarView, type Rig } from './avatar-view';
import type { VoxelModel } from '@hm/voxel';
import type { Pose } from '@hm/anim';
import { PostChain } from './post-chain';
import { pixelRatioFor } from './pixel-ratio';
import { GRAPHICS_TIERS, plantsCulled, qualitySpecOf, shadowMapSize, type GraphicsSettings } from './graphics';
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
  setModelPose(index: number, x: number, y: number, z: number, yawDeg: number, scale?: number): void;
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
  /** Your character, split into bones so animation presets can move it (null removes it). `block` is metres per voxel. */
  setAvatar(model: VoxelModel | null, block?: number, rig?: Rig): void;
  /** Feet at (x, y, z), facing `yaw` radians (0 = facing -Z), in `pose` (null = standing). */
  setAvatarPose(x: number, y: number, z: number, yaw: number, pose: Pose | null, visible?: boolean): void;
  /** The lighting setup as it is right now (mid-blend values included), or null while a plain look is in charge. */
  readonly lighting: LightSetup | null;
  /** A ready-made graphics tier (`GRAPHICS_TIERS` in graphics.ts says what each one decides). Same as `setGraphics(GRAPHICS_TIERS[q])`. */
  setQuality(q: Quality): void;
  /** Draw with these graphics settings: a tier, maybe with the player's own changes on top (`resolveGraphics`). */
  setGraphics(g: GraphicsSettings): void;
  /**
   * Only this part of the canvas is seen (CSS pixels from its top-left), e.g. a window onto the view: pixels outside it are not shaded.
   * null draws everything. Used without picture effects (the effects pass draws the whole frame).
   */
  setClip(rect: { readonly x: number; readonly y: number; readonly w: number; readonly h: number } | null): void;
  readonly graphics: GraphicsSettings;
  /** The graphics chip the browser gave this page, as it names it (null before the first mount or when the browser hides it). */
  readonly gpu: string | null;
  /** For profiling from the console (draw calls, triangles, hiding parts of the scene); null while unmounted. */
  readonly debug: { readonly webgl: THREE.WebGLRenderer; readonly scene: THREE.Scene; readonly camera: THREE.PerspectiveCamera; readonly post: boolean } | null;
};

export type LightAnchors = Partial<Record<'focus' | 'lantern' | 'torch' | 'campfire' | 'barrel', Vec3>>;

export interface RenderOptions {
  readonly assetUrl?: (path: string) => string;
  readonly pixelRatio?: number;
  readonly shadows?: boolean;
  readonly background?: 'sky' | 'dark';
  /**
   * Which graphics chip to ask for on machines with two (default 'high-performance'). Only a request: the browser and the operating
   * system decide (on Windows, Settings > System > Display > Graphics can force the fast chip for the browser). `gpu` says what came.
   */
  readonly powerPreference?: 'default' | 'high-performance' | 'low-power';
}

const miss = (): Pick => ({ entity: null, point: null, normal: null, distance: Infinity });

/** The graphics chip's name: the unmasked one where the browser shares it (Chrome, Edge), else the plain one (Firefox gives a real name there too). */
function readGpuName(gl: WebGLRenderingContext | WebGL2RenderingContext): string | null {
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    return typeof name === 'string' && name ? name : null;
  } catch { return null; }
}
const finiteNumber = (value: Value | undefined, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

export function createThreeRenderer(opts: RenderOptions = {}): ThreeRenderer {
  let orbitState: OrbitState = { target: [0, 0, 0], yaw: 0.6, pitch: 0.5, distance: 18, fov: 50 };
  let hostElement: HTMLElement | null = null;
  let webgl: THREE.WebGLRenderer | null = null;
  let scene: THREE.Scene | null = null;
  let viewCamera: THREE.PerspectiveCamera | null = null;
  const defaultNear = 0.05;
  const nearFor = (distance: number): number => Math.min(2, Math.max(defaultNear, distance * 0.008));
  let sceneSync: SceneSync | null = null;
  let sceneAdapter: ThreeSceneAdapter | null = null;
  let environment: EnvironmentRig | null = null;
  let overlays: OverlayManager | null = null;
  let presetStore: PresetStore | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let removeWindowResize: (() => void) | null = null;
  let previousFrame: number | null = null;
  let gpuName: string | null = null;
  let clip: { readonly x: number; readonly y: number; readonly w: number; readonly h: number } | null = null;
  const listeners = new Set<(dtMs: number) => void>();

  const resize = (): void => {
    if (!hostElement || !webgl || !viewCamera) return;
    const rect = hostElement.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width || hostElement.clientWidth || 1));
    const height = Math.max(1, Math.round(rect.height || hostElement.clientHeight || 1));
    // the tier's pixel ratio depends on the canvas size (low keeps to a pixel budget)
    const ratio = pixelRatioFor(graphics, width, height, opts.pixelRatio ?? (typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1));
    if (Math.abs(webgl.getPixelRatio() - ratio) > 1e-3) webgl.setPixelRatio(ratio);
    webgl.setSize(width, height, false);
    post?.setSize(width, height, webgl.getPixelRatio());
    viewCamera.aspect = width / height;
    viewCamera.updateProjectionMatrix();
  };

  let focus: { readonly target: Vec3; readonly radius: number; readonly veil: boolean; readonly hideNear: boolean; readonly falloff: number } | null = null;
  const applyFocus = (): void => {
    if (!viewCamera) return;
    // far views get a bigger near plane: depth precision is spent where the eye is, so the shore and the water do not flicker against each other
    if (!focus) { viewCamera.near = nearFor(orbitState.distance); environment?.setVeil(null); return; }
    const p = orbitPosition(orbitState);
    const d = Math.hypot(p[0] - focus.target[0], p[1] - focus.target[1], p[2] - focus.target[2]);
    viewCamera.near = focus.hideNear ? Math.max(nearFor(d), d - focus.radius * 1.3) : nearFor(d);
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
    avatar?.dispose();
    avatar = null;
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
  /** What the current graphics preset decides (a tier, maybe with the player's own changes on top). */
  let graphics: GraphicsSettings = GRAPHICS_TIERS.high;
  let pendingSetup: LightSetup | null = null;
  let rig: LightingRig | null = null;
  let post: PostChain | null = null;
  let lightFocus: Vec3 = [0, 0, 0];
  let lightAnchors: LightAnchors | undefined;
  let postStale = true;
  let avatar: AvatarView | null = null;
  let pendingAvatar: { model: VoxelModel; block: number; rig?: Rig } | null = null;
  const buildAvatar = (): void => {
    avatar?.dispose();
    avatar = null;
    if (scene && pendingAvatar) { avatar = new AvatarView(pendingAvatar.model, pendingAvatar.rig, pendingAvatar.block); scene.add(avatar.group); }
  };
  /** Picture effects need the lighting rig and `effects` on. Rebuilt when those or smooth edges change (multisampling is fixed at creation). */
  const buildPost = (): void => {
    post?.dispose();
    post = null;
    if (!webgl || !scene || !viewCamera || !rig || !graphics.effects) return;
    post = new PostChain(webgl, scene, viewCamera, graphics.smoothEdges ? 4 : 0);
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
      rig.setShadowCap(shadowMapSize(graphics));
      rig.setReflections(graphics.reflections);
      rig.setClouds(graphics.clouds);
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
    if (scene && pendingDecor && pendingDecor.length) { decorView = new DecorView(pendingDecor); decorGraphics(decorView); scene.add(decorView.group); }
  };
  const decorGraphics = (v: DecorView): void => {
    v.setDetailRadius(graphics.plantDetail > 0 ? graphics.plantDetail : Infinity);
    v.setCulling(plantsCulled(graphics));
    v.setLowCost(graphics.simpleLighting);
    v.setDrawDistance(graphics.plantDistance > 0 ? graphics.plantDistance : Infinity);
  };
  let terrainView: TerrainView | null = null;
  let pendingTerrain: { data: TerrainLike; surfaces: SurfaceArray } | null = null;
  const applyTerrain = (): void => {
    terrainView?.mesh.removeFromParent();
    terrainView?.dispose();
    terrainView = null;
    if (scene && pendingTerrain) {
      terrainView = new TerrainView(pendingTerrain.data, pendingTerrain.surfaces);
      terrainView.setLowCost(graphics.simpleLighting);
      terrainView.setForceFlat(graphics.flatGround);
      scene.add(terrainView.mesh);
    }
    environment?.setSea(!!terrainView);
    environment?.setSeaFloor(pendingTerrain ? seaFloorOf(pendingTerrain.data) : null);
  };
  const seaFloorOf = (t: TerrainLike): { heights: Float32Array; cols: number; rows: number; cell: number; originX: number; originZ: number } =>
    ({ heights: t.heights, cols: t.spec.cols, rows: t.spec.rows, cell: t.spec.cell, originX: t.spec.originX, originZ: t.spec.originZ });

  const service: ThreeRenderer = {
    mount(host: HTMLElement, world: World, store: PresetStore): void {
      unmount();
      hostElement = host;
      presetStore = store;
      const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: opts.powerPreference ?? 'high-performance' });
      gpuName = readGpuName(renderer.getContext());
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
      environment.setLowDetail(graphics.simpleSea);
      applyTerrain();
      applyDecor();
      applyRoad();
      applyModels();
      if (pendingLook) environment.setLook(pendingLook);
      buildRig();
      buildAvatar();
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
    setModelPose(index: number, x: number, y: number, z: number, yawDeg: number, scale?: number): void {
      modelsView?.pose(index, x, y, z, yawDeg, scale);
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
      service.setGraphics(GRAPHICS_TIERS[q]);
    },
    setGraphics(g: GraphicsSettings): void {
      const rebuildPost = g.effects !== graphics.effects || g.smoothEdges !== graphics.smoothEdges;
      graphics = g;
      const shadowSize = shadowMapSize(g);
      if (rig) { rig.setShadowCap(shadowSize); rig.setReflections(g.reflections); rig.setClouds(g.clouds); }
      else environment?.setShadows(shadowSize > 0, Math.max(256, shadowSize));
      environment?.setLowDetail(g.simpleSea);
      if (decorView) decorGraphics(decorView);
      terrainView?.setLowCost(g.simpleLighting);
      terrainView?.setForceFlat(g.flatGround);
      if (rebuildPost) buildPost();
      resize();
      postStale = true;
    },
    get graphics(): GraphicsSettings {
      return graphics;
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
    setAvatar(model: VoxelModel | null, block = 0.04, rig?: Rig): void {
      pendingAvatar = model ? { model, block, ...(rig ? { rig } : {}) } : null;
      buildAvatar();
    },
    setAvatarPose(x: number, y: number, z: number, yaw: number, pose: Pose | null, visible = true): void {
      if (!avatar) return;
      avatar.place(x, y, z, yaw, visible);
      if (pose) avatar.setPose(pose);
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
      if (pendingTerrain) environment?.setSeaFloor(seaFloorOf(pendingTerrain.data));
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
      decorView?.update(viewCamera);
      const frameSeconds = previousFrame === null ? 0.016 : Math.min(0.1, (performance.now() - previousFrame) / 1000);
      if (rig) {
        const changed = rig.update(frameSeconds, { focus: lightFocus, anchors: lightAnchors, time: performance.now() / 1000 });
        if (post && (changed || postStale)) { post.apply(rig.current.post, qualitySpecOf(graphics)); postStale = false; }
      }
      if (post) post.render(frameSeconds);
      else if (clip) {
        // only part of the view is seen (a window onto it): shade just those pixels, the rest of the canvas is hidden anyway
        const h = webgl.domElement.clientHeight;
        webgl.setScissorTest(true);
        webgl.setScissor(clip.x, h - clip.y - clip.h, clip.w, clip.h);
        webgl.render(scene, viewCamera);
        webgl.setScissorTest(false);
      } else webgl.render(scene, viewCamera);
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
    get gpu() {
      return gpuName;
    },
    setClip(rect): void {
      clip = rect && rect.w > 0 && rect.h > 0 ? rect : null;
    },
    get debug() {
      return webgl && scene && viewCamera ? { webgl, scene, camera: viewCamera, post: !!post } : null;
    },
  };
  return service;
}