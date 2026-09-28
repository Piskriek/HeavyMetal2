/**
 * HoopPodFleet — draws every racer's Hoop-Pod (docs/HOOP_POD.md §Fleet, §LOD).
 *
 * Replaces the legacy per-racer sphere + two brass caps + shadow + shield (5 meshes, 1 material and
 * 1 canvas texture per racer) with at most five instanced draws for the whole field:
 *
 *   band 0  standard ≈2k tris   projected radius ≥ 56 px
 *   band 1  lite     ≈1k tris   ≥ 16 px
 *   band 2  far      ≈170 tris  below that — crowns only, the "very low poly at a distance" mesh
 *   + instanced blob shadows and shields
 *
 * LOD is chosen in SCREEN SPACE (camera FOV and viewport height), with hysteresis so a pod on a
 * threshold never flickers. Pods outside the frustum or beyond `cullDistance` are not drawn at all.
 * Each band is packed densely every frame: a band's vertex shader only runs for its own pods.
 *
 * The renderer stays the only caller and still writes nothing to the simulation: `setRacer` copies
 * numbers the sim owns into preallocated typed arrays; `commit` packs them once per frame.
 */
import * as THREE from 'three';
import { RADIUS } from '../scene';
import { MAX_RACERS } from '../contracts/config';
import { PLAYER_ID } from '../roster';
import { loadPaintedDecals } from '../meta/ball-design';
import type { RgbaImage } from '../meta/sphere-decal-baker';
import { acquirePodTextures, releasePodTextures, type PodTextures } from './pod-atlas';
import { podGeometry, projectedRadiusPx, selectPodLodBand, type PodLod, type PodLodBand } from './pod-geometry';
import { createPodMaterials, type PodBakeTextures, type PodMaterials } from './pod-material';
import { POD_LIVERY_EVENT, liveryForRacer, loadPlayerLivery, validateLivery, type PodLivery, type PodRacerIdentity } from './pod-livery';
import { EQUIPPED_BALL_KEY, POD_DESIGN_EVENT, bakeDesign, liveryForDesign, resolvePlayerDesign } from './pod-design';

export { POD_DESIGN_EVENT };

/** Fields the fleet reads from a racer frame. All optional — missing data degrades, never throws. */
export interface PodRacerInput extends PodRacerIdentity {
  readonly vz?: number;
  readonly rollRate?: number;
  readonly shieldUntil?: number;
}
export interface PodVec3 { readonly x: number; readonly y: number; readonly z: number }
export interface PodBakeInput { readonly albedo: RgbaImage; readonly emissive: RgbaImage | null }

export interface HoopPodFleetOptions {
  /** Instance capacity. Defaults to MAX_RACERS (100). */
  readonly capacity?: number;
  /** Collision radius the contact hoops are fitted to. Defaults to scene RADIUS. */
  readonly radius?: number;
  /** Meshes for bands 0/1/2. Defaults to standard/lite/far; the garage uses hero for all three. */
  readonly lods?: readonly [PodLod, PodLod, PodLod];
  /** Skip pods outside the camera frustum. Default true. */
  readonly frustumCull?: boolean;
  /** World units; pods farther than this are not drawn (the track fog is opaque by 48 000). */
  readonly cullDistance?: number;
  /** Garage-design layers in the bake array. Layer 0 is the player's. Default 4. */
  readonly bakeLayers?: number;
  /** Bake width (height = width / 2). 512 in races, 1024 in the garage. */
  readonly bakeWidth?: number;
  /** Race the player's saved Ball Garage design. Default true. */
  readonly playerDesign?: boolean;
  /** Listen for Paint Shop / garage events on `window`. Default true. */
  readonly listen?: boolean;
}

const TAU = Math.PI * 2;
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const X_AXIS = new THREE.Vector3(1, 0, 0);
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const LIV = 19; // prim3 sec3 trim3 glass3 decal3 style4
const COLOR_KEYS = ['iPrim', 'iSec', 'iTrim', 'iGlass', 'iDecal'] as const;

interface Band {
  readonly mesh: THREE.InstancedMesh;
  readonly scale: number;
  readonly anim: THREE.InstancedBufferAttribute;
  readonly style: THREE.InstancedBufferAttribute;
  readonly colors: readonly THREE.InstancedBufferAttribute[];
  count: number;
}

export class HoopPodFleet {
  readonly capacity: number;
  /** Triangles per pod for bands 0/1/2 (diagnostics, docs, tests). */
  readonly triangles: readonly [number, number, number];

  private readonly scene: THREE.Scene;
  private readonly radius: number;
  private readonly frustumCull: boolean;
  private readonly cullDistance2: number;
  private readonly textures: PodTextures;
  private readonly bake: PodBakeTextures;
  private readonly bakeWidth: number;
  private readonly bakeLayers: number;
  private readonly materials: PodMaterials;
  private readonly bands: readonly [Band, Band, Band];
  private readonly shadow: THREE.InstancedMesh;
  private readonly shield: THREE.InstancedMesh;
  private readonly shadowTexture: THREE.CanvasTexture;

  private count = 0;
  private readonly pos: Float32Array;
  private readonly quat: Float32Array;
  private readonly visible: Uint8Array;
  private readonly shieldOn: Uint8Array;
  private readonly band: Int8Array;
  private readonly roll: Float32Array;
  private readonly diff: Float32Array;
  private readonly pitch: Float32Array;
  private readonly lean: Float32Array;
  private readonly prevRate: Float32Array;
  private readonly livery: Float32Array;
  private readonly liveryLoadout: unknown[];
  private readonly liveryColor: (string | undefined)[];
  private readonly liveryId: (number | undefined | null)[];

  private playerLivery: PodLivery | null;
  private readonly usePlayerDesign: boolean;
  private designKey: string | null = null;
  private designLivery: PodLivery | null = null;
  private designToken = 0;
  private designTimer: ReturnType<typeof setTimeout> | null = null;
  private shieldSpin = 0;
  private disposed = false;

  private readonly m4 = new THREE.Matrix4();
  private readonly p = new THREE.Vector3();
  private readonly q = new THREE.Quaternion();
  private readonly q2 = new THREE.Quaternion();
  private readonly up = new THREE.Vector3();
  private readonly s = new THREE.Vector3();
  private readonly color = new THREE.Color();
  private readonly frustum = new THREE.Frustum();
  private readonly projScreen = new THREE.Matrix4();
  private readonly sphere = new THREE.Sphere();
  private readonly flatQuat = new THREE.Quaternion().setFromAxisAngle(X_AXIS, -Math.PI / 2);

  private readonly onLivery = (event: Event) => {
    const detail = (event as CustomEvent<unknown>).detail;
    const result = detail === null ? null : validateLivery(detail);
    this.setPlayerLivery(result && result.ok ? result.livery : null);
  };
  private readonly onDesign = () => this.refreshPlayerDesign();
  private readonly onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === EQUIPPED_BALL_KEY || event.key === 'hm2-ball-designs-v1') this.refreshPlayerDesign();
  };

  constructor(scene: THREE.Scene, options: HoopPodFleetOptions = {}) {
    this.scene = scene;
    this.capacity = Math.max(1, Math.floor(options.capacity ?? MAX_RACERS));
    this.radius = options.radius ?? RADIUS;
    this.frustumCull = options.frustumCull ?? true;
    const cull = options.cullDistance ?? 52000;
    this.cullDistance2 = cull * cull;
    this.bakeWidth = Math.max(64, Math.floor(options.bakeWidth ?? 512));
    this.bakeLayers = Math.max(1, Math.floor(options.bakeLayers ?? 4));
    this.usePlayerDesign = options.playerDesign ?? true;
    this.textures = acquirePodTextures();
    this.bake = { albedo: bakeArray(this.bakeWidth, this.bakeLayers, true), glow: bakeArray(this.bakeWidth, this.bakeLayers, false) };
    this.materials = createPodMaterials(this.textures, this.bake);
    this.playerLivery = loadPlayerLivery();

    const cap = this.capacity;
    const lods = options.lods ?? (['standard', 'lite', 'far'] as const);
    const band = (lod: PodLod, name: string): Band => {
      const src = podGeometry(lod);
      const g = src.geometry.clone();
      const attr = (size: number, dynamic: boolean) => {
        const a = new THREE.InstancedBufferAttribute(new Float32Array(cap * size), size);
        a.setUsage(dynamic ? THREE.DynamicDrawUsage : THREE.StaticDrawUsage);
        return a;
      };
      const anim = attr(4, true);
      const style = attr(4, true);
      const colors = COLOR_KEYS.map(() => attr(3, true));
      g.setAttribute('iAnim', anim);
      g.setAttribute('iStyle', style);
      COLOR_KEYS.forEach((k, i) => g.setAttribute(k, colors[i]));
      const mesh = new THREE.InstancedMesh(g, this.materials.surface, cap);
      mesh.name = name;
      mesh.customDepthMaterial = this.materials.depth;
      mesh.castShadow = true;
      mesh.frustumCulled = false; // culled per instance in commit()
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.count = 0;
      return { mesh, scale: this.radius / src.rideHeight, anim, style, colors, count: 0 };
    };
    this.bands = [band(lods[0], 'HoopPods_Near'), band(lods[1], 'HoopPods_Mid'), band(lods[2], 'HoopPods_Far')];
    this.triangles = [podGeometry(lods[0]).triangles, podGeometry(lods[1]).triangles, podGeometry(lods[2]).triangles];

    this.shadowTexture = blobTexture();
    this.shadow = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(this.radius * 2.5, this.radius * 2.5),
      new THREE.MeshBasicMaterial({ map: this.shadowTexture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
      cap,
    );
    this.shadow.name = 'HoopPods_Shadow';
    this.shield = new THREE.InstancedMesh(
      new THREE.SphereGeometry(this.radius * 1.35, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0x44ddff, transparent: true, opacity: 0.45, wireframe: true }),
      cap,
    );
    this.shield.name = 'HoopPods_Shield';
    for (const m of [this.shadow, this.shield]) {
      m.frustumCulled = false;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.count = 0;
    }

    this.pos = new Float32Array(cap * 3);
    this.quat = new Float32Array(cap * 4);
    this.visible = new Uint8Array(cap);
    this.shieldOn = new Uint8Array(cap);
    this.band = new Int8Array(cap).fill(-1);
    this.roll = new Float32Array(cap);
    this.diff = new Float32Array(cap);
    this.pitch = new Float32Array(cap);
    this.lean = new Float32Array(cap);
    this.prevRate = new Float32Array(cap);
    this.livery = new Float32Array(cap * LIV);
    this.liveryLoadout = new Array<unknown>(cap).fill(undefined);
    this.liveryColor = new Array<string | undefined>(cap).fill(undefined);
    this.liveryId = new Array<number | undefined | null>(cap).fill(null);
    for (let i = 0; i < cap; i++) this.quat[i * 4 + 3] = 1;

    scene.add(this.bands[0].mesh, this.bands[1].mesh, this.bands[2].mesh, this.shadow, this.shield);
    if ((options.listen ?? true) && typeof window !== 'undefined') {
      window.addEventListener(POD_LIVERY_EVENT, this.onLivery);
      window.addEventListener(POD_DESIGN_EVENT, this.onDesign);
      window.addEventListener('storage', this.onStorage);
    }
    this.refreshPlayerDesign();
  }

  /** Sizes the active field (4/20/50/100). Also re-checks which garage design the player races. */
  setCount(count: number): void {
    if (this.disposed) return;
    const next = clamp(Math.floor(Number.isFinite(count) ? count : 0), 0, this.capacity);
    for (let i = this.count; i < next; i++) {
      this.roll[i] = this.diff[i] = this.pitch[i] = this.lean[i] = this.prevRate[i] = 0;
      this.visible[i] = this.shieldOn[i] = 0;
      this.band[i] = -1;
      this.liveryLoadout[i] = this.liveryColor[i] = undefined;
      this.liveryId[i] = null;
      this.writeLivery(i, liveryForRacer({}, i, this.playerLivery), 0);
    }
    this.count = next;
    this.refreshPlayerDesign();
  }

  /**
   * Copies one racer's frame. `gyro` is the level basis from `gyroPose(...).gyro`; the hoops take
   * −rollPhase about local X exactly like the legacy `core` mesh did.
   */
  setRacer(index: number, racer: PodRacerInput, world: PodVec3, gyro: THREE.Quaternion, rollPhase: number, visible: boolean, runTime: number, dt: number): void {
    if (this.disposed || index < 0 || index >= this.count) return;
    const i = index;
    this.pos[i * 3] = world.x;
    this.pos[i * 3 + 1] = world.y;
    this.pos[i * 3 + 2] = world.z;
    this.quat[i * 4] = gyro.x;
    this.quat[i * 4 + 1] = gyro.y;
    this.quat[i * 4 + 2] = gyro.z;
    this.quat[i * 4 + 3] = gyro.w;
    this.visible[i] = visible ? 1 : 0;
    this.roll[i] = Number.isFinite(rollPhase) ? -rollPhase : 0;

    const step = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.1) : 0;
    const rate = Number.isFinite(racer.rollRate) ? (racer.rollRate as number) : 0;
    const vz = Number.isFinite(racer.vz) ? (racer.vz as number) : 0;
    if (step > 0) {
      // Pendulum: the ballasted inner ball lags acceleration and leans into lane changes.
      const accel = (rate - this.prevRate[i]) / step;
      const k = 1 - Math.exp(-step * 6);
      this.pitch[i] += (clamp(-accel * 0.0035, -0.3, 0.3) - this.pitch[i]) * k;
      this.lean[i] += (clamp(-vz * 0.0006, -0.22, 0.22) - this.lean[i]) * k;
      this.diff[i] = (this.diff[i] + rate * clamp(vz / 600, -1, 1) * step) % (TAU * 1000);
    }
    this.prevRate[i] = rate;
    this.shieldOn[i] = (racer.shieldUntil ?? -Infinity) > runTime ? 1 : 0;

    if (racer.loadout !== this.liveryLoadout[i] || racer.color !== this.liveryColor[i] || racer.id !== this.liveryId[i]) {
      this.liveryLoadout[i] = racer.loadout;
      this.liveryColor[i] = racer.color;
      this.liveryId[i] = racer.id;
      const id = Number.isInteger(racer.id) ? (racer.id as number) : i;
      if (id === PLAYER_ID && this.designLivery) this.writeLivery(i, this.designLivery, 1); // layer 0
      else this.writeLivery(i, liveryForRacer(racer, i, this.playerLivery), 0);
    }
  }

  /**
   * Packs the frame. Call AFTER the camera is placed for this frame.
   * @param viewportHeight CSS pixels of the canvas (screen-space LOD); defaults to 720.
   */
  commit(camera?: THREE.Camera, dt = 1 / 60, reducedMotion = false, viewportHeight = 720): void {
    if (this.disposed) return;
    if (!reducedMotion) this.shieldSpin = (this.shieldSpin + dt * 4) % TAU;
    const persp = camera && (camera as THREE.PerspectiveCamera).isPerspectiveCamera ? (camera as THREE.PerspectiveCamera) : null;
    if (camera) {
      camera.updateMatrixWorld();
      this.projScreen.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      this.frustum.setFromProjectionMatrix(this.projScreen);
    }
    const camPos = camera ? camera.position : null;
    const fov = persp ? persp.fov : 60;
    const vh = viewportHeight > 0 ? viewportHeight : 720;
    for (const b of this.bands) b.count = 0;
    let shadows = 0;
    let shields = 0;

    for (let i = 0; i < this.count; i++) {
      if (!this.visible[i]) continue;
      this.p.set(this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]);
      let band: PodLodBand = 0;
      if (camPos) {
        const d2 = this.p.distanceToSquared(camPos);
        if (d2 > this.cullDistance2) continue;
        if (this.frustumCull && !this.frustum.intersectsSphere(this.sphere.set(this.p, this.radius * 1.6))) continue;
        band = selectPodLodBand(projectedRadiusPx(this.radius, Math.sqrt(d2), fov, vh), this.band[i] as PodLodBand | -1);
        this.band[i] = band;
      }
      const b = this.bands[band];
      const k = b.count++;
      this.q.set(this.quat[i * 4], this.quat[i * 4 + 1], this.quat[i * 4 + 2], this.quat[i * 4 + 3]);
      this.m4.compose(this.p, this.q, this.s.set(b.scale, b.scale, b.scale));
      b.mesh.setMatrixAt(k, this.m4);
      b.anim.setXYZW(k, this.roll[i], this.diff[i], this.pitch[i], this.lean[i]);
      const o = i * LIV;
      for (let c = 0; c < 5; c++) b.colors[c].setXYZ(k, this.livery[o + c * 3], this.livery[o + c * 3 + 1], this.livery[o + c * 3 + 2]);
      b.style.setXYZW(k, this.livery[o + 15], this.livery[o + 16], this.livery[o + 17], this.livery[o + 18]);

      // Blob shadow, flat on the road under the contact hoops.
      this.up.copy(Y_AXIS).applyQuaternion(this.q);
      this.p.addScaledVector(this.up, -(this.radius - 2));
      this.q2.copy(this.q).multiply(this.flatQuat);
      this.m4.compose(this.p, this.q2, this.s.set(1, 1, 1));
      this.shadow.setMatrixAt(shadows++, this.m4);

      if (this.shieldOn[i]) {
        this.p.addScaledVector(this.up, this.radius - 2);
        this.q2.setFromAxisAngle(Y_AXIS, this.shieldSpin).premultiply(this.q);
        this.m4.compose(this.p, this.q2, this.s.set(1, 1, 1));
        this.shield.setMatrixAt(shields++, this.m4);
      }
    }

    for (const b of this.bands) {
      b.mesh.count = b.count;
      flush(b.mesh.instanceMatrix, b.count);
      flush(b.anim, b.count);
      flush(b.style, b.count);
      b.colors.forEach((a) => flush(a, b.count));
    }
    this.shadow.count = shadows;
    this.shield.count = shields;
    flush(this.shadow.instanceMatrix, shadows);
    flush(this.shield.instanceMatrix, shields);
  }

  /** How many pods each band drew last frame (diagnostics / data attributes). */
  bandCounts(): [number, number, number] {
    return [this.bands[0].count, this.bands[1].count, this.bands[2].count];
  }

  /** Paint Shop livery for PLAYER_ID. A garage design, when present, takes precedence. */
  setPlayerLivery(livery: PodLivery | null): void {
    this.playerLivery = livery;
    this.invalidateLiveries();
  }

  /** Direct livery write for previews. `bakeLayer` shows that garage bake on the crowns. */
  setLivery(index: number, livery: PodLivery, bakeLayer: number | null = null): void {
    if (index < 0 || index >= this.capacity) return;
    this.writeLivery(index, livery, bakeLayer === null ? 0 : clamp(Math.floor(bakeLayer), 0, this.bakeLayers - 1) + 1);
  }

  /** Uploads a garage bake into `layer` (resampled to the fleet's bake size if needed). */
  setBake(layer: number, bake: PodBakeInput): void {
    if (this.disposed || layer < 0 || layer >= this.bakeLayers) return;
    writeLayer(this.bake.albedo, layer, bake.albedo);
    writeLayer(this.bake.glow, layer, bake.emissive);
  }

  /** Re-resolves the player's garage design (equipped or newest saved) and bakes it off the frame. */
  refreshPlayerDesign(): void {
    if (this.disposed || !this.usePlayerDesign) return;
    const config = resolvePlayerDesign();
    const key = config ? `${config.bakeKey}@${this.bakeWidth}` : null;
    if (key === this.designKey) return;
    this.designKey = key;
    this.designLivery = null;
    this.invalidateLiveries();
    const token = ++this.designToken;
    if (this.designTimer) clearTimeout(this.designTimer);
    if (!config) return;
    const run = () => {
      this.designTimer = null;
      if (this.disposed || token !== this.designToken) return;
      try {
        const bake = bakeDesign(config, this.bakeWidth);
        this.setBake(0, bake);
        this.designLivery = liveryForDesign(config, bake.albedo);
        this.invalidateLiveries();
      } catch {
        this.designKey = null; // a broken design races as the loadout livery, and may retry later
      }
    };
    // Bake off the current frame; re-bake once the painted decal PNGs have decoded.
    this.designTimer = setTimeout(run, 0);
    void loadPaintedDecals().then((n) => {
      if (n > 0 && token === this.designToken && !this.disposed) this.designTimer = setTimeout(run, 0);
    }).catch(() => undefined);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.designTimer) clearTimeout(this.designTimer);
    if (typeof window !== 'undefined') {
      window.removeEventListener(POD_LIVERY_EVENT, this.onLivery);
      window.removeEventListener(POD_DESIGN_EVENT, this.onDesign);
      window.removeEventListener('storage', this.onStorage);
    }
    for (const b of this.bands) {
      this.scene.remove(b.mesh);
      b.mesh.geometry.dispose();
    }
    this.scene.remove(this.shadow, this.shield);
    this.materials.surface.dispose();
    this.materials.depth.dispose();
    this.bake.albedo.dispose();
    this.bake.glow.dispose();
    this.shadow.geometry.dispose();
    (this.shadow.material as THREE.Material).dispose();
    this.shadowTexture.dispose();
    this.shield.geometry.dispose();
    (this.shield.material as THREE.Material).dispose();
    releasePodTextures();
  }

  private invalidateLiveries(): void {
    for (let i = 0; i < this.count; i++) this.liveryId[i] = null;
  }

  private writeLivery(i: number, l: PodLivery, bakeLayerPlusOne: number): void {
    const o = i * LIV;
    const hexes = [l.primary, l.secondary, l.trim, l.glass, l.decalColor];
    for (let c = 0; c < 5; c++) {
      this.color.set(hexes[c]); // sRGB hex → linear working space
      this.livery[o + c * 3] = this.color.r;
      this.livery[o + c * 3 + 1] = this.color.g;
      this.livery[o + c * 3 + 2] = this.color.b;
    }
    this.livery[o + 15] = l.hubDecal;
    this.livery[o + 16] = l.bandPattern;
    this.livery[o + 17] = l.wear;
    this.livery[o + 18] = bakeLayerPlusOne;
  }
}

/* -------------------------------------------------------------------------- */

function flush(attr: THREE.BufferAttribute, count: number): void {
  attr.clearUpdateRanges();
  if (count > 0) attr.addUpdateRange(0, count * attr.itemSize);
  attr.needsUpdate = true;
}

function bakeArray(width: number, layers: number, srgb: boolean): THREE.DataArrayTexture {
  const height = width / 2;
  const t = new THREE.DataArrayTexture(new Uint8Array(width * height * 4 * layers), width, height, layers);
  t.format = THREE.RGBAFormat;
  t.type = THREE.UnsignedByteType;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = THREE.RepeatWrapping; // u wraps the rolling circumference
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter; // distant pods sample small mips: no shimmer
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

/** Nearest-sample copy of an RgbaImage into one array layer (row 0 stays v = 1). Null clears it. */
function writeLayer(tex: THREE.DataArrayTexture, layer: number, img: RgbaImage | null): void {
  const { width: w, height: h } = tex.image;
  const data = tex.image.data as Uint8Array;
  const base = layer * w * h * 4;
  if (!img) {
    data.fill(0, base, base + w * h * 4);
  } else if (img.width === w && img.height === h) {
    data.set(img.data, base);
  } else {
    for (let y = 0; y < h; y++) {
      const sy = Math.min(img.height - 1, Math.floor(((y + 0.5) / h) * img.height));
      for (let x = 0; x < w; x++) {
        const sx = Math.min(img.width - 1, Math.floor(((x + 0.5) / w) * img.width));
        const si = (sy * img.width + sx) * 4;
        const di = base + (y * w + x) * 4;
        data[di] = img.data[si]; data[di + 1] = img.data[si + 1]; data[di + 2] = img.data[si + 2]; data[di + 3] = 255;
      }
    }
  }
  tex.addLayerUpdate(layer);
  tex.needsUpdate = true;
}

function blobTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  if (g) {
    const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    gr.addColorStop(0, 'rgba(8,10,9,.62)');
    gr.addColorStop(0.55, 'rgba(8,10,9,.3)');
    gr.addColorStop(1, 'rgba(8,10,9,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
