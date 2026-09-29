/**
 * The builder's hologram: how anything about to be placed previews. Every placement ghost (models,
 * painted cut-outs, decals, ramps, Easy Build's drop spot, lane nodes being drawn) wears this look, so
 * a preview never reads as a real placed piece: a see-through cyan tint over the piece's own painting,
 * a bright rim where its surface turns away, and faint horizontal scanlines in world space.
 *
 * Materials are cached per texture (a model's parts share a few), never one per mesh.
 */
import * as THREE from 'three';

export const HOLOGRAM_COLOR = 0x7fe9ff;

const VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalV;
  varying vec3 vViewV;
  varying float vWorldY;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldY = world.y;
    vec4 mv = viewMatrix * world;
    vViewV = -mv.xyz;
    vNormalV = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  uniform sampler2D map;
  uniform float hasMap;
  uniform vec3 tint;
  uniform float strength;
  varying vec2 vUv;
  varying vec3 vNormalV;
  varying vec3 vViewV;
  varying float vWorldY;
  void main() {
    vec4 tex = hasMap > 0.5 ? texture2D(map, vUv) : vec4(0.85, 0.85, 0.85, 1.0);
    if (tex.a < 0.05) discard;
    float facing = abs(dot(normalize(vNormalV), normalize(vViewV)));
    float rim = pow(1.0 - facing, 2.0);
    float scan = 0.82 + 0.18 * step(0.5, fract(vWorldY / 22.0));
    float lum = dot(tex.rgb, vec3(0.299, 0.587, 0.114));
    vec3 color = tint * (0.35 + 0.75 * lum) * scan + tint * rim * 0.9;
    gl_FragColor = vec4(color, (0.28 + 0.55 * rim) * tex.a * strength);
    #include <colorspace_fragment>
  }
`;

const cache = new Map<THREE.Texture | null, THREE.ShaderMaterial>();

/** The hologram material for a texture (null: untextured), shared. */
export function hologramMaterial(map: THREE.Texture | null = null): THREE.ShaderMaterial {
  let mat = cache.get(map);
  if (!mat) {
    mat = new THREE.ShaderMaterial({
      uniforms: {
        map: { value: map },
        hasMap: { value: map ? 1 : 0 },
        tint: { value: new THREE.Color(HOLOGRAM_COLOR) },
        strength: { value: 1 },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    mat.name = 'Hologram';
    cache.set(map, mat);
  }
  return mat;
}

/** The hologram for a camera-facing sprite: its painting tinted cyan, see-through. */
export function hologramSpriteMaterial(map: THREE.Texture | null): THREE.SpriteMaterial {
  return new THREE.SpriteMaterial({ map, color: HOLOGRAM_COLOR, transparent: true, opacity: 0.6, depthWrite: false });
}

/** Turns every mesh under `root` into a hologram (keeping each one's own texture), and sprites too. */
export function hologramize(root: THREE.Object3D): void {
  root.traverse((o) => {
    const sprite = o as THREE.Sprite;
    if (sprite.isSprite) {
      const old = sprite.material as THREE.SpriteMaterial;
      sprite.material = hologramSpriteMaterial(old.map ?? null);
      return;
    }
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const next = mats.map((m) => hologramMaterial(((m as THREE.MeshBasicMaterial).map as THREE.Texture | undefined) ?? null));
    mesh.material = Array.isArray(mesh.material) ? next : next[0]!;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.renderOrder = 50;
  });
}
