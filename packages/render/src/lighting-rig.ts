import * as THREE from 'three';
import { LightProbeGenerator } from 'three/examples/jsm/lights/LightProbeGenerator.js';
import type { Vec3 } from '@hm/contracts';
import { lerpSetup, sunDirection, type LampAnchor, type LightSetup, type ToneMappingName } from '@hm/lighting';
import type { EnvironmentRig } from './environment';

/**
 * The lighting rig: turns a LightSetup (a preset) into the actual lights, sky, haze, sea tint, tone mapping and sky reflections of a scene.
 * It keeps a fixed pool of lamps (4 point, 2 spot); lamps that are dark are left out of the scene, because three.js shades every light for
 * every pixel even at zero brightness (on integrated graphics the dark pool cost a third of the frame). Shaders recompile once when a setup
 * gains or loses lamps. A change of setup is a short blend rather than a pop. Sky and reflections share one gradient shader, so reflective
 * surfaces pick up the sky colour they sit under. On the low tier the sky's soft light comes from a light probe (9 numbers) instead of the
 * reflection map.
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
    // drawn after the solid objects with the depth test on, so its clouds are only worked out for the sky you can see (see environment.ts)
    depthTest: true,
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
      clouds: { value: 0.3 },
      time: { value: 0 },
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
      uniform float clouds; uniform float time;
      varying vec3 vDir;
      float cHash(vec2 p) { p = fract(p * vec2(127.1, 311.7)); p += dot(p, p + 19.19); return fract(p.x * p.y); }
      float cNoise(vec2 p) {
        vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
        return mix(mix(cHash(i), cHash(i + vec2(1.0, 0.0)), u.x), mix(cHash(i + vec2(0.0, 1.0)), cHash(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      float cFbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * cNoise(p); p = p * 2.03 + vec2(17.1, 9.2); a *= 0.5; } return s; }
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
        // clouds: a drifting layer above the horizon, lit on the sun's side, as dark as the sky at night, thinning towards the horizon
        if (h > 0.0 && clouds > 0.001) {
          vec2 uv = d.xz / (h + 0.12) * 1.3 + vec2(time * 0.010, time * 0.004);
          float n = cFbm(uv);
          float t = 0.48 + (0.5 - clouds) * 0.4;
          float c = smoothstep(t - 0.04, t + 0.14, n) * smoothstep(0.0, 0.16, h);
          float bright = clamp(max(dot(top, vec3(0.3333)), dot(horizon, vec3(0.3333))) * 1.6, 0.05, 1.0);
          float lit = 0.72 + 0.38 * s;
          vec3 cloudCol = mix(horizon, vec3(1.0), 0.55) * lit * bright;
          cloudCol = mix(cloudCol, cloudCol * 0.62, smoothstep(t + 0.05, t + 0.35, n) * 0.6);
          cloudCol += sunColor * pow(s, 10.0) * 0.35 * sunGlow;
          col = mix(col, cloudCol, c * 0.92);
        }
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
  private reflections = true;
  private cloudsOn = true;
  /** Low tier: the sky's soft light as spherical harmonics, measured from the same sky the reflection map is made of. */
  private readonly probe = new THREE.LightProbe();
  private probeTarget: THREE.WebGLCubeRenderTarget | null = null;
  private probeCamera: THREE.CubeCamera | null = null;
  private probeSig = '';
  private probeTime = -1;
  private probeBusy = false;
  private readonly seaSky = new THREE.Color();
  private readonly skyTop = new THREE.Color();
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
    this.probe.visible = false;
    scene.add(this.probe);
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

  /**
   * Sky reflections (an environment map lighting every PBR material). Off on the low tier: on a laptop's integrated graphics it costs
   * about a third of the frame. A light probe gives the same soft sky light instead (no shine), so colours stay as they were.
   */
  /** Graphics 'clouds': off, the sky is the plain gradient (the lightest tier). */
  setClouds(on: boolean): void {
    if (on === this.cloudsOn) return;
    this.cloudsOn = on;
    this.envSig = '';
    this.probeSig = '';
    this.dirty = true;
  }

  setReflections(on: boolean): void {
    if (on === this.reflections) return;
    this.reflections = on;
    this.envSig = '';
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
    // with clouds off the sky shader skips its cloud noise altogether (it only runs while clouds > 0)
    u.clouds!.value = this.cloudsOn ? s.sky.clouds ?? 0.3 : 0;
  }

  private updateEnvironmentMap(s: LightSetup): void {
    const sig = [s.sky.top, s.sky.horizon, s.sky.bottom, s.sky.sunGlow.toFixed(2), (s.sky.clouds ?? 0.3).toFixed(2), s.fog.color, s.sun.color, s.sun.azimuthDeg.toFixed(0), s.sun.elevationDeg.toFixed(0), s.fog.density.toFixed(3)].join('|');
    this.probe.visible = !this.reflections;
    if (!this.reflections) {
      if (this.scene.environment) { this.scene.environment = null; this.envTarget?.dispose(); this.envTarget = null; }
      this.updateProbe(s, sig);
      return;
    }
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

  /** Measure the sky into the light probe: a tiny cube render, read back off the main path; throttled while a setup blends. */
  private updateProbe(s: LightSetup, sig: string): void {
    if (sig === this.probeSig || this.probeBusy) return;
    if (this.blend < 1 && this.clock - this.probeTime < 0.25) return;
    this.setSkyUniforms(this.envSkyMat, s);
    if (!this.probeTarget || !this.probeCamera) {
      this.probeTarget = new THREE.WebGLCubeRenderTarget(16, { type: THREE.HalfFloatType });
      this.probeCamera = new THREE.CubeCamera(0.1, 200, this.probeTarget);
      this.envScene.add(this.probeCamera);
    }
    this.probeCamera.update(this.renderer, this.envScene);
    this.probeBusy = true;
    this.probeSig = sig;
    this.probeTime = this.clock;
    const target = this.probeTarget;
    LightProbeGenerator.fromCubeRenderTarget(this.renderer, target)
      .then((p) => { if (target === this.probeTarget) this.probe.sh.copy(p.sh); })
      .catch(() => { this.probeSig = ''; })
      .finally(() => { this.probeBusy = false; });
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
    // a dark light still costs every pixel of every lit material (three.js shades all lights in the scene): leave dark ones out.
    // Switching one on or off recompiles the materials once, which only happens when a setup gains or loses its lamps.
    for (const l of [this.fill, ...this.points, ...this.spots]) l.visible = l.intensity > 0;

    this.setSkyUniforms(this.skyMat, s);
    this.skyMat.uniforms.time!.value = ctx.time;
    this.env.setFog(new THREE.Color(s.fog.color), Math.max(0.0013, s.fog.density));
    this.env.setWater(new THREE.Color(s.water.color), s.water.opacity, s.water.roughness);

    this.updateEnvironmentMap(s);
    this.scene.environmentIntensity = Math.min(2, s.hemi.intensity * 0.5);
    this.probe.intensity = this.scene.environmentIntensity;
    this.env.setSeaSky(this.seaSky.set(s.sky.horizon).lerp(this.skyTop.set(s.sky.top), 0.25));

    this.renderer.toneMapping = TONE[s.toneMapping] ?? THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = s.exposure;
  }

  /** The sky dome, so effects that measure depth can hide it. */
  get skyMesh(): THREE.Object3D | null { return this.env.parts.sky; }

  dispose(): void {
    const sky = this.env.parts.sky;
    if (sky && this.legacySkyMaterial) sky.material = this.legacySkyMaterial;
    this.scene.remove(this.ambient, this.fill, this.fill.target, this.probe, ...this.points, ...this.spots, ...this.spots.map((s) => s.target));
    this.probeTarget?.dispose();
    this.probeTarget = null;
    this.scene.environment = this.prevEnvironment;
    this.scene.environmentIntensity = this.prevEnvironmentIntensity;
    this.envTarget?.dispose();
    this.pmrem.dispose();
    this.skyMat.dispose();
    this.envSkyMat.dispose();
    this.envScene.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.geometry.dispose(); });
  }
}
