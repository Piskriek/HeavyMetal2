// Procedural monster skin builder (plan 44, part B, rule 8a): grows every monster skin directly from its declarative
// @hm/creature genome into an articulated @hm/partgen 3D model and analytical gait clips (walk, attack, pain, death).
// No static .glb models or .webp sprite sheets are bundled or fetched.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CREATURE_PRESET, creatureAssembly, evaluateCreatureGait, type CreatureGenomeSpec } from '@hm/creature';
import { flatten, type PartDef, type PartSource } from '@hm/kitspec';
import { buildPart, type Rank } from '@hm/partgen';
import { hexToLinear, resolveMatPreset } from '@hm/matstack';
import { fallbackFor } from './adapter';
import { SKINS, type SkinInfo } from './roster';
import type { SpriteGroup } from './timing';

export interface SpriteView { readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly ox: number; readonly oy: number; readonly mirrored: boolean }
export interface SpriteFrame { readonly letter: string; readonly views: readonly (SpriteView | null)[] }
export interface SpriteGroupData { readonly ticks: number; readonly frames: readonly SpriteFrame[] }

export interface SpriteAsset {
  readonly kind: 'sprite';
  readonly id: string;
  readonly texture: THREE.Texture;
  readonly width: number;
  readonly height: number;
  /** Metres per atlas pixel (the sprite's real size: its pixels times this). */
  readonly mpp: number;
  readonly groups: Readonly<Record<SpriteGroup, SpriteGroupData>>;
}

export interface ModelAsset {
  readonly kind: 'model';
  readonly id: string;
  /** The model, scaled to its real height with its feet on y = 0 and centred on the origin. Instances are clones of it. */
  readonly prototype: THREE.Group;
  /** The procedural animation clips by group (walk, attack, pain, death). */
  readonly clips: ReadonlyMap<SpriteGroup, THREE.AnimationClip>;
}

export type SkinAsset = SpriteAsset | ModelAsset;

const GROUPS: readonly SpriteGroup[] = ['walk', 'attack', 'pain', 'death'];

const loaded = new Map<string, SkinAsset>();
const pending = new Map<string, Promise<SkinAsset>>();
const failed = new Set<string>();

/** The loaded skin, or null while it is not loaded (or has failed). Synchronous: the renderer asks every frame. */
export function skinAsset(id: string): SkinAsset | null {
  return loaded.get(id) ?? null;
}

/** True once a skin's load has failed (it is never retried). */
export function skinFailed(id: string): boolean {
  return failed.has(id);
}

function infoOf(id: string, roster: readonly SkinInfo[]): SkinInfo {
  const s = roster.find((r) => r.id === id);
  if (!s) throw new Error(`unknown monster skin: ${id}`);
  return s;
}

/** Parses the packed sprite JSON: each view is [x, y, w, h, originX, originY, mirrored], or null. */
export function parseSpriteJson(raw: Record<string, unknown>): { width: number; height: number; mpp: number; groups: Record<SpriteGroup, SpriteGroupData> } {
  const atlas = raw.atlas as { width: number; height: number };
  const groups = raw.groups as Record<string, { ticks: number; frames: { letter: string; views: (number[] | null)[] }[] }>;
  const out = {} as Record<SpriteGroup, SpriteGroupData>;
  for (const g of GROUPS) {
    const src = groups[g];
    if (!src) throw new Error(`sprite group missing: ${g}`);
    out[g] = {
      ticks: src.ticks,
      frames: src.frames.map((f) => ({
        letter: f.letter,
        views: f.views.map((v) => (v ? { x: v[0]!, y: v[1]!, w: v[2]!, h: v[3]!, ox: v[4]!, oy: v[5]!, mirrored: v[6] === 1 } : null)),
      })),
    };
  }
  return { width: atlas.width, height: atlas.height, mpp: Number(raw.metresPerPixel), groups: out };
}

/**
 * The box a model is fitted by. For morph-target models each frame (base plus one target's delta) gives a box; the fit uses the
 * median frame. A procedural creature without morphs is fitted by its own box.
 */
export function animatedBox(root: THREE.Object3D): THREE.Box3 {
  root.updateMatrixWorld(true);
  const frames: THREE.Box3[] = [];
  const v = new THREE.Vector3();
  const d = new THREE.Vector3();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const targets = m.geometry.morphAttributes.position;
    const base = m.geometry.attributes.position as THREE.BufferAttribute | undefined;
    if (!targets?.length || !base) return;
    for (const target of targets) {
      const frame = new THREE.Box3();
      for (let i = 0; i < base.count; i++) {
        v.fromBufferAttribute(base, i).add(d.fromBufferAttribute(target, i)).applyMatrix4(m.matrixWorld);
        frame.expandByPoint(v);
      }
      frames.push(frame);
    }
  });
  if (frames.length === 0) return new THREE.Box3().setFromObject(root);
  frames.sort((a, b) => (a.max.y - a.min.y) - (b.max.y - b.min.y));
  return frames[Math.floor(frames.length / 2)]!;
}

interface PaintSpec {
  readonly colour: string;
  readonly metalness: number;
  readonly roughness: number;
  readonly emissive?: string;
}

const SEMANTIC_PAINT: Readonly<Record<string, PaintSpec>> = Object.freeze({
  'eye-glow': { colour: '#ff5226', metalness: 0.35, roughness: 0.18, emissive: '#ff3b14' },
  'suit-gold': { colour: '#d9a514', metalness: 0.92, roughness: 0.24, emissive: '#7a5204' },
  'talon-horn': { colour: '#d8cfc0', metalness: 0.18, roughness: 0.52 },
  'effector-boot': { colour: '#262b33', metalness: 0.3, roughness: 0.68 },
  'effector-talon': { colour: '#cfc5b4', metalness: 0.2, roughness: 0.5 },
  'effector-hoof': { colour: '#2d2823', metalness: 0.22, roughness: 0.64 },
  'effector-pincer': { colour: '#b89e72', metalness: 0.32, roughness: 0.46 },
  'effector-thruster': { colour: '#465260', metalness: 0.65, roughness: 0.34 },
  'chitin-dark': { colour: '#2c332b', metalness: 0.28, roughness: 0.45 },
  'chitin-plate': { colour: '#3e4a3c', metalness: 0.32, roughness: 0.42 },
  'chitin': { colour: '#4a5744', metalness: 0.25, roughness: 0.48 },
  'hide-scales': { colour: '#4f5d48', metalness: 0.16, roughness: 0.58 },
  'hide-plate': { colour: '#3b4437', metalness: 0.22, roughness: 0.52 },
  'hide-fur': { colour: '#5c4938', metalness: 0.1, roughness: 0.72 },
  'drone-alloy': { colour: '#6e7885', metalness: 0.62, roughness: 0.36 },
  'drone-plate': { colour: '#4d5663', metalness: 0.68, roughness: 0.32 },
});

function resolveCreatureMaterial(name: string, fallbackPresetId: string, cache: Map<string, THREE.MeshStandardMaterial>): THREE.MeshStandardMaterial {
  const key = `${name}|${fallbackPresetId}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const semantic = SEMANTIC_PAINT[name];
  if (semantic) {
    const [r, g, b] = hexToLinear(semantic.colour);
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(r, g, b),
      metalness: semantic.metalness,
      roughness: semantic.roughness,
    });
    if (semantic.emissive) {
      const [er, eg, eb] = hexToLinear(semantic.emissive);
      mat.emissive = new THREE.Color(er, eg, eb);
      mat.emissiveIntensity = 1.1;
    }
    cache.set(key, mat);
    return mat;
  }

  const preset = resolveMatPreset(name) ?? resolveMatPreset(fallbackPresetId);
  const rawHex = preset?.base.colour ?? '#7a828c';
  const hex = rawHex === '$paint1' ? (preset?.paint[0] ?? '#7a828c') : rawHex === '$paint2' ? (preset?.paint[1] ?? '#7a828c') : rawHex.startsWith('#') ? rawHex : (preset?.paint[0] ?? '#7a828c');
  const [r, g, b] = hexToLinear(hex);
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(r, g, b),
    metalness: preset?.base.metal ?? 0.28,
    roughness: preset?.base.rough ?? 0.56,
  });
  cache.set(key, mat);
  return mat;
}

function slotGeometries(source: PartSource, _def: PartDef, rank: Rank): { slot: string; geometry: THREE.BufferGeometry }[] {
  const out: { slot: string; geometry: THREE.BufferGeometry }[] = [];
  if (source.kind === 'box') {
    const [x, y, z] = source.size;
    const geometry = new THREE.BoxGeometry(x, y, z);
    geometry.translate(0, y / 2, 0);
    out.push({ slot: 'box', geometry });
    return out;
  }
  if (source.kind === 'param') {
    const md = buildPart(source.gen, source.params, rank);
    if (!md) return out;
    for (const slot of md.slots) {
      if (slot.count === 0) continue;
      const remap = new Map<number, number>();
      const index = new Uint32Array(slot.count);
      const positions: number[] = [];
      const normals: number[] = [];
      const uvs: number[] = [];
      for (let i = 0; i < slot.count; i += 1) {
        const from = md.indices[slot.start + i] as number;
        let to = remap.get(from);
        if (to === undefined) {
          to = remap.size;
          remap.set(from, to);
          positions.push(md.positions[from * 3] as number, md.positions[from * 3 + 1] as number, md.positions[from * 3 + 2] as number);
          normals.push(md.normals[from * 3] as number, md.normals[from * 3 + 1] as number, md.normals[from * 3 + 2] as number);
          uvs.push(md.uvs[from * 2] as number, md.uvs[from * 2 + 1] as number);
        }
        index[i] = to;
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geometry.setIndex(new THREE.BufferAttribute(index, 1));
      out.push({ slot: slot.name, geometry });
    }
  }
  return out;
}

function buildProceduralClips(genome: CreatureGenomeSpec): Map<SpriteGroup, THREE.AnimationClip> {
  const clips = new Map<SpriteGroup, THREE.AnimationClip>();
  const RAD = Math.PI / 180;

  // 1. Walk clip driven by evaluateCreatureGait
  const walkDuration = 1.0;
  const walkSteps = 8;
  const walkTimes: number[] = [];
  const bodyPos: number[] = [];
  const bodyQuat: number[] = [];
  const limbQuats = new Map<string, number[]>();

  for (let k = 0; k <= walkSteps; k += 1) {
    const t = (k / walkSteps) * walkDuration;
    walkTimes.push(t);
    const gait = evaluateCreatureGait(genome, t, 1.4, { distanceM: 0 });
    bodyPos.push(gait.pelvis.swayM, gait.pelvis.bobM, 0);
    const qBody = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, gait.pelvis.rollDeg * RAD, 'XYZ'));
    bodyQuat.push(qBody.x, qBody.y, qBody.z, qBody.w);
    for (const limb of gait.limbs) {
      let arr = limbQuats.get(limb.label);
      if (!arr) {
        arr = [];
        limbQuats.set(limb.label, arr);
      }
      const qLimb = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(
          limb.upperRotationDeg[0] * RAD * 0.35,
          limb.upperRotationDeg[1] * RAD * 0.25,
          limb.upperRotationDeg[2] * RAD * 0.25,
          'XYZ',
        ),
      );
      arr.push(qLimb.x, qLimb.y, qLimb.z, qLimb.w);
    }
  }

  const walkTracks: THREE.KeyframeTrack[] = [
    new THREE.VectorKeyframeTrack('creature_body.position', walkTimes, bodyPos),
    new THREE.QuaternionKeyframeTrack('creature_body.quaternion', walkTimes, bodyQuat),
  ];
  for (const [label, values] of limbQuats) {
    walkTracks.push(new THREE.QuaternionKeyframeTrack(`limb_${label}.quaternion`, walkTimes, values));
  }
  clips.set('walk', new THREE.AnimationClip('walk', walkDuration, walkTracks));

  // 2. Attack clip (wind-up at t=0, lunge strike, recover)
  const qWindup = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.18, 0, 0));
  const qStrike = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.28, 0, 0));
  const qIdentity = new THREE.Quaternion();
  clips.set('attack', new THREE.AnimationClip('attack', 0.8, [
    new THREE.VectorKeyframeTrack('creature_body.position', [0, 0.3, 0.8], [0, 0.04, -0.05, 0, -0.03, 0.12, 0, 0, 0]),
    new THREE.QuaternionKeyframeTrack('creature_body.quaternion', [0, 0.3, 0.8], [
      qWindup.x, qWindup.y, qWindup.z, qWindup.w,
      qStrike.x, qStrike.y, qStrike.z, qStrike.w,
      qIdentity.x, qIdentity.y, qIdentity.z, qIdentity.w,
    ]),
  ]));

  // 3. Pain clip (recoil)
  const qPain = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.24, 0, 0.12));
  clips.set('pain', new THREE.AnimationClip('pain', 0.5, [
    new THREE.VectorKeyframeTrack('creature_body.position', [0, 0.18, 0.5], [0, 0, 0, 0, 0.05, -0.08, 0, 0, 0]),
    new THREE.QuaternionKeyframeTrack('creature_body.quaternion', [0, 0.18, 0.5], [
      qIdentity.x, qIdentity.y, qIdentity.z, qIdentity.w,
      qPain.x, qPain.y, qPain.z, qPain.w,
      qIdentity.x, qIdentity.y, qIdentity.z, qIdentity.w,
    ]),
  ]));

  // 4. Death clip (collapse to the floor)
  const qFall = new THREE.Quaternion().setFromEuler(new THREE.Euler(1.35, 0, 0.25));
  clips.set('death', new THREE.AnimationClip('death', 0.75, [
    new THREE.VectorKeyframeTrack('creature_body.position', [0, 0.4, 0.75], [0, 0, 0, 0, -0.15, 0.08, 0, -0.35, 0.15]),
    new THREE.QuaternionKeyframeTrack('creature_body.quaternion', [0, 0.75], [
      qIdentity.x, qIdentity.y, qIdentity.z, qIdentity.w,
      qFall.x, qFall.y, qFall.z, qFall.w,
    ]),
  ]));

  return clips;
}

function buildCreatureModel(skin: SkinInfo): ModelAsset {
  const genome = skin.genome;
  const assembly = creatureAssembly(genome);
  const placed = flatten(assembly.kit, CREATURE_PRESET);
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  const rank: Rank = 1;

  const scene = new THREE.Group();
  scene.name = `creature:${skin.id}`;
  const bodyGroup = new THREE.Group();
  bodyGroup.name = 'creature_body';
  scene.add(bodyGroup);

  const limbGroups = new Map<string, { group: THREE.Group; invRoot: THREE.Matrix4 }>();
  for (const limb of assembly.skeleton.limbs) {
    const g = new THREE.Group();
    g.name = `limb_${limb.label}`;
    g.position.set(limb.root[0], limb.root[1], limb.root[2]);
    g.updateMatrix();
    const invRoot = g.matrix.clone().invert();
    bodyGroup.add(g);
    limbGroups.set(limb.label, { group: g, invRoot });
  }

  const partMatrix = new THREE.Matrix4();
  for (const p of placed) {
    const def = assembly.kit.parts[p.part];
    if (!def) continue;
    partMatrix.fromArray(p.matrix as unknown as number[]);

    let targetGroup: THREE.Group = bodyGroup;
    let localMatrix = partMatrix;
    if (p.path.startsWith('mechanism/')) {
      const sub = p.path.slice('mechanism/'.length);
      for (const [label, entry] of limbGroups) {
        if (sub.startsWith(`${label}-`)) {
          targetGroup = entry.group;
          localMatrix = entry.invRoot.clone().multiply(partMatrix);
          break;
        }
      }
    }

    const byMaterial = new Map<string, THREE.BufferGeometry[]>();
    for (const { slot, geometry } of slotGeometries(p.source, def, rank)) {
      const matName = p.slotMaterials?.[slot] ?? p.material;
      geometry.applyMatrix4(localMatrix);
      const list = byMaterial.get(matName) ?? [];
      list.push(geometry);
      byMaterial.set(matName, list);
    }

    for (const [matName, list] of byMaterial) {
      const geometry = list.length === 1 ? list[0]! : mergeGeometries(list, false);
      if (!geometry) continue;
      const mat = resolveCreatureMaterial(matName, genome.skinPaletteId, materials);
      const mesh = new THREE.Mesh(geometry, mat);
      mesh.name = `${p.path}:${matName}`;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.frustumCulled = false;
      targetGroup.add(mesh);
    }
  }

  scene.updateMatrixWorld(true);
  const box = animatedBox(scene);
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  const s = size.y > 0 ? skin.heightM / size.y : 1;
  scene.scale.setScalar(s);
  scene.position.set(-centre.x * s, -box.min.y * s, -centre.z * s);

  // Counter-rotate by -skin.turn so renderer.ts's `yaw + turnOf(id)` faces +z for every era
  const turnGroup = new THREE.Group();
  turnGroup.rotation.y = -skin.turn;
  turnGroup.add(scene);

  const prototype = new THREE.Group();
  prototype.add(turnGroup);
  prototype.updateMatrixWorld(true);

  const clips = buildProceduralClips(genome);
  return { kind: 'model', id: skin.id, prototype, clips };
}

/** Builds and caches one procedural monster skin from its @hm/creature genome. */
export function loadSkin(id: string, roster: readonly SkinInfo[] = SKINS): Promise<SkinAsset> {
  const have = loaded.get(id);
  if (have) return Promise.resolve(have);
  const busy = pending.get(id);
  if (busy) return busy;
  try {
    const skin = infoOf(id, roster);
    const asset = buildCreatureModel(skin);
    loaded.set(id, asset);
    return Promise.resolve(asset);
  } catch (err: unknown) {
    failed.add(id);
    console.warn(`[monsters] ${id} stays on its fallback:`, err);
    return Promise.reject(err);
  }
}

export interface PreloadResult { readonly loaded: readonly string[]; readonly failed: readonly string[] }

/**
 * Builds the given skins and their fallbacks, behind the caller's loading bar. Never rejects: a skin that fails is listed in `failed`
 * and its fallback is drawn instead.
 */
export async function preloadSkins(ids: readonly string[], onProgress?: (done: number, total: number) => void, roster: readonly SkinInfo[] = SKINS): Promise<PreloadResult> {
  const all = [...new Set(ids.flatMap((id) => [id, fallbackFor(id, roster)]))];
  let done = 0;
  const results = await Promise.all(all.map((id) => loadSkin(id, roster).then(
    () => { done++; onProgress?.(done, all.length); return { id, ok: true }; },
    () => { done++; onProgress?.(done, all.length); return { id, ok: false }; },
  )));
  return {
    loaded: results.filter((r) => r.ok).map((r) => r.id),
    failed: results.filter((r) => !r.ok).map((r) => r.id),
  };
}
