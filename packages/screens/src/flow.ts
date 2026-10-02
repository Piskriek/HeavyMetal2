/**
 * Which screen the player is on, and how they move between screens. Pure and serialisable: the shell keeps one FlowState
 * and feeds it actions; an action that makes no sense on the current screen returns the SAME object, so nothing re-renders.
 */

export type ScreenId = 'title' | 'select' | 'loading' | 'intro' | 'race' | 'paused' | 'results' | 'standings' | 'settings';

export interface FlowState {
  screen: ScreenId;
  /** Where settings and pause return to. */
  previous: ScreenId | null;
  /** 0-based race in the championship. */
  raceIndex: number;
  raceCount: number;
  mode: 'quick' | 'championship';
  selectedRacer: string | null;
  loadingProgress: number;
  /** 3, 2, 1, then 0 = GO. */
  countdown: number;
}

export type FlowAction =
  | { type: 'play'; mode: 'quick' | 'championship'; raceCount?: number }
  | { type: 'selectRacer'; id: string }
  | { type: 'confirmRacer' }
  | { type: 'loadProgress'; value: number }
  | { type: 'loaded' }
  | { type: 'tickCountdown' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'finish' }
  | { type: 'continue' }
  | { type: 'restart' }
  | { type: 'openSettings' }
  | { type: 'closeSettings' }
  | { type: 'quit' };

export function initialFlow(): FlowState {
  return { screen: 'title', previous: null, raceIndex: 0, raceCount: 1, mode: 'quick', selectedRacer: null, loadingProgress: 0, countdown: 3 };
}

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

export function canPause(s: FlowState): boolean { return s.screen === 'race' || s.screen === 'intro'; }
export function isRacing(s: FlowState): boolean { return s.screen === 'intro' || s.screen === 'race' || s.screen === 'paused'; }

const loading = (s: FlowState, raceIndex = s.raceIndex): FlowState => ({ ...s, screen: 'loading', previous: null, raceIndex, loadingProgress: 0, countdown: 3 });

export function reduceFlow(s: FlowState, a: FlowAction): FlowState {
  switch (a.type) {
    case 'play': {
      if (s.screen !== 'title') return s;
      const count = a.mode === 'quick' ? 1 : clamp(Math.round(Number.isFinite(a.raceCount) ? (a.raceCount as number) : 4), 1, 12);
      return { ...s, screen: 'select', previous: null, mode: a.mode, raceCount: count, raceIndex: 0 };
    }
    case 'selectRacer':
      return s.screen === 'select' && s.selectedRacer !== a.id ? { ...s, selectedRacer: a.id } : s;
    case 'confirmRacer':
      return s.screen === 'select' && s.selectedRacer !== null ? loading(s, 0) : s;
    case 'loadProgress':
      return s.screen === 'loading' ? { ...s, loadingProgress: clamp(Number.isFinite(a.value) ? a.value : 0, 0, 1) } : s;
    case 'loaded':
      return s.screen === 'loading' ? { ...s, screen: 'intro', loadingProgress: 1, countdown: 3 } : s;
    case 'tickCountdown':
      if (s.screen !== 'intro') return s;
      return s.countdown > 0 ? { ...s, countdown: s.countdown - 1 } : { ...s, screen: 'race' };
    case 'pause':
      return s.screen === 'race' || s.screen === 'intro' ? { ...s, screen: 'paused', previous: s.screen } : s;
    case 'resume':
      return s.screen === 'paused' ? { ...s, screen: s.previous === 'intro' ? 'intro' : 'race', previous: null } : s;
    case 'finish':
      return s.screen === 'race' ? { ...s, screen: 'results', previous: null } : s;
    case 'continue':
      if (s.screen === 'results') return s.mode === 'championship' ? { ...s, screen: 'standings' } : { ...initialFlow(), selectedRacer: s.selectedRacer };
      if (s.screen === 'standings') return s.raceIndex + 1 < s.raceCount ? loading(s, s.raceIndex + 1) : { ...initialFlow(), selectedRacer: s.selectedRacer };
      return s;
    case 'restart':
      if (s.screen === 'paused') return loading(s);
      if ((s.screen === 'results' || s.screen === 'standings') && s.mode === 'quick') return loading(s);
      return s;
    case 'openSettings':
      return s.screen === 'title' || s.screen === 'paused' ? { ...s, screen: 'settings', previous: s.screen } : s;
    case 'closeSettings':
      return s.screen === 'settings' ? { ...s, screen: s.previous ?? 'title', previous: s.previous === 'paused' ? 'race' : null } : s;
    case 'quit':
      return s.screen === 'paused' ? { ...initialFlow(), selectedRacer: s.selectedRacer } : s;
  }
}
