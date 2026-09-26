/**
 * The race's gameplay obstacles, drawn with the painted track art.
 *
 * The engine's layout (gaps, boost pads, springs, sheep, TNT, spinners, rock gates…) was physics
 * only: the 3D renderer never read it, so balls hit invisible sheep and dropped through lane gaps
 * under solid-looking road. This layer draws a marker for every obstacle, at the exact lane and
 * distance the physics uses. Every marker is painted art now — the interim flat colours (orange
 * pads, black gaps, brown ramps) and tinted boxes (spinner, rock gate, water rock, cauldron,
 * roller rails) are gone:
 *
 *  - road marks wear a texture (chevrons that repeat along a boost pad and scroll toward the
 *    direction of travel, a painted pit inside a gap, a timber deck on a ramp),
 *  - obstacles beside and across the road are painted billboards,
 *  - the cauldron and the pinball spinner play their painted sheets, the spinner's frame driven by
 *    the sim's own spinner state,
 *  - every gap is announced by a warning sign a few car-lengths before it.
 *
 * Reduced motion holds every sheet on frame 0 and stops the chevrons scrolling.
 *
 * Built once per layout (the engine rebuilds its obstacle array on every reset); per frame it only
 * toggles visibility for things a hit removes (TNT, sheep) and writes texture offsets. No per-frame
 * allocation.
 */
import * as THREE from 'three';
import type { GameAssets } from './assets';
import { loadArtImage } from './art-assets';
import { LANE_WIDTH, RADIUS, obstacleBounds, obstacleZ, type Obstacle } from './scene';
import {
  engineDistanceFromX, worldFromCanonical, type TrackSpaceMap,
} from './track-space';

/** Height of a standing billboard (sheep, TNT, spring), world units. */
export const OBSTACLE_SPRITE_HEIGHT = 130;
/** Lift of road markings above the road, so they never z-fight with it. */
export const ROAD_MARK_LIFT = 2.5;
/** How far before a gap its warning sign stands, engine units. */
export const GAP_SIGN_LEAD = 400;
/** Height of the gap warning sign, world units. */
export const GAP_SIGN_HEIGHT = 240;
/** Chevron scroll, in texture repeats per second. */
export const BOOST_SCROLL_RATE = 0.55;

/* -----------------------------------------------------------------------------
   1. THE PAINTED ART
   -------------------------------------------------------------------------- */

/** Every painted file this layer draws with. */
export const TRACK_ART = {
  boostPad: '/art/track-obstacles/tex/boost-pad-chevrons.png',
  gapPit: '/art/track-obstacles/tex/gap-pit.png',
  rampDeck: '/art/track-obstacles/tex/ramp-deck.png',
  gapSign: '/art/track-obstacles/gap-warning-sign.png',
  rockGate: '/art/track-obstacles/rock-gate.png',
  waterRock: '/art/track-obstacles/water-rock.png',
  rollerRails: '/art/track-obstacles/roller-rails.png',
  cauldron: '/art/animated/alpha/anim-06-molten-cauldron.png',
  spinner: '/art/animated/alpha/anim-53-pinball-spinner.png',
  shieldBubble: '/art/track-obstacles/shield-bubble-hex.png',
} as const;

/** A painted sheet: a grid of frames in one file. */
export interface SheetGrid {
  readonly cols: number;
  readonly rows: number;
  readonly fps: number;
}

/**
 * How each obstacle kind is drawn. `sprite` kinds wear the game's own painted sprite sheet
 * (`track-sprites.png`, loaded as `GameAssets`); every other kind names a painted file.
 *
 * There is deliberately no "flat colour" or "tinted box" entry: a kind with no art is not drawn.
 */
export type ObstacleArt =
  | { readonly style: 'road'; readonly art: string; readonly tileLength: number; readonly scroll: number; readonly lit: boolean }
  | { readonly style: 'billboard'; readonly art: string; readonly heightScale: number; readonly minHeight: number }
  | { readonly style: 'sprite'; readonly art: keyof GameAssets }
  | { readonly style: 'sheet'; readonly art: string; readonly sheet: SheetGrid; readonly heightScale: number; readonly minHeight: number };

export const OBSTACLE_ART: Readonly<Record<string, ObstacleArt>> = Object.freeze({
  // Road marks. `tileLength` is how many engine units one copy of the texture covers.
  boost: { style: 'road', art: TRACK_ART.boostPad, tileLength: 130, scroll: BOOST_SCROLL_RATE, lit: false },
  gap: { style: 'road', art: TRACK_ART.gapPit, tileLength: 0, scroll: 0, lit: false },
  ramp: { style: 'road', art: TRACK_ART.rampDeck, tileLength: 220, scroll: 0, lit: true },
  // Painted billboards.
  rock_gate: { style: 'billboard', art: TRACK_ART.rockGate, heightScale: 1, minHeight: 300 },
  water_rock: { style: 'billboard', art: TRACK_ART.waterRock, heightScale: 1.3, minHeight: 120 },
  roller_rails: { style: 'billboard', art: TRACK_ART.rollerRails, heightScale: 3, minHeight: 110 },
  // Painted sheets, played frame by frame.
  cauldron: { style: 'sheet', art: TRACK_ART.cauldron, sheet: { cols: 2, rows: 2, fps: 6 }, heightScale: 1.6, minHeight: 200 },
  pinball_spinner: { style: 'sheet', art: TRACK_ART.spinner, sheet: { cols: 2, rows: 2, fps: 12 }, heightScale: 1.8, minHeight: 160 },
  // The game's own painted sprites.
  sheep: { style: 'sprite', art: 'sheep' },
  tnt: { style: 'sprite', art: 'tnt' },
  spring: { style: 'sprite', art: 'spring' },
});

/** The art a kind is drawn with, or `null` for the scenery kinds the track itself already shows. */
export function obstacleArtFor(kind: string): ObstacleArt | null {
  return OBSTACLE_ART[kind] ?? null;
}

/** Everything the preloader must decode before the grid: nothing may decode mid-race. */
export const TRACK_ART_PATHS: readonly string[] = Object.freeze(Object.values(TRACK_ART));

/** Images decoded by `preloadTrackArt`, so a marker can be built without waiting on the network. */
const decoded = new Map<string, HTMLImageElement>();

/**
 * Decodes every texture, billboard and sheet this layer needs. Called once from the race's loading
 * screen; a failure is not fatal (the marker is simply skipped, exactly as it was before the art).
 */
export async function preloadTrackArt(): Promise<{ loaded: number; failures: string[] }> {
  const failures: string[] = [];
  let loaded = 0;
  await Promise.all(TRACK_ART_PATHS.map(async (path) => {
    try {
      decoded.set(path, await loadArtImage(path));
      loaded += 1;
    } catch {
      failures.push(path);
    }
  }));
  return { loaded, failures };
}

/** True once `preloadTrackArt` has this file in hand. Test/diagnostic helper. */
export function trackArtReady(path: string): boolean {
  return decoded.has(path);
}

/**
 * A texture for a painted file: the preloaded image when there is one (the normal case — the race
 * screen decodes the lot before the grid), a load otherwise, and an empty texture when there is no
 * DOM at all (tests, the qualifying harness), so the layer behaves the same way headless.
 */
function paintedTexture(path: string): THREE.Texture {
  const image = decoded.get(path);
  if (image) {
    const texture = new THREE.Texture(image);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    texture.userData.art = path;
    return texture;
  }
  const texture = typeof document === 'undefined'
    ? new THREE.Texture()
    : new THREE.TextureLoader().load(path);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.userData.art = path;
  return texture;
}

/**
 * The shield bubble's painted texture, for the instanced shield in the 3D renderer.
 * Lives here because this module owns (and preloads) the track-obstacle art.
 */
export function shieldBubbleTexture(): THREE.Texture {
  return paintedTexture(TRACK_ART.shieldBubble);
}

/** The frame a 2×2 sheet shows at `time`; reduced motion holds frame 0. */
export function sheetFrameAt(sheet: SheetGrid, time: number, reducedMotion: boolean, phase = 0): number {
  const frames = Math.max(1, sheet.cols * sheet.rows);
  if (reducedMotion) return 0;
  const step = Math.floor(time * sheet.fps + phase);
  return ((step % frames) + frames) % frames;
}

/**
 * The spinner's frame comes from the sim's own spinner state (`spinAngle`, a quarter turn per
 * frame) carried forward by the presentation clock, so two spinners at different angles are not
 * drawn in lockstep. Reduced motion holds frame 0.
 */
export function spinnerFrameAt(obstacle: Obstacle, time: number, reducedMotion: boolean): number {
  const sheet = (OBSTACLE_ART.pinball_spinner as Extract<ObstacleArt, { style: 'sheet' }>).sheet;
  return sheetFrameAt(sheet, time, reducedMotion, (obstacle.spinAngle ?? 0) / 90);
}

/** Puts a sheet's frame into a texture's offset/repeat (frame 0 is the top-left cell). */
function applyFrame(texture: THREE.Texture, sheet: SheetGrid, frame: number): void {
  const col = frame % sheet.cols;
  const row = Math.floor(frame / sheet.cols) % sheet.rows;
  texture.repeat.set(1 / sheet.cols, 1 / sheet.rows);
  texture.offset.set(col / sheet.cols, 1 - (row + 1) / sheet.rows);
}

/** The player's motion setting, read the same way the rest of the renderer reads it. */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Presentation clock, in seconds. Never used by the sim, so determinism is untouched. */
function nowSeconds(): number {
  return typeof performance === 'undefined' ? 0 : performance.now() / 1000;
}

/* -----------------------------------------------------------------------------
   2. THE VIEW
   -------------------------------------------------------------------------- */

export interface ObstacleViewStats {
  /** Obstacles with a marker in the current layout. */
  drawn: number;
  /** Obstacles in the layout with no marker (scenery kinds and decorative effects). */
  skipped: number;
}

/** A marker whose texture plays a sheet, with the obstacle that drives it. */
interface AnimatedMarker {
  readonly obstacle: Obstacle;
  readonly sheet: SheetGrid;
  readonly texture: THREE.Texture;
  frame: number;
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
  private animated: AnimatedMarker[] = [];
  /** The scrolling road textures (the boost pads' chevrons). */
  private scrolling: { texture: THREE.Texture; rate: number }[] = [];

  /** The map the marker being built is placed on (one of `roadsAt`'s). */
  private map: TrackSpaceMap;

  constructor(
    private readonly parent: THREE.Object3D,
    private readonly assets: Partial<GameAssets>,
    map: TrackSpaceMap,
    /**
     * ISLAND-ROUTE: the roads an obstacle at engine x stands on. Inside a fork an obstacle exists on
     * every branch, so it gets a marker on each branch's road. Absent: the one map.
     */
    private readonly roadsAt?: (x: number) => readonly TrackSpaceMap[],
  ) {
    this.map = map;
    this.root.name = 'ObstacleView';
    parent.add(this.root);
  }

  /**
   * Call every frame with the engine's obstacle array; rebuilds only when the layout changes.
   * `time` and `reducedMotion` default to the presentation clock and the player's motion setting,
   * so the renderer keeps its one-argument call.
   */
  update(obstacles: readonly Obstacle[], time = nowSeconds(), reducedMotion = prefersReducedMotion()): void {
    if (obstacles !== this.layout) this.build(obstacles);
    for (const { obstacle, object } of this.removable) object.visible = !obstacle.hit;
    for (const marker of this.animated) {
      const frame = marker.obstacle.kind === 'pinball_spinner'
        ? spinnerFrameAt(marker.obstacle, time, reducedMotion)
        : sheetFrameAt(marker.sheet, time, reducedMotion);
      if (frame === marker.frame) continue;
      marker.frame = frame;
      applyFrame(marker.texture, marker.sheet, frame);
    }
    for (const { texture, rate } of this.scrolling) {
      // Toward the direction of travel; still under reduced motion.
      const offset = reducedMotion ? 0 : -(time * rate) % 1;
      if (texture.offset.y !== offset) texture.offset.y = offset;
    }
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
    this.animated = [];
  }

  private build(obstacles: readonly Obstacle[]): void {
    this.clear();
    this.layout = obstacles;
    let drawn = 0; let skipped = 0;
    const home = this.map;
    for (const obstacle of obstacles) {
      for (const road of this.roadsAt?.(obstacle.x) ?? [home]) {
        this.map = road;
        const object = this.markerFor(obstacle);
        if (!object) { skipped += 1; break; }
        this.root.add(object);
        drawn += 1;
        if (obstacle.kind === 'tnt' || obstacle.kind === 'sheep') this.removable.push({ obstacle, object });
      }
    }
    this.map = home;
    this.stats.drawn = drawn;
    this.stats.skipped = skipped;
  }

  private markerFor(obstacle: Obstacle): THREE.Object3D | null {
    const art = obstacleArtFor(obstacle.kind);
    if (!art) return null; // blimps, signs, splashes, torches, bridges: scenery the track already shows
    const object = art.style === 'road'
      ? this.roadMark(obstacle, art)
      : art.style === 'sprite'
        ? this.spriteBillboard(obstacle, art.art)
        : this.paintedBillboard(obstacle, art);
    object.name = `Obstacle_${obstacle.kind}`;
    // Every marker records the painted file (or painted sprite) it wears: there is no untextured
    // fallback left in this layer.
    object.userData.art = art.style === 'sprite' ? String(art.art) : art.art;
    object.userData.style = art.style;
    return object;
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

  /**
   * Gaps (a painted pit), boost pads (chevrons pointing the way) and ramps (a timber deck), lying
   * on the road. A gap also gets its warning sign, standing `GAP_SIGN_LEAD` before it, so the two
   * travel together as one marker.
   */
  private roadMark(obstacle: Obstacle, art: Extract<ObstacleArt, { style: 'road' }>): THREE.Object3D {
    const bounds = obstacle.kind === 'boost'
      ? { near: obstacleZ(obstacle) - 55, far: obstacleZ(obstacle) + 55 }
      : obstacleBounds(obstacle);
    const x0 = obstacle.x; const x1 = obstacle.x + obstacle.width;
    const rise = obstacle.kind === 'ramp' ? obstacle.height : 0;
    // One copy of the texture per `tileLength` of road, so a long ramp does not stretch its planks.
    const tiles = art.tileLength > 0 ? Math.max(1, Math.round(obstacle.width / art.tileLength)) : 1;
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
        uvs.push(j, t * tiles);
      }
      if (i > 0) { const a = (i - 1) * 2; index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(index);
    geometry.computeVertexNormals();
    this.geometries.push(geometry);
    const mesh = new THREE.Mesh(geometry, this.roadMaterial(obstacle.kind, art));
    mesh.name = `Obstacle_${obstacle.kind}`;
    mesh.renderOrder = 2;
    if (obstacle.kind !== 'gap') return mesh;

    const group = new THREE.Group();
    group.add(mesh);
    group.add(this.signBillboard(obstacle));
    return group;
  }

  private roadMaterial(kind: string, art: Extract<ObstacleArt, { style: 'road' }>): THREE.Material {
    const cached = this.materials.get(`road:${kind}`);
    if (cached) return cached;
    const shared = { side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 };
    const map = paintedTexture(art.art);
    map.wrapS = THREE.ClampToEdgeWrapping;
    map.wrapT = THREE.RepeatWrapping;
    this.textures.push(map);
    if (art.scroll > 0) this.scrolling.push({ texture: map, rate: art.scroll });
    const material = art.lit
      ? new THREE.MeshLambertMaterial({ map, transparent: true, ...shared })
      : new THREE.MeshBasicMaterial({ map, transparent: true, ...shared });
    material.userData.art = art.art;
    this.materials.set(`road:${kind}`, material);
    return material;
  }

  /** Sheep, TNT and springs: the game's own painted sprite sheet, standing in their lane. */
  private spriteBillboard(obstacle: Obstacle, art: keyof GameAssets): THREE.Object3D {
    const material = this.spriteMaterial(art);
    const sprite = new THREE.Sprite(material);
    const image = (this.assets[art] as { width?: number; height?: number } | undefined);
    const aspect = image?.width && image?.height ? image.width / image.height : 1;
    sprite.scale.set(OBSTACLE_SPRITE_HEIGHT * aspect, OBSTACLE_SPRITE_HEIGHT, 1);
    sprite.position.copy(this.at(obstacle.x + obstacle.width / 2, obstacleZ(obstacle), OBSTACLE_SPRITE_HEIGHT / 2));
    return sprite;
  }

  private spriteMaterial(art: keyof GameAssets): THREE.SpriteMaterial {
    const key = `sprite:${String(art)}`;
    const cached = this.materials.get(key);
    if (cached) return cached as THREE.SpriteMaterial;
    const source = (this.assets[art] as { image?: HTMLImageElement } | undefined)?.image;
    let texture: THREE.Texture | null = null;
    if (source) {
      texture = new THREE.Texture(source);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;
      this.textures.push(texture);
    }
    // Headless (tests, the qualifying harness) has no decoded sprite sheet: the marker is still
    // placed, wearing the sprite it will show in the browser, and never a tinted stand-in.
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    material.userData.art = String(art);
    this.materials.set(key, material);
    return material;
  }

  /**
   * Rock gates, water rocks, roller rails, cauldrons and spinners: painted billboards standing in
   * their lane, at the width the physics gives them. The two animated kinds get their own texture
   * (the frame lives in a texture's offset, so a shared one could not hold two frames at once).
   */
  private paintedBillboard(
    obstacle: Obstacle,
    art: Extract<ObstacleArt, { style: 'billboard' } | { style: 'sheet' }>,
  ): THREE.Object3D {
    const animated = art.style === 'sheet';
    const key = `painted:${art.art}`;
    const shared = animated ? null : (this.materials.get(key) as THREE.SpriteMaterial | undefined) ?? null;
    let material = shared;
    if (!material) {
      const texture = paintedTexture(art.art);
      this.textures.push(texture);
      material = new THREE.SpriteMaterial({ map: texture, transparent: true });
      material.userData.art = art.art;
      if (animated) {
        applyFrame(texture, art.sheet, 0);
        this.animated.push({ obstacle, sheet: art.sheet, texture, frame: 0 });
      } else this.materials.set(key, material);
    }
    const height = Math.max(art.minHeight, obstacle.height * art.heightScale);
    const bounds = obstacleBounds(obstacle);
    const width = Math.max(height, Math.max(LANE_WIDTH * 0.5, bounds.far - bounds.near));
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(width, height, 1);
    const z = (bounds.near + bounds.far) / 2;
    sprite.position.copy(this.at(obstacle.x + obstacle.width / 2, z, height / 2));
    return sprite;
  }

  /** The painted warning sign that stands before a gap. */
  private signBillboard(gap: Obstacle): THREE.Object3D {
    const key = `painted:${TRACK_ART.gapSign}`;
    let material = this.materials.get(key) as THREE.SpriteMaterial | undefined;
    if (!material) {
      const texture = paintedTexture(TRACK_ART.gapSign);
      this.textures.push(texture);
      material = new THREE.SpriteMaterial({ map: texture, transparent: true });
      material.userData.art = TRACK_ART.gapSign;
      this.materials.set(key, material);
    }
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(GAP_SIGN_HEIGHT, GAP_SIGN_HEIGHT, 1);
    sprite.position.copy(this.at(
      Math.max(0, gap.x - GAP_SIGN_LEAD), obstacleZ(gap), GAP_SIGN_HEIGHT / 2 + 20,
    ));
    sprite.name = 'Obstacle_gap_sign';
    sprite.userData.art = TRACK_ART.gapSign;
    return sprite;
  }
}
