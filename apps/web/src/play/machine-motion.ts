/**
 * Binds a `KitMotionSpec` to an object and poses it from the clock (plan 43, `anim:`).
 *
 * A `DrivenPart` remembers the part's rest pose when it is bound and writes `rest + evaluateKitMotion(spec, t, run, stage)`
 * every tick. Two properties matter and both come from `evaluateKitMotion` being pure in `(simTime, stage)`:
 *
 *  - scrubbing. Posing at t = 40 s gives the same result as posing at 0, 1, 2 ... 40 s, because nothing accumulates: the
 *    Studio scrubbar can jump to any timestamp and the ram is where it belongs (no `pos += vel * dt`).
 *  - stage fidelity. The evaluator quantises its clock to the stage's animation rate, so at S0 a ram steps at 8 Hz with the
 *    rest of the picture, and at S4..S6 it turns continuously.
 */
import * as THREE from 'three';
import { evaluateKitMotion, type KitMotionSpec } from '@hm/kinematic';

export interface DrivenPart {
  readonly object: THREE.Object3D;
  readonly spec: KitMotionSpec;
  /** The pose the part was built in: the motion is added to this, so an idle machine sits exactly where its builder put it. */
  readonly restPosition: readonly [number, number, number];
  readonly restRotation: readonly [number, number, number];
}

/** Bind an object to a spec: its current pose becomes the rest the motion is added to. */
export function driven(object: THREE.Object3D, spec: KitMotionSpec): DrivenPart {
  return {
    object,
    spec,
    restPosition: [object.position.x, object.position.y, object.position.z],
    restRotation: [object.rotation.x, object.rotation.y, object.rotation.z],
  };
}

/** Bind several objects at once, skipping the ones a builder did not produce (a kit frame with no ram on this tier). */
export function drivenAll(parts: readonly (readonly [THREE.Object3D | null | undefined, KitMotionSpec])[]): DrivenPart[] {
  const out: DrivenPart[] = [];
  for (const [object, spec] of parts) if (object) out.push(driven(object, spec));
  return out;
}

/**
 * Pose every bound part at time `t` while the machine runs at `run` (0..1) on the given Fidelity Stage. Pure in its inputs:
 * the same arguments always leave the scene in the same pose.
 */
export function poseDriven(parts: readonly DrivenPart[], t: number, run: number, stage = 6): void {
  for (const p of parts) {
    const { posOffset, rotOffset } = evaluateKitMotion(p.spec, t, run, stage);
    const [px, py, pz] = p.restPosition;
    const [rx, ry, rz] = p.restRotation;
    p.object.position.set(px + posOffset[0], py + posOffset[1], pz + posOffset[2]);
    p.object.rotation.set(rx + rotOffset[0], ry + rotOffset[1], rz + rotOffset[2]);
  }
}

/** A machine prop's `animate(t, running, stage)`: pose the bound parts, nothing else. */
export function driveMotion(parts: readonly DrivenPart[]): (t: number, run: number, stage?: number) => void {
  return parts.length === 0 ? () => {} : (t, run, stage = 6) => poseDriven(parts, t, run, stage);
}
