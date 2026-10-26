/**
 * @file apps/web/src/studio/state/studio-store.ts
 * ARGO_STUDIO_CLEANUP_DIRECTIVE.md (Commit 9fd3d9fb):
 * Unified Studio Session Store implementing:
 *  - Loop A: "Tune & Mod the Example Game" (Campaign Polish Loop)
 *  - Loop B: "Genesis of a New Planet" (From-Scratch World Builder Loop)
 *  - All 10 Logical Questions (Q1 Context Breadcrumb, Q2 World Switcher, Q3 5-Rung Hierarchy,
 *    Q4 Hover Try-On & Undo/Redo, Q5 3D Triad Sockets & Auto-Snap, Q6 Two-Tier Matstack,
 *    Q7 20-Tile TexGraph, Q8 @hm/wiregraph Logic & Triggers, Q9 Test Play in Sandbox,
 *    Q10 Spore Card PNG zTXt Export & Stargate Dialing Address)
 *  - The 4 Clean Workspaces ('creative-suite' | 'look-lighting' | 'scene-layout' | 'audio-lab')
 */

import type {
  AssemblyDef,
  DetailRank,
  Issue,
  Kit,
  OpRef,
  Overrides,
  PartDef,
  Placement,
  SocketDef,
} from '@hm/kitspec';
import { validate } from '@hm/kitspec';
import type {
  ChannelGroup,
  LayerSpec,
  MaskInput,
  MaskSpec,
  MaterialSpec,
  SurfaceSpec,
} from '@hm/matstack';
import {
  LAYER_SHELF,
  MATERIAL_SHELF,
  resolveMatPreset,
} from '@hm/matstack';
import { GENERATORS, resolveParams } from '@hm/partgen';
import type { TexGraph } from '@hm/texgraph';
import { TILE_LIBRARY, validateGraph } from '@hm/texgraph';
import type { End, Graph as WireGraph } from '@hm/wiregraph';
import { connect, layers as layersWireGraph, layout as layoutWireGraph, problems } from '@hm/wiregraph';
import { STUDIO_KIT_REGISTRY } from '../kits/studio-kit-registry';
import type { DiscoveredMaterialSlot } from '../viewport/raycast-picker';
import { extractMaterialSlots } from '../viewport/raycast-picker';
import { autoSnapFloatingPlacements } from '../viewport/socket-gizmos';
import type {
  BiomeFormulaId,
  SporeCardPayload,
  StargateAccessMode,
  WorldPlacementEntry,
} from './spore-card-codec';
import { computeStargateAddress, decodeSporeCardPng, encodeSporeCardPng } from './spore-card-codec';

export type StudioWorkspaceId = 'creative-suite' | 'look-lighting' | 'scene-layout' | 'audio-lab';
export type CreativeInspectorTabId = 'material-layers' | 'parts-assemblies' | 'texgraph-uv' | 'partgen-meshops' | 'logic-triggers';
export type PresetRung = 1 | 2 | 3 | 4 | 5;
export type ViewportMode = 'lit' | 'mask-bw' | 'wireframe-ranks' | 'quad-4angle';
export type PreviewStage = 'lab-neutral' | 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type KeymapScheme = 'setmix-wer' | 'blender-grs';
export type QuickMeshOpPreset =
  | 'smooth'
  | 'chamfer-45'
  | 'recessed-seam'
  | 'funnel-taper'
  | 'stretch-span'
  | 'edge-wear';

export const RUNG_METADATA: Readonly<Record<PresetRung, { readonly rung: PresetRung; readonly label: string; readonly engine: string }>> = Object.freeze({
  1: { rung: 1, label: 'Rung 1: Atoms', engine: '@hm/partgen & @hm/texgraph' },
  2: { rung: 2, label: 'Rung 2: Stacks', engine: '@hm/matstack & @hm/meshops' },
  3: { rung: 3, label: 'Rung 3: Parts & Stems', engine: '@hm/soundlab' },
  4: { rung: 4, label: 'Rung 4: Kits & Assemblies', engine: '@hm/kitspec' },
  5: { rung: 5, label: 'Rung 5: Worlds & Cartridges', engine: '@hm/cartlab & @hm/coopnet' },
});

export interface StudioWorldSpec {
  readonly id: string;
  readonly name: string;
  readonly isCampaign: boolean;
  readonly seed: number;
  readonly biome: BiomeFormulaId;
  /** The Four Floats S = (Pxd, Vtx, Lx, Aq) on 0..100 scale. */
  readonly floats: {
    readonly pxd: number;
    readonly vtx: number;
    readonly lx: number;
    readonly aq: number;
  };
  readonly sunElevationDeg: number;
  readonly sunAzimuthDeg: number;
  readonly skyTurbidity: number;
  readonly stargateAddress: string;
  readonly stargateAccess: StargateAccessMode;
  readonly placements: readonly WorldPlacementEntry[];
  readonly logicGraph: WireGraph;
}

export interface StudioBreadcrumb {
  readonly worldLabel: string;
  readonly machineLabel: string;
  readonly slotLabel: string;
  readonly detailLabel: string;
  readonly formatted: string;
}

export interface StagedChangeEntry {
  readonly id: string;
  readonly category: 'material' | 'tile' | 'kit-assembly' | 'part-param' | 'part-override' | 'world-spec' | 'campaign-apply';
  readonly targetId: string;
  readonly summary: string;
  readonly diskPath: string;
  readonly payloadJson: string;
}

export interface StudioState {
  // Top-level 4-Workspace & 5-Rung navigation
  readonly activeWorkspace: StudioWorkspaceId;
  readonly activeInspectorTab: CreativeInspectorTabId;
  readonly activeRung: PresetRung;

  // Worlds (Loop A Campaign Worlds + Loop B Custom Planets)
  readonly worlds: Readonly<Record<string, StudioWorldSpec>>;
  readonly activeWorldId: string;

  // Kits, Materials, Tiles & Overrides
  readonly kits: Readonly<Record<string, { readonly kit: Kit; readonly rootPreset: string; readonly label: string }>>;
  readonly materials: Readonly<Record<string, MaterialSpec>>;
  readonly tiles: Readonly<Record<string, TexGraph>>;
  readonly overridesByKit: Readonly<Record<string, Overrides>>;

  // Selection Context
  readonly activeKitId: string;
  readonly activePartPath: string | null;
  readonly activePartId: string | null;
  readonly activeSlotKey: string | null;
  readonly slotAssignScope: 'part-override' | 'kit-slot';
  readonly activeSocketPinId: string | null;

  readonly activeMaterialId: string;
  readonly hoveredMaterialId: string | null;
  readonly activeLayerIndex: number;
  readonly activeTileId: string;

  // Viewport & Look controls
  readonly viewportMode: ViewportMode;
  readonly maskViewLayerIndex: number | null;
  readonly previewRank: 'auto' | DetailRank;
  readonly previewStage: PreviewStage;
  readonly keymap: KeymapScheme;
  readonly showSockets: boolean;

  // Modals & Sandbox Test Play (Q9 & Q10)
  readonly testPlayActive: boolean;
  readonly testPlayBeamMode: 'extract' | 'apply' | 'sculpt' | 'seal';
  readonly testPlayRoverSpawned: boolean;
  readonly newPlanetModalOpen: boolean;
  readonly sporeCardModalOpen: boolean;
  readonly lastExportedSporeCard: {
    readonly payload: SporeCardPayload;
    readonly pngBytes: Uint8Array;
  } | null;

  // Audio Lab state (Workspace 4)
  readonly audioSelectedStemId: string;
  readonly audioAuditionStage: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  readonly audioMotorRpm: number;
  readonly audioBitCrushEnabled: boolean;

  // Validation & Staged Changes
  readonly validationIssues: readonly Issue[];
  readonly stagedChanges: readonly StagedChangeEntry[];
}

export const QUICK_MESHOP_PRESETS: Readonly<Record<QuickMeshOpPreset, OpRef>> = Object.freeze({
  'smooth': { op: 'smooth-taubin', params: { iterations: 6, lambda: 0.5, mu: -0.53 } },
  'chamfer-45': { op: 'chamfer-hard-edges', params: { width: 0.015, angleDeg: 35 } },
  'recessed-seam': { op: 'inset-outset-faces', params: { margin: 0.03, depth: -0.012 } },
  'funnel-taper': { op: 'taper-flare', params: { topScale: 1.25, bottomScale: 0.85, bulge: 0.0 } },
  'stretch-span': { op: 'extender-mid-slice', params: { axis: 0, deltaM: 0.25 } },
  'edge-wear': { op: 'surface-edge-wear-ao', params: { bandWidthM: 0.025, cavityWidthM: 0.035 } },
});

const DEFAULT_LOGIC_GRAPH: WireGraph = {
  nodes: [
    { id: 'proximity-sensor', inputs: [], outputs: ['detected'] },
    { id: 'power-relay', inputs: ['trigger'], outputs: ['energized'] },
    { id: 'stargate-iris', inputs: ['openSignal'], outputs: ['locked'] },
    { id: 'perimeter-turret', inputs: ['power', 'targetAlert'], outputs: ['firing'] },
  ],
  wires: [
    { from: { node: 'proximity-sensor', port: 'detected' }, to: { node: 'stargate-iris', port: 'openSignal' } },
    { from: { node: 'power-relay', port: 'energized' }, to: { node: 'perimeter-turret', port: 'power' } },
  ],
};

export const INITIAL_WORLDS: Readonly<Record<string, StudioWorldSpec>> = Object.freeze({
  'world:campaign-moon': {
    id: 'world:campaign-moon',
    name: 'Campaign: Moon Outpost',
    isCampaign: true,
    seed: 1042,
    biome: 'lunar-basalt',
    floats: { pxd: 48, vtx: 42, lx: 38, aq: 20 },
    sunElevationDeg: 22,
    sunAzimuthDeg: 35,
    skyTurbidity: 0.25,
    stargateAddress: computeStargateAddress('world:campaign-moon:1042'),
    stargateAccess: 'open',
    placements: [
      { instanceId: 'inst-stargate', kitId: 'kit:stargate', label: 'Moon Twin Gate', position: [0, 0, -6], rotationYDeg: 0, grounded: true },
      { instanceId: 'inst-mill', kitId: 'kit:texture-mill', label: 'Texture Mill V2', position: [-4.5, 0, 0], rotationYDeg: 0, grounded: true },
      { instanceId: 'inst-press', kitId: 'kit:shape-press', label: 'Shape Press V2', position: [4.5, 0, 0], rotationYDeg: 0, grounded: true },
      { instanceId: 'inst-drill', kitId: 'kit:rock-drill', label: 'Rock Drill V2', position: [-9.0, 0, 4.0], rotationYDeg: 45, grounded: true },
      { instanceId: 'inst-pylon', kitId: 'kit:relay-pylon', label: 'Relay Pylon #1', position: [0, 0, 5.5], rotationYDeg: 0, grounded: true },
      { instanceId: 'inst-rover', kitId: 'kit:rover-scout', label: 'Modular Scout Rover', position: [5.5, 0, 6.0], rotationYDeg: -30, grounded: true },
    ],
    logicGraph: DEFAULT_LOGIC_GRAPH,
  },
  'world:campaign-earth-lab': {
    id: 'world:campaign-earth-lab',
    name: 'Campaign: Earth Arrival Sector',
    isCampaign: true,
    seed: 2001,
    biome: 'terran-forest',
    floats: { pxd: 85, vtx: 85, lx: 80, aq: 65 },
    sunElevationDeg: 28,
    sunAzimuthDeg: 50,
    skyTurbidity: 0.4,
    stargateAddress: computeStargateAddress('world:campaign-earth-lab:2001'),
    stargateAccess: 'code-only',
    placements: [
      { instanceId: 'lab-stargate', kitId: 'kit:stargate', label: 'Freestanding Lab Gate', position: [3.0, 0, -2.5], rotationYDeg: 0, grounded: true },
      { instanceId: 'lab-cap-bank', kitId: 'kit:capacitor-bank', label: 'Power Wall Capacitor Bank', position: [5.5, 0, -5.0], rotationYDeg: 0, grounded: true },
      { instanceId: 'lab-water-maker', kitId: 'kit:water-maker', label: 'Hydro Condenser Unit', position: [-4.0, 0, -3.0], rotationYDeg: 90, grounded: true },
    ],
    logicGraph: DEFAULT_LOGIC_GRAPH,
  },
  'world:planet-vulcan': {
    id: 'world:planet-vulcan',
    name: 'My Worlds: Planet Vulcan (Custom)',
    isCampaign: false,
    seed: 7749,
    biome: 'volcanic-crag',
    floats: { pxd: 62, vtx: 70, lx: 75, aq: 10 },
    sunElevationDeg: 16,
    sunAzimuthDeg: 110,
    skyTurbidity: 0.72,
    stargateAddress: computeStargateAddress('world:planet-vulcan:7749'),
    stargateAccess: 'open',
    placements: [
      { instanceId: 'vulcan-gate', kitId: 'kit:stargate', label: 'Vulcan Network Gate', position: [0, 0, 0], rotationYDeg: 0, grounded: true },
      { instanceId: 'vulcan-power', kitId: 'kit:power-unit', label: 'Geothermal Power Unit', position: [4.5, 0, -2.0], rotationYDeg: 0, grounded: true },
    ],
    logicGraph: DEFAULT_LOGIC_GRAPH,
  },
});

export interface StudioStore {
  getSnapshot(): StudioState;
  subscribe(listener: () => void): () => void;

  // Q1 Breadcrumb & Q3 5-Rung Hierarchy
  getBreadcrumb(): StudioBreadcrumb;
  setActiveWorkspace(ws: StudioWorkspaceId): void;
  setActiveInspectorTab(tab: CreativeInspectorTabId): void;
  setActiveRung(rung: PresetRung): void;

  // Q2 World Switcher & Loop B ("Genesis of a New Planet")
  selectWorld(worldId: string): void;
  setNewPlanetModalOpen(open: boolean): void;
  createNewPlanet(input: {
    readonly name: string;
    readonly seed: number;
    readonly biome: BiomeFormulaId;
    readonly floats: { readonly pxd: number; readonly vtx: number; readonly lx: number; readonly aq: number };
    readonly stargateAccess: StargateAccessMode;
  }): string;
  updateActiveWorldLook(patch: Partial<Pick<StudioWorldSpec, 'floats' | 'sunElevationDeg' | 'sunAzimuthDeg' | 'skyTurbidity' | 'biome' | 'stargateAccess'>>): void;
  placeKitInActiveWorld(kitId: string, position?: readonly [number, number, number], rotationYDeg?: number): void;
  moveWorldPlacement(instanceId: string, position: readonly [number, number, number], rotationYDeg?: number): void;
  removeWorldPlacement(instanceId: string): void;
  autoGroundWorldPlacements(): void;

  // Loop A ("Tune & Mod the Example Game") Selection & Viewport
  selectKit(kitId: string): void;
  selectPartAndSlot(partPath: string | null, partId: string | null, slotKey: string | null): void;
  setSlotAssignScope(scope: 'part-override' | 'kit-slot'): void;
  selectSocketPin(pinId: string | null): void;
  setHoveredMaterial(matId: string | null): void;
  setActiveLayerIndex(index: number): void;
  setActiveTileId(tileId: string): void;
  setViewportMode(mode: ViewportMode, maskLayerIndex?: number | null): void;
  setPreviewRank(rank: 'auto' | DetailRank): void;
  setPreviewStage(stage: PreviewStage): void;
  setKeymap(keymap: KeymapScheme): void;
  setShowSockets(show: boolean): void;
  applyToCampaign(): StagedChangeEntry;

  // Pillar 1 & 3: Material, Layer Stack & TexGraph Actions
  getMaterialSlotsForActiveKit(): DiscoveredMaterialSlot[];
  getEffectiveMaterialSpec(matId: string): MaterialSpec;
  assignSlotMaterial(slotKey: string, matId: string, scope?: 'part-override' | 'kit-slot'): void;
  applySolventToActiveKit(partPath?: string | null): void;
  setMaterialPaint(paintIndex: 0 | 1, hex: string): void;
  setMaterialAge(age: number): void;
  updateBaseSurface(patch: Partial<SurfaceSpec>): void;
  addLayerFromShelf(layerPresetId: string): void;
  removeLayer(layerIndex: number): void;
  moveLayer(fromIndex: number, toIndex: number): void;
  toggleLayerVisible(layerIndex: number): void;
  updateLayer(layerIndex: number, patch: Partial<LayerSpec>): void;
  toggleLayerChannelWrite(layerIndex: number, channel: ChannelGroup): void;
  updateLayerSurface(layerIndex: number, patch: Partial<SurfaceSpec>): void;
  updateLayerMask(layerIndex: number, patch: Partial<MaskSpec>): void;
  setLayerMaskInputs(layerIndex: number, inputs: readonly MaskInput[]): void;
  updateTexGraph(tileId: string, graph: TexGraph): { ok: boolean; errors: string[] };

  // Pillar 2: Kit Assembler, Socket Snapping & @hm/meshops Actions
  attachPartToSocket(parentChildIndex: number, socketName: string, genOrPartId: string, key?: string): void;
  addSocketToPart(partId: string, socketName: string, socketDef: SocketDef): void;
  updatePlacement(childIndex: number, patch: Partial<Placement>): void;
  removePlacement(childIndex: number): void;
  autoFixGroundingIssues(): void;
  updatePartParam(partId: string, paramKey: string, value: number): void;
  applyQuickMeshOp(partId: string, preset: QuickMeshOpPreset): void;
  setPartMeshOps(partId: string, ops: readonly OpRef[]): void;

  // Q8: @hm/wiregraph Logic & Triggers Actions
  addLogicNode(id: string, inputs: readonly string[], outputs: readonly string[]): void;
  connectLogicWire(from: End, to: End): void;
  disconnectLogicWire(from: End, to: End): void;
  getLogicDiagnostics(): {
    readonly problems: readonly string[];
    readonly order: readonly string[] | null;
    readonly layout: ReturnType<typeof layoutWireGraph>;
  };

  // Q9: [▶ Test Play in Sandbox]
  enterTestPlaySandbox(): void;
  exitTestPlaySandbox(): void;
  setTestPlayBeamMode(mode: 'extract' | 'apply' | 'sculpt' | 'seal'): void;
  toggleTestPlayRover(): void;

  // Q10: [Export Spore Card] & [Import Spore Card]
  setSporeCardModalOpen(open: boolean): void;
  exportSporeCard(kind?: 'world' | 'machine-kit' | 'material'): {
    readonly payload: SporeCardPayload;
    readonly pngBytes: Uint8Array;
  };
  importSporeCard(pngBytes: Uint8Array): SporeCardPayload | null;

  // Workspace 4: Audio Lab Actions
  setAudioStem(stemId: string): void;
  setAudioAuditionStage(stage: 0 | 1 | 2 | 3 | 4 | 5 | 6): void;
  setAudioMotorRpm(rpm: number): void;
  setAudioBitCrushEnabled(enabled: boolean): void;

  // Undo / Redo / Persistence
  canUndo(): boolean;
  canRedo(): boolean;
  undo(): void;
  redo(): void;
  clearStagedChanges(): void;
}

export function createStudioStore(
  customKits?: Readonly<Record<string, { readonly kit: Kit; readonly rootPreset: string; readonly label?: string }>>,
  initialActiveKitId = 'kit:texture-mill',
): StudioStore {
  const defaultKits: Record<string, { readonly kit: Kit; readonly rootPreset: string; readonly label: string }> = {};
  for (const [id, entry] of Object.entries(STUDIO_KIT_REGISTRY)) {
    defaultKits[id] = { kit: entry.kit, rootPreset: entry.rootPreset, label: entry.label };
  }
  if (customKits) {
    for (const [id, entry] of Object.entries(customKits)) {
      defaultKits[id] = {
        kit: entry.kit,
        rootPreset: entry.rootPreset,
        label: entry.label ?? STUDIO_KIT_REGISTRY[id]?.label ?? id,
      };
    }
  }

  const firstKitId = defaultKits[initialActiveKitId] ? initialActiveKitId : Object.keys(defaultKits)[0]!;
  const entry0 = defaultKits[firstKitId]!;
  const slots0 = extractMaterialSlots(entry0.kit, entry0.rootPreset);
  const firstSlot = slots0[0]?.slotName ?? null;
  const firstMat = slots0[0]?.materialId ?? 'mat:field-worn-hazard';

  let state: StudioState = {
    activeWorkspace: 'creative-suite',
    activeInspectorTab: 'material-layers',
    activeRung: 4,
    worlds: { ...INITIAL_WORLDS },
    activeWorldId: 'world:campaign-moon',
    kits: defaultKits,
    materials: { ...MATERIAL_SHELF },
    tiles: { ...TILE_LIBRARY },
    overridesByKit: {},
    activeKitId: firstKitId,
    activePartPath: null,
    activePartId: null,
    activeSlotKey: firstSlot,
    slotAssignScope: 'kit-slot',
    activeSocketPinId: null,
    activeMaterialId: firstMat.startsWith('mat:') ? firstMat : 'mat:field-worn-hazard',
    hoveredMaterialId: null,
    activeLayerIndex: 0,
    activeTileId: 'brushed-metal',
    viewportMode: 'lit',
    maskViewLayerIndex: null,
    previewRank: 'auto',
    previewStage: 'lab-neutral',
    keymap: 'setmix-wer',
    showSockets: true,
    testPlayActive: false,
    testPlayBeamMode: 'apply',
    testPlayRoverSpawned: false,
    newPlanetModalOpen: false,
    sporeCardModalOpen: false,
    lastExportedSporeCard: null,
    audioSelectedStemId: 'stem:mill-grinder',
    audioAuditionStage: 4,
    audioMotorRpm: 1200,
    audioBitCrushEnabled: false,
    validationIssues: validate(entry0.kit, entry0.rootPreset),
    stagedChanges: [],
  };

  const past: StudioState[] = [];
  const future: StudioState[] = [];
  const listeners = new Set<() => void>();

  const emit = (): void => {
    for (const fn of listeners) fn();
  };

  const stageChange = (
    changes: readonly StagedChangeEntry[],
    entry: StagedChangeEntry,
  ): readonly StagedChangeEntry[] => {
    const filtered = changes.filter((c) => !(c.category === entry.category && c.targetId === entry.targetId));
    return [...filtered, entry];
  };

  const commit = (next: StudioState, recordUndo = true): void => {
    if (recordUndo) {
      past.push(state);
      if (past.length > 64) past.shift();
      future.length = 0;
    }
    state = next;
    emit();
  };

  const recomputeValidation = (
    kits: StudioState['kits'],
    kitId: string,
    overridesByKit: StudioState['overridesByKit'],
  ): readonly Issue[] => {
    const kEntry = kits[kitId];
    if (!kEntry) return [];
    const ov = overridesByKit[kitId];
    return validate(kEntry.kit, kEntry.rootPreset, ov ? { overrides: ov } : {});
  };

  const resolveMatSpec = (matId: string): MaterialSpec => {
    const norm = matId.startsWith('mat:') ? matId : `mat:${matId}`;
    return (
      state.materials[norm] ??
      resolveMatPreset(norm) ??
      state.materials['mat:field-worn-hazard']!
    );
  };

  const mutateActiveMaterial = (
    summary: string,
    updater: (spec: MaterialSpec) => MaterialSpec,
  ): void => {
    const matId = state.activeMaterialId;
    const current = resolveMatSpec(matId);
    const updated = updater(current);
    const nextMaterials = { ...state.materials, [matId]: updated };
    const cleanName = matId.replace(/^mat:/, '');
    const staged = stageChange(state.stagedChanges, {
      id: `mat:${cleanName}`,
      category: 'material',
      targetId: matId,
      summary,
      diskPath: `studio-data/materials/${cleanName}.json`,
      payloadJson: JSON.stringify(updated, null, 2),
    });
    commit({
      ...state,
      activeRung: 2,
      materials: nextMaterials,
      stagedChanges: staged,
    });
  };

  const mutateActiveKit = (
    summary: string,
    updater: (kit: Kit, rootPreset: string) => Kit,
    rung: PresetRung = 4,
  ): void => {
    const entry = state.kits[state.activeKitId];
    if (!entry) return;
    const nextKit = updater(entry.kit, entry.rootPreset);
    const nextKits = {
      ...state.kits,
      [state.activeKitId]: { ...entry, kit: nextKit },
    };
    const cleanId = state.activeKitId.replace(/^kit:/, '');
    const staged = stageChange(state.stagedChanges, {
      id: `kit:${cleanId}`,
      category: 'kit-assembly',
      targetId: state.activeKitId,
      summary,
      diskPath: `studio-data/kits/${cleanId}.json`,
      payloadJson: JSON.stringify(nextKit, null, 2),
    });
    commit({
      ...state,
      activeRung: rung,
      kits: nextKits,
      validationIssues: recomputeValidation(nextKits, state.activeKitId, state.overridesByKit),
      stagedChanges: staged,
    });
  };

  const mutateActiveWorld = (
    summary: string,
    updater: (w: StudioWorldSpec) => StudioWorldSpec,
  ): void => {
    const w = state.worlds[state.activeWorldId];
    if (!w) return;
    const nextWorld = updater(w);
    const nextWorlds = { ...state.worlds, [state.activeWorldId]: nextWorld };
    const cleanId = state.activeWorldId.replace(/^world:/, '');
    const staged = stageChange(state.stagedChanges, {
      id: `world:${cleanId}`,
      category: 'world-spec',
      targetId: state.activeWorldId,
      summary,
      diskPath: `studio-data/worlds/${cleanId}.json`,
      payloadJson: JSON.stringify(nextWorld, null, 2),
    });
    commit({
      ...state,
      activeRung: 5,
      worlds: nextWorlds,
      stagedChanges: staged,
    });
  };

  return {
    getSnapshot: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    getBreadcrumb() {
      const world = state.worlds[state.activeWorldId];
      const kitEntry = state.kits[state.activeKitId];
      const matSpec = resolveMatSpec(state.activeMaterialId);
      const layer =
        state.activeLayerIndex >= 0 && state.activeLayerIndex < matSpec.layers.length
          ? matSpec.layers[state.activeLayerIndex]
          : null;

      const worldLabel = world ? world.name : 'Campaign Moon';
      const machineLabel = kitEntry ? kitEntry.label : state.activeKitId;
      const slotLabel = state.activeSlotKey ?? 'hull-steel';
      const detailLabel = layer
        ? `Layer ${state.activeLayerIndex + 1}: ${layer.name}`
        : `Base: ${matSpec.base.name}`;

      return {
        worldLabel,
        machineLabel,
        slotLabel,
        detailLabel,
        formatted: `[World: ${worldLabel}] > [Machine: ${machineLabel}] > [Slot: ${slotLabel}] > [${detailLabel}]`,
      };
    },

    setActiveWorkspace(ws) {
      const rungByWs: Readonly<Record<StudioWorkspaceId, PresetRung>> = {
        'creative-suite': 4,
        'look-lighting': 5,
        'scene-layout': 5,
        'audio-lab': 3,
      };
      commit({ ...state, activeWorkspace: ws, activeRung: rungByWs[ws] }, false);
    },

    setActiveInspectorTab(tab) {
      const rungByTab: Readonly<Record<CreativeInspectorTabId, PresetRung>> = {
        'material-layers': 2,
        'parts-assemblies': 4,
        'texgraph-uv': 1,
        'partgen-meshops': 1,
        'logic-triggers': 4,
      };
      commit({ ...state, activeInspectorTab: tab, activeRung: rungByTab[tab] }, false);
    },

    setActiveRung(rung) {
      commit({ ...state, activeRung: rung }, false);
    },

    selectWorld(worldId) {
      const w = state.worlds[worldId];
      if (!w) return;
      const firstPlacedKitId = w.placements[0]?.kitId ?? state.activeKitId;
      const targetKitId = state.kits[firstPlacedKitId] ? firstPlacedKitId : state.activeKitId;
      commit(
        {
          ...state,
          activeWorldId: worldId,
          activeKitId: targetKitId,
          activeRung: 5,
          validationIssues: recomputeValidation(state.kits, targetKitId, state.overridesByKit),
        },
        false,
      );
    },

    setNewPlanetModalOpen(open) {
      commit({ ...state, newPlanetModalOpen: open }, false);
    },

    createNewPlanet(input) {
      const slug = input.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || `planet-${input.seed}`;
      const worldId = `world:${slug}`;
      const dialingAddress = computeStargateAddress(`${worldId}:${input.seed}:${input.biome}`);

      const newWorld: StudioWorldSpec = {
        id: worldId,
        name: `My Worlds: ${input.name}`,
        isCampaign: false,
        seed: input.seed,
        biome: input.biome,
        floats: { ...input.floats },
        sunElevationDeg: 24,
        sunAzimuthDeg: 45,
        skyTurbidity: 0.35,
        stargateAddress: dialingAddress,
        stargateAccess: input.stargateAccess,
        // Automatically ground the Network Stargate at the origin (Loop B Step 3)
        placements: [
          {
            instanceId: `${slug}-stargate`,
            kitId: 'kit:stargate',
            label: `${input.name} Network Stargate`,
            position: [0, 0, 0],
            rotationYDeg: 0,
            grounded: true,
          },
        ],
        logicGraph: DEFAULT_LOGIC_GRAPH,
      };

      const nextWorlds = { ...state.worlds, [worldId]: newWorld };
      const staged = stageChange(state.stagedChanges, {
        id: worldId,
        category: 'world-spec',
        targetId: worldId,
        summary: `Genesis of new planet '${input.name}' (${input.biome}, ${dialingAddress})`,
        diskPath: `studio-data/worlds/${slug}.json`,
        payloadJson: JSON.stringify(newWorld, null, 2),
      });

      commit({
        ...state,
        worlds: nextWorlds,
        activeWorldId: worldId,
        activeKitId: 'kit:stargate',
        activeRung: 5,
        newPlanetModalOpen: false,
        stagedChanges: staged,
      });
      return worldId;
    },

    updateActiveWorldLook(patch) {
      mutateActiveWorld(`Update Look & Atmosphere on ${state.activeWorldId}`, (w) => ({
        ...w,
        ...patch,
        floats: patch.floats ? { ...w.floats, ...patch.floats } : w.floats,
      }));
    },

    placeKitInActiveWorld(kitId, position = [0, 0, 0], rotationYDeg = 0) {
      const kitEntry = state.kits[kitId];
      if (!kitEntry) return;
      mutateActiveWorld(`Place '${kitEntry.label}' in ${state.activeWorldId}`, (w) => {
        const instanceId = `inst-${kitId.replace(/^kit:/, '')}-${w.placements.length + 1}`;
        const snappedPos: readonly [number, number, number] = [
          Number(position[0].toFixed(2)),
          0, // Auto-grounded at terrain surface y = 0
          Number(position[2].toFixed(2)),
        ];
        return {
          ...w,
          placements: [
            ...w.placements,
            {
              instanceId,
              kitId,
              label: `${kitEntry.label} #${w.placements.length + 1}`,
              position: snappedPos,
              rotationYDeg,
              grounded: true,
            },
          ],
        };
      });
    },

    moveWorldPlacement(instanceId, position, rotationYDeg) {
      mutateActiveWorld(`Move placement '${instanceId}' in ${state.activeWorldId}`, (w) => ({
        ...w,
        placements: w.placements.map((p) =>
          p.instanceId === instanceId
            ? {
                ...p,
                position,
                rotationYDeg: rotationYDeg ?? p.rotationYDeg,
                grounded: Math.abs(position[1]) <= 0.002,
              }
            : p,
        ),
      }));
    },

    removeWorldPlacement(instanceId) {
      mutateActiveWorld(`Remove placement '${instanceId}' from ${state.activeWorldId}`, (w) => ({
        ...w,
        placements: w.placements.filter((p) => p.instanceId !== instanceId),
      }));
    },

    autoGroundWorldPlacements() {
      mutateActiveWorld(`Auto-ground all placed machines on ${state.activeWorldId}`, (w) => ({
        ...w,
        placements: w.placements.map((p) => ({
          ...p,
          position: [p.position[0], 0, p.position[2]],
          grounded: true,
        })),
      }));
    },

    selectKit(kitId) {
      const entry = state.kits[kitId];
      if (!entry) return;
      const slots = extractMaterialSlots(entry.kit, entry.rootPreset, state.overridesByKit[kitId]);
      const firstSlot = slots[0]?.slotName ?? null;
      const firstMat = slots[0]?.materialId ?? 'mat:field-worn-hazard';
      commit(
        {
          ...state,
          activeKitId: kitId,
          activePartPath: null,
          activePartId: null,
          activeSlotKey: firstSlot,
          activeSocketPinId: null,
          activeMaterialId: firstMat.startsWith('mat:') ? firstMat : state.activeMaterialId,
          validationIssues: recomputeValidation(state.kits, kitId, state.overridesByKit),
        },
        false,
      );
    },

    selectPartAndSlot(partPath, partId, slotKey) {
      let nextMatId = state.activeMaterialId;
      const entry = state.kits[state.activeKitId];
      if (entry && partId) {
        const pDef = entry.kit.parts[partId];
        const rawSlot = slotKey?.includes(':') ? slotKey.split(':')[1]! : slotKey;
        const ov = partPath ? state.overridesByKit[state.activeKitId]?.[partPath] : undefined;
        const resolvedMat =
          (rawSlot ? ov?.slotMaterials?.[rawSlot] : undefined) ??
          ov?.material ??
          (rawSlot ? pDef?.slotMaterials?.[rawSlot] : undefined) ??
          pDef?.material;
        if (resolvedMat && resolvedMat.startsWith('mat:')) {
          nextMatId = resolvedMat;
        }
      }
      commit(
        {
          ...state,
          activePartPath: partPath,
          activePartId: partId,
          activeSlotKey: slotKey,
          activeMaterialId: nextMatId,
        },
        false,
      );
    },

    setSlotAssignScope(scope) {
      commit({ ...state, slotAssignScope: scope }, false);
    },

    selectSocketPin(pinId) {
      commit({ ...state, activeSocketPinId: pinId }, false);
    },

    setHoveredMaterial(matId) {
      if (state.hoveredMaterialId === matId) return;
      commit({ ...state, hoveredMaterialId: matId }, false);
    },

    setActiveLayerIndex(index) {
      commit(
        {
          ...state,
          activeLayerIndex: index,
          maskViewLayerIndex: state.viewportMode === 'mask-bw' && index >= 0 ? index : state.maskViewLayerIndex,
        },
        false,
      );
    },

    setActiveTileId(tileId) {
      if (!state.tiles[tileId]) return;
      commit({ ...state, activeTileId: tileId, activeRung: 1 }, false);
    },

    setViewportMode(mode, maskLayerIndex) {
      const mIdx =
        mode === 'mask-bw'
          ? (maskLayerIndex ?? (state.activeLayerIndex >= 0 ? state.activeLayerIndex : 0))
          : null;
      commit(
        {
          ...state,
          viewportMode: mode,
          maskViewLayerIndex: mIdx,
        },
        false,
      );
    },

    setPreviewRank(rank) {
      commit({ ...state, previewRank: rank }, false);
    },

    setPreviewStage(stage) {
      commit({ ...state, previewStage: stage }, false);
    },

    setKeymap(keymap) {
      commit({ ...state, keymap }, false);
    },

    setShowSockets(show) {
      commit({ ...state, showSockets: show }, false);
    },

    applyToCampaign() {
      const entry = state.kits[state.activeKitId]!;
      const cleanId = state.activeKitId.replace(/^kit:/, '');
      const payload = {
        kitId: state.activeKitId,
        worldId: state.activeWorldId,
        kit: entry.kit,
        overrides: state.overridesByKit[state.activeKitId] ?? {},
        activeMaterialId: state.activeMaterialId,
        activeMaterialSpec: resolveMatSpec(state.activeMaterialId),
      };
      const changeEntry: StagedChangeEntry = {
        id: `campaign:${cleanId}`,
        category: 'campaign-apply',
        targetId: state.activeKitId,
        summary: `Apply '${entry.label}' polish to active Campaign profile`,
        diskPath: `studio-data/campaign/${cleanId}.json`,
        payloadJson: JSON.stringify(payload, null, 2),
      };
      commit(
        {
          ...state,
          stagedChanges: stageChange(state.stagedChanges, changeEntry),
        },
        false,
      );
      return changeEntry;
    },

    getMaterialSlotsForActiveKit() {
      const entry = state.kits[state.activeKitId];
      if (!entry) return [];
      return extractMaterialSlots(entry.kit, entry.rootPreset, state.overridesByKit[state.activeKitId]);
    },

    getEffectiveMaterialSpec(matId) {
      if (state.hoveredMaterialId && matId === state.activeMaterialId) {
        return resolveMatSpec(state.hoveredMaterialId);
      }
      return resolveMatSpec(matId);
    },

    assignSlotMaterial(slotKey, matId, explicitScope) {
      const scope = explicitScope ?? state.slotAssignScope;
      const entry = state.kits[state.activeKitId];
      if (!entry) return;
      const [partIdFromKey, rawSlot = 'default'] = slotKey.includes(':')
        ? (slotKey.split(':') as [string, string])
        : [state.activePartId ?? '', slotKey];

      if (scope === 'part-override' && state.activePartPath) {
        const kitOv = { ...(state.overridesByKit[state.activeKitId] ?? {}) };
        const prev = kitOv[state.activePartPath] ?? {};
        const nextSlotMats =
          rawSlot === 'default'
            ? prev.slotMaterials
            : { ...(prev.slotMaterials ?? {}), [rawSlot]: matId };
        kitOv[state.activePartPath] = {
          ...prev,
          ...(rawSlot === 'default' ? { material: matId } : {}),
          ...(nextSlotMats ? { slotMaterials: nextSlotMats } : {}),
        };
        const nextOverridesByKit = { ...state.overridesByKit, [state.activeKitId]: kitOv };
        const cleanId = state.activeKitId.replace(/^kit:/, '');
        const staged = stageChange(state.stagedChanges, {
          id: `ov:${cleanId}`,
          category: 'part-override',
          targetId: state.activeKitId,
          summary: `Assign ${matId} to ${state.activePartPath} (${rawSlot})`,
          diskPath: `studio-data/overrides/${cleanId}.json`,
          payloadJson: JSON.stringify(kitOv, null, 2),
        });
        commit({
          ...state,
          overridesByKit: nextOverridesByKit,
          activeSlotKey: slotKey,
          activeMaterialId: matId.startsWith('mat:') ? matId : state.activeMaterialId,
          hoveredMaterialId: null,
          stagedChanges: staged,
        });
        return;
      }

      mutateActiveKit(`Bind ${matId} to slot ${slotKey} on ${state.activeKitId}`, (kit) => {
        const targetPartId = partIdFromKey || state.activePartId;
        if (!targetPartId || !kit.parts[targetPartId]) return kit;
        const pDef = kit.parts[targetPartId]!;
        const updatedPart: PartDef =
          rawSlot === 'default'
            ? { ...pDef, material: matId }
            : {
                ...pDef,
                slotMaterials: { ...(pDef.slotMaterials ?? {}), [rawSlot]: matId },
              };
        return {
          ...kit,
          parts: { ...kit.parts, [targetPartId]: updatedPart },
        };
      });
      if (matId.startsWith('mat:')) {
        state = { ...state, activeSlotKey: slotKey, activeMaterialId: matId, hoveredMaterialId: null };
        emit();
      }
    },

    applySolventToActiveKit(partPath) {
      mutateActiveMaterial(`Apply solvent (reset age to 0.0) on ${state.activeMaterialId}`, (spec) => ({
        ...spec,
        age: 0,
      }));
      if (partPath && state.overridesByKit[state.activeKitId]?.[partPath]) {
        const kitOv = { ...state.overridesByKit[state.activeKitId]! };
        delete kitOv[partPath];
        commit({
          ...state,
          overridesByKit: { ...state.overridesByKit, [state.activeKitId]: kitOv },
        });
      }
    },

    setMaterialPaint(paintIndex, hex) {
      mutateActiveMaterial(`Set paint${paintIndex + 1} to ${hex} on ${state.activeMaterialId}`, (spec) => {
        const nextPaint: readonly [string, string] =
          paintIndex === 0 ? [hex, spec.paint[1]] : [spec.paint[0], hex];
        return { ...spec, paint: nextPaint };
      });
    },

    setMaterialAge(age) {
      const clamped = Math.max(0, Math.min(1, Number(age.toFixed(3))));
      mutateActiveMaterial(`Set weathering age to ${clamped} on ${state.activeMaterialId}`, (spec) => ({
        ...spec,
        age: clamped,
      }));
    },

    updateBaseSurface(patch) {
      mutateActiveMaterial(`Update base surface on ${state.activeMaterialId}`, (spec) => ({
        ...spec,
        base: { ...spec.base, ...patch },
      }));
    },

    addLayerFromShelf(layerPresetId) {
      const template = LAYER_SHELF[layerPresetId];
      if (!template) return;
      mutateActiveMaterial(`Add layer '${template.name}' to ${state.activeMaterialId}`, (spec) => {
        if (spec.layers.length >= 6) return spec;
        const writes = template.writes.includes('coat')
          ? template.writes
          : ([...template.writes, 'coat', 'aniso'] as ChannelGroup[]);
        const newLayer: LayerSpec = { ...template, writes };
        return {
          ...spec,
          layers: [...spec.layers, newLayer],
        };
      });
    },

    removeLayer(layerIndex) {
      mutateActiveMaterial(`Remove layer #${layerIndex} from ${state.activeMaterialId}`, (spec) => ({
        ...spec,
        layers: spec.layers.filter((_, i) => i !== layerIndex),
      }));
    },

    moveLayer(fromIndex, toIndex) {
      mutateActiveMaterial(`Move layer ${fromIndex} -> ${toIndex} on ${state.activeMaterialId}`, (spec) => {
        if (
          fromIndex < 0 ||
          fromIndex >= spec.layers.length ||
          toIndex < 0 ||
          toIndex >= spec.layers.length ||
          fromIndex === toIndex
        ) {
          return spec;
        }
        const copy = [...spec.layers];
        const [moved] = copy.splice(fromIndex, 1);
        copy.splice(toIndex, 0, moved!);
        return { ...spec, layers: copy };
      });
    },

    toggleLayerVisible(layerIndex) {
      mutateActiveMaterial(`Toggle layer #${layerIndex} visibility on ${state.activeMaterialId}`, (spec) => ({
        ...spec,
        layers: spec.layers.map((l, i) => (i === layerIndex ? { ...l, visible: !l.visible } : l)),
      }));
    },

    updateLayer(layerIndex, patch) {
      mutateActiveMaterial(`Update layer #${layerIndex} on ${state.activeMaterialId}`, (spec) => ({
        ...spec,
        layers: spec.layers.map((l, i) => (i === layerIndex ? { ...l, ...patch } : l)),
      }));
    },

    toggleLayerChannelWrite(layerIndex, channel) {
      mutateActiveMaterial(`Toggle channel '${channel}' on layer #${layerIndex}`, (spec) => ({
        ...spec,
        layers: spec.layers.map((l, i) => {
          if (i !== layerIndex) return l;
          const has = l.writes.includes(channel);
          const writes = has ? l.writes.filter((c) => c !== channel) : [...l.writes, channel];
          return { ...l, writes };
        }),
      }));
    },

    updateLayerSurface(layerIndex, patch) {
      mutateActiveMaterial(`Update layer #${layerIndex} surface on ${state.activeMaterialId}`, (spec) => ({
        ...spec,
        layers: spec.layers.map((l, i) =>
          i === layerIndex ? { ...l, surface: { ...l.surface, ...patch } } : l,
        ),
      }));
    },

    updateLayerMask(layerIndex, patch) {
      mutateActiveMaterial(`Update layer #${layerIndex} mask on ${state.activeMaterialId}`, (spec) => ({
        ...spec,
        layers: spec.layers.map((l, i) =>
          i === layerIndex ? { ...l, mask: { ...l.mask, ...patch } } : l,
        ),
      }));
    },

    setLayerMaskInputs(layerIndex, inputs) {
      mutateActiveMaterial(`Update layer #${layerIndex} mask inputs`, (spec) => ({
        ...spec,
        layers: spec.layers.map((l, i) =>
          i === layerIndex ? { ...l, mask: { ...l.mask, inputs: inputs.slice(0, 4) } } : l,
        ),
      }));
    },

    updateTexGraph(tileId, graph) {
      const v = validateGraph(graph);
      if (!v.ok) return v;
      const nextTiles = { ...state.tiles, [tileId]: graph };
      const staged = stageChange(state.stagedChanges, {
        id: `tile:${tileId}`,
        category: 'tile',
        targetId: tileId,
        summary: `Update procedural TexGraph tile '${tileId}' (${graph.nodes.length} nodes)`,
        diskPath: `studio-data/tiles/${tileId}.json`,
        payloadJson: JSON.stringify(graph, null, 2),
      });
      commit({
        ...state,
        activeRung: 1,
        tiles: nextTiles,
        activeTileId: tileId,
        stagedChanges: staged,
      });
      return { ok: true, errors: [] };
    },

    attachPartToSocket(parentChildIndex, socketName, genOrPartId, key) {
      mutateActiveKit(
        `Attach '${genOrPartId}' to socket '${socketName}' on child #${parentChildIndex}`,
        (kit, rootPreset) => {
          const asm = kit.assemblies[rootPreset];
          if (!asm) return kit;

          let partRef = genOrPartId;
          let nextParts = kit.parts;

          if (!kit.parts[partRef] && !kit.assemblies[partRef] && GENERATORS[genOrPartId]) {
            const gen = GENERATORS[genOrPartId]!;
            const defaults = resolveParams(gen.params, {});
            partRef = `part-${genOrPartId}-${asm.children.length}`;
            nextParts = {
              ...kit.parts,
              [partRef]: {
                source: { kind: 'param' as const, gen: genOrPartId, params: defaults },
                material: 'mat:workshop-steel',
                rank: 1,
              },
            };
          }

          const newPlacement: Placement = {
            ref: partRef,
            key: key ?? `${partRef}#${asm.children.length}`,
            ...(parentChildIndex >= 0
              ? { on: { child: parentChildIndex, socket: socketName } }
              : {}),
            at: [0, 0, 0],
          };

          const updatedAsm: AssemblyDef = {
            ...asm,
            children: [...asm.children, newPlacement],
          };

          return {
            ...kit,
            parts: nextParts,
            assemblies: {
              ...kit.assemblies,
              [rootPreset]: updatedAsm,
            },
          };
        },
      );
    },

    addSocketToPart(partId, socketName, socketDef) {
      mutateActiveKit(`Add socket '${socketName}' to part '${partId}'`, (kit) => {
        const pDef = kit.parts[partId];
        if (!pDef) return kit;
        return {
          ...kit,
          parts: {
            ...kit.parts,
            [partId]: {
              ...pDef,
              sockets: {
                ...(pDef.sockets ?? {}),
                [socketName]: socketDef,
              },
            },
          },
        };
      });
    },

    updatePlacement(childIndex, patch) {
      mutateActiveKit(`Update placement #${childIndex}`, (kit, rootPreset) => {
        const asm = kit.assemblies[rootPreset];
        if (!asm || childIndex < 0 || childIndex >= asm.children.length) return kit;
        const children = asm.children.map((c, i) => (i === childIndex ? { ...c, ...patch } : c));
        return {
          ...kit,
          assemblies: {
            ...kit.assemblies,
            [rootPreset]: { ...asm, children },
          },
        };
      });
    },

    removePlacement(childIndex) {
      mutateActiveKit(`Remove placement #${childIndex}`, (kit, rootPreset) => {
        const asm = kit.assemblies[rootPreset];
        if (!asm || childIndex < 0 || childIndex >= asm.children.length) return kit;
        const children = asm.children.filter((_, i) => i !== childIndex);
        return {
          ...kit,
          assemblies: {
            ...kit.assemblies,
            [rootPreset]: { ...asm, children },
          },
        };
      });
    },

    autoFixGroundingIssues() {
      mutateActiveKit(`Auto-snap floating/below-ground parts on ${state.activeKitId}`, (kit, rootPreset) =>
        autoSnapFloatingPlacements(kit, rootPreset),
      );
    },

    updatePartParam(partId, paramKey, value) {
      mutateActiveKit(
        `Set ${partId}.${paramKey} = ${value}`,
        (kit) => {
          const pDef = kit.parts[partId];
          if (!pDef || pDef.source.kind !== 'param') return kit;
          const gen = GENERATORS[pDef.source.gen];
          const nextRaw = { ...pDef.source.params, [paramKey]: value };
          const clamped = gen ? resolveParams(gen.params, nextRaw) : nextRaw;
          return {
            ...kit,
            parts: {
              ...kit.parts,
              [partId]: {
                ...pDef,
                source: {
                  ...pDef.source,
                  params: clamped,
                },
              },
            },
          };
        },
        1,
      );
    },

    applyQuickMeshOp(partId, preset) {
      const opRef = QUICK_MESHOP_PRESETS[preset];
      if (!opRef) return;
      mutateActiveKit(
        `Apply '${preset}' operator preset to ${partId}`,
        (kit) => {
          const pDef = kit.parts[partId];
          if (!pDef || pDef.source.kind !== 'param') return kit;
          const existingOps = pDef.source.ops ?? [];
          const filtered = existingOps.filter((o) => o.op !== opRef.op);
          return {
            ...kit,
            parts: {
              ...kit.parts,
              [partId]: {
                ...pDef,
                source: {
                  ...pDef.source,
                  ops: [...filtered, opRef],
                },
              },
            },
          };
        },
        2,
      );
    },

    setPartMeshOps(partId, ops) {
      mutateActiveKit(
        `Update @hm/meshops stack on ${partId}`,
        (kit) => {
          const pDef = kit.parts[partId];
          if (!pDef || pDef.source.kind !== 'param') return kit;
          return {
            ...kit,
            parts: {
              ...kit.parts,
              [partId]: {
                ...pDef,
                source: {
                  ...pDef.source,
                  ops: [...ops],
                },
              },
            },
          };
        },
        2,
      );
    },

    // Q8: @hm/wiregraph Logic & Triggers
    addLogicNode(id, inputs, outputs) {
      mutateActiveWorld(`Add logic node '${id}' to ${state.activeWorldId}`, (w) => {
        if (w.logicGraph.nodes.some((n) => n.id === id)) return w;
        return {
          ...w,
          logicGraph: {
            ...w.logicGraph,
            nodes: [...w.logicGraph.nodes, { id, inputs: [...inputs], outputs: [...outputs] }],
          },
        };
      });
    },

    connectLogicWire(from, to) {
      mutateActiveWorld(`Wire ${from.node}.${from.port} -> ${to.node}.${to.port}`, (w) => ({
        ...w,
        logicGraph: connect(w.logicGraph, from, to),
      }));
    },

    disconnectLogicWire(from, to) {
      mutateActiveWorld(`Disconnect ${from.node}.${from.port} -> ${to.node}.${to.port}`, (w) => ({
        ...w,
        logicGraph: { nodes: w.logicGraph.nodes, wires: w.logicGraph.wires.filter((wire) => !(wire.from.node === from.node && wire.from.port === from.port && wire.to.node === to.node && wire.to.port === to.port)) },
      }));
    },

    getLogicDiagnostics() {
      const w = state.worlds[state.activeWorldId]!;
      return {
        problems: problems(w.logicGraph),
        order: layersWireGraph(w.logicGraph).flat(),
        layout: layoutWireGraph(w.logicGraph),
      };
    },

    // Q9: [▶ Test Play in Sandbox]
    enterTestPlaySandbox() {
      commit({ ...state, testPlayActive: true }, false);
    },

    exitTestPlaySandbox() {
      commit({ ...state, testPlayActive: false }, false);
    },

    setTestPlayBeamMode(mode) {
      commit({ ...state, testPlayBeamMode: mode }, false);
    },

    toggleTestPlayRover() {
      commit({ ...state, testPlayRoverSpawned: !state.testPlayRoverSpawned }, false);
    },

    // Q10: [Export Spore Card] & [Import Spore Card]
    setSporeCardModalOpen(open) {
      commit({ ...state, sporeCardModalOpen: open }, false);
    },

    exportSporeCard(kind = 'world') {
      const w = state.worlds[state.activeWorldId]!;
      const kitEntry = state.kits[state.activeKitId]!;
      const payload: SporeCardPayload = {
        schema: 'fidelity.spore.v1',
        kind,
        title: kind === 'world' ? w.name : kitEntry.label,
        author: 'Studio Architect',
        dialingAddress: w.stargateAddress,
        stargateAccess: w.stargateAccess,
        world: {
          id: w.id,
          seed: w.seed,
          biome: w.biome,
          floats: w.floats,
          sunElevationDeg: w.sunElevationDeg,
          sunAzimuthDeg: w.sunAzimuthDeg,
          placements: w.placements,
        },
        activeKitId: state.activeKitId,
        activeMaterialId: state.activeMaterialId,
        anatomyAuditPassed: state.validationIssues.length === 0,
      };
      const pngBytes = encodeSporeCardPng(payload, 64, 64);
      const result = { payload, pngBytes };
      commit({ ...state, lastExportedSporeCard: result, sporeCardModalOpen: true }, false);
      return result;
    },

    importSporeCard(pngBytes) {
      const decoded = decodeSporeCardPng(pngBytes);
      if (!decoded) return null;

      let nextWorlds = state.worlds;
      let nextWorldId = state.activeWorldId;
      if (decoded.world) {
        const wSpec: StudioWorldSpec = {
          id: decoded.world.id,
          name: decoded.title,
          isCampaign: false,
          seed: decoded.world.seed,
          biome: decoded.world.biome,
          floats: decoded.world.floats,
          sunElevationDeg: decoded.world.sunElevationDeg,
          sunAzimuthDeg: decoded.world.sunAzimuthDeg,
          skyTurbidity: 0.35,
          stargateAddress: decoded.dialingAddress,
          stargateAccess: decoded.stargateAccess,
          placements: decoded.world.placements,
          logicGraph: DEFAULT_LOGIC_GRAPH,
        };
        nextWorlds = { ...state.worlds, [wSpec.id]: wSpec };
        nextWorldId = wSpec.id;
      }

      const nextKitId = state.kits[decoded.activeKitId] ? decoded.activeKitId : state.activeKitId;
      const nextMatId = state.materials[decoded.activeMaterialId]
        ? decoded.activeMaterialId
        : state.activeMaterialId;

      commit({
        ...state,
        worlds: nextWorlds,
        activeWorldId: nextWorldId,
        activeKitId: nextKitId,
        activeMaterialId: nextMatId,
        sporeCardModalOpen: false,
      });
      return decoded;
    },

    // Workspace 4: Audio Lab
    setAudioStem(stemId) {
      commit({ ...state, audioSelectedStemId: stemId, activeRung: 3 }, false);
    },

    setAudioAuditionStage(stage) {
      commit({ ...state, audioAuditionStage: stage, activeRung: 3 }, false);
    },

    setAudioMotorRpm(rpm) {
      commit({ ...state, audioMotorRpm: Math.max(200, Math.min(4800, rpm)), activeRung: 3 }, false);
    },

    setAudioBitCrushEnabled(enabled) {
      commit({ ...state, audioBitCrushEnabled: enabled, activeRung: 3 }, false);
    },

    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,

    undo() {
      const prev = past.pop();
      if (!prev) return;
      future.push(state);
      state = prev;
      emit();
    },

    redo() {
      const next = future.pop();
      if (!next) return;
      past.push(state);
      state = next;
      emit();
    },

    clearStagedChanges() {
      commit({ ...state, stagedChanges: [] }, false);
    },
  };
}
