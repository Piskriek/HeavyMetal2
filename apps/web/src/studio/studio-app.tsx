/**
 * The FIDELITY Studio: a desktop editor for the game's assets. Dev-only writes (STUDIO.bat); read-only on the built game.
 *
 * Layout: a top bar (workspaces, undo and redo, keymap, Simple or Advanced, save), the content browser and outliner on
 * the left, the viewport in the centre, the details panel on the right, and the Changes panel under the viewport. Every
 * edit is a command on the scenedoc stack; Accept writes the file through the dev endpoint, and Vite's hot reload then
 * shows it in the game.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactElement } from 'react';
import type { Group } from 'three';
import { createHistory, redo, undo, type History, type Op } from '@hm/scenedoc';
import { ASSET_TWEAKS, GEN, loadGenRaw, type GenLevel } from '../assets/gen';
import { kv } from '../storage/profile-storage';
import { fieldError, FIELDS, type Vec3 } from '../../studio-server/tweak-schema';
import { ChangesPanel, ContentBrowser, Details, Outliner, fmtValue } from './studio-panels';
import { acceptInto, ASSET, clampField, discardOps, EMPTY_HISTORY, fileText, pendingChanges, placeOp, propsOf, REGISTRY, step, tweakOf, type Change, type Props, type Saved } from './studio-data';
import { KEYMAPS, StudioViewport, type Keymap, type Tool, type Transform } from './studio-viewport';
import './studio-app.css';

const ENDPOINT = '/__studio/data/asset-tweaks';
const DRAFT_KEY = 'studio.draft';
const LAYOUT_KEY = 'studio.layout';
const MODE_KEY = 'studio.mode';
const KEYMAP_KEY = 'studio.keymap';
const DEFAULT_LAYOUT = { left: 290, right: 320, changes: 210 };
const LIMITS = { left: [200, 480], right: [240, 520], changes: [120, 420] } as const;

type Workspace = 'assets' | 'moon';
type Status = { readonly tone: 'ok' | 'warn' | 'err'; readonly text: string };

const readJson = <T,>(key: string, fallback: T): T => {
  try { const raw = kv.get(key); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
};
const writeJson = (key: string, value: unknown): void => { try { kv.set(key, JSON.stringify(value)); } catch { /* storage may be blocked */ } };

const fieldFor = (key: string) => FIELDS.find((f) => f.key === key);

/** Props from a stored draft, kept only where they pass the schema; anything else falls back to the saved value. */
function sanitize(id: string, stored: Record<string, unknown> | undefined): Props {
  const base = propsOf(ASSET_TWEAKS[id]);
  const out: Props = { ...base };
  if (!stored) return out;
  for (const f of FIELDS) {
    const v = stored[f.key];
    if (v !== undefined && fieldError(f, v) === null) out[f.key] = v;
  }
  return out;
}

/** The scene as it was left: the draft's placed assets, or every asset the saved file tweaks. */
function bootHistory(): History {
  const draft = readJson<{ placed?: { id: string; props?: Record<string, unknown> }[] } | null>(DRAFT_KEY, null);
  const placed: { id: string; props?: Record<string, unknown> }[] = draft?.placed ?? Object.keys(ASSET_TWEAKS).map((id) => ({ id }));
  const ops: Op[] = placed
    .filter((p) => Object.prototype.hasOwnProperty.call(GEN, p.id))
    .map((p): Op => ({ op: 'create', type: ASSET, id: p.id, name: p.id, parent: null, props: sanitize(p.id, p.props) }));
  const opened = step(EMPTY_HISTORY, 'Open the scene', ops);
  return createHistory(opened.doc);
}

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

export function StudioApp({ onBack, renderPrototype }: {
  readonly onBack: () => void;
  /** The old prototype (Moon editor), shown as the "Moon (prototype)" workspace. It is not deleted. */
  readonly renderPrototype: () => ReactElement;
}): ReactElement {
  const [boot] = useState(() => bootHistory());
  const [hist, setHist] = useState<History>(boot);
  const [saved, setSaved] = useState<Saved>(() => ({ ...ASSET_TWEAKS }));
  const [writable, setWritable] = useState<boolean | null>(null);
  const [workspace, setWorkspace] = useState<Workspace>('assets');
  const [selected, setSelected] = useState<string | null>(() => boot.doc.roots[0] ?? null);
  const [mode, setMode] = useState<'simple' | 'advanced'>(() => (readJson<string>(MODE_KEY, 'simple') === 'advanced' ? 'advanced' : 'simple'));
  const [keymap, setKeymap] = useState<Keymap>(() => {
    const k = readJson<string>(KEYMAP_KEY, 'setmix');
    return k === 'blender' || k === 'maya' ? k : 'setmix';
  });
  const [tool, setTool] = useState<Tool>('move');
  const [level, setLevel] = useState<GenLevel>('low');
  const [query, setQuery] = useState('');
  const [layout, setLayout] = useState(() => ({ ...DEFAULT_LAYOUT, ...readJson<Partial<typeof DEFAULT_LAYOUT>>(LAYOUT_KEY, {}) }));
  const [stats, setStats] = useState({ meshes: 0, triangles: 0 });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [vpTick, setVpTick] = useState(0);
  const [rawTick, setRawTick] = useState(0);

  const hostRef = useRef<HTMLDivElement>(null);
  const vpRef = useRef<StudioViewport | null>(null);
  const raws = useRef(new Map<string, Group>());
  const loading = useRef(new Set<string>());
  const histRef = useRef(hist);
  histRef.current = hist;
  const selRef = useRef(selected);
  selRef.current = selected;
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const savedRef = useRef(saved);
  savedRef.current = saved;

  const doc = hist.doc;
  const changes = useMemo(() => pendingChanges(doc, saved), [doc, saved]);
  const pendingById = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of changes) m[c.id] = (m[c.id] ?? 0) + 1;
    return m;
  }, [changes]);
  const outlineRows = doc.roots.map((id) => ({ id, pending: pendingById[id] ?? 0 }));
  const placed = useMemo(() => new Set(doc.roots), [doc]);
  const node = selected ? doc.nodes[selected] : undefined;
  const selProps = node?.props as Props | undefined;
  const undoLabel = hist.past[hist.past.length - 1]?.label;
  const redoLabel = hist.future[hist.future.length - 1]?.label;

  const commit = useCallback((label: string, ops: readonly Op[], mergeKey?: string) => {
    setHist((h) => step(h, label, ops, mergeKey ? { key: mergeKey, at: Date.now() } : undefined));
  }, []);

  const setField = useCallback((key: string, value: unknown) => {
    const id = selRef.current;
    const f = fieldFor(key);
    if (!id || !f) return;
    commit(`${f.label}: ${id}`, [{ op: 'set', id, props: { [key]: clampField(f, value) } }], `field:${id}:${key}`);
  }, [commit]);

  const place = useCallback((id: string) => {
    if (!doc.nodes[id]) commit(`Place ${id}`, [placeOp(id, savedRef.current)]);
    setSelected(id);
    setWorkspace('assets');
  }, [commit, doc]);

  const removeId = useCallback((id: string) => {
    commit(`Remove ${id}`, [{ op: 'remove', id }]);
    setSelected((cur) => (cur === id ? null : cur));
  }, [commit]);

  const accept = useCallback(async (rows: readonly Change[]) => {
    if (!writable || rows.length === 0) return;
    setBusy(true);
    setStatus(null);
    try {
      // the file as it is on disk now is the base, so an outside edit made since the page opened is not overwritten
      const cur = await fetch(ENDPOINT, { cache: 'no-store' });
      if (!cur.ok) throw new Error(`could not read the file (HTTP ${cur.status})`);
      const onDisk = (await cur.json()) as Saved;
      const next = acceptInto(onDisk, histRef.current.doc, rows);
      const r = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: fileText(next) });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; why?: string };
      if (!r.ok || !j.ok) throw new Error(j.why ?? `HTTP ${r.status}`);
      setSaved(next);
      setStatus({ tone: 'ok', text: `Saved ${rows.length} change${rows.length === 1 ? '' : 's'} to asset-tweaks.json.` });
    } catch (e) {
      setStatus({ tone: 'err', text: `Not saved: ${e instanceof Error ? e.message : 'the write failed'}` });
    } finally {
      setBusy(false);
    }
  }, [writable]);

  const discard = useCallback((rows: readonly Change[]) => {
    if (rows.length === 0) return;
    commit(rows.length === 1 ? 'Discard a change' : 'Discard changes', discardOps(savedRef.current, rows));
  }, [commit]);

  // ---- writability: the dev endpoint answers with JSON; the built game answers 404 ----
  useEffect(() => {
    let live = true;
    fetch(ENDPOINT, { cache: 'no-store' })
      .then((r) => { if (live) setWritable(r.ok && (r.headers.get('content-type') ?? '').includes('json')); })
      .catch(() => { if (live) setWritable(false); });
    return () => { live = false; };
  }, []);

  // ---- the viewport: created for the Assets workspace, disposed when another one is open ----
  useEffect(() => {
    if (workspace !== 'assets' || !hostRef.current) return;
    const vp = new StudioViewport(hostRef.current, {
      onDragStart: () => { /* the merge key groups one drag into one undo step */ },
      onDrag: (next) => {
        const id = selRef.current;
        if (!id) return;
        const props: Record<string, unknown> = {};
        if (next.offset) props.offset = clampField(fieldFor('offset')!, next.offset);
        if (next.yaw !== undefined) props.yaw = clampField(fieldFor('yaw')!, next.yaw);
        if (next.scale !== undefined) props.scale = clampField(fieldFor('scale')!, next.scale);
        const t = toolRef.current;
        const label = t === 'move' ? 'Move' : t === 'rotate' ? 'Turn' : 'Scale';
        commit(`${label}: ${id}`, [{ op: 'set', id, props }], `gizmo:${id}`);
      },
      onDragEnd: () => { /* nothing: the next step starts a new undo entry */ },
      onStats: (s) => setStats(s),
    });
    vpRef.current = vp;
    setVpTick((n) => n + 1);
    return () => { vp.dispose(); vpRef.current = null; };
  }, [workspace, commit]);

  useEffect(() => { vpRef.current?.setKeymap(keymap); }, [keymap, vpTick]);
  useEffect(() => { vpRef.current?.setTool(tool); }, [tool, vpTick]);

  // the model shown: the selected asset as its file has it, with the scene's (possibly unsaved) values on top
  useEffect(() => {
    const vp = vpRef.current;
    if (!vp) return;
    if (!selected || !selProps) { vp.show(null, null, null); return; }
    const transform: Transform = {
      offset: selProps.offset as Vec3,
      yaw: selProps.yaw as number,
      scale: (selProps.scale as Vec3)[0] ?? 1,
    };
    const key = `${selected}|${level}`;
    const raw = raws.current.get(key);
    if (!raw) {
      vp.show(null, null, transform);
      if (!loading.current.has(key)) {
        loading.current.add(key);
        loadGenRaw(selected, level)
          .then((g) => { raws.current.set(key, g); setRawTick((n) => n + 1); })
          .catch(() => { /* an unknown asset stays empty */ })
          .finally(() => loading.current.delete(key));
      }
      return;
    }
    vp.show(raw, tweakOf(selProps), transform);
  }, [workspace, vpTick, selected, selProps, level, rawTick]);

  // a draft of the scene survives a reload (per browser): what is placed and its values
  useEffect(() => {
    writeJson(DRAFT_KEY, { placed: doc.roots.map((id) => ({ id, props: doc.nodes[id]?.props ?? {} })) });
  }, [doc]);
  useEffect(() => { writeJson(MODE_KEY, mode); }, [mode]);
  useEffect(() => { writeJson(KEYMAP_KEY, keymap); }, [keymap]);
  useEffect(() => { writeJson(LAYOUT_KEY, layout); }, [layout]);

  // ---- keys: undo and redo, delete, focus, tools (never while typing) ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === 'z') {
        e.preventDefault();
        setHist((h) => (e.shiftKey ? redo(REGISTRY, h) : undo(REGISTRY, h)).history);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); setHist((h) => redo(REGISTRY, h).history); return; }
      if (e.ctrlKey || e.metaKey || e.altKey || workspace !== 'assets') return;
      if (k === 'delete' || k === 'backspace') {
        const id = selRef.current;
        if (id) { e.preventDefault(); removeId(id); }
        return;
      }
      if (k === 'escape') { setSelected(null); return; }
      if (k === 'f') { vpRef.current?.focus(); return; }
      const picked = vpRef.current?.toolForKey(k);
      if (picked) setTool(picked);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [removeId, workspace]);

  // ---- panel sizes: drag the splitters, saved per browser; "Classic" puts them back ----
  const startResize = (axis: keyof typeof LIMITS) => (e: ReactPointerEvent<HTMLDivElement>): void => {
    e.preventDefault();
    const x0 = e.clientX, y0 = e.clientY;
    const v0 = layout[axis];
    const [lo, hi] = LIMITS[axis];
    const move = (ev: PointerEvent): void => {
      const d = axis === 'changes' ? y0 - ev.clientY : axis === 'left' ? ev.clientX - x0 : x0 - ev.clientX;
      setLayout((l) => ({ ...l, [axis]: clamp(v0 + d, lo, hi) }));
    };
    const up = (): void => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const shortcut = (name: Tool): string => {
    const keys = Object.entries(KEYMAPS[keymap].tools).find(([, t]) => t === name)?.[0] ?? '';
    return keys.toUpperCase();
  };

  const selFields = selProps && selected ? (
    <Details id={selected} props={selProps} simple={mode === 'simple'} onField={setField} />
  ) : null;

  const style = {
    '--l': `${layout.left}px`,
    '--r': `${layout.right}px`,
    '--b': `${layout.changes}px`,
  } as CSSProperties;

  return (
    <div className="sx" style={style} data-workspace={workspace}>
      <header className="sx-top">
        <div className="sx-brand">
          <span className="sx-mark" aria-hidden="true" />
          <div><b>FIDELITY</b><span>Studio</span></div>
        </div>
        <nav className="sx-tabs" aria-label="Workspaces">
          <button type="button" aria-pressed={workspace === 'assets'} onClick={() => setWorkspace('assets')}>Assets</button>
          {['Scene', 'Look', 'Audio'].map((name) => (
            <button key={name} type="button" disabled title="Coming next" aria-label={`${name}, coming next`}><span>{name}</span><i>next</i></button>
          ))}
          <button type="button" aria-pressed={workspace === 'moon'} onClick={() => setWorkspace('moon')}>Moon (prototype)</button>
        </nav>
        <span className="sx-grow" />
        {workspace === 'assets' ? <>
        <div className="sx-cluster">
          <button type="button" onClick={() => setHist((h) => undo(REGISTRY, h).history)} disabled={!undoLabel} title={undoLabel ? `Undo: ${undoLabel} (Ctrl+Z)` : 'Nothing to undo'} aria-label="Undo">Undo</button>
          <button type="button" onClick={() => setHist((h) => redo(REGISTRY, h).history)} disabled={!redoLabel} title={redoLabel ? `Redo: ${redoLabel} (Ctrl+Shift+Z)` : 'Nothing to redo'} aria-label="Redo">Redo</button>
        </div>
        <div className="sx-cluster">
          <label className="sx-select"><span>Keys</span>
            <select value={keymap} onChange={(e) => setKeymap(e.target.value as Keymap)} aria-label="Keymap">
              {(Object.keys(KEYMAPS) as Keymap[]).map((k) => <option key={k} value={k}>{KEYMAPS[k].label}</option>)}
            </select>
          </label>
          <div className="sx-seg" role="group" aria-label="Panel detail">
            <button type="button" aria-pressed={mode === 'simple'} onClick={() => setMode('simple')}>Simple</button>
            <button type="button" aria-pressed={mode === 'advanced'} onClick={() => setMode('advanced')}>Advanced</button>
          </div>
        </div>
        <div className="sx-cluster">
          <button type="button" onClick={() => setLayout({ ...DEFAULT_LAYOUT })} title="Put the panels back as they start">Classic layout</button>
          <button type="button" className="sx-go" onClick={() => void accept(changes)} disabled={changes.length === 0 || busy || !writable}
            title={writable ? 'Save every pending change to the project' : 'Open STUDIO.bat to save changes'}>Save{changes.length > 0 ? ` (${changes.length})` : ''}</button>
          <button type="button" onClick={onBack}>Back to the lab</button>
        </div>
        </> : <div className="sx-cluster">
          <button type="button" onClick={onBack}>Back to the lab</button>
        </div>}
      </header>

      {writable === false ? (
        <div className="sx-banner" role="status">
          <b>Read-only build.</b> Open STUDIO.bat to save changes. Edits here stay in this browser until then.
        </div>
      ) : null}

      {workspace === 'moon' ? (
        <div className="sx-proto">{renderPrototype()}</div>
      ) : (
        <div className="sx-body">
          <aside className="sx-left sx-panel" aria-label="Content and outliner">
            <section className="sx-block">
              <h2>Content</h2>
              <ContentBrowser query={query} onQuery={setQuery} placed={placed} onPlace={place} selected={selected} />
            </section>
            <section className="sx-block sx-outline">
              <h2>Scene <span className="sx-count">{doc.roots.length}</span></h2>
              <Outliner rows={outlineRows} selected={selected} onSelect={setSelected} onRemove={removeId} />
            </section>
          </aside>

          <div className="sx-split vertical" role="separator" aria-orientation="vertical" aria-label="Resize the content panel" tabIndex={0}
            onPointerDown={startResize('left')} />

          <div className="sx-center">
            <div className="sx-view" ref={hostRef}>
              <div className="sx-tools" role="toolbar" aria-label="Tools">
                <div className="sx-seg" role="group" aria-label="Transform tool">
                  {(['move', 'rotate', 'scale'] as const).map((t) => (
                    <button key={t} type="button" aria-pressed={tool === t} onClick={() => setTool(t)} disabled={!selected}>
                      {t === 'move' ? 'Move' : t === 'rotate' ? 'Turn' : 'Scale'} <kbd>{shortcut(t)}</kbd>
                    </button>
                  ))}
                </div>
                <div className="sx-seg" role="group" aria-label="Detail level">
                  {(['low', 'mid', 'high'] as const).map((l) => (
                    <button key={l} type="button" aria-pressed={level === l} onClick={() => setLevel(l)}>{l === 'low' ? 'Low' : l === 'mid' ? 'Mid' : 'High'}</button>
                  ))}
                </div>
                <button type="button" onClick={() => vpRef.current?.focus()} disabled={!selected} title="Frame the selected asset (F)">Frame <kbd>F</kbd></button>
              </div>

              {!selected ? (
                <div className="sx-empty-view">
                  <h2>Nothing selected</h2>
                  <p>Double-click an asset in Content to place it here. Then drag its arrows to move it, the ring to turn it, the cube to scale it.</p>
                </div>
              ) : null}

              {selected && selProps ? (
                <div className="sx-telemetry" aria-label="Selected asset readout">
                  <div className="sx-tm-head"><span>{selected}</span><span className="sx-dim">{GEN[selected]?.class}</span></div>
                  <dl>
                    <div><dt>Offset</dt><dd>{fmtValue(fieldFor('offset')!, selProps.offset)}</dd></div>
                    <div><dt>Turn</dt><dd>{fmtValue(fieldFor('yaw')!, selProps.yaw)}</dd></div>
                    <div><dt>Scale</dt><dd>{fmtValue(fieldFor('scale')!, selProps.scale)}</dd></div>
                    <div><dt>Meshes</dt><dd>{stats.meshes}</dd></div>
                    <div><dt>Triangles</dt><dd>{stats.triangles.toLocaleString('en-GB')}</dd></div>
                  </dl>
                  <p className="sx-dim">{KEYMAPS[keymap].nav}</p>
                </div>
              ) : null}
            </div>

            <div className="sx-split horizontal" role="separator" aria-orientation="horizontal" aria-label="Resize the changes panel" tabIndex={0}
              onPointerDown={startResize('changes')} />

            <ChangesPanel changes={changes} writable={writable === true} busy={busy} status={status}
              onAccept={(rows) => void accept(rows)} onDiscard={discard} onDiscardAll={() => discard(changes)} />
          </div>

          <div className="sx-split vertical" role="separator" aria-orientation="vertical" aria-label="Resize the details panel" tabIndex={0}
            onPointerDown={startResize('right')} />

          <aside className="sx-right sx-panel" aria-label="Details">
            <div className="sx-block-head">
              <h2>Details</h2>
              <span className="sx-dim">{mode === 'simple' ? 'Simple' : 'Advanced'}</span>
            </div>
            {selFields ?? <p className="sx-dim sx-empty">Select an asset in Scene to see its values.</p>}
            {selected && undoLabel ? <p className="sx-dim sx-last">Last edit: {undoLabel}</p> : null}
          </aside>
        </div>
      )}
    </div>
  );
}

