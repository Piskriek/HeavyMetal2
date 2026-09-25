/**
 * C1 (interim) — the race's gameplay obstacles, drawn.
 *
 * The engine's layout (gaps, boost pads, springs, sheep, TNT, spinners, rock gates…) was physics
 * only: the 3D renderer never read it, so balls hit invisible sheep and dropped through lane gaps
 * under solid-looking road. This layer draws a marker for every obstacle, at the exact lane and
 * distance the physics uses, from art the game already loads. It is deliberately simple — flat
 * road quads, billboards and tinted blocks — until obstacles become builder props (big move 1).
 *
 * Built once per layout (the engine rebuilds its obstacle array on every reset); per frame it only
 * toggles visibility for things a hit removes (TNT, sheep). No per-frame allocation.
 */
import * as THREE from 'three';
import type { GameAssets } from './assets';
import { LANE_WIDTH, RADIUS, obstacleBounds, obstacleZ, type Obstacle } from './scene';
import {
  engineDistanceFromX, worldFromCanonical, type TrackSpaceMap,
} from './track-space';

/** Height of a standing billboard (sheep, TNT, spring), world units. */
export const OBSTACLE_SPRITE_HEIGHT = 130;
/** Lift of road markings above the road, so they never z-fight with it. */
export const ROAD_MARK_LIFT = 2.5;

/** Kinds drawn as a flat mark on the road. */
const ROAD_KINDS = new Set(['gap', 'boost', 'ramp']);
/** Kinds drawn as a standing billboard from sprite art. */
const SPRITE_ART: Record<string, keyof GameAssets> = { sheep: 'sheep', tnt: 'tnt', spring: 'spring' };
/** Kinds drawn as a tinted block (no dedicated art yet). */
const BLOCK_COLOURS: Record<string, number> = {
  pinball_spinner: 0xd9a21b,
  rock_gate: 0x7d746a,
  water_rock: 0x5f6b70,
  cauldron: 0x2b2522,
  roller_rails: 0x6b4a2b,
};

export interface ObstacleViewStats {
  /** Obstacles with a marker in the current layout. */
  drawn: number;
  /** Obstacles in the layout with no marker (scenery kinds and decorative effects). */
  skipped: number;
}

export class ObstacleView {
  readonly root = new THREE.Group();
  readonly stats: ObstacleViewStats = { drawn: 0, skipped: 0 };
  private layout: readonly Obstacle[] | null = null;
  /** Markers a hit can remove, with the obstacle that owns them. */
  private removable: { obstacle: Obstacle; object: THREE.Object3D }[] = [];
  private readonly materials = new Map<string, THREE.Material>();
  private readonly textures: THREE.Texture[] = [];
  private readonly geometries: THREE.BufferGeometry[] = [];

  constructor(
    private readonly parent: THREE.Object3D,
    private readonly assets: Partial<GameAssets>,
    private readonly map: TrackSpaceMap,
  ) {
    this.root.name = 'ObstacleView';
    parent.add(this.root);
  }

  /** Call every frame with the engine's obstacle array; rebuilds only when the layout changes. */
  update(obstacles: readonly Obstacle[]): void {
    if (obstacles !== this.layout) this.build(obstacles);
    for (const { obstacle, object } of this.removable) object.visible = !obstacle.hit;
  }

  dispose(): void {
    this.clear();
    for (const material of this.materials.values()) material.dispose();
    this.materials.clear();
    for (const texture of this.textures) texture.dispose();
    this.textures.length = 0;
    this.parent.remove(this.root);
  }

  // ---------------------------------------------------------------------------

  private clear(): void {
    for (const child of [...this.root.children]) this.root.remove(child);
    for (const geometry of this.geometries) geometry.dispose();
    this.geometries.length = 0;
    this.removable = [];
  }

  private build(obstacles: readonly Obstacle[]): void {
    this.clear();
    this.layout = obstacles;
    let drawn = 0; let skipped = 0;
    for (const obstacle of obstacles) {
      const object = this.markerFor(obstacle);
      if (!object) { skipped += 1; continue; }
      this.root.add(object);
      drawn += 1;
      if (obstacle.kind === 'tnt' || obstacle.kind === 'sheep') this.removable.push({ obstacle, object });
    }
    this.stats.drawn = drawn;
    this.stats.skipped = skipped;
  }

  private markerFor(obstacle: Obstacle): THREE.Object3D | null {
    if (ROAD_KINDS.has(obstacle.kind)) return this.roadMark(obstacle);
    const art = SPRITE_ART[obstacle.kind];
    if (art) return this.billboard(obstacle, art);
    const colour = BLOCK_COLOURS[obstacle.kind];
    if (colour !== undefined) return this.block(obstacle, colour);
    return null; // blimps, signs, splashes, torches, bridges: scenery the track already shows
  }

  /** Arc distance on the ribbon for an engine x. */
  private s(x: number): number {
    return this.map.trackDistFromEngineDistance(engineDistanceFromX(x));
  }

  /** A world point on the road at engine (x, z), `height` above it. */
  private at(x: number, z: number, height: number): THREE.Vector3 {
    const p = worldFromCanonical(this.map, { s: this.s(x), laneZ: z, altitude: height - RADIUS });
    return new THREE.Vector3(p.world.x, p.world.y, p.world.z);
  }

  /** Gaps (a dark hole), boost pads (an orange strip) and ramps (a sloped deck), lying on the road. */
  private roadMark(obstacle: Obstacle): THREE.Mesh {
    const bounds = obstacle.kind === 'boost'
      ? { near: obstacleZ(obstacle) - 55, far: obstacleZ(obstacle) + 55 }
      : obstacleBounds(obstacle);
    const x0 = obstacle.x; const x1 = obstacle.x + obstacle.width;
    const rise = obstacle.kind === 'ramp' ? obstacle.height : 0;
    // Enough segments to follow the road's curve over the obstacle's length.
    const segments = Math.max(2, Math.ceil(obstacle.width / 60));
    const positions: number[] = []; const uvs: number[] = []; const index: number[] = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const x = x0 + (x1 - x0) * t;
      // Ramps follow the physics profile (rampSurface: height · t^1.6).
      const h = ROAD_MARK_LIFT + rise * Math.pow(t, 1.6);
      for (const [j, z] of [bounds.near, bounds.far].entries()) {
        const p = this.at(x, z, h);
        positions.push(p.x, p.y, p.z);
        uvs.push(j, t);
      }
      if (i > 0) { const a = (i - 1) * 2; index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(index);
    geometry.computeVertexNormals();
    this.geometries.push(geometry);
    const mesh = new THREE.Mesh(geometry, this.roadMaterial(obstacle.kind));
    mesh.name = `Obstacle_${obstacle.kind}`;
    mesh.renderOrder = 2;
    return mesh;
  }

  private roadMaterial(kind: string): THREE.Material {
    const cached = this.materials.get(`road:${kind}`);
    if (cached) return cached;
    const shared = { side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 };
    const material = kind === 'gap'
      ? new THREE.MeshBasicMaterial({ color: 0x070504, ...shared })
      : kind === 'boost'
        ? new THREE.MeshBasicMaterial({ color: 0xff8a1f, transparent: true, opacity: 0.85, ...shared })
        : new THREE.MeshLambertMaterial({ color: 0x8a5a2b, ...shared });
    this.materials.set(`road:${kind}`, material);
    return material;
  }

  /** Sheep, TNT and springs: the game's own sprite art, standing in their lane. */
  private billboard(obstacle: Obstacle, art: keyof GameAssets): THREE.Object3D | null {
    const material = this.spriteMaterial(art);
    if (!material) return this.block(obstacle, 0xb0b0b0);
    const sprite = new THREE.Sprite(material);
    const image = (this.assets[art] as { width?: number; height?: number } | undefined);
    const aspect = image?.width && image?.height ? image.width / image.height : 1;
    sprite.scale.set(OBSTACLE_SPRITE_HEIGHT * aspect, OBSTACLE_SPRITE_HEIGHT, 1);
    sprite.position.copy(this.at(obstacle.x + obstacle.width / 2, obstacleZ(obstacle), OBSTACLE_SPRITE_HEIGHT / 2));
    sprite.name = `Obstacle_${obstacle.kind}`;
    return sprite;
  }

  private spriteMaterial(art: keyof GameAssets): THREE.SpriteMaterial | null {
    const key = `sprite:${String(art)}`;
    const cached = this.materials.get(key);
    if (cached) return cached as THREE.SpriteMaterial;
    const source = (this.assets[art] as { image?: HTMLImageElement } | undefined)?.image;
    if (!source) return null;
    const texture = new THREE.Texture(source);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    this.textures.push(texture);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    this.materials.set(key, material);
    return material;
  }

  /** Kinds with no art yet: a tinted block across the lanes they occupy, so they are at least seen. */
  private block(obstacle: Obstacle, colour: number): THREE.Mesh {
    const bounds = obstacleBounds(obstacle);
    const width = Math.max(LANE_WIDTH * 0.5, bounds.far - bounds.near);
    const height = 80;
    // x across the road, z along it (lookAt below points +z down the road).
    const geometry = new THREE.BoxGeometry(width * 0.9, height, Math.max(40, Math.min(obstacle.width, 200)));
    this.geometries.push(geometry);
    let material = this.materials.get(`block:${colour}`);
    if (!material) { material = new THREE.MeshLambertMaterial({ color: colour }); this.materials.set(`block:${colour}`, material); }
    const mesh = new THREE.Mesh(geometry, material);
    const x = obstacle.x + obstacle.width / 2;
    const z = (bounds.near + bounds.far) / 2;
    mesh.position.copy(this.at(x, z, height / 2));
    // Square to the road: +z along the road's direction.
    mesh.lookAt(this.at(x + 20, z, height / 2));
    mesh.name = `Obstacle_${obstacle.kind}`;
    return mesh;
  }
}

