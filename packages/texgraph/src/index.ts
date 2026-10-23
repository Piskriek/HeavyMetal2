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
 *   Optional scaleY gives Y its own integer period (and its own octave progression), for directional grains such as brushed metal.
 * - scratches / spots: hashed wrapped primitives on the unit square. Length, width and radii are tile fractions; angleSpread is in degrees.
 * - hex: a staggered, wrapping hexagonal Voronoi lattice; edge is f2 - f1 softened by lineWidth, cell is the nearest cell's hashed value.
 * - weave: centred warp and weft crowns in a 2 x 2 over-under twill; count is rounded to a four-thread repeat so the pattern wraps.
 * - blur: a wrapped separable box blur, with radius as a fraction of the tile size (0 < radius <= 0.25).
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

function smoothstep01(e0: number, e1: number, x: number): number {
  if (e0 === e1) return x < e0 ? 0 : 1;
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}

function noiseImage(size: number, scale: number, octaves: number, gain: number, seed: number, scaleY?: number): Float32Array {
  const scaleX = Math.max(1, Math.round(scale));
  const sY = scaleY === undefined ? scaleX : Math.max(1, Math.round(scaleY));
  const out = new Float32Array(size * size);
  const xa = new Int32Array(size), xb = new Int32Array(size), tx = new Float32Array(size);
  // tx was historically stored as float32 while ty stayed a JS number; retain
  // that precision so graphs without scaleY remain byte-for-byte compatible.
  const yaArr = new Int32Array(size), ybArr = new Int32Array(size), tyArr = new Float64Array(size);
  let amplitude = 1, norm = 0;
  let periodX = scaleX, periodY = sY;
  const count = Math.max(1, Math.min(6, Math.round(octaves || 1)));
  for (let octave = 0; octave < count; octave += 1) {
    const lattice = new Float32Array(periodX * periodY);
    const octaveSeed = (seed | 0) + octave * 101;
    for (let j = 0; j < periodY; j += 1) for (let i = 0; i < periodX; i += 1) lattice[j * periodX + i] = hash2(i, j, octaveSeed);
    for (let x = 0; x < size; x += 1) {
      const f = ((x + 0.5) / size) * periodX, i0 = Math.floor(f);
      xa[x] = ((i0 % periodX) + periodX) % periodX; xb[x] = ((i0 + 1) % periodX + periodX) % periodX; tx[x] = fade(f - i0);
    }
    for (let y = 0; y < size; y += 1) {
      const f = ((y + 0.5) / size) * periodY, j0 = Math.floor(f);
      yaArr[y] = (((j0 % periodY) + periodY) % periodY) * periodX; ybArr[y] = (((j0 + 1) % periodY + periodY) % periodY) * periodX; tyArr[y] = fade(f - j0);
    }
    for (let y = 0; y < size; y += 1) {
      const ya = yaArr[y]!, yb = ybArr[y]!, ty = tyArr[y]!;
      for (let x = 0; x < size; x += 1) {
        const a = lattice[ya + xa[x]!]!, b = lattice[ya + xb[x]!]!, c = lattice[yb + xa[x]!]!, d = lattice[yb + xb[x]!]!;
        const top = a + (b - a) * tx[x]!, bottom = c + (d - c) * tx[x]!;
        out[y * size + x]! += (top + (bottom - top) * ty) * amplitude;
      }
    }
    norm += amplitude;
    amplitude *= gain;
    periodX *= 2; periodY *= 2;
  }
  for (let i = 0; i < out.length; i += 1) out[i] = norm > 0 ? out[i]! / norm : 0;
  return out;
}

function scratchesImage(size: number, count: number, length: number, width: number, angleSpread: number, seed: number): Float32Array {
  const out = new Float32Array(size * size);
  const n = Math.max(1, Math.round(count));
  const halfLength = length * 0.5, halfWidth = width * 0.5;
  const aa = 0.7 / size, angleRange = angleSpread * Math.PI / 180;
  const cxArr = new Float32Array(n), cyArr = new Float32Array(n);
  const cosArr = new Float32Array(n), sinArr = new Float32Array(n);
  const boundX = new Float32Array(n), boundY = new Float32Array(n);
  for (let k = 0; k < n; k += 1) {
    const angle = (hash2(k, 2, seed + 3441) - 0.5) * angleRange;
    const c = Math.cos(angle), s = Math.sin(angle);
    cxArr[k] = hash2(k, 0, seed);
    cyArr[k] = hash2(k, 1, seed + 7919);
    cosArr[k] = c; sinArr[k] = s;
    boundX[k] = halfLength * Math.abs(c) + halfWidth + aa;
    boundY[k] = halfLength * Math.abs(s) + halfWidth + aa;
  }
  // Compact segments need only the nearest wrapped centre. If an end or the
  // stroke can reach past half a tile, a neighbouring image can be closer.
  const imageRange = halfLength + halfWidth + aa > 0.5 ? 1 : 0;
  for (let y = 0; y < size; y += 1) {
    const v = (y + 0.5) / size;
    for (let x = 0; x < size; x += 1) {
      const u = (x + 0.5) / size;
      let best = 0;
      for (let k = 0; k < n; k += 1) {
        let baseX = cxArr[k]! - u; baseX -= Math.round(baseX);
        let baseY = cyArr[k]! - v; baseY -= Math.round(baseY);
        const c = cosArr[k]!, s = sinArr[k]!, bx = boundX[k]!, by = boundY[k]!;
        for (let oy = -imageRange; oy <= imageRange; oy += 1) {
          const dy = baseY + oy;
          if (Math.abs(dy) > by) continue;
          for (let ox = -imageRange; ox <= imageRange; ox += 1) {
            const dx = baseX + ox;
            if (Math.abs(dx) > bx) continue;
            // Project the point onto the finite segment, then measure the
            // perpendicular/end-cap distance in tile units.
            let along = -(dx * c + dy * s);
            if (along < -halfLength) along = -halfLength;
            else if (along > halfLength) along = halfLength;
            const px = dx + along * c, py = dy + along * s;
            const d2 = px * px + py * py, outer = halfWidth + aa;
            if (d2 > outer * outer) continue;
            const intensity = 1 - smoothstep01(halfWidth - aa, outer, Math.sqrt(d2));
            if (intensity > best) best = intensity;
          }
        }
        if (best >= 0.999) break;
      }
      out[y * size + x] = best;
    }
  }
  return out;
}

function spotsImage(size: number, count: number, radiusMin: number, radiusMax: number, softness: number, seed: number): Float32Array {
  const out = new Float32Array(size * size);
  const n = Math.max(1, Math.round(count));
  const cxArr = new Float32Array(n), cyArr = new Float32Array(n), rArr = new Float32Array(n), edgeArr = new Float32Array(n);
  const aa = 0.7 / size;
  for (let k = 0; k < n; k += 1) {
    const cx = hash2(k, 0, seed);
    const cy = hash2(k, 1, seed + 7919);
    const rr = hash2(k, 2, seed + 3441);
    const radius = radiusMin + (radiusMax - radiusMin) * rr;
    // Never let a soft disc collapse to a sub-pixel hard edge: a wrapped disc
    // on the tile boundary should be no sharper than one inside the tile.
    const edge = Math.max(softness * radius, aa * 4);
    cxArr[k] = cx; cyArr[k] = cy; rArr[k] = radius; edgeArr[k] = edge;
  }
  for (let y = 0; y < size; y += 1) {
    const v = (y + 0.5) / size;
    for (let x = 0; x < size; x += 1) {
      const u = (x + 0.5) / size;
      let best = 0;
      for (let k = 0; k < n; k += 1) {
        const cx = cxArr[k]!, cy = cyArr[k]!, r = rArr[k]!, edge = edgeArr[k]!;
        let dx = u - cx; dx -= Math.round(dx);
        let dy = v - cy; dy -= Math.round(dy);
        // quick reject via bounding box
        const bound = r + edge * 0.5 + aa;
        if (Math.abs(dx) > bound || Math.abs(dy) > bound) continue;
        const d2 = dx * dx + dy * dy;
        if (d2 > (r + edge * 0.5 + aa) * (r + edge * 0.5 + aa)) continue;
        const d = Math.sqrt(d2);
        const inner = r - edge * 0.5, outer = r + edge * 0.5;
        const intensity = 1 - smoothstep01(inner, outer, d);
        if (intensity > best) {
          best = intensity;
          if (best >= 0.999) break;
        }
      }
      out[y * size + x] = best;
    }
  }
  return out;
}

function hexImage(size: number, count: number, lineWidth: number, mode: string, seed: number): Float32Array {
  const out = new Float32Array(size * size);
  const nx = Math.max(1, Math.round(count));
  let ny = Math.round(nx * 1.15470053838);
  if (ny < 2) ny = 2;
  if ((ny & 1) === 1) ny += 1;
  const sx = 1 / nx, sy = 1 / ny;
  // Keep lattice edges off the tile boundary. Besides looking less mechanical, this
  // makes the random-cell mode wrap just like any interior cell boundary.
  const originX = sx * 0.37, originY = sy * 0.29;
  const aa = 1.2 / size;
  const lw = Math.max(0, lineWidth);
  for (let y = 0; y < size; y += 1) {
    const v = (y + 0.5) / size;
    const iy0 = Math.floor((v - originY) / sy);
    for (let x = 0; x < size; x += 1) {
      const u = (x + 0.5) / size;
      // collect candidate centers in 3x3 neighbourhood
      let f1 = 1e9, f2 = 1e9;
      let bestIx = 0, bestIy = 0;
      let bestDist2 = 1e9;
      for (let dy = -1; dy <= 1; dy += 1) {
        const iyCand = iy0 + dy;
        const iy = ((iyCand % ny) + ny) % ny;
        const offCand = (iyCand & 1) ? sx * 0.5 : 0;
        // estimated ix for this row
        const ixEst = Math.floor((u - offCand - originX) / sx);
        for (let dx = -1; dx <= 1; dx += 1) {
          const ixCand = ixEst + dx;
          const ix = ((ixCand % nx) + nx) % nx;
          // Keep the candidate coordinates unwrapped: adjacent periodic images
          // are distinct candidates, while only the cell hash index wraps.
          const cx = ixCand * sx + offCand + sx * 0.5 + originX;
          const cy = iyCand * sy + sy * 0.5 + originY;
          const ddx = cx - u, ddy = cy - v;
          const d2 = ddx * ddx + ddy * ddy;
          const d = Math.sqrt(d2);
          if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
          if (mode === "cell" && d2 < bestDist2) { bestDist2 = d2; bestIx = ix; bestIy = iy; }
        }
      }
      if (mode === "cell") {
        out[y * size + x] = hash2(bestIx, bestIy, seed);
      } else {
        // Zero on a cell edge, rising to one lineWidth inside the cell.
        out[y * size + x] = smoothstep01(0, Math.max(aa, lw), f2 - f1);
      }
    }
  }
  return out;
}

function weaveImage(size: number, count: number, gap: number): Float32Array {
  const out = new Float32Array(size * size);
  // A 2 x 2 twill repeats over four threads in each direction. Rounding to a
  // multiple of four keeps both the weave and its over-under pattern periodic.
  const n = Math.max(4, Math.round(count / 4) * 4);
  const threadWidth = Math.max(0.001, 1 - clamp01(gap));
  const aa = Math.min(threadWidth * 0.5, (1.5 * n) / size);
  const hGap = 0.16;
  for (let y = 0; y < size; y += 1) {
    const v = (y + 0.5) / size;
    const iy = Math.floor(v * n), fy = v * n - iy;
    const dy = Math.abs(fy - 0.5) * 2;
    const weft = 1 - smoothstep01(threadWidth - aa, threadWidth + aa, dy);
    const weftCrown = Math.sqrt(Math.max(0, 1 - (dy / threadWidth) ** 2));
    for (let x = 0; x < size; x += 1) {
      const u = (x + 0.5) / size;
      const ix = Math.floor(u * n), fx = u * n - ix;
      const dx = Math.abs(fx - 0.5) * 2;
      const warp = 1 - smoothstep01(threadWidth - aa, threadWidth + aa, dx);
      const warpCrown = Math.sqrt(Math.max(0, 1 - (dx / threadWidth) ** 2));
      const topIsWarp = ((ix + iy) % 4 + 4) % 4 < 2;
      const warpHeight = 0.46 + warpCrown * 0.14;
      const weftHeight = 0.44 + weftCrown * 0.14;
      // At a crossing only the upper thread is visible. Its crown rises above
      // the single-thread height; the next pair of crossings reverses the order.
      const crossingHeight = 0.76 + (topIsWarp ? warpCrown : weftCrown) * 0.2;
      const w = warp, f = weft, cross = w * f;
      out[y * size + x] =
        hGap * (1 - w) * (1 - f) +
        warpHeight * w * (1 - f) +
        weftHeight * f * (1 - w) +
        crossingHeight * cross;
    }
  }
  return out;
}

function boxBlurWrapped(data: Float32Array, size: number, channels: number, radiusPixels: number): Float32Array {
  if (radiusPixels <= 0) return new Float32Array(data);
  const r = Math.max(0, Math.round(radiusPixels));
  const win = 2 * r + 1;
  const invWin = 1 / win;
  const tmp = new Float32Array(data.length);
  // horizontal
  for (let y = 0; y < size; y += 1) {
    const row = y * size * channels;
    for (let c = 0; c < channels; c += 1) {
      let sum = 0;
      for (let k = -r; k <= r; k += 1) {
        const xx = (k + size) % size;
        sum += data[row + xx * channels + c]!;
      }
      tmp[row + c] = sum * invWin;
      for (let x = 1; x < size; x += 1) {
        const outX = (x - r - 1 + size) % size;
        const inX = (x + r) % size;
        sum += data[row + inX * channels + c]! - data[row + outX * channels + c]!;
        tmp[row + x * channels + c] = sum * invWin;
      }
    }
  }
  const out = new Float32Array(data.length);
  // vertical
  for (let x = 0; x < size; x += 1) {
    for (let c = 0; c < channels; c += 1) {
      let sum = 0;
      for (let k = -r; k <= r; k += 1) {
        const yy = (k + size) % size;
        sum += tmp[yy * size * channels + x * channels + c]!;
      }
      out[x * channels + c] = sum * invWin;
      for (let y = 1; y < size; y += 1) {
        const outY = (y - r - 1 + size) % size;
        const inY = (y + r) % size;
        sum += tmp[inY * size * channels + x * channels + c]! - tmp[outY * size * channels + x * channels + c]!;
        out[y * size * channels + x * channels + c] = sum * invWin;
      }
    }
  }
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
      const length = Math.sqrt(gx * gx + gy * gy);
      if (length > largest) largest = length;
    }
  }
  if (largest > 0) for (let i = 0; i < dx.length; i += 1) { dx[i] = dx[i]! / largest; dy[i] = dy[i]! / largest; }
  return { dx, dy };
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
    checkedNumber(node, "octaves", errors, 1, 6, true);
    checkedNumber(node, "gain", errors, 0, 1);
    checkedNumber(node, "seed", errors);
    if (node.scaleY !== undefined) checkedNumber(node, "scaleY", errors, 1, 64, true);
    return;
  }

  if (type === "scratches") {
    checkedNumber(node, "count", errors, 1, 1000, true);
    checkedNumber(node, "length", errors, 0, 1);
    checkedNumber(node, "width", errors, 0, 0.5);
    checkedNumber(node, "angleSpread", errors, 0, 360);
    checkedNumber(node, "seed", errors);
    return;
  }

  if (type === "spots") {
    checkedNumber(node, "count", errors, 1, 2000, true);
    checkedNumber(node, "radiusMin", errors, 0, 0.5);
    checkedNumber(node, "radiusMax", errors, 0, 0.5);
    checkedNumber(node, "softness", errors, 0, 1);
    checkedNumber(node, "seed", errors);
    if (isFiniteNumber(node.radiusMin) && isFiniteNumber(node.radiusMax) && Number(node.radiusMin) > Number(node.radiusMax)) {
      errors.push(`node '${id}': 'spots' requires radiusMin to be <= radiusMax`);
    }
    return;
  }

  if (type === "hex") {
    checkedNumber(node, "count", errors, 1, 64, true);
    checkedNumber(node, "lineWidth", errors, 0, 0.5);
    checkedNumber(node, "seed", errors);
    if (node.mode !== "edge" && node.mode !== "cell") {
      errors.push(`node '${id}': 'hex' parameter 'mode' must be 'edge' or 'cell'`);
    }
    return;
  }

  if (type === "weave") {
    checkedNumber(node, "count", errors, 1, 64, true);
    checkedNumber(node, "gap", errors, 0, 1);
    return;
  }

  if (type === "blur") {
    const validRadius = checkedNumber(node, "radius", errors, 0, 0.25);
    if (validRadius && Number(node.radius) <= 0) {
      errors.push(`node '${id}': 'blur' parameter 'radius' must be greater than 0`);
    }
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

      if (type === "noise" || type === "cellular" || type === "grain" || type === "scratches" || type === "spots" || type === "hex" || type === "weave") {
        result = "scalar";
      } else if (type === "stripes" || type === "checker") {
        result = "scalar";
      } else if (type === "blur") {
        result = typeof node.in === "string" ? inferType(node.in) : undefined;
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
      case "noise": {
        const scaleY = params.scaleY !== undefined ? num(params, "scaleY", num(params, "scale", 1)) : undefined;
        result = { colour: false, data: noiseImage(size, num(params, "scale", 1), num(params, "octaves", 1), num(params, "gain", 0.5), nodeSeed(node), scaleY) };
        break;
      }
      case "scratches":
        result = { colour: false, data: scratchesImage(size, num(params, "count", 20), num(params, "length", 0.3), num(params, "width", 0.01), num(params, "angleSpread", 30), nodeSeed(node)) };
        break;
      case "spots":
        result = { colour: false, data: spotsImage(size, num(params, "count", 40), num(params, "radiusMin", 0.02), num(params, "radiusMax", 0.05), num(params, "softness", 0.3), nodeSeed(node)) };
        break;
      case "hex":
        result = { colour: false, data: hexImage(size, num(params, "count", 8), num(params, "lineWidth", 0.04), String(params.mode ?? "edge"), nodeSeed(node)) };
        break;
      case "weave":
        result = { colour: false, data: weaveImage(size, num(params, "count", 8), num(params, "gap", 0.15)) };
        break;
      case "blur": {
        const input = get(String(params.in));
        const radius = num(params, "radius", 0.05);
        const rp = Math.round(radius * size);
        const channels = input.colour ? 3 : 1;
        const blurred = boxBlurWrapped(input.data, size, channels, rp);
        result = { colour: input.colour, data: blurred };
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


/** The procedural grey/height/roughness tiles used by the Plan 41 surface shelf. */
export const TILE_LIBRARY: Readonly<Record<string, TexGraph>> = Object.freeze({
  "brushed-metal": {
    id: "brushed-metal",
    name: "Brushed metal",
    nodes: [
      { id: "brush", type: "noise", scale: 12, scaleY: 48, octaves: 2, gain: 0.5, seed: 11 },
      { id: "levels", type: "levels", in: "brush", inLow: 0.25, inHigh: 0.75, gamma: 1, outLow: 0, outHigh: 1 },
      { id: "albedo", type: "ramp", in: "levels", stops: [{ at: 0, r: 0.12, g: 0.12, b: 0.12 }, { at: 1, r: 0.88, g: 0.88, b: 0.88 }] },
      { id: "height", type: "scaleBias", in: "levels", scale: 0.38, bias: 0.32 },
      { id: "rough", type: "scaleBias", in: "brush", scale: 0.22, bias: 0.39 },
    ],
    out: { albedo: "albedo", height: "height", roughness: "rough" },
  },
  "cells": {
    id: "cells",
    name: "Cells",
    nodes: [
      { id: "cell", type: "cellular", scale: 6, jitter: 0.8, mode: "f1", seed: 13 },
      { id: "levels", type: "levels", in: "cell", inLow: 0.15, inHigh: 0.75, gamma: 1, outLow: 1, outHigh: 0 },
      { id: "albedo", type: "ramp", in: "levels", stops: [{ at: 0, r: 0.14, g: 0.14, b: 0.14 }, { at: 1, r: 0.86, g: 0.86, b: 0.86 }] },
      { id: "height", type: "scaleBias", in: "levels", scale: 0.42, bias: 0.28 },
      { id: "rough", type: "scaleBias", in: "cell", scale: 0.24, bias: 0.4 },
    ],
    out: { albedo: "albedo", height: "height", roughness: "rough" },
  },
  "cast-iron": {
    id: "cast-iron",
    name: "Cast iron",
    nodes: [
      { id: "base", type: "noise", scale: 5, octaves: 3, gain: 0.55, seed: 21 },
      { id: "pits", type: "spots", count: 55, radiusMin: 0.02, radiusMax: 0.055, softness: 0.3, seed: 22 },
      { id: "mix", type: "blend", a: "base", b: "pits", mode: "max", amount: 0.65 },
      { id: "levels", type: "levels", in: "mix", inLow: 0.2, inHigh: 0.8, gamma: 1, outLow: 0, outHigh: 1 },
      { id: "albedo", type: "ramp", in: "levels", stops: [{ at: 0, r: 0.16, g: 0.16, b: 0.16 }, { at: 1, r: 0.84, g: 0.84, b: 0.84 }] },
      { id: "height", type: "scaleBias", in: "mix", scale: 0.45, bias: 0.28 },
      { id: "rough", type: "scaleBias", in: "mix", scale: 0.2, bias: 0.389 },
    ],
    out: { albedo: "albedo", height: "height", roughness: "rough" },
  },
  "pits": {
    id: "pits",
    name: "Pits",
    nodes: [
      { id: "spots", type: "spots", count: 70, radiusMin: 0.012, radiusMax: 0.035, softness: 0.22, seed: 31 },
      { id: "micro", type: "grain", seed: 32 },
      { id: "textured", type: "blend", a: "spots", b: "micro", mode: "add", amount: 0.15 },
      { id: "invert", type: "invert", in: "textured" },
      { id: "albedo", type: "ramp", in: "invert", stops: [{ at: 0, r: 0.18, g: 0.18, b: 0.18 }, { at: 1, r: 0.86, g: 0.86, b: 0.86 }] },
      { id: "height", type: "scaleBias", in: "textured", scale: -0.45, bias: 0.75 },
      { id: "rough", type: "scaleBias", in: "textured", scale: 0.26, bias: 0.447 },
    ],
    out: { albedo: "albedo", height: "height", roughness: "rough" },
  },
  "fine-grain": {
    id: "fine-grain",
    name: "Fine grain",
    nodes: [
      { id: "noise", type: "noise", scale: 18, octaves: 3, gain: 0.5, seed: 41 },
      { id: "levels", type: "levels", in: "noise", inLow: 0.2, inHigh: 0.8, gamma: 0.9, outLow: 0, outHigh: 1 },
      { id: "albedo", type: "ramp", in: "levels", stops: [{ at: 0, r: 0.15, g: 0.15, b: 0.15 }, { at: 1, r: 0.85, g: 0.85, b: 0.85 }] },
      { id: "height", type: "scaleBias", in: "levels", scale: 0.32, bias: 0.34 },
      { id: "rough", type: "scaleBias", in: "noise", scale: 0.2, bias: 0.402 },
    ],
    out: { albedo: "albedo", height: "height", roughness: "rough" },
  },
  "orange-peel": {
    id: "orange-peel",
    name: "Orange peel",
    nodes: [
      { id: "noise", type: "noise", scale: 6, octaves: 2, gain: 0.5, seed: 51 },
      { id: "blur", type: "blur", in: "noise", radius: 0.06 },
      { id: "levels", type: "levels", in: "blur", inLow: 0.25, inHigh: 0.72, gamma: 1, outLow: 0, outHigh: 1 },
      { id: "albedo", type: "ramp", in: "levels", stops: [{ at: 0, r: 0.17, g: 0.17, b: 0.17 }, { at: 1, r: 0.83, g: 0.83, b: 0.83 }] },
      { id: "height", type: "scaleBias", in: "blur", scale: 0.35, bias: 0.33 },
      { id: "rough", type: "scaleBias", in: "blur", scale: 0.18, bias: 0.409 },
    ],
    out: { albedo: "albedo", height: "height", roughness: "rough" },
  },
  "stripes": {
    id: "stripes",
    name: "Stripes",
    nodes: [
      { id: "stripes", type: "stripes", count: 2, softness: 0.02, vertical: true, tilt: 2 },
      { id: "albedo", type: "ramp", in: "stripes", interpolation: "constant", stops: [{ at: 0, r: 0, g: 0, b: 0 }, { at: 1, r: 1, g: 1, b: 1 }] },
      { id: "height", type: "scaleBias", in: "stripes", scale: 0.5, bias: 0.25 },
      { id: "rough", type: "scaleBias", in: "stripes", scale: 0.22, bias: 0.39 },
    ],
    out: { albedo: "albedo", height: "height", roughness: "rough" },
  },
  "rubber-grain": {
    id: "rubber-grain",
    name: "Rubber grain",
    nodes: [
      { id: "noise1", type: "noise", scale: 10, octaves: 2, gain: 0.5, seed: 61 },
      { id: "noise2", type: "noise", scale: 18, octaves: 2, gain: 0.5, seed: 62 },
      { id: "mix", type: "blend", a: "noise1", b: "noise2", mode: "max", amount: 0.6 },
      { id: "levels", type: "levels", in: "mix", inLow: 0.25, inHigh: 0.75, gamma: 1, outLow: 0, outHigh: 1 },
      { id: "albedo", type: "ramp", in: "levels", stops: [{ at: 0, r: 0.19, g: 0.19, b: 0.19 }, { at: 1, r: 0.81, g: 0.81, b: 0.81 }] },
      { id: "height", type: "scaleBias", in: "mix", scale: 0.34, bias: 0.33 },
      { id: "rough", type: "scaleBias", in: "mix", scale: 0.2, bias: 0.388 },
    ],
    out: { albedo: "albedo", height: "height", roughness: "rough" },
  },
  "concrete": {
    id: "concrete",
    name: "Concrete",
    nodes: [
      { id: "cell", type: "cellular", scale: 5, jitter: 0.75, mode: "f1", seed: 71 },
      { id: "noise", type: "noise", scale: 12, octaves: 2, gain: 0.5, seed: 72 },
      { id: "mix", type: "blend", a: "cell", b: "noise", mode: "multiply", amount: 0.45 },
      { id: "levels", type: "levels", in: "mix", inLow: 0.15, inHigh: 0.75, gamma: 1, outLow: 0, outHigh: 1 },
      { id: "albedo", type: "ramp", in: "levels", stops: [{ at: 0, r: 0.16, g: 0.16, b: 0.16 }, { at: 1, r: 0.84, g: 0.84, b: 0.84 }] },
      { id: "height", type: "scaleBias", in: "mix", scale: 0.4, bias: 0.3 },
      { id: "rough", type: "scaleBias", in: "mix", scale: 0.22, bias: 0.43 },
    ],
    out: { albedo: "albedo", height: "height", roughness: "rough" },
  },
  "carbon-weave": {
    id: "carbon-weave",
    name: "Carbon weave",
    nodes: [
      { id: "weave", type: "weave", count: 8, gap: 0.12 },
      { id: "levels", type: "levels", in: "weave", inLow: 0.32, inHigh: 0.82, gamma: 1, outLow: 0, outHigh: 1 },
      { id: "albedo", type: "ramp", in: "levels", stops: [{ at: 0, r: 0.13, g: 0.13, b: 0.13 }, { at: 1, r: 0.87, g: 0.87, b: 0.87 }] },
      { id: "height", type: "scaleBias", in: "weave", scale: 0.55, bias: 0.22 },
      { id: "rough", type: "scaleBias", in: "weave", scale: 0.18, bias: 0.35 },
    ],
    out: { albedo: "albedo", height: "height", roughness: "rough" },
  },
  "hex-micro": {
    id: "hex-micro",
    name: "Hex micro",
    nodes: [
      { id: "hex", type: "hex", count: 10, lineWidth: 0.035, mode: "edge", seed: 81 },
      { id: "levels", type: "levels", in: "hex", inLow: 0.05, inHigh: 0.65, gamma: 1, outLow: 0, outHigh: 1 },
      { id: "albedo", type: "ramp", in: "levels", stops: [{ at: 0, r: 0.15, g: 0.15, b: 0.15 }, { at: 1, r: 0.85, g: 0.85, b: 0.85 }] },
      { id: "height", type: "scaleBias", in: "hex", scale: 0.42, bias: 0.3 },
      { id: "rough", type: "scaleBias", in: "hex", scale: 0.2, bias: 0.366 },
    ],
    out: { albedo: "albedo", height: "height", roughness: "rough" },
  },
  "flake-scale": {
    id: "flake-scale",
    name: "Flake scale",
    nodes: [
      { id: "flakes", type: "spots", count: 48, radiusMin: 0.028, radiusMax: 0.068, softness: 0.42, seed: 91 },
      { id: "micro", type: "grain", seed: 92 },
      { id: "textured", type: "blend", a: "flakes", b: "micro", mode: "add", amount: 0.25 },
      { id: "levels", type: "levels", in: "textured", inLow: 0.05, inHigh: 0.85, gamma: 0.9, outLow: 0, outHigh: 1 },
      { id: "albedo", type: "ramp", in: "levels", stops: [{ at: 0, r: 0.17, g: 0.17, b: 0.17 }, { at: 1, r: 0.83, g: 0.83, b: 0.83 }] },
      { id: "height", type: "scaleBias", in: "textured", scale: 0.5, bias: 0.28 },
      { id: "rough", type: "scaleBias", in: "textured", scale: 0.2, bias: 0.421 },
    ],
    out: { albedo: "albedo", height: "height", roughness: "rough" },
  },
  "grime-clouds": {
    id: "grime-clouds",
    name: "Grime clouds",
    nodes: [
      { id: "cloud", type: "noise", scale: 3, octaves: 3, gain: 0.6, seed: 101 },
      { id: "levels", type: "levels", in: "cloud", inLow: 0.45, inHigh: 0.55, gamma: 1, outLow: 0, outHigh: 1 },
      { id: "albedo", type: "ramp", in: "levels", stops: [{ at: 0, r: 0.14, g: 0.14, b: 0.14 }, { at: 1, r: 0.86, g: 0.86, b: 0.86 }] },
      { id: "height", type: "scaleBias", in: "cloud", scale: 0.3, bias: 0.38 },
      { id: "rough", type: "scaleBias", in: "cloud", scale: 0.2, bias: 0.408 },
    ],
    out: { albedo: "albedo", height: "height", roughness: "rough" },
  },
  "regolith-grain": {
    id: "regolith-grain",
    name: "Regolith grain",
    nodes: [
      { id: "grain", type: "spots", count: 85, radiusMin: 0.01, radiusMax: 0.024, softness: 0.28, seed: 111 },
      { id: "micro", type: "grain", seed: 112 },
      { id: "textured", type: "blend", a: "grain", b: "micro", mode: "add", amount: 0.25 },
      { id: "levels", type: "levels", in: "textured", inLow: 0.05, inHigh: 0.9, gamma: 1, outLow: 0, outHigh: 1 },
      { id: "albedo", type: "ramp", in: "levels", stops: [{ at: 0, r: 0.18, g: 0.18, b: 0.18 }, { at: 1, r: 0.82, g: 0.82, b: 0.82 }] },
      { id: "height", type: "scaleBias", in: "textured", scale: 0.38, bias: 0.35 },
      { id: "rough", type: "scaleBias", in: "textured", scale: 0.18, bias: 0.462 },
    ],
    out: { albedo: "albedo", height: "height", roughness: "rough" },
  },
  "moss-clump": {
    id: "moss-clump",
    name: "Moss clump",
    nodes: [
      { id: "spots", type: "spots", count: 32, radiusMin: 0.03, radiusMax: 0.075, softness: 0.55, seed: 121 },
      { id: "blur", type: "blur", in: "spots", radius: 0.05 },
      { id: "micro", type: "grain", seed: 122 },
      { id: "textured", type: "blend", a: "blur", b: "micro", mode: "add", amount: 0.25 },
      { id: "levels", type: "levels", in: "textured", inLow: 0.1, inHigh: 0.85, gamma: 0.9, outLow: 0, outHigh: 1 },
      { id: "albedo", type: "ramp", in: "levels", stops: [{ at: 0, r: 0.16, g: 0.16, b: 0.16 }, { at: 1, r: 0.84, g: 0.84, b: 0.84 }] },
      { id: "height", type: "scaleBias", in: "textured", scale: 0.48, bias: 0.3 },
      { id: "rough", type: "scaleBias", in: "textured", scale: 0.2, bias: 0.425 },
    ],
    out: { albedo: "albedo", height: "height", roughness: "rough" },
  },
  "frost-crystal": {
    id: "frost-crystal",
    name: "Frost crystal",
    nodes: [
      { id: "hex", type: "hex", count: 7, lineWidth: 0.025, mode: "cell", seed: 131 },
      { id: "noise", type: "noise", scale: 12, octaves: 2, gain: 0.5, seed: 132 },
      { id: "mix", type: "blend", a: "hex", b: "noise", mode: "multiply", amount: 0.35 },
      { id: "levels", type: "levels", in: "mix", inLow: 0.12, inHigh: 0.82, gamma: 1, outLow: 0, outHigh: 1 },
      { id: "albedo", type: "ramp", in: "levels", stops: [{ at: 0, r: 0.15, g: 0.15, b: 0.15 }, { at: 1, r: 0.85, g: 0.85, b: 0.85 }] },
      { id: "height", type: "scaleBias", in: "hex", scale: 0.42, bias: 0.32 },
      { id: "rough", type: "scaleBias", in: "mix", scale: 0.2, bias: 0.42 },
    ],
    out: { albedo: "albedo", height: "height", roughness: "rough" },
  },
  "mud-splatter": {
    id: "mud-splatter",
    name: "Mud splatter",
    nodes: [
      { id: "splat", type: "spots", count: 42, radiusMin: 0.02, radiusMax: 0.09, softness: 0.48, seed: 141 },
      { id: "micro", type: "grain", seed: 142 },
      { id: "textured", type: "blend", a: "splat", b: "micro", mode: "add", amount: 0.5 },
      { id: "levels", type: "levels", in: "textured", inLow: 0.05, inHigh: 0.85, gamma: 1, outLow: 0, outHigh: 1 },
      { id: "albedo", type: "ramp", in: "levels", stops: [{ at: 0, r: 0.17, g: 0.17, b: 0.17 }, { at: 1, r: 0.83, g: 0.83, b: 0.83 }] },
      { id: "height", type: "scaleBias", in: "textured", scale: 0.46, bias: 0.3 },
      { id: "rough", type: "scaleBias", in: "textured", scale: 0.2, bias: 0.39 },
    ],
    out: { albedo: "albedo", height: "height", roughness: "rough" },
  },
  "mineral-crust": {
    id: "mineral-crust",
    name: "Mineral crust",
    nodes: [
      { id: "cell", type: "cellular", scale: 7, jitter: 0.85, mode: "edge", seed: 151 },
      { id: "spots", type: "spots", count: 35, radiusMin: 0.015, radiusMax: 0.04, softness: 0.3, seed: 152 },
      { id: "mix", type: "blend", a: "cell", b: "spots", mode: "max", amount: 0.55 },
      { id: "micro", type: "grain", seed: 153 },
      { id: "textured", type: "blend", a: "mix", b: "micro", mode: "add", amount: 0.25 },
      { id: "levels", type: "levels", in: "textured", inLow: 0.12, inHigh: 0.78, gamma: 1, outLow: 0, outHigh: 1 },
      { id: "albedo", type: "ramp", in: "levels", stops: [{ at: 0, r: 0.16, g: 0.16, b: 0.16 }, { at: 1, r: 0.84, g: 0.84, b: 0.84 }] },
      { id: "height", type: "scaleBias", in: "textured", scale: 0.4, bias: 0.32 },
      { id: "rough", type: "scaleBias", in: "textured", scale: 0.2, bias: 0.415 },
    ],
    out: { albedo: "albedo", height: "height", roughness: "rough" },
  },
  "scorch-burn": {
    id: "scorch-burn",
    name: "Scorch burn",
    nodes: [
      { id: "noise", type: "noise", scale: 4, octaves: 3, gain: 0.55, seed: 161 },
      { id: "warpField", type: "noise", scale: 2, octaves: 2, gain: 0.5, seed: 162 },
      { id: "warped", type: "warp", in: "noise", warp: "warpField", amount: 0.09 },
      { id: "levels", type: "levels", in: "warped", inLow: 0.42, inHigh: 0.62, gamma: 0.9, outLow: 0, outHigh: 1 },
      { id: "albedo", type: "ramp", in: "levels", stops: [{ at: 0, r: 0.14, g: 0.14, b: 0.14 }, { at: 1, r: 0.86, g: 0.86, b: 0.86 }] },
      { id: "height", type: "scaleBias", in: "warped", scale: 0.36, bias: 0.34 },
      { id: "rough", type: "scaleBias", in: "warped", scale: 0.2, bias: 0.403 },
    ],
    out: { albedo: "albedo", height: "height", roughness: "rough" },
  },
  "scratches": {
    id: "scratches",
    name: "Scratches",
    nodes: [
      { id: "scratches", type: "scratches", count: 62, length: 0.32, width: 0.0035, angleSpread: 28, seed: 171 },
      { id: "micro", type: "grain", seed: 172 },
      { id: "textured", type: "blend", a: "scratches", b: "micro", mode: "add", amount: 0.5 },
      { id: "levels", type: "levels", in: "textured", inLow: 0.05, inHigh: 0.6, gamma: 1, outLow: 0, outHigh: 1 },
      { id: "albedo", type: "ramp", in: "levels", stops: [{ at: 0, r: 0.18, g: 0.18, b: 0.18 }, { at: 1, r: 0.82, g: 0.82, b: 0.82 }] },
      { id: "height", type: "scaleBias", in: "textured", scale: 0.42, bias: 0.32 },
      { id: "rough", type: "scaleBias", in: "textured", scale: 0.2, bias: 0.434 },
    ],
    out: { albedo: "albedo", height: "height", roughness: "rough" },
  },
});

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
