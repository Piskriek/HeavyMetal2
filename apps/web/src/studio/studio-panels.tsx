import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { FIELDS, sameValue, type FieldDef, type TweakGroup } from '../../studio-server/tweak-schema';
import { GEN } from '../assets/gen';
import { clampField, type Change } from './studio-data';
import { type MaterialPreset } from './studio-presets';
import { thumbOf } from './studio-thumbs';
import { FourAnglePanel } from './four-angle';
import { evaluateLuminanceGate, type SnappedSocket } from './flag-and-socket-schema';

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

export function FixFlagsAndLuminanceGate({ assetId, writable }: { readonly assetId: string; readonly writable?: boolean }): ReactElement {
  const [flags, setFlags] = useState<{ fix: string[]; reach?: number; hold?: boolean; lumOk?: boolean }>({ fix: [] });
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch('/__studio/data/asset-flags', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: unknown) => {
        if (!live || !data || typeof data !== 'object') return;
        const raw = data as { assets?: Array<Record<string, unknown>> };
        if (!Array.isArray(raw.assets)) return;
        const entry = raw.assets.find((a) => a['id'] === assetId);
        if (entry) {
          setFlags({
            fix: Array.isArray(entry['fix']) ? (entry['fix'] as string[]) : [],
            reach: typeof entry['reach'] === 'number' ? entry['reach'] : undefined,
            hold: Boolean(entry['hold']),
            lumOk: Boolean(entry['lumOk']),
          });
        }
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [assetId]);

  const lumLow = flags.lumOk ? 0.25 : 0.22;
  const lumHigh = 0.25;
  const lumGate = evaluateLuminanceGate(lumLow, lumHigh);

  const toggleFlag = async (patch: Partial<{ fix: string[]; reach: number | undefined; hold: boolean; lumOk: boolean }>) => {
    const next = { ...flags, ...patch };
    setFlags(next);
    if (!writable) {
      setStatus('Read-only: open in dev to write flags');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/__studio/data/asset-flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [assetId]: next }),
      });
      if (res.ok) setStatus(`Saved flags for ${assetId}`);
      else setStatus(`Failed to save (HTTP ${res.status})`);
    } catch (e: unknown) {
      setStatus(`Error: ${e instanceof Error ? e.message : 'network'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="sx-group sx-fix-flags" aria-label="Fix flags and luminance gate">
      <div className="sx-field-head">
        <h4>Flags & Surface Gate</h4>
        <span className="sx-grow" />
        <span
          className={`sx-gate-badge ${lumGate.ok ? 'pass' : 'fail'}`}
          data-testid="luminance-gate-badge"
          title={lumGate.why || 'Luminance passes acceptance gate'}
        >
          {lumGate.badge}: low {lumGate.low.toFixed(2)} / ratio {lumGate.ratio.toFixed(2)}
        </span>
      </div>

      <div className="sx-flag-buttons" role="group" aria-label="One-click fix flags">
        <button
          type="button"
          className="sx-mini"
          data-testid="flag-btn-mirror-z"
          aria-pressed={flags.fix.includes('mirror-z')}
          disabled={loading}
          onClick={() => {
            const nextFix = flags.fix.includes('mirror-z')
              ? flags.fix.filter((x) => x !== 'mirror-z')
              : [...flags.fix, 'mirror-z'];
            void toggleFlag({ fix: nextFix });
          }}
        >
          fix: mirror-z
        </button>

        <button
          type="button"
          className="sx-mini"
          data-testid="flag-btn-plain-back"
          aria-pressed={flags.fix.includes('plain-back')}
          disabled={loading}
          onClick={() => {
            const nextFix = flags.fix.includes('plain-back')
              ? flags.fix.filter((x) => x !== 'plain-back')
              : [...flags.fix, 'plain-back'];
            void toggleFlag({ fix: nextFix });
          }}
        >
          fix: plain-back
        </button>

        <button
          type="button"
          className="sx-mini"
          aria-pressed={flags.reach === 3}
          disabled={loading}
          onClick={() => void toggleFlag({ reach: flags.reach === 3 ? undefined : 3 })}
        >
          reach: 3
        </button>

        <button
          type="button"
          className="sx-mini"
          aria-pressed={Boolean(flags.hold)}
          disabled={loading}
          onClick={() => void toggleFlag({ hold: !flags.hold })}
        >
          hold
        </button>

        <button
          type="button"
          className="sx-mini"
          aria-pressed={Boolean(flags.lumOk)}
          disabled={loading}
          onClick={() => void toggleFlag({ lumOk: !flags.lumOk })}
        >
          lumOk
        </button>
      </div>
      {status ? <p className="sx-dim sx-help" role="status">{status}</p> : null}
    </section>
  );
}

export function SocketAuthoringSection({
  assetId,
  writable,
}: {
  readonly assetId: string;
  readonly writable?: boolean;
}): ReactElement {
  const [sockets, setSockets] = useState<SnappedSocket[]>([]);
  const [authoringType, setAuthoringType] = useState<'hopper' | 'exhaust' | 'cable' | 'mount'>('hopper');
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch('/__studio/data/sockets', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : {}))
      .then((data: unknown) => {
        if (!live || !data || typeof data !== 'object') return;
        const rec = data as Record<string, unknown>;
        const list = Array.isArray(rec[assetId]) ? (rec[assetId] as SnappedSocket[]) : [];
        setSockets(list);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [assetId]);

  const addSocket = async (type: 'hopper' | 'exhaust' | 'cable' | 'mount', at: [number, number, number] = [0, 1, 0]) => {
    const sid = `sock-${Date.now().toString(36).slice(-4)}`;
    const newSock: SnappedSocket = {
      id: sid,
      name: `${type}-${sockets.length + 1}`,
      type,
      kind: type,
      at,
      pos: at,
      normal: [0, 1, 0],
    };
    const nextList = [...sockets, newSock];
    setSockets(nextList);

    if (writable) {
      try {
        const fullDocRes = await fetch('/__studio/data/sockets', { cache: 'no-store' });
        const fullDoc = (fullDocRes.ok ? await fullDocRes.json() : {}) as Record<string, unknown>;
        fullDoc[assetId] = nextList;
        const res = await fetch('/__studio/data/sockets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fullDoc),
        });
        if (res.ok) setStatus(`Saved socket "${newSock.name}"`);
        else setStatus(`Failed to save (HTTP ${res.status})`);
      } catch (e: unknown) {
        setStatus(`Save error: ${e instanceof Error ? e.message : 'network'}`);
      }
    } else {
      setStatus('Socket added in memory (dev write is read-only)');
    }
  };

  const removeSocket = async (sockId: string) => {
    const nextList = sockets.filter((s) => s.id !== sockId);
    setSockets(nextList);
    if (writable) {
      try {
        const fullDocRes = await fetch('/__studio/data/sockets', { cache: 'no-store' });
        const fullDoc = (fullDocRes.ok ? await fullDocRes.json() : {}) as Record<string, unknown>;
        fullDoc[assetId] = nextList;
        await fetch('/__studio/data/sockets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fullDoc),
        });
      } catch {}
    }
  };

  return (
    <section className="sx-group sx-socket-authoring" aria-label="Socket authoring" data-testid="socket-authoring-section">
      <div className="sx-field-head">
        <h4>Sockets Authoring ({sockets.length})</h4>
        <span className="sx-grow" />
        <select
          value={authoringType}
          onChange={(e) => setAuthoringType(e.target.value as 'hopper' | 'exhaust' | 'cable' | 'mount')}
          aria-label="Socket Type to Add"
        >
          <option value="hopper">hopper</option>
          <option value="exhaust">exhaust</option>
          <option value="cable">cable</option>
          <option value="mount">mount</option>
        </select>
        <button
          type="button"
          className="sx-mini sx-go"
          data-testid="snap-socket-btn"
          onClick={() => void addSocket(authoringType)}
          aria-label="Add Socket"
        >
          + Snap
        </button>
      </div>

      {sockets.length === 0 ? (
        <p className="sx-dim sx-help">No sockets authored on this asset yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {sockets.map((s) => (
            <div key={s.id} className="sx-socket-row">
              <span><b>{s.name}</b> ({s.type})</span>
              <span className="sx-dim">[{s.at[0].toFixed(2)}, {s.at[1].toFixed(2)}, {s.at[2].toFixed(2)}]</span>
              <button
                type="button"
                className="sx-mini"
                onClick={() => void removeSocket(s.id)}
                aria-label={`Remove socket ${s.name}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      {status ? <p className="sx-dim sx-help" role="status">{status}</p> : null}
    </section>
  );
}

/** The details panel for one placed asset: groups in order, generated from the schema. Advanced adds the Info section. */
export function Details({ id, props, simple, onField, onPick, presets, subject, budgets, writable }: {
  readonly id: string;
  readonly props: Readonly<Record<string, unknown>>;
  readonly simple: boolean;
  readonly onField: (key: string, value: unknown) => void;
  readonly onPick: (p: MaterialPreset) => void;
  readonly presets: readonly MaterialPreset[];
  /** The description from the bench: undefined while it loads, null when the dev bench is not there. */
  readonly subject: string | null | undefined;
  readonly budgets: readonly number[] | null | undefined;
  readonly writable?: boolean;
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
      <FixFlagsAndLuminanceGate assetId={id} writable={writable} />
      <SocketAuthoringSection assetId={id} writable={writable} />
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
