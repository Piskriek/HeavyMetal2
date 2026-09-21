/**
 * Rebuild the 3D track / terrain texture set from hand-painted Warcraft-style masters.
 *
 * Reads painterly 1024x1024 masters from scratch/texture-masters/ (git-ignored),
 * downsamples them to the 512x512 runtime size, seals the opposing tile edges so the
 * repeat is seamless, and writes both runtime copies:
 *   - public/textures/<name>.png        (three.js renderer)
 *   - public/art/tracks/tex-<name>.png  (legacy track-3d-data path)
 *
 * It also synthesizes a matching grass fringe strip (painterly, palette-matched to the
 * new grass master) and writes it to:
 *   - public/textures/grass-fringe.png
 *   - public/art/decals/grass-fringe.png
 *
 * Usage: node scripts/generate-stylized-track-textures.mjs
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const root = fileURLToPath(new URL('../', import.meta.url));
const masterDir = join(root, 'scratch', 'texture-masters');
const texDir = join(root, 'public', 'textures');
const trackDir = join(root, 'public', 'art', 'tracks');
const decalDir = join(root, 'public', 'art', 'decals');

const TILE = 512;
const FRINGE_W = 1024;
const FRINGE_H = 256;

const TEXTURES = ['dirt', 'grass', 'cliff', 'caverock', 'lava', 'wood', 'cobble', 'iron', 'bark', 'water'];

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'buffer', maxBuffer: 1024 * 1024 * 512 });
  if (r.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} failed:\n${r.stderr?.toString()}`);
  }
  return r.stdout;
}

// Decode an image to raw RGBA at an exact size via ImageMagick.
// cropFrac trims the master's painted border frame (image models tend to add a pale
// torn-edge rim) so tile edges sample interior content.
function decodeRaw(src, w, h, cropFrac = 1) {
  const args = [src];
  if (cropFrac < 1) {
    args.push('-gravity', 'center', '-crop', `${Math.round(cropFrac * 100)}%x${Math.round(cropFrac * 100)}%+0+0`, '+repage');
  }
  args.push('-resize', `${w}x${h}^`, '-gravity', 'center', '-extent', `${w}x${h}`, '-depth', '8', 'rgba:-');
  const raw = run('convert', args);
  return new Uint8ClampedArray(raw.buffer, raw.byteOffset, raw.length);
}

function encodeRaw(data, w, h, dst) {
  const buf = Buffer.from(data.buffer, data.byteOffset, data.length);
  const tmp = join(tmpdir(), `hm2-tex-${Date.now()}-${Math.random().toString(36).slice(2)}.raw`);
  writeFileSync(tmp, buf);
  run('convert', ['-size', `${w}x${h}`, '-depth', '8', `rgba:${tmp}`, dst]);
}

// Smoothstep helper for blending weights.
const smooth = (t) => t * t * (3 - 2 * t);

// Seal opposing edges with an overlap cross-fade: the left band continues the right
// edge's content and blends into the head (and top continues the bottom), so the wrap
// is continuous without washed-out averaged strips.
function sealSeams(d, w, h, band) {
  const src = Uint8ClampedArray.from(d);
  // Horizontal: columns [0,band) = cross-fade from tail continuation into head.
  for (let x = 0; x < band; x++) {
    const t = smooth((x + 1) / band);
    for (let y = 0; y < h; y++) {
      const o = (y * w + x) * 4;
      const tail = (y * w + ((x + w - band) % w)) * 4;
      for (let c = 0; c < 4; c++) d[o + c] = src[tail + c] + (src[o + c] - src[tail + c]) * t;
    }
  }
  // Vertical: rows [0,band) = cross-fade from bottom continuation into top.
  const src2 = Uint8ClampedArray.from(d);
  for (let y = 0; y < band; y++) {
    const t = smooth((y + 1) / band);
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      const tail = (((y + h - band) % h) * w + x) * 4;
      for (let c = 0; c < 4; c++) d[o + c] = src2[tail + c] + (src2[o + c] - src2[tail + c]) * t;
    }
  }
}

function edgeDiff(d, w, h) {
  let max = 0;
  for (let y = 0; y < h; y++) {
    const l = (y * w) * 4, r = (y * w + w - 1) * 4;
    for (let c = 0; c < 3; c++) max = Math.max(max, Math.abs(d[l + c] - d[r + c]));
  }
  for (let x = 0; x < w; x++) {
    const t = x * 4, b = ((h - 1) * w + x) * 4;
    for (let c = 0; c < 3; c++) max = Math.max(max, Math.abs(d[t + c] - d[b + c]));
  }
  return max;
}

// Deterministic PRNG for the fringe blade field.
function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Synthesize a painterly grass fringe whose body is sampled from the new grass master.
function buildFringe(grassMasterPath) {
  // Sample the grass tile at fringe resolution for body colour.
  const grass = decodeRaw(grassMasterPath, FRINGE_W, FRINGE_H, 0.9);
  const d = new Uint8ClampedArray(FRINGE_W * FRINGE_H * 4);
  const rnd = mulberry(20260921);

  // Per-column blade height field: layered sines + jitter for an organic silhouette.
  const phase1 = rnd() * Math.PI * 2, phase2 = rnd() * Math.PI * 2, phase3 = rnd() * Math.PI * 2;
  const heights = new Float32Array(FRINGE_W);
  for (let x = 0; x < FRINGE_W; x++) {
    const t = (x / FRINGE_W) * Math.PI * 2;
    let hgt =
      0.46 +
      0.16 * Math.sin(t * 9 + phase1) +
      0.10 * Math.sin(t * 23 + phase2) +
      0.04 * Math.sin(t * 51 + phase3) +
      (rnd() - 0.5) * 0.04;
    heights[x] = Math.max(0.18, Math.min(0.92, hgt));
  }
  // Smooth the height field so blades read as broad painterly strokes, not spikes.
  for (let pass = 0; pass < 4; pass++) {
    for (let x = 0; x < FRINGE_W; x++) {
      const a = heights[(x + FRINGE_W - 1) % FRINGE_W], b = heights[(x + 1) % FRINGE_W];
      heights[x] = (a + heights[x] * 2 + b) / 4;
    }
  }

  for (let x = 0; x < FRINGE_W; x++) {
    const topFrac = 1 - heights[x]; // fraction of column that is transparent at top
    for (let y = 0; y < FRINGE_H; y++) {
      const i = (y * FRINGE_W + x) * 4;
      const yFrac = y / FRINGE_H;
      const edge = topFrac;
      const feather = 0.06;
      let a;
      if (yFrac < edge - feather) a = 0;
      else if (yFrac > edge + feather) a = 1;
      else a = smooth((yFrac - (edge - feather)) / (2 * feather));

      // Sample grass colour, biasing toward deeper root tones near the bottom.
      const gy = Math.min(FRINGE_H - 1, Math.floor(yFrac * FRINGE_H));
      const gi = (gy * FRINGE_W + x) * 4;
      d[i] = grass[gi]; d[i + 1] = grass[gi + 1]; d[i + 2] = grass[gi + 2];
      d[i + 3] = Math.round(a * 255);
    }
  }

  sealHorizontal(d, FRINGE_W, FRINGE_H, 24);
  bleedFringe(d, FRINGE_W, FRINGE_H);
  return d;
}

// Overlap cross-fade for the horizontal wrap only (strips repeat along the track).
function sealHorizontal(d, w, h, band) {
  const src = Uint8ClampedArray.from(d);
  for (let x = 0; x < band; x++) {
    const t = smooth((x + 1) / band);
    for (let y = 0; y < h; y++) {
      const o = (y * w + x) * 4;
      const tail = (y * w + ((x + w - band) % w)) * 4;
      for (let c = 0; c < 4; c++) d[o + c] = src[tail + c] + (src[o + c] - src[tail + c]) * t;
    }
  }
}

// Bleed the visible edge colour into adjacent transparent pixels (repo anti-halo
// convention, see scripts/fix-edge-magenta.mjs pass 8) so scaling never shows a halo.
function bleedFringe(d, w, h) {
  const src = Uint8ClampedArray.from(d);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (src[i + 3] !== 0) continue;
      let r = 0, g = 0, b = 0, n = 0, hasVisible = false;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          const j = (yy * w + xx) * 4;
          if (src[j + 3] === 0) continue;
          if (src[j + 3] >= 16) hasVisible = true;
          r += src[j]; g += src[j + 1]; b += src[j + 2]; n++;
        }
      }
      if (n && hasVisible) {
        d[i] = Math.round(r / n); d[i + 1] = Math.round(g / n); d[i + 2] = Math.round(b / n);
      }
    }
  }
}

// Key out a #FF00FF matte to alpha and despill the anti-aliased fringe so no magenta
// halo survives on the grass edges.
function keyMagenta(d) {
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const m = Math.min(r, b) - g; // magenta-ness
    let a = 1;
    if (m > 16) a = 1 - smooth(Math.min(1, (m - 16) / 64));
    if (m > 96) a = 0;
    // Despill: clamp the red/blue excess over green on surviving pixels.
    const cap = g + 36;
    d[i] = Math.min(r, cap);
    d[i + 2] = Math.min(b, cap);
    d[i + 3] = Math.round(a * 255);
  }
}

function main() {
  mkdirSync(texDir, { recursive: true });
  mkdirSync(trackDir, { recursive: true });
  mkdirSync(decalDir, { recursive: true });

  console.log('Rebuilding stylized track textures from masters...');
  for (const name of TEXTURES) {
    const master = join(masterDir, `${name}.png`);
    if (!existsSync(master)) {
      console.warn(`  ! missing master for ${name}, skipping`);
      continue;
    }
    const d = decodeRaw(master, TILE, TILE, 0.86);
    sealSeams(d, TILE, TILE, 24);
    const diff = edgeDiff(d, TILE, TILE);
    const texOut = join(texDir, `${name}.png`);
    const trackOut = join(trackDir, `tex-${name}.png`);
    encodeRaw(d, TILE, TILE, texOut);
    encodeRaw(d, TILE, TILE, trackOut);
    console.log(`  ✓ ${name.padEnd(9)} edge-diff=${diff}`);
  }

  // Fringe: prefer a painted master on a magenta matte; otherwise synthesize a
  // palette-matched strip from the new grass master.
  const fringeMaster = join(masterDir, 'fringe.png');
  const grassMaster = join(masterDir, 'grass.png');
  if (existsSync(fringeMaster)) {
    const fringe = decodeRaw(fringeMaster, FRINGE_W, FRINGE_H);
    keyMagenta(fringe);
    sealHorizontal(fringe, FRINGE_W, FRINGE_H, 24);
    bleedFringe(fringe, FRINGE_W, FRINGE_H);
    encodeRaw(fringe, FRINGE_W, FRINGE_H, join(texDir, 'grass-fringe.png'));
    encodeRaw(fringe, FRINGE_W, FRINGE_H, join(decalDir, 'grass-fringe.png'));
    console.log('  ✓ grass-fringe (painted master, magenta-keyed)');
  } else if (existsSync(grassMaster)) {
    const fringe = buildFringe(grassMaster);
    encodeRaw(fringe, FRINGE_W, FRINGE_H, join(texDir, 'grass-fringe.png'));
    encodeRaw(fringe, FRINGE_W, FRINGE_H, join(decalDir, 'grass-fringe.png'));
    console.log('  ✓ grass-fringe (palette-matched to new grass)');
  }

  console.log('Done.');
}

main();
