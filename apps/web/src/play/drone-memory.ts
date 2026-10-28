/**
 * Plan 56 W6a: the drone's memory host. The Overwatch drone is a rung: its ego (`brain`) over three presets it lives by,
 * fire rhythm (`mot`), reflexes (`logic`) and flight (`loc`). What happens in play becomes their experience; leaving the
 * Moon is the checkpoint where it dreams; its memory is saved as share codes.
 *
 * - Contact: the fire preset, more exciting the closer it is, the outcome still open.
 * - A target down: the fire preset, a good outcome.
 * - The area clear: the flight preset, calm.
 * - Hits on the player: the flight preset failed to cover; hard ones are felt as root-reactivity (fight or flight).
 * - A reflex fired from a bridged game: the reflex preset.
 * Each is thought under the ego's own dominant distortion (aligned while it is balanced), so the ladder holds: the thinking
 * above shapes what the presets below take on.
 *
 * Pure: the game passes the tick and the stage; nothing here reads a clock or storage.
 */
import { ALIGNED, decodeMem, encodeMem, type Mem, type StageId } from '@hm/shorthand';
import {
  REST_AT, SQ_DISTORTION_CATALOG, compileSystemMemory, createPresetMemory, digestLines, dominantDistortion, dream, kundalini, recordExperience, symptomOffset, wakeLine,
  type DreamCue, type DreamDigest, type EgoWeights, type Experience,
} from '@hm/harness';

/** The drone's memories by role; `of` codes are fixed so a save always finds its own. */
export const DRONE_MEMORY_OF = { ego: 'brain:d0e0', fire: 'mot:f1e0', reflex: 'logic:5ef1', flight: 'loc:f17e' } as const;
export type DroneRole = Exclude<keyof typeof DRONE_MEMORY_OF, 'ego'>;
export const DRONE_ROLES: readonly DroneRole[] = ['fire', 'reflex', 'flight'];

export interface DroneMemory {
  readonly ego: Mem;
  readonly presets: Readonly<Record<DroneRole, Mem>>;
  readonly weights: EgoWeights;
  /** The last dream's digest, for the bridge and the debug view. */
  readonly lastDream: DreamDigest | null;
}

/** What the game saw happen, for the drone's memory. */
export type DroneCatalyst =
  | { readonly kind: 'contact'; readonly distance: number }
  | { readonly kind: 'down' }
  | { readonly kind: 'clear' }
  | { readonly kind: 'hurt'; readonly damage: number }
  | { readonly kind: 'reflex' };

export function createDroneMemory(): DroneMemory {
  return {
    ego: createPresetMemory(DRONE_MEMORY_OF.ego),
    presets: { fire: createPresetMemory(DRONE_MEMORY_OF.fire), reflex: createPresetMemory(DRONE_MEMORY_OF.reflex), flight: createPresetMemory(DRONE_MEMORY_OF.flight) },
    weights: { prefer: {} },
    lastDream: null,
  };
}

/** The stage a frame reports (0..6) as the shorthand's stage id. */
export const stageIdOf = (stage: number): StageId => (stage <= 0 ? 'S0a' : stage >= 6 ? 'S6' : (`S${Math.round(stage)}` as StageId));

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

/** The experience a catalyst is for one preset, and which. */
function experienceOf(c: DroneCatalyst): { readonly role: DroneRole; readonly x: Omit<Experience, 't' | 'stage' | 'by'> } {
  switch (c.kind) {
    case 'contact': return { role: 'fire', x: { cat: 'CONTACT', excitement: clamp01(0.3 + 0.5 * (1 - c.distance / 30)), error: 0.3 } };
    case 'down': return { role: 'fire', x: { cat: 'TARGET_DOWN', excitement: 0.6, error: 0.1 } };
    case 'clear': return { role: 'flight', x: { cat: 'AREA_CLEAR', excitement: 0.2, error: 0 } };
    case 'hurt': {
      const ex = clamp01(0.4 + c.damage / 40);
      return { role: 'flight', x: { cat: 'HITS_ON_YOU', excitement: ex, error: 0.8, ...(ex >= 0.7 ? { felt: 'root-reactivity' as const } : {}) } };
    }
    case 'reflex': return { role: 'reflex', x: { cat: 'REFLEX', excitement: 0.7, error: 0.2 } };
  }
}

/** One catalyst into the drone's memory, at a game tick and the plot's stage; `calm` is what anchors present lend (0..0.6). */
export function noteCatalyst(m: DroneMemory, c: DroneCatalyst, tick: number, stage: number, calm = 0): DroneMemory {
  const { role, x } = experienceOf(c);
  const by = dominantDistortion(m.ego);
  const mem = recordExperience(m.presets[role], { ...x, t: Math.max(0, Math.round(tick)), stage: stageIdOf(stage), by, ...(calm > 0 ? { calm } : {}) });
  return { ...m, presets: { ...m.presets, [role]: mem } };
}

/** The dream at a checkpoint (leaving the Moon): the drone's presets under its ego; what it says on waking. */
export function dreamNow(m: DroneMemory, tick: number, cues?: readonly DreamCue[]): { readonly memory: DroneMemory; readonly line: string } {
  const order = DRONE_ROLES.map((r) => m.presets[r]);
  const r = dream({ ego: m.ego, presets: order, weights: m.weights, now: Math.max(0, Math.round(tick)), ...(cues ? { cues } : {}) });
  const presets = { fire: r.presets[0]!, reflex: r.presets[1]!, flight: r.presets[2]! };
  return { memory: { ego: r.ego, presets, weights: r.weights, lastDream: r.digest }, line: wakeLine(r.digest) };
}

/** The drone's memory as text to save: each memory as its share code, and the ego's preferences. */
export function saveDroneMemory(m: DroneMemory): string {
  return JSON.stringify({ v: 1, ego: encodeMem(m.ego), presets: DRONE_ROLES.map((r) => encodeMem(m.presets[r])), prefer: m.weights.prefer });
}

/** A saved drone memory, or null for anything else (a fresh one is the caller's fallback). Never throws. */
export function loadDroneMemory(text: string | null): DroneMemory | null {
  try {
    if (!text) return null;
    const o = JSON.parse(text) as { v?: unknown; ego?: unknown; presets?: unknown; prefer?: unknown };
    if (o.v !== 1 || typeof o.ego !== 'string' || !Array.isArray(o.presets) || o.presets.length !== DRONE_ROLES.length) return null;
    const ego = decodeMem(o.ego);
    const mems = o.presets.map((c) => (typeof c === 'string' ? decodeMem(c) : null));
    if (!ego || ego.of !== DRONE_MEMORY_OF.ego || mems.some((x, i) => !x || x.of !== DRONE_MEMORY_OF[DRONE_ROLES[i]!])) return null;
    const prefer: Record<string, number> = {};
    if (o.prefer && typeof o.prefer === 'object') {
      for (const [k, v] of Object.entries(o.prefer as Record<string, unknown>)) if (Number.isInteger(v) && (v as number) >= -127 && (v as number) <= 127) prefer[k] = v as number;
    }
    return { ego, presets: { fire: mems[0]!, reflex: mems[1]!, flight: mems[2]! }, weights: { prefer }, lastDream: null };
  } catch {
    return null;
  }
}

// ---- Plan 56 W6b: the Higher Self seat. An AI on the bridge reads the drone's perspective, cues its next dream and
// speaks through it. The seat never writes memory: a cue only biases what the dream replays.

/** What the drone shows a Higher Self: its system digest (W4) as lines, each preset's kundalini level, and what it may cue. */
export interface DronePerspective {
  readonly lines: readonly string[];
  readonly kundalini: Readonly<Record<DroneRole, number>>;
  /** Episodes still charging a ray, the ones worth a cue: newest first, at most MAX_CUES. */
  readonly cueable: readonly { readonly of: string; readonly t: number; readonly cat: string; readonly d: string; readonly h: number }[];
}

/** The most cues a Higher Self may give for one dream (the dream's own budget). */
export const MAX_CUES = 12;

export function dronePerspective(m: DroneMemory): DronePerspective {
  const presets = DRONE_ROLES.map((r) => m.presets[r]);
  const pack = compileSystemMemory(presets, [{ ego: m.ego, presets: presets.map((p) => p.of), weights: m.weights }]);
  const cueable = presets.flatMap((p) => p.ep
    .filter((e) => e.d !== ALIGNED && (p.charge[SQ_DISTORTION_CATALOG[e.d].rayIndex - 1] ?? 0) > REST_AT)
    .map((e) => ({ of: p.of, t: e.t, cat: e.cat, d: e.d, h: e.h })))
    .sort((a, b) => b.t - a.t || (a.of < b.of ? -1 : 1)).slice(0, MAX_CUES);
  return {
    lines: digestLines(pack),
    kundalini: { fire: kundalini(m.presets.fire), reflex: kundalini(m.presets.reflex), flight: kundalini(m.presets.flight) },
    cueable,
  };
}

/** A Higher Self's cues from the bridge, checked: only the drone's own presets, whole ticks, at most MAX_CUES; null for anything else. */
export function checkCues(raw: unknown): DreamCue[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_CUES) return null;
  const mine = new Set<string>(DRONE_ROLES.map((r) => DRONE_MEMORY_OF[r]));
  const out: DreamCue[] = [];
  for (const c of raw) {
    if (!c || typeof c !== 'object') return null;
    const { of, t } = c as { of?: unknown; t?: unknown };
    if (typeof of !== 'string' || !mine.has(of) || !Number.isSafeInteger(t) || (t as number) < 0) return null;
    out.push({ of, t: t as number });
  }
  return out;
}

/** A Higher Self's words, made safe to say: plain text, one line, at most 300 characters; null when nothing is left. */
export function higherSelfWords(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);
  return s.length ? s : null;
}

// ---- Plan 56 W6c: symptoms you can see. Catalyst left unbalanced shows in the body (Law of One 61.7): the fire rhythm
// stutters by the fire preset's imbalance, and the flight sways off its station by the flight preset's. A balanced drone
// is steady; a dream that balances it steadies it.

/** At full imbalance the fire rhythm's gaps stretch or shrink by up to half... */
export const SYMPTOM_GAP = 0.5;
/** ...and the flight sways up to this far (m) off its station while it fights. */
export const SYMPTOM_SWAY_M = 0.8;

export interface DroneSymptoms {
  /** The factor on the fire rhythm's gaps at a step (1 when the fire preset is balanced). */
  gapFactor(step: number): number;
  /** The offset (m) from its fighting station at a step ({0, 0} when the flight preset is balanced). */
  sway(step: number): { readonly x: number; readonly z: number };
  /** How strong each is: 1 − balance. */
  readonly amplitude: { readonly fire: number; readonly flight: number };
}

export function droneSymptoms(m: DroneMemory): DroneSymptoms {
  const { fire, flight } = m.presets;
  return {
    gapFactor: (step) => 1 + SYMPTOM_GAP * symptomOffset(fire, step),
    sway: (step) => ({ x: SYMPTOM_SWAY_M * symptomOffset(flight, step), z: SYMPTOM_SWAY_M * symptomOffset(flight, step, 1) }),
    amplitude: { fire: 1 - fire.bal, flight: 1 - flight.bal },
  };
}
