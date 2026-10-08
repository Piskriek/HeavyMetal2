/**
 * @hm/hydro
 *
 * Deterministic water on a plot: streams down steepest descent, lakes in
 * hollows with one flat surface, overflow at the lowest rim, wetness fading
 * over WET_REACH cells. Every client gets the same map from the same terrain.
 */

export const WET_REACH: 6 = 6;

export interface Terrain {
  readonly size: number;
  readonly cell: number;
  readonly heights: readonly number[];
}

export interface Source {
  readonly x: number;
  readonly z: number;
  readonly share: number;
}

export interface Water {
  readonly depth: readonly number[];
  readonly level: readonly number[];
  readonly stream: readonly number[];
  readonly wet: readonly number[];
  readonly volume: number;
  readonly drained: number;
}

function n0(n: number): number {
  return n + 0;
}

const DX: readonly number[] = [-1, 1, 0, 0];
const DZ: readonly number[] = [0, 0, -1, 1];

type Heap = { h: number[]; i: number[] };

function heapPush(heap: Heap, height: number, i: number): void {
  heap.h.push(height);
  heap.i.push(i);
  let k = heap.h.length - 1;
  while (k > 0) {
    const p = (k - 1) >> 1;
    const hk = heap.h[k];
    const hp = heap.h[p];
    const ik = heap.i[k];
    const ip = heap.i[p];
    if (hk === undefined || hp === undefined || ik === undefined || ip === undefined) break;
    if (hp < hk || (hp === hk && ip <= ik)) break;
    heap.h[k] = hp;
    heap.i[k] = ip;
    heap.h[p] = hk;
    heap.i[p] = ik;
    k = p;
  }
}

function heapPop(heap: Heap): { h: number; i: number } | undefined {
  const n = heap.h.length;
  if (n === 0) return undefined;
  const h0 = heap.h[0];
  const i0 = heap.i[0];
  if (h0 === undefined || i0 === undefined) return undefined;
  const lastH = heap.h.pop();
  const lastI = heap.i.pop();
  if (lastH === undefined || lastI === undefined) return { h: h0, i: i0 };
  if (n === 1) return { h: h0, i: i0 };
  heap.h[0] = lastH;
  heap.i[0] = lastI;
  let k = 0;
  const len = heap.h.length;
  for (;;) {
    const l = k * 2 + 1;
    const r = l + 1;
    let best = k;
    const hk = heap.h[best];
    const ik = heap.i[best];
    if (hk === undefined || ik === undefined) break;
    if (l < len) {
      const hl = heap.h[l];
      const il = heap.i[l];
      if (hl !== undefined && il !== undefined && (hl < hk || (hl === hk && il < ik))) best = l;
    }
    const hb = heap.h[best];
    const ib = heap.i[best];
    if (hb === undefined || ib === undefined) break;
    if (r < len) {
      const hr = heap.h[r];
      const ir = heap.i[r];
      if (hr !== undefined && ir !== undefined && (hr < hb || (hr === hb && ir < ib))) best = r;
    }
    if (best === k) break;
    const hs = heap.h[k];
    const is = heap.i[k];
    const ht = heap.h[best];
    const it = heap.i[best];
    if (hs === undefined || is === undefined || ht === undefined || it === undefined) break;
    heap.h[k] = ht;
    heap.i[k] = it;
    heap.h[best] = hs;
    heap.i[best] = is;
    k = best;
  }
  return { h: h0, i: i0 };
}

export function flood(t: Terrain, sources: readonly Source[], volume: number): Water {
  const size = t.size;
  const n = size * size;
  if (t.heights.length !== n) throw new Error("heights length does not match size");
  if (volume < 0) throw new Error("negative volume");

  const H: number[] = [];
  for (let i = 0; i < n; i++) {
    const h = t.heights[i];
    if (h === undefined) throw new Error("heights length does not match size");
    H.push(h);
  }

  let sumShares = 0;
  for (const s of sources) {
    if (s.share <= 0) throw new Error("source share must be > 0");
    if (!Number.isInteger(s.x) || !Number.isInteger(s.z) || s.x < 0 || s.z < 0 || s.x >= size || s.z >= size) {
      throw new Error("source outside the grid");
    }
    sumShares += s.share;
  }

  const A = t.cell * t.cell;
  const depth: number[] = [];
  const flowThrough: number[] = [];
  for (let i = 0; i < n; i++) {
    depth.push(0);
    flowThrough.push(0);
  }
  let drained = 0;

  const neigh: number[][] = [];
  for (let i = 0; i < n; i++) {
    const x = i % size;
    const z = (i / size) | 0;
    const list: number[] = [];
    for (let k = 0; k < 4; k++) {
      const nx = x + (DX[k] ?? 0);
      const nz = z + (DZ[k] ?? 0);
      if (nx < 0 || nz < 0 || nx >= size || nz >= size) continue;
      list.push(nz * size + nx);
    }
    neigh.push(list);
  }

  const isBorder = (i: number): boolean => {
    const x = i % size;
    const z = (i / size) | 0;
    return x === 0 || z === 0 || x === size - 1 || z === size - 1;
  };

  const steepest = (i: number, exclude: Uint8Array | null): number => {
    const hi = H[i];
    if (hi === undefined) return -1;
    let best = -1;
    let bestH = 0;
    const x = i % size;
    const z = (i / size) | 0;
    for (let k = 0; k < 4; k++) {
      const nx = x + (DX[k] ?? 0);
      const nz = z + (DZ[k] ?? 0);
      if (nx < 0 || nz < 0 || nx >= size || nz >= size) continue;
      const j = nz * size + nx;
      if (exclude !== null && exclude[j] === 1) continue;
      const hj = H[j];
      if (hj === undefined || !(hj < hi)) continue;
      if (best < 0 || hj < bestH) {
        best = j;
        bestH = hj;
      }
    }
    return best;
  };

  const hasLowerOutside = (i: number, inLake: Uint8Array): boolean => {
    const hi = H[i];
    if (hi === undefined) return false;
    const nb = neigh[i];
    if (nb === undefined) return false;
    for (const j of nb) {
      if (inLake[j] === 1) continue;
      const hj = H[j];
      if (hj !== undefined && hj < hi) return true;
    }
    return false;
  };

  const writeDepths = (cells: readonly number[], level: number): void => {
    for (const i of cells) {
      const h = H[i];
      if (h === undefined) continue;
      const d = level - h;
      depth[i] = d > 0 ? d : 0;
    }
  };

  const fillLake = (seed: number, amount: number): { w: number; next: number } => {
    const inLake = new Uint8Array(n);
    const cells: number[] = [];
    let lakeWater = 0;
    if ((depth[seed] ?? 0) > 0) {
      const stack: number[] = [seed];
      inLake[seed] = 1;
      cells.push(seed);
      while (stack.length > 0) {
        const i = stack.pop();
        if (i === undefined) break;
        lakeWater += (depth[i] ?? 0) * A;
        const nb = neigh[i];
        if (nb === undefined) continue;
        for (const j of nb) {
          if (inLake[j] === 1) continue;
          if ((depth[j] ?? 0) > 0) {
            inLake[j] = 1;
            cells.push(j);
            stack.push(j);
          }
        }
      }
    } else {
      inLake[seed] = 1;
      cells.push(seed);
    }

    let currentLevel =
      (depth[seed] ?? 0) > 0 ? (H[seed] ?? 0) + (depth[seed] ?? 0) : (H[seed] ?? 0);

    let remaining = amount;
    const heap: Heap = { h: [], i: [] };

    const addRim = (i: number): void => {
      const nb = neigh[i];
      if (nb === undefined) return;
      for (const j of nb) {
        if (inLake[j] === 1) continue;
        const hj = H[j];
        if (hj === undefined) continue;
        heapPush(heap, hj, j);
      }
    };

    for (const c of cells) addRim(c);

    const mergeFrom = (start: number): void => {
      const st: number[] = [start];
      inLake[start] = 1;
      cells.push(start);
      while (st.length > 0) {
        const i = st.pop();
        if (i === undefined) break;
        lakeWater += (depth[i] ?? 0) * A;
        addRim(i);
        const nb = neigh[i];
        if (nb === undefined) continue;
        for (const j of nb) {
          if (inLake[j] === 1) continue;
          if ((depth[j] ?? 0) > 0) {
            inLake[j] = 1;
            cells.push(j);
            st.push(j);
          }
        }
      }
      let sumH = 0;
      for (const i of cells) sumH += H[i] ?? 0;
      if (cells.length > 0) currentLevel = (lakeWater / A + sumH) / cells.length;
    };

    while (remaining > 0) {
      let R = -1;
      let hR = 0;
      for (;;) {
        const it = heapPop(heap);
        if (it === undefined) {
          R = -1;
          break;
        }
        if (inLake[it.i] === 1) continue;
        R = it.i;
        hR = it.h;
        break;
      }
      if (R < 0) {
        drained += remaining;
        remaining = 0;
        break;
      }

      if ((depth[R] ?? 0) > 0) {
        mergeFrom(R);
        continue;
      }

      const spill = isBorder(R) || hasLowerOutside(R, inLake);
      const nCells = cells.length;
      let lift = hR - currentLevel;
      if (lift < 0) lift = 0;
      const cap = nCells * lift * A;

      if (spill) {
        if (remaining <= cap) {
          if (nCells > 0 && A > 0) currentLevel += remaining / (nCells * A);
          lakeWater += remaining;
          remaining = 0;
          break;
        }
        remaining -= cap;
        lakeWater += cap;
        currentLevel = hR;
        writeDepths(cells, currentLevel);
        flowThrough[R] = (flowThrough[R] ?? 0) + remaining;
        const next = steepest(R, inLake);
        if (next < 0) {
          drained += remaining;
          remaining = 0;
          return { w: 0, next: 0 };
        }
        return { w: remaining, next };
      }

      if (remaining <= cap) {
        if (nCells > 0 && A > 0) currentLevel += remaining / (nCells * A);
        lakeWater += remaining;
        remaining = 0;
        break;
      }
      remaining -= cap;
      lakeWater += cap;
      currentLevel = hR;
      inLake[R] = 1;
      cells.push(R);
      addRim(R);
    }

    writeDepths(cells, currentLevel);
    return { w: 0, next: 0 };
  };

  const route = (start: number, amount: number): void => {
    let i = start;
    let w = amount;
    while (w > 0) {
      flowThrough[i] = (flowThrough[i] ?? 0) + w;
      if (depth[i]! > 0) {
        const r = fillLake(i, w);
        w = r.w;
        if (w <= 0) return;
        i = r.next;
        continue;
      }
      const nxt = steepest(i, null);
      if (nxt >= 0) {
        i = nxt;
        continue;
      }
      if (isBorder(i)) {
        drained += w;
        return;
      }
      const r = fillLake(i, w);
      w = r.w;
      if (w <= 0) return;
      i = r.next;
    }
  };

  if (volume > 0 && sumShares > 0) {
    for (const s of sources) {
      const amount = (volume * s.share) / sumShares;
      if (amount > 0) route(s.z * size + s.x, amount);
    }
  }

  const depthOut: number[] = [];
  const levelOut: number[] = [];
  const stream: number[] = [];
  let lakeVol = 0;
  for (let i = 0; i < n; i++) {
    const h = H[i] ?? 0;
    let d = depth[i] ?? 0;
    if (!(d > 0)) d = 0;
    depthOut.push(n0(d));
    levelOut.push(n0(h + d));
    lakeVol += d * A;
    if (d > 0 || volume <= 0) stream.push(0);
    else {
      const f = flowThrough[i] ?? 0;
      let s = f / volume;
      if (s < 0) s = 0;
      else if (s > 1) s = 1;
      stream.push(n0(s));
    }
  }

  const wet: number[] = [];
  const dist: number[] = [];
  const q: number[] = [];
  let qh = 0;
  for (let i = 0; i < n; i++) {
    const d = depthOut[i] ?? 0;
    const s = stream[i] ?? 0;
    if (d > 0 || s > 0) {
      dist.push(0);
      wet.push(1);
      q.push(i);
    } else {
      dist.push(-1);
      wet.push(0);
    }
  }
  while (qh < q.length) {
    const i = q[qh];
    qh += 1;
    if (i === undefined) continue;
    const di = dist[i] ?? 0;
    const nb = neigh[i];
    if (nb === undefined) continue;
    for (const j of nb) {
      if ((dist[j] ?? -1) >= 0) continue;
      const nd = di + 1;
      dist[j] = nd;
      let w = 1 - nd / WET_REACH;
      if (w < 0) w = 0;
      wet[j] = n0(w);
      if (nd < WET_REACH) q.push(j);
    }
  }
  for (let i = 0; i < n; i++) {
    const w = wet[i];
    wet[i] = n0(w === undefined || w < 0 ? 0 : w > 1 ? 1 : w);
  }

  return {
    depth: depthOut,
    level: levelOut,
    stream,
    wet,
    volume: n0(lakeVol),
    drained: n0(drained),
  };
}
