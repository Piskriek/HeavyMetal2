/**
 * M01 — **the powerups, drawn where the physics collects them.**
 *
 * `assets.pickupSprites` has been loaded since the sprites were painted and **nothing has ever drawn
 * them**: the engine asks `resolvePickups` whether a ball touched a pickup (so they are collectible, and
 * the HUD shows the charges they grant), and it hands `frame.pickups` to the renderer, which ignored the
 * list. A player could gain a shield from something they never saw. This file closes that.
 *
 * The laws, all of them headless-assertable (three.js builds sprites and textures in node):
 *
 *  - **The sprite is where the pickup is.** Its world position comes from `placementFromEngine` — the
 *    same mapping the racers use — fed with `pickupY`, the very function the collection solve uses for
 *    the bob. A sprite that drifted from the collision point would be worse than an invisible pickup.
 *  - **One texture and one material per kind, ever.** Built on first use from the painted canvases and
 *    reused for every pickup of that kind in every race.
 *  - **The pool only grows to the field's own size.** Sprites are made as needed and then recycled: a
 *    race with 40 pickups builds 40 sprites once and keeps them for the whole run, whether the list is
 *    40 long or 3 (`update` never allocates in the steady state).
 *  - **A collected pickup is not drawn.** The solve marks `collectedBy`/`collectedAt`; the sprite for a
 *    pickup taken within its own window is hidden, so nobody chases a ghost.
 *
 * No DOM (beyond the `<canvas>` the sprites were painted into), no WebGL context, no React.
 */
import * as THREE from 'three';
import { POWERUPS, pickupY, type AirPickup, type PowerupKind } from './powerups';
import type { CourseId } from './types';
import {
  placementFromEngine, type PhysicalRampSurface, type TrackSpaceMap,
} from './track-space';

/** How big a pickup reads. A ball is 62 across; a pickup is a gate item, not a marble. */
export const PICKUP_SPRITE_SIZE = 150;
/** How long a taken pickup stays hidden. Matches the solve's own "already claimed" window. */
export const PICKUP_HIDDEN_SECONDS = 6;

/**
 * P10 — making a pickup read from the cockpit, a long way down the road. The sprite breathes slowly
 * (±12 %, one breath per 2.2 s), a four-point glint turns over it, a ring in its colour marks the
 * spot on the road, and a faint shaft of light rises above it so it shows over a crest. Reduced
 * motion stops the breathing and the turning; the ring and the shaft stay.
 */
export const PICKUP_PULSE = 0.12;
export const PICKUP_PULSE_PERIOD_S = 2.2;
export const PICKUP_BEAM_HEIGHT = 150;
export const PICKUP_RING_SIZE = 190;

/** The sprite's scale factor at `time` (1 when still). */
export function pickupPulse(time: number, reducedMotion: boolean): number {
  if (reducedMotion || !Number.isFinite(time)) return 1;
  return 1 + PICKUP_PULSE * Math.sin((time * 2 * Math.PI) / PICKUP_PULSE_PERIOD_S);
}

/** A small RGBA texture from a per-pixel alpha function (white, so a material colour tints it). */
function alphaTexture(size: number, alpha: (u: number, v: number) => number): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = (x + 0.5) / size * 2 - 1; const v = (y + 0.5) / size * 2 - 1;
    const a = Math.max(0, Math.min(1, alpha(u, v)));
    const i = (y * size + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = 255; data[i + 3] = Math.round(a * 255);
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.needsUpdate = true;
  return texture;
}
/** Four thin rays and a soft core. */
const starAlpha = (u: number, v: number) => {
  const ray = Math.max(Math.exp(-Math.abs(u) * 26) * (1 - Math.abs(v)), Math.exp(-Math.abs(v) * 26) * (1 - Math.abs(u)));
  return ray + Math.exp(-(u * u + v * v) * 22) * 0.8;
};
/** A soft ring. */
const ringAlpha = (u: number, v: number) => Math.exp(-(((Math.hypot(u, v) - 0.78) / 0.12) ** 2));
/** A vertical shaft, bright at the bottom (v = 1) and fading to nothing at the top. */
const beamAlpha = (u: number, v: number) => Math.exp(-(u * u) * 9) * ((v + 1) / 2) ** 2;

interface PickupGlow { glint: THREE.Sprite; beam: THREE.Sprite; ring: THREE.Mesh }
interface GlowMaterials { glint: THREE.SpriteMaterial; beam: THREE.SpriteMaterial; ring: THREE.MeshBasicMaterial }
const Z_AXIS = new THREE.Vector3(0, 0, 1);

export interface PickupViewStats {
  /** Sprites built over the life of the view: the pool's high-water mark, not a per-frame number. */
  spritesBuilt: number;
  /** Textures built: at most one per powerup kind, ever. */
  texturesCreated: number;
  /** Materials built: at most one per powerup kind, ever. */
  materialsCreated: number;
  /** Sprites hidden because their pickup is inside its collected window. */
  hidden: number;
  /** The last frame's visible count, for a HUD or a test. */
  visible: number;
}

/**
 * The pickup layer. `parent` is the renderer's scene; everything it adds lives under `root`, so
 * `dispose()` leaves the parent exactly as it found it.
 */
export class PickupView {
  readonly root = new THREE.Group();
  readonly stats: PickupViewStats = {
    spritesBuilt: 0, texturesCreated: 0, materialsCreated: 0, hidden: 0, visible: 0,
  };

  private readonly sprites: THREE.Sprite[] = [];
  private readonly materials = new Map<PowerupKind, THREE.SpriteMaterial>();
  private readonly geometry: THREE.PlaneGeometry;
  /** P10: the glint, ring and shaft, beside `root` so `root` holds exactly one sprite per pickup. */
  readonly glow = new THREE.Group();
  private readonly glows: PickupGlow[] = [];
  private readonly glowMaterials = new Map<PowerupKind, GlowMaterials>();
  private readonly glowTextures = { star: alphaTexture(64, starAlpha), ring: alphaTexture(64, ringAlpha), beam: alphaTexture(32, beamAlpha) };
  private readonly ringUp = new THREE.Vector3();

  constructor(
    private readonly parent: THREE.Object3D,
    /** The painted pickup canvases, by kind. A kind with no art is simply not drawn. */
    private readonly art: Partial<Record<PowerupKind, HTMLCanvasElement>> = {},
    /** The track-space map the rest of the scene is placed with. */
    private readonly map: TrackSpaceMap,
  ) {
    this.root.name = 'PickupView';
    parent.add(this.root);
    this.glow.name = 'PickupGlow';
    parent.add(this.glow);
    this.geometry = new THREE.PlaneGeometry(1, 1);
  }

  /** How many sprites the pool currently holds. */
  get poolSize(): number { return this.sprites.length; }

  /**
   * Places every pickup for this frame. `time` is the race clock the bob is read from, so the sprite
   * moves exactly as the collision point does; `reducedMotion` stills it, as everywhere else.
   */
  update(
    pickups: readonly AirPickup[],
    time: number,
    reducedMotion: boolean,
    runTime: number,
    ramps: readonly PhysicalRampSurface[],
    /** The course being raced: a pickup's height is measured against its hill profile (M10). */
    course: CourseId,
  ): void {
    let visible = 0;
    let hidden = 0;
    for (let index = 0; index < pickups.length; index++) {
      const pickup = pickups[index];
      const material = this.materialFor(pickup.kind);
      if (!material) continue; // no art for this kind: not drawn rather than drawn wrong
      const sprite = this.spriteAt(index, material);
      const glow = this.glowAt(index, pickup.kind);
      const taken = pickup.collectedBy !== null && runTime - pickup.collectedAt < PICKUP_HIDDEN_SECONDS;
      sprite.visible = !taken;
      glow.glint.visible = glow.beam.visible = glow.ring.visible = !taken;
      if (taken) { hidden += 1; continue; }
      const y = pickupY(pickup, time, reducedMotion);
      const placement = placementFromEngine(this.map, { x: pickup.x, z: pickup.z, y, course }, ramps);
      sprite.position.set(placement.world.x, placement.world.y, placement.world.z);
      // Face the camera without a per-frame matrix rebuild of the whole scene: three's sprites always
      // billboard, so the only thing the render path pays for is the position above.
      const scale = PICKUP_SPRITE_SIZE * pickupPulse(time, reducedMotion);
      sprite.scale.set(scale, scale, 1);
      // P10: the glint over it, the shaft rising from it, and the ring on the road under it.
      const f = placement.frame;
      glow.glint.position.copy(sprite.position);
      glow.glint.scale.setScalar(PICKUP_SPRITE_SIZE * 0.9 * pickupPulse(time + PICKUP_PULSE_PERIOD_S / 4, reducedMotion));
      glow.beam.position.set(
        placement.world.x + f.up.x * PICKUP_BEAM_HEIGHT / 2,
        placement.world.y + f.up.y * PICKUP_BEAM_HEIGHT / 2,
        placement.world.z + f.up.z * PICKUP_BEAM_HEIGHT / 2,
      );
      const ground = placement.lateral;
      glow.ring.position.set(
        f.pos.x + f.right.x * ground + f.up.x * 2,
        f.pos.y + f.right.y * ground + f.up.y * 2,
        f.pos.z + f.right.z * ground + f.up.z * 2,
      );
      glow.ring.quaternion.setFromUnitVectors(Z_AXIS, this.ringUp.set(f.up.x, f.up.y, f.up.z).normalize());
      visible += 1;
    }
    // Sprites beyond this frame's list are hidden, not destroyed: the next race reuses them.
    for (let index = pickups.length; index < this.sprites.length; index++) this.sprites[index].visible = false;
    for (let index = pickups.length; index < this.glows.length; index++) this.hideGlow(this.glows[index]);
    // The glints turn slowly, all together (a sprite's rotation lives on its material).
    for (const materials of this.glowMaterials.values()) materials.glint.rotation = reducedMotion ? 0 : time * 0.6;
    this.stats.hidden = hidden;
    this.stats.visible = visible;
  }

  /** Hides everything (the pause screen, a finished race, a course with no pickups). */
  hideAll(): void {
    for (const sprite of this.sprites) sprite.visible = false;
    for (const glow of this.glows) this.hideGlow(glow);
    this.stats.visible = 0;
  }

  dispose(): void {
    for (const sprite of this.sprites) this.root.remove(sprite);
    this.sprites.length = 0;
    // The layer is gone, so nothing it was drawing is visible: the counters say so rather than
    // reporting the last frame it ever drew.
    this.stats.visible = 0;
    this.stats.hidden = 0;
    for (const material of this.materials.values()) material.dispose();
    this.materials.clear();
    this.geometry.dispose();
    this.parent.remove(this.root);
    for (const glow of this.glows) this.glow.remove(glow.glint, glow.beam, glow.ring);
    this.glows.length = 0;
    for (const materials of this.glowMaterials.values()) { materials.glint.dispose(); materials.beam.dispose(); materials.ring.dispose(); }
    this.glowMaterials.clear();
    for (const texture of Object.values(this.glowTextures)) texture.dispose();
    this.parent.remove(this.glow);
  }

  private hideGlow(glow: PickupGlow) { glow.glint.visible = glow.beam.visible = glow.ring.visible = false; }

  /** P10: the glow for pickup `index` (pooled like the sprites), in its kind's colours. */
  private glowAt(index: number, kind: PowerupKind): PickupGlow {
    const materials = this.glowMaterialsFor(kind);
    const existing = this.glows[index];
    if (existing) {
      existing.glint.material = materials.glint; existing.beam.material = materials.beam; existing.ring.material = materials.ring;
      return existing;
    }
    const glint = new THREE.Sprite(materials.glint);
    glint.renderOrder = 3;
    const beam = new THREE.Sprite(materials.beam);
    beam.scale.set(26, PICKUP_BEAM_HEIGHT, 1);
    beam.renderOrder = 1;
    const ring = new THREE.Mesh(this.geometry, materials.ring);
    ring.scale.set(PICKUP_RING_SIZE, PICKUP_RING_SIZE, 1);
    ring.renderOrder = 1;
    this.glow.add(glint, beam, ring);
    const glow = { glint, beam, ring };
    this.glows.push(glow);
    return glow;
  }

  private glowMaterialsFor(kind: PowerupKind): GlowMaterials {
    const cached = this.glowMaterials.get(kind);
    if (cached) return cached;
    const color = new THREE.Color(POWERUPS[kind].color);
    const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color } as const;
    const materials: GlowMaterials = {
      glint: new THREE.SpriteMaterial({ ...additive, map: this.glowTextures.star, opacity: 0.95 }),
      beam: new THREE.SpriteMaterial({ ...additive, map: this.glowTextures.beam, opacity: 0.55 }),
      ring: new THREE.MeshBasicMaterial({ ...additive, map: this.glowTextures.ring, opacity: 0.85, side: THREE.DoubleSide }),
    };
    this.glowMaterials.set(kind, materials);
    return materials;
  }

  private spriteAt(index: number, material: THREE.SpriteMaterial): THREE.Sprite {
    const existing = this.sprites[index];
    if (existing) return existing;
    const sprite = new THREE.Sprite(material);
    sprite.name = `Pickup:${index}`;
    sprite.renderOrder = 2;
    this.root.add(sprite);
    this.sprites.push(sprite);
    this.stats.spritesBuilt += 1;
    return sprite;
  }

  /** The one material for a kind, built from its painted canvas on first use. */
  private materialFor(kind: PowerupKind): THREE.SpriteMaterial | null {
    const cached = this.materials.get(kind);
    if (cached) return cached;
    const canvas = this.art[kind];
    if (!canvas) return null;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      // A pickup is a marker, not a wall: it must never write depth over a ball passing through it.
      depthWrite: false,
    });
    this.materials.set(kind, material);
    this.stats.texturesCreated += 1;
    this.stats.materialsCreated += 1;
    return material;
  }
}
