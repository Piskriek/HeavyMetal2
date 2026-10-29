/**
 * Plan 57 §16.6 & §18 + Law of One Universe Completions (owner & Argon, 29 Oct).
 *
 * Closes the 8 systemic gaps identified in the Law of One SQ Distortion Check and implements the Emergent Science &
 * Chaos-Seed Quest Engine:
 *
 * 1. Inner Veil Permeability (`effectiveVeilOpacity`, Ra 94.12 & 95.19): consistent polarization and rising kundalini
 *    thin an entity's personal Veil opacity by up to 35% within any stage, and post-Veil mastery carries higher weight.
 * 2. Antidote Resilience (`antidoteResilience`, `recordResilientExperience`, Ra 5.2, 42.2, 61.11): once a preset has
 *    genuinely balanced and closed a `by -> d` cause link in a W3 dream (`open === false`), it is less swayed by that
 *    same catalyst in the future (effective charge gain halved via calm resilience).
 * 3. Ray-Level Dyadic Transfer & Law of Doubling (`dyadTransferRay`, `harmoniousDoubling`, Ra 26.36, 32.5, 84.13, 10.12–14):
 *    dyads transfer energy according to their highest mutually open ray (`min(kundalini(a), kundalini(b))`), and $N$
 *    harmonious minds double their collective working/Stargate power ($2^{N-1}$, capped for numerical safety).
 * 4. The Call (`callIntensity`, Ra 7.12, 3.6): measures the sorrow/seeking signal emitted by a native or planet from its
 *    active somatic ache, open cause links, and investment—summoning Wanderer/Player aid without infringing free will.
 * 5. Social Memory Complex -> Planetary Body Relief & Stargate Charge (`relievePlanetFromComplex`, Ra 11.17, 65.17,
 *    Plan 57 §2–3): when a planet's natives cross coherence >= 0.95, their closed cause links and somatic eurekas
 *    relieve the planet's matching body zones (crust, oceans, wind, biosphere, aurora, grid, crown) and charge the Stargate.
 * 6. 2nd-Density Awakening via Investment (`investSecondDensity`, Ra 13.21, 14.1): flora and fauna presets gain investment
 *    and awaken toward 3rd-density self-awareness when named, tended, or bonded with by a 3rd-density being.
 * 7. Pure Element Derivation Card & Alloying (`deriveElementPhysics`, `mixElementStack`, `PHYSMAT_ELEMENT_STACKS`,
 *    Plan 57 §16.6 P1–P3 & Q1–Q6): derives density, hardness, bounce, friction, electrical/thermal conductivity
 *    (Wiedemann–Franz), heat capacity, and gas effusion (Graham's law) from integer Four Floats (0..10000), reproducing
 *    all 9 `@hm/physmat` materials from one pure card.
 * 8. Universal Compositional Crafting (`combinePresets`: $A \otimes B \to C$) & Chaos-Seed Quest Generator
 *    (`generateSystemQuests`, Plan 57 §18, Ra 46.16): combines presets across rungs to synthesize emergent mechanics
 *    (e.g. chamber + exothermic reaction + nozzle -> thrust) and generates Homeostatic, Karmic, and Scientific Frontier
 *    quests directly from planetary/native body warnings and newly crafted discoveries.
 *
 * 100% pure and deterministic: no Date.now, no Math.random, no I/O.
 */
import { ALIGNED, checkMem, type Mem, type SqOrAligned } from '@hm/shorthand';
import { SQ_DISTORTION_CATALOG } from './purpose-excitement-catalyst.js';
import { BALANCED_AT, memoryBalance, recordExperience, type Experience } from './preset-memory.js';
import { REST_AT } from './dream.js';
import { kundalini } from './lifecycle.js';
import { STAGE_VEIL_OPACITY, type VeilStage } from './veil-learning-harvest.js';
import { BODY_ZONES, RELEASE_RATE, bodyStep, bodyWarnings, type BodyState } from './body.js';

// ---------------------------------------------------------------------------------------------------------------------
// 1. Inner Veil Permeability (Ra 94.12, 95.19)
// ---------------------------------------------------------------------------------------------------------------------

/** Maximum fraction by which an entity's own kundalini and balance thin its personal Veil within a stage (Ra 94.12). */
export const MAX_INNER_VEIL_THINNING = 0.35;

/**
 * Computes an entity's effective Veil opacity at `stage` by combining the world's stage opacity with the entity's own
 * inner polarization and kundalini progress (Ra 94.12: consistent choice makes the Veil permeable).
 */
export function effectiveVeilOpacity(stage: VeilStage, mem: Mem): number {
  checkMem(mem);
  const base = STAGE_VEIL_OPACITY[stage];
  if (base <= 0) return 0;
  const kShare = kundalini(mem) / 7;
  const balShare = Math.max(0, (mem.bal - 0.5) * 2); // 0 below bal=0.5, 1 at bal=1.0
  const thinning = MAX_INNER_VEIL_THINNING * (0.6 * kShare + 0.4 * balShare);
  return Math.round(base * (1 - thinning) * 10000) / 10000;
}

// ---------------------------------------------------------------------------------------------------------------------
// 2. Antidote Resilience (Ra 5.2, 18.5, 42.2, 61.11 — "Unswayed")
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Returns the resilience calm factor (0 or 0.5) a preset has earned for a specific `by -> d` distortion link.
 * When the preset has previously experienced, dreamed on, and closed that exact cause link (`open === false`),
 * it is no longer easily swayed by that catalyst (Ra 42.2).
 */
export function antidoteResilience(mem: Mem, by: SqOrAligned, d: SqOrAligned): number {
  if (d === ALIGNED) return 0;
  const masteredLink = mem.cause.some((c) => c.by === by && c.d === d && !c.open && c.n >= 1);
  return masteredLink ? 0.5 : 0;
}

/**
 * Wraps `recordExperience` with Ra 42.2 antidote resilience: if the preset has already closed the `by -> d` causal link
 * in a prior dream, its mastered resilience cushions the moment (`calm` raised by at least 0.5, capped at 0.6), halving
 * the new distorting charge while still recording the episode's full felt excitement.
 */
export function recordResilientExperience(mem: Mem, x: Experience): Mem {
  checkMem(mem);
  const d = x.felt ?? (x.by === ALIGNED ? ALIGNED : x.by);
  const res = antidoteResilience(mem, x.by, d);
  const calm = Math.min(0.6, Math.max(x.calm ?? 0, res));
  return recordExperience(mem, { ...x, calm });
}

// ---------------------------------------------------------------------------------------------------------------------
// 3. Ray-Level Dyadic Energy Transfer & The Law of Doubling (Ra 10.12–14, 26.36, 32.5, 84.13)
// ---------------------------------------------------------------------------------------------------------------------

export interface DyadRayTransfer {
  /** Highest mutually unblocked ray (0..7) between the two partners. */
  readonly highestMutualRay: number;
  /** True when the transfer reaches Ray 4 (Green Heart: unconditional love / turning point from receiving to giving, 32.5). */
  readonly heartOpen: boolean;
  /** Energy transfer multiplier (1.0 at Ray 0..1 up to 4.0 at Ray 7). */
  readonly transferMultiplier: number;
}

/**
 * Computes the highest mutually open ray between two presets in a dyad and the resulting energy transfer multiplier
 * (Ra 26.36, 32.5, 84.13: green-ray transfer opens when neither partner is blocked in the lower triad).
 */
export function dyadTransferRay(a: Mem, b: Mem): DyadRayTransfer {
  checkMem(a);
  checkMem(b);
  const highestMutualRay = Math.min(kundalini(a), kundalini(b));
  const heartOpen = highestMutualRay >= 4;
  const transferMultiplier = Math.round((1 + (highestMutualRay / 7) * (heartOpen ? 3 : 1)) * 1000) / 1000;
  return { highestMutualRay, heartOpen, transferMultiplier };
}

/**
 * The Law of Doubling (Ra 10.12–14): when harmonious minds (balanced, `bal >= 0.9`, with open heart `kundalini >= 4`)
 * unite in one seeking/working, their effective power doubles with each additional harmonious member ($2^{N-1}$, capped
 * at $2^{10} = 1024$ for deterministic safety).
 */
export function harmoniousDoubling(members: readonly Mem[]): {
  readonly harmoniousCount: number;
  readonly multiplier: number;
} {
  let harmoniousCount = 0;
  for (const m of members) {
    checkMem(m);
    if (m.bal >= BALANCED_AT && kundalini(m) >= 4) harmoniousCount++;
  }
  if (harmoniousCount <= 0) return { harmoniousCount: 0, multiplier: 1 };
  const exp = Math.min(10, harmoniousCount - 1);
  return { harmoniousCount, multiplier: 2 ** exp };
}

// ---------------------------------------------------------------------------------------------------------------------
// 4. The Call (Ra 7.12, 3.6) & 2nd-Density Investment (Ra 13.21, 14.1)
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Computes the intensity of "The Call" (0..1) emitted by a native, companion, or planet (Ra 7.12):
 * sorrow/ache from unresolved blockages combined with earnest seeking (investment `inv` and open cause links).
 * Wanderers and the System answer only in proportion to The Call, preserving free will (Ra 3.6).
 */
export function callIntensity(mem: Mem, body: BodyState | null = null): number {
  checkMem(mem);
  const openCount = mem.cause.filter((c) => c.open).length;
  const maxAche = body ? Math.max(1 - mem.bal, ...body.zones.map((z) => z.ache)) : 1 - mem.bal;
  const raw = 0.45 * maxAche + 0.35 * Math.min(1, openCount / 3) + 0.2 * mem.inv;
  return Math.round(Math.min(1, Math.max(0, raw)) * 1000) / 1000;
}

/**
 * Second-density flora and fauna presets (`species:*`, `flora:*`) move toward third-density self-awareness when
 * third-density beings invest in them—naming, tending, and sharing balanced companionship (Ra 13.21, 14.1).
 */
export function investSecondDensity(
  creatureMem: Mem,
  investorBal: number,
  action: 'name' | 'tend' | 'companion',
  t: number,
  stage: VeilStage = 'S3',
): { readonly mem: Mem; readonly awakenedToThirdDensity: boolean } {
  checkMem(creatureMem);
  const clampedBal = Math.max(0, Math.min(1, investorBal));
  const boost = (action === 'name' ? 0.25 : action === 'companion' ? 0.2 : 0.12) * (0.5 + 0.5 * clampedBal);
  const nextInv = Math.min(1, Math.round((creatureMem.inv + boost) * 1000) / 1000);
  const recorded = recordExperience(
    { ...creatureMem, inv: nextInv },
    { t, stage, cat: `invest:${action}`, excitement: 0.65, error: 0.05, by: ALIGNED },
  );
  // Awakens to 3rd-density self-awareness once investment >= 0.75, balanced, and at least 3 tended episodes
  const awakenedToThirdDensity = recorded.inv >= 0.75 && recorded.bal >= BALANCED_AT && recorded.ep.length >= 3;
  return { mem: recorded, awakenedToThirdDensity };
}

// ---------------------------------------------------------------------------------------------------------------------
// 5. Planetary Logos & Social Memory Complex Relief (Plan 57 §2–3; Ra 11.3, 11.17, 65.17)
// ---------------------------------------------------------------------------------------------------------------------

export interface PlanetaryComplexState {
  readonly planetMem: Mem;
  readonly planetBody: BodyState;
  /** Coherence across the native population (0..1); >= 0.95 forms a telepathic Social Memory Complex. */
  readonly complexCoherence: number;
  readonly isSocialMemoryComplex: boolean;
  /** Stargate charge (0..1): reaches 1.0 when the planet's 7 body zones flow and the Social Memory Complex is online. */
  readonly stargateCharge: number;
  readonly relievedRays: readonly number[];
}

/**
 * Propagates eurekas and closed cause links from a planet's native population into the Planet's Rung 5 memory and
 * `'planetary'` body (`crust`, `oceans`, `wind`, `biosphere`, `aurora`, `grid`, `crown`), computing the Stargate charge.
 */
export function relievePlanetFromComplex(input: {
  readonly planetMem: Mem;
  readonly prevPlanetBody: BodyState | null;
  readonly natives: readonly { readonly mem: Mem; readonly body?: BodyState | null }[];
}): PlanetaryComplexState {
  checkMem(input.planetMem);
  const count = input.natives.length;
  const meanBal = count > 0 ? input.natives.reduce((s, n) => s + checkMem(n.mem).bal, 0) / count : input.planetMem.bal;
  const complexCoherence = Math.round(meanBal * 1000) / 1000;
  const isSocialMemoryComplex = count >= 2 && complexCoherence >= 0.95;

  // Collect rays where natives achieved a somatic eureka or closed a cause link
  const eurekaRays = new Set<number>();
  const closedPairs = new Set<string>();
  for (const n of input.natives) {
    for (const c of n.mem.cause) {
      if (!c.open) {
        closedPairs.add(`${c.by}>${c.d}`);
        eurekaRays.add(SQ_DISTORTION_CATALOG[c.d].rayIndex - 1);
      }
    }
    for (const z of n.body?.zones ?? []) {
      if (z.signal === 'eureka') eurekaRays.add(z.ray - 1);
    }
  }

  // When pooled as a Social Memory Complex, native relief doubles via harmoniousDoubling; otherwise modest local relief
  const { multiplier } = harmoniousDoubling(input.natives.map((n) => n.mem));
  const stepRelief = isSocialMemoryComplex ? RELEASE_RATE : Math.min(RELEASE_RATE, Math.max(8, 4 * multiplier));

  const relievedRays: number[] = [];
  const charge = input.planetMem.charge.map((c, r) => {
    if (!eurekaRays.has(r) || Math.abs(c) <= REST_AT) return c;
    relievedRays.push(r + 1);
    return c > 0 ? Math.max(0, c - stepRelief) : Math.min(0, c + stepRelief);
  });

  const cause = input.planetMem.cause.map((c) =>
    closedPairs.has(`${c.by}>${c.d}`) && Math.abs(charge[SQ_DISTORTION_CATALOG[c.d].rayIndex - 1] ?? 0) <= REST_AT
      ? { ...c, open: false }
      : c,
  );

  const nextPlanetMem = checkMem({
    ...input.planetMem,
    bal: memoryBalance(charge),
    charge,
    cause,
  });

  const stepped = bodyStep({
    kind: 'planetary',
    mem: nextPlanetMem,
    prev: input.prevPlanetBody,
    sideOf: () => 'left',
  });

  const flowingZones = stepped.body.zones.filter((z) => z.mode === 'flowing').length;
  const stargateCharge = Math.round(((flowingZones / 7) * 0.7 + complexCoherence * 0.3) * 1000) / 1000;

  return {
    planetMem: stepped.mem,
    planetBody: stepped.body,
    complexCoherence,
    isSocialMemoryComplex,
    stargateCharge,
    relievedRays,
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// 6. Pure Element Derivation Card & Alloying (Plan 57 §16.6 P1–P3 & Q1–Q6)
// ---------------------------------------------------------------------------------------------------------------------

/** Integer scale 0..10000 for each of the Four Floats (P1: exact cross-machine sums and averages). */
export const ELEMENT_SCALE = 10000;

export interface ElementPreset {
  readonly id: string;
  readonly name: string;
  /** Spatial lattice, grain & hardness (0..10000). */
  readonly pxd: number;
  /** Mass & density in kg/m³ (1..10000). */
  readonly vtx: number;
  /** Charge, signal conductance & specular/luminous excitation (0..10000). */
  readonly lx: number;
  /** Fluid & thermal capacitance / viscoelastic storage (0..10000). */
  readonly aq: number;
}

export interface DerivedElementPhysics {
  readonly id: string;
  readonly density: number;
  readonly hardness: number;
  readonly bounce: number;
  readonly friction: number;
  readonly drag: number;
  readonly lift: number;
  readonly electricalConductivity: number;
  /** Wiedemann–Franz law (S48): electron part from Lx + phonon lattice part from Pxd. */
  readonly thermalConductivity: number;
  readonly heatCapacity: number;
  /** Melting threshold in Kelvin (derived from Pxd bond strength and Vtx mass). */
  readonly meltKelvin: number;
  /** Boiling threshold in Kelvin. */
  readonly boilKelvin: number;
  /** Graham's law gas effusion factor (integer 1/sqrt(vtx) scaled 0..1). */
  readonly gasEffusion: number;
}

const clamp = (x: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, x));
const round3 = (x: number): number => Math.round(x * 1000) / 1000;

/** Deterministic integer square root (floor(sqrt(n))), avoiding engine-dependent Math.pow. */
export function isqrt(n: number): number {
  if (n <= 0) return 0;
  let x = n;
  let y = Math.trunc((x + 1) / 2);
  while (y < x) {
    x = y;
    y = Math.trunc((x + Math.trunc(n / x)) / 2);
  }
  return x;
}

/**
 * P2: One pure Derivation Card turning an Element or Stack's Four Floats (0..10000) into every physical property
 * needed by `@hm/physmat`, `@hm/wiregraph`, and the coarse plot field, using only `+ - * /` and `isqrt`.
 */
export function deriveElementPhysics(el: ElementPreset): DerivedElementPhysics {
  const p = clamp( Math.round(el.pxd), 0, ELEMENT_SCALE) / ELEMENT_SCALE;
  const v = clamp(Math.round(el.vtx), 1, ELEMENT_SCALE) / ELEMENT_SCALE;
  const l = clamp(Math.round(el.lx), 0, ELEMENT_SCALE) / ELEMENT_SCALE;
  const a = clamp(Math.round(el.aq), 0, ELEMENT_SCALE) / ELEMENT_SCALE;

  const density = clamp(Math.round(el.vtx), 1, ELEMENT_SCALE);
  const hardness = round3(p);

  // Bounce (restitution): viscoelastic storage (Aq * (1 - Lx)) + polymer cross-link spring (Aq * Pxd) + light lattice弹性
  const rawBounce =
    0.45 * a * (1 - l) +
    0.75 * a * p * (1 - l) +
    0.18 * p * (1 - 0.75 * v) +
    0.12 * l * (1 - v);
  const bounce = round3(clamp(rawBounce, 0.02, 0.98));

  // Friction: lattice roughness (Pxd * (1 - 0.35 * Lx)) + condensed-matter hydrogel/viscoelastic tack
  const condensed = Math.min(1, density / 500);
  const rawFriction =
    0.85 * p * (1 - 0.35 * l) +
    0.92 * condensed * a * (1 - p) * (1 - l) +
    0.18 * v * p -
    0.04 * l * (1 - p);
  const friction = round3(clamp(rawFriction, 0.02, 0.98));

  // Buoyancy lift & drag for low-density gases/foams vs high-viscosity gels
  const lift = density < 300 ? round3(clamp((300 - density) / 250, 0, 1.2)) : 0;
  const drag = round3(clamp(lift > 0.5 ? 0.2 : 0.08 * a * (1 - p) + 0.01 * (1 - v), 0, 0.25));

  const electricalConductivity = round3(l);
  const thermalConductivity = round3(0.7 * l + 0.3 * p);
  const heatCapacity = round3(a);

  const meltKelvin = Math.round(250 + 1600 * p + 400 * v - 200 * a);
  const boilKelvin = Math.round(meltKelvin + 100 + 900 * a + 500 * p);
  const gasEffusion = round3(1 / Math.max(1, isqrt(density)));

  return {
    id: el.id,
    density,
    hardness,
    bounce,
    friction,
    drag,
    lift,
    electricalConductivity,
    thermalConductivity,
    heatCapacity,
    meltKelvin,
    boilKelvin,
    gasEffusion,
  };
}

/**
 * The 9 canonical element stacks corresponding to `@hm/physmat`'s `PHYS_MATERIALS` test oracle (P2).
 */
export const PHYSMAT_ELEMENT_STACKS: readonly ElementPreset[] = [
  { id: 'wood', name: 'Wood', pxd: 5800, vtx: 600, lx: 500, aq: 2500 },
  { id: 'rubber', name: 'Rubber', pxd: 6200, vtx: 1100, lx: 200, aq: 8400 },
  { id: 'ice', name: 'Ice', pxd: 400, vtx: 917, lx: 9200, aq: 1500 },
  { id: 'metal', name: 'Metal', pxd: 7200, vtx: 7800, lx: 8500, aq: 4800 },
  { id: 'anvil', name: 'Anvil', pxd: 8200, vtx: 10000, lx: 9000, aq: 500 },
  { id: 'balloon', name: 'Balloon', pxd: 1200, vtx: 1, lx: 500, aq: 2600 },
  { id: 'cork', name: 'Cork', pxd: 3500, vtx: 240, lx: 200, aq: 5600 },
  { id: 'stone', name: 'Stone', pxd: 8200, vtx: 2500, lx: 300, aq: 400 },
  { id: 'jelly', name: 'Jelly', pxd: 2200, vtx: 1100, lx: 200, aq: 9600 },
];

/**
 * Q1: Computes a cell's runtime temperature (in Kelvin) from integer stored heat and its element's Aq capacitance.
 */
export function cellTemperatureKelvin(storedHeat: number, el: ElementPreset): number {
  const cap = Math.max(500, el.aq);
  return Math.max(0, Math.round((storedHeat * 1000) / cap));
}

/**
 * P3 & Q3: Mixes two or more elements by mass share (`shares` summing to > 0) into a Rung 2 Stack preset.
 * - `Vtx` and `Aq` are mass-weighted means.
 * - `Pxd` (hardness) receives an interstitial work-hardening bonus when alloying elements of differing `Vtx` atomic radii
 *   (so bronze/steel is harder than pure copper/iron).
 * - `Lx` (electrical conductivity) is reduced by lattice variance (alloy electron scattering).
 */
export function mixElementStack(
  id: string,
  name: string,
  recipe: readonly { readonly element: ElementPreset; readonly massShare: number }[],
): ElementPreset {
  if (recipe.length === 0) throw new Error('mixElementStack requires at least one element');
  const totalShare = recipe.reduce((s, r) => s + Math.max(0, r.massShare), 0);
  if (totalShare <= 0) throw new Error('mixElementStack requires positive total massShare');

  let vtxMean = 0;
  let aqMean = 0;
  let pxdMean = 0;
  let lxMean = 0;
  for (const r of recipe) {
    const w = Math.max(0, r.massShare) / totalShare;
    vtxMean += r.element.vtx * w;
    aqMean += r.element.aq * w;
    pxdMean += r.element.pxd * w;
    lxMean += r.element.lx * w;
  }

  // Variance of Vtx (atomic radius mismatch -> interstitial lattice hardening) and Pxd (electron scattering)
  let vtxSpread = 0;
  let pxdSpread = 0;
  for (const r of recipe) {
    const w = Math.max(0, r.massShare) / totalShare;
    vtxSpread += w * Math.abs(r.element.vtx - vtxMean);
    pxdSpread += w * Math.abs(r.element.pxd - pxdMean);
  }

  const hardeningBonus = recipe.length > 1 ? Math.min(2200, Math.round(vtxSpread * 0.45 + 600)) : 0;
  const scatteringLoss = recipe.length > 1 ? Math.min(0.35, (pxdSpread / ELEMENT_SCALE) * 0.5) : 0;

  return {
    id,
    name,
    pxd: clamp(Math.round(pxdMean + hardeningBonus), 0, ELEMENT_SCALE),
    vtx: clamp(Math.round(vtxMean), 1, ELEMENT_SCALE),
    lx: clamp(Math.round(lxMean * (1 - scatteringLoss)), 0, ELEMENT_SCALE),
    aq: clamp(Math.round(aqMean), 0, ELEMENT_SCALE),
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// 7. Universal Compositional Crafting ($A \otimes B \to C$) & Chaos-Seed Quests (Plan 57 §18)
// ---------------------------------------------------------------------------------------------------------------------

function fnv1aHex8(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export type EmergentMechanicKind =
  | 'alloy-stack'
  | 'thermal-thruster'
  | 'conductive-coil'
  | 'hydro-condenser'
  | 'harmonic-transceiver'
  | 'structural-frame';

export interface SynthesizedPreset {
  /** Content-addressed preset id (`<kind>:<hash8>`). */
  readonly of: string;
  readonly name: string;
  readonly parents: readonly [string, string];
  readonly element: ElementPreset;
  readonly physics: DerivedElementPhysics;
  readonly emergentMechanic: EmergentMechanicKind;
  /** Emergent output metric derived from physical laws (e.g. thrust in Newtons, conductance, or capacitance). */
  readonly emergentOutput: number;
  readonly systemNotice: string;
}

/**
 * Plan 57 §18.1–18.2: Universal Compositional Crafting ($A \otimes B \to C$).
 * Combines two presets under a physical condition (`heatKelvin`, `openNozzle`, `wiredSignal`), deriving the emergent
 * mechanic from the Four Floats rather than a lookup table.
 */
export function combinePresets(
  a: { readonly of: string; readonly element: ElementPreset },
  b: { readonly of: string; readonly element: ElementPreset },
  condition: { readonly heatKelvin?: number; readonly openNozzle?: boolean; readonly wiredSignal?: boolean; readonly massShareA?: number } = {},
): SynthesizedPreset {
  const shareA = clamp(condition.massShareA ?? 0.5, 0.05, 0.95);
  const sortedParents: readonly [string, string] = a.of <= b.of ? [a.of, b.of] : [b.of, a.of];
  const hash = fnv1aHex8(`${sortedParents[0]}|${sortedParents[1]}|${shareA}|${condition.heatKelvin ?? 300}|${Boolean(condition.openNozzle)}|${Boolean(condition.wiredSignal)}`);

  const mixed = mixElementStack(`stack:${hash}`, `${a.element.name}-${b.element.name}`, [
    { element: a.element, massShare: shareA },
    { element: b.element, massShare: 1 - shareA },
  ]);
  const physics = deriveElementPhysics(mixed);
  const heat = condition.heatKelvin ?? 300;

  let emergentMechanic: EmergentMechanicKind = 'alloy-stack';
  let kindPrefix = 'matc';
  let emergentOutput = physics.hardness;

  // Law 1: High-Pxd chamber + high-Aq fluid heated past boilKelvin with an open nozzle -> Thermal Thruster!
  if (condition.openNozzle && mixed.pxd >= 5000 && heat >= physics.boilKelvin) {
    emergentMechanic = 'thermal-thruster';
    kindPrefix = 'part';
    const pressureRatio = (heat - physics.boilKelvin + 200) / 200;
    emergentOutput = Math.round(pressureRatio * (mixed.aq / 100) * (1 + physics.gasEffusion));
  } else if (condition.wiredSignal && mixed.lx >= 6000 && mixed.pxd >= 5000) {
    // Law 2: High-Lx + wired signal -> Conductive Coil / Harmonic Transceiver
    emergentMechanic = mixed.aq >= 5000 ? 'harmonic-transceiver' : 'conductive-coil';
    kindPrefix = 'part';
    emergentOutput = Math.round(physics.electricalConductivity * 1000);
  } else if (mixed.aq >= 6500 && heat < physics.meltKelvin) {
    emergentMechanic = 'hydro-condenser';
    kindPrefix = 'part';
    emergentOutput = Math.round(physics.heatCapacity * 1000);
  } else if (physics.hardness >= 0.75) {
    emergentMechanic = 'structural-frame';
    kindPrefix = 'part';
    emergentOutput = Math.round(physics.hardness * 1000);
  }

  const of = `${kindPrefix}:${hash}`;
  return {
    of,
    name: `${mixed.name} (${emergentMechanic})`,
    parents: sortedParents,
    element: mixed,
    physics,
    emergentMechanic,
    emergentOutput,
    systemNotice: `Discovery forged: ${of} -> ${emergentMechanic} (output ${emergentOutput}).`,
  };
}

export type SystemQuestKind = 'homeostatic-planet' | 'karmic-call' | 'scientific-frontier';

export interface SystemQuest {
  readonly id: string;
  readonly kind: SystemQuestKind;
  readonly targetOf: string;
  readonly ray: number;
  readonly title: string;
  readonly objective: string;
  readonly priority: number;
}

/**
 * Plan 57 §18.3 & Ra 46.16: The LitRPG "System" as Homeostatic Scientist.
 * Generates quests dynamically from:
 * 1. Planetary body imbalances (`homeostatic-planet` — e.g. crust strain, ocean depletion, aurora starvation),
 * 2. Native/Drone open cause links & The Call (`karmic-call` — Ra 46.16 "more catalyst of the same theme"), and
 * 3. Newly synthesized presets (`scientific-frontier` — testing the next physical law on an adjacent rung).
 */
export function generateSystemQuests(input: {
  readonly planetMem: Mem;
  readonly planetBody: BodyState;
  readonly natives: readonly { readonly mem: Mem; readonly body?: BodyState | null }[];
  readonly recentSyntheses?: readonly SynthesizedPreset[];
}): SystemQuest[] {
  const quests: SystemQuest[] = [];

  // 1. Homeostatic Planetary Quests from planetary body warnings
  for (const w of bodyWarnings(input.planetMem.of, input.planetBody, input.planetMem)) {
    const zoneName = BODY_ZONES[w.ray - 1]?.planetary ?? w.source;
    quests.push({
      id: `quest:planet:${w.ray}:${w.sickness ?? w.signal ?? 'imbalance'}`,
      kind: 'homeostatic-planet',
      targetOf: input.planetMem.of,
      ray: w.ray,
      title: `Planetary Equilibrium: ${zoneName}`,
      objective: `Relieve ${w.sickness ?? w.signal ?? 'strain'} in the planet's ${zoneName} (restore ${w.quality ?? 'flow'} at ${w.place}).`,
      priority: Math.round((0.6 + 0.4 * w.ache) * 100),
    });
  }

  // 2. Karmic / Call Quests from natives or companions (Ra 7.12 & 46.16)
  for (const n of input.natives) {
    const call = callIntensity(n.mem, n.body ?? null);
    if (call < 0.25) continue;
    const open = n.mem.cause.find((c) => c.open);
    if (!open) continue;
    const info = SQ_DISTORTION_CATALOG[open.d];
    quests.push({
      id: `quest:call:${n.mem.of}:${open.d}`,
      kind: 'karmic-call',
      targetOf: n.mem.of,
      ray: info.rayIndex,
      title: `Answer the Call: ${info.antidoteName}`,
      objective: `Partner with ${n.mem.of} on Ray ${info.rayIndex} catalyst to transmute ${open.d} into ${info.antidoteName}.`,
      priority: Math.round(call * 100),
    });
  }

  // 3. Scientific Frontier Quests from recent crafting syntheses
  for (const s of input.recentSyntheses ?? []) {
    const nextStep =
      s.emergentMechanic === 'alloy-stack' && s.element.pxd >= 5000
        ? 'Combine this high-Pxd alloy with a high-Aq propellant above boiling point and an open nozzle to test directed thrust.'
        : s.emergentMechanic === 'thermal-thruster'
          ? 'Mount the thruster on a vessel frame to test orbital delta-v.'
          : 'Wire this component into a Triad socket circuit to measure live signal conductance.';
    quests.push({
      id: `quest:frontier:${s.of}`,
      kind: 'scientific-frontier',
      targetOf: s.of,
      ray: 6,
      title: `Hypothesis: ${s.emergentMechanic}`,
      objective: nextStep,
      priority: 55,
    });
  }

  return quests.sort((a, b) => b.priority - a.priority || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
