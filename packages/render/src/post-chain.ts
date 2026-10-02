import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { hexToRgb, type LightSetup, type QualitySpec } from '@hm/lighting';
import { GradeShader } from './grade-shader';

/**
 * The picture-effects chain: scene -> contact shadows (GTAO) -> glow (bloom) -> tone mapping + sRGB (OutputPass) -> colour grade -> edge smoothing.
 * The lighting setup says which effects and how strong; the quality tier says which are allowed. Everything renders in half-float so bright
 * highlights survive until tone mapping. Colour grade runs after tone mapping, in display space.
 */
export class PostChain {
  private readonly composer: EffectComposer;
  private readonly gtao: GTAOPass;
  private readonly bloom: UnrealBloomPass;
  private readonly grade: ShaderPass;
  private readonly fxaa: ShaderPass;
  private width = 1;
  private height = 1;
  private elapsed = 0;
  /** Objects hidden while contact shadows measure depth (the sky dome would otherwise be treated as a wall). */
  hideForAo: THREE.Object3D[] = [];

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, samples: number) {
    const size = renderer.getSize(new THREE.Vector2());
    const pr = renderer.getPixelRatio();
    const target = new THREE.WebGLRenderTarget(Math.max(1, size.x * pr), Math.max(1, size.y * pr), { type: THREE.HalfFloatType, samples });
    this.composer = new EffectComposer(renderer, target);
    this.composer.addPass(new RenderPass(scene, camera));
    this.gtao = new GTAOPass(scene, camera, 512, 512);
    this.gtao.output = GTAOPass.OUTPUT.Default;
    this.gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
    const gtao = this.gtao as unknown as { render: (...a: unknown[]) => void };
    const original = gtao.render.bind(this.gtao);
    gtao.render = (...args: unknown[]): void => {
      const was = this.hideForAo.map((o) => o.visible);
      for (const o of this.hideForAo) o.visible = false;
      original(...args);
      this.hideForAo.forEach((o, i) => { o.visible = was[i] ?? true; });
    };
    this.composer.addPass(this.gtao);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.3, 0.5, 1);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.fxaa = new ShaderPass(FXAAShader);
    this.composer.addPass(this.fxaa);
  }

  setSize(width: number, height: number, pixelRatio: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(this.width, this.height);
    (this.fxaa.material.uniforms.resolution!.value as THREE.Vector2).set(1 / (this.width * pixelRatio), 1 / (this.height * pixelRatio));
    this.grade.uniforms.aspect!.value = this.width / this.height;
  }

  /** Push the setup's effect settings, capped by the quality tier. */
  apply(post: LightSetup['post'], q: QualitySpec, aoSamples = q.aoSamples): void {
    this.bloom.enabled = q.bloom && post.bloom.strength > 0.001;
    this.bloom.strength = post.bloom.strength;
    this.bloom.radius = post.bloom.radius;
    this.bloom.threshold = post.bloom.threshold;
    this.gtao.enabled = q.ssao && post.ssao.enabled && post.ssao.intensity > 0.001;
    this.gtao.blendIntensity = post.ssao.intensity;
    this.gtao.updateGtaoMaterial({ radius: post.ssao.radius, distanceExponent: 1.5, thickness: 1, scale: 1, samples: aoSamples });
    const u = this.grade.uniforms;
    const lift = hexToRgb(post.lift), gamma = hexToRgb(post.gamma), gain = hexToRgb(post.gain);
    (u.lift!.value as THREE.Vector3).set((lift[0] - 0.5) * 0.5, (lift[1] - 0.5) * 0.5, (lift[2] - 0.5) * 0.5);
    (u.gamma!.value as THREE.Vector3).set(gamma[0] * 2, gamma[1] * 2, gamma[2] * 2);
    (u.gain!.value as THREE.Vector3).set(gain[0] * 2, gain[1] * 2, gain[2] * 2);
    u.saturation!.value = post.saturation;
    u.contrast!.value = post.contrast;
    u.posterize!.value = post.posterize;
    u.vignetteDarkness!.value = post.vignette.darkness;
    u.vignetteOffset!.value = post.vignette.offset;
    u.grain!.value = post.grain;
    this.fxaa.enabled = post.fxaa;
  }

  render(dtSeconds: number): void {
    this.elapsed += dtSeconds;
    this.grade.uniforms.time!.value = this.elapsed;
    this.composer.render(dtSeconds);
  }

  dispose(): void {
    this.composer.dispose();
  }
}
