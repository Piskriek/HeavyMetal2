import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig } from 'framer-motion';
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Check, Hammer, Image as ImageIcon, Keyboard, Play, Settings2, Trophy } from 'lucide-react';
import MainMenu from './components/MainMenu';
import SettingsPanel from './components/SettingsPanel';
import Modal from './components/Modal';
import NewGameSetup from './components/NewGameSetup';
import { AirSupplyGuide } from './components/AirSupplies';
import RaceScreen from './screens/RaceScreen';
import MapEditorScreen from './screens/MapEditorScreen';
import { OPTIONS_KEY, RECORDS_KEY, readOptions, readRecords, recordsForStorage, savePreference } from './game/preferences';
import { COURSES, type RunRecord } from './game/types';
import { SETUP_KEY, commitRound, createSession, eventTitle, nextRound, recordModeLabel, resumeLabel, sessionComplete, sessionConfig, sessionTrackId, type RaceFinish, type RaceSession, type RaceSetup, type SessionPhase } from './game/session';
import { setActiveIslandTrack } from './game/island-route/island-props-storage';
import { payRacePurse, placeBet, settleRound, updateWallet, voidRound } from './game/meta/wallet';
import type { CustomEvent } from './game/custom-events';
import type { GoblinProfile } from './game/meta/goblin-profiles';
import type { SlipBet } from './components/bets/BetSlip';
import QuickRacesPanel from './components/quick/QuickRacesPanel';
import MultiplayerHub from './components/multiplayer/MultiplayerHub';
import { toggleFullscreen } from './platform/platform';
import { readSave, writeSave, type SaveNotice } from './game/save';
import './menu.css';
import './setup.css';
import './frames.css';
import './hud.css';
import './creator.css';
import './garage.css';
import './hub.css';

// MP-T06: the goblin creator loads when it is opened.
const BallCustomizer = lazy(() => import('./components/garage/BallCustomizer'));
const CharacterCreatorStudio = lazy(() => import('./components/creator/CharacterCreatorStudio'));

type Panel = 'settings' | 'guide' | 'records' | 'credits' | 'new-game' | 'creator' | 'garage' | 'quick-races' | 'multiplayer' | null;

/** A custom event races each round on its own island track: make it the active one before the round loads. */
function applyRoundTrack(session: RaceSession | null) {
  const track = session ? sessionTrackId(session) : null;
  if (track) setActiveIslandTrack(track);
}

/** "Serpentine Cup · round 2 of 3" / "Quick Race" */
const roundBetLabel = (session: RaceSession, round: number) =>
  session.rounds.length > 1 ? `${eventTitle(session)} · round ${round + 1} of ${session.rounds.length}` : eventTitle(session);

const WRITE_FAILED = 'Progress could not be saved on this device. Your current event keeps running in this tab.';

export default function App() {
  // Read the durable event once, before the first paint, so a reload lands on a coherent flow.
  const hydration = useMemo(() => { const saved = readSave(); applyRoundTrack(saved.session); return saved; }, []);
  const [options, setOptions] = useState(readOptions);
  const [records, setRecords] = useState(readRecords);
  const [screen, setScreen] = useState<'menu' | 'race' | 'editor'>('menu');
  const [panel, setPanel] = useState<Panel>(null);
  const [session, setSession] = useState<RaceSession | null>(hydration.session);
  const [phase, setPhase] = useState<SessionPhase>(hydration.phase);
  const [lastSetup, setLastSetup] = useState<RaceSetup>(() => ({ ...hydration.draft, loadout: { ...hydration.draft.loadout } }));
  const [notices, setNotices] = useState<SaveNotice[]>(hydration.notices);
  const [restartNote, setRestartNote] = useState<string | null>(hydration.restartNotice);
  const [persistWarning, setPersistWarning] = useState<string | null>(hydration.storageBlocked ? hydration.notices[0]?.text ?? WRITE_FAILED : null);
  const [clearRecords, setClearRecords] = useState(false);
  const [fullscreenFallback, setFullscreenFallback] = useState(false);
  // Quick Races hands the setup a mode (skip its first step) or a custom event.
  const [setupEvent, setSetupEvent] = useState<CustomEvent | null>(null);
  const [setupSkipMode, setSetupSkipMode] = useState(false);
  // The Goblin Creator / Ball Garage opened from Profile go back to it on close.
  const [creatorStart, setCreatorStart] = useState<GoblinProfile | null>(null);
  const [returnToProfile, setReturnToProfile] = useState(false);
  const shell = useRef<HTMLDivElement>(null);
  const config = useMemo(() => session ? sessionConfig(session) : null, [session?.id, session?.round]);
  const recoveryNotes = useMemo(() => [...(restartNote ? [restartNote] : []), ...notices.map((notice) => notice.text)], [restartNote, notices]);

  useEffect(() => { if (!savePreference(OPTIONS_KEY, options)) setPersistWarning(WRITE_FAILED); }, [options]);
  // T02: stored under the explicit summary policy; the in-memory list keeps every row.
  useEffect(() => { if (!savePreference(RECORDS_KEY, recordsForStorage(records))) setPersistWarning(WRITE_FAILED); }, [records]);
  useEffect(() => { savePreference(SETUP_KEY, lastSetup); }, [lastSetup]);
  // Atomic, idempotent persistence of the event phase. Identical payloads are not rewritten.
  useEffect(() => {
    const result = writeSave({ phase, draft: lastSetup, session });
    setPersistWarning(result.ok ? null : (result.error ?? WRITE_FAILED));
  }, [phase, session, lastSetup]);
  useEffect(() => {
    notices.forEach((notice) => notice.level === 'warning' && console.warn('[Heavy Metal GP 2] save recovery:', notice.text));
  }, [notices]);
  useEffect(() => {
    document.documentElement.classList.toggle('high-contrast-game', options.highContrast);
    document.documentElement.classList.toggle('reduced-motion-game', options.reducedMotion);
    return () => { document.documentElement.classList.remove('high-contrast-game', 'reduced-motion-game'); };
  }, [options.highContrast, options.reducedMotion]);

  const closePanel = useCallback(() => {
    setClearRecords(false);
    // The creator or garage opened from Profile: back to the Profile.
    if (returnToProfile && (panel === 'creator' || panel === 'garage')) { setPanel('multiplayer'); return; }
    setPanel(null);
    setReturnToProfile(false);
  }, [returnToProfile, panel]);
  const quickRaces = useCallback(() => { setReturnToProfile(false); setPanel('quick-races'); }, []);
  const multiplayer = useCallback(() => { setReturnToProfile(false); setPanel('multiplayer'); }, []);
  const openSetup = useCallback((mode: RaceSetup['mode'] | null, event: CustomEvent | null = null) => {
    if (mode) setLastSetup((s) => ({ ...s, mode, customPhysics: mode === 'quick' && s.customPhysics }));
    setSetupEvent(event);
    setSetupSkipMode(Boolean(mode || event));
    setPanel('new-game');
  }, []);
  const resume = useCallback(() => { setPanel(null); setScreen('race'); }, []);
  const leaveRaceFullscreen = useCallback((action: () => void) => {
    if (document.fullscreenElement && document.fullscreenElement !== shell.current) {
      void document.exitFullscreen().catch(() => {}).finally(action);
    } else action();
  }, []);
  const mainMenu = useCallback(() => {
    const showMenu = () => { setPanel(null); setScreen('menu'); };
    if (document.fullscreenElement && document.fullscreenElement !== shell.current) {
      void document.exitFullscreen().catch(() => {}).finally(showMenu);
    } else showMenu();
  }, []);
  const settings = useCallback(() => setPanel('settings'), []);
  const newGame = quickRaces;
  const mapEditor = useCallback(() => { setPanel(null); setScreen('editor'); }, []);
  const startRace = useCallback((setup: RaceSetup, bets: SlipBet[] = []) => {
    leaveRaceFullscreen(() => {
      setLastSetup(setup);
      const next = createSession(setup);
      // The event being replaced will never race its open rounds: their stakes go back.
      const replaced = session;
      updateWallet((doc) => {
        let d = doc;
        if (replaced) replaced.rounds.forEach((_, r) => { d = voidRound(d, replaced.id, r); });
        for (const b of bets) d = placeBet(d, { sessionId: next.id, round: 0, market: b.market, stake: b.stake, odds: b.odds, label: roundBetLabel(next, 0), fieldSize: next.setup.fieldSize }).doc;
        return d;
      });
      applyRoundTrack(next);
      setSession(next);
      setPhase('grid');
      setNotices([]);
      setRestartNote(null);
      setScreen('race');
      setPanel(null);
    });
  }, [leaveRaceFullscreen, session]);

  useEffect(() => {
    (window as any).__startRace = (setup?: RaceSetup) => startRace(setup ?? lastSetup);
    return () => { delete (window as any).__startRace; };
  }, [startRace, lastSetup]);
  // Commits are idempotent: a duplicate round record is ignored, never scored twice.
  const finishRound = useCallback((record: RunRecord) => {
    if (!session) return;
    const next = commitRound(session, record);
    if (next === session) return;
    // Race purse and the bookie: settled from the committed result, once (idempotent keys).
    const round = record.round ?? session.round;
    updateWallet((doc) => payRacePurse(
      settleRound(doc, session.id, round, { finished: record.completed, position: record.position }),
      session.id, round, record.completed, record.position, record.fieldSize ?? session.setup.fieldSize, roundBetLabel(session, round)));
    setSession(next);
    setPhase(sessionComplete(next) ? 'cup-results' : 'round-results');
    setNotices([]);
  }, [session]);
  const continueRace = useCallback((finish?: RaceFinish | null) => {
    leaveRaceFullscreen(() => {
      if (session) {
        const complete = sessionComplete(session);
        const next = complete ? createSession(session.setup) : nextRound(session, finish);
        if (next !== session) {
          applyRoundTrack(next);
          setSession(next);
          setPhase(next.round !== session.round ? 'grid' : sessionComplete(next) ? 'cup-results' : 'round-results');
        }
      }
      setRestartNote(null);
      setScreen('race');
      setPanel(null);
    });
  }, [session, leaveRaceFullscreen]);
  // The race screen owns the live engine; it may only move the phase between grid and racing.
  const noteRacePhase = useCallback((next: 'grid' | 'racing') => {
    setPhase((current) => current === 'round-results' || current === 'cup-results' ? current : next);
    if (next === 'racing') {
      setNotices((current) => current.length ? [] : current);
      setRestartNote(null);
    }
  }, []);
  // RUN.world owns fullscreen when hosted; the browser's own otherwise (a CSS fallback if refused).
  const fullscreen = async () => {
    if (!(await toggleFullscreen(shell.current))) setFullscreenFallback((previous) => !previous);
  };

  return (
    <MotionConfig reducedMotion={options.reducedMotion ? 'always' : 'user'}>
      <div ref={shell} className={`game-application ${fullscreenFallback ? 'menu-fullscreen' : ''}`}>
        {screen === 'menu' && <MainMenu options={options} hasRace={Boolean(session)} resumeLabel={resumeLabel(session, phase)} resumeNote={recoveryNotes[0] ?? null} storageWarning={persistWarning} onQuickRaces={quickRaces} onMultiplayer={multiplayer} onResume={resume} onMapEditor={mapEditor}
          onSettings={settings} onGuide={() => setPanel('guide')}
          onCredits={() => setPanel('credits')} onSound={() => setOptions((previous) => ({ ...previous, sound: !previous.sound }))} onFullscreen={() => void fullscreen()} />}

        {screen === 'editor' && (
          <MapEditorScreen
            options={options}
            onMainMenu={mainMenu}
          />
        )}

        {session && config && <div className="race-screen-host" hidden={screen !== 'race'} aria-hidden={screen !== 'race'} inert={screen !== 'race'}>
          <RaceScreen key={`${session.id}:${session.round}`} active={screen === 'race' && panel === null} options={options} setOptions={setOptions}
            config={config} session={session} onRoundComplete={finishRound} onContinue={continueRace} onNewGame={newGame} onPhase={noteRacePhase}
            gridNotes={recoveryNotes} storageWarning={persistWarning}
            records={records} setRecords={setRecords} onMainMenu={mainMenu} onSettings={settings} />
        </div>}

        <AnimatePresence>
          {panel === 'settings' && <SettingsPanel key="settings" options={options} onChange={setOptions} onClose={closePanel} />}
          {panel === 'new-game' && <NewGameSetup key={`new-game:${setupEvent?.id ?? lastSetup.mode}`} initial={lastSetup} hasSession={Boolean(session)} finishedSession={session ? sessionComplete(session) : false} onStart={startRace}
            onClose={setupSkipMode ? quickRaces : closePanel} skipModeStep={setupSkipMode} event={setupEvent} />}

          {panel === 'quick-races' && <Modal key="quick-races" title="Quick Races" eyebrow="THE ISLAND, YOUR WAY" onClose={closePanel} className="fantasy-dialog quick-races-dialog" wide backdrop="arena">
            <QuickRacesPanel onQuickRace={() => openSetup('quick')} onTournament={() => openSetup('tournament')} onRaceEvent={(event) => openSetup(null, event)} />
          </Modal>}

          {panel === 'multiplayer' && <Modal key="multiplayer" title="Multiplayer" eyebrow="YOUR GOBLIN GOES WHERE YOU RACE" onClose={closePanel} className="fantasy-dialog multiplayer-dialog" wide backdrop="vault">
            <MultiplayerHub records={records} startOnProfile={returnToProfile} onQuickRaces={quickRaces}
              onOpenCreator={(start) => { setCreatorStart(start); setReturnToProfile(true); setPanel('creator'); }}
              onOpenGarage={() => { setReturnToProfile(true); setPanel('garage'); }} />
          </Modal>}

          {panel === 'guide' && <Modal key="guide" title="The Driver's Handbook" eyebrow="READING THIS COUNTS AS SAFETY TRAINING" onClose={closePanel} className="fantasy-dialog" wide backdrop="workshop">
            <p className="fantasy-lead">Pick your rider and capsule before the race. Your orange goblin starts in lane 3 against the rival riders. Falling costs time, not the whole race.</p>
            <div className="handbook-row"><Play size={23} /><div><h3>One shove off the pad</h3><p>Press Space or Enter (tap GO on a phone) and the starter goblin pushes you off. Your first split is a solo run; the rivals join at the merge gate.</p></div><kbd>Space</kbd></div>
            <div className="handbook-row"><ArrowRight size={23} /><div><h3>Take the racing line. Or theirs.</h3><p>A and D change lanes. Contact shoves rivals sideways. Heavy balls push harder, but light balls jump higher.</p></div><kbd>A / D</kbd></div>
            <div className="handbook-row"><ArrowUpRight size={22} /><div><h3>A little air, a lot of trouble</h3><p>Space spends an air-bounce charge; spring pads refill them. Shift boosts; chevron pads refill a charge.</p></div><kbd>Space / Shift</kbd></div>
            <div className="handbook-row"><Settings2 size={23} /><div><h3>Keep the chaos under control</h3><p>P pauses. R restarts the current unfinished race. M toggles sound. V changes the camera, and [ and ] slow the race down or speed it back up. Presets are fixed during competition; Quick Race custom practice enables the tuning sliders.</p></div><Keyboard size={25} /></div>
            <AirSupplyGuide />
            <div className="fantasy-dialog-actions"><span className="subtle-note">No brakes. No refunds. Now you know.</span><button className="fantasy-primary" onClick={closePanel}>I Feel Qualified <Check size={16} /></button></div>
          </Modal>}

          {panel === 'creator' && <Modal key="creator" title="Goblin Creator" eyebrow="EVERY FACE A BAD IDEA" onClose={closePanel} className="fantasy-dialog creator-dialog" wide backdrop="workshop"><Suspense fallback={<p className="fantasy-lead">Warming up the workshop…</p>}><CharacterCreatorStudio key={creatorStart?.id ?? 'new'} startWith={creatorStart} /></Suspense></Modal>}

          {panel === 'garage' && <Modal key="garage" title="Ball Garage" eyebrow="PAINT IT, THEN ROLL IT" onClose={closePanel} className="fantasy-dialog garage-dialog" wide backdrop="workshop"><Suspense fallback={<p className="fantasy-lead">Opening the garage…</p>}><BallCustomizer /></Suspense></Modal>}

          {panel === 'records' && <Modal key="records" title="Hall of Chaos" eyebrow="SOME BAD IDEAS BECOME LEGENDS" onClose={closePanel} className="fantasy-dialog" wide backdrop="vault">
            {records.length ? <>
              <p className="fantasy-lead">Your best runs, saved on this device. No account. No witnesses required.</p>
              <div className="fantasy-records-wrap"><table className="fantasy-records"><thead><tr><th>Rank</th><th>Track</th><th>Finish</th><th>Distance</th><th>Chaos</th></tr></thead><tbody>{records.map((record, index) => <tr key={record.id}><td>{String(index + 1).padStart(2, '0')}</td><td>{COURSES.find((track) => track.id === record.course)?.name ?? 'Rustbucket Ridge'}<small>{recordModeLabel(record)} / {new Date(record.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</small></td><td>{record.completed ? `${record.position ?? 1} / ${record.fieldSize ?? 4}` : 'DNF'}</td><td>{record.distance.toLocaleString()} m</td><td>{record.score.toLocaleString()}</td></tr>)}</tbody></table></div>
              <div className="fantasy-dialog-actions"><button className="fantasy-link" onClick={() => { if (clearRecords) { setRecords([]); setClearRecords(false); } else setClearRecords(true); }}>{clearRecords ? 'Confirm: clear local records' : 'Clear local records'}</button>{clearRecords && <button className="fantasy-link" onClick={() => setClearRecords(false)}>Cancel</button>}<button className="fantasy-primary" onClick={closePanel}>Back <ArrowLeft size={15} /></button></div>
            </> : <div className="menu-empty-state"><Trophy size={53} strokeWidth={1.15} /><h3>A Legend in the Making</h3><p>The record book is empty.<br />The track is not going to wreck itself.</p><button className="fantasy-primary" onClick={newGame}>Make Some History <ArrowRight size={16} /></button></div>}
          </Modal>}

          {panel === 'credits' && <Modal key="credits" title="The Art & the Engineering" eyebrow="ORIGINAL GOBLINS. CAREFULLY CONSIDERED CHAOS." onClose={closePanel} className="fantasy-dialog" wide backdrop="workshop">
            <figure className="menu-concept"><img src="/art/goblin-rally-concept.png" alt="Original Goblin Rally concept painting with a goblin slingshot, timber loop, sheep, and cheering crowds in a mountain arena." /><figcaption>THE ORIGINAL CONCEPT / GOBLIN RALLY</figcaption></figure>
            <p className="fantasy-lead">An original fantasy racing game. The visual direction takes cues from readable, hand-painted high fantasy; no Blizzard characters, logos, or interface assets are used.</p>
            <div className="research-links"><h3><ImageIcon size={18} />Original art</h3>
              <p className="artist-note">Riders, full-body goblins, racing balls, air supplies, blimp, landmarks and course paintings are original generated artwork made for this game. They are stored as alpha PNGs under <code>public/art/</code> with a typed manifest at <code>src/game/art-manifest.json</code>; the source sheets and the keying, despill and normalization steps are documented in <code>docs/ART_PIPELINE.md</code>. Downloads in The Workshop are the exact files the race draws.</p>
            </div>
            <div className="research-links"><h3><BookOpen size={18} />Design references</h3>
              <a href="https://news.blizzard.com/en-us/article/23737992/shadowlands-an-inside-look-at-the-character-creation-ui-redesign" target="_blank" rel="noreferrer">Blizzard: Focus, hierarchy, and choice <ArrowUpRight size={15} /></a>
              <a href="https://80.lv/articles/matt-mcdaid-mastering-the-stylized-art" target="_blank" rel="noreferrer">Matt McDaid: Readability in stylized art <ArrowUpRight size={15} /></a>
              <a href="https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/112" target="_blank" rel="noreferrer">Xbox: Consistent, accessible menu navigation <ArrowUpRight size={15} /></a>
              <a href="https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas" target="_blank" rel="noreferrer">MDN: Keep the rendering work where it belongs <ArrowUpRight size={15} /></a>
            </div>
            <div className="fantasy-dialog-actions"><span className="subtle-note"><Hammer size={14} />Goblin Engineering Co.</span><button className="fantasy-primary" onClick={closePanel}>Back to the Menu <ArrowLeft size={15} /></button></div>
          </Modal>}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}