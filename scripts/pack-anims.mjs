import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

export const CLIP_NAMES = [
  'breathing-idle',
  'looking-around',
  'walking',
  'running',
  'left-strafe-walking',
  'right-strafe-walking',
  'walking-backwards',
  'jump',
  'pulling-lever',
  'button-pushing',
  'plant-a-plant',
  'waving',
  'cheering',
  'pointing',
];

/**
 * Thins keys within tolerance by dropping linear intermediate keys.
 */
function thinTrack(times, values, stride, isQuat, tol) {
  const n = times.length;
  if (n <= 2) return { times, values };

  // Check if completely static throughout
  let maxDelta = 0;
  for (let i = 1; i < n; i++) {
    for (let s = 0; s < stride; s++) {
      maxDelta = Math.max(maxDelta, Math.abs(values[i * stride + s] - values[s]));
    }
  }
  if (maxDelta < 1e-4) {
    return { times: [0], values: values.slice(0, stride) };
  }

  const keep = [0];
  let lastKept = 0;
  for (let i = 1; i < n - 1; i++) {
    let err = 0;
    const t0 = times[lastKept], t1 = times[i + 1];
    for (let k = lastKept + 1; k <= i; k++) {
      const tk = times[k];
      const frac = (tk - t0) / (t1 - t0);
      for (let s = 0; s < stride; s++) {
        const v0 = values[lastKept * stride + s];
        const v1 = values[(i + 1) * stride + s];
        const vk = values[k * stride + s];
        const lerped = v0 + (v1 - v0) * frac;
        err = Math.max(err, Math.abs(vk - lerped));
      }
    }
    if (err > tol) {
      keep.push(i);
      lastKept = i;
    }
  }
  keep.push(n - 1);

  const outTimes = [];
  const outValues = [];
  for (const idx of keep) {
    outTimes.push(times[idx]);
    for (let s = 0; s < stride; s++) outValues.push(values[idx * stride + s]);
  }
  return { times: outTimes, values: outValues };
}

export function packAnimations(animsDir, outFilePath) {
  const loader = new FBXLoader();

  // Find sample tracks to establish track name dictionary
  const sampleBuf = fs.readFileSync(path.join(animsDir, 'breathing-idle.fbx'));
  const sampleFbx = loader.parse(sampleBuf.buffer.slice(sampleBuf.byteOffset, sampleBuf.byteOffset + sampleBuf.byteLength), '');
  const TRACK_NAMES = sampleFbx.animations[0].tracks.map((t) => t.name);

  const clips = [];
  let totalOrigKeys = 0;
  let totalThinnedKeys = 0;

  for (const name of CLIP_NAMES) {
    const fbxPath = path.join(animsDir, `${name}.fbx`);
    if (!fs.existsSync(fbxPath)) {
      throw new Error(`Animation file not found: ${fbxPath}`);
    }
    const buf = fs.readFileSync(fbxPath);
    const fbx = loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
    const clip = fbx.animations[0];
    const tracks = [];

    for (let tIdx = 0; tIdx < TRACK_NAMES.length; tIdx++) {
      const tName = TRACK_NAMES[tIdx];
      const srcTrack = clip.tracks.find((t) => t.name === tName);
      if (!srcTrack) continue;

      totalOrigKeys += srcTrack.times.length;
      const isPos = tName.endsWith('.position');
      const stride = isPos ? 3 : 4;
      const tol = isPos ? 0.05 : 0.008; // position tol 0.05 cm, quat tol 0.008
      const thinned = thinTrack(srcTrack.times, srcTrack.values, stride, !isPos, tol);
      totalThinnedKeys += thinned.times.length;

      tracks.push({
        trackIdx: tIdx,
        isPos,
        times: thinned.times,
        values: thinned.values,
      });
    }
    clips.push({ name, duration: clip.duration, tracks });
  }

  // Build binary
  const chunks = [];
  chunks.push(Buffer.from('HMAN')); // Magic
  const verBuf = Buffer.alloc(2);
  verBuf.writeUInt16LE(1, 0); // Version 1
  chunks.push(verBuf);

  // Track names table
  const tnCount = Buffer.alloc(2);
  tnCount.writeUInt16LE(TRACK_NAMES.length, 0);
  chunks.push(tnCount);
  for (const tn of TRACK_NAMES) {
    const strBuf = Buffer.from(tn, 'utf8');
    chunks.push(Buffer.from([strBuf.length]), strBuf);
  }

  // Clips count
  const cCount = Buffer.alloc(2);
  cCount.writeUInt16LE(clips.length, 0);
  chunks.push(cCount);

  for (const clip of clips) {
    const nameBuf = Buffer.from(clip.name, 'utf8');
    chunks.push(Buffer.from([nameBuf.length]), nameBuf);
    const durBuf = Buffer.alloc(4);
    durBuf.writeFloatLE(clip.duration, 0);
    chunks.push(durBuf);

    const tCount = Buffer.alloc(2);
    tCount.writeUInt16LE(clip.tracks.length, 0);
    chunks.push(tCount);

    for (const track of clip.tracks) {
      chunks.push(Buffer.from([track.trackIdx]));
      const kCount = Buffer.alloc(2);
      kCount.writeUInt16LE(track.times.length, 0);
      chunks.push(kCount);

      // Times as Float32
      const timesBuf = Buffer.alloc(track.times.length * 4);
      for (let i = 0; i < track.times.length; i++) {
        timesBuf.writeFloatLE(track.times[i], i * 4);
      }
      chunks.push(timesBuf);

      // Quantized values
      if (track.isPos) {
        const valBuf = Buffer.alloc(track.values.length * 2);
        for (let i = 0; i < track.values.length; i++) {
          valBuf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(track.values[i] * 10))), i * 2);
        }
        chunks.push(valBuf);
      } else {
        const valBuf = Buffer.alloc(track.values.length * 2);
        for (let i = 0; i < track.values.length; i++) {
          valBuf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(track.values[i] * 32767))), i * 2);
        }
        chunks.push(valBuf);
      }
    }
  }

  const finalBuf = Buffer.concat(chunks);
  fs.mkdirSync(path.dirname(outFilePath), { recursive: true });
  fs.writeFileSync(outFilePath, finalBuf);

  console.log(`Packed ${clips.length} animations to ${outFilePath}`);
  console.log(`Keys: ${totalOrigKeys} -> ${totalThinnedKeys} (${((totalThinnedKeys / totalOrigKeys) * 100).toFixed(1)}%)`);
  console.log(`Binary size: ${finalBuf.length} bytes (${(finalBuf.length / 1024).toFixed(1)} KB)`);
  return {
    bytes: finalBuf.length,
    clips: clips.length,
    origKeys: totalOrigKeys,
    thinnedKeys: totalThinnedKeys,
  };
}

if (process.argv[1] && process.argv[1].endsWith('pack-anims.mjs')) {
  const animsDir = path.resolve('zips/Models/rigged/anims');
  const outFile = path.resolve('apps/web/src/avatar/scientist/anims.bin');
  packAnimations(animsDir, outFile);
}
