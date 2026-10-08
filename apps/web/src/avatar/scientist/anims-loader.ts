import * as THREE from 'three';

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
] as const;

export type ClipName = (typeof CLIP_NAMES)[number];

/**
 * Decodes all packed animation clips from an ArrayBuffer / ArrayBufferView.
 */
export function decodeAnimationClips(buffer: ArrayBuffer | ArrayBufferView): Map<string, THREE.AnimationClip> {
  const byteOffset = 'byteOffset' in buffer ? buffer.byteOffset : 0;
  const byteLength = buffer.byteLength;
  const rawBuf = 'buffer' in buffer ? buffer.buffer : buffer;
  const view = new DataView(rawBuf, byteOffset, byteLength);
  let offset = 0;

  // Magic 'HMAN'
  const magic = String.fromCharCode(
    view.getUint8(offset++),
    view.getUint8(offset++),
    view.getUint8(offset++),
    view.getUint8(offset++)
  );
  if (magic !== 'HMAN') {
    throw new Error(`Invalid animations binary magic: ${magic}`);
  }

  const version = view.getUint16(offset, true);
  offset += 2;
  if (version !== 1) {
    throw new Error(`Unsupported animations binary version: ${version}`);
  }

  const tnCount = view.getUint16(offset, true);
  offset += 2;
  const trackNames: string[] = [];
  const decoder = new TextDecoder();
  for (let i = 0; i < tnCount; i++) {
    const len = view.getUint8(offset++);
    const strBytes = new Uint8Array(rawBuf, byteOffset + offset, len);
    offset += len;
    trackNames.push(decoder.decode(strBytes));
  }

  const clipCount = view.getUint16(offset, true);
  offset += 2;
  const clips = new Map<string, THREE.AnimationClip>();

  for (let c = 0; c < clipCount; c++) {
    const nameLen = view.getUint8(offset++);
    const nameBytes = new Uint8Array(rawBuf, byteOffset + offset, nameLen);
    offset += nameLen;
    const clipName = decoder.decode(nameBytes);
    const duration = view.getFloat32(offset, true);
    offset += 4;
    const trackCount = view.getUint16(offset, true);
    offset += 2;
    const tracks: THREE.KeyframeTrack[] = [];

    for (let t = 0; t < trackCount; t++) {
      const trackIdx = view.getUint8(offset++);
      const trackName = trackNames[trackIdx]!;
      const isPos = trackName.endsWith('.position');
      const numKeys = view.getUint16(offset, true);
      offset += 2;

      const times = new Float32Array(numKeys);
      for (let k = 0; k < numKeys; k++) {
        times[k] = view.getFloat32(offset, true);
        offset += 4;
      }

      const stride = isPos ? 3 : 4;
      const values = new Float32Array(numKeys * stride);

      if (isPos) {
        for (let k = 0; k < numKeys * 3; k++) {
          values[k] = view.getInt16(offset, true) / 10.0;
          offset += 2;
        }
        tracks.push(new THREE.VectorKeyframeTrack(trackName, times, values));
      } else {
        for (let k = 0; k < numKeys; k++) {
          const qx = view.getInt16(offset, true) / 32767.0;
          offset += 2;
          const qy = view.getInt16(offset, true) / 32767.0;
          offset += 2;
          const qz = view.getInt16(offset, true) / 32767.0;
          offset += 2;
          const qw = view.getInt16(offset, true) / 32767.0;
          offset += 2;
          const len = Math.hypot(qx, qy, qz, qw) || 1;
          const base = k * 4;
          values[base] = qx / len;
          values[base + 1] = qy / len;
          values[base + 2] = qz / len;
          values[base + 3] = qw / len;
        }
        tracks.push(new THREE.QuaternionKeyframeTrack(trackName, times, values));
      }
    }
    clips.set(clipName, new THREE.AnimationClip(clipName, duration, tracks));
  }

  return clips;
}

let cachedClipsPromise: Promise<Map<string, THREE.AnimationClip>> | null = null;

import { animsBinUrl } from './scientist-model';

/**
 * Loads and caches the scientist animation clips.
 */
export async function loadScientistAnimations(bufferOverride?: ArrayBuffer | ArrayBufferView): Promise<Map<string, THREE.AnimationClip>> {
  if (bufferOverride) return decodeAnimationClips(bufferOverride);
  if (cachedClipsPromise) return cachedClipsPromise;
  cachedClipsPromise = (async () => {
    let buf: ArrayBuffer;
    if (typeof window === 'undefined') {
      const { readFile } = await import('node:fs/promises');
      const { fileURLToPath } = await import('node:url');
      const nodeBuf = await readFile(fileURLToPath(animsBinUrl));
      buf = nodeBuf.buffer.slice(nodeBuf.byteOffset, nodeBuf.byteOffset + nodeBuf.byteLength);
    } else {
      const res = await fetch(animsBinUrl.href);
      if (!res.ok) throw new Error(`Failed to fetch anims.bin: ${res.statusText}`);
      buf = await res.arrayBuffer();
    }
    return decodeAnimationClips(buf);
  })();
  return cachedClipsPromise;
}
