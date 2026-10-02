import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { Copy, Plus, Trash2 } from 'lucide-react';
import type { Runtime } from '@hm/engine';
import { App } from '../app';
import { IslandWalk } from '../island';
import { hasSavedMap, loadMap } from '../maker/storage';
import { GalaxyCanvas, type GalaxyHandle, type PlanetDef } from './galaxy';
import { GoblinRacingMenu } from './racing-menu';
import { Community } from './community';
import { createActivity, duplicateActivity, loadProfile, removeActivity, saveProfile, unhideAll, type ActivityRow, type Profile } from './profile';

/**
 * The shell: a game inside a game. It always opens on the main menu over the galaxy. My Island dives galaxy -> planet -> island -> goblin and hands
 * over to walking. Esc opens the jump menu. Multiplayer is the galaxy hub; every activity (Goblin Racing first) is a separate game with its own menu.
 */
type Screen = 'menu' | 'zoom' | 'island' | 'activities' | 'hub' | 'activity' | 'racing' | 'settings' | 'build';

const HOME: PlanetDef = { id: 'home', name: 'My Island', hue: 0.52, size: 1, ring: false };
const toPlanet = (a: ActivityRow): PlanetDef => ({ id: a.id, name: a.name, hue: a.hue, size: a.size, ring: a.ring, hosting: a.id === 'goblin-racing' });

export function Shell(props: { readonly rt: Runtime; readonly onBuild: () => void }): ReactElement {
  const { rt, onBuild } = props;
  const [screen, setScreen] = useState<Screen>('menu');
  const [profile, setProfile] = useState<Profile>(() => loadProfile());
  const [islandOn, setIslandOn] = useState(false);
  const [intro, setIntro] = useState(false);
  const [galaxyOpacity, setGalaxyOpacity] = useState(1);
  const [activityId, setActivityId] = useState('goblin-racing');
  const [picked, setPicked] = useState<string | null>('goblin-racing');
  const [hubTab, setHubTab] = useState<'hub' | 'community'>('hub');
  const [raceEntry, setRaceEntry] = useState<'select' | 'custom'>('select');
  const galaxy = useRef<GalaxyHandle>(null);
  const screenRef = useRef(screen);
  screenRef.current = screen;
  const reduced = useMemo(() => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } }, []);
  const update = useCallback((fn: (p: Profile) => Profile) => setProfile((p) => { const n = fn(p); saveProfile(n); return n; }), []);

  const visible = profile.activities.filter((a) => !a.hidden);
  const planets = useMemo(() => [HOME, ...visible.map(toPlanet)], [profile.activities]); // eslint-disable-line react-hooks/exhaustive-deps
  const galaxyOn = screen === 'menu' || screen === 'zoom' || screen === 'hub' || screen === 'activities' || screen === 'settings' || screen === 'activity';

  /** My Island: dive to the home planet, cross-fade to the island arriving from above, then walk. */
  const myIsland = useCallback(async () => {
    if (screenRef.current === 'zoom') return;
    // capture the mouse now, while the click still counts as a user gesture: mouse look is on from the first frame on the island
    try { const r = (document.querySelector('.shell') as HTMLElement | null)?.requestPointerLock() as unknown as Promise<void> | undefined; r?.catch?.(() => undefined); } catch { /* not available */ }
    if (islandOn && screenRef.current !== 'menu') { setScreen('island'); setGalaxyOpacity(0); return; }
    setScreen('zoom'); setIntro(!reduced);
    if (!reduced) await galaxy.current?.diveTo('home', 2600);
    setIslandOn(true);
    setGalaxyOpacity(0);
    window.setTimeout(() => { if (screenRef.current === 'zoom') setScreen('island'); }, reduced ? 0 : 900);
  }, [islandOn, reduced]);

  const toMenu = useCallback(() => { setScreen('menu'); setGalaxyOpacity(1); setPicked('goblin-racing'); }, []);
  const toHub = useCallback(() => { setScreen('hub'); setHubTab('hub'); setGalaxyOpacity(1); }, []);
  const toActivities = useCallback(() => { setScreen('activities'); setGalaxyOpacity(1); }, []);

  // Esc on the shell screens: one step back (the island handles its own Esc)
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      const s = screenRef.current;
      if (s === 'activity') setScreen('hub');
      else if (s === 'hub' || s === 'activities' || s === 'settings') { if (islandOn) { setScreen('island'); setGalaxyOpacity(0); } else toMenu(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [islandOn, toMenu]);

  const fromMap = useMemo(() => hasSavedMap() && loadMap(rt) !== null, [rt]);
  const picks = planets.find((p) => p.id === picked) ?? null;
  const pickedRow = visible.find((a) => a.id === picked) ?? null;

  const openActivity = (id: string): void => { setActivityId(id); setScreen('activity'); };

  return (
    <div className="shell">
      {islandOn ? (
        <div className="shell-layer" style={{ zIndex: 1 }}>
          <IslandWalk rt={rt} intro={intro} grownUp={profile.grownUp} skin={profile.skin} onIntroDone={() => setIntro(false)} onEdit={onBuild} onActivities={toActivities} onHub={toHub} onMainMenu={toMenu} />
        </div>
      ) : null}
      {galaxyOn ? (
        <div className="shell-layer" style={{ zIndex: 2, opacity: galaxyOpacity, transition: 'opacity .9s ease', pointerEvents: galaxyOpacity < 0.5 ? 'none' : 'auto' }}>
          <GalaxyCanvas ref={galaxy} planets={planets} mode={screen === 'hub' ? 'hub' : 'backdrop'} focusId={screen === 'hub' ? 'goblin-racing' : undefined} highlightId={screen === 'hub' ? 'goblin-racing' : undefined} reducedMotion={reduced} onPick={(id) => { setPicked(id); }} />
        </div>
      ) : null}

      {screen === 'menu' ? (
        <div className="shell-layer shell-ui" style={{ zIndex: 3 }}>
          <div className="shell-brand"><b>GOBLIN</b><i>PRESET STUDIO</i></div>
          <nav className="shell-menu" aria-label="Main menu">
            <button className="go" onClick={toActivities}>Play</button>
            <button onClick={toHub}>Multiplayer</button>
            <button onClick={() => void myIsland()}>My Island</button>
            <button onClick={() => setScreen('settings')}>Settings</button>
          </nav>
          <p className="shell-foot">Everything is a preset. Press My Island to jump into your goblin.</p>
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
            <header><h3>Activities</h3><button onClick={() => (islandOn ? (setScreen('island'), setGalaxyOpacity(0)) : toMenu())}>Close</button></header>
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
          <GoblinRacingMenu profile={profile} activity={visible.find((a) => a.id === activityId) ?? visible[0] ?? profile.activities[0]!} onBack={() => (islandOn && !picked ? setScreen('island') : setScreen('hub'))}
            onQuickRace={() => { setRaceEntry('select'); setScreen('racing'); }} onMyGoblin={() => { setRaceEntry('custom'); setScreen('racing'); }}
            onProfile={(fn) => update(fn)} />
        </div>
      ) : null}

      {screen === 'settings' ? (
        <div className="shell-layer shell-ui" style={{ zIndex: 3 }}>
          <div className="shell-window narrow" role="dialog" aria-label="Settings">
            <header><h3>Settings</h3><button onClick={toMenu}>Close</button></header>
            <label className="row"><input type="checkbox" checked={profile.grownUp} onChange={(e) => update((p) => ({ ...p, grownUp: e.target.checked }))} /> Grown-up mode (build mode on)</label>
            <p className="hint">Build mode is for adults. Switch it off for a kid profile: My Island and the activities stay, building is hidden.</p>
            <label className="row">Name <input value={profile.name} maxLength={20} onChange={(e) => update((p) => ({ ...p, name: e.target.value }))} /></label>
            <label className="row">Island skin <select value={profile.skin} onChange={(e) => update((p) => ({ ...p, skin: e.target.value as 'flat' | 'pbr' }))}><option value="flat">Flat (matches the voxel goblin)</option><option value="pbr">PBR (full relief)</option></select></label>
            <div className="btns"><button onClick={() => update((p) => ({ ...p, tutorialDone: false }))}>Replay the tutorial</button><button className="danger" onClick={() => { update(() => ({ ...profile, credits: 500, tutorialDone: false, skin: 'flat', signedUp: false, strikes: 0 })); }}>Reset progress</button></div>
          </div>
        </div>
      ) : null}

      {screen === 'racing' ? (
        <div className="shell-layer" style={{ zIndex: 4 }}>
          <App rt={rt} fromMap={fromMap} entry={raceEntry} onExit={() => setScreen('activity')} />
        </div>
      ) : null}
    </div>
  );
}
