// Retargets Mixamo animation sets (authored on the old scientist rig) onto Astro's rig.
//   node --import tsx scripts/retarget-astro.ts <scientist.fbx> --rifle      the 11 rifle clips, into astro/rifle-anims.bin
// The target rig is `apps/web/src/avatar/astro/mixamo-rig.ts`'s rest table: the suit itself is procedural
// (`ASTRO_SUIT_CREATURE_KIT`), so there is no character GLB to patch. The scientist set is packed from the source FBX by
// `scripts/pack-anims.mjs` into `scientist/anims.bin`; only the rifle set needs retargeting here.
// Why not copy rotations by bone name: the two rigs share Mixamo names but not bind poses or bone axes, which bent
// Astro into an alien crouch. For every bone and frame this takes the source bone's rotation relative to its own bind pose
// (in world space) and applies it to Astro's bone in Astro's bind pose:
//   W_target(t) = W_source(t) · W_source_bind⁻¹ · W_target_bind
// then turns world rotations back into local ones through the already solved parent. The hips also move: the source hips'
// displacement from bind, scaled by the ratio of hip heights.
// The rifle set (TASK-21c): its clips were authored on the same 65-bone Mixamo rig as the scientist clips, in centimetres. They are
// read as FBX clips, their hips are held in place (no root drift, as the rifle always was), and the output hips are in metres:
// the source is scaled to metres here, so nothing downstream scales it again. Written as HMAN v2 (positions in millimetres).
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { decodeAnimationClips, RIFLE_CLIP_NAMES } from '../apps/web/src/avatar/scientist/anims-loader';
import { buildMixamoRig } from '../apps/web/src/avatar/astro/mixamo-rig';

const args = process.argv.slice(2);
const rifleMode = args.includes('--rifle');
const [fbxPath] = args.filter((a) => a !== '--rifle');
if (!fbxPath) { console.error('usage: node --import tsx scripts/retarget-astro.ts <scientist.fbx> --rifle'); process.exit(2); }
const RIFLE_DIR = 'zips/Models/rigged/anims/rifle';
const RIFLE_OUT = 'apps/web/src/avatar/astro/rifle-anims.bin';
const FPS = 30;
/** Keys within these of their straight-line guess are dropped (quaternion components; metres for the hips). */
const QUAT_TOL = 0.008, POS_TOL_M = 0.001;

const toArrayBuffer = (b: Buffer): ArrayBuffer => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;


/** Every bone under a root, posed to bind (all skeletons: a model may split its bones over several skinned meshes). */
function bindPose(root: THREE.Object3D, usePose = true): { bones: Map<string, THREE.Bone>; bind: Map<string, { q: THREE.Quaternion; p: THREE.Vector3 }> } {
  if (usePose) root.traverse((o) => { const m = o as THREE.SkinnedMesh; if (m.isSkinnedMesh) m.skeleton.pose(); });
  root.updateMatrixWorld(true);
  const bones = new Map<string, THREE.Bone>(), bind = new Map<string, { q: THREE.Quaternion; p: THREE.Vector3 }>();
  root.traverse((o) => { if ((o as THREE.Bone).isBone) { const b = o as THREE.Bone, q = new THREE.Quaternion(), p = new THREE.Vector3(); b.matrixWorld.decompose(p, q, new THREE.Vector3()); bones.set(b.name, b); bind.set(b.name, { q, p }); } });
  return { bones, bind };
}

/** The source: the old scientist rig (FBX in centimetres, scaled to metres as the game did). */
interface Source {
  readonly root: THREE.Group;
  readonly bones: Map<string, THREE.Bone>;
  readonly bind: Map<string, { q: THREE.Quaternion; p: THREE.Vector3 }>;
  /** Where the source hips stand at the idle's first frame (the hips' reference). */
  readonly hipsRef: THREE.Vector3;
}

/** The target: Astro's bones parents first, their bind pose after pose matching, and the hips' scale. */
interface Target {
  readonly root: THREE.Object3D;
  readonly order: THREE.Bone[];
  readonly tBind: Map<string, { q: THREE.Quaternion; p: THREE.Vector3 }>;
  readonly ratio: number;
  readonly tStand: THREE.Vector3;
}

/** One clip retargeted onto Astro at FPS frames a second: a local rotation per bone and frame, and the hips in the hips' parent space. */
interface Retargeted {
  readonly duration: number;
  readonly times: Float32Array;
  readonly rot: Map<string, Float32Array>;
  readonly hips: Float32Array;
}

function buildSource(fbx: string, clips: Map<string, THREE.AnimationClip>): Source {
  const root = new FBXLoader().parse(toArrayBuffer(fs.readFileSync(fbx)), '') as THREE.Group;
  root.scale.setScalar(0.01);
  // the source's reference is its default node pose (Mixamo's T-pose), read in the same space playback uses
  const { bones, bind } = bindPose(root, false);
  // the hips' reference: where the source hips stand at the idle's first frame, read the same way playback is (posing the
  // FBX to bind applies its armature transform twice, so its bind position is not comparable)
  const m = new THREE.AnimationMixer(root);
  m.clipAction(clips.get('breathing-idle')!).play(); m.setTime(0); root.updateMatrixWorld(true);
  const hipsRef = new THREE.Vector3(); bones.get('mixamorigHips')!.getWorldPosition(hipsRef); m.stopAllAction();
  return { root, bones, bind, hipsRef };
}

function buildTarget(root: THREE.Object3D, src: Source): Target {
  // rotations come from Astro's rest table; the hips' standing height (0.916 m) is that table's own first row
  const tRest = bindPose(root, false).bind;
  const tStand = tRest.get('mixamorigHips')!.p.clone();
  const ratio = tStand.y / src.hipsRef.y;
  // target bones parents-first, so a parent's solved world rotation is ready for its children
  const order: THREE.Bone[] = []; const visit = (b: THREE.Object3D) => { if ((b as THREE.Bone).isBone) order.push(b as THREE.Bone); b.children.forEach(visit); };
  const first = root.getObjectByName('mixamorigHips') as THREE.Bone | null;
  if (!first) throw new Error('the Mixamo rest table has no hips');
  visit(first);
  // pose matching: turn each Astro bone (parents first) so it points where the source bone points in the source's T-pose; the
  // rest poses differ (an A-pose is not a T-pose), and retargeting against unmatched rests crosses the arms
  const tBind = new Map<string, { q: THREE.Quaternion; p: THREE.Vector3 }>();
  const adjust = new Map<string, THREE.Quaternion>();
  for (const b of order) {
    const parentAdj = (b.parent && adjust.get(b.parent.name)) ?? new THREE.Quaternion();
    const rest = tRest.get(b.name)!, child = b.children.find((c) => (c as THREE.Bone).isBone && tRest.has(c.name) && src.bind.has(c.name));
    let adj = parentAdj.clone();
    if (child && src.bind.has(b.name)) {
      const dt = tRest.get(child.name)!.p.clone().sub(rest.p).applyQuaternion(parentAdj).normalize();
      const ds = src.bind.get(child.name)!.p.clone().sub(src.bind.get(b.name)!.p).normalize();
      if (dt.lengthSq() > 0 && ds.lengthSq() > 0) adj = new THREE.Quaternion().setFromUnitVectors(dt, ds).multiply(parentAdj);
    }
    adjust.set(b.name, adj);
    tBind.set(b.name, { q: adj.clone().multiply(rest.q), p: rest.p.clone() });
  }
  return { root, order, tBind, ratio, tStand };
}

function retargetClip(clip: THREE.AnimationClip, src: Source, tgt: Target): Retargeted {
  const mixer = new THREE.AnimationMixer(src.root); mixer.clipAction(clip).play();
  const frames = Math.max(2, Math.round(clip.duration * FPS) + 1), times = new Float32Array(frames);
  const rot = new Map(tgt.order.map((b) => [b.name, new Float32Array(frames * 4)] as const));
  const hips = new Float32Array(frames * 3);
  const hipsBone = tgt.order.find((b) => b.name === 'mixamorigHips')!;
  const parentInv = hipsBone.parent ? hipsBone.parent.matrixWorld.clone().invert() : new THREE.Matrix4();
  for (let f = 0; f < frames; f++) {
    const t = Math.min(clip.duration, f / FPS); times[f] = t;
    mixer.setTime(t); src.root.updateMatrixWorld(true);
    const world = new Map<string, THREE.Quaternion>();
    for (const b of tgt.order) {
      const tb = tgt.tBind.get(b.name)!, sb = src.bones.get(b.name), sbind = src.bind.get(b.name);
      let w: THREE.Quaternion;
      if (sb && sbind) {
        const ws = new THREE.Quaternion(); sb.matrixWorld.decompose(new THREE.Vector3(), ws, new THREE.Vector3());
        w = ws.multiply(sbind.q.clone().invert()).multiply(tb.q);
      } else {
        // no source bone: keep the bind pose relative to the (moving) parent
        const parentBind = b.parent && tgt.tBind.get(b.parent.name);
        const parentNow = b.parent && world.get(b.parent.name);
        w = parentNow && parentBind ? parentNow.clone().multiply(parentBind.q.clone().invert()).multiply(tb.q) : tb.q.clone();
      }
      world.set(b.name, w);
      const parentWorld = b.parent && world.get(b.parent.name);
      const parentRot = parentWorld ?? (() => { const q = new THREE.Quaternion(); b.parent?.matrixWorld.decompose(new THREE.Vector3(), q, new THREE.Vector3()); return q; })();
      parentRot.clone().invert().multiply(w).normalize().toArray(rot.get(b.name)!, f * 4);
    }
    // the hips travel as the source's do, scaled to Astro's hip height, in the hips' parent space
    const sp = new THREE.Vector3(); src.bones.get('mixamorigHips')!.getWorldPosition(sp);
    tgt.tStand.clone().add(sp.sub(src.hipsRef).multiplyScalar(tgt.ratio)).applyMatrix4(parentInv).toArray(hips, f * 3);
  }
  mixer.stopAllAction();
  return { duration: clip.duration, times, rot, hips };
}

/** Keys within `tol` of the straight line between their kept neighbours are dropped; a static track keeps one key. */
function thinTrack(times: Float32Array, values: Float32Array, stride: number, tol: number): { times: number[]; values: number[] } {
  const n = times.length;
  if (n <= 2) return { times: Array.from(times), values: Array.from(values) };
  let maxDelta = 0;
  for (let i = 1; i < n; i++) for (let s = 0; s < stride; s++) maxDelta = Math.max(maxDelta, Math.abs(values[i * stride + s]! - values[s]!));
  if (maxDelta < 1e-4) return { times: [times[0]!], values: Array.from(values.slice(0, stride)) };
  const keep = [0];
  let lastKept = 0;
  for (let i = 1; i < n - 1; i++) {
    let err = 0;
    const t0 = times[lastKept]!, t1 = times[i + 1]!;
    for (let k = lastKept + 1; k <= i; k++) {
      const frac = (times[k]! - t0) / (t1 - t0);
      for (let s = 0; s < stride; s++) {
        const v0 = values[lastKept * stride + s]!, v1 = values[(i + 1) * stride + s]!;
        err = Math.max(err, Math.abs(values[k * stride + s]! - (v0 + (v1 - v0) * frac)));
      }
    }
    if (err > tol) { keep.push(i); lastKept = i; }
  }
  keep.push(n - 1);
  const outTimes: number[] = [], outValues: number[] = [];
  for (const idx of keep) { outTimes.push(times[idx]!); for (let s = 0; s < stride; s++) outValues.push(values[idx * stride + s]!); }
  return { times: outTimes, values: outValues };
}

interface PackTrack { readonly name: string; readonly isPos: boolean; readonly times: number[]; readonly values: number[] }
interface PackClip { readonly name: string; readonly duration: number; readonly tracks: PackTrack[] }

/**
 * HMAN v2: the magic, the version, the track names once, then per clip its tracks as (track index, key count, float32 times,
 * values). Quaternions are int16 (/32767); positions are int16 in millimetres (v1, the scientist set, is centimetres in tenths).
 */
function writeHmanV2(outFile: string, clips: PackClip[]): number {
  const names: string[] = [];
  const indexOf = (n: string): number => { let i = names.indexOf(n); if (i < 0) { names.push(n); i = names.length - 1; } return i; };
  const body: Buffer[] = [];
  const u8 = (v: number): Buffer => Buffer.from([v]);
  const u16 = (v: number): Buffer => { const b = Buffer.alloc(2); b.writeUInt16LE(v, 0); return b; };
  const f32 = (v: number): Buffer => { const b = Buffer.alloc(4); b.writeFloatLE(v, 0); return b; };
  for (const clip of clips) {
    const nameBuf = Buffer.from(clip.name, 'utf8');
    body.push(u8(nameBuf.length), nameBuf, f32(clip.duration), u16(clip.tracks.length));
    for (const track of clip.tracks) {
      body.push(u8(indexOf(track.name)), u16(track.times.length));
      for (const t of track.times) body.push(f32(t));
      const vals = Buffer.alloc(track.values.length * 2);
      for (let i = 0; i < track.values.length; i++) {
        const v = track.values[i]!;
        vals.writeInt16LE(track.isPos ? Math.max(-32768, Math.min(32767, Math.round(v * 1000))) : Math.max(-32767, Math.min(32767, Math.round(v * 32767))), i * 2);
      }
      body.push(vals);
    }
  }
  const head: Buffer[] = [Buffer.from('HMAN'), u16(2), u16(names.length)];
  for (const n of names) { const b = Buffer.from(n, 'utf8'); head.push(u8(b.length), b); }
  head.push(u16(clips.length));
  const bytes = Buffer.concat([...head, ...body]);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, bytes);
  return bytes.length;
}

/** The rifle set: each clip read from its FBX, hips held in place, retargeted, thinned, written as HMAN v2. */
function rifleSet(src: Source, target: Target): void {
  const out: PackClip[] = [];
  const hipsName = THREE.PropertyBinding.sanitizeNodeName('mixamorigHips');
  let keys = 0, kept = 0;
  for (const name of RIFLE_CLIP_NAMES) {
    const fbx = new FBXLoader().parse(toArrayBuffer(fs.readFileSync(path.join(RIFLE_DIR, `${name}.fbx`))), '');
    const clip = fbx.animations[0];
    if (!clip) throw new Error(`${name}.fbx has no animation`);
    // no root drift: the hips' X and Z stay at their first key (the set has always been in place)
    for (const t of clip.tracks) {
      if (!/Hips\.position$/.test(t.name)) continue;
      const v = t.values;
      for (let i = 0; i < t.times.length; i++) { v[i * 3] = v[0]!; v[i * 3 + 2] = v[2]!; }
    }
    const r = retargetClip(clip, src, target);
    const tracks: PackTrack[] = [];
    for (const b of target.order) {
      const q = thinTrack(r.times, r.rot.get(b.name)!, 4, QUAT_TOL);
      tracks.push({ name: `${THREE.PropertyBinding.sanitizeNodeName(b.name)}.quaternion`, isPos: false, times: q.times, values: q.values });
      keys += r.times.length; kept += q.times.length;
    }
    const h = thinTrack(r.times, r.hips, 3, POS_TOL_M);
    tracks.push({ name: `${hipsName}.position`, isPos: true, times: h.times, values: h.values });
    keys += r.times.length; kept += h.times.length;
    out.push({ name, duration: r.duration, tracks });
  }
  const bytes = writeHmanV2(RIFLE_OUT, out);
  console.log(`${RIFLE_OUT}: ${out.length} clips (${out.map((c) => c.name).join(', ')}), ${(bytes / 1024).toFixed(1)} KB; keys ${keys} -> ${kept}`);
}

async function main(): Promise<void> {
  if (!rifleMode) {
    console.error('The suit is procedural now (ASTRO_SUIT_CREATURE_KIT), so there is no character GLB to patch.');
    console.error('Pack the scientist set with: node scripts/pack-anims.mjs   (writes apps/web/src/avatar/scientist/anims.bin)');
    process.exit(2);
  }
  // the idle is the hips' reference: the rifle set is retargeted against the same source rig
  const clips = decodeAnimationClips(fs.readFileSync('apps/web/src/avatar/scientist/anims.bin'));
  const src = buildSource(fbxPath!, clips);
  const rig = buildMixamoRig();
  rifleSet(src, buildTarget(rig.root, src));
}
main().catch((e: unknown) => { console.error(e); process.exit(1); });
