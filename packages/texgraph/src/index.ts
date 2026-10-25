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
  "scratches",
  "spots",
  "hex",
  "weave",
  "blur",
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
 *   An optional integer tilt leans them: t = count u + tilt v (vertical) or count v + tilt u, still seamless (SetMix vault, 2026-10-06).
 * - warp: u' = u + (w(u, v) - 0.5) amount, v' = v + (w(u + 0.37, v + 0.21) - 0.5) amount, sampled bilinearly.
 *   With curl: true the offset is the field's gradient turned a quarter (dw/dv, -dw/du), scaled so its largest offset is amount / 2
 *   like the plain warp: a swirl that never bunches up or thins out (divergence free).
 * - ramp: interpolation 'linear' (the default), 'smooth' (a smoothstep between stops) or 'constant' (the nearest stop: a hard palette
 *   in which every stop shows).
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

function noiseImage(size: number, scaleX: number, octaves: number, gain: number, seed: number, scaleY?: number): Float32Array {
  const out = new Float32Array(size * size);
  const xa = new Int32Array(size), xb = new Int32Array(size), tx = new Float32Array(size);
  let amplitude = 1, norm = 0;
  let periodX = Math.max(1, Math.round(scaleX));
  let periodY = Math.max(1, Math.round(scaleY !== undefined ? scaleY : scaleX));
  const count = Math.max(1, Math.min(6, Math.round(octaves || 1)));
  for (let octave = 0; octave < count; octave += 1) {
    const lattice = new Float32Array(periodX * periodY);
    const octaveSeed = (seed | 0) + octave * 101;
    for (let j = 0; j < periodY; j += 1) for (let i = 0; i < periodX; i += 1) lattice[j * periodX + i] = hash2(i, j, octaveSeed);
    for (let x = 0; x < size; x += 1) {
      const f = ((x + 0.5) / size) * periodX, i0 = Math.floor(f);
      xa[x] = i0 % periodX; xb[x] = (i0 + 1) % periodX; tx[x] = fade(f - i0);
    }
    for (let y = 0; y < size; y += 1) {
      const f = ((y + 0.5) / size) * periodY, j0 = Math.floor(f);
      const ya = (j0 % periodY) * periodX, yb = ((j0 + 1) % periodY) * periodX, ty = fade(f - j0);
      for (let x = 0; x < size; x += 1) {
        const a = lattice[ya + xa[x]!]!, b = lattice[ya + xb[x]!]!, c = lattice[yb + xa[x]!]!, d = lattice[yb + xb[x]!]!;
        const top = a + (b - a) * tx[x]!, bottom = c + (d - c) * tx[x]!;
        out[y * size + x]! += (top + (bottom - top) * ty) * amplitude;
      }
    }
    norm += amplitude;
    amplitude *= gain;
    periodX *= 2;
    periodY *= 2;
  }
  for (let i = 0; i < out.length; i += 1) out[i] = norm > 0 ? out[i]! / norm : 0;
  return out;
}

/** Periodic wrapped scratches on the unit square (OPUS_NOTE_44). */
function scratchesImage(
  size: number,
  count: number,
  length: number,
  width: number,
  angleSpread: number,
  seed: number,
): Float32Array {
  const out = new Float32Array(size * size);
  const n = Math.max(1, Math.min(256, Math.round(count)));
  const len = Math.max(0.02, Math.min(0.95, length));
  const rad = Math.max(0.75 / size, Math.min(0.08, width));
  const invRad = 1 / rad;
  const spread = clamp01(angleSpread) * Math.PI;
  const baseSeed = seed | 0;

  for (let s = 0; s < n; s += 1) {
    const cx = hash2(s, 0, baseSeed);
    const cy = hash2(s, 1, baseSeed + 17);
    const ang = (hash2(s, 2, baseSeed + 31) - 0.5) * 2 * spread;
    const slen = len * (0.6 + 0.4 * hash2(s, 3, baseSeed + 47));
    const strength = 0.55 + 0.45 * hash2(s, 4, baseSeed + 61);
    const dx = Math.cos(ang) * slen * 0.5;
    const dy = Math.sin(ang) * slen * 0.5;
    const ax = cx - dx, ay = cy - dy;
    const bx = cx + dx, by = cy + dy;
    const abx = bx - ax, aby = by - ay;
    const abLen2 = Math.max(1e-8, abx * abx + aby * aby);

    const minX = Math.min(ax, bx) - rad * 1.5;
    const maxX = Math.max(ax, bx) + rad * 1.5;
    const minY = Math.min(ay, by) - rad * 1.5;
    const maxY = Math.max(ay, by) + rad * 1.5;

    const ix0 = Math.floor(minX * size);
    const ix1 = Math.ceil(maxX * size);
    const iy0 = Math.floor(minY * size);
    const iy1 = Math.ceil(maxY * size);

    for (let py = iy0; py <= iy1; py += 1) {
      const wy = ((py % size) + size) % size;
      const v = (py + 0.5) / size;
      for (let px = ix0; px <= ix1; px += 1) {
        const wx = ((px % size) + size) % size;
        const u = (px + 0.5) / size;
        const apx = u - ax, apy = v - ay;
        const t = clamp01((apx * abx + apy * aby) / abLen2);
        const qx = ax + abx * t - u;
        const qy = ay + aby * t - v;
        const d = Math.sqrt(qx * qx + qy * qy);
        if (d < rad) {
          const tip = Math.sin(t * Math.PI);
          const falloff = (1 - d * invRad) * tip * strength;
          const idx = wy * size + wx;
          if (falloff > out[idx]!) out[idx] = falloff;
        }
      }
    }
  }
  return out;
}

/** Periodic wrapped discs for pits, flakes, mud, and pebbles (OPUS_NOTE_44). */
function spotsImage(
  size: number,
  count: number,
  radiusMin: number,
  radiusMax: number,
  softness: number,
  seed: number,
): Float32Array {
  const out = new Float32Array(size * size);
  const n = Math.max(1, Math.min(512, Math.round(count)));
  const rMin = Math.max(0.004, Math.min(0.45, radiusMin));
  const rMax = Math.max(rMin, Math.min(0.48, radiusMax));
  const soft = clamp01(softness);
  const baseSeed = seed | 0;

  for (let s = 0; s < n; s += 1) {
    const cx = hash2(s, 0, baseSeed);
    const cy = hash2(s, 1, baseSeed + 29);
    const r = rMin + (rMax - rMin) * hash2(s, 2, baseSeed + 53);
    const amp = 0.45 + 0.55 * hash2(s, 3, baseSeed + 71);
    const inner = r * (1 - soft * 0.85);
    const span = Math.max(1e-5, r - inner);

    const ix0 = Math.floor((cx - r) * size) - 1;
    const ix1 = Math.ceil((cx + r) * size) + 1;
    const iy0 = Math.floor((cy - r) * size) - 1;
    const iy1 = Math.ceil((cy + r) * size) + 1;

    for (let py = iy0; py <= iy1; py += 1) {
      const wy = ((py % size) + size) % size;
      const v = (py + 0.5) / size;
      const dy = v - cy;
      for (let px = ix0; px <= ix1; px += 1) {
        const wx = ((px % size) + size) % size;
        const u = (px + 0.5) / size;
        const dx = u - cx;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < r) {
          const t = d <= inner ? 1 : 1 - fade(clamp01((d - inner) / span));
          const val = t * amp;
          const idx = wy * size + wx;
          out[idx] = clamp01(out[idx]! + val * (1 - out[idx]! * 0.65));
        }
      }
    }
  }
  return out;
}

/** Seamless periodic hexagonal lattice on the unit square (OPUS_NOTE_44). */
function hexImage(
  size: number,
  count: number,
  lineWidth: number,
  mode: string,
  seed: number,
): Float32Array {
  const out = new Float32Array(size * size);
  const nx = Math.max(1, Math.round(count));
  const ny = Math.max(2, Math.round(nx * 2) & ~1);
  const lw = Math.max(1e-4, clamp01(lineWidth));
  const invLw = 1 / lw;
  const baseSeed = seed | 0;

  for (let y = 0; y < size; y += 1) {
    const gy = ((y + 0.5) / size) * ny + 0.25;
    const iy = Math.floor(gy);
    for (let x = 0; x < size; x += 1) {
      const gx = ((x + 0.5) / size) * nx + 0.25;
      const ix = Math.floor(gx);
      let best1 = 1e9, best2 = 1e9;
      let bestCx = 0, bestCy = 0;

      for (let dy = -1; dy <= 1; dy += 1) {
        const row = iy + dy;
        const wRow = ((row % ny) + ny) % ny;
        const xShift = (wRow & 1) * 0.5;
        const py = (row + 0.5 - gy) * 0.8660254;
        const py2 = py * py;
        for (let dx = -1; dx <= 1; dx += 1) {
          const col = ix + dx;
          const wCol = ((col % nx) + nx) % nx;
          const px = col + 0.5 + xShift - gx;
          const d2 = px * px + py2;
          if (d2 < best1) {
            best2 = best1;
            best1 = d2;
            bestCx = wCol;
            bestCy = wRow;
          } else if (d2 < best2) {
            best2 = d2;
          }
        }
      }
      const borderDist = Math.sqrt(best2) - Math.sqrt(best1);
      if (mode === "cell") {
        const cellVal = 0.15 + 0.85 * hash2(bestCx, bestCy, baseSeed);
        const edgeMask = borderDist < lw ? fade(clamp01(borderDist * invLw)) : 1;
        out[y * size + x] = cellVal * edgeMask;
      } else {
        out[y * size + x] = fade(clamp01(borderDist * invLw));
      }
    }
  }
  return out;
}

/** Seamless C-infinity periodic over-under twill weave with height rising over each crossing (OPUS_NOTE_44). */
function weaveImage(size: number, count: number, gap: number): Float32Array {
  const out = new Float32Array(size * size);
  const n = Math.max(1, Math.round(count));
  const cycles = Math.max(1, Math.round(n / 2));
  const g = Math.max(0, Math.min(0.45, gap));
  const strandWidth = 1 - g;

  for (let y = 0; y < size; y += 1) {
    const vNorm = (y + 0.5) / size;
    const v = vNorm * n;
    const iy = Math.floor(v);
    const fy = v - iy;
    const vDist = Math.abs(fy - 0.5) * 2;
    const vProfile = vDist < strandWidth ? Math.cos((vDist / strandWidth) * Math.PI * 0.5) : 0;

    for (let x = 0; x < size; x += 1) {
      const uNorm = (x + 0.5) / size;
      const u = uNorm * n;
      const ix = Math.floor(u);
      const fx = u - ix;
      const uDist = Math.abs(fx - 0.5) * 2;
      const uProfile = uDist < strandWidth ? Math.cos((uDist / strandWidth) * Math.PI * 0.5) : 0;

      if (uProfile <= 0 && vProfile <= 0) {
        out[y * size + x] = 0.05;
        continue;
      }
      // Smooth periodic over-under arch waves along u and v (exact integer cycles across [0, 1))
      const uArch = 0.58 + 0.37 * Math.cos(2 * Math.PI * cycles * uNorm + iy * Math.PI);
      const vArch = 0.58 - 0.37 * Math.cos(2 * Math.PI * cycles * vNorm + ix * Math.PI);
      const hHorizontal = vProfile * uArch;
      const hVertical = uProfile * vArch;
      out[y * size + x] = clamp01(Math.max(hHorizontal, hVertical));
    }
  }
  return out;
}

/** O(1)-per-pixel sliding-window wrapped 2-pass separable box/gaussian blur (OPUS_NOTE_44). */
function blurImage(input: Float32Array, size: number, radiusFraction: number): Float32Array {
  const radPx = Math.max(1, Math.min(Math.floor(size / 4), Math.round(clamp01(radiusFraction) * size)));
  let src = input;
  let tmp = new Float32Array(size * size);
  let dst = new Float32Array(size * size);
  const win = 2 * radPx + 1;
  const inv = 1 / win;

  for (let pass = 0; pass < 1; pass += 1) {
    // Horizontal sliding window
    for (let y = 0; y < size; y += 1) {
      const row = y * size;
      let sum = 0;
      for (let k = -radPx; k <= radPx; k += 1) {
        sum += src[row + ((k % size + size) % size)]!;
      }
      for (let x = 0; x < size; x += 1) {
        tmp[row + x] = sum * inv;
        const outIdx = ((x - radPx) % size + size) % size;
        const inIdx = ((x + radPx + 1) % size + size) % size;
        sum += src[row + inIdx]! - src[row + outIdx]!;
      }
    }
    // Vertical sliding window (row-major contiguous cache access)
    const colSums = new Float32Array(size);
    for (let k = -radPx; k <= radPx; k += 1) {
      const rOff = ((k % size + size) % size) * size;
      for (let x = 0; x < size; x += 1) colSums[x]! += tmp[rOff + x]!;
    }
    for (let y = 0; y < size; y += 1) {
      const row = y * size;
      const outRow = (((y - radPx) % size + size) % size) * size;
      const inRow = (((y + radPx + 1) % size + size) % size) * size;
      for (let x = 0; x < size; x += 1) {
        const sVal = colSums[x]!;
        dst[row + x] = sVal * inv;
        colSums[x] = sVal + tmp[inRow + x]! - tmp[outRow + x]!;
      }
    }
    src = dst;
    if (pass === 0) dst = new Float32Array(size * size);
  }
  return src;
}

function cellularImage(size: number, scale: number, jitter: number, mode: string, seed: number): Float32Array {
  const cells = Math.max(1, Math.round(scale)), spread = clamp01(jitter);
  const px = new Float32Array(cells * cells), py = new Float32Array(cells * cells);
  for (let j = 0; j < cells; j += 1) for (let i = 0; i < cells; i += 1) {
    px[j * cells + i] = 0.5 + (hash2(i, j, seed) - 0.5) * spread;
    py[j * cells + i] = 0.5 + (hash2(i, j, (seed | 0) + 7919) - 0.5) * spread;
  }
  const out = new Float32Array(size * size);
  const wrap = new Int32Array(cells + 2);
  for (let i = -1; i <= cells; i += 1) wrap[i + 1] = ((i % cells) + cells) % cells;
  for (let y = 0; y < size; y += 1) {
    const fy = ((y + 0.5) / size) * cells, yi = Math.floor(fy);
    const r0 = wrap[yi]! * cells, r1 = wrap[yi + 1]! * cells, r2 = wrap[yi + 2]! * cells;
    for (let x = 0; x < size; x += 1) {
      const fx = ((x + 0.5) / size) * cells, xi = Math.floor(fx);
      const c0 = wrap[xi]!, c1 = wrap[xi + 1]!, c2 = wrap[xi + 2]!;
      let f1 = 1e9, f2 = 1e9;
      for (let dy = -1; dy <= 1; dy += 1) {
        const cy = yi + dy, wy = dy === -1 ? r0 : dy === 0 ? r1 : r2;
        for (let dx = -1; dx <= 1; dx += 1) {
          const cx = xi + dx, wx = dx === -1 ? c0 : dx === 0 ? c1 : c2, k = wy + wx;
          const ax = cx + px[k]! - fx, ay = cy + py[k]! - fy, d2 = ax * ax + ay * ay;
          if (d2 < f1) { f2 = f1; f1 = d2; } else if (d2 < f2) f2 = d2;
        }
      }
      f1 = Math.sqrt(f1);
      f2 = Math.sqrt(f2);
      const v = mode === "f2" ? f2 : mode === "edge" ? f2 - f1 : f1;
      out[y * size + x] = v > 1 ? 1 : v;
    }
  }
  return out;
}

function stripesImage(size: number, count: number, softness: number, vertical: boolean, tilt = 0): Float32Array {
  const bands = Math.max(1, Math.round(count)), soft = clamp01(softness), width = Math.max(0.0025, soft * 0.5);
  const lean = Math.round(tilt);
  const shape = (s: number): number => {
    if (soft >= 0.999) return s;
    const k = clamp01((s - (0.5 - width)) / (2 * width));
    return k * k * (3 - 2 * k);
  };
  const out = new Float32Array(size * size);
  if (lean !== 0) {
    // integer counts along both axes keep the leaning stripes seamless
    for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
      const u = (x + 0.5) / size, v = (y + 0.5) / size;
      const t = vertical ? bands * u + lean * v : bands * v + lean * u;
      out[y * size + x] = shape(0.5 + 0.5 * Math.sin(Math.PI * 2 * t));
    }
    return out;
  }
  const line = new Float32Array(size);
  for (let i = 0; i < size; i += 1) line[i] = shape(0.5 + 0.5 * Math.sin(Math.PI * 2 * ((i + 0.5) / size) * bands));
  for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) out[y * size + x] = vertical ? line[x]! : line[y]!;
  return out;
}

/** The curl of a wrapping scalar field: its gradient turned a quarter, divided by the largest so the biggest offset is 1. */
function curlOffsets(field: Float32Array, size: number): { dx: Float32Array; dy: Float32Array } {
  const dx = new Float32Array(size * size), dy = new Float32Array(size * size);
  let largest = 0;
  for (let y = 0; y < size; y += 1) {
    const up = ((y + size - 1) % size) * size, down = ((y + 1) % size) * size, row = y * size;
    for (let x = 0; x < size; x += 1) {
      const left = (x + size - 1) % size, right = (x + 1) % size;
      const gx = (field[row + right]! - field[row + left]!) * 0.5, gy = (field[down + x]! - field[up + x]!) * 0.5;
      dx[row + x] = gy; dy[row + x] = -gx;
      const lenSq = gx * gx + gy * gy;
      if (lenSq > largest) largest = lenSq;
    }
  }
  if (largest > 0) {
    const invLargest = 1 / Math.sqrt(largest);
    for (let i = 0; i < dx.length; i += 1) { dx[i] = dx[i]! * invLargest; dy[i] = dy[i]! * invLargest; }
  }
  return { dx, dy };
}

/** Bilinear, wrapping sample of an image with `channels` channels at pixel position (sx, sy), written to out[at..]. */
function sampleInto(image: Float32Array, size: number, channels: number, sx: number, sy: number, out: Float32Array, at: number): void {
  let x0 = Math.floor(sx), y0 = Math.floor(sy);
  const tx = sx - x0, ty = sy - y0;
  const mask = size - 1;
  const isPow2 = (size & mask) === 0;
  if (isPow2) {
    x0 &= mask; y0 &= mask;
  } else {
    x0 = ((x0 % size) + size) % size; y0 = ((y0 % size) + size) % size;
  }
  const x1 = isPow2 ? (x0 + 1) & mask : (x0 + 1) % size;
  const y1 = isPow2 ? (y0 + 1) & mask : (y0 + 1) % size;
  if (channels === 1) {
    const r0 = y0 * size, r1 = y1 * size;
    const a = image[r0 + x0]!, b = image[r0 + x1]!;
    const d = image[r1 + x0]!, e = image[r1 + x1]!;
    out[at] = (a + (b - a) * tx) * (1 - ty) + (d + (e - d) * tx) * ty;
    return;
  }
  for (let c = 0; c < channels; c += 1) {
    const a = image[(y0 * size + x0) * channels + c]!, b = image[(y0 * size + x1) * channels + c]!;
    const d = image[(y1 * size + x0) * channels + c]!, e = image[(y1 * size + x1) * channels + c]!;
    out[at + c] = (a + (b - a) * tx) * (1 - ty) + (d + (e - d) * tx) * ty;
  }
}

/** How a ramp goes from one stop to the next. */
export type RampInterpolation = "linear" | "smooth" | "constant";

/** A ramp as a 2048-step lookup (stops sorted by `at`; equal stops make a hard step). */
function rampTable(stops: readonly NodeRecord[], interpolation: RampInterpolation = "linear"): Float32Array {
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
      const a = sorted[i]!, b = sorted[i + 1]!, span = Number(b.at) - Number(a.at);
      let t = span <= 0 ? 1 : (x - Number(a.at)) / span;
      if (interpolation === "smooth") t = t * t * (3 - 2 * t);
      else if (interpolation === "constant") t = t < 0.5 ? 0 : 1;
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

  if (type === "levels" || type === "invert" || type === "ramp" || type === "scaleBias" || type === "blur") {
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
    if (node.scaleY !== undefined) checkedNumber(node, "scaleY", errors, 1, 64, true);
    checkedNumber(node, "octaves", errors, 1, 6, true);
    checkedNumber(node, "gain", errors, 0, 1);
    checkedNumber(node, "seed", errors);
    return;
  }

  if (type === "scratches") {
    checkedNumber(node, "count", errors, 1, 256, true);
    checkedNumber(node, "length", errors, 0.01, 1);
    checkedNumber(node, "width", errors, 0.001, 0.1);
    checkedNumber(node, "angleSpread", errors, 0, 1);
    checkedNumber(node, "seed", errors);
    return;
  }

  if (type === "spots") {
    const rMin = checkedNumber(node, "radiusMin", errors, 0.002, 0.5);
    const rMax = checkedNumber(node, "radiusMax", errors, 0.002, 0.5);
    if (rMin && rMax && Number(node.radiusMin) > Number(node.radiusMax)) {
      errors.push(`node '${id}': 'spots' requires radiusMin <= radiusMax`);
    }
    checkedNumber(node, "count", errors, 1, 512, true);
    checkedNumber(node, "softness", errors, 0, 1);
    checkedNumber(node, "seed", errors);
    return;
  }

  if (type === "hex") {
    checkedNumber(node, "count", errors, 1, 64, true);
    checkedNumber(node, "lineWidth", errors, 0.01, 1);
    if (node.mode !== "edge" && node.mode !== "cell") {
      errors.push(`node '${id}': 'hex' parameter 'mode' must be 'edge' or 'cell'`);
    }
    if (node.seed !== undefined) checkedNumber(node, "seed", errors);
    return;
  }

  if (type === "weave") {
    checkedNumber(node, "count", errors, 1, 64, true);
    checkedNumber(node, "gap", errors, 0, 0.45);
    return;
  }

  if (type === "blur") {
    checkedNumber(node, "radius", errors, 0.001, 0.25);
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
    if (node.tilt !== undefined) checkedNumber(node, "tilt", errors, -64, 64, true);
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
    if (node.curl !== undefined && typeof node.curl !== "boolean") {
      errors.push(`node '${id}': 'warp' parameter 'curl' must be boolean`);
    }
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
    if (
      node.interpolation !== undefined &&
      node.interpolation !== "linear" &&
      node.interpolation !== "smooth" &&
      node.interpolation !== "constant"
    ) {
      errors.push(`node '${id}': 'ramp' parameter 'interpolation' must be 'linear', 'smooth', or 'constant'`);
    }

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
      } else if (type === "stripes" || type === "checker" || type === "scratches" || type === "spots" || type === "hex" || type === "weave" || type === "blur") {
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
      } else if (type === "levels" || type === "ramp" || type === "blur") {
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
      case "noise": {
        const sy = params.scaleY !== undefined ? num(params, "scaleY", num(params, "scale", 1)) : undefined;
        result = { colour: false, data: noiseImage(size, num(params, "scale", 1), num(params, "octaves", 1), num(params, "gain", 0.5), nodeSeed(node), sy) };
        break;
      }

      case "scratches":
        result = {
          colour: false,
          data: scratchesImage(
            size,
            num(params, "count", 24),
            num(params, "length", 0.25),
            num(params, "width", 0.012),
            num(params, "angleSpread", 0.8),
            nodeSeed(node),
          ),
        };
        break;

      case "spots":
        result = {
          colour: false,
          data: spotsImage(
            size,
            num(params, "count", 24),
            num(params, "radiusMin", 0.02),
            num(params, "radiusMax", 0.08),
            num(params, "softness", 0.4),
            nodeSeed(node),
          ),
        };
        break;

      case "hex":
        result = {
          colour: false,
          data: hexImage(
            size,
            num(params, "count", 8),
            num(params, "lineWidth", 0.18),
            String(params.mode ?? "edge"),
            nodeSeed(node),
          ),
        };
        break;

      case "weave":
        result = {
          colour: false,
          data: weaveImage(size, num(params, "count", 6), num(params, "gap", 0.08)),
        };
        break;

      case "blur": {
        const input = scalarOf(get(String(params.in)));
        result = {
          colour: false,
          data: blurImage(input, size, num(params, "radius", 0.02)),
        };
        break;
      }

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
        result = {
          colour: false,
          data: stripesImage(size, num(params, "count", 1), num(params, "softness", 1), params.vertical === true, num(params, "tilt", 0)),
        };
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
        if (params.curl === true) {
          const { dx, dy } = curlOffsets(field, size);
          for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
            const i = y * size + x;
            sampleInto(source.data, size, channels, x + dx[i]! * 0.5 * amount, y + dy[i]! * 0.5 * amount, data, i * channels);
          }
        } else {
          for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
            const i = y * size + x;
            const w1 = field[i]!, w2 = field[((y + oy) % size) * size + ((x + ox) % size)]!;
            sampleInto(source.data, size, channels, x + (w1 - 0.5) * amount, y + (w2 - 0.5) * amount, data, i * channels);
          }
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
        if (channels === 1 && !mask) {
          for (let i = 0; i < count; i += 1) {
            const x = a[i]!;
            data[i] = x + (op(x, b[i]!) - x) * amount;
          }
        } else {
          for (let i = 0; i < count; i += 1) {
            const t = mask ? amount * clamp01(mask[i]!) : amount;
            for (let c = 0; c < channels; c += 1) {
              const k = i * channels + c, x = a[k]!;
              data[k] = x + (op(x, b[k]!) - x) * t;
            }
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
        const interpolation = params.interpolation === "smooth" || params.interpolation === "constant" ? params.interpolation : "linear";
        const table = rampTable(params.stops as NodeRecord[], interpolation);
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

/**
 * The 20 canonical procedural surface tiles required by `@hm/matstack` (`OPUS_NOTE_44` / `TICKET-41`).
 *
 * Every tile:
 * - wraps seamlessly across [0, 1) x [0, 1);
 * - outputs neutral greyscale `albedo` whose 5th-to-95th percentile spread is >= 0.35 (so `@hm/matstack` colours & ramps drive the hue);
 * - outputs non-constant `height` [0..1] and `roughness` [0..1];
 * - evaluates deterministically in < 25 ms at 128 px.
 */
export const TILE_LIBRARY: Readonly<Record<string, TexGraph>> = Object.freeze({
  "brushed-metal": {
    id: "brushed-metal",
    name: "Brushed Metal",
    nodes: [
      { id: "streaks", type: "noise", scale: 2, scaleY: 24, octaves: 3, gain: 0.6, seed: 101 },
      { id: "fine", type: "noise", scale: 4, scaleY: 32, octaves: 2, gain: 0.5, seed: 203 },
      { id: "mix", type: "blend", a: "streaks", b: "fine", mode: "mix", amount: 0.45 },
      { id: "grey", type: "levels", in: "mix", inLow: 0.22, inHigh: 0.78, gamma: 1.0, outLow: 0.08, outHigh: 0.92 },
      { id: "height", type: "scaleBias", in: "grey", scale: 0.55, bias: 0.22 },
      { id: "roughness", type: "scaleBias", in: "grey", scale: -0.35, bias: 0.68 },
    ],
    out: { albedo: "grey", height: "height", roughness: "roughness" },
  },
  "cells": {
    id: "cells",
    name: "Cellular Rust Blotches",
    nodes: [
      { id: "c1", type: "cellular", scale: 6, jitter: 0.85, mode: "f1", seed: 111 },
      { id: "n1", type: "noise", scale: 5, octaves: 3, gain: 0.55, seed: 113 },
      { id: "warped", type: "warp", in: "c1", warp: "n1", amount: 0.12 },
      { id: "grey", type: "levels", in: "warped", inLow: 0.12, inHigh: 0.78, gamma: 0.95, outLow: 0.06, outHigh: 0.94 },
      { id: "height", type: "scaleBias", in: "grey", scale: 0.7, bias: 0.15 },
      { id: "roughness", type: "scaleBias", in: "grey", scale: 0.4, bias: 0.32 },
    ],
    out: { albedo: "grey", height: "height", roughness: "roughness" },
  },
  "cast-iron": {
    id: "cast-iron",
    name: "Sand-Cast Iron Mottle",
    nodes: [
      { id: "base", type: "noise", scale: 6, octaves: 4, gain: 0.58, seed: 131 },
      { id: "pits", type: "spots", count: 42, radiusMin: 0.015, radiusMax: 0.045, softness: 0.5, seed: 137 },
      { id: "invPits", type: "invert", in: "pits" },
      { id: "combined", type: "blend", a: "base", b: "invPits", mode: "multiply", amount: 0.45 },
      { id: "grey", type: "levels", in: "combined", inLow: 0.18, inHigh: 0.76, gamma: 1.0, outLow: 0.08, outHigh: 0.92 },
      { id: "height", type: "scaleBias", in: "grey", scale: 0.65, bias: 0.18 },
      { id: "roughness", type: "scaleBias", in: "grey", scale: -0.38, bias: 0.72 },
    ],
    out: { albedo: "grey", height: "height", roughness: "roughness" },
  },
  "pits": {
    id: "pits",
    name: "Pitted Surface",
    nodes: [
      { id: "dots", type: "spots", count: 64, radiusMin: 0.018, radiusMax: 0.065, softness: 0.45, seed: 149 },
      { id: "bg", type: "noise", scale: 8, octaves: 2, gain: 0.5, seed: 151 },
      { id: "invDots", type: "invert", in: "dots" },
      { id: "mix", type: "blend", a: "invDots", b: "bg", mode: "mix", amount: 0.35 },
      { id: "grey", type: "levels", in: "mix", inLow: 0.25, inHigh: 0.85, gamma: 1.1, outLow: 0.05, outHigh: 0.95 },
      { id: "height", type: "scaleBias", in: "grey", scale: 0.8, bias: 0.1 },
      { id: "roughness", type: "scaleBias", in: "dots", scale: 0.45, bias: 0.35 },
    ],
    out: { albedo: "grey", height: "height", roughness: "roughness" },
  },
  "fine-grain": {
    id: "fine-grain",
    name: "Anodised Micro Grain",
    nodes: [
      { id: "g1", type: "noise", scale: 16, octaves: 3, gain: 0.55, seed: 163 },
      { id: "g2", type: "grain", seed: 167 },
      { id: "mix", type: "blend", a: "g1", b: "g2", mode: "mix", amount: 0.22 },
      { id: "grey", type: "levels", in: "mix", inLow: 0.24, inHigh: 0.76, gamma: 1.0, outLow: 0.08, outHigh: 0.92 },
      { id: "height", type: "scaleBias", in: "grey", scale: 0.45, bias: 0.28 },
      { id: "roughness", type: "scaleBias", in: "grey", scale: 0.3, bias: 0.36 },
    ],
    out: { albedo: "grey", height: "height", roughness: "roughness" },
  },
  "orange-peel": {
    id: "orange-peel",
    name: "Soft Bumpy Powder-Coat Orange Peel",
    nodes: [
      { id: "c1", type: "cellular", scale: 10, jitter: 0.75, mode: "f1", seed: 173 },
      { id: "soft", type: "blur", in: "c1", radius: 0.025 },
      { id: "n1", type: "noise", scale: 8, octaves: 2, gain: 0.45, seed: 179 },
      { id: "mix", type: "blend", a: "soft", b: "n1", mode: "mix", amount: 0.35 },
      { id: "grey", type: "levels", in: "mix", inLow: 0.22, inHigh: 0.74, gamma: 0.95, outLow: 0.08, outHigh: 0.92 },
      { id: "height", type: "invert", in: "grey" },
      { id: "roughness", type: "scaleBias", in: "grey", scale: 0.25, bias: 0.38 },
    ],
    out: { albedo: "grey", height: "height", roughness: "roughness" },
  },
  "stripes": {
    id: "stripes",
    name: "Hazard Diagonal Stripes",
    nodes: [
      { id: "bands", type: "stripes", count: 2, softness: 0.04, vertical: true, tilt: 2 },
      { id: "wear", type: "noise", scale: 6, octaves: 2, gain: 0.5, seed: 191 },
      { id: "height", type: "scaleBias", in: "bands", scale: 0.25, bias: 0.38 },
      { id: "roughness", type: "scaleBias", in: "wear", scale: 0.2, bias: 0.4 },
    ],
    out: { albedo: "bands", height: "height", roughness: "roughness" },
  },
  "rubber-grain": {
    id: "rubber-grain",
    name: "Matte Vulcanised Rubber Grain",
    nodes: [
      { id: "c1", type: "cellular", scale: 14, jitter: 0.9, mode: "f2", seed: 197 },
      { id: "n1", type: "noise", scale: 10, octaves: 2, gain: 0.5, seed: 199 },
      { id: "mix", type: "blend", a: "c1", b: "n1", mode: "mix", amount: 0.48 },
      { id: "grey", type: "levels", in: "mix", inLow: 0.24, inHigh: 0.78, gamma: 1.0, outLow: 0.08, outHigh: 0.92 },
      { id: "height", type: "scaleBias", in: "grey", scale: 0.5, bias: 0.25 },
      { id: "roughness", type: "scaleBias", in: "grey", scale: -0.25, bias: 0.78 },
    ],
    out: { albedo: "grey", height: "height", roughness: "roughness" },
  },
  "concrete": {
    id: "concrete",
    name: "Cast Concrete Aggregate & Pores",
    nodes: [
      { id: "agg", type: "noise", scale: 5, octaves: 4, gain: 0.55, seed: 211 },
      { id: "pores", type: "spots", count: 55, radiusMin: 0.012, radiusMax: 0.04, softness: 0.35, seed: 223 },
      { id: "invPores", type: "invert", in: "pores" },
      { id: "mix", type: "blend", a: "agg", b: "invPores", mode: "multiply", amount: 0.4 },
      { id: "grey", type: "levels", in: "mix", inLow: 0.18, inHigh: 0.76, gamma: 1.0, outLow: 0.06, outHigh: 0.94 },
      { id: "height", type: "scaleBias", in: "grey", scale: 0.75, bias: 0.12 },
      { id: "roughness", type: "scaleBias", in: "grey", scale: -0.3, bias: 0.76 },
    ],
    out: { albedo: "grey", height: "height", roughness: "roughness" },
  },
  "carbon-weave": {
    id: "carbon-weave",
    name: "2x2 Carbon Twill Weave",
    nodes: [
      { id: "twill", type: "weave", count: 8, gap: 0.08 },
      { id: "grey", type: "levels", in: "twill", inLow: 0.12, inHigh: 0.88, gamma: 0.95, outLow: 0.05, outHigh: 0.95 },
      { id: "height", type: "scaleBias", in: "grey", scale: 0.7, bias: 0.15 },
      { id: "roughness", type: "scaleBias", in: "grey", scale: -0.4, bias: 0.62 },
    ],
    out: { albedo: "grey", height: "height", roughness: "roughness" },
  },
  "hex-micro": {
    id: "hex-micro",
    name: "Fine Hexagonal Composite Lattice",
    nodes: [
      { id: "grid", type: "hex", count: 8, lineWidth: 0.24, mode: "edge", seed: 233 },
      { id: "cells", type: "hex", count: 8, lineWidth: 0.18, mode: "cell", seed: 239 },
      { id: "mix", type: "blend", a: "grid", b: "cells", mode: "multiply", amount: 0.55 },
      { id: "grey", type: "levels", in: "mix", inLow: 0.15, inHigh: 0.85, gamma: 1.0, outLow: 0.06, outHigh: 0.94 },
      { id: "height", type: "scaleBias", in: "grid", scale: 0.6, bias: 0.2 },
      { id: "roughness", type: "scaleBias", in: "grid", scale: -0.35, bias: 0.6 },
    ],
    out: { albedo: "grey", height: "height", roughness: "roughness" },
  },
  "flake-scale": {
    id: "flake-scale",
    name: "Overlapping Heavy Rust Scale Flakes",
    nodes: [
      { id: "flakes", type: "spots", count: 48, radiusMin: 0.04, radiusMax: 0.12, softness: 0.2, seed: 251 },
      { id: "cracks", type: "cellular", scale: 6, jitter: 0.85, mode: "edge", seed: 257 },
      { id: "mix", type: "blend", a: "flakes", b: "cracks", mode: "mix", amount: 0.42 },
      { id: "grey", type: "levels", in: "mix", inLow: 0.14, inHigh: 0.78, gamma: 1.0, outLow: 0.06, outHigh: 0.94 },
      { id: "height", type: "scaleBias", in: "grey", scale: 0.82, bias: 0.1 },
      { id: "roughness", type: "scaleBias", in: "grey", scale: 0.35, bias: 0.45 },
    ],
    out: { albedo: "grey", height: "height", roughness: "roughness" },
  },
  "grime-clouds": {
    id: "grime-clouds",
    name: "Soft Oily Grime Blotches",
    nodes: [
      { id: "clouds", type: "noise", scale: 3, octaves: 3, gain: 0.55, seed: 269 },
      { id: "warpField", type: "noise", scale: 4, octaves: 2, gain: 0.5, seed: 271 },
      { id: "warped", type: "warp", in: "clouds", warp: "warpField", amount: 0.14, curl: true },
      { id: "grey", type: "levels", in: "warped", inLow: 0.2, inHigh: 0.78, gamma: 1.0, outLow: 0.06, outHigh: 0.94 },
      { id: "height", type: "scaleBias", in: "grey", scale: 0.5, bias: 0.25 },
      { id: "roughness", type: "scaleBias", in: "grey", scale: 0.4, bias: 0.38 },
    ],
    out: { albedo: "grey", height: "height", roughness: "roughness" },
  },
  "regolith-grain": {
    id: "regolith-grain",
    name: "Lunar Regolith Dust & Small Pebbles",
    nodes: [
      { id: "dust", type: "noise", scale: 7, octaves: 4, gain: 0.55, seed: 281 },
      { id: "pebbles", type: "spots", count: 50, radiusMin: 0.015, radiusMax: 0.055, softness: 0.35, seed: 283 },
      { id: "mix", type: "blend", a: "dust", b: "pebbles", mode: "add", amount: 0.48 },
      { id: "grey", type: "levels", in: "mix", inLow: 0.2, inHigh: 0.82, gamma: 1.0, outLow: 0.07, outHigh: 0.93 },
      { id: "height", type: "scaleBias", in: "grey", scale: 0.72, bias: 0.14 },
      { id: "roughness", type: "scaleBias", in: "grey", scale: -0.25, bias: 0.8 },
    ],
    out: { albedo: "grey", height: "height", roughness: "roughness" },
  },
  "moss-clump": {
    id: "moss-clump",
    name: "Clumpy Organic Moss Cushions",
    nodes: [
      { id: "clumps", type: "spots", count: 38, radiusMin: 0.045, radiusMax: 0.13, softness: 0.55, seed: 293 },
      { id: "fibres", type: "noise", scale: 9, octaves: 3, gain: 0.6, seed: 307 },
      { id: "warped", type: "warp", in: "clumps", warp: "fibres", amount: 0.1 },
      { id: "mix", type: "blend", a: "warped", b: "fibres", mode: "mix", amount: 0.35 },
      { id: "grey", type: "levels", in: "mix", inLow: 0.16, inHigh: 0.78, gamma: 0.95, outLow: 0.05, outHigh: 0.95 },
      { id: "height", type: "scaleBias", in: "grey", scale: 0.85, bias: 0.08 },
      { id: "roughness", type: "scaleBias", in: "grey", scale: 0.25, bias: 0.65 },
    ],
    out: { albedo: "grey", height: "height", roughness: "roughness" },
  },
  "frost-crystal": {
    id: "frost-crystal",
    name: "Branching Frost Crystal Edges",
    nodes: [
      { id: "facets", type: "cellular", scale: 7, jitter: 0.9, mode: "edge", seed: 311 },
      { id: "needles", type: "scratches", count: 72, length: 0.22, width: 0.014, angleSpread: 1.0, seed: 313 },
      { id: "mix", type: "blend", a: "facets", b: "needles", mode: "max", amount: 0.75 },
      { id: "grey", type: "levels", in: "mix", inLow: 0.1, inHigh: 0.76, gamma: 0.9, outLow: 0.05, outHigh: 0.95 },
      { id: "height", type: "scaleBias", in: "grey", scale: 0.7, bias: 0.15 },
      { id: "roughness", type: "scaleBias", in: "grey", scale: -0.35, bias: 0.68 },
    ],
    out: { albedo: "grey", height: "height", roughness: "roughness" },
  },
  "mud-splatter": {
    id: "mud-splatter",
    name: "Dried Mud Splatter Spots",
    nodes: [
      { id: "splats", type: "spots", count: 44, radiusMin: 0.03, radiusMax: 0.11, softness: 0.3, seed: 331 },
      { id: "warpField", type: "noise", scale: 6, octaves: 3, gain: 0.55, seed: 337 },
      { id: "warped", type: "warp", in: "splats", warp: "warpField", amount: 0.12 },
      { id: "grey", type: "levels", in: "warped", inLow: 0.12, inHigh: 0.78, gamma: 1.0, outLow: 0.06, outHigh: 0.94 },
      { id: "height", type: "scaleBias", in: "grey", scale: 0.75, bias: 0.12 },
      { id: "roughness", type: "scaleBias", in: "grey", scale: 0.35, bias: 0.42 },
    ],
    out: { albedo: "grey", height: "height", roughness: "roughness" },
  },
  "mineral-crust": {
    id: "mineral-crust",
    name: "Evaporite Mineral Crust Rings & Deposits",
    nodes: [
      { id: "rings", type: "cellular", scale: 5, jitter: 0.85, mode: "edge", seed: 347 },
      { id: "crust", type: "noise", scale: 7, octaves: 3, gain: 0.55, seed: 349 },
      { id: "warped", type: "warp", in: "rings", warp: "crust", amount: 0.14 },
      { id: "mix", type: "blend", a: "warped", b: "crust", mode: "mix", amount: 0.42 },
      { id: "grey", type: "levels", in: "mix", inLow: 0.16, inHigh: 0.78, gamma: 1.0, outLow: 0.06, outHigh: 0.94 },
      { id: "height", type: "scaleBias", in: "grey", scale: 0.75, bias: 0.12 },
      { id: "roughness", type: "scaleBias", in: "grey", scale: 0.3, bias: 0.52 },
    ],
    out: { albedo: "grey", height: "height", roughness: "roughness" },
  },
  "scorch-burn": {
    id: "scorch-burn",
    name: "Thermal Scorch Blotches & Soot Speckle",
    nodes: [
      { id: "burns", type: "noise", scale: 3, octaves: 4, gain: 0.55, seed: 359 },
      { id: "speckle", type: "spots", count: 80, radiusMin: 0.01, radiusMax: 0.035, softness: 0.4, seed: 367 },
      { id: "mix", type: "blend", a: "burns", b: "speckle", mode: "add", amount: 0.4 },
      { id: "grey", type: "levels", in: "mix", inLow: 0.18, inHigh: 0.8, gamma: 1.05, outLow: 0.05, outHigh: 0.95 },
      { id: "height", type: "scaleBias", in: "grey", scale: -0.55, bias: 0.78 },
      { id: "roughness", type: "scaleBias", in: "grey", scale: 0.35, bias: 0.5 },
    ],
    out: { albedo: "grey", height: "height", roughness: "roughness" },
  },
  "scratches": {
    id: "scratches",
    name: "Random Abrasive Surface Scratches",
    nodes: [
      { id: "cuts", type: "scratches", count: 85, length: 0.32, width: 0.016, angleSpread: 0.95, seed: 373 },
      { id: "base", type: "noise", scale: 6, octaves: 2, gain: 0.45, seed: 379 },
      { id: "mix", type: "blend", a: "cuts", b: "base", mode: "add", amount: 0.32 },
      { id: "grey", type: "levels", in: "mix", inLow: 0.08, inHigh: 0.72, gamma: 0.9, outLow: 0.05, outHigh: 0.95 },
      { id: "height", type: "invert", in: "grey" },
      { id: "roughness", type: "scaleBias", in: "grey", scale: 0.4, bias: 0.25 },
    ],
    out: { albedo: "grey", height: "height", roughness: "roughness" },
  },
});

// Register all 20 TILE_LIBRARY graphs inside TEXTURE_PRESETS as well for unified preset lookup.
for (const tile of Object.values(TILE_LIBRARY)) {
  if (!TEXTURE_PRESETS.some((p) => p.id === tile.id)) {
    TEXTURE_PRESETS.push(tile);
  }
}

const toSrgbByte = (v: number): number => Math.round(255 * clamp01(v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055));

/**
 * An evaluated tile as the terrain stores it: colour as sRGB RGBA bytes, and maps as RGBA bytes with R = height, G = roughness (the terrain
 * makes the normal from the height). Shared by the bake (scripts/bake-setmix.mjs) and the in-game surface editor.
 */
export function tileBytes(t: EvaluatedTexture): { colour: Uint8Array; maps: Uint8Array } {
  const n = t.size * t.size;
  const colour = new Uint8Array(n * 4), maps = new Uint8Array(n * 4);
  for (let i = 0; i < n; i += 1) {
    colour[i * 4] = t.albedo ? toSrgbByte(t.albedo[i * 3]!) : 128;
    colour[i * 4 + 1] = t.albedo ? toSrgbByte(t.albedo[i * 3 + 1]!) : 128;
    colour[i * 4 + 2] = t.albedo ? toSrgbByte(t.albedo[i * 3 + 2]!) : 128;
    colour[i * 4 + 3] = 255;
    maps[i * 4] = Math.round(255 * clamp01(t.height?.[i] ?? 0.5));
    maps[i * 4 + 1] = Math.round(255 * clamp01(t.roughness?.[i] ?? 0.85));
    maps[i * 4 + 3] = 255;
  }
  return { colour, maps };
}

/** An evaluated tile lit by a sun from the top left (40 degrees up), as sRGB RGBA bytes: how it will look on the ground, for previews. */
export function litPreview(t: EvaluatedTexture): Uint8ClampedArray {
  const n = t.size * t.size, out = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i += 1) {
    const nx = t.normal ? (t.normal[i * 2]! - 0.5) * 2 : 0, ny = t.normal ? (t.normal[i * 2 + 1]! - 0.5) * 2 : 0;
    const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    const lit = 0.3 * (0.55 + 0.45 * nz) + (0.7 / 0.64) * Math.max(0, nx * -0.54 + ny * -0.54 + nz * 0.64);
    for (let c = 0; c < 3; c += 1) out[i * 4 + c] = toSrgbByte((t.albedo?.[i * 3 + c] ?? 0.5) * lit);
    out[i * 4 + 3] = 255;
  }
  return out;
}

export * from "./noise-atlas";
export { TILE_LIBRARY_IDS, TILE_LIBRARY_LIST } from "./tile-library";

