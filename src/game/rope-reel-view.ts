/**
 * H6 — the rope goblins. When a ball crosses an authored out-of-bounds node the crew hauls it back:
 * for `OOB_REEL_S` the ball is held (sim/racer-physics.ts), drawn easing from where it went out back
 * to its lane, while the rope-heave trio stands on the lane and hauls it in on a rope.
 *
 * The art is the existing animated rope-heave trio (a 2×2 sheet): no new images were generated.
 * Pooled like the pickups: one trio and one rope per reeling ball, reused across races.
 */
import * as THREE from 'three';
import { placementFromEngine, type TrackSpaceMap } from './track-space';
import type { RacerFrame } from './scene';
import type { CourseId } from './types';

/** The rope-heave trio sheet: 2 columns × 2 rows, played at 6 frames a second. */
export const ROPE_REEL_ART = Object.freeze({ url: '/art/animated/alpha/anim-33-rope-heave-trio.png', cols: 2, rows: 2, fps: 6 });
/** How tall the trio stands (world units; a ball is 124 across), and its aspect (400 × 560 art). */
export const ROPE_CREW_HEIGHT = 300;
const ROPE_CREW_ASPECT = 400 / 560;

/** The 2×2 sheet frame shown at `time` (frozen on the first under reduced motion). */
export function ropeCrewFrame(time: number, reducedMotion: boolean): number {
  if (reducedMotion || !Number.isFinite(time)) return 0;
  return Math.floor(Math.max(0, time) * ROPE_REEL_ART.fps) % (ROPE_REEL_ART.cols * ROPE_REEL_ART.rows);
}

interface Crew { sprite: THREE.Sprite; rope: THREE.Line; ropePositions: Float32Array }

export class RopeReelView {
  readonly root = new THREE.Group();
  private readonly crews: Crew[] = [];
  private material: THREE.SpriteMaterial | null = null;
  private texture: THREE.Texture | null = null;
  private readonly ropeMaterial = new THREE.LineBasicMaterial({ color: 0x8a6a3a });

  constructor(private readonly parent: THREE.Object3D, private readonly map: TrackSpaceMap) {
    this.root.name = 'RopeReelView';
    parent.add(this.root);
  }

  /** Draws a crew for every reeling ball this frame; the rest of the pool is hidden. */
  update(racers: readonly RacerFrame[], course: CourseId, time: number, reducedMotion: boolean): number {
    let used = 0;
    for (const racer of racers) {
      const reel = racer.reelBack;
      if (!reel || racer.hidden) continue;
      const crew = this.crewAt(used++);
      const at = placementFromEngine(this.map, { x: reel.toX, y: reel.toY, z: reel.toZ, grounded: true, course });
      const f = at.frame;
      // The trio stands on the lane, a little down the road from where the ball comes back to.
      const ground = at.lateral;
      const base = new THREE.Vector3(f.pos.x + f.right.x * ground, f.pos.y + f.right.y * ground, f.pos.z + f.right.z * ground)
        .addScaledVector(new THREE.Vector3(f.tangent.x, f.tangent.y, f.tangent.z), 180);
      crew.sprite.position.copy(base).addScaledVector(new THREE.Vector3(f.up.x, f.up.y, f.up.z), ROPE_CREW_HEIGHT / 2);
      crew.sprite.visible = true;
      const ball = placementFromEngine(this.map, { x: racer.x, y: racer.y, z: racer.z, grounded: racer.grounded, distance: racer.distance, course });
      // The rope runs from the crew's hands to the ball, and goes slack once it is home.
      const hands = crew.sprite.position.clone().addScaledVector(new THREE.Vector3(f.up.x, f.up.y, f.up.z), -ROPE_CREW_HEIGHT * 0.05);
      crew.ropePositions.set([hands.x, hands.y, hands.z, ball.world.x, ball.world.y, ball.world.z]);
      (crew.rope.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      crew.rope.geometry.computeBoundingSphere();
      crew.rope.visible = reel.t < 0.98;
    }
    for (let i = used; i < this.crews.length; i++) { this.crews[i].sprite.visible = false; this.crews[i].rope.visible = false; }
    if (used && this.texture) {
      const frame = ropeCrewFrame(time, reducedMotion);
      const col = frame % ROPE_REEL_ART.cols; const row = Math.floor(frame / ROPE_REEL_ART.cols);
      this.texture.offset.set(col / ROPE_REEL_ART.cols, 1 - (row + 1) / ROPE_REEL_ART.rows);
    }
    return used;
  }

  private crewAt(index: number): Crew {
    const existing = this.crews[index];
    if (existing) return existing;
    const sprite = new THREE.Sprite(this.crewMaterial());
    sprite.scale.set(ROPE_CREW_HEIGHT * ROPE_CREW_ASPECT, ROPE_CREW_HEIGHT, 1);
    sprite.renderOrder = 2;
    const ropePositions = new Float32Array(6);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(ropePositions, 3));
    const rope = new THREE.Line(geometry, this.ropeMaterial);
    rope.frustumCulled = false;
    this.root.add(sprite, rope);
    const crew = { sprite, rope, ropePositions };
    this.crews.push(crew);
    return crew;
  }

  /** One material for every crew; the sheet loads in a browser (it is preloaded with the race art). */
  private crewMaterial(): THREE.SpriteMaterial {
    if (this.material) return this.material;
    if (typeof document !== 'undefined') {
      this.texture = new THREE.TextureLoader().load(ROPE_REEL_ART.url);
      this.texture.colorSpace = THREE.SRGBColorSpace;
      this.texture.repeat.set(1 / ROPE_REEL_ART.cols, 1 / ROPE_REEL_ART.rows);
    }
    this.material = new THREE.SpriteMaterial({ map: this.texture ?? undefined, transparent: true, depthWrite: false });
    return this.material;
  }

  dispose(): void {
    for (const crew of this.crews) { this.root.remove(crew.sprite, crew.rope); crew.rope.geometry.dispose(); }
    this.crews.length = 0;
    this.material?.dispose();
    this.texture?.dispose();
    this.ropeMaterial.dispose();
    this.parent.remove(this.root);
  }
}
