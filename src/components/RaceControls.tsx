import { useEffect, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpFromLine, ArrowUpRight, Pause, Play, RotateCcw, Zap } from 'lucide-react';
import type { GameOptions, GameSnapshot } from '../game/types';
import BallTuning, { type TuningKey } from './BallTuning';
import { formatKey, loadBindings, type KeyBindings } from '../game/controls';
import type { RaceConfig } from '../game/session';

interface RaceControlsProps {
  snapshot: GameSnapshot;
  loaded: boolean;
  options: GameOptions;
  config?: RaceConfig;
  bindings?: KeyBindings;
  onTune: (key: TuningKey, value: number) => void;
  onBounce: () => void;
  onBoost: () => void;
  onPrimary: () => void;
  onLane: (direction: number) => void;
}

/**
 * TICKET-02: the control deck keeps only tactile inputs and live numbers.
 * Flavor headlines, pack-delta text, and standings strips moved out: standings
 * are pips on the mini track bar, supplies are the in-stage icon counter.
 */
export default function RaceControls({ snapshot, loaded, options, config, bindings: propBindings, onTune, onBounce, onBoost, onPrimary, onLane }: RaceControlsProps) {
  const [liveBindings, setLiveBindings] = useState<KeyBindings>(() => propBindings ?? loadBindings());
  useEffect(() => { if (propBindings) setLiveBindings(propBindings); }, [propBindings]);
  useEffect(() => {
    if (propBindings) return;
    const h = () => setLiveBindings(loadBindings());
    window.addEventListener('goblin-bindings-changed' as any, h);
    window.addEventListener('storage', h);
    return () => { window.removeEventListener('goblin-bindings-changed' as any, h); window.removeEventListener('storage', h); };
  }, [propBindings]);
  const bindings = liveBindings;
  const leftLabel = (bindings.steerLeft?.[0] ? formatKey(bindings.steerLeft[0]) : 'A');
  const rightLabel = (bindings.steerRight?.[0] ? formatKey(bindings.steerRight[0]) : 'D');
  const bounceLabel = (bindings.bounce?.[0] ? formatKey(bindings.bounce[0]) : 'SPACE');
  const boostLabel = (bindings.boost?.[0] ? formatKey(bindings.boost[0]) : 'SHIFT');
  const pauseLabel = (bindings.pause?.[0] ? formatKey(bindings.pause[0]) : 'P');
  const { status, inLoop, falling, bounces, boosts } = snapshot;
  const ready = status === 'ready';
  const flying = status === 'flying';
  const paused = status === 'paused';
  const finished = status === 'finished';
  // Short functional status only — no commentary during active gameplay.
  const statusWord = snapshot.settling ? 'Finish locked' : falling && flying ? 'Recovering'
    : inLoop && flying ? 'In the loop'
      : flying ? 'Live'
        : paused ? 'Paused'
          : finished ? 'Finished' : 'On the grid';
  const statusAlert = Boolean(flying && (falling || inLoop));
  const label = ready || status === 'loading' ? 'LAUNCH THE RACE' : paused ? 'KEEP IT ROLLING' : flying ? 'PAUSE THE CHAOS' : config?.mode === 'tournament' ? config.round < config.totalRounds - 1 ? 'NEXT RACE' : 'RACE THE CUP AGAIN' : 'REMATCH';
  const canSteer = flying && !snapshot.settling && !inLoop && !falling && !snapshot.laneLocked;

  return (
    <div className="race-controls">
    {config?.customPhysics ? <BallTuning options={options} onChange={onTune} flying={flying || paused} /> : null}
    <div className="control-deck">
      <div className="launch-status">
        <div className="status-heading"><span className={`status-light ${flying ? 'is-live' : ''}`} /><h2 className={statusAlert ? 'alert' : ''} role="status" aria-live="polite">{statusWord}</h2></div>
        <div className="steering-controls" role="group" aria-label="Lane steering">
          <button className="steer-key" onClick={() => onLane(-1)} disabled={!canSteer || snapshot.targetLane === 0} aria-label={`Change to the lane on the left (${leftLabel})`} title={`Left lane (${leftLabel})`}><ArrowLeft size={13} /><kbd>{leftLabel}</kbd></button>
          <div className="lane-indicator" aria-label={`Lane ${snapshot.lane + 1} of 4. Target lane ${snapshot.targetLane + 1}`}>
            {[0, 1, 2, 3].map((lane) => <span key={lane} className={`${lane === snapshot.targetLane ? 'target-lane' : ''} ${lane === snapshot.lane ? 'current-lane' : ''}`}>{lane + 1}</span>)}
          </div>
          <button className="steer-key" onClick={() => onLane(1)} disabled={!canSteer || snapshot.targetLane === 3} aria-label={`Change to the lane on the right (${rightLabel})`} title={`Right lane (${rightLabel})`}><kbd>{rightLabel}</kbd><ArrowRight size={13} /></button>
          <span className="steering-hint">{inLoop ? 'IN THE LOOP' : snapshot.laneLocked ? 'BUMPED!' : 'CHANGE LANES'}</span>
        </div>
        <div className="power-readout">
          <span>CHAOS POINTS</span>
          <strong>{snapshot.score.toLocaleString('en-US')}</strong><span className="bumps-readout">{snapshot.bumps} BUMPS</span>
        </div>
      </div>
      <div className="air-controls" aria-label="Air controls">
        <button className="ability-button" disabled={!flying || snapshot.settling || inLoop || falling || bounces === 0} onClick={onBounce} title={inLoop ? 'Bounce unlocks after the loop' : `Bounce upward (${bounceLabel}). ${bounces} charges remaining.`} aria-label={`Bounce (${bounceLabel}). ${bounces} charges${inLoop ? '. Available after the loop' : ''}`}>
          <ArrowUpFromLine className="ability-icon bounce-icon" size={24} strokeWidth={1.6} />
          <span className="ability-label">Bounce<span className="charge-dots" aria-hidden="true">{[0, 1, 2].map((index) => <i key={index} className={index < bounces ? 'charged' : ''} />)}</span></span>
          <kbd>{bounceLabel}</kbd>
        </button>
        <button className="ability-button" disabled={!flying || snapshot.settling || falling || boosts === 0} onClick={onBoost} title={`Speed boost (${boostLabel}). ${boosts} charges remaining.`} aria-label={`Boost (${boostLabel}). ${boosts} charges remaining`}>
          <Zap className="ability-icon boost-icon" size={24} strokeWidth={1.6} />
          <span className="ability-label">Boost<span className="charge-dots boost-charges" aria-hidden="true">{[0, 1].map((index) => <i key={index} className={index < boosts ? 'charged' : ''} />)}</span></span>
          <kbd>{boostLabel}</kbd>
        </button>
      </div>
      <div className="launch-action">
        <button className="primary-button launch-button" onClick={onPrimary} disabled={!loaded}>
          {label}{flying ? <Pause size={18} /> : paused ? <Play size={18} /> : finished ? <RotateCcw size={18} /> : <ArrowUpRight size={22} />}
        </button>
        <span>{ready ? <>OR PRESS <kbd>ENTER</kbd></> : flying || paused ? <>PAUSE / RESUME <kbd>{pauseLabel}</kbd></> : 'UNLIMITED ATTEMPTS'}</span>
      </div>
    </div>
    </div>
  );
}

/**
 * H5: fires on pointer-down, so a thumb gets the action with no tap delay, and the browser's own
 * gesture (scroll, double-tap zoom) never starts. Keyboard activation (Enter/Space on a focused
 * button, which reports `detail === 0`) still works through the click.
 */
function press(action: () => void) {
  return {
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      action();
    },
    onClick: (event: MouseEvent<HTMLButtonElement>) => { if (event.detail === 0) action(); },
    onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => event.stopPropagation(),
  };
}

interface TouchRaceControlsProps {
  snapshot: GameSnapshot;
  onLane: (direction: -1 | 1) => void;
  onBounce: () => void;
  onBoost: () => void;
  /** GO on the grid, pause/resume while racing. */
  onPrimary: () => void;
}

/**
 * H5: the thumb layout for touch screens (coarse pointers). Lanes sit under the left thumb, bounce
 * and boost under the right, and GO / pause in the middle, all clear of the cockpit gauges. The
 * race screen only mounts it for a coarse pointer, so a mouse-and-keyboard desk never sees it.
 */
export function TouchRaceControls({ snapshot, onLane, onBounce, onBoost, onPrimary }: TouchRaceControlsProps) {
  const { status, inLoop, falling, bounces, boosts } = snapshot;
  const ready = status === 'ready';
  const racing = status === 'flying' || status === 'pushing';
  const paused = status === 'paused';
  const canSteer = racing && !snapshot.settling && !inLoop && !falling && !snapshot.laneLocked;
  return (
    <div className="touch-controls" role="group" aria-label="Touch controls">
      <div className="touch-cluster touch-lanes">
        <button className="touch-button" disabled={!canSteer} aria-label="Change to the lane on the left" {...press(() => onLane(-1))}><ArrowLeft size={30} /></button>
        <button className="touch-button" disabled={!canSteer} aria-label="Change to the lane on the right" {...press(() => onLane(1))}><ArrowRight size={30} /></button>
      </div>
      {(ready || racing || paused) && (
        <button className="touch-button touch-primary" aria-label={ready ? 'Start the race' : paused ? 'Resume race' : 'Pause race'} {...press(onPrimary)}>
          {ready ? 'GO' : paused ? <Play size={22} /> : <Pause size={22} />}
        </button>
      )}
      <div className="touch-cluster touch-abilities">
        <button className="touch-button" disabled={!racing || snapshot.settling || inLoop || falling || bounces === 0} aria-label={`Bounce. ${bounces} charges`} {...press(onBounce)}>
          <ArrowUpFromLine size={26} /><span className="charge-dots" aria-hidden="true">{[0, 1, 2].map((index) => <i key={index} className={index < bounces ? 'charged' : ''} />)}</span>
        </button>
        <button className="touch-button" disabled={!racing || snapshot.settling || falling || boosts === 0} aria-label={`Boost. ${boosts} charges`} {...press(onBoost)}>
          <Zap size={26} /><span className="charge-dots boost-charges" aria-hidden="true">{[0, 1].map((index) => <i key={index} className={index < boosts ? 'charged' : ''} />)}</span>
        </button>
      </div>
    </div>
  );
}
