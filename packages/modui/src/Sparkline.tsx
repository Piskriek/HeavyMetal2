import type { Range } from './types';

const f2 = (n: number): string => n.toFixed(2);

/** 'x,y x,y ...' polyline points scaled into the box, 2 decimals. Empty values -> ''. */
export function sparklinePoints(values: readonly number[], width: number, height: number, range?: Range): string {
  if (values.length === 0) return '';
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    min = Math.min(min, v);
    max = Math.max(max, v);
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    min = 0;
    max = 0;
  }
  const r = range ?? { min, max };
  const span = r.max - r.min;
  const n = values.length;
  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    const v = values[i]!;
    const x = n === 1 ? 0 : (i / (n - 1)) * width;
    const y = span > 0 ? height - ((v - r.min) / span) * height : height / 2;
    parts.push(`${f2(x)},${f2(y)}`);
  }
  return parts.join(' ');
}

/** A tiny one-line preview of a sampled modulator. */
export function Sparkline(props: {
  values: readonly number[];
  width?: number;
  height?: number;
  range?: Range;
  label?: string;
}) {
  const width = props.width ?? 120;
  const height = props.height ?? 28;
  const range = props.range;
  const points = sparklinePoints(props.values, width, height, range);
  return (
    <svg
      data-kit="sparkline"
      role="img"
      aria-label={props.label ?? 'Modulator preview'}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: 'block', background: 'var(--hm-inset, #0d1116)', border: '1px solid var(--hm-line, #26303b)', borderRadius: 6 }}
    >
      {points === '' ? null : (
        <polyline
          data-role="line"
          points={points}
          fill="none"
          stroke="var(--hm-accent, #ffd24a)"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}
