// Retargets the 14-clip Mixamo animation set (authored on the old scientist rig) onto Astro's rig, and adds the
// clips to Astro's packed GLBs as glTF animations. Astro keeps its own Walking and Running.
//   node --import tsx scripts/retarget-astro.ts <scientist.fbx> [astro dir]
// Why not copy rotations by bone name: the two rigs share Mixamo names but not bind poses or bone axes, which bent
// Astro into an alien crouch. For every bone and frame this takes the source bone's rotation relative to its own bind pose
// (in world space) and applies it to Astro's bone in Astro's bind pose:
//   W_target(t) = W_source(t) · W_source_bind⁻¹ · W_target_bind
// then turns world rotations back into local ones through the already solved parent. The hips also move: the source hips'
// displacement from bind, scaled by the ratio of hip heights.
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder as ThreeMeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { NodeIO, type Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, resample } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { decodeAnimationClips } from '../apps/web/src/avatar/scientist/anims-loader';

const [fbxPath, dirArg] = process.argv.slice(2);
if (!fbxPath) { console.error('usage: node --import tsx scripts/retarget-astro.ts <scientist.fbx> [astro dir]'); process.exit(2); }
const dir = dirArg ?? 'apps/web/src/avatar/astro';
const FPS = 30;
const OWN = new Set(['walking', 'running']);

const toArrayBuffer = (b: Buffer): ArrayBuffer => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
const firstSkinned = (root: THREE.Object3D): THREE.SkinnedMesh => {
  let found: THREE.SkinnedMesh | null = null;
  root.traverse((o) => { if (!found && (o as THREE.SkinnedMesh).isSkinnedMesh) found = o as THREE.SkinnedMesh; });
  if (!found) throw new Error('no skinned mesh'); return found;
};

/** Every bone under a root, posed to bind (all skeletons: a model may split its bones over several skinned meshes). */
function bindPose(root: THREE.Object3D, usePose = true): { bones: Map<string, THREE.Bone>; bind: Map<string, { q: THREE.Quaternion; p: THREE.Vector3 }> } {
  if (usePose) root.traverse((o) => { const m = o as THREE.SkinnedMesh; if (m.isSkinnedMesh) m.skeleton.pose(); });
  root.updateMatrixWorld(true);
  const bones = new Map<string, THREE.Bone>(), bind = new Map<string, { q: THREE.Quaternion; p: THREE.Vector3 }>();
  root.traverse((o) => { if ((o as THREE.Bone).isBone) { const b = o as THREE.Bone, q = new THREE.Quaternion(), p = new THREE.Vector3(); b.matrixWorld.decompose(p, q, new THREE.Vector3()); bones.set(b.name, b); bind.set(b.name, { q, p }); } });
  return { bones, bind };
}

async function main(): Promise<void> {
  // the source: the old scientist rig (FBX in centimetres, scaled to metres as the game did) and its 14 clips
  const source = new FBXLoader().parse(toArrayBuffer(fs.readFileSync(fbxPath!)), '') as THREE.Group;
  source.scale.setScalar(0.01);
  // the source's reference is its default node pose (Mixamo's T-pose), read in the same space playback uses
  const { bones: sBones, bind: sBind } = bindPose(source, false);
  const clips = decodeAnimationClips(fs.readFileSync('apps/web/src/avatar/scientist/anims.bin'));
  // the hips' reference: where the source hips stand at the idle's first frame, read the same way playback is (posing the
  // FBX to bind applies its armature transform twice, so its bind position is not comparable)
  const sHips = (() => { const m = new THREE.AnimationMixer(source); m.clipAction(clips.get('breathing-idle')!).play(); m.setTime(0); source.updateMatrixWorld(true); const p = new THREE.Vector3(); sBones.get('mixamorigHips')!.getWorldPosition(p); m.stopAllAction(); return { p }; })();

  await MeshoptEncoder.ready; await MeshoptDecoder.ready; await ThreeMeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

  for (const level of ['low', 'mid', 'high']) {
    const file = path.join(dir, `astro-${level}.glb`);
    const doc: Document = await io.read(file);
    // the target rig as three.js objects: parse a copy without textures (node has no image decoder)
    const bare = await io.read(file);
    for (const t of bare.getRoot().listTextures()) t.dispose();
    const parsed = await new GLTFLoader().setMeshoptDecoder(ThreeMeshoptDecoder).parseAsync(toArrayBuffer(Buffer.from(await io.writeBinary(bare))), '');
    // rotations come from Astro's bind pose (skeleton.pose()); the hips' standing height from its default node pose (0.916 m),
    // which pose() misplaces
    const target = parsed.scene, tSkin = firstSkinned(target);
    const tRest = bindPose(target, false).bind;
    const tStand = tRest.get('mixamorigHips')!.p.clone();
    const tHips = { p: tStand }, ratio = tHips.p.y / sHips.p.y;
    // target bones parents-first, so a parent's solved world rotation is ready for its children
    const order: THREE.Bone[] = []; const visit = (b: THREE.Object3D) => { if ((b as THREE.Bone).isBone) order.push(b as THREE.Bone); b.children.forEach(visit); };
    visit(tSkin.skeleton.bones[0]!);
    // pose matching: turn each Astro bone (parents first) so it points where the source bone points in the source's
    // T-pose; the rest poses differ (an A-pose is not a T-pose), and retargeting against unmatched rests crosses the arms
    const tBind = new Map<string, { q: THREE.Quaternion; p: THREE.Vector3 }>();
    const adjust = new Map<string, THREE.Quaternion>();
    for (const b of order) {
      const parentAdj = (b.parent && adjust.get(b.parent.name)) ?? new THREE.Quaternion();
      const rest = tRest.get(b.name)!, child = b.children.find((c) => (c as THREE.Bone).isBone && tRest.has(c.name) && sBind.has(c.name));
      let adj = parentAdj.clone();
      if (child && sBind.has(b.name)) {
        const dt = tRest.get(child.name)!.p.clone().sub(rest.p).applyQuaternion(parentAdj).normalize();
        const ds = sBind.get(child.name)!.p.clone().sub(sBind.get(b.name)!.p).normalize();
        if (dt.lengthSq() > 0 && ds.lengthSq() > 0) adj = new THREE.Quaternion().setFromUnitVectors(dt, ds).multiply(parentAdj);
      }
      adjust.set(b.name, adj);
      tBind.set(b.name, { q: adj.clone().multiply(rest.q), p: rest.p.clone() });
    }
    const docNodes = new Map(doc.getRoot().listNodes().map((n) => [THREE.PropertyBinding.sanitizeNodeName(n.getName()), n] as const));
    const buffer = doc.getRoot().listBuffers()[0]!;
    const existing = new Set(doc.getRoot().listAnimations().map((a) => a.getName().toLowerCase()));
    let added = 0;
    for (const [name, clip] of clips) {
      if (OWN.has(name) || existing.has(name)) continue;
      const mixer = new THREE.AnimationMixer(source); const action = mixer.clipAction(clip); action.play();
      const frames = Math.max(2, Math.round(clip.duration * FPS) + 1), times = new Float32Array(frames);
      const rot = new Map(order.map((b) => [b.name, new Float32Array(frames * 4)] as const));
      const hipPos = new Float32Array(frames * 3);
      for (let f = 0; f < frames; f++) {
        const t = Math.min(clip.duration, f / FPS); times[f] = t;
        mixer.setTime(t); source.updateMatrixWorld(true);
        const world = new Map<string, THREE.Quaternion>();
        for (const b of order) {
          const tb = tBind.get(b.name)!, sb = sBones.get(b.name), sbind = sBind.get(b.name);
          let w: THREE.Quaternion;
          if (sb && sbind) {
            const ws = new THREE.Quaternion(); sb.matrixWorld.decompose(new THREE.Vector3(), ws, new THREE.Vector3());
            w = ws.multiply(sbind.q.clone().invert()).multiply(tb.q);
          } else {
            // no source bone: keep the bind pose relative to the (moving) parent
            const parentBind = b.parent && tBind.get(b.parent.name);
            const parentNow = b.parent && world.get(b.parent.name);
            w = parentNow && parentBind ? parentNow.clone().multiply(parentBind.q.clone().invert()).multiply(tb.q) : tb.q.clone();
          }
          world.set(b.name, w);
          const parentWorld = b.parent && world.get(b.parent.name);
          const parentRot = parentWorld ?? (() => { const q = new THREE.Quaternion(); b.parent?.matrixWorld.decompose(new THREE.Vector3(), q, new THREE.Vector3()); return q; })();
          const local = parentRot.clone().invert().multiply(w).normalize();
          local.toArray(rot.get(b.name)!, f * 4);
        }
        // the hips travel as the source's do, scaled to Astro's hip height, in the hips' parent space
        const sp = new THREE.Vector3(); sBones.get('mixamorigHips')!.getWorldPosition(sp);
        const wp = tHips.p.clone().add(sp.sub(sHips.p).multiplyScalar(ratio));
        const hipsBone = tSkin.skeleton.bones.find((b) => b.name === 'mixamorigHips')!;
        const parentInv = hipsBone.parent ? hipsBone.parent.matrixWorld.clone().invert() : new THREE.Matrix4();
        wp.applyMatrix4(parentInv).toArray(hipPos, f * 3);
      }
      const anim = doc.createAnimation(name), input = doc.createAccessor().setType('SCALAR').setArray(times).setBuffer(buffer);
      for (const [bone, values] of rot) {
        const node = docNodes.get(bone); if (!node) continue;
        const s = doc.createAnimationSampler().setInput(input).setOutput(doc.createAccessor().setType('VEC4').setArray(values).setBuffer(buffer)).setInterpolation('LINEAR');
        anim.addSampler(s).addChannel(doc.createAnimationChannel().setTargetNode(node).setTargetPath('rotation').setSampler(s));
      }
      const hipsNode = docNodes.get('mixamorigHips');
      if (hipsNode) {
        const s = doc.createAnimationSampler().setInput(input).setOutput(doc.createAccessor().setType('VEC3').setArray(hipPos).setBuffer(buffer)).setInterpolation('LINEAR');
        anim.addSampler(s).addChannel(doc.createAnimationChannel().setTargetNode(hipsNode).setTargetPath('translation').setSampler(s));
      }
      added++;
    }
    await doc.transform(resample(), prune());
    await io.write(file, doc);
    console.log(`${file}: +${added} clips (${doc.getRoot().listAnimations().map((a) => a.getName()).join(', ')}), ${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
  }
}
main().catch((e: unknown) => { console.error(e); process.exit(1); });
