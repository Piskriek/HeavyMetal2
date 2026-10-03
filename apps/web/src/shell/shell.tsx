import { resetTour } from '../tutorial/tour';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactElement } from 'react';
import { Copy, Pencil, Plus, Redo2, Trash2, Undo2 } from 'lucide-react';
import type { Runtime } from '@hm/engine';
import { goblinRacing, type Activity } from '@hm/activities';
import { App } from '../app';
import { IslandWalk } from '../island';
import { MapMaker } from '../maker/maker';
import { buildMakerScene, TEMPLATE_SHAPES, type MakerScene } from '../maker/scene';
import { loadMap, pinMapKey } from '../maker/storage';
import { activeIslandId, createIsland, duplicateIsland, islands, onFork, openIsland, redoIslands, removeIsland, renameIsland, subscribe, templates, undoIslands } from '../islands/island-store';
import { describeIsland } from '@hm/islands';
import { GalaxyCanvas, type GalaxyHandle, type PlanetDef } from './galaxy';
import { GalaxyBar, type Level } from './galaxy-bar';
import { GoblinRacingMenu } from './racing-menu';
import { Community } from './community';
import { createActivity, duplicateActivity, loadProfile, removeActivity, saveProfile, unhideAll, type Profile } from './profile';
import { SettingsBody } from './settings-body';
import { GoblinFront, GoblinPreview, SetMixHome } from './goblin-front';
import { CreateGoblin } from '../avatar/create-goblin';
import { player } from '../build/player';

/**
 * The shell of **SetMix Harness**: a world of activities. It opens on the SetMix home: the galaxy, with Goblin Racing selected and its menu live
 * in a window beside it; open that window and it grows into Goblin Racing's own menu (Play, Multiplayer, Settings) orbiting the Goblin Racing
 * island. Your own island is harness level: My island dives galaxy -> planet -> island -> your avatar and hands over to walking; from then on Esc
 * brings a bar down from the top (back to galaxy, up one level, into the selected). Everything is a screen of this one shell: there are no
 * separate pages, so nothing can strand you (see ROUTES and the e2e smoke test). Goblin words belong to Goblin Racing; the harness is SetMix.
 */
export type Screen = 'home' | 'goblin' | 'create' | 'zoom' | 'island' | 'activities' | 'hub' | 'activity' | 'racing' | 'settings' | 'build' | 'islands';

/** Where "back" goes from every screen. The e2e test and the unit test walk this table: each screen must have a way home. */
export const ROUTES: Readonly<Record<Screen, { readonly back: Screen | 'origin' | null; readonly doc: string }>> = {
  home: { back: null, doc: 'The SetMix home: the galaxy, Goblin Racing selected with its menu live beside it. The only root.' },
  goblin: { back: 'home', doc: "Goblin Racing's own menu (Play, Multiplayer, Settings) orbiting the Goblin Racing island." },
  create: { back: 'origin', doc: 'Make an avatar (look and name). The first game you play makes the first one: Goblin Racing makes a goblin.' },
  zoom: { back: 'island', doc: 'The dive. Esc skips to your avatar.' },
  island: { back: 'home', doc: 'Walking your own island (harness level). Esc opens the jump menu and the galaxy bar.' },
  activities: { back: 'origin', doc: 'The activities window.' },
  hub: { back: 'origin', doc: 'Community: shared presets and your shares.' },
  activity: { back: 'goblin', doc: "Goblin Racing's sections: tournaments, spectate, rankings, track editor, the bookie." },
  racing: { back: 'activity', doc: 'A race. Esc pauses; quitting returns to where it was started.' },
  settings: { back: 'origin', doc: 'Settings (the settings presets).' },
  islands: { back: 'origin', doc: 'My islands: open, duplicate, rename, delete, undo.' },
  build: { back: 'island', doc: 'Build mode. Esc opens the jump menu; Back to Island returns.' },
};

const HOME: PlanetDef = { id: 'home', name: 'My Island', hue: 0.52, size: 1, ring: false, doc: 'Your own planet: walk it as your avatar, build, host.' };
/** Goblin Racing's island lives under its own key, never mixed with your islands (H7: an evolution replaces it). */
const RACING_MAP = 'hm.racing.map.v2';
const toPlanet = (a: Activity): PlanetDef => ({ id: a.id, name: a.name, hue: a.planet.hue > 1 ? a.planet.hue / 360 : a.planet.hue, size: a.planet.size, ring: a.planet.ring, hosting: a.hosting.tournament, doc: a.doc, players: a.hosting.players });

/** An island opened for play or editing: its own runtime, so two islands can never share presets. */
interface World { readonly rt: Runtime; readonly scene: MakerScene; readonly id: string }

export function Shell(props: { readonly makeRuntime: () => Runtime }): ReactElement {
  const { makeRuntime } = props;
  const [world, setWorld] = useState<World | null>(null);
  const [raceRt, setRaceRt] = useState<{ rt: Runtime; fromMap: boolean } | null>(null);
  const [note, setNote] = useState('');
  const registry = useSyncExternalStore(subscribe, () => islands(), () => islands());
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [newTemplate, setNewTemplate] = useState('volcano');
  useEffect(() => onFork((m) => { setNote(`This island is now yours: "${m.name}". Rename it in My islands.`); window.setTimeout(() => setNote(''), 6000); }), []);
  const [screen, setScreen] = useState<Screen>('home');
  // where the hub / activities / settings / the avatar maker were opened from: their Back and Esc return there, never to each other
  const origin = useRef<'home' | 'goblin' | 'island'>('home');
  /** The Goblin Racing island: the world its menu orbits (its own map, never mixed with your islands). */
  const [raceWorld, setRaceWorld] = useState<World | null>(null);
  /** What the avatar maker leads to when done: a race (Goblin Racing's Play) or your island (My island). */
  const [createFor, setCreateFor] = useState<'race' | 'island'>('race');
  /** The galaxy stays a moment while Goblin Racing's window grows to fill the screen, then goes (it is a 3D view of its own). */
  const [growing, setGrowing] = useState(false);
  const [profile, setProfile] = useState<Profile>(() => loadProfile());
  const [session, setSession] = useState(false); // you have been on your island this visit
  const [intro, setIntro] = useState(false);
  const [level, setLevel] = useState<Level>('goblin');
  const [islandMenu, setIslandMenu] = useState(false);
  const [galaxyOpacity, setGalaxyOpacity] = useState(1);
  const [activityId, setActivityId] = useState('goblin-racing');
  const [picked, setPicked] = useState<string | null>('goblin-racing');
  const [raceEntry, setRaceEntry] = useState<'select' | 'custom'>('select');
  const [raceAuto, setRaceAuto] = useState(false);
  const [raceBack, setRaceBack] = useState<Screen>('activity');
  const galaxy = useRef<GalaxyHandle>(null);
  // the leader line that ties Goblin Racing's window to its planet: drawn every frame from the galaxy's loop, straight on the SVG (no React render)
  const leaderLine = useRef<SVGLineElement>(null);
  const leaderRing = useRef<SVGCircleElement>(null);
  const stageEl = useRef<HTMLDivElement>(null);
  /** Where the goblin should stand on the screen while Goblin Racing is a window on the home: the middle of the window's island. */
  const windowFrame = (): { x: number; y: number } => (window.innerWidth <= 760 ? { x: 0.5, y: 0.76 } : { x: 0.75, y: 0.47 });
  const drawLeader = useCallback((x: number, y: number, radius: number) => {
    const line = leaderLine.current, ring = leaderRing.current, stage = stageEl.current;
    if (!line || !ring || !stage) return;
    const r = stage.getBoundingClientRect();
    const tx = r.left, ty = Math.min(Math.max(y, r.top + 28), r.bottom - 28);
    const rr = radius + 8, dx = tx - x, dy = ty - y, d = Math.hypot(dx, dy) || 1;
    const shown = x < r.left - rr - 12 && x > 0 && y > 0 && y < window.innerHeight;
    ring.setAttribute('cx', String(x)); ring.setAttribute('cy', String(y)); ring.setAttribute('r', String(rr));
    line.setAttribute('x1', String(x + (dx / d) * rr)); line.setAttribute('y1', String(y + (dy / d) * rr)); line.setAttribute('x2', String(tx)); line.setAttribute('y2', String(ty));
    ring.style.opacity = line.style.opacity = shown ? '1' : '0';
  }, []);
  const screenRef = useRef(screen);
  screenRef.current = screen;
  const reduced = useMemo(() => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } }, []);
  const update = useCallback((fn: (p: Profile) => Profile) => setProfile((p) => { const n = fn(p); saveProfile(n); return n; }), []);
  const replayTour = useCallback(() => { resetTour(); update((p) => ({ ...p, tutorialDone: false })); setNote('The tour starts again next time you are on your island'); }, [update]);
  const resetProgress = useCallback(() => { resetTour(); update((p) => ({ ...p, credits: 500, tutorialDone: false, skin: 'flat', tournament: null })); }, [update]);

  const visible = profile.activities.filter((a) => !a.hidden);
  const planets = useMemo(() => [HOME, ...visible.map(toPlanet)], [profile.activities]); // eslint-disable-line react-hooks/exhaustive-deps
  /**
   * The Goblin Racing stage: its island orbiting under its menu. A window on the SetMix home, the whole screen in Goblin Racing (and behind its
   * settings and the avatar maker when you came from there). Your own island is mounted only while you are on it.
   */
  const fromGoblin = origin.current === 'goblin';
  const stageOn = screen === 'home' || screen === 'goblin' || (screen === 'create' && createFor === 'race') || (screen === 'settings' && (fromGoblin || origin.current === 'home'));
  const stageFull = stageOn && screen !== 'home' && !(screen === 'settings' && !fromGoblin);
  const galaxyOn = screen === 'home' || screen === 'zoom' || screen === 'hub' || screen === 'activities' || screen === 'activity' || growing
    || (screen === 'create' && createFor === 'island') || (screen === 'settings' && !fromGoblin);
  const islandMounted = world !== null && (screen === 'island' || (screen === 'zoom' && session));

  /** Open an island as a fresh world: load its saved map, or build it from its template (a template instance has no saved map until it is edited). */
  const openWorld = useCallback((id: string): World | null => {
    const meta = openIsland(id);
    if (!meta) return null;
    pinMapKey(null);
    const rt = makeRuntime();
    const scene = loadMap(rt) ?? (() => { const shape = TEMPLATE_SHAPES[meta.template ?? 'blank-island'] ?? TEMPLATE_SHAPES['blank-island']!; return buildMakerScene(rt, shape.seed, shape); })();
    const w = { rt, scene, id };
    setWorld(w);
    return w;
  }, [makeRuntime]);

  /** The Goblin Racing island (its own map key): built from the racing starter until an evolution replaces it (H7). */
  const openRaceWorld = useCallback((): World => {
    pinMapKey(RACING_MAP);
    const rt = makeRuntime();
    const shape = TEMPLATE_SHAPES['goblin-racing']!;
    const scene = loadMap(rt) ?? buildMakerScene(rt, shape.seed, shape);
    pinMapKey(null); // the runtime remembers its own map (storage.ts), nothing else should write there
    const w = { rt, scene, id: 'goblin-racing' };
    setRaceWorld(w);
    return w;
  }, [makeRuntime]);
  useEffect(() => { if (stageOn && !raceWorld) openRaceWorld(); }, [stageOn, raceWorld, openRaceWorld]);
  // the window slides in once when it first appears on the home, not again each time Goblin Racing shrinks back into it
  const [arriving, setArriving] = useState(true);
  useEffect(() => { if (!raceWorld) return; const t = window.setTimeout(() => setArriving(false), 1300); return () => window.clearTimeout(t); }, [raceWorld]);
  const go = useCallback((to: Screen) => { setScreen(to); setGalaxyOpacity(to === 'island' || to === 'build' || to === 'racing' ? 0 : 1); }, []);
  const toHome = useCallback(() => { origin.current = 'home'; go('home'); setPicked('goblin-racing'); setIslandMenu(false); }, [go]);
  /** Goblin Racing's window grows into its own menu; the galaxy fades out behind it. */
  const toGoblin = useCallback(() => {
    if (screenRef.current === 'home') { setGrowing(true); window.setTimeout(() => setGrowing(false), 900); }
    origin.current = 'goblin';
    go('goblin');
  }, [go]);
  const toIsland = useCallback(() => { setIntro(false); setLevel('goblin'); setIslandMenu(false); go('island'); }, [go]);
  /** The race track editor (the older Maker) on your island: reached from the Goblin Racing menu, since it edits race tracks. */
  const toTrackEditor = useCallback(() => { if (!world) { const id = activeIslandId(); if (!id || !openWorld(id)) return; } setSession(true); go('build'); }, [world, openWorld, go]);
  const remember = (): void => { const s = screenRef.current; origin.current = s === 'home' ? 'home' : s === 'goblin' || s === 'activity' ? 'goblin' : s === 'island' || s === 'build' || s === 'zoom' ? 'island' : origin.current; };
  /** Community: shared presets and your shares (the galaxy itself is the home now). */
  const toHub = useCallback(() => { remember(); go('hub'); }, [go]); // eslint-disable-line react-hooks/exhaustive-deps
  const toActivities = useCallback(() => { remember(); go('activities'); }, [go]); // eslint-disable-line react-hooks/exhaustive-deps
  const toIslands = useCallback(() => { remember(); go('islands'); }, [go]); // eslint-disable-line react-hooks/exhaustive-deps
  const toSettings = useCallback(() => { remember(); go('settings'); }, [go]); // eslint-disable-line react-hooks/exhaustive-deps
  /** "Back" for the hub, the activities window and settings: return to where they were opened from. */
  const back = useCallback(() => { if (origin.current === 'island' && session) toIsland(); else if (origin.current === 'goblin') toGoblin(); else toHome(); }, [session, toIsland, toGoblin, toHome]);

  /** My Island: dive to the home planet, cross-fade to the island arriving from above, then walk. */
  const myIsland = useCallback(async () => {
    if (screenRef.current === 'zoom') return;
    // you walk your island as an avatar: the first time, make one
    if (!player().created) { remember(); setCreateFor('island'); go('create'); return; }
    // capture the mouse now, while the click still counts as a user gesture: mouse look is on from the first frame on the island
    try { const r = (document.querySelector('.shell') as HTMLElement | null)?.requestPointerLock() as unknown as Promise<void> | undefined; r?.catch?.(() => undefined); } catch { /* not available */ }
    if (!world) { const id = activeIslandId(); if (!id || !openWorld(id)) return; }
    setSession(true); setLevel('goblin'); setIslandMenu(false);
    setScreen('zoom'); setIntro(!reduced);
    if (!reduced) await galaxy.current?.diveTo('home', 2600);
    setGalaxyOpacity(0);
    window.setTimeout(() => { if (screenRef.current === 'zoom') setScreen('island'); }, reduced ? 0 : 900);
  }, [reduced, world, openWorld, go]); // eslint-disable-line react-hooks/exhaustive-deps

  // Esc on the shell's own screens: one step back (the island, the editor and the race handle their own Esc)
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      const s = screenRef.current;
      if (s === 'activity') toGoblin();
      else if (s === 'goblin') toHome();
      else if (s === 'hub' || s === 'activities' || s === 'islands' || s === 'settings' || s === 'create') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [back, toGoblin, toHome]);

  const picks = planets.find((p) => p.id === picked) ?? null;
  const pickedRow = visible.find((a) => a.id === picked) ?? null;
  /** What Goblin Racing's window and menu say: the game in one line, and what Play does for you (a new player learns it makes their first avatar). */
  const goblinStatus = { doc: goblinRacing().doc, you: player().created ? `You race as ${profile.name}.` : 'Play makes your first avatar: a goblin.' };
  /** An activity: Goblin Racing opens its own menu (the window grows); others open their sections. */
  /** Goblin Racing's sections (tournaments, spectate, rankings, track editor, the bookie): its Multiplayer. */
  const openSections = (): void => { origin.current = 'goblin'; setActivityId('goblin-racing'); go('activity'); };
  const openActivity = (id: string): void => { setActivityId(id); if (id === 'goblin-racing') toGoblin(); else { origin.current = 'home'; go('activity'); } };
  /** Goblin Racing's Play: the first game you play makes your first avatar (a goblin); then, and every time after, it is a race. */
  const play = (): void => { if (!player().created) { origin.current = 'goblin'; setCreateFor('race'); go('create'); } else startRace('select', 'goblin'); };
  const activityInfos = useMemo(() => visible.map((a) => ({ id: a.id, name: a.name, doc: a.doc, hue: a.planet.hue, ring: a.planet.ring })), [visible]);
  /** The racing activity has its own map (the racetrack island), pinned to its own key so it never mixes with your islands. */
  const startRace = (entry: 'select' | 'custom', from: Screen = 'activity'): void => {
    pinMapKey(RACING_MAP);
    const rt = makeRuntime();
    const loaded = loadMap(rt);
    const shape = TEMPLATE_SHAPES['goblin-racing']!;
    if (!loaded) buildMakerScene(rt, shape.seed, shape);
    setRaceRt({ rt, fromMap: true });
    setRaceEntry(entry); setRaceAuto(false); setRaceBack(from); go('racing');
  };

  const islandRows = registry.list();
  const submitRename = (): void => { if (renaming) { const err = renameIsland(renaming, draft); if (err) setNote(err); setRenaming(null); } };

  return (
    <div className="shell" data-screen={screen}>
      {islandMounted ? (
        <div className="shell-layer" style={{ zIndex: 1 }}>
          <IslandWalk key={`${world!.id}-${profile.gpu}`} rt={world!.rt} scene={world!.scene} intro={intro} level={level === 'island' ? 'island' : 'goblin'} showcase={false} grownUp={profile.grownUp} skin={profile.skin} onSkin={(sk) => update((p) => ({ ...p, skin: sk }))} onCredits={(n) => update((p) => ({ ...p, credits: p.credits + Math.max(0, n) }))} quality={profile.quality} fpsTarget={profile.fpsTarget} graphics={profile.graphics} gpu={profile.gpu} profile={profile} onProfile={update} onReplayTour={replayTour} onResetProgress={resetProgress} controls={profile.controls} activities={activityInfos} onActivity={openActivity} onIntroDone={() => setIntro(false)} onMenuChange={setIslandMenu}
            onActivities={toActivities} onIslands={toIslands} onHub={() => toHub()} onMainMenu={toHome} />
        </div>
      ) : null}
      {stageOn && raceWorld ? (
        <div ref={stageEl} className={`gr-stage${stageFull ? ' full' : ''}${arriving ? ' arrive' : ''}`} style={{ zIndex: 3 }}>
          {/* the scene is always screen-sized and stays put: the window is an opening onto it, so growing never resizes the 3D view (no flicker) */}
          <div className="gr-scene">
            <IslandWalk key={`race-${profile.gpu}`} rt={raceWorld.rt} scene={raceWorld.scene} showcase frame={screen === 'home' ? windowFrame() : undefined} clipTo={stageEl} grownUp={profile.grownUp} skin={profile.skin}
              quality={profile.quality} fpsTarget={profile.fpsTarget} graphics={profile.graphics} gpu={profile.gpu} controls={profile.controls} activities={activityInfos}
              onActivities={toActivities} onHub={() => toHub()} onMainMenu={toHome} />
          </div>
          {screen === 'home' ? <GoblinPreview {...goblinStatus} onOpen={toGoblin} onPlay={() => { toGoblin(); play(); }} onMultiplayer={() => { toGoblin(); openSections(); }} onSettings={() => { toGoblin(); toSettings(); }} /> : null}
          {screen === 'goblin' ? <GoblinFront {...goblinStatus} onPlay={play} onMultiplayer={openSections} onSettings={toSettings} onHome={toHome} /> : null}
        </div>
      ) : null}
      {screen === 'island' || screen === 'zoom' ? <GalaxyBar open={islandMenu || level === 'island'} island={screen === 'island'} level={level} onLevel={setLevel} onBackToGalaxy={() => toHub()} /> : null}
      {/* above the galaxy bar: the island's Walk/Studio, 1st/3rd and Flat/PBR toggles are drawn here, so the bar never covers them */}
      {screen === 'island' ? <div className="hud-top" id="hud-top" /> : null}
      {galaxyOn ? (
        <div className="shell-layer" style={{ zIndex: 2, opacity: galaxyOpacity, transition: 'opacity .9s ease', pointerEvents: galaxyOpacity < 0.5 ? 'none' : 'auto' }}>
          <GalaxyCanvas ref={galaxy} planets={planets} mode={screen === 'home' ? 'hub' : 'backdrop'} focusId={screen === 'home' ? 'goblin-racing' : undefined} highlightId={screen === 'home' ? 'goblin-racing' : undefined} reducedMotion={reduced} onPick={(id) => { setPicked(id); }} focusShift={screen === 'home' ? 16 : 0} onFocusScreen={screen === 'home' ? drawLeader : undefined} />
        </div>
      ) : null}

      {screen === 'create' ? (
        <div className="shell-layer shell-ui" style={{ zIndex: 3 }}>
          <CreateGoblin onBack={back} onDone={(look) => { update((pr) => ({ ...pr, name: look.name })); if (createFor === 'race') startRace('select', 'goblin'); else void myIsland(); }} />
        </div>
      ) : null}

      {screen === 'home' ? (
        <div className="shell-layer shell-ui sm-layer" style={{ zIndex: 4 }}>
          <SetMixHome leader={{ line: leaderLine, ring: leaderRing }} credits={profile.credits} onMyIsland={() => void myIsland()} onCommunity={() => toHub()} onSettings={toSettings} />
          {/* another planet picked: what is played there (Goblin Racing shows its live window instead) */}
          {picks && picks.id !== 'goblin-racing' ? (
            <aside className="shell-card" aria-live="polite">
              {pickedRow ? (<><h3>{pickedRow.name}</h3><p>{pickedRow.doc}</p><button className="go" onClick={() => openActivity(pickedRow.id)}>Jump in</button></>)
                : (<><h3>{picks.name}</h3><p>Your own planet: walk it as your avatar, build, host.</p><button className="go" onClick={() => void myIsland()}>Go to my island</button></>)}
              <button className="quiet" onClick={() => setPicked('goblin-racing')}>Back to Goblin Racing</button>
            </aside>
          ) : null}
        </div>
      ) : null}

      {screen === 'hub' ? (
        <div className="shell-layer shell-ui" style={{ zIndex: 3 }}>
          <header className="shell-top">
            <div className="sm-brand small"><b>SetMix</b><i>Community</i></div>
            <span className="grow" />
            <span className="shell-credits" title="In-game credits. Never real money.">{profile.credits} cr</span>
            {session ? <button onClick={toIsland}>Back to Island</button> : null}
            <button onClick={toHome}>Home</button>
          </header>
          <Community profile={profile} onCredits={(d) => update((p) => ({ ...p, credits: Math.max(0, p.credits + d) }))} />
        </div>
      ) : null}

      {screen === 'activities' ? (
        <div className="shell-layer shell-ui" style={{ zIndex: 3 }}>
          <div className="shell-window" role="dialog" aria-label="Activities">
            <header><h3>Activities</h3><button onClick={back}>Close</button></header>
            <div className="shell-cards">
              {visible.map((a) => (
                <article key={a.id} className="shell-activity">
                  <h4>{a.name}</h4>
                  <p>{a.doc}</p>
                  <div className="btns">
                    <button className="go" onClick={() => openActivity(a.id)}>Play</button>
                    <button title="Duplicate" onClick={() => update((p) => duplicateActivity(p, a.id))}><Copy size={13} strokeWidth={1.6} /></button>
                    <button title={a.builtin ? 'Hide (built-in activities cannot be deleted)' : 'Remove'} onClick={() => update((p) => removeActivity(p, a.id))}><Trash2 size={13} strokeWidth={1.6} /></button>
                  </div>
                </article>
              ))}
              <button className="shell-activity new" onClick={() => update((p) => createActivity(p, `New activity ${p.activities.length}`))}><Plus size={18} strokeWidth={1.4} />Create new</button>
            </div>
            {profile.activities.some((a) => a.hidden) ? <button className="quiet" onClick={() => update(unhideAll)}>Show hidden activities</button> : null}
          </div>
        </div>
      ) : null}

      {screen === 'activity' ? (
        <div className="shell-layer" style={{ zIndex: 3 }}>
          <GoblinRacingMenu profile={profile} activity={visible.find((a) => a.id === activityId) ?? visible[0] ?? profile.activities[0]!} onBack={toGoblin}
            onQuickRace={() => { startRace('select'); }} onMyGoblin={() => { startRace('custom'); }}
            onProfile={(fn) => update(fn)} onTrackEditor={toTrackEditor} />
        </div>
      ) : null}

      {screen === 'islands' ? (
        <div className="shell-layer shell-ui" style={{ zIndex: 3 }}>
          <div className="shell-window" role="dialog" aria-label="My islands">
            <header>
              <h3>My islands</h3>
              <button aria-label="Undo" title={registry.canUndo ? `Undo: ${registry.history().at(-1) ?? ''}` : 'Nothing to undo'} disabled={!registry.canUndo} onClick={() => { const e = undoIslands(); if (e) setNote(e); }}><Undo2 size={14} strokeWidth={1.6} /></button>
              <button aria-label="Redo" title="Redo" disabled={!registry.canRedo} onClick={() => { const e = redoIslands(); if (e) setNote(e); }}><Redo2 size={14} strokeWidth={1.6} /></button>
              <button onClick={back}>Close</button>
            </header>
            <div className="shell-cards">
              {islandRows.map((m) => (
                <article key={m.id} className={`shell-activity${m.id === activeIslandId() ? ' current' : ''}`}>
                  {renaming === m.id ? (
                    <input autoFocus value={draft} maxLength={40} aria-label="Island name" onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submitRename(); if (e.key === 'Escape') { e.stopPropagation(); setRenaming(null); } }} onBlur={submitRename} />
                  ) : <h4>{m.name}</h4>}
                  <p>{describeIsland(m, Date.now())}</p>
                  <div className="btns">
                    <button className="go" onClick={() => { const w = openWorld(m.id); if (w) { setSession(true); setLevel('goblin'); setIntro(false); go('island'); } }}>Open</button>
                    <button title="Rename" aria-label="Rename" onClick={() => { setRenaming(m.id); setDraft(m.name); }}><Pencil size={13} strokeWidth={1.6} /></button>
                    <button title="Duplicate" aria-label="Duplicate" onClick={() => { const e = duplicateIsland(m.id); if (e) setNote(e); }}><Copy size={13} strokeWidth={1.6} /></button>
                    <button title="Delete (you can undo)" aria-label="Delete" onClick={() => { const e = removeIsland(m.id); if (e) setNote(e); if (world?.id === m.id) setWorld(null); }}><Trash2 size={13} strokeWidth={1.6} /></button>
                  </div>
                </article>
              ))}
              <div className="shell-activity new">
                <select aria-label="Start from" value={newTemplate} onChange={(e) => setNewTemplate(e.target.value)}>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
                <button onClick={() => { const e = createIsland(TEMPLATE_SHAPES[newTemplate]?.name ?? 'My Island', newTemplate); if (e) setNote(e); }}><Plus size={14} strokeWidth={1.4} /> Create new</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {note ? <div className="shell-note" role="status" onClick={() => setNote('')}>{note}</div> : null}

      {screen === 'settings' ? (
        <div className="shell-layer shell-ui" style={{ zIndex: 3 }}>
          <div className="shell-window narrow" role="dialog" aria-label="Settings">
            <header><h3>Settings</h3><button onClick={back}>Close</button></header>
            <SettingsBody profile={profile} update={update} onReplayTour={replayTour} onReset={resetProgress} />
          </div>
        </div>
      ) : null}

      {screen === 'build' && world ? (
        <div className="shell-layer" style={{ zIndex: 4 }}>
          <MapMaker key={world.id} rt={world.rt} scene={world.scene} onTestDrive={() => { setRaceEntry('select'); setRaceAuto(true); setRaceBack('build'); setRaceRt(null); go('racing'); }} onExit={toIsland} onMenu={toHome} onIslands={toIslands} onCommunity={() => toHub()} />
        </div>
      ) : null}

      {screen === 'racing' && (raceAuto ? world : raceRt) ? (
        <div className="shell-layer" style={{ zIndex: 4 }}>
          <App rt={(raceAuto ? world! : raceRt!).rt} fromMap={raceAuto ? true : raceRt!.fromMap} {...(raceAuto ? { autoStart: true } : { entry: raceEntry })} onExit={() => { pinMapKey(null); go(raceBack); }} />
        </div>
      ) : null}
    </div>
  );
}
