import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { FIELDS, sameValue, type FieldDef, type TweakGroup } from '../../studio-server/tweak-schema';
import { GEN } from '../assets/gen';
import { clampField, type Change } from './studio-data';
import { type MaterialPreset } from './studio-presets';
import { thumbOf } from './studio-thumbs';
import { FourAnglePanel } from './four-angle';

export const GROUPS: readonly TweakGroup[] = ['Fit', 'Material', 'Glow'];

const r2 = (n: number): string => (Math.round(n * 100) / 100).toFixed(2);

/** A value as a person reads it in the Changes list and beside a control. */
export function fmtValue(f: FieldDef, v: unknown): string {
  if (f.kind === 'color') return typeof v === 'string' && v ? v : "model's own";
  if (f.kind === 'number') {
    if (typeof v !== 'number') return '-';
    if (sameValue(v, f.neutral)) return 'model';
    return f.unit === 'x' ? `${r2(v)}x` : `${r2(v)}${f.unit ? ` ${f.unit}` : ''}`;
  }
  if (!Array.isArray(v)) return '-';
  const a = v as number[];
  if (f.key === 'scale' && a[0] === a[1] && a[1] === a[2]) return `${r2(a[0] ?? 1)}x`;
  return `${a.map(r2).join(', ')}${f.unit ? ` ${f.unit}` : ''}`;
}

const fieldOf = (key: string): FieldDef => FIELDS.find((f) => f.key === key) ?? FIELDS[0]!;

interface RowProps {
  readonly field: FieldDef;
  readonly value: unknown;
  readonly simple: boolean;
  readonly onChange: (v: unknown) => void;
}

/** One tweak, drawn from its schema: a slider and a field for numbers, three fields for a vector, a colour input. */
export function FieldRow({ field: f, value, simple, onChange }: RowProps): ReactElement {
  const id = `sx-${f.key}`;
  const neutral = sameValue(value, f.neutral);
  const head = (control: ReactNode): ReactElement => (
    <div className="sx-field-head">
      <label htmlFor={id}>{f.label}</label>
      <span className="sx-grow" />
      {control}
      <button type="button" className="sx-mini" disabled={neutral} onClick={() => onChange(f.neutral)} aria-label={`Reset ${f.label}`}>Reset</button>
    </div>
  );

  if (f.kind === 'color') {
    const hex = typeof value === 'string' && value ? value : '#ffffff';
    return (
      <div className="sx-field">
        {head(<span className="sx-value">{fmtValue(f, value)}</span>)}
        <div className="sx-colour">
          <input id={id} type="color" value={hex} onChange={(e) => onChange(e.target.value)} aria-label={f.label} />
          <input type="text" value={typeof value === 'string' ? value : ''} placeholder="#rrggbb" maxLength={7} aria-label={`${f.label} hex`}
            onChange={(e) => { const t = e.target.value; if (t === '' || /^#[0-9a-fA-F]{6}$/.test(t)) onChange(t); }} />
        </div>
        <p className="sx-help">{f.help}</p>
      </div>
    );
  }

  if (f.kind === 'number' || (f.key === 'scale' && simple)) {
    const n = f.key === 'scale' ? (Array.isArray(value) ? Number(value[0]) : 1) : typeof value === 'number' ? value : Number(f.neutral);
    const shown = neutral && f.kind === 'number' ? f.min : n;
    const setN = (x: number): void => onChange(f.key === 'scale' ? clampField(f, [x, x, x]) : clampField(f, x));
    return (
      <div className="sx-field">
        {head(
          <input className="sx-num" type="number" id={`${id}-num`} value={neutral && f.kind === 'number' ? '' : r2(n)} placeholder={neutral ? 'model' : undefined}
            min={f.min} max={f.max} step={f.step} aria-label={`${f.label} value`}
            onChange={(e) => { if (e.target.value !== '') setN(Number(e.target.value)); }} />,
        )}
        <input id={id} className="sx-range" type="range" min={f.min} max={f.max} step={f.step} value={shown}
          onChange={(e) => setN(Number(e.target.value))} aria-label={`${f.label} slider`} />
        <p className="sx-help">{f.help}</p>
      </div>
    );
  }

  // a vector: offset, or the three axes of scale in Advanced
  const a = Array.isArray(value) ? (value as number[]) : [0, 0, 0];
  const axes = ['x', 'y', 'z'] as const;
  const setAxis = (i: number, x: number): void => {
    const next = [a[0] ?? 0, a[1] ?? 0, a[2] ?? 0];
    next[i] = x;
    onChange(clampField(f, next));
  };
  return (
    <div className="sx-field">
      {head(<span className="sx-value">{fmtValue(f, value)}</span>)}
      <div className="sx-vec">
        {axes.map((ax, i) => (
          <label key={ax} className="sx-axis">
            <span>{ax}</span>
            <input type="number" value={r2(a[i] ?? 0)} min={f.min} max={f.max} step={f.step} aria-label={`${f.label} ${ax}`}
              onChange={(e) => { if (e.target.value !== '') setAxis(i, Number(e.target.value)); }} />
          </label>
        ))}
      </div>
      <p className="sx-help">{f.help}</p>
    </div>
  );
}

/** Whether a preset is the look the asset has now (tint, metal and rough all equal, to the hundredth). */
export function presetMatches(p: MaterialPreset, props: Readonly<Record<string, unknown>>): boolean {
  const tint = typeof props.tint === 'string' ? props.tint.toLowerCase() : '';
  const metal = typeof props.metalness === 'number' ? props.metalness : -1;
  const rough = typeof props.roughness === 'number' ? props.roughness : -1;
  return tint === p.tint.toLowerCase() && Math.abs(metal - p.metalness) < 0.005 && Math.abs(rough - p.roughness) < 0.005;
}

/** The one-click looks: a strip of the vault's material presets, each a swatch and its name. */
function Presets({ presets, props, onPick }: {
  readonly presets: readonly MaterialPreset[];
  readonly props: Readonly<Record<string, unknown>>;
  readonly onPick: (p: MaterialPreset) => void;
}): ReactElement {
  return (
    <div className="sx-presets" role="group" aria-label="Material presets">
      <div className="sx-field-head"><span className="sx-presets-title">Presets</span><span className="sx-dim">Sets base colour, metal and rough</span></div>
      <div className="sx-strip">
        {presets.map((p) => (
          <button key={p.id} type="button" className="sx-preset" aria-pressed={presetMatches(p, props)} onClick={() => onPick(p)}
            title={`${p.name}: base colour ${p.tint}, metal ${p.metalness.toFixed(2)}, rough ${p.roughness.toFixed(2)}`}>
            <span className="sx-swatch" style={{ background: p.tint }} aria-hidden="true" />
            <span className="sx-preset-name">{p.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** The details panel for one placed asset: groups in order, generated from the schema. Advanced adds the Info section. */
export function Details({ id, props, simple, onField, onPick, presets, subject, budgets }: {
  readonly id: string;
  readonly props: Readonly<Record<string, unknown>>;
  readonly simple: boolean;
  readonly onField: (key: string, value: unknown) => void;
  readonly onPick: (p: MaterialPreset) => void;
  readonly presets: readonly MaterialPreset[];
  /** The description from the bench: undefined while it loads, null when the dev bench is not there. */
  readonly subject: string | null | undefined;
  readonly budgets: readonly number[] | null | undefined;
}): ReactElement {
  const info = GEN[id];
  return (
    <div className="sx-details">
      <header className="sx-asset-head">
        <h3>{id}</h3>
        <p className="sx-dim">{info?.class ?? ''} {info ? `${r2(info.size[0])} x ${r2(info.size[1])} x ${r2(info.size[2])} m` : ''}</p>
      </header>
      {GROUPS.map((g) => (
        <section key={g} className="sx-group" aria-label={g}>
          <h4>{g}</h4>
          {FIELDS.filter((f) => f.group === g).map((f) => (
            <FieldRow key={f.key} field={f} value={props[f.key]} simple={simple}
              onChange={(v) => onField(f.key, v)} />
          ))}
          {g === 'Material' ? <Presets presets={presets} props={props} onPick={onPick} /> : null}
        </section>
      ))}
      {simple ? null : (
        <section className="sx-group sx-info" aria-label="Info">
          <h4>Info</h4>
          <dl className="sx-info-list">
            <div><dt>Class</dt><dd>{info?.class ?? '-'}</dd></div>
            <div><dt>Size</dt><dd>{info ? `${r2(info.size[0])} x ${r2(info.size[1])} x ${r2(info.size[2])} m` : '-'}</dd></div>
            <div><dt>Triangles</dt><dd>{budgets ? `low ${budgets[0]?.toLocaleString('en-GB')}, mid ${budgets[1]?.toLocaleString('en-GB')}, high ${budgets[2]?.toLocaleString('en-GB')}` : '-'}</dd></div>
          </dl>
          <p className="sx-subject">{subject === undefined ? 'Reading the description' : subject === null ? 'The description is read in the dev Studio (STUDIO.bat).' : subject}</p>
          <p className="sx-dim sx-help">Edit the description in the Redo panel.</p>
        </section>
      )}
      <FourAnglePanel assetId={id} />
    </div>
  );
}

/** A thumbnail, drawn when its row scrolls into view (the browser has a few hundred assets; most are never drawn). */
function Thumb({ id }: { readonly id: string }): ReactElement {
  const ref = useRef<HTMLSpanElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    let live = true;
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      void thumbOf(id).then((u) => { if (live) setUrl(u); });
    });
    io.observe(el);
    return () => { live = false; io.disconnect(); };
  }, [id]);
  return <span ref={ref} className="sx-thumb" aria-hidden="true">{url ? <img src={url} alt="" draggable={false} /> : null}</span>;
}

/** The content browser: every packed asset, filtered by class and search, with a thumbnail per row. */
export function ContentBrowser({ query, onQuery, placed, onPlace, selected, cls, onClass, versions }: {
  readonly query: string;
  readonly onQuery: (q: string) => void;
  readonly placed: ReadonlySet<string>;
  readonly onPlace: (id: string) => void;
  readonly selected: string | null;
  /** The class filter: '' for every class. */
  readonly cls: string;
  readonly onClass: (c: string) => void;
  /** A number per asset that changes after a redo, so its thumbnail is drawn again. */
  readonly versions: Readonly<Record<string, number>>;
}): ReactElement {
  const q = query.trim().toLowerCase();
  const all = Object.keys(GEN);
  const counts = new Map<string, number>();
  for (const id of all) counts.set(GEN[id]?.class ?? 'other', (counts.get(GEN[id]?.class ?? 'other') ?? 0) + 1);
  const classes = [...counts.keys()].sort((a, b) => a.localeCompare(b));
  const ids = all
    .filter((id) => (cls === '' || (GEN[id]?.class ?? 'other') === cls) && (q === '' || id.includes(q) || (GEN[id]?.class ?? '').includes(q)))
    .sort((a, b) => {
      const ca = GEN[a]?.class ?? '', cb = GEN[b]?.class ?? '';
      return ca === cb ? a.localeCompare(b) : ca.localeCompare(cb);
    });
  return (
    <div className="sx-browser">
      <input className="sx-search" type="search" placeholder="Search assets" value={query} onChange={(e) => onQuery(e.target.value)} aria-label="Search assets" />
      <div className="sx-chips" role="group" aria-label="Filter by class">
        <button type="button" className="sx-chip" aria-pressed={cls === ''} onClick={() => onClass('')}>All <b>{all.length}</b></button>
        {classes.map((c) => (
          <button key={c} type="button" className="sx-chip" aria-pressed={cls === c} onClick={() => onClass(c)}>{c} <b>{counts.get(c)}</b></button>
        ))}
      </div>
      <p className="sx-dim sx-count">{ids.length} of {all.length} assets. Double-click one to place it in the scene.</p>
      <ul className="sx-list" role="listbox" aria-label="Assets">
        {ids.map((id) => {
          const info = GEN[id];
          const on = placed.has(id);
          return (
            <li key={id} className={`sx-row${selected === id ? ' on' : ''}`} onDoubleClick={() => onPlace(id)}>
              <button type="button" className="sx-row-main" onClick={() => onPlace(id)} aria-label={`Place ${id}`}>
                <Thumb key={`${id}:${versions[id] ?? 0}`} id={id} />
                <span className="sx-row-text">
                  <span className="sx-row-name">{id}</span>
                  <span className="sx-dim">{info?.class}</span>
                </span>
              </button>
              {on ? <span className="sx-tag" title="In the scene">in scene</span> : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** The scene's outliner: what is placed, with a dot where something is unsaved. */
export function Outliner({ rows, selected, onSelect, onRemove }: {
  readonly rows: readonly { readonly id: string; readonly pending: number }[];
  readonly selected: string | null;
  readonly onSelect: (id: string) => void;
  readonly onRemove: (id: string) => void;
}): ReactElement {
  if (rows.length === 0) return <p className="sx-dim sx-empty">Nothing in the scene yet.</p>;
  return (
    <ul className="sx-list sx-outliner" aria-label="Scene">
      {rows.map((r) => (
        <li key={r.id} className={`sx-row${selected === r.id ? ' on' : ''}`}>
          <button type="button" className="sx-row-main" onClick={() => onSelect(r.id)} aria-current={selected === r.id ? 'true' : undefined}>
            <span className="sx-row-name">{r.id}</span>
            {r.pending > 0 ? <span className="sx-dot" title={`${r.pending} unsaved`} aria-label={`${r.pending} unsaved`} /> : null}
          </button>
          <button type="button" className="sx-mini" onClick={() => onRemove(r.id)} aria-label={`Remove ${r.id} from the scene`}>Remove</button>
        </li>
      ))}
    </ul>
  );
}

/** The Changes panel: every pending prop, grouped by object, with accept and discard per row. */
export function ChangesPanel({ changes, writable, busy, onAccept, onDiscard, onDiscardAll, status }: {
  readonly changes: readonly Change[];
  readonly writable: boolean;
  readonly busy: boolean;
  readonly onAccept: (rows: readonly Change[]) => void;
  readonly onDiscard: (rows: readonly Change[]) => void;
  readonly onDiscardAll: () => void;
  readonly status: { readonly tone: 'ok' | 'warn' | 'err'; readonly text: string } | null;
}): ReactElement {
  const objects = [...new Set(changes.map((c) => c.id))];
  return (
    <section className="sx-changes" aria-label="Changes">
      <header className="sx-changes-head">
        <h3>Changes <span className="sx-count">{changes.length}</span></h3>
        <span className="sx-dim sx-grow">{changes.length === 0 ? 'Edits you make show here until you accept them into the project.' : `${objects.length} object${objects.length === 1 ? '' : 's'} with unsaved edits`}</span>
        {status ? <span className={`sx-status ${status.tone}`} role="status">{status.text}</span> : null}
        <button type="button" onClick={onDiscardAll} disabled={changes.length === 0 || busy}>Discard all</button>
        <button type="button" className="sx-go" onClick={() => onAccept(changes)} disabled={changes.length === 0 || busy || !writable}
          title={writable ? 'Write these changes into the project' : 'Open STUDIO.bat to save changes'}>Accept all</button>
      </header>
      {changes.length === 0 ? null : (
        <div className="sx-table-wrap">
          <table className="sx-table">
            <thead>
              <tr><th scope="col">Object</th><th scope="col">Field</th><th scope="col">From</th><th scope="col">To</th><th scope="col"><span className="sx-sr">Actions</span></th></tr>
            </thead>
            <tbody>
              {changes.map((c) => {
                const f = fieldOf(c.key);
                return (
                  <tr key={`${c.id}-${c.key}`}>
                    <td>{c.id}</td>
                    <td>{f.label}</td>
                    <td className="sx-num-cell sx-dim">{fmtValue(f, c.from)}</td>
                    <td className="sx-num-cell sx-hot">{fmtValue(f, c.to)}</td>
                    <td className="sx-acts">
                      <button type="button" className="sx-mini" onClick={() => onDiscard([c])} disabled={busy}>Discard</button>
                      <button type="button" className="sx-mini sx-go" onClick={() => onAccept([c])} disabled={busy || !writable}>Accept</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
