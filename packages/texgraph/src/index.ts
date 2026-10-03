export interface TexNode {
  id: string;
  type: string;
  [param: string]: unknown;
}

export interface TexGraph {
  id: string;
  name: string;
  nodes: TexNode[];
  out: {
    albedo?: string;
    height?: string;
    roughness?: string;
  };
}

type ValueType = "scalar" | "colour";
type Color = [number, number, number];
type NodeRecord = Record<string, unknown>;

const NODE_TYPES = new Set([
  "noise",
  "cellular",
  "grain",
  "stripes",
  "checker",
  "constant",
  "warp",
  "blend",
  "levels",
  "invert",
  "ramp",
  "scaleBias",
]);

function isRecord(value: unknown): value is NodeRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isColorValue(value: unknown): value is [number, number, number] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((channel) => isFiniteNumber(channel))
  );
}

/*
 * The evaluator works on whole images (one Float32Array per node), which is what makes it fast enough to run in the game.
 * Conventions (the ones the stylised set from the Arena agents was authored against, docs/prompts/arena-pbr-textures.md):
 * - u = (x + 0.5) / size, v = (y + 0.5) / size; v grows downward (image rows); everything wraps at the tile edge.
 * - noise: tileable value noise, quintic fade; octave o has period scale * 2^o, seed + 101 o and weight gain^o, normalised by the weights.
 * - cellular: one point per cell at its centre + (hash - 0.5) * jitter, 3 x 3 search, raw distances in cell units clamped to 1
 *   (f1 is 0 at a cell's point and grows outwards); edge = f2 - f1.
 * - stripes: 0.5 + 0.5 sin(2 pi count t), t = u when vertical; softness below 1 sharpens it with a smoothstep of width softness / 2.
 * - warp: u' = u + (w(u, v) - 0.5) amount, v' = v + (w(u + 0.37, v + 0.21) - 0.5) amount, sampled bilinearly.
 * - blend: lerp(a, op(a, b), amount * mask); overlay = a < 0.5 ? 2ab : 1 - 2(1 - a)(1 - b).
 * - levels: t = clamp((x - inLow) / (inHigh - inLow)), t^gamma, lerp(outLow, outHigh, t).
 * Only the outputs are clamped to 0..1; values in between may leave it (a scaleBias above 1 then a levels brings them back).
 */
function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function fade(value: number): number {
  return value * value * value * (value * (value * 6 - 15) + 10);
}

function hash2(x: number, y: number, seed: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  h = Math.imul(h, 2246822519);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

function noiseImage(size: number, scale: number, octaves: number, gain: number, seed: number): Float32Array {
  const out = new Float32Array(size * size);
  const xa = new Int32Array(size), xb = new Int32Array(size), tx = new Float32Array(size);
  let amplitude = 1, norm = 0, period = Math.max(1, Math.round(scale));
  const count = Math.max(1, Math.min(6, Math.round(octaves || 1)));
  for (let octave = 0; octave < count; octave += 1) {
    const lattice = new Float32Array(period * period);
    const octaveSeed = (seed | 0) + octave * 101;
    for (let j = 0; j < period; j += 1) for (let i = 0; i < period; i += 1) lattice[j * period + i] = hash2(i, j, octaveSeed);
    for (let x = 0; x < size; x += 1) {
      const f = ((x + 0.5) / size) * period, i0 = Math.floor(f);
      xa[x] = i0 % period; xb[x] = (i0 + 1) % period; tx[x] = fade(f - i0);
    }
    for (let y = 0; y < size; y += 1) {
      const f = ((y + 0.5) / size) * period, j0 = Math.floor(f);
      const ya = (j0 % period) * period, yb = ((j0 + 1) % period) * period, ty = fade(f - j0);
      for (let x = 0; x < size; x += 1) {
        const a = lattice[ya + xa[x]!]!, b = lattice[ya + xb[x]!]!, c = lattice[yb + xa[x]!]!, d = lattice[yb + xb[x]!]!;
        const top = a + (b - a) * tx[x]!, bottom = c + (d - c) * tx[x]!;
        out[y * size + x]! += (top + (bottom - top) * ty) * amplitude;
      }
    }
    norm += amplitude;
    amplitude *= gain;
    period *= 2;
  }
  for (let i = 0; i < out.length; i += 1) out[i] = norm > 0 ? out[i]! / norm : 0;
  return out;
}

function cellularImage(size: number, scale: number, jitter: number, mode: string, seed: number): Float32Array {
  const cells = Math.max(1, Math.round(scale)), spread = clamp01(jitter);
  const px = new Float32Array(cells * cells), py = new Float32Array(cells * cells);
  for (let j = 0; j < cells; j += 1) for (let i = 0; i < cells; i += 1) {
    px[j * cells + i] = 0.5 + (hash2(i, j, seed) - 0.5) * spread;
    py[j * cells + i] = 0.5 + (hash2(i, j, (seed | 0) + 7919) - 0.5) * spread;
  }
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y += 1) {
    const fy = ((y + 0.5) / size) * cells, yi = Math.floor(fy);
    for (let x = 0; x < size; x += 1) {
      const fx = ((x + 0.5) / size) * cells, xi = Math.floor(fx);
      let f1 = 1e9, f2 = 1e9;
      for (let dy = -1; dy <= 1; dy += 1) {
        const cy = yi + dy, wy = ((cy % cells) + cells) % cells;
        for (let dx = -1; dx <= 1; dx += 1) {
          const cx = xi + dx, wx = ((cx % cells) + cells) % cells, k = wy * cells + wx;
          const ax = cx + px[k]! - fx, ay = cy + py[k]! - fy, d = Math.sqrt(ax * ax + ay * ay);
          if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
        }
      }
      const v = mode === "f2" ? f2 : mode === "edge" ? f2 - f1 : f1;
      out[y * size + x] = v > 1 ? 1 : v;
    }
  }
  return out;
}

function stripesImage(size: number, count: number, softness: number, vertical: boolean): Float32Array {
  const bands = Math.max(1, Math.round(count)), soft = clamp01(softness), width = Math.max(0.0025, soft * 0.5);
  const line = new Float32Array(size);
  for (let i = 0; i < size; i += 1) {
    const s = 0.5 + 0.5 * Math.sin(Math.PI * 2 * ((i + 0.5) / size) * bands);
    if (soft >= 0.999) line[i] = s;
    else { const k = clamp01((s - (0.5 - width)) / (2 * width)); line[i] = k * k * (3 - 2 * k); }
  }
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) out[y * size + x] = vertical ? line[x]! : line[y]!;
  return out;
}

/** Bilinear, wrapping sample of an image with `channels` channels at pixel position (sx, sy), written to out[at..]. */
function sampleInto(image: Float32Array, size: number, channels: number, sx: number, sy: number, out: Float32Array, at: number): void {
  let x0 = Math.floor(sx), y0 = Math.floor(sy);
  const tx = sx - x0, ty = sy - y0;
  x0 = ((x0 % size) + size) % size; y0 = ((y0 % size) + size) % size;
  const x1 = (x0 + 1) % size, y1 = (y0 + 1) % size;
  for (let c = 0; c < channels; c += 1) {
    const a = image[(y0 * size + x0) * channels + c]!, b = image[(y0 * size + x1) * channels + c]!;
    const d = image[(y1 * size + x0) * channels + c]!, e = image[(y1 * size + x1) * channels + c]!;
    out[at + c] = (a + (b - a) * tx) * (1 - ty) + (d + (e - d) * tx) * ty;
  }
}

/** A ramp as a 2048-step lookup (stops sorted by `at`; equal stops make a hard step). */
function rampTable(stops: readonly NodeRecord[]): Float32Array {
  const sorted = stops.slice().sort((p, q) => Number(p.at) - Number(q.at));
  const steps = 2048, table = new Float32Array(steps * 3);
  const colour = (s: NodeRecord): Color => [Number(s.r), Number(s.g), Number(s.b)];
  for (let j = 0; j < steps; j += 1) {
    const x = j / (steps - 1);
    let c: Color;
    if (!sorted.length) c = [0, 0, 0];
    else if (x <= Number(sorted[0]!.at)) c = colour(sorted[0]!);
    else if (x >= Number(sorted[sorted.length - 1]!.at)) c = colour(sorted[sorted.length - 1]!);
    else {
      let i = 0;
      while (i < sorted.length - 1 && Number(sorted[i + 1]!.at) < x) i += 1;
      const a = sorted[i]!, b = sorted[i + 1]!, span = Number(b.at) - Number(a.at), t = span <= 0 ? 1 : (x - Number(a.at)) / span;
      const ca = colour(a), cb = colour(b);
      c = [ca[0] + (cb[0] - ca[0]) * t, ca[1] + (cb[1] - ca[1]) * t, ca[2] + (cb[2] - ca[2]) * t];
    }
    table[j * 3] = c[0]; table[j * 3 + 1] = c[1]; table[j * 3 + 2] = c[2];
  }
  return table;
}


function referencesFor(node: NodeRecord): string[] {
  const type = typeof node.type === "string" ? node.type : "";

  if (type === "warp") {
    return ["in", "warp"];
  }

  if (type === "blend") {
    const refs = ["a", "b"];
    if (node.mask !== undefined) {
      refs.push("mask");
    }
    return refs;
  }

  if (type === "levels" || type === "invert" || type === "ramp" || type === "scaleBias") {
    return ["in"];
  }

  return [];
}

function checkedNumber(
  node: NodeRecord,
  field: string,
  errors: string[],
  min?: number,
  max?: number,
  integer = false,
): boolean {
  const value = node[field];

  if (!isFiniteNumber(value)) {
    errors.push(
      `node '${String(node.id)}': '${String(node.type)}' parameter '${field}' must be a finite number`,
    );
    return false;
  }

  if (integer && !Number.isInteger(value)) {
    errors.push(
      `node '${String(node.id)}': '${String(node.type)}' parameter '${field}' must be an integer`,
    );
    return false;
  }

  if (min !== undefined && value < min) {
    errors.push(
      `node '${String(node.id)}': '${String(node.type)}' parameter '${field}' must be at least ${min}`,
    );
    return false;
  }

  if (max !== undefined && value > max) {
    errors.push(
      `node '${String(node.id)}': '${String(node.type)}' parameter '${field}' must be at most ${max}`,
    );
    return false;
  }

  return true;
}

function checkNodeParameters(node: NodeRecord, errors: string[]): void {
  const type = node.type;
  const id = String(node.id);

  if (type === "noise") {
    checkedNumber(node, "scale", errors, 1, 64, true);
    checkedNumber(node, "octaves", errors, 1, 6, true);
    checkedNumber(node, "gain", errors, 0, 1);
    checkedNumber(node, "seed", errors);
    return;
  }

  if (type === "cellular") {
    checkedNumber(node, "scale", errors, 1, undefined, true);
    checkedNumber(node, "jitter", errors, 0, 1);
    checkedNumber(node, "seed", errors);

    if (node.mode !== "f1" && node.mode !== "f2" && node.mode !== "edge") {
      errors.push(
        `node '${id}': 'cellular' parameter 'mode' must be 'f1', 'f2', or 'edge'`,
      );
    }
    return;
  }

  if (type === "grain") {
    checkedNumber(node, "seed", errors);
    return;
  }

  if (type === "stripes") {
    checkedNumber(node, "count", errors, 1, undefined, true);
    checkedNumber(node, "softness", errors, 0, 1);

    if (typeof node.vertical !== "boolean") {
      errors.push(`node '${id}': 'stripes' parameter 'vertical' must be boolean`);
    }
    return;
  }

  if (type === "checker") {
    checkedNumber(node, "countX", errors, 1, undefined, true);
    checkedNumber(node, "countY", errors, 1, undefined, true);
    return;
  }

  if (type === "constant") {
    if (isFiniteNumber(node.value)) {
      if (node.value < 0 || node.value > 1) {
        errors.push(`node '${id}': 'constant' value must be between 0 and 1`);
      }
      return;
    }

    if (isColorValue(node.value)) {
      if (node.value.some((channel) => channel < 0 || channel > 1)) {
        errors.push(`node '${id}': 'constant' colour channels must be between 0 and 1`);
      }
      return;
    }

    errors.push(
      `node '${id}': 'constant' parameter 'value' must be a number or an RGB array`,
    );
    return;
  }

  if (type === "warp") {
    checkedNumber(node, "amount", errors, 0, 0.3);
    return;
  }

  if (type === "blend") {
    checkedNumber(node, "amount", errors, 0, 1);

    if (
      node.mode !== "mix" &&
      node.mode !== "add" &&
      node.mode !== "multiply" &&
      node.mode !== "min" &&
      node.mode !== "max" &&
      node.mode !== "overlay"
    ) {
      errors.push(
        `node '${id}': 'blend' parameter 'mode' must be 'mix', 'add', 'multiply', 'min', 'max', or 'overlay'`,
      );
    }
    return;
  }

  if (type === "levels") {
    const inLow = checkedNumber(node, "inLow", errors, 0, 1);
    // above 1 is allowed: it softens the contrast (the evaluator clamps the result)
    const inHigh = checkedNumber(node, "inHigh", errors, 0, 2);
    checkedNumber(node, "gamma", errors, 0.000001);
    checkedNumber(node, "outLow", errors, 0, 1);
    checkedNumber(node, "outHigh", errors, 0, 1);

    if (inLow && inHigh && Number(node.inLow) >= Number(node.inHigh)) {
      errors.push(`node '${id}': 'levels' requires inLow to be less than inHigh`);
    }
    return;
  }

  if (type === "ramp") {
    if (!Array.isArray(node.stops) || node.stops.length < 2) {
      errors.push(`node '${id}': 'ramp' requires at least two stops`);
      return;
    }

    let previousAt = -Infinity;

    node.stops.forEach((rawStop, index) => {
      if (!isRecord(rawStop)) {
        errors.push(`node '${id}': 'ramp' stop ${index} must be an object`);
        return;
      }

      const at = rawStop.at;
      const channels = [rawStop.r, rawStop.g, rawStop.b];

      if (!isFiniteNumber(at) || at < 0 || at > 1) {
        errors.push(`node '${id}': 'ramp' stop ${index} at must be between 0 and 1`);
      } else {
        if (at < previousAt) {
          errors.push(`node '${id}': 'ramp' stops must be sorted by at`);
        }
        previousAt = at;
      }

      for (const channel of channels) {
        if (!isFiniteNumber(channel) || channel < 0 || channel > 1) {
          errors.push(
            `node '${id}': 'ramp' stop ${index} colour channels must be between 0 and 1`,
          );
          break;
        }
      }
    });
    return;
  }

  if (type === "scaleBias") {
    checkedNumber(node, "scale", errors);
    checkedNumber(node, "bias", errors);
  }
}

export function validateGraph(g: unknown): { ok: boolean; errors: string[] } {
  try {
    const errors: string[] = [];

    if (!isRecord(g)) {
      return { ok: false, errors: ["graph must be an object"] };
    }

    if (typeof g.id !== "string" || g.id.length === 0) {
      errors.push("graph id must be a non-empty string");
    }

    if (typeof g.name !== "string") {
      errors.push("graph name must be a string");
    }

    const nodeMap = new Map<string, NodeRecord>();
    const rawNodes = g.nodes;

    if (!Array.isArray(rawNodes)) {
      errors.push("graph nodes must be an array");
    } else {
      rawNodes.forEach((rawNode, index) => {
        if (!isRecord(rawNode)) {
          errors.push(`node at index ${index} must be an object`);
          return;
        }

        const id = rawNode.id;
        const label = typeof id === "string" ? id : `at index ${index}`;

        if (typeof id !== "string" || id.length === 0) {
          errors.push(`node ${label} must have a non-empty string id`);
        } else if (nodeMap.has(id)) {
          errors.push(`node '${id}' has a duplicate id`);
        } else {
          nodeMap.set(id, rawNode);
        }

        if (typeof rawNode.type !== "string") {
          errors.push(`node '${label}' must have a string type`);
        } else if (!NODE_TYPES.has(rawNode.type)) {
          errors.push(`node '${label}': unknown node type '${rawNode.type}'`);
        } else {
          checkNodeParameters(rawNode, errors);
        }
      });
    }

    if (Array.isArray(rawNodes)) {
      for (const node of nodeMap.values()) {
        const type = typeof node.type === "string" ? node.type : "";
        for (const field of referencesFor(node)) {
          const value = node[field];
          const optional = type === "blend" && field === "mask";

          if (value === undefined && optional) {
            continue;
          }

          if (typeof value !== "string") {
            errors.push(
              `node '${String(node.id)}': '${type}' field '${field}' must be a node id`,
            );
          } else if (!nodeMap.has(value)) {
            errors.push(
              `node '${String(node.id)}': '${type}' refers to '${value}' which does not exist`,
            );
          }
        }
      }
    }

    const state = new Map<string, "active" | "done">();

    const visit = (id: string): void => {
      const currentState = state.get(id);
      if (currentState === "active") {
        errors.push(`cycle detected involving node '${id}'`);
        return;
      }
      if (currentState === "done") {
        return;
      }

      state.set(id, "active");
      const node = nodeMap.get(id);
      if (node) {
        for (const field of referencesFor(node)) {
          const reference = node[field];
          if (typeof reference === "string" && nodeMap.has(reference)) {
            visit(reference);
          }
        }
      }
      state.set(id, "done");
    };

    for (const id of nodeMap.keys()) {
      visit(id);
    }

    const inferred = new Map<string, ValueType | undefined>();
    const typeStack = new Set<string>();

    const inferType = (id: string): ValueType | undefined => {
      if (inferred.has(id)) {
        return inferred.get(id);
      }

      if (typeStack.has(id)) {
        return undefined;
      }

      const node = nodeMap.get(id);
      if (!node) {
        return undefined;
      }

      typeStack.add(id);
      const type = node.type;
      let result: ValueType | undefined;

      if (type === "noise" || type === "cellular" || type === "grain") {
        result = "scalar";
      } else if (type === "stripes" || type === "checker") {
        result = "scalar";
      } else if (type === "constant") {
        result = isColorValue(node.value)
          ? "colour"
          : isFiniteNumber(node.value)
            ? "scalar"
            : undefined;
      } else if (type === "warp") {
        result = typeof node.in === "string" ? inferType(node.in) : undefined;
      } else if (type === "blend") {
        const aType = typeof node.a === "string" ? inferType(node.a) : undefined;
        const bType = typeof node.b === "string" ? inferType(node.b) : undefined;
        result = aType && bType && aType === bType ? aType : undefined;
      } else if (type === "levels") {
        result = "scalar";
      } else if (type === "invert") {
        result = typeof node.in === "string" ? inferType(node.in) : undefined;
      } else if (type === "ramp") {
        result = "colour";
      } else if (type === "scaleBias") {
        result = typeof node.in === "string" ? inferType(node.in) : undefined;
      }

      typeStack.delete(id);
      inferred.set(id, result);
      return result;
    };

    const expectScalar = (node: NodeRecord, field: string): void => {
      const reference = node[field];
      if (typeof reference !== "string") {
        return;
      }
      const actual = inferType(reference);
      if (actual && actual !== "scalar") {
        errors.push(
          `node '${String(node.id)}': '${String(node.type)}' expects '${field}' to be scalar but it refers to a colour node`,
        );
      }
    };

    for (const node of nodeMap.values()) {
      const type = node.type;

      if (type === "warp") {
        expectScalar(node, "warp");
      } else if (type === "blend") {
        expectScalar(node, "mask");

        const aType =
          typeof node.a === "string" ? inferType(node.a) : undefined;
        const bType =
          typeof node.b === "string" ? inferType(node.b) : undefined;

        if (aType && bType && aType !== bType) {
          errors.push(
            `node '${String(node.id)}': 'blend' requires 'a' and 'b' to have the same type`,
          );
        }
      } else if (type === "levels" || type === "ramp") {
        expectScalar(node, "in");
      }
    }

    const out = g.out;
    const outputKeys = ["albedo", "height", "roughness"] as const;
    let outputCount = 0;

    if (!isRecord(out)) {
      errors.push("graph out must be an object");
    } else {
      for (const key of outputKeys) {
        const value = out[key];
        if (value === undefined) {
          continue;
        }

        outputCount += 1;

        if (typeof value !== "string") {
          errors.push(`output '${key}' must refer to a node id`);
          continue;
        }

        if (!nodeMap.has(value)) {
          errors.push(`output '${key}' refers to '${value}' which does not exist`);
          continue;
        }

        const outputType = inferType(value);
        if ((key === "height" || key === "roughness") && outputType === "colour") {
          errors.push(`output '${key}' must refer to a scalar node`);
        }
      }
    }

    if (outputCount === 0) {
      errors.push("graph must define at least one output");
    }

    return { ok: errors.length === 0, errors };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, errors: [`could not validate graph: ${message}`] };
  }
}

/** One evaluated node: a scalar image (size * size) or a colour image (size * size * 3). */
interface Image { readonly colour: boolean; readonly data: Float32Array }

export interface EvaluateOptions {
  /** Pixels across the tile (default 64). */
  size?: number;
  /** Added to every node's seed: the same graph with a different look. */
  seed?: number;
  /**
   * How steep the normal is: height units to pixel widths. 1 is very gentle. The game's stylised relief is 0.3 m of height on a 3 m ground tile
   * (size * 0.1) and 0.1 m on a 0.5 m voxel face (size * 0.2).
   */
  relief?: number;
}

export interface EvaluatedTexture {
  size: number;
  /** Linear colour, 3 per pixel. */
  albedo?: Float32Array;
  height?: Float32Array;
  /** The tangent-space normal from the height: x and y at 0.5 + 0.5 n, 2 per pixel (z is rebuilt from them). */
  normal?: Float32Array;
  roughness?: Float32Array;
}

export function evaluateGraph(graph: TexGraph, opts?: EvaluateOptions): EvaluatedTexture {
  const validation = validateGraph(graph);
  if (!validation.ok) {
    throw new Error(
      `Invalid texture graph:\n${validation.errors.map((error) => `- ${error}`).join("\n")}`,
    );
  }

  const size = opts?.size ?? 64;
  if (!Number.isInteger(size) || size < 1) {
    throw new Error("Texture size must be a positive integer");
  }

  const optionSeed = opts?.seed ?? 0;
  if (!Number.isFinite(optionSeed)) {
    throw new Error("Evaluation seed must be a finite number");
  }

  const count = size * size;
  const nodeMap = new Map<string, TexNode>(graph.nodes.map((node) => [node.id, node]));
  const memo = new Map<string, Image>();
  const nodeSeed = (node: TexNode): number =>
    (typeof node.seed === "number" ? Math.trunc(node.seed) : 0) + Math.trunc(optionSeed);
  const num = (params: NodeRecord, key: string, fallback: number): number => {
    const value = params[key];
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  };
  const scalarOf = (image: Image): Float32Array => {
    if (!image.colour) return image.data;
    const out = new Float32Array(count);
    for (let i = 0; i < count; i += 1) out[i] = (image.data[i * 3]! + image.data[i * 3 + 1]! + image.data[i * 3 + 2]!) / 3;
    return out;
  };
  const colourOf = (image: Image): Float32Array => {
    if (image.colour) return image.data;
    const out = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) out[i * 3] = out[i * 3 + 1] = out[i * 3 + 2] = image.data[i]!;
    return out;
  };

  const get = (id: string): Image => {
    const hit = memo.get(id);
    if (hit) return hit;
    const node = nodeMap.get(id);
    if (!node) throw new Error(`Cannot evaluate missing node '${id}'`);
    const params = node as NodeRecord;
    let result: Image;

    switch (node.type) {
      case "noise":
        result = { colour: false, data: noiseImage(size, num(params, "scale", 1), num(params, "octaves", 1), num(params, "gain", 0.5), nodeSeed(node)) };
        break;

      case "cellular":
        result = { colour: false, data: cellularImage(size, num(params, "scale", 1), num(params, "jitter", 0.8), String(params.mode), nodeSeed(node)) };
        break;

      case "grain": {
        const data = new Float32Array(count);
        const seed = nodeSeed(node);
        for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) data[y * size + x] = hash2(x, y, seed);
        result = { colour: false, data };
        break;
      }

      case "stripes":
        result = { colour: false, data: stripesImage(size, num(params, "count", 1), num(params, "softness", 1), params.vertical === true) };
        break;

      case "checker": {
        const data = new Float32Array(count);
        const cx = Math.max(1, Math.round(num(params, "countX", 1))), cy = Math.max(1, Math.round(num(params, "countY", 1)));
        for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
          data[y * size + x] = (Math.floor(((x + 0.5) / size) * cx) + Math.floor(((y + 0.5) / size) * cy)) & 1;
        }
        result = { colour: false, data };
        break;
      }

      case "constant": {
        if (isColorValue(params.value)) {
          const data = new Float32Array(count * 3);
          const [r, g, b] = params.value;
          for (let i = 0; i < count; i += 1) { data[i * 3] = r; data[i * 3 + 1] = g; data[i * 3 + 2] = b; }
          result = { colour: true, data };
        } else {
          result = { colour: false, data: new Float32Array(count).fill(Number(params.value)) };
        }
        break;
      }

      case "warp": {
        const source = get(String(params.in));
        const field = scalarOf(get(String(params.warp)));
        const amount = Math.min(0.15, Math.max(0, num(params, "amount", 0))) * size;
        const ox = Math.floor(size * 0.37), oy = Math.floor(size * 0.21);
        const channels = source.colour ? 3 : 1;
        const data = new Float32Array(count * channels);
        for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
          const i = y * size + x;
          const w1 = field[i]!, w2 = field[((y + oy) % size) * size + ((x + ox) % size)]!;
          sampleInto(source.data, size, channels, x + (w1 - 0.5) * amount, y + (w2 - 0.5) * amount, data, i * channels);
        }
        result = { colour: source.colour, data };
        break;
      }

      case "blend": {
        const first = get(String(params.a));
        const colour = first.colour;
        const a = colour ? colourOf(first) : first.data;
        const second = get(String(params.b));
        const b = colour ? colourOf(second) : scalarOf(second);
        const mask = params.mask === undefined ? null : scalarOf(get(String(params.mask)));
        const amount = clamp01(num(params, "amount", 0.5));
        const mode = String(params.mode);
        const op =
          mode === "add" ? (x: number, y: number) => x + y
          : mode === "multiply" ? (x: number, y: number) => x * y
          : mode === "min" ? (x: number, y: number) => (x < y ? x : y)
          : mode === "max" ? (x: number, y: number) => (x > y ? x : y)
          : mode === "overlay" ? (x: number, y: number) => (x < 0.5 ? 2 * x * y : 1 - 2 * (1 - x) * (1 - y))
          : (_x: number, y: number) => y;
        const channels = colour ? 3 : 1;
        const data = new Float32Array(count * channels);
        for (let i = 0; i < count; i += 1) {
          const t = mask ? amount * clamp01(mask[i]!) : amount;
          for (let c = 0; c < channels; c += 1) {
            const k = i * channels + c, x = a[k]!;
            data[k] = x + (op(x, b[k]!) - x) * t;
          }
        }
        result = { colour, data };
        break;
      }

      case "levels": {
        const input = scalarOf(get(String(params.in)));
        const low = num(params, "inLow", 0), high = num(params, "inHigh", 1), gamma = num(params, "gamma", 1);
        const outLow = num(params, "outLow", 0), outHigh = num(params, "outHigh", 1), span = high - low;
        const data = new Float32Array(count);
        for (let i = 0; i < count; i += 1) {
          let t = span === 0 ? (input[i]! >= high ? 1 : 0) : clamp01((input[i]! - low) / span);
          if (gamma !== 1) t = Math.pow(t, gamma);
          data[i] = outLow + (outHigh - outLow) * t;
        }
        result = { colour: false, data };
        break;
      }

      case "invert": {
        const input = get(String(params.in));
        const data = new Float32Array(input.data.length);
        for (let i = 0; i < data.length; i += 1) data[i] = 1 - input.data[i]!;
        result = { colour: input.colour, data };
        break;
      }

      case "ramp": {
        const input = scalarOf(get(String(params.in)));
        const table = rampTable(params.stops as NodeRecord[]);
        const data = new Float32Array(count * 3);
        for (let i = 0; i < count; i += 1) {
          const j = Math.round(clamp01(input[i]!) * 2047) * 3;
          data[i * 3] = table[j]!; data[i * 3 + 1] = table[j + 1]!; data[i * 3 + 2] = table[j + 2]!;
        }
        result = { colour: true, data };
        break;
      }

      case "scaleBias": {
        const input = get(String(params.in));
        const scale = num(params, "scale", 1), bias = num(params, "bias", 0);
        const data = new Float32Array(input.data.length);
        for (let i = 0; i < data.length; i += 1) data[i] = input.data[i]! * scale + bias;
        result = { colour: input.colour, data };
        break;
      }

      default:
        throw new Error(`Cannot evaluate unknown node type '${node.type}'`);
    }

    memo.set(id, result);
    return result;
  };

  const result: EvaluatedTexture = { size };

  if (graph.out.albedo !== undefined) {
    const colour = colourOf(get(graph.out.albedo));
    result.albedo = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i += 1) result.albedo[i] = clamp01(colour[i]!);
  }

  if (graph.out.height !== undefined) {
    const height = scalarOf(get(graph.out.height));
    result.height = new Float32Array(count);
    for (let i = 0; i < count; i += 1) result.height[i] = clamp01(height[i]!);
    result.normal = normalFromHeight(result.height, size, opts?.relief ?? 1);
  }

  if (graph.out.roughness !== undefined) {
    const roughness = scalarOf(get(graph.out.roughness));
    result.roughness = new Float32Array(count);
    for (let i = 0; i < count; i += 1) result.roughness[i] = clamp01(roughness[i]!);
  }

  return result;
}

/** The tangent-space normal of a wrapping height image (x and y at 0.5 + 0.5 n; rows grow downward, so a rise down the image tips y negative). */
export function normalFromHeight(height: Float32Array, size: number, relief = 1): Float32Array {
  const normal = new Float32Array(size * size * 2);
  for (let y = 0; y < size; y += 1) {
    const up = ((y + size - 1) % size) * size, down = ((y + 1) % size) * size, row = y * size;
    for (let x = 0; x < size; x += 1) {
      const left = (x + size - 1) % size, right = (x + 1) % size;
      const dx = (height[row + right]! - height[row + left]!) * 0.5 * relief;
      const dy = (height[down + x]! - height[up + x]!) * 0.5 * relief;
      const inverseLength = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const offset = (row + x) * 2;
      normal[offset] = clamp01(0.5 - 0.5 * dx * inverseLength);
      normal[offset + 1] = clamp01(0.5 - 0.5 * dy * inverseLength);
    }
  }
  return normal;
}


export function channelStats(
  data: Float32Array,
  size: number,
  channels = 1,
): { mean: number[]; std: number[]; seam: number; neighbour: number } {
  if (!Number.isInteger(size) || size < 1) {
    throw new Error("Stats size must be a positive integer");
  }

  if (!Number.isInteger(channels) || channels < 1) {
    throw new Error("Stats channels must be a positive integer");
  }

  const expectedLength = size * size * channels;
  if (data.length !== expectedLength) {
    throw new Error(
      `Stats expected ${expectedLength} values but received ${data.length}`,
    );
  }

  const mean = new Array<number>(channels).fill(0);
  const variance = new Array<number>(channels).fill(0);

  for (let index = 0; index < size * size; index += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      mean[channel]! += data[index * channels + channel]!;
    }
  }

  for (let channel = 0; channel < channels; channel += 1) {
    mean[channel]! /= size * size;
  }

  for (let index = 0; index < size * size; index += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const difference = data[index * channels + channel]! - mean[channel]!;
      variance[channel]! += difference * difference;
    }
  }

  for (let channel = 0; channel < channels; channel += 1) {
    variance[channel] = Math.sqrt(variance[channel]! / (size * size));
  }

  let seamTotal = 0;
  let seamSamples = 0;

  for (let y = 0; y < size; y += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const left = (y * size) * channels + channel;
      const right = (y * size + size - 1) * channels + channel;
      seamTotal += Math.abs(data[left]! - data[right]!);
      seamSamples += 1;
    }
  }

  for (let x = 0; x < size; x += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const top = x * channels + channel;
      const bottom = ((size - 1) * size + x) * channels + channel;
      seamTotal += Math.abs(data[top]! - data[bottom]!);
      seamSamples += 1;
    }
  }

  // the same difference between neighbours inside the tile: a seamless tile's edge differs no more than its inside does
  let insideTotal = 0;
  let insideSamples = 0;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x + 1 < size; x += 1) {
      for (let channel = 0; channel < channels; channel += 1) {
        insideTotal += Math.abs(data[(y * size + x) * channels + channel]! - data[(y * size + x + 1) * channels + channel]!);
        insideSamples += 1;
      }
    }
  }

  for (let y = 0; y + 1 < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      for (let channel = 0; channel < channels; channel += 1) {
        insideTotal += Math.abs(data[(y * size + x) * channels + channel]! - data[((y + 1) * size + x) * channels + channel]!);
        insideSamples += 1;
      }
    }
  }

  return {
    mean,
    std: variance,
    seam: seamSamples === 0 ? 0 : seamTotal / seamSamples,
    neighbour: insideSamples === 0 ? 0 : insideTotal / insideSamples,
  };
}

export const TEXTURE_PRESETS: TexGraph[] = [
  {
    id: "basalt",
    name: "Basalt",
    nodes: [
      {
        id: "cells",
        type: "cellular",
        scale: 2,
        jitter: 0.8,
        mode: "edge",
        seed: 17,
      },
      {
        id: "warpField",
        type: "noise",
        scale: 2,
        octaves: 2,
        gain: 0.5,
        seed: 31,
      },
      {
        id: "warpedCells",
        type: "warp",
        in: "cells",
        warp: "warpField",
        amount: 0.08,
      },
      {
        id: "cracks",
        type: "levels",
        in: "warpedCells",
        inLow: 0.03,
        inHigh: 0.5,
        gamma: 0.8,
        outLow: 0,
        outHigh: 1,
      },
      {
        id: "rock",
        type: "ramp",
        in: "cracks",
        stops: [
          { at: 0, r: 0.045, g: 0.06, b: 0.075 },
          { at: 0.4, r: 0.058, g: 0.073, b: 0.088 },
          { at: 1, r: 0.085, g: 0.1, b: 0.115 },
        ],
      },
      {
        id: "height",
        type: "scaleBias",
        in: "cracks",
        scale: 0.14,
        bias: 0.42,
      },
      {
        id: "roughness",
        type: "scaleBias",
        in: "cracks",
        scale: 0.14,
        bias: 0.78,
      },
    ],
    out: {
      albedo: "rock",
      height: "height",
      roughness: "roughness",
    },
  },
  {
    id: "sand",
    name: "Sand",
    nodes: [
      {
        id: "ripples",
        type: "stripes",
        count: 3,
        vertical: false,
        softness: 0.85,
      },
      {
        id: "sandWarp",
        type: "noise",
        scale: 2,
        octaves: 2,
        gain: 0.5,
        seed: 43,
      },
      {
        id: "warpedRipples",
        type: "warp",
        in: "ripples",
        warp: "sandWarp",
        amount: 0.08,
      },
      {
        id: "grain",
        type: "grain",
        seed: 61,
      },
      {
        id: "rippleColor",
        type: "ramp",
        in: "warpedRipples",
        stops: [
          { at: 0, r: 0.58, g: 0.43, b: 0.25 },
          { at: 0.5, r: 0.7, g: 0.55, b: 0.34 },
          { at: 1, r: 0.8, g: 0.66, b: 0.43 },
        ],
      },
      {
        id: "grainColor",
        type: "ramp",
        in: "grain",
        stops: [
          { at: 0, r: 0.6, g: 0.46, b: 0.28 },
          { at: 1, r: 0.78, g: 0.64, b: 0.42 },
        ],
      },
      {
        id: "sandAlbedo",
        type: "blend",
        a: "rippleColor",
        b: "grainColor",
        mode: "mix",
        amount: 0.3,
      },
      {
        id: "heightMix",
        type: "blend",
        a: "warpedRipples",
        b: "grain",
        mode: "mix",
        amount: 0.35,
      },
      {
        id: "height",
        type: "scaleBias",
        in: "heightMix",
        scale: 0.4,
        bias: 0.25,
      },
      {
        id: "roughness",
        type: "scaleBias",
        in: "grain",
        scale: 0.12,
        bias: 0.48,
      },
    ],
    out: {
      albedo: "sandAlbedo",
      height: "height",
      roughness: "roughness",
    },
  },
  {
    id: "grass",
    name: "Grass",
    nodes: [
      {
        id: "fine",
        type: "noise",
        scale: 4,
        octaves: 2,
        gain: 0.5,
        seed: 71,
      },
      {
        id: "broad",
        type: "noise",
        scale: 2,
        octaves: 2,
        gain: 0.5,
        seed: 83,
      },
      {
        id: "grain",
        type: "grain",
        seed: 97,
      },
      {
        id: "noiseMix",
        type: "blend",
        a: "broad",
        b: "fine",
        mode: "mix",
        amount: 0.55,
      },
      {
        id: "surface",
        type: "blend",
        a: "noiseMix",
        b: "grain",
        mode: "add",
        amount: 0.18,
      },
      {
        id: "green",
        type: "ramp",
        in: "surface",
        stops: [
          { at: 0, r: 0.08, g: 0.2, b: 0.045 },
          { at: 0.5, r: 0.16, g: 0.3, b: 0.075 },
          { at: 1, r: 0.27, g: 0.4, b: 0.11 },
        ],
      },
      {
        id: "height",
        type: "scaleBias",
        in: "surface",
        scale: 0.28,
        bias: 0.3,
      },
      {
        id: "roughness",
        type: "scaleBias",
        in: "broad",
        scale: 0.1,
        bias: 0.58,
      },
    ],
    out: {
      albedo: "green",
      height: "height",
      roughness: "roughness",
    },
  },
];