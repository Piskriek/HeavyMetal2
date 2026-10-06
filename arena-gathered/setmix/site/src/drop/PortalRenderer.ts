/* ============================================================================
 *  packages/portal/src/PortalRenderer.ts
 *  ---------------------------------------------------------------------------
 *  THE SEAMLESS ARCHWAY.
 *
 *  One room, two renderers, no loading screen. The portal is not a texture of
 *  the moon — it is the moon, rendered through a stencil-masked virtual camera
 *  whose near plane has been skewed onto the portal plane itself.
 *
 *  Three problems, three solutions, in the order they bite:
 *
 *    1. "I can see the destination world outside the archway."
 *       → STENCIL MASK. Draw the portal quad to the stencil buffer only, then
 *         render the destination with a stencil test. Pixels outside the arch
 *         are never touched.
 *
 *    2. "The destination doesn't move correctly when I move."
 *       → VIRTUAL CAMERA. Transform the real camera into destination space:
 *         V = D · F⁻¹ · C, where F is the source portal frame, D is the
 *         destination frame flipped 180° about Y, and C is the camera matrix.
 *
 *    3. "Geometry between the destination camera and the portal pokes through."
 *       → OBLIQUE NEAR-PLANE CLIP. Skew the projection matrix so its near
 *         plane IS the destination portal plane. Nothing in front of the arch
 *         can be rasterised, because there is no depth range in front of it.
 *
 *  Pure maths, zero three imports — the renderer is injected (ThreeLike).
 * ==========================================================================*/

export type Mat4 = Float32Array;
export type Vec3 = [number, number, number];
export type Vec4 = [number, number, number, number];

/* ─────────────────────────────────────── minimal matrix kit (column-major) */

export const mat4 = {
  identity(): Mat4 {
    return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
  },
  multiply(a: Mat4, b: Mat4, out = new Float32Array(16) as Mat4): Mat4 {
    for (let c = 0; c < 4; c++)
      for (let r = 0; r < 4; r++) {
        let s = 0;
        for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
        out[c * 4 + r] = s;
      }
    return out;
  },
  /** General 4×4 inverse (Laplace expansion). Portal frames may be scaled. */
  invert(m: Mat4, out = new Float32Array(16) as Mat4): Mat4 {
    const [a00,a01,a02,a03,a10,a11,a12,a13,a20,a21,a22,a23,a30,a31,a32,a33] = m as unknown as number[];
    const b00 = a00*a11 - a01*a10, b01 = a00*a12 - a02*a10, b02 = a00*a13 - a03*a10;
    const b03 = a01*a12 - a02*a11, b04 = a01*a13 - a03*a11, b05 = a02*a13 - a03*a12;
    const b06 = a20*a31 - a21*a30, b07 = a20*a32 - a22*a30, b08 = a20*a33 - a23*a30;
    const b09 = a21*a32 - a22*a31, b10 = a21*a33 - a23*a31, b11 = a22*a33 - a23*a32;
    let det = b00*b11 - b01*b10 + b02*b09 + b03*b08 - b04*b07 + b05*b06;
    if (!det) return mat4.identity();
    det = 1 / det;
    out[0]=(a11*b11-a12*b10+a13*b09)*det; out[1]=(a02*b10-a01*b11-a03*b09)*det;
    out[2]=(a31*b05-a32*b04+a33*b03)*det; out[3]=(a22*b04-a21*b05-a23*b03)*det;
    out[4]=(a12*b08-a10*b11-a13*b07)*det; out[5]=(a00*b11-a02*b08+a03*b07)*det;
    out[6]=(a32*b02-a30*b05-a33*b01)*det; out[7]=(a20*b05-a22*b02+a23*b01)*det;
    out[8]=(a10*b10-a11*b08+a13*b06)*det; out[9]=(a01*b08-a00*b10-a03*b06)*det;
    out[10]=(a30*b04-a31*b02+a33*b00)*det; out[11]=(a21*b02-a20*b04-a23*b00)*det;
    out[12]=(a11*b07-a10*b09-a12*b06)*det; out[13]=(a00*b09-a01*b07+a02*b06)*det;
    out[14]=(a31*b01-a30*b03-a32*b00)*det; out[15]=(a20*b03-a21*b01+a22*b00)*det;
    return out;
  },
  /** 180° yaw — you walk *through* a portal, so the destination faces back. */
  flipY(): Mat4 {
    return new Float32Array([-1,0,0,0, 0,1,0,0, 0,0,-1,0, 0,0,0,1]);
  },
  transformPoint(m: Mat4, p: Vec3): Vec3 {
    return [
      m[0]*p[0] + m[4]*p[1] + m[8]*p[2]  + m[12],
      m[1]*p[0] + m[5]*p[1] + m[9]*p[2]  + m[13],
      m[2]*p[0] + m[6]*p[1] + m[10]*p[2] + m[14],
    ];
  },
  transformDir(m: Mat4, v: Vec3): Vec3 {
    return [
      m[0]*v[0] + m[4]*v[1] + m[8]*v[2],
      m[1]*v[0] + m[5]*v[1] + m[9]*v[2],
      m[2]*v[0] + m[6]*v[1] + m[10]*v[2],
    ];
  },
  perspective(fovy: number, ar: number, n: number, f: number): Mat4 {
    const t = 1 / Math.tan(fovy / 2);
    return new Float32Array([t/ar,0,0,0, 0,t,0,0, 0,0,(f+n)/(n-f),-1, 0,0,(2*f*n)/(n-f),0]);
  },
};

const dot3 = (a: Vec3, b: Vec3) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
const sign = (x: number) => (x > 0 ? 1 : x < 0 ? -1 : 0);

/* ──────────────────────────────────────────────────────────── contracts ── */

export interface PortalFrame {
  id: string;
  /** world matrix of the arch in its own world */
  matrix: Mat4;
  /** local half-extents of the opening, metres */
  width: number;
  height: number;
  /** which world this side belongs to */
  world: "LAB" | "MOON";
}

export interface PortalLink {
  id: string;
  a: PortalFrame;
  b: PortalFrame;
  /** 0..1 — Stage-6 bandwidth. Below 1 the far side renders at reduced res. */
  bandwidth: number;
  /** recursion depth: 1 is plenty; a portal seeing itself needs 2+ */
  maxDepth: number;
  open: boolean;
}

export interface CameraState {
  /** camera → world */
  matrix: Mat4;
  fovY: number;
  aspect: number;
  near: number;
  far: number;
}

/* ═══════════════════════════════════ 1 · THE VIRTUAL CAMERA TRANSFORM ══ */

/**
 *  V = D · Ry(180°) · F⁻¹ · C
 *
 *  Read right to left: take the camera into the source portal's local space,
 *  turn it around (you exit facing away from the arch you entered), then push
 *  it out into the destination portal's world space.
 *
 *  Because this is one matrix product, parallax, roll, head-bob and FOV all
 *  come out correct for free. There is no special case for "player is looking
 *  at the portal from an angle" — that case does not exist.
 */
export function virtualCameraMatrix(camera: Mat4, from: PortalFrame, to: PortalFrame): Mat4 {
  const fInv = mat4.invert(from.matrix);
  const flip = mat4.flipY();
  const t1 = mat4.multiply(flip, fInv);
  const t2 = mat4.multiply(to.matrix, t1);
  return mat4.multiply(t2, camera);
}

/* ═══════════════════════════════════ 2 · OBLIQUE NEAR-PLANE CLIPPING ══ */

/**
 *  Lengyel's oblique frustum (Journal of Game Development, 2005), adapted.
 *
 *  Replaces the projection's third row so the near plane coincides with the
 *  portal plane. Everything between the virtual camera and the arch is
 *  clipped away *by the rasteriser*, which is why no geometry can poke
 *  through — we are not hiding it, we are removing the depth range it would
 *  have occupied.
 *
 *  `plane` is the portal plane in VIEW space: (nx, ny, nz, d), normalised,
 *  with the normal pointing *away* from the camera (into the visible world).
 */
export function obliqueProjection(proj: Mat4, plane: Vec4): Mat4 {
  const p = new Float32Array(proj) as Mat4;

  // Q = the far-corner of the frustum in clip space, pulled back through P⁻¹
  const q: Vec4 = [
    (sign(plane[0]) + p[8]) / p[0],
    (sign(plane[1]) + p[9]) / p[5],
    -1,
    (1 + p[10]) / p[14],
  ];

  // scale the plane so that c·Q = 1 … the magic that keeps the far plane put
  const dotQ = plane[0]*q[0] + plane[1]*q[1] + plane[2]*q[2] + plane[3]*q[3];
  if (Math.abs(dotQ) < 1e-8) return p;
  const s = 2 / dotQ;
  const c: Vec4 = [plane[0]*s, plane[1]*s, plane[2]*s, plane[3]*s];

  // third row ← c − fourth row
  p[2]  = c[0];
  p[6]  = c[1];
  p[10] = c[2] + 1;
  p[14] = c[3];
  return p;
}

/** Portal plane in the virtual camera's VIEW space. */
export function portalPlaneViewSpace(portal: PortalFrame, viewMatrix: Mat4, flipSide = 1): Vec4 {
  const m = portal.matrix;
  const originW: Vec3 = [m[12], m[13], m[14]];
  // local +Z is the arch's facing direction
  const normalW: Vec3 = [m[8], m[9], m[10]];
  const nl = Math.hypot(normalW[0], normalW[1], normalW[2]) || 1;
  const n: Vec3 = [normalW[0]/nl * flipSide, normalW[1]/nl * flipSide, normalW[2]/nl * flipSide];

  const oV = mat4.transformPoint(viewMatrix, originW);
  const nV = mat4.transformDir(viewMatrix, n);
  const l = Math.hypot(nV[0], nV[1], nV[2]) || 1;
  const nn: Vec3 = [nV[0]/l, nV[1]/l, nV[2]/l];
  return [nn[0], nn[1], nn[2], -dot3(nn, oV)];
}

/** Which side of the arch a world-space point is on. +1 lab, −1 destination. */
export function sideOf(portal: PortalFrame, p: Vec3): number {
  const m = portal.matrix;
  const o: Vec3 = [m[12], m[13], m[14]];
  const n: Vec3 = [m[8], m[9], m[10]];
  const nl = Math.hypot(n[0], n[1], n[2]) || 1;
  return ((p[0]-o[0])*n[0] + (p[1]-o[1])*n[1] + (p[2]-o[2])*n[2]) / nl;
}

/** Is the point inside the arch's rectangular opening (ignoring side)? */
export function withinAperture(portal: PortalFrame, p: Vec3): boolean {
  const inv = mat4.invert(portal.matrix);
  const l = mat4.transformPoint(inv, p);
  return Math.abs(l[0]) <= portal.width * 0.5 && l[1] >= 0 && l[1] <= portal.height;
}

/* ═══════════════════════════════════════════════ 3 · THE RENDER PASSES ══ */

export interface GLLike {
  STENCIL_TEST: number; DEPTH_TEST: number; COLOR_BUFFER_BIT: number;
  DEPTH_BUFFER_BIT: number; STENCIL_BUFFER_BIT: number;
  ALWAYS: number; EQUAL: number; LEQUAL: number; REPLACE: number; KEEP: number; INCR: number;
  enable(c: number): void; disable(c: number): void;
  clear(mask: number): void; clearStencil(s: number): void;
  colorMask(r: boolean, g: boolean, b: boolean, a: boolean): void;
  depthMask(f: boolean): void; depthFunc(f: number): void;
  stencilFunc(func: number, ref: number, mask: number): void;
  stencilOp(fail: number, zfail: number, zpass: number): void;
  stencilMask(mask: number): void;
}

export interface PortalDrawCtx {
  /** draws the arch's opening quad only */
  drawPortalQuad(link: PortalLink, side: "a" | "b"): void;
  /** draws a whole world with the given view+projection */
  drawWorld(world: "LAB" | "MOON", view: Mat4, proj: Mat4, quality: number): void;
}

export interface PortalRenderStats {
  passes: number;
  depth: number;
  stencilRef: number;
  obliqueApplied: boolean;
  destQuality: number;
  cameraSide: number;
  cullSkipped: boolean;
}

/**
 *  THE ORDER MATTERS AND IS NOT OBVIOUS:
 *
 *    1. clear stencil to 0
 *    2. draw the arch quad with colour+depth writes OFF, stencil ← depth+1
 *       (depth test ON so an object in front of the arch correctly occludes it)
 *    3. clear the DEPTH buffer inside the stencilled region only
 *       (otherwise the lab's depth values reject the moon's geometry)
 *    4. draw the destination world with stencilFunc(EQUAL, depth+1) and the
 *       oblique projection
 *    5. restore, draw the source world normally — its depth now correctly
 *       occludes the portal interior where a lab object stands in front
 *
 *  Step 3 is the one everyone forgets, and it presents as "the portal is a
 *  flat grey hole" or "the moon z-fights with the lab floor".
 */
export function renderPortal(
  gl: GLLike,
  ctx: PortalDrawCtx,
  link: PortalLink,
  camera: CameraState,
  depth = 0,
): PortalRenderStats {
  const stats: PortalRenderStats = {
    passes: 0, depth, stencilRef: depth + 1, obliqueApplied: false,
    destQuality: link.bandwidth, cameraSide: 0, cullSkipped: false,
  };
  if (!link.open || depth >= link.maxDepth) {
    stats.cullSkipped = true;
    return stats;
  }

  const camPos: Vec3 = [camera.matrix[12], camera.matrix[13], camera.matrix[14]];
  const side = sideOf(link.a, camPos);
  stats.cameraSide = side;

  // Which way are we looking through? The near side is the source.
  const from = side >= 0 ? link.a : link.b;
  const to = side >= 0 ? link.b : link.a;

  const view = mat4.invert(camera.matrix);
  const proj = mat4.perspective(camera.fovY, camera.aspect, camera.near, camera.far);

  /* ── 1/2 · stencil the aperture ───────────────────────────────────── */
  gl.enable(gl.STENCIL_TEST);
  gl.stencilMask(0xff);
  gl.colorMask(false, false, false, false);
  gl.depthMask(false);
  gl.stencilFunc(gl.EQUAL, depth, 0xff);          // only where the parent allowed
  gl.stencilOp(gl.KEEP, gl.KEEP, gl.INCR);        // nested portals nest cleanly
  ctx.drawPortalQuad(link, side >= 0 ? "a" : "b");
  stats.passes++;

  /* ── 3 · clear depth inside the aperture only ─────────────────────── */
  gl.colorMask(true, true, true, true);
  gl.depthMask(true);
  gl.stencilFunc(gl.EQUAL, depth + 1, 0xff);
  gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
  gl.clear(gl.DEPTH_BUFFER_BIT);

  /* ── 4 · destination world, oblique-clipped ───────────────────────── */
  const vCam = virtualCameraMatrix(camera.matrix, from, to);
  const vView = mat4.invert(vCam);
  const plane = portalPlaneViewSpace(to, vView, -1);
  const vProj = obliqueProjection(proj, plane);
  stats.obliqueApplied = true;

  // Bandwidth throttles the far side: at Stage 3 you see a coarse moon
  // through the arch, and that is diegetically correct — the portal really
  // is a data link, and it really is the thing you are upgrading.
  ctx.drawWorld(to.world, vView, vProj, link.bandwidth);
  stats.passes++;

  /* ── recurse for portal-in-portal ─────────────────────────────────── */
  if (depth + 1 < link.maxDepth) {
    const sub = renderPortal(gl, ctx, link, { ...camera, matrix: vCam }, depth + 1);
    stats.passes += sub.passes;
  }

  /* ── 5 · restore, source world ────────────────────────────────────── */
  gl.disable(gl.STENCIL_TEST);
  gl.stencilMask(0x00);
  gl.depthFunc(gl.LEQUAL);
  ctx.drawWorld(from.world, view, proj, 1);
  stats.passes++;

  return stats;
}

/* ═════════════════════════════════════ 4 · THE THRESHOLD STATE MACHINE ══ */

export type AvatarForm = "SCIENTIST" | "GOBLIN";
export type CrossPhase = "AWAY" | "APPROACHING" | "REACHING" | "CROSSING" | "SETTLING";

export interface ThresholdState {
  phase: CrossPhase;
  /** signed distance to the portal plane, metres */
  distance: number;
  /** −1 … +1 across the dissolve band; 0 is the plane itself */
  t: number;
  form: AvatarForm;
  world: "LAB" | "MOON";
  /** 0..1 — how much of the body has transformed, used by the shader */
  dissolve: number;
  /** 0 lab bus … 1 moon bus */
  audioMix: number;
  /** true for exactly one tick, on the frame ownership flips */
  justCrossed: boolean;
  /** the hand can be through the plane while the body is not */
  handThrough: boolean;
}

/** Width of the dissolve band, metres. Deliberately asymmetric around the
 *  plane: the transformation completes slightly *after* you commit, so the
 *  player sees their new hands arrive rather than finding them already there. */
const BAND_IN = 0.55;
const BAND_OUT = 0.85;

export function initialThreshold(world: "LAB" | "MOON" = "LAB"): ThresholdState {
  return {
    phase: "AWAY", distance: 99, t: world === "LAB" ? 1 : -1,
    form: world === "LAB" ? "SCIENTIST" : "GOBLIN",
    world, dissolve: 0, audioMix: world === "LAB" ? 0 : 1,
    justCrossed: false, handThrough: false,
  };
}

/**
 *  Pure reducer. Call at 120 Hz with the player's head and hand positions.
 *
 *  The crossing is NOT an event with a cutscene — it is a continuous function
 *  of distance. That is the whole promise of the premise: you can stand with
 *  your head in one universe and your hand in the other, and both render
 *  correctly, because both are just a signed distance away from one plane.
 */
export function stepThreshold(
  prev: ThresholdState,
  portal: PortalFrame,
  headPos: Vec3,
  handPos: Vec3 | null,
): ThresholdState {
  const d = sideOf(portal, headPos);
  const inAperture = withinAperture(portal, headPos);
  const handD = handPos ? sideOf(portal, handPos) : d;
  const handThrough = !!handPos && handD < 0 && withinAperture(portal, handPos);

  // t: +1 fully in the lab, −1 fully on the moon
  const band = d >= 0 ? BAND_IN : BAND_OUT;
  const t = Math.max(-1, Math.min(1, d / band));

  let phase: CrossPhase = "AWAY";
  if (!inAperture && Math.abs(d) > 2.5) phase = "AWAY";
  else if (Math.abs(d) > 1.2) phase = "APPROACHING";
  else if (!inAperture) phase = "APPROACHING";
  else if (Math.abs(d) <= band) phase = "CROSSING";
  else if (handThrough) phase = "REACHING";
  else phase = prev.phase === "CROSSING" ? "SETTLING" : "APPROACHING";

  // ownership flips exactly at the plane, not at the end of the dissolve
  const nowLab = d >= 0;
  const world: "LAB" | "MOON" = nowLab ? "LAB" : "MOON";
  const justCrossed = world !== prev.world;

  // S(u) again: the same C¹ curve the terrain geomorph uses, so the body
  // transform and the ground transform feel like one phenomenon.
  const u = (1 - t) * 0.5;
  const s = u * u * (3 - 2 * u);

  return {
    phase,
    distance: d,
    t,
    form: nowLab ? "SCIENTIST" : "GOBLIN",
    world,
    dissolve: inAperture || Math.abs(d) < band ? s : nowLab ? 0 : 1,
    audioMix: s,
    justCrossed,
    handThrough,
  };
}

/* ─────────────────────────── coordinate-space transform (lab ⟷ planet) ── */

export interface SpaceTransform {
  /** lab-local → planet-world */
  toPlanet(p: Vec3): Vec3;
  /** planet-world → lab-local */
  toLab(p: Vec3): Vec3;
  anchor: Vec3;
}

/**
 *  The lab's origin is (0, y, 0). The moon side of the arch is bolted to a
 *  spire at (sx, sy, sz) with a yaw. Everything else follows from composing
 *  the two portal frames — we never store a second copy of the player's
 *  position, we transform it on demand, which is why there is no desync.
 */
export function makeSpaceTransform(labPortal: PortalFrame, moonPortal: PortalFrame): SpaceTransform {
  const labToMoon = mat4.multiply(
    moonPortal.matrix,
    mat4.multiply(mat4.flipY(), mat4.invert(labPortal.matrix)),
  );
  const moonToLab = mat4.invert(labToMoon);
  return {
    toPlanet: (p) => mat4.transformPoint(labToMoon, p),
    toLab: (p) => mat4.transformPoint(moonToLab, p),
    anchor: [moonPortal.matrix[12], moonPortal.matrix[13], moonPortal.matrix[14]],
  };
}

/* ───────────────────────────────────────────── audio crossfade contract ── */

export interface PortalAudioMix {
  /** 0..1 gain on the pristine studio bus */
  labGain: number;
  /** 0..1 gain on the planet's diegetic bus at its current stage */
  moonGain: number;
  /** the lab is a small, bright, heavily-treated room: short tail, high HF */
  labReverbSeconds: number;
  /** low-pass applied to whichever bus you are NOT standing in */
  occlusionHz: number;
  /** the portal itself hums; the hum is the bandwidth */
  portalHumGain: number;
  portalHumHz: number;
}

/**
 *  Equal-power crossfade, not linear: a linear fade between two uncorrelated
 *  buses dips ~3 dB in the middle, and the player hears that dip as a seam.
 *  The portal's own hum fills the centre and its pitch rides bandwidth, so
 *  upgrading the link is audible before it is visible.
 */
export function portalAudioMix(th: ThresholdState, bandwidth: number): PortalAudioMix {
  const x = Math.max(0, Math.min(1, th.audioMix));
  const labGain = Math.cos((x * Math.PI) / 2);
  const moonGain = Math.sin((x * Math.PI) / 2);
  const proximity = 1 - Math.min(1, Math.abs(th.distance) / 4);
  return {
    labGain,
    moonGain,
    labReverbSeconds: 0.42,
    // the far bus is muffled through the aperture, fully open at the plane
    occlusionHz: 420 + proximity * 19000,
    portalHumGain: proximity * 0.22,
    portalHumHz: 52 + bandwidth * 46,
  };
}
