/**
 * ISLAND-ROUTE: a detail map for the island terrain.
 *
 * The island's own texture is 2048 pixels across 90,000 world units (about 45 units a pixel), so up
 * close it is soft. A detail map fixes that the usual way: a small tiling texture, sampled at a much
 * higher frequency, multiplies the base colour. Its brightness is divided by its own average, so on
 * average it changes nothing ("1 = no change"), it only adds grain. It fades out with distance, so its
 * repeat never shows from afar, where the base texture already has enough detail.
 *
 * Two octaves (fine up close, coarser further out) keep the grain from swimming as the camera moves.
 * Projection is triplanar in world space (three planar samples blended by the surface normal), so steep
 * groove walls and cliffs get grain too instead of stretched streaks.
 */
import * as THREE from 'three';

export interface DetailMapOptions {
  /** World units per repeat of the fine and the coarse octave. */
  readonly fineTile: number;
  readonly coarseTile: number;
  /** How strongly each octave shows (0 = off, 1 = the texture's full contrast). */
  readonly fineStrength: number;
  readonly coarseStrength: number;
  /** Distances (from the camera) where each octave has faded out entirely. */
  readonly fineFade: number;
  readonly coarseFade: number;
}

export const ISLAND_DETAIL: DetailMapOptions = {
  fineTile: 260,
  coarseTile: 1500,
  fineStrength: 0.55,
  coarseStrength: 0.35,
  fineFade: 9000,
  coarseFade: 32000,
};

/** The average brightness of an image (0..1), so the detail can be normalised to "no change on average". */
export function meanLuminance(image: CanvasImageSource & { width: number; height: number }): number {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  if (!g) return 0.5;
  g.drawImage(image, 0, 0, size, size);
  const px = g.getImageData(0, 0, size, size).data;
  let sum = 0;
  for (let i = 0; i < px.length; i += 4) sum += (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) / 255;
  return sum / (px.length / 4) || 0.5;
}

/** GLSL added to the fragment shader's header: the uniforms and the triplanar sampler. */
export const DETAIL_FRAGMENT_HEADER = /* glsl */ `
uniform sampler2D detailMap;
uniform float detailMean;
uniform vec2 detailTile;
uniform vec2 detailStrength;
uniform vec2 detailFade;
varying vec3 vDetailWorld;
varying vec3 vDetailNormal;
float detailLum(vec2 uv) {
  return dot(texture2D(detailMap, uv).rgb, vec3(0.299, 0.587, 0.114)) / detailMean;
}
float detailTriplanar(vec3 p, vec3 w, float tile) {
  vec3 q = p / tile;
  return detailLum(q.zy) * w.x + detailLum(q.xz) * w.y + detailLum(q.xy) * w.z;
}
`;

/** GLSL run after the base map is applied: multiply in both octaves, each fading with distance. */
export const DETAIL_FRAGMENT_BODY = /* glsl */ `
{
  vec3 w = pow(abs(normalize(vDetailNormal)), vec3(4.0));
  w /= (w.x + w.y + w.z);
  float dist = length(vDetailWorld - cameraPosition);
  float fine = detailTriplanar(vDetailWorld, w, detailTile.x);
  float coarse = detailTriplanar(vDetailWorld, w, detailTile.y);
  float kf = detailStrength.x * (1.0 - smoothstep(detailFade.x * 0.4, detailFade.x, dist));
  float kc = detailStrength.y * (1.0 - smoothstep(detailFade.y * 0.4, detailFade.y, dist));
  diffuseColor.rgb *= mix(1.0, fine, kf) * mix(1.0, coarse, kc);
}
`;

/** Inserts the detail map into a MeshStandardMaterial's shaders (its onBeforeCompile). */
export function injectDetailMap(
  shader: { vertexShader: string; fragmentShader: string; uniforms: Record<string, THREE.IUniform> },
  uniforms: Record<string, THREE.IUniform>,
): void {
  Object.assign(shader.uniforms, uniforms);
  const need = (source: string, anchor: string) => {
    if (!source.includes(anchor)) throw new Error(`detail map: shader anchor ${anchor} is missing (three.js changed?)`);
  };
  need(shader.vertexShader, '#include <common>');
  need(shader.vertexShader, '#include <project_vertex>');
  need(shader.fragmentShader, '#include <common>');
  need(shader.fragmentShader, '#include <map_fragment>');
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vDetailWorld;\nvarying vec3 vDetailNormal;')
    .replace('#include <project_vertex>', `#include <project_vertex>
  vDetailWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
  vDetailNormal = normalize(mat3(modelMatrix) * objectNormal);`);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>\n${DETAIL_FRAGMENT_HEADER}`)
    .replace('#include <map_fragment>', `#include <map_fragment>\n${DETAIL_FRAGMENT_BODY}`);
}

/**
 * Gives a terrain material a detail map (the texture is set to repeat). Returns `measure`: call it once
 * the detail texture's image has loaded, to normalise by its average brightness (a neutral guess until then).
 */
export function applyDetailMap(material: THREE.MeshStandardMaterial, detail: THREE.Texture, opts: DetailMapOptions = ISLAND_DETAIL): { measure(): void } {
  detail.wrapS = detail.wrapT = THREE.RepeatWrapping;
  const uniforms: Record<string, THREE.IUniform> = {
    detailMap: { value: detail },
    detailMean: { value: 0.5 },
    detailTile: { value: new THREE.Vector2(opts.fineTile, opts.coarseTile) },
    detailStrength: { value: new THREE.Vector2(opts.fineStrength, opts.coarseStrength) },
    detailFade: { value: new THREE.Vector2(opts.fineFade, opts.coarseFade) },
  };
  material.onBeforeCompile = (shader) => injectDetailMap(shader, uniforms);
  material.customProgramCacheKey = () => 'island-detail-map';
  material.userData.detail = uniforms;
  return {
    measure() {
      const image = detail.image as (CanvasImageSource & { width: number; height: number }) | undefined;
      if (image?.width && typeof document !== 'undefined') uniforms.detailMean.value = meanLuminance(image);
    },
  };
}
