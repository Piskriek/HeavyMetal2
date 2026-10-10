/**
 * @hm/mobsim — deterministic Monster Mash mobs for synced world replays.
 *
 * Ogros and Demons chase the player around walls (pathing via @hm/navpath's
 * exact any-angle navigator), attack within 2.2 m, resume chase beyond 2.8 m,
 * flinch ('pain', 0.3 s) when hurt, and stay where they fall when dead. The
 * shotgun fires 7 pellets in a +-0.0275 rad two-axis spread cone.
 *
 * Determinism rules of the house:
 * - Pure functions; inputs are never mutated, outputs share frozen structure.
 * - Every random draw comes from sim.rng (a 32-bit LCG), so identical seeds
 *   and identical call sequences replay identically on every engine.
 * - No DOM, no Date, no Math.random, and no Math.sin/cos/atan2 — everything
 *   is vectors + Math.sqrt, so floats match across platforms.
 *
 * The public Mob/Sim shapes are exactly the spec; per-mob path memory
 * (waypoints, re-path timer) and the per-grid navigator cache are carried as
 * hidden internal fields on the same immutable objects.
 */

import { navigator as buildNavigator, type Grid } from '@hm/navpath';

export type { Grid } from '@hm/navpath';

export const DT = 1 / 30;

export type MobKind = 'ogro' | 'demon';
export type MobState = 'chase' | 'attack' | 'pain' | 'death';

export const KINDS: Record<MobKind, { hp: number; speed: number; radius: number; height: number }> = {
  ogro: { hp: 100, speed: 2.8, radius: 0.9, height: 3.6 },
  demon: { hp: 80, speed: 3.2, radius: 0.7, height: 2.0 },
};

export interface Mob {
  id: number;
  kind: MobKind;
  x: number;
  z: number;
  hp: number;
  state: MobState;
  timer: number;
}

export interface Sim {
  tick: number;
  rng: number;
  nextId: number;
  cooldown: number;
  mobs: Mob[];
}

export interface Nav {
  originX: number;
  originZ: number;
  cell: number;
  grid: Grid;
}

/* ------------------------------------------------------------------ */
/* Tunables                                                            */
/* ------------------------------------------------------------------ */

const ATTACK_RANGE = 2.2; // chase -> attack
const CHASE_RANGE = 2.8; // attack -> chase
const PAIN_TIME = 0.3;
const FIRE_INTERVAL = 0.52;
const PELLETS = 7;
const PELLET_RANGE = 60;
const PELLET_SPREAD = 0.0275;
const REPATH_INTERVAL = 0.5; // re-path at most twice a second...
const REPATH_PLAYER_DRIFT = 1; // ...or sooner if the player strayed > 1 m

/* ------------------------------------------------------------------ */
/* Internal state (hidden on the public types)                         */
/* ------------------------------------------------------------------ */

type Solver = ReturnType<typeof buildNavigator>;

interface MobInt extends Mob {
  /** Seconds until the next allowed re-path (throttle). */
  repath: number;
  /** Cursor into `path`: index of the current target waypoint. */
  wpIdx: number;
  /** World-space waypoints to follow; `path[path.length - 1]` is the path's end. */
  path: [number, number][];
  /** The player position the current path was routed to. */
  pathEnd: [number, number];
}

interface SimInt extends Omit<Sim, 'mobs'> {
  mobs: MobInt[];
  /** Built navigators, one per Grid object; immutable content, shared by all sim versions. */
  navCache: ReadonlyMap<Grid, Solver>;
}

const asMobInt = (m: Mob): MobInt => {
  const im = m as Partial<MobInt>;
  if (im.repath !== undefined && im.wpIdx !== undefined && im.path !== undefined && im.pathEnd !== undefined) {
    return m as MobInt;
  }
  return {
    id: m.id,
    kind: m.kind,
    x: m.x,
    z: m.z,
    hp: m.hp,
    state: m.state,
    timer: m.timer,
    repath: im.repath ?? 0,
    wpIdx: im.wpIdx ?? 0,
    path: im.path ?? [],
    pathEnd: im.pathEnd ?? [m.x, m.z],
  };
};

const asSimInt = (sim: Sim): SimInt => ({
  tick: sim.tick,
  rng: sim.rng,
  nextId: sim.nextId,
  cooldown: sim.cooldown,
  mobs: sim.mobs as MobInt[],
  navCache: (sim as Partial<SimInt>).navCache ?? new Map(),
});

/* ------------------------------------------------------------------ */
/* Deterministic RNG                                                   */
/* ------------------------------------------------------------------ */

const TWO32 = 4294967296;
const nextRng = (rng: number): number => (Math.imul(rng, 1664525) + 1013904223) >>> 0;
const unit = (rng: number): number => rng / TWO32;

/* ------------------------------------------------------------------ */
/* World <-> grid helpers                                              */
/* ------------------------------------------------------------------ */

/** Is the world point inside a free cell (its center, cell-wise)? Outside is blocked. */
const pointFree = (nav: Nav, x: number, z: number): boolean => {
  const gx = Math.floor((x - nav.originX) / nav.cell);
  const gz = Math.floor((z - nav.originZ) / nav.cell);
  return gx >= 0 && gx < nav.grid.w && gz >= 0 && gz < nav.grid.h && !nav.grid.blocked(gx, gz);
};

const makeMob = (id: number, kind: MobKind, x: number, z: number): MobInt => ({
  id,
  kind,
  x,
  z,
  hp: KINDS[kind].hp,
  state: 'chase',
  timer: 0,
  repath: 0, // forces an immediate first path on the first chase tick
  wpIdx: 0,
  path: [],
  pathEnd: [x, z],
});

const withMob = (sim: SimInt, kind: MobKind, x: number, z: number): SimInt => ({
  ...sim,
  nextId: sim.nextId + 1,
  mobs: [...sim.mobs, makeMob(sim.nextId, kind, x, z)],
});

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export function createSim(seed: number): Sim {
  const sim: SimInt = {
    tick: 0,
    rng: seed >>> 0,
    nextId: 1,
    cooldown: 0,
    mobs: [],
    navCache: new Map(),
  };
  return sim;
}

export function spawn(sim: Sim, nav: Nav, kind: MobKind, x: number, z: number): Sim {
  if (!pointFree(nav, x, z)) return sim; // no-op if blocked
  return withMob(asSimInt(sim), kind, x, z);
}

export function spawnNear(
  sim: Sim,
  nav: Nav,
  kind: MobKind,
  count: number,
  cx: number,
  cz: number,
  minR: number,
  maxR: number,
): Sim {
  let s = asSimInt(sim);
  let rng = s.rng >>> 0;
  const lo = Math.max(0, Math.min(minR, maxR));
  const hi = Math.max(minR, maxR);
  for (let i = 0; i < count; i++) {
    // Rejection sample a direction on the unit disc, then pick a radius in
    // [lo, hi]; accept only free cells. Bounded attempts keep it total.
    for (let attempt = 0; attempt < 32; attempt++) {
      rng = nextRng(rng);
      const a = unit(rng);
      rng = nextRng(rng);
      const b = unit(rng);
      rng = nextRng(rng);
      const rr = unit(rng);
      const dx = a * 2 - 1;
      const dz = b * 2 - 1;
      const d2 = dx * dx + dz * dz;
      if (d2 < 1e-4 || d2 > 1) continue;
      const dist = Math.sqrt(d2);
      const rad = lo + rr * (hi - lo);
      const px = cx + (dx / dist) * rad;
      const pz = cz + (dz / dist) * rad;
      if (!pointFree(nav, px, pz)) continue;
      s = { ...withMob(s, kind, px, pz), rng };
      break;
    }
  }
  return { ...s, rng };
}

/**
 * One trigger pull's ballistics. The weapon's parts (apps/web/src/base/weapons.ts weaponStats) give these numbers;
 * SHOTGUN is today's gun (semi core, scatter barrel, iron sight). A burst is the caller firing again after
 * `cooldown` = the burst gap; a beam is 1 pellet, 0 spread and a short cooldown per damage tick.
 */
export interface Shot {
  readonly pellets: number;
  /** Damage per pellet, min and max inclusive. */
  readonly damage: readonly [number, number];
  /** Half-angle spread on each axis, radians. */
  readonly spread: number;
  readonly range: number;
  /** Seconds before the next shot. */
  readonly cooldown: number;
}
export const SHOTGUN: Shot = { pellets: PELLETS, damage: [20, 29], spread: PELLET_SPREAD, range: PELLET_RANGE, cooldown: FIRE_INTERVAL };

export function fire(
  sim: Sim,
  origin: [number, number, number],
  dir: [number, number, number],
  shot: Shot = SHOTGUN,
): { sim: Sim; hits: number; damage: number; killed: number[] } {
  const s0 = asSimInt(sim);
  const noop = { sim: sim, hits: 0, damage: 0, killed: [] as number[] };
  if (s0.cooldown > 0) return noop; // no shot while cooling down; no draws either
  const dl = Math.sqrt(dir[0] * dir[0] + dir[1] * dir[1] + dir[2] * dir[2]);
  if (!(dl > 0)) return noop;
  const nx = dir[0] / dl;
  const ny = dir[1] / dl;
  const nz = dir[2] / dl;

  // Deterministic orthonormal basis (e1, e2) around the aim direction.
  let upx = 0;
  let upy = 1;
  let upz = 0;
  if (Math.abs(ny) > 0.999) {
    upx = 1;
    upy = 0;
  }
  let e1x = ny * upz - nz * upy;
  let e1y = nz * upx - nx * upz;
  let e1z = nx * upy - ny * upx;
  const e1l = Math.sqrt(e1x * e1x + e1y * e1y + e1z * e1z);
  e1x /= e1l;
  e1y /= e1l;
  e1z /= e1l;
  const e2x = ny * e1z - nz * e1y;
  const e2y = nz * e1x - nx * e1z;
  const e2z = nx * e1y - ny * e1x;

  let rng = s0.rng >>> 0;
  const dmgByMob = new Map<number, number>();
  let hits = 0;
  let damage = 0;
  // three draws per pellet whatever the weapon, so the default shot replays exactly as before
  const span = Math.max(0, Math.floor(shot.damage[1]) - Math.floor(shot.damage[0])) + 1;
  for (let i = 0; i < shot.pellets; i++) {
    rng = nextRng(rng);
    const s1 = (2 * unit(rng) - 1) * shot.spread;
    rng = nextRng(rng);
    const s2 = (2 * unit(rng) - 1) * shot.spread;
    rng = nextRng(rng);
    const dmg = Math.floor(shot.damage[0]) + Math.floor(unit(rng) * span);
    const px = nx + e1x * s1 + e2x * s2;
    const py = ny + e1y * s1 + e2y * s2;
    const pz = nz + e1z * s1 + e2z * s2;
    const pl = Math.sqrt(px * px + py * py + pz * pz);
    const ux = px / pl;
    const uy = py / pl;
    const uz = pz / pl;
    // Nearest live sphere along the ray, within range.
    let bestT = Number.POSITIVE_INFINITY;
    let target: MobInt | null = null;
    for (const m of s0.mobs) {
      if (m.state === 'death') continue;
      const kd = KINDS[m.kind];
      const ocx = m.x - origin[0];
      const ocy = kd.height / 2 - origin[1];
      const ocz = m.z - origin[2];
      const tca = ocx * ux + ocy * uy + ocz * uz;
      if (tca < 0) continue;
      const d2 = ocx * ocx + ocy * ocy + ocz * ocz - tca * tca;
      if (d2 > kd.radius * kd.radius) continue;
      const entry = tca - Math.sqrt(kd.radius * kd.radius - d2);
      const t = entry < 0 ? 0 : entry;
      if (t > shot.range) continue;
      if (target === null || t < bestT) {
        bestT = t;
        target = m;
      }
    }
    if (target !== null) {
      hits += 1;
      damage += dmg;
      dmgByMob.set(target.id, (dmgByMob.get(target.id) ?? 0) + dmg);
    }
  }

  const killed: number[] = [];
  const mobs = s0.mobs.map((m): MobInt => {
    const dd = dmgByMob.get(m.id);
    if (dd === undefined || m.state === 'death') return m;
    const hp = m.hp - dd;
    if (hp <= 0) {
      killed.push(m.id);
      return { ...m, hp: 0, state: 'death', timer: 0 };
    }
    return { ...m, hp, state: 'pain', timer: PAIN_TIME };
  });
  const out: SimInt = { ...s0, cooldown: shot.cooldown, rng, mobs };
  return { sim: out, hits, damage, killed };
}

export function step(sim: Sim, nav: Nav, player: { x: number; z: number }): Sim {
  const s0 = asSimInt(sim);
  let solver = s0.navCache.get(nav.grid);
  let solverDirty = false;
  const getSolver = (): Solver => {
    if (solver === undefined) {
      solver = buildNavigator(nav.grid);
      solverDirty = true;
    }
    return solver;
  };
  const gx = (wx: number): number => (wx - nav.originX) / nav.cell;
  const gz = (wz: number): number => (wz - nav.originZ) / nav.cell;

  const mobs = s0.mobs.map((m0): MobInt => {
    const m = asMobInt(m0);
    if (m.state === 'death') return m; // the dead stay where they fell

    let state = m.state;
    let timer = m.timer;
    if (state === 'pain') {
      timer = m.timer - DT;
      if (timer > 0) return { ...m, timer };
      timer = 0;
      state = 'chase';
    }

    const dxp = player.x - m.x;
    const dzp = player.z - m.z;
    const d = Math.sqrt(dxp * dxp + dzp * dzp);

    if (state === 'attack') {
      if (d <= CHASE_RANGE) return m; // hold the attack up to 2.8 m
      state = 'chase';
    }
    if (state !== 'chase') return m;
    if (d <= ATTACK_RANGE) return { ...m, state: 'attack' };

    // --- chase ---
    let repath = m.repath - DT;
    let wpIdx = m.wpIdx;
    let path = m.path;
    let pathEnd = m.pathEnd;
    const fdx = player.x - pathEnd[0];
    const fdz = player.z - pathEnd[1];
    if (repath <= 0 || fdx * fdx + fdz * fdz > REPATH_PLAYER_DRIFT * REPATH_PLAYER_DRIFT) {
      const p = getSolver().path([gx(m.x), gz(m.z)], [gx(player.x), gz(player.z)]);
      path = p
        ? p.points.slice(1).map(([px, pz]): [number, number] => [nav.originX + px * nav.cell, nav.originZ + pz * nav.cell])
        : [];
      wpIdx = 0;
      pathEnd = [player.x, player.z];
      repath = REPATH_INTERVAL;
    }
    let x = m.x;
    let z = m.z;
    while (wpIdx < path.length) {
      const wpt = path[wpIdx]!;
      const ddx = wpt[0] - x;
      const ddz = wpt[1] - z;
      if (ddx * ddx + ddz * ddz > 1e-18) break;
      wpIdx += 1;
    }
    if (wpIdx < path.length) {
      const wpt = path[wpIdx]!;
      const ddx = wpt[0] - x;
      const ddz = wpt[1] - z;
      const dd = Math.sqrt(ddx * ddx + ddz * ddz);
      const v = KINDS[m.kind].speed * DT;
      if (dd <= v) {
        x = wpt[0];
        z = wpt[1];
      } else {
        x += (ddx / dd) * v;
        z += (ddz / dd) * v;
      }
    }
    return { ...m, x, z, state, timer, repath, wpIdx, path, pathEnd };
  });

  // Live mobs closer than their two radii push apart equally, in id order.
  // A push into a blocked cell is dropped (per side).
  for (let i = 0; i < mobs.length; i++) {
    let a = mobs[i]!;
    if (a.state === 'death') continue;
    for (let j = i + 1; j < mobs.length; j++) {
      let b = mobs[j]!;
      if (b.state === 'death') continue;
      const rr = KINDS[a.kind].radius + KINDS[b.kind].radius;
      const pdx = b.x - a.x;
      const pdz = b.z - a.z;
      const d2 = pdx * pdx + pdz * pdz;
      if (d2 >= rr * rr) continue;
      const d = Math.sqrt(d2);
      let ux = 1;
      let uz = 0;
      if (d > 1e-9) {
        ux = pdx / d;
        uz = pdz / d;
      }
      const half = (rr - d) / 2;
      const nax = a.x - ux * half;
      const naz = a.z - uz * half;
      if (pointFree(nav, nax, naz)) {
        a = { ...a, x: nax, z: naz, repath: 0 }; // forced re-path after a shove
        mobs[i] = a;
      }
      const nbx = b.x + ux * half;
      const nbz = b.z + uz * half;
      if (pointFree(nav, nbx, nbz)) {
        b = { ...b, x: nbx, z: nbz, repath: 0 };
        mobs[j] = b;
      }
    }
  }

  let out: SimInt = {
    ...s0,
    tick: s0.tick + 1,
    cooldown: Math.max(0, s0.cooldown - DT),
    mobs,
  };
  if (solverDirty && solver !== undefined) {
    const navCache = new Map(out.navCache);
    navCache.set(nav.grid, solver);
    out = { ...out, navCache };
  }
  return out;
}

export function hashSim(sim: Sim): string {
  const num = (v: number): string => (Object.is(v, -0) ? '-0' : String(v));
  const parts: string[] = [num(sim.tick), num(sim.rng >>> 0), num(sim.nextId), num(sim.cooldown)];
  for (const m of sim.mobs) {
    const im = m as Partial<MobInt>;
    parts.push(
      `${m.id},${m.kind},${num(m.x)},${num(m.z)},${num(m.hp)},${m.state},${num(m.timer)},${num(im.repath ?? 0)},${num(im.wpIdx ?? 0)}`,
    );
    const pe = im.pathEnd;
    parts.push(pe ? `${num(pe[0])},${num(pe[1])}` : '-');
    const pth = im.path ?? [];
    let eye = `${pth.length}`;
    for (const [px, pz] of pth) eye += `,${num(px)},${num(pz)}`;
    parts.push(eye);
  }
  return parts.join('|');
}
