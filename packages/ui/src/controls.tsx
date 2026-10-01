import type { ReactElement } from 'react';
import type { Value } from '@hm/contracts';
import type { InspectorRow } from './model';

export type Emit = (key: string, value: Value) => void;

interface ControlProps { readonly row: InspectorRow; readonly id: string; readonly emit: Emit }

const isList = (v: Value | undefined): v is readonly Value[] => Array.isArray(v);
const isRecord = (v: Value | undefined): v is { readonly [key: string]: Value } =>
  v !== null && typeof v === 'object' && !Array.isArray(v);

export function toNumber(v: Value | undefined): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return 0;
}

/** Parses what the user typed. Returns null for an empty or non-numeric entry (nothing is emitted then). */
function parseNumber(row: InspectorRow, raw: string): number | null {
  if (raw.trim() === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return row.type === 'int' ? Math.round(n) : n;
}

export function summarize(v: Value, max = 48): string {
  let s: string;
  try { s = JSON.stringify(v) ?? String(v); } catch { s = String(v); }
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function showNumber(n: number): string {
  return String(Math.round(n * 1e6) / 1e6);
}

function Slider({ row, id, emit }: ControlProps): ReactElement {
  const n = toNumber(row.value);
  return (
    <>
      <input
        type="range" min={row.min} max={row.max} step={row.step ?? (row.type === 'int' ? 1 : 'any')}
        className="hmi-range" id={id} aria-label={row.label} value={n}
        onChange={(e) => { const p = parseNumber(row, e.target.value); if (p !== null) emit(row.key, p); }}
      />
      <output className="hmi-val" htmlFor={id}>{row.unit ? `${showNumber(n)} ${row.unit}` : showNumber(n)}</output>
    </>
  );
}

function NumberField({ row, id, emit }: ControlProps): ReactElement {
  return (
    <>
      <input
        type="number" min={row.min} max={row.max} step={row.step ?? (row.type === 'int' ? 1 : 'any')}
        className="hmi-in" id={id} aria-label={row.label} value={toNumber(row.value)}
        onChange={(e) => { const p = parseNumber(row, e.target.value); if (p !== null) emit(row.key, p); }}
      />
      {row.unit ? <span className="hmi-val">{row.unit}</span> : null}
    </>
  );
}

function Toggle({ row, id, emit }: ControlProps): ReactElement {
  return (
    <input
      type="checkbox" className="hmi-check" id={id} aria-label={row.label} checked={row.value === true}
      onChange={(e) => emit(row.key, e.target.checked)}
    />
  );
}

function TextField({ row, id, emit }: ControlProps): ReactElement {
  const v = row.value;
  return (
    <input
      type="text" className="hmi-in" id={id} aria-label={row.label} value={typeof v === 'string' ? v : v === null ? '' : String(v)}
      onChange={(e) => emit(row.key, e.target.value)}
    />
  );
}

function Select({ row, id, emit }: ControlProps): ReactElement {
  const current = typeof row.value === 'string' ? row.value : String(row.value);
  const options = row.options ?? [];
  const all = options.includes(current) ? options : [current, ...options];
  return (
    <select className="hmi-in" id={id} aria-label={row.label} value={current} onChange={(e) => emit(row.key, e.target.value)}>
      {all.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function ColorField({ row, id, emit }: ControlProps): ReactElement {
  const v = typeof row.value === 'string' && /^#[0-9a-fA-F]{6}$/.test(row.value) ? row.value : '#000000';
  return (
    <input type="color" className="hmi-swatch" id={id} aria-label={row.label} value={v} onChange={(e) => emit(row.key, e.target.value)} />
  );
}

const AXES: Readonly<Record<string, readonly string[]>> = { vec2: ['x', 'y'], vec3: ['x', 'y', 'z'], quat: ['x', 'y', 'z', 'w'] };

function Vector({ row, id, emit }: ControlProps): ReactElement {
  const axes = AXES[row.type] ?? AXES['vec3']!;
  const v = row.value;
  const get = (i: number, axis: string): number => (isList(v) ? toNumber(v[i]) : isRecord(v) ? toNumber(v[axis]) : 0);
  const set = (i: number, n: number): void => {
    const next = axes.map((a, j) => (j === i ? n : get(j, a)));
    emit(row.key, isRecord(v) ? Object.fromEntries(axes.map((a, j) => [a, next[j] as number])) : next);
  };
  return (
    <div className="hmi-vec">
      {axes.map((axis, i) => (
        <label className="hmi-axis" key={axis}>
          <span>{axis}</span>
          <input
            type="number" step={row.step ?? 'any'} className="hmi-in" id={i === 0 ? id : undefined}
            aria-label={`${row.label} ${axis}`} value={get(i, axis)}
            onChange={(e) => { const p = parseNumber(row, e.target.value); if (p !== null) set(i, p); }}
          />
        </label>
      ))}
    </div>
  );
}

function ExprField({ row, id, emit }: ControlProps): ReactElement {
  const v = row.value;
  const text = row.expression ?? (isRecord(v) && typeof v['expr'] === 'string' ? v['expr'] : typeof v === 'string' ? v : summarize(v, 200));
  return (
    <div className="hmi-exprwrap">
      <span className="hmi-fx" title="Formula">ƒ</span>
      <input type="text" className="hmi-in" id={id} aria-label={row.label} value={text} onChange={(e) => emit(row.key, { expr: e.target.value })} />
    </div>
  );
}

function Summary({ row }: ControlProps): ReactElement {
  return <code className="hmi-sum" title={summarize(row.value, 400)}>{summarize(row.value)}</code>;
}

/** The control for a row. Components here are plain functions (no hooks), so the tree can be inspected in tests. */
export function Control(props: ControlProps): ReactElement {
  switch (props.row.control) {
    case 'slider': return <Slider {...props} />;
    case 'number': return <NumberField {...props} />;
    case 'toggle': return <Toggle {...props} />;
    case 'text': return <TextField {...props} />;
    case 'select': return <Select {...props} />;
    case 'color': return <ColorField {...props} />;
    case 'vector': return <Vector {...props} />;
    case 'expr': return <ExprField {...props} />;
    default: return <Summary {...props} />;
  }
}
