/**
 * The FIDELITY Studio: a desktop editor for the game's assets. Dev-only writes (STUDIO.bat); read-only on the built game.
 *
 * Layout: a top bar (workspaces, undo and redo, keymap, Simple or Advanced, save), the content browser and outliner on
 * the left, the viewport in the centre, and on the right the details panel and the Redo model panel (TASK-18). Every edit
 * is a command on the scenedoc stack; Accept writes the file through the dev endpoint, and Vite's hot reload then shows
 * it in the game.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactElement } from 'react';
import type { Group } from 'three';
import { createHistory, redo, undo, type History, type Op } from '@hm/scenedoc';
import { SPECS } from '@hm/vault';
import { ASSET_TWEAKS, GEN, loadGenRaw, type GenLevel } from '../assets/gen';
import { kv } from '../storage/profile-storage';
import { fieldError, FIELDS, type AssetTweak, type Vec3 } from '../../studio-server/tweak-schema';
import { ChangesPanel, ContentBrowser, Details, Outliner, fmtValue } from './studio-panels';
import { acceptInto, ASSET, clampField, discardOps, EMPTY_HISTORY, fileText, pendingChanges, placeOp, propsOf, REGISTRY, step, tweakOf, type Change, type Props, type Saved } from './studio-data';
import { KEYMAPS, StudioViewport, type Context, type Copy, type Keymap, type Overlay, type Tool, type Transform } from './studio-viewport';
import { presetsFrom, type MaterialPreset } from './studio-presets';
import { RedoPanel } from './studio-redo';
import { AudioTab, normalizeAudioLevels, type AudioLevelEntry, type AudioLevels, type AudioPatch } from './audio-tab';
import { fileUrl, getAsset, type AssetInfo } from './studio-api';
import { forgetLevels, loadGlbUrl } from './studio-levels';
import { forgetThumb } from './studio-thumbs';
import './studio-app.css';

const ENDPOINT = '/__studio/data/asset-tweaks';
const DRAFT_KEY = 'studio.draft';
const LAYOUT_KEY = 'studio.layout';
const MODE_KEY = 'studio.mode';
const KEYMAP_KEY = 'studio.keymap';
const DEFAULT_LAYOUT = { left: 290, right: 320, changes: 210 };
const LIMITS = { left: [200, 480], right: [240, 520], changes: [120, 420] } as const;

type Workspace = 'assets' | 'moon' | 'audio';
/** The sound library as public/audio/levels.json holds it (the wrapper keeps its note). */
type AudioDoc = { readonly about?: string; readonly levels: Readonly<Record<string, AudioLevelEntry>> };
type Status = { readonly tone: 'ok' | 'warn' | 'err'; readonly text: string };
/** The levels the viewport shows: one, or all three side by side. */
type LevelChoice = GenLevel | 'all';
type RightTab = 'details' | 'redo';

const LEVEL_LABEL: Record<GenLevel, string> = { low: 'Low', mid: 'Mid', high: 'High' };
const LEVELS: readonly GenLevel[] = ['low', 'mid', 'high'];
/** The vault's material presets, once: the one-click looks of the Material section. */
const PRESETS: readonly MaterialPreset[] = presetsFrom(SPECS);

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

/** A model the viewport wants: its cache key, what it is called, where it stands, and how to load it. */
interface Want {
  readonly cacheKey: string;
  readonly key: string;
  readonly label: string;
  readonly slot: Vec3;
  readonly tweak: AssetTweak | null;
  readonly load: () => Promise<Group>;
}

const EMPTY_SHOW = { anchor: null, transform: null, overlay: 'solid', figure: false, context: 'none', size: [1, 1, 1], reframe: false } as const;

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
  const [level, setLevel] = useState<LevelChoice>('low');
  const [overlay, setOverlay] = useState<Overlay>('solid');
  const [inContext, setInContext] = useState(false);
  const [query, setQuery] = useState('');
  const [cls, setCls] = useState('');
  const [layout, setLayout] = useState(() => ({ ...DEFAULT_LAYOUT, ...readJson<Partial<typeof DEFAULT_LAYOUT>>(LAYOUT_KEY, {}) }));
  const [copyStats, setCopyStats] = useState<{ readonly label: string; readonly triangles: number }[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [vpTick, setVpTick] = useState(0);
  const [rawTick, setRawTick] = useState(0);
  const [rightTab, setRightTab] = useState<RightTab>('details');
  const [comparing, setComparing] = useState<string | null>(null);
  const [versions, setVersions] = useState<Record<string, number>>({});
  /** The bench's record of the selected asset (its description, budgets): undefined while it loads, null off the dev server. */
  const [benchInfo, setBenchInfo] = useState<AssetInfo | null | undefined>(undefined);
  /** The Audio workspace: the levels as loaded, edited only in memory (no audio write route exists), and a note for Copy JSON. */
  const [audioDoc, setAudioDoc] = useState<AudioDoc | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [audioNote, setAudioNote] = useState<string | null>(null);

  const hostRef = useRef<HTMLDivElement>(null);
  const vpRef = useRef<StudioViewport | null>(null);
  const raws = useRef(new Map<string, Group>());
  const loading = useRef(new Set<string>());
  const failed = useRef(new Set<string>());
  const lastFrame = useRef('');
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

  /** A material preset: base colour, metal and rough at once, one step on the Changes list. */
  const applyPreset = useCallback((p: MaterialPreset) => {
    const id = selRef.current;
    if (!id) return;
    commit(`Look: ${p.name}`, [{
      op: 'set', id,
      props: {
        tint: clampField(fieldFor('tint')!, p.tint),
        metalness: clampField(fieldFor('metalness')!, p.metalness),
        roughness: clampField(fieldFor('roughness')!, p.roughness),
      },
    }]);
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

  /** A redo finished for an asset: its files are new, so what the page shows of it is reloaded. */
  const onAssetChanged = useCallback((id: string) => {
    forgetLevels(id);
    forgetThumb(id);
    for (const k of [...raws.current.keys()]) if (k.startsWith(`${id}|`) || k.includes(`/file/${id}/`)) raws.current.delete(k);
    failed.current.clear();
    setVersions((v) => ({ ...v, [id]: (v[id] ?? 0) + 1 }));
    setRawTick((n) => n + 1);
  }, []);

  // ---- writability: the dev endpoint answers with JSON. The built game has no such route, so it does not ask (the
  // request was a 404 in every built session, and it failed the campaign test's no-HTTP-error check) ----
  useEffect(() => {
    if (import.meta.env?.DEV !== true) { setWritable(false); return undefined; }
    let live = true;
    fetch(ENDPOINT, { cache: 'no-store' })
      .then((r) => { if (live) setWritable(r.ok && (r.headers.get('content-type') ?? '').includes('json')); })
      .catch(() => { if (live) setWritable(false); });
    return () => { live = false; };
  }, []);

  // ---- the Audio workspace: public/audio/levels.json, fetched beside the page the way the game's own audio loads it ----
  useEffect(() => {
    if (workspace !== 'audio' || audioDoc || audioError) return undefined;
    let live = true;
    fetch(new URL('audio/levels.json', document.baseURI).toString(), { cache: 'no-store' })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<AudioLevels>; })
      .then((raw) => {
        if (!live) return;
        const about = (raw as { readonly about?: unknown }).about;
        setAudioDoc({ ...(typeof about === 'string' ? { about } : {}), levels: normalizeAudioLevels(raw) });
      })
      .catch((e: unknown) => { if (live) setAudioError(`Could not load audio/levels.json (${e instanceof Error ? e.message : 'fetch failed'}).`); });
    return () => { live = false; };
  }, [workspace, audioDoc, audioError]);

  /** A gain or loop change: kept in memory until the JSON is copied into the project (the dev Assets route writes asset-tweaks.json only). */
  const changeAudio = useCallback((id: string, patch: AudioPatch) => {
    setAudioDoc((d) => {
      const cur = d?.levels[id];
      if (!d || !cur) return d;
      return { ...d, levels: { ...d.levels, [id]: { ...cur, ...patch } } };
    });
    setAudioNote(null);
  }, []);

  const copyAudioJson = useCallback(async () => {
    if (!audioDoc) return;
    const text = `${JSON.stringify(audioDoc, null, 2)}\n`;
    try {
      await navigator.clipboard.writeText(text);
      setAudioNote('Copied the levels JSON. Paste it over public/audio/levels.json to keep the edits.');
    } catch {
      setAudioNote('Could not copy here. The edits stay in this session only.');
    }
  }, [audioDoc]);

  // ---- the bench's record of the selected asset (dev only): its description and budgets ----
  const selVersion = selected ? versions[selected] ?? 0 : 0;
  useEffect(() => {
    if (!selected) { setBenchInfo(undefined); return undefined; }
    let live = true;
    setBenchInfo(undefined);
    void getAsset(selected).then((r) => { if (live) setBenchInfo(r.ok ? r.value : null); });
    return () => { live = false; };
  }, [selected, selVersion]);

  // a selection change leaves the comparison
  useEffect(() => { setComparing(null); }, [selected]);

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
    });
    vpRef.current = vp;
    setVpTick((n) => n + 1);
    return () => { vp.dispose(); vpRef.current = null; };
  }, [workspace, commit]);

  useEffect(() => { vpRef.current?.setKeymap(keymap); }, [keymap, vpTick]);
  useEffect(() => { vpRef.current?.setTool(tool); }, [tool, vpTick]);

  // ---- what the viewport shows: the selected asset at one level or all three, or the old against the new ----
  useEffect(() => {
    const vp = vpRef.current;
    if (!vp) return;
    if (!selected || !selProps) {
      vp.show([], EMPTY_SHOW);
      setCopyStats([]);
      return;
    }
    const info = GEN[selected];
    const size: [number, number, number] = info ? [info.size[0], info.size[1], info.size[2]] : [1, 1, 1];
    const transform: Transform = {
      offset: selProps.offset as Vec3,
      yaw: selProps.yaw as number,
      scale: (selProps.scale as Vec3)[0] ?? 1,
    };
    const tweak = tweakOf(selProps);
    const wants: Want[] = [];
    let anchorKey: string | null = null;
    let context: Context = 'none';
    if (comparing) {
      // the old model (archived) on the top row, the new one (packed now) on the bottom, the levels across
      const span = Math.max(size[0], size[2]);
      const col = span * 1.5 + 0.8, rowGap = span * 1.2 + 1.6;
      LEVELS.forEach((l, ci) => {
        const oldUrl = fileUrl(selected, `${l}.glb`, comparing);
        const newUrl = fileUrl(selected, `${l}.glb`, undefined, selVersion);
        wants.push({ cacheKey: oldUrl, key: `old-${l}`, label: `Old ${LEVEL_LABEL[l]}`, slot: [(ci - 1) * col, 0, rowGap / 2], tweak: null, load: () => loadGlbUrl(oldUrl) });
        wants.push({ cacheKey: newUrl, key: `new-${l}`, label: `New ${LEVEL_LABEL[l]}`, slot: [(ci - 1) * col, 0, -rowGap / 2], tweak: null, load: () => loadGlbUrl(newUrl) });
      });
    } else {
      const levels: readonly GenLevel[] = level === 'all' ? LEVELS : [level];
      const anchorIndex = level === 'all' ? 1 : 0;
      const spacing = Math.max(size[0], size[2]) * 1.35 + 0.6;
      levels.forEach((l, i) => {
        const k = `${selected}|${l}`;
        wants.push({ cacheKey: k, key: l, label: LEVEL_LABEL[l], slot: [(i - anchorIndex) * spacing, 0, 0], tweak, load: () => loadGenRaw(selected, l) });
      });
      anchorKey = levels[anchorIndex] ?? null;
      context = inContext ? (info?.box ? 'lattice' : info?.class === 'lab' ? 'wall' : 'floor') : 'none';
    }
    // load what is missing; the viewport shows once everything it wants has come in (or has failed)
    for (const w of wants) {
      if (raws.current.has(w.cacheKey) || failed.current.has(w.cacheKey) || loading.current.has(w.cacheKey)) continue;
      loading.current.add(w.cacheKey);
      w.load()
        .then((g) => { raws.current.set(w.cacheKey, g); })
        .catch(() => { failed.current.add(w.cacheKey); })
        .finally(() => { loading.current.delete(w.cacheKey); setRawTick((n) => n + 1); });
    }
    if (wants.some((w) => loading.current.has(w.cacheKey))) { setLoadingModels(true); return; }
    setLoadingModels(false);
    const copies: Copy[] = [];
    const labels: string[] = [];
    let anchor: number | null = null;
    for (const w of wants) {
      const raw = raws.current.get(w.cacheKey);
      if (!raw) continue;
      if (w.cacheKey === `${selected}|${anchorKey}`) anchor = copies.length;
      copies.push({ key: w.key, label: w.label, raw, slot: w.slot, tweak: w.tweak });
      labels.push(w.label);
    }
    const frame = `${selected}|${level}|${comparing ?? ''}`;
    const stats = vp.show(copies, {
      anchor: comparing ? null : anchor,
      transform: comparing ? null : transform,
      overlay,
      figure: true,
      context,
      size,
      box: info?.box,
      reframe: frame !== lastFrame.current,
    });
    lastFrame.current = frame;
    setCopyStats(stats.map((s, i): { label: string; triangles: number } => ({ label: labels[i] ?? s.key, triangles: s.triangles })));
  }, [workspace, vpTick, selected, selProps, level, overlay, inContext, comparing, selVersion, rawTick]);

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

  const budgetOf = (label: string): string => {
    const b = benchInfo?.entry.budgets;
    if (!b) return '';
    const i = label.startsWith('Old ') || label.startsWith('New ') ? label.slice(4) : label;
    const idx = i === 'Low' ? 0 : i === 'Mid' ? 1 : i === 'High' ? 2 : -1;
    const v = idx >= 0 ? b[idx] : undefined;
    return v === undefined ? '' : ` of ${v.toLocaleString('en-GB')} budget`;
  };

  const selFields = selProps && selected ? (
    <Details id={selected} props={selProps} simple={mode === 'simple'} onField={setField} onPick={applyPreset} presets={PRESETS}
      subject={benchInfo === undefined ? undefined : benchInfo === null ? null : benchInfo.entry.subject}
      budgets={benchInfo?.entry.budgets ?? null} />
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
          {['Scene', 'Look'].map((name) => (
            <button key={name} type="button" disabled title="Coming next" aria-label={`${name}, coming next`}><span>{name}</span><i>next</i></button>
          ))}
          <button type="button" aria-pressed={workspace === 'audio'} onClick={() => setWorkspace('audio')}>Audio</button>
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
      ) : workspace === 'audio' ? (
        <div className="sx-audio-pane">
          <div className="sx-audio-bar">
            <p role="status">{audioNote ?? (writable === true
              ? 'Dev build: edits stay in this session. Copy the JSON into public/audio/levels.json to keep them.'
              : 'Built game: the levels are listed and previewed here, not edited.')}</p>
            <button type="button" onClick={() => void copyAudioJson()} disabled={!audioDoc} title="Copy the whole levels.json, edits included">Copy JSON</button>
          </div>
          {audioError ? <p className="sx-banner" role="alert">{audioError}</p> : null}
          {audioDoc ? <AudioTab levels={audioDoc.levels} writable={writable === true} onChange={changeAudio} /> : null}
        </div>
      ) : (
        <div className="sx-body">
          <aside className="sx-left sx-panel" aria-label="Content and outliner">
            <section className="sx-block">
              <h2>Content</h2>
              <ContentBrowser query={query} onQuery={setQuery} placed={placed} onPlace={place} selected={selected}
                cls={cls} onClass={setCls} versions={versions} />
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
                    <button key={t} type="button" aria-pressed={tool === t} onClick={() => setTool(t)} disabled={!selected || comparing !== null}>
                      {t === 'move' ? 'Move' : t === 'rotate' ? 'Turn' : 'Scale'} <kbd>{shortcut(t)}</kbd>
                    </button>
                  ))}
                </div>
                <div className="sx-seg" role="group" aria-label="Detail level">
                  {(['low', 'mid', 'high', 'all'] as const).map((l) => (
                    <button key={l} type="button" aria-pressed={level === l} onClick={() => setLevel(l)} disabled={comparing !== null}>
                      {l === 'all' ? 'All three' : LEVEL_LABEL[l]}
                    </button>
                  ))}
                </div>
                <div className="sx-seg" role="group" aria-label="Surface">
                  {(['solid', 'wire', 'normals'] as const).map((o) => (
                    <button key={o} type="button" aria-pressed={overlay === o} onClick={() => setOverlay(o)}>
                      {o === 'solid' ? 'Solid' : o === 'wire' ? 'Wireframe' : 'Normals'}
                    </button>
                  ))}
                </div>
                <button type="button" aria-pressed={inContext} onClick={() => setInContext((v) => !v)} disabled={!selected} title="Show the asset where the game uses it">In context</button>
                <button type="button" onClick={() => vpRef.current?.focus()} disabled={!selected} title="Frame the selected asset (F)">Frame <kbd>F</kbd></button>
              </div>

              {loadingModels ? (
                <div className="sx-loading" role="status">
                  <span>Loading the model</span>
                  <i aria-hidden="true" />
                </div>
              ) : null}

              {!selected ? (
                <div className="sx-empty-view">
                  <h2>Nothing selected</h2>
                  <p>Double-click an asset in Content to place it here. Then drag its arrows to move it, the ring to turn it, the cube to scale it.</p>
                </div>
              ) : null}

              {selected && selProps ? (
                <div className="sx-telemetry" aria-label="Selected asset readout">
                  <div className="sx-tm-head"><span>{comparing ? `${selected}, old against new` : selected}</span><span className="sx-dim">{GEN[selected]?.class}</span></div>
                  <dl>
                    {comparing ? null : <>
                      <div><dt>Offset</dt><dd>{fmtValue(fieldFor('offset')!, selProps.offset)}</dd></div>
                      <div><dt>Turn</dt><dd>{fmtValue(fieldFor('yaw')!, selProps.yaw)}</dd></div>
                      <div><dt>Scale</dt><dd>{fmtValue(fieldFor('scale')!, selProps.scale)}</dd></div>
                    </>}
                    {copyStats.map((s) => (
                      <div key={s.label}><dt>{s.label} triangles</dt><dd>{s.triangles.toLocaleString('en-GB')}<small>{budgetOf(s.label)}</small></dd></div>
                    ))}
                    <div><dt>Real size</dt><dd>{GEN[selected] ? `${GEN[selected]!.size[0].toFixed(2)} x ${GEN[selected]!.size[1].toFixed(2)} x ${GEN[selected]!.size[2].toFixed(2)} m` : '-'}</dd></div>
                  </dl>
                  <p className="sx-dim">{comparing ? 'Old is the archived model, new is the one packed now. Both are shown as they were made.' : KEYMAPS[keymap].nav}</p>
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
            <div className="sx-right-tabs" role="tablist" aria-label="Right panel">
              <button type="button" role="tab" aria-selected={rightTab === 'details'} onClick={() => setRightTab('details')}>Details</button>
              <button type="button" role="tab" aria-selected={rightTab === 'redo'} onClick={() => setRightTab('redo')}>Redo model</button>
            </div>
            {rightTab === 'details' ? (<>
              <div className="sx-block-head">
                <h2>Details</h2>
                <span className="sx-dim">{mode === 'simple' ? 'Simple' : 'Advanced'}</span>
              </div>
              {selFields ?? <p className="sx-dim sx-empty">Select an asset in Scene to see its values.</p>}
              {selected && undoLabel ? <p className="sx-dim sx-last">Last edit: {undoLabel}</p> : null}
            </>) : (
              <RedoPanel id={selected} comparing={comparing} onCompare={setComparing} onChanged={onAssetChanged} />
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
