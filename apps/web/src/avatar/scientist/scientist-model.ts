import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
const scientistFbxUrl = new URL('./scientist.fbx', import.meta.url).href;

export const SUBMESH_COLORS: Record<string, { color: number; roughness: number; metalness?: number }> = {
  '1': { color: 0x334155, roughness: 0.7 },
  '2': { color: 0x1e293b, roughness: 0.8 },
  '3': { color: 0x475569, roughness: 0.6 },
  '4': { color: 0xe2e8f0, roughness: 0.5 },
  '5': { color: 0xf5f8fa, roughness: 0.5, metalness: 0.05 },
  '6': { color: 0x0f172a, roughness: 0.9 },
  '7': { color: 0x0f172a, roughness: 0.9 },
  '9': { color: 0x334155, roughness: 0.7 },
};

let cachedTemplate: THREE.Group | null = null;
let cachedTemplatePromise: Promise<THREE.Group> | null = null;

/**
 * Loads the base scientist FBX template, scaled to 1.75 m.
 */
export async function loadScientistTemplate(): Promise<THREE.Group> {
  if (cachedTemplate) return cachedTemplate;
  if (cachedTemplatePromise) return cachedTemplatePromise;

  cachedTemplatePromise = (async () => {
    const loader = new FBXLoader();
    let buf: ArrayBuffer;
    if (typeof window === 'undefined') {
      const { readFile } = await import('node:fs/promises');
      const { fileURLToPath } = await import('node:url');
      const nodeBuf = await readFile(fileURLToPath(new URL('./scientist.fbx', import.meta.url)));
      buf = nodeBuf.buffer.slice(nodeBuf.byteOffset, nodeBuf.byteOffset + nodeBuf.byteLength);
    } else {
      const res = await fetch(scientistFbxUrl);
      if (!res.ok) throw new Error(`Failed to fetch scientist.fbx: ${res.statusText}`);
      buf = await res.arrayBuffer();
    }
    const group = loader.parse(buf, '') as THREE.Group;
    group.scale.setScalar(0.01); // 175 cm -> 1.75 m
    cachedTemplate = group;
    return group;
  })();

  return cachedTemplatePromise;
}

/**
 * Applies PBR materials and visor tint to a scientist group instance.
 */
export function styleScientistGroup(
  group: THREE.Group,
  visorHex = '#f59e0b'
): {
  visorMaterials: THREE.MeshStandardMaterial[];
  spine: THREE.Bone | null;
} {
  const visorColor = new THREE.Color(visorHex);
  const visorMaterials: THREE.MeshStandardMaterial[] = [];
  const spine = (group.getObjectByName('mixamorigSpine') as THREE.Bone) ?? null;
  group.userData.spine = spine;

  group.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) {
      const mesh = c as THREE.Mesh;
      if (mesh.name === '6' || mesh.name === '7' || mesh.name === '8') {
        const mat = new THREE.MeshStandardMaterial({
          color: visorColor,
          emissive: visorColor,
          emissiveIntensity: 0.9,
          roughness: 0.1,
          metalness: 0.1,
          transparent: true,
          opacity: 0.9,
        });
        mesh.material = mat;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        visorMaterials.push(mat);
      } else if (SUBMESH_COLORS[mesh.name]) {
        const mat = new THREE.MeshStandardMaterial(SUBMESH_COLORS[mesh.name]);
        mesh.material = mat;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    }
  });

  return { visorMaterials, spine };
}

/**
 * Creates a cloned instance of the scientist character with custom visor color.
 */
export async function createScientistInstance(visorHex = '#f59e0b'): Promise<{
  group: THREE.Group;
  visorMaterials: THREE.MeshStandardMaterial[];
  spine: THREE.Bone | null;
}> {
  const template = await loadScientistTemplate();
  const group = SkeletonUtils.clone(template) as THREE.Group;
  const { visorMaterials, spine } = styleScientistGroup(group, visorHex);
  return { group, visorMaterials, spine };
}
