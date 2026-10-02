import * as THREE from 'three';
import type { Vec3 } from '@hm/contracts';
import { lerpSetup, sunDirection, type LampAnchor, type LightSetup, type ToneMappingName } from '@hm/lighting';
import type { EnvironmentRig } from './environment';

/**
 * The lighting rig: turns a LightSetup (a preset) into the actual lights, sky, haze, sea tint, tone mapping and sky reflections of a scene.
 * It keeps a fixed pool of lamps (4 point, 2 spot) so the number of lights never changes and shaders never recompile. A change of setup is a
 * short blend rather than a pop. Sky and reflections share one gradient shader, so reflective surfaces pick up the sky colour they sit under.
 */
export interface LightingContext {
  /** The point of interest (the player's chest, the thing being edited): lamps without a prop hang near it, the fill light aims at it. */
  readonly focus: Vec3;
  /** Where named props are, when the scene has them. */
  readonly anchors?: Partial<Record<LampAnchor, Vec3>>;
  /** Seconds, for lamp flicker. */
  readonly time: number;
}

/** Where a lamp hangs when the scene has no prop of that name: a spot around the point of interest. */
const FALLBACK: Readonly<Record<LampAnchor, Vec3>> = {
  focus: [0, 0, 0],
  lantern: [-2.5, 0.4, 2.2],
  torch: [2.4, 0.3, -1.6],
  campfire: [-3.4, -0.5, -1.2],
  barrel: [3.0, -0.2, 3.0],
};

const TONE: Record<ToneMappingName, THREE.ToneMapping> = {
  none: THREE.NoToneMapping,
  linear: THREE.LinearToneMapping,
  reinhard: THREE.ReinhardToneMapping,
  cineon: THREE.CineonToneMapping,
  aces: THREE.ACESFilmicToneMapping,
  agx: THREE.AgXToneMapping,
  neutral: THREE.NeutralToneMapping,
};

export function createSkyMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color('#2a78dc') },
      horizon: { value: new THREE.Color('#bfe5ff') },
      bottom: { value: new THREE.Color('#dcf2ff') },
      fogColor: { value: new THREE.Color('#ffffff') },
      fogAmt: { value: 0.3 },
      sunDir: { value: new THREE.Vector3(0, 1, 0) },
      sunColor: { value: new THREE.Color('#ffffff') },
      sunGlow: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom;
      uniform vec3 fogColor; uniform float fogAmt;
      uniform vec3 sunDir; uniform vec3 sunColor; uniform float sunGlow;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col;
        if (h > 0.0) col = mix(horizon, top, pow(smoothstep(0.0, 1.0, h), 0.55));
        else col = mix(horizon, bottom, pow(smoothstep(0.0, 1.0, -h), 0.45));
        float haze = (1.0 - smoothstep(0.0, 0.28, abs(h + 0.02))) * fogAmt;
        col = mix(col, fogColor, haze);
        float s = max(dot(d, normalize(sunDir)), 0.0);
        col += sunColor * (pow(s, 6.0) * 0.22 + pow(s, 48.0) * 0.6) * sunGlow;
        col += sunColor * smoothstep(0.99935, 0.9997, s) * 6.0 * min(sunGlow, 1.0);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

const ease = (t: number): number => (t < 1 ? 1 - Math.pow(1 - t, 3) : 1);

export class LightingRig {
  private readonly ambient = new THREE.AmbientLight('#ffffff', 0.1);
  private readonly fill = new THREE.DirectionalLight('#ffffff', 0);
  private readonly points: THREE.PointLight[] = [];
  private readonly spots: THREE.SpotLight[] = [];
  private readonly skyMat = createSkyMaterial();
  private readonly envScene = new THREE.Scene();
  private readonly envSkyMat = createSkyMaterial();
  private readonly pmrem: THREE.PMREMGenerator;
  private envTarget: THREE.WebGLRenderTarget | null = null;
  private envSig = '';
  private envTime = -1;
  private readonly legacySkyMaterial: THREE.ShaderMaterial | null;
  private readonly prevEnvironment: THREE.Texture | null;
  private readonly prevEnvironmentIntensity: number;
  private from: LightSetup;
  private target: LightSetup;
  private blend = 1;
  private blendSeconds = 0.0001;
  private clock = 0;
  private shadowCap = 2048;
  private dirty = true;
  /** The setup as it stands this frame (mid-blend values included). */
  current: LightSetup;

  constructor(private readonly scene: THREE.Scene, private readonly renderer: THREE.WebGLRenderer, private readonly env: EnvironmentRig, initial: LightSetup) {
    this.from = this.target = this.current = initial;
    this.prevEnvironment = scene.environment;
    this.prevEnvironmentIntensity = scene.environmentIntensity;
    const parts = env.parts;
    this.legacySkyMaterial = parts.sky ? parts.sky.material : null;
    if (parts.sky) parts.sky.material = this.skyMat;
    this.envScene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 48, 24), this.envSkyMat));
    this.pmrem = new THREE.PMREMGenerator(renderer);
    scene.add(this.ambient, this.fill, this.fill.target);
    for (let i = 0; i < 4; i++) { const p = new THREE.PointLight('#ffffff', 0, 10, 2); this.points.push(p); scene.add(p); }
    for (let i = 0; i < 2; i++) { const s = new THREE.SpotLight('#ffffff', 0, 16, 0.55, 0.6, 2); this.spots.push(s); scene.add(s, s.target); }
  }

  /** Move towards a setup over `seconds` (0 = at once). */
  set(setup: LightSetup, seconds = 0.6): void {
    if (setup === this.target) return;
    this.from = this.current;
    this.target = setup;
    this.blend = seconds <= 0 ? 1 : 0;
    this.blendSeconds = Math.max(0.0001, seconds);
    this.dirty = true;
  }

  /** Cap on the shadow map size from the quality tier (0 = shadows off). */
  setShadowCap(size: number): void {
    if (size === this.shadowCap) return;
    this.shadowCap = size;
    this.dirty = true;
  }

  /** Call every frame. Returns true when this frame's values differ from the last (so the caller can refresh the picture effects). */
  update(dtSeconds: number, ctx: LightingContext): boolean {
    this.clock = ctx.time;
    let changed = this.dirty;
    if (this.blend < 1) {
      this.blend = Math.min(1, this.blend + dtSeconds / this.blendSeconds);
      this.current = lerpSetup(this.from, this.target, ease(this.blend));
      changed = true;
    } else if (this.current !== this.target) { this.current = this.target; changed = true; }
    // Lamps flicker and follow the point of interest, so a setup with lamps or a back light is refreshed every frame.
    const moving = (this.current.extraLights?.length ?? 0) > 0 || !!this.current.fill;
    if (changed || moving) this.apply(this.current, ctx);
    this.dirty = false;
    return changed;
  }

  private setSkyUniforms(mat: THREE.ShaderMaterial, s: LightSetup): void {
    const u = mat.uniforms;
    (u.top!.value as THREE.Color).set(s.sky.top);
    (u.horizon!.value as THREE.Color).set(s.sky.horizon);
    (u.bottom!.value as THREE.Color).set(s.sky.bottom);
    (u.fogColor!.value as THREE.Color).set(s.fog.color);
    u.fogAmt!.value = Math.min(1, s.fog.density * 30);
    const d = sunDirection(s);
    (u.sunDir!.value as THREE.Vector3).set(d[0], d[1], d[2]);
    (u.sunColor!.value as THREE.Color).set(s.sun.color);
    u.sunGlow!.value = s.sky.sunGlow;
  }

  private updateEnvironmentMap(s: LightSetup): void {
    const sig = [s.sky.top, s.sky.horizon, s.sky.bottom, s.sky.sunGlow.toFixed(2), s.fog.color, s.sun.color, s.sun.azimuthDeg.toFixed(0), s.sun.elevationDeg.toFixed(0), s.fog.density.toFixed(3)].join('|');
    if (sig === this.envSig && this.envTarget) return;
    const settled = this.blend >= 1;
    if (this.envTarget && !settled && this.clock - this.envTime < 0.12) return;
    this.setSkyUniforms(this.envSkyMat, s);
    const rt = this.pmrem.fromScene(this.envScene, 0, 0.1, 200);
    this.envTarget?.dispose();
    this.envTarget = rt;
    this.envSig = sig;
    this.envTime = this.clock;
    this.scene.environment = rt.texture;
  }

  private apply(s: LightSetup, ctx: LightingContext): void {
    const { sun, hemisphere } = this.env.parts;
    const dir = sunDirection(s);
    this.env.setSunDirection(dir);
    sun.color.set(s.sun.color);
    sun.intensity = s.sun.intensity;
    const size = Math.min(this.shadowCap, s.sun.shadowMapSize);
    this.env.setShadows(size > 0, Math.max(256, size));
    sun.shadow.radius = Math.max(0.01, s.sun.shadowSoftness * 1.5 * (Math.max(256, size) / 2048));
    sun.shadow.intensity = 1 - Math.min(0.32, Math.max(0, s.sun.shadowSoftness - 2) * 0.03);

    hemisphere.color.set(s.hemi.sky);
    hemisphere.groundColor.set(s.hemi.ground);
    hemisphere.intensity = s.hemi.intensity;
    this.ambient.color.set(s.ambient.color);
    this.ambient.intensity = s.ambient.intensity;

    const f = ctx.focus;
    if (s.fill) {
      this.fill.color.set(s.fill.color);
      this.fill.intensity = s.fill.intensity;
      this.fill.position.set(f[0] + s.fill.position[0], f[1] + s.fill.position[1], f[2] + s.fill.position[2]);
      this.fill.target.position.set(f[0], f[1], f[2]);
    } else this.fill.intensity = 0;

    let pi = 0, si = 0;
    const flick = (i: number): number => 1 + 0.07 * Math.sin(this.clock * 13 + i * 3.1) * Math.sin(this.clock * 7.3 + i);
    for (const l of s.extraLights ?? []) {
      const base = ctx.anchors?.[l.anchor] ?? [f[0] + FALLBACK[l.anchor][0], f[1] + FALLBACK[l.anchor][1], f[2] + FALLBACK[l.anchor][2]];
      const x = base[0] + l.offset[0], y = base[1] + l.offset[1], z = base[2] + l.offset[2];
      if (l.type === 'point' && pi < this.points.length) {
        const p = this.points[pi++]!;
        p.color.set(l.color); p.intensity = l.intensity * flick(pi); p.distance = l.distance; p.position.set(x, y, z);
      } else if (l.type === 'spot' && si < this.spots.length) {
        const sp = this.spots[si++]!;
        sp.color.set(l.color); sp.intensity = l.intensity; sp.distance = l.distance; sp.position.set(x, y, z);
        sp.target.position.set(f[0], f[1] - 0.6, f[2]);
      }
    }
    for (; pi < this.points.length; pi++) this.points[pi]!.intensity = 0;
    for (; si < this.spots.length; si++) this.spots[si]!.intensity = 0;

    this.setSkyUniforms(this.skyMat, s);
    this.env.setFog(new THREE.Color(s.fog.color), Math.max(0.0013, s.fog.density));
    this.env.setWater(new THREE.Color(s.water.color), s.water.opacity, s.water.roughness);

    this.updateEnvironmentMap(s);
    this.scene.environmentIntensity = Math.min(2, s.hemi.intensity * 0.5);

    this.renderer.toneMapping = TONE[s.toneMapping] ?? THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = s.exposure;
  }

  /** The sky dome, so effects that measure depth can hide it. */
  get skyMesh(): THREE.Object3D | null { return this.env.parts.sky; }

  dispose(): void {
    const sky = this.env.parts.sky;
    if (sky && this.legacySkyMaterial) sky.material = this.legacySkyMaterial;
    this.scene.remove(this.ambient, this.fill, this.fill.target, ...this.points, ...this.spots, ...this.spots.map((s) => s.target));
    this.scene.environment = this.prevEnvironment;
    this.scene.environmentIntensity = this.prevEnvironmentIntensity;
    this.envTarget?.dispose();
    this.pmrem.dispose();
    this.skyMat.dispose();
    this.envSkyMat.dispose();
    this.envScene.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.geometry.dispose(); });
  }
}
