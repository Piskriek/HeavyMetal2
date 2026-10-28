/**
 * Plan 56 §20: the drone's body shows its warnings. A warned zone's parts get a light overlay in that zone's colour, animated
 * by how it shows: a pain flashes, a eureka glows, a held ache sits stiff, an inflamed zone is tinged, a runaway one cracks
 * (a sharp flicker), a drained one flickers, and a numb side limps (the drone rolls toward it).
 *
 * The drone's zones, on its kit (kit-drone.ts; facing +z, its left is +x):
 *   1 root (feet, base): skids, struts, thruster pods and nozzles (motors and shrouds in air)
 *   2 couplings: the arms      3 power core: battery and weapon pod     4 centre (the heart, its gyro): the hull
 *   5 voice: its radio masts and nav lamps (its signals)      6 sight: lens and sensor housing      7 crown: the top cap
 * Pure: the companion draws what this plans.
 */
import type { PlacedPart } from '@hm/kitspec';
import type { BodyWarning } from '@hm/harness';

/**
 * How a zone shows (Argon's visual spec, 28 Oct, mapped onto the drone's real parts, RULES 8a):
 * - where it is held: congested is a steady dull amber (stiff), inflamed a pulsing red-orange (pulse), runaway a jittering
 *   red-orange (crack, and the whole drone micro-vibrates), drained a flicker, numb a limp;
 * - where it aches: its own glow starved (a dark shell, starve) with blue static over it while the ache holds (static), or a
 *   sharp flash over it on a pain (flash): on the drone the voice is its nav lamps, so suppressed truth is a voice gone dim;
 * - a eureka sweeps the antidote's colour from where it was held up into where it ached (sweep-from, then sweep-to).
 */
export type BodyLook = 'flash' | 'glow' | 'stiff' | 'pulse' | 'static' | 'starve' | 'flicker' | 'tinge' | 'crack' | 'limp' | 'sweep-from' | 'sweep-to';
export type BodySide = 'left' | 'center' | 'right';

/** One visible change to draw: which zone (ray 1..7), which side, its colour and how it shows. */
export interface BodyVisualHint {
  readonly ray: number;
  readonly side: BodySide;
  readonly hue: string;
  readonly look: BodyLook;
}

/** Which of the drone's parts (by placement path) belong to each zone. */
export const DRONE_ZONE_PARTS: Readonly<Record<number, (path: string) => boolean>> = {
  1: (p) => /^(skid|strut|thruster-|nozzle-|motor-|shroud-)/.test(p),
  2: (p) => p.startsWith('arm-'),
  3: (p) => p === 'battery' || p === 'pod' || p === 'barrel',
  4: (p) => p === 'hull',
  5: (p) => p.startsWith('mast-') || p.startsWith('lamp-'),
  6: (p) => p === 'lens' || p === 'sensor-housing',
  7: (p) => p === 'cap',
};

/** A part's side, from its corner or its name; the frame's middle parts are centre. */
export function partSide(path: string): BodySide {
  const corner = /(front|back)-(left|right)/.exec(path);
  if (corner) return corner[2] as BodySide;
  if (/-left$/.test(path)) return 'left';
  if (/-right$/.test(path)) return 'right';
  return 'center';
}

/** One overlay box: over a placed part (or the warned half of a middle part), with how to draw it. */
export interface OverlayPart {
  readonly path: string;
  readonly size: readonly [number, number, number];
  /** Along the part's own x: a middle part warned on one side shows only that half (the drone's left is +x). */
  readonly offsetX: number;
  /** Up to the part's own centre: kit boxes stand on their base (kit-build lifts each by half its height). */
  readonly offsetY: number;
  readonly matrix: readonly number[];
  readonly hue: string;
  readonly look: BodyLook;
}

/** How much bigger an overlay is than its part, so it shows over it; a starved part's dark shell sits outside that. */
export const OVERLAY_GROW = 1.15;
export const STARVE_GROW = 1.3;

/** The overlays a build's placed parts need for these hints. */
export function overlayPlan(placed: readonly PlacedPart[], hints: readonly BodyVisualHint[]): OverlayPart[] {
  const out: OverlayPart[] = [];
  for (const h of hints) {
    const inZone = DRONE_ZONE_PARTS[h.ray];
    if (!inZone) continue;
    for (const p of placed) {
      if (!inZone(p.path) || p.source.kind !== 'box') continue;
      const [w, ht, d] = p.source.size;
      const side = partSide(p.path);
      if (h.side !== 'center' && side !== 'center' && side !== h.side) continue;
      const half = h.side !== 'center' && side === 'center';
      const box = (grow: number, hue: string, look: BodyLook): OverlayPart => ({
        path: p.path,
        size: [(half ? w / 2 : w) * grow, ht * grow, d * grow],
        offsetX: half ? (h.side === 'left' ? w / 4 : -w / 4) : 0,
        offsetY: ht / 2,
        matrix: p.matrix,
        hue,
        look,
      });
      // an ache or a pain starves the part's own glow first, then crackles or flashes over it (Argon's spec)
      if (h.look === 'static' || h.look === 'flash') out.push(box(STARVE_GROW, '#000000', 'starve'));
      out.push(box(OVERLAY_GROW, h.hue, h.look));
    }
  }
  return out;
}

const frac = (x: number): number => x - Math.floor(x);
const noise = (n: number): number => frac(Math.sin(n * 12.9898) * 43758.5453);

/** An overlay's opacity at time `t` (s): each look's own rhythm. Deterministic; `seed` desyncs neighbours. */
export function lookOpacity(look: BodyLook, t: number, seed = 0): number {
  switch (look) {
    case 'flash': { const k = frac(t / 2.5 + seed * 0.13); return 0.85 * Math.exp(-k * 9); } // a sharp pulse every 2.5 s
    case 'glow': return 0.3 + 0.15 * Math.sin(t * 1.6 + seed);
    case 'stiff': return 0.3;
    case 'pulse': return 0.25 + 0.3 * (0.5 + 0.5 * Math.sin(t * 4 + seed));
    case 'static': return noise(Math.floor(t * 20) + seed * 5) > 0.82 ? 0.75 : 0.06; // intermittent crackle
    case 'starve': return 0.8; // drawn dark (normal blending), not added
    case 'tinge': return 0.4;
    case 'crack': return noise(Math.floor(t * 14) + seed * 7) > 0.7 ? 0.8 : 0.12;
    case 'flicker': return noise((Math.floor(t * 8) + seed * 3) * 6.02) > 0.5 ? 0.45 : 0.05;
    case 'limp': return 0.25;
    // the eureka's sweep, once every 3 s: the held zone fades as the aching zone brightens
    case 'sweep-from': { const k = frac(t / 3); return 0.6 * Math.max(0, 1 - k * 2); }
    case 'sweep-to': { const k = frac(t / 3); return 0.65 * Math.max(0, Math.min(1, (k - 0.3) / 0.25, (1 - k) / 0.35)); }
  }
}

/** The holding zone's stage colours (Argon's spec): a dull amber while congested, red-orange once inflamed. */
export const CONGESTED_HUE = '#b8762e';
export const INFLAMED_HUE = '#e0502a';

/**
 * A checkpoint's warnings as the drone's visible changes: where each is held (by its stage) and where it aches (static or a
 * flash), or a eureka's sweep from the one up into the other in the antidote's colour.
 */
export function hintsFromWarnings(warnings: readonly BodyWarning[]): BodyVisualHint[] {
  const out: BodyVisualHint[] = [];
  for (const w of warnings) {
    const side = w.side;
    if (w.signal === 'eureka') {
      out.push({ ray: w.ray, side, hue: w.visual.hue, look: 'sweep-from' });
      if (w.at !== w.ray) out.push({ ray: w.at, side, hue: w.visual.hue, look: 'sweep-to' });
      continue;
    }
    // where it is held, by its stage
    if (w.sickness === 'congested') out.push({ ray: w.ray, side, hue: CONGESTED_HUE, look: 'stiff' });
    else if (w.sickness === 'inflamed') out.push({ ray: w.ray, side, hue: INFLAMED_HUE, look: 'pulse' });
    else if (w.sickness === 'runaway') out.push({ ray: w.ray, side, hue: INFLAMED_HUE, look: 'crack' });
    else if (w.sickness === 'drained') out.push({ ray: w.ray, side, hue: w.visual.hue, look: 'flicker' });
    else if (w.sickness === 'numb') out.push({ ray: w.ray, side, hue: w.visual.hue, look: 'limp' });
    // where it shows: a flash on a pain, a soft tinge while it itches back, static while the ache holds
    if (w.signal === 'pain') out.push({ ray: w.at, side, hue: w.visual.hue, look: 'flash' });
    else if (w.signal === 'itch') out.push({ ray: w.at, side, hue: w.visual.hue, look: 'tinge' });
    else if (w.at !== w.ray && (w.signal === 'ache' || w.sickness !== null)) out.push({ ray: w.at, side, hue: w.visual.hue, look: 'static' });
  }
  return out;
}

/** The micro-vibration a runaway zone gives the whole drone (radians of jitter); 0 otherwise. */
export function bodyJitter(hints: readonly BodyVisualHint[]): number {
  return hints.some((h) => h.look === 'crack') ? 0.012 : 0;
}

/** The roll a numb side gives the drone (radians): it dips toward the side it cannot feel; 0 when nothing limps. */
export function limpRoll(hints: readonly BodyVisualHint[]): number {
  const limp = hints.find((h) => h.look === 'limp' && h.side !== 'center');
  // facing +z its left is +x; a negative roll about z dips +x
  return limp ? (limp.side === 'left' ? -0.16 : 0.16) : 0;
}
