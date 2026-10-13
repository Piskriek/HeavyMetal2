/**
 * The extraction rifle's clips (TASK-21): the Mixamo rifle set, packed in place into `rifle-anims.bin` on the mixamorig rig
 * that Astro shares (`node scripts/pack-anims.mjs --rifle`). Loaded once, behind the planet's loading bar, and merged into
 * the character's clip set so the scientist animator plays them while the rifle is out.
 */
import * as THREE from 'three';
import { decodeAnimationClips } from '../scientist/anims-loader';
import { ASTRO_HIPS_Y } from './astro-model';

export const rifleAnimsBinUrl = new URL('./rifle-anims.bin', import.meta.url);

/**
 * The packed Mixamo hips are in centimetres (about 100 standing; the game scales the rig by 0.01). Astro's hips stand at
 * ASTRO_HIPS_Y, so the hips' travel is scaled by that height over the source's metre. Without it the rifle set puts the
 * character 100 m up. The rotations are the packed set's as they are.
 */
const SOURCE_HIPS_CM = 100;
export function scaleRifleClipsToAstro(clips: Map<string, THREE.AnimationClip>): Map<string, THREE.AnimationClip> {
  const k = ASTRO_HIPS_Y / SOURCE_HIPS_CM;
  for (const clip of clips.values()) {
    for (const track of clip.tracks) {
      if (track.name !== 'mixamorigHips.position') continue;
      for (let i = 0; i < track.values.length; i++) track.values[i] = track.values[i]! * k;
    }
  }
  return clips;
}

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
    return scaleRifleClipsToAstro(decodeAnimationClips(buf));
  })();
  cachedRifle.catch(() => { cachedRifle = null; });
  return cachedRifle;
}
