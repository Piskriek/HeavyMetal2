// The first Play (owner, 2026-10-07; STATUS SM22, SETMIX_PLAN Phase 2b): who you are, the gate, the first look round the
// planet, the first machine; then the plot's stages (the plot itself is `@hm/plotsim`: ore, power, machines, metrics). Pure: the
// steps, what each one asks of you, sync, and the save. The screen (play.tsx, play-scene.ts) draws it; this file decides it.

import { loadPlot, newPlot, nextStage, type MachineKind, type Metric, type PlotState } from '@hm/plotsim';
import { loadLab, newLab, type Cartridge, type LabState } from '@hm/cartlab';
import { VAULT_BY_ID } from '@hm/vault';

/** Where you are in the first Play (the tutorial); after it, the plot's stages lead. */
export type Step = 'create' | 'power' | 'explore' | 'build' | 'drill' | 'done';
export const STEPS: readonly Step[] = ['create', 'power', 'explore', 'build', 'drill', 'done'];

export type PlayAvatar =
  | { readonly kind: 'scientist'; readonly name: string; readonly visor: string }
  | { readonly kind: 'custom'; readonly name: string; readonly key: string };

/** Everything Play saves. */
export interface PlayState {
  readonly v: 5;
  readonly step: Step;
  /** The scientist or custom avatar made in the lab. */
  readonly avatar: PlayAvatar | null;
  /** Legacy look id kept for compatibility. */
  readonly avatarId: string | null;
  readonly gateOn: boolean;
  /** You have stood on the planet at least once. */
  readonly visited: boolean;
  /** Your plot: its ore, its machines, its four fidelity metrics and its stage (`@hm/plotsim`). */
  readonly plot: PlotState;
  /** The lab's cartridges (bench, combiner, rack) (`@hm/cartlab`). */
  readonly lab: LabState;
}

export const FRESH: PlayState = { v: 5, step: 'create', avatar: null, avatarId: null, gateOn: false, visited: false, plot: newPlot(), lab: newLab() };
export const SAVE_KEY = 'hm.setmix.play';

/** What players call the four metrics. */
export const METRIC_NAME: Readonly<Record<Metric, string>> = { pxd: 'texture', vtx: 'shape', lx: 'light', aq: 'water' };
/** The colour of each metric's pixels (the concept art's language). */
export const METRIC_COLOUR: Readonly<Record<Metric, string>> = { pxd: '#ff3d8a', vtx: '#7cff4d', lx: '#ffc13d', aq: '#3dc8ff' };

const num = (v: unknown, lo: number, hi: number, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);

/** The first saves (v1) kept a list of texture mills and a stage: they become the plot's mills, at that stage. */
function migrate(raw: Record<string, unknown>): PlotState {
  const mills = Array.isArray(raw['machines']) ? (raw['machines'] as unknown[]).filter((m): m is Record<string, unknown> => !!m && typeof m === 'object' && (m as Record<string, unknown>)['kind'] === 'texture-mill') : [];
  const machines = mills.map((m, i) => ({ id: i + 1, kind: 'mill' as MachineKind, x: num(m['x'], -2000, 2000, 0), z: num(m['z'], -2000, 2000, 0), yaw: num(m['yaw'], -10, 10, 0), on: true, cartridge: null, built: 0 }));
  const stage = Math.round(num(raw['stage'], 0, 6, 0));
  return loadPlot({ ...newPlot(), machines, nextId: machines.length + 1, stage: machines.length ? Math.max(1, stage) : stage });
}

function parseAvatar(raw: unknown, legacyId: string | null, rawName?: unknown): PlayAvatar | null {
  const defaultName = typeof rawName === 'string' && rawName.trim() ? rawName.trim() : 'Scientist';
  if (raw && typeof raw === 'object') {
    const r = raw as Record<string, unknown>;
    const name = typeof r['name'] === 'string' && r['name'].trim() ? r['name'].trim() : defaultName;
    if (r['kind'] === 'custom' && typeof r['key'] === 'string') {
      return { kind: 'custom', name, key: r['key'] };
    }
    const visor = typeof r['visor'] === 'string' && r['visor'] ? r['visor'] : '#f59e0b';
    return { kind: 'scientist', name, visor };
  }
  if (legacyId) {
    return { kind: 'scientist', name: defaultName, visor: '#f59e0b' };
  }
  return null;
}

/** A saved state, checked: anything missing or odd falls back to the fresh value, so a bad save never traps a player. */
export function loadState(raw: unknown): PlayState {
  if (!raw || typeof raw !== 'object') return FRESH;
  const r = raw as Record<string, unknown>;
  const step = STEPS.includes(r['step'] as Step) ? (r['step'] as Step) : 'create';
  const legacyId = typeof r['avatarId'] === 'string' && r['avatarId'] ? r['avatarId'] : null;
  const avatar = parseAvatar(r['avatar'], legacyId, r['name']);
  const avatarId = avatar ? (avatar.kind === 'scientist' ? 'scientist' : avatar.key) : legacyId;
  // a step past 'create' needs an avatar; past 'power' needs the gate on
  let plot = r['plot'] !== undefined ? loadPlot(r['plot']) : migrate(r);
  const hasDrill = plot.machines.some((m) => m.kind === 'drill');
  let fixedStep: Step = step !== 'create' && !avatar && !avatarId ? 'create' : step;
  if (fixedStep === 'done' && !hasDrill) fixedStep = 'drill';
  let lab = r['lab'] ? loadLab(r['lab']) : null;
  if (!lab) {
    let nextLab = newLab();
    const newMachines = plot.machines.map((m) => {
      if (m.cartridge) {
        const p = VAULT_BY_ID.get(m.cartridge);
        if (p) {
          const cid = `c${nextLab.nextId}`;
          const c: Cartridge = {
            id: cid,
            name: p.name,
            kind: 'preset',
            preset: p.id,
            from: [],
            affinity: {
              pxd: p.affinity.pxd ?? 1,
              vtx: p.affinity.vtx ?? 1,
              lx: p.affinity.lx ?? 1,
              aq: p.affinity.aq ?? 1,
            },
            slot: m.id,
          };
          nextLab = {
            ...nextLab,
            nextId: nextLab.nextId + 1,
            cartridges: [...nextLab.cartridges, c],
          };
          return { ...m, cartridge: cid };
        }
      }
      return m;
    });
    plot = { ...plot, machines: newMachines };
    lab = nextLab;
  }
  return {
    v: 5, step: fixedStep, avatar, avatarId,
    gateOn: fixedStep === 'create' || fixedStep === 'power' ? false : true,
    visited: r['visited'] === true,
    plot,
    lab,
  };
}

/** You made your avatar: next, turn on the gate. */
export function created(s: PlayState, avatar: PlayAvatar | string): PlayState {
  const av: PlayAvatar = typeof avatar === 'string'
    ? { kind: 'scientist', name: 'Scientist', visor: '#f59e0b' }
    : avatar;
  const avatarId = av.kind === 'scientist' ? 'scientist' : av.key;
  return { ...s, avatar: av, avatarId, step: s.step === 'create' ? 'power' : s.step };
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
/** The plot changed (a machine built or removed, time passed). After the first pixel machine, the player feeds the mill with a drill before stage goals lead. */
export function withPlot(s: PlayState, plot: PlotState): PlayState {
  const hasRunningDrill = plot.machines.some((m) => m.kind === 'drill' && m.on);
  let nextStep = s.step;
  if (s.step === 'build' && plot.stage >= 1) {
    nextStep = hasRunningDrill ? 'done' : 'drill';
  } else if (s.step === 'drill' && hasRunningDrill) {
    nextStep = 'done';
  }
  return { ...s, plot, step: nextStep };
}

/** In the 'drill' tutorial step, the first rock drill is free to place even with 0 ore. */
export function isFreeDrill(s: PlayState, kind: MachineKind): boolean {
  return s.step === 'drill' && kind === 'drill' && !s.plot.machines.some((m) => m.kind === 'drill');
}

/** The lab changed (cartridge made, written, combined, slotted). */
export function withLab(s: PlayState, lab: LabState): PlayState {
  return { ...s, lab };
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
      : { title: 'Build your first machine', hint: 'Open the build menu (B) and place a texture mill near the gate.' };
    case 'drill': return {
      title: 'Feed your mill',
      hint: 'It burns ore. Build a rock drill (B) on rocky ground: rock and scree hold the most.',
    };
    case 'done': {
      const next = nextStage(s.plot);
      if (!next) return { title: 'Stage 6', hint: 'Full fidelity: your plot is real.' };
      const needs = (Object.entries(next.needs) as [Metric, number][]).map(([m, v]) => `${METRIC_NAME[m]} ${v}`).join(', ');
      return { title: `Stage ${s.plot.stage}`, hint: `Stage ${next.stage} needs ${needs}.` };
    }
  }
}

// ---- sync: how long your body holds together on the planet

/** Seconds of sync on a stage-0 planet, from full. */
export const SYNC_SECONDS = 60;
/** Within this distance of a running machine, sync recovers (from stage 1). */
export const MACHINE_FIELD = 28;

/** Sync after `dt` seconds: it refills in the lab, drains on the planet, and from stage 1 recovers near a running machine. 0..1. */
/** Sync refill per second inside a pressurised room on the planet (D14): slower than the lab, so the lab stays home. */
export const SHELTER_REFILL = 0.25;

export function stepSync(level: number, dt: number, o: { readonly onPlanet: boolean; readonly stage: number; readonly nearMachine: boolean; readonly sheltered?: boolean }): number {
  let rate: number;
  if (!o.onPlanet) rate = 0.5;
  else if (o.sheltered === true) rate = SHELTER_REFILL;
  else if (o.stage >= 1 && o.nearMachine) rate = 0.2;
  else rate = -1 / (SYNC_SECONDS * (o.stage >= 1 ? 1.5 : 1));
  return Math.min(1, Math.max(0, level + rate * dt));
}
