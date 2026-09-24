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
import { pickupY, type AirPickup, type PowerupKind } from './powerups';
import {
  placementFromEngine, type PhysicalRampSurface, type TrackSpaceMap,
} from './track-space';

/** How big a pickup reads. A ball is 62 across; a pickup is a gate item, not a marble. */
export const PICKUP_SPRITE_SIZE = 150;
/** How long a taken pickup stays hidden. Matches the solve's own "already claimed" window. */
export const PICKUP_HIDDEN_SECONDS = 6;

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

  constructor(
    private readonly parent: THREE.Object3D,
    /** The painted pickup canvases, by kind. A kind with no art is simply not drawn. */
    private readonly art: Partial<Record<PowerupKind, HTMLCanvasElement>> = {},
    /** The track-space map the rest of the scene is placed with. */
    private readonly map: TrackSpaceMap,
  ) {
    this.root.name = 'PickupView';
    parent.add(this.root);
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
    ramps: readonly PhysicalRampSurface[] = [],
  ): void {
    let visible = 0;
    let hidden = 0;
    for (let index = 0; index < pickups.length; index++) {
      const pickup = pickups[index];
      const material = this.materialFor(pickup.kind);
      if (!material) continue; // no art for this kind: not drawn rather than drawn wrong
      const sprite = this.spriteAt(index, material);
      const taken = pickup.collectedBy !== null && runTime - pickup.collectedAt < PICKUP_HIDDEN_SECONDS;
      sprite.visible = !taken;
      if (taken) { hidden += 1; continue; }
      const y = pickupY(pickup, time, reducedMotion);
      const placement = placementFromEngine(this.map, { x: pickup.x, z: pickup.z, y }, ramps);
      sprite.position.set(placement.world.x, placement.world.y, placement.world.z);
      // Face the camera without a per-frame matrix rebuild of the whole scene: three's sprites always
      // billboard, so the only thing the render path pays for is the position above.
      const scale = PICKUP_SPRITE_SIZE;
      sprite.scale.set(scale, scale, 1);
      visible += 1;
    }
    // Sprites beyond this frame's list are hidden, not destroyed: the next race reuses them.
    for (let index = pickups.length; index < this.sprites.length; index++) this.sprites[index].visible = false;
    this.stats.hidden = hidden;
    this.stats.visible = visible;
  }

  /** Hides everything (the pause screen, a finished race, a course with no pickups). */
  hideAll(): void {
    for (const sprite of this.sprites) sprite.visible = false;
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
