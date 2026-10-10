// Packs the Meshy "Armored Space Suit" character (Mixamo-rigged, three detail levels) into compact game GLBs.
//   node scripts/pack-character.mjs <folder with the three zips' contents> [out dir]
// For each level (3k, 9k, 30k):
//  - take the walking file as the base (mesh, skin, baked material) and add the running file's clip;
//  - resample the animation curves and drop tangents (three.js derives them for the normal map);
//  - re-encode the three 4096² textures as 1024² WebP;
//  - compress the geometry with meshopt (the game loads it through three's MeshoptDecoder).
// The game bundle stays one file, so every kilobyte here ships to every player.
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, resample, textureCompress } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';

const [src, outArg] = process.argv.slice(2);
if (!src) { console.error('usage: node scripts/pack-character.mjs <extracted folder> [out dir]'); process.exit(2); }
const out = outArg ?? 'apps/web/src/avatar/astro';
const LEVELS = [['3k', 'low'], ['9k', 'mid'], ['30k', 'high']];
const NAME = 'Meshy_AI_Armored_Space_Suit_biped';

await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
fs.mkdirSync(out, { recursive: true });

for (const [level, label] of LEVELS) {
  const dir = path.join(src, level, NAME);
  const walk = await io.read(path.join(dir, `${NAME}_Animation_Walking_withSkin.glb`));
  const run = await io.read(path.join(dir, `${NAME}_Animation_Running_withSkin.glb`));
  const buffer = walk.getRoot().listBuffers()[0];
  const nodes = new Map(walk.getRoot().listNodes().map((n) => [n.getName(), n]));
  const copy = (a) => walk.createAccessor().setType(a.getType()).setArray(a.getArray().slice()).setBuffer(buffer);
  for (const anim of run.getRoot().listAnimations()) {
    const into = walk.createAnimation(anim.getName());
    for (const ch of anim.listChannels()) {
      const target = nodes.get(ch.getTargetNode()?.getName() ?? '');
      if (!target) continue;
      const s = ch.getSampler();
      const sampler = walk.createAnimationSampler().setInterpolation(s.getInterpolation()).setInput(copy(s.getInput())).setOutput(copy(s.getOutput()));
      into.addSampler(sampler).addChannel(walk.createAnimationChannel().setTargetNode(target).setTargetPath(ch.getTargetPath()).setSampler(sampler));
    }
  }
  for (const mesh of walk.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) prim.setAttribute('TANGENT', null);
  await walk.transform(
    resample(),
    prune(),
    dedup(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 82 }),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  );
  const file = path.join(out, `astro-${label}.glb`);
  await io.write(file, walk);
  const anims = walk.getRoot().listAnimations().map((a) => a.getName());
  const tris = walk.getRoot().listMeshes().flatMap((m) => m.listPrimitives()).reduce((n, p) => n + (p.getIndices()?.getCount() ?? 0) / 3, 0);
  console.log(`${file}: ${(fs.statSync(file).size / 1024).toFixed(0)} KB, ${tris} triangles, clips ${anims.join(', ')}`);
}
