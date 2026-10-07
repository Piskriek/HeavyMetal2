// The first Play (owner, 2026-10-07; STATUS SM22, SETMIX_PLAN Phase 2b): who you are, the gate, the first look round the
// planet, the first machine. Pure: the steps, what each one asks of you, sync, and where a machine may stand. The screen
// (play.tsx, play-scene.ts) draws it; this file decides it.

/** Where you are in the first Play. */
export type Step = 'create' | 'power' | 'explore' | 'build' | 'done';
export const STEPS: readonly Step[] = ['create', 'power', 'explore', 'build', 'done'];

/** A machine you placed on your plot (planet frame, metres). */
export interface PlacedMachine { readonly kind: 'texture-mill'; readonly x: number; readonly z: number; readonly yaw: number }

/** Everything the first Play saves. */
export interface PlayState {
  readonly v: 1;
  readonly step: Step;
  /** The human you made in the lab (the avatar maker's look id). */
  readonly avatarId: string | null;
  readonly gateOn: boolean;
  /** You have stood on the planet at least once. */
  readonly visited: boolean;
  readonly machines: readonly PlacedMachine[];
  /** The plot's fidelity stage: 0 is the black-and-white dither you first see. */
  readonly stage: number;
}

export const FRESH: PlayState = { v: 1, step: 'create', avatarId: null, gateOn: false, visited: false, machines: [], stage: 0 };
export const SAVE_KEY = 'hm.setmix.play';

const num = (v: unknown, lo: number, hi: number, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);

/** A saved state, checked: anything missing or odd falls back to the fresh value, so a bad save never traps a player. */
export function loadState(raw: unknown): PlayState {
  if (!raw || typeof raw !== 'object') return FRESH;
  const r = raw as Record<string, unknown>;
  const step = STEPS.includes(r['step'] as Step) ? (r['step'] as Step) : 'create';
  const machines = Array.isArray(r['machines'])
    ? (r['machines'] as unknown[]).flatMap((m): PlacedMachine[] => {
      if (!m || typeof m !== 'object') return [];
      const o = m as Record<string, unknown>;
      return o['kind'] === 'texture-mill' ? [{ kind: 'texture-mill', x: num(o['x'], -2000, 2000, 0), z: num(o['z'], -2000, 2000, 0), yaw: num(o['yaw'], -10, 10, 0) }] : [];
    })
    : [];
  const avatarId = typeof r['avatarId'] === 'string' && r['avatarId'] ? r['avatarId'] : null;
  // a step past 'create' needs a human; past 'power' needs the gate on
  const fixedStep: Step = step !== 'create' && !avatarId ? 'create' : step;
  return {
    v: 1, step: fixedStep, avatarId,
    gateOn: fixedStep === 'create' || fixedStep === 'power' ? false : true,
    visited: r['visited'] === true,
    machines,
    stage: Math.round(num(r['stage'], 0, 6, 0)),
  };
}

/** You made your human: next, turn on the gate. */
export function created(s: PlayState, avatarId: string): PlayState {
  return { ...s, avatarId, step: s.step === 'create' ? 'power' : s.step };
}
/** The main lever is thrown and the gate is on: next, step through and look around. */
export function poweredOn(s: PlayState): PlayState {
  return s.step === 'power' ? { ...s, gateOn: true, step: 'explore' } : { ...s, gateOn: true };
}
/** You stepped onto the planet. */
export function arrived(s: PlayState): PlayState { return s.visited ? s : { ...s, visited: true }; }
/** You are back in the lab (you walked back, or your sync ran out): the first look round is done. */
export function returned(s: PlayState): PlayState {
  return s.step === 'explore' && s.visited ? { ...s, step: 'build' } : s;
}
/** A machine stands on your plot. The first one lifts the plot to stage 1. */
export function placed(s: PlayState, m: PlacedMachine): PlayState {
  return { ...s, machines: [...s.machines, m], stage: Math.max(s.stage, 1), step: s.step === 'build' ? 'done' : s.step };
}

/** What the screen says you should do now, where you are. */
export function objective(s: PlayState, where: 'lab' | 'planet'): { readonly title: string; readonly hint: string } {
  switch (s.step) {
    case 'create': return { title: 'Who are you?', hint: 'Make your scientist before you turn anything on.' };
    case 'power': return { title: 'Turn on the gate', hint: 'Pull the main lever on the console.' };
    case 'explore': return where === 'lab'
      ? { title: 'Step through the gate', hint: 'Look around your plot. Your sync runs down while you are there.' }
      : { title: 'Look around', hint: 'Your sync is running down. Walk back through the gate before it runs out.' };
    case 'build': return where === 'lab'
      ? { title: 'Build your first machine', hint: 'Step through to your plot and open the build menu.' }
      : { title: 'Build your first machine', hint: 'Open the build menu and place a texture mill near the gate.' };
    case 'done': return { title: 'Stage 1', hint: 'Colour has reached your plot. Your mill keeps your sync up nearby.' };
  }
}

// ---- sync: how long your body holds together on the planet

/** Seconds of sync on a stage-0 planet, from full. */
export const SYNC_SECONDS = 60;
/** Within this distance of a running machine, sync recovers (from stage 1). */
export const MACHINE_FIELD = 28;

/** Sync after `dt` seconds: it refills in the lab, drains on the planet, and from stage 1 recovers near a running machine. 0..1. */
export function stepSync(level: number, dt: number, o: { readonly onPlanet: boolean; readonly stage: number; readonly nearMachine: boolean }): number {
  let rate: number;
  if (!o.onPlanet) rate = 0.5;
  else if (o.stage >= 1 && o.nearMachine) rate = 0.2;
  else rate = -1 / (SYNC_SECONDS * (o.stage >= 1 ? 1.5 : 1));
  return Math.min(1, Math.max(0, level + rate * dt));
}

// ---- where a machine may stand

/** The gate's junction box reaches this far: a machine further out gets no power. */
export const CABLE_REACH = 30;
/** Machines keep clear of the gate's footing and of each other. */
export const GATE_CLEAR = 4.5, MACHINE_GAP = 3.5;

/** Whether a machine may stand at x, z (planet frame), and if not, why (the build ghost shows it). */
export function placeCheck(x: number, z: number, gate: { readonly x: number; readonly z: number }, machines: readonly PlacedMachine[]): { readonly ok: boolean; readonly why: string } {
  const d = Math.hypot(x - gate.x, z - gate.z);
  if (d < GATE_CLEAR) return { ok: false, why: 'Too close to the gate.' };
  if (d > CABLE_REACH) return { ok: false, why: 'Too far: the gate’s cable reaches 30 m.' };
  if (machines.some((m) => Math.hypot(m.x - x, m.z - z) < MACHINE_GAP)) return { ok: false, why: 'Too close to another machine.' };
  return { ok: true, why: '' };
}
