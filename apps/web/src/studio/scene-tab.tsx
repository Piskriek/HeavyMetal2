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

import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import type * as THREE from 'three';
import { ASSET_TWEAKS, GEN, loadGenRaw } from '../assets/gen';
import { VEHICLE_FIT } from '../assets/gen-props';
import { kv } from '../storage/profile-storage';
import type { Copy, StudioViewport, Transform } from './studio-viewport';
import {
  normalizeSockets,
  plumeColourFor,
  resolveMachineKind,
  socketPlumeGizmo,
  type RegistryEntry,
  type SocketPlumeGizmoHandle,
} from './socket-plume-gizmo';

import './scene-tab.css';
import {
  LAYOUTS_KEY,
  STARTER_SCENES,
  normalizeTransform,
  parseScene,
  serializeScene,
  validateSceneDoc,
  type SceneDoc,
  type SceneItem,
} from './scene-tab-data';

export {
  LAYOUTS_KEY,
  STARTER_SCENES,
  normalizeTransform,
  parseScene,
  serializeScene,
  validateSceneDoc,
  type SceneDoc,
  type SceneItem,
};

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

export interface SceneUndoHooks {
  readonly undo: () => void;
  readonly redo: () => void;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
}

export interface SceneTabProps {
  readonly viewport?: StudioViewport | null;
  readonly registry?: Readonly<Record<string, RegistryEntry>>;
  readonly writable?: boolean | null;
  readonly socketsGizmoOn?: boolean;
  readonly onToggleSocketsGizmo?: (on: boolean) => void;
  readonly onUndoRef?: (hooks: SceneUndoHooks) => void;
}

export function SceneTab({
  viewport = null,
  registry = GEN as unknown as Readonly<Record<string, RegistryEntry>>,
  writable = false,
  socketsGizmoOn,
  onToggleSocketsGizmo,
  onUndoRef,
}: SceneTabProps): ReactElement {

  const [layouts, setLayouts] = useState<SceneDoc[]>(readLayouts);
  const [scene, setScene] = useState<SceneDoc>(() => STARTER_SCENES[0]!);
  const [selectedId, setSelectedId] = useState<string | null>(() => STARTER_SCENES[0]?.items[0]?.id ?? null);
  const [assetToAdd, setAssetToAdd] = useState<string>(() => Object.keys(registry)[0] ?? 'mill');
  const [localGizmoOn, setLocalGizmoOn] = useState<boolean>(socketsGizmoOn ?? true);
  const [gizmoTally, setGizmoTally] = useState<{ readonly markers: number; readonly plumes: number }>({ markers: 0, plumes: 0 });
  const [importText, setImportText] = useState<string>('');
  const [status, setStatus] = useState<{ readonly tone: 'ok' | 'err'; readonly text: string } | null>(null);

  const [undoStack, setUndoStack] = useState<SceneDoc[]>([]);
  const [redoStack, setRedoStack] = useState<SceneDoc[]>([]);
  const dragStartSceneRef = useRef<SceneDoc | null>(null);
  const sceneRef = useRef<SceneDoc>(scene);
  sceneRef.current = scene;

  const pushUndo = useCallback((prev: SceneDoc): void => {
    setUndoStack((u) => [...u, prev]);
    setRedoStack([]);
  }, []);

  const undo = useCallback((): void => {
    setUndoStack((u) => {
      if (u.length === 0) return u;
      const prev = u[u.length - 1]!;
      const nextU = u.slice(0, -1);
      setRedoStack((r) => [...r, sceneRef.current]);
      setScene(prev);
      return nextU;
    });
  }, []);

  const redo = useCallback((): void => {
    setRedoStack((r) => {
      if (r.length === 0) return r;
      const next = r[r.length - 1]!;
      const nextR = r.slice(0, -1);
      setUndoStack((u) => [...u, sceneRef.current]);
      setScene(next);
      return nextR;
    });
  }, []);

  useEffect(() => {
    onUndoRef?.({
      undo,
      redo,
      canUndo: undoStack.length > 0,
      canRedo: redoStack.length > 0,
    });
  }, [undo, redo, undoStack.length, redoStack.length, onUndoRef]);

  // Load project scene layouts when dev write-back is enabled
  useEffect(() => {
    if (!writable) return undefined;
    let cancelled = false;
    fetch('/__studio/data/scene-layouts')
      .then(async (res) => {
        if (!res.ok) return;
        const data: unknown = await res.json();
        if (cancelled) return;
        if (data && typeof data === 'object') {
          const rawList = Array.isArray(data) ? data : Object.values(data);
          const parsed: SceneDoc[] = [];
          for (const item of rawList) {
            try {
              parsed.push(parseScene(item));
            } catch {
              // ignore malformed entries
            }
          }
          if (parsed.length > 0) {
            setLayouts(parsed);
            writeLayouts(parsed);
          }
        }
      })
      .catch(() => {
        // dev write route not present or blocked
      });
    return () => {
      cancelled = true;
    };
  }, [writable]);

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

  const updateItemTransformWithUndo = (id: string, patch: Partial<Transform>): void => {
    pushUndo(sceneRef.current);
    updateItemTransform(id, patch);
  };

  // The viewport's gizmo drags the selected item, as the Assets workspace drags its asset.
  useEffect(() => {
    if (!viewport) return undefined;
    viewport.setHooks({
      onDragStart: () => {
        dragStartSceneRef.current = sceneRef.current;
      },
      onDrag: (next) => {
        if (selectedId) updateItemTransform(selectedId, next);
      },
      onDragEnd: () => {
        if (dragStartSceneRef.current) {
          const before = JSON.stringify(dragStartSceneRef.current);
          const after = JSON.stringify(sceneRef.current);
          if (before !== after) {
            pushUndo(dragStartSceneRef.current);
          }
          dragStartSceneRef.current = null;
        }
      },
    });
    return undefined;
  }, [viewport, selectedId, pushUndo]);

  const addItem = (): void => {
    if (!assetToAdd) return;
    pushUndo(sceneRef.current);
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
    pushUndo(sceneRef.current);
    setScene((prev) => {
      const nextItems = prev.items.filter((i) => i.id !== id);
      if (selectedId === id) {
        setSelectedId(nextItems[0]?.id ?? null);
      }
      return { ...prev, items: nextItems };
    });
  };

  // POL-88: writes to dev route /__studio/data/scene-layouts when writable, otherwise local storage fallback
  const saveLayout = async (): Promise<void> => {
    try {
      const clean = parseScene(serializeScene(scene));
      const idx = layouts.findIndex((l) => l.name === clean.name);
      const next = idx >= 0 ? layouts.map((l, i) => (i === idx ? clean : l)) : [...layouts, clean];
      setLayouts(next);
      writeLayouts(next);

      if (writable) {
        try {
          const res = await fetch('/__studio/data/scene-layouts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(next),
          });
          if (!res.ok) {
            const errData = (await res.json().catch(() => ({}))) as { why?: string };
            throw new Error(errData.why ?? `Server error ${res.status}`);
          }
          setStatus({
            tone: 'ok',
            text: `Saved "${clean.name}" to project file (scene-layouts.json).`,
          });
          return;
        } catch (postErr) {
          setStatus({
            tone: 'err',
            text: `Saved "${clean.name}" in this browser (server write failed: ${(postErr as Error).message}). Copy JSON keeps it.`,
          });
          return;
        }
      }

      setStatus({
        tone: 'ok',
        text: `Saved "${clean.name}" in this browser. Copy JSON keeps it.`,
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
                    updateItemTransformWithUndo(activeItem.id, { offset: next });
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
                onChange={(e) => updateItemTransformWithUndo(activeItem.id, { yaw: Number(e.target.value) || 0 })}
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
                  updateItemTransformWithUndo(activeItem.id, {
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
