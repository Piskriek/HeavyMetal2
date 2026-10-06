// From a world's progress to what the renderer may spend, and a texture graph rewritten to fit it.
import type { TexGraph, TexNode } from "@hm/texgraph";
import type { DeviceProfile, FidelityState, RenderBudget, TexelSize } from "./types";
import { TEXEL_LADDER } from "./types";
import { fidelityIndex, normalised, stageOf } from "./metrics";

const DEVICE_LIST: DeviceProfile[] = [
  { id: "potato", label: "Potato", maxTexel: 64, msBudget: 16.6, allowNormal: false, allowWarp: false, maxOctaves: 3 },
  { id: "low", label: "Low", maxTexel: 128, msBudget: 16.6, allowNormal: true, allowWarp: true, maxOctaves: 4 },
  { id: "medium", label: "Medium", maxTexel: 256, msBudget: 16.6, allowNormal: true, allowWarp: true, maxOctaves: 5 },
  { id: "high", label: "High", maxTexel: 512, msBudget: 16.6, allowNormal: true, allowWarp: true, maxOctaves: 6 },
  { id: "ultra", label: "Ultra", maxTexel: 512, msBudget: 16.6, allowNormal: true, allowWarp: true, maxOctaves: 6 },
];

/** The game's graphics tiers as budgets (ids match @hm/game's Quality). Low is the minimum spec, the owner's laptop. */
export const DEVICES: readonly DeviceProfile[] = Object.freeze(DEVICE_LIST);

/** The budget profile for a graphics tier id; unknown ids get Low, the minimum spec. */
export function deviceFor(tier: string): DeviceProfile {
  return DEVICES.find((d) => d.id === tier) ?? DEVICES[1]!;
}

/**
 * FidelityState to RenderBudget: pxd sets texel size, octaves and palette; vtx the relief; lx the shading;
 * aq the wetness. The tier only clamps (and says so in `demoted`); it never changes the stage, so progress
 * is the same on every machine.
 */
export function deriveBudget(s: FidelityState, dev: DeviceProfile): RenderBudget {
  const n = normalised(s);
  const stage = stageOf(fidelityIndex(s));
  const demoted: string[] = [];

  const wantIndex = Math.round(n.pxd * 5);
  const capIndex = TEXEL_LADDER.indexOf(dev.maxTexel);
  let sizeIndex = wantIndex;
  if (capIndex >= 0 && sizeIndex > capIndex) {
    demoted.push(`texel ${TEXEL_LADDER[wantIndex]} to ${dev.maxTexel}`);
    sizeIndex = capIndex;
  }

  let octaves = 1 + Math.floor(n.pxd * 5);
  if (octaves > dev.maxOctaves) {
    demoted.push(`octaves ${octaves} to ${dev.maxOctaves}`);
    octaves = dev.maxOctaves;
  }

  const normal = n.lx > 0.18 && dev.allowNormal;
  if (n.lx > 0.18 && !dev.allowNormal) demoted.push("normal maps off: lit by vertex");
  const allowWarp = n.pxd > 0.3 && dev.allowWarp;
  if (n.pxd > 0.3 && !dev.allowWarp) demoted.push("domain warp off");
  const allowCellular = n.vtx > 0.22 || dev.maxTexel >= 128;
  if (!allowCellular) demoted.push("cellular drawn as noise");

  return {
    stage,
    size: TEXEL_LADDER[Math.max(0, sizeIndex)] as TexelSize,
    octaveBudget: octaves,
    relief: 0.15 + n.vtx * 1.55,
    normal,
    roughness: n.lx > 0.1,
    paletteLevels: n.pxd < 0.12 ? -1 : n.pxd < 0.3 ? 3 : n.pxd < 0.5 ? 6 : n.pxd < 0.72 ? 16 : 0,
    shadowCascades: Math.min(4, Math.floor(n.lx * 5)),
    allowWarp,
    allowCellular,
    wetness: Math.max(0, (n.aq - 0.22) / 0.78),
    demoted,
  };
}

/** The evaluateGraph options for a budget (relief is per texture size, as @hm/texgraph expects). */
export function toEvaluateOptions(b: RenderBudget, seed: number): { size: number; seed: number; relief: number } {
  return { size: b.size, seed, relief: b.relief * b.size * 0.1 };
}

/** The fields of a texgraph node that name another node. */
export const EDGE_KEYS = ["in", "warp", "a", "b", "mask"] as const;

/** Whether a node gives colour (follows pass-through nodes back to where the colour comes from). */
export function isColourNode(byId: ReadonlyMap<string, TexNode>, id: string | undefined, depth = 0): boolean {
  const node = id === undefined ? undefined : byId.get(id);
  if (!node || depth > 32) return false;
  if (node.type === "ramp") return true;
  if (node.type === "constant") return Array.isArray(node.value);
  if (node.type === "warp" || node.type === "invert" || node.type === "scaleBias") return isColourNode(byId, node.in as string, depth + 1);
  if (node.type === "blend") return isColourNode(byId, node.a as string, depth + 1);
  return false;
}

/**
 * Rewrites a texture graph to fit a budget, so one cartridge draws as a 2-bit palette at stage 1 and full
 * PBR at stage 6: noise octaves clamped; ramps hard (palette) at low pxd and smooth at full colour; cellular
 * drawn as cheap noise when not allowed; warps skipped when not allowed (their users read the warp's input);
 * curl warps plain below 64 texels; and the water's wetness laid over the albedo.
 */
export function adaptGraph(g: TexGraph, b: RenderBudget): TexGraph {
  const keep = new Map<string, TexNode>();
  const alias = new Map<string, string>();

  for (const n of g.nodes) {
    const c: TexNode = { ...n };

    if (c.type === "noise" && typeof c.octaves === "number") c.octaves = Math.max(1, Math.min(c.octaves, b.octaveBudget));

    if (c.type === "ramp") c.interpolation = b.paletteLevels === -1 ? "constant" : b.paletteLevels === 0 ? "smooth" : "linear";

    if (c.type === "cellular" && !b.allowCellular) {
      // the substitute obeys the octave budget too (the Arena drop gave it a fixed 2: a bug its own test caught)
      keep.set(c.id, {
        id: c.id, type: "noise", scale: typeof c.scale === "number" ? c.scale : 6,
        octaves: Math.min(2, b.octaveBudget), gain: 0.5, seed: typeof c.seed === "number" ? c.seed : 0,
      });
      continue;
    }

    if (c.type === "warp") {
      if (!b.allowWarp && typeof c.in === "string") {
        alias.set(c.id, c.in);
        continue;
      }
      if (c.curl === true && b.size <= 32) c.curl = false;
    }

    keep.set(c.id, c);
  }

  const resolve = (id: string | undefined): string | undefined => {
    let current = id;
    for (let i = 0; i < 16 && current !== undefined && alias.has(current); i++) current = alias.get(current);
    return current;
  };

  const nodes: TexNode[] = [];
  for (const n of keep.values()) {
    const c: TexNode = { ...n };
    for (const k of EDGE_KEYS) if (typeof c[k] === "string") c[k] = resolve(c[k] as string);
    nodes.push(c);
  }

  const out: TexGraph["out"] = {};
  const albedo = resolve(g.out.albedo), height = resolve(g.out.height), roughness = b.roughness ? resolve(g.out.roughness) : undefined;
  if (albedo !== undefined) out.albedo = albedo;
  if (height !== undefined) out.height = height;
  if (roughness !== undefined) out.roughness = roughness;

  const byId = new Map(nodes.map((n) => [n.id, n]));
  if (b.wetness > 0.01 && out.albedo !== undefined && isColourNode(byId, out.albedo)) {
    const wet: TexNode = { id: "__wet_mix", type: "blend", a: out.albedo, b: "__wet_src", mode: "multiply", amount: Math.min(0.75, b.wetness * 0.8) };
    nodes.push({ id: "__wet_src", type: "constant", value: [0.07, 0.3, 0.42] });
    if (out.height !== undefined) {
      // low ground is wetter
      nodes.push({ id: "__wet_mask", type: "invert", in: out.height });
      wet.mask = "__wet_mask";
    }
    nodes.push(wet);
    out.albedo = "__wet_mix";
    if (out.roughness !== undefined) {
      nodes.push({
        id: "__wet_rough", type: "levels", in: out.roughness,
        inLow: 0, inHigh: 1, gamma: 1, outLow: 0, outHigh: Math.max(0.12, 1 - b.wetness * 0.8),
      });
      out.roughness = "__wet_rough";
    }
  }

  return { id: `${g.id}@s${b.stage}`, name: g.name, nodes, out };
}
