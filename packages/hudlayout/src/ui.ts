/**
 * Plan 57 §15: the interface is presets too. A `ui:` preset climbs the same five rungs as every preset:
 *   1 tokens: colour, type, scale, corner, motion
 *   2 widget looks: a readout, a meter, a card, a badge, a list, a stat, an action, each in a tone, a frame and a size
 *   3 parts: a widget bound to a real value, or an action bound to a real command
 *   4 panels: parts placed by anchor and offset (the HUD layout's own anchors and pixel offsets)
 *   5 a screen: its tokens and its panels
 * The System HUD's rule binds rung 3: a lens, never a lie. A part reads a declared source (a value the screen really has), and a
 * part with no source to read cannot be placed: validateScreen says so. An action is held to a declared command the same way, so
 * there is no button that does nothing. These are universal operators, not one game's templates:
 * a meter is a meter whether it reads a sync, a fuel tank or an XP bar. Another game's interface is bagged as this structure and
 * redrawn in FIDELITY's own tokens, never its art or text.
 *
 * Pure and deterministic; the app renders what a screen describes. A player's own screen travels as `uic:<code>`
 * (@hm/presetcodec: versioned, CRC-checked; a damaged or foreign code reads as null).
 */
import { decode, encode, type Field, type Schema } from '@hm/presetcodec';
import type { Anchor } from './types';

export const UI_ANCHORS: readonly Anchor[] = ['top-left', 'top-center', 'top-right', 'middle-left', 'center', 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right'];

// ---- rung 1: tokens
export type UiFont = 'setmix' | 'sans' | 'mono';
export const UI_FONTS: readonly UiFont[] = ['setmix', 'sans', 'mono'];
export interface UiTokens {
  readonly ink: string;
  readonly paper: string;
  readonly accent: string;
  readonly warn: string;
  readonly dim: string;
  readonly font: UiFont;
  /** The type and spacing scale, 0.75 to 1.5. */
  readonly scale: number;
  /** Corner radius in px, 0 to 12. */
  readonly radius: number;
  readonly reducedMotion: boolean;
}

// ---- rung 2: widget looks
/**
 * A stat (Argon's yes, 29 Oct) is one number with what the player reads beside it: what it is out of, its rate, what is held
 * elsewhere, its share and its alarm, each bound to a source of its own (the ore, the power, the health).
 */
export type WidgetKind = 'readout' | 'meter' | 'card' | 'badge' | 'list' | 'stat' | 'action';
export const WIDGET_KINDS: readonly WidgetKind[] = ['readout', 'meter', 'card', 'badge', 'list', 'stat', 'action'];
export type WidgetTone = 'ink' | 'accent' | 'warn' | 'dim';
export const WIDGET_TONES: readonly WidgetTone[] = ['ink', 'accent', 'warn', 'dim'];
export type WidgetFrame = 'none' | 'line' | 'fill';
export const WIDGET_FRAMES: readonly WidgetFrame[] = ['none', 'line', 'fill'];
export type WidgetSize = 's' | 'm' | 'l';
export const WIDGET_SIZES: readonly WidgetSize[] = ['s', 'm', 'l'];
export interface WidgetLook {
  readonly kind: WidgetKind;
  readonly tone: WidgetTone;
  readonly frame: WidgetFrame;
  readonly size: WidgetSize;
}

// ---- rung 3: parts, bound to a source
/**
 * What a screen really has to show: a value's path and what kind of value it is (a meter needs a ratio, or a number and its max).
 * A flag is a state that is on or off (the power is short, the health is low).
 */
export type SourceKind = 'number' | 'ratio' | 'text' | 'stage' | 'list' | 'flag';
export interface UiSource {
  readonly path: string;
  readonly kind: SourceKind;
  /** A number's top, so a meter can show it as a share. */
  readonly max?: number;
  /** The value's own unit (kW, ore). It belongs to the value, so a part cannot claim another. */
  readonly unit?: string;
}
/** Something the screen can really do when pressed (open the comms, fire), by its id; an action part binds one. */
export interface UiCommand {
  readonly id: string;
  /** What it does, in the player's words. */
  readonly does: string;
}
/** A stat's other bindings, each a source path the screen declares. */
export interface StatBinds {
  /** What the value is out of (a number): the supply the demand draws on, the health's top. */
  readonly of?: string;
  /** Its change each second (a number), written signed. */
  readonly rate?: string;
  /** What is held elsewhere and counts with it (a number): the ore in linked crates. */
  readonly linked?: string;
  /** How much of the need is met (a ratio), written as a percentage. */
  readonly share?: string;
  /** Its alarm (a flag): the stat reads as alerted, and shows its note. */
  readonly alert?: string;
}
/** Which kind of source each stat binding reads. */
export const STAT_READS: Readonly<Record<keyof StatBinds, SourceKind>> = { of: 'number', rate: 'number', linked: 'number', share: 'ratio', alert: 'flag' };
export const STAT_BINDS: readonly (keyof StatBinds)[] = ['of', 'rate', 'linked', 'share', 'alert'];
export interface UiPart {
  readonly id: string;
  readonly look: WidgetLook;
  /** The source path this part reads, or the command an action runs; it must be one the screen declares. */
  readonly binds: string;
  /** The player's word for it (shown beside the value), never a value of its own. A readout of a flag shows it while the flag is up. */
  readonly label: string;
  /** A stat's other bindings. */
  readonly with?: StatBinds;
  /** A stat's words while its alert is up (what to do about it). */
  readonly note?: string;
}

/** Which widget can show which kind of source. */
export const WIDGET_READS: Readonly<Record<WidgetKind, readonly SourceKind[]>> = {
  readout: ['number', 'ratio', 'text', 'stage', 'flag'],
  meter: ['ratio', 'number'],
  card: ['text', 'stage'],
  badge: ['text', 'stage'],
  list: ['list'],
  stat: ['number'],
  action: [],
};

// ---- rung 4: panels
export interface UiPanel {
  readonly id: string;
  readonly anchor: Anchor;
  /** Pixels in from the anchor's edges, as @hm/hudlayout's elements. */
  readonly offsetX: number;
  readonly offsetY: number;
  readonly visible: boolean;
  readonly parts: readonly UiPart[];
}

// ---- rung 5: a screen
export interface UiScreen {
  readonly id: string;
  readonly tokens: UiTokens;
  readonly panels: readonly UiPanel[];
}

export const UI_LIMITS = { panels: 16, partsPerPanel: 8, offset: 400, idBytes: 32, labelBytes: 64, pathBytes: 48 } as const;

export type UiIssueCode = 'unbound' | 'wrong-widget' | 'meter-without-range' | 'duplicate-id' | 'off-screen' | 'bad-colour' | 'empty-panel' | 'out-of-range' | 'note-without-alert';
export interface UiIssue {
  readonly code: UiIssueCode;
  readonly at: string;
  readonly detail: string;
}

const HEX = /^#[0-9a-f]{6}$/i;

/** What is wrong with a screen against the sources it may read and the commands it may run; [] when it may be shown. Never throws. */
export function validateScreen(screen: UiScreen, sources: readonly UiSource[], commands: readonly UiCommand[] = []): UiIssue[] {
  const out: UiIssue[] = [];
  const byPath = new Map(sources.map((s) => [s.path, s]));
  const commandIds = new Set(commands.map((c) => c.id));
  const t = screen.tokens;
  for (const k of ['ink', 'paper', 'accent', 'warn', 'dim'] as const) if (!HEX.test(t[k])) out.push({ code: 'bad-colour', at: `tokens.${k}`, detail: `${t[k]} is not #rrggbb` });
  if (!(t.scale >= 0.75 && t.scale <= 1.5)) out.push({ code: 'out-of-range', at: 'tokens.scale', detail: `${t.scale} is outside 0.75 to 1.5` });
  if (!(t.radius >= 0 && t.radius <= 12)) out.push({ code: 'out-of-range', at: 'tokens.radius', detail: `${t.radius} is outside 0 to 12` });
  const ids = new Set<string>();
  const seen = (id: string, at: string): void => { if (ids.has(id)) out.push({ code: 'duplicate-id', at, detail: `${id} is used twice` }); ids.add(id); };
  for (const p of screen.panels) {
    seen(p.id, `panel ${p.id}`);
    if (Math.abs(p.offsetX) > UI_LIMITS.offset || Math.abs(p.offsetY) > UI_LIMITS.offset) out.push({ code: 'off-screen', at: `panel ${p.id}`, detail: `offset beyond ${UI_LIMITS.offset} px` });
    if (p.parts.length === 0) out.push({ code: 'empty-panel', at: `panel ${p.id}`, detail: 'a panel with nothing in it' });
    for (const part of p.parts) {
      const at = `panel ${p.id} / part ${part.id}`;
      seen(part.id, at);
      const extra = STAT_BINDS.filter((k) => part.with?.[k] !== undefined);
      if (part.look.kind === 'action') {
        // the same rule for a press: an action with no real command to run would be a button that does nothing
        if (!commandIds.has(part.binds)) out.push({ code: 'unbound', at, detail: `${part.binds} is not a command this screen has` });
        if (extra.length > 0 || part.note !== undefined) out.push({ code: 'wrong-widget', at, detail: 'an action runs a command; it reads no values' });
        continue;
      }
      const src = byPath.get(part.binds);
      // the lens rule: a part with nothing real to read cannot be placed
      if (!src) { out.push({ code: 'unbound', at, detail: `${part.binds} is not a value this screen has` }); continue; }
      if (!WIDGET_READS[part.look.kind].includes(src.kind)) out.push({ code: 'wrong-widget', at, detail: `a ${part.look.kind} cannot show a ${src.kind}` });
      else if (part.look.kind === 'meter' && src.kind === 'number' && !(typeof src.max === 'number' && src.max > 0)) out.push({ code: 'meter-without-range', at, detail: `${part.binds} has no max, so a meter would invent its scale` });
      if (extra.length > 0 && part.look.kind !== 'stat') out.push({ code: 'wrong-widget', at, detail: `only a stat reads more than one value (this ${part.look.kind} has ${extra.join(', ')})` });
      for (const k of extra) {
        const path = part.with?.[k] as string;
        const other = byPath.get(path);
        // the lens rule holds for each binding: every value a stat shows is one the screen has
        if (!other) out.push({ code: 'unbound', at: `${at} / ${k}`, detail: `${path} is not a value this screen has` });
        else if (other.kind !== STAT_READS[k]) out.push({ code: 'wrong-widget', at: `${at} / ${k}`, detail: `a stat's ${k} reads a ${STAT_READS[k]}, not a ${other.kind}` });
      }
      if (part.note !== undefined && part.with?.alert === undefined) out.push({ code: 'note-without-alert', at, detail: 'a note shows only while an alert is up, and this part has none' });
    }
  }
  return out;
}

// ---- the code
const enumOf = (options: readonly string[]): Field => ({ kind: 'enum', options });
const str = (maxBytes: number): Field => ({ kind: 'string', maxBytes });
const lookOf = (kind: Field): Field => ({ kind: 'object', fields: { kind, tone: enumOf(WIDGET_TONES), frame: enumOf(WIDGET_FRAMES), size: enumOf(WIDGET_SIZES) } });
/** Version 3 and on: the kind by name (checked against WIDGET_KINDS on decode). */
const LOOK: Field = lookOf(str(16));
const TOKENS: Field = {
  kind: 'object',
  fields: {
    ink: { kind: 'color' }, paper: { kind: 'color' }, accent: { kind: 'color' }, warn: { kind: 'color' }, dim: { kind: 'color' },
    font: enumOf(UI_FONTS), scale: { kind: 'float', min: 0.75, max: 1.5, step: 0.05 }, radius: { kind: 'int', min: 0, max: 12 }, reducedMotion: { kind: 'bool' },
  },
};
const screenSchema = (version: number, part: Field): Schema => ({
  id: 'hm.ui.screen',
  version,
  root: {
    kind: 'object',
    fields: {
      id: str(UI_LIMITS.idBytes),
      tokens: TOKENS,
      panels: {
        kind: 'array',
        maxLength: UI_LIMITS.panels,
        of: {
          kind: 'object',
          fields: {
            id: str(UI_LIMITS.idBytes), anchor: enumOf(UI_ANCHORS), visible: { kind: 'bool' },
            offsetX: { kind: 'int', min: -UI_LIMITS.offset, max: UI_LIMITS.offset }, offsetY: { kind: 'int', min: -UI_LIMITS.offset, max: UI_LIMITS.offset },
            parts: { kind: 'array', of: part, maxLength: UI_LIMITS.partsPerPanel },
          },
        },
      },
    },
  },
});
/** The first codes' part, before the stat: five widget kinds and 48-byte labels. */
const PART_V1: Field = {
  kind: 'object',
  fields: {
    id: str(UI_LIMITS.idBytes),
    look: { kind: 'object', fields: { kind: enumOf(['readout', 'meter', 'card', 'badge', 'list']), tone: enumOf(WIDGET_TONES), frame: enumOf(WIDGET_FRAMES), size: enumOf(WIDGET_SIZES) } },
    binds: str(UI_LIMITS.pathBytes), label: str(48),
  },
};
/** A part with its stat bindings and note, each '' for none (a code has no optional fields). */
const partWith = (look: Field): Field => ({
  kind: 'object',
  fields: {
    id: str(UI_LIMITS.idBytes), look, binds: str(UI_LIMITS.pathBytes), label: str(UI_LIMITS.labelBytes),
    ...Object.fromEntries(STAT_BINDS.map((k) => [k, str(UI_LIMITS.pathBytes)])), note: str(UI_LIMITS.labelBytes),
  },
});
export const UI_SCREEN_SCHEMA: Schema = screenSchema(3, partWith(LOOK));
/** Version 2 (the stat): the six kinds as an enum. */
const UI_SCREEN_SCHEMA_V2: Schema = screenSchema(2, partWith(lookOf(enumOf(['readout', 'meter', 'card', 'badge', 'list', 'stat']))));
const UI_SCREEN_SCHEMA_V1: Schema = screenSchema(1, PART_V1);

type FlatPart = Omit<UiPart, 'with' | 'note'> & Readonly<Record<keyof StatBinds | 'note', string>>;
const flatPart = (p: UiPart): FlatPart => ({
  id: p.id, look: p.look, binds: p.binds, label: p.label,
  of: p.with?.of ?? '', rate: p.with?.rate ?? '', linked: p.with?.linked ?? '', share: p.with?.share ?? '', alert: p.with?.alert ?? '', note: p.note ?? '',
});
const fullPart = (p: FlatPart): UiPart => {
  const binds: StatBinds = Object.fromEntries(STAT_BINDS.filter((k) => p[k] !== '').map((k) => [k, p[k]]));
  return { id: p.id, look: p.look, binds: p.binds, label: p.label, ...(Object.keys(binds).length > 0 ? { with: binds } : {}), ...(p.note !== '' ? { note: p.note } : {}) };
};
interface ScreenOf<P> { readonly id: string; readonly tokens: UiTokens; readonly panels: readonly (Omit<UiPanel, 'parts'> & { readonly parts: readonly P[] })[] }
const mapParts = <A, B>(screen: ScreenOf<A>, f: (p: A) => B): ScreenOf<B> => ({ ...screen, panels: screen.panels.map((panel) => ({ ...panel, parts: panel.parts.map(f) })) });

/** A player's own screen's prefix; a shelf screen keeps its name, `ui:<id>`. */
export const UI_CODE_PREFIX = 'uic:';

/** A screen as a short text code. Throws only on a value the schema cannot hold (validate first). */
export function encodeScreen(screen: UiScreen): string {
  return UI_CODE_PREFIX + encode(UI_SCREEN_SCHEMA, mapParts(screen, flatPart));
}

/** The screen a code stands for, or null for a damaged, foreign or unprefixed code. Never throws. */
export function decodeScreen(code: string): UiScreen | null {
  if (!code.startsWith(UI_CODE_PREFIX)) return null;
  try {
    const body = code.slice(UI_CODE_PREFIX.length);
    const v3 = decode(UI_SCREEN_SCHEMA, body) as ScreenOf<FlatPart> | null;
    if (v3) return v3.panels.every((p) => p.parts.every((part) => (WIDGET_KINDS as readonly string[]).includes(part.look.kind))) ? mapParts(v3, fullPart) : null;
    // codes from before the action (version 2) and before the stat (version 1) read as they were
    const v2 = decode(UI_SCREEN_SCHEMA_V2, body);
    if (v2) return mapParts(v2 as unknown as ScreenOf<FlatPart>, fullPart);
    const v1 = decode(UI_SCREEN_SCHEMA_V1, body);
    return v1 ? (v1 as UiScreen) : null;
  } catch {
    return null;
  }
}

// ---- Plan 58: Curated Rung-1 UI Style Shelf (`UI_STYLE_SHELF`), CSS token mapping, and Rung-4 Screen Suite

export type UiStyleId =
  | 'braun-atelier'
  | 'rams-paper'
  | 'nier-monolith'
  | 'nasa-amber'
  | 'system-sovereign'
  | 'high-contrast';

export interface UiStylePreset {
  readonly id: UiStyleId;
  readonly name: string;
  readonly tagline: string;
  readonly s: { readonly Pxd: number; readonly Vtx: number; readonly Lx: number; readonly Aq: number };
  readonly tokens: UiTokens;
}

export const UI_STYLE_SHELF: readonly UiStylePreset[] = [
  {
    id: 'braun-atelier',
    name: 'Braun Atelier',
    tagline: 'Matte warm-carbon faceplate, 1px hairline rules & tactile terracotta accent.',
    s: { Pxd: 0.88, Vtx: 0.85, Lx: 0.72, Aq: 0.30 },
    tokens: {
      ink: '#f2f0e8',
      paper: '#1b1d19',
      accent: '#d96b43',
      warn: '#c94a38',
      dim: '#9e9c92',
      font: 'sans',
      scale: 1,
      radius: 2,
      reducedMotion: false,
    },
  },
  {
    id: 'rams-paper',
    name: 'Rams Drafting Vellum',
    tagline: 'Clean warm-white architectural studio paper, charcoal ink & terracotta index.',
    s: { Pxd: 0.92, Vtx: 0.86, Lx: 0.90, Aq: 0.25 },
    tokens: {
      ink: '#20221e',
      paper: '#f8f7f2',
      accent: '#c56443',
      warn: '#b3402e',
      dim: '#75746b',
      font: 'sans',
      scale: 1,
      radius: 0,
      reducedMotion: false,
    },
  },
  {
    id: 'nier-monolith',
    name: 'YoRHa Monolith',
    tagline: 'Computational data-craft in warm ash-charcoal, parchment bone & brass.',
    s: { Pxd: 0.90, Vtx: 0.88, Lx: 0.65, Aq: 0.22 },
    tokens: {
      ink: '#dad4c4',
      paper: '#21201d',
      accent: '#c4b89b',
      warn: '#b85344',
      dim: '#8c8779',
      font: 'mono',
      scale: 1,
      radius: 0,
      reducedMotion: false,
    },
  },
  {
    id: 'nasa-amber',
    name: 'Apollo Telemetry',
    tagline: 'Anodized command-module slate with warm instrument-amber readouts.',
    s: { Pxd: 0.84, Vtx: 0.80, Lx: 0.78, Aq: 0.28 },
    tokens: {
      ink: '#ede8dc',
      paper: '#171a1f',
      accent: '#e09f3e',
      warn: '#d6513e',
      dim: '#8c8a82',
      font: 'mono',
      scale: 1,
      radius: 2,
      reducedMotion: false,
    },
  },
  {
    id: 'system-sovereign',
    name: 'Sovereign Ledger',
    tagline: 'Deep archival obsidian slate with burnished gold-ochre filigree.',
    s: { Pxd: 0.90, Vtx: 0.84, Lx: 0.82, Aq: 0.45 },
    tokens: {
      ink: '#eef2f6',
      paper: '#151920',
      accent: '#d4a359',
      warn: '#d9534f',
      dim: '#8b96a5',
      font: 'setmix',
      scale: 1,
      radius: 2,
      reducedMotion: false,
    },
  },
  {
    id: 'high-contrast',
    name: 'High-Contrast Blueprint',
    tagline: 'WCAG AAA pitch-black chassis, crisp white lines & high-visibility gold.',
    s: { Pxd: 1.00, Vtx: 0.90, Lx: 1.00, Aq: 0.20 },
    tokens: {
      ink: '#ffffff',
      paper: '#080808',
      accent: '#ffbe0b',
      warn: '#ff595e',
      dim: '#d4d4d4',
      font: 'sans',
      scale: 1.15,
      radius: 0,
      reducedMotion: true,
    },
  },
];

export const DEFAULT_UI_STYLE_ID: UiStyleId = 'braun-atelier';

const LEGACY_STYLE_ALIASES: Readonly<Record<string, UiStyleId>> = {
  'holodeck-violet': 'braun-atelier',
  'litrpg-system': 'system-sovereign',
  'stargate-ancient': 'nasa-amber',
  'studio-precision': 'nier-monolith',
  'retro-amber-crt': 'nasa-amber',
};

export function getUiStylePreset(id: string | null | undefined): UiStylePreset {
  const resolved = id && LEGACY_STYLE_ALIASES[id] ? LEGACY_STYLE_ALIASES[id] : id;
  return UI_STYLE_SHELF.find((s) => s.id === resolved) ?? UI_STYLE_SHELF[0]!;
}

export const resolveUiStyle = getUiStylePreset;

export function applyUiStylePreset(screen: UiScreen, styleId: string): UiScreen {
  const preset = getUiStylePreset(styleId);
  return { ...screen, tokens: preset.tokens };
}

const FONT_STACKS: Readonly<Record<UiFont, string>> = {
  setmix: "'Oxanium', 'Inter', system-ui, sans-serif",
  sans: "'Inter', system-ui, -apple-system, sans-serif",
  mono: "'JetBrains Mono', 'Fira Code', monospace",
};

function parseHexRgb(hex: string): [number, number, number] {
  const clean = HEX.test(hex) ? hex.slice(1) : '1b1d19';
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function mixHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = parseHexRgb(a);
  const [br, bg, bb] = parseHexRgb(b);
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${clamp(ar + (br - ar) * t)}${clamp(ag + (bg - ag) * t)}${clamp(ab + (bb - ab) * t)}`;
}

function relativeLuma(hex: string): number {
  const [r, g, b] = parseHexRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/**
 * Maps Rung-1 `UiTokens` to both `--ui-*` and root legacy variables (`--bg`, `--paper`, `--panel`,
 * `--hm-inset`, `--line`, `--text`, `--dim`, `--accent`, `--ok`, `--danger`) so every stylesheet
 * (`shell.css`, `studio.css`, `dark-modal.css`, `dark-forms.css`, `planetary-grid.css`) shares one
 * cohesive, high-contrast industrial palette with zero black-on-black collisions.
 */
export function uiTokensToCssVars(tokens: UiTokens): Readonly<Record<string, string>> {
  const isLight = relativeLuma(tokens.paper) > 0.5;
  const bg = isLight ? mixHex(tokens.paper, tokens.ink, 0.04) : mixHex(tokens.paper, '#000000', 0.26);
  const panel = tokens.paper;
  const inset = mixHex(tokens.paper, tokens.ink, isLight ? 0.06 : 0.08);
  const hover = mixHex(tokens.paper, tokens.ink, isLight ? 0.11 : 0.14);
  const line = mixHex(tokens.paper, tokens.ink, isLight ? 0.18 : 0.22);
  const faint = mixHex(tokens.paper, tokens.dim, 0.65);
  const ok = isLight ? '#437a60' : '#5c9a78';
  const accentInk = relativeLuma(tokens.accent) > 0.56 ? '#141513' : '#ffffff';

  return {
    '--ui-bg': bg,
    '--ui-paper': panel,
    '--ui-panel': panel,
    '--ui-inset': inset,
    '--ui-hover': hover,
    '--ui-line': line,
    '--ui-ink': tokens.ink,
    '--ui-text': tokens.ink,
    '--ui-dim': tokens.dim,
    '--ui-accent': tokens.accent,
    '--ui-accent-ink': accentInk,
    '--ui-ok': ok,
    '--ui-warn': tokens.warn,
    '--ui-danger': tokens.warn,
    '--ui-font': FONT_STACKS[tokens.font] ?? FONT_STACKS.sans,
    '--ui-scale': String(tokens.scale),
    '--ui-radius': `${tokens.radius}px`,
    // Unified root variable bridge for shell.css + studio.css + modals:
    '--bg': bg,
    '--paper': panel,
    '--panel': panel,
    '--hm-bg': panel,
    '--hm-inset': inset,
    '--line': line,
    '--text': tokens.ink,
    '--dim': tokens.dim,
    '--faint': faint,
    '--accent': tokens.accent,
    '--green': ok,
    '--ok': ok,
    '--danger': tokens.warn,
  };
}

// ---- Plan 58 §4.1: Home Holo-Deck Screen Preset (`HOME_HOLODECK_SCREEN`)

export const HOME_HOLODECK_SOURCES: readonly UiSource[] = [
  { path: 'room.stage', kind: 'stage' },
  { path: 'room.warmShare', kind: 'ratio' },
  { path: 'profile.name', kind: 'text' },
  { path: 'profile.credits', kind: 'number', unit: 'cr' },
  { path: 'ui.styleName', kind: 'text' },
  { path: 'bridge.status', kind: 'text' },
];

export const HOME_HOLODECK_COMMANDS: readonly UiCommand[] = [
  { id: 'nav.expedition', does: 'Enter seeded world at Stage 3 with your Overwatch drone' },
  { id: 'nav.grid', does: 'Open the Solar System & Stargate Network map' },
  { id: 'nav.studio', does: 'Open The Studio 5-rung preset and world editor' },
  { id: 'nav.community', does: 'Open the Community & Guild preset shelf' },
  { id: 'nav.settings', does: 'Open Settings & UI Style presets' },
  { id: 'ui.cycleStyle', does: 'Cycle the active UI Style preset' },
  { id: 'bridge.toggleLink', does: 'Link or unlink a running game window on the Holo-Room screen' },
];

export const HOME_HOLODECK_SCREEN: UiScreen = {
  id: 'home-holodeck',
  tokens: UI_STYLE_SHELF[0]!.tokens,
  panels: [
    {
      id: 'home-nav',
      anchor: 'top-left',
      offsetX: 24,
      offsetY: 24,
      visible: true,
      parts: [
        { id: 'room-stage', look: { kind: 'badge', tone: 'accent', frame: 'fill', size: 's' }, binds: 'room.stage', label: 'Warmup' },
        { id: 'room-warm', look: { kind: 'meter', tone: 'accent', frame: 'line', size: 's' }, binds: 'room.warmShare', label: 'Presets' },
        { id: 'act-expedition', look: { kind: 'action', tone: 'accent', frame: 'fill', size: 'l' }, binds: 'nav.expedition', label: 'Enter Seeded World' },
        { id: 'act-grid', look: { kind: 'action', tone: 'ink', frame: 'line', size: 'm' }, binds: 'nav.grid', label: 'Solar System & Stargate' },
        { id: 'act-studio', look: { kind: 'action', tone: 'ink', frame: 'line', size: 'm' }, binds: 'nav.studio', label: 'The Studio' },
        { id: 'act-community', look: { kind: 'action', tone: 'ink', frame: 'line', size: 'm' }, binds: 'nav.community', label: 'Community & Guild Shelf' },
        { id: 'act-settings', look: { kind: 'action', tone: 'dim', frame: 'line', size: 's' }, binds: 'nav.settings', label: 'Settings & UI Theme' },
      ],
    },
    {
      id: 'home-profile',
      anchor: 'top-right',
      offsetX: 24,
      offsetY: 24,
      visible: true,
      parts: [
        { id: 'prof-name', look: { kind: 'badge', tone: 'ink', frame: 'line', size: 'm' }, binds: 'profile.name', label: 'Wanderer' },
        { id: 'prof-credits', look: { kind: 'stat', tone: 'accent', frame: 'none', size: 's' }, binds: 'profile.credits', label: 'Credits' },
        { id: 'style-name', look: { kind: 'readout', tone: 'dim', frame: 'none', size: 's' }, binds: 'ui.styleName', label: 'Theme' },
        { id: 'style-cycle', look: { kind: 'action', tone: 'accent', frame: 'line', size: 's' }, binds: 'ui.cycleStyle', label: 'Switch UI Theme' },
      ],
    },
    {
      id: 'home-bridge',
      anchor: 'bottom-right',
      offsetX: 24,
      offsetY: 24,
      visible: true,
      parts: [
        { id: 'bridge-readout', look: { kind: 'readout', tone: 'ink', frame: 'line', size: 's' }, binds: 'bridge.status', label: 'Holo-Room Bridge' },
        { id: 'bridge-link', look: { kind: 'action', tone: 'accent', frame: 'fill', size: 's' }, binds: 'bridge.toggleLink', label: 'Link Game Window' },
      ],
    },
  ],
};

// ---- Plan 58 §4.3: Rung-6 Wanderer Meta-Shell Screen Preset (`META_SHELL_SCREEN`)

export const META_SHELL_SOURCES: readonly UiSource[] = [
  { path: 'wanderer.bal', kind: 'ratio' },
  { path: 'wanderer.calm', kind: 'number', max: 0.6 },
  { path: 'party.doubling', kind: 'number' },
  { path: 'guild.coherence', kind: 'ratio' },
  { path: 'comms.messages', kind: 'list' },
  { path: 'clip.status', kind: 'text' },
  { path: 'harness.bridgeMode', kind: 'text' },
];

export const META_SHELL_COMMANDS: readonly UiCommand[] = [
  { id: 'comms.pingGate', does: 'Send canned callout: Meet at the Stargate plinth' },
  { id: 'comms.pingCraft', does: 'Send canned callout: Try this crafted preset on your bench' },
  { id: 'comms.pingEureka', does: 'Send canned callout: Eureka! Something let go and flow returned' },
  { id: 'clip.capture', does: 'Capture 6s video clip and deterministic shorthand replay code' },
  { id: 'harness.cueDream', does: 'Send Higher Self dream cue to Overwatch Drone' },
];

export const META_SHELL_SCREEN: UiScreen = {
  id: 'meta-shell',
  tokens: UI_STYLE_SHELF[0]!.tokens,
  panels: [
    {
      id: 'wanderer-party',
      anchor: 'top-left',
      offsetX: 24,
      offsetY: 140,
      visible: true,
      parts: [
        { id: 'wan-bal', look: { kind: 'meter', tone: 'accent', frame: 'line', size: 's' }, binds: 'wanderer.bal', label: 'Wanderer Anchor' },
        { id: 'wan-calm', look: { kind: 'meter', tone: 'ink', frame: 'line', size: 's' }, binds: 'wanderer.calm', label: 'Anchor Calm Lent' },
        { id: 'party-mult', look: { kind: 'stat', tone: 'accent', frame: 'none', size: 'm' }, binds: 'party.doubling', label: 'Party Doubling' },
        { id: 'guild-coh', look: { kind: 'meter', tone: 'accent', frame: 'line', size: 's' }, binds: 'guild.coherence', label: 'Guild Complex' },
      ],
    },
    {
      id: 'comms-drawer',
      anchor: 'bottom-left',
      offsetX: 24,
      offsetY: 64,
      visible: true,
      parts: [
        { id: 'msg-list', look: { kind: 'list', tone: 'ink', frame: 'line', size: 'm' }, binds: 'comms.messages', label: 'Comms Feed' },
        { id: 'ping-gate', look: { kind: 'action', tone: 'accent', frame: 'line', size: 's' }, binds: 'comms.pingGate', label: 'Ping: Gate' },
        { id: 'ping-craft', look: { kind: 'action', tone: 'accent', frame: 'line', size: 's' }, binds: 'comms.pingCraft', label: 'Share Preset' },
        { id: 'ping-eureka', look: { kind: 'action', tone: 'ink', frame: 'line', size: 's' }, binds: 'comms.pingEureka', label: 'Eureka!' },
      ],
    },
    {
      id: 'clip-and-harness',
      anchor: 'middle-left',
      offsetX: 24,
      offsetY: 0,
      visible: true,
      parts: [
        { id: 'clip-stat', look: { kind: 'readout', tone: 'dim', frame: 'none', size: 's' }, binds: 'clip.status', label: 'Clip Recorder' },
        { id: 'clip-btn', look: { kind: 'action', tone: 'accent', frame: 'fill', size: 's' }, binds: 'clip.capture', label: 'Record Clip + Code' },
        { id: 'bridge-mode', look: { kind: 'badge', tone: 'ink', frame: 'line', size: 's' }, binds: 'harness.bridgeMode', label: 'Bridge' },
        { id: 'cue-dream', look: { kind: 'action', tone: 'accent', frame: 'line', size: 's' }, binds: 'harness.cueDream', label: 'Cue Higher Self Dream' },
      ],
    },
  ],
};

// ---- Plan 58 §4.4: Studio Self-Hosted Shell Screen Preset (`STUDIO_SHELL_SCREEN`)

export const STUDIO_SHELL_SOURCES: readonly UiSource[] = [
  { path: 'studio.worldName', kind: 'text' },
  { path: 'studio.rung', kind: 'number', max: 5 },
  { path: 'studio.workspace', kind: 'text' },
  { path: 'studio.uiStyle', kind: 'text' },
  { path: 'studio.stagedCount', kind: 'number' },
];

export const STUDIO_SHELL_COMMANDS: readonly UiCommand[] = [
  { id: 'studio.backToMenu', does: 'Return from The Studio to the Home Menu' },
  { id: 'studio.testPlay', does: 'Enter Test Play in Sandbox with staged presets' },
  { id: 'studio.exportSpore', does: 'Export Spore Card and preset share codes' },
  { id: 'studio.applySave', does: 'Apply staged preset changes to campaign and save' },
];

export const STUDIO_SHELL_SCREEN: UiScreen = {
  id: 'studio-shell',
  tokens: UI_STYLE_SHELF[0]!.tokens,
  panels: [
    {
      id: 'studio-topbar',
      anchor: 'top-left',
      offsetX: 16,
      offsetY: 8,
      visible: true,
      parts: [
        { id: 'act-back', look: { kind: 'action', tone: 'ink', frame: 'line', size: 's' }, binds: 'studio.backToMenu', label: 'Back' },
        { id: 'world-name', look: { kind: 'badge', tone: 'accent', frame: 'line', size: 'm' }, binds: 'studio.worldName', label: 'World' },
        { id: 'rung-num', look: { kind: 'stat', tone: 'ink', frame: 'none', size: 's' }, binds: 'studio.rung', label: 'Rung' },
        { id: 'ws-name', look: { kind: 'readout', tone: 'dim', frame: 'none', size: 's' }, binds: 'studio.workspace', label: 'Workspace' },
      ],
    },
    {
      id: 'studio-actions',
      anchor: 'top-right',
      offsetX: 16,
      offsetY: 8,
      visible: true,
      parts: [
        { id: 'ui-style-readout', look: { kind: 'readout', tone: 'dim', frame: 'none', size: 's' }, binds: 'studio.uiStyle', label: 'UI Style' },
        { id: 'staged-stat', look: { kind: 'stat', tone: 'accent', frame: 'none', size: 's' }, binds: 'studio.stagedCount', label: 'Staged' },
        { id: 'act-test-play', look: { kind: 'action', tone: 'accent', frame: 'line', size: 's' }, binds: 'studio.testPlay', label: 'Test Play in Sandbox' },
        { id: 'act-export-spore', look: { kind: 'action', tone: 'ink', frame: 'line', size: 's' }, binds: 'studio.exportSpore', label: 'Export Spore Card' },
        { id: 'act-apply-save', look: { kind: 'action', tone: 'accent', frame: 'fill', size: 's' }, binds: 'studio.applySave', label: 'Apply to Campaign / Save' },
      ],
    },
  ],
};


