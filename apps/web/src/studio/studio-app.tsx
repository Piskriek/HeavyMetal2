import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
  DEFAULT_UI_STYLE_ID,
  getUiStylePreset,
  uiTokensToCssVars,
  type UiStyleId,
} from '@hm/hudlayout';
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
import { UiPresetInspector } from './inspectors/ui-preset-inspector';
import { LookTab } from './look-tab';
import { SceneTab } from './scene-tab';
import { AudioTab } from './audio-tab';
import { NewPlanetModal } from './modals/new-planet-modal';
import { SporeCardModal } from './modals/spore-card-modal';
import { TestPlayOverlay } from './modals/test-play-overlay';
import { installStudioAiBridge } from './studio-ai-bridge';
import { kv } from '../storage/profile-storage';

const UI_STYLE_KEY = 'hm.setmix.ui.style';

export interface StudioAppProps {
  store?: StudioStore;
  onBack?: () => void;
  renderPrototype?: () => React.ReactElement;
  initialInspectorTab?: CreativeInspectorTabId;
}

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
  { id: 'ui-interface', label: 'UI & Menus (ui:)', rung: 4 },
];

export const StudioApp: React.FC<StudioAppProps> = ({
  store = defaultStore,
  onBack,
  renderPrototype: _renderPrototype,
  initialInspectorTab,
}) => {
  const state = useSyncExternalStore(
    (listener) => store.subscribe(listener),
    () => store.getSnapshot(),
  );

  const [uiStyleId, setUiStyleId] = useState<UiStyleId>(() => {
    try {
      return getUiStylePreset(kv.get(UI_STYLE_KEY)).id;
    } catch {
      return DEFAULT_UI_STYLE_ID;
    }
  });
  const [hoverUiStyleId, setHoverUiStyleId] = useState<UiStyleId | null>(null);
  const effectiveStylePreset = useMemo(
    () => getUiStylePreset(hoverUiStyleId ?? uiStyleId),
    [hoverUiStyleId, uiStyleId],
  );
  const uiCssVars = useMemo(
    () => uiTokensToCssVars(effectiveStylePreset.tokens),
    [effectiveStylePreset],
  );

  // Sync root document CSS variables so modals and overlays match the Studio's active UI preset
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    for (const [k, v] of Object.entries(uiCssVars)) {
      root.style.setProperty(k, v);
    }
  }, [uiCssVars]);

  useEffect(() => {
    if (initialInspectorTab) {
      store.setActiveWorkspace('creative-suite');
      store.setActiveInspectorTab(initialInspectorTab);
    }
  }, [initialInspectorTab, store]);

  const handleSelectUiStyle = (nextId: UiStyleId) => {
    setUiStyleId(nextId);
    setHoverUiStyleId(null);
    try {
      kv.set(UI_STYLE_KEY, nextId);
    } catch {
      /* ignore */
    }
  };

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

  // Interactive 5-Rung Inception Navigation
  const navigateToRung = (rung: PresetRung) => {
    store.setActiveRung(rung);
    if (rung === 5) {
      store.setActiveWorkspace('scene-layout');
    } else if (rung === 4) {
      store.setActiveWorkspace('creative-suite');
      if (state.activeInspectorTab !== 'ui-interface') {
        store.setActiveInspectorTab('parts-assemblies');
      }
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
      className="studio-root"
      data-ui-style={effectiveStylePreset.id}
      style={{
        ...(uiCssVars as React.CSSProperties),
        display: 'flex',
        flexDirection: 'column',
        width: '100vw',
        height: '100vh',
        background: 'var(--ui-bg, #141613)',
        color: 'var(--ui-ink, #f2f0e8)',
        fontFamily: 'var(--ui-font, Inter, system-ui, sans-serif)',
        overflow: 'hidden',
      }}
    >
      {/* Top Main Bar: Styled by `STUDIO_SHELL_SCREEN` & `UiTokens` (`--ui-*`) */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
          background: 'var(--ui-panel, #1b1d19)',
          borderBottom: '1px solid var(--ui-line, #4c4f47)',
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
                background: 'var(--ui-inset, #2a2c27)',
                border: '1px solid var(--ui-line, #4c4f47)',
                borderRadius: 'var(--ui-radius, 2px)',
                color: 'var(--ui-ink, #f2f0e8)',
                cursor: 'pointer',
              }}
            >
              ← Back
            </button>
          )}
          <span
            style={{
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: '0.08em',
              color: 'var(--ui-accent, #d96b43)',
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
              borderRadius: 'var(--ui-radius, 2px)',
              background: 'var(--ui-inset, #2a2c27)',
              color: 'var(--ui-ink, #f2f0e8)',
              border: '1px solid var(--ui-line, #4c4f47)',
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
                    borderRadius: 'var(--ui-radius, 2px)',
                    border: active
                      ? '1px solid var(--ui-accent, #d96b43)'
                      : '1px solid var(--ui-line, #4c4f47)',
                    background: active ? 'var(--ui-accent, #d96b43)' : 'var(--ui-inset, #2a2c27)',
                    color: active ? 'var(--ui-accent-ink, #ffffff)' : 'var(--ui-dim, #9e9c92)',
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
              borderRadius: 'var(--ui-radius, 2px)',
              border: '1px solid var(--ui-line, #4c4f47)',
              background: 'var(--ui-inset, #2a2c27)',
              color: store.canUndo() ? 'var(--ui-ink, #f2f0e8)' : 'var(--ui-dim, #9e9c92)',
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
              borderRadius: 'var(--ui-radius, 2px)',
              border: '1px solid var(--ui-line, #4c4f47)',
              background: 'var(--ui-inset, #2a2c27)',
              color: store.canRedo() ? 'var(--ui-ink, #f2f0e8)' : 'var(--ui-dim, #9e9c92)',
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
              borderRadius: 'var(--ui-radius, 2px)',
              border: '1px solid var(--ui-ok, #5c9a78)',
              background: 'var(--ui-ok, #5c9a78)',
              color: '#ffffff',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ▶ Test Play in Sandbox
          </button>

          <button
            onClick={() => store.setSporeCardModalOpen(true)}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--ui-radius, 2px)',
              border: '1px solid var(--ui-line, #4c4f47)',
              background: 'var(--ui-inset, #2a2c27)',
              color: 'var(--ui-ink, #f2f0e8)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Export Spore Card
          </button>

          <button
            onClick={handleApplyAndSave}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--ui-radius, 2px)',
              border: '1px solid var(--ui-accent, #d96b43)',
              background: 'var(--ui-accent, #d96b43)',
              color: 'var(--ui-accent-ink, #ffffff)',
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
          background: 'var(--ui-bg, #141613)',
          borderBottom: '1px solid var(--ui-line, #4c4f47)',
          fontSize: 11,
          color: 'var(--ui-dim, #9e9c92)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--ui-accent, #d96b43)', fontWeight: 700, marginRight: 2 }}>
            5-Rung Inception:
          </span>
          {(
            [
              [5, `R5 World: ${breadcrumb.worldLabel}`, 'Zoom Out to Rung 5: Planetary World & Scene Layout'],
              [4, `R4 Kit/UI: ${breadcrumb.machineLabel}`, 'Jump to Rung 4: Modular Machine Kit & UI Screens'],
              [3, `R3 Part: ${state.activePartId ?? 'plinth'}`, 'Dive to Rung 3: Parametric Part & MeshOps Stack'],
              [2, `R2 Slot: ${breadcrumb.slotLabel}`, 'Dive to Rung 2: Layered PBR Material Stack'],
              [1, `R1 Atom: ${state.activeTileId}`, 'Dive to Rung 1: Seamless Procedural Tile & UI Tokens'],
            ] as const
          ).map(([rungNum, text, title], idx) => {
            const active = state.activeRung === rungNum;
            return (
              <React.Fragment key={rungNum}>
                {idx > 0 && <span>▸</span>}
                <button
                  onClick={() => navigateToRung(rungNum)}
                  title={title}
                  style={{
                    padding: '2px 8px',
                    borderRadius: 'var(--ui-radius, 2px)',
                    border: active
                      ? '1px solid var(--ui-accent, #d96b43)'
                      : '1px solid var(--ui-line, #4c4f47)',
                    background: active ? 'var(--ui-accent, #d96b43)' : 'var(--ui-inset, #2a2c27)',
                    color: active ? 'var(--ui-accent-ink, #ffffff)' : 'var(--ui-ink, #f2f0e8)',
                    fontSize: 11,
                    fontWeight: active ? 700 : 500,
                    cursor: 'pointer',
                  }}
                >
                  {text}
                </button>
              </React.Fragment>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {saveBanner && (
            <span style={{ color: 'var(--ui-ok, #5c9a78)', fontWeight: 700 }}>{saveBanner}</span>
          )}
          <button
            onClick={() => navigateToRung(Math.min(5, state.activeRung + 1) as PresetRung)}
            disabled={state.activeRung >= 5}
            title="Zoom Out One Rung in the Preset Hierarchy"
            style={{
              padding: '2px 7px',
              borderRadius: 'var(--ui-radius, 2px)',
              border: '1px solid var(--ui-line, #4c4f47)',
              background: 'var(--ui-inset, #2a2c27)',
              color: state.activeRung < 5 ? 'var(--ui-ink, #f2f0e8)' : 'var(--ui-dim, #9e9c92)',
              fontSize: 10,
              cursor: state.activeRung < 5 ? 'pointer' : 'default',
            }}
          >
            ↑ Zoom Out Rung
          </button>
          <button
            onClick={() => navigateToRung(Math.max(1, state.activeRung - 1) as PresetRung)}
            disabled={state.activeRung <= 1}
            title="Dive In One Rung in the Preset Hierarchy"
            style={{
              padding: '2px 7px',
              borderRadius: 'var(--ui-radius, 2px)',
              border: '1px solid var(--ui-line, #4c4f47)',
              background: 'var(--ui-inset, #2a2c27)',
              color: state.activeRung > 1 ? 'var(--ui-ink, #f2f0e8)' : 'var(--ui-dim, #9e9c92)',
              fontSize: 10,
              cursor: state.activeRung > 1 ? 'pointer' : 'default',
            }}
          >
            ↓ Dive In Rung
          </button>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 'var(--ui-radius, 2px)',
              background: 'var(--ui-inset, #2a2c27)',
              border: '1px solid var(--ui-line, #4c4f47)',
              color: 'var(--ui-accent, #d96b43)',
              fontSize: 10,
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            {rungMeta.label} ({rungMeta.engine})
          </span>
        </div>
      </div>

      {/* Workspace Body */}
      <div style={{ flex: 1, minHeight: 0, minWidth: 0, overflow: 'hidden' }}>
        {state.activeWorkspace === 'creative-suite' && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) 440px',
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

            {/* Right: 6 Purpose-Built Inspector Tabs (including UI & Menus `ui:`) */}
            <div
              style={{
                width: 440,
                minWidth: 0,
                borderLeft: '1px solid var(--ui-line, #4c4f47)',
                background: 'var(--ui-panel, #1b1d19)',
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  borderBottom: '1px solid var(--ui-line, #4c4f47)',
                  background: 'var(--ui-bg, #141613)',
                  overflowX: 'auto',
                  flexShrink: 0,
                }}
              >
                {INSPECTOR_TABS.map((t) => {
                  const active = state.activeInspectorTab === t.id;
                  return (
                    <button
                      key={t.id}
                      data-testid={`studio-tab-${t.id}`}
                      onClick={() => {
                        store.setActiveInspectorTab(t.id);
                        store.setActiveRung(t.rung);
                      }}
                      style={{
                        padding: '9px 10px',
                        fontSize: 11,
                        fontWeight: active ? 700 : 500,
                        border: 'none',
                        borderBottom: active
                          ? '2px solid var(--ui-accent, #d96b43)'
                          : '2px solid transparent',
                        background: active ? 'var(--ui-panel, #1b1d19)' : 'transparent',
                        color: active ? 'var(--ui-accent, #d96b43)' : 'var(--ui-dim, #9e9c92)',
                        whiteSpace: 'nowrap',
                        cursor: 'pointer',
                      }}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>

              <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: state.activeInspectorTab === 'ui-interface' ? 12 : 0 }}>
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
                {state.activeInspectorTab === 'ui-interface' && (
                  <UiPresetInspector
                    activeStyleId={uiStyleId}
                    onSelectStyleId={handleSelectUiStyle}
                    onHoverStyleId={setHoverUiStyleId}
                  />
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
