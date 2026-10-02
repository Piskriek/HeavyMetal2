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
type Value = number | Color;
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

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function wrap01(value: number): number {
  const wrapped = value - Math.floor(value);
  return wrapped >= 1 ? 0 : wrapped;
}

function modInt(value: number, period: number): number {
  const result = value % period;
  return result < 0 ? result + period : result;
}

function fade(value: number): number {
  return value * value * value * (value * (value * 6 - 15) + 10);
}

function lerp(a: number, b: number, amount: number): number {
  return a + (b - a) * amount;
}

function hash2(x: number, y: number, seed: number): number {
  let h = Math.imul((x | 0) ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (y | 0), 0xc2b2ae35);
  h = Math.imul(h ^ (Math.trunc(seed) | 0), 0x27d4eb2d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return (h >>> 0) / 4294967295;
}

function valueNoise(
  u: number,
  v: number,
  scale: number,
  octaves: number,
  gain: number,
  seed: number,
): number {
  let amplitude = 1;
  let total = 0;
  let normalizer = 0;

  for (let octave = 0; octave < octaves; octave += 1) {
    const period = scale * 2 ** octave;
    const px = u * period;
    const py = v * period;
    const ix = Math.floor(px);
    const iy = Math.floor(py);
    const tx = fade(px - ix);
    const ty = fade(py - iy);

    const x0 = modInt(ix, period);
    const x1 = modInt(ix + 1, period);
    const y0 = modInt(iy, period);
    const y1 = modInt(iy + 1, period);

    const top = lerp(
      hash2(x0, y0, seed + octave * 1013),
      hash2(x1, y0, seed + octave * 1013),
      tx,
    );
    const bottom = lerp(
      hash2(x0, y1, seed + octave * 1013),
      hash2(x1, y1, seed + octave * 1013),
      tx,
    );

    total += lerp(top, bottom, ty) * amplitude;
    normalizer += amplitude;
    amplitude *= gain;
  }

  return normalizer === 0 ? 0 : clamp01(total / normalizer);
}

function cellularNoise(
  u: number,
  v: number,
  scale: number,
  jitter: number,
  mode: "f1" | "f2" | "edge",
  seed: number,
): number {
  const px = u * scale;
  const py = v * scale;
  const baseX = Math.floor(px);
  const baseY = Math.floor(py);
  const localX = px - baseX;
  const localY = py - baseY;
  let first = Number.POSITIVE_INFINITY;
  let second = Number.POSITIVE_INFINITY;

  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const cellX = modInt(baseX + dx, scale);
      const cellY = modInt(baseY + dy, scale);
      const randomX = hash2(cellX, cellY, seed + 17);
      const randomY = hash2(cellX, cellY, seed + 53);
      const featureX = 0.5 + (randomX - 0.5) * jitter;
      const featureY = 0.5 + (randomY - 0.5) * jitter;
      const distanceX = dx + featureX - localX;
      const distanceY = dy + featureY - localY;
      const distance = Math.hypot(distanceX, distanceY);

      if (distance < first) {
        second = first;
        first = distance;
      } else if (distance < second) {
        second = distance;
      }
    }
  }

  if (mode === "f1") {
    return clamp01(1 - first / Math.SQRT2);
  }

  if (mode === "f2") {
    return clamp01(1 - second / Math.SQRT2);
  }

  return clamp01(((second - first) / Math.SQRT2) * 1.5);
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
    const inHigh = checkedNumber(node, "inHigh", errors, 0, 1);
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

function asScalar(value: Value): number {
  if (typeof value === "number") {
    return value;
  }
  return (value[0] + value[1] + value[2]) / 3;
}

function mapValue(value: Value, mapper: (channel: number) => number): Value {
  if (typeof value === "number") {
    return clamp01(mapper(value));
  }

  return [
    clamp01(mapper(value[0])),
    clamp01(mapper(value[1])),
    clamp01(mapper(value[2])),
  ];
}

function blendChannel(
  a: number,
  b: number,
  amount: number,
  mode: string,
): number {
  let target: number;

  if (mode === "add") {
    target = a + b;
  } else if (mode === "multiply") {
    target = a * b;
  } else if (mode === "min") {
    target = Math.min(a, b);
  } else if (mode === "max") {
    target = Math.max(a, b);
  } else if (mode === "overlay") {
    target = a < 0.5
      ? 2 * a * b
      : 1 - 2 * (1 - a) * (1 - b);
  } else {
    target = b;
  }

  return clamp01(lerp(a, target, amount));
}

function blendValue(
  a: Value,
  b: Value,
  amount: number,
  mode: string,
): Value {
  if (typeof a === "number" && typeof b === "number") {
    return blendChannel(a, b, amount, mode);
  }

  const colorA = a as Color;
  const colorB = b as Color;

  return [
    blendChannel(colorA[0], colorB[0], amount, mode),
    blendChannel(colorA[1], colorB[1], amount, mode),
    blendChannel(colorA[2], colorB[2], amount, mode),
  ];
}

function stopColor(stop: NodeRecord): Color {
  return [
    clamp01(Number(stop.r)),
    clamp01(Number(stop.g)),
    clamp01(Number(stop.b)),
  ];
}

export function evaluateGraph(
  graph: TexGraph,
  opts?: { size?: number; seed?: number },
): {
  size: number;
  albedo?: Float32Array;
  height?: Float32Array;
  normal?: Float32Array;
  roughness?: Float32Array;
} {
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

  const nodeMap = new Map<string, TexNode>(
    graph.nodes.map((node) => [node.id, node]),
  );

  const nodeSeed = (node: TexNode): number => {
    const seed = typeof node.seed === "number" ? Math.trunc(node.seed) : 0;
    return seed + Math.trunc(optionSeed);
  };

  const sample = (
    id: string,
    u: number,
    v: number,
    cache: Map<string, Value>,
  ): Value => {
    const uu = wrap01(u);
    const vv = wrap01(v);
    const key = `${id}|${uu}|${vv}`;
    const cached = cache.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const node = nodeMap.get(id);
    if (!node) {
      throw new Error(`Cannot evaluate missing node '${id}'`);
    }

    const params = node as NodeRecord;
    let result: Value;

    switch (node.type) {
      case "noise":
        result = valueNoise(
          uu,
          vv,
          Number(params.scale),
          Number(params.octaves),
          Number(params.gain),
          nodeSeed(node),
        );
        break;

      case "cellular":
        result = cellularNoise(
          uu,
          vv,
          Number(params.scale),
          Number(params.jitter),
          params.mode as "f1" | "f2" | "edge",
          nodeSeed(node),
        );
        break;

      case "grain": {
        const period = Math.max(1, size - 1);
        const x = size === 1 ? 0 : modInt(Math.floor(uu * size), period);
        const y = size === 1 ? 0 : modInt(Math.floor(vv * size), period);
        result = hash2(x, y, nodeSeed(node));
        break;
      }

      case "stripes": {
        const coordinate = params.vertical ? uu : vv;
        const phase = wrap01(coordinate * Number(params.count));
        const hard = phase < 0.5 ? 1 : 0;
        const soft = 0.5 + 0.5 * Math.cos(phase * Math.PI * 2);
        const softness = Number(params.softness);
        result = clamp01(lerp(hard, soft, softness));
        break;
      }

      case "checker": {
        const x = Math.floor(uu * Number(params.countX));
        const y = Math.floor(vv * Number(params.countY));
        result = (x + y) % 2 === 0 ? 1 : 0;
        break;
      }

      case "constant": {
        if (isColorValue(params.value)) {
          result = [
            clamp01(params.value[0]),
            clamp01(params.value[1]),
            clamp01(params.value[2]),
          ];
        } else {
          result = clamp01(Number(params.value));
        }
        break;
      }

      case "warp": {
        const warpValue = asScalar(
          sample(String(params.warp), uu, vv, cache),
        );
        const offset = Number(params.amount) * (warpValue - 0.5);
        result = sample(
          String(params.in),
          uu + offset,
          vv + offset,
          cache,
        );
        break;
      }

      case "blend": {
        const a = sample(String(params.a), uu, vv, cache);
        const b = sample(String(params.b), uu, vv, cache);
        const mask =
          params.mask === undefined
            ? 1
            : clamp01(asScalar(sample(String(params.mask), uu, vv, cache)));
        result = blendValue(
          a,
          b,
          Number(params.amount) * mask,
          String(params.mode),
        );
        break;
      }

      case "levels": {
        const input = asScalar(sample(String(params.in), uu, vv, cache));
        const low = Number(params.inLow);
        const high = Number(params.inHigh);
        const gamma = Number(params.gamma);
        const t = clamp01((input - low) / (high - low));
        const adjusted = Math.pow(t, gamma);
        result = clamp01(
          Number(params.outLow) +
            adjusted * (Number(params.outHigh) - Number(params.outLow)),
        );
        break;
      }

      case "invert":
        result = mapValue(
          sample(String(params.in), uu, vv, cache),
          (value) => 1 - value,
        );
        break;

      case "ramp": {
        const input = clamp01(asScalar(sample(String(params.in), uu, vv, cache)));
        const stops = params.stops as unknown[];
        const first = stops[0] as NodeRecord;
        const last = stops[stops.length - 1] as NodeRecord;

        if (input <= Number(first.at)) {
          result = stopColor(first);
          break;
        }

        if (input >= Number(last.at)) {
          result = stopColor(last);
          break;
        }

        let lower = first;
        let upper = last;

        for (let index = 1; index < stops.length; index += 1) {
          const candidate = stops[index] as NodeRecord;
          if (input <= Number(candidate.at)) {
            lower = stops[index - 1] as NodeRecord;
            upper = candidate;
            break;
          }
        }

        const range = Number(upper.at) - Number(lower.at);
        const amount =
          range === 0
            ? 0
            : (input - Number(lower.at)) / range;
        const lowerColor = stopColor(lower);
        const upperColor = stopColor(upper);

        result = [
          clamp01(lerp(lowerColor[0], upperColor[0], amount)),
          clamp01(lerp(lowerColor[1], upperColor[1], amount)),
          clamp01(lerp(lowerColor[2], upperColor[2], amount)),
        ];
        break;
      }

      case "scaleBias":
        result = mapValue(
          sample(String(params.in), uu, vv, cache),
          (value) => value * Number(params.scale) + Number(params.bias),
        );
        break;

      default:
        throw new Error(`Cannot evaluate unknown node type '${node.type}'`);
    }

    cache.set(key, result);
    return result;
  };

  const render = (id: string, channels: 1 | 3): Float32Array => {
    const data = new Float32Array(size * size * channels);

    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const u = (x + 0.5) / size;
        const v = (y + 0.5) / size;
        const value = sample(id, u, v, new Map());
        const offset = (y * size + x) * channels;

        if (channels === 1) {
          data[offset] = clamp01(asScalar(value));
        } else if (typeof value === "number") {
          const scalar = clamp01(value);
          data[offset] = scalar;
          data[offset + 1] = scalar;
          data[offset + 2] = scalar;
        } else {
          data[offset] = clamp01(value[0]);
          data[offset + 1] = clamp01(value[1]);
          data[offset + 2] = clamp01(value[2]);
        }
      }
    }

    return data;
  };

  const result: {
    size: number;
    albedo?: Float32Array;
    height?: Float32Array;
    normal?: Float32Array;
    roughness?: Float32Array;
  } = { size };

  if (graph.out.albedo !== undefined) {
    result.albedo = render(graph.out.albedo, 3);
  }

  if (graph.out.height !== undefined) {
    result.height = render(graph.out.height, 1);
    result.normal = new Float32Array(size * size * 2);

    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const left = ((y * size + (x + size - 1) % size));
        const right = ((y * size + (x + 1) % size));
        const up = ((((y + size - 1) % size) * size + x));
        const down = ((((y + 1) % size) * size + x));

        const dx = (result.height![right]! - result.height![left]!) * 0.5;
        const dy = (result.height![down]! - result.height![up]!) * 0.5;
        const nx = -dx;
        const ny = -dy;
        const nz = 1;
        const inverseLength = 1 / Math.hypot(nx, ny, nz);
        const offset = (y * size + x) * 2;

        result.normal[offset] = clamp01(0.5 + 0.5 * nx * inverseLength);
        result.normal[offset + 1] = clamp01(0.5 + 0.5 * ny * inverseLength);
      }
    }
  }

  if (graph.out.roughness !== undefined) {
    result.roughness = render(graph.out.roughness, 1);
  }

  return result;
}

export function channelStats(
  data: Float32Array,
  size: number,
  channels = 1,
): { mean: number[]; std: number[]; seam: number } {
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

  return {
    mean,
    std: variance,
    seam: seamSamples === 0 ? 0 : seamTotal / seamSamples,
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