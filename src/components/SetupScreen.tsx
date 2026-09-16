import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { ArrowRight, ArrowUpRight, RotateCcw, Shuffle, Flag, Trophy, FlaskConical, CircleHelp, Gauge, Weight, MoveUp, LockKeyhole, ChevronRight } from 'lucide-react';
import { adjustStat, statsToPhysics, STAT_BUDGET, PLAYER_COLORS, TEAMS, teamOf } from '../game/types';
import type { MarbleStats, MarbleInfo } from '../game/types';
import { CALENDAR } from '../game/season';
import Brand from './Brand';
import CircuitPreview from './CircuitPreview';
import PhysicsLab from './PhysicsLab';
import RulesDialog from './RulesDialog';
import WalletButton from './WalletButton';
import LoadoutPreview from './LoadoutPreview';
import type { RacerAccount } from '../game/economy';

interface Props {
  stats: MarbleStats;
  onStats: (s: MarbleStats) => void;
  color: string;
  onColor: (c: string) => void;
  rivals: MarbleInfo[];
  onRerollRivals: () => void;
  seed: number;
  onNewSeed: () => void;
  onStart: () => void;
  onStartSeason: () => void;
  onContinueSeason?: () => void;
  seasonMode?: boolean;
  onBackToSeason?: () => void;
  circuitIndex: number;
  onCircuit: (index: number) => void;
  account: RacerAccount;
  onShop: () => void;
}

const STAT_META = [
  { key: 'weight', label: 'Weight', Icon: Weight, color: '#f1ae65', hint: 'More impact. Break walls and push through the pack.' },
  { key: 'speed', label: 'Speed', Icon: Gauge, color: '#d7ff3f', hint: 'Less drag. Carry momentum through every turn.' },
  { key: 'bounce', label: 'Bounce', Icon: MoveUp, color: '#b6a0ff', hint: 'More airtime. Reach ramps and shortcut ledges.' },
] as const;
const COLOR_NAMES = ['Volt', 'Glacier', 'Coral', 'Tangerine', 'Violet', 'Pearl', 'Mint'];

export default function SetupScreen(props: Props) {
  const { stats, onStats, color, onColor, rivals, onRerollRivals, seed, onNewSeed, onStart, onStartSeason, onContinueSeason, seasonMode, onBackToSeason, circuitIndex, onCircuit } = props;
  const { account, onShop } = props;
  const [mode, setMode] = useState<'season' | 'quick'>('season');
  const [dialog, setDialog] = useState<'rules' | 'lab' | null>(null);
  const ph = useMemo(() => statsToPhysics(stats), [stats]);
  const roster = useMemo<MarbleInfo[]>(() => [{ id: 0, name: 'You', color, stats, isPlayer: true }, ...rivals], [color, stats, rivals]);
  const circuit = CALENDAR[circuitIndex];

  return <div className="app-shell garage-page">
    <header className="app-header">
      <Brand />
      <nav className="main-nav" aria-label="Main navigation">
        <button className="active" aria-current="page">Garage</button>
        <button onClick={onContinueSeason ?? (() => { setMode('season'); document.getElementById('race-mode')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); })}>Championship</button>
        <button onClick={() => setDialog('rules')}>How to play</button>
      </nav>
      <div className="header-tools"><button className="text-button lab-link" onClick={() => setDialog('lab')}><FlaskConical size={16} /><span>Physics lab</span></button><WalletButton credits={account.credits} onClick={onShop} /></div>
    </header>

    <main className="garage-main">
      <div className="garage-heading entrance">
        <div><div className="eyebrow"><span className="accent-line" /> THE PADDOCK <span className="muted">/ WORLD MARBLE CHAMPIONSHIP</span></div><h1>MARBLE RUN.<span> RUMBLE.</span></h1><p>Find your line. Build your advantage. Let gravity do the rest.</p></div>
        {onContinueSeason && !seasonMode ? <button className="button-secondary continue-season" onClick={onContinueSeason}>Continue season <ArrowUpRight size={17} /></button> : <div className="edition-mark"><span>SEASON</span><strong>01<span>/06 GP</span></strong></div>}
      </div>

      <div className="garage-workspace entrance entrance-delay">
        <section className="circuit-panel" aria-labelledby="circuit-title">
          <div className="section-topline"><span className="eyebrow"><b>01</b> THE CIRCUIT</span><button className="text-button" onClick={onNewSeed}><Shuffle size={14} />Regenerate</button></div>
          <div className="circuit-title-row"><div><h2 id="circuit-title">{circuit.short === 'MARBLEHURST' ? 'MARBLEHURST PARK' : circuit.short}</h2><span>{circuit.location}</span></div><span className="circuit-seed">SEED<br /><b>{seed.toString(16).slice(0, 6).toUpperCase()}</b></span></div>
          <CircuitPreview seed={seed} roster={roster} profile={circuit.profile} />
          <div className="circuit-selector" aria-label="Select a circuit">{CALENDAR.map((gp, i) => <button key={gp.id} className={i === circuitIndex ? 'selected' : ''} aria-pressed={i === circuitIndex} onClick={() => onCircuit(i)}><span>{String(i + 1).padStart(2, '0')}</span><strong>{gp.short}</strong></button>)}</div>
          <div className="circuit-caption"><span className="circuit-type"><Flag size={14} /> {circuit.profile.segments} SECTORS / 3X LENGTH</span><p>More distance. More disappearing pegs. Glowing pegs carry free items.</p></div>
        </section>

        <section className="tuning-panel" aria-labelledby="tuning-title">
          <div className="section-topline"><span className="eyebrow"><b>02</b> YOUR MARBLE</span><button className="icon-button" onClick={() => onStats({ weight: 5, speed: 5, bounce: 5 })} aria-label="Reset stats to balanced"><RotateCcw size={15} /></button></div>
          <div className="marble-identity"><div className="marble-display" style={{ '--marble': color } as CSSProperties}><div className="display-marble"><i /><span /></div><div className="marble-ground" /></div><div><span className="eyebrow accent">APEX RACING</span><h2 id="tuning-title">THE CHALLENGER</h2><span className="marble-mass">{Math.round(ph.mass * 100)}g <span>/</span> YOUR RACE, YOUR BUILD</span></div></div>
          <fieldset className="paint-selector"><legend>Choose your livery</legend><div>{PLAYER_COLORS.map((c, i) => <button key={c} type="button" style={{ '--paint': c } as CSSProperties} className={`paint-swatch ${c === color ? 'selected' : ''}`} onClick={() => onColor(c)} aria-label={`${COLOR_NAMES[i]} livery`} aria-pressed={c === color}><span /></button>)}</div></fieldset>
          <div className="budget-caption"><span><b>{STAT_BUDGET}</b> points. One perfect balance.</span><button className="icon-button" aria-label="Explain stat trade-offs" onClick={() => setDialog('rules')}><CircleHelp size={14} /></button></div>
          <div className="stat-controls">{STAT_META.map(({ key, label, Icon, hint, color: statColor }) => <div className="stat-control" key={key} style={{ '--stat-color': statColor, '--range-fill': `${(stats[key] - 1) / 9 * 100}%` } as CSSProperties}>
            <div className="stat-label"><label htmlFor={`stat-${key}`}><Icon size={16} />{label}</label><output htmlFor={`stat-${key}`}>{String(stats[key]).padStart(2, '0')}<span>/10</span></output></div>
            <input id={`stat-${key}`} type="range" min="1" max="10" step="1" value={stats[key]} aria-describedby={`hint-${key}`} onChange={(e) => onStats(adjustStat(stats, key, Number(e.target.value)))} />
            <p id={`hint-${key}`}>{hint}</p>
          </div>)}</div>
          <div className="stat-budget-bar" aria-label="Shared stat allocation">{STAT_META.map(({ key, color: statColor }) => <span key={key} style={{ width: `${stats[key] / 15 * 100}%`, background: statColor }} />)}</div>
          <p className="tradeoff-note">Raising one stat redistributes the other two.</p>
          {seasonMode ? <div className="race-launch"><button className="button-primary launch-button" onClick={onBackToSeason}><LockKeyhole size={17} /> Save setup <ArrowRight size={19} /></button><p>Locked for all three heats once the GP begins.</p></div> : <div className="race-launch" id="race-mode">
            <div className="mode-switch" aria-label="Race mode"><button aria-pressed={mode === 'season'} className={mode === 'season' ? 'selected' : ''} onClick={() => setMode('season')}><Trophy size={15} />Championship</button><button aria-pressed={mode === 'quick'} className={mode === 'quick' ? 'selected' : ''} onClick={() => setMode('quick')}><Flag size={15} />Quick race</button></div>
            <button className="button-primary launch-button" onClick={mode === 'season' ? onStartSeason : onStart}>{mode === 'season' ? 'START CHAMPIONSHIP' : 'LIGHTS OUT. LET\'S RACE.'}<ArrowRight size={20} /></button>
            <p>{mode === 'season' ? '6 Grands Prix. 3 heats per circuit. Points + prize credits.' : `One long heat at ${circuit.location}. Finish to earn credits.`}</p>
          </div>}
        </section>
      </div>

      <LoadoutPreview inventory={account.inventory} onShop={onShop} />
      <section className="grid-preview entrance entrance-delay-2" aria-labelledby="grid-title"><div className="section-topline"><div className="eyebrow" id="grid-title"><b>03</b> MEET THE GRID <span className="muted">/ 10 MARBLES. NO BRAKES.</span></div>{!seasonMode && <button className="text-button" onClick={onRerollRivals}>Shuffle rivals <Shuffle size={14} /></button>}</div><div className="team-grid">{TEAMS.map((team) => <div className="team-entry" key={team.id}><span className="team-label"><i style={{ background: team.color }} />{team.name}</span><div>{roster.filter((m) => teamOf(m.id).id === team.id).map((m) => <span key={m.id}><i className="tiny-marble" style={{ '--marble': m.color } as CSSProperties} /><b>{m.isPlayer ? 'You' : m.name}</b>{m.isPlayer && <small>PLAYER</small>}</span>)}</div></div>)}</div></section>
      <footer className="app-footer"><span>POWERED BY GRAVITY. FUELED BY COMPETITION.</span><button className="text-button" onClick={() => setDialog('rules')}>Race briefing <ChevronRight size={13} /></button><button className="text-button" onClick={() => setDialog('lab')}><FlaskConical size={13} />Test the engine</button></footer>
    </main>
    {dialog === 'lab' && <PhysicsLab onClose={() => setDialog(null)} />}
    {dialog === 'rules' && <RulesDialog onClose={() => setDialog(null)} />}
  </div>;
}