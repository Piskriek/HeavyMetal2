/**
 * `window.studioAgent`: the Studio's tool layer for a bring-your-own agent (plan 40 §2).
 *
 * The document is the API. An agent reads the document (with the slider schema the panels draw from), proposes `@hm/scenedoc`
 * operations and `matstack.*` material commands, and looks at what it made before asking the person to accept it:
 *
 *  - `read` hands back the document (or a subtree) with each node's type and props schema;
 *  - `commands` lists every command with its parameter schema, generated from one registry so the skill file, the panel and the
 *    agent cannot disagree;
 *  - `propose` stages a change set. Nothing is applied: each call is checked first, and a refusal comes back with the reason;
 *  - `changes` / `accept` / `reject` / `undo` / `redo` are the person's side: accepting a row runs it on the normal undo history;
 *  - `validateKit` is kitspec's `validate` plus the review checks plan 40 names (unresolved `mat:`/`vault:` ids, a part below the
 *    floor, a missing machine socket);
 *  - `materialCoverage` is `@hm/matstack`'s six-zone coverage report, so an agent measures a preset instead of guessing at it;
 *  - `capture` is injected by the page (a view, a four-side turntable, a mask view). This module never touches WebGL: it is pure
 *    and runs in a node test.
 *
 * Pure: no clock, no randomness, no DOM. The step clock and the renderer arrive as options, so a test drives both.
 */
import {
  CHANNEL_GROUPS,
  LAYER_SHELF,
  MASK_SHELF,
  MATERIAL_SHELF,
  MAX_LAYERS,
  MAX_MASK_INPUTS,
  SURFACE_SHELF,
  coverage,
  resolveMatPreset,
  type ChannelGroup,
  type LayerSpec,
  type MaskInput,
  type MaskSpec,
  type MaterialSpec,
} from '@hm/matstack';
import {
  apply as applyOp,
  check as checkOp,
  createHistory,
  path as docPath,
  redo as redoHistory,
  run as runOps,
  undo as undoHistory,
  type Doc,
  type History,
  type Op,
  type PropType,
  type Registry,
} from '@hm/scenedoc';
import { flatten as flattenKit, presetSockets, validate as validateKitSpec, type Issue, type Kit, type Overrides } from '@hm/kitspec';
import { atlasNoiseSource, atlasTileSource } from '@hm/texgraph';
import { materialCoverageReport } from './studio-agent-coverage';
import { auditSummary, kitAudit, type AuditOptions, type KitAuditReport } from './studio-agent-audit';

// ------------------------------------------------------------------ what an agent can ask for

/** A command parameter, described the way scenedoc describes a prop, so the panels and the skill file draw the same controls. */
export interface ParamSpec {
  readonly key: string;
  readonly label: string;
  readonly type: PropType;
  readonly help?: string;
}

/** One entry of `studio.commands.list`. */
export interface CommandSpec {
  readonly name: string;
  readonly summary: string;
  readonly group: 'document' | 'material' | 'inspect';
  readonly params: readonly ParamSpec[];
  readonly returns: string;
}

const num = (key: string, label: string, min: number, max: number, def: number, help?: string): ParamSpec => ({
  key,
  label,
  type: { kind: 'number', min, max, default: def },
  ...(help ? { help } : {}),
});

const MATSTACK_COMMANDS: readonly CommandSpec[] = Object.freeze([
  {
    name: 'matstack.setPaint',
    summary: 'Sets the material\'s two paints (body and trim); every colour reference in its surfaces resolves through them.',
    group: 'material',
    params: [
      { key: 'body', label: 'Body paint', type: { kind: 'color', default: '#8a8f96' }, help: 'a #rrggbb swatch' },
      { key: 'trim', label: 'Trim paint', type: { kind: 'color', default: '#3d434b' } },
    ],
    returns: 'the material with its new paint',
  },
  {
    name: 'matstack.setAge',
    summary: 'Sets the weathering age, 0 pristine to 1 rotten. Weathering layers grow from where their mask is strongest.',
    group: 'material',
    params: [num('age', 'Age', 0, 1, 0.4)],
    returns: 'the aged material',
  },
  {
    name: 'matstack.addLayer',
    summary: 'Adds a layer from the layer shelf (edge-wear, rust-bloom, dirt, soot, ...) at an index; the top of the stack is the end.',
    group: 'material',
    params: [
      { key: 'layer', label: 'Layer', type: { kind: 'enum', options: Object.keys(LAYER_SHELF), default: 'rust-bloom' } },
      { key: 'index', label: 'Index', type: { kind: 'int', min: 0, max: MAX_LAYERS, default: MAX_LAYERS } },
    ],
    returns: 'the material with the layer added',
  },
  {
    name: 'matstack.updateLayer',
    summary: 'Changes one layer\'s dials: opacity, how much its own relief steers it, whether it is drawn, and what it writes.',
    group: 'material',
    params: [
      { key: 'index', label: 'Layer index', type: { kind: 'int', min: 0, max: MAX_LAYERS - 1, default: 0 } },
      num('opacity', 'Opacity', 0, 1, 1),
      num('heightBlend', 'Relief blend', 0, 1, 1),
      { key: 'visible', label: 'Visible', type: { kind: 'bool', default: true } },
      {
        key: 'writes',
        label: 'Writes',
        type: { kind: 'json', default: CHANNEL_GROUPS },
        help: 'any of colour, metal, rough, specular, height, coat, fuzz, aniso, film, emit',
      },
    ],
    returns: 'the material with the layer changed',
  },
  {
    name: 'matstack.setMaskInput',
    summary: 'Replaces one of a layer\'s mask inputs (edge, cavity, up, down, ground, noise, streaks, all) with its fold settings.',
    group: 'material',
    params: [
      { key: 'index', label: 'Layer index', type: { kind: 'int', min: 0, max: MAX_LAYERS - 1, default: 0 } },
      { key: 'input', label: 'Input index', type: { kind: 'int', min: 0, max: MAX_MASK_INPUTS - 1, default: 0 } },
      { key: 'kind', label: 'Input kind', type: { kind: 'enum', options: ['all', 'edge', 'cavity', 'up', 'down', 'ground', 'noise', 'streaks'], default: 'noise' } },
      { key: 'blend', label: 'Blend', type: { kind: 'enum', options: ['normal', 'add', 'subtract', 'multiply', 'max', 'min'], default: 'normal' } },
      num('opacity', 'Input opacity', 0, 1, 1),
      { key: 'invert', label: 'Invert', type: { kind: 'bool', default: false } },
      num('width', 'Width (m)', 0, 0.05, 0.01, 'edge and cavity inputs only'),
      num('angle', 'Angle (deg)', 0, 90, 35, 'up and down inputs only'),
      num('soft', 'Softness (deg)', 0, 90, 15, 'up and down inputs only'),
      num('height', 'Height (m)', 0, 3, 0.3, 'the ground input only'),
      num('scale', 'Scale (m per repeat)', 0.01, 4, 0.3, 'noise and streaks inputs only'),
      num('seed', 'Seed', 0, 999, 1, 'noise and streaks inputs only'),
      num('stretch', 'Stretch', 1, 24, 4, 'the streaks input only'),
    ],
    returns: 'the material with the input replaced',
  },
]);

const DOCUMENT_COMMANDS: readonly CommandSpec[] = Object.freeze([
  {
    name: 'studio.doc.propose',
    summary: 'Stages @hm/scenedoc operations (create, set, move, rename, duplicate, remove) or material commands. Nothing is applied.',
    group: 'document',
    params: [
      { key: 'label', label: 'Label', type: { kind: 'string', maxLength: 120, default: 'agent edit' }, help: 'what the Changes row says' },
      { key: 'ops', label: 'Operations', type: { kind: 'json', default: [] } },
      { key: 'material', label: 'Material (and its commands)', type: { kind: 'json', default: null } },
    ],
    returns: 'staged rows and any refusals',
  },
  {
    name: 'studio.kit.validate',
    summary: 'kitspec validate plus the review checks: unresolved mat:/vault: ids, a part below the floor or floating, a missing machine socket.',
    group: 'inspect',
    params: [
      { key: 'kit', label: 'Kit', type: { kind: 'json', default: null }, help: 'a @hm/kitspec Kit' },
      { key: 'preset', label: 'Preset', type: { kind: 'string', maxLength: 80, default: 'main' }, help: 'the assembly that is the whole machine' },
      { key: 'sockets', label: 'Required sockets', type: { kind: 'json', default: [] }, help: 'e.g. ["power", "vent"] for a machine' },
    ],
    returns: 'ok, or every issue with where it is and what is wrong',
  },
  {
    name: 'studio.kit.audit',
    summary:
      'The anatomy standard: colliding part pairs at rest, exploded and through 8 motion phases; loose ends; pipes that end in mid-air; bend radii at moving joints; and 24-ray orbit clearance for every control.',
    group: 'inspect',
    params: [
      { key: 'kit', label: 'Kit', type: { kind: 'json', default: null }, help: 'a @hm/kitspec Kit' },
      { key: 'preset', label: 'Preset', type: { kind: 'string', maxLength: 80, default: 'main' }, help: "the assembly that is the whole machine (the kit's own main preset when it has none)" },
      {
        key: 'options',
        label: 'Options',
        type: { kind: 'json', default: {} },
        help: 'collisionM, socketToleranceM, explode, phases, stage, ground, conduits, targets, minClearRays',
      },
    ],
    returns: 'the five reports (solidClearances, looseEnds, terminals, hingeBendRadius, orbitClearance24), a pass flag and a one-line summary',
  },
  {
    name: 'studio.material.coverage',
    summary: 'Percent of a 2.8 m machine each layer of a material paints, in six zones (top, side, edge, crease, bottom, splash), plus its edge metal.',
    group: 'inspect',
    params: [
      { key: 'preset', label: 'Preset id', type: { kind: 'string', maxLength: 80, default: 'mat:field-worn-hazard' }, help: 'a mat: id from the shelf' },
      { key: 'material', label: 'Material', type: { kind: 'json', default: null }, help: 'a MaterialSpec (wins over the preset)' },
      { key: 'grid', label: 'Grid', type: { kind: 'int', min: 4, max: 64, default: 24 } },
    ],
    returns: 'per-zone percentages, edge metal and a per-layer table',
  },
  {
    name: 'studio.capture',
    summary: 'An image of the current view or a four-side turntable, optionally at a detail rank or showing one layer\'s mask.',
    group: 'inspect',
    params: [
      { key: 'mode', label: 'Mode', type: { kind: 'enum', options: ['view', 'turntable4'], default: 'turntable4' } },
      { key: 'includeStaged', label: 'Include staged', type: { kind: 'bool', default: true } },
      { key: 'rank', label: 'Rank', type: { kind: 'int', min: 0, max: 2, default: 2 } },
      { key: 'maskView', label: 'Mask layer', type: { kind: 'int', min: 0, max: MAX_LAYERS - 1, default: 0 }, help: 'draw that layer\'s mask in black and white (-1 off)' },
    ],
    returns: 'a data URL',
  },
]);

/** Every command, in the order the skill file and the Changes panel list them. */
export const STUDIO_COMMANDS: readonly CommandSpec[] = Object.freeze([...DOCUMENT_COMMANDS, ...MATSTACK_COMMANDS]);

/** The command a name refers to, or undefined. */
export const studioCommand = (name: string): CommandSpec | undefined => STUDIO_COMMANDS.find((c) => c.name === name);

// ------------------------------------------------------------------ material commands (pure)

export type MatstackCommand =
  | { readonly command: 'matstack.setPaint'; readonly body: string; readonly trim: string }
  | { readonly command: 'matstack.setAge'; readonly age: number }
  | { readonly command: 'matstack.addLayer'; readonly layer: string; readonly index?: number }
  | {
      readonly command: 'matstack.updateLayer';
      readonly index: number;
      readonly opacity?: number;
      readonly heightBlend?: number;
      readonly visible?: boolean;
      readonly writes?: readonly ChannelGroup[];
    }
  | { readonly command: 'matstack.setMaskInput'; readonly index: number; readonly input: number; readonly value: MaskInput };

const isHex = (s: unknown): s is string => typeof s === 'string' && /^#[0-9a-fA-F]{6}$/.test(s);
const finite = (v: unknown, lo: number, hi: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;

/** A mask input from flat parameters (the same keys the command schema names). Pure clipping, never a guess. */
export function maskInputFrom(params: Readonly<Record<string, unknown>>): MaskInput | { readonly why: string } {
  const kind = params.kind;
  const blend = params.blend ?? 'normal';
  const opacity = params.opacity ?? 1;
  const invert = params.invert === true;
  if (typeof blend !== 'string' || !['normal', 'add', 'subtract', 'multiply', 'max', 'min'].includes(blend)) return { why: `unknown blend '${String(blend)}'` };
  if (!finite(opacity, 0, 1)) return { why: 'opacity must be 0 to 1' };
  const base = { blend: blend as MaskInput['blend'], opacity, invert };
  switch (kind) {
    case 'all':
      return { kind: 'all', ...base };
    case 'edge':
    case 'cavity': {
      const width = params.width ?? 0.01;
      if (!finite(width, 0, 0.05)) return { why: 'width must be 0 to 0.05 m' };
      return { kind, ...base, width };
    }
    case 'up':
    case 'down': {
      const angle = params.angle ?? 35;
      const soft = params.soft ?? 15;
      if (!finite(angle, 0, 90)) return { why: 'angle must be 0 to 90 degrees' };
      if (!finite(soft, 0, 90)) return { why: 'soft must be 0 to 90 degrees' };
      return { kind, ...base, angle, soft };
    }
    case 'ground': {
      const height = params.height ?? 0.3;
      const soft = params.soft ?? 0.15;
      if (!finite(height, 0, 3)) return { why: 'height must be 0 to 3 m' };
      if (!finite(soft, 0, 3)) return { why: 'soft must be 0 to 3 m' };
      return { kind, ...base, height, soft };
    }
    case 'noise':
    case 'streaks': {
      const scale = params.scale ?? 0.3;
      const seed = params.seed ?? 1;
      if (!finite(scale, 0.01, 4)) return { why: 'scale must be 0.01 to 4 m' };
      if (!finite(seed, 0, 999)) return { why: 'seed must be 0 to 999' };
      if (kind === 'noise') {
        const noise = params.noise ?? 'clouds';
        if (typeof noise !== 'string' || !['clouds', 'cells', 'speckle', 'scratches'].includes(noise)) return { why: `unknown noise '${String(noise)}'` };
        return { kind, ...base, noise: noise as 'clouds' | 'cells' | 'speckle' | 'scratches', scale, seed };
      }
      const stretch = params.stretch ?? 4;
      if (!finite(stretch, 1, 24)) return { why: 'stretch must be 1 to 24' };
      return { kind, ...base, scale, stretch, seed };
    }
    default:
      return { why: `unknown mask input kind '${String(kind)}'` };
  }
}

/**
 * What is wrong with a material, as plain reasons (the same checks a person's panel makes before it draws): 1 to `MAX_LAYERS`
 * layers, a mask of 1 to `MAX_MASK_INPUTS` inputs, only real channel groups written, values in range. Empty means usable.
 */
export function checkMaterial(m: MaterialSpec): string[] {
  const why: string[] = [];
  if (!m.name?.trim()) why.push('the material needs a name');
  if (!finite(m.age, 0, 1)) why.push(`age ${m.age} is outside 0..1`);
  if (m.paint.length !== 2 || !m.paint.every(isHex)) why.push('paint must be two #rrggbb swatches');
  if (m.layers.length === 0) why.push('a material needs at least one layer');
  if (m.layers.length > MAX_LAYERS) why.push(`${m.layers.length} layers is more than ${MAX_LAYERS}`);
  m.layers.forEach((l, i) => {
    const at = `layer ${i} (${l.name || 'unnamed'})`;
    if (!finite(l.opacity, 0, 1)) why.push(`${at}: opacity ${l.opacity} is outside 0..1`);
    if (!finite(l.heightBlend, 0, 1)) why.push(`${at}: heightBlend ${l.heightBlend} is outside 0..1`);
    if (l.writes.length === 0) why.push(`${at}: writes nothing, so it cannot be seen`);
    for (const w of l.writes) if (!CHANNEL_GROUPS.includes(w)) why.push(`${at}: '${String(w)}' is not a channel group`);
    const mask = l.mask;
    if (mask.inputs.length === 0) why.push(`${at}: its mask has no inputs`);
    if (mask.inputs.length > MAX_MASK_INPUTS) why.push(`${at}: ${mask.inputs.length} mask inputs is more than ${MAX_MASK_INPUTS}`);
    if (!finite(mask.balance, -1, 1)) why.push(`${at}: mask balance ${mask.balance} is outside -1..1`);
    if (!finite(mask.contrast, 0, 1)) why.push(`${at}: mask contrast ${mask.contrast} is outside 0..1`);
  });
  return why;
}

/** The result of a material command: the new material, or the reason it was refused. */
export type MaterialResult = { readonly ok: true; readonly material: MaterialSpec } | { readonly ok: false; readonly why: string };

/** Runs one `matstack.*` command on a material. Pure: the input is never changed. */
export function applyMatstackCommand(material: MaterialSpec, cmd: MatstackCommand): MaterialResult {
  const done = (next: MaterialSpec): MaterialResult => {
    const why = checkMaterial(next);
    return why.length === 0 ? { ok: true, material: next } : { ok: false, why: why.join('; ') };
  };
  const layerAt = (i: unknown): LayerSpec | string => {
    if (!Number.isInteger(i) || typeof i !== 'number' || i < 0 || i >= material.layers.length) {
      return `layer ${String(i)} does not exist (the material has ${material.layers.length})`;
    }
    return material.layers[i]!;
  };
  switch (cmd.command) {
    case 'matstack.setPaint': {
      if (!isHex(cmd.body) || !isHex(cmd.trim)) return { ok: false, why: 'both paints must be #rrggbb swatches' };
      return done({ ...material, paint: [cmd.body, cmd.trim] });
    }
    case 'matstack.setAge': {
      if (!finite(cmd.age, 0, 1)) return { ok: false, why: 'age must be 0 to 1' };
      return done({ ...material, age: cmd.age });
    }
    case 'matstack.addLayer': {
      const layer = LAYER_SHELF[cmd.layer];
      if (!layer) return { ok: false, why: `no layer '${cmd.layer}' in the shelf` };
      if (material.layers.length >= MAX_LAYERS) return { ok: false, why: `the material already has ${MAX_LAYERS} layers` };
      const index = cmd.index ?? material.layers.length;
      if (!Number.isInteger(index) || index < 0 || index > material.layers.length) {
        return { ok: false, why: `index ${cmd.index} is outside 0..${material.layers.length}` };
      }
      const layers = [...material.layers];
      layers.splice(index, 0, layer);
      return done({ ...material, layers });
    }
    case 'matstack.updateLayer': {
      const layer = layerAt(cmd.index);
      if (typeof layer === 'string') return { ok: false, why: layer };
      const next: LayerSpec = {
        ...layer,
        ...(cmd.opacity === undefined ? {} : { opacity: cmd.opacity }),
        ...(cmd.heightBlend === undefined ? {} : { heightBlend: cmd.heightBlend }),
        ...(cmd.visible === undefined ? {} : { visible: cmd.visible }),
        ...(cmd.writes === undefined ? {} : { writes: [...cmd.writes] }),
      };
      const layers = [...material.layers];
      layers[cmd.index] = next;
      return done({ ...material, layers });
    }
    case 'matstack.setMaskInput': {
      const layer = layerAt(cmd.index);
      if (typeof layer === 'string') return { ok: false, why: layer };
      if (!Number.isInteger(cmd.input) || cmd.input < 0 || cmd.input >= layer.mask.inputs.length) {
        return { ok: false, why: `input ${cmd.input} does not exist (the mask has ${layer.mask.inputs.length})` };
      }
      const inputs = [...layer.mask.inputs];
      inputs[cmd.input] = cmd.value;
      const layers = [...material.layers];
      layers[cmd.index] = { ...layer, mask: { ...layer.mask, inputs } };
      return done({ ...material, layers });
    }
    default:
      return { ok: false, why: `unknown command '${(cmd as { command: string }).command}'` };
  }
}

// ------------------------------------------------------------------ kitspec validation, plus the review checks

/** A kit problem: kitspec's own issues, and the review's (a reference the game cannot resolve, a floating part, a missing socket). */
export interface KitProblem {
  readonly code: 'kitspec' | 'unresolved-material' | 'below-floor' | 'floating' | 'missing-socket';
  readonly at: string;
  readonly detail: string;
}

export interface KitReport {
  readonly ok: boolean;
  readonly problems: readonly KitProblem[];
  /** The parts the preset places, at their paths, for a Changes row or a capture. */
  readonly parts: readonly { readonly path: string; readonly part: string; readonly material: string; readonly rank: number }[];
  /** The machine points the preset exposes. */
  readonly sockets: readonly string[];
}

/**
 * `studio.kit.validate`: kitspec's `validate`, then the review checks plan 40 §2 asks for:
 *  - every `mat:` / `vault:` / `part:` / `lx:` id a part names must resolve (the shelf or the resolver says so);
 *  - no part may start below the floor;
 *  - no part may float: more than 5 mm from its parent part's box is a gap (kitspec's own `floating` check runs first, and this
 *    catches a preset that only *looks* seated because two boxes touch at a corner);
 *  - every required socket must exist.
 */
export function validateKit(
  kit: Kit,
  preset: string,
  o: {
    readonly sockets?: readonly string[];
    readonly overrides?: Overrides;
    /** Resolves a material name the way the scene will (shelf first); false means the game cannot draw it. */
    readonly resolvesMaterial?: (name: string) => boolean;
    readonly ground?: number;
  } = {},
): KitReport {
  const problems: KitProblem[] = [];
  const issues: Issue[] = validateKitSpec(kit, preset, { ...(o.overrides ? { overrides: o.overrides } : {}), ...(o.ground === undefined ? {} : { ground: o.ground }) });
  for (const issue of issues) problems.push({ code: 'kitspec', at: issue.at, detail: `${issue.code}: ${issue.detail}` });
  const places = flattenKit(kit, preset, o.overrides);
  const resolves =
    o.resolvesMaterial ??
    ((name: string): boolean =>
      !!MATERIAL_SHELF[name] || name.startsWith('mat:') ? !!MATERIAL_SHELF[name] || !!resolveMatPreset(name) : !name.includes(':') || name.startsWith('lx:'));
  for (const p of places) {
    const names = [p.material, ...Object.values(p.slotMaterials ?? {})];
    for (const name of names) {
      if (name === 'gen' || name === 'lamp' || name.startsWith('lx:')) continue; // the scene's own record and the light presets
      if (!resolves(name)) problems.push({ code: 'unresolved-material', at: p.path, detail: `'${name}' is neither in the shelf nor resolvable by the scene` });
    }
    const y = p.matrix[13] as number;
    const ground = o.ground ?? 0;
    if (y < ground - 1e-6) problems.push({ code: 'below-floor', at: p.path, detail: `starts ${(ground - y).toFixed(3)} m below the floor` });
  }
  const sockets = Object.keys(presetSockets(kit, preset));
  for (const need of o.sockets ?? []) {
    if (!sockets.includes(need)) problems.push({ code: 'missing-socket', at: preset, detail: `'${need}' is missing (the preset has ${sockets.join(', ') || 'none'})` });
  }
  return {
    ok: problems.length === 0,
    problems,
    parts: places.map((p) => ({ path: p.path, part: p.part, material: p.material, rank: p.rank })),
    sockets,
  };
}

// ------------------------------------------------------------------ the staged change set and the session

/** One row of the Changes panel. `staged` rows are what the person reviews; accepting runs the row. */
export interface StagedChange {
  readonly id: string;
  readonly seq: number;
  readonly label: string;
  readonly ops: readonly Op[];
  readonly material: { readonly name: string; readonly command: MatstackCommand } | null;
  readonly status: 'staged' | 'accepted' | 'rejected';
  readonly why: string;
}

/** A refusal from `propose`: which call, and why it cannot be staged. */
export interface Refusal {
  readonly call: number;
  readonly label: string;
  readonly why: string;
}

/** What one propose call asks for. */
export interface ProposeCall {
  readonly label?: string;
  readonly ops?: readonly Op[];
  readonly material?: { readonly name: string; readonly command: MatstackCommand };
}

/** A capture the page must draw: a view, a four-side turntable, or one layer's mask. */
export interface CaptureRequest {
  readonly mode: 'view' | 'turntable4';
  readonly includeStaged: boolean;
  readonly rank: 0 | 1 | 2;
  readonly maskView: number;
}

export type Capture = (o: CaptureRequest) => Promise<{ readonly ok: true; readonly dataUrl: string } | { readonly ok: false; readonly why: string }>;

/**
 * The Studio's own history, handed to the session so an accepted row lands in the document the person is already looking at (and so a
 * person's own edit is what the agent reads next). Without one, the session keeps a history of its own, seeded with `doc`.
 */
export interface HistoryHandle {
  readonly get: () => History;
  readonly set: (h: History) => void;
}

export interface SessionOptions {
  readonly registry: Registry;
  readonly doc: Doc;
  readonly history?: HistoryHandle;
  /** The step clock, injected so the session stays pure (and so a test can drive merges). */
  readonly at?: () => number;
  /** The page's renderer; without it `capture` refuses with the reason. */
  readonly capture?: Capture;
  readonly materials?: Readonly<Record<string, MaterialSpec>>;
}

/** The document as an agent reads it: the nodes under `id` (the roots when absent), with the type's props schema. */
export interface DocRead {
  readonly nodes: readonly {
    readonly id: string;
    readonly type: string;
    readonly name: string;
    readonly path: readonly string[];
    readonly props: Readonly<Record<string, unknown>>;
    readonly schema: Readonly<Record<string, PropType>>;
    readonly children: readonly string[];
  }[];
  readonly roots: readonly string[];
}

let sessionCount = 0;

/**
 * One Studio session: the document's history, the materials being edited, and the staged rows an agent proposed. A person's
 * Studio and an agent's bridge each hold one; accepting is the only way a proposal reaches the document.
 */
export class StudioSession {
  readonly id: string;
  private readonly handle: HistoryHandle;
  private staged: StagedChange[] = [];
  private seq = 0;
  private readonly registry: Registry;
  private readonly at: () => number;
  private readonly renderer?: Capture;
  private materials: Record<string, MaterialSpec>;

  constructor(o: SessionOptions) {
    sessionCount += 1;
    this.id = `studio-session-${sessionCount}`;
    this.registry = o.registry;
    const own = { current: createHistory(o.doc) };
    this.handle = o.history ?? { get: () => own.current, set: (h) => { own.current = h; } };
    this.at = o.at ?? (() => 0);
    if (o.capture) this.renderer = o.capture;
    this.materials = { ...(o.materials ?? {}) };
  }

  /** The document as it stands (accepted rows only). */
  doc(): Doc {
    return this.handle.get().doc;
  }

  /** The materials the session holds, by name. */
  materialTable(): Readonly<Record<string, MaterialSpec>> {
    return this.materials;
  }

  /** `studio.doc.read`: the document, or one node's subtree, with the props schema each node draws from. */
  read(id?: string): DocRead {
    const doc = this.handle.get().doc;
    const ids = id ? [id, ...descendantsOf(doc, id)] : [...doc.roots];
    const nodes = ids.flatMap((nodeId) => {
      const node = doc.nodes[nodeId];
      if (!node) return [];
      const def = this.registry.types.get(node.type);
      return [
        {
          id: node.id,
          type: node.type,
          name: node.name,
          path: docPath(doc, node.id),
          props: node.props,
          schema: def?.props ?? {},
          children: node.children,
        },
      ];
    });
    return { nodes, roots: doc.roots };
  }

  /** `studio.commands.list`. */
  commands(): readonly CommandSpec[] {
    return STUDIO_COMMANDS;
  }

  /**
   * `studio.doc.propose`: stages the calls in order. Each is checked against the document (or the material) as it will be once the
   * earlier calls in the same proposal have run, so a proposal can create a node and then set it. A call that cannot be staged comes
   * back in `refusals` with the reason; the rest still stage.
   */
  propose(calls: readonly ProposeCall[]): { readonly staged: readonly StagedChange[]; readonly refusals: readonly Refusal[] } {
    const staged: StagedChange[] = [];
    const refusals: Refusal[] = [];
    // a working copy: a proposal is checked as a whole, in order
    let doc = this.handle.get().doc;
    const materials = { ...this.materials };
    calls.forEach((call, i) => {
      const label = call.label?.trim() || 'agent edit';
      const ops = [...(call.ops ?? [])];
      if (ops.length > 0) {
        for (const op of ops) {
          const check = checkOp(this.registry, doc, op);
          if (!check.ok) {
            refusals.push({ call: i, label, why: check.why });
            return;
          }
          doc = applyOp(this.registry, doc, op).doc;
        }
      }
      if (call.material) {
        const target = materials[call.material.name];
        if (!target) {
          refusals.push({ call: i, label, why: `there is no material '${call.material.name}' in this session` });
          return;
        }
        const result = applyMatstackCommand(target, call.material.command);
        if (!result.ok) {
          refusals.push({ call: i, label, why: result.why });
          return;
        }
        materials[call.material.name] = result.material;
      }
      if (ops.length === 0 && !call.material) {
        refusals.push({ call: i, label, why: 'the call has neither ops nor a material command' });
        return;
      }
      this.seq += 1;
      const row: StagedChange = {
        id: `change-${this.seq}`,
        seq: this.seq,
        label,
        ops,
        material: call.material ?? null,
        status: 'staged',
        why: '',
      };
      this.staged.push(row);
      staged.push(row);
    });
    return { staged, refusals };
  }

  /** `studio.changes.list`: every row, staged first in proposal order, then the ones already decided. */
  changes(): readonly StagedChange[] {
    return this.staged;
  }

  /**
   * `studio.changes.accept`: runs the row. Document ops go on as one undo step; a material command updates its material. Accepting
   * a row that is not staged (or was rejected) is refused with the reason, never silently ignored.
   */
  accept(id: string): { readonly ok: boolean; readonly why: string; readonly doc: Doc } {
    const row = this.staged.find((c) => c.id === id);
    if (!row) return { ok: false, why: `no change '${id}'`, doc: this.handle.get().doc };
    if (row.status !== 'staged') return { ok: false, why: `change '${id}' was already ${row.status}`, doc: this.handle.get().doc };
    if (row.ops.length > 0) {
      try {
        const result = runOps(this.registry, this.handle.get(), row.label, row.ops, { at: this.at() });
        this.handle.set(result.history);
      } catch (e) {
        return { ok: false, why: e instanceof Error ? e.message : String(e), doc: this.handle.get().doc };
      }
    }
    if (row.material) {
      const target = this.materials[row.material.name];
      if (!target) return { ok: false, why: `the material '${row.material.name}' is gone`, doc: this.handle.get().doc };
      const result = applyMatstackCommand(target, row.material.command);
      if (!result.ok) return { ok: false, why: result.why, doc: this.handle.get().doc };
      this.materials = { ...this.materials, [row.material.name]: result.material };
    }
    this.staged = this.staged.map((c) => (c.id === id ? { ...c, status: 'accepted' } : c));
    return { ok: true, why: '', doc: this.handle.get().doc };
  }

  /** `studio.changes.reject`: drops the row. Rejecting twice is refused, not ignored. */
  reject(id: string, why = ''): { readonly ok: boolean; readonly why: string } {
    const row = this.staged.find((c) => c.id === id);
    if (!row) return { ok: false, why: `no change '${id}'` };
    if (row.status !== 'staged') return { ok: false, why: `change '${id}' was already ${row.status}` };
    this.staged = this.staged.map((c) => (c.id === id ? { ...c, status: 'rejected', why } : c));
    return { ok: true, why: '' };
  }

  /** `studio.history.undo` / `redo`: the person's own undo stack, which a proposal's rows land on. */
  undo(): Doc {
    this.handle.set(undoHistory(this.registry, this.handle.get()).history);
    return this.handle.get().doc;
  }

  redo(): Doc {
    this.handle.set(redoHistory(this.registry, this.handle.get()).history);
    return this.handle.get().doc;
  }

  /** Steps on the undo stack (for a Changes panel heading). */
  historyDepth(): { readonly past: number; readonly future: number } {
    const h = this.handle.get();
    return { past: h.past.length, future: h.future.length };
  }

  /** `studio.kit.validate`. */
  validateKit(kit: Kit, preset: string, o: { readonly sockets?: readonly string[]; readonly overrides?: Overrides; readonly resolvesMaterial?: (name: string) => boolean } = {}): KitReport {
    return validateKit(kit, preset, o);
  }

  /**
   * `studio.kit.audit`: the anatomy standard. Where `validateKit` says a kit is legal, this says whether it is buildable —
   * colliding parts, parts that hang off nothing, pipes that end in mid-air, conduits that kink across a moving joint, and
   * controls the beam can never reach. Pure: the report is the same for the same kit, and it never touches a renderer.
   */
  auditKit(kit: Kit, o: AuditOptions = {}): KitAuditReport & { readonly summary: string } {
    const report = kitAudit(kit, o);
    return { ...report, summary: auditSummary(report) };
  }

  /** `studio.material.coverage`: the six-zone report for a shelf preset or a spec, with percentages an agent can read. */
  materialCoverage(o: { readonly preset?: string; readonly material?: MaterialSpec; readonly grid?: number }): ReturnType<typeof materialCoverageReport> {
    return materialCoverageReport(o);
  }

  /** `studio.capture`. Without a renderer the refusal says so (the built game has one; a node test does not). */
  async capture(o: Partial<CaptureRequest> = {}): Promise<{ readonly ok: true; readonly dataUrl: string } | { readonly ok: false; readonly why: string }> {
    if (!this.renderer) return { ok: false, why: 'no renderer is attached to this session (the Studio page installs one)' };
    const rank = o.rank ?? 2;
    if (rank !== 0 && rank !== 1 && rank !== 2) return { ok: false, why: `rank ${rank} is not 0, 1 or 2` };
    const maskView = o.maskView ?? -1;
    if (!Number.isInteger(maskView) || maskView < -1 || maskView >= MAX_LAYERS) return { ok: false, why: `maskView ${maskView} is not -1 to ${MAX_LAYERS - 1}` };
    return this.renderer({ mode: o.mode ?? 'turntable4', includeStaged: o.includeStaged ?? true, rank, maskView });
  }

  /** The layers of a material the coverage report can mask (the Changes panel's mask view picker). */
  layerNames(material: string): readonly string[] {
    return (this.materials[material]?.layers ?? []).map((l) => l.name);
  }
}

const descendantsOf = (doc: Doc, id: string): string[] => {
  const root = doc.nodes[id];
  if (!root) return [];
  const out: string[] = [];
  const walk = (nodeId: string): void => {
    for (const child of doc.nodes[nodeId]?.children ?? []) {
      out.push(child);
      walk(child);
    }
  };
  walk(id);
  return out;
};

/** The mask a layer draws with, for a mask view or a doc read of a shelf layer. */
export const shelfMask = (name: string): MaskSpec | undefined => MASK_SHELF[name];

/** The surfaces a material may name in a `set` op, for the skill file's table. */
export const SURFACE_IDS: readonly string[] = Object.freeze(Object.keys(SURFACE_SHELF));

/** The coverage sources the agent reports on (one atlas, the same bytes the shader reads). */
export const coverageSources = (): { readonly tiles: ReturnType<typeof atlasTileSource>; readonly noise: ReturnType<typeof atlasNoiseSource> } => ({
  tiles: atlasTileSource(),
  noise: atlasNoiseSource(),
});

/** The plain coverage call, for a script or a test that does not need a session. */
export const materialCoverageOf = (m: MaterialSpec, grid?: number): ReturnType<typeof coverage> => {
  const { tiles, noise } = coverageSources();
  return coverage(m, tiles, noise, grid);
};
