export type Archetype = 'charger' | 'spitter' | 'swarmer' | 'flyer' | 'brute' | 'sapper';
export type Aggression = 'off' | 'calm' | 'normal' | 'hard';
export type Phase = 'roam' | 'chase' | 'windup' | 'attack' | 'recover' | 'pain' | 'dead';

export interface Drop { readonly item: 'pixels' | 'vertices'; readonly n: number }
export interface Spec {
  readonly hp: number;
  readonly speed: number;
  readonly radius: number;
  readonly reach: number;
  readonly windup: number;
  readonly damage: number;
  readonly flies: boolean;
  readonly ranged: boolean;
  readonly targets: 'player' | 'machine';
  readonly pack: number;
  readonly drop: Drop;
}

export const ARCHETYPES: Readonly<Record<Archetype, Spec>> = {
  charger: {
    hp: 10, speed: 4, radius: 0.5, reach: 2, windup: 0.8, damage: 5,
    flies: false, ranged: false, targets: 'player', pack: 2, drop: { item: 'pixels', n: 5 },
  },
  spitter: {
    hp: 8, speed: 2, radius: 0.3, reach: 10, windup: 1.2, damage: 3,
    flies: false, ranged: true, targets: 'player', pack: 2, drop: { item: 'pixels', n: 5 },
  },
  swarmer: {
    hp: 4, speed: 6, radius: 0.2, reach: 1.5, windup: 0.5, damage: 2,
    flies: true, ranged: false, targets: 'player', pack: 5, drop: { item: 'pixels', n: 5 },
  },
  flyer: {
    hp: 6, speed: 5, radius: 0.3, reach: 1, windup: 0.6, damage: 3,
    flies: true, ranged: true, targets: 'player', pack: 3, drop: { item: 'pixels', n: 5 },
  },
  brute: {
    hp: 30, speed: 2, radius: 1, reach: 3, windup: 1.0, damage: 15,
    flies: false, ranged: false, targets: 'player', pack: 1, drop: { item: 'vertices', n: 3 },
  },
  sapper: {
    hp: 12, speed: 3, radius: 0.4, reach: 8, windup: 0.7, damage: 6,
    flies: false, ranged: false, targets: 'machine', pack: 2, drop: { item: 'vertices', n: 2 },
  },
} as const;

export interface P { readonly x: number; readonly z: number }
export interface Mob extends P {
  readonly id: number;
  readonly kind: Archetype;
  readonly leak: number;
  readonly hp: number;
  readonly phase: Phase;
  readonly phaseT: number;
  readonly provoked: boolean;
}
export interface Bolt extends P {
  readonly id: number;
  readonly from: number;
  readonly vx: number;
  readonly vz: number;
  readonly life: number;
  readonly damage: number;
}
export interface Leak extends P {
  readonly id: number;
  readonly kinds: readonly Archetype[];
  readonly seal: number;
  readonly sealed: boolean;
  readonly nextWave: number;
}
export interface World {
  readonly t: number;
  readonly rng: number;
  readonly nextId: number;
  readonly mobs: readonly Mob[];
  readonly bolts: readonly Bolt[];
  readonly leaks: readonly Leak[];
}
export interface Input {
  readonly dt: number;
  readonly stage: number;
  readonly aggression: Aggression;
  readonly player: P & { readonly alive: boolean };
  readonly machines: readonly (P & { readonly id: number })[];
  readonly safe: readonly (P & { readonly r: number })[];
  readonly sealing: number | null;
  readonly walkable?: (x: number, z: number) => boolean;
}
export type Event =
  | { readonly t: 'warn'; readonly leak: number; readonly inSeconds: number }
  | { readonly t: 'spawn'; readonly mob: number; readonly leak: number }
  | { readonly t: 'telegraph'; readonly mob: number }
  | { readonly t: 'hitPlayer'; readonly mob: number; readonly damage: number }
  | { readonly t: 'drain'; readonly mob: number; readonly machine: number; readonly amount: number }
  | { readonly t: 'death'; readonly mob: number; readonly drop: Drop }
  | { readonly t: 'sealed'; readonly leak: number };

export const WARN_SECONDS = 20;
export const SEAL_SECONDS = 6;
export const MAX_MOBS = 24;

function lcgNext(rng: number): number {
  const unsigned = (rng >>> 0);
  return ((1664525 * unsigned + 1013904223) | 0) >>> 0;
}

function rndFloat(rng: number): { f: number; rng: number } {
  const next = lcgNext(rng);
  return { f: next / 4294967296, rng: next };
}

export function createWorld(seed: number): World {
  return {
    t: 0,
    rng: (seed | 0) >>> 0,
    nextId: 1,
    mobs: [],
    bolts: [],
    leaks: [],
  };
}

export function addLeak(w: World, at: P, kinds: readonly Archetype[]): World {
  return {
    ...w,
    nextId: w.nextId + 1,
    leaks: [
      ...w.leaks,
      {
        id: w.nextId,
        x: at.x,
        z: at.z,
        kinds: [...kinds],
        seal: 0,
        sealed: false,
        nextWave: w.t + 90,
      },
    ],
  };
}

function getTargetForMob(mob: Mob, input: Input, leaks: readonly Leak[]): P {
  const leak = leaks.find((l) => l.id === mob.leak);
  const leakPos: P = leak ? { x: leak.x, z: leak.z } : { x: mob.x, z: mob.z };
  if (!input.player.alive) return leakPos;
  if (input.aggression === 'calm') {
    return mob.provoked ? input.player : leakPos;
  }
  if (mob.kind === 'sapper') {
    if (input.machines.length > 0) {
      let nearest = input.machines[0]!;
      let nearestDist = Math.hypot(nearest.x - mob.x, nearest.z - mob.z);
      for (let i = 1; i < input.machines.length; i++) {
        const m = input.machines[i]!;
        const d = Math.hypot(m.x - mob.x, m.z - mob.z);
        if (d < nearestDist) {
          nearest = m;
          nearestDist = d;
        }
      }
      return nearest;
    }
    return input.player;
  }
  return input.player;
}

function computeMove(mob: Mob, target: P, input: Input, existingMobs: readonly Mob[]): P {
  const spec = ARCHETYPES[mob.kind];
  const speed = spec.speed;
  const maxDist = speed * input.dt;
  const dx = target.x - mob.x;
  const dz = target.z - mob.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.001 || maxDist < 0.001) return { x: mob.x, z: mob.z };
  const baseDirX = dx / dist;
  const baseDirZ = dz / dist;

  const angles = [0, Math.PI / 8, -Math.PI / 8, Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2];
  for (const angle of angles) {
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const dirX = baseDirX * cosA - baseDirZ * sinA;
    const dirZ = baseDirX * sinA + baseDirZ * cosA;
    const tx = mob.x + dirX * maxDist;
    const tz = mob.z + dirZ * maxDist;

    const walkableFn = input.walkable ?? (() => true);
    if (!spec.flies && !walkableFn(tx, tz)) continue;

    let overlap = false;
    for (const other of existingMobs) {
      if (other.id === mob.id) continue;
      if (other.phase === 'dead') continue;
      const otherSpec = ARCHETYPES[other.kind];
      const d = Math.hypot(tx - other.x, tz - other.z);
      if (d < spec.radius + otherSpec.radius - 1e-6) {
        overlap = true;
        break;
      }
    }
    if (!overlap) {
      return { x: tx, z: tz };
    }
  }

  return { x: mob.x, z: mob.z };
}

function trySpawnPosition(
  leakPos: P,
  kind: Archetype,
  input: Input,
  existingMobs: readonly Mob[],
  rngState: number
): { x: number; z: number; newRng: number } | null {
  const spec = ARCHETYPES[kind];
  for (let i = 0; i < 30; i++) {
    const res = rndFloat(rngState);
    const f = res.f;
    const r = res.rng;
    const angle = f * Math.PI * 2;
    const radius = Math.sqrt(f) * 6;
    const x = leakPos.x + Math.cos(angle) * radius;
    const z = leakPos.z + Math.sin(angle) * radius;

    let insideSafe = false;
    for (const s of input.safe) {
      if (Math.hypot(x - s.x, z - s.z) < s.r - 1e-6) {
        insideSafe = true;
        break;
      }
    }
    if (insideSafe) {
      rngState = r;
      continue;
    }

    if (Math.hypot(x - input.player.x, z - input.player.z) < 8 - 1e-6) {
      rngState = r;
      continue;
    }

    if (!spec.flies) {
      const walkableFn = input.walkable ?? (() => true);
      if (!walkableFn(x, z)) {
        rngState = r;
        continue;
      }
    }

    let overlap = false;
    for (const mob of existingMobs) {
      if (mob.phase === 'dead') continue;
      const otherSpec = ARCHETYPES[mob.kind];
      const d = Math.hypot(x - mob.x, z - mob.z);
      if (d < spec.radius + otherSpec.radius - 1e-6) {
        overlap = true;
        break;
      }
    }
    if (overlap) {
      rngState = r;
      continue;
    }

    return { x, z, newRng: r };
  }
  return null;
}

export function step(w: World, input: Input): { readonly world: World; readonly events: readonly Event[] } {
  const events: Event[] = [];
  let newRng = w.rng;
  let nextId = w.nextId;

  const prevT = w.t;
  const newT = prevT + input.dt;

  const newLeaks: Leak[] = [];
  const spawnRequests: { kind: Archetype; leakId: number; leakPos: P }[] = [];

  for (const leak of w.leaks) {
    if (leak.sealed) {
      newLeaks.push({ ...leak, seal: 1, sealed: true, nextWave: leak.nextWave });
      continue;
    }

    const distToPlayer = Math.hypot(input.player.x - leak.x, input.player.z - leak.z);
    let newSeal = leak.seal;
    let sealed: boolean = leak.sealed;

    if (input.sealing === leak.id && distToPlayer <= 25) {
      newSeal = Math.min(1, leak.seal + input.dt / SEAL_SECONDS);
      if (newSeal >= 1 - 1e-6) {
        newSeal = 1;
        sealed = true;
        events.push({ t: 'sealed', leak: leak.id });
      }
    } else {
      newSeal = Math.max(0, leak.seal - input.dt / (SEAL_SECONDS * 2));
    }

    let nextWave = leak.nextWave;
    if (input.aggression !== 'off' && !sealed) {
      const interval = input.aggression === 'hard' ? 60 : input.aggression === 'calm' ? 120 : 90;
      const warnThreshold = leak.nextWave - WARN_SECONDS;
      const spawnThreshold = leak.nextWave;

      if (prevT < warnThreshold - 1e-6 && newT >= warnThreshold - 1e-6) {
        events.push({ t: 'warn', leak: leak.id, inSeconds: WARN_SECONDS });
      }

      if (prevT < spawnThreshold - 1e-6 && newT >= spawnThreshold - 1e-6) {
        const kinds = leak.kinds;
        let maxSpawns = Math.max(0, MAX_MOBS - w.mobs.filter((m) => m.phase !== 'dead').length);
        const desired: Archetype[] = [];
        for (const kind of kinds) {
          const pack = ARCHETYPES[kind].pack;
          const multiplier = 1 + Math.floor(input.stage / 2);
          const hardMult = input.aggression === 'hard' ? 1.5 : 1;
          const count = Math.round(pack * multiplier * hardMult);
          for (let i = 0; i < count; i++) {
            desired.push(kind);
          }
        }
        const toSpawn = desired.slice(0, maxSpawns);
        for (const kind of toSpawn) {
          spawnRequests.push({ kind, leakId: leak.id, leakPos: { x: leak.x, z: leak.z } });
        }
        nextWave = spawnThreshold + interval;
      }
      if (prevT >= spawnThreshold && !sealed) {
        nextWave = prevT + interval;
      }
    }

    newLeaks.push({ ...leak, seal: newSeal, sealed, nextWave });
  }

  const processedMobs: Mob[] = [];
  const boltsToAdd: Bolt[] = [];

  for (const mob of w.mobs) {
    if (mob.phase === 'dead') {
      const newPhaseT = mob.phaseT + input.dt;
      if (newPhaseT >= 2) {
        continue;
      }
      processedMobs.push({ ...mob, phaseT: newPhaseT });
      continue;
    }

    const spec = ARCHETYPES[mob.kind];
    let phase: Phase = mob.phase;
    let phaseT = mob.phaseT;
    let hp = mob.hp;
    let provoked = mob.provoked;
    let x = mob.x;
    let z = mob.z;
    let windupTarget: P | undefined = (mob as any).windupTarget;

    if (phase === 'pain') {
      phaseT += input.dt;
      if (phaseT >= 0.25) {
        if (hp <= 0) {
          events.push({ t: 'death', mob: mob.id, drop: spec.drop });
          phase = 'dead';
          phaseT = 0;
          processedMobs.push({ ...mob, phase, phaseT, x, z, hp, provoked });
        } else {
          phase = input.player.alive ? 'chase' : 'roam';
          phaseT = 0;
          processedMobs.push({ ...mob, phase, phaseT, x, z, hp, provoked });
        }
      } else {
        processedMobs.push({ ...mob, phase, phaseT, x, z, hp, provoked });
      }
      continue;
    }

    if (mob.kind === 'sapper') {
      const target = getTargetForMob(mob, input, w.leaks);
      const distToTarget = Math.hypot(target.x - mob.x, target.z - mob.z);
      if (distToTarget <= spec.reach + 0.5) {
        events.push({ t: 'drain', mob: mob.id, machine: (target as any).id ?? -1, amount: spec.damage * input.dt });
      }
    }

    if (phase === 'windup') {
      phaseT += input.dt;
      if (phaseT >= spec.windup) {
        const target = getTargetForMob(mob, input, w.leaks);
        const distToTarget = Math.hypot(target.x - mob.x, target.z - mob.z);

        if (mob.kind === 'sapper') {
          if (distToTarget <= spec.reach + 0.5) {
            events.push({ t: 'drain', mob: mob.id, machine: (target as any).id ?? -1, amount: spec.damage * input.dt });
          }
        } else if (spec.ranged) {
          const boltDirX = (windupTarget?.x ?? target.x) - mob.x;
          const boltDirZ = (windupTarget?.z ?? target.z) - mob.z;
          const len = Math.hypot(boltDirX, boltDirZ);
          const dirX = len < 0.001 ? 0 : boltDirX / len;
          const dirZ = len < 0.001 ? 0 : boltDirZ / len;
          boltsToAdd.push({
            id: nextId++,
            x: mob.x,
            z: mob.z,
            from: mob.id,
            vx: dirX * 12,
            vz: dirZ * 12,
            life: 0,
            damage: spec.damage,
          } as Bolt);
        } else {
          if (distToTarget <= spec.reach + 0.5) {
            events.push({ t: 'hitPlayer', mob: mob.id, damage: spec.damage });
          }
        }

        phase = 'attack';
        phaseT = 0;
        windupTarget = undefined;
        processedMobs.push({ ...mob, phase, phaseT, x, z, hp, provoked, windupTarget } as Mob);
      } else {
        processedMobs.push({ ...mob, phase, phaseT, x, z, hp, provoked, windupTarget } as Mob);
      }
      continue;
    }

    if (phase === 'attack') {
      phase = 'recover';
      phaseT = 0;
      processedMobs.push({ ...mob, phase, phaseT, x, z, hp, provoked } as Mob);
      continue;
    }

    if (phase === 'recover') {
      phaseT += input.dt;
      if (phaseT >= 0.6) {
        phase = input.player.alive ? 'chase' : 'roam';
        phaseT = 0;
      }
      processedMobs.push({ ...mob, phase, phaseT, x, z, hp, provoked, windupTarget } as Mob);
      continue;
    }

    const target = getTargetForMob(mob, input, w.leaks);
    const distToTarget = Math.hypot(target.x - mob.x, target.z - mob.z);

    if (distToTarget <= spec.reach + 0.5) {
      phase = 'windup';
      phaseT = 0;
      windupTarget = { x: target.x, z: target.z };
      events.push({ t: 'telegraph', mob: mob.id });
      processedMobs.push({ ...mob, phase, phaseT, x, z, hp, provoked, windupTarget } as Mob);
    } else {
      const movedPos = computeMove(mob, target, input, w.mobs);
      x = movedPos.x;
      z = movedPos.z;
      phase = input.aggression === 'calm' && !provoked ? 'roam' : 'chase';
      processedMobs.push({ ...mob, phase, phaseT: 0, x, z, hp, provoked, windupTarget } as Mob);
    }
  }

  const newMobsFromSpawns: Mob[] = [];
  for (const req of spawnRequests) {
    const spawnRes = trySpawnPosition(req.leakPos, req.kind, input, [...processedMobs, ...w.mobs], newRng);
    if (spawnRes) {
      newRng = spawnRes.newRng;
      const newMob: Mob = {
        id: nextId++,
        kind: req.kind,
        x: spawnRes.x,
        z: spawnRes.z,
        leak: req.leakId,
        hp: ARCHETYPES[req.kind].hp,
        phase: input.aggression === 'calm' ? 'roam' : 'chase',
        phaseT: 0,
        provoked: false,
      };
      newMobsFromSpawns.push(newMob);
      events.push({ t: 'spawn', mob: newMob.id, leak: req.leakId });
    }
  }

  const newBolts: Bolt[] = [];
  for (const bolt of w.bolts) {
    const newBoltLife = bolt.life + input.dt;
    const newBoltX = bolt.x + bolt.vx * input.dt;
    const newBoltZ = bolt.z + bolt.vz * input.dt;

    const distToPlayer = Math.hypot(newBoltX - input.player.x, newBoltZ - input.player.z);
    if (distToPlayer <= 0.6) {
      events.push({ t: 'hitPlayer', mob: bolt.from, damage: bolt.damage });
      continue;
    }

    if (newBoltLife >= 3) {
      continue;
    }

    newBolts.push({ ...bolt, x: newBoltX, z: newBoltZ, life: newBoltLife });
  }

  return {
    world: {
      t: newT,
      rng: newRng,
      nextId,
      mobs: [...processedMobs, ...newMobsFromSpawns],
      bolts: newBolts,
      leaks: newLeaks,
    },
    events,
  };
}

export function hurt(w: World, mob: number, damage: number): { readonly world: World; readonly events: readonly Event[] } {
  const newMobs = w.mobs.map((m) => {
    if (m.id === mob) {
      const newHp = Math.max(0, m.hp - damage);
      let phase: Phase = m.phase;
      let phaseT = m.phaseT;
      if (m.kind !== 'brute') {
        phase = 'pain';
        phaseT = 0;
      }
      return {
        ...m,
        hp: newHp,
        phase,
        phaseT,
        provoked: true,
      } as Mob;
    }
    return m;
  });
  return {
    world: { ...w, mobs: newMobs },
    events: [],
  };
}

export function raycast(w: World, from: P, dir: P, range: number): number | null {
  const dx = dir.x;
  const dz = dir.z;
  const len = Math.hypot(dx, dz);
  if (len < 1e-6) return null;
  const nx = dx / len;
  const nz = dz / len;

  let bestId: number | null = null;
  let bestT = Infinity;

  for (const mob of w.mobs) {
    if (mob.phase === 'dead') continue;
    const mx = mob.x - from.x;
    const mz = mob.z - from.z;
    const proj = mx * nx + mz * nz;
    const t = Math.max(0, Math.min(range, proj));
    const closestX = from.x + nx * t;
    const closestZ = from.z + nz * t;
    const distSq = (mob.x - closestX) * (mob.x - closestX) + (mob.z - closestZ) * (mob.z - closestZ);
    const radius = ARCHETYPES[mob.kind].radius;
    if (distSq <= radius * radius + 1e-6) {
      if (t < bestT - 1e-6) {
        bestT = t;
        bestId = mob.id;
      }
    }
  }
  return bestId;
}

export function encode(w: World): string {
  return JSON.stringify(w);
}

export function decode(s: string): World {
  return JSON.parse(s) as World;
}
