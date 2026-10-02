import { useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { addPoint, curvePath, fromPx, hitPoint, movePoint, removePoint, toPx } from './curve';
import type { Box, Pt } from './types';

const TEXT = 'var(--hm-text, #dde6ee)';
const ACCENT = 'var(--hm-accent, #ffd24a)';
const LINE = 'var(--hm-line, #26303b)';
const PANEL = 'var(--hm-panel, #151a21)';

export function CurveEditor(props: {
  points: readonly Pt[];
  interpolation: 'linear' | 'smooth' | 'step';
  onChange: (points: readonly Pt[]) => void;
  width?: number;
  height?: number;
  selected?: number;
  onSelect?: (index: number) => void;
  cursorX?: number;
  label?: string;
}) {
  const { points, interpolation, onChange, onSelect } = props;
  const width = props.width ?? 320;
  const height = props.height ?? 160;
  const box: Box = { x: 0, y: 0, w: width, h: height };
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [drag, setDrag] = useState(-1);

  const localPx = (clientX: number, clientY: number): Pt | null => {
    const el = svgRef.current;
    const rect = el && typeof el.getBoundingClientRect === 'function' ? el.getBoundingClientRect() : null;
    if (!rect || rect.width === 0 || rect.height === 0) return null;
    return [clientX - rect.left, clientY - rect.top];
  };
  const capture = (id: number): void => {
    const el = svgRef.current;
    if (el && typeof el.setPointerCapture === 'function') el.setPointerCapture(id);
  };
  const grab = (i: number, e: ReactPointerEvent<Element>): void => {
    e.preventDefault();
    e.stopPropagation();
    onSelect?.(i);
    capture(e.pointerId);
    setDrag(i);
  };
  const onBackgroundDown = (e: ReactPointerEvent<SVGSVGElement>): void => {
    const px = localPx(e.clientX, e.clientY);
    if (!px) return;
    const hit = hitPoint(box, points, px, 9);
    if (hit >= 0) {
      grab(hit, e);
      return;
    }
    const at = fromPx(box, px);
    const next = addPoint(points, at);
    onSelect?.(next.filter((p) => p[0] < at[0]).length);
    onChange(next);
  };
  const onMove = (e: ReactPointerEvent<SVGSVGElement>): void => {
    if (drag < 0) return;
    const px = localPx(e.clientX, e.clientY);
    if (!px) return;
    onChange(movePoint(points, drag, fromPx(box, px)));
  };
  const onKeyUp = (i: number) => (e: ReactKeyboardEvent<SVGCircleElement>): void => {
    const step = e.shiftKey ? 0.1 : 0.02;
    const p = points[i];
    if (!p) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      onChange(movePoint(points, i, [p[0] + (e.key === 'ArrowLeft' ? -step : step), p[1]]));
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      onChange(movePoint(points, i, [p[0], p[1] + (e.key === 'ArrowUp' ? step : -step)]));
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      onChange(removePoint(points, i));
      onSelect?.(-1);
    }
  };

  const grid: ReactNode[] = [];
  for (let i = 1; i <= 4; i++) {
    grid.push(<line key={`v${i}`} x1={(width * i) / 5} y1={0} x2={(width * i) / 5} y2={height} stroke={LINE} strokeWidth={1} />);
    grid.push(<line key={`h${i}`} x1={0} y1={(height * i) / 5} x2={width} y2={(height * i) / 5} stroke={LINE} strokeWidth={1} />);
  }

  return (
    <svg
      ref={svgRef}
      role="group"
      aria-label={props.label ?? 'Curve editor'}
      data-kit="curve-editor"
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
      <rect x={0} y={0} width={width} height={height} fill="transparent" />
      {grid}
      <path
        data-role="curve"
        d={curvePath(box, points, interpolation)}
        fill="none"
        stroke={ACCENT}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {props.cursorX === undefined ? null : (
        <line
          data-role="cursor"
          x1={props.cursorX * width}
          y1={0}
          x2={props.cursorX * width}
          y2={height}
          stroke={TEXT}
          strokeWidth={1}
          strokeDasharray="3 3"
          opacity={0.6}
        />
      )}
      {points.map((p, i) => {
        const px = toPx(box, p);
        const on = i === props.selected;
        return (
          <circle
            key={i}
            data-role="point"
            data-index={String(i)}
            cx={px[0]}
            cy={px[1]}
            r={on ? 8 : 6}
            tabIndex={0}
            role="slider"
            aria-label={`Point ${i + 1}`}
            aria-valuemin={0}
            aria-valuemax={1}
            aria-valuenow={p[1]}
            aria-valuetext={`x ${p[0].toFixed(2)}, y ${p[1].toFixed(2)}`}
            style={{ fill: on ? ACCENT : TEXT, stroke: PANEL, strokeWidth: 2, cursor: 'grab', outline: 'none' }}
            onPointerDown={(e) => grab(i, e)}
            onDoubleClick={(e) => {
              e.stopPropagation();
              onChange(removePoint(points, i));
              onSelect?.(-1);
            }}
            onKeyDown={onKeyUp(i)}
            onFocus={() => onSelect?.(i)}
          />
        );
      })}
    </svg>
  );
}
