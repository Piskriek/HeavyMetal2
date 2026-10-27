/**
 * @hm/cartlab — the lab's cartridges, for a terraforming game.
 *
 * The plot's pixel machines pour pixels that raise four metrics. A cartridge in a
 * machine's slot scales what it pours, per metric, by its affinity. The lab has
 * three machines for cartridges:
 *
 *  - the preset bench writes one preset onto one blank (RULES.writeSeconds of powered time);
 *  - the preset combiner mixes 2 to 4 written cartridges into a new one (RULES.combineSeconds);
 *  - the preset rack holds up to RULES.rackSize cartridges; its indexer glows for
 *    RULES.catalogueSeconds after a cartridge is added.
 *
 * All state is plain JSON data and every function is pure: it returns new data and
 * never mutates its input. No imports, no DOM, no clock, no randomness.
 */

export type Metric = 'pxd' | 'vtx' | 'lx' | 'aq';

/** Texture, shape, light and water, in that order. */
export const METRICS: readonly Metric[] = Object.freeze(['pxd', 'vtx', 'lx', 'aq'] as const);

export const RULES: {
  readonly blankCost: 12;
  readonly rackSize: 48;
  readonly writeSeconds: 20;
  readonly combineSeconds: 45;
  readonly catalogueSeconds: 2;
  readonly minInputs: 2;
  readonly maxInputs: 4;
} = Object.freeze({
  blankCost: 12,
  rackSize: 48,
  writeSeconds: 20,
  combineSeconds: 45,
  catalogueSeconds: 2,
  minInputs: 2,
  maxInputs: 4,
} as const);

export interface Preset {
  readonly id: string;
  readonly name: string;
  /** A missing metric is 1. */
  readonly affinity: Readonly<Partial<Record<Metric, number>>>;
  /** The plot stage that opens this preset for writing. */
  readonly minStage: number;
}

/**
 * Ids run 'c1', 'c2', ... in the order made. A written cartridge keeps its id and
 * takes the preset's name, kind 'preset' and preset = the preset's id. A mix gets a
 * new id, kind 'mix', preset null, the inputs' names joined with ' + ' in the order
 * given, and from = the inputs' ids. A blank: name 'Blank', preset null, from [],
 * every affinity 1.
 */
/**
 * A Shape Press part written onto a blank (plans 38 and 39, TICKET-32): a part generator with its slider values, a
 * material per slot, and the one-click operators applied on top. The beam's Apply puts it onto a placed part. Kept
 * structural here (no imports): @hm/partgen and @hm/meshops read it.
 */
export interface PartSpec {
  readonly name: string;
  readonly gen: string;
  readonly params: Readonly<Record<string, number>>;
  readonly slotMaterials: Readonly<Record<string, string>>;
  readonly ops: readonly { readonly op: string; readonly params: Readonly<Record<string, number>> }[];
}

/**
 * A Water Maker species written onto a blank (plan 39 section 6, Aq): a tree species and its treegen slider values. The
 * beam's Apply regrows a tree with it. Structural here: @hm/treegen reads it.
 */
export interface SpeciesSpec {
  readonly name: string;
  readonly species: string;
  readonly params: Readonly<Record<string, number>>;
}

export type LightPattern = 'steady' | 'pulse' | 'blink' | 'flicker';
export const LIGHT_PATTERNS: readonly LightPattern[] = Object.freeze(['steady', 'pulse', 'blink', 'flicker'] as const);

/**
 * A Light Projector preset written onto a blank (plan 39 section 6, Lx): a colour temperature in kelvin, or a signal
 * colour instead, an intensity and a pattern. The beam's Apply sets a lamp with it.
 */
export interface LightSpec {
  readonly name: string;
  readonly kelvin: number;
  /** A signal colour ('#rrggbb') in place of the temperature, or null. */
  readonly colour: string | null;
  /** 0 to 3: how bright the lamp glows. */
  readonly intensity: number;
  readonly pattern: LightPattern;
}

/**
 * A Texture Mill material written onto a blank (plan 41): a layered material by its name, a shelf preset's
 * `mat:<id>` or a player's own `matc:<code>` (@hm/matstack reads it). The beam's Apply puts it on the part it is fired
 * at. `name` is what people read.
 */
export interface MaterialPrintSpec {
  readonly name: string;
  readonly ref: string;
}

/**
 * A Soul Harness written onto a blank (plan 47): a shelf preset's `harness:<id>` or a player's
 * own tuned `harnessc:<crc>:<code>` (./harness-cartridge reads it). The rifle's port glows
 * Ray-7 violet; entering a vehicle with it loaded binds the vessel soul. `name` is what people read.
 */
export interface HarnessPrintSpec {
  readonly name: string;
  readonly ref: string;
}

export const SPRITE_DITHERS = ['none', 'bayer2', 'bayer4'] as const;
export type SpriteDither = (typeof SPRITE_DITHERS)[number];

/**
 * A sprite sheet written onto a blank (plan 43, step 4): the turntable of one kit preset, baked at a Fidelity Stage into that
 * stage's palette and dither. The Bench previews it as an eight-frame billboard; the beam's Apply puts it on a machine, which
 * hangs it over the machine as a billboard card. Structural here: @hm/shareware reads it.
 */
export interface SpritePrintSpec {
  readonly name: string;
  /** The kit preset to turn: a `@hm/kitspec` preset id ('drill', 'press', 'gate'). */
  readonly kit: string;
  /** The Fidelity Stage whose palette and dither the sheet uses. */
  readonly stage: number;
  /** Pixels a frame. */
  readonly size: number;
  /** Frames around the turntable (1 to 16; 8 is the shareware card). */
  readonly angles: number;
  readonly dither: SpriteDither;
  readonly elevationDeg: number;
}

/** One oscillator in a sound print: the atom of a synth patch. */
export interface SoundAtomSpec {
  readonly wave: string;
  readonly freqHz: number;
  readonly gain: number;
  readonly attackMs: number;
  readonly decayMs: number;
  readonly delayMs?: number;
  readonly detuneCents?: number;
}

/** A patch: atoms summed, with child patches summed under it (the recursion a stem is built from). */
export interface SoundPatchSpec {
  readonly name: string;
  readonly gain?: number;
  readonly atoms?: readonly SoundAtomSpec[];
  readonly children?: readonly SoundPatchSpec[];
}

export const SOUND_ROLES = ['machine', 'rifle', 'gate', 'music'] as const;
export type SoundRole = (typeof SOUND_ROLES)[number];

/**
 * A sound written onto a blank (plan 43, step 4): a recursive synth patch and the stage that plays it, so a `sndc:` cartridge
 * sounds like its era's hardware. The Bench previews it; the beam's Apply gives its hum to the machine it is fired at.
 * Structural here: @hm/soundlab reads it.
 */
export interface SoundPrintSpec {
  readonly name: string;
  readonly role: SoundRole;
  readonly stage: number;
  readonly gain: number;
  readonly patch: SoundPatchSpec;
  readonly pan?: number;
  readonly loopSeconds?: number;
}

/** What the bench prints onto a blank for the beam rifle: a part, a species, a light, a material, a sprite, a sound or a harness. */
export type Print =
  | { readonly part: PartSpec }
  | { readonly species: SpeciesSpec }
  | { readonly light: LightSpec }
  | { readonly material: MaterialPrintSpec }
  | { readonly sprite: SpritePrintSpec }
  | { readonly sound: SoundPrintSpec }
  | { readonly harness: HarnessPrintSpec };
export type PrintKind = 'part' | 'species' | 'light' | 'material' | 'sprite' | 'sound' | 'harness';

export interface Cartridge {
  readonly id: string;
  readonly name: string;
  readonly kind: 'blank' | 'preset' | 'mix' | PrintKind;
  readonly preset: string | null;
  readonly from: readonly string[];
  readonly affinity: Readonly<Record<Metric, number>>;
  /** null: in the rack. A number: in that plot machine. */
  readonly slot: number | null;
  /** Kind 'part' only: the part it carries. */
  readonly part?: PartSpec;
  /** Kind 'species' only: the species it carries. */
  readonly species?: SpeciesSpec;
  /** Kind 'light' only: the light it carries. */
  readonly light?: LightSpec;
  /** Kind 'material' only: the material it carries. */
  readonly material?: MaterialPrintSpec;
  /** Kind 'sprite' only: the sprite sheet it carries. */
  readonly sprite?: SpritePrintSpec;
  /** Kind 'sound' only: the sound it carries. */
  readonly sound?: SoundPrintSpec;
  /** Kind 'harness' only: the vessel soul harness it carries (plan 47). */
  readonly harness?: HarnessPrintSpec;
}

/**
 * A job on the bench (one blank and a preset id) or in the combiner (2 to 4
 * cartridges, preset null). done and needs are seconds of powered time.
 *
 * While a power cut has it paused, a job also carries `stalled: true`. The rule
 * "one 'stalled' event per cut" needs that one bit of memory, and LabState has
 * nowhere else to keep it. The key is dropped the moment the job runs again, and
 * loadLab accepts and keeps it.
 */
export interface Job {
  readonly inputs: readonly string[];
  readonly preset: string | null;
  readonly done: number;
  readonly needs: number;
  /** A bench job printing a part, a species, a light, a material, a sprite, a sound or a harness instead of writing a preset. */
  readonly part?: PartSpec;
  readonly species?: SpeciesSpec;
  readonly light?: LightSpec;
  readonly material?: MaterialPrintSpec;
  readonly sprite?: SpritePrintSpec;
  readonly sound?: SoundPrintSpec;
  readonly harness?: HarnessPrintSpec;
}

export interface LabState {
  readonly v: 1;
  readonly time: number;
  readonly nextId: number;
  readonly cartridges: readonly Cartridge[];
  readonly bench: Job | null;
  readonly combiner: Job | null;
  readonly catalogueUntil: number;
}

export interface LabEnv {
  readonly presets: readonly Preset[];
  readonly stage: number;
  /** The gate: the bench and the combiner only work while it is on. */
  readonly powered: boolean;
}

export type LabEvent =
  | { readonly type: 'written'; readonly id: string }
  | { readonly type: 'combined'; readonly id: string }
  | { readonly type: 'stalled'; readonly machine: 'bench' | 'combiner' };

/** why is '' when ok, else one plain sentence for the player. */
export interface Check {
  readonly ok: boolean;
  readonly why: string;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

type Machine = 'bench' | 'combiner';

/** A combined affinity stays within these bounds. */
const MIN_AFFINITY = 0.5;
const MAX_AFFINITY = 3;

const OK: Check = Object.freeze({ ok: true, why: '' });
const no = (why: string): Check => ({ ok: false, why });
const NO_POWER = 'No power: turn the gate on.';

const orThrow = (check: Check): void => {
  if (!check.ok) throw new Error(check.why);
};

const byMetric = (f: (m: Metric) => number): Record<Metric, number> => ({
  pxd: f('pxd'),
  vtx: f('vtx'),
  lx: f('lx'),
  aq: f('aq'),
});

const find = (s: LabState, id: string): Cartridge | undefined => s.cartridges.find((c) => c.id === id);

/** The machine whose job holds the cartridge, if any. */
const jobOf = (s: LabState, id: string): Machine | null => {
  if (s.bench !== null && s.bench.inputs.includes(id)) return 'bench';
  if (s.combiner !== null && s.combiner.inputs.includes(id)) return 'combiner';
  return null;
};

const busyWhy = (c: Cartridge, where: Machine): string => {
  const who = c.kind === 'blank' ? 'That blank' : c.name;
  return where === 'bench' ? `${who} is being written on the bench.` : `${who} is being mixed in the combiner.`;
};

type PausedJob = Job & { readonly stalled: true };

const isPaused = (job: Job): boolean => 'stalled' in job && job.stalled === true;

/** The print a job or a cartridge carries (its own field, to spread), or null. */
export function printOf(x: {
  readonly part?: PartSpec;
  readonly species?: SpeciesSpec;
  readonly light?: LightSpec;
  readonly material?: MaterialPrintSpec;
  readonly sprite?: SpritePrintSpec;
  readonly sound?: SoundPrintSpec;
  readonly harness?: HarnessPrintSpec;
}): Print | null {
  if (x.part !== undefined) return { part: x.part };
  if (x.species !== undefined) return { species: x.species };
  if (x.light !== undefined) return { light: x.light };
  if (x.material !== undefined) return { material: x.material };
  if (x.sprite !== undefined) return { sprite: x.sprite };
  if (x.sound !== undefined) return { sound: x.sound };
  if (x.harness !== undefined) return { harness: x.harness };
  return null;
}
export const printKind = (p: Print): PrintKind =>
  'part' in p ? 'part' : 'species' in p ? 'species' : 'light' in p ? 'light' : 'material' in p ? 'material' : 'sprite' in p ? 'sprite' : 'sound' in p ? 'sound' : 'harness';
const printName = (p: Print): string =>
  'part' in p ? p.part.name
    : 'species' in p ? p.species.name
      : 'light' in p ? p.light.name
        : 'material' in p ? p.material.name
          : 'sprite' in p ? p.sprite.name : 'sound' in p ? p.sound.name : p.harness.name;
/** Every print cartridge goes in the beam rifle only: never the combiner, never a plot machine. */
const PRINT_KINDS: readonly PrintKind[] = Object.freeze(['part', 'species', 'light', 'material', 'sprite', 'sound', 'harness'] as const);
const forTheRifle = (c: Cartridge): boolean => (PRINT_KINDS as readonly string[]).includes(c.kind);
const RIFLE_ONLY: Readonly<Record<PrintKind, string>> = {
  part: 'A part cartridge',
  species: 'A species cartridge',
  light: 'A light cartridge',
  material: 'A material cartridge',
  sprite: 'A sprite cartridge',
  sound: 'A sound cartridge',
  harness: 'A harness cartridge',
};

const paused = (job: Job): Job => {
  const p: PausedJob = { inputs: job.inputs, preset: job.preset, done: job.done, needs: job.needs, stalled: true, ...(printOf(job) ?? {}) };
  return p;
};

/** The job after it has run: a running job is never marked stalled. */
const running = (job: Job, done: number): Job => ({ inputs: job.inputs, preset: job.preset, done, needs: job.needs, ...(printOf(job) ?? {}) });

const presetAffinity = (p: Preset): Record<Metric, number> =>
  byMetric((m) => {
    const v = p.affinity[m];
    return typeof v === 'number' && Number.isFinite(v) ? v : 1;
  });

/** Per metric: the best gain in full, every other gain at half, clamped to [0.5, 3]. */
const combineAffinity = (affinities: readonly number[]): number => {
  const gains = affinities.map((a) => a - 1).sort((x, y) => y - x);
  let gain = 0;
  gains.forEach((g, i) => {
    gain += i === 0 ? g : g / 2;
  });
  return Math.min(MAX_AFFINITY, Math.max(MIN_AFFINITY, 1 + gain));
};

// ---------------------------------------------------------------------------
// The lab
// ---------------------------------------------------------------------------

export function newLab(): LabState {
  return { v: 1, time: 0, nextId: 1, cartridges: [], bench: null, combiner: null, catalogueUntil: 0 };
}

/** Cartridges not in a plot machine. Cartridges in a lab job still sit on the rack. */
export function rackCount(s: LabState): number {
  let n = 0;
  for (const c of s.cartridges) if (c.slot === null) n += 1;
  return n;
}

export function canMakeBlank(s: LabState, ore: number): Check {
  if (!(ore >= RULES.blankCost)) return no(`Not enough ore: a blank costs ${RULES.blankCost}.`);
  if (rackCount(s) >= RULES.rackSize) return no(`The rack is full: ${RULES.rackSize} cartridges.`);
  return OK;
}

/** Makes a blank and puts it in the rack. Throws Error(why) when refused. */
export function makeBlank(s: LabState, ore: number): { readonly state: LabState; readonly oreUsed: number } {
  orThrow(canMakeBlank(s, ore));
  const blank: Cartridge = {
    id: `c${s.nextId}`,
    name: 'Blank',
    kind: 'blank',
    preset: null,
    from: [],
    affinity: byMetric(() => 1),
    slot: null,
  };
  return {
    state: {
      ...s,
      nextId: s.nextId + 1,
      cartridges: [...s.cartridges, blank],
      catalogueUntil: s.time + RULES.catalogueSeconds,
    },
    oreUsed: RULES.blankCost,
  };
}

export function canWrite(s: LabState, env: LabEnv, blank: string, preset: string): Check {
  if (!env.powered) return no(NO_POWER);
  if (s.bench !== null) return no('The bench is busy: wait for its write to finish.');
  const c = find(s, blank);
  if (c === undefined) return no('That cartridge is not in the lab.');
  if (c.kind !== 'blank') return no(`${c.name} is not a blank: presets go on blanks only.`);
  const busy = jobOf(s, c.id);
  if (busy !== null) return no(busyWhy(c, busy));
  const p = env.presets.find((x) => x.id === preset);
  if (p === undefined) return no('There is no such preset.');
  if (!(p.minStage <= env.stage)) return no(`That preset opens at stage ${p.minStage}.`);
  return OK;
}

/** Puts a blank and a preset on the bench. Throws Error(why) when refused. */
export function startWrite(s: LabState, env: LabEnv, blank: string, preset: string): LabState {
  orThrow(canWrite(s, env, blank, preset));
  return { ...s, bench: { inputs: [blank], preset, done: 0, needs: RULES.writeSeconds } };
}

/**
 * Whether the bench can print `print` (a part, a species or a light) onto `blank`. A part's cost is paid by the caller,
 * from the base's stores; a species or a light costs the blank and the bench's time, as a written preset does.
 */
export function canWritePrint(s: LabState, env: LabEnv, blank: string, print: Print): Check {
  if (!env.powered) return no(NO_POWER);
  if (s.bench !== null) return no('The bench is busy: wait for its write to finish.');
  return blankTakes(s, blank, print);
}

/** Puts a blank and a print on the bench. Throws Error(why) when refused. */
export function startPrintWrite(s: LabState, env: LabEnv, blank: string, print: Print): LabState {
  orThrow(canWritePrint(s, env, blank, print));
  return { ...s, bench: { inputs: [blank], preset: null, done: 0, needs: RULES.writeSeconds, ...print } };
}

/** Whether the bench can print `part` onto `blank` (the part's cost is paid by the caller, from the base's stores). */
export const canWritePart = (s: LabState, env: LabEnv, blank: string, part: PartSpec): Check => canWritePrint(s, env, blank, { part });
/** Puts a blank and a part on the bench. Throws Error(why) when refused. */
export const startPartWrite = (s: LabState, env: LabEnv, blank: string, part: PartSpec): LabState => startPrintWrite(s, env, blank, { part });

/** Whether a blank on the rack can take the print (not in a machine or a job; the print well formed). */
function blankTakes(s: LabState, blank: string, print: Print): Check {
  const c = find(s, blank);
  if (c === undefined) return no('That cartridge is not in the lab.');
  if (c.kind !== 'blank') return no(`${c.name} is not a blank: prints go on blanks only.`);
  if (c.slot !== null) return no('That blank sits in a machine.');
  const busy = jobOf(s, c.id);
  if (busy !== null) return no(busyWhy(c, busy));
  if (!validPrint(print)) return no(`That ${printKind(print)} is not complete.`);
  return OK;
}

/**
 * Whether the planet's Drafting Table can print `part` onto `blank` (ARGO_NOTE_34 D.1). The table draws its blank from
 * the rack through the quantum bridge and prints at once: no bench job, and the lab's power is not needed. The part's
 * cost is paid by the caller, from the base's stores.
 */
export function canPrintPart(s: LabState, blank: string, part: PartSpec): Check {
  return blankTakes(s, blank, { part });
}

/** The first blank the Drafting Table can draw: on the rack, in no machine and no job. */
export function freeBlank(s: LabState): string | null {
  for (const c of s.cartridges) if (c.kind === 'blank' && c.slot === null && jobOf(s, c.id) === null) return c.id;
  return null;
}

/** Prints `part` onto `blank` at once (the planet's Drafting Table). Throws Error(why) when refused. */
export function printPart(s: LabState, blank: string, part: PartSpec): LabState {
  orThrow(canPrintPart(s, blank, part));
  return { ...s, cartridges: s.cartridges.map((c) => (c.id === blank ? printedCartridge(c, { part }) : c)) };
}

const printedCartridge = (blank: Cartridge, print: Print): Cartridge => ({
  id: blank.id,
  name: printName(print),
  kind: printKind(print),
  preset: null,
  from: [],
  affinity: byMetric(() => 1),
  slot: blank.slot,
  ...print,
});

export function canCombine(s: LabState, env: LabEnv, ids: readonly string[]): Check {
  if (!env.powered) return no(NO_POWER);
  if (s.combiner !== null) return no('The combiner is busy: wait for its mix to finish.');
  if (ids.length < RULES.minInputs || ids.length > RULES.maxInputs) {
    return no(`The combiner takes ${RULES.minInputs} to ${RULES.maxInputs} cartridges.`);
  }
  if (new Set(ids).size !== ids.length) return no('Each cartridge can go in only once.');
  const inputs: Cartridge[] = [];
  for (const id of ids) {
    const c = find(s, id);
    if (c === undefined) return no('One of those cartridges is not in the lab.');
    inputs.push(c);
  }
  if (inputs.some((c) => c.kind === 'blank')) return no('A blank has nothing to mix: write a preset on it first.');
  const rifle = inputs.find(forTheRifle);
  if (rifle) return no(`${RIFLE_ONLY[rifle.kind as PrintKind]} goes in the beam rifle, not the combiner.`);
  for (const c of inputs) {
    if (c.slot !== null) return no(`${c.name} is in a machine: take it out first.`);
    const busy = jobOf(s, c.id);
    if (busy !== null) return no(busyWhy(c, busy));
  }
  return OK;
}

/** Loads 2 to 4 written cartridges into the combiner. Throws Error(why) when refused. */
export function startCombine(s: LabState, env: LabEnv, ids: readonly string[]): LabState {
  orThrow(canCombine(s, env, ids));
  return { ...s, combiner: { inputs: [...ids], preset: null, done: 0, needs: RULES.combineSeconds } };
}

export function canSlot(s: LabState, id: string, machine: number): Check {
  const c = find(s, id);
  if (c === undefined) return no('That cartridge is not in the lab.');
  if (c.kind === 'blank') return no('A blank does nothing: write a preset on it first.');
  if (forTheRifle(c)) return no(`${RIFLE_ONLY[c.kind as PrintKind]} goes in the beam rifle, not a machine.`);
  if (c.slot !== null) return no(`${c.name} is already in a machine: take it out first.`);
  const busy = jobOf(s, c.id);
  if (busy !== null) return no(busyWhy(c, busy));
  if (!Number.isFinite(machine)) return no('There is no such machine.');
  return OK;
}

/** Puts a written cartridge into a plot machine's slot. Throws Error(why) when refused. */
export function slotInto(s: LabState, id: string, machine: number): LabState {
  orThrow(canSlot(s, id, machine));
  const slot = machine === 0 ? 0 : machine; // -0 would not survive a JSON round trip
  return { ...s, cartridges: s.cartridges.map((c) => (c.id === id ? { ...c, slot } : c)) };
}

/**
 * Back to the rack; unchanged if it is there already (or unknown). This never
 * refuses, so a full rack can go over RULES.rackSize this way; making blanks
 * stays refused until it is back under.
 */
export function unslot(s: LabState, id: string): LabState {
  const c = find(s, id);
  if (c === undefined || c.slot === null) return s;
  return { ...s, cartridges: s.cartridges.map((x) => (x.id === id ? { ...x, slot: null } : x)) };
}

/**
 * Moves time on by dt seconds (a negative or non-finite dt counts as 0). Powered,
 * each job's done grows by dt and a job finishes once done >= needs. Unpowered,
 * nothing progresses, and each machine with a job reports one 'stalled' event when
 * it stops, then again only after it has run since.
 */
export function step(s: LabState, env: LabEnv, dt: number): { readonly state: LabState; readonly events: readonly LabEvent[] } {
  const d = Number.isFinite(dt) && dt > 0 ? dt : 0;
  const events: LabEvent[] = [];
  const now: LabState = { ...s, time: s.time + d };
  if (!env.powered) {
    const stall = (job: Job | null, machine: Machine): Job | null => {
      if (job === null || isPaused(job)) return job;
      events.push({ type: 'stalled', machine });
      return paused(job);
    };
    const bench = stall(now.bench, 'bench');
    const combiner = stall(now.combiner, 'combiner');
    return { state: { ...now, bench, combiner }, events };
  }
  return { state: runCombiner(runBench(now, env, d, events), d, events), events };
}

function runBench(s: LabState, env: LabEnv, d: number, events: LabEvent[]): LabState {
  const job = s.bench;
  if (job === null) return s;
  const done = job.done + d;
  const print = printOf(job);
  if (print !== null) {
    if (done < job.needs) return { ...s, bench: running(job, done) };
    const target = job.inputs[0];
    const blank = target === undefined ? undefined : find(s, target);
    if (blank === undefined) return { ...s, bench: null };
    events.push({ type: 'written', id: blank.id });
    const printed = printedCartridge(blank, print);
    return { ...s, bench: null, cartridges: s.cartridges.map((c) => (c.id === blank.id ? printed : c)) };
  }
  const preset = env.presets.find((p) => p.id === job.preset);
  if (done < job.needs || preset === undefined) {
    // Still writing, or the preset has gone from env.presets: the job never fails,
    // it waits at the finish line until the preset is back.
    return { ...s, bench: running(job, Math.min(done, job.needs)) };
  }
  const target = job.inputs[0];
  const blank = target === undefined ? undefined : find(s, target);
  if (blank === undefined) return { ...s, bench: null }; // nothing to write on (hand-made states only)
  events.push({ type: 'written', id: blank.id });
  const written: Cartridge = {
    id: blank.id,
    name: preset.name,
    kind: 'preset',
    preset: preset.id,
    from: [],
    affinity: presetAffinity(preset),
    slot: blank.slot,
  };
  return { ...s, bench: null, cartridges: s.cartridges.map((c) => (c.id === blank.id ? written : c)) };
}

function runCombiner(s: LabState, d: number, events: LabEvent[]): LabState {
  const job = s.combiner;
  if (job === null) return s;
  const done = job.done + d;
  if (done < job.needs) return { ...s, combiner: running(job, done) };
  const inputs: Cartridge[] = [];
  for (const id of job.inputs) {
    const c = find(s, id);
    if (c !== undefined) inputs.push(c);
  }
  if (inputs.length === 0) return { ...s, combiner: null }; // nothing to mix (hand-made states only)
  const mix: Cartridge = {
    id: `c${s.nextId}`,
    name: inputs.map((c) => c.name).join(' + '),
    kind: 'mix',
    preset: null,
    from: inputs.map((c) => c.id),
    affinity: byMetric((m) => combineAffinity(inputs.map((c) => c.affinity[m]))),
    slot: null,
  };
  events.push({ type: 'combined', id: mix.id });
  return {
    ...s,
    nextId: s.nextId + 1,
    cartridges: [...s.cartridges.filter((c) => !job.inputs.includes(c.id)), mix],
    combiner: null,
    catalogueUntil: s.time + RULES.catalogueSeconds,
  };
}

/** 0..1: how hard each lab machine works right now, for its pixels. */
export function activity(s: LabState, env: LabEnv): { readonly bench: number; readonly combiner: number; readonly rack: number } {
  const on = env.powered;
  return {
    bench: on && s.bench !== null ? 1 : 0,
    combiner: on && s.combiner !== null ? 1 : 0,
    rack: on && s.time < s.catalogueUntil ? 1 : 0,
  };
}

/** The factor a cartridge applies to a metric: 1 for an unknown id or a blank. */
export function affinityOf(s: LabState, id: string, metric: Metric): number {
  const c = find(s, id);
  if (c === undefined || c.kind === 'blank') return 1;
  const v: unknown = c.affinity[metric];
  return typeof v === 'number' ? v : 1;
}

// ---------------------------------------------------------------------------
// Saves
// ---------------------------------------------------------------------------

type Json = { readonly [key: string]: unknown };

const isRecord = (x: unknown): x is Json => typeof x === 'object' && x !== null && !Array.isArray(x);
const isList = (x: unknown): x is readonly unknown[] => Array.isArray(x);
const isNumber = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const isString = (x: unknown): x is string => typeof x === 'string';
const CARTRIDGE_ID = /^c([1-9][0-9]*)$/;

const stringList = (x: unknown): string[] | null => {
  if (!isList(x)) return null;
  const out: string[] = [];
  for (const v of x) {
    if (!isString(v)) return null;
    out.push(v);
  }
  return out;
};

const numberRecord = (x: unknown): Record<string, number> | null => {
  if (!isRecord(x)) return null;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(x)) {
    if (!isNumber(v)) return null;
    out[k] = v;
  }
  return out;
};

const stringRecord = (x: unknown): Record<string, string> | null => {
  if (!isRecord(x)) return null;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(x)) {
    if (!isString(v)) return null;
    out[k] = v;
  }
  return out;
};

/** A part spec read back from JSON, or null when any field has the wrong shape. */
function loadPart(x: unknown): PartSpec | null {
  if (!isRecord(x)) return null;
  const { name, gen, params, slotMaterials, ops } = x;
  if (!isString(name) || !isString(gen) || gen.length === 0) return null;
  const p = numberRecord(params), sm = stringRecord(slotMaterials);
  if (p === null || sm === null || !isList(ops)) return null;
  const list: { op: string; params: Record<string, number> }[] = [];
  for (const o of ops) {
    if (!isRecord(o) || !isString(o.op)) return null;
    const op = numberRecord(o.params);
    if (op === null) return null;
    list.push({ op: o.op, params: op });
  }
  return { name, gen, params: p, slotMaterials: sm, ops: list };
}

function loadSpecies(x: unknown): SpeciesSpec | null {
  if (!isRecord(x)) return null;
  const { name, species, params } = x;
  if (!isString(name) || !isString(species) || species.length === 0) return null;
  const p = numberRecord(params);
  return p === null ? null : { name, species, params: p };
}

const HEX = /^#[0-9a-f]{6}$/i;
function loadLight(x: unknown): LightSpec | null {
  if (!isRecord(x)) return null;
  const { name, kelvin, colour, intensity, pattern } = x;
  if (!isString(name) || !isNumber(kelvin) || kelvin < 1000 || kelvin > 12000) return null;
  if (colour !== null && !(isString(colour) && HEX.test(colour))) return null;
  if (!isNumber(intensity) || intensity < 0 || intensity > 3) return null;
  if (!isString(pattern) || !(LIGHT_PATTERNS as readonly string[]).includes(pattern)) return null;
  return { name, kelvin, colour, intensity, pattern: pattern as LightPattern };
}

/** A material by name: a shelf preset (`mat:`) or a player's code (`matc:`), at most 4000 characters. */
const MATERIAL_REF = /^matc?:[A-Za-z0-9_-]+$/;
function loadMaterial(x: unknown): MaterialPrintSpec | null {
  if (!isRecord(x)) return null;
  const { name, ref } = x;
  if (!isString(name) || !isString(ref) || ref.length > 4000 || !MATERIAL_REF.test(ref)) return null;
  return { name, ref };
}

/** A harness ref's shape: a shelf id or a CRC-checked compact code (./harness-cartridge decodes it fully at bind time). */
const HARNESS_REF = /^harness:[a-z0-9][a-z0-9-]{0,63}$|^harnessc:[0-9A-F]{6}:[A-Za-z0-9_-]{1,4000}$/;

/** A harness print read back: a name people read and a ref the harness codec can decode. */
function loadHarness(x: unknown): HarnessPrintSpec | null {
  if (!isRecord(x)) return null;
  const { name, ref } = x;
  if (!isString(name) || name.length === 0 || name.length > 96) return null;
  if (!isString(ref) || ref.length > 4200 || !HARNESS_REF.test(ref)) return null;
  return { name, ref };
}

const KIT_ID = /^[a-z0-9][a-z0-9-]{0,39}$/;

/** A sprite print read back: a kit id, a stage off the ladder and a frame size a billboard can hold. */
function loadSprite(x: unknown): SpritePrintSpec | null {
  if (!isRecord(x)) return null;
  const { name, kit, stage, size, angles, dither, elevationDeg } = x;
  if (!isString(name) || name.length === 0 || name.length > 96 || !isString(kit) || !KIT_ID.test(kit)) return null;
  if (!isNumber(stage) || stage < 0 || stage > 6) return null;
  if (!isNumber(size) || size < 4 || size > 128) return null;
  if (!isNumber(angles) || angles < 1 || angles > 16) return null;
  if (!isString(dither) || !(SPRITE_DITHERS as readonly string[]).includes(dither)) return null;
  if (!isNumber(elevationDeg) || elevationDeg < -80 || elevationDeg > 80) return null;
  return {
    name, kit, stage: Math.floor(stage), size: Math.round(size), angles: Math.round(angles),
    dither: dither as SpriteDither, elevationDeg,
  };
}

const isWaveName = (w: unknown): w is string => isString(w) && ['sine', 'square', 'sawtooth', 'triangle', 'noise'].includes(w);

/** A patch read back, to a depth a hand-made patch can reach and no further. */
function loadPatch(x: unknown, depth: number): SoundPatchSpec | null {
  if (!isRecord(x) || depth > 6) return null;
  const { name, gain, atoms, children } = x;
  if (!isString(name) || (gain !== undefined && !isNumber(gain))) return null;
  const atomList: SoundAtomSpec[] = [];
  if (atoms !== undefined) {
    if (!isList(atoms)) return null;
    for (const a of atoms.slice(0, 32)) {
      if (!isRecord(a) || !isWaveName(a.wave)) return null;
      const { freqHz, gain: ag, attackMs, decayMs, delayMs, detuneCents } = a;
      if (!isNumber(freqHz) || freqHz <= 0 || freqHz > 20000) return null;
      if (!isNumber(ag) || ag < 0 || ag > 2) return null;
      if (!isNumber(attackMs) || attackMs < 0 || attackMs > 5000) return null;
      if (!isNumber(decayMs) || decayMs <= 0 || decayMs > 12000) return null;
      if (delayMs !== undefined && (!isNumber(delayMs) || delayMs < 0 || delayMs > 8000)) return null;
      if (detuneCents !== undefined && (!isNumber(detuneCents) || Math.abs(detuneCents) > 4800)) return null;
      atomList.push({
        wave: a.wave, freqHz, gain: ag, attackMs, decayMs,
        ...(delayMs !== undefined ? { delayMs } : {}),
        ...(detuneCents !== undefined ? { detuneCents } : {}),
      });
    }
  }
  const childList: SoundPatchSpec[] = [];
  if (children !== undefined) {
    if (!isList(children)) return null;
    for (const c of children.slice(0, 32)) {
      const kid = loadPatch(c, depth + 1);
      if (!kid) return null;
      childList.push(kid);
    }
  }
  if (atomList.length === 0 && childList.length === 0) return null;
  return { name, ...(gain !== undefined ? { gain } : {}), ...(atomList.length > 0 ? { atoms: atomList } : {}), ...(childList.length > 0 ? { children: childList } : {}) };
}

/** A sound print read back: a playable patch, a stage off the ladder and a role the mix knows. */
function loadSound(x: unknown): SoundPrintSpec | null {
  if (!isRecord(x)) return null;
  const { name, role, stage, gain, pan, loopSeconds } = x;
  if (!isString(name) || name.length === 0 || name.length > 96) return null;
  if (!isString(role) || !(SOUND_ROLES as readonly string[]).includes(role)) return null;
  if (!isNumber(stage) || stage < 0 || stage > 6) return null;
  if (!isNumber(gain) || gain < 0 || gain > 2) return null;
  if (pan !== undefined && (!isNumber(pan) || Math.abs(pan) > 1)) return null;
  if (loopSeconds !== undefined && (!isNumber(loopSeconds) || loopSeconds <= 0 || loopSeconds > 60)) return null;
  const patch = loadPatch(x.patch, 0);
  if (!patch) return null;
  return {
    name, role: role as SoundRole, stage: Math.floor(stage), gain, patch,
    ...(pan !== undefined ? { pan } : {}),
    ...(loopSeconds !== undefined ? { loopSeconds } : {}),
  };
}

/** The print as saved, checked: 'none' when there is none, null when one is malformed or more than one is set. */
function loadPrint(x: Readonly<Record<string, unknown>>): Print | null | 'none' {
  const set = (['part', 'species', 'light', 'material', 'sprite', 'sound', 'harness'] as const).filter((k) => x[k] !== undefined);
  if (set.length === 0) return 'none';
  if (set.length > 1) return null;
  if (set[0] === 'part') {
    const p = loadPart(x.part);
    return p && { part: p };
  }
  if (set[0] === 'species') {
    const p = loadSpecies(x.species);
    return p && { species: p };
  }
  if (set[0] === 'light') {
    const p = loadLight(x.light);
    return p && { light: p };
  }
  if (set[0] === 'material') {
    const p = loadMaterial(x.material);
    return p && { material: p };
  }
  if (set[0] === 'sprite') {
    const p = loadSprite(x.sprite);
    return p && { sprite: p };
  }
  if (set[0] === 'sound') {
    const p = loadSound(x.sound);
    return p && { sound: p };
  }
  const p = loadHarness(x.harness);
  return p && { harness: p };
}

function validPrint(print: Print): boolean {
  const p = loadPrint(print as unknown as Readonly<Record<string, unknown>>);
  return p !== null && p !== 'none';
}

function loadCartridge(x: unknown, nextId: number): Cartridge | null {
  if (!isRecord(x)) return null;
  const { id, name, kind, preset, from, affinity, slot } = x;
  if (!isString(id) || !isString(name)) return null;
  const n = CARTRIDGE_ID.exec(id)?.[1];
  if (n === undefined || !(Number(n) < nextId)) return null; // only ids already handed out
  if (isString(kind) && (PRINT_KINDS as readonly string[]).includes(kind)) {
    const k = kind as PrintKind;
    const print = loadPrint(x);
    // a print names no preset, never sits in a machine, and carries exactly its own kind
    if (print === null || print === 'none' || printKind(print) !== k || preset !== null || slot !== null) return null;
    return { id, name, kind: k, preset: null, from: [], affinity: { pxd: 1, vtx: 1, lx: 1, aq: 1 }, slot: null, ...print };
  }
  if (kind !== 'blank' && kind !== 'preset' && kind !== 'mix') return null;
  if (preset !== null && !isString(preset)) return null;
  if ((kind === 'preset') !== (preset !== null)) return null; // only a written preset names one
  const fromIds = stringList(from);
  if (fromIds === null || !isRecord(affinity)) return null;
  const { pxd, vtx, lx, aq } = affinity;
  if (!isNumber(pxd) || !isNumber(vtx) || !isNumber(lx) || !isNumber(aq)) return null;
  if (slot !== null && !isNumber(slot)) return null;
  if (kind === 'blank' && (slot !== null || fromIds.length > 0 || pxd !== 1 || vtx !== 1 || lx !== 1 || aq !== 1)) {
    return null; // blanks never go in a machine and do nothing
  }
  return { id, name, kind, preset, from: fromIds, affinity: { pxd, vtx, lx, aq }, slot };
}

function loadJob(x: unknown): Job | null {
  if (!isRecord(x)) return null;
  const { inputs, preset, done, needs, stalled } = x;
  const ids = stringList(inputs);
  if (ids === null) return null;
  if (preset !== null && !isString(preset)) return null;
  if (!isNumber(done) || done < 0 || !isNumber(needs) || needs < 0) return null;
  if (stalled !== undefined && typeof stalled !== 'boolean') return null;
  const print = loadPrint(x);
  if (print === null || (print !== 'none' && preset !== null)) return null;
  const job: Job = { inputs: ids, preset, done, needs, ...(print === 'none' ? {} : print) };
  return stalled === true ? paused(job) : job;
}

/** The bench writes one preset onto one blank. */
function benchHolds(job: Job, byId: ReadonlyMap<string, Cartridge>): boolean {
  const [id, ...rest] = job.inputs;
  const c = id === undefined ? undefined : byId.get(id);
  // a bench job writes either a preset or a print (a part, a species or a light), onto one blank
  return (job.preset !== null) !== (printOf(job) !== null) && rest.length === 0 && c !== undefined && c.kind === 'blank';
}

/** The combiner holds 2 to 4 different written cartridges from the rack. */
function combinerHolds(job: Job, byId: ReadonlyMap<string, Cartridge>): boolean {
  const n = job.inputs.length;
  return (
    job.preset === null &&
    printOf(job) === null &&
    n >= RULES.minInputs &&
    n <= RULES.maxInputs &&
    new Set(job.inputs).size === n &&
    job.inputs.every((id) => {
      const c = byId.get(id);
      return c !== undefined && c.kind !== 'blank' && !forTheRifle(c) && c.slot === null;
    })
  );
}

/**
 * Reads a save. Returns null for junk: a wrong v, missing or mistyped fields, the
 * same id twice, an id the lab has not handed out yet, a job naming a missing
 * cartridge, and labs the rules cannot make (a blank in a machine, a bench job
 * that is not one blank, a combiner job that is not 2 to 4 different written
 * cartridges from the rack). Unknown extra keys are dropped.
 */
export function loadLab(json: unknown): LabState | null {
  if (!isRecord(json)) return null;
  const { v, time, nextId, cartridges, bench, combiner, catalogueUntil } = json;
  if (v !== 1) return null;
  if (!isNumber(time) || time < 0 || !isNumber(catalogueUntil) || catalogueUntil < 0) return null;
  if (!isNumber(nextId) || !Number.isSafeInteger(nextId) || nextId < 1) return null;
  if (!isList(cartridges)) return null;
  const byId = new Map<string, Cartridge>();
  for (const x of cartridges) {
    const c = loadCartridge(x, nextId);
    if (c === null || byId.has(c.id)) return null;
    byId.set(c.id, c);
  }
  const b = bench === null ? null : loadJob(bench);
  const k = combiner === null ? null : loadJob(combiner);
  if (bench !== null && (b === null || !benchHolds(b, byId))) return null;
  if (combiner !== null && (k === null || !combinerHolds(k, byId))) return null;
  return { v: 1, time, nextId, cartridges: [...byId.values()], bench: b, combiner: k, catalogueUntil };
}

// ---------------------------------------------------------------------------
// Peaceful combiner recipes (TICKET-13, P1-LOOP-05)
// ---------------------------------------------------------------------------

/**
 * A combiner recipe that makes a monster-drop item from salvage (ore) and a blank cartridge, with no fight. The drops it
 * matches are leaksim's, mapped to items in apps/web/src/monsters/policy.ts (pxd-mono, vtx-rough and anomaly-core).
 * `plotsim`'s verifyPeacefulDropParity checks that every drop has one of these and a seal reward, so Aggression 'off' or
 * 'calm' never blocks progress. Items are plain ids; the lab's inventory and cartridges stay as they are.
 */
export interface PeacefulCombinerRecipe {
  readonly id: string;
  readonly title: string;
  readonly inputs: readonly { readonly item: string; readonly n: number }[];
  readonly output: { readonly item: string; readonly n: number };
  readonly description: string;
}

export const PEACEFUL_COMBINER_RECIPES: readonly PeacefulCombinerRecipe[] = Object.freeze([
  {
    id: 'combiner-peaceful-pxd-mono',
    title: 'Synthesize 1-bit pixel fragment',
    inputs: [{ item: 'ore', n: 8 }, { item: 'cartridge-blank', n: 1 }],
    output: { item: 'pxd-mono', n: 8 },
    description: 'Extracts monochrome pixel fragments from raw lunar ore and a blank cartridge, without a fight.',
  },
  {
    id: 'combiner-peaceful-vtx-rough',
    title: 'Synthesize rough vertex shard',
    inputs: [{ item: 'ore', n: 10 }, { item: 'cartridge-blank', n: 1 }],
    output: { item: 'vtx-rough', n: 6 },
    description: 'Presses raw ore into coarse vertex shards, without a fight.',
  },
  {
    id: 'combiner-peaceful-anomaly-core',
    title: 'Synthesize anomaly core',
    inputs: [{ item: 'ore', n: 20 }, { item: 'pxd-mono', n: 4 }, { item: 'cartridge-blank', n: 1 }],
    output: { item: 'anomaly-core', n: 1 },
    description: 'Fuses salvaged substrate and a blank cartridge into a stable anomaly core, without combat.',
  },
] as const);

/** The print a saved cartridge carries (the rifle's port save), checked as a lab save checks it; null when it has none or it is malformed. */
export function readPrint(x: unknown): Print | null {
  if (!isRecord(x)) return null;
  const p = loadPrint(x);
  return p === 'none' ? null : p;
}

// PNG Spore Cards share the same pure schemas and anatomy audit as Studio imports.
export * from './spore-card';

// Plan 47 consumer integration: Sovereign Harness (`harness:` / `harnessc:`) cartridges.
export * from './harness-cartridge';
