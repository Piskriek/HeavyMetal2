/**
 * A Light Projector preset as a lamp's material (plan 39 section 6, Lx): a kit lamp part names it
 * `lx:<kelvin>:<intensity>:<pattern>[:<rrggbb>]` and glows that colour at that intensity, its pattern (a slow pulse, a
 * blink, a flicker) animated by one tick a frame for every lamp wearing it. One material per preset, shared, so a lamp
 * costs no more than any other part; real point lights stay the Graphics tier's extra.
 */
import * as THREE from 'three';
import type { LightPattern } from '@hm/cartlab';
import { lightHex, parseLightName, patternGlow } from './light-presets';

/** The housing's dark face around the glow. */
const LAMP_BODY = '#14181f';
const lights = new Map<string, { readonly material: THREE.MeshStandardMaterial; readonly intensity: number; readonly pattern: LightPattern }>();

/** The material for an `lx:` name, or null for any other name. */
export function lightMaterial(name: string): THREE.Material | null {
  const hit = lights.get(name);
  if (hit) return hit.material;
  const l = parseLightName(name);
  if (!l) return null;
  const material = new THREE.MeshStandardMaterial({ color: LAMP_BODY, emissive: lightHex(l), emissiveIntensity: l.intensity, roughness: 0.3, metalness: 0.1 });
  lights.set(name, { material, intensity: l.intensity, pattern: l.pattern });
  return material;
}

/** Moves every light material's pattern on to time t (seconds); call once a frame. Steady lights never change. */
export function tickLights(t: number): void {
  for (const l of lights.values()) {
    if (l.pattern !== 'steady') l.material.emissiveIntensity = l.intensity * patternGlow(l.pattern, t);
  }
}
