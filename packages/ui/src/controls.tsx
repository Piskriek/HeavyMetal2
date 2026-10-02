import { memo, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactElement } from 'react';
import type { Value } from '@hm/contracts';
import type { InspectorRow } from './model';
import { clampTo, defaultStep, fitRange, formatNumber, growRange, quantise, type Range } from './range';

export type Emit = (key: string, value: Value) => void;

/** One way to give a number its value. Number and Formula are built in; a host adds the drivers it has (wave, random, curve ...). */
export interface InputChoice { readonly id: string; readonly label: string; readonly doc: string }
export interface InputSource {
  /** Extra choices shown after Number and Formula. */
  readonly choices: readonly InputChoice[];
  /** What drives this setting now: a choice id, or undefined for a plain number. */
  readonly current?: (key: string) => string | undefined;
  /** The user picked a choice (also called with 'number' and 'formula' so the host can remove a driver it had added). */
  readonly pick: (key: string, choiceId: string) => void;
}

interface ControlProps { readonly row: InspectorRow; readonly id: string; readonly emit: Emit; readonly inputs?: InputSource | undefined }

const isList = (v: Value | undefined): v is readonly Value[] => Array.isArray(v);
const isRecord = (v: Value | undefined): v is { readonly [key: string]: Value } =>
  v !== null && typeof v === 'object' && !Array.isArray(v);

export function toNumber(v: Value | undefined): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return 0;
}

/** Parses what the user typed. Returns null for an empty or non-numeric entry (nothing is emitted then). */
export function parseNumber(row: InspectorRow, raw: string): number | null {
  if (raw.trim() === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return row.type === 'int' ? Math.round(n) : n;
}

const hardOf = (row: InspectorRow): Range => ({ lo: row.hardMin ?? -Infinity, hi: row.hardMax ?? Infinity });

/** What a typed or dragged number becomes: whole for ints, snapped to the step when dragged, never past the hard limits. Null for junk. */
export function numberToEmit(row: InspectorRow, raw: string, snap: boolean): number | null {
  const p = parseNumber(row, raw);
  if (p === null) return null;
  const step = row.step ?? (row.type === 'int' ? 1 : undefined);
  return clampTo(snap ? quantise(p, step) : p, hardOf(row));
}

export function summarize(v: Value, max = 48): string {
  let s: string;
  try { s = JSON.stringify(v) ?? String(v); } catch { s = String(v); }
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/* ------------------------------ the input menu ------------------------------ */

const BUILT_IN: readonly InputChoice[] = [
  { id: 'number', label: 'Number', doc: 'A fixed number: use the slider or type it.' },
  { id: 'formula', label: 'Formula', doc: 'A little sum that works the value out, like speed * 2.' },
];

/** The small button at the end of every number: opens the list of things that can give it its value. */
function InputButtonImpl({ row, emit, inputs, formula }: { readonly row: InspectorRow; readonly emit: Emit; readonly inputs?: InputSource | undefined; readonly formula: boolean }): ReactElement {
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const menu = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (!at) return;
    const off = (e: Event): void => { if (!menu.current?.contains(e.target as Node)) setAt(null); };
    const key = (e: globalThis.KeyboardEvent): void => { if (e.key === 'Escape') { e.stopPropagation(); setAt(null); } };
    window.addEventListener('pointerdown', off, true);
    window.addEventListener('keydown', key, true);
    return () => { window.removeEventListener('pointerdown', off, true); window.removeEventListener('keydown', key, true); };
  }, [at]);
  const driven = inputs?.current?.(row.key);
  const current = driven ?? (formula ? 'formula' : 'number');
  const choices = [...BUILT_IN, ...(inputs?.choices ?? [])];
  const label = choices.find((c) => c.id === current)?.label ?? current;
  const pick = (id: string): void => {
    setAt(null);
    if (id === 'number') { if (formula) emit(row.key, clampTo(toNumber(row.value), hardOf(row))); }
    else if (id === 'formula') { if (!formula) emit(row.key, { expr: formatNumber(toNumber(row.value)) }); }
    inputs?.pick(row.key, id);
  };
  return (
    <>
      <button
        type="button" className={current === 'number' ? 'hmi-src' : 'hmi-src on'} aria-haspopup="menu" aria-expanded={at !== null}
        aria-label={`${row.label}: input is ${label}. Choose another input`} title={`Input: ${label}. Click to choose what gives this its value.`}
        onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); const vh = typeof window === 'undefined' ? 800 : window.innerHeight; setAt(at ? null : { x: Math.max(8, Math.min(r.right - 230, (typeof window === 'undefined' ? 800 : window.innerWidth) - 238)), y: Math.max(8, Math.min(r.bottom + 4, vh - 292)) }); }}
      >
        <svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true" focusable="false"><circle cx="3" cy="7" r="1.8" /><circle cx="11" cy="3.2" r="1.8" /><circle cx="11" cy="10.8" r="1.8" /><path d="M4.7 6.3 9.4 3.8M4.7 7.7 9.4 10.2" /></svg>
      </button>
      {at ? (
        <ul ref={menu} className="hmi-srcmenu" role="menu" style={{ position: 'fixed', left: at.x, top: at.y, maxHeight: 284, overflowY: 'auto' }}>
          {choices.map((c) => (
            <li key={c.id} role="none">
              <button type="button" role="menuitemradio" aria-checked={c.id === current} className={c.id === current ? 'on' : ''} onClick={() => pick(c.id)}>
                <b>{c.label}</b><span>{c.doc}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

const InputButton = memo(InputButtonImpl);

/* ----------------------- sliders that never stop short ----------------------- */

/**
 * A number with a slider. The slider shows the comfortable range from the schema, but it is not a wall: type any number in the box; push the
 * thumb against an end and keep the pointer going and the end moves out, faster the harder you push (like a scrollbar that keeps extending);
 * when the value is back inside the comfortable range the scale returns to it. Only a real hard limit (an opacity above 1) stops a value.
 */
function SliderImpl({ row, id, emit, inputs }: ControlProps): ReactElement {
  const n = toNumber(row.value);
  const soft: Range = { lo: row.min ?? 0, hi: row.max ?? 1 };
  const hard = hardOf(row);
  const step = row.step ?? (row.type === 'int' ? 1 : undefined);
  const [pushed, setPushed] = useState<Range | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const range = pushed ?? fitRange(soft, n, hard);
  const send = (v: number): void => emit(row.key, row.type === 'int' ? Math.round(clampTo(v, hard)) : clampTo(quantise(v, step), hard));
  const live = useRef({ range, hard, send });
  live.current = { range, hard, send };
  const stop = useRef<(() => void) | null>(null);
  useEffect(() => () => { stop.current?.(); }, []);

  const onPointerDown = (e: ReactPointerEvent<HTMLInputElement>): void => {
    const el = e.currentTarget;
    let side: 'hi' | 'lo' | null = null;
    let over = 0;
    let cur = live.current.range;
    let last = performance.now();
    let raf = 0;
    const move = (ev: PointerEvent): void => {
      const r = el.getBoundingClientRect();
      if (ev.clientX > r.right) { side = 'hi'; over = ev.clientX - r.right; }
      else if (ev.clientX < r.left) { side = 'lo'; over = r.left - ev.clientX; }
      else { side = null; over = 0; }
    };
    const tick = (now: number): void => {
      const dt = (now - last) / 1000;
      last = now;
      if (side && over > 3) {
        const grown = growRange(cur, side, over, dt, live.current.hard);
        if (grown.lo !== cur.lo || grown.hi !== cur.hi) { cur = grown; setPushed(cur); live.current.send(side === 'hi' ? cur.hi : cur.lo); }
      }
      raf = requestAnimationFrame(tick);
    };
    const up = (): void => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      stop.current = null;
      setPushed(null);
    };
    stop.current?.();
    stop.current = up;
    setPushed(cur); // the scale holds still while the thumb is held, and refits when it is let go
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    raf = requestAnimationFrame(tick);
  };

  // at the end of the track the arrow keys carry on past it instead of stopping
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    const s = step ?? defaultStep(range);
    const up = e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'PageUp';
    const down = e.key === 'ArrowLeft' || e.key === 'ArrowDown' || e.key === 'PageDown';
    const big = e.key === 'PageUp' || e.key === 'PageDown' ? 10 : 1;
    if (up && n >= range.hi) { e.preventDefault(); send(n + s * big); }
    else if (down && n <= range.lo) { e.preventDefault(); send(n - s * big); }
  };

  return (
    <>
      <input
        type="range" min={range.lo} max={range.hi} step="any"
        className="hmi-range" id={id} aria-label={row.label} value={n}
        onChange={(e) => { const p = numberToEmit(row, e.target.value, true); if (p !== null) emit(row.key, p); }}
        onPointerDown={onPointerDown} onKeyDown={onKeyDown}
      />
      <input
        type="number" step="any" className="hmi-num" aria-label={`${row.label} value`}
        value={draft ?? formatNumber(n)}
        onChange={(e) => { setDraft(e.target.value); const p = numberToEmit(row, e.target.value, false); if (p !== null) emit(row.key, p); }}
        onBlur={() => setDraft(null)}
      />
      {row.unit ? <span className="hmi-unit">{row.unit}</span> : null}
      <InputButton row={row} emit={emit} inputs={inputs} formula={false} />
    </>
  );
}
const Slider = memo(SliderImpl);

function NumberFieldImpl({ row, id, emit, inputs }: ControlProps): ReactElement {
  const n = toNumber(row.value);
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <>
      <input
        type="number" step="any"
        className="hmi-in" id={id} aria-label={row.label} value={draft ?? formatNumber(n)}
        onChange={(e) => { setDraft(e.target.value); const p = numberToEmit(row, e.target.value, false); if (p !== null) emit(row.key, p); }}
        onBlur={() => setDraft(null)}
      />
      {row.unit ? <span className="hmi-unit">{row.unit}</span> : null}
      <InputButton row={row} emit={emit} inputs={inputs} formula={false} />
    </>
  );
}
const NumberField = memo(NumberFieldImpl);

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

function ExprField({ row, id, emit, inputs }: ControlProps): ReactElement {
  const v = row.value;
  const text = row.expression ?? (isRecord(v) && typeof v['expr'] === 'string' ? v['expr'] : typeof v === 'string' ? v : summarize(v, 200));
  const numeric = row.type === 'number' || row.type === 'int' || row.type === 'expr';
  return (
    <div className="hmi-exprwrap">
      <span className="hmi-fx" title="Formula">ƒ</span>
      <input type="text" className="hmi-in" id={id} aria-label={row.label} value={text} onChange={(e) => emit(row.key, { expr: e.target.value })} />
      {numeric ? <InputButton row={row} emit={emit} inputs={inputs} formula /> : null}
    </div>
  );
}

function Summary({ row }: ControlProps): ReactElement {
  return <code className="hmi-sum" title={summarize(row.value, 400)}>{summarize(row.value)}</code>;
}

/** The control for a row. This function has no hooks (the stateful numeric controls are separate memo components), so the tree can be inspected in tests. */
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
