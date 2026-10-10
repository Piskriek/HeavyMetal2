export type Kind = 'dither' | 'fold' | 'chroma' | 'spire';

export const ITEM = {
  dither: 'pxd-mono',
  chroma: 'pxd-chroma',
  fold: 'vtx-rough',
  spire: 'vtx-fine',
} as const;

export const MAX = { dither: 60, fold: 60, chroma: 120, spire: 120 } as const;
export const RATE = { dither: 1.5, fold: 1.5, chroma: 1, spire: 1 } as const;
export const G0 = 1 / 600;
export const CELL = 20;

export interface Node {
  readonly id: number;
  readonly kind: Kind;
  readonly x: number;
  readonly z: number;
  readonly reserve: number;
  readonly carry: number;
}

export interface Field {
  readonly v: 1;
  readonly seed: number;
  readonly time: number;
  readonly nodes: readonly Node[];
}

export interface Stack {
  readonly item: string;
  readonly n: number;
}

export function hash(seed: number, i: number, j: number, k: number): number {
  let h = (seed ^ Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(k, 2147483647)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

function clampStage(stage: number): number {
  if (Number.isNaN(stage)) return 0;
  return Math.floor(Math.min(6, Math.max(0, stage)));
}

export function generate(seed: number, radius: number, stage: number): Field {
  const tier = clampStage(stage);
  const limit = radius - 10;
  const nodes: Node[] = [];

  if (!Number.isFinite(limit) || limit < 0) {
    return { v: 1, seed, time: 0, nodes };
  }

  const low = Math.ceil(-limit / CELL);
  const high = Math.floor(limit / CELL);
  const density = 0.18 + 0.04 * tier;
  const upgradeChance = Math.max(0, (tier - 1) * 0.15);

  for (let ci = low; ci <= high; ci += 1) {
    for (let cj = low; cj <= high; cj += 1) {
      const centerX = ci * CELL;
      const centerZ = cj * CELL;
      if (Math.hypot(centerX, centerZ) > limit) continue;
      if (hash(seed, ci, cj, 0) >= density) continue;

      const isPixel = hash(seed, ci, cj, 3) < 0.5;
      const upgraded = hash(seed, ci, cj, 4) < upgradeChance;
      const kind: Kind = isPixel
        ? upgraded ? 'chroma' : 'dither'
        : upgraded ? 'spire' : 'fold';

      nodes.push({
        id: (ci + 1000) * 2001 + (cj + 1000),
        kind,
        x: centerX + (hash(seed, ci, cj, 1) - 0.5) * 12,
        z: centerZ + (hash(seed, ci, cj, 2) - 0.5) * 12,
        reserve: MAX[kind],
        carry: 0,
      });
    }
  }

  nodes.sort((a, b) => a.id - b.id);
  return { v: 1, seed, time: 0, nodes };
}

export function regen(field: Field, radius: number, stage: number): Field {
  const generated = generate(field.seed, radius, stage);
  const nodes = generated.nodes.map((node): Node => {
    const previous = field.nodes.find((candidate) => candidate.id === node.id);
    if (previous === undefined) return node;

    return {
      ...node,
      reserve: (previous.reserve / MAX[previous.kind]) * MAX[node.kind],
      carry: previous.carry,
    };
  });

  return { ...generated, time: field.time, nodes };
}

export function advance(
  field: Field,
  dt: number,
  stage: number,
  beam: { readonly id: number; readonly power: number } | null,
): { readonly field: Field; readonly items: readonly Stack[] } {
  if (!Number.isFinite(dt) || dt <= 0) {
    return { field, items: [] };
  }

  const tier = clampStage(stage);
  const target = beam === null
    ? undefined
    : field.nodes.find((node) => node.id === beam.id);
  const power = beam === null || Number.isNaN(beam.power)
    ? 0
    : Math.max(0, Math.min(4, beam.power));
  const growth = G0 * (1 + tier / 2);
  const nodes: Node[] = [];
  const items: Stack[] = [];

  for (const node of field.nodes) {
    const maximum = MAX[node.kind];

    if (target !== undefined && node.id === target.id) {
      const rate = RATE[node.kind] * power;
      const remaining = Math.max(
        0,
        (node.reserve + maximum) * Math.exp((-rate * dt) / (2 * maximum)) - maximum,
      );
      const harvested = node.reserve - remaining;
      const count = Math.floor(node.carry + harvested + 1e-9);
      const rawCarry = node.carry + harvested - count;
      const carry = Math.max(0, Math.min(1 - Number.EPSILON / 2, rawCarry));

      nodes.push({ ...node, reserve: remaining, carry });
      if (count > 0) items.push({ item: ITEM[node.kind], n: count });
    } else {
      const reserve = maximum - (maximum - node.reserve) * Math.exp(-growth * dt);
      nodes.push({ ...node, reserve });
    }
  }

  return {
    field: { ...field, time: field.time + dt, nodes },
    items,
  };
}
