import * as THREE from 'three';

/**
 * Placed particle effects (F12, hotbar spec V3): the buffer a CPU particle system fills each frame (@hm/particles, 8 floats a particle:
 * x, y, z, size in metres, r, g, b, a) drawn as soft round points. One layer glows (additive: fire, sparks), one does not (smoke, snow).
 * The buffer is uploaded as it is, no copying.
 */
export const PARTICLE_STRIDE = 8;
export type ParticleLayerId = 'glow' | 'plain';

const VERT = `
uniform float uScale; attribute float aSize; attribute vec4 aColor; varying vec4 vColor;
void main() { vColor = aColor; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = max(1.0, aSize * uScale / max(0.1, -mv.z)); gl_Position = projectionMatrix * mv; }`;
const FRAG = `
varying vec4 vColor;
void main() { vec2 p = gl_PointCoord - 0.5; float d = length(p); if (d > 0.5) discard; gl_FragColor = vec4(vColor.rgb, vColor.a * smoothstep(0.5, 0.1, d)); }`;

export class ParticleLayer {
  readonly points: THREE.Points;
  private readonly data: THREE.InterleavedBuffer;
  private readonly material: THREE.ShaderMaterial;

  constructor(readonly buffer: Float32Array, glow: boolean) {
    this.data = new THREE.InterleavedBuffer(buffer, PARTICLE_STRIDE).setUsage(THREE.DynamicDrawUsage);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.InterleavedBufferAttribute(this.data, 3, 0));
    g.setAttribute('aSize', new THREE.InterleavedBufferAttribute(this.data, 1, 3));
    g.setAttribute('aColor', new THREE.InterleavedBufferAttribute(this.data, 4, 4));
    g.setDrawRange(0, 0);
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, uniforms: { uScale: { value: 600 } },
      transparent: true, depthWrite: false, blending: glow ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = glow ? 22 : 21;
  }

  /** The particles are in the buffer again: draw the first `count`. `scale` turns metres into pixels at 1 m (viewport height / (2 tan(fov / 2))). */
  update(count: number, scale: number): void {
    const n = Math.max(0, Math.min(count, Math.floor(this.buffer.length / PARTICLE_STRIDE)));
    // upload only the live particles, and nothing at all while none are alive
    if (n > 0) {
      this.data.clearUpdateRanges();
      this.data.addUpdateRange(0, n * PARTICLE_STRIDE);
      this.data.needsUpdate = true;
    }
    this.points.geometry.setDrawRange(0, n);
    this.points.visible = n > 0;
    this.material.uniforms['uScale']!.value = scale;
  }

  dispose(): void { this.points.geometry.dispose(); this.material.dispose(); }
}
