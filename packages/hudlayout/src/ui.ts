/**
 * Plan 57 §15: the interface is presets too. A `ui:` preset climbs the same five rungs as every preset:
 *   1 tokens: colour, type, scale, corner, motion
 *   2 widget looks: a readout, a meter, a card, a badge, a list, each in a tone, a frame and a size
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
export type WidgetKind = 'readout' | 'meter' | 'card' | 'badge' | 'list';
export const WIDGET_KINDS: readonly WidgetKind[] = ['readout', 'meter', 'card', 'badge', 'list'];
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
/** What a screen really has to show: a value's path and what kind of value it is (a meter needs a ratio, or a number and its max). */
export type SourceKind = 'number' | 'ratio' | 'text' | 'stage' | 'list';
export interface UiSource {
  readonly path: string;
  readonly kind: SourceKind;
  /** A number's top, so a meter can show it as a share. */
  readonly max?: number;
}
export interface UiPart {
  readonly id: string;
  readonly look: WidgetLook;
  /** The source path this part reads; it must be one the screen declares. */
  readonly binds: string;
  /** The player's word for it (shown beside the value), never a value of its own. */
  readonly label: string;
}

/** Which widget can show which kind of source. */
export const WIDGET_READS: Readonly<Record<WidgetKind, readonly SourceKind[]>> = {
  readout: ['number', 'ratio', 'text', 'stage'],
  meter: ['ratio', 'number'],
  card: ['text', 'stage'],
  badge: ['text', 'stage'],
  list: ['list'],
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

export const UI_LIMITS = { panels: 16, partsPerPanel: 8, offset: 400, idBytes: 32, labelBytes: 48, pathBytes: 48 } as const;

export type UiIssueCode = 'unbound' | 'wrong-widget' | 'meter-without-range' | 'duplicate-id' | 'off-screen' | 'bad-colour' | 'empty-panel' | 'out-of-range';
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
    }
  }
  return out;
}

// ---- the code
const enumOf = (options: readonly string[]): Field => ({ kind: 'enum', options });
const str = (maxBytes: number): Field => ({ kind: 'string', maxBytes });
const LOOK: Field = { kind: 'object', fields: { kind: enumOf(WIDGET_KINDS), tone: enumOf(WIDGET_TONES), frame: enumOf(WIDGET_FRAMES), size: enumOf(WIDGET_SIZES) } };
const PART: Field = { kind: 'object', fields: { id: str(UI_LIMITS.idBytes), look: LOOK, binds: str(UI_LIMITS.pathBytes), label: str(UI_LIMITS.labelBytes) } };
const PANEL: Field = {
  kind: 'object',
  fields: {
    id: str(UI_LIMITS.idBytes), anchor: enumOf(UI_ANCHORS), visible: { kind: 'bool' },
    offsetX: { kind: 'int', min: -UI_LIMITS.offset, max: UI_LIMITS.offset }, offsetY: { kind: 'int', min: -UI_LIMITS.offset, max: UI_LIMITS.offset },
    parts: { kind: 'array', of: PART, maxLength: UI_LIMITS.partsPerPanel },
  },
};
export const UI_SCREEN_SCHEMA: Schema = {
  id: 'hm.ui.screen',
  version: 1,
  root: {
    kind: 'object',
    fields: {
      id: str(UI_LIMITS.idBytes),
      tokens: {
        kind: 'object',
        fields: {
          ink: { kind: 'color' }, paper: { kind: 'color' }, accent: { kind: 'color' }, warn: { kind: 'color' }, dim: { kind: 'color' },
          font: enumOf(UI_FONTS), scale: { kind: 'float', min: 0.75, max: 1.5, step: 0.05 }, radius: { kind: 'int', min: 0, max: 12 }, reducedMotion: { kind: 'bool' },
        },
      },
      panels: { kind: 'array', of: PANEL, maxLength: UI_LIMITS.panels },
    },
  },
};

/** A player's own screen's prefix; a shelf screen keeps its name, `ui:<id>`. */
export const UI_CODE_PREFIX = 'uic:';

/** A screen as a short text code. Throws only on a value the schema cannot hold (validate first). */
export function encodeScreen(screen: UiScreen): string {
  return UI_CODE_PREFIX + encode(UI_SCREEN_SCHEMA, screen);
}

/** The screen a code stands for, or null for a damaged, foreign or unprefixed code. Never throws. */
export function decodeScreen(code: string): UiScreen | null {
  if (!code.startsWith(UI_CODE_PREFIX)) return null;
  try {
    const v = decode(UI_SCREEN_SCHEMA, code.slice(UI_CODE_PREFIX.length));
    return v ? (v as UiScreen) : null;
  } catch {
    return null;
  }
}
