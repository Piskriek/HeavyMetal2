/**
 * Plan 57 §15: the interface is presets too. A `ui:` preset climbs the same five rungs as every preset:
 *   1 tokens: colour, type, scale, corner, motion
 *   2 widget looks: a readout, a meter, a card, a badge, a list, a stat, each in a tone, a frame and a size
 *   3 parts: a widget bound to a real value
 *   4 panels: parts placed by anchor and offset (the HUD layout's own anchors and pixel offsets)
 *   5 a screen: its tokens and its panels
 * The System HUD's rule binds rung 3: a lens, never a lie. A part reads a declared source (a value the screen really has), and a
 * part with no source to read cannot be placed: validateScreen says so. These are universal operators, not one game's templates:
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
export type WidgetKind = 'readout' | 'meter' | 'card' | 'badge' | 'list' | 'stat';
export const WIDGET_KINDS: readonly WidgetKind[] = ['readout', 'meter', 'card', 'badge', 'list', 'stat'];
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
  /** The source path this part reads; it must be one the screen declares. */
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

/** What is wrong with a screen against the sources it may read; [] when it may be shown. Never throws. */
export function validateScreen(screen: UiScreen, sources: readonly UiSource[]): UiIssue[] {
  const out: UiIssue[] = [];
  const byPath = new Map(sources.map((s) => [s.path, s]));
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
      const src = byPath.get(part.binds);
      // the lens rule: a part with nothing real to read cannot be placed
      if (!src) { out.push({ code: 'unbound', at, detail: `${part.binds} is not a value this screen has` }); continue; }
      if (!WIDGET_READS[part.look.kind].includes(src.kind)) out.push({ code: 'wrong-widget', at, detail: `a ${part.look.kind} cannot show a ${src.kind}` });
      else if (part.look.kind === 'meter' && src.kind === 'number' && !(typeof src.max === 'number' && src.max > 0)) out.push({ code: 'meter-without-range', at, detail: `${part.binds} has no max, so a meter would invent its scale` });
      const extra = STAT_BINDS.filter((k) => part.with?.[k] !== undefined);
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
const LOOK: Field = { kind: 'object', fields: { kind: enumOf(WIDGET_KINDS), tone: enumOf(WIDGET_TONES), frame: enumOf(WIDGET_FRAMES), size: enumOf(WIDGET_SIZES) } };
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
const PART_V2: Field = {
  kind: 'object',
  fields: {
    id: str(UI_LIMITS.idBytes), look: LOOK, binds: str(UI_LIMITS.pathBytes), label: str(UI_LIMITS.labelBytes),
    ...Object.fromEntries(STAT_BINDS.map((k) => [k, str(UI_LIMITS.pathBytes)])), note: str(UI_LIMITS.labelBytes),
  },
};
export const UI_SCREEN_SCHEMA: Schema = screenSchema(2, PART_V2);
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
    const v2 = decode(UI_SCREEN_SCHEMA, body);
    if (v2) return mapParts(v2 as unknown as ScreenOf<FlatPart>, fullPart);
    // a code from before the stat reads as it was
    const v1 = decode(UI_SCREEN_SCHEMA_V1, body);
    return v1 ? (v1 as UiScreen) : null;
  } catch {
    return null;
  }
}
