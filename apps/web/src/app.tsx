import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactElement } from 'react';
import type { Runtime } from '@hm/engine';
import { RACERS } from '@hm/content';
import {
  CharacterSelect, DEFAULT_SETTINGS, LoadingScreen, PauseMenu, ResultsScreen, ScreenStyles, SettingsScreen, StandingsScreen, TitleScreen, canPause, initialFlow, reduceFlow, tipFor,
  type FlowAction, type FlowState, type RacerCard, type ResultRow, type Settings, type StandingRow,
} from '@hm/screens';
import { audio, setSoundEnabled } from './maker/feedback';
import { RaceView, type RaceSetup } from './race-view';
import { themeOf } from './ui-preset';

const POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const KEY_SETTINGS = 'hm.settings', KEY_CUSTOM = 'hm.custom', KEY_RACER = 'hm.lastRacer';

const CARDS: RacerCard[] = RACERS.map((r, i) => ({
  id: String(i), name: r.name, color: String(r.params['color']), accent: String(r.params['accent']),
  weight: Number(r.params['weight']), speed: Number(r.params['speed']), bounce: Number(r.params['bounce']),
  ...(r.doc ? { blurb: r.doc } : {}),
}));
const DEFAULT_CUSTOM: RacerCard = { id: 'custom', name: 'My goblin', color: '#7cd24a', accent: '#ff7a3d', weight: 5, speed: 5, bounce: 5 };

const load = <T,>(key: string, fallback: T): T => { try { const raw = localStorage.getItem(key); return raw ? { ...fallback, ...(JSON.parse(raw) as object) } as T : fallback; } catch { return fallback; } };
const save = (key: string, value: unknown): void => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage may be unavailable */ } };

/**
 * The whole game: title, goblin select, loading, the race with its countdown and pause, results and the championship table.
 * The screen flow is a pure reducer (`@hm/screens`); this component owns the race view, the settings and the standings.
 */
export function App({ rt, fromMap, autoStart = false, onEditor, entry, onExit }: { readonly rt: Runtime; readonly fromMap: boolean; readonly autoStart?: boolean; readonly onEditor?: () => void; readonly entry?: 'select' | 'custom'; readonly onExit?: () => void }): ReactElement {
  const [settings, setSettings] = useState<Settings>(() => load(KEY_SETTINGS, DEFAULT_SETTINGS));
  const [custom, setCustom] = useState<RacerCard>(() => load(KEY_CUSTOM, DEFAULT_CUSTOM));
  const [flow, dispatch] = useReducer(reduceFlow, undefined, (): FlowState => {
    const first = initialFlow();
    if (entry) {
      const acts: FlowAction[] = [{ type: 'play', mode: 'quick' }];
      if (entry === 'custom') acts.push({ type: 'selectRacer', id: 'custom' });
      return acts.reduce((st, a) => reduceFlow(st, a), first);
    }
    if (!autoStart) return first;
    let last = '0';
    try { last = localStorage.getItem(KEY_RACER) ?? '0'; } catch { /* default goblin */ }
    return [{ type: 'play', mode: 'quick' }, { type: 'selectRacer', id: last }, { type: 'confirmRacer' }].reduce((s, a) => reduceFlow(s, a as never), first);
  });
  const theme = useMemo(() => themeOf(rt), [rt]);
  // inside the shell the title screen is the activity menu: going back to it leaves the game
  useEffect(() => { if (onExit && flow.screen === 'title') onExit(); }, [flow.screen, onExit]);
  const [raceKey, setRaceKey] = useState(() => (flow.screen === 'loading' ? 1 : 0));
  const [results, setResults] = useState<ResultRow[] | null>(null);
  const [table, setTable] = useState<Record<string, StandingRow>>({});
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const loadedAt = useRef(performance.now());
  const flowRef = useRef(flow);
  flowRef.current = flow;

  /** Every action goes through here: entering the loading screen also starts a fresh race view (new game, grid and lights). */
  const go = useCallback((a: FlowAction): void => {
    const cur = flowRef.current;
    const next = reduceFlow(cur, a);
    if (next.screen === 'loading' && cur.screen !== 'loading') {
      setRaceKey((n) => n + 1); setReady(false); setResults(null); setProgress(0); loadedAt.current = performance.now();
      try { if (next.selectedRacer) localStorage.setItem(KEY_RACER, next.selectedRacer); } catch { /* ignore */ }
    }
    dispatch(a);
  }, []);

  useEffect(() => { save(KEY_SETTINGS, settings); audio()?.setVolumes({ master: settings.master, sfx: settings.sfx, music: settings.music }); setSoundEnabled(settings.master > 0); }, [settings]);
  useEffect(() => { save(KEY_CUSTOM, custom); }, [custom]);

  const setup = useMemo<RaceSetup>(() => {
    const id = flow.selectedRacer;
    if (id === 'custom') return { fromMap, player: { name: custom.name, params: { weight: custom.weight, speed: custom.speed, bounce: custom.bounce, color: custom.color, accent: custom.accent } } };
    return { fromMap, playerIndex: Number(id ?? 0) || 0 };
  }, [fromMap, flow.selectedRacer, custom]);

  const inRace = flow.screen === 'loading' || flow.screen === 'intro' || flow.screen === 'race' || flow.screen === 'paused' || flow.screen === 'results' || flow.screen === 'standings'
    || (flow.screen === 'settings' && flow.previous === 'paused');

  // loading bar: moves while the race view builds, finishes once it has drawn a few frames (and never flashes by)
  useEffect(() => {
    if (flow.screen !== 'loading') return;
    const t = setInterval(() => {
      const elapsed = performance.now() - loadedAt.current;
      const p = Math.min(ready ? 1 : 0.9, elapsed / 1200);
      setProgress(p);
      dispatch({ type: 'loadProgress', value: p });
      if (ready && elapsed > 1000) { clearInterval(t); dispatch({ type: 'loaded' }); }
    }, 60);
    return () => clearInterval(t);
  }, [flow.screen, ready, raceKey]);

  const onResults = useCallback((rows: ResultRow[]) => {
    const gained = rows.map((r) => ({ ...r, pointsGained: r.dnf ? 0 : (POINTS[r.position - 1] ?? 0) }));
    setResults(gained);
    setTable((t) => {
      const next = { ...t };
      for (const r of gained) {
        const cur = next[r.name] ?? { id: r.name, name: r.name, color: r.color, points: 0, wins: 0, best: 99 };
        next[r.name] = { ...cur, points: cur.points + (r.pointsGained ?? 0), wins: cur.wins + (r.position === 1 && !r.dnf ? 1 : 0), best: Math.min(cur.best, r.dnf ? 99 : r.position) };
      }
      return next;
    });
    go({ type: 'finish' });
  }, []);

  // Esc or P pauses and resumes
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape' && e.key.toLowerCase() !== 'p') return;
      if (canPause(flow)) { e.preventDefault(); go({ type: 'pause' }); }
      else if (flow.screen === 'paused') { e.preventDefault(); go({ type: 'resume' }); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flow]);

  // a new championship starts with a clean table
  useEffect(() => { if (flow.screen === 'select') setTable({}); }, [flow.screen]);

  const patch = (p: Partial<Settings>): void => setSettings((s) => ({ ...s, ...p }));
  const standings = Object.values(table);
  const playerName = results?.find((r) => r.isPlayer)?.name;
  const final = flow.mode === 'championship' && flow.raceIndex + 1 >= flow.raceCount;
  const quickContinue = flow.mode === 'quick' ? 'Back to title' : 'Standings';

  return (
    <div className="game-app" style={{ position: 'absolute', inset: 0, ...theme.vars }}>
      <ScreenStyles />
      {theme.hudCss ? <style>{theme.hudCss}</style> : null}
      {inRace ? (
        <RaceView key={raceKey} rt={rt} setup={setup} settings={settings} layout={theme.layout}
          active={flow.screen === 'intro' || flow.screen === 'race' || flow.screen === 'results' || flow.screen === 'standings'}
          pausable={canPause(flow)}
          paused={flow.screen === 'paused' || (flow.screen === 'settings' && flow.previous === 'paused')}
          onReady={() => setReady(true)} onRacing={() => go({ type: 'raceStart' })} onResults={onResults} onPause={() => go({ type: 'pause' })} />
      ) : null}
      {flow.screen === 'title' && !onExit ? <TitleScreen title={theme.title} subtitle={theme.subtitle} quickLabel={theme.quickLabel} seriesLabel={theme.seriesLabel} reducedMotion={settings.reducedMotion} onPlay={(mode) => go({ type: 'play', mode })} onSettings={() => go({ type: 'openSettings' })} {...(onEditor ? { onEditor } : {})} /> : null}
      {flow.screen === 'select' ? (
        <CharacterSelect racers={CARDS} selected={flow.selectedRacer} reducedMotion={settings.reducedMotion} custom={custom} onCustomChange={(c) => { setCustom(c); if (flow.selectedRacer === 'custom') go({ type: 'selectRacer', id: 'custom' }); }}
          onSelect={(id) => go({ type: 'selectRacer', id })} onConfirm={() => go({ type: 'confirmRacer' })} onBack={() => go({ type: 'back' })} />
      ) : null}
      {flow.screen === 'loading' ? <div style={{ position: 'absolute', inset: 0 }}><LoadingScreen progress={progress} tip={tipFor(raceKey + flow.raceIndex)} reducedMotion={settings.reducedMotion} title={flow.mode === 'championship' ? `Race ${flow.raceIndex + 1} of ${flow.raceCount}` : 'Loading Basalt Isle'} /></div> : null}
      {flow.screen === 'paused' ? <PauseMenu onResume={() => go({ type: 'resume' })} onRestart={() => go({ type: 'restart' })} onSettings={() => go({ type: 'openSettings' })} onQuit={() => go({ type: 'quit' })} reducedMotion={settings.reducedMotion} /> : null}
      {flow.screen === 'settings' ? <SettingsScreen settings={settings} onChange={patch} onClose={() => go({ type: 'closeSettings' })} onReset={() => setSettings(DEFAULT_SETTINGS)} reducedMotion={settings.reducedMotion} /> : null}
      {flow.screen === 'results' && results ? <ResultsScreen rows={results} continueLabel={quickContinue} reducedMotion={settings.reducedMotion} onContinue={() => go({ type: 'continue' })} {...(flow.mode === 'quick' ? { onRestart: () => go({ type: 'restart' }) } : {})} /> : null}
      {flow.screen === 'standings' ? <StandingsScreen rows={standings} raceIndex={flow.raceIndex} raceCount={flow.raceCount} final={final} reducedMotion={settings.reducedMotion} onContinue={() => go({ type: 'continue' })} {...(playerName ? { playerId: playerName } : {})} /> : null}
    </div>
  );
}
