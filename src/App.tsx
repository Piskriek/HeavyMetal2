import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig } from 'framer-motion';
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Check, Hammer, Image as ImageIcon, Keyboard, MousePointer2, Play, Settings2, Trophy } from 'lucide-react';
import MainMenu from './components/MainMenu';
import SettingsPanel from './components/SettingsPanel';
import Modal from './components/Modal';
import NewGameSetup from './components/NewGameSetup';
import { AirSupplyGuide } from './components/AirSupplies';
import RaceScreen from './screens/RaceScreen';
import { OPTIONS_KEY, RECORDS_KEY, readOptions, readRecords, savePreference } from './game/preferences';
import { COURSES, type RunRecord } from './game/types';
import { SETUP_KEY, commitRound, createSession, nextRound, recordModeLabel, resumeLabel, sessionComplete, sessionConfig, type RaceSession, type RaceSetup, type SessionPhase } from './game/session';
import { readSave, writeSave, type SaveNotice } from './game/save';
import './menu.css';
import './setup.css';
import './frames.css';
import './hud.css';

type Panel = 'settings' | 'guide' | 'records' | 'credits' | 'new-game' | null;

const WRITE_FAILED = 'Progress could not be saved on this device. Your current event keeps running in this tab.';

export default function App() {
  // Read the durable event once, before the first paint, so a reload lands on a coherent flow.
  const hydration = useMemo(() => readSave(), []);
  const [options, setOptions] = useState(readOptions);
  const [records, setRecords] = useState(readRecords);
  const [screen, setScreen] = useState<'menu' | 'race'>('menu');
  const [panel, setPanel] = useState<Panel>(null);
  const [session, setSession] = useState<RaceSession | null>(hydration.session);
  const [phase, setPhase] = useState<SessionPhase>(hydration.phase);
  const [lastSetup, setLastSetup] = useState<RaceSetup>(() => ({ ...hydration.draft, loadout: { ...hydration.draft.loadout } }));
  const [notices, setNotices] = useState<SaveNotice[]>(hydration.notices);
  const [restartNote, setRestartNote] = useState<string | null>(hydration.restartNotice);
  const [persistWarning, setPersistWarning] = useState<string | null>(hydration.storageBlocked ? hydration.notices[0]?.text ?? WRITE_FAILED : null);
  const [clearRecords, setClearRecords] = useState(false);
  const [fullscreenFallback, setFullscreenFallback] = useState(false);
  const shell = useRef<HTMLDivElement>(null);
  const config = useMemo(() => session ? sessionConfig(session) : null, [session?.id, session?.round]);
  const recoveryNotes = useMemo(() => [...(restartNote ? [restartNote] : []), ...notices.map((notice) => notice.text)], [restartNote, notices]);

  useEffect(() => { if (!savePreference(OPTIONS_KEY, options)) setPersistWarning(WRITE_FAILED); }, [options]);
  useEffect(() => { if (!savePreference(RECORDS_KEY, records)) setPersistWarning(WRITE_FAILED); }, [records]);
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

  const closePanel = useCallback(() => { setPanel(null); setClearRecords(false); }, []);
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
  const newGame = useCallback(() => setPanel('new-game'), []);
  const startRace = useCallback((setup: RaceSetup) => {
    leaveRaceFullscreen(() => {
      setLastSetup(setup);
      setSession(createSession(setup));
      setPhase('grid');
      setNotices([]);
      setRestartNote(null);
      setScreen('race');
      setPanel(null);
    });
  }, [leaveRaceFullscreen]);
  // Commits are idempotent: a duplicate round record is ignored, never scored twice.
  const finishRound = useCallback((record: RunRecord) => {
    if (!session) return;
    const next = commitRound(session, record);
    if (next === session) return;
    setSession(next);
    setPhase(sessionComplete(next) ? 'cup-results' : 'round-results');
    setNotices([]);
  }, [session]);
  const continueRace = useCallback(() => {
    leaveRaceFullscreen(() => {
      if (session) {
        const complete = sessionComplete(session);
        const next = complete ? createSession(session.setup) : nextRound(session);
        if (next !== session) {
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
  const fullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (shell.current?.requestFullscreen) await shell.current.requestFullscreen();
      else setFullscreenFallback((previous) => !previous);
    } catch { setFullscreenFallback((previous) => !previous); }
  };

  return (
    <MotionConfig reducedMotion={options.reducedMotion ? 'always' : 'user'}>
      <div ref={shell} className={`game-application ${fullscreenFallback ? 'menu-fullscreen' : ''}`}>
        {screen === 'menu' && <MainMenu options={options} hasRace={Boolean(session)} resumeLabel={resumeLabel(session, phase)} resumeNote={recoveryNotes[0] ?? null} storageWarning={persistWarning} onNewGame={newGame} onResume={resume}
          onSettings={settings} onGuide={() => setPanel('guide')} onRecords={() => setPanel('records')}
          onCredits={() => setPanel('credits')} onSound={() => setOptions((previous) => ({ ...previous, sound: !previous.sound }))} onFullscreen={() => void fullscreen()} />}

        {session && config && <div className="race-screen-host" hidden={screen !== 'race'} aria-hidden={screen !== 'race'} inert={screen !== 'race'}>
          <RaceScreen key={`${session.id}:${session.round}`} active={screen === 'race' && panel === null} options={options} setOptions={setOptions}
            config={config} session={session} onRoundComplete={finishRound} onContinue={continueRace} onNewGame={newGame} onPhase={noteRacePhase}
            gridNotes={recoveryNotes} storageWarning={persistWarning}
            records={records} setRecords={setRecords} onMainMenu={mainMenu} onSettings={settings} />
        </div>}

        <AnimatePresence>
          {panel === 'settings' && <SettingsPanel key="settings" options={options} onChange={setOptions} onClose={closePanel} />}
          {panel === 'new-game' && <NewGameSetup key="new-game" initial={lastSetup} hasSession={Boolean(session)} finishedSession={session ? sessionComplete(session) : false} onStart={startRace} onClose={closePanel} />}

          {panel === 'guide' && <Modal key="guide" title="The Driver's Handbook" eyebrow="READING THIS COUNTS AS SAFETY TRAINING" onClose={closePanel} className="fantasy-dialog" wide backdrop="workshop">
            <p className="fantasy-lead">Pick your rider and capsule before the race. Your orange goblin starts in lane 3 against the other three riders. Falling costs time, not the whole race.</p>
            <div className="handbook-row"><MousePointer2 size={23} /><div><h3>Launch all four goblins</h3><p>Pull your glowing ball back and release. Or adjust power and angle with the arrow keys, then press Enter.</p></div><kbd>Drag</kbd></div>
            <div className="handbook-row"><ArrowRight size={23} /><div><h3>Take the racing line. Or theirs.</h3><p>A and D change lanes. Contact shoves rivals sideways. Heavy balls push harder, but light balls jump higher.</p></div><kbd>A / D</kbd></div>
            <div className="handbook-row"><Play size={22} /><div><h3>A little hop, a lot of trouble</h3><p>W or J bunny-hops from the ground. Space spends an air-bounce charge. Shift boosts; chevron pads refill a charge.</p></div><kbd>W / Space / Shift</kbd></div>
            <div className="handbook-row"><Settings2 size={23} /><div><h3>Keep the chaos under control</h3><p>P pauses. R restarts the current unfinished race. M toggles sound. Presets are fixed during competition; Quick Race custom practice enables the tuning sliders.</p></div><Keyboard size={25} /></div>
            <AirSupplyGuide />
            <div className="fantasy-dialog-actions"><span className="subtle-note">No brakes. No refunds. Now you know.</span><button className="fantasy-primary" onClick={closePanel}>I Feel Qualified <Check size={16} /></button></div>
          </Modal>}

          {panel === 'records' && <Modal key="records" title="Hall of Chaos" eyebrow="SOME BAD IDEAS BECOME LEGENDS" onClose={closePanel} className="fantasy-dialog" wide backdrop="vault">
            {records.length ? <>
              <p className="fantasy-lead">Your best runs, saved on this device. No account. No witnesses required.</p>
              <div className="fantasy-records-wrap"><table className="fantasy-records"><thead><tr><th>Rank</th><th>Track</th><th>Finish</th><th>Distance</th><th>Chaos</th></tr></thead><tbody>{records.map((record, index) => <tr key={record.id}><td>{String(index + 1).padStart(2, '0')}</td><td>{COURSES.find((track) => track.id === record.course)?.name ?? 'Rustbucket Ridge'}<small>{recordModeLabel(record)} / {new Date(record.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</small></td><td>{record.completed ? `${record.position ?? 1} / 4` : 'DNF'}</td><td>{record.distance.toLocaleString()} m</td><td>{record.score.toLocaleString()}</td></tr>)}</tbody></table></div>
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