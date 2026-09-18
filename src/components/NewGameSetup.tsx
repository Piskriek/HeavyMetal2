import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, ChevronRight, Flag, Gauge, LockKeyhole, RotateCcw, Shield, Sparkles, Trophy, Users, Weight, Zap } from 'lucide-react';
import Modal from './Modal';
import { CAPSULES, DEFAULT_LOADOUT, RIDERS, STAT_LABELS, capsuleById, loadoutStats, riderById } from '../game/loadouts';
import RacerFigure from './RacerFigure';
import { capsuleArt, riderArt } from '../game/loadout-art';
import { CUP_NAME, CUP_POINTS, CUP_ROUNDS, DIFFICULTIES, type RaceSetup } from '../game/session';
import { COURSES } from '../game/types';
import { TRACKS } from '../game/courses';
import { coursePreview } from '../game/world-art';

interface NewGameSetupProps {
  initial: RaceSetup;
  hasSession: boolean;
  /** A completed event still holds its standings view and needs confirmation to replace. */
  finishedSession: boolean;
  onStart: (setup: RaceSetup) => void;
  onClose: () => void;
}

function radioKeys(event: KeyboardEvent<HTMLElement>) {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
  const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
  if (!items.length) return;
  event.preventDefault();
  const current = items.indexOf(document.activeElement as HTMLButtonElement);
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
    : (Math.max(0, current) + (event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
  items[next].click(); items[next].focus();
}

export default function NewGameSetup({ initial, hasSession, finishedSession, onStart, onClose }: NewGameSetupProps) {
  const [setup, setSetup] = useState<RaceSetup>(() => ({ ...initial, loadout: { ...initial.loadout } }));
  const [step, setStep] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const [starting, setStarting] = useState(false);
  const startGuard = useRef(false);
  const body = useRef<HTMLDivElement>(null);
  const rider = riderById(setup.loadout.rider);
  const capsule = capsuleById(setup.loadout.capsule);
  const stats = loadoutStats(setup.loadout);
  const tournament = setup.mode === 'tournament';
  const titles = ['Choose Your Competition', 'Build Your Bad Idea', 'Ready for the Starting Line?'];
  const names = ['Competition', 'Rider & Capsule', 'Race Rules'];

  useEffect(() => {
    if (!step && !confirm) return;
    body.current?.focus({ preventScroll: true });
    body.current?.closest('.modal')?.scrollTo({ top: 0, behavior: 'instant' });
  }, [step, confirm]);

  const start = () => {
    if (hasSession && !confirm) { setConfirm(true); return; }
    if (startGuard.current) return;
    startGuard.current = true;
    setStarting(true);
    onStart({ ...setup, customPhysics: !tournament && setup.customPhysics });
  };

  return (
    <Modal title={confirm ? 'Leave the Current Event?' : titles[step]} eyebrow="HEAVY METAL GP 2 / NEW GAME" onClose={onClose} wide className="fantasy-dialog setup-dialog">
      <div ref={body} tabIndex={-1} className="setup-body">
        {confirm ? <div className="setup-confirm">
          <Flag size={40} strokeWidth={1.3} /><h3>New crew. Fresh trouble.</h3>
          <p>{finishedSession ? 'This event is already finished, but its final standings have not been filed away yet. Starting a new event clears that results screen. Every committed round stays in the Hall of Chaos, and your settings are kept.' : 'This replaces the current race or cup, including its unfinished rounds. Completed race records and your settings will be kept.'}</p>
          <div className="fantasy-dialog-actions"><button className="fantasy-secondary" onClick={() => setConfirm(false)}><ArrowLeft size={16} />Keep choosing</button><button className="fantasy-primary" onClick={start} disabled={starting}>Start the New Event <Flag size={16} /></button></div>
        </div> : <>
          <nav className="setup-steps" aria-label="Race setup steps">{names.map((name, index) => <button key={name} className={step === index ? 'active' : index < step ? 'complete' : ''} aria-current={step === index ? 'step' : undefined} onClick={() => setStep(index)}><span>{index < step ? <Check size={12} /> : index + 1}</span>{name}{index < 2 && <ChevronRight size={13} />}</button>)}</nav>

          {step === 0 && <div className="setup-mode-step">
            <p className="fantasy-lead">A quick shot at glory, or three races to prove it wasn't an accident.</p>
            <div className="mode-options" role="radiogroup" aria-label="Race mode" onKeyDown={radioKeys}>
              <button className={`mode-option ${!tournament ? 'selected' : ''}`} role="radio" aria-checked={!tournament} tabIndex={!tournament ? 0 : -1} onClick={() => setSetup((s) => ({ ...s, mode: 'quick' }))}>
                <div className="mode-icon"><Flag size={47} strokeWidth={1.15} /></div><span className="mode-kicker">ONE RACE. ALL THE CHAOS.</span><h3>Quick Race</h3><p>Choose a track, build your capsule, and challenge three rivals.</p>
                <div className="mode-facts"><span>1 track</span><span>4 racers</span><span>Your rules</span></div><span className="selection-mark">{!tournament && <Check size={15} />}</span>
              </button>
              <button className={`mode-option ${tournament ? 'selected' : ''}`} role="radio" aria-checked={tournament} tabIndex={tournament ? 0 : -1} onClick={() => setSetup((s) => ({ ...s, mode: 'tournament', customPhysics: false }))}>
                <div className="mode-icon"><Trophy size={47} strokeWidth={1.15} /></div><span className="mode-kicker">CONSISTENCY. QUESTIONABLE INTENT.</span><h3>Tournament</h3><p>Race the whole circuit. Carry your points and your crew through all three rounds.</p>
                <div className="mode-facts"><span>3 tracks</span><span>One fixed crew</span><span>One cup</span></div><span className="selection-mark">{tournament && <Check size={15} />}</span>
              </button>
            </div>
            <div className="setup-rule-note"><Shield size={17} /><p>All riders and capsules are available from the start. No upgrades to grind. No hidden CPU speed advantage.</p></div>
          </div>}

          {step === 1 && <div className="loadout-builder">
            <section className="loadout-workbench" aria-label="Rider and capsule selection">
              <div className="choice-heading"><span>01 / PICK YOUR RIDER</span><span>{RIDERS.length} equally questionable candidates</span></div>
              <div className="rider-options" role="radiogroup" aria-label="Select rider" onKeyDown={radioKeys}>{RIDERS.map((candidate) => <button key={candidate.id} className={`rider-option ${candidate.id === setup.loadout.rider ? 'selected' : ''}`} role="radio" aria-checked={candidate.id === setup.loadout.rider} tabIndex={candidate.id === setup.loadout.rider ? 0 : -1} onClick={() => setSetup((s) => ({ ...s, loadout: { ...s.loadout, rider: candidate.id } }))}>
                <img src={riderArt(candidate.id)} alt={`${candidate.name}, ${candidate.title}`} /><span>{candidate.name}</span>{candidate.id === setup.loadout.rider && <Check size={12} />}
              </button>)}</div>
              <div className="loadout-showcase" aria-label={`${rider.name} riding ${capsule.name}`}>
                <div className="showcase-circle" aria-hidden="true" />
                <AnimatePresence mode="wait"><motion.div key={`${rider.id}-${capsule.id}`} className="selected-capsule" initial={{ opacity: 0, y: 7, rotate: -3 }} animate={{ opacity: 1, y: 0, rotate: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.19 }}><RacerFigure loadout={setup.loadout} /></motion.div></AnimatePresence>
                <div className="showcase-shadow" aria-hidden="true" />
                <div className="showcase-label"><span>{rider.title}</span><h3>{rider.name} <i>&</i> {capsule.name}</h3><p>{rider.quote}</p></div>
              </div>
              <div className="choice-heading"><span>02 / PICK YOUR CAPSULE</span><button onClick={() => setSetup((s) => ({ ...s, loadout: { ...DEFAULT_LOADOUT } }))}><RotateCcw size={11} />All-rounder</button></div>
              <div className="capsule-options" role="radiogroup" aria-label="Select capsule" onKeyDown={radioKeys}>{CAPSULES.map((candidate) => <button key={candidate.id} className={`capsule-option ${candidate.id === setup.loadout.capsule ? 'selected' : ''}`} role="radio" aria-checked={candidate.id === setup.loadout.capsule} tabIndex={candidate.id === setup.loadout.capsule ? 0 : -1} onClick={() => setSetup((s) => ({ ...s, loadout: { ...s.loadout, capsule: candidate.id } }))}>
                <img src={capsuleArt(candidate.id)} alt="" /><span>{candidate.name}<small>{candidate.title}</small></span>{candidate.id === setup.loadout.capsule && <Check size={12} />}
              </button>)}</div>
            </section>
            <aside className="loadout-spec" aria-label="Combined loadout statistics">
              <div className="spec-heading"><span>THE COMBINED BUILD</span><Shield size={18} /></div>
              <h3>{stats.ratings.handling >= 8 ? 'Quick on its feet.' : stats.ratings.stability >= 8 ? 'Hard to move. Harder to ignore.' : stats.ratings.boost >= 8 ? 'Made for the red button.' : 'A little of everything.'}</h3>
              <p className="spec-description">{rider.description}</p>
              <div className="loadout-ratings">{STAT_LABELS.map(({ id, label, explanation }) => <div className="rating-row" key={id} title={explanation}>
                <div><span>{label}</span><strong>{stats.ratings[id]}<small> / 10</small></strong></div><div className="rating-track" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={10} aria-valuenow={stats.ratings[id]}><span style={{ width: `${stats.ratings[id] * 10}%` }} /></div>
              </div>)}</div>
              <div className="budget-note"><Check size={13} />{stats.budget}-point budget. Different strengths, not upgrades.</div>
              <dl className="physical-stats"><div><dt><Gauge size={14} />Launch speed</dt><dd>{stats.launchSpeed} <small>km/h</small></dd></div><div><dt><Weight size={14} />Race weight</dt><dd>{stats.weight} <small>kg</small></dd></div><div><dt><Zap size={14} />Boost impulse</dt><dd>+{stats.boostKmh} <small>km/h</small></dd></div></dl>
              <div className="loadout-tradeoffs"><p><strong>Good at</strong>{capsule.strength}</p><p><strong>The catch</strong>{capsule.weakness}</p></div>
              <details className="stat-explanation"><summary>What do these stats change?</summary>{STAT_LABELS.map((stat) => <p key={stat.id}><strong>{stat.label}:</strong> {stat.explanation}</p>)}<p>Weight also changes hop height and resistance to bumps. All combinations use the same total budget; final balance will be checked through playtesting.</p></details>
            </aside>
          </div>}

          {step === 2 && <div className="setup-final">
            <section className="event-selection">
              <div className="choice-heading"><span>{tournament ? 'THE SCRAPDOME CUP / RACE ORDER' : 'CHOOSE YOUR TRACK'}</span><Flag size={15} /></div>
              {tournament ? <div className="cup-itinerary">{CUP_ROUNDS.map((id, index) => {
                const track = COURSES.find((c) => c.id === id)!;
                return <div className="itinerary-stop" key={id}><img className="course-thumbnail" src={coursePreview(id)} alt={`${TRACKS[id].region} scenery`} /><span>{String(index + 1).padStart(2, '0')}</span><div><h3>{track.name}</h3><p>{TRACKS[id].region} / {TRACKS[id].character}</p></div><small>15 km</small></div>;
              })}<div className="cup-scoring"><Trophy size={18} /><div><strong>Every finish matters.</strong><p>1st: {CUP_POINTS[0]} pts / 2nd: {CUP_POINTS[1]} / 3rd: {CUP_POINTS[2]} / 4th: {CUP_POINTS[3]}. DNF: 0.</p></div></div></div> :
                <div className="new-race-courses" role="radiogroup" aria-label="Choose a track" onKeyDown={radioKeys}>{COURSES.map((track) => <button key={track.id} className={`new-race-course ${setup.course === track.id ? 'selected' : ''}`} role="radio" aria-checked={setup.course === track.id} tabIndex={setup.course === track.id ? 0 : -1} onClick={() => setSetup((s) => ({ ...s, course: track.id }))}>
                  <img className="course-thumbnail" src={coursePreview(track.id)} alt={`${TRACKS[track.id].region} scenery`} /><span><strong>{track.name}</strong><small>{TRACKS[track.id].region} / {TRACKS[track.id].character}</small></span><span className="course-check">{setup.course === track.id && <Check size={17} />}</span>
                </button>)}</div>}
              <p className="course-world-description">{tournament ? 'Three distinct descents. Forest flow, quarry bursts, and pasture hops. Airborne supplies reward a good racing line.' : TRACKS[setup.course].description}</p>
              <div className="choice-heading difficulty-heading"><span>CPU CHALLENGE</span><Users size={15} /></div>
              <div className="difficulty-options" role="radiogroup" aria-label="CPU difficulty" onKeyDown={radioKeys}>{DIFFICULTIES.map((level) => <button role="radio" aria-checked={setup.difficulty === level.id} tabIndex={setup.difficulty === level.id ? 0 : -1} className={setup.difficulty === level.id ? 'selected' : ''} key={level.id} onClick={() => setSetup((s) => ({ ...s, difficulty: level.id }))}>{level.name}</button>)}</div>
              <p className="difficulty-description">{DIFFICULTIES.find((d) => d.id === setup.difficulty)?.description} Difficulty changes decisions, not the laws of physics.</p>
              {!tournament && <label className="practice-option"><input type="checkbox" checked={setup.customPhysics} onChange={(event) => setSetup((s) => ({ ...s, customPhysics: event.target.checked }))} /><span>Custom physics practice<small>Enable the live speed and weight sliders. Recorded as practice, not a preset race.</small></span></label>}
            </section>
            <aside className="event-summary"><RacerFigure loadout={setup.loadout} className="summary-racer" /><span className="mode-kicker">YOUR STARTING LINEUP</span><h3>{rider.name}</h3><p>{capsule.name} / {capsule.title}</p>
              <div className="event-summary-rule"><LockKeyhole size={17} /><span>{setup.customPhysics && !tournament ? 'Custom tuning enabled for this practice run.' : tournament ? 'Your loadout stays locked for all three rounds.' : 'Preset stats stay fixed for this race.'}</span></div>
              <div className="event-summary-rule"><Trophy size={17} /><span>{tournament ? CUP_NAME : 'One race. Four goblins. One finish.'}</span></div>
              <p className="finish-window-note">Rivals get a 10-second finish window after you. Ties in the cup break by wins, then final-round placement.</p>
            </aside>
          </div>}

          <div className="fantasy-dialog-actions setup-actions">
            <button className="fantasy-link" onClick={() => step === 0 ? onClose() : setStep(step - 1)}><ArrowLeft size={15} />{step === 0 ? 'Main menu' : 'Back'}</button>
            <span className="setup-progress-note">{step === 0 ? <><Users size={14} />Four racers. All local.</> : <><Sparkles size={14} />{rider.name} + {capsule.name}</>}</span>
            <button className="fantasy-primary" onClick={() => step < 2 ? setStep(step + 1) : start()} disabled={starting}>{step === 0 ? 'Choose Your Crew' : step === 1 ? 'Set the Race' : tournament ? 'Enter the Cup' : 'To the Starting Line'}<ArrowRight size={16} /></button>
          </div>
        </>}
      </div>
    </Modal>
  );
}