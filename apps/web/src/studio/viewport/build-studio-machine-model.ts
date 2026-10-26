/**
 * @file apps/web/src/studio/viewport/build-studio-machine-model.ts
 * ARGO_STUDIO_CLEANUP_DIRECTIVE.md (Checklist Item #3):
 * Replaces legacy `loadGenRaw()` in `LookTab`, `SceneTab`, and `CreativeSuite` with
 * `buildStudioMachineModel()`, constructing a live Three.js `THREE.Group` directly from any
 * `@hm/kitspec` modular `Kit` + `@hm/partgen` generators + `@hm/matstack` layered materials.
 */

import * as THREE from 'three';
import type { Box3, DetailRank, Kit, Overrides } from '@hm/kitspec';
import { flatten, presetBounds } from '@hm/kitspec';
import type { MaterialSpec, NoiseSource, SamplePoint, TileSource } from '@hm/matstack';
const DEFAULT_NOISE: NoiseSource = { sample: () => 0.5 };
const DEFAULT_TILE_SOURCE: TileSource = { sample: () => FLAT_TILE };
import {
  FLAT_TILE,
  layerWeight,
  MATERIAL_SHELF,
  materialAt,
  resolveMatPreset,
  surfaceAt,
} from '@hm/matstack';
import type { Rank } from '@hm/partgen';
import { buildPart } from '@hm/partgen';
import type { StudioTileBank } from './layered-material-bridge';
import type { KitPickTable } from './raycast-picker';
import { buildKitPickTable } from './raycast-picker';
import type { SocketPin } from './socket-gizmos';
import { enumerateAssemblySockets } from './socket-gizmos';

export interface BuildStudioMachineOptions {
  readonly kit: Kit;
  readonly presetId: string;
  readonly rank?: DetailRank;
  readonly overrides?: Overrides;
  readonly materials?: Readonly<Record<string, MaterialSpec>>;
  readonly activeMaterialId?: string;
  readonly hoveredMaterialId?: string | null;
  readonly maskViewLayerIndex?: number | null;
  readonly wireframe?: boolean;
  readonly showSockets?: boolean;
  readonly tileBank?: StudioTileBank;
}

export interface BuiltStudioMachineModel {
  readonly group: THREE.Group;
  readonly pickTable: KitPickTable;
  readonly socketPins: readonly SocketPin[];
  readonly bounds: Box3;
  readonly partCount: number;
  readonly triangleCount: number;
  dispose(): void;
}

const SAMPLE_PROBE: SamplePoint = {
  uv: [0.35, 0.35],
  pos: [0.2, 1.1, 0.2],
  normal: [0, 0.5, 0.866],
  edge: 0.018,
  cavity: 0.025,
};

const toSrgbHex = (rgb: readonly [number, number, number]): string => {
  const ch = (v: number): string => {
    const c = Math.max(0, Math.min(1, v));
    const s = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    return Math.round(s * 255).toString(16).padStart(2, '0');
  };
  return `#${ch(rgb[0])}${ch(rgb[1])}${ch(rgb[2])}`;
};

function makeMatstackThreeMaterial(
  matId: string,
  opts: BuildStudioMachineOptions,
): THREE.MeshStandardMaterial {
  // 1. Handle emissive Lx lamp codes ('lx:<kelvin>:<intensity>:<pattern>[:<hex>]')
  if (matId.startsWith('lx:')) {
    const parts = matId.split(':');
    const intensity = Number(parts[2] ?? 1.5) || 1.5;
    const rawHex = parts[4] ? (parts[4].startsWith('#') ? parts[4] : `#${parts[4]}`) : '#ffc13d';
    return new THREE.MeshStandardMaterial({
      color: rawHex,
      emissive: rawHex,
      emissiveIntensity: intensity,
      roughness: 0.2,
      metalness: 0.1,
      wireframe: Boolean(opts.wireframe),
    });
  }

  // 2. Resolve effective MaterialSpec (with non-destructive hover try-on support!)
  const normId = matId.startsWith('mat:') ? matId : `mat:${matId}`;
  const effectiveId =
    opts.hoveredMaterialId && opts.activeMaterialId === normId ? opts.hoveredMaterialId : normId;

  const spec: MaterialSpec =
    opts.materials?.[effectiveId] ??
    resolveMatPreset(effectiveId) ??
    MATERIAL_SHELF['mat:field-worn-hazard']!;

  const tiles = opts.tileBank?.tileSource ?? DEFAULT_TILE_SOURCE;
  const noise = opts.tileBank?.noiseSource ?? DEFAULT_NOISE;

  // 3. Mask B&W diagnostic mode
  if (
    opts.maskViewLayerIndex !== undefined &&
    opts.maskViewLayerIndex !== null &&
    opts.maskViewLayerIndex >= 0 &&
    opts.maskViewLayerIndex < spec.layers.length
  ) {
    const layer = spec.layers[opts.maskViewLayerIndex]!;
    const surf = surfaceAt(layer.surface, SAMPLE_PROBE, spec.paint, tiles);
    const w = layerWeight(layer, surf.height, SAMPLE_PROBE, spec.age, noise);
    const greyHex = toSrgbHex([w, w, w]);
    return new THREE.MeshStandardMaterial({
      color: greyHex,
      roughness: 0.9,
      metalness: 0.0,
      wireframe: Boolean(opts.wireframe),
    });
  }

  // 4. Standard Lit @hm/matstack evaluation
  const ch = materialAt(spec, SAMPLE_PROBE, tiles, noise);
  const colorHex = toSrgbHex(ch.colour);
  const emitHex = toSrgbHex(ch.emit);
  const hasEmit = ch.emit[0] + ch.emit[1] + ch.emit[2] > 0.01;

  if (ch.coat > 0.05) {
    return new THREE.MeshPhysicalMaterial({
      color: colorHex,
      roughness: ch.rough,
      metalness: ch.metal,
      clearcoat: ch.coat,
      clearcoatRoughness: ch.coatRough,
      ...(hasEmit ? { emissive: emitHex, emissiveIntensity: 1.0 } : {}),
      wireframe: Boolean(opts.wireframe),
    });
  }

  return new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: ch.rough,
    metalness: ch.metal,
    ...(hasEmit ? { emissive: emitHex, emissiveIntensity: 1.0 } : {}),
    wireframe: Boolean(opts.wireframe),
  });
}

/**
 * Builds a complete, grounded Three.js `THREE.Group` for any modular `Kit` preset (`MILL_V2_KIT`,
 * `STARGATE_V2_KIT`, `CAPACITOR_BANK_PURE_KIT`, `ROVER_SCOUT_V2_KIT`, etc.), replacing `loadGenRaw()`.
 */
export function buildStudioMachineModel(
  opts: BuildStudioMachineOptions,
): BuiltStudioMachineModel {
  const maxRank: DetailRank = opts.rank ?? 2;
  const placed = flatten(opts.kit, opts.presetId, opts.overrides);
  const pickTable = buildKitPickTable(opts.kit, opts.presetId, maxRank, opts.overrides);
  const socketPins = opts.showSockets
    ? enumerateAssemblySockets(opts.kit, opts.presetId, opts.overrides)
    : [];
  const kitBounds = presetBounds(opts.kit, placed) ?? { min: [0, 0, 0], max: [1, 1, 1] };

  const group = new THREE.Group();
  group.name = `studio-kit:${opts.presetId}`;
  group.userData = {
    kitId: opts.presetId,
    pickTable,
    socketPins,
  };

  const disposableGeoms: THREE.BufferGeometry[] = [];
  const disposableMats: THREE.Material[] = [];

  for (const p of placed) {
    if (p.rank > maxRank) continue;

    if (p.source.kind === 'param') {
      const md = buildPart(p.source.gen, p.source.params, maxRank as Rank);
      if (md) {
        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.BufferAttribute(md.positions, 3));
        geom.setAttribute('normal', new THREE.BufferAttribute(md.normals, 3));
        geom.setAttribute('uv', new THREE.BufferAttribute(md.uvs, 2));
        geom.setIndex(new THREE.BufferAttribute(md.indices, 1));

        const slotMats: THREE.MeshStandardMaterial[] = [];
        md.slots.forEach((s, sIdx) => {
          geom.addGroup(s.start, s.count, sIdx);
          const mId = p.slotMaterials?.[s.name] ?? p.material;
          const mat = makeMatstackThreeMaterial(mId, opts);
          slotMats.push(mat);
          disposableMats.push(mat);
        });

        const mesh = new THREE.Mesh(geom, slotMats.length === 1 ? slotMats[0]! : (slotMats as unknown as THREE.MeshStandardMaterial));
        mesh.name = p.path;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const m4 = new THREE.Matrix4().fromArray(p.matrix);
        mesh.applyMatrix4(m4);
        mesh.userData = {
          partPath: p.path,
          partId: p.part,
          rank: p.rank,
        };
        group.add(mesh);
        disposableGeoms.push(geom);
        continue;
      }
    }

    // Box source fallback
    const size = p.source.kind === 'box' ? p.source.size : ([0.5, 0.5, 0.5] as const);
    const boxGeom = new THREE.BoxGeometry(size[0], size[1], size[2]);
    const mat = makeMatstackThreeMaterial(p.material, opts);
    const mesh = new THREE.Mesh(boxGeom, mat);
    mesh.name = p.path;
    const m4 = new THREE.Matrix4().fromArray(p.matrix);
    mesh.applyMatrix4(m4);
    mesh.userData = { partPath: p.path, partId: p.part, rank: p.rank };
    group.add(mesh);
    disposableGeoms.push(boxGeom);
    disposableMats.push(mat);
  }

  // Render 3D Triad Socket Pins if enabled (Red = Input, Blue = Output, Gold = Power, Green = Mount)
  if (opts.showSockets) {
    for (const pin of socketPins) {
      const pinGeom = new THREE.SphereGeometry(0.045);
      const pinMat = new THREE.MeshBasicMaterial({ color: pin.colorHex });
      const pinMesh = new THREE.Mesh(pinGeom, pinMat);
      pinMesh.name = `socket-pin:${pin.pinId}`;
      pinMesh.position.set(pin.worldPos[0], pin.worldPos[1], pin.worldPos[2]);
      pinMesh.userData = { isSocketPin: true, socketPin: pin };
      group.add(pinMesh);
      disposableGeoms.push(pinGeom);
      disposableMats.push(pinMat);
    }
  }

  return {
    group,
    pickTable,
    socketPins,
    bounds: kitBounds,
    partCount: placed.filter((p) => p.rank <= maxRank).length,
    triangleCount: pickTable.totalTriangles,
    dispose() {
      for (const g of disposableGeoms) g.dispose();
      for (const m of disposableMats) m.dispose();
    },
  };
}
