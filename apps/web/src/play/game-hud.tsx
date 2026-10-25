import type { ReactElement } from 'react';
import { GAME_PRESETS, type MultiverseGamePresetSpec } from './game-presets';
import { gameGoal, type GameProgress } from './game-mode';
import './game-hud.css';

/** A blade of the existing HUD, not a mode-specific canvas or screen. */
export function GameHudBlade({ preset, progress, speed, livingMobs, hp, ammo, onShare, onPreset }: {
  readonly preset: MultiverseGamePresetSpec;
  readonly progress: GameProgress;
  readonly speed: number | null;
  readonly livingMobs: number;
  readonly hp: number;
  readonly ammo: { readonly current: number; readonly max: number };
  readonly onShare: () => void;
  readonly onPreset?: (preset: MultiverseGamePresetSpec) => void;
}): ReactElement {
  const goal = gameGoal(preset, progress);
  return <section className="multiverse-blade" data-hud-blade={preset.hudBlade} aria-label={preset.title}>
    <div className="multiverse-eyebrow"><i /> SETMIX MULTIVERSE / RUNG 5</div>
    <h1>{preset.title}</h1>
    <div className="multiverse-objective" aria-live="polite"><strong>{goal.title}</strong><p>{goal.hint}</p></div>
    {preset.hudBlade === 'race-lap-telemetry' ? <div className="multiverse-readout"><b>{Math.round((speed ?? 0) * 3.6)}</b><span>KM/H<br />{progress.elapsed.toFixed(1)} SEC</span></div> : null}
    {preset.hudBlade === 'arena-wave-survivor' ? <div className="multiverse-vitals"><span>{livingMobs} HOSTILES</span><span>{Math.ceil(hp)} HP</span><span>{ammo.current} / {ammo.max} · R RELOAD</span></div> : null}
    <div className="multiverse-rules"><span>SEED {preset.worldSeed}</span><span>{preset.activeRules.gravityScale} G</span><span>{preset.activeRules.stageAnimRateHz} HZ</span></div>
    <div className="multiverse-actions">
      {onPreset && progress.status !== 'playing' ? <button type="button" onClick={() => onPreset(preset)}>Restart preset</button> : null}
      {onPreset ? <select aria-label="Switch multiverse preset" value={GAME_PRESETS.some((p) => p.id === preset.id) ? preset.id : ''} onChange={(e) => { const next = GAME_PRESETS.find((p) => p.id === e.target.value); if (next) onPreset(next); }}>
        {!GAME_PRESETS.some((p) => p.id === preset.id) ? <option value="">Custom game</option> : null}
        {GAME_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
      </select> : null}
      <button type="button" onClick={onShare}>Export PNG card</button>
    </div>
    <small>WASD · MOVE / MOUSE · LOOK / ESC · MENU<br />DROP A SPORE PNG ON THE WORLD TO IMPORT</small>
  </section>;
}
