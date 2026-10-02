import type { CSSProperties, ReactElement } from 'react';
import { accent, control, label, panel, row, touch } from './styles';
import type { Tier } from './BrushPanel';

export interface ToolItem {
  id: string;
  label: string;
  icon: string;
  hotkey?: string;
}

export type Axes = 'free' | 'x' | 'y' | 'z' | 'xy' | 'xz' | 'yz';

export interface Manip {
  snapGrid: number;
  snapAngle: number;
  snapToSurface: boolean;
  alignToNormal: boolean;
  axes: Axes;
  mirror: 'none' | 'x' | 'z';
  arrayCount: number;
}

export interface ToolbarProps {
  tools: readonly ToolItem[];
  active: string;
  onSelect: (id: string) => void;
  manip: Manip;
  onManip: (patch: Partial<Manip>) => void;
  tier: Tier;
}

const AXES: readonly Axes[] = ['free', 'x', 'y', 'z', 'xy', 'xz', 'yz'];
const GRIDS: readonly { value: number; label: string }[] = [
  { value: 0, label: 'Off' },
  { value: 0.25, label: '0.25' },
  { value: 0.5, label: '0.5' },
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 5, label: '5' },
];
const ANGLES: readonly { value: number; label: string }[] = [
  { value: 0, label: 'Off' },
  { value: 5, label: '5°' },
  { value: 15, label: '15°' },
  { value: 45, label: '45°' },
  { value: 90, label: '90°' },
];

const manipBar: CSSProperties = {
  ...row,
  gap: 10,
  paddingTop: 8,
  borderTop: '1px solid var(--hm-line, #26303b)',
};

function num(event: { target: { value: string } }): number {
  return Number(event.target.value);
}

export function Toolbar(props: ToolbarProps): ReactElement {
  const { manip, onManip, tier } = props;
  const surface = (
    <label style={label}>
      <input
        type="checkbox"
        data-field="snapToSurface"
        checked={manip.snapToSurface}
        onChange={(event) => onManip({ snapToSurface: event.target.checked })}
        style={control}
      />
      Surface
    </label>
  );
  return (
    <div data-kit="toolbar" style={panel}>
      <div style={row}>
        {props.tools.map((item) => (
          <button
            key={item.id}
            type="button"
            data-tool={item.id}
            aria-pressed={item.id === props.active}
            title={item.hotkey ? `${item.label} (${item.hotkey})` : item.label}
            onClick={() => props.onSelect(item.id)}
            style={{ ...touch, ...(item.id === props.active ? accent : null) }}
          >
            <span aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      <div data-kit="manip" style={manipBar}>
        <label style={label}>
          Grid
          <select
            data-field="snapGrid"
            value={manip.snapGrid}
            onChange={(event) => onManip({ snapGrid: num(event) })}
            style={control}
          >
            {GRIDS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {tier === 'play' ? (
          surface
        ) : (
          <>
            <label style={label}>
              Angle
              <select
                data-field="snapAngle"
                value={manip.snapAngle}
                onChange={(event) => onManip({ snapAngle: num(event) })}
                style={control}
              >
                {ANGLES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            {surface}
            <label style={label}>
              <input
                type="checkbox"
                data-field="alignToNormal"
                checked={manip.alignToNormal}
                onChange={(event) => onManip({ alignToNormal: event.target.checked })}
                style={control}
              />
              Normal
            </label>
          </>
        )}

        {tier === 'pro' ? (
          <>
            <label style={label}>
              Axes
              <select
                data-field="axes"
                value={manip.axes}
                onChange={(event) => onManip({ axes: event.target.value as Axes })}
                style={control}
              >
                {AXES.map((axes) => (
                  <option key={axes} value={axes}>
                    {axes}
                  </option>
                ))}
              </select>
            </label>
            <label style={label}>
              Mirror
              <select
                data-field="mirror"
                value={manip.mirror}
                onChange={(event) => onManip({ mirror: event.target.value as Manip['mirror'] })}
                style={control}
              >
                <option value="none">none</option>
                <option value="x">x</option>
                <option value="z">z</option>
              </select>
            </label>
            <label style={label}>
              Array
              <input
                type="number"
                data-field="arrayCount"
                min={1}
                max={64}
                value={manip.arrayCount}
                onChange={(event) => onManip({ arrayCount: num(event) })}
                style={{ ...control, width: 64 }}
              />
            </label>
          </>
        ) : null}
      </div>
    </div>
  );
}
