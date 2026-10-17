// ============================================================================
// File: apps/web/src/studio/scene-tab.tsx
// TICKET-08b (OPUS_NOTE_15 Item B):
// The Studio's Scene tab: SceneTab({ viewport, registry, writable }).
// Reuses the existing StudioViewport's placement and gizmo, and adds:
// - save and load of named scene layouts (SceneDoc { name, items: { id, assetId, t: Transform }[] },
//   kept in memory, with Copy JSON, and written through the dev route when writable);
// - a toggle for the sockets and plumes gizmo (Item C), with socket & plume labels in the panel.
// Pure helpers: serializeScene and parseScene, with round-trip and bad-input rejection.
// ============================================================================

import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import type * as THREE from 'three';
import { ASSET_TWEAKS, GEN, loadGenRaw } from '../assets/gen';
import { VEHICLE_FIT } from '../assets/gen-props';
import { kv } from '../storage/profile-storage';
import { round3 } from './studio-data';
import type { Copy, StudioViewport, Transform } from './studio-viewport';
import {
  normalizeSockets,
  plumeColourFor,
  resolveMachineKind,
  socketPlumeGizmo,
  type RegistryEntry,
  type SocketPlumeGizmoHandle,
} from './socket-plume-gizmo';

const STYLE_ID = 'hm-studio-scene-tab-styles';
const STYLE_CSS = `
.sx-scene-tab { display: flex; flex-direction: column; gap: 12px; padding: 12px; color: var(--sx-text, #d7e3ee); font: 400 13px/1.45 var(--sx-ui, Inter, system-ui, sans-serif); min-height: 0; overflow-y: auto; }
.sx-scene-card { display: flex; flex-direction: column; gap: 8px; padding: 11px 12px; background: rgba(10, 15, 22, 0.76); border: 1px solid var(--sx-line, #1c2734); border-radius: 8px; }
.sx-scene-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.sx-scene-head h3 { margin: 0; font: 600 12px/1 var(--sx-display, Oxanium, sans-serif); letter-spacing: 0.06em; text-transform: uppercase; color: var(--sx-text, #d7e3ee); }
.sx-scene-row { display: flex; align-items: center; gap: 6px; }
.sx-scene-row input[type='text'] { flex: 1; }
.sx-scene-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; max-height: 220px; overflow-y: auto; }
.sx-scene-item { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 8px; border-radius: 6px; background: rgba(16, 23, 33, 0.72); border: 1px solid transparent; }
.sx-scene-item.on { background: var(--sx-amber-soft, rgba(255, 197, 61, 0.14)); border-color: rgba(255, 197, 61, 0.5); }
.sx-scene-item-btn { flex: 1; display: flex; align-items: center; justify-content: space-between; gap: 8px; background: transparent !important; border: 0 !important; padding: 2px 4px !important; text-align: left; color: var(--sx-text, #d7e3ee); }
.sx-scene-vec-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
.sx-scene-vec-field { min-width: 0; }
.sx-scene-tab input, .sx-scene-tab select { min-width: 0; width: 100%; box-sizing: border-box; }
.sx-scene-vec-field { display: flex; flex-direction: column; gap: 3px; font-size: 11px; color: var(--sx-dim, #6c8193); }
.sx-scene-socket-list { list-style: none; margin: 4px 0 0; padding: 0; display: flex; flex-direction: column; gap: 4px; font-size: 11px; }
.sx-scene-socket-row { display: flex; align-items: center; justify-content: space-between; padding: 4px 7px; border-radius: 4px; background: rgba(5, 8, 12, 0.6); border: 1px solid rgba(44, 61, 81, 0.5); }
.sx-scene-plume-chip { display: inline-flex; align-items: center; gap: 6px; font: 600 11px/1 var(--sx-display, Oxanium, monospace); }
.sx-scene-plume-dot { width: 10px; height: 10px; border-radius: 2px; border: 1px solid rgba(255, 255, 255, 0.35); }
.sx-scene-status { font-size: 11px; padding: 5px 8px; border-radius: 5px; background: rgba(95, 212, 255, 0.12); border: 1px solid rgba(95, 212, 255, 0.35); color: var(--sx-cyan, #5fd4ff); }
.sx-scene-status.err { background: rgba(255, 122, 107, 0.14); border-color: rgba(255, 122, 107, 0.45); color: var(--sx-err, #ff7a6b); }
`;

function ensureSceneStyles(): void {
  if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
    const el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent = STYLE_CSS;
    document.head.appendChild(el);
  }
}

export interface SceneItem {
  readonly id: string;
  readonly assetId: string;
  readonly t: Transform;
}

export interface SceneDoc {
  readonly name: string;
  readonly items: readonly SceneItem[];
}

/** Saved layouts live in this browser (the Studio's own draft store). The dev write-back has no route for them yet. */
const LAYOUTS_KEY = 'studio.scene-layouts';

function normalizeTransform(raw: unknown, label: string): Transform {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`${label}: transform "t" must be an object`);
  }
  const obj = raw as Record<string, unknown>;
  const off = obj.offset;
  if (
    !Array.isArray(off) ||
    off.length !== 3 ||
    typeof off[0] !== 'number' ||
    typeof off[1] !== 'number' ||
    typeof off[2] !== 'number' ||
    !Number.isFinite(off[0]) ||
    !Number.isFinite(off[1]) ||
    !Number.isFinite(off[2])
  ) {
    throw new Error(`${label}: transform offset must be a 3-number tuple [x, y, z]`);
  }
  const yaw = obj.yaw;
  if (typeof yaw !== 'number' || !Number.isFinite(yaw)) {
    throw new Error(`${label}: transform yaw must be a finite number`);
  }
  const scale = obj.scale;
  if (typeof scale !== 'number' || !Number.isFinite(scale) || scale <= 0) {
    throw new Error(`${label}: transform scale must be a positive finite number`);
  }
  return {
    offset: [round3(off[0]), round3(off[1]), round3(off[2])],
    yaw: round3(yaw),
    scale: round3(scale),
  };
}

function validateSceneDoc(input: unknown): SceneDoc {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('SceneDoc must be a JSON object');
  }
  const obj = input as Record<string, unknown>;
  if (typeof obj.name !== 'string' || obj.name.trim().length === 0) {
    throw new Error('SceneDoc "name" must be a non-empty string');
  }
  if (!Array.isArray(obj.items)) {
    throw new Error('SceneDoc "items" must be an array');
  }

  const seenIds = new Set<string>();
  const items: SceneItem[] = obj.items.map((raw, idx) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error(`items[${idx}] must be an object`);
    }
    const r = raw as Record<string, unknown>;
    if (typeof r.id !== 'string' || r.id.trim().length === 0) {
      throw new Error(`items[${idx}].id must be a non-empty string`);
    }
    if (typeof r.assetId !== 'string' || r.assetId.trim().length === 0) {
      throw new Error(`items[${idx}].assetId must be a non-empty string`);
    }
    const id = r.id.trim();
    if (seenIds.has(id)) {
      throw new Error(`Duplicate SceneItem id "${id}"`);
    }
    seenIds.add(id);
    return {
      id,
      assetId: r.assetId.trim(),
      t: normalizeTransform(r.t, `items[${idx}]`),
    };
  });

  return {
    name: obj.name.trim(),
    items,
  };
}

/**
 * Pure helper (TICKET-08b Item B):
 * Validates and serializes a `SceneDoc` to canonical 2-space indented JSON with a trailing newline.
 */
export function serializeScene(doc: SceneDoc): string {
  const clean = validateSceneDoc(doc);
  return `${JSON.stringify(clean, null, 2)}\n`;
}

/**
 * Pure helper (TICKET-08b Item B):
 * Parses and validates a `SceneDoc` from a JSON string (or raw object).
 * Throws an `Error` if the input is malformed or fails schema validation.
 */
export function parseScene(input: string | unknown): SceneDoc {
  let parsed: unknown = input;
  if (typeof input === 'string') {
    if (input.trim().length === 0) {
      throw new Error('Empty scene JSON string');
    }
    try {
      parsed = JSON.parse(input);
    } catch (err) {
      throw new Error(`Invalid scene JSON: ${(err as Error).message}`);
    }
  }
  return validateSceneDoc(parsed);
}

const STARTER_SCENES: readonly SceneDoc[] = [
  {
    name: 'Outpost Production Pad',
    items: [
      { id: 'mill-1', assetId: 'mill', t: { offset: [-3.5, 0, 0], yaw: 0, scale: 1 } },
      { id: 'press-1', assetId: 'press-frame', t: { offset: [3.5, 0, 0], yaw: 90, scale: 1 } },
      { id: 'water-1', assetId: 'watermaker', t: { offset: [0, 0, -5.5], yaw: 0, scale: 1 } },
    ],
  },
  {
    name: 'Rover Bay Inspection',
    items: [
      { id: 'scout-1', assetId: 'scout-body', t: { offset: [-2.5, 0, 0], yaw: 20, scale: 1 } },
      { id: 'hauler-1', assetId: 'hauler-body', t: { offset: [2.8, 0, 0], yaw: -15, scale: 1 } },
    ],
  },
];

/**
 * Sockets for the rover bodies, from the game's own fit table (gen-props). The packed registry carries no sockets, so
 * without this the gizmo would have nothing to mark on those assets.
 */
const SOCKETS_BY_ASSET: Readonly<Record<string, RegistryEntry['sockets']>> = {
  'scout-body': VEHICLE_FIT.scout.sockets,
  'hauler-body': VEHICLE_FIT.hauler.sockets,
  'crawler-body': VEHICLE_FIT.crawler.sockets,
};

/** The registry entry for one placed asset, with its sockets from the registry or the fit table. */
function entryFor(assetId: string, registry: Readonly<Record<string, RegistryEntry>>): RegistryEntry {
  const base = registry[assetId] ?? {};
  return { ...base, id: assetId, sockets: base.sockets ?? SOCKETS_BY_ASSET[assetId] };
}

/** The saved layouts from this browser, each one checked again; the starters when there are none. */
function readLayouts(): SceneDoc[] {
  try {
    const raw = kv.get(LAYOUTS_KEY);
    if (!raw) return [...STARTER_SCENES];
    const list: unknown = JSON.parse(raw);
    if (!Array.isArray(list)) return [...STARTER_SCENES];
    const out: SceneDoc[] = [];
    for (const item of list) {
      try {
        out.push(parseScene(item));
      } catch {
        // a bad entry is left out; the rest still load
      }
    }
    return out.length > 0 ? out : [...STARTER_SCENES];
  } catch {
    return [...STARTER_SCENES];
  }
}

function writeLayouts(list: readonly SceneDoc[]): void {
  try {
    kv.set(LAYOUTS_KEY, JSON.stringify(list));
  } catch {
    // storage may be blocked: the layouts then last for this session only
  }
}

export interface SceneTabProps {
  readonly viewport?: StudioViewport | null;
  readonly registry?: Readonly<Record<string, RegistryEntry>>;
  readonly writable?: boolean | null;
  readonly socketsGizmoOn?: boolean;
  readonly onToggleSocketsGizmo?: (on: boolean) => void;
}

export function SceneTab({
  viewport = null,
  registry = GEN as unknown as Readonly<Record<string, RegistryEntry>>,
  writable = false,
  socketsGizmoOn,
  onToggleSocketsGizmo,
}: SceneTabProps): ReactElement {
  ensureSceneStyles();

  const [layouts, setLayouts] = useState<SceneDoc[]>(readLayouts);
  const [scene, setScene] = useState<SceneDoc>(() => STARTER_SCENES[0]!);
  const [selectedId, setSelectedId] = useState<string | null>(() => STARTER_SCENES[0]?.items[0]?.id ?? null);
  const [assetToAdd, setAssetToAdd] = useState<string>(() => Object.keys(registry)[0] ?? 'mill');
  const [localGizmoOn, setLocalGizmoOn] = useState<boolean>(socketsGizmoOn ?? true);
  const [gizmoTally, setGizmoTally] = useState<{ readonly markers: number; readonly plumes: number }>({ markers: 0, plumes: 0 });
  const [importText, setImportText] = useState<string>('');
  const [status, setStatus] = useState<{ readonly tone: 'ok' | 'err'; readonly text: string } | null>(null);

  const showGizmo = socketsGizmoOn ?? localGizmoOn;
  const toggleGizmo = (next: boolean): void => {
    setLocalGizmoOn(next);
    onToggleSocketsGizmo?.(next);
  };

  const activeItem = useMemo(
    () => scene.items.find((it) => it.id === selectedId) ?? null,
    [scene.items, selectedId],
  );
  const activeEntry = useMemo(
    () => (activeItem ? (registry[activeItem.assetId] ?? { id: activeItem.assetId, class: 'machine' }) : null),
    [activeItem, registry],
  );
  const activeSockets = useMemo(
    () => (activeItem ? normalizeSockets(entryFor(activeItem.assetId, registry)) : []),
    [activeItem, registry],
  );
  const activePlumeColour = useMemo(
    () => (activeEntry && activeItem ? plumeColourFor({ ...activeEntry, id: activeItem.assetId }) : null),
    [activeEntry, activeItem],
  );
  const activeMachineKind = useMemo(
    () => (activeEntry && activeItem ? resolveMachineKind({ ...activeEntry, id: activeItem.assetId }) : null),
    [activeEntry, activeItem],
  );

  const gizmoHandlesRef = useRef<SocketPlumeGizmoHandle[]>([]);

  // Synchronize current SceneDoc items with StudioViewport when viewport is present
  useEffect(() => {
    if (!viewport) return undefined;
    let cancelled = false;

    const cleanupGizmos = (): void => {
      for (const h of gizmoHandlesRef.current) h.dispose();
      gizmoHandlesRef.current = [];
    };

    void Promise.all(
      scene.items.map(async (item) => {
        try {
          const raw = await loadGenRaw(item.assetId, 'low');
          return { item, raw };
        } catch {
          return null;
        }
      }),
    ).then((loaded) => {
      if (cancelled) return;
      cleanupGizmos();

      const valid = loaded.filter((x): x is { item: SceneItem; raw: THREE.Group } => x !== null);
      const copies: Copy[] = valid.map(({ item, raw }) => {
        const cloned = raw.clone(true);
        cloned.name = item.assetId;
        if (showGizmo) {
          const g = socketPlumeGizmo(cloned, entryFor(item.assetId, registry));
          cloned.add(g.group);
          gizmoHandlesRef.current.push(g);
        }
        const baseTweak = ASSET_TWEAKS[item.assetId] ?? {};
        return {
          key: item.id,
          label: `${item.id} (${item.assetId})`,
          raw: cloned,
          slot: item.t.offset,
          tweak: {
            ...baseTweak,
            yaw: item.t.yaw,
            scale: item.t.scale,
          },
        };
      });

      const handles = gizmoHandlesRef.current;
      setGizmoTally({
        markers: handles.reduce((n, h) => n + h.sockets.length, 0),
        plumes: handles.filter((h) => h.vent !== null).length,
      });

      const anchorIdx = valid.findIndex((v) => v.item.id === selectedId);
      const anchorItem = anchorIdx >= 0 ? valid[anchorIdx]!.item : null;
      viewport.show(copies, {
        anchor: anchorIdx >= 0 ? anchorIdx : null,
        transform: anchorItem ? anchorItem.t : null,
        overlay: 'solid',
        figure: true,
        context: 'floor',
        size: [4, 4, 4],
        reframe: false,
      });
    });

    return () => {
      cancelled = true;
      cleanupGizmos();
    };
  }, [viewport, scene, selectedId, showGizmo, registry]);

  const updateItemTransform = (id: string, patch: Partial<Transform>): void => {
    setScene((prev) => ({
      ...prev,
      items: prev.items.map((it) =>
        it.id === id
          ? {
              ...it,
              t: {
                offset: patch.offset ?? it.t.offset,
                yaw: patch.yaw ?? it.t.yaw,
                scale: patch.scale ?? it.t.scale,
              },
            }
          : it,
      ),
    }));
  };

  // The viewport's gizmo drags the selected item, as the Assets workspace drags its asset.
  useEffect(() => {
    if (!viewport) return undefined;
    viewport.setHooks({
      onDragStart: () => undefined,
      onDrag: (next) => {
        if (selectedId) updateItemTransform(selectedId, next);
      },
      onDragEnd: () => undefined,
    });
    return undefined;
  }, [viewport, selectedId]);

  const addItem = (): void => {
    if (!assetToAdd) return;
    const prefix = assetToAdd.split('-')[0] ?? 'item';
    let n = scene.items.length + 1;
    let nextId = `${prefix}-${n}`;
    const existing = new Set(scene.items.map((i) => i.id));
    while (existing.has(nextId)) {
      n++;
      nextId = `${prefix}-${n}`;
    }
    const nextItem: SceneItem = {
      id: nextId,
      assetId: assetToAdd,
      t: { offset: [0, 0, 0], yaw: 0, scale: 1 },
    };
    setScene((prev) => ({ ...prev, items: [...prev.items, nextItem] }));
    setSelectedId(nextId);
  };

  const removeItem = (id: string): void => {
    setScene((prev) => {
      const nextItems = prev.items.filter((i) => i.id !== id);
      if (selectedId === id) {
        setSelectedId(nextItems[0]?.id ?? null);
      }
      return { ...prev, items: nextItems };
    });
  };

  // The dev write-back accepts only asset-tweaks.json, so a layout is kept in this browser. Copy JSON takes it to the project.
  const saveLayout = (): void => {
    try {
      const clean = parseScene(serializeScene(scene));
      const idx = layouts.findIndex((l) => l.name === clean.name);
      const next = idx >= 0 ? layouts.map((l, i) => (i === idx ? clean : l)) : [...layouts, clean];
      setLayouts(next);
      writeLayouts(next);
      setStatus({
        tone: 'ok',
        text: writable
          ? `Saved "${clean.name}" in this browser. Scene files have no project route yet: Copy JSON keeps it.`
          : `Saved "${clean.name}" in this browser. Copy JSON keeps it.`,
      });
    } catch (err) {
      setStatus({ tone: 'err', text: (err as Error).message });
    }
  };

  const copyJson = async (): Promise<void> => {
    try {
      const json = serializeScene(scene);
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(json);
      }
      setStatus({ tone: 'ok', text: `Copied ${scene.items.length} scene items as JSON.` });
    } catch (err) {
      setStatus({ tone: 'err', text: (err as Error).message });
    }
  };

  const loadFromJsonText = (): void => {
    try {
      const parsed = parseScene(importText);
      setScene(parsed);
      setSelectedId(parsed.items[0]?.id ?? null);
      setImportText('');
      setStatus({ tone: 'ok', text: `Loaded layout "${parsed.name}".` });
    } catch (err) {
      setStatus({ tone: 'err', text: (err as Error).message });
    }
  };

  const registryIds = useMemo(() => Object.keys(registry).sort((a, b) => a.localeCompare(b)), [registry]);

  return (
    <div className="sx-scene-tab" data-testid="studio-scene-tab">
      <section className="sx-scene-card" aria-label="Saved Scene Layouts">
        <div className="sx-scene-head">
          <h3>Scene Layout</h3>
          <span className="sx-count">{layouts.length} saved</span>
        </div>
        <div className="sx-scene-row">
          <input
            type="text"
            value={scene.name}
            onChange={(e) => setScene((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Layout name"
            aria-label="Scene layout name"
          />
          <button type="button" className="sx-go" onClick={saveLayout}>
            Save
          </button>
          <button type="button" onClick={() => void copyJson()}>
            Copy JSON
          </button>
        </div>
        <div className="sx-scene-row">
          <select
            value={scene.name}
            onChange={(e) => {
              const found = layouts.find((l) => l.name === e.target.value);
              if (found) {
                setScene(found);
                setSelectedId(found.items[0]?.id ?? null);
              }
            }}
            aria-label="Load saved layout"
            style={{ flex: 1 }}
          >
            {layouts.map((l) => (
              <option key={l.name} value={l.name}>
                {l.name} ({l.items.length} items)
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              const fresh: SceneDoc = { name: `Layout ${layouts.length + 1}`, items: [] };
              setScene(fresh);
              setSelectedId(null);
            }}
          >
            New
          </button>
        </div>
        <div className="sx-scene-row">
          <input
            type="text"
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder="Paste SceneDoc JSON to load..."
            aria-label="Import SceneDoc JSON"
          />
          <button type="button" disabled={!importText.trim()} onClick={loadFromJsonText}>
            Load JSON
          </button>
        </div>
        {status ? (
          <div className={`sx-scene-status${status.tone === 'err' ? ' err' : ''}`} role="status">
            {status.text}
          </div>
        ) : null}
      </section>

      <section className="sx-scene-card" aria-label="Sockets and Plumes Gizmo">
        <div className="sx-scene-head">
          <h3>Sockets &amp; Plumes Gizmo</h3>
          <button
            type="button"
            aria-pressed={showGizmo}
            onClick={() => toggleGizmo(!showGizmo)}
            aria-label="Toggle sockets and plumes gizmo"
          >
            {showGizmo ? 'Gizmo On' : 'Gizmo Off'}
          </button>
        </div>
        <p className="sx-dim" style={{ fontSize: 11 }}>
          Square socket markers and ARGO_NOTE_08 machine vent arrows on the 3D viewport; socket names stay here in the panel only.
        </p>
        <p className="sx-scene-status" data-testid="scene-gizmo-readout">
          {showGizmo
            ? `${gizmoTally.markers} socket markers, ${gizmoTally.plumes} plume vents on the placed items`
            : 'Off: the placed items show without markers or vents'}
        </p>
        {activeItem ? (
          <>
            {activePlumeColour && activeMachineKind ? (
              <div className="sx-scene-socket-row">
                <span>Plume Vent ({activeMachineKind})</span>
                <span className="sx-scene-plume-chip" style={{ color: activePlumeColour }}>
                  <span className="sx-scene-plume-dot" style={{ background: activePlumeColour }} />
                  {activePlumeColour}
                </span>
              </div>
            ) : null}
            {activeSockets.length > 0 ? (
              <ul className="sx-scene-socket-list" aria-label="Selected item sockets">
                {activeSockets.map((s) => (
                  <li key={s.name} className="sx-scene-socket-row">
                    <b>{s.name}</b>
                    <span className="sx-num-cell sx-dim">
                      [{s.at[0].toFixed(2)}, {s.at[1].toFixed(2)}, {s.at[2].toFixed(2)}] m
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="sx-dim" style={{ fontSize: 11 }}>
                No explicit registry sockets on {activeItem.assetId}.
              </p>
            )}
          </>
        ) : null}
      </section>

      <section className="sx-scene-card" aria-label="Scene Items">
        <div className="sx-scene-head">
          <h3>Placed Items</h3>
          <span className="sx-count">{scene.items.length}</span>
        </div>
        <div className="sx-scene-row">
          <select
            value={assetToAdd}
            onChange={(e) => setAssetToAdd(e.target.value)}
            aria-label="Pick asset to place"
            style={{ flex: 1 }}
          >
            {registryIds.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
          <button type="button" onClick={addItem}>
            + Place
          </button>
        </div>
        <ul className="sx-scene-list" aria-label="Placed scene items">
          {scene.items.map((it) => (
            <li key={it.id} className={`sx-scene-item${selectedId === it.id ? ' on' : ''}`}>
              <button
                type="button"
                className="sx-scene-item-btn"
                onClick={() => setSelectedId(it.id)}
                aria-current={selectedId === it.id ? 'true' : undefined}
              >
                <b>{it.id}</b>
                <span className="sx-dim">{it.assetId}</span>
              </button>
              <button
                type="button"
                className="sx-mini"
                onClick={() => removeItem(it.id)}
                aria-label={`Remove ${it.id}`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      </section>

      {activeItem ? (
        <section className="sx-scene-card" aria-label="Selected Item Transform">
          <div className="sx-scene-head">
            <h3>Transform · {activeItem.id}</h3>
            <span className="sx-dim">{activeItem.assetId}</span>
          </div>
          <div className="sx-scene-vec-grid">
            {(['X', 'Y', 'Z'] as const).map((axis, i) => (
              <label key={axis} className="sx-scene-vec-field">
                <span>Offset {axis} (m)</span>
                <input
                  type="number"
                  step={0.25}
                  value={activeItem.t.offset[i] ?? 0}
                  onChange={(e) => {
                    const next: [number, number, number] = [
                      activeItem.t.offset[0],
                      activeItem.t.offset[1],
                      activeItem.t.offset[2],
                    ];
                    next[i] = Number(e.target.value) || 0;
                    updateItemTransform(activeItem.id, { offset: next });
                  }}
                />
              </label>
            ))}
          </div>
          <div className="sx-scene-vec-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            <label className="sx-scene-vec-field">
              <span>Yaw (deg)</span>
              <input
                type="number"
                step={15}
                value={activeItem.t.yaw}
                onChange={(e) => updateItemTransform(activeItem.id, { yaw: Number(e.target.value) || 0 })}
              />
            </label>
            <label className="sx-scene-vec-field">
              <span>Scale</span>
              <input
                type="number"
                step={0.1}
                min={0.05}
                max={5}
                value={activeItem.t.scale}
                onChange={(e) =>
                  updateItemTransform(activeItem.id, {
                    scale: Math.max(0.05, Number(e.target.value) || 1),
                  })
                }
              />
            </label>
          </div>
        </section>
      ) : null}
    </div>
  );
}

export default SceneTab;
