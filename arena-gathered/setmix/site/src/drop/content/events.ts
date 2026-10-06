/* ============================================================================
 *  packages/content/src/events.ts
 *  ---------------------------------------------------------------------------
 *  THE PLANETARY CALENDAR — deterministic weather and events.
 *
 *  THE RULE THAT MADE THIS WORK
 *  A weather system that surprises you is a weather system you cannot plan
 *  around, and a terraforming game is a planning game. So the calendar is
 *  FULLY DETERMINISTIC AND FULLY FORECASTABLE: given (seed, day) every event
 *  is already decided, and the Planet Table shows the next seven days.
 *
 *  Players do not react to weather. They schedule around it — and the entire
 *  mid-game "boredom trough" from GDD §6 is solved by giving them a reason
 *  to care what Tuesday looks like.
 *
 *  One planetary day = 24 real minutes = 172,800 ticks at 120 Hz.
 *  The calendar repeats every 30 days, with a seeded offset per world.
 *
 *  Pure. No clock, no RNG beyond the injected seed.
 * ==========================================================================*/

import type { MetricKey } from "../contracts.setmix";

export const TICKS_PER_DAY = 172_800;
export const CALENDAR_DAYS = 30;
export const TICKS_PER_CYCLE = TICKS_PER_DAY * CALENDAR_DAYS;

export type EventId =
  | "TWIN_ECLIPSE" | "SOLAR_FLARE" | "METEOR_SHOWER" | "METHANE_MONSOON"
  | "NOISE_STORM" | "AURORA_CASCADE" | "DUST_DEVIL_SEASON" | "THERMAL_INVERSION"
  | "SPORE_BLOOM" | "NULL_TIDE" | "CRYSTAL_RESONANCE" | "CLEAR_SKIES";

export type EventSeverity = "CALM" | "NOTABLE" | "MAJOR" | "CRISIS";

export interface EventEffects {
  /** multiplier on each metric's emitter output */
  yield?: Partial<Record<MetricKey, number>>;
  /** × on solar collector output */
  solar?: number;
  /** × on coherence drain outside shelter */
  coherenceDrain?: number;
  /** × on machine heat generation */
  heat?: number;
  /** × on flora emissive brightness */
  bioluminescence?: number;
  /** + metres on sea level, temporary */
  seaLevelDelta?: number;
  /** × on harvest node spawn rate */
  nodeSpawn?: number;
  /** × on rover grip */
  grip?: number;
  /** temporary harvest nodes seeded by the event */
  spawns?: { node: string; count: number; tier: number }[];
  /** ambient temperature delta, °C */
  tempDelta?: number;
  /** × on portal bandwidth */
  bandwidth?: number;
}

export interface PlanetEvent {
  id: EventId;
  name: string;
  severity: EventSeverity;
  /** hours of a 24-minute day; events are sub-day */
  durationHours: number;
  /** which stage the event first becomes possible */
  minStage: 1 | 2 | 3 | 4 | 5 | 6;
  /** relative weight in the scheduler */
  weight: number;
  colour: string;
  glyph: string;
  /** one-line forecast text shown on the wrist device */
  forecast: string;
  /** what the player actually sees */
  spectacle: string;
  /** why a player changes their plans for it */
  tactics: string;
  effects: EventEffects;
  /** audio engine hook */
  audio: string;
}

export const EVENTS: Record<EventId, PlanetEvent> = {
  TWIN_ECLIPSE: {
    id: "TWIN_ECLIPSE", name: "Eclipse of the Twin Moons", severity: "MAJOR",
    durationHours: 3.2, minStage: 2, weight: 10, colour: "#6e5ce0", glyph: "◐",
    forecast: "Twin occultation in {t}. Solar output will fail; bring stored Lumens.",
    spectacle: "Both satellites cross the disc eleven minutes apart. The second contact drops the surface into a violet dusk, the temperature falls nine degrees, every bioluminescent organism on the planet triples its output, and the sky mantas rise from the canyons to feed in the dark.",
    tactics: "Solar dies for three hours, so geothermal and stored Glowstone carry you. But flora emissive ×3 means Lumen Masts standing in a bioluminescent biome massively over-perform — the eclipse is a net Lx WINDFALL if you sited your masts in the mycelium instead of the open.",
    effects: {
      solar: 0.05, bioluminescence: 3.0, tempDelta: -9,
      yield: { lx: 1.9, pxd: 0.85 }, coherenceDrain: 1.25, heat: 0.7,
      spawns: [{ node: "Sky Manta Shed Scale", count: 14, tier: 4 }],
    },
    audio: "Low-passed everything, −6 dB, and a single sub-bass swell at second contact. The ecology audio bed inverts: day species out, night species in.",
  },
  SOLAR_FLARE: {
    id: "SOLAR_FLARE", name: "Solar Flare Surge", severity: "MAJOR",
    durationHours: 2.4, minStage: 2, weight: 11, colour: "#ffc13d", glyph: "✸",
    forecast: "X-class flare inbound, {t}. Collectors will over-produce; drone links will drop.",
    spectacle: "The sky fills with dancing violet aurorae from pole to pole, every Aurora Lichen canopy ripples in phase with the field, and your suit's circuit conduits run at full brightness for two and a half hours.",
    tactics: "Solar ×2.5 and rover boost recharges instantly — this is the window to run the Perpetual Foundry flat out. But drone bandwidth halves and machine heat rises 40%, so overclocked emitters WILL trip. Schedule your maintenance pass for the hour before.",
    effects: {
      solar: 2.5, yield: { lx: 2.2, pxd: 1.3 }, heat: 1.4, bandwidth: 0.5,
      tempDelta: +6, coherenceDrain: 1.15, bioluminescence: 1.4,
    },
    audio: "A rising ionospheric whine on the Lx bus and crackling static on every drone channel. The score gains a fifth voice.",
  },
  METEOR_SHOWER: {
    id: "METEOR_SHOWER", name: "Meteor Shower", severity: "NOTABLE",
    durationHours: 4.0, minStage: 1, weight: 13, colour: "#ff6fb2", glyph: "✦",
    forecast: "Debris stream crossing in {t}. Impact nodes will spawn; stay out of the open.",
    spectacle: "Two hundred streaks an hour, then the impacts: each one a visible flash on the horizon followed four seconds later by a dust ring expanding across the regolith.",
    tactics: "Fresh craters spawn high-tier Photonic Salt and Geode nodes that persist for one day only. The single best harvesting window in the early game — and the only reliable early source of Shock Quartz. Impacts damage unsheltered machines at 2% condition per hit.",
    effects: {
      nodeSpawn: 3.4, yield: { pxd: 1.25, vtx: 1.15 }, coherenceDrain: 1.1,
      spawns: [
        { node: "Fresh Photon Salt", count: 22, tier: 2 },
        { node: "Impact Geode", count: 9, tier: 3 },
        { node: "Shock Quartz Shard", count: 6, tier: 2 },
      ],
    },
    audio: "Sparse, enormous impacts with a 4-second visual-to-audio delay the player can measure. The first time anyone notices sound has a speed here.",
  },
  METHANE_MONSOON: {
    id: "METHANE_MONSOON", name: "Methane Monsoon", severity: "MAJOR",
    durationHours: 6.5, minStage: 4, weight: 12, colour: "#3dc8ff", glyph: "☂",
    forecast: "Deep condensation front, {t}. Lakes will rise 3.4 m. Check your low-lying builds.",
    spectacle: "Heavy atmospheric condensation turns the sky the colour of wet slate, rain ripples cross every water surface in the world simultaneously, and the wetness mask darkens the entire planet by a third.",
    tactics: "Aq yield ×2.8 — the best terraforming window there is. But sea level rises 3.4 m for six hours and does not care what you built. Players learn the flood contour the hard way exactly once, and then they use the Planet Table's Flood Planner forever.",
    effects: {
      yield: { aq: 2.8, pxd: 0.9 }, seaLevelDelta: 3.4, solar: 0.35,
      grip: 0.72, heat: 0.6, tempDelta: -4, coherenceDrain: 1.2,
    },
    audio: "Close-mic rain on the helmet bypassing the bit-crusher entirely, plus the underwater low-pass engaging early as puddles reach knee height.",
  },
  NOISE_STORM: {
    id: "NOISE_STORM", name: "Noise Storm", severity: "CRISIS",
    durationHours: 2.0, minStage: 1, weight: 14, colour: "#ff3d8a", glyph: "▚",
    forecast: "Decoherence front, bearing {dir}, {t}. Get inside a spire field.",
    spectacle: "A wall of writhing static advancing at 14 m/s. Terrain inside the front visibly de-resolves — bevels snap back to cubes, palettes collapse to four colours, and the sky reverts to black.",
    tactics: "Coherence drain ×2.4 and a regional Fi rollback that repairs over the following hour. But the fallout is the richest Chromatic Crystal in the game. Veterans chase storms the way farmers chase rain.",
    effects: {
      coherenceDrain: 2.4, yield: { pxd: 0.5, vtx: 0.5, lx: 0.5, aq: 0.5 },
      nodeSpawn: 2.2, bandwidth: 0.3, grip: 0.85,
      spawns: [{ node: "Storm Chromatic Fallout", count: 30, tier: 3 }],
    },
    audio: "The bit-crusher drops to 3 bits and the Nyquist filter closes to 2.4 kHz for the duration. The world audibly loses resolution.",
  },
  AURORA_CASCADE: {
    id: "AURORA_CASCADE", name: "Aurora Cascade", severity: "NOTABLE",
    durationHours: 5.0, minStage: 3, weight: 9, colour: "#36d6b0", glyph: "≋",
    forecast: "Sustained auroral activity, {t}. Good night for Lumen work.",
    spectacle: "Green and teal curtains for five hours, bright enough to read by, reflected in every body of water you have made.",
    tactics: "Lx yield ×1.7 at night, which is the only time that is ever true. Aurora Lichen biomes gain a permanent +4% biomass per cascade survived — the only event with a lasting positive effect.",
    effects: {
      yield: { lx: 1.7 }, bioluminescence: 1.8, solar: 0.0, tempDelta: -3,
      coherenceDrain: 0.9,
    },
    audio: "A slow shimmering pad on the non-diegetic bus, and the Aurora Lichen's own grain density doubles.",
  },
  DUST_DEVIL_SEASON: {
    id: "DUST_DEVIL_SEASON", name: "Dust Devil Season", severity: "NOTABLE",
    durationHours: 8.0, minStage: 1, weight: 11, colour: "#c08a5e", glyph: "🜁",
    forecast: "Convective season, {t}. Expect vortices; secure loose cargo.",
    spectacle: "Forty-metre dust columns wandering the flats on their own errands, lifting regolith into the sky and dropping it somewhere else. They are navigable, and riding one is faster than walking.",
    tactics: "Solar drops 30% from atmospheric dust, but the wind field doubles — windmills, Humming Meadows and every curl-noise biome over-produce. The first event that rewards having built the right KIND of power.",
    effects: {
      solar: 0.7, yield: { pxd: 1.2, vtx: 1.1 }, grip: 0.88, heat: 0.85,
      nodeSpawn: 1.3,
    },
    audio: "Wind band gain +9 dB with the gust LFO tripled. Footstep foley gains a grit layer that persists an hour after the season ends.",
  },
  THERMAL_INVERSION: {
    id: "THERMAL_INVERSION", name: "Thermal Inversion", severity: "NOTABLE",
    durationHours: 7.0, minStage: 3, weight: 8, colour: "#ff8a3d", glyph: "≡",
    forecast: "Inversion layer forming, {t}. Cooling will be impaired across low ground.",
    spectacle: "A visible brown lid over the basin at 300 m, trapping everything underneath it. Plumes from your chimneys hit the layer and spread sideways into a ceiling.",
    tactics: "Machine cooling ×0.45 in low terrain — fission piles and overclocked emitters trip within the hour unless throttled. The event that teaches players why their base should not be in the prettiest valley.",
    effects: {
      heat: 2.2, yield: { pxd: 1.15, lx: 0.8 }, solar: 0.75, tempDelta: +11,
      coherenceDrain: 1.1,
    },
    audio: "Reverb tail shortens by half as the inversion deadens the air. Machinery hum becomes noticeably closer and drier.",
  },
  SPORE_BLOOM: {
    id: "SPORE_BLOOM", name: "Spore Bloom", severity: "CALM",
    durationHours: 9.0, minStage: 3, weight: 10, colour: "#b574e0", glyph: "✺",
    forecast: "Mass sporulation event, {t}. Biome expansion favoured.",
    spectacle: "The air fills with drifting violet and gold motes for nine hours. Every carpet and canopy biome visibly expands its footprint while you watch.",
    tactics: "Terraform wave speed ×1.6 for any BIOME-class cartridge. The single best window to dispatch a biome spire — a nine-hour bloom can carry a new biome across a whole continent.",
    effects: {
      yield: { aq: 1.3, pxd: 1.25 }, bioluminescence: 1.5, nodeSpawn: 1.8,
      tempDelta: +2,
    },
    audio: "The granular ambience density quadruples. Playtesters describe it, unprompted, as 'the planet purring'.",
  },
  NULL_TIDE: {
    id: "NULL_TIDE", name: "Null Tide", severity: "CRISIS",
    durationHours: 3.5, minStage: 4, weight: 6, colour: "#ff00ff", glyph: "▓",
    forecast: "WARNING: Aq exceeds Pxd by 3×. Untextured flood predicted in {t}.",
    spectacle: "Magenta-and-black checkerboard water — the missing-texture error, rendered as a monster — advancing up every valley your hydrology reaches.",
    tactics: "Entirely self-inflicted: it only fires when you outrun your own Pixel Density with Hydrology. Fix the ratio and it recedes. The only event the player can prevent by playing better, and the only one that teaches the coherence term viscerally.",
    effects: {
      coherenceDrain: 3.8, yield: { aq: 0.4, pxd: 0.6, vtx: 0.7, lx: 0.7 },
      seaLevelDelta: 2.0, grip: 0.5, bandwidth: 0.4,
    },
    audio: "A single sustained 1 kHz sine — the sound of a test tone where the ecology should be.",
  },
  CRYSTAL_RESONANCE: {
    id: "CRYSTAL_RESONANCE", name: "Crystal Resonance", severity: "CALM",
    durationHours: 4.5, minStage: 4, weight: 7, colour: "#6e8ff0", glyph: "◈",
    forecast: "Lattice resonance predicted, {t}. Coherence infrastructure will over-reach.",
    spectacle: "Every crystal formation on the planet rings at 58 Hz simultaneously. The sound arrives before you find the source, and the Giant Crystal Stalks visibly vibrate.",
    tactics: "Coherence broadcast radius ×2.2 planet-wide — the safe expedition window. Veterans save their longest polar runs for resonance days and plant no beacons at all.",
    effects: {
      coherenceDrain: 0.35, yield: { pxd: 1.4, lx: 1.3 }, bioluminescence: 1.2,
      nodeSpawn: 1.4,
    },
    audio: "A pure 58 Hz drone with harmonics at the fifth and octave, spatialised to every crystal in range. The game's quietest and most loved sound.",
  },
  CLEAR_SKIES: {
    id: "CLEAR_SKIES", name: "Clear Skies", severity: "CALM",
    durationHours: 24.0, minStage: 1, weight: 22, colour: "#8b9bb4", glyph: "○",
    forecast: "Nothing scheduled. A good day to build.",
    spectacle: "Nothing happens. The planet simply is, at whatever fidelity you have earned for it.",
    tactics: "Baseline everything. These days exist on purpose: an event calendar with no gaps is a calendar with no events. Roughly a third of the month is quiet, and that is what makes the other two thirds land.",
    effects: {},
    audio: "The biome bed, unmodified. On a Stage-6 planet this is the best the game ever sounds.",
  },
};

export const EVENT_LIST = Object.values(EVENTS);

/* ══════════════════════════════════════════ THE DETERMINISTIC SCHEDULER ══ */

export interface ScheduledEvent {
  day: number;
  event: PlanetEvent;
  /** tick within the cycle at which it begins */
  startTick: number;
  endTick: number;
  /** 0..1 intensity roll — same seed, same roll, forever */
  intensity: number;
}

/** Splitmix32: a deterministic, well-distributed hash of (seed, day, salt). */
function hash32(seed: number, day: number, salt: number): number {
  let x = (seed ^ Math.imul(day + 1, 0x9e3779b9) ^ Math.imul(salt + 1, 0x85ebca6b)) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97) >>> 0;
  return ((x ^ (x >>> 15)) >>> 0) / 4294967296;
}

/**
 *  THE FORECAST IS THE FEATURE.
 *  Given (seed, day) this returns the same event on every machine, forever,
 *  with no stored state. The Planet Table can therefore show seven days ahead
 *  — and a player can plan a polar expedition around a Crystal Resonance that
 *  is still four days away.
 */
export function eventForDay(seed: number, day: number, maxStage: number): ScheduledEvent {
  const d = ((day % CALENDAR_DAYS) + CALENDAR_DAYS) % CALENDAR_DAYS;

  const pool = EVENT_LIST.filter((e) => e.minStage <= maxStage);
  const total = pool.reduce((a, e) => a + e.weight, 0);
  let roll = hash32(seed, d, 1) * total;
  let picked = pool[pool.length - 1];
  for (const e of pool) {
    roll -= e.weight;
    if (roll <= 0) { picked = e; break; }
  }

  // Anti-clustering: never the same CRISIS two days running. Deterministic,
  // because it only ever looks backwards at an already-decided day.
  if (picked.severity === "CRISIS" && d > 0) {
    const prev = eventForDayRaw(seed, d - 1, maxStage);
    if (prev.severity === "CRISIS") picked = EVENTS.CLEAR_SKIES;
  }

  const dayStart = d * TICKS_PER_DAY;
  const offsetH = hash32(seed, d, 2) * Math.max(0, 24 - picked.durationHours);
  const startTick = dayStart + Math.floor((offsetH / 24) * TICKS_PER_DAY);
  const endTick = startTick + Math.floor((picked.durationHours / 24) * TICKS_PER_DAY);

  return { day: d, event: picked, startTick, endTick, intensity: 0.55 + hash32(seed, d, 3) * 0.45 };
}

function eventForDayRaw(seed: number, day: number, maxStage: number): PlanetEvent {
  const pool = EVENT_LIST.filter((e) => e.minStage <= maxStage);
  const total = pool.reduce((a, e) => a + e.weight, 0);
  let roll = hash32(seed, day, 1) * total;
  for (const e of pool) {
    roll -= e.weight;
    if (roll <= 0) return e;
  }
  return EVENTS.CLEAR_SKIES;
}

export function calendar(seed: number, maxStage: number): ScheduledEvent[] {
  return Array.from({ length: CALENDAR_DAYS }, (_, d) => eventForDay(seed, d, maxStage));
}

export function activeAt(seed: number, tick: number, maxStage: number): ScheduledEvent | null {
  const t = ((tick % TICKS_PER_CYCLE) + TICKS_PER_CYCLE) % TICKS_PER_CYCLE;
  const day = Math.floor(t / TICKS_PER_DAY);
  for (const d of [day - 1, day]) {
    const ev = eventForDay(seed, d, maxStage);
    if (t >= ev.startTick && t < ev.endTick) return ev;
  }
  return null;
}

/** The wrist device's seven-day forecast. */
export function forecast(seed: number, tick: number, maxStage: number, days = 7) {
  const today = Math.floor((tick % TICKS_PER_CYCLE) / TICKS_PER_DAY);
  return Array.from({ length: days }, (_, i) => {
    const ev = eventForDay(seed, today + i, maxStage);
    const ticksAway = Math.max(0, ev.startTick + (i >= 0 ? 0 : 0) - (tick % TICKS_PER_CYCLE) + i * 0);
    return {
      ...ev,
      inDays: i,
      etaMinutes: Math.round((ticksAway / 120 / 60) * 10) / 10,
      label: ev.event.forecast
        .replace("{t}", i === 0 ? "now" : i === 1 ? "1 day" : `${i} days`)
        .replace("{dir}", ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"][Math.floor(hash32(seed, ev.day, 7) * 8)]),
    };
  });
}

/** Compose an active event's effects into a multiplier set the sim applies. */
export function effectsAt(seed: number, tick: number, maxStage: number): Required<Pick<EventEffects, "solar" | "coherenceDrain" | "heat" | "bioluminescence" | "nodeSpawn" | "grip" | "bandwidth" | "seaLevelDelta" | "tempDelta">> & { yield: Record<MetricKey, number>; event: PlanetEvent | null; intensity: number } {
  const act = activeAt(seed, tick, maxStage);
  const base = {
    solar: 1, coherenceDrain: 1, heat: 1, bioluminescence: 1, nodeSpawn: 1,
    grip: 1, bandwidth: 1, seaLevelDelta: 0, tempDelta: 0,
    yield: { pxd: 1, vtx: 1, lx: 1, aq: 1 } as Record<MetricKey, number>,
    event: null as PlanetEvent | null, intensity: 0,
  };
  if (!act) return base;
  const e = act.event.effects;
  const k = act.intensity;
  const lerp1 = (v: number | undefined) => (v === undefined ? 1 : 1 + (v - 1) * k);
  return {
    solar: lerp1(e.solar),
    coherenceDrain: lerp1(e.coherenceDrain),
    heat: lerp1(e.heat),
    bioluminescence: lerp1(e.bioluminescence),
    nodeSpawn: lerp1(e.nodeSpawn),
    grip: lerp1(e.grip),
    bandwidth: lerp1(e.bandwidth),
    seaLevelDelta: (e.seaLevelDelta ?? 0) * k,
    tempDelta: (e.tempDelta ?? 0) * k,
    yield: {
      pxd: lerp1(e.yield?.pxd), vtx: lerp1(e.yield?.vtx),
      lx: lerp1(e.yield?.lx), aq: lerp1(e.yield?.aq),
    },
    event: act.event,
    intensity: k,
  };
}

export const CALENDAR_STATS = {
  events: EVENT_LIST.length,
  days: CALENDAR_DAYS,
  realMinutesPerDay: 24,
  realHoursPerCycle: (CALENDAR_DAYS * 24) / 60,
  crisisEvents: EVENT_LIST.filter((e) => e.severity === "CRISIS").length,
  calmShare: Math.round((EVENT_LIST.filter((e) => e.severity === "CALM").reduce((a, e) => a + e.weight, 0) /
    EVENT_LIST.reduce((a, e) => a + e.weight, 0)) * 100),
};
