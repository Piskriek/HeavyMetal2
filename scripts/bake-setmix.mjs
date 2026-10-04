// Bake the SetMix ground textures from their graphs (packages/texgraph/sets) into the files the terrain loads.
//   node --import tsx scripts/bake-setmix.mjs            (npm run bake:setmix)
// Writes, under apps/web/public/textures/setmix/:
//   <id>.webp        the painted (PBR) ground's colour, 512 px, sRGB (evaluated at twice that and averaged down: smooth edges)
//   maps/<id>.webp   R = height, G = roughness (the normal is made from the height when the game loads it)
//   voxel.webp       the voxel blocks' colour: one row per surface, VARIANTS block faces of 32 px across (seeds 0, 1000, 2000)
//   voxel-maps.webp  the same layout, R = height, G = roughness
//   graphs.json      both sets, for the in-game surface editor
// and packages/render/src/terrain/setmix-colours.ts: each tile's average colour (the maps of your islands, and what shows while a tile loads)
// --only <id> bakes just that ground tile (no voxel atlas); --graph <file.json> bakes it from that graph instead of its first style (trying a look).
// Every graph's own seeds and whole-number scales make the tiles seamless; nothing here blends edges.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { evaluateGraph } from '../packages/texgraph/src/index.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const out = `${root}apps/web/public/textures/setmix/`;
const ground = JSON.parse(readFileSync(`${root}packages/texgraph/sets/setmix-ground.json`, 'utf8'));
const voxel = JSON.parse(readFileSync(`${root}packages/texgraph/sets/setmix-voxel.json`, 'utf8'));
const SIZE = 512, SUPER = 2, VOXEL = 32, VARIANTS = 3;

const srgb = (v) => Math.round(255 * Math.min(1, Math.max(0, v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055)));
const byte = (v) => Math.round(255 * Math.min(1, Math.max(0, v)));
/** An evaluated tile averaged down by `by` (box filter): the graphs draw hard edges, and this antialiases them. */
function shrink(t, by) {
  if (by === 1) return t;
  const n = t.size / by, avg = (src, ch) => {
    if (!src) return src;
    const out = new Float32Array(n * n * ch);
    for (let y = 0; y < t.size; y++) for (let x = 0; x < t.size; x++) for (let c = 0; c < ch; c++) out[(Math.floor(y / by) * n + Math.floor(x / by)) * ch + c] += src[(y * t.size + x) * ch + c] / (by * by);
    return out;
  };
  return { size: n, albedo: avg(t.albedo, 3), height: avg(t.height, 1), roughness: avg(t.roughness, 1) };
}

/** Colour and maps of one evaluated tile into two RGBA images of width `w` at (ox, oy). */
function put(t, colour, maps, w, ox, oy) {
  for (let y = 0; y < t.size; y++) for (let x = 0; x < t.size; x++) {
    const i = y * t.size + x, o = ((oy + y) * w + ox + x) * 4;
    colour[o] = srgb(t.albedo[i * 3]); colour[o + 1] = srgb(t.albedo[i * 3 + 1]); colour[o + 2] = srgb(t.albedo[i * 3 + 2]); colour[o + 3] = 255;
    maps[o] = byte(t.height?.[i] ?? 0.5); maps[o + 1] = byte(t.roughness?.[i] ?? 0.85); maps[o + 2] = 0; maps[o + 3] = 255;
  }
}

const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'];
if (!chrome.some(existsSync)) { console.log('bake-setmix: Chrome is needed to encode webp; not found'); process.exit(1); }
const { chromium } = await import('playwright-core');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
/** Encode RGBA bytes as webp in the browser (lossy colour; quality 1 is lossless, used for the maps so the height stays exact). */
async function webp(rgba, w, h, quality) {
  const b64 = await page.evaluate(([data, w, h, q]) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const bytes = Uint8ClampedArray.from(atob(data), (ch) => ch.charCodeAt(0));
    c.getContext('2d').putImageData(new ImageData(bytes, w, h), 0, 0);
    return c.toDataURL('image/webp', q).split(',')[1];
  }, [Buffer.from(rgba).toString('base64'), w, h, quality]);
  return Buffer.from(b64, 'base64');
}

/** The average colour of an evaluated tile, as sRGB hex (averaged in linear light). */
const average = (t) => {
  const n = t.size * t.size, sum = [0, 0, 0];
  for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) sum[c] += t.albedo[i * 3 + c];
  return '#' + sum.map((v) => srgb(v / n).toString(16).padStart(2, '0')).join('');
};
const coloursFile = `${root}packages/render/src/terrain/setmix-colours.ts`;
const known = existsSync(coloursFile) ? JSON.parse(/= (\{.*\});/.exec(readFileSync(coloursFile, 'utf8'))?.[1] ?? '{}') : {};
const colours = { ground: { ...(known.ground ?? {}) }, voxel: { ...(known.voxel ?? {}) } };
const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };
const only = arg('--only'), tryGraph = arg('--graph');
mkdirSync(`${out}maps`, { recursive: true });
let bytes = 0;
const t0 = performance.now();
for (const s of ground.surfaces) {
  if (only && s.id !== only) continue;
  const graph = only && tryGraph ? JSON.parse(readFileSync(tryGraph, 'utf8')) : s.styles[0].graph;
  const t = shrink(evaluateGraph(graph, { size: SIZE * SUPER }), SUPER);
  const colour = new Uint8Array(SIZE * SIZE * 4), maps = new Uint8Array(SIZE * SIZE * 4);
  put(t, colour, maps, SIZE, 0, 0);
  colours.ground[s.id] = average(t);
  const c = await webp(colour, SIZE, SIZE, 0.9), m = await webp(maps, SIZE, SIZE, 1);
  writeFileSync(`${out}${s.id}.webp`, c); writeFileSync(`${out}maps/${s.id}.webp`, m);
  bytes += c.length + m.length;
}
const writeColours = () => writeFileSync(coloursFile, `// Written by scripts/bake-setmix.mjs (do not edit): the average colour of each SetMix ground tile and of each voxel face variant, by surface.
// The maps of your islands draw with these, and they show while a tile loads.
export const SETMIX_COLOURS: { readonly ground: Readonly<Record<string, string>>; readonly voxel: Readonly<Record<string, readonly string[]>> } = ${JSON.stringify(colours)};
`);
if (only) { writeColours(); await browser.close(); console.log(`bake-setmix: ${only} only`); process.exit(0); }
const vw = VOXEL * VARIANTS, vh = VOXEL * voxel.graphs.length;
const vc = new Uint8Array(vw * vh * 4), vm = new Uint8Array(vw * vh * 4);
voxel.graphs.forEach((g, row) => {
  const tones = [];
  for (let v = 0; v < VARIANTS; v++) { const t = evaluateGraph(g, { size: VOXEL, seed: v * 1000 }); put(t, vc, vm, vw, v * VOXEL, row * VOXEL); tones.push(average(t)); }
  colours.voxel[g.id.replace(/^voxel-/, '')] = tones;
});
const vcw = await webp(vc, vw, vh, 1), vmw = await webp(vm, vw, vh, 1);
writeFileSync(`${out}voxel.webp`, vcw); writeFileSync(`${out}voxel-maps.webp`, vmw);
bytes += vcw.length + vmw.length;
writeFileSync(`${out}graphs.json`, JSON.stringify({ ground, voxel }));
writeColours();
await browser.close();
console.log(`bake-setmix: ${ground.surfaces.length} ground tiles and ${voxel.graphs.length} x ${VARIANTS} voxel faces, ${Math.round(bytes / 1024)} KB, ${Math.round(performance.now() - t0)} ms`);
