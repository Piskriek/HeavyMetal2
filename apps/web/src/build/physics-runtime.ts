import { bodyFor, hammer, materialById, stepBody, type Body, type Motion, type Vec3 } from '@hm/physmat';

/**
 * Things in motion (the Physics tab, F11): a thing dropped or hit by the push hammer falls, bounces, slides and settles by its material
 * (@hm/physmat), on the ground under it. While they move only the picture changes; when every one has come to rest (or after a few
 * seconds) the island takes their new places, as one undo step.
 */
export interface PhysThing { readonly ref: string; readonly base: Vec3; readonly size: Vec3; readonly material: string }
interface Sim { readonly ref: string; readonly body: Body; motion: Motion; readonly lift: number; still: number }
export interface PhysPose { readonly ref: string; readonly x: number; readonly y: number; readonly z: number }

const MAX_SECONDS = 6;
const MAX_SPEED = 20;

/** A body for a thing standing on its base (pure). */
export function bodyOf(t: PhysThing): { body: Body; lift: number } {
  const [sx, sy, sz] = t.size;
  const body = bodyFor([-sx / 2, 0, -sz / 2], [sx / 2, sy, sz / 2], materialById(t.material).id, 'solid', true);
  return { body, lift: body.shape === 'sphere' ? body.radius : body.half[1] };
}

export class PhysicsRuntime {
  private readonly sims = new Map<string, Sim>();
  private time = 0;
  /** What the island will call the undo step when they settle. */
  label = 'Drop';

  get active(): boolean { return this.sims.size > 0; }

  private start(t: PhysThing, vel: Vec3, height: number): void {
    const { body, lift } = bodyOf(t);
    this.sims.set(t.ref, { ref: t.ref, body, lift, motion: { pos: [t.base[0], t.base[1] + lift + height, t.base[2]], vel }, still: 0 });
  }

  /** Lift a thing `height` metres and let it fall. */
  drop(t: PhysThing, height: number): void { this.label = 'Drop'; this.time = 0; this.start(t, [0, 0, 0], height); }

  /** The push hammer: every thing within `radius` of centre flies away from it; returns how many moved. */
  swing(centre: Vec3, radius: number, strength: number, things: readonly PhysThing[]): number {
    const bodies = things.map((t) => { const { body, lift } = bodyOf(t); return { t, body, motion: { pos: [t.base[0], t.base[1] + lift, t.base[2]] as Vec3, vel: [0, 0, 0] as Vec3 } }; });
    const vels = hammer(centre, radius, strength, bodies.map((b) => ({ body: b.body, motion: b.motion })));
    let n = 0;
    bodies.forEach((b, i) => {
      const v = vels[i];
      if (!v || Math.hypot(v[0], v[1], v[2]) < 1e-3) return;
      const k = Math.min(1, MAX_SPEED / Math.max(1e-9, Math.hypot(v[0], v[1], v[2])));
      this.start(b.t, [v[0] * k, v[1] * k, v[2] * k], 0);
      n++;
    });
    if (n) { this.label = 'Hammer'; this.time = 0; }
    return n;
  }

  /** One frame: move everything; `ground` is the height under a point. Returns where each moving thing's base is now. */
  step(dt: number, ground: (x: number, z: number) => number): PhysPose[] {
    const d = Math.min(1 / 30, Math.max(0, dt));
    this.time += d;
    const out: PhysPose[] = [];
    for (const s of this.sims.values()) {
      // small fixed steps: the integrator is a preview, not a solver
      for (let k = 0; k < 4; k++) s.motion = stepBody(s.body, s.motion, d / 4, ground(s.motion.pos[0], s.motion.pos[2]));
      const speed = Math.hypot(s.motion.vel[0], s.motion.vel[1], s.motion.vel[2]);
      s.still = speed < 0.05 ? s.still + d : 0;
      out.push({ ref: s.ref, x: s.motion.pos[0], y: s.motion.pos[1] - s.lift, z: s.motion.pos[2] });
    }
    return out;
  }

  /** When every thing has rested for a moment (or the show ran long): their final places, and the runtime is empty again. */
  settled(): PhysPose[] | null {
    if (!this.sims.size) return null;
    const done = this.time > MAX_SECONDS || [...this.sims.values()].every((s) => s.still > 0.4);
    if (!done) return null;
    const out = [...this.sims.values()].map((s) => ({ ref: s.ref, x: s.motion.pos[0], y: s.motion.pos[1] - s.lift, z: s.motion.pos[2] }));
    this.sims.clear();
    return out;
  }
}
