/**
 * Test-drive toolbar: switch camera instantly and slow the race down to look at things.
 *
 * Used by the builder's test drive and by quick races. It only calls back; the engine owns the
 * clock (`setTimeScale`) and the camera (`setCameraMode`), so this component holds no game state.
 * Keys: [ slower, ] faster, V toggles cockpit / chase.
 */
import { useEffect, useState } from 'react';
import type { GameOptions } from '../game/types';
import { TIME_SCALES, stepTimeScale, timeScaleLabel } from '../game/time-scale';
import { DEFAULT_ROPE, ROPE_LIMITS, type RopeConfig } from '../game/sim/rope';

type CameraMode = GameOptions['cameraMode'];

export interface TestDriveBarProps {
  cameraMode: CameraMode;
  onCameraMode: (mode: CameraMode) => void;
  timeScale: number;
  onTimeScale: (scale: number) => void;
  /** Where to sit. Defaults to the stage's top-right corner. */
  style?: React.CSSProperties;
  /**
   * H7b: the lane rope's timings and a setter, for tuning by feel. The drawer only exists in a dev
   * build (`import.meta.env.DEV`); a production build never shows it.
   */
  rope?: RopeConfig;
  onRope?: (change: Partial<RopeConfig>) => void;
}

/** H7b: dev builds only (Vite sets import.meta.env.DEV); off wherever it is not defined. */
export const ROPE_TUNING_AVAILABLE = Boolean((import.meta as { env?: { DEV?: boolean } }).env?.DEV);

const ROPE_SLIDERS: readonly { key: keyof RopeConfig; label: string; unit: string }[] = [
  { key: 'payoutS', label: 'Slack', unit: 's' },
  { key: 'reelS', label: 'Reel-in', unit: 's' },
  { key: 'edgeSmashVz', label: 'Edge smash', unit: '' },
];

/** H7b: three sliders and a reset for the rope, under the test-drive bar. */
export function RopeTuning({ rope, onRope }: { rope: RopeConfig; onRope: (change: Partial<RopeConfig>) => void }) {
  return (
    <div className="rope-tuning" role="group" aria-label="Rope tuning (dev)"
      style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, display: 'grid', gap: 6, padding: '8px 10px', background: '#1a1410ee', border: '1px solid #8a6a3a', borderRadius: 6, color: '#f7d9a6', font: '600 11px/1.2 Trebuchet MS, system-ui, sans-serif', minWidth: 230 }}>
      {ROPE_SLIDERS.map(({ key, label, unit }) => {
        const { min, max, step } = ROPE_LIMITS[key];
        return (
          <label key={key} style={{ display: 'grid', gridTemplateColumns: '72px 1fr 44px', alignItems: 'center', gap: 6 }}>
            <span>{label}</span>
            <input type="range" min={min} max={max} step={step} value={rope[key]} aria-label={`${label} (${key})`}
              onChange={(event) => onRope({ [key]: Number(event.target.value) })} />
            <output style={{ textAlign: 'right' }}>{key === 'edgeSmashVz' ? rope[key].toFixed(0) : rope[key].toFixed(2)}{unit}</output>
          </label>
        );
      })}
      <button type="button" style={{ ...button, justifySelf: 'end' }} onClick={() => onRope({ ...DEFAULT_ROPE })}>RESET DEFAULTS</button>
    </div>
  );
}

/** The camera the toggle switches to: cockpit ↔ chase (fixed goes to cockpit). */
export const nextCameraMode = (mode: CameraMode): CameraMode => (mode === 'first_person' ? 'follow_ball' : 'first_person');

const button: React.CSSProperties = {
  font: '700 12px/1 Trebuchet MS, system-ui, sans-serif', letterSpacing: '0.06em', color: '#f7d9a6',
  background: '#1a1410e6', border: '1px solid #8a6a3a', borderRadius: 5, padding: '6px 9px', cursor: 'pointer',
};
const active: React.CSSProperties = { ...button, background: '#8a5a1ee6', color: '#fff3dc', borderColor: '#e0b060' };

export default function TestDriveBar({ cameraMode, onCameraMode, timeScale, onTimeScale, style, rope, onRope }: TestDriveBarProps) {
  const [ropeOpen, setRopeOpen] = useState(false);
  const ropeTuning = ROPE_TUNING_AVAILABLE && rope && onRope;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.code === 'BracketLeft') { e.preventDefault(); onTimeScale(stepTimeScale(timeScale, -1)); }
      else if (e.code === 'BracketRight') { e.preventDefault(); onTimeScale(stepTimeScale(timeScale, 1)); }
      else if (e.code === 'KeyV' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); onCameraMode(nextCameraMode(cameraMode)); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cameraMode, onCameraMode, timeScale, onTimeScale]);

  const slowest = timeScale <= TIME_SCALES[0];
  const fastest = timeScale >= TIME_SCALES[TIME_SCALES.length - 1];
  return (
    <div
      className="test-drive-bar"
      role="toolbar"
      aria-label="Test drive controls"
      style={{ position: 'absolute', top: 12, right: 12, zIndex: 60, display: 'flex', gap: 6, alignItems: 'center', pointerEvents: 'auto', ...style }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <button type="button" style={cameraMode === 'first_person' ? active : button} aria-pressed={cameraMode === 'first_person'} title="Cockpit view (V)" onClick={() => onCameraMode('first_person')}>COCKPIT</button>
      <button type="button" style={cameraMode === 'follow_ball' ? active : button} aria-pressed={cameraMode === 'follow_ball'} title="Chase view (V)" onClick={() => onCameraMode('follow_ball')}>CHASE</button>
      <span style={{ width: 8 }} />
      <button type="button" style={button} disabled={slowest} title="Slower ([)" aria-label="Slower" onClick={() => onTimeScale(stepTimeScale(timeScale, -1))}>−</button>
      <span style={{ ...button, cursor: 'default', minWidth: 52, textAlign: 'center' }} aria-live="polite" title="Game speed">{timeScaleLabel(timeScale)}</span>
      <button type="button" style={button} disabled={fastest} title="Faster (])" aria-label="Faster" onClick={() => onTimeScale(stepTimeScale(timeScale, 1))}>+</button>
      {ropeTuning && <>
        <span style={{ width: 8 }} />
        <button type="button" style={ropeOpen ? active : button} aria-pressed={ropeOpen} aria-expanded={ropeOpen} title="Tune the lane rope (dev only)" onClick={() => setRopeOpen((open) => !open)}>ROPE</button>
        {ropeOpen && <RopeTuning rope={rope} onRope={onRope} />}
      </>}
    </div>
  );
}
