import type {
  DirectorConfig,
  DirectorEvent,
  DirectorState,
  Phase,
  Progress,
  RaceDirector,
  RaceResult,
} from './types.js';

const DEFAULT_COUNTDOWN_MS = 3000;
const DEFAULT_GRACE_MS = 30000;
const DEFAULT_MAX_RACE_MS = 600000;
const DEFAULT_HOLD_MS = 1500;

function clamp(n: number, lo: number, hi: number): number {
  if (n < lo) return lo;
  if (n > hi) return hi;
  return n;
}

function isValidPhase(p: unknown): p is Phase {
  return p === 'lobby' || p === 'countdown' || p === 'racing' || p === 'finished' || p === 'results';
}

interface SnapshotShape {
  v: number;
  config: {
    racers: string[];
    laps: number;
    countdownMs: number;
    finishGraceMs: number;
    maxRaceMs: number;
    finishedHoldMs: number;
  };
  state: {
    phase: Phase;
    countdownLeftMs: number;
    raceTimeMs: number;
    lights: number;
    order: { id: string; position: number }[];
    finishTimes: Record<string, number>;
    dnf: string[];
  };
  internals: {
    finishOrder: string[];
    firstFinishTime: number | null;
    finishedElapsedMs: number;
    emitted2: boolean;
    emitted1: boolean;
    emitted0: boolean;
  };
}

export function createRaceDirector(cfg: DirectorConfig): RaceDirector {
  let cfgRacers: string[] = [...cfg.racers];
  let laps: number = cfg.laps;
  let countdownMs: number = cfg.countdownMs ?? DEFAULT_COUNTDOWN_MS;
  let finishGraceMs: number = cfg.finishGraceMs ?? DEFAULT_GRACE_MS;
  let maxRaceMs: number = cfg.maxRaceMs ?? DEFAULT_MAX_RACE_MS;
  let finishedHoldMs: number = cfg.finishedHoldMs ?? DEFAULT_HOLD_MS;

  const state: DirectorState = {
    phase: 'lobby',
    countdownLeftMs: countdownMs,
    raceTimeMs: 0,
    lights: 3,
    order: cfgRacers.map((id, i) => ({ id, position: i + 1 })),
    finishTimes: {},
    dnf: [],
  };

  let finishOrder: string[] = [];
  let firstFinishTime: number | null = null;
  let finishedElapsedMs = 0;
  let emitted2 = false;
  let emitted1 = false;
  let emitted0 = false;

  function progressValueFor(id: string, progress: Readonly<Record<string, Progress>> | undefined): number {
    if (!progress) return 0;
    const e = progress[id];
    if (!e) return 0;
    const v = (e as Progress).progress;
    if (typeof v !== 'number' || !Number.isFinite(v)) return 0;
    return v;
  }

  function refreshOrder(progress?: Readonly<Record<string, Progress>>): void {
    const finishedSet = new Set<string>(finishOrder);
    const finishedPart = finishOrder.map((id, idx) => ({ id, position: idx + 1 }));
    const unfinished = cfgRacers.filter((id) => !finishedSet.has(id));
    const idxMap = new Map<string, number>();
    cfgRacers.forEach((id, i) => {
      if (!idxMap.has(id)) idxMap.set(id, i);
    });
    unfinished.sort((a, b) => {
      const pa = progressValueFor(a, progress);
      const pb = progressValueFor(b, progress);
      if (pb !== pa) return pb - pa;
      return (idxMap.get(a) ?? 0) - (idxMap.get(b) ?? 0);
    });
    const offset = finishedPart.length;
    const unfinishedPart = unfinished.map((id, i) => ({ id, position: offset + i + 1 }));
    state.order = [...finishedPart, ...unfinishedPart];
  }

  function computeCountdownLights(): number {
    if (countdownMs <= 0) return 0;
    const per = countdownMs / 3;
    const v = Math.ceil(state.countdownLeftMs / per);
    return clamp(v, 0, 3);
  }

  function buildResults(): RaceResult[] {
    const res: RaceResult[] = [];
    for (let i = 0; i < finishOrder.length; i++) {
      const id = finishOrder[i]!;
      const tm = state.finishTimes[id]!;
      res.push({ id, position: i + 1, timeMs: tm });
    }
    const finishedSet = new Set<string>(finishOrder);
    let pos = finishOrder.length + 1;
    for (const id of cfgRacers) {
      if (!finishedSet.has(id)) {
        res.push({ id, position: pos++, dnf: true });
      }
    }
    return res;
  }

  function resetToCountdown(): void {
    state.phase = 'countdown';
    state.countdownLeftMs = countdownMs;
    state.raceTimeMs = 0;
    state.lights = 3;
    state.finishTimes = {};
    state.dnf = [];
    finishOrder = [];
    firstFinishTime = null;
    finishedElapsedMs = 0;
    emitted2 = false;
    emitted1 = false;
    emitted0 = false;
    state.order = cfgRacers.map((id, i) => ({ id, position: i + 1 }));
  }

  const director: RaceDirector = {
    get state(): DirectorState {
      return state;
    },
    start(): DirectorEvent[] {
      if (state.phase !== 'lobby' && state.phase !== 'results') return [];
      resetToCountdown();
      return [
        { type: 'phase', phase: 'countdown' },
        { type: 'countdown', value: 3 },
      ];
    },
    update(dtMs: number, progress: Readonly<Record<string, Progress>>): DirectorEvent[] {
      if (typeof dtMs !== 'number' || !Number.isFinite(dtMs) || dtMs < 0) return [];
      if (state.phase === 'lobby' || state.phase === 'results') return [];

      if (state.phase === 'countdown') {
        const events: DirectorEvent[] = [];
        const prevLeft = state.countdownLeftMs;
        const newLeft = prevLeft - dtMs;
        const t2 = (2 * countdownMs) / 3;
        const t1 = (1 * countdownMs) / 3;

        if (!emitted2 && newLeft <= t2) {
          events.push({ type: 'countdown', value: 2 });
          emitted2 = true;
        }
        if (!emitted1 && newLeft <= t1) {
          events.push({ type: 'countdown', value: 1 });
          emitted1 = true;
        }
        if (newLeft <= 0) {
          if (!emitted0) {
            events.push({ type: 'countdown', value: 0 });
            emitted0 = true;
          }
          const leftover = dtMs - prevLeft >= 0 ? dtMs - prevLeft : 0;
          state.countdownLeftMs = 0;
          state.lights = 0;
          state.phase = 'racing';
          state.raceTimeMs = leftover;
          events.push({ type: 'phase', phase: 'racing' });
          // continue into racing logic with the same progress, using raceTimeMs already set
          const racingEvents = processRacing(progress, false);
          for (const e of racingEvents) events.push(e);
          return events;
        }

        state.countdownLeftMs = newLeft;
        state.lights = computeCountdownLights();
        refreshOrder(progress);
        return events;
      }

      if (state.phase === 'racing') {
        state.raceTimeMs += dtMs;
        const ev = processRacing(progress, true);
        return ev;
      }

      // finished
      finishedElapsedMs += dtMs;
      refreshOrder(progress);
      if (finishedElapsedMs >= finishedHoldMs) {
        state.phase = 'results';
        const results = buildResults();
        return [
          { type: 'phase', phase: 'results' },
          { type: 'results', results },
        ];
      }
      return [];
    },
    abort(): DirectorEvent[] {
      if (state.phase !== 'countdown' && state.phase !== 'racing') return [];
      const events: DirectorEvent[] = [];
      const finishedSet = new Set<string>(finishOrder);
      for (const id of cfgRacers) {
        if (!finishedSet.has(id)) {
          state.dnf.push(id);
          events.push({ type: 'dnf', id });
        }
      }
      // ensure dnf order follows cfg order (it does by construction)
      state.phase = 'results';
      state.lights = 0;
      state.countdownLeftMs = 0;
      refreshOrder(undefined);
      // rebuild order to reflect final? refreshOrder with undefined gives finished first then dnf by cfg order
      // which matches results dnf order
      events.push({ type: 'phase', phase: 'results' });
      events.push({ type: 'results', results: buildResults() });
      return events;
    },
    snapshot(): string {
      const snap: SnapshotShape = {
        v: 1,
        config: {
          racers: [...cfgRacers],
          laps,
          countdownMs,
          finishGraceMs,
          maxRaceMs,
          finishedHoldMs,
        },
        state: {
          phase: state.phase,
          countdownLeftMs: state.countdownLeftMs,
          raceTimeMs: state.raceTimeMs,
          lights: state.lights,
          order: state.order.map((o) => ({ id: o.id, position: o.position })),
          finishTimes: { ...state.finishTimes },
          dnf: [...state.dnf],
        },
        internals: {
          finishOrder: [...finishOrder],
          firstFinishTime,
          finishedElapsedMs,
          emitted2,
          emitted1,
          emitted0,
        },
      };
      return JSON.stringify(snap);
    },
    restore(json: string): void {
      let parsed: unknown;
      try {
        parsed = JSON.parse(json);
      } catch {
        throw new Error('restore: invalid JSON string');
      }
      const shape = parsed as Partial<SnapshotShape>;
      if (
        typeof shape !== 'object' ||
        shape === null ||
        (shape as { v?: unknown }).v !== 1 ||
        typeof (shape as { config?: unknown }).config !== 'object' ||
        typeof (shape as { state?: unknown }).state !== 'object' ||
        typeof (shape as { internals?: unknown }).internals !== 'object' ||
        (shape as { config?: unknown }).config === null ||
        (shape as { state?: unknown }).state === null ||
        (shape as { internals?: unknown }).internals === null
      ) {
        throw new Error('restore: invalid snapshot shape');
      }
      const c = (shape as SnapshotShape).config;
      const s = (shape as SnapshotShape).state;
      const it = (shape as SnapshotShape).internals;
      // validate config
      if (
        !Array.isArray(c.racers) ||
        !c.racers.every((x) => typeof x === 'string') ||
        typeof c.laps !== 'number' ||
        !Number.isFinite(c.laps) ||
        typeof c.countdownMs !== 'number' ||
        !Number.isFinite(c.countdownMs) ||
        typeof c.finishGraceMs !== 'number' ||
        !Number.isFinite(c.finishGraceMs) ||
        typeof c.maxRaceMs !== 'number' ||
        !Number.isFinite(c.maxRaceMs) ||
        typeof c.finishedHoldMs !== 'number' ||
        !Number.isFinite(c.finishedHoldMs)
      ) {
        throw new Error('restore: invalid snapshot shape (bad config)');
      }
      if (
        !isValidPhase(s.phase) ||
        typeof s.countdownLeftMs !== 'number' ||
        !Number.isFinite(s.countdownLeftMs) ||
        typeof s.raceTimeMs !== 'number' ||
        !Number.isFinite(s.raceTimeMs) ||
        typeof s.lights !== 'number' ||
        !Number.isFinite(s.lights) ||
        !Array.isArray(s.order) ||
        !s.order.every(
          (o) =>
            typeof o === 'object' &&
            o !== null &&
            typeof (o as { id?: unknown }).id === 'string' &&
            typeof (o as { position?: unknown }).position === 'number'
        ) ||
        typeof s.finishTimes !== 'object' ||
        s.finishTimes === null ||
        Array.isArray(s.finishTimes) ||
        !Object.values(s.finishTimes as Record<string, unknown>).every((v) => typeof v === 'number' && Number.isFinite(v)) ||
        !Array.isArray(s.dnf) ||
        !s.dnf.every((x) => typeof x === 'string')
      ) {
        throw new Error('restore: invalid snapshot shape (bad state)');
      }
      if (
        !Array.isArray(it.finishOrder) ||
        !it.finishOrder.every((x) => typeof x === 'string') ||
        !(it.firstFinishTime === null || (typeof it.firstFinishTime === 'number' && Number.isFinite(it.firstFinishTime))) ||
        typeof it.finishedElapsedMs !== 'number' ||
        !Number.isFinite(it.finishedElapsedMs) ||
        typeof it.emitted2 !== 'boolean' ||
        typeof it.emitted1 !== 'boolean' ||
        typeof it.emitted0 !== 'boolean'
      ) {
        throw new Error('restore: invalid snapshot shape (bad internals)');
      }

      cfgRacers = [...c.racers];
      laps = c.laps;
      countdownMs = c.countdownMs;
      finishGraceMs = c.finishGraceMs;
      maxRaceMs = c.maxRaceMs;
      finishedHoldMs = c.finishedHoldMs;

      state.phase = s.phase;
      state.countdownLeftMs = s.countdownLeftMs;
      state.raceTimeMs = s.raceTimeMs;
      state.lights = s.lights;
      state.order = s.order.map((o) => ({ id: o.id, position: o.position }));
      state.finishTimes = { ...s.finishTimes };
      state.dnf = [...s.dnf];

      finishOrder = [...it.finishOrder];
      firstFinishTime = it.firstFinishTime;
      finishedElapsedMs = it.finishedElapsedMs;
      emitted2 = it.emitted2;
      emitted1 = it.emitted1;
      emitted0 = it.emitted0;
    },
  };

  function processRacing(
    progress: Readonly<Record<string, Progress>>,
    _addedDt: boolean
  ): DirectorEvent[] {
    void _addedDt;
    const events: DirectorEvent[] = [];
    // collect newly finished
    const finishedSet = new Set<string>(finishOrder);
    const candidates: { id: string; prog: number; idx: number }[] = [];
    cfgRacers.forEach((id, idx) => {
      if (finishedSet.has(id)) return;
      const entry = (progress as Readonly<Record<string, Progress>>)[id];
      if (entry && (entry as Progress).finished === true) {
        let pv = 0;
        const raw = (entry as Progress).progress;
        if (typeof raw === 'number' && Number.isFinite(raw)) pv = raw;
        candidates.push({ id, prog: pv, idx });
      }
    });
    candidates.sort((a, b) => {
      if (b.prog !== a.prog) return b.prog - a.prog;
      return a.idx - b.idx;
    });
    for (const cand of candidates) {
      const position = finishOrder.length + 1;
      finishOrder.push(cand.id);
      state.finishTimes[cand.id] = state.raceTimeMs;
      if (firstFinishTime === null) firstFinishTime = state.raceTimeMs;
      events.push({ type: 'finish', id: cand.id, position, timeMs: state.raceTimeMs });
    }

    // check DNF trigger
    let shouldDnf = false;
    if (finishOrder.length > 0 && firstFinishTime !== null) {
      if (state.raceTimeMs >= firstFinishTime + finishGraceMs) shouldDnf = true;
    }
    if (state.raceTimeMs >= maxRaceMs) shouldDnf = true;

    if (shouldDnf) {
      const done = new Set<string>(finishOrder);
      // also avoid double-adding already dnf (should be empty at this point, but guard)
      const alreadyDnf = new Set<string>(state.dnf);
      for (const id of cfgRacers) {
        if (!done.has(id) && !alreadyDnf.has(id)) {
          state.dnf.push(id);
          events.push({ type: 'dnf', id });
        }
      }
    }

    refreshOrder(progress);

    const totalDone = finishOrder.length + state.dnf.length;
    if (totalDone >= cfgRacers.length) {
      // all resolved
      if (state.phase !== 'finished') {
        state.phase = 'finished';
        finishedElapsedMs = 0;
        events.push({ type: 'phase', phase: 'finished' });
      }
    }
    return events;
  }

  return director;
}
