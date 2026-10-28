/**
 * Overwatch's fast brain in a fight (plan 50 §2): pure and deterministic, stepped at the frame rate by whoever hosts the
 * drone (the play scene; an external game's host later, plan 51). The slow brain (an AI on the bridge, or
 * the player's voice) only sets `CombatOrders`; nothing here waits on it.
 *
 * Numbers are the research's starting points (docs/COMBAT_DRONE_COMPANION_RESEARCH.md): acquire at 25 m, drop at 30 m,
 * 4-round bursts at 10 rounds/s with 0.6 s between bursts at 30% of the player's DPS, 250 ms to acquire, aim error 2.5°
 * tightening to 1° over a second, a sticky target (15%, a 20% lead held 400 ms, 1.5 s minimum), a kill-steal guard, a
 * 15° keep-out cone around the player's aim, a clear 0.4 m lane, one contact bark per 8 s, and confirmations after 3 s.
 *
 * No clock, no Math.random: the brain carries its own time and a mulberry32 state, so a replay fires the same shots.
 * Conventions: x/z ground plane; the player's facing is (-sin yaw, -cos yaw) (the walker's); a drone yaw `a` faces
 * (sin a, cos a) (its lens is +z).
 */

export type CombatMode = 'defend' | 'weapons-free' | 'hold-fire';
export type CoverSide = 'left' | 'right' | 'rear';

export interface CombatOrders {
  readonly mode: CombatMode;
  /** The target the slow brain or a ping named, and until when (brain seconds) the order stands. */
  readonly focusId: number | null;
  readonly focusUntil: number;
  readonly cover: CoverSide;
}

export const DEFAULT_COMBAT_ORDERS: CombatOrders = Object.freeze({ mode: 'defend', focusId: null, focusUntil: 0, cover: 'right' });
/** A focus order stands this long unless renewed (research: standing orders expire after 60 s). */
export const FOCUS_ORDER_S = 60;

export interface CombatTuning {
  readonly engageM: number;
  readonly dropM: number;
  /** Only targets within this of the player (the drone defends, it does not roam). */
  readonly leashM: number;
  /** 'defend' engages only inside this radius of the player, or anything winding up at them within `leashM`. */
  readonly defendM: number;
  readonly burstRounds: number;
  readonly roundGapS: number;
  readonly burstGapS: number;
  /** The drone's sustained damage as a share of the player's (research: about 30%). */
  readonly dpsShare: number;
  readonly acquireS: number;
  readonly switchSlewS: number;
  readonly aimErrStartDeg: number;
  readonly aimErrEndDeg: number;
  readonly aimTightenS: number;
  readonly stickyBonus: number;
  readonly challengeLead: number;
  readonly challengeHoldS: number;
  readonly minTargetS: number;
  readonly killStealDeg: number;
  readonly keepOutDeg: number;
  readonly laneM: number;
  /** The combat station's distance from the player. */
  readonly stationM: number;
  /** One bark per this long for a contact (danger); confirmations (down, clear) wait `confirmGapS`. */
  readonly barkGapS: number;
  readonly confirmGapS: number;
  /** How long a hit on the player makes its attacker count double. */
  readonly hurtMemoryS: number;
  /** "Area clear" after this long with nothing to fight. */
  readonly clearAfterS: number;
}

export const COMBAT_TUNING: CombatTuning = Object.freeze({
  engageM: 25, dropM: 30, leashM: 30, defendM: 15,
  burstRounds: 4, roundGapS: 0.1, burstGapS: 0.6, dpsShare: 0.3,
  acquireS: 0.25, switchSlewS: 0.4, aimErrStartDeg: 2.5, aimErrEndDeg: 1, aimTightenS: 1,
  stickyBonus: 0.15, challengeLead: 0.2, challengeHoldS: 0.4, minTargetS: 1.5,
  killStealDeg: 5, keepOutDeg: 15, laneM: 0.4, stationM: 5.5, barkGapS: 8, confirmGapS: 3, hurtMemoryS: 5, clearAfterS: 3,
});

/** How hard each kind hits (leaksim's damage per strike): the threat ordering's "hurts a lot". */
const KIND_THREAT: Readonly<Record<string, number>> = { brute: 30, charger: 15, sapper: 12, spitter: 10, flyer: 8, swarmer: 5 };
const MOB_RADIUS_M = 0.5;

export interface CombatMob {
  readonly id: number;
  readonly kind: string;
  readonly hp: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Winding up a strike (the telegraph). */
  readonly telegraph: boolean;
}

export interface CombatInput {
  readonly dt: number;
  readonly drone: { readonly x: number; readonly y: number; readonly z: number };
  /** `shotDamage`: one trigger pull (the kill-steal guard); `dps`: the player's sustained damage per second (the drone's share). */
  readonly player: { readonly x: number; readonly z: number; readonly yaw: number; readonly shotDamage: number; readonly dps: number };
  readonly mobs: readonly CombatMob[];
  readonly orders: CombatOrders;
  /** The monster that last hit the player, and when (brain seconds), if any. */
  readonly hurtBy?: { readonly id: number; readonly at: number } | null;
  readonly tuning?: CombatTuning;
}

export interface CombatBrain {
  readonly t: number;
  readonly targetId: number | null;
  readonly targetKind: string | null;
  readonly targetSince: number;
  readonly acquireAt: number;
  readonly trackSince: number;
  readonly challengerId: number | null;
  readonly challengerSince: number;
  readonly burstLeft: number;
  readonly nextShotAt: number;
  readonly rng: number;
  readonly seen: readonly number[];
  readonly lastBarkAt: number;
  readonly idleSince: number;
  readonly fought: boolean;
}

export type CombatEvent =
  | { readonly kind: 'contact'; readonly mobId: number; readonly mobKind: string; readonly distance: number }
  | { readonly kind: 'down'; readonly mobId: number; readonly mobKind: string }
  | { readonly kind: 'clear' };

export interface CombatShot {
  readonly mobId: number;
  readonly damage: number;
  readonly hit: boolean;
  /** Where the round went (the mob on a hit, a near miss beside it otherwise). */
  readonly at: { readonly x: number; readonly y: number; readonly z: number };
}

export interface CombatTick {
  readonly brain: CombatBrain;
  readonly shot: CombatShot | null;
  /** Where the drone should hold while it fights (null: fly its normal order). */
  readonly station: { readonly x: number; readonly z: number } | null;
  /** The yaw to aim the lens and barrel at (null: no target). */
  readonly aimYaw: number | null;
  readonly events: readonly CombatEvent[];
  /** The one line worth saying now (one per `barkGapS`, danger first), or null. */
  readonly bark: CombatEvent | null;
}

export function newCombatBrain(seed = 0x5e7f1d): CombatBrain {
  return {
    t: 0, targetId: null, targetKind: null, targetSince: 0, acquireAt: 0, trackSince: 0, challengerId: null, challengerSince: 0,
    burstLeft: 0, nextShotAt: 0, rng: seed >>> 0, seen: [], lastBarkAt: -Infinity, idleSince: 0, fought: false,
  };
}

/** mulberry32: the next state and a number in [0, 1). */
function next(rng: number): [number, number] {
  const s = (rng + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [s, ((t ^ (t >>> 14)) >>> 0) / 4294967296];
}

const DEG = Math.PI / 180;
const angleBetween = (ax: number, az: number, bx: number, bz: number): number => {
  const la = Math.hypot(ax, az), lb = Math.hypot(bx, bz);
  if (la < 1e-9 || lb < 1e-9) return 0;
  return Math.acos(Math.max(-1, Math.min(1, (ax * bx + az * bz) / (la * lb))));
};
/** The distance from point P to the segment AB (ground plane). */
function segmentDistance(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const vx = bx - ax, vz = bz - az;
  const len2 = vx * vx + vz * vz;
  const u = len2 < 1e-9 ? 0 : Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / len2));
  return Math.hypot(px - (ax + vx * u), pz - (az + vz * u));
}

/** The threat score: hurts a lot, quick to kill, close to the player, winding up, or the one that just hit them. */
export function threatScore(m: CombatMob, player: CombatInput['player'], tuning: CombatTuning, hurtBy: CombatInput['hurtBy'], t: number): number {
  const dPlayer = Math.hypot(m.x - player.x, m.z - player.z);
  const closeness = Math.max(0, 1 - dPlayer / tuning.leashM);
  const quickKill = 1 + 20 / (20 + Math.max(0, m.hp));
  const hurting = hurtBy && hurtBy.id === m.id && t - hurtBy.at <= tuning.hurtMemoryS ? 2 : 1;
  return (KIND_THREAT[m.kind] ?? 10) * quickKill * (0.35 + 0.65 * closeness) * (m.telegraph ? 1.6 : 1) * hurting;
}

/**
 * The brain with no fight in hand: its target, its fight and its last line forgotten without a bark (the player left the
 * world, or died). The brain's clock stops off the planet, so a kept bark gap would swallow the first contact on return.
 */
export function standDown(brain: CombatBrain): CombatBrain {
  return { ...brain, targetId: null, targetKind: null, challengerId: null, burstLeft: 0, seen: [], fought: false, lastBarkAt: -Infinity };
}

/** One frame of the fast brain. */
export function stepCombat(brain: CombatBrain, input: CombatInput): CombatTick {
  const tun = input.tuning ?? COMBAT_TUNING;
  const t = brain.t + input.dt;
  const { drone, player, mobs, orders } = input;
  const byId = new Map(mobs.map((m) => [m.id, m] as const));
  const events: CombatEvent[] = [];
  const pfx = -Math.sin(player.yaw), pfz = -Math.cos(player.yaw);

  // contacts: every newcomer within the leash, once
  const seen = new Set(brain.seen.filter((id) => byId.has(id)));
  for (const m of mobs) {
    const d = Math.hypot(m.x - player.x, m.z - player.z);
    if (!seen.has(m.id) && d <= tun.leashM) {
      seen.add(m.id);
      events.push({ kind: 'contact', mobId: m.id, mobKind: m.kind, distance: Math.round(d) });
    }
  }
  // the last target died (it left the list): "down"
  if (brain.targetId !== null && !byId.has(brain.targetId)) events.push({ kind: 'down', mobId: brain.targetId, mobKind: brain.targetKind ?? 'target' });

  const eligible = (m: CombatMob, holding: boolean): boolean => {
    const dDrone = Math.hypot(m.x - drone.x, m.z - drone.z);
    const dPlayer = Math.hypot(m.x - player.x, m.z - player.z);
    if (dPlayer > tun.leashM || dDrone > (holding ? tun.dropM : tun.engageM)) return false;
    if (orders.mode === 'defend' && dPlayer > tun.defendM && !m.telegraph) return false;
    // kill-steal guard: leave the player a weak enemy they are already aiming at
    const aimOff = angleBetween(pfx, pfz, m.x - player.x, m.z - player.z);
    if (aimOff < tun.killStealDeg * DEG && m.hp <= player.shotDamage) return false;
    return true;
  };

  // a standing focus order wins while it stands and its target lives
  const focusMob = orders.focusId !== null && t <= orders.focusUntil ? byId.get(orders.focusId) ?? null : null;
  // a focus order still keeps to the leash: the drone never snipes across the map
  const focus = focusMob && Math.hypot(focusMob.x - player.x, focusMob.z - player.z) <= tun.leashM ? focusMob : null;
  let targetId = brain.targetId !== null && byId.has(brain.targetId) ? brain.targetId : null;
  let { targetSince, acquireAt, trackSince, challengerId, challengerSince } = brain;
  const choose = (id: number, switching: boolean): void => {
    targetId = id;
    targetSince = t;
    trackSince = t;
    acquireAt = t + (switching ? tun.switchSlewS : tun.acquireS);
    challengerId = null;
  };
  if (focus) {
    if (targetId !== focus.id) choose(focus.id, targetId !== null);
  } else {
    const current = targetId !== null ? byId.get(targetId) ?? null : null;
    const holding = current !== null && eligible(current, true);
    if (!holding) targetId = null;
    let best: CombatMob | null = null;
    let bestScore = -Infinity;
    for (const m of mobs) {
      if (!eligible(m, m.id === targetId)) continue;
      const s = threatScore(m, player, tun, input.hurtBy, t);
      if (s > bestScore) { best = m; bestScore = s; }
    }
    if (targetId === null) {
      if (best) choose(best.id, brain.targetId !== null);
    } else if (best && best.id !== targetId && current) {
      // the sticky target: a challenger needs a clear lead, held, and the target its minimum time
      const held = threatScore(current, player, tun, input.hurtBy, t) * (1 + tun.stickyBonus);
      if (bestScore > held * (1 + tun.challengeLead)) {
        if (challengerId !== best.id) { challengerId = best.id; challengerSince = t; }
        if (t - challengerSince >= tun.challengeHoldS && t - targetSince >= tun.minTargetS) choose(best.id, true);
      } else {
        challengerId = null;
      }
    } else {
      // the target leads again: a later challenger starts its hold from scratch
      challengerId = null;
    }
  }

  const target = targetId !== null ? byId.get(targetId) ?? null : null;

  // the station: on the ordered side, out of the player's aim cone, toward a focus that is out of reach
  let station: { x: number; z: number } | null = null;
  if (target && orders.mode !== 'hold-fire') {
    const rx = -pfz, rz = pfx; // the player's right: (cos yaw, -sin yaw)
    let sx = orders.cover === 'left' ? -rx : orders.cover === 'rear' ? -pfx : rx;
    let sz = orders.cover === 'left' ? -rz : orders.cover === 'rear' ? -pfz : rz;
    if (orders.cover !== 'rear') { sx = sx * 0.94 + pfx * 0.34; sz = sz * 0.94 + pfz * 0.34; }
    const len = Math.hypot(sx, sz) || 1;
    station = { x: player.x + (sx / len) * tun.stationM, z: player.z + (sz / len) * tun.stationM };
    const off = angleBetween(pfx, pfz, station.x - player.x, station.z - player.z);
    if (off < tun.keepOutDeg * DEG) station = { x: player.x + rx * tun.stationM, z: player.z + rz * tun.stationM };
  }

  // fire: bursts, after the acquire delay, only through a lane the player is not in
  let { burstLeft, nextShotAt, rng } = brain;
  let shot: CombatShot | null = null;
  const EPS = 1e-6;
  const inReach = target !== null && Math.hypot(target.x - drone.x, target.z - drone.z) <= tun.dropM;
  if (target && inReach && orders.mode !== 'hold-fire' && t + EPS >= acquireAt && t + EPS >= nextShotAt) {
    const laneClear = segmentDistance(player.x, player.z, drone.x, drone.z, target.x, target.z) > tun.laneM;
    if (laneClear) {
      // a round mid-burst keeps the burst's own rhythm (scheduled from when it was due, not from the frame that saw it)
      const midBurst = burstLeft > 0 && t - nextShotAt < tun.roundGapS;
      const base = midBurst ? nextShotAt : t;
      if (burstLeft <= 0) burstLeft = tun.burstRounds;
      burstLeft -= 1;
      nextShotAt = base + (burstLeft > 0 ? tun.roundGapS : tun.burstGapS);
      const tight = Math.min(1, (t - trackSince) / tun.aimTightenS);
      const errDeg = tun.aimErrStartDeg + (tun.aimErrEndDeg - tun.aimErrStartDeg) * tight;
      let u1: number, u2: number;
      [rng, u1] = next(rng);
      [rng, u2] = next(rng);
      const err = errDeg * DEG * Math.abs(u1 + u2 - 1) * 2;
      const dist = Math.hypot(target.x - drone.x, target.z - drone.z);
      const hit = err <= Math.atan2(MOB_RADIUS_M, Math.max(0.1, dist));
      const side = u2 < 0.5 ? -1 : 1;
      shot = {
        mobId: target.id,
        // the drone's share of the player's DPS, spread over its own rounds per second
        damage: (player.dps * tun.dpsShare) / (tun.burstRounds / ((tun.burstRounds - 1) * tun.roundGapS + tun.burstGapS)),
        hit,
        at: hit ? { x: target.x, y: target.y, z: target.z } : { x: target.x + side * (MOB_RADIUS_M + 0.4), y: target.y + 0.3, z: target.z },
      };
    }
  }

  // "area clear" once the fight has been quiet for a moment
  const fighting = target !== null;
  let idleSince = fighting ? t : brain.idleSince;
  let fought = brain.fought || fighting;
  const anyNear = mobs.some((m) => Math.hypot(m.x - player.x, m.z - player.z) <= tun.leashM);
  if (!fighting && !anyNear && fought && t - idleSince >= tun.clearAfterS) {
    events.push({ kind: 'clear' });
    fought = false;
  }

  // one bark per gap, danger first
  let bark: CombatEvent | null = null;
  let lastBarkAt = brain.lastBarkAt;
  const since = t - lastBarkAt;
  const contact = events.find((e) => e.kind === 'contact');
  if (contact && since >= tun.barkGapS) bark = contact;
  else if (!contact && since >= tun.confirmGapS) bark = events.find((e) => e.kind === 'down') ?? events.find((e) => e.kind === 'clear') ?? null;
  if (bark) lastBarkAt = t;

  const aimYaw = target ? Math.atan2(target.x - drone.x, target.z - drone.z) : null;
  return {
    brain: {
      t, targetId, targetKind: target?.kind ?? null, targetSince, acquireAt, trackSince, challengerId, challengerSince,
      burstLeft, nextShotAt, rng, seen: [...seen], lastBarkAt, idleSince, fought,
    },
    shot, station, aimYaw, events, bark,
  };
}

/** The radio line for a bark. */
export function barkLine(e: CombatEvent): string {
  switch (e.kind) {
    case 'contact': return `Contact: ${e.mobKind}, ${e.distance} m.`;
    case 'down': return `${e.mobKind[0]?.toUpperCase() ?? ''}${e.mobKind.slice(1)} down.`;
    case 'clear': return 'Area clear.';
  }
}
