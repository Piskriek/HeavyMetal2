/* ============================================================================
 *  packages/setmix-compute/src/SetmixWGSL.ts
 *  ---------------------------------------------------------------------------
 *  THREE WGSL PASSES, ZERO CPU READBACK.
 *
 *  The CPU's entire job in this pipeline is to write 64 bytes of uniforms and
 *  call three dispatches and one indirect draw. It never sees a vertex, never
 *  sees a triangle count, never allocates a buffer per frame, and — crucially
 *  — never awaits a mapAsync, which is the single thing that makes GPU
 *  meshing slower than CPU meshing in most implementations.
 *
 *    Pass 1  density    — Simplex 3D fBm + hydraulic erosion → r32float grid
 *    Pass 2  surface    — Surface Nets; atomics allocate vertices in place
 *    Pass 3  indirect   — writes indexCount into a DrawIndexedIndirect buffer
 *
 *  Workgroup sizing: 4×4×4 = 64 invocations. A 32³ chunk is 8×8×8 = 512
 *  workgroups; the brief's 1024 is one 32×32×64 slab, which is what we use
 *  for the planet's vertical columns.
 * ==========================================================================*/

/* ═══════════════════════════ shared bindings & helpers ═══════════════ */

export const WGSL_COMMON = /* wgsl */ `
struct Params {
  origin      : vec3<f32>,   // chunk origin, world metres
  cellSize    : f32,
  dims        : vec3<u32>,   // voxels per axis (inclusive of the +1 skirt)
  seed        : u32,
  // the four SetMix metrics, normalised 0..1 — the ONLY gameplay input
  pxd         : f32,
  vtx         : f32,
  lx          : f32,
  aq          : f32,
  octaves     : u32,
  erosionIter : u32,
  isoLevel    : f32,
  time        : f32,
};

@group(0) @binding(0) var<uniform>             params  : Params;
@group(0) @binding(1) var<storage, read_write> density : array<f32>;

fn idx3(p : vec3<u32>) -> u32 {
  return p.x + p.y * params.dims.x + p.z * params.dims.x * params.dims.y;
}

// ── hash & gradient noise ─────────────────────────────────────────────
fn hash3(p : vec3<i32>, s : u32) -> f32 {
  var n : u32 = u32(p.x * 374761393 + p.y * 668265263 + p.z * 1274126177) ^ s;
  n = (n ^ (n >> 13u)) * 1274126177u;
  return f32(n ^ (n >> 16u)) / 4294967295.0;
}

fn vnoise3(p : vec3<f32>, s : u32) -> f32 {
  let i = vec3<i32>(floor(p));
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  let c000 = hash3(i + vec3<i32>(0,0,0), s); let c100 = hash3(i + vec3<i32>(1,0,0), s);
  let c010 = hash3(i + vec3<i32>(0,1,0), s); let c110 = hash3(i + vec3<i32>(1,1,0), s);
  let c001 = hash3(i + vec3<i32>(0,0,1), s); let c101 = hash3(i + vec3<i32>(1,0,1), s);
  let c011 = hash3(i + vec3<i32>(0,1,1), s); let c111 = hash3(i + vec3<i32>(1,1,1), s);
  let x00 = mix(c000, c100, u.x); let x10 = mix(c010, c110, u.x);
  let x01 = mix(c001, c101, u.x); let x11 = mix(c011, c111, u.x);
  return mix(mix(x00, x10, u.y), mix(x01, x11, u.y), u.z);
}

// Simplex-style skew keeps the lattice from showing through at low octaves,
// which matters enormously at Stage 1 where there are only two of them.
const SKEW   : f32 = 0.3333333;
const UNSKEW : f32 = 0.1666667;

fn simplex3(p : vec3<f32>, s : u32) -> f32 {
  let sk = (p.x + p.y + p.z) * SKEW;
  let q  = p + vec3<f32>(sk);
  let us = (q.x + q.y + q.z) * UNSKEW;
  return vnoise3(q - vec3<f32>(us), s) * 2.0 - 1.0;
}

fn fbm3(p : vec3<f32>, oct : u32, s : u32) -> f32 {
  var amp  = 0.5;
  var freq = 1.0;
  var sum  = 0.0;
  var norm = 0.0;
  for (var i : u32 = 0u; i < 8u; i = i + 1u) {
    // weight instead of break: octaves fade in continuously as Pxd rises,
    // so there is no visible pop when the budget crosses an integer.
    let w = clamp(f32(oct) - f32(i), 0.0, 1.0);
    if (w <= 0.0) { break; }
    sum  = sum + amp * simplex3(p * freq, s + i * 101u) * w;
    norm = norm + amp * w;
    amp  = amp * 0.52;
    freq = freq * 2.03;
  }
  return select(0.0, sum / norm, norm > 0.0);
}
`;

/* ═══════════════════════════ PASS 1 · DENSITY + EROSION ══════════════ */

export const WGSL_PASS1_DENSITY = /* wgsl */ `
${WGSL_COMMON}

// Hydraulic erosion needs a neighbourhood, so it runs as a second kernel
// over the same buffer rather than inline — ping-ponging would double VRAM
// for a result that converges fine with a Jacobi-style in-place relaxation.
@compute @workgroup_size(4, 4, 4)
fn density_main(@builtin(global_invocation_id) gid : vec3<u32>) {
  if (gid.x >= params.dims.x || gid.y >= params.dims.y || gid.z >= params.dims.z) { return; }

  let world = params.origin + vec3<f32>(gid) * params.cellSize;

  // base terrain: 3D fBm warped by a low-frequency field (domain warping)
  let warp = vec3<f32>(
    fbm3(world * 0.0031 + vec3<f32>( 11.3,  0.0,  0.0), 3u, params.seed),
    fbm3(world * 0.0031 + vec3<f32>(  0.0, 23.7,  0.0), 3u, params.seed + 7u),
    fbm3(world * 0.0031 + vec3<f32>(  0.0,  0.0, 41.1), 3u, params.seed + 13u)
  ) * 46.0;

  let n = fbm3((world + warp) * 0.0082, params.octaves, params.seed);

  // Vtx controls how much high-frequency detail survives into the field,
  // so the SAME dispatch produces Stage-1 blocks and Stage-6 hills.
  let detail = fbm3(world * 0.062, params.octaves, params.seed + 977u) * params.vtx * 0.28;

  // signed distance: negative inside the rock
  var d = world.y - (n * 54.0 + detail * 18.0);

  // Aq floods: anything below sea level becomes "soft" so the mesher
  // produces a shoreline instead of a cliff.
  let sea = -20.0 + params.aq * 23.0;
  d = d + max(0.0, sea - world.y) * 0.04 * params.aq;

  density[idx3(gid)] = d;
}

// ── hydraulic erosion: one Jacobi relaxation step ────────────────────
// Material flows downhill proportionally to the gradient; we approximate a
// full droplet sim with an anisotropic diffusion that is stable, parallel
// and — the deciding factor — needs no per-droplet atomics.
@compute @workgroup_size(4, 4, 4)
fn erode_main(@builtin(global_invocation_id) gid : vec3<u32>) {
  if (gid.x == 0u || gid.y == 0u || gid.z == 0u) { return; }
  if (gid.x >= params.dims.x - 1u || gid.y >= params.dims.y - 1u || gid.z >= params.dims.z - 1u) { return; }

  let c  = density[idx3(gid)];
  let xp = density[idx3(gid + vec3<u32>(1u,0u,0u))];
  let xm = density[idx3(gid - vec3<u32>(1u,0u,0u))];
  let zp = density[idx3(gid + vec3<u32>(0u,0u,1u))];
  let zm = density[idx3(gid - vec3<u32>(0u,0u,1u))];
  let yp = density[idx3(gid + vec3<u32>(0u,1u,0u))];

  let slope = length(vec2<f32>(xp - xm, zp - zm)) * 0.5;
  // only surface-adjacent voxels erode; interior rock is untouched
  let exposed = select(0.0, 1.0, (c < 0.0) != (yp < 0.0));
  let rate = params.aq * 0.22 + 0.04;

  let lap = (xp + xm + zp + zm - 4.0 * c) * 0.25;
  density[idx3(gid)] = c + lap * slope * rate * exposed;
}
`;

/* ═══════════════════════ PASS 2 · GPU SURFACE NETS ═══════════════════ */

export const WGSL_PASS2_SURFACE = /* wgsl */ `
${WGSL_COMMON}

struct Vertex {
  pos : vec3<f32>,
  nrm : vec3<f32>,
};

struct Counters {
  vertexCount : atomic<u32>,
  indexCount  : atomic<u32>,
};

@group(0) @binding(2) var<storage, read_write> vertices : array<Vertex>;
@group(0) @binding(3) var<storage, read_write> indices  : array<u32>;
@group(0) @binding(4) var<storage, read_write> counters : Counters;
// cellVertex[cell] = vertex index + 1, or 0 if the cell produced none.
@group(0) @binding(5) var<storage, read_write> cellVertex : array<u32>;

const CORNER = array<vec3<u32>, 8>(
  vec3<u32>(0u,0u,0u), vec3<u32>(1u,0u,0u), vec3<u32>(0u,1u,0u), vec3<u32>(1u,1u,0u),
  vec3<u32>(0u,0u,1u), vec3<u32>(1u,0u,1u), vec3<u32>(0u,1u,1u), vec3<u32>(1u,1u,1u)
);

// Surface Nets rather than Marching Cubes: one vertex per cell instead of up
// to five, no 256-entry triangle table in constant memory, and the dual mesh
// is exactly what @hm/smoothvox2 consumes on the CPU path. Identical topology
// on both backends is worth more than MC's slightly sharper features.
@compute @workgroup_size(4, 4, 4)
fn surface_main(@builtin(global_invocation_id) gid : vec3<u32>) {
  let dims = params.dims;
  if (gid.x >= dims.x - 1u || gid.y >= dims.y - 1u || gid.z >= dims.z - 1u) { return; }

  var mask : u32 = 0u;
  var d : array<f32, 8>;
  for (var i : u32 = 0u; i < 8u; i = i + 1u) {
    d[i] = density[idx3(gid + CORNER[i])];
    if (d[i] < params.isoLevel) { mask = mask | (1u << i); }
  }
  let cell = gid.x + gid.y * dims.x + gid.z * dims.x * dims.y;
  if (mask == 0u || mask == 255u) { cellVertex[cell] = 0u; return; }

  // QEF-lite: average the 12 edge crossings. Full QEF needs an SVD per cell;
  // the centroid is within a few centimetres and costs nothing.
  var acc  = vec3<f32>(0.0);
  var hits = 0.0;
  for (var e : u32 = 0u; e < 12u; e = e + 1u) {
    let a = EDGE_A[e]; let b = EDGE_B[e];
    let da = d[a]; let db = d[b];
    if ((da < params.isoLevel) == (db < params.isoLevel)) { continue; }
    let t = (params.isoLevel - da) / (db - da);
    acc = acc + mix(vec3<f32>(CORNER[a]), vec3<f32>(CORNER[b]), t);
    hits = hits + 1.0;
  }
  if (hits == 0.0) { cellVertex[cell] = 0u; return; }

  let local = acc / hits;
  let world = params.origin + (vec3<f32>(gid) + local) * params.cellSize;

  // central-difference normal straight from the field
  let n = normalize(vec3<f32>(
    density[idx3(gid + vec3<u32>(1u,0u,0u))] - d[0],
    density[idx3(gid + vec3<u32>(0u,1u,0u))] - d[0],
    density[idx3(gid + vec3<u32>(0u,0u,1u))] - d[0]
  ) + vec3<f32>(1e-6));

  let vi = atomicAdd(&counters.vertexCount, 1u);
  vertices[vi] = Vertex(world, n);
  cellVertex[cell] = vi + 1u;
}

const EDGE_A = array<u32,12>(0u,1u,2u,0u, 4u,5u,6u,4u, 0u,1u,3u,2u);
const EDGE_B = array<u32,12>(1u,3u,3u,2u, 5u,7u,7u,6u, 4u,5u,7u,6u);

// Quads are emitted in a SECOND dispatch so every cellVertex is already
// written. A barrier would only synchronise within a workgroup; this is the
// cheapest correct option and it costs one extra dispatch, not one readback.
@compute @workgroup_size(4, 4, 4)
fn quads_main(@builtin(global_invocation_id) gid : vec3<u32>) {
  let dims = params.dims;
  if (gid.x == 0u || gid.y == 0u || gid.z == 0u) { return; }
  if (gid.x >= dims.x - 1u || gid.y >= dims.y - 1u || gid.z >= dims.z - 1u) { return; }

  let cell = gid.x + gid.y * dims.x + gid.z * dims.x * dims.y;
  if (cellVertex[cell] == 0u) { return; }

  let here = density[idx3(gid)] < params.isoLevel;

  for (var axis : u32 = 0u; axis < 3u; axis = axis + 1u) {
    var step = vec3<u32>(0u);
    if (axis == 0u) { step = vec3<u32>(1u,0u,0u); }
    else if (axis == 1u) { step = vec3<u32>(0u,1u,0u); }
    else { step = vec3<u32>(0u,0u,1u); }

    let there = density[idx3(gid + step)] < params.isoLevel;
    if (here == there) { continue; }

    // the quad is the four cells sharing this edge
    var o1 = vec3<u32>(0u); var o2 = vec3<u32>(0u);
    if (axis == 0u) { o1 = vec3<u32>(0u,1u,0u); o2 = vec3<u32>(0u,0u,1u); }
    else if (axis == 1u) { o1 = vec3<u32>(0u,0u,1u); o2 = vec3<u32>(1u,0u,0u); }
    else { o1 = vec3<u32>(1u,0u,0u); o2 = vec3<u32>(0u,1u,0u); }

    let c0 = cellVertex[cell];
    let c1 = cellVertex[cell - (o1.x + o1.y * dims.x + o1.z * dims.x * dims.y)];
    let c2 = cellVertex[cell - (o1.x + o1.y * dims.x + o1.z * dims.x * dims.y)
                             - (o2.x + o2.y * dims.x + o2.z * dims.x * dims.y)];
    let c3 = cellVertex[cell - (o2.x + o2.y * dims.x + o2.z * dims.x * dims.y)];
    if (c0 == 0u || c1 == 0u || c2 == 0u || c3 == 0u) { continue; }

    let base = atomicAdd(&counters.indexCount, 6u);
    // winding flips with the sign of the crossing so normals stay outward
    if (here) {
      indices[base + 0u] = c0 - 1u; indices[base + 1u] = c1 - 1u; indices[base + 2u] = c2 - 1u;
      indices[base + 3u] = c0 - 1u; indices[base + 4u] = c2 - 1u; indices[base + 5u] = c3 - 1u;
    } else {
      indices[base + 0u] = c0 - 1u; indices[base + 1u] = c2 - 1u; indices[base + 2u] = c1 - 1u;
      indices[base + 3u] = c0 - 1u; indices[base + 4u] = c3 - 1u; indices[base + 5u] = c2 - 1u;
    }
  }
}
`;

/* ═══════════════════ PASS 3 · INDIRECT DRAW ARGUMENTS ════════════════ */

export const WGSL_PASS3_INDIRECT = /* wgsl */ `
struct Counters {
  vertexCount : atomic<u32>,
  indexCount  : atomic<u32>,
};
// layout required by drawIndexedIndirect
struct DrawArgs {
  indexCount    : u32,
  instanceCount : u32,
  firstIndex    : u32,
  baseVertex    : i32,
  firstInstance : u32,
};

@group(0) @binding(4) var<storage, read_write> counters : Counters;
@group(0) @binding(6) var<storage, read_write> drawArgs : DrawArgs;

// ONE invocation. This is the whole trick: the triangle count never crosses
// the PCIe bus, never touches JavaScript, and never costs a frame of latency.
// The CPU issues drawIndexedIndirect against a buffer it has never read.
@compute @workgroup_size(1)
fn indirect_main() {
  drawArgs.indexCount    = atomicLoad(&counters.indexCount);
  drawArgs.instanceCount = 1u;
  drawArgs.firstIndex    = 0u;
  drawArgs.baseVertex    = 0;
  drawArgs.firstInstance = 0u;
  // reset for the next frame, still without a readback
  atomicStore(&counters.vertexCount, 0u);
  atomicStore(&counters.indexCount, 0u);
}
`;

/* ═══════════════════════ render shader for the result ═══════════════ */

export const WGSL_RENDER = /* wgsl */ `
struct Camera { viewProj : mat4x4<f32>, eye : vec3<f32>, pad : f32 };
struct Vertex { pos : vec3<f32>, nrm : vec3<f32> };

@group(0) @binding(0) var<uniform> cam : Camera;
@group(0) @binding(1) var<storage, read> verts : array<Vertex>;

struct VSOut {
  @builtin(position) clip : vec4<f32>,
  @location(0) nrm : vec3<f32>,
  @location(1) world : vec3<f32>,
};

@vertex
fn vs(@builtin(vertex_index) vi : u32) -> VSOut {
  let v = verts[vi];
  var o : VSOut;
  o.clip  = cam.viewProj * vec4<f32>(v.pos, 1.0);
  o.nrm   = v.nrm;
  o.world = v.pos;
  return o;
}

@fragment
fn fs(i : VSOut) -> @location(0) vec4<f32> {
  let L = normalize(vec3<f32>(0.42, 0.78, -0.46));
  let ndl = max(dot(normalize(i.nrm), L), 0.0);
  let base = mix(vec3<f32>(0.19,0.2,0.24), vec3<f32>(0.55,0.62,0.44),
                 clamp(i.world.y * 0.02 + 0.5, 0.0, 1.0));
  return vec4<f32>(base * (0.3 + ndl * 0.9), 1.0);
}
`;

/* ─────────────────────────────── dispatch geometry, as data ────────── */

export const WGSL_PASSES = [
  {
    id: "density_main",
    label: "Pass 1a · Density field",
    source: "WGSL_PASS1_DENSITY",
    workgroupSize: [4, 4, 4] as const,
    reads: ["params"],
    writes: ["density"],
    note: "Simplex 3D fBm with domain warping. Octave count fades in continuously from Pxd, so there is no pop when the budget crosses an integer.",
  },
  {
    id: "erode_main",
    label: "Pass 1b · Hydraulic erosion",
    source: "WGSL_PASS1_DENSITY",
    workgroupSize: [4, 4, 4] as const,
    reads: ["density"],
    writes: ["density"],
    note: "Jacobi relaxation instead of droplet simulation: stable, embarrassingly parallel, and needs no per-droplet atomics. Only surface-adjacent voxels erode.",
  },
  {
    id: "surface_main",
    label: "Pass 2a · Surface Nets vertices",
    source: "WGSL_PASS2_SURFACE",
    workgroupSize: [4, 4, 4] as const,
    reads: ["density"],
    writes: ["vertices", "cellVertex", "counters"],
    note: "One vertex per cell via atomicAdd. QEF-lite centroid — a full SVD per cell buys a few centimetres and costs an order of magnitude.",
  },
  {
    id: "quads_main",
    label: "Pass 2b · Quad emission",
    source: "WGSL_PASS2_SURFACE",
    workgroupSize: [4, 4, 4] as const,
    reads: ["density", "cellVertex"],
    writes: ["indices", "counters"],
    note: "A second dispatch, not a barrier: workgroup barriers do not synchronise across workgroups, and a second dispatch is far cheaper than a readback.",
  },
  {
    id: "indirect_main",
    label: "Pass 3 · Indirect draw args",
    source: "WGSL_PASS3_INDIRECT",
    workgroupSize: [1, 1, 1] as const,
    reads: ["counters"],
    writes: ["drawArgs"],
    note: "One invocation writes indexCount into the DrawIndexedIndirect buffer and resets the atomics. The triangle count never enters JavaScript.",
  },
] as const;

export const WGSL_SOURCES: Record<string, string> = {
  WGSL_COMMON,
  WGSL_PASS1_DENSITY,
  WGSL_PASS2_SURFACE,
  WGSL_PASS3_INDIRECT,
  WGSL_RENDER,
};
