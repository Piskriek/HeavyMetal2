import { Gauge, Weight } from 'lucide-react';
import type { GameOptions } from '../game/types';

export type TuningKey = 'launchSpeed' | 'ballWeight';
interface BallTuningProps {
  options: GameOptions;
  onChange: (key: TuningKey, value: number) => void;
  flying?: boolean;
}

export default function BallTuning({ options, onChange, flying = false }: BallTuningProps) {
  return (
    <div className="ball-tuning" aria-label="Ball physics settings">
      <div className="tuning-title">SCRAP SPECIFICATION<span>YOUR BALL. YOUR BAD IDEA.</span></div>
      <label className="tuning-slider">
        <span className="tuning-label"><Gauge size={14} />{flying ? 'Ball speed' : 'Launch speed'} <strong>{options.launchSpeed}<small> km/h</small></strong></span>
        <input aria-label="Ball speed setting in kilometers per hour" type="range" min={80} max={240} step={10} value={options.launchSpeed} onChange={(event) => onChange('launchSpeed', Number(event.target.value))} />
        <span className="tuning-hint">{flying ? 'Adjust live. Hills keep adding momentum.' : 'At full slingshot power; adjustable during a run.'}</span>
      </label>
      <label className="tuning-slider">
        <span className="tuning-label"><Weight size={14} />Ball weight <strong>{options.ballWeight}<small> kg</small></strong></span>
        <input aria-label="Ball weight in kilograms" type="range" min={40} max={240} step={10} value={options.ballWeight} onChange={(event) => onChange('ballWeight', Number(event.target.value))} />
        <span className="tuning-hint">Lighter hops higher. Heavier holds momentum.</span>
      </label>
    </div>
  );
}