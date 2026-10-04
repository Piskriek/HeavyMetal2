/**
 * Logic (MASTER_PLAN 6.4, the coders' tab): an island's rules, "when something happens, do something". Easy drops ready-made rules on things;
 * Pro changes a rule's blocks (when, do, how much); Studio shows the script a rule equals. The runner is pure: give it the rules and what is
 * where, it says what happens this frame (sounds, words, and how each thing is posed: spinning, jumping, hidden). It never writes the island:
 * the effects are for show, so a rule can never break what you built.
 */
export type LogicWhen = 'touch' | 'every' | 'night' | 'day' | 'start';
export type LogicDo = 'sound' | 'spin' | 'jump' | 'hide' | 'show' | 'say';
export const LOGIC_WHENS: readonly LogicWhen[] = ['touch', 'every', 'night', 'day', 'start'];
export const LOGIC_DOS: readonly LogicDo[] = ['sound', 'spin', 'jump', 'hide', 'show', 'say'];

export interface LogicRule {
  readonly id: string;
  readonly when: LogicWhen;
  /** Touch: how close a goblin comes (metres). */
  readonly near: number;
  /** Every: how often (seconds). */
  readonly every: number;
  readonly do: LogicDo;
  readonly sound: string;
  readonly text: string;
  /** Spin: turns; jump: metres. */
  readonly amount: number;
  /** The thing it is on (a preset id), '' for the whole island. */
  readonly thing: string;
}

/** The Logic tab's ways (its hotbar): put the palette's rule on what you point at, take rules off it, see every rule of the island. */
export const LOGIC_WAYS: readonly { readonly id: string; readonly name: string; readonly icon: string; readonly doc: string; readonly left: string; readonly right: string }[] = [
  { id: 'logic-attach', name: 'Add rule', icon: 'Zap', doc: 'Put the palette\'s rule on the thing you point at (or on the island, for rules like a welcome sign).', left: 'Add the rule', right: 'Take its rules off' },
  { id: 'logic-remove', name: 'Remove rules', icon: 'Trash2', doc: 'Take every rule off the thing you point at.', left: 'Take its rules off', right: 'Take its rules off' },
  { id: 'logic-rules', name: 'Rules', icon: 'Network', doc: 'Every rule of this island, in words; Pro changes their blocks, Studio shows the script each one equals.', left: 'Open the rules', right: 'Open the rules' },
];

/** The ready-made rules (Easy): the palette of the Logic tab. */
export const LOGIC_PRESETS: readonly { readonly id: string; readonly name: string; readonly icon: string; readonly rule: Partial<LogicRule>; readonly needsThing: boolean }[] = [
  { id: 'touch-chime', name: 'Touch: chime', icon: 'Bell', rule: { when: 'touch', do: 'sound', sound: 'item-pickup' }, needsThing: true },
  { id: 'touch-spin', name: 'Touch: spin', icon: 'RotateCcw', rule: { when: 'touch', do: 'spin', amount: 1 }, needsThing: true },
  { id: 'touch-jump', name: 'Touch: jump', icon: 'ArrowUpFromLine', rule: { when: 'touch', do: 'jump', amount: 1.5 }, needsThing: true },
  { id: 'touch-vanish', name: 'Touch: vanish', icon: 'EyeOff', rule: { when: 'touch', do: 'hide' }, needsThing: true },
  { id: 'touch-hello', name: 'Touch: say hello', icon: 'Smile', rule: { when: 'touch', do: 'say', text: 'Hello, goblin!' }, needsThing: true },
  { id: 'keep-spinning', name: 'Keep spinning', icon: 'Repeat', rule: { when: 'every', every: 2, do: 'spin', amount: 1 }, needsThing: true },
  { id: 'hop-now-and-then', name: 'Hop now and then', icon: 'Footprints', rule: { when: 'every', every: 4, do: 'jump', amount: 0.8 }, needsThing: true },
  { id: 'night-only', name: 'Only at night', icon: 'Moon', rule: { when: 'day', do: 'hide' }, needsThing: true },
  { id: 'welcome', name: 'Welcome sign', icon: 'Flag', rule: { when: 'start', do: 'say', text: 'Welcome to my island!' }, needsThing: false },
  { id: 'night-owl', name: 'Night sound', icon: 'Moon', rule: { when: 'night', do: 'sound', sound: 'ui-success' }, needsThing: false },
];

const num = (v: unknown, d: number, lo: number, hi: number): number => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
/** Anything to a legal rule (a preset's params). Never throws. */
export function normalizeRule(params: unknown, id: string): LogicRule {
  const p = params && typeof params === 'object' && !Array.isArray(params) ? (params as Record<string, unknown>) : {};
  return {
    id,
    when: LOGIC_WHENS.includes(p.when as LogicWhen) ? (p.when as LogicWhen) : 'touch',
    near: num(p.near, 1.5, 0.3, 20),
    every: num(p.every, 3, 0.2, 600),
    do: LOGIC_DOS.includes(p.do as LogicDo) ? (p.do as LogicDo) : 'sound',
    sound: typeof p.sound === 'string' && p.sound ? p.sound : 'item-pickup',
    text: typeof p.text === 'string' ? p.text.slice(0, 120) : 'Hello!',
    amount: num(p.amount, 1, 0, 20),
    thing: typeof p.thing === 'string' ? p.thing : '',
  };
}

/** A rule in words (Easy shows this; it is also the script's comment). */
export function ruleSentence(r: LogicRule, thingName = 'it'): string {
  const when = r.when === 'touch' ? `When a goblin comes within ${r.near} m of ${thingName}` : r.when === 'every' ? `Every ${r.every} s` : r.when === 'night' ? 'When night falls' : r.when === 'day' ? 'By day' : 'When the island opens';
  const what = r.do === 'sound' ? `play the sound "${r.sound}"` : r.do === 'spin' ? `${thingName} spins ${r.amount === 1 ? 'once' : `${r.amount} times`}` : r.do === 'jump' ? `${thingName} jumps ${r.amount} m` : r.do === 'hide' ? `${thingName} hides` : r.do === 'show' ? `${thingName} shows` : `say "${r.text}"`;
  return `${when}: ${what}`;
}

/** The script a rule equals (Studio). The island runs rules natively; this is the same rule as code, to read, copy and learn from. */
export function ruleScript(r: LogicRule, thingName = 'it'): string {
  const act = r.do === 'sound' ? `ctx.emit('sound', ${JSON.stringify(r.sound)});`
    : r.do === 'say' ? `ctx.emit('say', ${JSON.stringify(r.text)});`
    : `ctx.emit(${JSON.stringify(r.do)}, { thing: ${JSON.stringify(r.thing)}, amount: ${r.amount} });`;
  const head = `// ${ruleSentence(r, thingName)}\n`;
  if (r.when === 'every') return `${head}let last = 0;\nexport function update(ctx) {\n  if (ctx.tick * ctx.dt - last >= ${r.every}) {\n    last = ctx.tick * ctx.dt;\n    ${act}\n  }\n}\n`;
  if (r.when === 'start') return `${head}export function init(ctx) {\n  ${act}\n}\n`;
  const event = r.when === 'touch' ? `name === 'touch' && payload === ${JSON.stringify(r.thing)}` : `name === ${JSON.stringify(r.when === 'night' ? 'nightfall' : 'daybreak')}`;
  return `${head}export function onEvent(ctx, name, payload) {\n  if (${event}) {\n    ${act}\n  }\n}\n`;
}

export interface LogicWorld {
  /** Where your goblin is. */
  readonly player: readonly [number, number, number];
  /** Where each thing is (by preset id). */
  readonly things: ReadonlyMap<string, { readonly x: number; readonly y: number; readonly z: number }>;
  /** Hour of the day (0..24), or -1 when the look decides (counted as day). */
  readonly hour: number;
  /** Seconds since the island opened. */
  readonly now: number;
}
export type LogicEvent = { readonly kind: 'sound'; readonly id: string } | { readonly kind: 'say'; readonly text: string };
/** How a thing is posed this frame on top of where it stands. */
export interface LogicPose { readonly dy: number; readonly dyaw: number; readonly hidden: boolean }

const isNight = (hour: number): boolean => hour >= 0 && (hour >= 19 || hour < 6);

/** Runs an island's rules frame by frame. Keeps only what it must remember: who is touching what, timers, moves under way, hidden things. */
export class LogicRunner {
  private touching = new Set<string>();
  private lastEvery = new Map<string, number>();
  private started = false;
  private night: boolean | null = null;
  private moves = new Map<string, { kind: 'spin' | 'jump'; t0: number; amount: number }>();
  private hidden = new Map<string, boolean>();

  /** One frame: what happens, and the pose of every thing a rule moves or hides. */
  step(rules: readonly LogicRule[], w: LogicWorld): { events: LogicEvent[]; poses: Map<string, LogicPose> } {
    const events: LogicEvent[] = [];
    const nightNow = isNight(w.hour);
    const nightfall = this.night === false && nightNow, daybreak = this.night === true && !nightNow;
    const firstFrame = !this.started;
    const fire = (r: LogicRule): void => {
      if (r.do === 'sound') events.push({ kind: 'sound', id: r.sound });
      else if (r.do === 'say') events.push({ kind: 'say', text: r.text });
      else if (!r.thing) return;
      else if (r.do === 'spin' || r.do === 'jump') this.moves.set(r.thing, { kind: r.do, t0: w.now, amount: r.amount });
      else this.hidden.set(r.thing, r.do === 'hide');
    };
    const touchingNow = new Set<string>();
    for (const r of rules) {
      switch (r.when) {
        case 'touch': {
          const t = r.thing ? w.things.get(r.thing) : undefined;
          if (!t) break;
          const near = Math.hypot(t.x - w.player[0], t.z - w.player[2]) < r.near && Math.abs(t.y - w.player[1]) < r.near + 2;
          const key = `${r.id}`;
          if (near) { touchingNow.add(key); if (!this.touching.has(key)) fire(r); }
          break;
        }
        case 'every': {
          const last = this.lastEvery.get(r.id) ?? w.now;
          if (!this.lastEvery.has(r.id)) this.lastEvery.set(r.id, w.now);
          else if (w.now - last >= r.every) { this.lastEvery.set(r.id, w.now); fire(r); }
          break;
        }
        case 'night': if (nightfall || (firstFrame && nightNow && r.do !== 'sound')) fire(r); break;
        case 'day': if (daybreak || (firstFrame && !nightNow && r.do !== 'sound')) fire(r); break;
        case 'start': if (firstFrame) fire(r); break;
      }
    }
    // a "hide by day" thing shows again at night (and the other way round): the opposite rule is implied
    for (const r of rules) if (r.thing && (r.do === 'hide' || r.do === 'show') && (r.when === 'night' || r.when === 'day')) {
      const active = r.when === 'night' ? nightNow : !nightNow;
      this.hidden.set(r.thing, active ? r.do === 'hide' : r.do !== 'hide');
    }
    this.touching = touchingNow;
    this.started = true;
    this.night = nightNow;
    const poses = new Map<string, LogicPose>();
    for (const [thing, m] of this.moves) {
      const dur = m.kind === 'spin' ? Math.max(0.6, m.amount * 0.8) : 0.7, u = (w.now - m.t0) / dur;
      if (u >= 1) { this.moves.delete(thing); poses.set(thing, { dy: 0, dyaw: 0, hidden: this.hidden.get(thing) ?? false }); continue; }
      const e = u * u * (3 - 2 * u);
      poses.set(thing, { dy: m.kind === 'jump' ? 4 * m.amount * u * (1 - u) : 0, dyaw: m.kind === 'spin' ? 360 * m.amount * e : 0, hidden: this.hidden.get(thing) ?? false });
    }
    for (const [thing, h] of this.hidden) if (!poses.has(thing)) poses.set(thing, { dy: 0, dyaw: 0, hidden: h });
    return { events, poses };
  }
}
