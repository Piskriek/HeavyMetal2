// Lists every inline data URL in the single-file build (apps/web/dist/index.html): its base64 size, the generated asset it
// carries (matched by content against apps/web/src/assets/gen/*.glb), the code that references that asset id (thumb-map.ts
// excluded, as its id lists are thumbnails only), and the totals. Run it before and after a change that moves models out.
//   node scripts/size-report.mjs
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'apps', 'web', 'dist', 'index.html');
const GEN = path.join(ROOT, 'apps', 'web', 'src', 'assets', 'gen');
const REGISTRY = path.join(GEN, 'registry.json');
const SEARCH_ROOTS = ['apps/web/src', 'packages', 'scripts'].map((p) => path.join(ROOT, p));
const SKIP_DIRS = new Set(['node_modules', 'dist', 'gen', '.git']);
const SKIP_FILES = new Set(['thumb-map.ts', 'registry.json', 'assets.json']);
const TEXT_EXT = /\.(ts|tsx|mjs|js|json)$/;

const sha = (buf) => crypto.createHash('sha1').update(buf).digest('hex');
const mib = (n) => (n / 1048576).toFixed(3);

// content hash -> label: the generated lows still on disk by asset id, and any other inlined .glb under apps/web/src by its path
const idByHash = new Map();
function scanGlbs(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, ent.name);
    if (ent.isDirectory()) scanGlbs(file);
    else if (ent.name.endsWith('.glb')) {
      const label = dir === GEN ? ent.name.slice(0, -4) : `${path.relative(ROOT, file).replace(/\\/g, '/')} (not a generated asset)`;
      idByHash.set(sha(fs.readFileSync(file)), label);
    }
  }
}
scanGlbs(path.join(ROOT, 'apps', 'web', 'src'));

const registry = JSON.parse(fs.readFileSync(REGISTRY, 'utf8'));
const movedOut = Object.entries(registry).filter(([, v]) => v.inline === false).map(([id]) => id);

// every source line that names an id, excluding thumb-map.ts, the registry and the gen folder
const sources = [];
function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.isDirectory()) {
      if (!SKIP_DIRS.has(ent.name)) walk(path.join(dir, ent.name));
    } else if (TEXT_EXT.test(ent.name) && !SKIP_FILES.has(ent.name)) {
      const file = path.join(dir, ent.name);
      sources.push({ rel: path.relative(ROOT, file).replace(/\\/g, '/'), lines: fs.readFileSync(file, 'utf8').split('\n') });
    }
  }
}
for (const root of SEARCH_ROOTS) if (fs.existsSync(root)) walk(root);

function refsOf(id) {
  const re = new RegExp(`(^|[^\\w-])${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\w-])`);
  const hits = [];
  for (const s of sources) {
    s.lines.forEach((line, i) => { if (re.test(line)) hits.push(`${s.rel}:${i + 1}`); });
  }
  return hits;
}

const html = fs.readFileSync(DIST, 'utf8');
const dataUrl = /data:([a-z0-9.+/-]+);base64,([A-Za-z0-9+/=]+)/g;
const rows = [];
const other = new Map();
for (const m of html.matchAll(dataUrl)) {
  const [, mime, b64] = m;
  if (mime !== 'model/gltf-binary') {
    const o = other.get(mime) ?? { n: 0, bytes: 0 };
    o.n += 1; o.bytes += b64.length; other.set(mime, o);
    continue;
  }
  const id = idByHash.get(sha(Buffer.from(b64, 'base64'))) ?? null;
  const generated = id !== null && !id.includes(' ');
  rows.push({ id, bytes: b64.length, refs: generated ? refsOf(id) : [] });
}
rows.sort((a, b) => b.bytes - a.bytes);

const modelBytes = rows.reduce((n, r) => n + r.bytes, 0);
const otherBytes = [...other.values()].reduce((n, o) => n + o.bytes, 0);
const dataBytes = modelBytes + otherBytes;
const total = fs.statSync(DIST).size;

console.log(`size-report: ${path.relative(ROOT, DIST).replace(/\\/g, '/')} = ${total} bytes (${mib(total)} MiB)`);
console.log('');
console.log('   #  base64 bytes  asset id                          referenced by (first three, thumb-map.ts excluded)');
rows.forEach((r, i) => {
  const refs = r.id !== null && r.id.includes(' ') ? '(not a generated asset: no registry id)'
    : r.refs.length === 0 ? '(no reference)'
      : `${r.refs.slice(0, 3).join(', ')}${r.refs.length > 3 ? ` (+${r.refs.length - 3})` : ''}`;
  console.log(`${String(i + 1).padStart(4)}  ${String(r.bytes).padStart(12)}  ${(r.id ?? '(unmatched)').padEnd(30)}  ${refs}`);
});
console.log('');
console.log('other inline data URLs:');
for (const [mime, o] of other) console.log(`  ${mime}: ${o.n} (${o.bytes} base64 bytes)`);
console.log('');
console.log('totals:');
console.log(`  inline models: ${rows.length} (${modelBytes} base64 bytes, ${mib(modelBytes)} MiB)`);
console.log(`  other data URLs: ${otherBytes} base64 bytes, ${mib(otherBytes)} MiB`);
console.log(`  all data URLs: ${dataBytes} base64 bytes, ${mib(dataBytes)} MiB; the rest of the file: ${total - dataBytes} bytes`);
console.log(`  registry entries moved to the HD pack (inline: false): ${movedOut.length}${movedOut.length ? ` (${movedOut.join(', ')})` : ''}`);
console.log(`  unmatched model data URLs: ${rows.filter((r) => r.id === null).length}`);
