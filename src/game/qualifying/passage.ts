/**
 * M01 · T1d — **the passage**: the giant 360° loop baked into the track's 3D geometry, and the plane a
 * racer crosses when they enter it.
 *
 * There are two kinds of loop in this game and they are easy to confuse:
 *
 * * a **ring obstacle** (`kind: 'loop'`, `add('loop', x, …)` in `track-layout.ts`) is a 322-unit
 *   decoration standing on the road that a racer may choose to ride if they are in its lane;
 * * the **geometry loop** is part of the track itself — a real 360° circle in the centreline spline
 *   (`LOOP_DEFINITIONS` in `track-space.ts`), 1400 slots in radius on the alpine stage. The alpine
 *   loop's mouth is engine **x 8304**, and the field runs through the granite tunnel portal that
 *   marks it before dropping into the circle.
 *
 * The race is sorted at the geometry loop, not at the ring the start pad hangs over — which is the
 * user's own correction, verbatim: *"there is a 'Loop' decoration at the start of the course, you guys
 * have set that as the first split time location, but the loop i was refering to is a giant loop in the
 * actual 3d geometry of the track where the lanes do a 360 deg loop, at the mouth of the loop is a
 * decoration called public/art/props/prop-26-granite-tunnel-portal.png."*
 *
 * **Everything here is derived, never authored** — the same rule the qualifying gate follows. The mouth
 * is read out of the compiled `TrackSpaceMap` (arc length → engine x through the module's own monotone
 * map), so the day the alpine loop is re-authored in `track-space.ts` this module follows it without an
 * edit. The numbers only change if the track's geometry does.
 */
import { START_X } from '../scene';
import { getTrackSpace, type TrackLoopSpan } from '../track-space';

/** The stage the race's sorting loop lives on. The alpine loop is the only 360° loop before section 3. */
export const PASSAGE_STAGE = 'alpine';

/**
 * The tunnel portal that stands at the mouth, as a *builder prop type*.
 *
 * Authored: the portal is the user's own placed prop (`prop_26_granite_tunnel_portal`,
 * `/art/props/alpha/prop-26-granite-tunnel-portal.png`, 1300×1300). It is not a placed prop in
 * `DEFAULT_TRACK_PROPS` — it lives in the user's saved document — so nothing is guaranteed to exist at
 * the mouth in a fresh document, and the checkpoint must *not* depend on it: the plane is derived from
 * the geometry and the portal is the visual marker of it. This constant is the one place that identity
 * is written down, so a future pass can check a document for it (`hasPassagePortal`).
 */
export const PASSAGE_PORTAL_PROP_TYPE = 'prop_26_granite_tunnel_portal';

/** The geometry loop the race sorts at: the first loop on `PASSAGE_STAGE`, in spline order. */
export function passageLoop(): TrackLoopSpan {
  const loop = getTrackSpace().loops.find((candidate) => candidate.stage === PASSAGE_STAGE);
  if (!loop) {
    throw new Error(`[passage] no ${PASSAGE_STAGE} geometry loop on this track — the sorting loop is missing.`);
  }
  return loop;
}

/** World arc length → engine x, through the track-space map's own engine↔arc mapping. */
export function passageXFromTrackDist(trackDist: number): number {
  return START_X + getTrackSpace().engineDistanceFromTrackDist(trackDist) * 2;
}

/** The mouth of the geometry loop, in engine x: where a racer leaves the road and enters the circle. */
export function passageMouthX(): number {
  return passageXFromTrackDist(passageLoop().start);
}

/** The far side of the circle, in engine x: where the 360° is behind the racer. */
export function passageExitX(): number {
  return passageXFromTrackDist(passageLoop().end);
}

/** The circle's radius, in engine x-units (the spline's own authored radius). */
export function passageRadius(): number {
  return passageLoop().radius;
}

/**
 * True when a racer is physically inside the circle: past the mouth and short of the exit. The merge
 * reads this to keep the field from bumping while it is upside down, holding a line the real geometry
 * owns — two racers at the same engine x inside a barrel are not in contact in the world.
 */
export function insidePassage(x: number): boolean {
  return x > passageMouthX() && x < passageExitX();
}

/**
 * How far through the loop a racer is, 0 at the mouth to 1 at the exit. The pool's own occupancy rule —
 * "the previous rider must be a quarter of the way round before the next is released" — is expressed on
 * this instead of on a ring ride's angle, because the sorting plane is the loop's mouth now and the
 * circle is geometry, not an obstacle with an angle to read.
 */
export function passageProgress(x: number): number {
  const span = passageExitX() - passageMouthX();
  if (!(span > 0)) return 1;
  return Math.max(0, Math.min(1, (x - passageMouthX()) / span));
}

/**
 * The tunnel portal stands across the corridor centre, so every release is aimed through it: the
 * corridor's middle lane. (`laneZ(2)` is 0 — see `scene.ts`.)
 */
export const PASSAGE_CENTRE_Z = 0;

/**
 * The intangibility after a release. Riders leave the plane at a common speed and are inside a barrel
 * for the next few seconds, so a released rider stays intangible until they are **clear of the loop**,
 * with a hard cap so a rider stopped inside it cannot stay a ghost for ever.
 */
export const PASSAGE_GHOST_TAIL_S = 0.75;
export const PASSAGE_GHOST_CAP_S = 20;
