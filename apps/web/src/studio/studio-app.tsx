import React, { useEffect, useState, useSyncExternalStore } from 'react';
import {
  createStudioStore,
  RUNG_METADATA,
  type CreativeInspectorTabId,
  type StudioStore,
  type StudioWorkspaceId,
} from './state/studio-store';
import { persistStagedStudioChanges } from './state/studio-persistence';
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

const defaultStore = createStudioStore();

const WORKSPACES: Array<{ id: StudioWorkspaceId; label: string }> = [
  { id: 'creative-suite', label: 'Creative Suite' },
  { id: 'look-lighting', label: 'Look & Lighting' },
  { id: 'scene-layout', label: 'Scene Layout' },
  { id: 'audio-lab', label: 'Audio Lab' },
];

const INSPECTOR_TABS: Array<{ id: CreativeInspectorTabId; label: string }> = [
  { id: 'material-layers', label: 'Material & Layers' },
  { id: 'parts-assemblies', label: 'Parts & Assemblies' },
  { id: 'texgraph-uv', label: 'TexGraph (UV)' },
  { id: 'partgen-meshops', label: 'PartGen & MeshOps' },
  { id: 'logic-triggers', label: 'Logic & Triggers' },
];

export const StudioApp: React.FC<StudioAppProps> = ({
  store = defaultStore,
  onBack,
  renderPrototype: _renderPrototype,
}) => {
  const state = useSyncExternalStore(
    (listener) => store.subscribe(listener),
    () => store.getSnapshot()
  );

  const [saveBanner, setSaveBanner] = useState<string | null>(null);
  const breadcrumb = store.getBreadcrumb();
  const rungMeta = RUNG_METADATA[state.activeRung];

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
        : `Save warning: ${res.error ?? 'offline mode'}`
    );
    setTimeout(() => setSaveBanner(null), 3000);
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
          <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: '0.06em', color: '#38bdf8' }}>
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
                  onClick={() => store.setActiveWorkspace(ws.id)}
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

      {/* Q1 & Q3: Permanent Context Breadcrumb Bar + 5-Rung Hierarchy Indicator */}
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
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: '#38bdf8', fontWeight: 700 }}>Context:</span>
          <span style={{ color: '#f8fafc' }}>{breadcrumb.formatted}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {saveBanner && <span style={{ color: '#34d399', fontWeight: 700 }}>{saveBanner}</span>}
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 4,
              background: 'rgba(56, 189, 248, 0.12)',
              border: '1px solid #1e3a5f',
              color: '#7dd3fc',
              fontSize: 10,
              fontWeight: 600,
            }}
          >
            {rungMeta.label} ({rungMeta.engine})
          </span>
        </div>
      </div>

      {/* Workspace Body */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {state.activeWorkspace === 'creative-suite' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 410px', height: '100%' }}>
            {/* Left/Center: MaterialSlotStrip + 3D Viewport */}
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0, overflow: 'hidden' }}>
              <MaterialSlotStrip state={state} store={store} />
              <div
                style={{
                  flex: 1,
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'radial-gradient(circle at 50% 40%, #162236, #090d16 75%)',
                }}
              >
                <div style={{ textAlign: 'center', pointerEvents: 'none' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#38bdf8' }}>
                    Live 3D Modular Machine Viewport — {state.kits[state.activeKitId]?.label}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                    Mode: {state.viewportMode.toUpperCase()} | Validation Issues:{' '}
                    {state.validationIssues.length}
                  </div>
                  {state.hoveredMaterialId && (
                    <div style={{ fontSize: 11, color: '#fbbf24', marginTop: 6 }}>
                      Hover Preview Active → {state.hoveredMaterialId}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right: 5 Purpose-Built Inspector Tabs */}
            <div
              style={{
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
                }}
              >
                {INSPECTOR_TABS.map((t) => {
                  const active = state.activeInspectorTab === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => store.setActiveInspectorTab(t.id)}
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

              <div style={{ flex: 1, overflowY: 'auto' }}>
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
        <SporeCardModal state={state} store={store} onClose={() => store.setSporeCardModalOpen(false)} />
      )}
      <TestPlayOverlay state={state} store={store} />
    </div>
  );
};
