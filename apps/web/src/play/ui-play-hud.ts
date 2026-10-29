/**
 * Plan 57 §15: the play HUD as a `ui:` screen, panel by panel; the goal card first (Argon, 29 Oct: no rung changes; wire it to the
 * live stage and next-stage values). The screen is data: its panels, their parts and what each part reads. The sources are the
 * values the HUD really has; validateScreen holds the screen to them (a lens, never a lie), and the renderer draws a part only
 * when its source has a value.
 */
import { validateScreen, type UiPanel, type UiPart, type UiScreen, type UiSource } from '@hm/hudlayout';

/** The four floats, in the HUD's order (the constitution's S = Pxd, Vtx, Lx, Aq). */
export const FLOAT_KEYS = ['pxd', 'vtx', 'lx', 'aq'] as const;

/** What the play HUD can show: the goal card's lines, the plot's stage and its four levels (each 0 to 100). */
export const PLAY_HUD_SOURCES: readonly UiSource[] = [
  { path: 'goal.title', kind: 'text' },
  { path: 'goal.hint', kind: 'text' },
  { path: 'goal.next', kind: 'text' },
  { path: 'plot.stage', kind: 'stage' },
  ...FLOAT_KEYS.map((k): UiSource => ({ path: `floats.${k}`, kind: 'number', max: 100 })),
];

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

/** The play HUD's screen: its tokens are the HUD's own look, and the goal card is its first panel. */
export const PLAY_HUD_SCREEN: UiScreen = {
  id: 'play-hud',
  tokens: { ink: '#f1f4f5', paper: '#0c1014', accent: '#a050c8', warn: '#e0502a', dim: '#8a96a3', font: 'setmix', scale: 1, radius: 4, reducedMotion: false },
  panels: [PLAY_HUD_GOAL, PLAY_HUD_FLOATS],
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
export const playHudIssues = (): ReturnType<typeof validateScreen> => validateScreen(PLAY_HUD_SCREEN, PLAY_HUD_SOURCES);

/** The goal card's values from what play knows now; a missing value (null) draws nothing. */
export function goalValues(o: { readonly title: string; readonly hint: string; readonly next: string | null }): Readonly<Record<string, string | null>> {
  return { 'goal.title': o.title, 'goal.hint': o.hint, 'goal.next': o.next };
}
