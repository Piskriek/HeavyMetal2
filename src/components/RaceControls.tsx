import { ArrowLeft, ArrowRight, ArrowUpFromLine, ArrowUpRight, LockKeyhole, MoveUp, Pause, Play, RotateCcw, Zap } from 'lucide-react';
import type { GameOptions, GameSnapshot } from '../game/types';
import BallTuning, { type TuningKey } from './BallTuning';
import RaceStandings from './RaceStandings';
import AirSupplies from './AirSupplies';
import { capsuleById, loadoutStats, riderById } from '../game/loadouts';
import type { RaceConfig } from '../game/session';

interface RaceControlsProps {
  snapshot: GameSnapshot;
  loaded: boolean;
  options: GameOptions;
  config?: RaceConfig;
  onTune: (key: TuningKey, value: number) => void;
  onJump: () => void;
  onBounce: () => void;
  onBoost: () => void;
  onPrimary: () => void;
  onLane: (direction: number) => void;
}

export default function RaceControls({ snapshot, loaded, options, config, onTune, onJump, onBounce, onBoost, onPrimary, onLane }: RaceControlsProps) {
  const { status, inLoop, falling, bounces, boosts } = snapshot;
  const ready = status === 'ready';
  const flying = status === 'flying';
  const paused = status === 'paused';
  const finished = status === 'finished';
  const headline = snapshot.settling ? 'Your finish is locked in.' : falling && flying ? 'Pit crew! A little help here.'
    : inLoop && flying ? 'Hold on to your goblin.'
    : flying ? 'Looking gloriously irresponsible.'
      : paused ? 'Even chaos needs a breather.'
        : finished ? 'That deserves another go.' : 'Four goblins. One very bad idea.';
  const description = snapshot.settling ? 'The remaining racers have a short window to finish.' : falling && flying ? 'Recovery costs time, not the race. Get back after them.'
    : inLoop && flying ? 'Let the loop do its thing. Save a bounce for the landing.'
    : flying ? `${snapshot.grade}% downhill. A / D to switch lanes and shoulder the competition.`
      : paused ? 'Your goblin will wait. Probably.'
        : ready ? 'Pull back your orange ball. All four launch together.'
          : finished ? 'New ball. Same goblin. Still no plan.' : 'One goblin. One metal ball. Absolutely no plan.';
  const label = ready || status === 'loading' ? 'LAUNCH THE RACE' : paused ? 'KEEP IT ROLLING' : flying ? 'PAUSE THE CHAOS' : config?.mode === 'tournament' ? config.round < config.totalRounds - 1 ? 'NEXT RACE' : 'RACE THE CUP AGAIN' : 'REMATCH';
  const canSteer = flying && !snapshot.settling && !inLoop && !falling && !snapshot.laneLocked;
  const stats = config ? loadoutStats(config.loadout) : null;

  return (
    <div className="race-controls">
    <RaceStandings racers={snapshot.racers} ready={ready || status === 'loading'} />
    <AirSupplies snapshot={snapshot} />
    {config && !config.customPhysics ? <div className="race-loadout-bar"><LockKeyhole size={15} /><strong>{riderById(config.loadout.rider).name}<span> + </span>{capsuleById(config.loadout.capsule).name}</strong><span>{stats?.launchSpeed} km/h launch</span><span>{stats?.weight} kg</span><small>{config.mode === 'tournament' ? 'CREW LOCKED FOR THE CUP' : 'FIXED RACE LOADOUT'}</small></div> : <BallTuning options={options} onChange={onTune} flying={flying || paused} />}
    <div className="control-deck">
      <div className="launch-status">
        <div className="status-heading"><span className={`status-light ${flying ? 'is-live' : ''}`} /><h2>{headline}</h2></div>
        <p>{description}</p>
        <div className="steering-controls" role="group" aria-label="Lane steering">
          <button className="steer-key" onClick={() => onLane(-1)} disabled={!canSteer || snapshot.targetLane === 0} aria-label="Change to the lane on the left (A)" title="Left lane (A)"><ArrowLeft size={13} /><kbd>A</kbd></button>
          <div className="lane-indicator" aria-label={`Lane ${snapshot.lane + 1} of 4. Target lane ${snapshot.targetLane + 1}`}>
            {[0, 1, 2, 3].map((lane) => <span key={lane} className={`${lane === snapshot.targetLane ? 'target-lane' : ''} ${lane === snapshot.lane ? 'current-lane' : ''}`}>{lane + 1}</span>)}
          </div>
          <button className="steer-key" onClick={() => onLane(1)} disabled={!canSteer || snapshot.targetLane === 3} aria-label="Change to the lane on the right (D)" title="Right lane (D)"><kbd>D</kbd><ArrowRight size={13} /></button>
          <span className="steering-hint">{inLoop ? 'IN THE LOOP' : snapshot.laneLocked ? 'BUMPED!' : 'CHANGE LANES'}</span>
        </div>
        <div className="power-readout">
          <span>{ready ? 'LAUNCH POWER' : 'CHAOS POINTS'}</span>
          {ready ? <>
            <div className="power-bars" role="meter" aria-label="Launch power" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(snapshot.power * 100)}>
              {Array.from({ length: 12 }, (_, index) => <i key={index} className={index < Math.round(snapshot.power * 12) ? 'filled' : ''} />)}
            </div>
            <strong>{Math.round(snapshot.power * 100)}%</strong>
            <strong className="angle-readout">{Math.round(snapshot.angle)} deg</strong>
          </> : <><strong>{snapshot.score.toLocaleString('en-US')}</strong><span className="bumps-readout">{snapshot.bumps} BUMPS</span></>}
        </div>
      </div>
      <div className="air-controls" aria-label="Air controls">
        <button className="ability-button jump-button" disabled={!flying || snapshot.settling || !snapshot.hopReady || inLoop || falling} onClick={onJump} title="Bunny hop from the ground (W or J). Unlimited hops, no charges." aria-label="Jump: bunny hop">
          <MoveUp className="ability-icon jump-icon" size={23} strokeWidth={1.6} />
          <span className="ability-label">Jump<span className="hop-status">{snapshot.hopReady ? 'READY' : 'ON LANDING'}</span></span><kbd>W</kbd>
        </button>
        <button className="ability-button" disabled={!flying || snapshot.settling || inLoop || falling || bounces === 0} onClick={onBounce} title={inLoop ? 'Bounce unlocks after the loop' : `Bounce upward (Space). ${bounces} charges remaining.`} aria-label={`Bounce. ${bounces} charges${inLoop ? '. Available after the loop' : ''}`}>
          <ArrowUpFromLine className="ability-icon bounce-icon" size={24} strokeWidth={1.6} />
          <span className="ability-label">Bounce<span className="charge-dots" aria-hidden="true">{[0, 1, 2].map((index) => <i key={index} className={index < bounces ? 'charged' : ''} />)}</span></span>
          <kbd>SPACE</kbd>
        </button>
        <button className="ability-button" disabled={!flying || snapshot.settling || falling || boosts === 0} onClick={onBoost} title={`Speed boost (Shift). ${boosts} charges remaining.`} aria-label={`Boost. ${boosts} charges remaining`}>
          <Zap className="ability-icon boost-icon" size={24} strokeWidth={1.6} />
          <span className="ability-label">Boost<span className="charge-dots boost-charges" aria-hidden="true">{[0, 1].map((index) => <i key={index} className={index < boosts ? 'charged' : ''} />)}</span></span>
          <kbd>SHIFT</kbd>
        </button>
      </div>
      <div className="launch-action">
        <button className="primary-button launch-button" onClick={onPrimary} disabled={!loaded}>
          {label}{flying ? <Pause size={18} /> : paused ? <Play size={18} /> : finished ? <RotateCcw size={18} /> : <ArrowUpRight size={22} />}
        </button>
        <span>{ready ? <>OR PRESS <kbd>ENTER</kbd></> : flying || paused ? <>PAUSE / RESUME <kbd>P</kbd></> : 'QUESTIONABLE FUN. UNLIMITED ATTEMPTS.'}</span>
      </div>
    </div>
    </div>
  );
}