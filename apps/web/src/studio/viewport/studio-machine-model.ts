/**
 * @file apps/web/src/studio/viewport/studio-machine-model.ts
 * STUDIO-44B / 44D: Live 3D Machine Builder for the Studio Viewport.
 *
 * Builds a THREE.Group from @hm/kitspec Kit using buildKitPreset with @hm/matstack
 * layered materials and precomputed aEdge/aCavity attributes.
 * Also builds the O(log N) pick table for face-to-slot raycasting.
 */

import * as THREE from 'three';
import type { Kit, Overrides } from '@hm/kitspec';
import { resolveMatPreset, specOfName, type MaterialSpec } from '@hm/matstack';
import { buildKitPreset, type KitBuild } from '../../play/kit-build';
import {
  kitLayering,
  materialForSpec,
  setMaskView,
} from '../../play/layered-material';
import { buildKitPickTable, type KitPickTable } from './raycast-picker';
import { globalStudioStore } from '../state/studio-hook';

export interface StudioMachineBuildResult {
  readonly kitId: string;
  readonly presetId: string;
  readonly group: THREE.Group;
  readonly build: KitBuild;
  readonly pickTable: KitPickTable;
  readonly dispose: () => void;
}

/**
 * Builds a 3D Three.js Group for the specified Kit and Preset, wired to @hm/matstack layered materials.
 */
export function buildStudioMachineModel(
  _renderer: THREE.WebGLRenderer,
  kit: Kit,
  presetId: string,
  overrides?: Overrides,
  maskViewLayerIndex: number | null = null,
  maxRank: 0 | 1 | 2 = 2,
): StudioMachineBuildResult | null {

  const resolveMaterial = (name: string): THREE.Material | null => {
    // Check if store has an effective spec or override
    const storeSpec = globalStudioStore.getEffectiveMaterialSpec(name);
    let targetSpec: MaterialSpec = storeSpec;

    if (!targetSpec) {
      const canonical = resolveMatPreset(name);
      if (canonical) targetSpec = canonical;
      else {
        const named = specOfName(name);
        if (named) targetSpec = named;
      }
    }

    if (targetSpec) {
      const mat = materialForSpec(targetSpec, maxRank);
      if (maskViewLayerIndex !== null) {
        setMaskView(mat, maskViewLayerIndex);
      }
      return mat;
    }

    // Fallback standard material with sensible color
    return new THREE.MeshStandardMaterial({
      color: name.includes('hazard') ? 0xeab308 : 0x8a929a,
      roughness: 0.5,
      metalness: 0.3,
    });
  };

  const build = buildKitPreset(kit, presetId, {
    materials: {},
    resolveMaterial,
    maxRank,
    overrides,
    layering: kitLayering,
    gen: () => null,
  });

  if (!build) {
    return null;
  }

  const pickTable = buildKitPickTable(kit, presetId, maxRank, overrides);

  return {
    kitId: presetId,
    presetId,
    group: build.group,
    build,
    pickTable,
    dispose: () => {
      // Disposed when new build created
    },
  };
}
