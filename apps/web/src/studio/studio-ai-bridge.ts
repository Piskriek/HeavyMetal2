/**
 * @file apps/web/src/studio/studio-ai-bridge.ts
 * Programmatic AI Navigation & Inspection Bridge for FIDELITY Studio.
 *
 * Exposes window.__studioBridge and window.__studioNav so automated crawlers,
 * Playwright tests, and external AI agents (Claude, Gemini) can quickly navigate,
 * manipulate state, switch workspaces, select kits/parts, and inspect every screen.
 */

import type {
  CreativeInspectorTabId,
  PresetRung,
  PreviewStage,
  StudioState,
  StudioStore,
  StudioWorkspaceId,
  ViewportMode,
} from './state/studio-store';
import type { DetailRank } from '@hm/kitspec';

export interface StudioScreenManifest {
  readonly workspaces: Array<{ id: StudioWorkspaceId; label: string }>;
  readonly creativeTabs: Array<{ id: CreativeInspectorTabId; label: string; rung: PresetRung }>;
  readonly kits: Array<{ id: string; label: string }>;
  readonly activeWorldId: string;
  readonly activeWorkspace: StudioWorkspaceId;
  readonly activeKitId: string;
  readonly activeRung: PresetRung;
  readonly testPlayActive: boolean;
  readonly newPlanetModalOpen: boolean;
  readonly sporeCardModalOpen: boolean;
}

export interface StudioAiBridge {
  readonly version: string;
  readonly getSnapshot: () => StudioState;
  readonly getManifest: () => StudioScreenManifest;
  readonly navigateWorkspace: (ws: StudioWorkspaceId) => void;
  readonly navigateInspectorTab: (tab: CreativeInspectorTabId) => void;
  readonly selectKit: (kitId: string) => void;
  readonly selectPartAndSlot: (partPath: string | null, partId: string | null, slotKey: string | null) => void;
  readonly setActiveRung: (rung: PresetRung) => void;
  readonly assignMaterial: (slotKey: string, matId: string) => void;
  readonly setWeatheringAge: (age: number) => void;
  readonly setPaint: (index: 0 | 1, hex: string) => void;
  readonly setViewportMode: (mode: ViewportMode, maskLayerIndex?: number | null) => void;
  readonly setPreviewStage: (stage: PreviewStage) => void;
  readonly setPreviewRank: (rank: 'auto' | DetailRank) => void;
  readonly openNewPlanetModal: (open: boolean) => void;
  readonly openSporeCardModal: (open: boolean) => void;
  readonly enterTestPlaySandbox: () => void;
  readonly exitTestPlaySandbox: () => void;
  readonly captureViewportDataUrl: () => string | null;
}

export function installStudioAiBridge(store: StudioStore): () => void {
  const bridge: StudioAiBridge = {
    version: '44.3.0',
    getSnapshot: () => store.getSnapshot(),
    getManifest: () => {
      const snap = store.getSnapshot();
      return {
        workspaces: [
          { id: 'creative-suite', label: 'Creative Suite' },
          { id: 'look-lighting', label: 'Look & Lighting' },
          { id: 'scene-layout', label: 'Scene Layout' },
          { id: 'audio-lab', label: 'Audio Lab' },
        ],
        creativeTabs: [
          { id: 'material-layers', label: 'Material & Layers', rung: 2 },
          { id: 'parts-assemblies', label: 'Parts & Assemblies', rung: 4 },
          { id: 'texgraph-uv', label: 'TexGraph (UV)', rung: 1 },
          { id: 'partgen-meshops', label: 'PartGen & MeshOps', rung: 3 },
          { id: 'logic-triggers', label: 'Logic & Triggers', rung: 3 },
        ],
        kits: Object.entries(snap.kits).map(([id, k]) => ({ id, label: k.label })),
        activeWorldId: snap.activeWorldId,
        activeWorkspace: snap.activeWorkspace,
        activeKitId: snap.activeKitId,
        activeRung: snap.activeRung,
        testPlayActive: snap.testPlayActive,
        newPlanetModalOpen: snap.newPlanetModalOpen,
        sporeCardModalOpen: snap.sporeCardModalOpen,
      };
    },
    navigateWorkspace: (ws) => store.setActiveWorkspace(ws),
    navigateInspectorTab: (tab) => store.setActiveInspectorTab(tab),
    selectKit: (kitId) => store.selectKit(kitId),
    selectPartAndSlot: (partPath, partId, slotKey) => store.selectPartAndSlot(partPath, partId, slotKey),
    setActiveRung: (rung) => store.setActiveRung(rung),
    assignMaterial: (slotKey, matId) => store.assignSlotMaterial(slotKey, matId),
    setWeatheringAge: (age) => store.setMaterialAge(age),
    setPaint: (index, hex) => store.setMaterialPaint(index, hex),
    setViewportMode: (mode, maskLayerIndex) => store.setViewportMode(mode, maskLayerIndex),
    setPreviewStage: (stage) => store.setPreviewStage(stage),
    setPreviewRank: (rank) => store.setPreviewRank(rank),
    openNewPlanetModal: (open) => store.setNewPlanetModalOpen(open),
    openSporeCardModal: (open) => store.setSporeCardModalOpen(open),
    enterTestPlaySandbox: () => store.enterTestPlaySandbox(),
    exitTestPlaySandbox: () => store.exitTestPlaySandbox(),
    captureViewportDataUrl: () => {
      const canvas =
        document.querySelector<HTMLCanvasElement>('canvas[data-testid="studio-viewport-canvas"]') ||
        document.querySelector<HTMLCanvasElement>('canvas');
      if (!canvas) return null;
      try {
        return canvas.toDataURL('image/png');
      } catch (err) {
        console.warn('captureViewportDataUrl failed:', err);
        return null;
      }
    },
  };

  const w = window as unknown as {
    __studioStore?: StudioStore;
    __studioBridge?: StudioAiBridge;
    __studioNav?: StudioAiBridge;
  };

  w.__studioStore = store;
  w.__studioBridge = bridge;
  w.__studioNav = bridge;

  return () => {
    if (w.__studioStore === store) {
      delete w.__studioStore;
      delete w.__studioBridge;
      delete w.__studioNav;
    }
  };
}
