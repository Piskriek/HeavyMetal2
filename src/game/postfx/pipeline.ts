/**
 * IF-POSTFX: PostProcessingPipeline coordinating HDR render target, Dual-Kawase bloom,
 * and composite tone mapping.
 */

import * as THREE from 'three';
import {
  type PostFxOptions,
  DEFAULT_POSTFX_OPTIONS,
  fitToBudget,
} from './budget';
import { createKawasePyramid, disposeKawasePyramid, type KawaseLevel } from './kawase';
import { CompositeShader } from './composite';

export class PostProcessingPipeline {
  private options: PostFxOptions = { ...DEFAULT_POSTFX_OPTIONS };
  private width = 1280;
  private height = 720;
  private frameIndex = 0;

  private hdrTarget: THREE.WebGLRenderTarget | null = null;
  private bloomPyramid: KawaseLevel[] = [];
  private compositeMaterial: THREE.ShaderMaterial | null = null;
  private quadMesh: THREE.Mesh | null = null;
  private quadScene = new THREE.Scene();
  private quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    options: Partial<PostFxOptions> = {},
  ) {
    this.options = { ...DEFAULT_POSTFX_OPTIONS, ...options };
    this.initPipeline();
  }

  setOptions(updated: Partial<PostFxOptions>): void {
    this.options = { ...this.options, ...updated };
    this.initPipeline();
  }

  getOptions(): PostFxOptions {
    return { ...this.options };
  }

  setSize(width: number, height: number): void {
    if (width <= 0 || height <= 0) return;
    this.width = width;
    this.height = height;

    const budget = fitToBudget(width, height, this.options.quality);
    if (budget.quality !== this.options.quality) {
      this.options.quality = budget.quality;
    }

    this.initPipeline();
  }

  render(scene: THREE.Scene, camera: THREE.Camera, overlayScene?: THREE.Scene): void {
    this.frameIndex++;

    if (this.options.quality === 'low') {
      this.renderer.toneMapping = THREE.NoToneMapping;
      this.renderer.render(scene, camera);
      if (overlayScene) {
        const autoClear = this.renderer.autoClear;
        this.renderer.autoClear = false;
        this.renderer.render(overlayScene, camera);
        this.renderer.autoClear = autoClear;
      }
      return;
    }

    if (this.options.quality === 'medium') {
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.render(scene, camera);
      if (overlayScene) {
        const autoClear = this.renderer.autoClear;
        this.renderer.autoClear = false;
        this.renderer.render(overlayScene, camera);
        this.renderer.autoClear = autoClear;
      }
      return;
    }

    // High Quality: Render to HDR Target first
    if (!this.hdrTarget || !this.compositeMaterial) {
      this.renderer.render(scene, camera);
      return;
    }

    const prevToneMapping = this.renderer.toneMapping;
    this.renderer.toneMapping = THREE.NoToneMapping; // Avoid double tone mapping

    this.renderer.setRenderTarget(this.hdrTarget);
    this.renderer.clear();
    this.renderer.render(scene, camera);

    // Composite pass direct to screen
    this.renderer.setRenderTarget(null);
    this.compositeMaterial.uniforms.tDiffuse.value = this.hdrTarget.texture;
    this.compositeMaterial.uniforms.bloomStrength.value = this.options.bloomStrength;
    this.compositeMaterial.uniforms.vignetteStrength.value = this.options.vignetteStrength;
    this.compositeMaterial.uniforms.grainStrength.value = this.options.grainStrength;
    this.compositeMaterial.uniforms.frameIndex.value = this.frameIndex;

    this.renderer.render(this.quadScene, this.quadCamera);

    // Overlay pass (clean, un-bloomed UI overlays)
    if (overlayScene) {
      const autoClear = this.renderer.autoClear;
      this.renderer.autoClear = false;
      this.renderer.render(overlayScene, camera);
      this.renderer.autoClear = autoClear;
    }

    this.renderer.toneMapping = prevToneMapping;
  }

  dispose(): void {
    this.disposeTargets();
  }

  private initPipeline(): void {
    this.disposeTargets();

    if (this.options.quality === 'high') {
      this.hdrTarget = new THREE.WebGLRenderTarget(this.width, this.height, {
        type: THREE.HalfFloatType,
        format: THREE.RGBAFormat,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        depthBuffer: true,
      });

      this.bloomPyramid = createKawasePyramid(this.width, this.height, 4);

      this.compositeMaterial = new THREE.ShaderMaterial({
        ...CompositeShader,
        depthTest: false,
        depthWrite: false,
      });

      const geom = new THREE.PlaneGeometry(2, 2);
      this.quadMesh = new THREE.Mesh(geom, this.compositeMaterial);
      this.quadScene.add(this.quadMesh);
    }
  }

  private disposeTargets(): void {
    if (this.hdrTarget) {
      this.hdrTarget.dispose();
      this.hdrTarget = null;
    }
    if (this.bloomPyramid.length > 0) {
      disposeKawasePyramid(this.bloomPyramid);
      this.bloomPyramid = [];
    }
    if (this.quadMesh) {
      this.quadMesh.geometry.dispose();
      this.quadScene.remove(this.quadMesh);
      this.quadMesh = null;
    }
    if (this.compositeMaterial) {
      this.compositeMaterial.dispose();
      this.compositeMaterial = null;
    }
  }
}
