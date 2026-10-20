// ============================================================================
// File: packages/anim/src/bone-retarget-map.ts
// TICKET-21 (POL-12 — Universal 3D Avatar Drag & Drop):
// Zero-dependency humanoid bone retargeter and GLB/VRM binary inspector.
// Maps VRM 0.x (J_Bip_*), VRM 1.0 (VRMC_vrm humanoid), Mixamo (mixamorig*),
// ReadyPlayerMe, and Blender/Blockbench humanoid rigs onto @hm/anim's 6
// procedural locomotion bones ('body', 'head', 'armL', 'armR', 'legL', 'legR')
// with A-pose / T-pose rest-rotation delta compensation.
// ============================================================================

import type { Bone, BonePose, Pose } from './index';

export type AvatarFileFormat = 'glb' | 'vrm';

export interface RetargetedBoneBinding {
  readonly bone: Bone;
  readonly nodeName: string;
  /** Matched convention source ('vrm1', 'vrm0', 'mixamo', 'generic'). */
  readonly source: 'vrm1' | 'vrm0' | 'mixamo' | 'generic';
  /** Estimated A-pose roll angle (radians) around Z to compensate when applying armRaise / rz. */
  readonly restRollZ: number;
}

export type BoneRetargetMap = Partial<Record<Bone, RetargetedBoneBinding>>;

export interface GlbVrmInspection {
  readonly valid: boolean;
  readonly format: AvatarFileFormat;
  readonly version: number;
  readonly nodeNames: readonly string[];
  readonly vrmMeta?: {
    readonly specVersion: '0.x' | '1.0';
    readonly title?: string;
    readonly author?: string;
    readonly humanoidBones: Partial<Record<string, string>>;
  };
  readonly retargetMap: BoneRetargetMap;
  readonly mappedCount: number;
}

/**
 * Strips common rig prefixes (`mixamorig:`, `mixamorig_`, `mixamorig`, `J_Bip_`, `Bip01_`,
 * `Armature|`, `CC_Base_`, `DEF-`) and normalizes to lowercase alphanumeric tokens.
 */
export function canonicalizeBoneName(raw: string): string {
  const base = raw.trim().replace(/^.*[:|]/, '');
  const stripped = base
    .replace(/^mixamorig[_:]?/i, '')
    .replace(/^cc_base_/i, '')
    .replace(/^def[-_]/i, '')
    .replace(/^bip01[-_\s]?/i, '');
  return stripped.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Dictionary of canonical aliases for each of @hm/anim's 6 locomotion bones, ordered from
 * most specific root/joint to fallback limb segment.
 */
export const HUMANOID_BONE_ALIASES: Readonly<Record<Bone, readonly string[]>> = {
  body: [
    'jbipchips',
    'jbipcspine',
    'jbipcchest',
    'hips',
    'pelvis',
    'spine',
    'spine1',
    'chest',
    'upperchest',
    'torso',
    'body',
    'root',
  ],
  head: [
    'jbipchead',
    'head',
    'jbipcneck',
    'neck',
    'cranium',
  ],
  armL: [
    'jbipcupperarml',
    'jbiplupperarm',
    'leftupperarm',
    'leftarm',
    'upperarml',
    'arml',
    'larml',
    'lupperarm',
    'shoulderl',
    'leftshoulder',
  ],
  armR: [
    'jbipcupperarmr',
    'jbiprupperarm',
    'rightupperarm',
    'rightarm',
    'upperarmr',
    'armr',
    'rarmr',
    'rupperarm',
    'shoulderr',
    'rightshoulder',
  ],
  legL: [
    'jbiplupperleg',
    'leftupperleg',
    'leftupleg',
    'upperlegl',
    'thighl',
    'leftthigh',
    'legl',
    'leftleg',
    'lupleg',
  ],
  legR: [
    'jbiprupperleg',
    'rightupperleg',
    'rightupleg',
    'upperlegr',
    'thighr',
    'rightthigh',
    'legr',
    'rightleg',
    'rupleg',
  ],
};

/** VRM 0.x / 1.0 humanoid bone tags mapped to @hm/anim's 6 bones. */
const VRM_HUMANOID_TO_ANIM: Readonly<Record<Bone, readonly string[]>> = {
  body: ['hips', 'spine', 'chest', 'upperChest'],
  head: ['head', 'neck'],
  armL: ['leftUpperArm', 'leftShoulder'],
  armR: ['rightUpperArm', 'rightShoulder'],
  legL: ['leftUpperLeg'],
  legR: ['rightUpperLeg'],
};

function detectSourceKind(rawName: string): 'vrm0' | 'mixamo' | 'generic' {
  if (/^j_bip_/i.test(rawName)) return 'vrm0';
  if (/^mixamorig/i.test(rawName)) return 'mixamo';
  return 'generic';
}

/**
 * Resolves a mapping from `@hm/anim`'s 6 bones (`body`, `head`, `armL`, `armR`, `legL`, `legR`)
 * to the concrete node names inside a `.glb` or `.vrm` scene hierarchy.
 * If explicit VRM humanoid bone metadata (`vrmHumanoidBones`) is present, it takes priority.
 */
export function buildBoneRetargetMap(
  nodeNames: readonly string[],
  vrmHumanoidBones?: Partial<Record<string, string>>,
): BoneRetargetMap {
  const out: BoneRetargetMap = {};
  const available = new Set(nodeNames);

  // 1. First pass: explicit VRM 0.x / 1.0 humanoid bone table if available
  if (vrmHumanoidBones) {
    for (const bone of ['body', 'head', 'armL', 'armR', 'legL', 'legR'] as const) {
      for (const vrmKey of VRM_HUMANOID_TO_ANIM[bone]) {
        const targetNode = vrmHumanoidBones[vrmKey];
        if (targetNode && (available.size === 0 || available.has(targetNode))) {
          out[bone] = {
            bone,
            nodeName: targetNode,
            source: /^j_bip_/i.test(targetNode) ? 'vrm0' : 'vrm1',
            restRollZ: 0,
          };
          break;
        }
      }
    }
  }

  // 2. Second pass: match node names against canonical VRM / Mixamo / Blender aliases
  const byCanonical = new Map<string, string>();
  for (const name of nodeNames) {
    const canon = canonicalizeBoneName(name);
    if (canon && !byCanonical.has(canon)) {
      byCanonical.set(canon, name);
    }
  }

  for (const bone of ['body', 'head', 'armL', 'armR', 'legL', 'legR'] as const) {
    if (out[bone]) continue;
    for (const alias of HUMANOID_BONE_ALIASES[bone]) {
      const matched = byCanonical.get(alias);
      if (matched) {
        out[bone] = {
          bone,
          nodeName: matched,
          source: detectSourceKind(matched),
          restRollZ: 0,
        };
        break;
      }
    }
  }

  return out;
}

/**
 * Computes the local Euler delta rotation `(rx, ry, rz)` to apply on top of a retargeted bone's
 * bind/rest Euler angles `(restRx, restRy, restRz)` so both T-pose (VRM) and A-pose (Mixamo/RPM)
 * characters animate cleanly without twisting shoulders inside-out.
 */
export function retargetBoneEuler(
  bone: Bone,
  animPose: BonePose,
  restEuler: { readonly x: number; readonly y: number; readonly z: number } = { x: 0, y: 0, z: 0 },
  bodyLean = 0,
): { readonly x: number; readonly y: number; readonly z: number } {
  if (bone === 'body') {
    return {
      x: restEuler.x + animPose.rx + bodyLean,
      y: restEuler.y + animPose.ry,
      z: restEuler.z + animPose.rz,
    };
  }
  if (bone === 'armL') {
    return {
      x: restEuler.x + animPose.rx,
      y: restEuler.y + animPose.ry,
      z: restEuler.z - animPose.rz,
    };
  }
  if (bone === 'armR') {
    return {
      x: restEuler.x + animPose.rx,
      y: restEuler.y + animPose.ry,
      z: restEuler.z + animPose.rz,
    };
  }
  return {
    x: restEuler.x + animPose.rx,
    y: restEuler.y + animPose.ry,
    z: restEuler.z + animPose.rz,
  };
}

/**
 * Applies a full `@hm/anim` `Pose` to a dictionary of scene bone nodes, preserving each
 * bone's initial bind rotation (`restRotations`) and vertical hip height (`restHipY`).
 */
export function applyPoseToRetargetedNodes(
  pose: Pose,
  nodes: Partial<Record<Bone, { rotation: { x: number; y: number; z: number }; position?: { y: number } }>>,
  restRotations: Partial<Record<Bone, { readonly x: number; readonly y: number; readonly z: number }>> = {},
  restHipY = 0,
  avatarHeightM = 1.7,
): void {
  for (const bone of ['body', 'head', 'armL', 'armR', 'legL', 'legR'] as const) {
    const node = nodes[bone];
    if (!node) continue;
    const rest = restRotations[bone] ?? { x: 0, y: 0, z: 0 };
    const next = retargetBoneEuler(bone, pose.bones[bone], rest, bone === 'body' ? pose.lean : 0);
    node.rotation.x = next.x;
    node.rotation.y = next.y;
    node.rotation.z = next.z;
    if (bone === 'body' && node.position) {
      node.position.y = restHipY + pose.lift * avatarHeightM;
    }
  }
}

/**
 * Inspects a binary `.glb` or `.vrm` `ArrayBuffer` (standard glTF 2.0 binary container:
 * 12-byte header `[magic=0x46546C67, version=2, length]` followed by chunk 0 `JSON`)
 * and extracts node names, VRM 0.x / 1.0 humanoid bone metadata, and the 6-bone retarget map.
 */
export function inspectGlbOrVrmBinary(
  bytes: ArrayBuffer,
  fileName = 'avatar.glb',
): GlbVrmInspection {
  const lower = fileName.toLowerCase();
  const defaultFormat: AvatarFileFormat = lower.endsWith('.vrm') ? 'vrm' : 'glb';
  if (!bytes || bytes.byteLength < 20) {
    return {
      valid: false,
      format: defaultFormat,
      version: 0,
      nodeNames: [],
      retargetMap: {},
      mappedCount: 0,
    };
  }
  const view = new DataView(bytes);
  const magic = view.getUint32(0, true);
  const version = view.getUint32(4, true);
  // 0x46546C67 === 'glTF' in little-endian ASCII
  if (magic !== 0x46546c67 || version !== 2) {
    return {
      valid: false,
      format: defaultFormat,
      version,
      nodeNames: [],
      retargetMap: {},
      mappedCount: 0,
    };
  }

  const chunkLength = view.getUint32(12, true);
  const chunkType = view.getUint32(16, true);
  // 0x4E4F534A === 'JSON'
  if (chunkType !== 0x4e4f534a || 20 + chunkLength > bytes.byteLength) {
    return {
      valid: false,
      format: defaultFormat,
      version,
      nodeNames: [],
      retargetMap: {},
      mappedCount: 0,
    };
  }

  try {
    const jsonBytes = new Uint8Array(bytes, 20, chunkLength);
    const jsonText = new TextDecoder('utf-8').decode(jsonBytes);
    const gltf = JSON.parse(jsonText) as {
      nodes?: readonly { name?: string }[];
      extensions?: {
        VRM?: {
          meta?: { title?: string; author?: string };
          humanoid?: { humanBones?: readonly { bone?: string; node?: number }[] };
        };
        VRMC_vrm?: {
          specVersion?: string;
          meta?: { name?: string; authors?: readonly string[] };
          humanoid?: { humanBones?: Readonly<Record<string, { node?: number }>> };
        };
      };
    };

    const nodes = Array.isArray(gltf.nodes) ? gltf.nodes : [];
    const nodeNames = nodes.map((n, idx) => (typeof n?.name === 'string' && n.name ? n.name : `node_${idx}`));

    let format: AvatarFileFormat = defaultFormat;
    let vrmMeta: GlbVrmInspection['vrmMeta'] | undefined;
    const humanoidBones: Partial<Record<string, string>> = {};

    if (gltf.extensions?.VRMC_vrm) {
      format = 'vrm';
      const vrm1 = gltf.extensions.VRMC_vrm;
      const hb = vrm1.humanoid?.humanBones ?? {};
      for (const [boneName, entry] of Object.entries(hb)) {
        if (entry && typeof entry.node === 'number' && nodeNames[entry.node]) {
          humanoidBones[boneName] = nodeNames[entry.node]!;
        }
      }
      vrmMeta = {
        specVersion: '1.0',
        title: vrm1.meta?.name,
        author: vrm1.meta?.authors?.[0],
        humanoidBones,
      };
    } else if (gltf.extensions?.VRM) {
      format = 'vrm';
      const vrm0 = gltf.extensions.VRM;
      for (const entry of vrm0.humanoid?.humanBones ?? []) {
        if (entry?.bone && typeof entry.node === 'number' && nodeNames[entry.node]) {
          humanoidBones[entry.bone] = nodeNames[entry.node]!;
        }
      }
      vrmMeta = {
        specVersion: '0.x',
        title: vrm0.meta?.title,
        author: vrm0.meta?.author,
        humanoidBones,
      };
    }

    const retargetMap = buildBoneRetargetMap(nodeNames, Object.keys(humanoidBones).length > 0 ? humanoidBones : undefined);
    const mappedCount = Object.keys(retargetMap).length;

    return {
      valid: true,
      format,
      version,
      nodeNames,
      ...(vrmMeta ? { vrmMeta } : {}),
      retargetMap,
      mappedCount,
    };
  } catch {
    return {
      valid: false,
      format: defaultFormat,
      version,
      nodeNames: [],
      retargetMap: {},
      mappedCount: 0,
    };
  }
}
