export type PartKind = 'nose' | 'cabin' | 'tank' | 'engine' | 'fin' | 'hull' | 'button';

export interface PartDef {
  kind: PartKind;
  mass: number;
  fuel?: number;
  thrust?: number;
  burn?: number;
}

export const PARTS: Readonly<Record<PartKind, PartDef>> = {
  nose: { kind: 'nose', mass: 50 },
  cabin: { kind: 'cabin', mass: 300 },
  tank: { kind: 'tank', mass: 100, fuel: 900 },
  engine: { kind: 'engine', mass: 250, thrust: 60000, burn: 30 },
  fin: { kind: 'fin', mass: 20 },
  hull: { kind: 'hull', mass: 80 },
  button: { kind: 'button', mass: 1 },
};

export interface Part { kind: PartKind; x: number; y: number }
export interface Wire { from: number; to: number }
export interface Blueprint { parts: Part[]; wires: Wire[] }

const cell = (x: number, y: number): string => `${x},${y}`;

export function readiness(b: Blueprint): string[] {
  const problems: string[] = [];
  const parts = b.parts;
  const count = (kind: PartKind): number =>
    parts.filter((part) => part.kind === kind).length;

  if (count('cabin') !== 1) problems.push('A rocket needs exactly one cabin.');
  if (count('engine') < 1) problems.push('A rocket needs at least one engine.');
  if (count('tank') < 1) problems.push('A rocket needs at least one tank.');

  const occupied = new Map<string, number>();
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!;
    if (!Number.isInteger(part.x) || !Number.isInteger(part.y)) {
      problems.push(`Part ${i} must occupy a grid cell.`);
    }
    const key = cell(part.x, part.y);
    if (occupied.has(key)) problems.push(`Parts overlap at ${key}.`);
    else occupied.set(key, i);
  }

  if (parts.length > 0) {
    const seen = new Set<number>([0]);
    const queue = [0];
    for (let head = 0; head < queue.length; head++) {
      const part = parts[queue[head]!]!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const neighbor = occupied.get(cell(part.x + dx!, part.y + dy!));
        if (neighbor !== undefined && !seen.has(neighbor)) {
          seen.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
    if (seen.size !== parts.length) {
      problems.push('All parts must form one connected rocket.');
    }
  }

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!;
    if (part.kind !== 'engine') continue;
    if (parts.some((other) => other.x === part.x && other.y < part.y)) {
      problems.push(`Engine ${i} must be at the bottom of its column.`);
    }
    if (!b.wires.some((wire) => wire.to === i && parts[wire.from]?.kind === 'button')) {
      problems.push(`Engine ${i} needs a launch button wire.`);
    }
  }

  const highest = Math.max(...parts.map((part) => part.y));
  if (!parts.some((part) => part.kind === 'nose' && part.y === highest)) {
    problems.push('A nose must top the highest column.');
  }

  const n = numbers(b);
  if (!(n.thrust > n.mass * 9.8)) {
    problems.push('Thrust must exceed launch weight.');
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

  for (const part of b.parts) {
    const def = PARTS[part.kind];
    dryMass += def.mass;
    fuel += def.fuel ?? 0;
    if (part.kind === 'engine') {
      thrust += def.thrust ?? 0;
      burn += def.burn ?? 0;
    }
  }

  const mass = dryMass + fuel;
  return {
    dryMass,
    fuel,
    mass,
    thrust,
    burn,
    twr: mass > 0 ? thrust / (mass * 9.8) : 0,
    burnTime: burn > 0 ? fuel / burn : 0,
    deltaV: burn > 0 && dryMass > 0
      ? (thrust / burn) * Math.log(mass / dryMass)
      : 0,
  };
}

export interface Flight { t: number; height: number; speed: number; fuel: number }

export function launch(b: Blueprint, seconds: number, dt: number): Flight[] {
  if (!Number.isFinite(seconds) || seconds < 0 || !Number.isFinite(dt) || dt <= 0) {
    throw new RangeError('seconds must be nonnegative and dt must be positive and finite.');
  }

  const n = numbers(b);
  let t = 0;
  let height = 0;
  let speed = 0;
  let fuel = n.fuel;
  let leftGround = false;
  const samples: Flight[] = [{ t, height, speed, fuel }];

  while (t < seconds) {
    const step = Math.min(dt, seconds - t);
    const burned = n.burn > 0 ? Math.min(fuel, n.burn * step) : 0;
    const poweredFraction = n.burn > 0 ? burned / (n.burn * step) : 0;
    const mass = n.dryMass + fuel - burned / 2;
    const drag = 0.0005 * speed * Math.abs(speed);
    const acceleration = mass > 0
      ? n.thrust * poweredFraction / mass - 9.8 - drag
      : -9.8 - drag;

    speed += acceleration * step;
    height += speed * step;
    fuel -= burned;
    t = Math.min(seconds, t + step);

    if (height > 0) leftGround = true;
    if (leftGround && height <= 0) height = 0;
    samples.push({ t, height, speed, fuel });
    if (leftGround && height === 0) break;
  }

  return samples;
}

export function shopRocket(): Blueprint {
  return {
    parts: [
      { kind: 'engine', x: 0, y: 0 },
      { kind: 'tank', x: 0, y: 1 },
      { kind: 'cabin', x: 0, y: 2 },
      { kind: 'nose', x: 0, y: 3 },
      { kind: 'button', x: 1, y: 2 },
    ],
    wires: [{ from: 4, to: 0 }],
  };
}