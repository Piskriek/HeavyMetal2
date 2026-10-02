import type { ReactElement } from 'react';
import { accent, field, label, panel, row, touch, valueText } from './styles';

export type BrushKind = 'paint' | 'raise' | 'lower' | 'smooth' | 'flatten';

export interface BrushState {
  kind: BrushKind;
  radius: number;
  strength: number;
  falloff: 'smooth' | 'linear' | 'flat';
}

export type Tier = 'play' | 'build' | 'pro';

export interface BrushPanelProps {
  brush: BrushState;
  onChange: (patch: Partial<BrushState>) => void;
  tier: Tier;
}

const KINDS: readonly { id: BrushKind; label: string }[] = [
  { id: 'paint', label: 'Paint' },
  { id: 'raise', label: 'Raise' },
  { id: 'lower', label: 'Lower' },
  { id: 'smooth', label: 'Smooth' },
  { id: 'flatten', label: 'Flatten' },
];

const FALLOFFS: readonly BrushState['falloff'][] = ['smooth', 'linear', 'flat'];

export function BrushPanel(props: BrushPanelProps): ReactElement {
  const { brush, onChange, tier } = props;
  return (
    <div data-kit="brush" style={panel}>
      <div style={row}>
        {KINDS.map((kind) => (
          <button
            key={kind.id}
            type="button"
            data-kind={kind.id}
            aria-pressed={brush.kind === kind.id}
            title={kind.label}
            onClick={() => onChange({ kind: kind.id })}
            style={{ ...touch, ...(brush.kind === kind.id ? accent : null) }}
          >
            {kind.label}
          </button>
        ))}
      </div>

      <label style={label}>
        <span>Radius</span>
        <input
          type="range"
          data-field="radius"
          min={1}
          max={60}
          step={1}
          value={brush.radius}
          onChange={(event) => onChange({ radius: Number(event.target.value) })}
          style={field}
        />
        <span style={valueText}>{brush.radius}</span>
      </label>

      {tier === 'play' ? null : (
        <>
          <label style={label}>
            <span>Strength</span>
            <input
              type="range"
              data-field="strength"
              min={0.05}
              max={1}
              step={0.05}
              value={brush.strength}
              onChange={(event) => onChange({ strength: Number(event.target.value) })}
              style={field}
            />
            <span style={valueText}>{brush.strength}</span>
          </label>
          <label style={label}>
            <span>Falloff</span>
            <select
              data-field="falloff"
              value={brush.falloff}
              onChange={(event) => onChange({ falloff: event.target.value as BrushState['falloff'] })}
              style={field}
            >
              {FALLOFFS.map((falloff) => (
                <option key={falloff} value={falloff}>
                  {falloff}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
    </div>
  );
}
