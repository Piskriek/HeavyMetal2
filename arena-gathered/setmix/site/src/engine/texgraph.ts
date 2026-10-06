/* ============================================================================
   @hm/texgraph — reference implementation, PHASE 3.
   Incorporates the four accepted resolutions from the core team:
     Q2 · EvaluateOptions.bounds  → region-limited partial evaluation
     Q3 · warp.vectorField        → true 2-channel divergence-free curl noise
     Q4 · graphCost()             → promoted to an official engine export
     Q5 · ramp.interpolation      → linear | smooth | constant (2-bit palettes)
   Q1 was resolved by policy: we hash the DAG, never the float buffers.
   ========================================================================== */

export interface TexNode {
  id: string;
  type: string;
  [param: string]: unknown;
}

/** Q3 — accepted spec. */
export interface WarpNode extends TexNode {
  type: "warp";
  input: string;
  vectorField?: string; // 2-channel [dx, dy]; wins over `by` when present
  by?: string; // legacy 1-channel scalar offset
  amount: number;
}

/** Q5 — accepted spec. */
export interface RampNode extends TexNode {
  type: "ramp";
  input: string;
  stops: { t: number; color: [number, number, number] }[];
  interpolation?: "linear" | "smooth" | "constant";
}

/** Divergence-free vector generator: ∇⊥ψ = (∂ψ/∂y, −∂ψ/∂x). */
export interface CurlNode extends TexNode {
  type: "curl";
  potential: string;
  scale?: number;
}

export interface TexGraph {
  id: string;
  name: string;
  nodes: TexNode[];
  out: { albedo?: string; height?: string; roughness?: string };
}

/** Q2 — accepted spec. Pixel-space, half-open [x0,x1) × [y0,y1). */
export interface Bounds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface EvaluateOptions {
  size?: number;
  seed?: number;
  relief?: number;
  normal?: boolean;
  bounds?: Bounds; // evaluate only this sub-region (chunkworld wave fronts)
}

export interface EvaluatedTexture {
  size: number;
  albedo?: Float32Array;
  height?: Float32Array;
  roughness?: Float32Array;
  normal?: Float32Array;
  region?: Bounds; // what was actually written this call
  stats?: { nodes: number; texelsTouched: number; dilationPx: number };
}

/* ----------------------------------------------------------------- field */
type Chan = 1 | 2 | 3;
type Field = { ch: Chan; d: Float32Array };

const num = (n: TexNode, k: string, d: number) =>
  typeof n[k] === "number" ? (n[k] as number) : d;
const str = (n: TexNode, k: string) => (typeof n[k] === "string" ? (n[k] as string) : undefined);
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/* --------------------------------------------------------------- hashing */
function h2(x: number, y: number, s: number) {
  let n = (x * 374761393 + y * 668265263 + s * 1442695040) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
function vnoise(x: number, y: number, s: number) {
  const xi = Math.floor(x),
    yi = Math.floor(y);
  const fx = x - xi,
    fy = y - yi;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = h2(xi, yi, s),
    b = h2(xi + 1, yi, s);
  const c = h2(xi, yi + 1, s),
    e = h2(xi + 1, yi + 1, s);
  return (a + (b - a) * u) * (1 - v) + (c + (e - c) * u) * v;
}

function sample(f: Field, size: number, x: number, y: number, c: number) {
  const sx = x * size - 0.5,
    sy = y * size - 0.5;
  const x0 = Math.floor(sx),
    y0 = Math.floor(sy);
  const tx = sx - x0,
    ty = sy - y0;
  const w = (a: number) => ((a % size) + size) % size;
  const i00 = (w(y0) * size + w(x0)) * f.ch + c;
  const i10 = (w(y0) * size + w(x0 + 1)) * f.ch + c;
  const i01 = (w(y0 + 1) * size + w(x0)) * f.ch + c;
  const i11 = (w(y0 + 1) * size + w(x0 + 1)) * f.ch + c;
  const a = f.d[i00] + (f.d[i10] - f.d[i00]) * tx;
  const b = f.d[i01] + (f.d[i11] - f.d[i01]) * tx;
  return a + (b - a) * ty;
}

const promote = (f: Field, size: number): Field => {
  if (f.ch === 3) return f;
  const d = new Float32Array(size * size * 3);
  for (let i = 0, n = size * size; i < n; i++) {
    const v = f.d[i * f.ch];
    d[i * 3] = d[i * 3 + 1] = d[i * 3 + 2] = v;
  }
  return { ch: 3, d };
};

/* ═══════════════════════════════════════ Q2 · region dilation through DAG */

const rectUnion = (a: Bounds, b: Bounds): Bounds => ({
  x0: Math.min(a.x0, b.x0),
  y0: Math.min(a.y0, b.y0),
  x1: Math.max(a.x1, b.x1),
  y1: Math.max(a.y1, b.y1),
});
const rectDilate = (r: Bounds, px: number, size: number): Bounds => ({
  x0: Math.max(0, r.x0 - px),
  y0: Math.max(0, r.y0 - px),
  x1: Math.min(size, r.x1 + px),
  y1: Math.min(size, r.y1 + px),
});
const rectArea = (r: Bounds) => Math.max(0, r.x1 - r.x0) * Math.max(0, r.y1 - r.y0);

/** A `warp` reads its input at offset coordinates, so a partial evaluation
 *  must grow the requested region as it walks UPSTREAM through warp nodes.
 *  Without this, wave-front re-evaluation produces a visible seam. */
function computeRegions(
  graph: TexGraph,
  byId: Map<string, TexNode>,
  want: Bounds,
  size: number,
): { regions: Map<string, Bounds>; dilation: number } {
  const regions = new Map<string, Bounds>();
  let maxDil = 0;
  const visit = (id: string | undefined, req: Bounds, depth: number) => {
    if (!id || depth > 64) return;
    const n = byId.get(id);
    if (!n) return;
    const prev = regions.get(id);
    const merged = prev ? rectUnion(prev, req) : req;
    if (prev && rectArea(merged) === rectArea(prev)) return; // no growth, prune
    regions.set(id, merged);

    if (n.type === "warp") {
      const px = Math.ceil(Math.abs(num(n, "amount", 0.1)) * size) + 2;
      maxDil = Math.max(maxDil, px);
      const grown = rectDilate(merged, px, size);
      visit(str(n, "input"), grown, depth + 1);
      visit(str(n, "vectorField"), merged, depth + 1);
      visit(str(n, "by"), merged, depth + 1);
      return;
    }
    if (n.type === "curl") {
      // central differences need a 1-texel apron
      visit(str(n, "potential"), rectDilate(merged, 2, size), depth + 1);
      return;
    }
    for (const k of ["input", "a", "b", "by", "mask", "potential"]) {
      const v = str(n, k);
      if (v) visit(v, merged, depth + 1);
    }
  };
  for (const id of [graph.out.albedo, graph.out.height, graph.out.roughness]) visit(id, want, 0);
  return { regions, dilation: maxDil };
}

/* ------------------------------------------------------------- evaluator */
export function evaluateGraph(graph: TexGraph, opts: EvaluateOptions = {}): EvaluatedTexture {
  const size = Math.max(4, Math.min(1024, opts.size ?? 128));
  const seed = opts.seed ?? 0;
  const relief = opts.relief ?? 1;
  const px = size * size;

  const full: Bounds = { x0: 0, y0: 0, x1: size, y1: size };
  const want: Bounds = opts.bounds
    ? {
        x0: Math.max(0, Math.floor(opts.bounds.x0)),
        y0: Math.max(0, Math.floor(opts.bounds.y0)),
        x1: Math.min(size, Math.ceil(opts.bounds.x1)),
        y1: Math.min(size, Math.ceil(opts.bounds.y1)),
      }
    : full;

  const byId = new Map<string, TexNode>();
  for (const n of graph.nodes) byId.set(n.id, n);
  const { regions, dilation } = computeRegions(graph, byId, want, size);

  const memo = new Map<string, Field>();
  const stack = new Set<string>();
  let nodesEvaluated = 0;
  let texelsTouched = 0;

  const ZERO: Field = { ch: 1, d: new Float32Array(px) };
  const regionOf = (id: string) => regions.get(id) ?? want;

  function evalNode(id: string | undefined): Field {
    if (!id) return ZERO;
    const hit = memo.get(id);
    if (hit) return hit;
    const n = byId.get(id);
    if (!n || stack.has(id)) return ZERO;
    stack.add(id);
    const out = run(n, regionOf(id));
    stack.delete(id);
    memo.set(id, out);
    nodesEvaluated++;
    return out;
  }

  function run(n: TexNode, R: Bounds): Field {
    texelsTouched += rectArea(R);
    switch (n.type) {
      /* ---------------- generators ---------------- */
      case "constant": {
        const rgb = n.rgb as number[] | undefined;
        if (Array.isArray(rgb)) {
          const d = new Float32Array(px * 3);
          for (let y = R.y0; y < R.y1; y++)
            for (let x = R.x0; x < R.x1; x++) {
              const i = (y * size + x) * 3;
              d[i] = rgb[0];
              d[i + 1] = rgb[1];
              d[i + 2] = rgb[2];
            }
          return { ch: 3, d };
        }
        const v = num(n, "value", 0.5);
        const d = new Float32Array(px);
        for (let y = R.y0; y < R.y1; y++) for (let x = R.x0; x < R.x1; x++) d[y * size + x] = v;
        return { ch: 1, d };
      }
      case "noise": {
        const freq = num(n, "freq", 4);
        const oct = Math.max(1, Math.round(num(n, "octaves", 4)));
        const lac = num(n, "lacunarity", 2);
        const gain = num(n, "gain", 0.5);
        const s = seed + Math.round(num(n, "seed", 0));
        const d = new Float32Array(px);
        for (let y = R.y0; y < R.y1; y++) {
          for (let x = R.x0; x < R.x1; x++) {
            let amp = 1,
              f = freq,
              sum = 0,
              norm = 0;
            const u = x / size,
              v = y / size;
            for (let o = 0; o < oct; o++) {
              sum += amp * vnoise(u * f, v * f, s + o * 101);
              norm += amp;
              amp *= gain;
              f *= lac;
            }
            d[y * size + x] = sum / norm;
          }
        }
        return { ch: 1, d };
      }
      case "cellular": {
        const freq = Math.max(1, num(n, "freq", 6));
        const jitter = num(n, "jitter", 1);
        const inv = num(n, "invert", 0) > 0.5;
        const s = seed + Math.round(num(n, "seed", 0));
        const d = new Float32Array(px);
        for (let y = R.y0; y < R.y1; y++) {
          for (let x = R.x0; x < R.x1; x++) {
            const u = (x / size) * freq,
              v = (y / size) * freq;
            const cx = Math.floor(u),
              cy = Math.floor(v);
            let best = 9;
            for (let j = -1; j <= 1; j++)
              for (let i = -1; i <= 1; i++) {
                const gx = cx + i,
                  gy = cy + j;
                const ax = gx + 0.5 + (h2(gx, gy, s) - 0.5) * jitter;
                const ay = gy + 0.5 + (h2(gx, gy, s + 7919) - 0.5) * jitter;
                const dd = Math.hypot(u - ax, v - ay);
                if (dd < best) best = dd;
              }
            const val = clamp01(best);
            d[y * size + x] = inv ? 1 - val : val;
          }
        }
        return { ch: 1, d };
      }
      case "grain": {
        const s = seed + Math.round(num(n, "seed", 0));
        const scale = Math.max(1, Math.round(num(n, "scale", 1)));
        const d = new Float32Array(px);
        for (let y = R.y0; y < R.y1; y++)
          for (let x = R.x0; x < R.x1; x++)
            d[y * size + x] = h2(Math.floor(x / scale), Math.floor(y / scale), s);
        return { ch: 1, d };
      }
      case "stripes": {
        const freq = num(n, "freq", 8);
        const ang = (num(n, "angle", 0) * Math.PI) / 180;
        const sharp = clamp01(num(n, "sharpness", 0));
        const ca = Math.cos(ang),
          sa = Math.sin(ang);
        const d = new Float32Array(px);
        for (let y = R.y0; y < R.y1; y++)
          for (let x = R.x0; x < R.x1; x++) {
            const t = ((x / size) * ca + (y / size) * sa) * freq;
            const w = 0.5 + 0.5 * Math.sin(t * Math.PI * 2);
            d[y * size + x] = sharp > 0 ? w * (1 - sharp) + (w > 0.5 ? 1 : 0) * sharp : w;
          }
        return { ch: 1, d };
      }
      case "checker": {
        const freq = Math.max(1, Math.round(num(n, "freq", 8)));
        const d = new Float32Array(px);
        for (let y = R.y0; y < R.y1; y++)
          for (let x = R.x0; x < R.x1; x++)
            d[y * size + x] =
              (Math.floor((x / size) * freq) + Math.floor((y / size) * freq)) % 2 ? 1 : 0;
        return { ch: 1, d };
      }

      /* ------------- Q3 · true curl noise ------------- */
      case "curl": {
        const psi = evalNode(str(n, "potential"));
        const k = num(n, "scale", 1);
        const d = new Float32Array(px * 2);
        const w = (a: number) => ((a % size) + size) % size;
        const g = (x: number, y: number) => psi.d[(w(y) * size + w(x)) * psi.ch];
        for (let y = R.y0; y < R.y1; y++)
          for (let x = R.x0; x < R.x1; x++) {
            const dpdx = (g(x + 1, y) - g(x - 1, y)) * 0.5;
            const dpdy = (g(x, y + 1) - g(x, y - 1)) * 0.5;
            const i = (y * size + x) * 2;
            d[i] = dpdy * k * size * 0.01; // ∂ψ/∂y
            d[i + 1] = -dpdx * k * size * 0.01; // −∂ψ/∂x  ⇒ ∇·v = 0
          }
        return { ch: 2, d };
      }

      /* ---------------- operators ---------------- */
      case "warp": {
        const src = evalNode(str(n, "input"));
        const amt = num(n, "amount", 0.1);
        const vfId = str(n, "vectorField");
        const vf = vfId ? evalNode(vfId) : null;
        const by = !vf ? evalNode(str(n, "by")) : null;
        const d = new Float32Array(px * src.ch);
        for (let y = R.y0; y < R.y1; y++) {
          for (let x = R.x0; x < R.x1; x++) {
            const i = y * size + x;
            let ox: number, oy: number;
            if (vf) {
              // 2-channel signed vector — already centred on zero
              ox = vf.d[i * vf.ch] * amt;
              oy = vf.d[i * vf.ch + (vf.ch > 1 ? 1 : 0)] * amt;
            } else {
              const b = by!;
              ox = (b.d[i * b.ch] - 0.5) * 2 * amt;
              oy = (b.d[i * b.ch + (b.ch === 3 ? 1 : 0)] - 0.5) * 2 * amt;
            }
            const u = x / size + ox,
              v = y / size + oy;
            for (let c = 0; c < src.ch; c++) d[i * src.ch + c] = sample(src, size, u, v, c);
          }
        }
        return { ch: src.ch, d };
      }
      case "blend": {
        let a = evalNode(str(n, "a"));
        let b = evalNode(str(n, "b"));
        const mode = str(n, "mode") ?? "mix";
        const maskId = str(n, "mask");
        const mask = maskId ? evalNode(maskId) : null;
        const fac = clamp01(num(n, "factor", 0.5));
        const ch: Chan = a.ch === 3 || b.ch === 3 ? 3 : 1;
        if (ch === 3) {
          a = promote(a, size);
          b = promote(b, size);
        }
        const d = new Float32Array(px * ch);
        for (let y = R.y0; y < R.y1; y++)
          for (let x = R.x0; x < R.x1; x++) {
            const i = y * size + x;
            const f = mask ? clamp01(mask.d[i * mask.ch] * fac * 2) : fac;
            for (let c = 0; c < ch; c++) {
              const av = a.d[i * ch + c],
                bv = b.d[i * ch + c];
              let r: number;
              switch (mode) {
                case "add":
                  r = av + bv * f;
                  break;
                case "mul":
                  r = av * (1 - f + bv * f);
                  break;
                case "screen":
                  r = 1 - (1 - av) * (1 - bv * f);
                  break;
                case "overlay":
                  r = av < 0.5 ? 2 * av * bv : 1 - 2 * (1 - av) * (1 - bv);
                  r = av + (r - av) * f;
                  break;
                case "min":
                  r = Math.min(av, bv) * f + av * (1 - f);
                  break;
                case "max":
                  r = Math.max(av, bv) * f + av * (1 - f);
                  break;
                default:
                  r = av + (bv - av) * f;
              }
              d[i * ch + c] = r;
            }
          }
        return { ch, d };
      }
      case "levels": {
        const src = evalNode(str(n, "input"));
        const iL = num(n, "inLow", 0),
          iH = num(n, "inHigh", 1);
        const oL = num(n, "outLow", 0),
          oH = num(n, "outHigh", 1);
        const g = Math.max(0.01, num(n, "gamma", 1));
        const span = Math.abs(iH - iL) < 1e-5 ? 1e-5 : iH - iL;
        const d = new Float32Array(px * src.ch);
        for (let y = R.y0; y < R.y1; y++)
          for (let x = R.x0; x < R.x1; x++)
            for (let c = 0; c < src.ch; c++) {
              const i = (y * size + x) * src.ch + c;
              d[i] = oL + Math.pow(clamp01((src.d[i] - iL) / span), 1 / g) * (oH - oL);
            }
        return { ch: src.ch, d };
      }
      case "invert": {
        const src = evalNode(str(n, "input"));
        const d = new Float32Array(px * src.ch);
        for (let y = R.y0; y < R.y1; y++)
          for (let x = R.x0; x < R.x1; x++)
            for (let c = 0; c < src.ch; c++) {
              const i = (y * size + x) * src.ch + c;
              d[i] = 1 - src.d[i];
            }
        return { ch: src.ch, d };
      }
      case "scaleBias": {
        const src = evalNode(str(n, "input"));
        const s = num(n, "scale", 1),
          b = num(n, "bias", 0);
        const d = new Float32Array(px * src.ch);
        for (let y = R.y0; y < R.y1; y++)
          for (let x = R.x0; x < R.x1; x++)
            for (let c = 0; c < src.ch; c++) {
              const i = (y * size + x) * src.ch + c;
              d[i] = src.d[i] * s + b;
            }
        return { ch: src.ch, d };
      }

      /* ------------- Q5 · ramp interpolation modes ------------- */
      case "ramp": {
        const src = evalNode(str(n, "input"));
        const mode = (str(n, "interpolation") ?? "linear") as RampNode["interpolation"];
        const stops = (n.stops as { t: number; color: number[] }[] | undefined) ?? [
          { t: 0, color: [0, 0, 0] },
          { t: 1, color: [1, 1, 1] },
        ];
        const S = [...stops].sort((p, q) => p.t - q.t);
        const d = new Float32Array(px * 3);
        for (let y = R.y0; y < R.y1; y++)
          for (let x = R.x0; x < R.x1; x++) {
            const i = y * size + x;
            const v = clamp01(src.d[i * src.ch]);
            let lo = S[0],
              hi = S[S.length - 1];
            for (let k = 0; k < S.length - 1; k++)
              if (v >= S[k].t && v <= S[k + 1].t) {
                lo = S[k];
                hi = S[k + 1];
                break;
              }
            let f = clamp01((v - lo.t) / (hi.t - lo.t || 1));
            if (mode === "smooth") f = f * f * (3 - 2 * f);
            else if (mode === "constant") f = 0; // hard palette step — Stage 1
            d[i * 3] = lo.color[0] + (hi.color[0] - lo.color[0]) * f;
            d[i * 3 + 1] = lo.color[1] + (hi.color[1] - lo.color[1]) * f;
            d[i * 3 + 2] = lo.color[2] + (hi.color[2] - lo.color[2]) * f;
          }
        return { ch: 3, d };
      }
      default:
        return ZERO;
    }
  }

  const out: EvaluatedTexture = { size, region: want };

  if (graph.out.albedo) out.albedo = promote(evalNode(graph.out.albedo), size).d;
  if (graph.out.height) {
    const f = evalNode(graph.out.height);
    out.height = f.ch === 1 ? f.d : lum(f, px);
  }
  if (graph.out.roughness) {
    const f = evalNode(graph.out.roughness);
    out.roughness = f.ch === 1 ? f.d : lum(f, px);
  }
  if (opts.normal && out.height) out.normal = heightToNormal(out.height, size, relief, want);

  out.stats = { nodes: nodesEvaluated, texelsTouched, dilationPx: dilation };
  return out;
}

function lum(f: Field, px: number) {
  const d = new Float32Array(px);
  for (let i = 0; i < px; i++) {
    if (f.ch === 3)
      d[i] = f.d[i * 3] * 0.299 + f.d[i * 3 + 1] * 0.587 + f.d[i * 3 + 2] * 0.114;
    else d[i] = f.d[i * f.ch];
  }
  return d;
}

export function heightToNormal(h: Float32Array, size: number, relief: number, R?: Bounds) {
  const n = new Float32Array(size * size * 2);
  const r = R ?? { x0: 0, y0: 0, x1: size, y1: size };
  const w = (a: number) => ((a % size) + size) % size;
  for (let y = r.y0; y < r.y1; y++)
    for (let x = r.x0; x < r.x1; x++) {
      const l = h[y * size + w(x - 1)],
        rt = h[y * size + w(x + 1)];
      const u = h[w(y - 1) * size + x],
        d = h[w(y + 1) * size + x];
      const i = (y * size + x) * 2;
      n[i] = (l - rt) * relief * size * 0.02;
      n[i + 1] = (u - d) * relief * size * 0.02;
    }
  return n;
}

/* ------------------------------------------------------------ tileBytes */
export function tileBytes(t: EvaluatedTexture): { colour: Uint8Array; maps: Uint8Array } {
  const px = t.size * t.size;
  const colour = new Uint8Array(px * 3);
  const maps = new Uint8Array(px * 4);
  for (let i = 0; i < px; i++) {
    if (t.albedo) {
      colour[i * 3] = clamp01(t.albedo[i * 3]) * 255;
      colour[i * 3 + 1] = clamp01(t.albedo[i * 3 + 1]) * 255;
      colour[i * 3 + 2] = clamp01(t.albedo[i * 3 + 2]) * 255;
    }
    maps[i * 4] = t.height ? clamp01(t.height[i]) * 255 : 128;
    maps[i * 4 + 1] = t.roughness ? clamp01(t.roughness[i]) * 255 : 200;
    maps[i * 4 + 2] = t.normal ? clamp01(t.normal[i * 2] * 0.5 + 0.5) * 255 : 128;
    maps[i * 4 + 3] = t.normal ? clamp01(t.normal[i * 2 + 1] * 0.5 + 0.5) * 255 : 128;
  }
  return { colour, maps };
}

/* ----------------------------------------------------------- litPreview */
export function litPreview(
  t: EvaluatedTexture,
  light: [number, number, number] = [-0.5, -0.65, 0.58],
  ambient = 0.28,
): Uint8ClampedArray {
  const px = t.size * t.size;
  const o = new Uint8ClampedArray(px * 4);
  const ll = Math.hypot(light[0], light[1], light[2]) || 1;
  const L = [light[0] / ll, light[1] / ll, light[2] / ll];
  for (let i = 0; i < px; i++) {
    const nx = t.normal ? t.normal[i * 2] : 0;
    const ny = t.normal ? t.normal[i * 2 + 1] : 0;
    const nz = Math.sqrt(Math.max(0.02, 1 - nx * nx - ny * ny));
    const ndl = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
    const rough = t.roughness ? t.roughness[i] : 0.8;
    const hvz = nz + L[2];
    const hl = Math.hypot(nx + L[0], ny + L[1], hvz) || 1;
    const nh = Math.max(0, (nx * (nx + L[0]) + ny * (ny + L[1]) + nz * hvz) / hl);
    const spec = Math.pow(nh, 2 + (1 - rough) * 120) * (1 - rough) * 1.4;
    const sh = ambient + ndl * 0.95;
    for (let c = 0; c < 3; c++) {
      const a = t.albedo ? t.albedo[i * 3 + c] : 0.6;
      o[i * 4 + c] = (a * sh + spec) * 255;
    }
    o[i * 4 + 3] = 255;
  }
  return o;
}

/* ═══════════════════════ Q4 · official engine cost heuristic ═══════════ */
export const NODE_WEIGHT: Record<string, number> = {
  constant: 1,
  checker: 1,
  grain: 1,
  stripes: 2,
  invert: 1,
  scaleBias: 1,
  levels: 2,
  blend: 2,
  ramp: 3,
  curl: 5,
  warp: 4,
  cellular: 9,
  noise: 1, // + octaves
};

export function graphCost(g: TexGraph, size: number, bounds?: Bounds) {
  let weight = 0;
  for (const n of g.nodes) {
    const base = NODE_WEIGHT[n.type] ?? 1;
    weight +=
      n.type === "noise"
        ? base + Math.max(1, Math.round((n.octaves as number) ?? 4))
        : base;
  }
  const texels = bounds
    ? Math.max(0, bounds.x1 - bounds.x0) * Math.max(0, bounds.y1 - bounds.y0)
    : size * size;
  return { weight, texels, evalMs: (weight * texels) / 2.6e6 };
}

export const nodeTypes = [
  "noise",
  "cellular",
  "grain",
  "stripes",
  "checker",
  "constant",
  "warp",
  "curl",
  "blend",
  "levels",
  "invert",
  "ramp",
  "scaleBias",
] as const;
