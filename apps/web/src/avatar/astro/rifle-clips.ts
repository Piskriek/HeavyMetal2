/**
 * The extraction rifle's clips (TASK-21): the Mixamo rifle set, retargeted onto Astro's rig by `scripts/retarget-astro.ts --rifle`
 * into `rifle-anims.bin` (HMAN v2: hips in metres, so nothing here scales them). Loaded once, behind the planet's loading bar, and
 * merged into the character's clip set so the scientist animator plays them while the rifle is out.
 */
import * as THREE from 'three';
import { decodeAnimationClips } from '../scientist/anims-loader';

export const rifleAnimsBinUrl = new URL('./rifle-anims.bin', import.meta.url);

let cachedRifle: Promise<Map<string, THREE.AnimationClip>> | null = null;

/** The rifle clips, decoded. Cached: a second call returns the same map. */
export function loadRifleAnimations(): Promise<Map<string, THREE.AnimationClip>> {
  if (cachedRifle) return cachedRifle;
  cachedRifle = (async () => {
    let buf: ArrayBuffer;
    if (typeof window === 'undefined') {
      const { readFile } = await import('node:fs/promises');
      const { fileURLToPath } = await import('node:url');
      const nodeBuf = await readFile(fileURLToPath(rifleAnimsBinUrl));
      buf = nodeBuf.buffer.slice(nodeBuf.byteOffset, nodeBuf.byteOffset + nodeBuf.byteLength);
    } else {
      const res = await fetch(rifleAnimsBinUrl.href);
      if (!res.ok) throw new Error(`Failed to fetch rifle-anims.bin: ${res.statusText}`);
      buf = await res.arrayBuffer();
    }
    return decodeAnimationClips(buf);
  })();
  cachedRifle.catch(() => { cachedRifle = null; });
  return cachedRifle;
}
