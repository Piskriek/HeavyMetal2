// One sprite skin as one instanced draw call: every monster of the skin is a camera-facing billboard whose feet stand on its ground
// point. Per instance the batch writes the anchor, the atlas rectangle of the view picked this frame (a mirrored view flips its U,
// with the origin mirrored too) and the quad's box around the anchor, in metres. Unlit, with the scene's fog (pixel art is pre-lit).
import * as THREE from 'three';
import { SPRITE_OVERLAY_BODY, SPRITE_OVERLAY_FRAG, SPRITE_OVERLAY_VERT, pulseFor, sliceFor, type Look } from './overlay';
import type { SpriteAsset, SpriteView } from './loader';
import { bearing, frameIndex, pickView, type Play } from './timing';

/** One monster in a batch: where it stands, which way it faces, and what it is doing (its phase time is in seconds). */
export interface SpriteSlot {
  readonly x: number;
  readonly z: number;
  /** The ground height under the feet (0 when not given). */
  readonly y?: number;
  readonly yaw: number;
  readonly play: Play;
  readonly phaseT: number;
}

const VERT = /* glsl */ `
attribute vec3 aAnchor;
attribute vec4 aFrame;
attribute vec4 aBox;
varying vec2 vUv;
${SPRITE_OVERLAY_VERT}
#include <fog_pars_vertex>
void main() {
  vUv = vec2(aFrame.x + uv.x * aFrame.z, aFrame.y + (1.0 - uv.y) * aFrame.w);
  vec4 mvPosition = modelViewMatrix * vec4(aAnchor, 1.0);
  mvPosition.xy += vec2(mix(aBox.x, aBox.z, uv.x), mix(aBox.y, aBox.w, uv.y));
  mvPosition.x += uSlice * sin(floor(uv.y * 12.0) * 12.9898 + uTime * 9.0) * 0.05;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const FRAG = /* glsl */ `
uniform sampler2D uAtlas;
uniform vec3 uTint;
${SPRITE_OVERLAY_FRAG}
varying vec2 vUv;
#include <fog_pars_fragment>
void main() {
  vec4 c = texture2D(uAtlas, vUv);
  if (c.a < 0.5) discard;
${SPRITE_OVERLAY_BODY}
  #include <fog_fragment>
}
`;

export class SpriteBatch {
  readonly mesh: THREE.Mesh;
  private readonly geo: THREE.InstancedBufferGeometry;
  private readonly anchor: THREE.InstancedBufferAttribute;
  private readonly frame: THREE.InstancedBufferAttribute;
  private readonly box: THREE.InstancedBufferAttribute;
  private slots: SpriteSlot[] = [];
  private readonly uniforms: Record<string, THREE.IUniform>;
  /** The frame's wind-up pulse and glitch slice (the strongest of the batch's monsters). */
  private pulseNow = 0.2;
  private sliceNow = 0;
  /** Slots that did not fit this frame (the batch's capacity). */
  dropped = 0;

  constructor(readonly asset: SpriteAsset, readonly capacity: number, tint: readonly [number, number, number] = [1, 1, 1], look: Look = { rim: 0x3dc8ff, remap: 0.2, levels: 0 }) {
    const quad = new THREE.PlaneGeometry(1, 1);
    this.geo = new THREE.InstancedBufferGeometry();
    this.geo.setIndex(quad.index);
    this.geo.setAttribute('position', quad.attributes.position!);
    this.geo.setAttribute('uv', quad.attributes.uv!);
    quad.dispose();
    this.anchor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    this.frame = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
    this.box = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
    this.anchor.setUsage(THREE.DynamicDrawUsage);
    this.frame.setUsage(THREE.DynamicDrawUsage);
    this.box.setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('aAnchor', this.anchor);
    this.geo.setAttribute('aFrame', this.frame);
    this.geo.setAttribute('aBox', this.box);
    this.geo.instanceCount = 0;
    const img = asset.texture.image as { width?: number; height?: number } | undefined;
    const tw = img?.width || 1;
    const th = img?.height || 1;
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
        uAtlas: { value: asset.texture },
        uTint: { value: new THREE.Vector3(tint[0], tint[1], tint[2]) },
        uRim: { value: new THREE.Color(look.rim) },
        uPulse: { value: 0.2 },
        uRemap: { value: look.remap },
        uLevels: { value: look.levels },
        uSlice: { value: 0 },
        uTime: { value: 0 },
        uTexel: { value: new THREE.Vector2(1 / tw, 1 / th) },
      }]),
      fog: true,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(this.geo, mat);
    this.uniforms = mat.uniforms;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.mesh.name = `monster-sprite:${asset.id}`;
  }

  /** Starts a frame: the slots from the last frame are dropped. */
  begin(): void {
    this.slots = [];
    this.dropped = 0;
    this.pulseNow = 0.2;
    this.sliceNow = 0;
  }

  /** The ground's quantisation steps (the stage the monster stands on; 0 is smooth). */
  setLevels(levels: number): void {
    this.uniforms['uLevels']!.value = levels;
  }

  /** Adds a monster to this frame; false when the batch is full. */
  push(slot: SpriteSlot): boolean {
    if (this.slots.length >= this.capacity) {
      this.dropped++;
      return false;
    }
    this.slots.push(slot);
    const windup = slot.play.group === 'attack' && slot.play.mode === 'hold';
    this.pulseNow = Math.max(this.pulseNow, pulseFor(windup ? slot.phaseT : null));
    this.sliceNow = Math.max(this.sliceNow, sliceFor(windup ? 'windup' : slot.play.group === 'pain' ? 'pain' : 'other'));
    return true;
  }

  get count(): number {
    return this.slots.length;
  }

  /** Writes every slot's view for the camera at (cx, cz), and the frame of its phase. Returns the number drawn. */
  update(cx: number, cz: number): number {
    this.uniforms['uPulse']!.value = this.pulseNow;
    this.uniforms['uSlice']!.value = this.sliceNow;
    this.uniforms['uTime']!.value = performance.now() / 1000;
    const a = this.asset;
    const W = a.width, H = a.height;
    let drawn = 0;
    this.slots.forEach((s, i) => {
      const group = a.groups[s.play.group];
      const pick = pickView(s.yaw, bearing(s.x, s.z, cx, cz));
      const frame = group.frames[frameIndex(group.frames.length, group.ticks, s.phaseT, s.play.mode)];
      const v = frame ? resolveView(frame.views, pick.index) : null;
      if (!v) {
        this.frame.setXYZW(i, 0, 0, 0, 0);
        this.box.setXYZW(i, 0, 0, 0, 0);
        this.anchor.setXYZ(i, s.x, s.y ?? 0, s.z);
        return;
      }
      const mpp = a.mpp;
      // a mirrored view is drawn flipped, with its origin at the mirrored x (the atlas stores the origin of the source view)
      const ox = v.mirrored ? v.w - v.ox : v.ox;
      const u0 = v.mirrored ? (v.x + v.w) / W : v.x / W;
      const du = (v.mirrored ? -v.w : v.w) / W;
      this.frame.setXYZW(i, u0, v.y / H, du, v.h / H);
      this.box.setXYZW(i, -ox * mpp, -(v.h - v.oy) * mpp, (v.w - ox) * mpp, v.oy * mpp);
      this.anchor.setXYZ(i, s.x, s.y ?? 0, s.z);
      drawn++;
    });
    this.geo.instanceCount = this.slots.length;
    this.anchor.needsUpdate = true;
    this.frame.needsUpdate = true;
    this.box.needsUpdate = true;
    this.mesh.visible = this.slots.length > 0;
    return drawn;
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.geo.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}

/** The view for `index`, or the nearest one that exists when a view is missing from the atlas (none are, in the packed set). */
export function resolveView(views: readonly (SpriteView | null)[], index: number): SpriteView | null {
  for (let d = 0; d < views.length; d++) {
    const a = views[(index + d) % views.length];
    if (a) return a;
    const b = views[(index - d + views.length) % views.length];
    if (b) return b;
  }
  return null;
}
