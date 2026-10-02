// voxparts_body.ts — hand-designed voxel BODY parts for a goblin character creator.
// Shared format with the head-side file. Pure, deterministic, no imports.

export type V3 = [number, number, number];
export type Slot =
  'head'|'ears'|'nose'|'eyes'|'mouth'|'hair'|'hat'|'face-extra'|'torso'|'shirt'|'arms'|'hands'|'belt'|'legs'|'boots'|'back'|'handheld';
export type PaletteSlot =
  'skin'|'skinDark'|'skinLight'|'cloth1'|'cloth2'|'metal'|'leather'|'glow'|'hair'|'teeth'|'eyeWhite'|'pupil'|'accent';

export interface Part {
  id: string; slot: Slot; name: string; doc: string;
  size: V3; palette: PaletteSlot[]; cells: number[];
  anchors: Record<string, V3>; attachTo: string; tags: string[];
}

const SLOT_LIST: readonly string[] = ['head','ears','nose','eyes','mouth','hair','hat','face-extra','torso','shirt','arms','hands','belt','legs','boots','back','handheld'];
const PAL_LIST: readonly PaletteSlot[] = ['skin','skinDark','skinLight','cloth1','cloth2','metal','leather','glow','hair','teeth','eyeWhite','pupil','accent'];
const SLOT_SET = new Set<string>(SLOT_LIST);
const PAL_SET = new Set<string>(PAL_LIST);

// material codes = index into PAL_LIST + 1
const SKIN = 1, DARK = 2, LITE = 3, CL1 = 4, CL2 = 5, MET = 6, LEA = 7, GLO = 8, HAIR = 9, FANG = 10, ACC = 13;

interface Grid { sx: number; sy: number; sz: number; d: number[] }

function mkGrid(sx: number, sy: number, sz: number): Grid {
  return { sx, sy, sz, d: new Array<number>(sx * sy * sz).fill(0) };
}
function set(g: Grid, x: number, y: number, z: number, v: number): void {
  if (x < 0 || y < 0 || z < 0 || x >= g.sx || y >= g.sy || z >= g.sz) return;
  g.d[x + g.sx * (y + g.sy * z)] = v;
}
function box(g: Grid, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, v: number): void {
  const xa = Math.min(x0, x1), xb = Math.max(x0, x1), ya = Math.min(y0, y1), yb = Math.max(y0, y1), za = Math.min(z0, z1), zb = Math.max(z0, z1);
  for (let z = za; z <= zb; z++) for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) set(g, x, y, z, v);
}
function ellipsoid(g: Grid, cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, v: number): void {
  for (let z = Math.floor(cz - rz); z <= Math.ceil(cz + rz); z++)
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x - cx) / rx, ny = (y - cy) / ry, nz = (z - cz) / rz;
        if (nx * nx + ny * ny + nz * nz <= 1.0001) set(g, x, y, z, v);
      }
}
function sphere(g: Grid, cx: number, cy: number, cz: number, r: number, v: number): void { ellipsoid(g, cx, cy, cz, r, r, r, v); }
function cylinder(g: Grid, cx: number, cz: number, y0: number, y1: number, r: number, v: number): void {
  for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
    for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
        if ((x - cx) * (x - cx) + (z - cz) * (z - cz) <= r * r + 0.0001) set(g, x, y, z, v);
}
// 6-connected thick line: greedy single-axis steps so paths never break diagonally.
function line(g: Grid, a: V3, b: V3, v: number, t = 0): void {
  let x = a[0], y = a[1], z = a[2];
  box(g, x - t, y - t, z - t, x + t, y + t, z + t, v);
  let guard = 0;
  while ((x !== b[0] || y !== b[1] || z !== b[2]) && guard++ < 500) {
    const dx = b[0] - x, dy = b[1] - y, dz = b[2] - z;
    if (Math.abs(dx) >= Math.abs(dy) && Math.abs(dx) >= Math.abs(dz)) x += Math.sign(dx);
    else if (Math.abs(dy) >= Math.abs(dz)) y += Math.sign(dy);
    else z += Math.sign(dz);
    box(g, x - t, y - t, z - t, x + t, y + t, z + t, v);
  }
}
function mirrorX(g: Grid): Grid {
  const m = mkGrid(g.sx, g.sy, g.sz);
  for (let z = 0; z < g.sz; z++) for (let y = 0; y < g.sy; y++) for (let x = 0; x < g.sx; x++)
    m.d[x + g.sx * (y + g.sy * z)] = g.d[(g.sx - 1 - x) + g.sx * (y + g.sy * z)] ?? 0;
  return m;
}
// Make grid exactly mirror-symmetric in x (lower-x side wins on conflicts).
function symX(g: Grid): void {
  const m = mirrorX(g);
  for (let z = 0; z < g.sz; z++) for (let y = 0; y < g.sy; y++) for (let x = 0; x <= g.sx - 1 - x; x++) {
    const i = x + g.sx * (y + g.sy * z), j = (g.sx - 1 - x) + g.sx * (y + g.sy * z);
    const a = g.d[i] ?? 0, bb = m.d[i] ?? 0, v = a !== 0 ? a : bb;
    g.d[i] = v; g.d[j] = v;
  }
}
// hollow tube: outer box with the interior carved for the full y-range (open top/bottom)
function shell(g: Grid, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, v: number): void {
  box(g, x0, y0, z0, x1, y1, z1, v); box(g, x0 + 1, y0, z0 + 1, x1 - 1, y1, z1 - 1, 0);
}
function clampN(n: number, lo: number, hi: number): number { return n < lo ? lo : n > hi ? hi : n; }

function finish(g: Grid, id: string, slot: Slot, name: string, doc: string, attachTo: string, tags: string[], anchors: Record<string, V3>): Part {
  const used = new Set<number>();
  for (const v of g.d) if (v > 0) used.add(v);
  const palette: PaletteSlot[] = []; const remap = new Array<number>(PAL_LIST.length + 1).fill(0);
  for (let v = 1; v <= PAL_LIST.length; v++) {
    if (used.has(v)) { const ps = PAL_LIST[v - 1]; if (ps !== undefined) { palette.push(ps); remap[v] = palette.length; } }
  }
  const cells = g.d.map(v => remap[v] ?? 0);
  const a: Record<string, V3> = {};
  for (const [k, p] of Object.entries(anchors)) a[k] = [clampN(p[0], 0, g.sx - 1), clampN(p[1], 0, g.sy - 1), clampN(p[2], 0, g.sz - 1)];
  if (a['root'] === undefined) a['root'] = [(g.sx - 1) >> 1, 0, (g.sz - 1) >> 1];
  return { id, slot, name, doc, size: [g.sx, g.sy, g.sz], palette, cells, anchors: a, attachTo, tags: [...tags] };
}
function P(id: string, slot: Slot, name: string, doc: string, size: V3, attachTo: string, tags: string[], anchors: Record<string, V3>, build: (g: Grid) => void): Part {
  const g = mkGrid(size[0], size[1], size[2]);
  build(g);
  if (tags.includes('centred')) symX(g);
  return finish(g, id, slot, name, doc, attachTo, tags, anchors);
}

function componentsOf(sx: number, sy: number, sz: number, cells: number[]): number {
  const n = sx * sy * sz; const seen = new Array<boolean>(n).fill(false); let comp = 0;
  for (let s = 0; s < n; s++) {
    if (seen[s] || (cells[s] ?? 0) === 0) continue;
    comp++; const stack: number[] = [s]; seen[s] = true;
    while (stack.length > 0) {
      const c = stack.pop(); if (c === undefined) break;
      const x = c % sx, y = Math.floor(c / sx) % sy, z = Math.floor(c / (sx * sy));
      const nb: V3[] = [[x - 1, y, z], [x + 1, y, z], [x, y - 1, z], [x, y + 1, z], [x, y, z - 1], [x, y, z + 1]];
      for (const [nx, ny, nz] of nb) {
        if (nx < 0 || ny < 0 || nz < 0 || nx >= sx || ny >= sy || nz >= sz) continue;
        const ni = nx + sx * (ny + sy * nz);
        if (!seen[ni] && (cells[ni] ?? 0) !== 0) { seen[ni] = true; stack.push(ni); }
      }
    }
  }
  return comp;
}

export function validatePart(p: unknown): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (typeof p !== 'object' || p === null) return { ok: false, errors: ['not an object'] };
  const o = p as Record<string, unknown>;
  if (typeof o['id'] !== 'string' || o['id'].length === 0) errors.push('bad id');
  if (typeof o['slot'] !== 'string' || !SLOT_SET.has(o['slot'])) errors.push('bad slot');
  const size = o['size'];
  let sx = 0, sy = 0, sz = 0, sizeOk = false;
  if (Array.isArray(size) && size.length === 3 && size.every(n => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 40)) {
    sx = size[0] as number; sy = size[1] as number; sz = size[2] as number; sizeOk = true;
  } else errors.push('bad size');
  const pal = o['palette'];
  let palOk = false, palLen = 0;
  if (Array.isArray(pal) && pal.every(s => typeof s === 'string' && PAL_SET.has(s))) { palOk = true; palLen = pal.length; }
  else errors.push('bad palette');
  const cells = o['cells'];
  let cellsOk = false;
  if (Array.isArray(cells) && cells.every(v => typeof v === 'number' && Number.isInteger(v) && v >= 0)) {
    cellsOk = sizeOk && cells.length === sx * sy * sz;
    if (sizeOk && cells.length !== sx * sy * sz) errors.push('cells length mismatch');
    if (palOk && (cells as number[]).some(v => v > palLen)) { errors.push('cell value outside palette'); cellsOk = false; }
  } else errors.push('bad cells');
  const an = o['anchors'];
  if (typeof an !== 'object' || an === null || Array.isArray(an)) errors.push('bad anchors');
  else {
    const rec = an as Record<string, unknown>;
    if (!('root' in rec)) errors.push("missing 'root' anchor");
    for (const [k, v] of Object.entries(rec)) {
      if (!(Array.isArray(v) && v.length === 3 && v.every(n => typeof n === 'number' && Number.isInteger(n)))) { errors.push(`anchor ${k} malformed`); continue; }
      if (sizeOk) {
        const ax = v[0] as number, ay = v[1] as number, az = v[2] as number;
        if (ax < 0 || ay < 0 || az < 0 || ax >= sx || ay >= sy || az >= sz) errors.push(`anchor ${k} outside grid`);
      }
    }
  }
  if (cellsOk && palOk) {
    const cc = cells as number[]; const used = new Set<number>(); let filled = 0;
    for (const v of cc) if (v > 0) { used.add(v); filled++; }
    if (filled === 0) errors.push('empty part');
    for (let i = 1; i <= palLen; i++) if (!used.has(i)) errors.push(`unused palette entry ${i}`);
    if (filled > 0 && componentsOf(sx, sy, sz, cc) !== 1) errors.push('not 6-connected');
  }
  return { ok: errors.length === 0, errors };
}

export function partStats(p: Part): { voxels: number; bounds: { min: V3; max: V3 }; components: number } {
  const [sx, sy, sz] = p.size; let vox = 0;
  const mn: V3 = [sx, sy, sz], mx: V3 = [-1, -1, -1];
  for (let z = 0; z < sz; z++) for (let y = 0; y < sy; y++) for (let x = 0; x < sx; x++) {
    if ((p.cells[x + sx * (y + sy * z)] ?? 0) !== 0) {
      vox++;
      if (x < mn[0]) mn[0] = x; if (y < mn[1]) mn[1] = y; if (z < mn[2]) mn[2] = z;
      if (x > mx[0]) mx[0] = x; if (y > mx[1]) mx[1] = y; if (z > mx[2]) mx[2] = z;
    }
  }
  if (vox === 0) return { voxels: 0, bounds: { min: [0, 0, 0], max: [0, 0, 0] }, components: 0 };
  return { voxels: vox, bounds: { min: mn, max: mx }, components: componentsOf(sx, sy, sz, p.cells) };
}

const CHARS: Record<PaletteSlot, string> = { skin: 's', skinDark: 'd', skinLight: 'l', cloth1: 'c', cloth2: 'C', metal: 'm', leather: 'L', glow: '*', hair: 'h', teeth: 't', eyeWhite: 'w', pupil: 'p', accent: 'a' };
export function ascii(p: Part, y: number): string {
  const [sx, sy, sz] = p.size;
  if (y < 0 || y >= sy) return '';
  const rows: string[] = [];
  for (let z = 0; z < sz; z++) {
    let r = '';
    for (let x = 0; x < sx; x++) {
      const v = p.cells[x + sx * (y + sy * z)] ?? 0;
      if (v === 0) { r += '.'; continue; }
      const ps = p.palette[v - 1];
      r += ps === undefined ? '?' : CHARS[ps];
    }
    rows.push(r);
  }
  return rows.join('\n');
}

// ---- anchor templates ----
function TANCH(w: number, h: number, d: number): Record<string, V3> {
  const mx = (w - 1) >> 1, mz = (d - 1) >> 1;
  return { root: [mx, 0, mz], waist: [mx, 2, mz], neck: [mx, h - 1, mz], shoulderL: [w - 1, h - 3, mz], shoulderR: [0, h - 3, mz], hipL: [mx + 3, 0, mz], hipR: [mx - 3, 0, mz], backMount: [mx, Math.floor(h * 0.6), d - 1] };
}
function torso(id: string, name: string, doc: string, build: (g: Grid) => void, size: V3 = [12, 14, 8]): Part {
  return P(id, 'torso', name, doc, size, 'root', ['centred', 'torso'], TANCH(size[0], size[1], size[2]), build);
}
function shirt(id: string, name: string, doc: string, build: (g: Grid) => void): Part {
  return P(id, 'shirt', name, doc, [14, 15, 9], 'root', ['centred', 'shirt'], TANCH(14, 15, 9), build);
}
function armSet(id: string, name: string, doc: string, build: (g: Grid) => void): Part {
  return P(id, 'arms', name, doc, [6, 13, 6], 'shoulderL', ['pair', 'arm'], { root: [2, 12, 2], handSeat: [2, 0, 2], wrist: [2, 1, 2] }, build);
}
function handSet(id: string, name: string, doc: string, build: (g: Grid) => void): Part {
  return P(id, 'hands', name, doc, [5, 6, 6], 'handSeat', ['pair', 'hand'], { root: [2, 5, 2], palm: [2, 2, 0] }, build);
}
function beltP(id: string, name: string, doc: string, build: (g: Grid) => void, size: V3 = [14, 5, 10], rootY = 2): Part {
  return P(id, 'belt', name, doc, size, 'waist', ['centred', 'belt'], { root: [(size[0] - 1) >> 1, rootY, (size[2] - 1) >> 1] }, build);
}
function legSet(id: string, name: string, doc: string, build: (g: Grid) => void): Part {
  return P(id, 'legs', name, doc, [6, 15, 6], 'hipL', ['pair', 'leg'], { root: [2, 14, 2], ankle: [2, 1, 2], knee: [2, 8, 2] }, build);
}
function bootSet(id: string, name: string, doc: string, build: (g: Grid) => void): Part {
  return P(id, 'boots', name, doc, [5, 6, 9], 'ankle', ['pair', 'boot'], { root: [2, 5, 6], toe: [2, 0, 0] }, build);
}
function backP(id: string, name: string, doc: string, size: V3, root: V3, build: (g: Grid) => void): Part {
  return P(id, 'back', name, doc, size, 'backMount', ['centred', 'back'], { root }, build);
}
function held(id: string, name: string, doc: string, size: V3, grip: V3, build: (g: Grid) => void): Part {
  return P(id, 'handheld', name, doc, size, 'palm', ['held'], { root: grip, grip }, build);
}
function legBase(g: Grid): void { cylinder(g, 2, 2, 8, 14, 2.1, SKIN); cylinder(g, 2, 2, 0, 9, 1.7, SKIN); sphere(g, 2, 8, 2, 1.9, SKIN); }

// ---- the parts ----
const TORSOS: Part[] = [
  torso('torso_scrawny', 'Scrawny Torso', 'Bony gutter-goblin chest, every rib on show.', g => {
    box(g, 3, 0, 2, 8, 13, 5, SKIN); box(g, 4, 6, 2, 7, 6, 2, DARK); box(g, 4, 8, 2, 7, 8, 2, DARK);
    box(g, 4, 10, 2, 7, 10, 2, DARK); box(g, 5, 1, 5, 6, 12, 5, DARK); box(g, 4, 11, 2, 7, 12, 2, LITE);
  }),
  torso('torso_barrel', 'Barrel Chest', 'Huge proud keg of a chest, Warcraft bruiser style.', g => {
    ellipsoid(g, 5.5, 8, 3.5, 6, 6.2, 3.6, SKIN); box(g, 3, 0, 2, 8, 4, 5, SKIN);
    ellipsoid(g, 5.5, 9, 1.2, 3.4, 3.2, 1.4, LITE); box(g, 4, 3, 1, 7, 3, 1, DARK);
  }),
  torso('torso_hunched', 'Hunched Back', 'Stooped sneak with a big shoulder hump.', g => {
    box(g, 3, 0, 2, 8, 9, 5, SKIN); box(g, 3, 8, 1, 8, 13, 4, SKIN); sphere(g, 5.5, 10, 5, 2.8, SKIN);
    ellipsoid(g, 5.5, 11, 5.6, 2, 1.6, 1.4, DARK); box(g, 4, 9, 1, 7, 11, 1, LITE);
  }),
  torso('torso_athletic', 'Athletic', 'V-shaped scrapper torso with carved abs.', g => {
    box(g, 2, 7, 2, 9, 13, 5, SKIN); box(g, 3, 0, 2, 8, 8, 5, SKIN);
    box(g, 3, 10, 2, 4, 11, 2, LITE); box(g, 7, 10, 2, 8, 11, 2, LITE);
    box(g, 5, 2, 2, 6, 8, 2, DARK); box(g, 4, 4, 2, 7, 4, 2, DARK); box(g, 4, 6, 2, 7, 6, 2, DARK);
  }),
  torso('torso_belly', 'Round Belly', 'Well-fed market goblin with a proud round gut.', g => {
    box(g, 3, 7, 2, 8, 13, 5, SKIN); ellipsoid(g, 5.5, 4, 3.5, 4.6, 4.8, 3.4, SKIN);
    ellipsoid(g, 5.5, 4, 1.4, 2.2, 2.2, 1.2, LITE); set(g, 5, 4, 1, DARK); set(g, 6, 4, 1, DARK);
  }),
  torso('torso_plated', 'Plated Chest', 'Scrap-iron chest plate riveted straight on.', g => {
    box(g, 3, 0, 2, 8, 13, 5, SKIN); box(g, 2, 4, 1, 9, 12, 1, MET); box(g, 2, 11, 2, 9, 12, 2, MET);
    set(g, 3, 5, 0, ACC); set(g, 8, 5, 0, ACC); set(g, 3, 11, 0, ACC); set(g, 8, 11, 0, ACC);
  }),
  torso('torso_cyber', 'Cyber Ribs', 'Back-alley augments: glowing rib implants and a steel spine.', g => {
    box(g, 3, 0, 2, 8, 13, 5, SKIN); box(g, 4, 5, 1, 7, 5, 1, GLO); box(g, 4, 7, 1, 7, 7, 1, GLO);
    box(g, 4, 9, 1, 7, 9, 1, GLO); box(g, 5, 2, 6, 6, 12, 6, MET); set(g, 5, 12, 6, ACC); set(g, 6, 12, 6, ACC); box(g, 4, 11, 2, 7, 11, 2, DARK);
  }),
  torso('torso_child', 'Child Size', 'Tiny whelp torso for the smallest goblins.', g => {
    box(g, 2, 0, 1, 7, 9, 4, SKIN); ellipsoid(g, 4.5, 3, 0.9, 2.4, 2.4, 1, LITE); box(g, 3, 7, 1, 6, 7, 1, DARK);
  }, [10, 10, 6]),
];

const SHIRTS: Part[] = [
  shirt('shirt_vest', 'Ragged Leather Vest', 'Open scavenged vest, nicked hems, bone toggles.', g => {
    shell(g, 2, 0, 1, 11, 10, 7, LEA); box(g, 6, 0, 1, 7, 10, 1, 0); box(g, 2, 10, 2, 4, 11, 6, LEA);
    set(g, 3, 0, 1, 0); set(g, 10, 0, 1, 0); set(g, 2, 0, 5, 0); set(g, 11, 0, 5, 0);
    set(g, 4, 6, 1, ACC); set(g, 4, 3, 1, ACC);
  }),
  shirt('shirt_tunic', 'Courier Tunic', 'Blue courier jacket, satchel strap and brass buttons.', g => {
    shell(g, 2, 0, 1, 11, 11, 7, CL1);
    line(g, [2, 11, 1], [11, 1, 1], LEA, 0); line(g, [2, 11, 7], [11, 1, 7], LEA, 0); box(g, 2, 11, 1, 2, 11, 7, LEA);
    set(g, 6, 2, 0, ACC); set(g, 6, 4, 0, ACC); set(g, 6, 6, 0, ACC); set(g, 6, 8, 0, ACC);
  }),
  shirt('shirt_cloak', 'Traveler Cloak', 'Heavy road cloak, open at the front, bright clasp.', g => {
    shell(g, 2, 0, 1, 11, 12, 7, CL2); box(g, 2, 0, 8, 11, 12, 8, CL2);
    box(g, 5, 0, 1, 8, 8, 1, 0); set(g, 6, 11, 0, ACC); set(g, 6, 10, 0, ACC);
  }),
  shirt('shirt_hoodie', 'Hoodie', 'Slouchy hoodie with a kangaroo pocket.', g => {
    shell(g, 2, 0, 1, 11, 11, 7, CL1); box(g, 3, 11, 5, 10, 13, 8, CL1); box(g, 4, 12, 6, 9, 13, 8, 0);
    box(g, 4, 2, 0, 9, 5, 0, CL2); set(g, 5, 10, 0, ACC); set(g, 8, 10, 0, ACC);
  }),
  shirt('shirt_mail', 'Mail Shirt', 'Clinking mail with a cloth collar and leather hem.', g => {
    shell(g, 2, 0, 1, 11, 11, 7, MET); shell(g, 2, 0, 1, 11, 0, 7, LEA); shell(g, 2, 10, 1, 11, 11, 7, CL2);
    set(g, 5, 5, 1, ACC); set(g, 5, 7, 1, ACC); set(g, 5, 3, 1, ACC); set(g, 4, 6, 1, ACC); set(g, 4, 4, 1, ACC);
  }),
  shirt('shirt_robe', 'Woven Robe', 'Long tinker-priest robe with a bright front band.', g => {
    shell(g, 1, 0, 1, 12, 13, 7, CL2); shell(g, 1, 0, 1, 12, 1, 7, ACC); box(g, 6, 0, 1, 7, 13, 1, CL1);
  }),
  shirt('shirt_racing', 'Racing Suit', 'Grand-prix goblin suit with a go-faster stripe.', g => {
    shell(g, 2, 0, 1, 11, 11, 7, CL1); box(g, 6, 0, 1, 7, 11, 1, ACC); box(g, 6, 0, 7, 7, 11, 7, ACC);
    box(g, 3, 5, 1, 4, 7, 1, CL2); shell(g, 2, 11, 1, 11, 11, 7, MET);
  }),
  shirt('shirt_bandolier', 'Bare Bandolier', 'No shirt, just crossed straps and a belly pouch.', g => {
    line(g, [2, 13, 1], [11, 1, 1], LEA, 0); line(g, [2, 13, 7], [11, 1, 7], LEA, 0);
    box(g, 2, 13, 1, 2, 13, 7, LEA); box(g, 11, 1, 1, 11, 1, 7, LEA);
    box(g, 4, 7, 0, 6, 9, 0, CL2); set(g, 5, 8, 0, ACC);
  }),
];

const ARMS: Part[] = [
  armSet('arms_wiry', 'Wiry Arms', 'Long stringy sneak-thief arms.', g => {
    box(g, 1, 0, 1, 3, 12, 3, SKIN); box(g, 1, 6, 1, 3, 6, 3, DARK); sphere(g, 2, 11, 2, 1.9, SKIN); box(g, 1, 9, 1, 1, 11, 3, LITE);
  }),
  armSet('arms_brawny', 'Brawny Arms', 'Thick dockworker arms with a proud bicep.', g => {
    cylinder(g, 2, 2, 6, 12, 2.2, SKIN); cylinder(g, 2, 2, 0, 7, 1.6, SKIN); ellipsoid(g, 2, 9, 1, 1.4, 1.6, 1, LITE); box(g, 1, 6, 3, 3, 6, 3, DARK);
  }),
  armSet('arms_sleeved', 'Sleeved Arms', 'Rolled cloth sleeve with a chunky cuff.', g => {
    box(g, 1, 0, 1, 3, 7, 3, SKIN); box(g, 1, 5, 1, 3, 12, 3, CL1); box(g, 0, 5, 0, 4, 6, 4, CL2);
  }),
  armSet('arms_plated', 'Plated Arms', 'Pauldron and bracer bolted over green muscle.', g => {
    box(g, 1, 0, 1, 3, 12, 3, SKIN); sphere(g, 2, 11.5, 2, 2.4, MET); box(g, 0, 1, 0, 4, 4, 4, MET);
    set(g, 2, 11, 0, ACC); set(g, 2, 3, 0, ACC);
  }),
  armSet('arms_cyber', 'Cyber Arms', 'Full chrome replacement with a glow seam.', g => {
    box(g, 1, 0, 1, 3, 12, 3, MET); box(g, 2, 1, 1, 2, 11, 1, GLO); box(g, 1, 6, 1, 3, 6, 3, ACC);
  }),
  armSet('arms_shaggy', 'Shaggy Arms', 'Scruffy arms with tufts of wiry fur.', g => {
    box(g, 1, 0, 1, 3, 12, 3, SKIN); set(g, 0, 11, 2, HAIR); set(g, 0, 9, 2, HAIR); set(g, 0, 7, 1, HAIR);
    set(g, 4, 10, 2, HAIR); set(g, 4, 8, 2, HAIR); box(g, 1, 12, 0, 3, 12, 4, HAIR);
  }),
];

const HANDS: Part[] = [
  handSet('hands_clawed', 'Clawed Hands', 'Grabby mitts tipped with yellow claws.', g => {
    box(g, 0, 0, 2, 4, 5, 5, SKIN); box(g, 0, 1, 0, 0, 2, 1, FANG); box(g, 2, 1, 0, 2, 2, 1, FANG);
    box(g, 4, 1, 0, 4, 2, 1, FANG); box(g, 0, 3, 2, 4, 3, 2, DARK);
  }),
  handSet('hands_fist', 'Heavy Fists', 'Knuckly brawler fists.', g => {
    box(g, 0, 0, 1, 4, 5, 4, SKIN); box(g, 1, 1, 1, 1, 4, 1, DARK); box(g, 3, 1, 1, 3, 4, 1, DARK); box(g, 4, 2, 2, 4, 4, 3, LITE);
  }),
  handSet('hands_gloved', 'Work Gloves', 'Patched cloth gloves with big cuffs.', g => {
    box(g, 0, 0, 1, 4, 3, 4, CL1); box(g, 0, 4, 0, 4, 5, 5, CL2); set(g, 2, 2, 1, ACC); set(g, 2, 1, 1, ACC);
  }),
  handSet('hands_gauntlet', 'Iron Gauntlets', 'Scrap gauntlets with knuckle studs.', g => {
    box(g, 0, 0, 1, 4, 5, 4, MET); set(g, 1, 2, 0, ACC); set(g, 3, 2, 0, ACC); box(g, 0, 5, 0, 4, 5, 5, LEA);
  }),
  handSet('hands_threefinger', 'Three-Finger Hands', 'Classic cartoon three-finger grabbers.', g => {
    box(g, 0, 2, 2, 4, 5, 5, SKIN); box(g, 0, 0, 2, 0, 2, 4, SKIN); box(g, 2, 0, 2, 2, 2, 4, SKIN);
    box(g, 4, 0, 2, 4, 2, 4, SKIN); box(g, 0, 2, 2, 4, 2, 2, DARK);
  }),
  handSet('hands_open', 'Open Hands', 'Flat open palms, ready to wave or shove.', g => {
    box(g, 0, 0, 1, 4, 5, 2, SKIN); box(g, 1, 0, 1, 1, 2, 1, DARK); box(g, 3, 0, 1, 3, 2, 1, DARK);
    box(g, 4, 2, 3, 4, 4, 4, SKIN); box(g, 0, 4, 1, 4, 4, 1, LITE);
  }),
];

const BELTS: Part[] = [
  beltP('belt_buckle', 'Buckle Belt', 'Wide leather belt with a square iron buckle.', g => {
    shell(g, 1, 1, 1, 12, 3, 8, LEA); box(g, 5, 1, 0, 8, 3, 0, MET); set(g, 6, 2, 0, ACC); set(g, 7, 2, 0, ACC);
  }),
  beltP('belt_rope', 'Rope Belt', 'Twisted rope with a fat knot and loose ends.', g => {
    shell(g, 1, 1, 1, 12, 2, 8, HAIR); box(g, 5, 1, 0, 8, 2, 0, HAIR); box(g, 6, 0, 0, 7, 0, 0, HAIR);
  }),
  beltP('belt_pouches', 'Utility Pouches', 'Tinker belt hung with stuffed pouches.', g => {
    shell(g, 1, 1, 1, 12, 3, 8, LEA); box(g, 2, 0, 0, 4, 2, 0, CL2); set(g, 3, 1, 0, ACC); box(g, 5, 0, 9, 8, 2, 9, CL2);
  }),
  beltP('belt_sash', 'Silk Sash', 'Looted silk sash with hanging knotted tails.', g => {
    shell(g, 1, 5, 1, 12, 7, 8, CL1); box(g, 3, 0, 1, 5, 5, 1, CL1); box(g, 3, 2, 0, 5, 3, 0, ACC);
  }, [14, 8, 10], 6),
  beltP('belt_armoured', 'Armoured Belt', 'Banded iron girdle with a boss plate.', g => {
    shell(g, 1, 1, 1, 12, 3, 8, MET); shell(g, 1, 0, 1, 12, 0, 8, LEA); set(g, 4, 2, 1, ACC); set(g, 3, 2, 1, ACC); box(g, 5, 1, 0, 8, 3, 0, ACC);
  }),
  beltP('belt_bandolier', 'Shell Bandolier', 'Belt of brass shells and a back pouch.', g => {
    shell(g, 1, 1, 1, 12, 3, 8, LEA); set(g, 3, 1, 0, MET); set(g, 5, 1, 0, MET); set(g, 3, 2, 0, ACC); set(g, 5, 2, 0, ACC); box(g, 2, 0, 9, 5, 1, 9, CL2);
  }),
];

const LEGS: Part[] = [
  legSet('legs_knobby', 'Knobby Bare Legs', 'Skinny bare legs with big knobbly knees.', g => {
    legBase(g); sphere(g, 2, 8, 1, 1.2, LITE); box(g, 1, 8, 3, 3, 8, 3, DARK);
  }),
  legSet('legs_trousers', 'Patched Trousers', 'Workaday trousers with a knee patch.', g => {
    legBase(g); cylinder(g, 2, 2, 4, 14, 2.2, CL1); box(g, 0, 4, 0, 4, 4, 4, CL2); box(g, 3, 10, 0, 4, 11, 1, CL2);
  }),
  legSet('legs_shorts', 'Baggy Shorts', 'Knee-free baggy shorts with a rolled hem.', g => {
    legBase(g); cylinder(g, 2, 2, 10, 14, 2.4, CL1); box(g, 0, 10, 0, 4, 10, 4, CL2);
  }),
  legSet('legs_greaves', 'Armoured Greaves', 'Iron shin greaves and a kneecap dome.', g => {
    legBase(g); cylinder(g, 2, 2, 1, 7, 2.0, MET); sphere(g, 2, 8, 1.4, 1.5, MET); set(g, 2, 5, 0, ACC); set(g, 2, 3, 0, ACC);
  }),
  legSet('legs_tattered', 'Tattered Leggings', 'Chewed-up leggings full of holes.', g => {
    legBase(g); cylinder(g, 2, 2, 6, 14, 2.2, CL2); set(g, 0, 6, 2, 0); set(g, 4, 6, 2, 0); set(g, 2, 6, 0, 0); set(g, 2, 7, 4, 0); set(g, 2, 10, 0, ACC);
  }),
  legSet('legs_socks', 'Striped Socks', 'Bare thighs over loud striped socks.', g => {
    legBase(g); for (let y = 0; y <= 6; y++) cylinder(g, 2, 2, y, y, 1.9, y % 2 === 0 ? CL1 : CL2);
  }),
  legSet('legs_bootcut', 'Boot-Cut Legs', 'Legs with tall leather uppers built in.', g => {
    legBase(g); cylinder(g, 2, 2, 0, 5, 2.1, LEA); box(g, 0, 5, 0, 4, 5, 4, LEA); set(g, 2, 4, 0, MET);
  }),
  P('legs_skirt', 'legs', 'Robe Skirt', 'Centred tiered robe skirt, no legs showing.', [14, 12, 10], 'waist', ['centred', 'leg'],
    { root: [6, 11, 4], ankle: [6, 0, 4] }, g => {
      shell(g, 1, 0, 1, 12, 4, 8, CL2); shell(g, 2, 4, 2, 11, 8, 7, CL2); shell(g, 3, 8, 3, 10, 11, 6, CL1); shell(g, 1, 0, 1, 12, 0, 8, ACC);
    }),
];

const BOOTS: Part[] = [
  bootSet('boots_leather', 'Leather Boots', 'Worn leather boots with a side buckle.', g => {
    box(g, 0, 0, 0, 4, 0, 8, LEA); box(g, 0, 1, 0, 4, 2, 8, LEA); box(g, 0, 3, 4, 4, 5, 8, LEA);
    set(g, 0, 4, 6, MET); set(g, 4, 4, 6, MET); box(g, 0, 5, 4, 4, 5, 8, CL2);
  }),
  bootSet('boots_sandals', 'Rope Sandals', 'Flat soles tied on with rope straps.', g => {
    box(g, 0, 0, 0, 4, 0, 8, LEA); box(g, 1, 1, 3, 3, 2, 8, SKIN); box(g, 1, 1, 0, 3, 1, 1, SKIN);
    box(g, 0, 1, 2, 4, 1, 2, HAIR); box(g, 0, 1, 6, 4, 2, 6, HAIR);
  }),
  bootSet('boots_iron', 'Iron Sabatons', 'Stomping iron boots with a toe ridge.', g => {
    box(g, 0, 0, 0, 4, 0, 8, MET); box(g, 0, 1, 0, 4, 2, 8, MET); box(g, 0, 3, 4, 4, 5, 8, MET);
    box(g, 0, 1, 0, 4, 2, 0, ACC); box(g, 2, 3, 4, 2, 5, 4, ACC); box(g, 0, 5, 4, 4, 5, 8, LEA);
  }),
  bootSet('boots_clawfeet', 'Bare Claw Feet', 'Wide bare feet ending in three claws.', g => {
    box(g, 0, 0, 1, 4, 1, 8, SKIN); box(g, 1, 2, 5, 3, 5, 8, SKIN); set(g, 0, 0, 0, FANG); set(g, 2, 0, 0, FANG);
    set(g, 4, 0, 0, FANG); box(g, 1, 1, 1, 3, 1, 2, LITE);
  }),
  bootSet('boots_sneakers', 'Scrap Sneakers', 'Stitched-together sneakers with a side flash.', g => {
    box(g, 0, 0, 0, 4, 0, 8, CL2); box(g, 0, 1, 0, 4, 2, 8, CL1); box(g, 1, 3, 1, 3, 3, 3, CL1);
    box(g, 0, 1, 4, 0, 1, 7, ACC); box(g, 4, 1, 4, 4, 1, 7, ACC); set(g, 2, 3, 2, CL2); box(g, 0, 3, 4, 4, 5, 8, CL1);
  }),
  bootSet('boots_wellies', 'Rubber Wellies', 'Tall swamp wellies with a folded top.', g => {
    box(g, 0, 0, 0, 4, 0, 8, LEA); box(g, 0, 1, 0, 4, 2, 8, CL2); box(g, 0, 3, 4, 4, 5, 8, CL2);
    box(g, 0, 5, 4, 4, 5, 8, CL1); set(g, 2, 2, 0, ACC);
  }),
];

const BACKS: Part[] = [
  backP('back_satchel', 'Satchel', 'Soft leather satchel with a buttoned flap.', [12, 12, 6], [5, 4, 0], g => {
    box(g, 2, 2, 1, 9, 7, 4, LEA); box(g, 2, 5, 5, 9, 7, 5, CL2); set(g, 4, 4, 5, ACC); box(g, 5, 8, 1, 6, 9, 4, LEA);
  }),
  backP('back_backpack', 'Backpack', 'Big adventure pack with an outer pocket.', [12, 12, 6], [5, 5, 0], g => {
    box(g, 2, 1, 1, 9, 10, 4, CL1); box(g, 3, 2, 5, 8, 6, 5, CL2); box(g, 2, 8, 1, 9, 10, 5, LEA);
    set(g, 4, 6, 5, ACC); box(g, 3, 10, 1, 4, 11, 4, LEA);
  }),
  backP('back_quiver', 'Quiver', 'Leather quiver bristling with arrows.', [12, 12, 6], [5, 5, 0], g => {
    cylinder(g, 5.5, 3, 0, 9, 2.1, LEA); cylinder(g, 5.5, 3, 9, 9, 2.4, ACC); box(g, 4, 7, 3, 4, 10, 3, HAIR); set(g, 4, 11, 3, FANG);
  }),
  backP('back_wings', 'Wing Stubs', 'Vestigial bat-wing stubs on a strap plate.', [12, 12, 3], [5, 6, 0], g => {
    box(g, 4, 4, 0, 7, 8, 1, LEA); ellipsoid(g, 9, 7, 1, 2.6, 3.2, 1.2, SKIN); ellipsoid(g, 9.6, 6.4, 1, 1.6, 2, 1.2, DARK); set(g, 11, 10, 1, FANG);
  }),
  backP('back_jetpack', 'Jetpack', 'Twin-tank bootleg jetpack, flames on.', [12, 12, 6], [5, 6, 0], g => {
    cylinder(g, 8, 2, 2, 10, 1.8, MET); box(g, 3, 4, 0, 8, 8, 1, MET); cylinder(g, 8, 2, 1, 1, 2.0, ACC); cylinder(g, 8, 2, 0, 0, 1.4, GLO);
  }),
  backP('back_cape', 'Cape', 'Flowing cape clipped at the shoulders.', [12, 16, 4], [5, 14, 0], g => {
    box(g, 1, 0, 2, 10, 13, 2, CL2); box(g, 2, 13, 0, 9, 14, 2, CL2); box(g, 1, 0, 2, 10, 1, 2, ACC); set(g, 3, 14, 0, MET);
  }),
  backP('back_scrolltube', 'Scroll Tube', 'Capped map tube slung on a strap.', [12, 12, 5], [5, 5, 0], g => {
    cylinder(g, 5.5, 2, 1, 10, 1.7, LEA); cylinder(g, 5.5, 2, 0, 0, 2.0, MET); cylinder(g, 5.5, 2, 10, 11, 2.0, MET);
    cylinder(g, 5.5, 2, 5, 5, 1.9, ACC); box(g, 5, 5, 0, 6, 5, 0, LEA);
  }),
  backP('back_shield', 'Back Shield', 'Round shield slung across the back.', [12, 12, 5], [5, 6, 0], g => {
    ellipsoid(g, 5.5, 6, 1.5, 5.4, 5.4, 1.6, MET); ellipsoid(g, 5.5, 6, 1.5, 4.2, 4.2, 1.3, LEA); sphere(g, 5.5, 6, 3, 1.8, MET);
    set(g, 5, 10, 1, ACC); set(g, 5, 2, 1, ACC); set(g, 1, 6, 1, ACC);
  }),
];

const HELD: Part[] = [
  held('held_shield', 'Round Shield', 'Small wooden buckler with an iron rim and boss.', [9, 9, 4], [4, 4, 3], g => {
    ellipsoid(g, 4, 4, 1, 4.4, 4.4, 1.5, MET); ellipsoid(g, 4, 4, 1, 3.2, 3.2, 1.2, LEA); sphere(g, 4, 4, 0, 1.6, MET);
    box(g, 3, 3, 3, 5, 5, 3, LEA); set(g, 4, 7, 1, ACC); set(g, 4, 1, 1, ACC); set(g, 1, 4, 1, ACC); set(g, 7, 4, 1, ACC);
  }),
  held('held_dagger', 'Dagger', 'Quick stabbing dagger with a brass fuller.', [6, 14, 3], [2, 1, 0], g => {
    box(g, 2, 0, 0, 3, 3, 1, LEA); box(g, 2, 0, 0, 3, 0, 1, ACC); box(g, 0, 4, 0, 5, 4, 1, MET);
    box(g, 2, 5, 0, 3, 11, 1, MET); box(g, 2, 12, 0, 3, 12, 0, MET); set(g, 2, 13, 0, MET); box(g, 2, 5, 0, 2, 10, 0, ACC);
  }),
  held('held_club', 'Club', 'Knotted wooden club with iron studs.', [7, 14, 7], [3, 2, 3], g => {
    cylinder(g, 3, 3, 0, 6, 1.2, LEA); ellipsoid(g, 3, 9, 3, 3, 4.4, 3, LEA); set(g, 3, 13, 3, MET);
    set(g, 1, 10, 1, MET); set(g, 5, 10, 1, MET); cylinder(g, 3, 3, 1, 2, 1.3, ACC);
  }),
  held('held_torch', 'Torch', 'Pitch torch with a crackling glow flame.', [5, 12, 5], [2, 1, 2], g => {
    box(g, 2, 0, 2, 2, 7, 2, LEA); box(g, 1, 2, 1, 3, 2, 3, LEA); ellipsoid(g, 2, 8, 2, 1.9, 2.8, 1.9, GLO);
    set(g, 2, 8, 2, ACC); set(g, 2, 7, 2, ACC);
  }),
  held('held_scroll', 'Map Scroll', 'Rolled treasure map with end caps and a band.', [9, 4, 4], [4, 1, 1], g => {
    box(g, 0, 0, 0, 8, 2, 2, CL2); box(g, 0, 0, 0, 0, 2, 2, ACC); box(g, 8, 0, 0, 8, 2, 2, ACC); box(g, 4, 0, 0, 4, 2, 2, LEA);
  }),
  held('held_lantern', 'Lantern', 'Iron cage lantern glowing warm inside.', [7, 10, 7], [3, 8, 3], g => {
    box(g, 1, 0, 1, 5, 0, 5, MET); box(g, 1, 1, 1, 1, 5, 1, MET); box(g, 5, 1, 1, 5, 5, 1, MET);
    box(g, 1, 1, 5, 1, 5, 5, MET); box(g, 5, 1, 5, 5, 5, 5, MET); box(g, 1, 6, 1, 5, 6, 5, MET);
    box(g, 2, 1, 2, 4, 5, 4, GLO); box(g, 2, 7, 3, 2, 8, 3, MET); box(g, 4, 7, 3, 4, 8, 3, MET);
    box(g, 2, 9, 3, 4, 9, 3, MET); set(g, 3, 6, 3, ACC);
  }),
  held('held_wrench', 'Wrench', 'Oversized tinker wrench with a taped grip.', [7, 13, 3], [3, 2, 0], g => {
    box(g, 2, 0, 0, 4, 8, 1, MET); box(g, 1, 9, 0, 5, 10, 1, MET); box(g, 1, 11, 0, 2, 12, 1, MET);
    box(g, 4, 11, 0, 5, 12, 1, MET); box(g, 2, 0, 0, 4, 2, 1, LEA); set(g, 3, 6, 0, ACC);
  }),
  held('held_flag', 'Racing Flag', 'Checkered race flag on an iron pole.', [12, 14, 2], [0, 3, 0], g => {
    box(g, 0, 0, 0, 0, 13, 1, MET); box(g, 1, 7, 0, 10, 12, 0, CL1); box(g, 1, 10, 0, 3, 12, 0, CL2);
    box(g, 4, 7, 0, 6, 9, 0, CL2); box(g, 7, 10, 0, 9, 12, 0, CL2); box(g, 10, 7, 0, 10, 9, 0, CL2); set(g, 0, 13, 0, ACC);
  }),
  held('held_trophy', 'Trophy', 'Gleaming loot-cup trophy with two handles.', [9, 12, 9], [4, 3, 4], g => {
    box(g, 2, 0, 2, 6, 1, 6, MET); box(g, 4, 2, 4, 4, 4, 4, MET); ellipsoid(g, 4, 7, 4, 3.4, 2.8, 3.4, ACC);
    ellipsoid(g, 4, 8.4, 4, 2.4, 2.2, 2.4, 0); box(g, 0, 7, 4, 0, 8, 4, ACC); box(g, 8, 7, 4, 8, 8, 4, ACC);
    set(g, 1, 6, 4, ACC); set(g, 7, 6, 4, ACC);
  }),
  held('held_bomb', 'Bomb', 'Round iron bomb, fuse lit and sparking.', [8, 11, 8], [3, 4, 3], g => {
    sphere(g, 3.5, 4, 3.5, 3.6, MET); box(g, 0, 4, 3, 7, 4, 4, ACC); box(g, 3, 8, 3, 4, 8, 4, LEA);
    box(g, 3, 9, 3, 4, 9, 4, GLO); box(g, 2, 5, 2, 2, 6, 2, LITE);
  }),
];

export const BODY_PARTS: Part[] = [...TORSOS, ...SHIRTS, ...ARMS, ...HANDS, ...BELTS, ...LEGS, ...BOOTS, ...BACKS, ...HELD];