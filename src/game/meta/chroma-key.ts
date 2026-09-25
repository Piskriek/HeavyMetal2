/**
 * Magenta chroma-key pipeline for generated avatar parts (Plan §9).
 * Pure functions over RGBA buffers → identical output in Node (build script) and the browser (Keying Lab).
 *
 *   1. detectKey      median of the border ring (generators rarely hit exact #FF00FF, and JPEG shifts it)
 *   2. matte          alpha from distance in the YCbCr chroma plane (luma weighted low) with a soft ramp
 *   3. decontaminate  solve C = a·F + (1−a)·K for F on edge pixels (removes the pink halo mathematically)
 *   4. despill        clamp residual magenta: spill = max(0, min(R,B) − G) — zero for brass, cyan, white, green
 *   5. choke          optional 0–2 px alpha erosion to kill JPEG ringing on the outline
 *   6. trim + resize  bbox of alpha > 8, pad, premultiplied box downsample to the master size
 *   7. QA             residual-magenta count, border-touch, coverage, key deviation → pass / warn / fail
 */

export interface Rgba { width: number; height: number; data: Uint8ClampedArray }
export interface KeyParams {
  /** Chroma distance below which a pixel is fully transparent. */
  inner: number;
  /** Chroma distance above which a pixel is fully opaque. */
  outer: number;
  /** Weight of luma difference relative to chroma (0 = pure chroma key). */
  lumaWeight: number;
  /** 0..1 strength of residual spill removal. */
  despill: number;
  /** Alpha erosion radius in px (0, 1, 2). */
  choke: number;
  /** Override the detected key colour. */
  key?: readonly [number, number, number];
}

export const DEFAULT_KEY_PARAMS: KeyParams = { inner: 38, outer: 92, lumaWeight: 0.25, despill: 1, choke: 1 };

export interface KeyQa {
  key: [number, number, number];
  keyDeviation: number;          // distance of detected key from pure #FF00FF
  coverage: number;              // Σalpha / area of trimmed box
  residualMagenta: number;       // opaque-ish pixels still reading as magenta
  borderTouch: number;           // opaque pixels on the raw image border (subject cropped by generator?)
  bbox: { x: number; y: number; w: number; h: number };
  verdict: 'pass' | 'warn' | 'fail';
  notes: string[];
}

const ycc = (r: number, g: number, b: number) => [
  0.299 * r + 0.587 * g + 0.114 * b,
  128 - 0.168736 * r - 0.331264 * g + 0.5 * b,
  128 + 0.5 * r - 0.418688 * g - 0.081312 * b,
] as const;

export function detectKey(img: Rgba): [number, number, number] {
  const { width: w, height: h, data } = img;
  const rs: number[] = [], gs: number[] = [], bs: number[] = [];
  const ring = Math.max(2, Math.round(Math.min(w, h) * 0.01));
  const step = Math.max(1, Math.floor((w + h) / 400));
  const push = (x: number, y: number) => { const i = (y * w + x) * 4; rs.push(data[i]); gs.push(data[i + 1]); bs.push(data[i + 2]); };
  for (let d = 0; d < ring; d++) {
    for (let x = 0; x < w; x += step) { push(x, d); push(x, h - 1 - d); }
    for (let y = 0; y < h; y += step) { push(d, y); push(w - 1 - d, y); }
  }
  const med = (a: number[]) => { const s = [...a].sort((p, q) => p - q); return s[s.length >> 1]; };
  return [med(rs), med(gs), med(bs)];
}

export const spillOf = (r: number, g: number, b: number) => Math.max(0, Math.min(r, b) - g);

export function chromaKey(src: Rgba, params: KeyParams = DEFAULT_KEY_PARAMS): { image: Rgba; alpha: Float32Array; key: [number, number, number] } {
  const { width: w, height: h, data } = src;
  const key = (params.key ? [...params.key] : detectKey(src)) as [number, number, number];
  const [ky, kcb, kcr] = ycc(key[0], key[1], key[2]);
  const alpha = new Float32Array(w * h);
  const span = Math.max(1, params.outer - params.inner);
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    const [y, cb, cr] = ycc(data[i], data[i + 1], data[i + 2]);
    const d = Math.hypot(cb - kcb, cr - kcr) + params.lumaWeight * Math.abs(y - ky);
    const t = Math.min(1, Math.max(0, (d - params.inner) / span));
    alpha[p] = t * t * (3 - 2 * t) * (data[i + 3] / 255);
  }
  // Choke: erode alpha by the minimum over a (2r+1)² neighbourhood, blended to keep edges soft.
  let a = alpha;
  for (let pass = 0; pass < params.choke; pass++) {
    const next = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let m = a[y * w + x];
      if (x > 0) m = Math.min(m, a[y * w + x - 1]);
      if (x < w - 1) m = Math.min(m, a[y * w + x + 1]);
      if (y > 0) m = Math.min(m, a[(y - 1) * w + x]);
      if (y < h - 1) m = Math.min(m, a[(y + 1) * w + x]);
      next[y * w + x] = (a[y * w + x] + m) / 2;
    }
    a = next;
  }
  const out = new Uint8ClampedArray(w * h * 4);
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    const al = a[p];
    if (al <= 0.004) continue; // fully keyed: leave transparent black
    let r = data[i], g = data[i + 1], b = data[i + 2];
    if (al < 0.98) {
      // Colour decontamination: F = (C − (1−a)K) / a
      const inv = 1 / Math.max(al, 0.08);
      r = (r - (1 - al) * key[0]) * inv; g = (g - (1 - al) * key[1]) * inv; b = (b - (1 - al) * key[2]) * inv;
      r = Math.min(255, Math.max(0, r)); g = Math.min(255, Math.max(0, g)); b = Math.min(255, Math.max(0, b));
    }
    const s = spillOf(r, g, b) * params.despill;
    out[i] = r - s; out[i + 1] = g; out[i + 2] = b - s; out[i + 3] = Math.round(al * 255);
  }
  return { image: { width: w, height: h, data: out }, alpha: a, key };
}

export function alphaBBox(img: Rgba, threshold = 8, pad = 2) {
  const { width: w, height: h, data } = img;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (data[(y * w + x) * 4 + 3] > threshold) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) return { x: 0, y: 0, w: 1, h: 1 };
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

export function crop(img: Rgba, box: { x: number; y: number; w: number; h: number }): Rgba {
  const out = new Uint8ClampedArray(box.w * box.h * 4);
  for (let y = 0; y < box.h; y++) out.set(img.data.subarray(((box.y + y) * img.width + box.x) * 4, ((box.y + y) * img.width + box.x + box.w) * 4), y * box.w * 4);
  return { width: box.w, height: box.h, data: out };
}

/** Premultiplied box-filter downsample so transparent pixels never bleed dark fringes into edges. */
export function downsample(img: Rgba, maxSide: number): Rgba {
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  if (scale >= 1) return img;
  const w = Math.max(1, Math.round(img.width * scale)), h = Math.max(1, Math.round(img.height * scale));
  const out = new Uint8ClampedArray(w * h * 4);
  const sx = img.width / w, sy = img.height / h;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let r = 0, g = 0, b = 0, a = 0, n = 0;
    const xs = Math.floor(x * sx), xe = Math.min(img.width, Math.ceil((x + 1) * sx));
    const ys = Math.floor(y * sy), ye = Math.min(img.height, Math.ceil((y + 1) * sy));
    for (let yy = ys; yy < ye; yy++) for (let xx = xs; xx < xe; xx++) {
      const i = (yy * img.width + xx) * 4, al = img.data[i + 3] / 255;
      r += img.data[i] * al; g += img.data[i + 1] * al; b += img.data[i + 2] * al; a += al; n++;
    }
    const o = (y * w + x) * 4;
    if (a > 0) { out[o] = r / a; out[o + 1] = g / a; out[o + 2] = b / a; }
    out[o + 3] = Math.round((a / n) * 255);
  }
  return { width: w, height: h, data: out };
}

export function qaReport(raw: Rgba, keyed: Rgba, key: [number, number, number]): KeyQa {
  const bbox = alphaBBox(keyed);
  const notes: string[] = [];
  let residual = 0, alphaSum = 0, border = 0;
  const { width: w, height: h, data } = keyed;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, a = data[i + 3];
    alphaSum += a / 255;
    if (a > 128 && spillOf(raw.data[i], raw.data[i + 1], raw.data[i + 2]) > 90 && raw.data[i + 1] < 90) residual++;
    if (a > 200 && (x === 0 || y === 0 || x === w - 1 || y === h - 1)) border++;
  }
  const keyDeviation = Math.round(Math.hypot(key[0] - 255, key[1], key[2] - 255));
  const coverage = alphaSum / (bbox.w * bbox.h);
  const residualPct = residual / Math.max(1, alphaSum);
  if (keyDeviation > 60) notes.push(`key drifted ${keyDeviation} from #FF00FF — regenerate or pass --key`);
  if (border > 0) notes.push(`${border} opaque px touch the frame — subject cropped by generator`);
  if (residualPct > 0.002) notes.push(`${(residualPct * 100).toFixed(2)}% of the subject reads as magenta — prompt leak (pink/purple in art)`);
  if (coverage < 0.12) notes.push('very sparse subject — check the matte thresholds');
  const verdict: KeyQa['verdict'] = border > 50 || residualPct > 0.01 ? 'fail' : notes.length ? 'warn' : 'pass';
  return { key, keyDeviation, coverage: Math.round(coverage * 1000) / 1000, residualMagenta: residual, borderTouch: border, bbox, verdict, notes };
}

/** Full pipeline used by the build script. */
export function keyPart(raw: Rgba, params: KeyParams = DEFAULT_KEY_PARAMS, masterSize = 512) {
  const keyed = chromaKey(raw, params);
  const qa = qaReport(raw, keyed.image, keyed.key);
  const trimmed = crop(keyed.image, qa.bbox);
  return { master: downsample(trimmed, masterSize), qa };
}
