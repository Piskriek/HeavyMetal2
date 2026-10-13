// The pure maths of the view from the lab window (docs/WINDOW_SCENE_PLAN.md §5 to §8): seeded randomness, the fidelity pockets,
// the static bursts, the storm's progress and the palette tables. No DOM, no Date.now, no Math.random: the same seed gives the same
// view every time, so the shots repeat. The scene (`lab-vista.ts`) reads these and the GLSL in it mirrors the same constants.

export type Vec3 = readonly [number, number, number];
/** The four fidelity floats (CLAUDE.md §1): [Pxd, Vtx, Lx, Aq], each 0..1. */
export type FidelityS = readonly [number, number, number, number];

/** mulberry32: a small seeded generator; each call returns a float in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Plan §5: the storm world outside the pockets. */
export const BASE_S: FidelityS = [0.15, 0.3, 0.3, 0];
/** Plan §8: at progress 1 the plain is calm at full PBR. */
export const CALM_S: FidelityS = [1, 1, 1, 0];
/** The soft edge of a pocket, as a fraction of its radius (plan §5: a soft 15% edge). */
export const POCKET_EDGE = 0.15;
/** The most pockets the shader loops over. */
export const MAX_POCKETS = 6;

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
export function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}

/** The spawn point (lab metres): the bearings are measured from it (north is -z, east is +x). */
export const SPAWN_XZ: readonly [number, number] = [-2.5, 1.0];
/** The distance from the spawn to the window's plane, metres. */
export const WINDOW_DIST = 10;
/** The spawn eye's height (m): the glass spans -7.1 to +10.5 degrees of elevation from it (y 0.4 to 3.5 at 10 m). */
export const SPAWN_EYE_Y = 1.65;
/** The window's opening in lab metres (the same numbers as WINDOW in lab-room.ts; the window plane is z -9). */
export const GLASS = { x0: -7.4, x1: 7.4, y0: 0.4, y1: 3.5 } as const;
/** The mullions of the window (lab metres, x): they divide the glass into four bays. */
export const MULLIONS_X: readonly number[] = [-3.7, 0, 3.7];
/** The Breach from the spawn: its bearing, and its distance (plan §3: a third in from the window's left, about 1.2 km out). */
export const BREACH_BEARING = -2.5;
export const BREACH_DIST = 1200;
/** Nothing stands in the Breach's bearing band, plus or minus this, in degrees (review 2, V1). */
export const CORRIDOR_DEG = 6;
/** A pocket's radius is at most this share of its distance from the spawn (0.07: about 4 degrees across, under the 6 degree cap). */
export const POCKET_MAX_RATIO = 0.07;

const rad = (d: number): number => (d * Math.PI) / 180;
const deg = (r: number): number => (r * 180) / Math.PI;

/** A point on a bearing from `origin` (x, z), in the lab frame: 0 degrees is north (-z), 90 east (+x). */
export function polar(origin: readonly [number, number], bearingDeg: number, dist: number): readonly [number, number] {
  const a = (bearingDeg * Math.PI) / 180;
  return [origin[0] + Math.sin(a) * dist, origin[1] - Math.cos(a) * dist];
}

/** The bearing (degrees, from north towards east) of a lab point, seen from the spawn. */
export function bearingFromSpawn(x: number, z: number): number {
  return deg(Math.atan2(x - SPAWN_XZ[0], SPAWN_XZ[1] - z));
}
/** The elevation (degrees) of a point at height `y` and horizontal distance `dist`, seen from the spawn eye. */
export function elevationFromSpawn(y: number, dist: number): number {
  return deg(Math.atan2(y - SPAWN_EYE_Y, dist));
}
/** The angular radius (degrees) of a sphere of radius `r` at distance `dist`. */
export function angularRadius(r: number, dist: number): number {
  return deg(Math.asin(Math.min(1, r / dist)));
}
/** The Breach's centre in the lab frame. */
export const BREACH_XZ: readonly [number, number] = polar(SPAWN_XZ, BREACH_BEARING, BREACH_DIST);

/** The starting pockets (plan §5). `tint` multiplies the ground and the props inside; `sky` is what the shell's back faces show. */
export interface PocketKind {
  readonly name: string;
  readonly s: FidelityS;
  readonly tint: Vec3;
  /** The back faces' tint (at most 25% opacity): the pocket's sky, seen from inside. */
  readonly sky: Vec3;
  /** The fresnel rim of scanline static, in the pocket's own colour (review 2, V2). */
  readonly rim: Vec3;
}
export const POCKET_KINDS: readonly PocketKind[] = [
  { name: 'Old Earth', s: [1, 1, 1, 0], tint: [0.62, 1.0, 0.5], sky: [0.36, 0.6, 0.9], rim: [0.45, 0.72, 1.0] },
  { name: '1-bit', s: [0, 0.2, 0, 0], tint: [1, 1, 1], sky: [0.6, 0.6, 0.62], rim: [1.0, 1.0, 1.0] },
  { name: 'EGA', s: [0.25, 0.4, 0.5, 0], tint: [1.0, 0.7, 1.0], sky: [0.25, 0.85, 0.95], rim: [1.0, 0.3, 0.9] },
  { name: 'Drowned', s: [0.7, 0.8, 0.8, 1], tint: [0.55, 0.9, 1.0], sky: [0.06, 0.3, 0.36], rim: [0.2, 0.95, 0.85] },
  { name: 'Wire-crunch', s: [0.5, 0, 0.6, 0], tint: [1, 1, 1], sky: [0.28, 0.28, 0.32], rim: [0.4, 1.0, 0.35] },
];

/** The shader's view of one pocket at one moment. `radius` 0 means the slot is empty; `centre` is (x, height above the ground, z). */
export interface PocketFrame {
  readonly centre: Vec3;
  readonly radius: number;
  readonly kind: number;
}

/**
 * The slots' sectors, seen from the spawn: a bearing (degrees), a distance (m) and an elevation (degrees). Each pocket drifts inside
 * its sector, so where it sits on the glass holds at every moment. The slots sit in the window's bays, at most two in any bay, and
 * none in the Breach's corridor. Slot 0 is the 1-bit pocket that the crate flies through.
 */
export interface PocketSector { readonly bearing: number; readonly dist: number; readonly elev: number }
export const POCKET_SECTORS: readonly PocketSector[] = [
  { bearing: 10, dist: 80, elev: 4.8 },
  { bearing: -17, dist: 45, elev: 4.0 },
  { bearing: 19, dist: 75, elev: 4.2 },
  { bearing: -20.5, dist: 55, elev: 4.4 },
  { bearing: 35, dist: 50, elev: 4.0 },
  { bearing: 27, dist: 90, elev: 4.0 },
];
/** How far a pocket drifts about its sector: bearing (deg), elevation (deg), distance (m). */
const SECTOR_AMP = { bearing: 1.2, elev: 0.25, dist: 6 } as const;

/**
 * Plan §5: each pocket lives for 20 to 40 s, then collapses in a burst and forms again. Slot 0 never collapses: it is the 1-bit
 * pocket that the crosswind's lane 0 flies through (the crate shot), so it stays where it is.
 */
export function pocketLifetime(slot: number): number {
  if (slot === 0) return 1e9;
  return 20 + 20 * mulberry32(0x9e37 + slot * 131)();
}

/**
 * The pocket in slot `slot` at time `t` (seconds). `scale` grows the pockets with the storm's progress (plan §8). It drifts in its
 * sector on a seeded path (1 to 2 m a second), breathes +-10%, and shrinks to nothing over the last 1.2 s of its life and grows
 * back over the first 1.2 s of the next. Its centre is above the ground by more than its radius: every pocket floats (R5). Its
 * radius is at most POCKET_MAX_RATIO of its distance from the spawn, so from the spawn it subtends at most about 4 degrees.
 */
export function pocketFrame(slot: number, t: number, scale = 1): PocketFrame {
  const sec = POCKET_SECTORS[slot % POCKET_SECTORS.length]!;
  const life = pocketLifetime(slot);
  const cycle = Math.max(0, Math.floor(t / life));
  const phase = t - cycle * life;
  const r = mulberry32(0x1d0c + slot * 613 + cycle * 1009);
  const kind = slot === 0 ? 1 : Math.floor(r() * POCKET_KINDS.length) % POCKET_KINDS.length;
  const size = slot === 0 ? 1 : 0.7 + 0.3 * r();
  // a new cycle picks new drift phases, so the pocket forms in a new place
  const q = mulberry32(0x51f1 + slot * 977 + cycle * 7919);
  const pb = q() * 6.283, pe = q() * 6.283, pd = q() * 6.283;
  const grow = smoothstep(0, 1.2, phase);
  const shrink = 1 - smoothstep(life - 1.2, life, phase);
  const breath = 1 + 0.1 * Math.sin(t * 0.9 + slot * 1.7);
  const bearing = sec.bearing + SECTOR_AMP.bearing * Math.sin(0.2 * t + pb);
  const elev = sec.elev + SECTOR_AMP.elev * Math.sin(0.15 * t + pe);
  const dist = sec.dist + SECTOR_AMP.dist * Math.sin(0.2 * t + pd);
  const [x, z] = polar(SPAWN_XZ, bearing, dist);
  const y = SPAWN_EYE_Y + dist * Math.tan(rad(elev));
  const cap = POCKET_MAX_RATIO * dist;
  const radius = cap * Math.min(1, size * scale * breath) * Math.min(grow, shrink);
  return { centre: [x, y, z], radius, kind };
}

/**
 * The ground under a pocket (review 2, V2): the pocket casts its fidelity straight down as a disc of its radius. The disc fades as the
 * pocket rises: full at 4 m, gone by 30 m. Mirrors `groundFade` in the shader.
 */
export function groundFade(centreHeight: number): number {
  return 1 - smoothstep(4, 30, centreHeight);
}

/** A burst of static (plan §6): the bolt, the burst shell, the light and the ring, all from one event. */
export interface BurstEvent {
  /** Seconds from the start of the scene. */
  readonly t: number;
  /** Where the bolt strikes the plain (lab frame, metres). */
  readonly x: number;
  readonly z: number;
  /** 0..1: the bigger the strike, the wider the burst. */
  readonly strength: number;
}

/** How long one burst lasts (plan §6: about 1.2 s). */
export const BURST_SECONDS = 1.2;

/**
 * The bursts as a seeded schedule: one every 5 to 12 s, the Breach's side (x in the layout's band near the column) struck more often.
 * `eventsBetween(from, to)` returns the events whose time falls in [from, to), in order, and never repeats one.
 * `progress` lowers the chance of a burst as the storm thins (plan §8: the flashes drop off).
 */
export function burstSchedule(seed: number, breachX: number, breachZ: number): {
  eventsBetween(from: number, to: number, progress: number): BurstEvent[];
} {
  const r = mulberry32(seed);
  let next = 4 + 4 * r();
  // each event carries a fixed roll, so the progress only decides, at read time, which of them strike (the schedule never changes)
  const made: { readonly event: BurstEvent; readonly roll: number }[] = [];
  const extend = (until: number): void => {
    while (next <= until) {
      const near = r() < 0.6;
      const span = near ? 90 : 240;
      const x = near ? breachX + (r() * 2 - 1) * span : (r() * 2 - 1) * 900;
      const z = near ? breachZ + (r() * 2 - 1) * span : -200 - r() * 900;
      const roll = r();
      made.push({ event: { t: next, x, z, strength: 0.4 + 0.6 * r() }, roll });
      next += 5 + 7 * r();
    }
  };
  return {
    eventsBetween(from: number, to: number, progress: number): BurstEvent[] {
      extend(to);
      const keepBelow = 1 - 0.8 * clamp01(progress);
      return made.filter((m) => m.event.t >= from && m.event.t < to && m.roll < keepBelow).map((m) => m.event);
    },
  };
}

/** The look of one burst at its age (seconds since it struck): the bolt, the burst shell, the light (capped, never a whiteout) and the ring. */
export interface BurstLook {
  readonly bolt: number;
  readonly burst: number;
  readonly burstAlpha: number;
  readonly light: number;
  readonly ring: number;
}
export function burstLook(age: number, strength: number): BurstLook {
  if (age < 0 || age > BURST_SECONDS) return { bolt: 0, burst: 0, burstAlpha: 0, light: 0, ring: 0 };
  const bolt = age < 0.15 ? 1 : 0;
  const burst = clamp01(age / 0.8) * (0.6 + 0.4 * strength);
  const burstAlpha = clamp01(1 - age / 0.8);
  // capped at 0.7 of full: the lab floor lights up but never whites out (STALKER 2's complaint, plan §6)
  const light = 0.7 * strength * Math.exp(-age / 0.22);
  const ring = clamp01(age / BURST_SECONDS);
  return { bolt, burst, burstAlpha, light, ring };
}

/** The storm's progress (plan §8): what the view looks like at progress 0 (the storm) to 1 (the calm plain). */
export interface VistaLook {
  readonly baseS: FidelityS;
  readonly pocketScale: number;
  /** The Breach's height as a fraction of its column (1 at the storm, a faint scar at 1). */
  readonly breachHeight: number;
  readonly breachGlow: number;
  /** Dust density (1 full storm, less when calm). */
  readonly dust: number;
  /** Flashes per burst-schedule roll: the storm keeps them, the calm plain loses them. */
  readonly flashChance: number;
  /** 0 storm sky, 1 dusk. */
  readonly dusk: number;
}
export function lookAt(progress: number): VistaLook {
  const p = clamp01(progress);
  return {
    baseS: [lerp(BASE_S[0], CALM_S[0], p), lerp(BASE_S[1], CALM_S[1], p), lerp(BASE_S[2], CALM_S[2], p), lerp(BASE_S[3], CALM_S[3], p)],
    pocketScale: 0.85 + 0.35 * p,
    breachHeight: 1 - 0.92 * p,
    breachGlow: 1 - 0.85 * p,
    dust: 1 - 0.7 * p,
    flashChance: 1 - 0.8 * p,
    dusk: smoothstep(0.3, 1, p),
  };
}

/**
 * How lit the cloud layer is at a distance from the Breach (review 2, V1: the undersides within 1.5 km of it). 1 at the column,
 * 0 beyond 1.5 km. Mirrors the sky shader.
 */
export function cloudLitAt(distFromBreach: number): number {
  return 1 - smoothstep(200, 1500, distFromBreach);
}

/** The Pxd bucket of a pixel-density float (plan §5): 0 the 1-bit dither, 0.25 the EGA palette, 0.5 the 3-3-2 quantise, 1 full colour. */
export function pxdMode(pxd: number): 'bayer' | 'ega' | 'vga' | 'full' {
  const p = clamp01(pxd);
  return p < 0.125 ? 'bayer' : p < 0.375 ? 'ega' : p < 0.75 ? 'vga' : 'full';
}

/** Plan §5: the vertex grid of a Vtx float, mix(1.5 m, 0, Vtx). Zero means no snapping. */
export function vtxGrid(vtx: number): number {
  return 1.5 * (1 - clamp01(vtx));
}

/** Plan §5: Lx 0 is unlit flat colour, 0.5 flat Lambert, 1 full PBR. Returns the weights of the three looks (they sum to 1). */
export function lxWeights(lx: number): { readonly unlit: number; readonly flat: number; readonly pbr: number } {
  const l = clamp01(lx);
  if (l <= 0.5) { const f = l * 2; return { unlit: 1 - f, flat: f, pbr: 0 }; }
  const f = (l - 0.5) * 2;
  return { unlit: 0, flat: 1 - f, pbr: f };
}

/**
 * The strongest pocket around a point and its weight (0 outside every pocket, 1 inside the core). A point on the ground (height
 * under 0.5 m) takes the pocket's disc straight down, faded by the pocket's height. Mirrors the shader's loop.
 */
export function strongestPocket(frames: readonly PocketFrame[], p: Vec3): { readonly index: number; readonly weight: number } {
  let best = -1, weight = 0;
  const ground = p[1] < 0.5;
  frames.forEach((f, i) => {
    if (f.radius <= 0) return;
    const dx = p[0] - f.centre[0], dy = p[1] - f.centre[1], dz = p[2] - f.centre[2];
    const d = ground ? Math.sqrt(dx * dx + dz * dz) : Math.sqrt(dx * dx + dy * dy + dz * dz);
    const inner = f.radius * (1 - POCKET_EDGE);
    const w = (1 - smoothstep(inner, f.radius, d)) * (ground ? groundFade(f.centre[1]) : 1);
    if (w > weight) { weight = w; best = i; }
  });
  return { index: best, weight };
}

/** The fidelity at a point: the base outside, the strongest pocket's S inside (blended over its soft edge). */
export function fidelityAt(base: FidelityS, frames: readonly PocketFrame[], p: Vec3): FidelityS {
  const { index, weight } = strongestPocket(frames, p);
  if (index < 0 || weight <= 0) return base;
  const s = POCKET_KINDS[frames[index]!.kind]!.s;
  return [lerp(base[0], s[0], weight), lerp(base[1], s[1], weight), lerp(base[2], s[2], weight), lerp(base[3], s[3], weight)];
}

/** The 16-colour EGA palette (the standard CGA/EGA set), as 0..1 RGB. */
export const EGA16: readonly Vec3[] = [
  [0, 0, 0], [0, 0, 170], [0, 170, 0], [0, 170, 170], [170, 0, 0], [170, 0, 170], [170, 85, 0], [170, 170, 170],
  [85, 85, 85], [85, 85, 255], [85, 255, 85], [85, 255, 255], [255, 85, 85], [255, 85, 255], [255, 255, 85], [255, 255, 255],
].map(([r, g, b]) => [(r ?? 0) / 255, (g ?? 0) / 255, (b ?? 0) / 255] as const);

/** The nearest EGA colour to an RGB colour (0..1), by squared distance. */
export function nearestEga(rgb: Vec3): Vec3 {
  let best = EGA16[0]!, bestD = Infinity;
  for (const c of EGA16) {
    const d = (c[0] - rgb[0]) ** 2 + (c[1] - rgb[1]) ** 2 + (c[2] - rgb[2]) ** 2;
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

/** The 256-colour 3-3-2 quantise of an RGB colour (0..1). */
export function quantise332(rgb: Vec3): Vec3 {
  return [Math.round(clamp01(rgb[0]) * 7) / 7, Math.round(clamp01(rgb[1]) * 7) / 7, Math.round(clamp01(rgb[2]) * 3) / 3];
}

/** The screen rectangle (pixels) that holds the given points, clipped to the screen, or null if nothing of it is on screen. */
export function clipRect(points: readonly { readonly x: number; readonly y: number }[], width: number, height: number): { readonly x: number; readonly y: number; readonly w: number; readonly h: number } | null {
  if (points.length === 0) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of points) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
    x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
  }
  const cx0 = Math.max(0, Math.floor(x0)), cy0 = Math.max(0, Math.floor(y0));
  const cx1 = Math.min(width, Math.ceil(x1)), cy1 = Math.min(height, Math.ceil(y1));
  if (cx1 <= cx0 || cy1 <= cy0) return null;
  return { x: cx0, y: cy0, w: cx1 - cx0, h: cy1 - cy0 };
}

/** The bay (0 to 3, left to right) of a bearing from the spawn, by the mullions; -1 outside the glass. */
export function bayOfBearing(b: number): number {
  const edges = [GLASS.x0, ...MULLIONS_X, GLASS.x1].map((x) => bearingFromSpawn(x, SPAWN_XZ[1] - WINDOW_DIST));
  for (let i = 0; i < 4; i++) if (b >= edges[i]! && b < edges[i + 1]!) return i;
  return -1;
}

/** Whether a bearing lies in the Breach's corridor (its bearing plus or minus `halfWidth` degrees). */
export function inCorridor(bearingDeg: number, halfWidth = CORRIDOR_DEG): boolean {
  return Math.abs(bearingDeg - BREACH_BEARING) < halfWidth;
}
