import type { ComponentDef, LapState, LapTrackerLike, RacerDeps, RacerWorld, StepContext, Value } from '../src/types';

export function fakeWorld(): RacerWorld & { spawn(c: Record<string, Record<string, Value>>): number } {
  const defs = new Map<string, ComponentDef>(); const ents = new Map<number, Map<string, Record<string, Value>>>(); let next = 1;
  return {
    defineComponent(def) { if (defs.has(def.name)) throw new Error('duplicate ' + def.name); defs.set(def.name, def); },
    components: () => [...defs.values()],
    alive: (id) => ents.has(id), has: (id, c) => ents.get(id)?.has(c) ?? false, get: (id, c) => ents.get(id)?.get(c),
    set(id, c, v) { const m = ents.get(id); const cur = m?.get(c); if (!m || !cur) throw new Error(`no ${c} on ${id}`); m.set(c, { ...cur, ...v }); },
    query: (...cs) => [...ents.keys()].filter((id) => cs.every((c) => ents.get(id)?.has(c))).sort((a, b) => a - b),
    spawn(c) { const id = next++; const m = new Map<string, Record<string, Value>>(); for (const [k, v] of Object.entries(c)) m.set(k, { ...(defs.get(k)?.defaults ?? {}), ...v }); ents.set(id, m); return id; },
  };
}
export const T = { transform: { x: 0, y: 0, z: 0 }, velocity: { vx: 0, vy: 0, vz: 0 }, body: {} } as const;
export function ctx(actors: Record<string, Record<string, number | boolean>> = {}, dt = 1 / 120): StepContext & { events: StepContext['events'] & { log: [string, unknown][] } } {
  const log: [string, unknown][] = [];
  return { dt, tick: 0, rng: { next: () => 0.5 }, input: { tick: 0, actors }, events: { emit: (n, p) => { log.push([n, p]); }, log } };
}
export function fakeDeps(over: Partial<RacerDeps> = {}) {
  const forces: [number, number[]][] = []; const impulses: [number, number[]][] = [];
  const states = new Map<number, LapState>();
  const deps: RacerDeps = {
    physics: { applyForce: (e, f) => { forces.push([e, [...f]]); }, applyImpulse: (e, i) => { impulses.push([e, [...i]]); } },
    track: { points: [[0, 0], [100, 0], [100, 100], [0, 100]], width: 10 }, laps: 3,
    derivePhysics: () => ({ mass: 2, maxSpeed: 20, acceleration: 10, restitution: 0.3, grip: 1 }),
    aiControl: () => ({ steer: 0.5, throttle: 0.8 }), rubberBand: () => 1.1,
    createLapTracker: (): LapTrackerLike => { let st: LapState = { lap: 1, progress: 0, finished: false, lapCompleted: false }; return { update: () => st = { ...st, ...(states.get(0) ?? {}) }, reset() { st = { lap: 1, progress: 0, finished: false, lapCompleted: false }; }, get state() { return st; } }; },
    rankRacers: (s) => [...s].sort((a, b) => b.progress - a.progress || (a.id < b.id ? -1 : 1)).map((r, i) => ({ id: r.id, position: i + 1 })),
    itemById: (id) => (id === 'boost' ? { id, kind: 'self', durationMs: 2500 } : id === 'jump' ? { id, kind: 'self', durationMs: 600 } : undefined),
    ...over,
  };
  return { deps, forces, impulses, states };
}
