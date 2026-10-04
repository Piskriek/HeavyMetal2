/**
 * rockets: a toy-world rocket module.
 *
 * A rocket is a blueprint of parts stacked on a grid. This module checks
 * whether a blueprint is "ship ready", works out its numbers (mass, thrust,
 * fuel, range) and simulates a simple straight-up launch.
 *
 * No imports, no DOM, no Date, no Math.random.
 */

export type PartKind = 'nose' | 'cabin' | 'tank' | 'engine' | 'fin' | 'hull' | 'button';

export interface PartDef {
  kind: PartKind;
  mass: number;
  fuel?: number;
  thrust?: number;
  burn?: number;
} // kg; fuel kg held; thrust N; burn kg/s

export const PARTS: Readonly<Record<PartKind, PartDef>> = {
  nose: { kind: 'nose', mass: 50 },
  cabin: { kind: 'cabin', mass: 300 },
  tank: { kind: 'tank', mass: 100, fuel: 900 },
  engine: { kind: 'engine', mass: 250, thrust: 60000, burn: 30 },
  fin: { kind: 'fin', mass: 20 },
  hull: { kind: 'hull', mass: 80 },
  button: { kind: 'button', mass: 1 },
};

export interface Part {
  kind: PartKind;
  x: number;
  y: number;
} // grid cells, y up; one part per cell

export interface Wire {
  from: number;
  to: number;
} // indices into parts (the launch button wired to an engine)

export interface Blueprint {
  parts: Part[];
  wires: Wire[];
}

const GRAVITY = 9.8; // m/s^2
const DRAG = 0.0005; // per kg of mass

/** Problems (empty = ship ready). */
export function readiness(b: Blueprint): string[] {
  const problems: string[] = [];
  const parts = b.parts;

  // Exactly one cabin.
  const cabins = parts.filter((p) => p.kind === 'cabin').length;
  if (cabins === 0) {
    problems.push('no cabin');
  } else if (cabins > 1) {
    problems.push(`expected exactly one cabin, found ${cabins}`);
  }

  // At least one engine.
  const engines = parts.filter((p) => p.kind === 'engine');
  if (engines.length === 0) {
    problems.push('no engine');
  }

  // At least one tank.
  if (!parts.some((p) => p.kind === 'tank')) {
    problems.push('no tank');
  }

  // Every part touches another (4-neighbours); the whole rocket is one piece.
  if (parts.length === 0) {
    problems.push('no parts');
  } else {
    const at = new Map<string, number>();
    parts.forEach((p, i) => at.set(`${p.x},${p.y}`, i));
    const seen = new Set<number>([0]);
    const stack: number[] = [0];
    while (stack.length > 0) {
      const cur = stack.pop() as number;
      const p = parts[cur] as Part;
      const around: Array<[number, number]> = [
        [p.x + 1, p.y],
        [p.x - 1, p.y],
        [p.x, p.y + 1],
        [p.x, p.y - 1],
      ];
      for (const [nx, ny] of around) {
        const j = at.get(`${nx},${ny}`);
        if (j !== undefined && !seen.has(j)) {
          seen.add(j);
          stack.push(j);
        }
      }
    }
    for (let i = 0; i < parts.length; i++) {
      if (!seen.has(i)) {
        const p = parts[i] as Part;
        problems.push(`part ${i} (${p.kind} at ${p.x},${p.y}) is floating`);
      }
    }
  }

  // Every engine is at the bottom of its column (nothing below it).
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i] as Part;
    if (p.kind !== 'engine') continue;
    const under = parts.some((q) => q.x === p.x && q.y < p.y);
    if (under) {
      problems.push(`engine at ${p.x},${p.y} has a part under it`);
    }
  }

  // A nose on top of the highest column.
  if (parts.length > 0) {
    let top = -Infinity;
    for (const p of parts) {
      if (p.y > top) top = p.y;
    }
    if (!parts.some((p) => p.y === top && p.kind === 'nose')) {
      problems.push('no nose on top of the highest column');
    }
  }

  // At least one launch button wired to every engine.
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i] as Part;
    if (p.kind !== 'engine') continue;
    const wired = b.wires.some((w) => w.from === i || w.to === i);
    if (!wired) {
      problems.push(`engine at ${p.x},${p.y} is not wired to a launch button`);
    }
  }

  // Total thrust must beat total weight at launch.
  const n = numbers(b);
  if (n.thrust <= n.mass * GRAVITY) {
    problems.push('too heavy to lift off');
  }

  return problems;
}

export interface Numbers {
  dryMass: number;
  fuel: number;
  mass: number;
  thrust: number;
  burn: number;
  twr: number;
  burnTime: number;
  deltaV: number;
}

export function numbers(b: Blueprint): Numbers {
  let dryMass = 0;
  let fuel = 0;
  let thrust = 0;
  let burn = 0;

  for (const p of b.parts) {
    const def = PARTS[p.kind];
    dryMass += def.mass;
    fuel += def.fuel ?? 0;
    thrust += def.thrust ?? 0;
    burn += def.burn ?? 0;
  }

  const mass = dryMass + fuel;
  const twr = mass > 0 ? thrust / (mass * GRAVITY) : 0;
  const burnTime = burn > 0 ? fuel / burn : 0;
  const deltaV = burn > 0 && dryMass > 0 ? (thrust / burn) * Math.log(mass / dryMass) : 0;

  return { dryMass, fuel, mass, thrust, burn, twr, burnTime, deltaV };
}

export interface Flight {
  t: number;
  height: number;
  speed: number;
  fuel: number;
}

/** Simulate a straight-up launch in steps of dt. */
export function launch(b: Blueprint, seconds: number, dt: number): Flight[] {
  const n = numbers(b);
  const samples: Flight[] = [];

  let height = 0;
  let speed = 0;
  let fuel = n.fuel;
  let launched = false;
  let done = false;

  const steps = dt > 0 ? Math.max(0, Math.floor(seconds / dt + 1e-9)) : 0;

  for (let i = 0; i <= steps; i++) {
    if (i > 0) {
      const burning = fuel > 0 && n.burn > 0;
      const thrust = burning ? n.thrust : 0;
      const used = burning ? Math.min(fuel, n.burn * dt) : 0;
      fuel = Math.max(0, fuel - used);

      const mass = n.dryMass + fuel;
      const drag = mass > 0 ? (DRAG * speed * Math.abs(speed)) / mass : 0;
      const accel = (mass > 0 ? thrust / mass : 0) - GRAVITY - drag;

      speed += accel * dt;
      height += speed * dt;

      if (height <= 0) {
        // Either it never left the pad, or it has fallen back to the ground.
        height = 0;
        speed = 0;
        if (launched) {
          done = true;
        }
      } else {
        launched = true;
      }
    }

    samples.push({ t: i * dt, height, speed, fuel });
    if (done) break;
  }

  return samples;
}

/** A ready-made rocket that passes readiness (the shop's). */
export function shopRocket(): Blueprint {
  const parts: Part[] = [
    { kind: 'engine', x: 0, y: 0 },
    { kind: 'tank', x: 0, y: 1 },
    { kind: 'tank', x: 0, y: 2 },
    { kind: 'cabin', x: 0, y: 3 },
    { kind: 'nose', x: 0, y: 4 },
    { kind: 'fin', x: -1, y: 0 },
    { kind: 'fin', x: 1, y: 0 },
    { kind: 'button', x: 1, y: 1 },
  ];
  const wires: Wire[] = [{ from: 7, to: 0 }];
  return { parts, wires };
}