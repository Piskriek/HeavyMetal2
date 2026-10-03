import { ControlsList, ControlsSettings } from './controls-list';
import { resetTour } from '../tutorial/tour';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactElement } from 'react';
import { Copy, Pencil, Plus, Redo2, Trash2, Undo2 } from 'lucide-react';
import type { Runtime } from '@hm/engine';
import type { Activity } from '@hm/activities';
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
import { createActivity, duplicateActivity, gpuInUse, loadProfile, tierInUse, removeActivity, saveProfile, unhideAll, type GpuChoice, type Profile } from './profile';
import { FPS_TARGETS, parseQuality, tidyGpuName } from '@hm/game';
import { GraphicsTuning } from './graphics-tuning';
import { CreateGoblin } from '../avatar/create-goblin';
import { player } from '../build/player';

/**
 * The shell: a game inside a game. It always opens on the main menu over the galaxy. My Island dives galaxy -> planet -> island -> goblin and hands
 * over to walking; from then on the menu is gone and Esc brings a bar down from the top (back to galaxy, up one level, into the selected).
 * Everything is a screen of this one shell: there are no separate pages, so nothing can strand you (see ROUTES and the e2e smoke test).
 */
export type Screen = 'menu' | 'create' | 'zoom' | 'island' | 'activities' | 'hub' | 'activity' | 'racing' | 'settings' | 'build' | 'islands';

/** Where "back" goes from every screen. The e2e test and the unit test walk this table: each screen must have a way home. */
export const ROUTES: Readonly<Record<Screen, { readonly back: Screen | 'origin' | null; readonly doc: string }>> = {
  menu: { back: null, doc: 'The main menu over the galaxy. The only root.' },
  create: { back: 'menu', doc: 'Create your goblin (look and name): Play asks for it the first time, then dives to your island.' },
  zoom: { back: 'island', doc: 'The dive. Esc skips to the goblin.' },
  island: { back: 'menu', doc: 'Walking. Esc opens the jump menu and the galaxy bar.' },
  activities: { back: 'origin', doc: 'The activities window.' },
  hub: { back: 'origin', doc: 'Multiplayer: the galaxy with hosted activities and the community.' },
  activity: { back: 'hub', doc: 'One activity (Goblin Racing) with its own menu.' },
  racing: { back: 'activity', doc: 'A race. Esc pauses; quitting returns to where it was started.' },
  settings: { back: 'menu', doc: 'Settings.' },
  islands: { back: 'origin', doc: 'My islands: open, duplicate, rename, delete, undo.' },
  build: { back: 'island', doc: 'Build mode. Esc opens the jump menu; Back to Island returns.' },
};

const HOME: PlanetDef = { id: 'home', name: 'My Island', hue: 0.52, size: 1, ring: false, doc: 'Your own planet: walk it as your goblin, build, host.' };
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
  const [screen, setScreen] = useState<Screen>('menu');
  // where the hub / activities were opened from (the main menu or the island): their Back and Esc return there, never to each other
  const origin = useRef<'menu' | 'island'>('menu');
  const [profile, setProfile] = useState<Profile>(() => loadProfile());
  const [session, setSession] = useState(false); // you have been on your island this visit
  const [intro, setIntro] = useState(false);
  const [level, setLevel] = useState<Level>('goblin');
  const [islandMenu, setIslandMenu] = useState(false);
  const [galaxyOpacity, setGalaxyOpacity] = useState(1);
  const [activityId, setActivityId] = useState('goblin-racing');
  const [picked, setPicked] = useState<string | null>('goblin-racing');
  const [hubTab, setHubTab] = useState<'hub' | 'community'>('hub');
  const [raceEntry, setRaceEntry] = useState<'select' | 'custom'>('select');
  const [raceAuto, setRaceAuto] = useState(false);
  const [raceBack, setRaceBack] = useState<Screen>('activity');
  const galaxy = useRef<GalaxyHandle>(null);
  const screenRef = useRef(screen);
  screenRef.current = screen;
  const reduced = useMemo(() => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } }, []);
  const update = useCallback((fn: (p: Profile) => Profile) => setProfile((p) => { const n = fn(p); saveProfile(n); return n; }), []);

  const visible = profile.activities.filter((a) => !a.hidden);
  const planets = useMemo(() => [HOME, ...visible.map(toPlanet)], [profile.activities]); // eslint-disable-line react-hooks/exhaustive-deps
  /** Behind the main menu (and settings and the goblin creator) your island turns slowly; the galaxy is the multiplayer view. */
  const showcase = screen === 'menu' || screen === 'settings' || screen === 'create';
  const galaxyOn = screen === 'zoom' || screen === 'hub' || screen === 'activities' || screen === 'activity' || (showcase && world === null);
  const islandMounted = world !== null && (screen === 'island' || showcase || (screen === 'zoom' && session));

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

  // the menu shows your island: open it as soon as the menu is up
  useEffect(() => { if ((screen === 'menu' || screen === 'create') && !world) { const id = activeIslandId(); if (id) openWorld(id); } }, [screen, world, openWorld]);
  const go = useCallback((to: Screen) => { setScreen(to); setGalaxyOpacity(to === 'island' || to === 'build' || to === 'racing' ? 0 : 1); }, []);
  const toMenu = useCallback(() => { go('menu'); setPicked('goblin-racing'); setIslandMenu(false); }, [go]);
  const toIsland = useCallback(() => { setIntro(false); setLevel('goblin'); setIslandMenu(false); go('island'); }, [go]);
  const remember = (): void => { const s = screenRef.current; if (s === 'menu' || s === 'island' || s === 'build' || s === 'zoom') origin.current = s === 'menu' ? 'menu' : 'island'; };
  const toHub = useCallback((tab: 'hub' | 'community' = 'hub') => { remember(); setHubTab(tab); go('hub'); }, [go]); // eslint-disable-line react-hooks/exhaustive-deps
  const toActivities = useCallback(() => { remember(); go('activities'); }, [go]); // eslint-disable-line react-hooks/exhaustive-deps
  const toIslands = useCallback(() => { remember(); go('islands'); }, [go]); // eslint-disable-line react-hooks/exhaustive-deps
  /** "Back" for the hub and the activities window: return to where they were opened from. */
  const back = useCallback(() => { if (origin.current === 'island' && session) toIsland(); else toMenu(); }, [session, toIsland, toMenu]);

  /** My Island: dive to the home planet, cross-fade to the island arriving from above, then walk. */
  const myIsland = useCallback(async () => {
    if (screenRef.current === 'zoom') return;
    // capture the mouse now, while the click still counts as a user gesture: mouse look is on from the first frame on the island
    try { const r = (document.querySelector('.shell') as HTMLElement | null)?.requestPointerLock() as unknown as Promise<void> | undefined; r?.catch?.(() => undefined); } catch { /* not available */ }
    if (!world) { const id = activeIslandId(); if (!id || !openWorld(id)) return; }
    // from the menu the island is already there behind it: the camera simply flies down to the goblin
    if (screenRef.current === 'menu' || screenRef.current === 'create' || screenRef.current === 'settings') { setSession(true); setLevel('goblin'); setIslandMenu(false); setIntro(false); setGalaxyOpacity(0); setScreen('island'); return; }
    setSession(true); setLevel('goblin'); setIslandMenu(false);
    setScreen('zoom'); setIntro(!reduced);
    if (!reduced) await galaxy.current?.diveTo('home', 2600);
    setGalaxyOpacity(0);
    window.setTimeout(() => { if (screenRef.current === 'zoom') setScreen('island'); }, reduced ? 0 : 900);
  }, [reduced, world, openWorld]);

  // Esc on the shell's own screens: one step back (the island, the editor and the race handle their own Esc)
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      const s = screenRef.current;
      if (s === 'activity') go('hub');
      else if (s === 'hub' || s === 'activities' || s === 'islands') back();
      else if (s === 'settings' || s === 'create') toMenu();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [back, go, toMenu]);

  const picks = planets.find((p) => p.id === picked) ?? null;
  const pickedRow = visible.find((a) => a.id === picked) ?? null;
  const openActivity = (id: string): void => { setActivityId(id); go('activity'); };
  /** Play: the first time you make your goblin (look and name); then, and every time after, it takes you to your island. */
  const play = (): void => { if (!player().created) go('create'); else void myIsland(); };
  const activityInfos = useMemo(() => visible.map((a) => ({ id: a.id, name: a.name, doc: a.doc, hue: a.planet.hue, ring: a.planet.ring })), [visible]);
  /** The racing activity has its own map (the racetrack island), pinned to its own key so it never mixes with your islands. */
  const startRace = (entry: 'select' | 'custom'): void => {
    pinMapKey('hm.racing.map.v1');
    const rt = makeRuntime();
    const loaded = loadMap(rt);
    const shape = TEMPLATE_SHAPES['racing-starter']!;
    if (!loaded) buildMakerScene(rt, shape.seed, shape);
    setRaceRt({ rt, fromMap: true });
    setRaceEntry(entry); setRaceAuto(false); setRaceBack('activity'); go('racing');
  };

  const islandRows = registry.list();
  const submitRename = (): void => { if (renaming) { const err = renameIsland(renaming, draft); if (err) setNote(err); setRenaming(null); } };

  return (
    <div className="shell" data-screen={screen}>
      {islandMounted ? (
        <div className="shell-layer" style={{ zIndex: 1 }}>
          <IslandWalk key={`${world!.id}-${profile.gpu}`} rt={world!.rt} scene={world!.scene} intro={intro} level={level === 'island' ? 'island' : 'goblin'} showcase={showcase} grownUp={profile.grownUp} skin={profile.skin} onSkin={(sk) => update((p) => ({ ...p, skin: sk }))} onCredits={(n) => update((p) => ({ ...p, credits: p.credits + Math.max(0, n) }))} quality={profile.quality} fpsTarget={profile.fpsTarget} graphics={profile.graphics} gpu={profile.gpu} controls={profile.controls} activities={activityInfos} onActivity={openActivity} onIntroDone={() => setIntro(false)} onMenuChange={setIslandMenu}
            onEdit={() => go('build')} onActivities={toActivities} onIslands={toIslands} onHub={() => toHub()} onMainMenu={toMenu} />
        </div>
      ) : null}
      {screen === 'island' || screen === 'zoom' ? <GalaxyBar open={islandMenu || level === 'island'} level={level} onLevel={setLevel} onBackToGalaxy={() => toHub()} /> : null}
      {galaxyOn ? (
        <div className="shell-layer" style={{ zIndex: 2, opacity: galaxyOpacity, transition: 'opacity .9s ease', pointerEvents: galaxyOpacity < 0.5 ? 'none' : 'auto' }}>
          <GalaxyCanvas ref={galaxy} planets={planets} mode={screen === 'hub' ? 'hub' : 'backdrop'} focusId={screen === 'hub' ? 'goblin-racing' : undefined} highlightId={screen === 'hub' ? 'goblin-racing' : undefined} reducedMotion={reduced} onPick={(id) => { setPicked(id); }} />
        </div>
      ) : null}

      {screen === 'create' ? (
        <div className="shell-layer shell-ui" style={{ zIndex: 3 }}>
          <CreateGoblin onBack={toMenu} onDone={(look) => { update((pr) => ({ ...pr, name: look.name })); void myIsland(); }} />
        </div>
      ) : null}

      {screen === 'menu' ? (
        <div className="shell-layer shell-ui" style={{ zIndex: 3 }}>
          <div className="shell-brand"><b>GOBLIN</b><i>PRESET STUDIO</i></div>
          <nav className="shell-menu" aria-label="Main menu">
            <button className="go" onClick={play}>Play</button>
            <button onClick={() => toHub()}>Multiplayer</button>
            <button onClick={() => void myIsland()}>My Island</button>
            <button onClick={() => go('settings')}>Settings</button>
          </nav>
          <p className="shell-foot">Everything is a preset. Play takes you to your island, as your goblin.</p>
        </div>
      ) : null}

      {screen === 'hub' ? (
        <div className="shell-layer shell-ui" style={{ zIndex: 3 }}>
          <header className="shell-top">
            <div className="shell-brand small"><b>GOBLIN</b><i>MULTIPLAYER</i></div>
            <div className="tabs">
              <button className={hubTab === 'hub' ? 'on' : ''} onClick={() => setHubTab('hub')}>Hub</button>
              <button className={hubTab === 'community' ? 'on' : ''} onClick={() => setHubTab('community')}>Community</button>
            </div>
            <span className="grow" />
            <span className="shell-credits" title="In-game credits. Never real money.">{profile.credits} cr</span>
            {session ? <button onClick={toIsland}>Back to Island</button> : null}
            <button onClick={toMenu}>Main menu</button>
          </header>
          {hubTab === 'hub' ? (
            <aside className="shell-card" aria-live="polite">
              {picks && pickedRow ? (
                <>
                  <h3>{pickedRow.name}</h3>
                  <p>{pickedRow.doc}</p>
                  {pickedRow.id === 'goblin-racing' ? <p className="hint">Hosting this week's tournament · sign-ups open · next heat in 2 days (simulated until the platform backend is connected)</p> : null}
                  <button className="go" onClick={() => openActivity(pickedRow.id)}>Jump in</button>
                </>
              ) : picks ? (<><h3>{picks.name}</h3><p>Your own planet. Walk it as a goblin.</p><button onClick={() => void myIsland()}>Jump into my goblin</button></>) : <p className="hint">Drag to look around. Click a planet to see what is hosted there. More activities appear as people host them.</p>}
            </aside>
          ) : <Community profile={profile} onCredits={(d) => update((p) => ({ ...p, credits: Math.max(0, p.credits + d) }))} />}
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
          <GoblinRacingMenu profile={profile} activity={visible.find((a) => a.id === activityId) ?? visible[0] ?? profile.activities[0]!} onBack={() => go('hub')}
            onQuickRace={() => { startRace('select'); }} onMyGoblin={() => { startRace('custom'); }}
            onProfile={(fn) => update(fn)} />
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
            <header><h3>Settings</h3><button onClick={toMenu}>Close</button></header>
            <label className="row"><input type="checkbox" checked={profile.grownUp} onChange={(e) => update((p) => ({ ...p, grownUp: e.target.checked }))} /> Grown-up mode (build mode on)</label>
            <p className="hint">Build mode is for adults. Switch it off for a kid profile: My Island and the activities stay, building is hidden.</p>
            <label className="row">Name <input value={profile.name} maxLength={20} onChange={(e) => update((p) => ({ ...p, name: e.target.value }))} /></label>
            <label className="row">Island skin <select value={profile.skin} onChange={(e) => update((p) => ({ ...p, skin: e.target.value as 'flat' | 'pbr' }))}><option value="flat">Flat (matches the voxel goblin)</option><option value="pbr">PBR (full relief)</option></select></label>
            <label className="row">Graphics <select value={profile.quality} onChange={(e) => update((p) => ({ ...p, quality: e.target.value as typeof profile.quality }))}><option value="auto">Auto (best the device can hold)</option><option value="ultra">Ultra</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low (phones and older laptops)</option></select></label>
            {profile.quality === 'auto' ? (
              <div className="row fps-target" role="group" aria-label="Aim for">
                <span>Aim for</span>
                <span className="seg">{FPS_TARGETS.map((f) => <button key={f} className={profile.fpsTarget === f ? 'on' : ''} aria-pressed={profile.fpsTarget === f} onClick={() => update((p) => ({ ...p, fpsTarget: f }))}>{f} fps</button>)}</span>
              </div>
            ) : null}
            {profile.quality === 'auto' ? <p className="hint">15 fps looks best and moves slower, 60 fps moves smoothly and looks plainer. Auto raises or lowers the graphics until your machine keeps up.</p> : null}
            <GraphicsTuning tier={parseQuality(profile.quality) ?? tierInUse() ?? 'medium'} own={profile.graphics} onChange={(g) => update((p) => ({ ...p, graphics: g }))} />
            <label className="row">Graphics card <select value={profile.gpu} onChange={(e) => update((p) => ({ ...p, gpu: e.target.value as GpuChoice }))}><option value="fast">Ask for the fast one</option><option value="saver">Ask for the battery saver</option><option value="browser">Let the browser choose</option></select></label>
            <p className="hint">In use: {gpuInUse() ? tidyGpuName(gpuInUse()!) : 'not known yet'}. A page can only ask: on a laptop with two graphics cards, Windows decides. To always get the fast one, open Windows Settings, System, Display, Graphics, pick your browser and choose High performance.</p>
            <ControlsSettings value={profile.controls} onChange={(c) => update((p) => ({ ...p, controls: c }))} />
            <ControlsList />
            <div className="btns"><button onClick={() => { resetTour(); update((p) => ({ ...p, tutorialDone: false })); setNote('The tour starts again next time you are on your island'); }}>Replay the tour</button><button className="danger" onClick={() => { resetTour(); update(() => ({ ...profile, credits: 500, tutorialDone: false, skin: 'flat', tournament: null })); }}>Reset progress</button></div>
          </div>
        </div>
      ) : null}

      {screen === 'build' && world ? (
        <div className="shell-layer" style={{ zIndex: 4 }}>
          <MapMaker key={world.id} rt={world.rt} scene={world.scene} onTestDrive={() => { setRaceEntry('select'); setRaceAuto(true); setRaceBack('build'); setRaceRt(null); go('racing'); }} onExit={toIsland} onMenu={toMenu} onIslands={toIslands} onCommunity={() => toHub('community')} />
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
