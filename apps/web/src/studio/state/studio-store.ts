/**
 * @file apps/web/src/studio/state/studio-store.ts
 * STUDIO-44B & STUDIO-44D (Opus Core): Unified Studio Session Store, Undo/Redo Stack,
 * Live Material/Layer/Tile Binding, and Interactive `@hm/kitspec` + `@hm/meshops` Assembler Actions.
 *
 * Compatible with React 19 `useSyncExternalStore(store.subscribe, store.getSnapshot)`.
 * Pure TypeScript, zero DOM globals, deterministic.
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
import type { DiscoveredMaterialSlot } from '../viewport/raycast-picker';
import { extractMaterialSlots } from '../viewport/raycast-picker';
import { autoSnapFloatingPlacements } from '../viewport/socket-gizmos';


export type ViewportMode = 'lit' | 'mask-bw' | 'wireframe-ranks' | 'quad-4angle' | 'compare-legacy';
export type PreviewStage = 'lab-neutral' | 0 | 1 | 2 | 3 | 4;
export type KeymapScheme = 'setmix-wer' | 'blender-grs';
export type QuickMeshOpPreset =
  | 'smooth'
  | 'chamfer-45'
  | 'recessed-seam'
  | 'funnel-taper'
  | 'stretch-span'
  | 'edge-wear';

export interface StagedChangeEntry {
  readonly id: string;
  readonly category: 'material' | 'tile' | 'kit-assembly' | 'part-param' | 'part-override';
  readonly targetId: string;
  readonly summary: string;
  readonly diskPath: string;
  readonly payloadJson: string;
}

export interface StudioState {
  /** Active kits dictionary (e.g. 'kit:texture-mill', 'kit:capacitor-bank', 'kit:test-piece'). */
  readonly kits: Readonly<Record<string, { readonly kit: Kit; readonly rootPreset: string }>>;
  /** Active material shelf (combines canonical MATERIAL_SHELF + user-edited materials). */
  readonly materials: Readonly<Record<string, MaterialSpec>>;
  /** Active procedural tile library (combines canonical TILE_LIBRARY + user-edited TexGraphs). */
  readonly tiles: Readonly<Record<string, TexGraph>>;
  /** Per-kit instance overrides (simulates in-world Beam Apply / per-part customization). */
  readonly overridesByKit: Readonly<Record<string, Overrides>>;

  /** Selected kit ID in the viewport. */
  readonly activeKitId: string;
  /** Selected PlacedPart path in the active kit (null = root assembly selected). */
  readonly activePartPath: string | null;
  /** Selected PartDef ID in the active kit. */
  readonly activePartId: string | null;
  /** Selected material slot key on the active kit/part (e.g. 'body-carcass:body'). */
  readonly activeSlotKey: string | null;
  /** Selected socket pin ID in the 3D viewport (e.g. 'body-carcass#0::leftBay'). */
  readonly activeSocketPinId: string | null;

  /** Currently bound MaterialSpec ID for `activeSlotKey`. */
  readonly activeMaterialId: string;
  /** Non-destructive hover try-on MaterialSpec ID (when hovering a swatch in the shelf; null when not hovering). */
  readonly hoveredMaterialId: string | null;
  /** Selected layer index inside `activeMaterialId` (-1 = base SurfaceSpec, 0..5 = LayerSpec). */
  readonly activeLayerIndex: number;
  /** Selected TexGraph tile ID in the TexGraph Node Editor. */
  readonly activeTileId: string;

  /** Viewport rendering & inspection controls. */
  readonly viewportMode: ViewportMode;
  /** Layer index shown in grayscale when `viewportMode === 'mask-bw'` (null = off). */
  readonly maskViewLayerIndex: number | null;
  readonly previewRank: 'auto' | DetailRank;
  readonly previewStage: PreviewStage;
  readonly keymap: KeymapScheme;
  readonly showSockets: boolean;

  /** Live grounding & validation issues for the active kit. */
  readonly validationIssues: readonly Issue[];
  /** Staged changes ready to persist to `studio-data/` on `[Accept & Save]`. */
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

export interface StudioStore {
  getSnapshot(): StudioState;
  subscribe(listener: () => void): () => void;

  // Selection & Viewport Actions
  selectKit(kitId: string): void;
  selectPartAndSlot(partPath: string | null, partId: string | null, slotKey: string | null): void;
  selectSocketPin(pinId: string | null): void;
  setHoveredMaterial(matId: string | null): void;
  setActiveLayerIndex(index: number): void;
  setActiveTileId(tileId: string): void;
  setViewportMode(mode: ViewportMode, maskLayerIndex?: number | null): void;
  setPreviewRank(rank: 'auto' | DetailRank): void;
  setPreviewStage(stage: PreviewStage): void;
  setKeymap(keymap: KeymapScheme): void;
  setShowSockets(show: boolean): void;

  // Pillar 1 & 3: Material, Layer Stack & TexGraph Actions
  getMaterialSlotsForActiveKit(): DiscoveredMaterialSlot[];
  getEffectiveMaterialSpec(matId: string): MaterialSpec;
  assignSlotMaterial(slotKey: string, matId: string, scope: 'part-override' | 'kit-slot'): void;
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

  // Undo / Redo / Persistence
  canUndo(): boolean;
  canRedo(): boolean;
  undo(): void;
  redo(): void;
  clearStagedChanges(): void;
}

export function createStudioStore(
  initialKits: Readonly<Record<string, { readonly kit: Kit; readonly rootPreset: string }>>,
  initialActiveKitId?: string,
): StudioStore {
  const firstKitId = initialActiveKitId ?? Object.keys(initialKits)[0] ?? 'kit:default';
  const entry0 = initialKits[firstKitId];
  const slots0 = entry0 ? extractMaterialSlots(entry0.kit, entry0.rootPreset) : [];
  const firstSlot = slots0[0]?.slotName ?? null;
  const firstMat = slots0[0]?.materialId ?? 'mat:field-worn-hazard';

  let state: StudioState = {
    kits: { ...initialKits },
    materials: { ...MATERIAL_SHELF },
    tiles: { ...TILE_LIBRARY },
    overridesByKit: {},
    activeKitId: firstKitId,
    activePartPath: null,
    activePartId: null,
    activeSlotKey: firstSlot,
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
    validationIssues: entry0 ? validate(entry0.kit, entry0.rootPreset) : [],
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
      materials: nextMaterials,
      stagedChanges: staged,
    });
  };

  const mutateActiveKit = (
    summary: string,
    updater: (kit: Kit, rootPreset: string) => Kit,
  ): void => {
    const entry = state.kits[state.activeKitId];
    if (!entry) return;
    const nextKit = updater(entry.kit, entry.rootPreset);
    const nextKits = {
      ...state.kits,
      [state.activeKitId]: { kit: nextKit, rootPreset: entry.rootPreset },
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
      kits: nextKits,
      validationIssues: recomputeValidation(nextKits, state.activeKitId, state.overridesByKit),
      stagedChanges: staged,
    });
  };

  return {
    getSnapshot: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
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
      commit({ ...state, activeTileId: tileId }, false);
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

    assignSlotMaterial(slotKey, matId, scope) {
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

      // scope === 'kit-slot': update PartDef in the Kit
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
      // Solvent rule (ARGO_NOTE_43 Item 4): resets age to 0 and hides weathering layers on active material,
      // and clears weathering overrides on the target part/machine.
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
        // Enforce ARGO_NOTE_43 Bug #2 fix: opaque weathering layers include 'coat' and 'aniso' in writes by default
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

          // If genOrPartId is a @hm/partgen generator ID not yet in kit.parts, create a PartDef for it
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
      mutateActiveKit(`Set ${partId}.${paramKey} = ${value}`, (kit) => {
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
      });
    },

    applyQuickMeshOp(partId, preset) {
      const opRef = QUICK_MESHOP_PRESETS[preset];
      if (!opRef) return;
      mutateActiveKit(`Apply '${preset}' operator preset to ${partId}`, (kit) => {
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
      });
    },

    setPartMeshOps(partId, ops) {
      mutateActiveKit(`Update @hm/meshops stack on ${partId}`, (kit) => {
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
      });
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
