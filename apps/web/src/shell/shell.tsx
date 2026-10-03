import { resetTour } from '../tutorial/tour';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactElement } from 'react';
import { Copy, Plus, Redo2, Trash2, Undo2 } from 'lucide-react';
import type { Runtime } from '@hm/engine';
import { goblinRacing, type Activity } from '@hm/activities';
import { kindOf, type AvatarKind, type AvatarLook } from '@hm/avatarlook';
import { AvatarsWindow } from './avatars';
import { App } from '../app';
import { IslandWalk } from '../island';
import { MapMaker } from '../maker/maker';
import { buildMakerScene, TEMPLATE_SHAPES, type MakerScene } from '../maker/scene';
import { loadMap, mapBundle, pinMapKey, seedMap } from '../maker/storage';
import { OFFICIAL_RACING } from '../maker/official-racing';
import { NewIsland, type NewIslandChoice } from '../islands/new-island';
import { PlanetScreen, PlanetWindow } from '../islands/my-planet';
import { NewActivity } from './new-activity';
import { activeIslandId, createIslandWithMap, duplicateIsland, islands, onFork, openIsland, redoIslands, removeIsland, renameIsland, subscribe, undoIslands } from '../islands/island-store';
import { GalaxyCanvas, type GalaxyHandle, type PlanetDef } from './galaxy';
import { GalaxyBar, type Level } from './galaxy-bar';
import { GoblinRacingMenu } from './racing-menu';
import { Community } from './community';
import { duplicateActivity, loadProfile, makeActivity, removeActivity, saveProfile, unhideAll, type Profile } from './profile';
import { SettingsBody } from './settings-body';
import { GoblinFront, GoblinPreview, SetMixHome } from './goblin-front';
import { captureMouse } from './capture-mouse';
import { CreateGoblin } from '../avatar/create-goblin';
import { player } from '../build/player';

/**
 * The shell of **SetMix Harness**: a world of activities. It opens on the SetMix home: the galaxy, with Goblin Racing selected and its menu live
 * in a window beside it; open that window and it grows into Goblin Racing's own menu (Play, Race modes, Settings) orbiting the Goblin Racing
 * island. Your own island is harness level: My island dives galaxy -> planet -> island -> your avatar and hands over to walking; from then on Esc
 * brings a bar down from the top (back to galaxy, up one level, into the selected). Everything is a screen of this one shell: there are no
 * separate pages, so nothing can strand you (see ROUTES and the e2e smoke test). Goblin words belong to Goblin Racing; the harness is SetMix.
 */
export type Screen = 'home' | 'goblin' | 'create' | 'avatars' | 'zoom' | 'island' | 'activities' | 'hub' | 'activity' | 'racing' | 'settings' | 'build' | 'islands';

/** Where "back" goes from every screen. The e2e test and the unit test walk this table: each screen must have a way home. */
export const ROUTES: Readonly<Record<Screen, { readonly back: Screen | 'origin' | null; readonly doc: string }>> = {
  home: { back: null, doc: 'The SetMix home: the galaxy, Goblin Racing selected with its menu live beside it. The only root.' },
  goblin: { back: 'home', doc: "Goblin Racing's own menu (Play, Race modes, Settings) orbiting the Goblin Racing island." },
  create: { back: 'origin', doc: 'Make an avatar (look and name). The first game you play makes the first one: Goblin Racing makes a goblin.' },
  avatars: { back: 'origin', doc: 'Avatars: everyone you can be (any kind); use, change, remove, make a new one.' },
  zoom: { back: 'island', doc: 'The dive. Esc skips to your avatar.' },
  island: { back: 'home', doc: 'Walking your own island (harness level). Esc opens the jump menu and the galaxy bar.' },
  activities: { back: 'origin', doc: 'The activities window.' },
  hub: { back: 'origin', doc: 'Community: shared presets and your shares.' },
  activity: { back: 'goblin', doc: "Goblin Racing's sections: tournaments, spectate, rankings, track editor, the bookie." },
  racing: { back: 'activity', doc: 'A race. Esc pauses; quitting returns to where it was started.' },
  settings: { back: 'origin', doc: 'Settings (the settings presets).' },
  islands: { back: 'origin', doc: 'My planet: your islands drawn from above; go into one, rename, copy, delete, undo, make a new one.' },
  build: { back: 'activity', doc: "Goblin Racing's track editor, on the Goblin Racing island. Esc opens its menu; Back to Goblin Racing returns." },
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
  /** My islands is making a new island (quick, wizard or manual) instead of listing them. */
  const [newIsland, setNewIsland] = useState(false);
  /** The activities window is making a new activity (quick, wizard or manual). */
  const [newActivity, setNewActivity] = useState(false);
  useEffect(() => onFork((m) => { setNote(`This island is now yours: "${m.name}". Rename it in My islands.`); window.setTimeout(() => setNote(''), 6000); }), []);
  const [screen, setScreen] = useState<Screen>('home');
  // where the hub / activities / settings / the avatar maker were opened from: their Back and Esc return there, never to each other
  const origin = useRef<'home' | 'goblin' | 'island'>('home');
  /** The Goblin Racing island: the world its menu orbits (its own map, never mixed with your islands). */
  const [raceWorld, setRaceWorld] = useState<World | null>(null);
  /** What the avatar maker leads to when done: a race (Goblin Racing's Play) or your island (My island). */
  const [createFor, setCreateFor] = useState<'race' | 'island' | 'avatars'>('race');
  /** The Avatars window's maker: the avatar being changed, or null for a new one. */
  const [editLook, setEditLook] = useState<AvatarLook | null>(null);
  /** The kind a manual new avatar starts as (picked in the New avatar chooser). */
  const [newKind, setNewKind] = useState<AvatarKind>('goblin');
  const createForRef = useRef(createFor);
  createForRef.current = createFor;
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
  /** Which island the track editor has open: Goblin Racing's (its track editor, owner default Q4) or your own. */
  const [editing, setEditing] = useState<'racing' | 'home'>('racing');
  const galaxy = useRef<GalaxyHandle>(null);
  // the leader line that ties Goblin Racing's window to its planet: drawn every frame from the galaxy's loop, straight on the SVG (no React render)
  const leaderLine = useRef<SVGLineElement>(null);
  const leaderRing = useRef<SVGCircleElement>(null);
  const stageEl = useRef<HTMLDivElement>(null);
  /** Where the goblin should stand on the screen while Goblin Racing is a window on the home: the middle of the window's island. */
  const windowFrame = (): { x: number; y: number } => (window.innerWidth <= 760 ? { x: 0.5, y: 0.76 } : { x: 0.75, y: 0.47 });
  /** My planet's window on the home (your islands with previews), when your planet is the one picked. */
  const planetWinEl = useRef<HTMLDivElement>(null);
  const pickedRef = useRef<string | null>(null);
  const drawLeader = useCallback((x: number, y: number, radius: number) => {
    // the line runs from the picked planet to its window: My planet's, or the live window of Goblin Racing (or another activity)
    const line = leaderLine.current, ring = leaderRing.current, stage = pickedRef.current === 'home' ? planetWinEl.current : stageEl.current;
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
  pickedRef.current = picked;
  /** The home shows a planet's live island window (Goblin Racing, any activity), or My planet's island previews (no 3D view needed). */
  const homeLive = picked !== 'home';
  const stageOn = (screen === 'home' && homeLive) || screen === 'goblin' || (screen === 'create' && createFor === 'race') || (screen === 'settings' && (fromGoblin || (origin.current === 'home' && homeLive)));
  // the window shows a loading bar until its island has drawn (a planet's view is built when it first shows)
  const [stageReady, setStageReady] = useState(false);
  useEffect(() => { if (!stageOn) setStageReady(false); }, [stageOn]);
  const stageFull = stageOn && screen !== 'home' && !(screen === 'settings' && !fromGoblin);
  const galaxyOn = screen === 'home' || screen === 'zoom' || screen === 'hub' || screen === 'activities' || screen === 'activity' || screen === 'islands' || growing
    || screen === 'avatars' || (screen === 'create' && createFor !== 'race') || (screen === 'settings' && !fromGoblin);
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
  // the official Goblin Racing island (when one is built in) goes in first for a player who has none yet; then the island opens
  const [racingSeeded, setRacingSeeded] = useState(OFFICIAL_RACING === null);
  useEffect(() => { if (OFFICIAL_RACING) void seedMap(RACING_MAP, OFFICIAL_RACING.code).finally(() => setRacingSeeded(true)); }, []);
  useEffect(() => { if (stageOn && !raceWorld && racingSeeded) openRaceWorld(); }, [stageOn, raceWorld, openRaceWorld, racingSeeded]);
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
  /** Goblin Racing's track editor: the Goblin Racing island itself (your changes are your proposal for its weekly evolution, H7). */
  const toTrackEditor = useCallback(() => { if (!raceWorld) openRaceWorld(); setEditing('racing'); go('build'); }, [raceWorld, openRaceWorld, go]);
  const remember = (): void => { const s = screenRef.current; origin.current = s === 'home' ? 'home' : s === 'goblin' || s === 'activity' ? 'goblin' : s === 'island' || s === 'build' || s === 'zoom' ? 'island' : origin.current; };
  /** Community: shared presets and your shares (the galaxy itself is the home now). */
  const toHub = useCallback(() => { remember(); go('hub'); }, [go]); // eslint-disable-line react-hooks/exhaustive-deps
  const toActivities = useCallback(() => { remember(); go('activities'); }, [go]); // eslint-disable-line react-hooks/exhaustive-deps
  const toIslands = useCallback(() => { remember(); go('islands'); }, [go]); // eslint-disable-line react-hooks/exhaustive-deps
  const toSettings = useCallback(() => { remember(); go('settings'); }, [go]); // eslint-disable-line react-hooks/exhaustive-deps
  const toAvatars = useCallback(() => { remember(); go('avatars'); }, [go]); // eslint-disable-line react-hooks/exhaustive-deps
  /** "Back" for the hub, the activities window and settings: return to where they were opened from. */
  const back = useCallback(() => { if (origin.current === 'island' && session) toIsland(); else if (origin.current === 'goblin') toGoblin(); else toHome(); }, [session, toIsland, toGoblin, toHome]);

  /** My Island: dive to the home planet, cross-fade to the island arriving from above, then walk. */
  const myIsland = useCallback(async () => {
    if (screenRef.current === 'zoom') return;
    // you walk your island as an avatar: the first time, make one
    if (!player().created) { remember(); setCreateFor('island'); go('create'); return; }
    // capture the mouse now, while the click still counts as a user gesture: mouse look is on from the first frame on the island
    const shellEl = document.querySelector('.shell') as HTMLElement | null;
    if (shellEl) captureMouse(shellEl);
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
      else if (s === 'create' && createForRef.current === 'avatars') go('avatars');
      else if (s === 'hub' || s === 'activities' || s === 'islands' || s === 'settings' || s === 'create' || s === 'avatars') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [back, go, toGoblin, toHome]);

  const picks = planets.find((p) => p.id === picked) ?? null;
  const pickedRow = visible.find((a) => a.id === picked) ?? null;
  /** Goblin Racing races as your goblin (your first avatar of that kind), whatever avatar walks your island. */
  const yourGoblin = (): AvatarLook | null => player().looks.find((l) => kindOf(l) === 'goblin') ?? null;
  /** What Goblin Racing's window and menu say: the game in one line, and what Play does for you (a new player learns it makes their first avatar). */
  const goblinStatus = { doc: goblinRacing().doc, you: yourGoblin() ? `You race as ${yourGoblin()!.name}.` : player().created ? 'Play makes you a goblin to race as.' : 'Play makes your first avatar: a goblin.' };
  /** An activity: Goblin Racing opens its own menu (the window grows); others open their sections. */
  /** Goblin Racing's sections (tournaments, spectate, rankings, track editor, the bookie): its Race modes (Multiplayer returns with online play). */
  const openSections = (): void => { origin.current = 'goblin'; setActivityId('goblin-racing'); go('activity'); };
  const openActivity = (id: string): void => { setActivityId(id); if (id === 'goblin-racing') toGoblin(); else { origin.current = 'home'; go('activity'); } };
  /** Goblin Racing's Play: the first game you play makes your first avatar (a goblin); then, and every time after, it is a race. */
  const play = (): void => { if (!yourGoblin()) { origin.current = 'goblin'; setCreateFor('race'); go('create'); } else startRace('select', 'goblin'); };
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
  /** The island My island opens (the home says its name, and "carry on" once you have been there). */
  const homeIsland = registry.get(activeIslandId() ?? '') ?? null;
  /** Open one of your islands and walk it (from My islands). */
  const openIslandNow = (id: string): void => {
    // you walk an island as an avatar: a new player makes one first, then lands on this island
    if (!player().created) { openIsland(id); setWorld(null); remember(); setCreateFor('island'); go('create'); return; }
    const w = openWorld(id); if (w) { setSession(true); setLevel('goblin'); setIntro(false); go('island'); }
  };
  /** A new island from My islands: a template as it is, or the wizard's own shape built now; Manual and the wizard open it straight away. */
  const makeIsland = (c: NewIslandChoice): void => {
    let json: string | null = null;
    if (c.shape) { pinMapKey(null); const rt = makeRuntime(); const sc = buildMakerScene(rt, c.shape.seed, c.shape); json = JSON.stringify(mapBundle(rt, sc.sceneId)); }
    const made = createIslandWithMap(c.name, c.template, json);
    setNewIsland(false);
    if (made.error) { setNote(made.error); return; }
    if (c.open && made.id) openIslandNow(made.id); else setNote(`Made ${c.name}. Open it from the list.`);
  };
  /** The island the track editor (and its test drive) works on. */
  const editWorld = editing === 'racing' ? raceWorld : world;

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
              onActivities={toActivities} onHub={() => toHub()} onMainMenu={toHome} onReady={() => setStageReady(true)} />
          </div>
          {screen === 'home' && (!pickedRow || pickedRow.id === 'goblin-racing') ? (
            <GoblinPreview {...goblinStatus} loading={!stageReady} onOpen={toGoblin}
              actions={[{ label: 'Play', go: true, onClick: () => { toGoblin(); play(); } }, { label: 'Race modes', onClick: () => { toGoblin(); openSections(); } }, { label: 'Settings', onClick: () => { toGoblin(); toSettings(); } }]} />
          ) : null}
          {/* another activity's planet: its own window on the same live island (activities are made from Goblin Racing) */}
          {screen === 'home' && pickedRow && pickedRow.id !== 'goblin-racing' ? (
            <GoblinPreview name={pickedRow.name} doc={pickedRow.doc} you={pickedRow.forkOf ? 'Made from Goblin Racing: the same races under its own name and planet.' : 'An activity of your own.'} loading={!stageReady}
              onOpen={() => openActivity(pickedRow.id)} actions={[{ label: 'Open', go: true, onClick: () => openActivity(pickedRow.id) }, { label: 'Back to Goblin Racing', onClick: () => setPicked('goblin-racing') }]} />
          ) : null}
          {screen === 'goblin' ? <GoblinFront {...goblinStatus} onPlay={play} onModes={openSections} onSettings={toSettings} onHome={toHome} /> : null}
        </div>
      ) : null}
      {screen === 'island' || screen === 'zoom' ? <GalaxyBar open={islandMenu || level === 'island'} island={screen === 'island'} level={level} onLevel={setLevel} onBackToGalaxy={() => toHub()} /> : null}
      {/* above the galaxy bar: the island's Walk/Studio, 1st/3rd and Flat/PBR toggles are drawn here, so the bar never covers them */}
      {/* there from the dive on: the island view puts its toggles here when it mounts (mounting before the slot existed left them under the bar) */}
      {islandMounted ? <div className="hud-top" id="hud-top" /> : null}
      {galaxyOn ? (
        <div className="shell-layer" style={{ zIndex: 2, opacity: galaxyOpacity, transition: 'opacity .9s ease', pointerEvents: galaxyOpacity < 0.5 ? 'none' : 'auto' }}>
          <GalaxyCanvas ref={galaxy} planets={planets} mode={screen === 'home' ? 'hub' : 'backdrop'} focusId={screen === 'home' ? picked ?? 'goblin-racing' : undefined} highlightId={screen === 'home' ? picked ?? 'goblin-racing' : undefined} reducedMotion={reduced} onPick={(id) => { setPicked(id); }} focusShift={screen === 'home' ? 16 : 0} onFocusScreen={screen === 'home' ? drawLeader : undefined} />
        </div>
      ) : null}

      {screen === 'create' ? (
        <div className="shell-layer shell-ui" style={{ zIndex: 3 }}>
          {createFor === 'race' ? (
            // the first game you play makes your first avatar: Goblin Racing makes a goblin (a new one beside any others you have)
            <CreateGoblin kind="goblin" fresh={player().created} title="Your goblin" doneLabel="Done: to the race" onBack={back}
              onDone={(look) => { if (!player().looks.some((l) => l.id !== look.id)) update((pr) => ({ ...pr, name: look.name })); startRace('select', 'goblin'); }} />
          ) : createFor === 'island' ? (
            <CreateGoblin voice="setmix" chooseKind title="Your avatar" doneLabel="Done: to my island" onBack={back} onDone={(look) => { update((pr) => ({ ...pr, name: look.name })); void myIsland(); }} />
          ) : (
            <CreateGoblin voice="setmix" key={editLook?.id ?? 'new'} {...(editLook ? { edit: editLook } : { chooseKind: true, fresh: true, kind: newKind })} title={editLook ? `Change ${editLook.name}` : 'New avatar'} doneLabel="Save"
              onBack={() => go('avatars')} onDone={() => go('avatars')} />
          )}
        </div>
      ) : null}

      {screen === 'home' ? (
        <div className="shell-layer shell-ui sm-layer" style={{ zIndex: 4 }}>
          <SetMixHome leader={{ line: leaderLine, ring: leaderRing }} credits={profile.credits} onMyIsland={() => { setPicked('home'); toIslands(); }} onAvatars={toAvatars} onCommunity={() => toHub()} onSettings={toSettings}
            onIslandNow={() => void myIsland()} island={homeIsland ? { name: homeIsland.name, visited: player().created && homeIsland.lastVisitedAt > homeIsland.createdAt + 1000 } : null} />
          {/* another planet picked: what is played there (Goblin Racing shows its live window instead) */}
          {/* your planet picked: its islands, drawn from above; pick one to go in, or open the planet for all of them */}
          {picks && picks.id === 'home' ? (
            <div ref={planetWinEl} className="planet-stage">
              <PlanetWindow islands={islandRows} activeId={activeIslandId()} onGo={openIslandNow} onOpen={toIslands} />
            </div>
          ) : null}
        </div>
      ) : null}

      {screen === 'avatars' ? (
        <div className="shell-layer shell-ui" style={{ zIndex: 3 }}>
          <AvatarsWindow onClose={back} onNew={(k) => { setEditLook(null); setNewKind(k); setCreateFor('avatars'); go('create'); }} onEdit={(l) => { setEditLook(l); setCreateFor('avatars'); go('create'); }} />
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
            {newActivity ? <NewActivity onCancel={() => setNewActivity(false)} onMake={(c) => { update((pr) => makeActivity(pr, c)); setNewActivity(false); setNote(`Made ${c.name}. Its planet is in the galaxy.`); }} /> : (
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
              <button className="shell-activity new" onClick={() => setNewActivity(true)}><Plus size={18} strokeWidth={1.4} />New activity</button>
            </div>
            )}
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
          <div className="shell-window wide" role="dialog" aria-label="My planet">
            <header>
              <h3>My planet</h3>
              <button aria-label="Undo" title={registry.canUndo ? `Undo: ${registry.history().at(-1) ?? ''}` : 'Nothing to undo'} disabled={!registry.canUndo} onClick={() => { const e = undoIslands(); if (e) setNote(e); }}><Undo2 size={14} strokeWidth={1.6} /></button>
              <button aria-label="Redo" title="Redo" disabled={!registry.canRedo} onClick={() => { const e = redoIslands(); if (e) setNote(e); }}><Redo2 size={14} strokeWidth={1.6} /></button>
              <button onClick={back}>Close</button>
            </header>
            {newIsland ? <NewIsland onCancel={() => setNewIsland(false)} onMake={makeIsland} /> : (<>
            <p className="hint">Your islands, drawn from above as they are now. Go into one to walk and build it.</p>
            <PlanetScreen islands={islandRows} activeId={activeIslandId()} onGo={openIslandNow} onNew={() => setNewIsland(true)}
              onRename={(id, name) => { const err = renameIsland(id, name); if (err) setNote(err); }}
              onDuplicate={(id) => { const e = duplicateIsland(id); if (e) setNote(e); }}
              onDelete={(id) => { const e = removeIsland(id); if (e) setNote(e); if (world?.id === id) setWorld(null); }} />
            </>
            )}
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

      {screen === 'build' && editWorld ? (
        <div className="shell-layer" style={{ zIndex: 4 }}>
          <MapMaker key={editWorld.id} rt={editWorld.rt} scene={editWorld.scene} onTestDrive={() => { setRaceEntry('select'); setRaceAuto(true); setRaceBack('build'); setRaceRt(null); go('racing'); }}
            onExit={editing === 'racing' ? openSections : toIsland} onMenu={toHome} {...(editing === 'racing' ? { exitLabel: 'Back to Goblin Racing', place: 'Goblin Racing island' } : { onIslands: toIslands })} onCommunity={() => toHub()} />
        </div>
      ) : null}

      {screen === 'racing' && (raceAuto ? editWorld : raceRt) ? (
        <div className="shell-layer" style={{ zIndex: 4 }}>
          <App profile={profile} onProfile={update} rt={(raceAuto ? editWorld! : raceRt!).rt} fromMap={raceAuto ? true : raceRt!.fromMap} {...(raceAuto ? { autoStart: true } : { entry: raceEntry })} onExit={() => { pinMapKey(null); go(raceBack); }} />
        </div>
      ) : null}
    </div>
  );
}
