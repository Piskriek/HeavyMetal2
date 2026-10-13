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

export const ARCHETYPES: Readonly<Record<Archetype, Spec>> = Object.freeze({
  charger: Object.freeze({
    hp: 40,
    speed: 6.5,
    radius: 0.8,
    reach: 1.8,
    windup: 0.5,
    damage: 15,
    flies: false,
    ranged: false,
    targets: 'player',
    pack: 2,
    drop: Object.freeze({ item: 'pixels', n: 4 }),
  }),
  spitter: Object.freeze({
    hp: 25,
    speed: 3.5,
    radius: 0.7,
    reach: 16.0,
    windup: 0.6,
    damage: 10,
    flies: false,
    ranged: true,
    targets: 'player',
    pack: 2,
    drop: Object.freeze({ item: 'pixels', n: 3 }),
  }),
  swarmer: Object.freeze({
    hp: 12,
    speed: 7.2,
    radius: 0.4,
    reach: 1.2,
    windup: 0.4,
    damage: 5,
    flies: true,
    ranged: false,
    targets: 'player',
    pack: 4,
    drop: Object.freeze({ item: 'pixels', n: 2 }),
  }),
  flyer: Object.freeze({
    hp: 25,
    speed: 4.8,
    radius: 0.6,
    reach: 14.0,
    windup: 0.5,
    damage: 8,
    flies: true,
    ranged: true,
    targets: 'player',
    pack: 2,
    drop: Object.freeze({ item: 'pixels', n: 4 }),
  }),
  brute: Object.freeze({
    hp: 100,
    speed: 2.4,
    radius: 1.2,
    reach: 2.2,
    windup: 1.0,
    damage: 30,
    flies: false,
    ranged: false,
    targets: 'player',
    pack: 1,
    drop: Object.freeze({ item: 'vertices', n: 4 }),
  }),
  sapper: Object.freeze({
    hp: 45,
    speed: 3.2,
    radius: 0.8,
    reach: 2.0,
    windup: 0.4,
    damage: 10,
    flies: false,
    ranged: false,
    targets: 'machine',
    pack: 1,
    drop: Object.freeze({ item: 'vertices', n: 3 }),
  }),
});

export interface P { readonly x: number; readonly z: number }

export interface Mob extends P {
  readonly id: number;
  readonly kind: Archetype;
  readonly leak: number;
  readonly hp: number;
  readonly phase: Phase;
  readonly phaseT: number;
  readonly provoked: boolean;
  readonly targetX?: number;
  readonly targetZ?: number;
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

export const WARN_SECONDS = 20 as const;
export const SEAL_SECONDS = 6 as const;
export const MAX_MOBS = 24 as const;

function nextRng(state: number): { readonly value: number; readonly nextState: number } {
  const s = (state + 0x6D2B79F5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, nextState: s };
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
  const newLeak: Leak = {
    id: w.nextId,
    x: at.x,
    z: at.z,
    kinds: [...kinds],
    seal: 0,
    sealed: false,
    nextWave: w.t + WARN_SECONDS,
  };
  return {
    t: w.t,
    rng: w.rng,
    nextId: w.nextId + 1,
    mobs: w.mobs,
    bolts: w.bolts,
    leaks: [...w.leaks, newLeak],
  };
}

function waveInterval(aggression: Aggression): number {
  if (aggression === 'hard') return 60;
  if (aggression === 'calm') return 120;
  return 90;
}

function clampOutsideSafe(
  x: number,
  z: number,
  safe: readonly (P & { readonly r: number })[]
): { readonly x: number; readonly z: number } {
  if (safe.length === 0) return { x, z };
  let cx = x;
  let cz = z;
  for (let i = 0; i < safe.length; i++) {
    const s = safe[i];
    if (!s) continue;
    const dx = cx - s.x;
    const dz = cz - s.z;
    const distSq = dx * dx + dz * dz;
    const rSq = s.r * s.r;
    if (distSq < rSq) {
      const dist = Math.sqrt(distSq);
      if (dist > 1e-6) {
        cx = s.x + (dx / dist) * s.r;
        cz = s.z + (dz / dist) * s.r;
      } else {
        cx = s.x + s.r;
        cz = s.z;
      }
    }
  }
  return { x: cx, z: cz };
}

function isValidPosition(
  x: number,
  z: number,
  flies: boolean,
  safe: readonly (P & { readonly r: number })[],
  walkable?: (x: number, z: number) => boolean
): boolean {
  if (safe.length === 0 && (flies || !walkable)) return true;
  for (let i = 0; i < safe.length; i++) {
    const s = safe[i];
    if (!s) continue;
    const dx = x - s.x;
    const dz = z - s.z;
    if (dx * dx + dz * dz < s.r * s.r - 1e-7) return false;
  }
  if (!flies && walkable && !walkable(x, z)) return false;
  return true;
}

const TURN_OFFSETS = [0, 0.26, -0.26, 0.52, -0.52, 0.78, -0.78, 1.05, -1.05, 1.3, -1.3, 1.57, -1.57];

function steerGround(
  curX: number,
  curZ: number,
  baseAngle: number,
  dist: number,
  safe: readonly (P & { readonly r: number })[],
  walkable?: (x: number, z: number) => boolean
): { readonly x: number; readonly z: number } {
  for (let k = 0; k < TURN_OFFSETS.length; k++) {
    const offset = TURN_OFFSETS[k] ?? 0;
    const angle = baseAngle + offset;
    const candX = curX + Math.cos(angle) * dist;
    const candZ = curZ + Math.sin(angle) * dist;

    const clamped = clampOutsideSafe(candX, candZ, safe);
    if (isValidPosition(clamped.x, clamped.z, false, safe, walkable)) {
      return clamped;
    }
  }
  return { x: curX, z: curZ };
}

export function step(
  w: World,
  input: Input
): { readonly world: World; readonly events: readonly Event[] } {
  let curRng = w.rng;
  const rand = (): number => {
    const res = nextRng(curRng);
    curRng = res.nextState;
    return res.value;
  };

  let nextId = w.nextId;
  const events: Event[] = [];
  const dt = input.dt;
  const curT = w.t;
  const nextT = curT + dt;

  // 1. Process Leaks (Sealing, Waves, Warnings)
  const currentInterval = waveInterval(input.aggression);
  const updatedLeaks: Leak[] = [];
  const waveSpawnsToRun: { readonly leak: Leak; readonly kinds: readonly Archetype[] }[] = [];

  for (let i = 0; i < w.leaks.length; i++) {
    const l = w.leaks[i];
    if (!l) continue;

    let seal = l.seal;
    let sealed = l.sealed;
    let nextWave = l.nextWave;

    // The first wave is already scheduled at creationT + WARN_SECONDS

    if (!sealed) {
      const isSealing =
        input.sealing === l.id &&
        Math.hypot(input.player.x - l.x, input.player.z - l.z) <= 25;

      if (isSealing) {
        seal += dt / SEAL_SECONDS;
      } else {
        seal -= (dt / SEAL_SECONDS) * 0.5;
      }

      if (seal >= 1) {
        seal = 1;
        sealed = true;
        events.push({ t: 'sealed', leak: l.id });
      } else if (seal < 0) {
        seal = 0;
      }
    }

    if (!sealed) {
      if (input.aggression === 'off') {
        nextWave += dt;
      } else {
        const warnTime = nextWave - WARN_SECONDS;
        if (warnTime >= curT - 1e-7 && warnTime < nextT - 1e-7) {
          events.push({ t: 'warn', leak: l.id, inSeconds: WARN_SECONDS });
        }

        if (nextWave >= curT - 1e-7 && nextWave < nextT - 1e-7) {
          waveSpawnsToRun.push({ leak: l, kinds: l.kinds });
          nextWave += currentInterval;
        }
      }
    }

    updatedLeaks.push({
      id: l.id,
      x: l.x,
      z: l.z,
      kinds: l.kinds,
      seal,
      sealed,
      nextWave,
    });
  }

  // 2. Wave Spawning
  let livingMobsCount = 0;
  for (let i = 0; i < w.mobs.length; i++) {
    const m = w.mobs[i];
    if (m && m.phase !== 'dead') livingMobsCount++;
  }

  const newMobs: Mob[] = [];

  for (let wIdx = 0; wIdx < waveSpawnsToRun.length; wIdx++) {
    const waveInfo = waveSpawnsToRun[wIdx];
    if (!waveInfo) continue;
    const leak = waveInfo.leak;

    for (let kIdx = 0; kIdx < waveInfo.kinds.length; kIdx++) {
      const kind = waveInfo.kinds[kIdx];
      if (!kind) continue;
      const spec = ARCHETYPES[kind];
      const baseCount = spec.pack * (1 + Math.floor(input.stage / 2));
      const rawCount = input.aggression === 'hard' ? baseCount * 1.5 : baseCount;
      const count = Math.floor(rawCount);

      for (let c = 0; c < count; c++) {
        if (livingMobsCount >= MAX_MOBS) break;

        let spawnX = leak.x;
        let spawnZ = leak.z;
        let found = false;

        for (let attempt = 0; attempt < 40; attempt++) {
          const r = Math.sqrt(rand()) * 5.8;
          const th = rand() * Math.PI * 2;
          const cx = leak.x + Math.cos(th) * r;
          const cz = leak.z + Math.sin(th) * r;

          const distP = Math.hypot(cx - input.player.x, cz - input.player.z);
          if (distP < 8.0) continue;

          let insideSafe = false;
          for (let sIdx = 0; sIdx < input.safe.length; sIdx++) {
            const s = input.safe[sIdx];
            if (!s) continue;
            if (Math.hypot(cx - s.x, cz - s.z) < s.r) {
              insideSafe = true;
              break;
            }
          }
          if (insideSafe) continue;

          if (!spec.flies && input.walkable && !input.walkable(cx, cz)) {
            continue;
          }

          spawnX = cx;
          spawnZ = cz;
          found = true;
          break;
        }

        if (!found) {
          const radii = [5.8, 5.0, 4.0, 3.0, 2.0, 1.0];
          const angles = 16;
          for (let rIdx = 0; rIdx < radii.length && !found; rIdx++) {
            const rad = radii[rIdx] ?? 5.0;
            for (let aIdx = 0; aIdx < angles; aIdx++) {
              const th = (aIdx / angles) * Math.PI * 2;
              const cx = leak.x + Math.cos(th) * rad;
              const cz = leak.z + Math.sin(th) * rad;

              if (Math.hypot(cx - input.player.x, cz - input.player.z) < 8.0) continue;

              let insideSafe = false;
              for (let sIdx = 0; sIdx < input.safe.length; sIdx++) {
                const s = input.safe[sIdx];
                if (!s) continue;
                if (Math.hypot(cx - s.x, cz - s.z) < s.r) {
                  insideSafe = true;
                  break;
                }
              }
              if (insideSafe) continue;

              if (!spec.flies && input.walkable && !input.walkable(cx, cz)) continue;

              spawnX = cx;
              spawnZ = cz;
              found = true;
              break;
            }
          }
        }

        if (found || spec.flies) {
          const mobId = nextId++;
          newMobs.push({
            id: mobId,
            kind,
            leak: leak.id,
            hp: spec.hp,
            phase: 'roam',
            phaseT: 0,
            provoked: false,
            x: spawnX,
            z: spawnZ,
          });
          livingMobsCount++;
          events.push({ t: 'spawn', mob: mobId, leak: leak.id });
        }
      }
    }
  }

  // 3. Update Existing Mobs
  const allMobs: Mob[] = [];
  const newBolts: Bolt[] = [];

  for (let i = 0; i < w.mobs.length; i++) {
    const m = w.mobs[i];
    if (!m) continue;
    const spec = ARCHETYPES[m.kind];

    if (m.phase === 'dead') {
      const pt = m.phaseT + dt;
      if (pt < 2.0) {
        allMobs.push({
          ...m,
          phaseT: pt,
        });
      }
      continue;
    }

    if (m.phase === 'pain') {
      const pt = m.phaseT + dt;
      if (pt >= 0.25) {
        allMobs.push({
          ...m,
          phase: 'chase',
          phaseT: 0,
        });
      } else {
        allMobs.push({
          ...m,
          phaseT: pt,
        });
      }
      continue;
    }

    if (m.phase === 'recover') {
      const pt = m.phaseT + dt;
      if (pt >= 0.6) {
        allMobs.push({
          ...m,
          phase: 'chase',
          phaseT: 0,
        });
      } else {
        allMobs.push({
          ...m,
          phaseT: pt,
        });
      }
      continue;
    }

    if (m.phase === 'windup') {
      const pt = m.phaseT + dt;
      if (pt >= spec.windup) {
        if (spec.ranged) {
          const tx = m.targetX ?? input.player.x;
          const tz = m.targetZ ?? input.player.z;
          const dx = tx - m.x;
          const dz = tz - m.z;
          const dist = Math.hypot(dx, dz) || 1;
          const vx = (dx / dist) * 12;
          const vz = (dz / dist) * 12;

          newBolts.push({
            id: nextId++,
            from: m.id,
            x: m.x,
            z: m.z,
            vx,
            vz,
            life: 3.0,
            damage: spec.damage,
          });
        } else {
          const curDist = Math.hypot(input.player.x - m.x, input.player.z - m.z);
          if (input.player.alive && curDist <= spec.reach + 0.5) {
            events.push({ t: 'hitPlayer', mob: m.id, damage: spec.damage });
          }
        }

        allMobs.push({
          ...m,
          phase: 'recover',
          phaseT: 0,
          targetX: undefined,
          targetZ: undefined,
        });
      } else {
        allMobs.push({
          ...m,
          phaseT: pt,
        });
      }
      continue;
    }

    // Phase: roam or chase or attack
    let leakX = m.x;
    let leakZ = m.z;
    for (let lIdx = 0; lIdx < updatedLeaks.length; lIdx++) {
      const lk = updatedLeaks[lIdx];
      if (lk && lk.id === m.leak) {
        leakX = lk.x;
        leakZ = lk.z;
        break;
      }
    }

    let shouldChase = false;
    let targetX = leakX;
    let targetZ = leakZ;
    let isTargetingMachine = false;
    let nearestMachineId: number | null = null;

    if (spec.targets === 'machine') {
      isTargetingMachine = true;
      let closestDist = Infinity;
      for (let mi = 0; mi < input.machines.length; mi++) {
        const mc = input.machines[mi];
        if (!mc) continue;
        const d = Math.hypot(mc.x - m.x, mc.z - m.z);
        if (d < closestDist) {
          closestDist = d;
          targetX = mc.x;
          targetZ = mc.z;
          nearestMachineId = mc.id;
        }
      }
      if (nearestMachineId !== null) {
        shouldChase = true;
      }
    } else {
      const playerDist = Math.hypot(input.player.x - m.x, input.player.z - m.z);
      if (input.player.alive) {
        if (input.aggression === 'calm') {
          shouldChase = m.provoked;
        } else if (input.aggression === 'normal' || input.aggression === 'hard') {
          shouldChase = m.provoked || playerDist <= 40;
        }
      }
      if (shouldChase) {
        targetX = input.player.x;
        targetZ = input.player.z;
      }
    }

    const distToTarget = Math.hypot(targetX - m.x, targetZ - m.z);

    if (isTargetingMachine && nearestMachineId !== null && distToTarget <= spec.reach) {
      events.push({
        t: 'drain',
        mob: m.id,
        machine: nearestMachineId,
        amount: spec.damage * dt,
      });
      allMobs.push({
        ...m,
        phase: 'attack',
        phaseT: m.phaseT + dt,
      });
      continue;
    }

    if (!isTargetingMachine && shouldChase && distToTarget <= spec.reach) {
      events.push({ t: 'telegraph', mob: m.id });
      allMobs.push({
        ...m,
        phase: 'windup',
        phaseT: 0,
        targetX: input.player.x,
        targetZ: input.player.z,
      });
      continue;
    }

    // Move towards target
    const currentPhase: Phase = shouldChase ? 'chase' : 'roam';
    let moveTargetX = targetX;
    let moveTargetZ = targetZ;

    if (!shouldChase) {
      const dLeak = Math.hypot(m.x - leakX, m.z - leakZ);
      if (dLeak > 14) {
        moveTargetX = leakX;
        moveTargetZ = leakZ;
      } else {
        const th = (m.id * 1.618033 + curT * 0.3) % (Math.PI * 2);
        moveTargetX = leakX + Math.cos(th) * 7;
        moveTargetZ = leakZ + Math.sin(th) * 7;
      }
    }

    const mdx = moveTargetX - m.x;
    const mdz = moveTargetZ - m.z;
    const moveDist = Math.hypot(mdx, mdz);

    if (moveDist < 0.05) {
      allMobs.push({
        ...m,
        phase: currentPhase,
      });
      continue;
    }

    const moveSpeed = shouldChase ? spec.speed : spec.speed * 0.5;
    const stepLen = Math.min(moveDist, moveSpeed * dt);
    const baseAngle = Math.atan2(mdz, mdx);

    let nextX = m.x;
    let nextZ = m.z;

    if (spec.flies) {
      const candX = m.x + Math.cos(baseAngle) * stepLen;
      const candZ = m.z + Math.sin(baseAngle) * stepLen;
      const clamped = clampOutsideSafe(candX, candZ, input.safe);
      nextX = clamped.x;
      nextZ = clamped.z;
    } else {
      const stepped = steerGround(m.x, m.z, baseAngle, stepLen, input.safe, input.walkable);
      nextX = stepped.x;
      nextZ = stepped.z;
    }

    allMobs.push({
      ...m,
      x: nextX,
      z: nextZ,
      phase: currentPhase,
    });
  }

  // Include freshly spawned mobs
  for (let sIdx = 0; sIdx < newMobs.length; sIdx++) {
    const sm = newMobs[sIdx];
    if (sm) allMobs.push(sm);
  }

  // 4. Monster Separation
  for (let i = 0; i < allMobs.length; i++) {
    const mi = allMobs[i];
    if (!mi || mi.phase === 'dead') continue;
    const specI = ARCHETYPES[mi.kind];

    for (let j = i + 1; j < allMobs.length; j++) {
      const mj = allMobs[j];
      if (!mj || mj.phase === 'dead') continue;
      const specJ = ARCHETYPES[mj.kind];

      const dx = mj.x - mi.x;
      const dz = mj.z - mi.z;
      const dist = Math.hypot(dx, dz);
      const minDist = specI.radius + specJ.radius;

      if (dist < minDist && dist > 1e-5) {
        const overlap = minDist - dist;
        const pushX = (dx / dist) * (overlap * 0.5);
        const pushZ = (dz / dist) * (overlap * 0.5);

        let nIx = mi.x - pushX;
        let nIz = mi.z - pushZ;
        let nJx = mj.x + pushX;
        let nJz = mj.z + pushZ;

        const clI = clampOutsideSafe(nIx, nIz, input.safe);
        if (isValidPosition(clI.x, clI.z, specI.flies, input.safe, input.walkable)) {
          allMobs[i] = { ...mi, x: clI.x, z: clI.z };
        }

        const clJ = clampOutsideSafe(nJx, nJz, input.safe);
        if (isValidPosition(clJ.x, clJ.z, specJ.flies, input.safe, input.walkable)) {
          allMobs[j] = { ...mj, x: clJ.x, z: clJ.z };
        }
      }
    }
  }

  // 5. Update Bolts
  const activeBolts: Bolt[] = [];
  const boltsToProcess = [...w.bolts, ...newBolts];

  for (let bIdx = 0; bIdx < boltsToProcess.length; bIdx++) {
    const b = boltsToProcess[bIdx];
    if (!b) continue;

    const remainingLife = b.life - dt;
    if (remainingLife <= 0) continue;

    const bx = b.x + b.vx * dt;
    const bz = b.z + b.vz * dt;

    if (input.player.alive && Math.hypot(bx - input.player.x, bz - input.player.z) <= 0.6) {
      events.push({ t: 'hitPlayer', mob: b.from, damage: b.damage });
      continue;
    }

    activeBolts.push({
      id: b.id,
      from: b.from,
      x: bx,
      z: bz,
      vx: b.vx,
      vz: b.vz,
      life: remainingLife,
      damage: b.damage,
    });
  }

  return {
    world: {
      t: nextT,
      rng: curRng,
      nextId,
      mobs: allMobs,
      bolts: activeBolts,
      leaks: updatedLeaks,
    },
    events,
  };
}

export function hurt(
  w: World,
  mobId: number,
  damage: number
): { readonly world: World; readonly events: readonly Event[] } {
  const events: Event[] = [];
  let found = false;

  const nextMobs: Mob[] = [];

  for (let i = 0; i < w.mobs.length; i++) {
    const m = w.mobs[i];
    if (!m) continue;

    if (m.id !== mobId || m.phase === 'dead') {
      nextMobs.push(m);
      continue;
    }

    found = true;
    const newHp = m.hp - damage;
    const spec = ARCHETYPES[m.kind];

    if (newHp <= 0) {
      events.push({ t: 'death', mob: m.id, drop: spec.drop });
      nextMobs.push({
        ...m,
        hp: 0,
        phase: 'dead',
        phaseT: 0,
        provoked: true,
      });
    } else {
      const nextPhase: Phase = m.kind === 'brute' ? m.phase : 'pain';
      nextMobs.push({
        ...m,
        hp: newHp,
        phase: nextPhase,
        phaseT: m.kind === 'brute' ? m.phaseT : 0,
        provoked: true,
      });
    }
  }

  if (!found) {
    return { world: w, events: [] };
  }

  return {
    world: {
      t: w.t,
      rng: w.rng,
      nextId: w.nextId,
      mobs: nextMobs,
      bolts: w.bolts,
      leaks: w.leaks,
    },
    events,
  };
}

export function raycast(w: World, from: P, dir: P, range: number): number | null {
  const dLen = Math.hypot(dir.x, dir.z);
  if (dLen === 0) return null;
  const dx = dir.x / dLen;
  const dz = dir.z / dLen;

  let nearestId: number | null = null;
  let nearestDist = Infinity;

  for (let i = 0; i < w.mobs.length; i++) {
    const m = w.mobs[i];
    if (!m || m.phase === 'dead') continue;

    const r = ARCHETYPES[m.kind].radius;
    const vx = m.x - from.x;
    const vz = m.z - from.z;

    const tProj = vx * dx + vz * dz;
    const dPerpSq = vx * vx + vz * vz - tProj * tProj;
    const rSq = r * r;

    if (dPerpSq > rSq) continue;

    const delta = Math.sqrt(Math.max(0, rSq - dPerpSq));
    const tHit = vx * vx + vz * vz <= rSq ? 0 : tProj - delta;

    if (tHit >= 0 && tHit <= range && tHit < nearestDist) {
      nearestDist = tHit;
      nearestId = m.id;
    }
  }

  return nearestId;
}

export function encode(w: World): string {
  return JSON.stringify(w);
}

export function decode(s: string): World {
  const parsed = JSON.parse(s) as World;
  return {
    t: parsed.t,
    rng: parsed.rng,
    nextId: parsed.nextId,
    mobs: parsed.mobs.map((m) => ({
      id: m.id,
      kind: m.kind,
      leak: m.leak,
      hp: m.hp,
      phase: m.phase,
      phaseT: m.phaseT,
      provoked: m.provoked,
      x: m.x,
      z: m.z,
      ...(m.targetX !== undefined ? { targetX: m.targetX } : {}),
      ...(m.targetZ !== undefined ? { targetZ: m.targetZ } : {}),
    })),
    bolts: parsed.bolts.map((b) => ({
      id: b.id,
      from: b.from,
      x: b.x,
      z: b.z,
      vx: b.vx,
      vz: b.vz,
      life: b.life,
      damage: b.damage,
    })),
    leaks: parsed.leaks.map((l) => ({
      id: l.id,
      kinds: [...l.kinds],
      seal: l.seal,
      sealed: l.sealed,
      nextWave: l.nextWave,
      x: l.x,
      z: l.z,
    })),
  };
}
