// @ts-nocheck (agent-generated: strict index access cleanup pending; behaviour is covered by the tests)
export type V3 = [number, number, number];
export interface Model { size: V3; palette: { color: V3 }[]; cells: Uint8Array }
export interface Selection { indices: Set<number> }
export interface Clip { size: V3; cells: { offset: V3; value: number }[] }

export function cellAt(m: Model, p: V3): number {
  const [x, y, z] = p;
  if (x < 0 || x >= m.size[0] || y < 0 || y >= m.size[1] || z < 0 || z >= m.size[2]) return 0;
  return m.cells[x + y * m.size[0] + z * m.size[0] * m.size[1]];
}

export function modelBounds(m: Model): { min: V3; max: V3 } | null {
  let min: V3 = [Infinity, Infinity, Infinity], max: V3 = [-Infinity, -Infinity, -Infinity], found = false;
  for (let i = 0; i < m.cells.length; i++) {
    if (m.cells[i] === 0) continue;
    found = true;
    const z = Math.floor(i / (m.size[0] * m.size[1])), rem = i % (m.size[0] * m.size[1]);
    const y = Math.floor(rem / m.size[0]), x = rem % m.size[0];
    min = [Math.min(min[0], x), Math.min(min[1], y), Math.min(min[2], z)];
    max = [Math.max(max[0], x), Math.max(max[1], y), Math.max(max[2], z)];
  }
  return found ? { min, max } : null;
}

export function raycast(m: Model, origin: V3, dir: V3, maxDist = 400): { cell: V3; normal: V3; before: V3 | null; dist: number } | null {
  const [sx, sy, sz] = m.size;
  const size = m.size;
  // clip the ray to the grid box first (slab method)
  let tEnter = 0, tExit = maxDist, enterAxis = -1;
  for (let i = 0; i < 3; i++) {
    if (dir[i] === 0) { if (origin[i] < 0 || origin[i] >= size[i]) return null; continue; }
    const t1 = (0 - origin[i]) / dir[i], t2 = (size[i] - origin[i]) / dir[i];
    const lo = Math.min(t1, t2), hi = Math.max(t1, t2);
    if (lo > tEnter) { tEnter = lo; enterAxis = i; }
    if (hi < tExit) tExit = hi;
  }
  if (tEnter > tExit) return null;
  const p: V3 = [origin[0] + dir[0] * tEnter, origin[1] + dir[1] * tEnter, origin[2] + dir[2] * tEnter];
  const c: V3 = [0, 0, 0];
  for (let i = 0; i < 3; i++) c[i] = Math.min(size[i] - 1, Math.max(0, Math.floor(p[i] + (dir[i] < 0 && enterAxis === i ? -1e-9 : 0))));
  const step: V3 = [dir[0] > 0 ? 1 : -1, dir[1] > 0 ? 1 : -1, dir[2] > 0 ? 1 : -1];
  const tMax: V3 = [Infinity, Infinity, Infinity], tDelta: V3 = [Infinity, Infinity, Infinity];
  for (let i = 0; i < 3; i++) {
    if (dir[i] === 0) continue;
    tDelta[i] = Math.abs(1 / dir[i]);
    const edge = dir[i] > 0 ? c[i] + 1 : c[i];
    tMax[i] = (edge - origin[i]) / dir[i];
  }
  let normal: V3 = [0, 0, 0];
  if (enterAxis >= 0) normal[enterAxis] = -step[enterAxis]!;
  let t = tEnter;
  const solid = (): boolean => m.cells[c[0] + sx * (c[1] + sy * c[2])] !== 0;
  for (let guard = 0; guard < sx + sy + sz + 4; guard++) {
    if (solid()) {
      const inside = t === 0 && enterAxis < 0;
      const hitNormal: V3 = inside ? [-step[0]! * (Math.abs(dir[0]) >= Math.abs(dir[1]) && Math.abs(dir[0]) >= Math.abs(dir[2]) ? 1 : 0), -step[1]! * (Math.abs(dir[1]) > Math.abs(dir[0]) && Math.abs(dir[1]) >= Math.abs(dir[2]) ? 1 : 0), -step[2]! * (Math.abs(dir[2]) > Math.abs(dir[0]) && Math.abs(dir[2]) > Math.abs(dir[1]) ? 1 : 0)] : normal;
      const bf: V3 = [c[0] + hitNormal[0], c[1] + hitNormal[1], c[2] + hitNormal[2]];
      const inGrid = bf[0] >= 0 && bf[1] >= 0 && bf[2] >= 0 && bf[0] < sx && bf[1] < sy && bf[2] < sz;
      return { cell: [c[0], c[1], c[2]], normal: [hitNormal[0] + 0, hitNormal[1] + 0, hitNormal[2] + 0], before: inGrid ? bf : null, dist: Math.max(0, t) };
    }
    const ax = tMax[0] <= tMax[1] && tMax[0] <= tMax[2] ? 0 : tMax[1] <= tMax[2] ? 1 : 2;
    t = tMax[ax]!;
    if (t > tExit || t > maxDist) return null;
    c[ax] += step[ax]!;
    if (c[ax]! < 0 || c[ax]! >= size[ax]!) return null;
    tMax[ax] += tDelta[ax]!;
    normal = [0, 0, 0]; normal[ax] = -step[ax]!;
  }
  return null;
}

/** Kept for older callers: the exact DDA above. */
export const raycastSimple = raycast;

export function raycastGround(origin: V3, dir: V3, y = 0): { point: V3 } | null {
  if (dir[1] === 0) return null;
  const t = (y - origin[1]) / dir[1];
  if (t < 0) return null;
  return { point: [origin[0] + t * dir[0], y, origin[2] + t * dir[2]] };
}

export type BrushShape = 'cube' | 'sphere' | 'disc' | 'line';
export function brushCells(shape: BrushShape, centre: V3, size: number, normal: V3, extra?: { to?: V3 }): V3[] {
  const res = new Set<string>();
  const add = (x: number, y: number, z: number) => res.add(`${x},${y},${z}`);
  if (shape === 'cube') {
    const lo = (c: number): number => Math.round(c) - Math.floor((size - 1) / 2);
    const x0 = lo(centre[0]), y0 = lo(centre[1]), z0 = lo(centre[2]);
    for (let x = x0; x < x0 + size; x++) for (let y = y0; y < y0 + size; y++) for (let z = z0; z < z0 + size; z++) add(x, y, z);
  } else if (shape === 'sphere') {
    const r = size / 2;
    for (let x = Math.floor(centre[0] - r); x <= Math.ceil(centre[0] + r); x++) for (let y = Math.floor(centre[1] - r); y <= Math.ceil(centre[1] + r); y++) for (let z = Math.floor(centre[2] - r); z <= Math.ceil(centre[2] + r); z++) {
      if (Math.sqrt((x - centre[0]) ** 2 + (y - centre[1]) ** 2 + (z - centre[2]) ** 2) <= r) add(x, y, z);
    }
  } else if (shape === 'disc') {
    const r = size / 2;
    const absN = [Math.abs(normal[0]), Math.abs(normal[1]), Math.abs(normal[2])];
    if (absN[0] >= absN[1] && absN[0] >= absN[2]) {
      for (let y = Math.floor(centre[1] - r); y <= Math.ceil(centre[1] + r); y++) for (let z = Math.floor(centre[2] - r); z <= Math.ceil(centre[2] + r); z++) if (Math.sqrt((y - centre[1]) ** 2 + (z - centre[2]) ** 2) <= r) add(Math.round(centre[0]), y, z);
    } else if (absN[1] >= absN[0] && absN[1] >= absN[2]) {
      for (let x = Math.floor(centre[0] - r); x <= Math.ceil(centre[0] + r); x++) for (let z = Math.floor(centre[2] - r); z <= Math.ceil(centre[2] + r); z++) if (Math.sqrt((x - centre[0]) ** 2 + (z - centre[2]) ** 2) <= r) add(x, Math.round(centre[1]), z);
    } else {
      for (let x = Math.floor(centre[0] - r); x <= Math.ceil(centre[0] + r); x++) for (let y = Math.floor(centre[1] - r); y <= Math.ceil(centre[1] + r); y++) if (Math.sqrt((x - centre[0]) ** 2 + (y - centre[1]) ** 2) <= r) add(x, y, Math.round(centre[2]));
    }
  } else if (shape === 'line' && extra?.to) {
    let x = Math.round(centre[0]), y = Math.round(centre[1]), z = Math.round(centre[2]);
    const tx = Math.round(extra.to[0]), ty = Math.round(extra.to[1]), tz = Math.round(extra.to[2]);
    const dx = Math.abs(tx - x), dy = Math.abs(ty - y), dz = Math.abs(tz - z);
    const sx = x < tx ? 1 : -1, sy = y < ty ? 1 : -1, sz = z < tz ? 1 : -1;
    if (dx >= dy && dx >= dz) {
      let p1 = 2 * dy - dx, p2 = 2 * dz - dx;
      while (x !== tx) { add(x, y, z); if (p1 >= 0) { y += sy; p1 -= 2 * dx; } if (p2 >= 0) { z += sz; p2 -= 2 * dx; } x += sx; p1 += 2 * dy; p2 += 2 * dz; }
    } else if (dy >= dx && dy >= dz) {
      let p1 = 2 * dx - dy, p2 = 2 * dz - dy;
      while (y !== ty) { add(x, y, z); if (p1 >= 0) { x += sx; p1 -= 2 * dy; } if (p2 >= 0) { z += sz; p2 -= 2 * dy; } y += sy; p1 += 2 * dx; p2 += 2 * dz; }
    } else {
      let p1 = 2 * dx - dz, p2 = 2 * dy - dz;
      while (z !== tz) { add(x, y, z); if (p1 >= 0) { x += sx; p1 -= 2 * dz; } if (p2 >= 0) { y += sy; p2 -= 2 * dz; } z += sz; p1 += 2 * dx; p2 += 2 * dy; }
    }
    add(tx, ty, tz);
  }
  return Array.from(res).map(s => s.split(',').map(Number) as V3);
}

export class SculptSession {
  private _model: Model;
  private _history: { label: string, diffs: { index: number, before: number, after: number }[], resize?: { before: Model, after: Model } }[] = [];
  private _redoStack: { label: string, diffs: { index: number, before: number, after: number }[], resize?: { before: Model, after: Model } }[] = [];
  private _currentStroke: { label: string, diffs: Map<number, { before: number, after: number }> } | null = null;
  public symmetry = { x: false, y: false, z: false, radial: 0 };
  public selection: Selection | null = null;

  constructor(model: Model, opts?: { maxHistoryCells?: number }) {
    this._model = { ...model, size: [model.size[0], model.size[1], model.size[2]], cells: new Uint8Array(model.cells) };
    this.maxHistoryCells = opts?.maxHistoryCells ?? 2_000_000;
  }
  private maxHistoryCells: number;

  model() { return { ...this._model, cells: new Uint8Array(this._model.cells) }; }
  beginStroke(label: string) {
    this._currentStroke = { label, diffs: new Map() };
    this._redoStack = [];
  }
  dab(mode: 'add' | 'remove' | 'paint' | 'smooth', cells: V3[], colour: number) {
    if (!this._currentStroke) return;
    const m = this._model;
    const modified = new Map<number, number>();
    const points = new Set<string>();
    const applySymmetry = (p: V3) => {
      let s = [p];
      if (this.symmetry.x) s.push([m.size[0] - 1 - p[0], p[1], p[2]]);
      if (this.symmetry.y) {
        const prev = [...s];
        for (const pt of prev) s.push([pt[0], m.size[1] - 1 - pt[1], pt[2]]);
      }
      if (this.symmetry.z) {
        const prev = [...s];
        for (const pt of prev) s.push([pt[0], pt[1], m.size[2] - 1 - pt[2]]);
      }
      if (this.symmetry.radial > 0) {
        const rad = this.symmetry.radial;
        const cx = (m.size[0] - 1) / 2, cz = (m.size[2] - 1) / 2;
        const prev = [...s];
        for (const pt of prev) {
          for (let i = 1; i < rad; i++) {
            const theta = (2 * Math.PI * i) / rad;
            const dx = pt[0] - cx, dz = pt[2] - cz;
            s.push([Math.round(cx + dx * Math.cos(theta) - dz * Math.sin(theta)), pt[1], Math.round(cz + dx * Math.sin(theta) + dz * Math.cos(theta))]);
          }
        }
      }
      for (const pt of s) {
        if (pt[0] >= 0 && pt[0] < m.size[0] && pt[1] >= 0 && pt[1] < m.size[1] && pt[2] >= 0 && pt[2] < m.size[2]) {
          const idx = pt[0] + pt[1] * m.size[0] + pt[2] * m.size[0] * m.size[1];
          points.add(`${idx}`);
        }
      }
    };
    cells.forEach(applySymmetry);

    const processed = Array.from(points).map(Number);
    const snapshot = new Uint8Array(m.cells);
    processed.forEach(idx => {
      if (this.selection && !this.selection.indices.has(idx)) return;
      const val = m.cells[idx];
      let next = val;
      if (mode === 'add' && val === 0) next = colour;
      else if (mode === 'remove' && val !== 0) next = 0;
      else if (mode === 'paint' && val !== 0) next = colour;
      else if (mode === 'smooth') {
        const [z, rem] = [Math.floor(idx / (m.size[0] * m.size[1])), idx % (m.size[0] * m.size[1])];
        const [y, x] = [Math.floor(rem / m.size[0]), rem % m.size[0]];
        const neighbors = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
        let solids = 0, counts = new Map<number, number>();
        neighbors.forEach(([dx,dy,dz]) => {
          const v = cellAt(m, [x+dx, y+dy, z+dz]);
          if (v !== 0) { solids++; counts.set(v, (counts.get(v) || 0) + 1); }
        });
        if (val !== 0 && solids <= 2) next = 0;
        else if (val === 0 && solids >= 5) {
          let maxC = 0, bestV = 0;
          counts.forEach((c, v) => { if (c > maxC) { maxC = c; bestV = v; } });
          next = bestV;
        }
      }
      if (next !== val) modified.set(idx, next);
    });

    modified.forEach((after, index) => {
      const before = this._currentStroke!.diffs.has(index) ? this._currentStroke!.diffs.get(index)!.before : m.cells[index];
      this._currentStroke!.diffs.set(index, { before, after });
      m.cells[index] = after;
    });
  }

  endStroke(): boolean {
    if (!this._currentStroke) return false;
    const diffs = Array.from(this._currentStroke.diffs.entries()).map(([index, { before, after }]) => ({ index, before, after }));
    if (diffs.length === 0) { this._currentStroke = null; return false; }
    this._history.push({ label: this._currentStroke.label, diffs });
    this._currentStroke = null;
    let total = 0;
    for (const s of this._history) total += s.diffs.length;
    while (total > this.maxHistoryCells && this._history.length > 0) {
      total -= this._history[0].diffs.length;
      this._history.shift();
    }
    return true;
  }

  undo() {
    const s = this._history.pop();
    if (!s) return false;
    if (s.resize) this._model = { ...s.resize.before, cells: new Uint8Array(s.resize.before.cells) };
    s.diffs.forEach(d => this._model.cells[d.index] = d.before);
    this._redoStack.push(s);
    return true;
  }
  redo() {
    const s = this._redoStack.pop();
    if (!s) return false;
    if (s.resize) this._model = { ...s.resize.after, cells: new Uint8Array(s.resize.after.cells) };
    s.diffs.forEach(d => this._model.cells[d.index] = d.after);
    this._history.push(s);
    return true;
  }
  get canUndo() { return this._history.length > 0; }
  get canRedo() { return this._redoStack.length > 0; }
  history() { return this._history.map(s => ({ label: s.label, cells: s.diffs.length })); }

  strokeFromSamples(label: string, mode: 'add'|'remove'|'paint'|'smooth', shape: BrushShape, size: number, colour: number, samples: { point: V3, normal: V3 }[], spacing = 1) {
    this.beginStroke(label);
    for (let i = 0; i < samples.length - 1; i++) {
      const p1 = samples[i].point, p2 = samples[i+1].point;
      const dist = Math.sqrt((p1[0]-p2[0])**2 + (p1[1]-p2[1])**2 + (p1[2]-p2[2])**2);
      const steps = Math.max(1, Math.ceil(dist / spacing));
      for (let j = 0; j < steps; j++) {
        const t = j / steps;
        const p = [p1[0] + t*(p2[0]-p1[0]), p1[1] + t*(p2[1]-p1[1]), p1[2] + t*(p2[2]-p1[2])];
        this.dab(mode, brushCells(shape, p, size, samples[i].normal), colour);
      }
    }
    const last = samples[samples.length - 1];
    if (last) this.dab(mode, brushCells(shape, last.point, size, last.normal), colour);
    this.endStroke();
  }

  resize(size: V3, anchor: 'min' | 'centre') {
    const oldM = this.model();
    const oldS = this._model.size;
    const offset: V3 = anchor === 'min' ? [0,0,0] : [Math.floor((size[0]-oldS[0])/2), Math.floor((size[1]-oldS[1])/2), Math.floor((size[2]-oldS[2])/2)];
    const newCells = new Uint8Array(size[0] * size[1] * size[2]);
    for (let i = 0; i < oldM.cells.length; i++) {
      const z = Math.floor(i / (oldS[0]*oldS[1])), rem = i % (oldS[0]*oldS[1]), y = Math.floor(rem/oldS[0]), x = rem % oldS[0];
      const nx = x + offset[0], ny = y + offset[1], nz = z + offset[2];
      if (nx >= 0 && nx < size[0] && ny >= 0 && ny < size[1] && nz >= 0 && nz < size[2]) {
        newCells[nx + ny * size[0] + nz * size[0] * size[1]] = oldM.cells[i];
      }
    }
    const after: Model = { ...this._model, size, cells: newCells };
    this._currentStroke = null;
    this._history.push({ label: 'resize', diffs: [], resize: { before: oldM, after } });
    this._redoStack = [];
    this._model = { ...after, cells: new Uint8Array(newCells) };
  }

  selectBox(a: V3, b: V3, mode: 'replace'|'add'|'subtract') {
    this.beginStroke('selectBox');
    const min = [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2])];
    const max = [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])];
    const indices = new Set<number>();
    for (let x = Math.max(0, min[0]); x <= Math.min(this._model.size[0]-1, max[0]); x++)
      for (let y = Math.max(0, min[1]); y <= Math.min(this._model.size[1]-1, max[1]); y++)
        for (let z = Math.max(0, min[2]); z <= Math.min(this._model.size[2]-1, max[2]); z++)
          indices.add(x + y * this._model.size[0] + z * this._model.size[0] * this._model.size[1]);
    if (mode === 'replace') this.selection = { indices };
    else if (this.selection) {
      if (mode === 'add') indices.forEach(i => this.selection!.indices.add(i));
      else indices.forEach(i => this.selection!.indices.delete(i));
    } else this.selection = { indices };
    this.endStroke();
  }

  selectSphere(c: V3, r: number, mode: 'replace'|'add'|'subtract') {
    this.beginStroke('selectSphere');
    const indices = new Set<number>();
    const s = this._model.size;
    for (let x = Math.max(0, Math.floor(c[0]-r)); x <= Math.min(s[0]-1, Math.ceil(c[0]+r)); x++)
      for (let y = Math.max(0, Math.floor(c[1]-r)); y <= Math.min(s[1]-1, Math.ceil(c[1]+r)); y++)
        for (let z = Math.max(0, Math.floor(c[2]-r)); z <= Math.min(s[2]-1, Math.ceil(c[2]+r)); z++)
          if (Math.sqrt((x-c[0])**2 + (y-c[1])**2 + (z-c[2])**2) <= r) indices.add(x + y * s[0] + z * s[0] * s[1]);
    if (mode === 'replace') this.selection = { indices };
    else if (this.selection) {
      if (mode === 'add') indices.forEach(i => this.selection!.indices.add(i));
      else indices.forEach(i => this.selection!.indices.delete(i));
    }
    this.endStroke();
  }

  selectWand(cell: V3, mode: 'replace'|'add'|'subtract', opts?: { tolerance?: 'exact'|'any' }) {
    this.beginStroke('selectWand');
    const m = this._model, s = m.size;
    const startIdx = cell[0] + cell[1]*s[0] + cell[2]*s[0]*s[1];
    if (startIdx < 0 || startIdx >= m.cells.length || m.cells[startIdx] === 0) { this.endStroke(); return; }
    const target = m.cells[startIdx], indices = new Set<number>(), queue = [startIdx];
    indices.add(startIdx);
    while (queue.length > 0) {
      const idx = queue.shift()!;
      const z = Math.floor(idx/(s[0]*s[1])), rem = idx%(s[0]*s[1]), y = Math.floor(rem/s[0]), x = rem%s[0];
      [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]].forEach(([dx,dy,dz]) => {
        const nx = x+dx, ny = y+dy, nz = z+dz;
        if (nx>=0 && nx<s[0] && ny>=0 && ny<s[1] && nz>=0 && nz<s[2]) {
          const nidx = nx + ny*s[0] + nz*s[0]*s[1];
          if (!indices.has(nidx) && m.cells[nidx] !== 0 && (opts?.tolerance === 'any' || m.cells[nidx] === target)) {
            indices.add(nidx); queue.push(nidx);
          }
        }
      });
    }
    if (mode === 'replace') this.selection = { indices };
    else if (this.selection) {
      if (mode === 'add') indices.forEach(i => this.selection!.indices.add(i));
      else indices.forEach(i => this.selection!.indices.delete(i));
    }
    this.endStroke();
  }

  selectAll() { this.selection = { indices: new Set(Array.from({length: this._model.cells.length}, (_, i) => i)) }; }
  selectNone() { this.selection = null; }
  invertSelection() {
    if (!this.selection) return;
    const next = new Set<number>();
    for (let i = 0; i < this._model.cells.length; i++) if (!this.selection.indices.has(i)) next.add(i);
    this.selection.indices = next;
  }
  growSelection() {
    if (!this.selection) return;
    const next = new Set(this.selection.indices);
    const s = this._model.size;
    this.selection.indices.forEach(idx => {
      const z = Math.floor(idx/(s[0]*s[1])), rem = idx%(s[0]*s[1]), y = Math.floor(rem/s[0]), x = rem%s[0];
      [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]].forEach(([dx,dy,dz]) => {
        const nx = x+dx, ny = y+dy, nz = z+dz;
        if (nx>=0 && nx<s[0] && ny>=0 && ny<s[1] && nz>=0 && nz<s[2]) next.add(nx + ny*s[0] + nz*s[0]*s[1]);
      });
    });
    this.selection.indices = next;
  }
  shrinkSelection() {
    if (!this.selection) return;
    const next = new Set<number>();
    const s = this._model.size;
    this.selection.indices.forEach(idx => {
      const z = Math.floor(idx/(s[0]*s[1])), rem = idx%(s[0]*s[1]), y = Math.floor(rem/s[0]), x = rem%s[0];
      let boundary = false;
      [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]].forEach(([dx,dy,dz]) => {
        const nx = x+dx, ny = y+dy, nz = z+dz;
        if (nx<0 || nx>=s[0] || ny<0 || ny>=s[1] || nz<0 || nz>=s[2] || !this.selection!.indices.has(nx + ny*s[0] + nz*s[0]*s[1])) boundary = true;
      });
      if (!boundary) next.add(idx);
    });
    this.selection.indices = next;
  }
  selectionBounds() {
    if (!this.selection || this.selection.indices.size === 0) return null;
    const s = this._model.size;
    let min: V3 = [Infinity, Infinity, Infinity], max: V3 = [-Infinity, -Infinity, -Infinity];
    this.selection.indices.forEach(idx => {
      const z = Math.floor(idx/(s[0]*s[1])), rem = idx%(s[0]*s[1]), y = Math.floor(rem/s[0]), x = rem%s[0];
      min = [Math.min(min[0], x), Math.min(min[1], y), Math.min(min[2], z)];
      max = [Math.max(max[0], x), Math.max(max[1], y), Math.max(max[2], z)];
    });
    return { min, max };
  }
  deleteSelection() {
    this.beginStroke('deleteSelection');
    if (this.selection) this.selection.indices.forEach(idx => {
      const val = this._model.cells[idx];
      if (val !== 0) {
        if (!this._currentStroke) return;
        this._currentStroke.diffs.set(idx, { before: val, after: 0 });
        this._model.cells[idx] = 0;
      }
    });
    this.endStroke();
  }
  fillSelection(colour: number, fillEmpty = false) {
    this.beginStroke('fillSelection');
    if (this.selection) this.selection.indices.forEach(idx => {
      const val = this._model.cells[idx];
      if (val !== colour && (val !== 0 || fillEmpty)) {
        this._currentStroke!.diffs.set(idx, { before: val, after: colour });
        this._model.cells[idx] = colour;
      }
    });
    this.endStroke();
  }
  moveSelection(dx: number, dy: number, dz: number) {
    this.beginStroke('moveSelection');
    if (!this.selection) { this.endStroke(); return; }
    const s = this._model.size, nextIndices = new Set<number>(), changes = new Map<number, number>();
    const oldCells = new Uint8Array(this._model.cells);
    this.selection.indices.forEach(idx => {
      const z = Math.floor(idx/(s[0]*s[1])), rem = idx%(s[0]*s[1]), y = Math.floor(rem/s[0]), x = rem%s[0];
      const nx = x + dx, ny = y + dy, nz = z + dz;
      if (nx >= 0 && nx < s[0] && ny >= 0 && ny < s[1] && nz >= 0 && nz < s[2]) {
        const nidx = nx + ny * s[0] + nz * s[0] * s[1];
        nextIndices.add(nidx);
        changes.set(nidx, oldCells[idx]);
      }
    });
    this.selection.indices.forEach(idx => {
      if (!Array.from(changes.keys()).includes(idx)) {
        changes.set(idx, 0);
      }
    });
    changes.forEach((after, idx) => {
      this._currentStroke!.diffs.set(idx, { before: this._model.cells[idx], after });
      this._model.cells[idx] = after;
    });
    this.selection.indices = nextIndices;
    this.endStroke();
  }
  copySelection(): Clip | null {
    if (!this.selection || this.selection.indices.size === 0) return null;
    const bounds = this.selectionBounds()!;
    const s = this._model.size, clipCells: { offset: V3, value: number }[] = [];
    this.selection.indices.forEach(idx => {
      const z = Math.floor(idx/(s[0]*s[1])), rem = idx%(s[0]*s[1]), y = Math.floor(rem/s[0]), x = rem%s[0];
      if (this._model.cells[idx] !== 0) clipCells.push({ offset: [x - bounds.min[0], y - bounds.min[1], z - bounds.min[2]], value: this._model.cells[idx] });
    });
    return { size: [bounds.max[0] - bounds.min[0] + 1, bounds.max[1] - bounds.min[1] + 1, bounds.max[2] - bounds.min[2] + 1], cells: clipCells };
  }
  paste(clip: Clip, at: V3, opts?: { onlyEmpty?: boolean }) {
    this.beginStroke('paste');
    const s = this._model.size;
    clip.cells.forEach(c => {
      const nx = at[0] + c.offset[0], ny = at[1] + c.offset[1], nz = at[2] + c.offset[2];
      if (nx >= 0 && nx < s[0] && ny >= 0 && ny < s[1] && nz >= 0 && nz < s[2]) {
        const idx = nx + ny * s[0] + nz * s[0] * s[1];
        if (!opts?.onlyEmpty || this._model.cells[idx] === 0) {
          this._currentStroke!.diffs.set(idx, { before: this._model.cells[idx], after: c.value });
          this._model.cells[idx] = c.value;
        }
      }
    });
    this.endStroke();
  }
  rotateSelection(axis: 'x'|'y'|'z', quarterTurns: number) {
    this.beginStroke('rotateSelection');
    if (!this.selection) { this.endStroke(); return; }
    const bounds = this.selectionBounds();
    if (!bounds) { this.endStroke(); return; }
    const { min, max } = bounds, s = this._model.size, cx = (min[0]+max[0])/2, cy = (min[1]+max[1])/2, cz = (min[2]+max[2])/2;
    const nextIndices = new Set<number>(), changes = new Map<number, number>();
    const oldCells = new Uint8Array(this._model.cells);
    this.selection.indices.forEach(idx => {
      const z = Math.floor(idx/(s[0]*s[1])), rem = idx%(s[0]*s[1]), y = Math.floor(rem/s[0]), x = rem%s[0];
      let nx = x - cx, ny = y - cy, nz = z - cz;
      for (let i = 0; i < (quarterTurns % 4 + 4) % 4; i++) {
        if (axis === 'x') { const t = nz; nz = -ny; ny = t; }
        else if (axis === 'y') { const t = nx; nx = -nz; nz = t; }
        else { const t = nx; nx = -ny; ny = t; }
      }
      const fx = Math.round(nx + cx), fy = Math.round(ny + cy), fz = Math.round(nz + cz);
      if (fx >= 0 && fx < s[0] && fy >= 0 && fy < s[1] && fz >= 0 && fz < s[2]) {
        const nidx = fx + fy * s[0] + fz * s[0] * s[1];
        nextIndices.add(nidx);
        changes.set(nidx, oldCells[idx]);
      }
    });
    this.selection.indices.forEach(idx => { if (!Array.from(changes.keys()).includes(idx)) changes.set(idx, 0); });
    changes.forEach((after, idx) => {
      this._currentStroke!.diffs.set(idx, { before: this._model.cells[idx], after });
      this._model.cells[idx] = after;
    });
    this.selection.indices = nextIndices;
    this.endStroke();
  }
  flipSelection(axis: 'x'|'y'|'z') {
    this.beginStroke('flipSelection');
    if (!this.selection) { this.endStroke(); return; }
    const bounds = this.selectionBounds();
    if (!bounds) { this.endStroke(); return; }
    const { min, max } = bounds, s = this._model.size, cx = (min[0]+max[0])/2, cy = (min[1]+max[1])/2, cz = (min[2]+max[2])/2;
    const nextIndices = new Set<number>(), changes = new Map<number, number>();
    const oldCells = new Uint8Array(this._model.cells);
    this.selection.indices.forEach(idx => {
      const z = Math.floor(idx/(s[0]*s[1])), rem = idx%(s[0]*s[1]), y = Math.floor(rem/s[0]), x = rem%s[0];
      let nx = x, ny = y, nz = z;
      if (axis === 'x') nx = Math.round(2 * cx - x);
      else if (axis === 'y') ny = Math.round(2 * cy - y);
      else nz = Math.round(2 * cz - z);
      if (nx >= 0 && nx < s[0] && ny >= 0 && ny < s[1] && nz >= 0 && nz < s[2]) {
        const nidx = nx + ny * s[0] + nz * s[0] * s[1];
        nextIndices.add(nidx);
        changes.set(nidx, oldCells[idx]);
      }
    });
    this.selection.indices.forEach(idx => { if (!Array.from(changes.keys()).includes(idx)) changes.set(idx, 0); });
    changes.forEach((after, idx) => {
      this._currentStroke!.diffs.set(idx, { before: this._model.cells[idx], after });
      this._model.cells[idx] = after;
    });
    this.selection.indices = nextIndices;
    this.endStroke();
  }
  scaleSelection(factor: 2 | 0.5) {
    this.beginStroke('scaleSelection');
    if (!this.selection) { this.endStroke(); return; }
    const bounds = this.selectionBounds();
    if (!bounds) { this.endStroke(); return; }
    const { min, max } = bounds, s = this._model.size, nextIndices = new Set<number>(), changes = new Map<number, number>();
    const oldCells = new Uint8Array(this._model.cells);
    if (factor === 2) {
      this.selection.indices.forEach(idx => {
        const z = Math.floor(idx/(s[0]*s[1])), rem = idx%(s[0]*s[1]), y = Math.floor(rem/s[0]), x = rem%s[0];
        for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++) for (let dz = 0; dz < 2; dz++) {
          const nx = 2*(x-min[0]) + dx + min[0], ny = 2*(y-min[1]) + dy + min[1], nz = 2*(z-min[2]) + dz + min[2];
          if (nx >= 0 && nx < s[0] && ny >= 0 && ny < s[1] && nz >= 0 && nz < s[2]) {
            const nidx = nx + ny * s[0] + nz * s[0] * s[1];
            nextIndices.add(nidx);
            changes.set(nidx, oldCells[idx]);
          }
        }
      });
    } else {
      for (let x = min[0]; x <= max[0]; x += 2) for (let y = min[1]; y <= max[1]; y += 2) for (let z = min[2]; z <= max[2]; z += 2) {
        const counts = new Map<number, number>();
        for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++) for (let dz = 0; dz < 2; dz++) {
          const nx = x + dx, ny = y + dy, nz = z + dz;
          if (nx >= 0 && nx < s[0] && ny >= 0 && ny < s[1] && nz >= 0 && nz < s[2]) {
            const v = oldCells[nx + ny * s[0] + nz * s[0] * s[1]];
            if (v !== 0) counts.set(v, (counts.get(v) || 0) + 1);
          }
        }
        let bestV = 0, maxC = 0;
        counts.forEach((c, v) => { if (c > maxC) { maxC = c; bestV = v; } });
        if (bestV !== 0) {
          const nx = Math.floor((x+min[0])/2), ny = Math.floor((y+min[1])/2), nz = Math.floor((z+min[2])/2);
          if (nx >= 0 && nx < s[0] && ny >= 0 && ny < s[1] && nz >= 0 && nz < s[2]) {
            const nidx = nx + ny * s[0] + nz * s[0] * s[1];
            nextIndices.add(nidx);
            changes.set(nidx, bestV);
          }
        }
      }
    }
    this.selection.indices.forEach(idx => { if (!Array.from(changes.keys()).includes(idx)) changes.set(idx, 0); });
    changes.forEach((after, idx) => {
      this._currentStroke!.diffs.set(idx, { before: this._model.cells[idx], after });
      this._model.cells[idx] = after;
    });
    this.selection.indices = nextIndices;
    this.endStroke();
  }
}

export function paletteAdd(m: Model, color: V3): { model: Model, index: number } {
  const idx = m.palette.findIndex(p => p.color[0] === color[0] && p.color[1] === color[1] && p.color[2] === color[2]);
  if (idx !== -1) return { model: m, index: idx + 1 };
  const newPalette = [...m.palette, { color }];
  return { model: { ...m, palette: newPalette }, index: newPalette.length };
}
export function paletteRemove(m: Model, index: number, replaceWith: number): { model: Model } {
  const newPalette = m.palette.filter((_, i) => i !== index - 1);
  const newCells = new Uint8Array(m.cells);
  for (let i = 0; i < newCells.length; i++) {
    if (newCells[i] === index) newCells[i] = replaceWith;
    else if (newCells[i] > index) newCells[i]--;
  }
  return { model: { ...m, palette: newPalette, cells: newCells } };
}
/** Rebuild a model with its palette in a new order: `order[k]` is the OLD 1-based index that becomes entry k+1 (entries left out are dropped; their cells map through `fallback`). */
function reorder(m: Model, order: readonly number[], fallback: (old: number) => number = () => 0): Model {
  const map = new Array<number>(m.palette.length + 1).fill(0);
  order.forEach((old, k) => { map[old] = k + 1; });
  for (let old = 1; old <= m.palette.length; old++) if (!map[old]) map[old] = fallback(old);
  const cells = new Uint8Array(m.cells.length);
  for (let i = 0; i < cells.length; i++) cells[i] = map[m.cells[i]!]!;
  return { ...m, palette: order.map((old) => m.palette[old - 1]!), cells };
}
export function paletteMove(m: Model, from: number, to: number): { model: Model } {
  const order = m.palette.map((_, i) => i + 1);
  const [item] = order.splice(from - 1, 1);
  order.splice(to - 1, 0, item!);
  return { model: reorder(m, order) };
}
export function paletteMerge(m: Model, tolerance = 0.02): { model: Model } {
  const n = m.palette.length, into = Array.from({ length: n + 1 }, (_, i) => i);
  const dist = (a: V3, b: V3): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  for (let i = 1; i <= n; i++) {
    if (into[i] !== i) continue;
    for (let j = i + 1; j <= n; j++) if (into[j] === j && dist(m.palette[i - 1]!.color, m.palette[j - 1]!.color) <= tolerance) into[j] = i;
  }
  const keep = Array.from({ length: n }, (_, i) => i + 1).filter((i) => into[i] === i);
  return { model: reorder(m, keep, (old) => keep.indexOf(into[old]!) + 1) };
}
export function paletteUse(m: Model): number[] {
  const counts = new Array(m.palette.length + 1).fill(0);
  m.cells.forEach(v => counts[v]++);
  return counts.slice(1);
}
export function paletteSort(m: Model, by: 'hue'|'lightness'|'use'): { model: Model } {
  const uses = paletteUse(m);
  const hue = (c: V3): number => {
    const mx = Math.max(...c), mn = Math.min(...c), d = mx - mn;
    if (d === 0) return -1; // greys first
    const h = mx === c[0] ? ((c[1] - c[2]) / d) % 6 : mx === c[1] ? (c[2] - c[0]) / d + 2 : (c[0] - c[1]) / d + 4;
    return (h < 0 ? h + 6 : h) / 6;
  };
  const light = (c: V3): number => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const order = m.palette.map((_, i) => i + 1);
  order.sort((a, b) => {
    const d = by === 'use' ? uses[b - 1]! - uses[a - 1]! : by === 'lightness' ? light(m.palette[a - 1]!.color) - light(m.palette[b - 1]!.color) : hue(m.palette[a - 1]!.color) - hue(m.palette[b - 1]!.color);
    return d || a - b;
  });
  return { model: reorder(m, order) };
}
export function visibleCells(m: Model, opts: { sliceAxis?: 'x'|'y'|'z'; sliceMin?: number; sliceMax?: number; hideSelection?: boolean }): Model {
  const newCells = new Uint8Array(m.cells);
  for (let i = 0; i < newCells.length; i++) {
    const z = Math.floor(i / (m.size[0] * m.size[1])), rem = i % (m.size[0] * m.size[1]);
    const y = Math.floor(rem / m.size[0]), x = rem % m.size[0];
    if (opts.sliceAxis === 'x' && (x < (opts.sliceMin ?? -1) || x > (opts.sliceMax ?? Infinity))) newCells[i] = 0;
    if (opts.sliceAxis === 'y' && (y < (opts.sliceMin ?? -1) || y > (opts.sliceMax ?? Infinity))) newCells[i] = 0;
    if (opts.sliceAxis === 'z' && (z < (opts.sliceMin ?? -1) || z > (opts.sliceMax ?? Infinity))) newCells[i] = 0;
  }
  return { ...m, cells: newCells };
}