/**
 * M01 · T5 — the effect render hook.
 *
 * Owns every GPU object the effects need and creates them at load, never during a race: 64
 * billboard meshes with their own materials, four *sliced* textures per painted sheet (one per
 * frame, cut once from the 2×2 alpha grid), and a single `Points` object for the sparks. `update()`
 * then only reads the queue, maps engine → world with the same `placementFromEngine` the racers use,
 * culls what is too far away, and writes numbers into objects that already exist. No geometry,
 * material, texture, quaternion or array is constructed inside a frame.
 *
 * Slicing matters: three.js applies a texture's `offset`/`repeat` as one shared uniform, so two
 * billboards showing different frames of the same sheet cannot share a texture *and* differ in
 * offset. Four frame textures per sheet — each a plain canvas the browser draws once at load —
 * give every billboard its own frame for free, with no per-slot texture copies (64 copies of a
 * 972² sheet would be a quarter of a gigabyte of VRAM).
 *
 * The billboards face the camera by copying its quaternion, which reads correctly from inside the
 * cockpit (where the camera is inside the ball) as well as from the chase camera.
 */
import * as THREE from 'three';
import {
  BILLBOARD_POOL, EFFECT_CULL_DISTANCE, EFFECT_SPECS, SPARK_PARTICLES,
  BillboardPool, SparkField,
} from './pool';
import type { EffectEvent } from './events';
import type { CourseId } from '../types';
import { placementFromEngine, type PhysicalRampSurface, type TrackSpaceMap } from '../track-space';

/** The sheets the runtime needs, with their grid. */
export const EFFECT_SHEETS = {
  'anim-43': { url: '/art/animated/alpha/anim-43-explosion-fire.png', cols: 2, rows: 2 },
  'anim-44': { url: '/art/animated/alpha/anim-44-spark-burst.png', cols: 2, rows: 2 },
  'anim-45': { url: '/art/animated/alpha/anim-45-smoke-puff.png', cols: 2, rows: 2 },
  'anim-49': { url: '/art/animated/alpha/anim-49-dust-puff.png', cols: 2, rows: 2 },
  'anim-54': { url: '/art/animated/alpha/anim-54-nitro-flame.png', cols: 2, rows: 2 },
  'anim-55': { url: '/art/animated/alpha/anim-55-boost-pad-flash.png', cols: 2, rows: 2 },
  'anim-56': { url: '/art/animated/alpha/anim-56-pickup-collect-burst.png', cols: 2, rows: 2 },
  'anim-57': { url: '/art/animated/alpha/anim-57-shield-shatter.png', cols: 2, rows: 2 },
  'anim-58': { url: '/art/animated/alpha/anim-58-spring-launch-puff.png', cols: 2, rows: 2 },
  'anim-59': { url: '/art/animated/alpha/anim-59-landing-shockwave.png', cols: 2, rows: 2 },
  'anim-60': { url: '/art/animated/alpha/anim-60-tree-smash-splinters.png', cols: 2, rows: 2 },
} as const;

export type SheetKey = keyof typeof EFFECT_SHEETS;
const SHEET_KEYS = Object.keys(EFFECT_SHEETS) as SheetKey[];

/** Every sheet the runtime needs, for the preloader (law 4: nothing decodes during a race). */
export const EFFECT_ART_PATHS: readonly string[] = Object.values(EFFECT_SHEETS).map((sheet) => sheet.url);

export interface EffectFrameInput {
  /** The engine's queue. `readSince` is called once per frame with the renderer's own cursor. */
  readonly queue: { readSince(cursor: number, out: EffectEvent[]): number };
  readonly space: TrackSpaceMap;
  readonly ramps: readonly PhysicalRampSurface[];
  /** The course being raced: effects sit on its hill profile, like the balls (M10). */
  readonly course: CourseId;
  /** Seconds, monotonic (the engine's run time). */
  readonly time: number;
  /** Seconds since the previous frame, clamped by the caller. */
  readonly dt: number;
}

export class EffectRenderer {
  private readonly group = new THREE.Group();
  private readonly pool = new BillboardPool(BILLBOARD_POOL);
  private readonly sparks = new SparkField(SPARK_PARTICLES);
  private readonly events: EffectEvent[] = [];
  /** Four sliced textures per sheet: `frameTextures.get(key)?.[frame]`. */
  private readonly frameTextures = new Map<SheetKey, THREE.Texture[]>();
  /** 1×1 transparent stand-in, so a material always has a `map` and swapping one never recompiles. */
  private readonly placeholder: THREE.DataTexture;
  private readonly meshes: THREE.Mesh[] = [];
  private readonly quaternion = new THREE.Quaternion();
  private readonly sparkPositions: Float32Array;
  private readonly sparkColors: Float32Array;
  private readonly pointGeometry: THREE.BufferGeometry;
  private readonly points: THREE.Points;
  private readonly sharedGeometry = new THREE.PlaneGeometry(1, 1);
  private cursor = 0;
  private spawned = 0;
  private lastDraw = 0;

  constructor(parent: THREE.Object3D) {
    this.group.name = 'EffectRuntime';
    parent.add(this.group);

    this.placeholder = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);
    this.placeholder.needsUpdate = true;

    for (const key of SHEET_KEYS) this.loadSheet(key);

    for (let i = 0; i < BILLBOARD_POOL; i++) {
      const material = new THREE.MeshBasicMaterial({
        map: this.placeholder, transparent: true, depthWrite: false, side: THREE.DoubleSide,
        toneMapped: false, opacity: 1,
      });
      const mesh = new THREE.Mesh(this.sharedGeometry, material);
      mesh.visible = false;
      mesh.frustumCulled = false;
      mesh.renderOrder = 10;
      this.meshes.push(mesh);
      this.group.add(mesh);
    }

    this.sparkPositions = new Float32Array(SPARK_PARTICLES * 3);
    this.sparkColors = new Float32Array(SPARK_PARTICLES * 3);
    this.pointGeometry = new THREE.BufferGeometry();
    this.pointGeometry.setAttribute('position', new THREE.BufferAttribute(this.sparkPositions, 3));
    this.pointGeometry.setAttribute('color', new THREE.BufferAttribute(this.sparkColors, 3));
    this.pointGeometry.setDrawRange(0, 0);
    this.points = new THREE.Points(this.pointGeometry, new THREE.PointsMaterial({
      size: EFFECT_SPECS.sparks.size, sizeAttenuation: true, vertexColors: true,
      transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending,
    }));
    this.points.frustumCulled = false;
    this.points.visible = false;
    this.points.renderOrder = 11;
    this.group.add(this.points);
  }

  /** Decodes one sheet and slices its frames. Nothing here runs while a race is in progress. */
  private loadSheet(key: SheetKey): void {
    const sheet = EFFECT_SHEETS[key];
    if (typeof document === 'undefined') return; // headless: no canvas, no textures
    const loader = new THREE.TextureLoader();
    loader.load(sheet.url, (image) => {
      const source = image.image as CanvasImageSource & { width?: number; height?: number };
      const width = Math.max(1, Math.floor((source.width ?? sheet.cols) / sheet.cols));
      const height = Math.max(1, Math.floor((source.height ?? sheet.rows) / sheet.rows));
      const frames: THREE.Texture[] = [];
      for (let frame = 0; frame < sheet.cols * sheet.rows; frame++) {
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) continue;
        // Sheet layout is row-major with frame 0 at the top-left (animFrameUV's own convention).
        const col = frame % sheet.cols;
        const row = Math.floor(frame / sheet.cols);
        context.drawImage(source as CanvasImageSource, col * width, row * height, width, height, 0, 0, width, height);
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.needsUpdate = true;
        frames.push(texture);
      }
      if (frames.length === sheet.cols * sheet.rows) this.frameTextures.set(key, frames);
      image.dispose();
    });
  }

  /** Billboards spawned since the last reset, and what the pool had to refuse. */
  get spawnCount(): number { return this.spawned; }
  get liveCount(): number { return this.pool.live; }
  get droppedCount(): number { return this.pool.dropped; }
  get sparkCount(): number { return this.sparks.live; }
  /** Events drawn by the last frame (0 is the normal case). */
  get lastDrawn(): number { return this.lastDraw; }

  /** A restart must not replay the previous race's effects: drop what is queued, empty the pool. */
  reset(queue: { readSince(cursor: number, out: EffectEvent[]): number }): void {
    this.pool.clear();
    this.sparks.clear();
    this.spawned = 0;
    this.lastDraw = 0;
    // Consume whatever is already queued, so a fresh run cannot fire stale explosions.
    this.cursor = queue.readSince(0, this.events);
    for (const mesh of this.meshes) mesh.visible = false;
    this.points.visible = false;
  }

  /** Drains the queue, spawns, advances the pool, writes the GPU-side numbers. */
  update(input: EffectFrameInput, camera: THREE.Camera, reducedMotion: boolean): number {
    const { queue, space, ramps, course, time, dt } = input;
    this.quaternion.copy(camera.quaternion);
    this.cursor = queue.readSince(this.cursor, this.events);
    let drawn = 0;
    for (const event of this.events) {
      const spec = EFFECT_SPECS[event.kind];
      const placement = placementFromEngine(space, { x: event.x, y: event.y, z: event.z, course }, ramps);
      const world = placement.world;
      const dx = world.x - camera.position.x;
      const dy = world.y - camera.position.y;
      const dz = world.z - camera.position.z;
      // Culling by distance keeps a pile-up behind the field from costing a draw call.
      if (dx * dx + dy * dy + dz * dz > EFFECT_CULL_DISTANCE * EFFECT_CULL_DISTANCE) continue;
      if (spec.sheet === 'points') {
        if (!reducedMotion) this.sparks.spawn(world.x, world.y, world.z, 18, 330, spec.life);
        drawn += 1;
        continue;
      }
      const spawned = this.pool.spawn(
        event.kind, spec, time, world.x, world.y, world.z, event.scale, placement.frame.up, event.tint,
      );
      if (spawned > 0) this.spawned += spawned;
      drawn += 1;
    }
    this.lastDraw = drawn;

    this.pool.update(time, reducedMotion);
    this.sparks.update(reducedMotion ? 0 : dt);
    this.writeBillboards(reducedMotion);
    this.writeSparks(reducedMotion);
    return drawn;
  }

  /** Copies the pool into the meshes: position, size, camera-facing orientation, sheet frame. */
  private writeBillboards(reducedMotion: boolean): void {
    const slots = this.pool.all;
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const mesh = this.meshes[i];
      if (!slot.active) { if (mesh.visible) mesh.visible = false; continue; }
      const position = this.pool.positionOf(slot);
      const size = this.pool.sizeOf(slot, reducedMotion);
      mesh.position.set(position.x, position.y, position.z);
      mesh.scale.set(size, size, 1);
      mesh.quaternion.copy(this.quaternion);
      const material = mesh.material as THREE.MeshBasicMaterial;
      const frames = this.frameTextures.get(slot.sheet as SheetKey);
      const frame = frames?.[slot.frame % (frames?.length || 1)];
      // A pointer swap between two decoded frames (or the stand-in) — never a recompile, never a copy.
      if (frame && material.map !== frame) material.map = frame;
      // A supply burst wears the supply's colour; every other sheet paints itself (white).
      if (material.color.getHex() !== slot.colour) material.color.setHex(slot.colour);
      material.opacity = slot.opacity;
      if (!mesh.visible) mesh.visible = true;
    }
  }

  /** Compacts the live sparks into the front of the buffers and sets the draw range. */
  private writeSparks(reducedMotion: boolean): void {
    const { x, y, z, life, capacity } = this.sparks;
    const tint = EFFECT_SPECS.sparks.tint;
    const r = ((tint >> 16) & 0xff) / 255;
    const g = ((tint >> 8) & 0xff) / 255;
    const b = (tint & 0xff) / 255;
    let live = 0;
    for (let i = 0; i < capacity; i++) {
      if (life[i] <= 0) continue;
      this.sparkPositions[live * 3] = x[i];
      this.sparkPositions[live * 3 + 1] = y[i];
      this.sparkPositions[live * 3 + 2] = z[i];
      const fade = Math.min(1, life[i] * 4);
      this.sparkColors[live * 3] = r * fade;
      this.sparkColors[live * 3 + 1] = g * fade;
      this.sparkColors[live * 3 + 2] = b * fade;
      live += 1;
    }
    this.pointGeometry.setDrawRange(0, live);
    this.points.visible = live > 0 && !reducedMotion;
    if (live === 0) return;
    (this.pointGeometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (this.pointGeometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
  }

  destroy(): void {
    for (const mesh of this.meshes) (mesh.material as THREE.Material).dispose();
    for (const frames of this.frameTextures.values()) for (const texture of frames) texture.dispose();
    this.frameTextures.clear();
    this.placeholder.dispose();
    this.sharedGeometry.dispose();
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
    this.group.clear();
    this.group.removeFromParent();
  }
}
