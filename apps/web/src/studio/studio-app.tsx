import React, { useEffect, useState, useSyncExternalStore } from 'react';
import {
  createStudioStore,
  RUNG_METADATA,
  type CreativeInspectorTabId,
  type PresetRung,
  type StudioStore,
  type StudioWorkspaceId,
} from './state/studio-store';
import { persistStagedStudioChanges } from './state/studio-persistence';
import { StudioViewportCanvas } from './viewport/studio-viewport';
import { MaterialSlotStrip } from './inspectors/material-slot-strip';
import { MatstackInspector } from './inspectors/matstack-inspector';
import { KitAssemblerPanel } from './inspectors/kit-assembler-panel';
import { TexGraphNodeEditor } from './inspectors/texgraph-node-editor';
import { PartGenMeshOpsPanel } from './inspectors/partgen-meshops-panel';
import { LogicTriggersPanel } from './inspectors/logic-triggers-panel';
import { LookTab } from './look-tab';
import { SceneTab } from './scene-tab';
import { AudioTab } from './audio-tab';
import { NewPlanetModal } from './modals/new-planet-modal';
import { SporeCardModal } from './modals/spore-card-modal';
import { TestPlayOverlay } from './modals/test-play-overlay';

export interface StudioAppProps {
  store?: StudioStore;
  onBack?: () => void;
  renderPrototype?: () => React.ReactElement;
}

import { installStudioAiBridge } from './studio-ai-bridge';

const defaultStore = createStudioStore();

const WORKSPACES: Array<{ id: StudioWorkspaceId; label: string; rung: PresetRung }> = [
  { id: 'creative-suite', label: 'Creative Suite', rung: 4 },
  { id: 'look-lighting', label: 'Look & Lighting', rung: 5 },
  { id: 'scene-layout', label: 'Scene Layout', rung: 5 },
  { id: 'audio-lab', label: 'Audio Lab', rung: 3 },
];

const INSPECTOR_TABS: Array<{ id: CreativeInspectorTabId; label: string; rung: PresetRung }> = [
  { id: 'material-layers', label: 'Material & Layers', rung: 2 },
  { id: 'parts-assemblies', label: 'Parts & Assemblies', rung: 4 },
  { id: 'texgraph-uv', label: 'TexGraph (UV)', rung: 1 },
  { id: 'partgen-meshops', label: 'PartGen & MeshOps', rung: 3 },
  { id: 'logic-triggers', label: 'Logic & Triggers', rung: 3 },
];

export const StudioApp: React.FC<StudioAppProps> = ({
  store = defaultStore,
  onBack,
  renderPrototype: _renderPrototype,
}) => {
  const state = useSyncExternalStore(
    (listener) => store.subscribe(listener),
    () => store.getSnapshot(),
  );

  const [saveBanner, setSaveBanner] = useState<string | null>(null);
  const breadcrumb = store.getBreadcrumb();
  const rungMeta = RUNG_METADATA[state.activeRung];

  // Install Programmatic AI Navigation & Inspection Bridge on window
  useEffect(() => {
    return installStudioAiBridge(store);
  }, [store]);

  // Global keyboard shortcuts: Ctrl+Z / Ctrl+Shift+Z undo/redo & [M] Mask B&W toggle
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          store.redo();
        } else {
          store.undo();
        }
      } else if (e.key.toLowerCase() === 'm' && !e.ctrlKey && !e.metaKey) {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
          if (state.viewportMode === 'mask-bw') {
            store.setViewportMode('lit', null);
          } else {
            store.setViewportMode('mask-bw', state.activeLayerIndex);
          }
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [store, state.viewportMode, state.activeLayerIndex]);

  const handleApplyAndSave = async () => {
    store.applyToCampaign();
    const res = await persistStagedStudioChanges(store);
    setSaveBanner(
      res.ok
        ? `Applied & saved ${res.writtenPaths.length} file(s) to campaign`
        : `Save warning: ${res.error ?? 'offline mode'}`,
    );
    setTimeout(() => setSaveBanner(null), 3000);
  };

  // Interactive 5-Rung Inception Navigation (Part 3 of Audit)
  const navigateToRung = (rung: PresetRung) => {
    store.setActiveRung(rung);
    if (rung === 5) {
      store.setActiveWorkspace('scene-layout');
    } else if (rung === 4) {
      store.setActiveWorkspace('creative-suite');
      store.setActiveInspectorTab('parts-assemblies');
    } else if (rung === 3) {
      store.setActiveWorkspace('creative-suite');
      store.setActiveInspectorTab('partgen-meshops');
    } else if (rung === 2) {
      store.setActiveWorkspace('creative-suite');
      store.setActiveInspectorTab('material-layers');
    } else if (rung === 1) {
      store.setActiveWorkspace('creative-suite');
      store.setActiveInspectorTab('texgraph-uv');
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100vw',
        height: '100vh',
        background: '#090d16',
        color: '#f8fafc',
        fontFamily: 'Inter, system-ui, sans-serif',
        overflow: 'hidden',
      }}
    >
      {/* Top Main Bar: [FIDELITY Studio] + World Switcher + 4 Clean Workspaces + [▶ Test Play] + [Export Spore Card] + [Save] */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
          background: '#0d131f',
          borderBottom: '1px solid #1e293b',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              data-testid="studio-back-btn"
              style={{
                padding: '5px 12px',
                fontSize: 12,
                fontWeight: 600,
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: 4,
                color: '#94a3b8',
                cursor: 'pointer',
              }}
            >
              ← Back
            </button>
          )}
          <span
            style={{
              fontSize: 14,
              fontWeight: 800,
              letterSpacing: '0.06em',
              color: '#38bdf8',
            }}
          >
            FIDELITY STUDIO
          </span>

          {/* Q2: World Switcher Dropdown */}
          <select
            value={state.activeWorldId}
            onChange={(e) => {
              if (e.target.value === '__new__') {
                store.setNewPlanetModalOpen(true);
              } else {
                store.selectWorld(e.target.value);
              }
            }}
            style={{
              padding: '5px 10px',
              borderRadius: 6,
              background: '#162032',
              color: '#e2e8f0',
              border: '1px solid #334155',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {Object.values(state.worlds).map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
            <option value="__new__">[+ Create New Planet / World...]</option>
          </select>

          {/* The 4 Clean Workspaces */}
          <nav style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
            {WORKSPACES.map((ws) => {
              const active = state.activeWorkspace === ws.id;
              return (
                <button
                  key={ws.id}
                  onClick={() => {
                    store.setActiveWorkspace(ws.id);
                    store.setActiveRung(ws.rung);
                  }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 6,
                    border: active ? '1px solid #38bdf8' : '1px solid transparent',
                    background: active ? 'rgba(56, 189, 248, 0.16)' : 'transparent',
                    color: active ? '#f0f9ff' : '#94a3b8',
                    fontSize: 12,
                    fontWeight: active ? 700 : 500,
                    cursor: 'pointer',
                  }}
                >
                  {ws.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right Action Buttons: Undo/Redo, [▶ Test Play], [Export Spore Card], [Save] */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => store.undo()}
            disabled={!store.canUndo()}
            title="Undo (Ctrl+Z)"
            style={{
              padding: '5px 8px',
              borderRadius: 5,
              border: '1px solid #334155',
              background: '#162032',
              color: store.canUndo() ? '#e2e8f0' : '#475569',
              fontSize: 11,
              cursor: store.canUndo() ? 'pointer' : 'default',
            }}
          >
            ↶ Undo
          </button>
          <button
            onClick={() => store.redo()}
            disabled={!store.canRedo()}
            title="Redo (Ctrl+Shift+Z)"
            style={{
              padding: '5px 8px',
              borderRadius: 5,
              border: '1px solid #334155',
              background: '#162032',
              color: store.canRedo() ? '#e2e8f0' : '#475569',
              fontSize: 11,
              cursor: store.canRedo() ? 'pointer' : 'default',
            }}
          >
            ↷ Redo
          </button>

          <button
            onClick={() => store.enterTestPlaySandbox()}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: 'none',
              background: '#10b981',
              color: '#052e16',
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            ▶ Test Play in Sandbox
          </button>

          <button
            onClick={() => store.setSporeCardModalOpen(true)}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid #a855f7',
              background: 'rgba(168, 85, 247, 0.18)',
              color: '#e9d5ff',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Export Spore Card
          </button>

          <button
            onClick={handleApplyAndSave}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              border: 'none',
              background: '#0284c7',
              color: '#fff',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Apply to Campaign / Save
          </button>
        </div>
      </header>

      {/* Q1 & Q3: Interactive 5-Rung Inception Context Breadcrumb Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '5px 16px',
          background: '#0b101b',
          borderBottom: '1px solid #182234',
          fontSize: 11,
          color: '#94a3b8',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
          <span style={{ color: '#38bdf8', fontWeight: 700, marginRight: 2 }}>
            5-Rung Inception:
          </span>
          <button
            onClick={() => navigateToRung(5)}
            title="Zoom Out to Rung 5: Planetary World & Scene Layout"
            style={{
              padding: '2px 8px',
              borderRadius: 4,
              border: state.activeRung === 5 ? '1px solid #38bdf8' : '1px solid #1e293b',
              background: state.activeRung === 5 ? 'rgba(56, 189, 248, 0.18)' : '#111827',
              color: state.activeRung === 5 ? '#f8fafc' : '#cbd5e1',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            🪐 R5 World: {breadcrumb.worldLabel}
          </button>
          <span>▸</span>
          <button
            onClick={() => navigateToRung(4)}
            title="Jump to Rung 4: Modular Machine Kit & Sockets (@hm/kitspec)"
            style={{
              padding: '2px 8px',
              borderRadius: 4,
              border: state.activeRung === 4 ? '1px solid #38bdf8' : '1px solid #1e293b',
              background: state.activeRung === 4 ? 'rgba(56, 189, 248, 0.18)' : '#111827',
              color: state.activeRung === 4 ? '#f8fafc' : '#cbd5e1',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            ⚙️ R4 Kit: {breadcrumb.machineLabel}
          </button>
          <span>▸</span>
          <button
            onClick={() => navigateToRung(3)}
            title="Dive to Rung 3: Parametric Part & MeshOps Stack (@hm/partgen)"
            style={{
              padding: '2px 8px',
              borderRadius: 4,
              border: state.activeRung === 3 ? '1px solid #38bdf8' : '1px solid #1e293b',
              background: state.activeRung === 3 ? 'rgba(56, 189, 248, 0.18)' : '#111827',
              color: state.activeRung === 3 ? '#f8fafc' : '#cbd5e1',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            📦 R3 Part: {state.activePartId ?? 'plinth'}
          </button>
          <span>▸</span>
          <button
            onClick={() => navigateToRung(2)}
            title="Dive to Rung 2: Layered PBR Material Stack (@hm/matstack)"
            style={{
              padding: '2px 8px',
              borderRadius: 4,
              border: state.activeRung === 2 ? '1px solid #38bdf8' : '1px solid #1e293b',
              background: state.activeRung === 2 ? 'rgba(56, 189, 248, 0.18)' : '#111827',
              color: state.activeRung === 2 ? '#f8fafc' : '#cbd5e1',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            🎨 R2 Slot: {breadcrumb.slotLabel}
          </button>
          <span>▸</span>
          <button
            onClick={() => navigateToRung(1)}
            title="Dive to Rung 1: Seamless Procedural Tile Atom (@hm/texgraph)"
            style={{
              padding: '2px 8px',
              borderRadius: 4,
              border: state.activeRung === 1 ? '1px solid #38bdf8' : '1px solid #1e293b',
              background: state.activeRung === 1 ? 'rgba(56, 189, 248, 0.18)' : '#111827',
              color: state.activeRung === 1 ? '#f8fafc' : '#cbd5e1',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            🧬 R1 Atom: {state.activeTileId}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {saveBanner && (
            <span style={{ color: '#34d399', fontWeight: 700 }}>{saveBanner}</span>
          )}
          <button
            onClick={() =>
              navigateToRung(Math.min(5, state.activeRung + 1) as PresetRung)
            }
            disabled={state.activeRung >= 5}
            title="Zoom Out One Rung in the Preset Hierarchy"
            style={{
              padding: '2px 7px',
              borderRadius: 4,
              border: '1px solid #334155',
              background: '#162032',
              color: state.activeRung < 5 ? '#7dd3fc' : '#475569',
              fontSize: 10,
              cursor: state.activeRung < 5 ? 'pointer' : 'default',
            }}
          >
            ↑ Zoom Out Rung
          </button>
          <button
            onClick={() =>
              navigateToRung(Math.max(1, state.activeRung - 1) as PresetRung)
            }
            disabled={state.activeRung <= 1}
            title="Dive In One Rung in the Preset Hierarchy"
            style={{
              padding: '2px 7px',
              borderRadius: 4,
              border: '1px solid #334155',
              background: '#162032',
              color: state.activeRung > 1 ? '#7dd3fc' : '#475569',
              fontSize: 10,
              cursor: state.activeRung > 1 ? 'pointer' : 'default',
            }}
          >
            ↓ Dive In Rung
          </button>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 4,
              background: 'rgba(56, 189, 248, 0.12)',
              border: '1px solid #1e3a5f',
              color: '#7dd3fc',
              fontSize: 10,
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            {rungMeta.label} ({rungMeta.engine})
          </span>
        </div>
      </div>

      {/* Workspace Body (Strict minWidth: 0 & minmax(0, 1fr) prevents CSS Grid Blow-Out!) */}
      <div style={{ flex: 1, minHeight: 0, minWidth: 0, overflow: 'hidden' }}>
        {state.activeWorkspace === 'creative-suite' && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) 420px',
              width: '100%',
              height: '100%',
              minWidth: 0,
              minHeight: 0,
              overflow: 'hidden',
            }}
          >
            {/* Left/Center: MaterialSlotStrip + Live Three.js WebGL Viewport */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                width: '100%',
                height: '100%',
                minWidth: 0,
                minHeight: 0,
                overflow: 'hidden',
              }}
            >
              <MaterialSlotStrip state={state} store={store} />
              <div style={{ flex: 1, minWidth: 0, minHeight: 0, position: 'relative' }}>
                <StudioViewportCanvas state={state} store={store} />
              </div>
            </div>

            {/* Right: 5 Purpose-Built Inspector Tabs */}
            <div
              style={{
                width: 420,
                minWidth: 0,
                borderLeft: '1px solid #1e293b',
                background: '#0f172a',
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  borderBottom: '1px solid #1e293b',
                  background: '#0b111e',
                  overflowX: 'auto',
                  flexShrink: 0,
                }}
              >
                {INSPECTOR_TABS.map((t) => {
                  const active = state.activeInspectorTab === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        store.setActiveInspectorTab(t.id);
                        store.setActiveRung(t.rung);
                      }}
                      style={{
                        padding: '9px 10px',
                        fontSize: 11,
                        fontWeight: active ? 700 : 500,
                        border: 'none',
                        borderBottom: active ? '2px solid #38bdf8' : '2px solid transparent',
                        background: 'transparent',
                        color: active ? '#38bdf8' : '#94a3b8',
                        whiteSpace: 'nowrap',
                        cursor: 'pointer',
                      }}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>

              <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                {state.activeInspectorTab === 'material-layers' && (
                  <MatstackInspector state={state} store={store} />
                )}
                {state.activeInspectorTab === 'parts-assemblies' && (
                  <KitAssemblerPanel state={state} store={store} />
                )}
                {state.activeInspectorTab === 'texgraph-uv' && (
                  <TexGraphNodeEditor state={state} store={store} />
                )}
                {state.activeInspectorTab === 'partgen-meshops' && (
                  <PartGenMeshOpsPanel state={state} store={store} />
                )}
                {state.activeInspectorTab === 'logic-triggers' && (
                  <LogicTriggersPanel state={state} store={store} />
                )}
              </div>
            </div>
          </div>
        )}

        {state.activeWorkspace === 'look-lighting' && (
          <LookTab state={state} store={store} />
        )}

        {state.activeWorkspace === 'scene-layout' && (
          <SceneTab state={state} store={store} />
        )}

        {state.activeWorkspace === 'audio-lab' && (
          <AudioTab state={state} store={store} />
        )}
      </div>

      {/* Modals & Sandbox Overlay */}
      {state.newPlanetModalOpen && (
        <NewPlanetModal store={store} onClose={() => store.setNewPlanetModalOpen(false)} />
      )}
      {state.sporeCardModalOpen && (
        <SporeCardModal
          state={state}
          store={store}
          onClose={() => store.setSporeCardModalOpen(false)}
        />
      )}
      <TestPlayOverlay state={state} store={store} />
    </div>
  );
};
