/**
 * Plan 57 §15: the play HUD as a `ui:` screen, panel by panel; the goal card first (Argon, 29 Oct: no rung changes; wire it to the
 * live stage and next-stage values). The screen is data: its panels, their parts and what each part reads. The sources are the
 * values the HUD really has; validateScreen holds the screen to them (a lens, never a lie), and the renderer draws a part only
 * when its source has a value.
 */
import { validateScreen, type UiPanel, type UiScreen, type UiSource } from '@hm/hudlayout';

/** What the play HUD can show, as the goal card reads it. */
export const PLAY_HUD_SOURCES: readonly UiSource[] = [
  { path: 'goal.title', kind: 'text' },
  { path: 'goal.hint', kind: 'text' },
  { path: 'goal.next', kind: 'text' },
];

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
  panels: [PLAY_HUD_GOAL],
};

/** The issues of the play HUD's screen against its sources ([] when it may be shown; the unit test holds it there). */
export const playHudIssues = (): ReturnType<typeof validateScreen> => validateScreen(PLAY_HUD_SCREEN, PLAY_HUD_SOURCES);

/** The goal card's values from what play knows now; a missing value (null) draws nothing. */
export function goalValues(o: { readonly title: string; readonly hint: string; readonly next: string | null }): Readonly<Record<string, string | null>> {
  return { 'goal.title': o.title, 'goal.hint': o.hint, 'goal.next': o.next };
}
