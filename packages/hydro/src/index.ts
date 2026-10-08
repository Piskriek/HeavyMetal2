/**
 * @hm/hydro — where the water lies on a plot.
 *
 * Streams run downhill from each source, hollows fill with one flat surface
 * each, full lakes spill into the next hollow, and water leaves over the edge
 * of the plot. The wetness it reports feeds the coverage layers.
 *
 * Pure functions only: no DOM, no Date, no Math.random, no imports, and the
 * inputs are never mutated.
 *
 * Termination. Every loop here is backed by a well-founded measure:
 *   - a dry run goes strictly downhill, so it visits each cell at most once;
 *   - a lake only ever gains cells (at most `size * size` additions in all);
 *   - a merge destroys a lake (at most one per lake ever made);
 *   - a transfer from one lake to another only happens with a strictly lower
 *     surface, because a lake's level is never above its lowest rim cell;
 *   - and should floating point ever bend that invariant, a cycle detector
 *     turns the loop into a merge (or into one more lake cell), which is
 *     progress by the counts above. A hard step budget backs the lot up.
 */

/** How far, in cells, the damp ground reaches from open water. */
export const WET_REACH = 6 as const;

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

/** -x, +x, -z, +z — the tie-break order for steepest descent. */
const DX: readonly number[] = [-1, 1, 0, 0];
const DZ: readonly number[] = [0, 0, -1, 1];

/** Two surfaces this close together count as the same surface. */
const EPS = 1e-9;

interface Lake {
  /** the lake's cells, ascending by height */
  cells: number[];
  /** their heights, ascending */
  hs: number[];
  /** pre[k] = the sum of the first k heights */
  pre: number[];
  /** the water it holds, in cubic metres */
  water: number;
  /** its one flat surface */
  level: number;
  /** rim candidates: a lazy binary heap, lowest first */
  heapI: number[];
  heapH: number[];
  /** -1 while this lake is its own root, else the lake it was merged into */
  merged: number;
  /** the cell it last spilled over, or -1 */
  spill: number;
}

interface Fill {
  /** the water still to place */
  readonly rest: number;
  /** where it carries on from, or -1 when this pour is finished */
  readonly from: number;
  /** whether anything changed: water placed, a cell added, or a merge */
  readonly progress: boolean;
}

/**
 * Work out where the water lies.
 *
 * @throws Error for heights of the wrong length, a source off the grid,
 *         a share <= 0, or a negative volume.
 */
export function flood(t: Terrain, sources: readonly Source[], volume: number): Water {
  /* ---------------- validation ---------------- */

  if (typeof t.size !== 'number' || !Number.isInteger(t.size) || t.size <= 0) {
    throw new Error('hydro: terrain size must be a positive integer');
  }
  const size = t.size;
  const n = size * size;
  if (t.heights.length !== n) {
    throw new Error(`hydro: heights has ${t.heights.length} values, expected ${n}`);
  }
  if (typeof t.cell !== 'number' || !Number.isFinite(t.cell) || t.cell <= 0) {
    throw new Error('hydro: terrain cell size must be a positive number');
  }
  if (typeof volume !== 'number' || !Number.isFinite(volume) || volume < 0) {
    throw new Error('hydro: volume must be a finite number >= 0');
  }

  const H = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const h = t.heights[i];
    if (typeof h !== 'number' || !Number.isFinite(h)) {
      throw new Error(`hydro: height ${i} is not a finite number`);
    }
    H[i] = h;
  }

  let shareSum = 0;
  for (const s of sources) {
    if (!Number.isInteger(s.x) || !Number.isInteger(s.z) || s.x < 0 || s.z < 0 || s.x >= size || s.z >= size) {
      throw new Error(`hydro: source (${s.x}, ${s.z}) is outside the grid`);
    }
    if (typeof s.share !== 'number' || !Number.isFinite(s.share) || s.share <= 0) {
      throw new Error('hydro: a source share must be a finite number > 0');
    }
    shareSum += s.share;
  }

  /* ---------------- state ---------------- */

  const area = t.cell * t.cell;
  const hAt = (i: number): number => H[i] ?? 0;
  const flow = new Float64Array(n);
  const lakeOf = new Int32Array(n).fill(-1);
  const lakes: Lake[] = [];
  /** the chain stamp each lake was last seen under, for the cycle detector */
  const mark: number[] = [];
  let drained = 0;

  const Lk = (id: number): Lake => {
    const l = lakes[id];
    if (l === undefined) throw new Error('hydro: internal error, no such lake');
    return l;
  };

  /** union-find over merged lakes, with path compression */
  const findRoot = (id: number): number => {
    let r = id;
    for (;;) {
      const m = Lk(r).merged;
      if (m < 0) break;
      r = m;
    }
    let k = id;
    while (k !== r) {
      const next = Lk(k).merged;
      Lk(k).merged = r;
      if (next < 0) break;
      k = next;
    }
    return r;
  };

  const lakeIdAt = (cell: number): number => {
    const raw = lakeOf[cell] ?? -1;
    return raw < 0 ? -1 : findRoot(raw);
  };

  const isBorder = (c: number): boolean => {
    const x = c % size;
    const z = (c - x) / size;
    return x === 0 || z === 0 || x === size - 1 || z === size - 1;
  };

  /* ---------------- the rim heap ---------------- */

  const hLess = (lk: Lake, a: number, b: number): boolean => {
    const ha = lk.heapH[a] ?? 0;
    const hb = lk.heapH[b] ?? 0;
    if (ha !== hb) return ha < hb;
    return (lk.heapI[a] ?? 0) < (lk.heapI[b] ?? 0);
  };
  const hSwap = (lk: Lake, a: number, b: number): void => {
    const ti = lk.heapI[a] ?? 0;
    const th = lk.heapH[a] ?? 0;
    lk.heapI[a] = lk.heapI[b] ?? 0;
    lk.heapH[a] = lk.heapH[b] ?? 0;
    lk.heapI[b] = ti;
    lk.heapH[b] = th;
  };
  const hPush = (lk: Lake, cell: number): void => {
    lk.heapI.push(cell);
    lk.heapH.push(hAt(cell));
    let k = lk.heapI.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (!hLess(lk, k, p)) break;
      hSwap(lk, k, p);
      k = p;
    }
  };
  const hPop = (lk: Lake): number => {
    if (lk.heapI.length === 0) return -1;
    const top = lk.heapI[0] ?? -1;
    const lastI = lk.heapI.pop();
    const lastH = lk.heapH.pop();
    if (lk.heapI.length > 0 && lastI !== undefined && lastH !== undefined) {
      lk.heapI[0] = lastI;
      lk.heapH[0] = lastH;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1;
        const r = l + 1;
        let m = k;
        if (l < lk.heapI.length && hLess(lk, l, m)) m = l;
        if (r < lk.heapI.length && hLess(lk, r, m)) m = r;
        if (m === k) break;
        hSwap(lk, k, m);
        k = m;
      }
    }
    return top;
  };

  /* ---------------- lake maths ---------------- */

  /** how many of the lake's cells sit at or below a height */
  const countBelow = (lk: Lake, target: number): number => {
    let lo = 0;
    let hi = lk.hs.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if ((lk.hs[mid] ?? 0) <= target) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };

  /** the water still needed to bring the lake up to a level */
  const capacityTo = (lk: Lake, target: number): number => {
    const k = countBelow(lk, target);
    const need = area * (k * target - (lk.pre[k] ?? 0));
    const cap = need - lk.water;
    return cap > 0 ? cap : 0;
  };

  /**
   * The one flat surface that holds exactly the water the lake has.
   *
   * With the heights ascending, f(k) = (water / area + pre[k]) / k is the
   * level if k cells are under water, and `f(k) <= hs[k]` is monotone in k,
   * so the right k is a binary search away.
   */
  const solveLevel = (lk: Lake): number => {
    const count = lk.hs.length;
    if (count === 0) return 0;
    const w = lk.water / area;
    let lo = 1;
    let hi = count;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      const lvl = (w + (lk.pre[mid] ?? 0)) / mid;
      if (lvl <= (lk.hs[mid] ?? Number.POSITIVE_INFINITY)) hi = mid;
      else lo = mid + 1;
    }
    return (w + (lk.pre[lo] ?? 0)) / lo;
  };

  const pushRim = (lk: Lake, id: number, c: number): void => {
    const x = c % size;
    const z = (c - x) / size;
    for (let d = 0; d < 4; d++) {
      const nx = x + (DX[d] ?? 0);
      const nz = z + (DZ[d] ?? 0);
      if (nx < 0 || nz < 0 || nx >= size || nz >= size) continue;
      const m = nz * size + nx;
      if (lakeIdAt(m) === id) continue;
      hPush(lk, m);
    }
  };

  /**
   * Take a cell into a lake. Cells almost always arrive in height order, so
   * this is a push; the water is then spread again over the new cell set,
   * which keeps `level` honest even when a lower cell joins late.
   */
  const addCell = (id: number, c: number): void => {
    const lk = Lk(id);
    const h = hAt(c);
    lakeOf[c] = id;
    const k = lk.hs.length;
    if (k === 0 || h >= (lk.hs[k - 1] ?? 0)) {
      lk.cells.push(c);
      lk.hs.push(h);
      lk.pre.push((lk.pre[k] ?? 0) + h);
    } else {
      let pos = 0;
      let hi = k;
      while (pos < hi) {
        const mid = (pos + hi) >> 1;
        if ((lk.hs[mid] ?? 0) <= h) pos = mid + 1;
        else hi = mid;
      }
      lk.cells.splice(pos, 0, c);
      lk.hs.splice(pos, 0, h);
      lk.pre.push(0);
      for (let q = pos; q < lk.hs.length; q++) lk.pre[q + 1] = (lk.pre[q] ?? 0) + (lk.hs[q] ?? 0);
    }
    lk.level = solveLevel(lk);
    pushRim(lk, id, c);
  };

  const newLake = (c: number): number => {
    const id = lakes.length;
    const h = hAt(c);
    const lk: Lake = {
      cells: [c],
      hs: [h],
      pre: [0, h],
      water: 0,
      level: h,
      heapI: [],
      heapH: [],
      merged: -1,
      spill: -1,
    };
    lakes.push(lk);
    mark.push(0);
    lakeOf[c] = id;
    pushRim(lk, id, c);
    return id;
  };

  /** Join two lakes into one pool with one surface. Returns the survivor. */
  const mergeLakes = (ra: number, rb: number): number => {
    let a = findRoot(ra);
    let b = findRoot(rb);
    if (a === b) return a;
    if (Lk(a).cells.length < Lk(b).cells.length) {
      const swap = a;
      a = b;
      b = swap;
    }
    const A = Lk(a);
    const B = Lk(b);
    for (const c of B.cells) lakeOf[c] = a;

    const na = A.cells.length;
    const nb = B.cells.length;
    const cells: number[] = new Array<number>(na + nb);
    const hs: number[] = new Array<number>(na + nb);
    let i = 0;
    let j = 0;
    let k = 0;
    while (i < na && j < nb) {
      const ha = A.hs[i] ?? 0;
      const hb = B.hs[j] ?? 0;
      if (ha <= hb) {
        cells[k] = A.cells[i] ?? 0;
        hs[k] = ha;
        i++;
      } else {
        cells[k] = B.cells[j] ?? 0;
        hs[k] = hb;
        j++;
      }
      k++;
    }
    while (i < na) {
      cells[k] = A.cells[i] ?? 0;
      hs[k] = A.hs[i] ?? 0;
      i++;
      k++;
    }
    while (j < nb) {
      cells[k] = B.cells[j] ?? 0;
      hs[k] = B.hs[j] ?? 0;
      j++;
      k++;
    }
    const pre: number[] = new Array<number>(na + nb + 1);
    pre[0] = 0;
    for (let q = 0; q < hs.length; q++) pre[q + 1] = (pre[q] ?? 0) + (hs[q] ?? 0);

    A.cells = cells;
    A.hs = hs;
    A.pre = pre;
    A.water += B.water;
    A.level = solveLevel(A);
    if (A.spill < 0) A.spill = B.spill;
    for (let q = 0; q < B.heapI.length; q++) {
      const c = B.heapI[q] ?? -1;
      if (c >= 0 && lakeIdAt(c) !== a) hPush(A, c);
    }

    B.merged = a;
    B.cells = [];
    B.hs = [];
    B.pre = [0];
    B.heapI = [];
    B.heapH = [];
    B.water = 0;
    B.spill = -1;
    return a;
  };

  /* ---------------- routing ---------------- */

  /** the steepest strictly lower 4-neighbour; ties go -x, +x, -z, +z */
  const steepestLower = (c: number, exclude: number): number => {
    const x = c % size;
    const z = (c - x) / size;
    const hc = hAt(c);
    let best = -1;
    let drop = 0;
    for (let d = 0; d < 4; d++) {
      const nx = x + (DX[d] ?? 0);
      const nz = z + (DZ[d] ?? 0);
      if (nx < 0 || nz < 0 || nx >= size || nz >= size) continue;
      const m = nz * size + nx;
      if (exclude >= 0 && lakeIdAt(m) === exclude) continue;
      const fall = hc - hAt(m);
      if (fall > 0 && fall > drop) {
        drop = fall;
        best = m;
      }
    }
    return best;
  };

  /* Each of these only ever runs after an addition or a merge, both of which
     are capped by the number of cells, so the budgets below are slack. */
  const fillBudget = 4 * n + 64;
  const pourBudget = 64 * n + 100000;

  /**
   * Pour water into a lake. It rises to its lowest rim, and then either
   * swallows that cell, joins the lake next to it, spills on, or runs off
   * the edge of the plot.
   */
  const fillLake = (startId: number, vol: number): Fill => {
    let id = findRoot(startId);
    let V = vol;
    let progress = false;

    for (let iter = 0; iter < fillBudget; iter++) {
      if (V <= 0) return { rest: 0, from: -1, progress: true };
      const lk = Lk(id);

      /* the lowest rim cell that is still outside the lake */
      let r = -1;
      for (;;) {
        const cand = hPop(lk);
        if (cand < 0) break;
        if (lakeIdAt(cand) === id) continue;
        r = cand;
        break;
      }
      if (r < 0) {
        /* nowhere left to go: the lake keeps the water */
        lk.water += V;
        lk.level = solveLevel(lk);
        return { rest: 0, from: -1, progress: true };
      }

      const hr = hAt(r);
      if (hr > lk.level) {
        const cap = capacityTo(lk, hr);
        if (V < cap) {
          /* the water runs out part way up: solve the level exactly */
          lk.water += V;
          lk.level = solveLevel(lk);
          hPush(lk, r);
          return { rest: 0, from: -1, progress: true };
        }
        if (cap > 0) {
          V -= cap;
          lk.water += cap;
          progress = true;
        }
        lk.level = hr;
      }

      /* the rim cell is another lake's: the two surfaces meet */
      const rimLake = lakeIdAt(r);
      if (rimLake >= 0 && rimLake !== id) {
        id = mergeLakes(id, rimLake);
        progress = true;
        continue;
      }

      const out = steepestLower(r, id);
      if (out >= 0) {
        const outLake = lakeIdAt(out);
        if (outLake >= 0 && outLake !== id && Lk(outLake).level >= hr - EPS) {
          /* it runs straight into water already at this height: one lake */
          id = mergeLakes(id, outLake);
          addCell(id, r);
          progress = true;
          continue;
        }
        /* full here: it spills over this cell and runs on */
        const own = Lk(id);
        own.spill = r;
        hPush(own, r);
        flow[r] = (flow[r] ?? 0) + V;
        return { rest: V, from: out, progress };
      }

      if (isBorder(r)) {
        /* the rim is the edge of the plot: the water leaves */
        flow[r] = (flow[r] ?? 0) + V;
        drained += V;
        hPush(lk, r);
        return { rest: 0, from: -1, progress: true };
      }

      /* a closed rim cell: the lake swallows it and keeps rising */
      addCell(id, r);
      progress = true;
    }

    /* unreachable: the budget is far above the number of possible changes */
    drained += V;
    return { rest: 0, from: -1, progress: true };
  };

  let chainStamp = 0;

  /** Pour one source's water in, from its cell. */
  const pour = (start: number, vol: number): void => {
    let cell = start;
    let V = vol;
    let chain = ++chainStamp;
    const chainLakes: number[] = [];

    for (let ops = 0; ops < pourBudget; ops++) {
      if (V <= 0) return;
      const id = lakeIdAt(cell);

      if (id >= 0) {
        if (mark[id] === chain) {
          /* back at a lake with nothing placed since: the water is going
             round in a ring, so close the ring off and make progress */
          let forced = false;
          let root = findRoot(id);
          for (const other of chainLakes) {
            const o = findRoot(other);
            if (o !== root) {
              root = mergeLakes(root, o);
              forced = true;
            }
          }
          if (!forced) {
            const sp = Lk(root).spill;
            if (sp >= 0) {
              const spLake = lakeIdAt(sp);
              if (spLake < 0) {
                addCell(root, sp);
                forced = true;
              } else if (spLake !== root) {
                root = mergeLakes(root, spLake);
                forced = true;
              }
            }
          }
          chain = ++chainStamp;
          chainLakes.length = 0;
          if (!forced) {
            /* unreachable: nothing left to join or swallow */
            drained += V;
            return;
          }
          continue;
        }

        mark[id] = chain;
        chainLakes.push(id);
        const res = fillLake(id, V);
        if (res.from < 0) return;
        if (res.progress) {
          chain = ++chainStamp;
          chainLakes.length = 0;
        }
        V = res.rest;
        cell = res.from;
        continue;
      }

      flow[cell] = (flow[cell] ?? 0) + V;
      const next = steepestLower(cell, -1);
      if (next >= 0) {
        cell = next;
        continue;
      }
      if (isBorder(cell)) {
        drained += V;
        return;
      }
      newLake(cell);
      chain = ++chainStamp;
      chainLakes.length = 0;
    }

    /* unreachable: every step above either places water, adds a cell,
       joins two lakes, or walks strictly downhill */
    drained += V;
  };

  if (volume > 0 && shareSum > 0) {
    for (const s of sources) {
      const share = (volume * s.share) / shareSum;
      if (share > 0) pour(s.z * size + s.x, share);
    }
  }

  /* ---------------- results ---------------- */

  const depth: number[] = new Array<number>(n);
  const level: number[] = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    depth[i] = 0;
    level[i] = hAt(i) + 0;
  }
  for (let id = 0; id < lakes.length; id++) {
    const lk = lakes[id];
    if (lk === undefined || lk.merged >= 0) continue;
    for (const c of lk.cells) {
      const d = lk.level - hAt(c);
      if (d > 0) {
        depth[c] = d;
        level[c] = hAt(c) + d;
      }
    }
  }

  let held = 0;
  for (let i = 0; i < n; i++) held += (depth[i] ?? 0) * area;

  const stream: number[] = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    if ((depth[i] ?? 0) > 0 || volume <= 0) {
      stream[i] = 0;
      continue;
    }
    const f = (flow[i] ?? 0) / volume;
    stream[i] = f <= 0 ? 0 : f >= 1 ? 1 : f;
  }

  /* wetness: 1 at the water, fading away over WET_REACH cells */
  const wet: number[] = new Array<number>(n);
  const dist = new Int32Array(n).fill(-1);
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;
  for (let i = 0; i < n; i++) {
    if ((depth[i] ?? 0) > 0 || (stream[i] ?? 0) > 0) {
      dist[i] = 0;
      queue[tail++] = i;
    }
  }
  while (head < tail) {
    const c = queue[head++] ?? 0;
    const d = (dist[c] ?? 0) + 1;
    if (d > WET_REACH) continue;
    const x = c % size;
    const z = (c - x) / size;
    for (let k = 0; k < 4; k++) {
      const nx = x + (DX[k] ?? 0);
      const nz = z + (DZ[k] ?? 0);
      if (nx < 0 || nz < 0 || nx >= size || nz >= size) continue;
      const m = nz * size + nx;
      if ((dist[m] ?? -1) >= 0) continue;
      dist[m] = d;
      queue[tail++] = m;
    }
  }
  for (let i = 0; i < n; i++) {
    const d = dist[i] ?? -1;
    if (d < 0) {
      wet[i] = 0;
      continue;
    }
    const v = 1 - d / WET_REACH;
    wet[i] = v <= 0 ? 0 : v >= 1 ? 1 : v;
  }

  return { depth, level, stream, wet, volume: held + 0, drained: drained + 0 };
}
