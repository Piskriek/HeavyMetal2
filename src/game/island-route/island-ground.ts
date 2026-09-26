/**
 * ISLAND-ROUTE: the ground of Basalt Isle, shaped by the route (docs/ISLAND_PLAN.md §0b: roads live in
 * the ground). Pure apart from plain numbers, so tests can hold its rules without WebGL.
 *
 * `naturalHeight` is a stand-in for the island's body until ISLAND-TERRAIN's heightfield lands: a
 * terraced volcano with a crater, cliff shelves, a beach ring and the sea floor, with an irregular coast
 * (the owner's render: stepped basalt plateaus, ochre tops, dark cliffs). `carvedHeight` then shapes it
 * round every road: flat ground under the road, rock cuttings where the road runs into a slope,
 * embankments where it runs a little above, nothing where it flies high (a bridge or trestle carries
 * it) or runs inside the mountain (a tunnel).
 */
import type { CPoint, TrackSpaceMap } from '../track-space';

/* -----------------------------------------------------------------------------
   THE ISLAND'S BODY
   -------------------------------------------------------------------------- */

/** Height against distance from the volcano's axis: crater, rim, flanks, cliff shelves, beach, sea floor. */
const RADIAL: readonly (readonly [number, number])[] = [
  [0, 17500], [2400, 18050], [3200, 20100], [3900, 20750], [5200, 19800], [7000, 17800], [9000, 15700],
  [11000, 13700], [13000, 11700], [15000, 9300], [16400, 6900], [18000, 5500], [20000, 4700], [22000, 3800],
  [24000, 2800], [25400, 2000], [26300, 350], [27500, 60], [29500, -40], [31000, -700], [36000, -1600],
  [60000, -2200],
];

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function radial(r: number): number {
  if (r <= RADIAL[0][0]) return RADIAL[0][1];
  for (let i = 1; i < RADIAL.length; i++) {
    const [r1, h1] = RADIAL[i];
    if (r <= r1) {
      const [r0, h0] = RADIAL[i - 1];
      const t = (r - r0) / (r1 - r0);
      return h0 + (h1 - h0) * (t * t * (3 - 2 * t));
    }
  }
  return RADIAL[RADIAL.length - 1][1];
}

/** Deterministic value noise in [-1, 1] (integer hash, smooth interpolation). */
function hash(i: number, j: number): number {
  let h = (i * 374761393 + j * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295 * 2 - 1;
}
function valueNoise(x: number, y: number): number {
  const i = Math.floor(x), j = Math.floor(y);
  const fx = x - i, fy = y - j;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(i, j), b = hash(i + 1, j), c = hash(i, j + 1), d = hash(i + 1, j + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
/** Fractal noise: four octaves from the given wavelength down. */
export function fbm(x: number, z: number, wavelength: number): number {
  let sum = 0, amp = 1, norm = 0, f = 1 / wavelength;
  for (let o = 0; o < 4; o++) {
    sum += valueNoise(x * f + o * 17.3, z * f - o * 9.1) * amp;
    norm += amp; amp *= 0.5; f *= 2.03;
  }
  return sum / norm;
}

/** Soft terraces: flat plateaus with steeper steps between, the stepped look of the reference. */
function terrace(h: number, shift: number): number {
  if (h < 900) return h;
  const step = 2300;
  const f = h / step + shift;
  const k = Math.floor(f);
  const stepped = (k + smooth(0.62, 0.9, f - k) - shift) * step;
  return h + (stepped - h) * 0.75 * smooth(900, 2200, h);
}

/** Local rock masses: the summit crag the shack sits on, and the basalt massif the Drain spirals into. */
export interface GroundBump { readonly x: number; readonly z: number; readonly height: number; readonly radius: number }

export function naturalHeight(x: number, z: number, bumps: readonly GroundBump[] = []): number {
  const r = Math.hypot(x, z);
  const theta = Math.atan2(x, -z);
  const wobble = 1 + 0.07 * Math.sin(3 * theta + 1.3) + 0.045 * Math.sin(5 * theta + 0.4) + 0.03 * Math.sin(11 * theta + 2.1);
  // Irregular plateaus: the body is bent by broad noise before the terraces, and the terrace levels
  // drift with a second noise, so no step runs round the island like a contour line.
  const warp = fbm(x, z, 9000);
  const body = radial(r / wobble + warp * 2600) + fbm(x + 5000, z - 3000, 5200) * 900 * smooth(1500, 5000, r);
  let h = terrace(body, fbm(x - 8000, z + 6000, 7000) * 0.6);
  for (const b of bumps) {
    const d = Math.hypot(x - b.x, z - b.z) / b.radius;
    if (d < 1) h = Math.max(h, h + b.height * (1 - smooth(0, 1, d)));
  }
  const grain = Math.sin(x * 0.00061 + z * 0.00047) * Math.sin(z * 0.00083 - x * 0.00029);
  return h + grain * 180 * smooth(-200, 600, h);
}

/* -----------------------------------------------------------------------------
   THE ROADS IN THE GROUND
   -------------------------------------------------------------------------- */

export interface RoadSample {
  readonly pos: CPoint;
  /** Horizontal unit vector across the road. */
  readonly rx: number;
  readonly rz: number;
  /** Height change per unit across (the road's bank) and per unit along (its grade). */
  readonly bank: number;
  readonly grade: number;
  readonly halfWidth: number;
  /** Inside the mountain: the ground above is left alone. */
  readonly tunnel: boolean;
  /** Another road passes under it here: carried on a bridge, never on an embankment. */
  bridge: boolean;
  /** Which road it belongs to (the main road 0, each branch its own). */
  readonly road: number;
}

/** Road samples every `stride` samples of each map, between the given arc distances. */
export function roadSamples(
  roads: readonly { map: TrackSpaceMap; from: number; to: number }[],
  stride = 2,
): RoadSample[] {
  const out: RoadSample[] = [];
  roads.forEach(({ map, from, to }, road) => {
    for (let i = 0; i < map.samples.length; i += stride) {
      const s = map.samples[i];
      if (s.dist < from || s.dist > to) continue;
      const l = Math.hypot(s.right.x, s.right.z) || 1;
      const t = Math.hypot(s.tangent.x, s.tangent.z) || 1;
      out.push({
        pos: s.pos, rx: s.right.x / l, rz: s.right.z / l, bank: s.right.y / l, grade: s.tangent.y / t, halfWidth: s.halfWidth,
        tunnel: s.stage === 'cavern' || s.stage === 'mine', bridge: false, road,
      });
    }
  });
  return out;
}

/** A bucket grid over road samples, so the ground only looks at the roads near it. */
export class RoadIndex {
  private readonly cells = new Map<string, RoadSample[]>();
  constructor(readonly samples: readonly RoadSample[], readonly cell = 1500) {
    for (const s of samples) {
      const key = this.key(Math.floor(s.pos.x / cell), Math.floor(s.pos.z / cell));
      const list = this.cells.get(key);
      if (list) list.push(s); else this.cells.set(key, [s]);
    }
  }
  private key(i: number, j: number) { return `${i},${j}`; }
  near(x: number, z: number, radius: number): RoadSample[] {
    const out: RoadSample[] = [];
    const n = Math.ceil(radius / this.cell);
    const ci = Math.floor(x / this.cell), cj = Math.floor(z / this.cell);
    for (let i = ci - n; i <= ci + n; i++) {
      for (let j = cj - n; j <= cj + n; j++) {
        const list = this.cells.get(this.key(i, j));
        if (list) for (const s of list) if (Math.abs(s.pos.x - x) <= radius && Math.abs(s.pos.z - z) <= radius) out.push(s);
      }
    }
    return out;
  }
}

/** Marks every sample another road passes under (by more than `clearance`), so it gets a bridge. */
export function markBridges(index: RoadIndex, clearance = 350): void {
  for (const s of index.samples) {
    for (const o of index.near(s.pos.x, s.pos.z, s.halfWidth + 700)) {
      if (o.road !== s.road && s.pos.y - o.pos.y > clearance
        && Math.hypot(o.pos.x - s.pos.x, o.pos.z - s.pos.z) < s.halfWidth + o.halfWidth) {
        s.bridge = true;
        break;
      }
    }
  }
}

/** How far below the road's centre line the ground sits under it. */
export const ROAD_BED = 70;
/** Flat ground either side of the road before a cutting or embankment starts. */
export const ROAD_SHOULDER = 260;
/** Width of the scree slope at the foot of a cutting before the rock face. */
export const CUT_SCREE = 500;
/** A road this far above the natural ground is carried on a trestle, not an embankment. */
export const TRESTLE_GAP = 1000;

/**
 * The ground at (x, z): the natural island, filled up to carry a road running a little above it, then cut
 * down wherever a road runs into it. Cuttings are steep (a scree foot, then a rock face), embankments
 * gentler (scree).
 */
export function carvedHeight(x: number, z: number, natural: number, index: RoadIndex): number {
  let ceiling = Infinity;
  let fill = -Infinity;
  for (const s of index.near(x, z, 5200)) {
    if (s.tunnel) continue;
    const dx = x - s.pos.x, dz = z - s.pos.z;
    const side = dx * s.rx + dz * s.rz;
    const across = Math.abs(side);
    // right = tangent × up, so forward across the ground is (rz, −rx).
    const ahead = dx * s.rz - dz * s.rx;
    if (Math.abs(ahead) > 260) continue;
    // The bed follows the road's bank out to the shoulder, so a banked corner's low edge stays clear.
    const edge = s.halfWidth + ROAD_SHOULDER;
    const bed = s.pos.y + s.grade * ahead + s.bank * Math.max(-edge, Math.min(edge, side)) - ROAD_BED;
    const d = Math.max(0, across - s.halfWidth - ROAD_SHOULDER);
    // Cutting: the ground may not stand above the road bed near it. A short scree slope, then a
    // near-vertical basalt face, so a road deep in a slope runs on a ledge under a cliff.
    ceiling = Math.min(ceiling, bed + Math.min(d, CUT_SCREE) * 1.6 + Math.max(0, d - CUT_SCREE) * 5);
    // Embankment: raise low ground under a road that runs only a little above it.
    if (!s.bridge && bed - natural < TRESTLE_GAP) fill = Math.max(fill, bed - d * 0.75);
  }
  // Every road's cutting is a ceiling no ground may pass, fills included: an embankment beside a lower
  // road stops at that road's ceiling (a retaining wall), so no road is ever buried by its neighbour.
  return Math.min(Math.max(natural, fill), ceiling);
}
