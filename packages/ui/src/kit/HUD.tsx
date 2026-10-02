import type { CSSProperties, ReactElement } from 'react';

export interface HudItem {
  id: string;
  label: string;
  icon: string;
}

export interface HUDProps {
  speed: number;
  lap: number;
  laps: number;
  position: number;
  racers: number;
  timeMs: number;
  item: HudItem | null;
  boost: number;
  message?: string;
}

const ZERO = '0:00.00';

export function ordinal(n: number): string {
  const value = Math.trunc(n);
  const magnitude = Math.abs(value);
  const last = magnitude % 10;
  const teens = magnitude % 100;
  const suffix =
    teens >= 11 && teens <= 13 ? 'th' : last === 1 ? 'st' : last === 2 ? 'nd' : last === 3 ? 'rd' : 'th';
  return `${value}${suffix}`;
}

export function formatTime(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return ZERO;
  const total = Math.floor(ms);
  const minutes = Math.floor(total / 60000);
  const seconds = Math.floor(total / 1000) % 60;
  const centis = Math.floor(total / 10) % 100;
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(centis).padStart(2, '0')}`;
}

const clamp01 = (n: number): number => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

const box: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 10px',
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--hm-text, #dde6ee)',
  background: 'rgba(12,16,21,0.62)',
  border: '1px solid var(--hm-line, #26303b)',
  borderRadius: 12,
  textShadow: '0 2px 6px rgba(0,0,0,0.65)',
};

const dim: CSSProperties = { fontSize: 11, fontWeight: 500, color: 'var(--hm-dim, #8fa0b1)' };

export function HUD(props: HUDProps): ReactElement {
  const percent = Math.round(clamp01(props.boost) * 100);
  return (
    <div
      data-kit="hud"
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: 8,
        padding: 12,
        pointerEvents: 'none',
        font: 'inherit',
        color: 'var(--hm-text, #dde6ee)',
      }}
    >
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div data-hud="speed" style={box}>
          <span style={{ fontSize: 28, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
            {Math.round(props.speed)}
          </span>
          <span style={dim}>km/h</span>
        </div>
        <div data-hud="lap" style={box}>
          {props.lap}/{props.laps}
        </div>
        <div data-hud="position" style={box}>
          <span style={{ fontSize: 20, fontWeight: 800 }}>{ordinal(props.position)}</span>
          <span style={dim}>/ {props.racers}</span>
        </div>
        <div data-hud="time" style={{ ...box, fontVariantNumeric: 'tabular-nums' }}>
          {formatTime(props.timeMs)}
        </div>
        <div
          data-hud="item"
          title={props.item ? props.item.label : undefined}
          style={{ ...box, minWidth: 44, minHeight: 44, fontSize: 22 }}
        >
          {props.item ? (
            <span>{props.item.icon}</span>
          ) : (
            <span
              style={{
                width: 24,
                height: 24,
                borderRadius: 8,
                border: '1px dashed var(--hm-line, #26303b)',
                display: 'block',
              }}
            />
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
        {props.message ? (
          <div
            role="status"
            style={{ ...box, fontSize: 18, fontWeight: 800, color: 'var(--hm-accent, #ffd24a)' }}
          >
            {props.message}
          </div>
        ) : null}
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          style={{ ...box, padding: 6, minWidth: 160 }}
        >
          <span
            style={{
              display: 'block',
              width: `${percent}%`,
              height: 10,
              borderRadius: 999,
              background: 'var(--hm-ok, #5fd38d)',
            }}
          />
        </div>
      </div>
    </div>
  );
}
