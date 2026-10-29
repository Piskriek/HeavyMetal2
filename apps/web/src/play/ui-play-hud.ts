/**
 * Plan 57 §15: the play HUD as a `ui:` screen, panel by panel; the goal card first (Argon, 29 Oct: no rung changes; wire it to the
 * live stage and next-stage values), then the floats pill, then the plot's ore and power and the health on the `stat` widget
 * (Argon's yes to the rung change). The screen is data: its panels, their parts and what each part reads. The sources are the
 * values the HUD really has; validateScreen holds the screen to them (a lens, never a lie), and the renderer draws a part only
 * when its source has a value.
 */
import { validateScreen, type UiCommand, type UiPanel, type UiPart, type UiScreen, type UiSource } from '@hm/hudlayout';
import { PLAYER_MAX_HP } from '../monsters/policy';

/** The four floats, in the HUD's order (the constitution's S = Pxd, Vtx, Lx, Aq). */
export const FLOAT_KEYS = ['pxd', 'vtx', 'lx', 'aq'] as const;

/**
 * What the play HUD can show: the goal card's lines, the plot's stage and its four levels (each 0 to 100), its ore and power, and
 * the player's health.
 */
export const PLAY_HUD_SOURCES: readonly UiSource[] = [
  { path: 'goal.title', kind: 'text' },
  { path: 'goal.hint', kind: 'text' },
  { path: 'goal.next', kind: 'text' },
  { path: 'plot.stage', kind: 'stage' },
  ...FLOAT_KEYS.map((k): UiSource => ({ path: `floats.${k}`, kind: 'number', max: 100 })),
  { path: 'plot.ore', kind: 'number', unit: 'ore' },
  { path: 'plot.oreRate', kind: 'number' },
  /** The ore in the crates linked to the plot. */
  { path: 'plot.oreLinked', kind: 'number' },
  /** No ore, and no drill to make more. */
  { path: 'plot.oreOut', kind: 'flag' },
  { path: 'power.demand', kind: 'number', unit: 'kW' },
  { path: 'power.supply', kind: 'number', unit: 'kW' },
  /** How much of the demand the supply meets. */
  { path: 'power.met', kind: 'ratio' },
  /** The supply falls short of the demand. */
  { path: 'power.short', kind: 'flag' },
  { path: 'player.hp', kind: 'number', max: PLAYER_MAX_HP },
  { path: 'player.hpMax', kind: 'number' },
  /** The reflex shield is up and soaks most of each hit. */
  { path: 'player.shielded', kind: 'flag' },
  /** The health is low and no shield takes the hits. */
  { path: 'player.lowWarning', kind: 'flag' },
  /** The drone's System notice showing now (Plan 57 §8.1), or none. */
  { path: 'system.notice', kind: 'text' },
];

/** The drone's System window (top centre, under the compass): the notice showing now, one at a time (Plan 57 §8.1). */
export const PLAY_HUD_SYSTEM: UiPanel = {
  id: 'system',
  anchor: 'top-center',
  offsetX: 0,
  offsetY: 76,
  visible: true,
  parts: [
    { id: 'notice', look: { kind: 'readout', tone: 'accent', frame: 'line', size: 'm' }, binds: 'system.notice', label: 'System' },
  ],
};

/** What the play HUD can do when pressed. */
export const PLAY_HUD_COMMANDS: readonly UiCommand[] = [
  { id: 'comms.toggle', does: 'Opens or closes the comms with Overwatch' },
];

/** The comms chip (bottom left): one action, opening the comms; its words carry the key that does the same. */
export const PLAY_HUD_COMMS: UiPanel = {
  id: 'comms',
  anchor: 'bottom-left',
  offsetX: 0,
  offsetY: 0,
  visible: true,
  parts: [
    { id: 'comms-toggle', look: { kind: 'action', tone: 'accent', frame: 'fill', size: 's' }, binds: 'comms.toggle', label: 'COMMS · OVERWATCH [Enter]' },
  ],
};

/** The plot's figures (bottom right): its ore, with its rate and the linked crates' ore, and the power drawn of the supply. */
export const PLAY_HUD_PLOT: UiPanel = {
  id: 'plot',
  anchor: 'bottom-right',
  offsetX: 0,
  offsetY: 0,
  visible: true,
  parts: [
    {
      id: 'ore', look: { kind: 'stat', tone: 'ink', frame: 'none', size: 'm' }, binds: 'plot.ore', label: 'Ore',
      with: { rate: 'plot.oreRate', linked: 'plot.oreLinked', alert: 'plot.oreOut' }, note: 'Out of ore: hold E on a boulder, or build a rock drill',
    },
    {
      id: 'power', look: { kind: 'stat', tone: 'ink', frame: 'none', size: 'm' }, binds: 'power.demand', label: 'Power',
      with: { of: 'power.supply', share: 'power.met', alert: 'power.short' },
    },
  ],
};

/** The health plate (bottom right): the hit points of the top, the segmented bar, and a note when the shield is up or the health low. */
export const PLAY_HUD_HEALTH: UiPanel = {
  id: 'health',
  anchor: 'bottom-right',
  offsetX: 0,
  offsetY: 0,
  visible: true,
  parts: [
    { id: 'hp', look: { kind: 'stat', tone: 'ink', frame: 'none', size: 'l' }, binds: 'player.hp', label: 'Health', with: { of: 'player.hpMax' } },
    { id: 'hp-bar', look: { kind: 'meter', tone: 'accent', frame: 'line', size: 'm' }, binds: 'player.hp', label: 'Health' },
    { id: 'shield', look: { kind: 'readout', tone: 'accent', frame: 'none', size: 's' }, binds: 'player.shielded', label: 'Shield up: hits do a fifth of their damage.' },
    { id: 'low', look: { kind: 'readout', tone: 'warn', frame: 'none', size: 's' }, binds: 'player.lowWarning', label: 'Low. Back off to the gate and patch up.' },
  ],
};

/** The floats pill: the stage badge, then a meter per float (the players' words for them as labels). */
export const PLAY_HUD_FLOATS: UiPanel = {
  id: 'floats',
  anchor: 'top-right',
  offsetX: 0,
  offsetY: 0,
  visible: true,
  parts: [
    { id: 'stage', look: { kind: 'badge', tone: 'ink', frame: 'fill', size: 's' }, binds: 'plot.stage', label: 'Stage' },
    ...([['pxd', 'texture'], ['vtx', 'shape'], ['lx', 'light'], ['aq', 'water']] as const).map(([k, name]): UiPart => ({
      id: k, look: { kind: 'meter', tone: 'accent', frame: 'line', size: 's' }, binds: `floats.${k}`, label: name,
    })),
  ],
};

/** The goal card: the stage (or the step) and what it needs next, then the chain's next step when there is one. */
export const PLAY_HUD_GOAL: UiPanel = {
  id: 'goal',
  anchor: 'top-left',
  offsetX: 0,
  offsetY: 0,
  visible: true,
  parts: [
    { id: 'title', look: { kind: 'card', tone: 'ink', frame: 'none', size: 'l' }, binds: 'goal.title', label: 'Goal' },
    { id: 'hint', look: { kind: 'readout', tone: 'dim', frame: 'none', size: 'm' }, binds: 'goal.hint', label: 'What it needs' },
    { id: 'next', look: { kind: 'badge', tone: 'dim', frame: 'none', size: 's' }, binds: 'goal.next', label: 'Next' },
  ],
};

/** The play HUD's screen: its tokens are the HUD's own look, and its panels so far. */
export const PLAY_HUD_SCREEN: UiScreen = {
  id: 'play-hud',
  tokens: { ink: '#f1f4f5', paper: '#0c1014', accent: '#a050c8', warn: '#e0502a', dim: '#8a96a3', font: 'setmix', scale: 1, radius: 4, reducedMotion: false },
  panels: [PLAY_HUD_GOAL, PLAY_HUD_FLOATS, PLAY_HUD_PLOT, PLAY_HUD_HEALTH, PLAY_HUD_COMMS, PLAY_HUD_SYSTEM],
};

const FLOAT_PATTERNS = ['solid', 'hatch', 'steps', 'dots'] as const;

/**
 * The floats pill's drawing props: the panel, its live values, and the pill's own classes, colours and patterns (the HUD's look;
 * hud-zones.tsx FloatsPill drew the same markup by hand). Each float keeps its pattern as well as its colour, so the four read apart
 * without colour.
 */
export function floatsPanelProps(stage: number, levels: Readonly<Record<(typeof FLOAT_KEYS)[number], number>>, colours: Readonly<Record<(typeof FLOAT_KEYS)[number], string>>) {
  return {
    panel: PLAY_HUD_FLOATS,
    values: floatsValues(stage, levels),
    element: 'div' as const,
    className: 'hud-floats',
    hudZone: 'top-right',
    ariaLabel: `Fidelity floats, stage ${stage}`,
    partClass: { stage: 'hud-stage-badge' },
    partTag: { stage: 'span' as const },
    partStyle: Object.fromEntries(FLOAT_KEYS.map((k) => [k, { '--c': colours[k] } as Record<string, string>])),
    partData: Object.fromEntries(FLOAT_KEYS.map((k) => [k, { metric: k }])),
    format: { stage: (v: string | number) => `S${v}`, ...Object.fromEntries(FLOAT_KEYS.map((k) => [k, (v: string | number) => String(Math.floor(Number(v)))])) },
    meter: { list: 'hud-floats-bars', label: 'hud-float-name', bar: (id: string) => `hud-float-bar pat-${FLOAT_PATTERNS[FLOAT_KEYS.indexOf(id as (typeof FLOAT_KEYS)[number])] ?? 'solid'}` },
    meterMax: Object.fromEntries(FLOAT_KEYS.map((k) => [k, 100])),
  };
}

/** The floats pill's values: the stage and each level as play knows them now. */
export function floatsValues(stage: number, levels: Readonly<Record<(typeof FLOAT_KEYS)[number], number>>): Readonly<Record<string, number>> {
  return { 'plot.stage': stage, ...Object.fromEntries(FLOAT_KEYS.map((k) => [`floats.${k}`, levels[k]])) };
}

/** The issues of the play HUD's screen against its sources ([] when it may be shown; the unit test holds it there). */
export const playHudIssues = (): ReturnType<typeof validateScreen> => validateScreen(PLAY_HUD_SCREEN, PLAY_HUD_SOURCES, PLAY_HUD_COMMANDS);

/** The goal card's values from what play knows now; a missing value (null) draws nothing. */
export function goalValues(o: { readonly title: string; readonly hint: string; readonly next: string | null }): Readonly<Record<string, string | null>> {
  return { 'goal.title': o.title, 'goal.hint': o.hint, 'goal.next': o.next };
}

/** What the plot panel shows now. */
export interface PlotFigures {
  readonly ore: number;
  readonly oreRate: number;
  readonly oreLinked: number;
  /** No ore and no drill. */
  readonly oreOut: boolean;
  readonly demand: number;
  readonly supply: number;
  /** 0 to 1: how much of the demand the supply meets. */
  readonly satisfaction: number;
}

const signedTenth = (v: string | number): string => { const n = Number(v); return `${n >= 0 ? '+' : ''}${n.toFixed(1)}`; };
const whole = (v: string | number): string => Number(v).toFixed(0);

/**
 * The plot panel's drawing props: its parts go into the plot section (beside the visiting banner), in the classes the hand-drawn
 * ticker and power line had (play.tsx before the stat).
 */
export function plotPanelProps(o: PlotFigures) {
  return {
    panel: PLAY_HUD_PLOT,
    sources: PLAY_HUD_SOURCES,
    element: 'none' as const,
    values: {
      'plot.ore': o.ore, 'plot.oreRate': o.oreRate, 'plot.oreLinked': o.oreLinked, 'plot.oreOut': o.oreOut,
      'power.demand': o.demand, 'power.supply': o.supply, 'power.met': o.satisfaction, 'power.short': o.satisfaction < 0.999,
    },
    partClass: { ore: 'play-ore', 'ore.alert': 'out-of-ore', 'ore.linked': 'play-ore-linked', 'ore.note': 'play-ore-warn', power: 'play-power', 'power.alert': 'short', 'power.share': 'play-power-pct' },
    partData: { ore: { testid: 'plot-ore-ticker' } },
    format: { ore: (v: string | number) => String(Math.floor(Number(v))), 'ore.rate': signedTenth, power: whole, 'power.of': whole },
  };
}

/** The health plate's drawing props, in the classes MonsterHud's hand-drawn plate had; `low` is MonsterHud's own call. */
export function healthPanelProps(o: { readonly hp: number; readonly maxHp: number; readonly low: boolean; readonly shielded: boolean }) {
  const { hp, maxHp, low, shielded } = o;
  const shown = (v: string | number): string => String(Math.max(0, Math.round(Number(v))));
  return {
    panel: PLAY_HUD_HEALTH,
    sources: PLAY_HUD_SOURCES,
    values: { 'player.hp': hp, 'player.hpMax': maxHp, 'player.shielded': shielded, 'player.lowWarning': low && !shielded },
    className: `mhud-plate mhud-vitals${low ? ' low' : ''}${shielded ? ' shielded' : ''}`,
    hudZone: 'bottom-right',
    ariaLabel: 'Health',
    live: false,
    title: { text: 'Health', className: 'mhud-title' },
    partTag: { hp: 'div' as const },
    partClass: { hp: 'mhud-figure', 'hp.of': 'mhud-figure-of', 'hp-bar': 'mhud-bar', shield: 'mhud-shield-note', low: 'mhud-note' },
    format: { hp: shown, 'hp-bar': shown },
    meterMax: { 'hp-bar': maxHp },
    segments: { 'hp-bar': 20 },
  };
}

/** The comms chip's drawing props, in the classes the hand-drawn chip had (companion-chat.tsx before the action). */
export function commsPanelProps(onToggle: () => void) {
  return {
    panel: PLAY_HUD_COMMS,
    values: {},
    element: 'none' as const,
    actions: { 'comms.toggle': onToggle },
    partClass: { 'comms-toggle': 'companion-chat-toggle' },
    partData: { 'comms-toggle': { testid: 'companion-comms-toggle' } },
    partIcon: { 'comms-toggle': 'companion-chat-orb' },
    partAria: { 'comms-toggle': 'Toggle Companion Comms (Enter to type, hold T to talk)' },
  };
}

/**
 * The System window's drawing props for the notice showing now: its kind (`SYS-SKILL`) rides on the window as `data-notice`, so
 * the edge takes the kind's colour, and the window announces itself to a screen reader.
 */
export function systemPanelProps(notice: { readonly id: string; readonly text: string }) {
  return {
    panel: PLAY_HUD_SYSTEM,
    values: { 'system.notice': notice.text },
    className: 'sys-notice',
    // the HUD's own zone word (the overlap gate reads it): the window sits under the compass, in the top-centre zone's column
    hudZone: 'top-centre',
    ariaLabel: 'System',
    partClass: { notice: 'sys-notice-text' },
    partData: { notice: { notice: notice.id } },
  };
}
