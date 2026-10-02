import { useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { formatMs, keyRange, moveKey, niceStep, pxToTime, pxToValue, removeKey, setEase, timeToPx, valueToPx } from './timeline';
import { addKey } from './timeline';
import type { Box, Ease, Keyframe } from './types';

const TEXT = 'var(--hm-text, #dde6ee)';
const ACCENT = 'var(--hm-accent, #ffd24a)';
const LINE = 'var(--hm-line, #26303b)';
const PANEL = 'var(--hm-panel, #151a21)';
const EASES: readonly Ease[] = ['linear', 'in', 'out', 'inOut', 'hold'];

export function TimelineEditor(props: {
  keys: readonly Keyframe[];
  durationMs: number;
  loop: 'none' | 'loop' | 'pingpong';
  onChange: (keys: readonly Keyframe[]) => void;
  width?: number;
  height?: number;
  selected?: number;
  onSelect?: (i: number) => void;
  playheadMs?: number;
}) {
  const { keys, durationMs, loop, onChange, onSelect } = props;
  const width = props.width ?? 320;
  const height = props.height ?? 140;
  const ruler = 18;
  const box: Box = { x: 0, y: ruler, w: width, h: height - ruler };
  const range = keyRange(keys);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [drag, setDrag] = useState(-1);
  const sel = props.selected !== undefined && props.selected >= 0 && props.selected < keys.length ? props.selected : -1;

  const localPx = (clientX: number, clientY: number): [number, number] | null => {
    const el = svgRef.current;
    const rect = el && typeof el.getBoundingClientRect === 'function' ? el.getBoundingClientRect() : null;
    if (!rect || rect.width === 0 || rect.height === 0) return null;
    return [clientX - rect.left, clientY - rect.top];
  };
  const grab = (i: number, e: ReactPointerEvent<Element>): void => {
    e.preventDefault();
    e.stopPropagation();
    onSelect?.(i);
    const el = svgRef.current;
    if (el && typeof el.setPointerCapture === 'function') el.setPointerCapture(e.pointerId);
    setDrag(i);
  };
  const onBackgroundDown = (e: ReactPointerEvent<SVGSVGElement>): void => {
    const px = localPx(e.clientX, e.clientY);
    if (!px) return;
    const hit = keys.findIndex((k) => Math.abs(timeToPx(box, durationMs, k.timeMs) - px[0]) < 7);
    if (hit >= 0) {
      grab(hit, e);
      return;
    }
    const t = pxToTime(box, durationMs, px[0]);
    const v = pxToValue(box, range, px[1]);
    const next = addKey(keys, t, v, durationMs);
    onChange(next);
    onSelect?.(next.findIndex((k) => k.timeMs === Math.min(t, durationMs)));
  };
  const onMove = (e: ReactPointerEvent<SVGSVGElement>): void => {
    if (drag < 0) return;
    const px = localPx(e.clientX, e.clientY);
    if (!px) return;
    const k = keys[drag];
    if (!k) return;
    onChange(moveKey(keys, drag, pxToTime(box, durationMs, px[0]), pxToValue(box, range, px[1]), durationMs));
  };
  const onKey = (i: number) => (e: ReactKeyboardEvent<SVGRectElement>): void => {
    const k = keys[i];
    if (!k) return;
    const dt = e.shiftKey ? 100 : 10;
    const dv = (range.max - range.min) * 0.02;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      onChange(moveKey(keys, i, k.timeMs + (e.key === 'ArrowLeft' ? -dt : dt), k.value, durationMs));
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      onChange(moveKey(keys, i, k.timeMs, k.value + (e.key === 'ArrowUp' ? dv : -dv), durationMs));
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      onChange(removeKey(keys, i));
      onSelect?.(-1);
    }
  };

  const step = niceStep(durationMs);
  const ticks: number[] = [];
  for (let t = 0; t <= durationMs + 0.001; t += step) ticks.push(Math.round(t));

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <svg
        ref={svgRef}
        data-kit="timeline-editor"
        aria-label="Timeline editor"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ display: 'block', touchAction: 'none', background: 'var(--hm-inset, #0d1116)', border: `1px solid ${LINE}`, borderRadius: 8, userSelect: 'none' }}
        onPointerDown={onBackgroundDown}
        onPointerMove={onMove}
        onPointerUp={() => setDrag(-1)}
        onPointerCancel={() => setDrag(-1)}
        onLostPointerCapture={() => setDrag(-1)}
      >
        <rect x={0} y={ruler} width={width} height={box.h} fill="transparent" stroke={LINE} />
        {ticks.map((t) => (
          <g key={t}>
            <line x1={timeToPx(box, durationMs, t)} y1={ruler} x2={timeToPx(box, durationMs, t)} y2={height} stroke={LINE} strokeWidth={1} />
            <text x={timeToPx(box, durationMs, t) + 3} y={12} fontSize={9} fill={TEXT} opacity={0.7}>{formatMs(t)}</text>
          </g>
        ))}
        <path
          data-role="line"
          d={keys.map((k, i) => `${i === 0 ? 'M' : 'L'} ${timeToPx(box, durationMs, k.timeMs)} ${valueToPx(box, range, k.value)}`).join(' ')}
          fill="none"
          stroke={ACCENT}
          strokeWidth={2}
        />
        {props.playheadMs === undefined ? null : (
          <line data-role="playhead" x1={timeToPx(box, durationMs, props.playheadMs)} y1={ruler} x2={timeToPx(box, durationMs, props.playheadMs)} y2={height} stroke={TEXT} strokeWidth={1} strokeDasharray="3 3" opacity={0.7} />
        )}
        {keys.map((k, i) => {
          const x = timeToPx(box, durationMs, k.timeMs);
          const y = valueToPx(box, range, k.value);
          const on = i === sel;
          return (
            <rect
              key={i}
              data-role="key"
              data-index={String(i)}
              x={x - (on ? 7 : 5)}
              y={y - (on ? 7 : 5)}
              width={on ? 14 : 10}
              height={on ? 14 : 10}
              transform={`rotate(45 ${x} ${y})`}
              tabIndex={0}
              role="slider"
              aria-label={`Keyframe ${i + 1} at ${formatMs(k.timeMs)}`}
              aria-valuemin={0}
              aria-valuemax={durationMs}
              aria-valuenow={k.timeMs}
              style={{ fill: on ? ACCENT : TEXT, stroke: PANEL, strokeWidth: 1.5, cursor: 'grab', outline: 'none' }}
              onPointerDown={(e) => grab(i, e)}
              onDoubleClick={(e) => {
                e.stopPropagation();
                onChange(removeKey(keys, i));
                onSelect?.(-1);
              }}
              onKeyDown={onKey(i)}
              onFocus={() => onSelect?.(i)}
            />
          );
        })}
        <text x={width - 4} y={12} fontSize={9} textAnchor="end" fill={TEXT} opacity={0.55}>{loop}</text>
      </svg>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--hm-dim, #8395a7)' }}>
        Ease of key {sel + 1}
        <select
          data-field="ease"
          value={keys[sel]?.ease ?? 'linear'}
          disabled={sel < 0}
          onChange={(e) => sel >= 0 && onChange(setEase(keys, sel, e.target.value as Ease))}
          style={{ background: PANEL, color: TEXT, border: `1px solid ${LINE}`, borderRadius: 6, padding: '3px 6px', fontSize: 11 }}
        >
          {EASES.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
      </label>
    </div>
  );
}
