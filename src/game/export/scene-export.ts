/**
 * IF-EXPORT: Scene export to Blender-compatible GLTF/GLB with meter scaling.
 * Embeds prop metadata into node extras for lossless round-trip editing.
 */

import { UNITS_PER_METER } from '../assets/model-import';
import type { PlacedProp } from '../track-builder-3d';

export interface ExportNodeExtras {
  hm2PropId: string;
  hm2Type: string;
  hm2MeshRole?: string;
  hm2Version: number;
}

export interface ExportNode {
  name: string;
  position: [number, number, number]; // in meters (divided by 62)
  rotation: [number, number, number];
  scale: [number, number, number];
  extras: ExportNodeExtras;
}

export interface ExportSceneDoc {
  generator: string;
  version: number;
  scaleUnitsPerMeter: number;
  nodes: ExportNode[];
}

export function exportSceneDoc(props: readonly PlacedProp[]): ExportSceneDoc {
  const nodes: ExportNode[] = [];

  for (const prop of props) {
    // Convert world units to meters
    const posX = prop.x / UNITS_PER_METER;
    const posY = prop.y / UNITS_PER_METER;
    const posZ = prop.z / UNITS_PER_METER;

    nodes.push({
      name: `${prop.type}_${prop.id}`,
      position: [posX, posY, posZ],
      rotation: [prop.rotX ?? 0, prop.rotY, prop.rotZ ?? 0],
      scale: [prop.scale, prop.scale, prop.scale],
      extras: {
        hm2PropId: prop.id,
        hm2Type: prop.type,
        hm2MeshRole: (prop as any).meshRole ?? 'decoration',
        hm2Version: 2,
      },
    });
  }

  return {
    generator: 'HeavyMetalGP2-Forge',
    version: 2,
    scaleUnitsPerMeter: UNITS_PER_METER,
    nodes,
  };
}

export interface RoundTripResult {
  updatedProps: PlacedProp[];
  changedCount: number;
  unrecognizedNodeCount: number;
}

/**
 * Applies imported round-trip changes back onto existing props.
 * Re-scales meter positions back to world units (× 62).
 */
export function applyRoundTrip(
  currentProps: readonly PlacedProp[],
  importedDoc: ExportSceneDoc,
): RoundTripResult {
  const propMap = new Map<string, PlacedProp>(currentProps.map((p) => [p.id, { ...p }]));
  let changedCount = 0;
  let unrecognizedNodeCount = 0;

  for (const node of importedDoc.nodes) {
    const propId = node.extras?.hm2PropId;
    if (!propId || !propMap.has(propId)) {
      unrecognizedNodeCount++;
      continue;
    }

    const prop = propMap.get(propId)!;
    const newX = node.position[0] * UNITS_PER_METER;
    const newY = node.position[1] * UNITS_PER_METER;
    const newZ = node.position[2] * UNITS_PER_METER;
    const newRotY = node.rotation[1];
    const newScale = node.scale[0];

    const hasChanged =
      Math.abs(prop.x - newX) > 1e-3 ||
      Math.abs(prop.y - newY) > 1e-3 ||
      Math.abs(prop.z - newZ) > 1e-3 ||
      Math.abs(prop.rotY - newRotY) > 1e-3 ||
      Math.abs(prop.scale - newScale) > 1e-3;

    if (hasChanged) {
      prop.x = newX;
      prop.y = newY;
      prop.z = newZ;
      prop.rotY = newRotY;
      prop.scale = newScale;
      changedCount++;
    }
  }

  return {
    updatedProps: Array.from(propMap.values()),
    changedCount,
    unrecognizedNodeCount,
  };
}
