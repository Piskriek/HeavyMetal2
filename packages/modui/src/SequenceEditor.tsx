import { useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { randomizeSteps, resizeSteps, setStep, stepFromPx } from './sequence';
import type { Box } from './types';

const TEXT = 'var(--hm-text, #dde6ee)';
const ACCENT = 'var(--hm-accent, #ffd24a)';
const LINE = 'var(--hm-line, #26303b)';
const PANEL = 'var(--hm-panel, #151a21)';
const btn: CSSProperties = {
  background: 'var(--hm-panel, #151a21)',
  color: TEXT,
  border: `1px solid ${LINE}`,
  borderRadius: 6,
  padding: '4px 8px',
  fontSize: 11,
  cursor: 'pointer',
};

/** Derived, deterministic seed so the Randomize button is reproducible for a given row. */
const seedFrom = (steps: readonly number[]): number =>
  steps.length * 7919 + Math.round(steps.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0) * 1000);

export function SequenceEditor(props: {
  steps: readonly number[];
  onChange: (steps: readonly number[]) => void;
  width?: number;
  height?: number;
  activeStep?: number;
}) {
  const { steps, onChange } = props;
  const width = props.width ?? 320;
  const height = props.height ?? 96;
  const box: Box = { x: 0, y: 0, w: width, h: height };
  const count = steps.length;
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [paint, setPaint] = useState(false);

  const localPx = (clientX: number, clientY: number): [number, number] | null => {
    const el = svgRef.current;
    const rect = el && typeof el.getBoundingClientRect === 'function' ? el.getBoundingClientRect() : null;
    if (!rect || rect.width === 0 || rect.height === 0) return null;
    return [clientX - rect.left, clientY - rect.top];
  };
  const paintAt = (clientX: number, clientY: number): void => {
    const px = localPx(clientX, clientY);
    if (!px || count < 1) return;
    const { index, value } = stepFromPx(box, count, px);
    if (steps[index] === value) return;
    onChange(setStep(steps, index, value));
  };
  const onDown = (e: ReactPointerEvent<SVGSVGElement>): void => {
    e.preventDefault();
    const el = svgRef.current;
    if (el && typeof el.setPointerCapture === 'function') el.setPointerCapture(e.pointerId);
    setPaint(true);
    paintAt(e.clientX, e.clientY);
  };
  const sw = count > 0 ? width / count : width;
  const gap = Math.min(3, sw * 0.15);

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <svg
        ref={svgRef}
        data-kit="sequence-editor"
        aria-label="Step sequencer"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ display: 'block', touchAction: 'none', background: 'var(--hm-inset, #0d1116)', border: `1px solid ${LINE}`, borderRadius: 8, userSelect: 'none' }}
        onPointerDown={onDown}
        onPointerMove={(e) => paint && paintAt(e.clientX, e.clientY)}
        onPointerUp={() => setPaint(false)}
        onPointerCancel={() => setPaint(false)}
        onLostPointerCapture={() => setPaint(false)}
      >
        {steps.map((v, i) => {
          const h = Math.max(1, Math.min(1, v) * height);
          const active = props.activeStep === i;
          return (
            <rect
              key={i}
              data-role="step"
              data-index={String(i)}
              x={i * sw + gap}
              y={height - h}
              width={Math.max(1, sw - gap * 2)}
              height={h}
              rx={2}
              style={{ fill: active ? ACCENT : v > 0 ? TEXT : LINE, opacity: active ? 1 : 0.35 + v * 0.65 }}
            />
          );
        })}
        <line x1={0} y1={height} x2={width} y2={height} stroke={LINE} strokeWidth={1} />
      </svg>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--hm-dim, #8395a7)' }}>
        <button
          type="button"
          data-action="random"
          style={btn}
          onClick={() => onChange(randomizeSteps(steps, seedFrom(steps)))}
        >
          Randomize
        </button>
        <button type="button" data-action="clear" style={btn} onClick={() => onChange(steps.map(() => 0))}>
          Clear
        </button>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
          Steps
          <input
            type="number"
            data-field="count"
            min={1}
            max={64}
            value={count}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (e.target.value.trim() === '' || !Number.isFinite(n)) return;
              onChange(resizeSteps(steps, n));
            }}
            style={{ width: 58, background: PANEL, color: TEXT, border: `1px solid ${LINE}`, borderRadius: 6, padding: '3px 6px', fontSize: 11 }}
          />
        </label>
      </div>
    </div>
  );
}
