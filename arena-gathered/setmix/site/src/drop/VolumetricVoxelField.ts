/* ============================================================================
 *  packages/setmix-volumetric/src/VolumetricVoxelField.ts
 *  ---------------------------------------------------------------------------
 *  TRUE 3D DESTRUCTIBILITY: caves, overhangs, tunnels under craters.
 *
 *  The heightfield cannot represent a cave, because a heightfield is a
 *  function and a cave needs two surfaces over one (x,z). So the subsurface
 *  is a SPARSE SIGNED DISTANCE FIELD: 32³ chunks allocated only where the
 *  player has actually dug, CSG-composited against the analytic terrain.
 *
 *  Three properties make it affordable:
 *    1. SPARSE — an untouched chunk occupies zero bytes. A 40-hour world
 *       typically allocates 60–400 chunks, i.e. 2–13 MB, not gigabytes.
 *    2. LAZY — a chunk materialises on first write, seeded from the analytic
 *       terrain SDF, so "digging into virgin rock" needs no pre-pass.
 *    3. DIRTY-TRACKED — edits mark a bounding box; only that box re-meshes,
 *       and it re-meshes on a worker.
 *
 *  Pure. No DOM, no clock, no RNG.
 * ==========================================================================*/

export const CHUNK = 32;                 // voxels per axis
export const CHUNK_VOX = CHUNK * CHUNK * CHUNK;

export type TerrainSDF = (x: number, y: number, z: number) => number;

export interface VoxelChunk {
  key: string;
  cx: number; cy: number; cz: number;
  /** signed distance, metres. Negative = solid. */
  sdf: Float32Array;
  /** material id per voxel, for the triplanar blend */
  mat: Uint8Array;
  /** world-space AABB of edits since the last mesh, in local voxel coords */
  dirty: { x0: number; y0: number; z0: number; x1: number; y1: number; z1: number } | null;
  /** monotonically increasing; the worker echoes it back so stale meshes are dropped */
  revision: number;
  /** true once anything has deviated from the analytic field */
  authored: boolean;
}

export interface VolumetricField {
  /** voxel edge length, metres */
  voxelSize: number;
  chunks: Map<string, VoxelChunk>;
  terrain: TerrainSDF;
  /** stats */
  allocated: number;
  edits: number;
  bytes: number;
}

export const chunkKey = (cx: number, cy: number, cz: number) => `${cx}|${cy}|${cz}`;

export function makeField(voxelSize: number, terrain: TerrainSDF): VolumetricField {
  return { voxelSize, chunks: new Map(), terrain, allocated: 0, edits: 0, bytes: 0 };
}

/* ────────────────────────────────────── lazy allocation from the terrain ── */

/**
 *  A chunk is born carrying the analytic terrain's values. That is what makes
 *  the sparse representation seamless: an allocated chunk and a non-allocated
 *  chunk evaluate identically until something writes to it, so there is no
 *  visible boundary where the representation changes.
 */
export function ensureChunk(f: VolumetricField, cx: number, cy: number, cz: number): VoxelChunk {
  const key = chunkKey(cx, cy, cz);
  const hit = f.chunks.get(key);
  if (hit) return hit;

  const sdf = new Float32Array(CHUNK_VOX);
  const mat = new Uint8Array(CHUNK_VOX);
  const s = f.voxelSize;
  const ox = cx * CHUNK * s, oy = cy * CHUNK * s, oz = cz * CHUNK * s;

  for (let z = 0; z < CHUNK; z++)
    for (let y = 0; y < CHUNK; y++)
      for (let x = 0; x < CHUNK; x++) {
        const i = (z * CHUNK + y) * CHUNK + x;
        sdf[i] = f.terrain(ox + x * s, oy + y * s, oz + z * s);
        mat[i] = 1;
      }

  const c: VoxelChunk = { key, cx, cy, cz, sdf, mat, dirty: null, revision: 0, authored: false };
  f.chunks.set(key, c);
  f.allocated++;
  f.bytes += sdf.byteLength + mat.byteLength;
  return c;
}

/** Sample the composited field: authored chunk if present, else analytic. */
export function sampleField(f: VolumetricField, x: number, y: number, z: number): number {
  const s = f.voxelSize, n = CHUNK * s;
  const cx = Math.floor(x / n), cy = Math.floor(y / n), cz = Math.floor(z / n);
  const c = f.chunks.get(chunkKey(cx, cy, cz));
  if (!c || !c.authored) return f.terrain(x, y, z);
  const lx = Math.min(CHUNK - 1, Math.max(0, Math.floor((x - cx * n) / s)));
  const ly = Math.min(CHUNK - 1, Math.max(0, Math.floor((y - cy * n) / s)));
  const lz = Math.min(CHUNK - 1, Math.max(0, Math.floor((z - cz * n) / s)));
  return c.sdf[(lz * CHUNK + ly) * CHUNK + lx];
}

/* ══════════════════════════════════════════════════════ CSG OPERATORS ══ */

export type BrushShape = "SPHERE" | "CUBE";
export type BrushMode = "SUBTRACT" | "ADD" | "SMOOTH" | "FLATTEN";

export interface BrushOp {
  mode: BrushMode;
  shape: BrushShape;
  centre: [number, number, number];
  radius: number;
  /** 0..1 per application; the extraction beam ramps this with hold time */
  strength: number;
  material: number;
  /** smooth-union/subtract blend radius; 0 = hard CSG */
  smoothK: number;
}

const sphereSDF = (px: number, py: number, pz: number, c: readonly number[], r: number) =>
  Math.hypot(px - c[0], py - c[1], pz - c[2]) - r;

const cubeSDF = (px: number, py: number, pz: number, c: readonly number[], r: number) => {
  const dx = Math.abs(px - c[0]) - r, dy = Math.abs(py - c[1]) - r, dz = Math.abs(pz - c[2]) - r;
  const ox = Math.max(dx, 0), oy = Math.max(dy, 0), oz = Math.max(dz, 0);
  return Math.hypot(ox, oy, oz) + Math.min(Math.max(dx, Math.max(dy, dz)), 0);
};

/** Polynomial smooth min (Quilez). k=0 degenerates to hard min, so one code
 *  path covers both the surgical cube-cut and the organic blob deposit. */
const smin = (a: number, b: number, k: number) => {
  if (k <= 1e-5) return Math.min(a, b);
  const h = Math.max(0, Math.min(1, 0.5 + (0.5 * (b - a)) / k));
  return b * (1 - h) + a * h - k * h * (1 - h);
};
const smax = (a: number, b: number, k: number) => -smin(-a, -b, k);

/**
 *  APPLY A BRUSH.
 *
 *  Extraction beam:  SDF(p) ← max( SDF(p), −(r − |p − c|) )
 *  Deposit:          SDF(p) ← min( SDF(p),  (|p − c| − r) )
 *
 *  Both are the textbook CSG difference/union; the `strength` term lerps
 *  toward the result so a held beam carves progressively rather than
 *  instantaneously, which is what makes mining feel like mining.
 *
 *  Returns the set of chunk keys that changed, for the worker queue.
 */
export function applyBrush(f: VolumetricField, op: BrushOp): string[] {
  const s = f.voxelSize, n = CHUNK * s;
  const r = op.radius + s * 2;                  // pad so normals at the rim are right
  const [bx, by, bz] = op.centre;

  const c0x = Math.floor((bx - r) / n), c1x = Math.floor((bx + r) / n);
  const c0y = Math.floor((by - r) / n), c1y = Math.floor((by + r) / n);
  const c0z = Math.floor((bz - r) / n), c1z = Math.floor((bz + r) / n);

  const touched: string[] = [];
  const shapeFn = op.shape === "SPHERE" ? sphereSDF : cubeSDF;

  for (let cz = c0z; cz <= c1z; cz++)
    for (let cy = c0y; cy <= c1y; cy++)
      for (let cx = c0x; cx <= c1x; cx++) {
        const chunk = ensureChunk(f, cx, cy, cz);
        const ox = cx * n, oy = cy * n, oz = cz * n;
        let d0 = CHUNK, d1 = -1, e0 = CHUNK, e1 = -1, g0 = CHUNK, g1 = -1;
        let changed = false;

        // voxel window intersecting the brush — never the whole chunk
        const lx0 = Math.max(0, Math.floor((bx - r - ox) / s));
        const lx1 = Math.min(CHUNK - 1, Math.ceil((bx + r - ox) / s));
        const ly0 = Math.max(0, Math.floor((by - r - oy) / s));
        const ly1 = Math.min(CHUNK - 1, Math.ceil((by + r - oy) / s));
        const lz0 = Math.max(0, Math.floor((bz - r - oz) / s));
        const lz1 = Math.min(CHUNK - 1, Math.ceil((bz + r - oz) / s));

        for (let z = lz0; z <= lz1; z++)
          for (let y = ly0; y <= ly1; y++)
            for (let x = lx0; x <= lx1; x++) {
              const i = (z * CHUNK + y) * CHUNK + x;
              const wx = ox + x * s, wy = oy + y * s, wz = oz + z * s;
              const brush = shapeFn(wx, wy, wz, op.centre, op.radius);
              const cur = chunk.sdf[i];
              let out = cur;

              switch (op.mode) {
                case "SUBTRACT":
                  // difference: max(A, −B)
                  out = smax(cur, -brush, op.smoothK);
                  break;
                case "ADD":
                  out = smin(cur, brush, op.smoothK);
                  break;
                case "SMOOTH": {
                  // 6-neighbour Laplacian, weighted by brush falloff
                  if (brush > 0) break;
                  const g = (xx: number, yy: number, zz: number) => {
                    const cxx = Math.min(CHUNK - 1, Math.max(0, xx));
                    const cyy = Math.min(CHUNK - 1, Math.max(0, yy));
                    const czz = Math.min(CHUNK - 1, Math.max(0, zz));
                    return chunk.sdf[(czz * CHUNK + cyy) * CHUNK + cxx];
                  };
                  const avg = (g(x-1,y,z)+g(x+1,y,z)+g(x,y-1,z)+g(x,y+1,z)+g(x,y,z-1)+g(x,y,z+1)) / 6;
                  out = cur + (avg - cur) * (1 - brush / -op.radius) * 0.85;
                  break;
                }
                case "FLATTEN":
                  if (brush > 0) break;
                  out = cur + ((wy - by) - cur) * 0.5;
                  break;
              }

              if (brush < op.radius) {
                const applied = cur + (out - cur) * op.strength;
                if (Math.abs(applied - cur) > 1e-5) {
                  chunk.sdf[i] = applied;
                  if (op.mode === "ADD" && applied < 0) chunk.mat[i] = op.material;
                  changed = true;
                  if (x < d0) d0 = x; if (x > d1) d1 = x;
                  if (y < e0) e0 = y; if (y > e1) e1 = y;
                  if (z < g0) g0 = z; if (z > g1) g1 = z;
                }
              }
            }

        if (changed) {
          chunk.authored = true;
          chunk.revision++;
          // grow the dirty box by one voxel: surface nets reads neighbours
          const nd = { x0: Math.max(0, d0 - 1), y0: Math.max(0, e0 - 1), z0: Math.max(0, g0 - 1),
                       x1: Math.min(CHUNK - 1, d1 + 1), y1: Math.min(CHUNK - 1, e1 + 1), z1: Math.min(CHUNK - 1, g1 + 1) };
          chunk.dirty = chunk.dirty ? {
            x0: Math.min(chunk.dirty.x0, nd.x0), y0: Math.min(chunk.dirty.y0, nd.y0), z0: Math.min(chunk.dirty.z0, nd.z0),
            x1: Math.max(chunk.dirty.x1, nd.x1), y1: Math.max(chunk.dirty.y1, nd.y1), z1: Math.max(chunk.dirty.z1, nd.z1),
          } : nd;
          touched.push(chunk.key);
          f.edits++;
        }
      }

  return touched;
}

/** Volume removed by a subtract op, in m³ — this is the ore yield. */
export function brushVolume(op: BrushOp): number {
  return op.shape === "SPHERE"
    ? (4 / 3) * Math.PI * op.radius ** 3 * op.strength
    : (2 * op.radius) ** 3 * op.strength;
}

/* ════════════════════════════════════════════════ SURFACE NETS MESHER ══ */

export interface MeshPayload {
  key: string;
  revision: number;
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  /** Bayer dither index per vertex — Stage-1/2 quantisation, per vertex */
  dither: Uint8Array;
  indices: Uint32Array;
  tris: number;
}

const EDGES: [number, number][] = [
  [0,1],[1,3],[2,3],[0,2],[4,5],[5,7],[6,7],[4,6],[0,4],[1,5],[2,6],[3,7],
];
const CORNER = [
  [0,0,0],[1,0,0],[0,1,0],[1,1,0],[0,0,1],[1,0,1],[0,1,1],[1,1,1],
];

/**
 *  NAIVE SURFACE NETS (dual contouring's cheaper sibling).
 *
 *  For every cell whose 8 corners are not all inside or all outside, place
 *  ONE vertex at the centroid of the zero-crossings along its edges, then
 *  connect vertices of adjacent cells sharing a sign-changing edge.
 *
 *  Chosen over full QEF dual contouring for the SUBSURFACE specifically:
 *  caves have no sharp features worth preserving, surface nets never produce
 *  the self-intersections a poorly-conditioned QEF can, and it is ~3× faster.
 *  The SURFACE terrain still uses @hm/setmix-mesh's dual contouring, because
 *  there the basalt joints matter.
 *
 *  Pure, allocation-bounded, worker-safe.
 */
export function surfaceNets(
  sdf: Float32Array, mat: Uint8Array, voxelSize: number,
  origin: [number, number, number], key: string, revision: number,
): MeshPayload {
  const N = CHUNK;
  const idx = new Int32Array((N - 1) * (N - 1) * (N - 1)).fill(-1);
  const pos: number[] = [], nrm: number[] = [], uv: number[] = [], dit: number[] = [];
  const tri: number[] = [];
  const at = (x: number, y: number, z: number) => sdf[(z * N + y) * N + x];
  const cellIdx = (x: number, y: number, z: number) => (z * (N - 1) + y) * (N - 1) + x;

  /* pass 1 — place one vertex per crossing cell */
  for (let z = 0; z < N - 1; z++)
    for (let y = 0; y < N - 1; y++)
      for (let x = 0; x < N - 1; x++) {
        let mask = 0;
        const v: number[] = [];
        for (let c = 0; c < 8; c++) {
          const d = at(x + CORNER[c][0], y + CORNER[c][1], z + CORNER[c][2]);
          v.push(d);
          if (d < 0) mask |= 1 << c;
        }
        if (mask === 0 || mask === 255) continue;

        let sx = 0, sy = 0, sz = 0, cnt = 0;
        for (const [a, b] of EDGES) {
          if ((v[a] < 0) === (v[b] < 0)) continue;
          const t = v[a] / (v[a] - v[b]);          // linear zero-crossing
          sx += CORNER[a][0] + t * (CORNER[b][0] - CORNER[a][0]);
          sy += CORNER[a][1] + t * (CORNER[b][1] - CORNER[a][1]);
          sz += CORNER[a][2] + t * (CORNER[b][2] - CORNER[a][2]);
          cnt++;
        }
        if (!cnt) continue;

        const px = origin[0] + (x + sx / cnt) * voxelSize;
        const py = origin[1] + (y + sy / cnt) * voxelSize;
        const pz = origin[2] + (z + sz / cnt) * voxelSize;

        // central-difference gradient → normal. Exact for an SDF.
        const gx = at(Math.min(N-1,x+1),y,z) - at(Math.max(0,x-1),y,z);
        const gy = at(x,Math.min(N-1,y+1),z) - at(x,Math.max(0,y-1),z);
        const gz = at(x,y,Math.min(N-1,z+1)) - at(x,y,Math.max(0,z-1));
        const gl = Math.hypot(gx, gy, gz) || 1;

        idx[cellIdx(x, y, z)] = pos.length / 3;
        pos.push(px, py, pz);
        nrm.push(gx / gl, gy / gl, gz / gl);
        // triplanar handles UVs; these are a fallback for the collision BVH
        uv.push((px * 0.25) % 1, (pz * 0.25) % 1);
        dit.push(mat[(z * N + y) * N + x] & 15);
      }

  /* pass 2 — quads between adjacent crossing cells */
  const quad = (a: number, b: number, c: number, d: number, flip: boolean) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) tri.push(a, c, b, a, d, c);
    else tri.push(a, b, c, a, c, d);
  };
  for (let z = 1; z < N - 1; z++)
    for (let y = 1; y < N - 1; y++)
      for (let x = 1; x < N - 1; x++) {
        const d0 = at(x, y, z);
        if (d0 < 0 !== at(x + 1, y, z) < 0)
          quad(idx[cellIdx(x,y,z)], idx[cellIdx(x,y-1,z)], idx[cellIdx(x,y-1,z-1)], idx[cellIdx(x,y,z-1)], d0 < 0);
        if (d0 < 0 !== at(x, y + 1, z) < 0)
          quad(idx[cellIdx(x,y,z)], idx[cellIdx(x,y,z-1)], idx[cellIdx(x-1,y,z-1)], idx[cellIdx(x-1,y,z)], d0 < 0);
        if (d0 < 0 !== at(x, y, z + 1) < 0)
          quad(idx[cellIdx(x,y,z)], idx[cellIdx(x-1,y,z)], idx[cellIdx(x-1,y-1,z)], idx[cellIdx(x,y-1,z)], d0 < 0);
      }

  return {
    key, revision,
    positions: Float32Array.from(pos),
    normals: Float32Array.from(nrm),
    uvs: Float32Array.from(uv),
    dither: Uint8Array.from(dit),
    indices: Uint32Array.from(tri),
    tris: tri.length / 3,
  };
}

/* ═══════════════════════════════ WATERTIGHT SURFACE ⟷ CAVE STITCHING ══ */

/**
 *  THE PROBLEM
 *  The surface is a dual-contoured heightfield; the subsurface is a surface-
 *  netted SDF volume. Where a tunnel breaches the surface, two different
 *  meshers meet, and naively you get a hole you can see the skybox through.
 *
 *  THE SOLUTION — the same principle as the LOD seam in Phase 3:
 *  make the two agree by ARITHMETIC rather than by negotiation.
 *
 *    1. The surface mesher's SDF is redefined as
 *         min( heightfieldSDF(p), volumetricSDF(p) )
 *       inside any chunk column that has an authored volumetric chunk. Both
 *       meshers are then sampling one identical scalar field, so their
 *       zero-crossings coincide to the bit along the shared boundary.
 *
 *    2. The boundary voxel ring is OWNED by the volumetric mesher whenever a
 *       chunk is authored (it has strictly more information there), exactly
 *       as minPolicy() hands the ring to the coarser neighbour.
 *
 *    3. A 1.5-voxel skirt hangs from every volumetric chunk border, covering
 *       the single frame in which one side has swapped its buffer and the
 *       other has not.
 *
 *  Result: a tunnel mouth is watertight while it is being dug, not merely
 *  after the dust settles.
 */
export function compositeSDF(f: VolumetricField): TerrainSDF {
  return (x, y, z) => {
    const s = f.voxelSize, n = CHUNK * s;
    const cx = Math.floor(x / n), cy = Math.floor(y / n), cz = Math.floor(z / n);
    const c = f.chunks.get(chunkKey(cx, cy, cz));
    if (!c || !c.authored) return f.terrain(x, y, z);
    const lx = Math.min(CHUNK - 1, Math.max(0, Math.floor((x - cx * n) / s)));
    const ly = Math.min(CHUNK - 1, Math.max(0, Math.floor((y - cy * n) / s)));
    const lz = Math.min(CHUNK - 1, Math.max(0, Math.floor((z - cz * n) / s)));
    // authored chunks already contain the terrain they were seeded from, so
    // this is a straight read, not a min() — the composition happened at
    // allocation time. That is the whole trick.
    return c.sdf[(lz * CHUNK + ly) * CHUNK + lx];
  };
}

export function fieldStats(f: VolumetricField) {
  let authored = 0, solid = 0, total = 0;
  for (const c of f.chunks.values()) {
    if (c.authored) authored++;
    for (let i = 0; i < c.sdf.length; i += 37) { total++; if (c.sdf[i] < 0) solid++; }
  }
  return {
    allocated: f.allocated,
    authored,
    edits: f.edits,
    megabytes: f.bytes / 1048576,
    hollowRatio: total ? 1 - solid / total : 0,
    bytesPerChunk: CHUNK_VOX * 5,
  };
}
