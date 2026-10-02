import { heightAt } from '@hm/terrain';
import { RIGS, RigState, validateRig, type RigDef, type RigKind, type Shot, type Subject } from '@hm/camerarig';
import type { Runtime } from '@hm/engine';

/**
 * Camera rigs are presets. A scene may carry `camera-rig` presets (slot `rigs`); the race lets the player cycle through them with C.
 * With none, the ready-made rigs apply. Only rigs that follow a racer are offered while racing (free and ghost are flown by hand when spectating).
 */
const FOLLOW: readonly RigKind[] = ['chase', 'first-person', 'orbit', 'helicam', 'topdown'];

export function rigsOf(rt: Runtime): RigDef[] {
  const scene = rt.binder.sceneId ? rt.store.get(rt.binder.sceneId) : undefined;
  const fromScene: RigDef[] = [];
  for (const r of scene?.children['rigs'] ?? []) {
    const p = rt.store.get(r.ref);
    if (!p) continue;
    const q = rt.store.resolve(r.ref).params as Record<string, unknown>;
    const n = (k: string, d: number): number => (Number.isFinite(Number(q[k])) ? Number(q[k]) : d);
    const def = { kind: (q['rig'] as RigKind) ?? 'chase', name: p.name, distance: n('distance', 6), height: n('height', 2.5), lookAhead: n('lookAhead', 4), stiffness: n('stiffness', 6), fov: n('fov', 62), fovBoostPerSpeed: n('fovBoostPerSpeed', 0.25), shake: n('shake', 0.2), orbitSpeed: n('orbitSpeed', 0.3), collideGround: q['collideGround'] !== false, eyeHeight: n('eyeHeight', 0.9) } as RigDef;
    if (validateRig(def).ok) fromScene.push(def);
  }
  const all = fromScene.length ? fromScene : RIGS;
  const follow = all.filter((d) => FOLLOW.includes(d.kind));
  return follow.length ? follow : RIGS.filter((d) => FOLLOW.includes(d.kind));
}

/** Runs one rig for the race camera: feed it the player's pose each frame, get a shot. */
export class RaceCamera {
  private state: RigState;
  private fresh = true;
  private index = 0;
  constructor(private readonly rigs: RigDef[], private readonly rt: Runtime) { this.state = new RigState(rigs[0]!); }

  get rig(): RigDef { return this.rigs[this.index]!; }
  next(): RigDef { this.index = (this.index + 1) % this.rigs.length; this.state = new RigState(this.rig); this.fresh = true; return this.rig; }

  step(dtMs: number, pose: { x: number; y: number; z: number; hx: number; hz: number; speed: number }, impulse = 0): Shot {
    const ts = this.rt.binder.terrain();
    const ground = (x: number, z: number): number => (ts ? heightAt(ts.terrain, x, z) : 0);
    const len = Math.hypot(pose.hx, pose.hz) || 1;
    const subject: Subject = { id: 0, pos: [pose.x, pose.y, pose.z], vel: [(pose.hx / len) * pose.speed, 0, (pose.hz / len) * pose.speed], yaw: Math.atan2(pose.hx, pose.hz), alive: true };
    if (this.fresh) { this.state.reset(subject, ground); this.fresh = false; }
    return this.state.step(this.rig, Math.min(0.1, dtMs / 1000), subject, ground, impulse);
  }
}
