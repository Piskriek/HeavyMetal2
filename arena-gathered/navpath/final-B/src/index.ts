export interface Grid {
  readonly w: number;
  readonly h: number;
  blocked(x: number, y: number): boolean;
}

export interface Path {
  points: [number, number][];
  length: number;
}

const EPSA = 1e-9;
const EPSB = 1e-12;

function pointBlocked(
  px: number,
  py: number,
  blk: Uint8Array,
  w: number,
  h: number
): boolean {
  if (px < 0 || px > w || py < 0 || py > h) return true;
  const rx = Math.round(px);
  const ry = Math.round(py);
  if (Math.abs(px - rx) < EPSA) return false;
  if (Math.abs(py - ry) < EPSA) return false;
  const cx = Math.floor(px);
  const cy = Math.floor(py);
  if (cx < 0 || cx >= w || cy < 0 || cy >= h) return true;
  return blk[cy * w + cx] === 1;
}

function segVisible(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  blk: Uint8Array,
  w: number,
  h: number
): boolean {
  if (x0 === x1 && y0 === y1) return true;
  if (x0 === x1) {
    const xr = Math.round(x0);
    if (Math.abs(x0 - xr) < EPSA) {
      const xi = xr;
      if (xi < 0 || xi > w) return false;
      let yLow = y0 < y1 ? y0 : y1;
      let yHigh = y0 < y1 ? y1 : y0;
      if (yLow < 0) yLow = 0;
      if (yHigh > h) yHigh = h;
      if (yHigh <= yLow) return true;
      let k0 = Math.floor(yLow);
      let k1 = Math.floor(yHigh - EPSA);
      if (k0 < 0) k0 = 0;
      if (k1 >= h) k1 = h - 1;
      for (let k = k0; k <= k1; k++) {
        const a = k > yLow ? k : yLow;
        const b = k + 1 < yHigh ? k + 1 : yHigh;
        if (b - a <= EPSB) continue;
        const lx = xi - 1;
        const rx2 = xi;
        let leftB: boolean;
        let rightB: boolean;
        if (lx < 0 || lx >= w || k < 0 || k >= h) leftB = true;
        else leftB = blk[k * w + lx] === 1;
        if (rx2 < 0 || rx2 >= w || k < 0 || k >= h) rightB = true;
        else rightB = blk[k * w + rx2] === 1;
        if (leftB && rightB) return false;
      }
      return true;
    }
  }
  if (y0 === y1) {
    const yr = Math.round(y0);
    if (Math.abs(y0 - yr) < EPSA) {
      const yi = yr;
      if (yi < 0 || yi > h) return false;
      let xLow = x0 < x1 ? x0 : x1;
      let xHigh = x0 < x1 ? x1 : x0;
      if (xLow < 0) xLow = 0;
      if (xHigh > w) xHigh = w;
      if (xHigh <= xLow) return true;
      let k0 = Math.floor(xLow);
      let k1 = Math.floor(xHigh - EPSA);
      if (k0 < 0) k0 = 0;
      if (k1 >= w) k1 = w - 1;
      for (let k = k0; k <= k1; k++) {
        const a = k > xLow ? k : xLow;
        const b = k + 1 < xHigh ? k + 1 : xHigh;
        if (b - a <= EPSB) continue;
        const by = yi - 1;
        const ay = yi;
        let belowB: boolean;
        let aboveB: boolean;
        if (k < 0 || k >= w || by < 0 || by >= h) belowB = true;
        else belowB = blk[by * w + k] === 1;
        if (k < 0 || k >= w || ay < 0 || ay >= h) aboveB = true;
        else aboveB = blk[ay * w + k] === 1;
        if (belowB && aboveB) return false;
      }
      return true;
    }
  }
  const dx = x1 - x0;
  const dy = y1 - y0;
  let tCur = 0;
  for (let iter = 0; iter < 1000; iter++) {
    if (tCur >= 1 - EPSB) return true;
    const xCur = x0 + dx * tCur;
    const yCur = y0 + dy * tCur;
    let tx = Infinity;
    let ty = Infinity;
    if (dx !== 0) {
      let xn: number;
      if (dx > 0) xn = Math.floor(xCur + EPSA) + 1;
      else xn = Math.ceil(xCur - EPSA) - 1;
      tx = (xn - x0) / dx;
    }
    if (dy !== 0) {
      let yn: number;
      if (dy > 0) yn = Math.floor(yCur + EPSA) + 1;
      else yn = Math.ceil(yCur - EPSA) - 1;
      ty = (yn - y0) / dy;
    }
    let tNext = tx < ty ? tx : ty;
    if (tNext > 1) tNext = 1;
    if (!(tNext > tCur)) {
      tCur = tCur + 1e-7;
      if (tCur >= 1 - EPSB) return true;
      continue;
    }
    const tMid = (tCur + tNext) * 0.5;
    const xm = x0 + dx * tMid;
    const ym = y0 + dy * tMid;
    const cx = Math.floor(xm);
    const cy = Math.floor(ym);
    if (cx < 0 || cx >= w || cy < 0 || cy >= h) return false;
    if (blk[cy * w + cx] === 1) return false;
    tCur = tNext;
  }
  return true;
}

interface Pre {
  w: number;
  h: number;
  blk: Uint8Array;
  vx: number[];
  vy: number[];
  adj: number[][];
  adjW: number[][];
}

function buildPre(grid: Grid): Pre {
  const w = grid.w;
  const h = grid.h;
  const blk = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (grid.blocked(x, y)) blk[y * w + x] = 1;
    }
  }
  const vx: number[] = [];
  const vy: number[] = [];
  for (let y = 1; y < h; y++) {
    for (let x = 1; x < w; x++) {
      const a = blk[(y - 1) * w + (x - 1)] === 1;
      const b = blk[(y - 1) * w + x] === 1;
      const c = blk[y * w + (x - 1)] === 1;
      const d = blk[y * w + x] === 1;
      let cnt = 0;
      if (a) cnt++;
      if (b) cnt++;
      if (c) cnt++;
      if (d) cnt++;
      if (cnt === 1) {
        vx.push(x);
        vy.push(y);
      }
    }
  }
  const n = vx.length;
  const adj: number[][] = [];
  const adjW: number[][] = [];
  for (let i = 0; i < n; i++) {
    adj.push([]);
    adjW.push([]);
  }
  for (let i = 0; i < n; i++) {
    const xi = vx[i]!;
    const yi = vy[i]!;
    for (let j = i + 1; j < n; j++) {
      const xj = vx[j]!;
      const yj = vy[j]!;
      if (segVisible(xi, yi, xj, yj, blk, w, h)) {
        const dx = xj - xi;
        const dy = yj - yi;
        const dd = Math.sqrt(dx * dx + dy * dy);
        adj[i]!.push(j);
        adjW[i]!.push(dd);
        adj[j]!.push(i);
        adjW[j]!.push(dd);
      }
    }
  }
  return { w, h, blk, vx, vy, adj, adjW };
}

function queryPath(
  pre: Pre,
  from: readonly [number, number],
  to: readonly [number, number]
): Path | null {
  const w = pre.w;
  const h = pre.h;
  const blk = pre.blk;
  const fx = from[0];
  const fy = from[1];
  const tx = to[0];
  const ty = to[1];
  if (pointBlocked(fx, fy, blk, w, h)) return null;
  if (pointBlocked(tx, ty, blk, w, h)) return null;
  if (fx === tx && fy === ty) {
    return { points: [[fx, fy], [tx, ty]], length: 0 };
  }
  if (segVisible(fx, fy, tx, ty, blk, w, h)) {
    const dx = tx - fx;
    const dy = ty - fy;
    return { points: [[fx, fy], [tx, ty]], length: Math.sqrt(dx * dx + dy * dy) };
  }
  const n = pre.vx.length;
  if (n === 0) return null;
  const sVis = new Uint8Array(n);
  const sD = new Float64Array(n);
  const eVis = new Uint8Array(n);
  const eD = new Float64Array(n);
  const sList: number[] = [];
  const sW: number[] = [];
  for (let i = 0; i < n; i++) {
    const xi = pre.vx[i]!;
    const yi = pre.vy[i]!;
    if (segVisible(fx, fy, xi, yi, blk, w, h)) {
      const dx = xi - fx;
      const dy = yi - fy;
      const dd = Math.sqrt(dx * dx + dy * dy);
      sVis[i] = 1;
      sD[i] = dd;
      sList.push(i);
      sW.push(dd);
    }
    if (segVisible(tx, ty, xi, yi, blk, w, h)) {
      const dx = xi - tx;
      const dy = yi - ty;
      const dd = Math.sqrt(dx * dx + dy * dy);
      eVis[i] = 1;
      eD[i] = dd;
    }
  }
  if (sList.length === 0) return null;
  let hasE = false;
  for (let i = 0; i < n; i++) {
    if (eVis[i] === 1) {
      hasE = true;
      break;
    }
  }
  if (!hasE) return null;
  const hArr = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const xi = pre.vx[i]!;
    const yi = pre.vy[i]!;
    const dx = xi - tx;
    const dy = yi - ty;
    hArr[i] = Math.sqrt(dx * dx + dy * dy);
  }
  const dxs = tx - fx;
  const dys = ty - fy;
  const hStart = Math.sqrt(dxs * dxs + dys * dys);
  const sNode = n;
  const eNode = n + 1;
  const total = n + 2;
  const dist = new Float64Array(total);
  for (let i = 0; i < total; i++) dist[i] = Infinity;
  const prev = new Int32Array(total);
  for (let i = 0; i < total; i++) prev[i] = -1;
  const done = new Uint8Array(total);
  const hd: number[] = [];
  const hi: number[] = [];
  const pushHeap = (f: number, idx: number): void => {
    hd.push(f);
    hi.push(idx);
    let c = hd.length - 1;
    while (c > 0) {
      const p = (c - 1) >> 1;
      const pf = hd[p]!;
      const pi = hi[p]!;
      if (pf < f || (pf === f && pi <= idx)) break;
      hd[c] = pf;
      hi[c] = pi;
      hd[p] = f;
      hi[p] = idx;
      c = p;
    }
  };
  dist[sNode] = 0;
  pushHeap(hStart, sNode);
  while (hd.length > 0) {
    const uTop = hi[0]!;
    const lastF = hd.pop()!;
    const lastI = hi.pop()!;
    if (hd.length > 0) {
      hd[0] = lastF;
      hi[0] = lastI;
      let p = 0;
      for (;;) {
        const l = p * 2 + 1;
        const r = l + 1;
        let best = p;
        const bf = hd[best]!;
        const bi = hi[best]!;
        if (l < hd.length) {
          const lf = hd[l]!;
          const li = hi[l]!;
          if (lf < bf || (lf === bf && li < bi)) best = l;
        }
        if (r < hd.length) {
          const rf = hd[r]!;
          const ri = hi[r]!;
          const cf = hd[best]!;
          const ci = hi[best]!;
          if (rf < cf || (rf === cf && ri < ci)) best = r;
        }
        if (best === p) break;
        const tf = hd[p]!;
        const ti = hi[p]!;
        hd[p] = hd[best]!;
        hi[p] = hi[best]!;
        hd[best] = tf;
        hi[best] = ti;
        p = best;
      }
    }
    if (done[uTop] === 1) continue;
    if (uTop === eNode) break;
    const gu = dist[uTop]!;
    if (gu === Infinity) continue;
    done[uTop] = 1;
    if (uTop === sNode) {
      for (let k = 0; k < sList.length; k++) {
        const v = sList[k]!;
        if (done[v] === 1) continue;
        const wgt = sW[k]!;
        const nd = gu + wgt;
        if (nd + EPSB < dist[v]!) {
          dist[v] = nd;
          prev[v] = uTop;
          pushHeap(nd + hArr[v]!, v);
        }
      }
    } else if (uTop >= 0 && uTop < n) {
      const neigh = pre.adj[uTop]!;
      const wts = pre.adjW[uTop]!;
      for (let k = 0; k < neigh.length; k++) {
        const v = neigh[k]!;
        if (done[v] === 1) continue;
        const wgt = wts[k]!;
        const nd = gu + wgt;
        if (nd + EPSB < dist[v]!) {
          dist[v] = nd;
          prev[v] = uTop;
          pushHeap(nd + hArr[v]!, v);
        }
      }
      if (eVis[uTop] === 1) {
        const v = eNode;
        if (done[v] !== 1) {
          const wgt = eD[uTop]!;
          const nd = gu + wgt;
          if (nd + EPSB < dist[v]!) {
            dist[v] = nd;
            prev[v] = uTop;
            pushHeap(nd, v);
          }
        }
      }
    }
  }
  const best = dist[eNode]!;
  if (best === Infinity) return null;
  const rev: number[] = [];
  let cur = eNode;
  for (let step = 0; step < total + 5; step++) {
    rev.push(cur);
    if (cur === sNode) break;
    const p = prev[cur]!;
    if (p === -1) return null;
    cur = p;
  }
  const pts: [number, number][] = [];
  pts.push([fx, fy]);
  for (let i = rev.length - 2; i >= 1; i--) {
    const vi = rev[i]!;
    pts.push([pre.vx[vi]!, pre.vy[vi]!]);
  }
  pts.push([tx, ty]);
  return { points: pts, length: best };
}

export function navigator(grid: Grid): {
  path(from: readonly [number, number], to: readonly [number, number]): Path | null;
} {
  const pre = buildPre(grid);
  return {
    path(from: readonly [number, number], to: readonly [number, number]): Path | null {
      return queryPath(pre, from, to);
    },
  };
}

export function shortestPath(
  grid: Grid,
  from: readonly [number, number],
  to: readonly [number, number]
): Path | null {
  const pre = buildPre(grid);
  return queryPath(pre, from, to);
}
