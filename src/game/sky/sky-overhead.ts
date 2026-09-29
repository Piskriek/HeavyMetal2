/**
 * SKY: a cloud ceiling over the island, seen from below (the Sky window's Overhead clouds): fair-weather
 * patches, a broken layer, or a storm ceiling. Overhead clouds are not billboards: they are a flat
 * layer high above the camera, so they converge to the horizon in true perspective.
 *
 * One big horizontal disc that follows the camera, at the ceiling's world height. Its shader reads a
 * density map (white = thick cloud): the painted deck art (ART-CLOUDS-EPIC,
 * /art/clouds/decks/cloud-deck-<pattern>.png) when it exists, else a procedural painterly noise. The
 * density becomes coverage (how much sky it hides), a lit colour on the thin parts and a shadow colour on
 * the thick undersides (dark for a storm), faded out toward the horizon so it never ends in an edge.
 */
import * as THREE from 'three';
import type { OverheadPattern, SkyOverhead } from './sky-settings';
import { rebase } from '../../platform/asset-base';

export const overheadArtUrl = (pattern: OverheadPattern) => `/art/clouds/decks/cloud-deck-${pattern}.png`;

/** How far the ceiling reaches from the camera (it fades out well before its edge). */
export const OVERHEAD_RADIUS = 900000;

const VERT = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const FRAG = /* glsl */ `
  uniform sampler2D deck;
  uniform float hasDeck;
  uniform float coverage;
  uniform float scale;
  uniform vec3 litColor;
  uniform vec3 shadowColor;
  uniform float darkness;
  uniform float opacity;
  uniform vec2 offset;
  uniform float radius;
  uniform float patternSeed;
  varying vec3 vWorld;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7)) + patternSeed) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int k = 0; k < 5; k++) { v += a * noise(p); p = p * 2.03 + vec2(17.1, 9.2); a *= 0.5; }
    return v;
  }

  void main() {
    vec2 uv = (vWorld.xz + offset) / scale;
    float d;
    if (hasDeck > 0.5) {
      d = texture2D(deck, uv).r;
    } else {
      // Billowing cumulus from warped noise: big soft masses with lumpy edges.
      vec2 q = vec2(fbm(uv * 3.0), fbm(uv * 3.0 + vec2(5.2, 1.3)));
      d = fbm(uv * 3.0 + q * 1.6);
      d = smoothstep(0.25, 0.8, d);
    }
    float t = 1.0 - coverage;
    float a = smoothstep(t - 0.12, t + 0.12, d);
    // The thick middles are the dark undersides; thin edges catch the light.
    float thick = smoothstep(t, 1.0, d);
    vec3 col = mix(litColor, shadowColor, thick * darkness);
    // Fade toward the horizon: far away the layer thins into the sky instead of ending.
    vec3 cam = cameraPosition;
    float dist = length(vWorld.xz - cam.xz);
    float fade = 1.0 - smoothstep(radius * 0.35, radius * 0.95, dist);
    gl_FragColor = vec4(col, a * opacity * fade);
    #include <colorspace_fragment>
  }
`;

export class OverheadClouds {
  readonly mesh: THREE.Mesh;
  private readonly material: THREE.ShaderMaterial;
  private settings: SkyOverhead | null = null;
  private readonly decks = new Map<OverheadPattern, THREE.Texture | null>();
  private readonly loader = typeof document !== 'undefined' ? new THREE.TextureLoader() : null;

  constructor() {
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        deck: { value: null },
        hasDeck: { value: 0 },
        coverage: { value: 0.6 },
        scale: { value: 48000 },
        litColor: { value: new THREE.Color('#f4f6fa') },
        shadowColor: { value: new THREE.Color('#8494a8') },
        darkness: { value: 0.5 },
        opacity: { value: 0.95 },
        offset: { value: new THREE.Vector2() },
        radius: { value: OVERHEAD_RADIUS },
        patternSeed: { value: 0 },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
    });
    this.mesh = new THREE.Mesh(new THREE.CircleGeometry(OVERHEAD_RADIUS, 96), this.material);
    this.mesh.rotation.x = Math.PI / 2;
    this.mesh.name = 'OverheadClouds';
    this.mesh.renderOrder = -400;
    this.mesh.frustumCulled = false;
    this.mesh.raycast = () => {};
    this.mesh.visible = false;
  }

  /** The Sky window's settings. */
  apply(s: SkyOverhead) {
    this.settings = s;
    this.mesh.visible = s.enabled && s.opacity > 0;
    const u = this.material.uniforms;
    u.coverage.value = s.coverage;
    u.scale.value = s.scale;
    (u.litColor.value as THREE.Color).set(s.color);
    (u.shadowColor.value as THREE.Color).set(s.shadow);
    u.darkness.value = s.darkness;
    u.opacity.value = s.opacity;
    u.patternSeed.value = s.pattern === 'fair' ? 0 : s.pattern === 'broken' ? 3.7 : 9.1;
    this.useDeck(s.pattern);
  }

  /** The painted deck for the pattern (procedural noise until it exists). */
  private useDeck(pattern: OverheadPattern) {
    const u = this.material.uniforms;
    const known = this.decks.get(pattern);
    if (known !== undefined) { u.deck.value = known; u.hasDeck.value = known ? 1 : 0; return; }
    this.decks.set(pattern, null);
    u.deck.value = null; u.hasDeck.value = 0;
    this.loader?.load(rebase(overheadArtUrl(pattern)), (texture) => {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.anisotropy = 8;
      this.decks.set(pattern, texture);
      if (this.settings?.pattern === pattern) { u.deck.value = texture; u.hasDeck.value = 1; }
    }, undefined, () => { /* no art yet: the procedural ceiling stays */ });
  }

  /** Each frame: over the camera at the ceiling's height, drifting with the wind. */
  update(time: number, camera: THREE.Camera, drift: number) {
    if (!this.mesh.visible || !this.settings) return;
    this.mesh.position.set(camera.position.x, this.settings.height, camera.position.z);
    // Above the ceiling (flying high in the editor) it still draws, seen from the top.
    (this.material.uniforms.offset.value as THREE.Vector2).set(time * 180 * this.settings.drift * drift, time * 60 * this.settings.drift * drift);
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
    for (const t of this.decks.values()) t?.dispose();
    this.mesh.removeFromParent();
  }
}
