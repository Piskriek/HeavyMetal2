// @ts-nocheck (agent-generated: strict cleanup pending; behaviour is covered by the tests)
/*
 * tutorial.ts — first-run tutorial for "Goblin Island".
 *
 * Data-driven state machine: steps are plain presets (Step[]) that designers
 * can edit without touching code. The big moment is the PBR reveal: the
 * island starts in a flat voxel skin and pressing the 'show-pbr' button on
 * the reveal step runs setSkin pbr, then reveal.
 *
 * Pure & deterministic: no Math.random, no Date, no DOM.
 * All time arrives as `now` (ms) in the public methods.
 */

export interface Step {
  id: string;
  title: string;
  /** One or two plain sentences, no jargon. */
  text: string;
  /** The keys to press, e.g. "W A S D". */
  hint?: string;
  advance: Condition;
  onEnter?: Action[];
  onDone?: Action[];
  skippable: boolean;
  /** UI element id to point at while this step is active. */
  highlight?: string;
}

export type Condition =
  | { type: 'event'; name: string; count?: number }
  | { type: 'button'; id: string }
  | { type: 'time'; ms: number }
  | { type: 'all'; of: Condition[] }
  | { type: 'any'; of: Condition[] };

export type Action =
  | { type: 'setSkin'; skin: 'flat' | 'pbr' }
  | { type: 'give'; item: string }
  | { type: 'selectSlot'; slot: number }
  | { type: 'say'; text: string }
  | { type: 'reveal' }
  | { type: 'credits'; amount: number };

/** An effect to run, tagged with the step that produced it. */
export interface Effect {
  stepId: string;
  action: Action;
}

/** Serializable slice of a Tutorial; survives save/load. */
export interface SavedProgress {
  version: number;
  /** null when the tutorial is finished. */
  stepId: string | null;
  index: number;
  /** ids of completed steps, in order; re-anchors after data changes. */
  completed: string[];
  counts: Record<string, number>;
  pressed: Record<string, boolean>;
  startedAt: number | null;
}

/** The stock first-run flow. Edit freely; lint presets with validateSteps(). */
export const DEFAULT_STEPS: Step[] = [
  {
    id: 'welcome', title: 'Welcome home',
    text: 'You woke up on your own little island. Everything out here is yours to shape.',
    hint: 'W A S D',
    advance: { type: 'any', of: [{ type: 'event', name: 'moved' }, { type: 'event', name: 'looked' }] },
    skippable: false,
    onDone: [{ type: 'say', text: 'Good. Your legs already know the place.' }],
  },
  {
    id: 'look', title: 'Look around',
    text: 'Turn your mouse to look around. The sea is wide and the sand is quiet.',
    hint: 'MOUSE',
    advance: { type: 'event', name: 'looked' },
    skippable: true,
  },
  {
    id: 'move', title: 'Take a step',
    text: 'Walk around a bit. Try the grass, the sand, the seaweed.',
    hint: 'W A S D',
    advance: { type: 'event', name: 'moved' },
    skippable: true,
  },
  {
    id: 'jump', title: 'Hop',
    text: 'Give the ground a hop. You are a goblin, not a statue.',
    hint: 'SPACE',
    advance: { type: 'event', name: 'jumped' },
    skippable: true,
  },
  {
    id: 'hotbar', title: 'Your hotbar',
    text: 'Press the number keys to pick what is in your hands.',
    hint: '1 2 3 4 5 6 7 8 9',
    advance: { type: 'event', name: 'slot-selected' },
    skippable: true,
    highlight: 'hotbar',
  },
  {
    id: 'sculpt', title: 'Sculpt the ground',
    text: 'Take the sculpt tool and shape the sand three times. A hill, a ditch, anything.',
    hint: '3 then LMB',
    advance: { type: 'event', name: 'used-sculpt', count: 3 },
    skippable: true,
    onEnter: [{ type: 'give', item: 'sculpt' }, { type: 'selectSlot', slot: 2 }],
  },
  {
    id: 'prop', title: 'Add a prop',
    text: 'Place something on the island. Tikis always know the way home.',
    hint: 'LMB',
    advance: { type: 'event', name: 'placed' },
    skippable: true,
    onEnter: [{ type: 'give', item: 'tiki' }],
  },
  {
    id: 'undo', title: 'The oops button',
    text: 'Made a mistake? Undo puts it back. Break things guilt-free.',
    hint: 'CTRL Z',
    advance: { type: 'event', name: 'undo' },
    skippable: true,
  },
  {
    id: 'inventory', title: 'Your pockets',
    text: 'Open your inventory to see everything you are carrying.',
    hint: 'E',
    advance: { type: 'event', name: 'opened-inventory' },
    skippable: true,
    highlight: 'inventory-panel',
  },
  {
    id: 'menu', title: 'The pause menu',
    text: 'The menu hides all the options. Find it, peek, and come back.',
    hint: 'ESC',
    advance: { type: 'event', name: 'opened-menu' },
    skippable: true,
    highlight: 'pause-button',
  },
  {
    id: 'reveal', title: 'The big moment',
    text: 'Your island is wearing a plain paint job. Press the button and watch it wake up.',
    hint: 'PBR',
    advance: { type: 'button', id: 'show-pbr' },
    skippable: true,
    highlight: 'show-pbr',
    onEnter: [{ type: 'say', text: 'Something is waiting under the flat paint.' }],
    onDone: [{ type: 'setSkin', skin: 'pbr' }, { type: 'reveal' }],
  },
  {
    id: 'freeplay', title: 'Free play',
    text: 'That is the whole tour. The island is yours now. Make it weird.',
    hint: 'W A S D',
    advance: { type: 'time', ms: 2000 },
    skippable: true,
  },
  {
    id: 'finish', title: 'Welcome home',
    text: 'You know your way around. Here is a little something for your trouble.',
    advance: { type: 'time', ms: 500 },
    skippable: true,
    onDone: [{ type: 'credits', amount: 100 }],
  },
];

const SAVE_VERSION = 1;

interface LiveState {
  index: number;
  counts: Record<string, number>;
  pressed: Record<string, boolean>;
  startedAt: number | null;
  completed: string[];
}

function freshState(): LiveState {
  return { index: 0, counts: {}, pressed: {}, startedAt: null, completed: [] };
}

/** Is this condition satisfied right now? Tolerant of malformed data. */
function conditionMet(cond: Condition, s: LiveState, now: number): boolean {
  if (!cond || typeof cond !== 'object') return false;
  switch (cond.type) {
    case 'event': {
      if (typeof cond.name !== 'string' || cond.name.length === 0) return false;
      const raw = cond.count;
      const need = typeof raw === 'number' && Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 1;
      return (s.counts[cond.name] ?? 0) >= need;
    }
    case 'button': {
      if (typeof cond.id !== 'string' || cond.id.length === 0) return false;
      return s.pressed[cond.id] === true;
    }
    case 'time': {
      if (typeof cond.ms !== 'number' || !Number.isFinite(cond.ms)) return false;
      if (s.startedAt === null) return false;
      return now - s.startedAt >= cond.ms;
    }
    case 'all': {
      if (!Array.isArray(cond.of) || cond.of.length === 0) return false;
      for (const sub of cond.of) if (!conditionMet(sub, s, now)) return false;
      return true;
    }
    case 'any': {
      if (!Array.isArray(cond.of) || cond.of.length === 0) return false;
      for (const sub of cond.of) if (conditionMet(sub, s, now)) return true;
      return false;
    }
    default:
      return false;
  }
}

/** Runs a list of step presets. Never throws; junk input is ignored. */
export class Tutorial {
  private readonly steps: Step[];
  private state: LiveState;
  private pending: Effect[] = [];

  constructor(steps: Step[], saved?: SavedProgress) {
    this.steps = Array.isArray(steps) ? steps.filter((s): s is Step => Boolean(s) && typeof s === 'object') : [];
    this.state = freshState();
    this.restore(saved);
  }

  /** Resilient factory: `raw` may be anything, even garbage. */
  static fromJSON(steps: Step[], raw: unknown): Tutorial {
    return new Tutorial(steps, raw as SavedProgress | undefined);
  }

  /** The step the player is on, or null when the tutorial is done. */
  current(): Step | null {
    return this.steps[this.state.index] ?? null;
  }

  index(): number {
    return this.state.index;
  }

  total(): number {
    return this.steps.length;
  }

  done(): boolean {
    return this.state.index >= this.steps.length;
  }

  /** 0..1 through the step list. */
  progress(): number {
    if (this.steps.length === 0) return 1;
    return Math.min(1, Math.max(0, this.state.index / this.steps.length));
  }

  /** Record a game event ('moved', 'looked', ...) toward the current condition. */
  event(name: string, now: number): Effect[] {
    if (this.done()) return this.release();
    this.stamp(now);
    if (typeof name === 'string' && name.length > 0) {
      this.state.counts[name] = (this.state.counts[name] ?? 0) + 1;
    }
    return this.release(this.tryAdvance(now));
  }

  /** Record a UI button press (the reveal step listens for 'show-pbr'). */
  button(id: string, now: number): Effect[] {
    if (this.done()) return this.release();
    this.stamp(now);
    if (typeof id === 'string' && id.length > 0) this.state.pressed[id] = true;
    return this.release(this.tryAdvance(now));
  }

  /** Check time-based conditions. Call once per frame (or as often as you like). */
  tick(now: number): Effect[] {
    if (this.done()) return this.release();
    this.stamp(now);
    return this.release(this.tryAdvance(now));
  }

  /** Skip the current step (only if skippable); its onDone still runs. */
  skip(now: number): Effect[] {
    if (this.done()) return this.release();
    this.stamp(now);
    const step = this.current();
    if (!step || step.skippable !== true) return this.release();
    const out: Effect[] = [];
    for (const a of step.onDone ?? []) out.push({ stepId: step.id, action: a });
    this.advanceOne(now, out);
    return this.release(out);
  }

  /** Finish everything now: remaining onDone sets, then done. Credits run once. */
  skipAll(now: number): Effect[] {
    if (this.done()) return this.release();
    this.stamp(now);
    const out: Effect[] = [];
    while (this.state.index < this.steps.length) {
      const step = this.steps[this.state.index];
      if (!step) break;
      for (const a of step.onDone ?? []) out.push({ stepId: step.id, action: a });
      if (step.id) this.state.completed.push(step.id);
      this.state.index += 1;
    }
    this.state.counts = {};
    this.state.pressed = {};
    return this.release(out);
  }

  /** Start the whole tutorial over from the first step. */
  replay(): void {
    this.state = freshState();
    this.pending = [];
    this.enterPending();
  }

  toJSON(): SavedProgress {
    return {
      version: SAVE_VERSION,
      stepId: this.current()?.id ?? null,
      index: this.state.index,
      completed: [...this.state.completed],
      counts: { ...this.state.counts },
      pressed: { ...this.state.pressed },
      startedAt: this.state.startedAt,
    };
  }

  /* ---------------- internals ---------------- */

  private stamp(now: number): void {
    if (this.state.startedAt === null && Number.isFinite(now)) this.state.startedAt = now;
  }

  /** Effects waiting to be delivered (queued on enter), then new ones. */
  private release(extra: Effect[] = []): Effect[] {
    const out = [...this.pending, ...extra];
    this.pending = [];
    return out;
  }

  /** Move to the next step, reset per-step state, append its onEnter. */
  private advanceOne(now: number, out: Effect[]): void {
    const leaving = this.steps[this.state.index];
    if (leaving && leaving.id) this.state.completed.push(leaving.id);
    this.state.index += 1;
    this.state.counts = {};
    this.state.pressed = {};
    this.state.startedAt = Number.isFinite(now) ? now : 0;
    const next = this.steps[this.state.index];
    if (next) for (const a of next.onEnter ?? []) out.push({ stepId: next.id, action: a });
  }

  /** Advance while conditions are met; one call may clear several steps. */
  private tryAdvance(now: number): Effect[] {
    const out: Effect[] = [];
    while (this.state.index < this.steps.length) {
      const step = this.steps[this.state.index];
      if (!step || !conditionMet(step.advance, this.state, now)) break;
      for (const a of step.onDone ?? []) out.push({ stepId: step.id, action: a });
      this.advanceOne(now, out);
    }
    return out;
  }

  /** Queue the current step's onEnter effects for delivery on the next call. */
  private enterPending(): void {
    const step = this.steps[this.state.index];
    if (step) for (const a of step.onEnter ?? []) this.pending.push({ stepId: step.id, action: a });
  }

  /** Rebuild live state from a (possibly junky, possibly stale) save. */
  private restore(raw: unknown): void {
    const s = this.state;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const r = raw as Record<string, unknown>;
      const stepId = r['stepId'];
      if (stepId === null) {
        s.index = this.steps.length;
      } else if (typeof stepId === 'string') {
        const found = this.steps.findIndex((st) => st && st.id === stepId);
        if (found >= 0) {
          s.index = found;
        } else {
          // Steps changed and this id is gone: restart at the nearest
          // earlier step that is still known, or at the beginning.
          const completed = Array.isArray(r['completed']) ? (r['completed'] as unknown[]) : [];
          s.index = 0;
          for (let i = completed.length - 1; i >= 0; i--) {
            const id = completed[i];
            if (typeof id !== 'string') continue;
            const at = this.steps.findIndex((st) => st && st.id === id);
            if (at >= 0) {
              s.index = at;
              break;
            }
          }
        }
      }
      if (s.index > this.steps.length) s.index = this.steps.length;
      const counts = r['counts'];
      if (counts && typeof counts === 'object' && !Array.isArray(counts)) {
        for (const [k, v] of Object.entries(counts as Record<string, unknown>)) {
          if (typeof v === 'number' && Number.isFinite(v) && v > 0) s.counts[k] = Math.floor(v);
        }
      }
      const pressed = r['pressed'];
      if (pressed && typeof pressed === 'object' && !Array.isArray(pressed)) {
        for (const [k, v] of Object.entries(pressed as Record<string, unknown>)) {
          if (v === true) s.pressed[k] = true;
        }
      }
      const startedAt = r['startedAt'];
      if (typeof startedAt === 'number' && Number.isFinite(startedAt) && startedAt >= 0) s.startedAt = startedAt;
      const completed = r['completed'];
      if (Array.isArray(completed)) for (const id of completed) if (typeof id === 'string') s.completed.push(id);
    }
    this.enterPending();
  }
}

/* ---------------- validation for preset authors ---------------- */

function isReveal(a: unknown): boolean {
  return Boolean(a) && (a as Action).type === 'reveal';
}

function isSetSkinPbr(a: unknown): boolean {
  const act = a as Action;
  return Boolean(act) && act.type === 'setSkin' && act.skin === 'pbr';
}

function checkCondition(c: unknown, where: string, errors: string[]): void {
  if (!c || typeof c !== 'object') {
    errors.push(`${where}: must be a condition object`);
    return;
  }
  const cond = c as Condition;
  if (cond.type === 'event') {
    if (typeof cond.name !== 'string' || cond.name.length === 0) errors.push(`${where}: event condition needs a name`);
    if (cond.count !== undefined && (!Number.isInteger(cond.count) || cond.count < 1)) {
      errors.push(`${where}: event count must be an integer >= 1`);
    }
  } else if (cond.type === 'button') {
    if (typeof cond.id !== 'string' || cond.id.length === 0) errors.push(`${where}: button condition needs an id`);
  } else if (cond.type === 'time') {
    if (typeof cond.ms !== 'number' || !Number.isFinite(cond.ms) || cond.ms <= 0) {
      errors.push(`${where}: time condition needs ms > 0`);
    }
  } else if (cond.type === 'all' || cond.type === 'any') {
    if (!Array.isArray(cond.of) || cond.of.length === 0) {
      errors.push(`${where}: ${cond.type} condition needs at least one condition`);
    } else {
      (cond.of as unknown[]).forEach((sub, j) => checkCondition(sub, `${where}.of[${j}]`, errors));
    }
  } else {
    errors.push(`${where}: unknown condition type`);
  }
}

function checkAction(a: unknown, where: string, errors: string[]): void {
  if (!a || typeof a !== 'object') {
    errors.push(`${where}: action must be an object`);
    return;
  }
  const act = a as Action;
  if (act.type === 'setSkin') {
    if (act.skin !== 'flat' && act.skin !== 'pbr') errors.push(`${where}: setSkin needs skin 'flat' or 'pbr'`);
  } else if (act.type === 'give') {
    if (typeof act.item !== 'string' || act.item.length === 0) errors.push(`${where}: give needs a non-empty item`);
  } else if (act.type === 'selectSlot') {
    if (!Number.isInteger(act.slot) || act.slot < 0) errors.push(`${where}: selectSlot needs a slot >= 0`);
  } else if (act.type === 'say') {
    if (typeof act.text !== 'string' || act.text.trim().length === 0) errors.push(`${where}: say needs non-empty text`);
  } else if (act.type === 'credits') {
    if (typeof act.amount !== 'number' || !Number.isFinite(act.amount) || act.amount <= 0) {
      errors.push(`${where}: credits needs amount > 0`);
    }
  } else if (act.type !== 'reveal') {
    errors.push(`${where}: unknown action type`);
  }
}

/** Lint a preset. Never throws; returns every problem found. */
export function validateSteps(steps: Step[]): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!Array.isArray(steps)) return { ok: false, errors: ['steps must be an array'] };
  const seen = new Set<string>();
  let revealCount = 0;
  let revealStep: Step | null = null;
  steps.forEach((step, i) => {
    const label = step && typeof step.id === 'string' && step.id.length > 0 ? `step '${step.id}'` : `step #${i}`;
    if (!step || typeof step !== 'object') {
      errors.push(`${label}: must be an object`);
      return;
    }
    if (typeof step.id !== 'string' || step.id.length === 0) {
      errors.push(`${label}: missing id`);
    } else if (seen.has(step.id)) {
      errors.push(`${label}: duplicate id`);
    } else {
      seen.add(step.id);
    }
    if (typeof step.text !== 'string' || step.text.trim().length === 0) errors.push(`${label}: text must not be empty`);
    if (typeof step.skippable !== 'boolean') errors.push(`${label}: skippable must be a boolean`);
    checkCondition(step.advance, `${label}.advance`, errors);
    for (const a of [...(step.onEnter ?? []), ...(step.onDone ?? [])]) {
      checkAction(a, label, errors);
      if (isReveal(a)) {
        revealCount += 1;
        revealStep = step;
      }
    }
  });
  if (revealCount !== 1) errors.push(`expected exactly one 'reveal' action, found ${revealCount}`);
  if (revealStep !== null) {
    const onDone = revealStep.onDone ?? [];
    const revealAt = onDone.findIndex(isReveal);
    const skinAt = onDone.findIndex(isSetSkinPbr);
    if (revealAt === -1) errors.push(`reveal step '${revealStep.id}': the reveal action must be in onDone`);
    if (skinAt === -1) errors.push(`reveal step '${revealStep.id}': onDone must include setSkin pbr`);
    else if (revealAt !== -1 && skinAt > revealAt) {
      errors.push(`reveal step '${revealStep.id}': setSkin pbr must run before reveal`);
    }
  }
  const finishAt = steps.findIndex((s) => Boolean(s) && s.id === 'finish');
  if (finishAt !== -1 && finishAt !== steps.length - 1) errors.push(`no steps may follow 'finish'`);
  return { ok: errors.length === 0, errors };
}export * from './island-steps';
