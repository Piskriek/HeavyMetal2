import * as THREE from 'three';
import type { SurfaceArray } from './surface-set';
import { COLOR_STAGE_GLSL, EMISSIVE_STAGE_GLSL, GLOBALS_GLSL, NOISE_GLSL, NORMAL_STAGE_GLSL, ROUGH_STAGE_GLSL, tileGlsl, uniformsGlsl } from './terrain-glsl';
import { bakeFlatBlocks, blockGridFor, type BlockGrid } from './flat-blocks';

/** What the renderer needs of a terrain (structurally the terrain package's Terrain; no import, so render stays independent). */
export interface TerrainLike {
  readonly spec: { readonly cols: number; readonly rows: number; readonly cell: number; readonly originX: number; readonly originZ: number };
  readonly heights: Float32Array;
  readonly surfaceA: Uint8Array;
  readonly surfaceB: Uint8Array;
  readonly blend: Uint8Array;
}
export interface DirtyRectLike { readonly c0: number; readonly r0: number; readonly c1: number; readonly r1: number }

export interface TerrainLook {
  /** Surface id that walls and cliffs wear regardless of the mask (0 = off). */
  cliffSurface: number;
  /** 0 = crisp height-led borders, 1 = long soft fades. */
  soft: number;
  normalStrength: number;
  /** 'flat' = blocky posterised colour like the voxel goblin; 'pbr' = full relief and roughness. */
  skin?: 'flat' | 'pbr';
  /** Multiplies every tile's size: bigger = calmer from the air. */
  scale: number;
}

/** The terrain mesh, its paint-mask texture and the island material. Rebuilds only what a brush stroke touched. */
export class TerrainView {
  readonly mesh: THREE.Mesh;
  private readonly geometry: THREE.BufferGeometry;
  private readonly mask: THREE.DataTexture;
  private readonly maskData: Uint8Array;
  private readonly material: THREE.MeshStandardMaterial;
  private uniforms: Record<string, THREE.IUniform> | null = null;
  readonly look: TerrainLook = { cliffSurface: 0, soft: 0.6, normalStrength: 1, scale: 1.8 };
  /** The flat skin's surfaces per half-metre block (see flat-blocks.ts); baked while the flat skin shows. */
  private readonly blockGrid: BlockGrid;
  private readonly blockData: Uint8Array;
  private readonly blocks: THREE.DataTexture;
  private blocksStale = true;
  private blocksFullPending = true;

  constructor(private readonly t: TerrainLike, private readonly surfaces: SurfaceArray) {
    const { cols, rows, cell, originX, originZ } = t.spec;
    this.blockGrid = blockGridFor(t.spec);
    this.blockData = new Uint8Array(this.blockGrid.w * this.blockGrid.h * 4);
    this.blocks = new THREE.DataTexture(this.blockData, this.blockGrid.w, this.blockGrid.h, THREE.RGBAFormat, THREE.UnsignedByteType);
    this.blocks.magFilter = this.blocks.minFilter = THREE.NearestFilter;
    this.blocks.generateMipmaps = false;
    this.blocks.flipY = false;
    this.blocks.onUpdate = () => { this.blocksFullPending = false; };
    const pos = new Float32Array(cols * rows * 3);
    const idx = new Uint32Array((cols - 1) * (rows - 1) * 6);
    // diagonal a-d, the same split the physics heightfield uses: (a,d,b) and (a,c,d), counter-clockwise seen from above
    let k = 0;
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const a = r * cols + c, b = a + 1, cc = a + cols, d = cc + 1;
        idx[k++] = a; idx[k++] = d; idx[k++] = b;
        idx[k++] = a; idx[k++] = cc; idx[k++] = d;
      }
    }
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(cols * rows * 3), 3));
    this.geometry.setIndex(new THREE.BufferAttribute(idx, 1));
    this.maskData = new Uint8Array(cols * rows * 4);
    this.mask = new THREE.DataTexture(this.maskData, cols, rows, THREE.RGBAFormat, THREE.UnsignedByteType);
    this.mask.magFilter = THREE.NearestFilter;
    this.mask.minFilter = THREE.NearestFilter;
    this.mask.generateMipmaps = false;
    this.mask.flipY = false;
    this.material = this.buildMaterial();
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
    void originX; void originZ; void cell;
    this.refresh(null);
    surfaces.ready.then(() => { this.material.needsUpdate = false; });
  }

  private buildMaterial(): THREE.MeshStandardMaterial {
    const layers = Math.max(1, this.surfaces.defs.length);
    const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0 });
    const { cols, rows, cell, originX, originZ } = this.t.spec;
    m.onBeforeCompile = (shader) => {
      const u: Record<string, THREE.IUniform> = {
        islSurfaces: { value: this.surfaces.texture }, islPbr: { value: this.surfaces.pbrTexture }, islFlatPalette: { value: this.surfaces.flatTexture },
        islNormalStrength: { value: this.look.normalStrength }, islLayerOf: { value: this.surfaces.layerOf },
        islParams: { value: this.surfaces.params }, islSoft: { value: this.look.soft }, islScale: { value: this.look.scale },
        islCliffLayer: { value: -1 }, islCliffNy: { value: new THREE.Vector2(0.55, 0.3) },
        paintMask: { value: this.mask }, paintRes: { value: new THREE.Vector2(cols, rows) },
        paintOrigin: { value: new THREE.Vector2(originX, originZ) }, paintCell: { value: cell },
        islBlocks: { value: this.blocks }, islBlockOrigin: { value: new THREE.Vector2(this.blockGrid.x0, this.blockGrid.z0) },
        islBlockMax: { value: new THREE.Vector2(this.blockGrid.w - 1, this.blockGrid.h - 1) },
      };
      Object.assign(shader.uniforms, u);
      this.uniforms = shader.uniforms;
      this.applyLook();
      shader.vertexShader = shader.vertexShader
        .replace('void main() {', 'varying vec3 vTWorld;\nvarying vec3 vTNormal;\nvoid main() {')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvTWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvTNormal = normalize(mat3(modelMatrix) * objectNormal);');
      shader.fragmentShader = shader.fragmentShader
        .replace('void main() {', `${NOISE_GLSL}\n${uniformsGlsl(layers)}\n${tileGlsl(layers)}\n${GLOBALS_GLSL}\nvoid main() {`)
        .replace('#include <color_fragment>', COLOR_STAGE_GLSL)
        .replace('#include <roughnessmap_fragment>', ROUGH_STAGE_GLSL)
        .replace('#include <emissivemap_fragment>', EMISSIVE_STAGE_GLSL)
        .replace('#include <normal_fragment_maps>', NORMAL_STAGE_GLSL);
    };
    m.customProgramCacheKey = () => `terrain-${layers}`;
    this.applySkinDefine(m);
    return m;
  }

  /** The flat skin is its own shader program (ISL_FLAT), so it carries none of the PBR path's cost. Switching skins compiles once. */
  private applySkinDefine(m: THREE.MeshStandardMaterial): void {
    const flat = this.look.skin === 'flat';
    const defines: Record<string, unknown> = { ...(m.defines ?? {}) };
    if (flat === ('ISL_FLAT' in defines)) return;
    if (flat) defines['ISL_FLAT'] = ''; else delete defines['ISL_FLAT'];
    m.defines = defines;
    m.needsUpdate = true;
  }

  private applyLook(): void {
    if (!this.uniforms) return;
    const layer = this.look.cliffSurface > 0 ? this.surfaces.layerOf[this.look.cliffSurface] ?? -1 : -1;
    this.uniforms['islCliffLayer']!.value = layer;
    this.uniforms['islSoft']!.value = this.look.soft;
    this.uniforms['islNormalStrength']!.value = this.look.normalStrength;
    this.uniforms['islScale']!.value = this.look.scale;
  }

  setLook(look: Partial<TerrainLook>): void {
    Object.assign(this.look, look);
    this.applySkinDefine(this.material);
    this.applyLook();
    if (this.look.skin === 'flat' && this.blocksStale) this.bakeBlocks(null);
  }

  /** Bake the flat skin's blocks for the nodes in `dirty` (all when null) and upload only the rows that changed. */
  private bakeBlocks(dirty: DirtyRectLike | null): void {
    const { v0, v1 } = bakeFlatBlocks(this.t, this.blockGrid, this.blockData, dirty);
    // row uploads only once the whole texture is on the GPU (a range upload before the first one would leave the other rows empty)
    if (dirty && !this.blocksFullPending) for (let v = v0; v <= v1; v++) this.blocks.addUpdateRange(v * this.blockGrid.w * 4, this.blockGrid.w * 4);
    else { this.blocks.clearUpdateRanges(); this.blocksFullPending = true; }
    this.blocks.needsUpdate = true;
    this.blocksStale = false;
  }

  /** Re-upload the nodes inside `dirty` (or everything when null): positions, normals and the paint mask. */
  refresh(dirty: DirtyRectLike | null): void {
    const { cols, rows, cell, originX, originZ } = this.t.spec;
    const h = this.t.heights;
    const pos = this.geometry.getAttribute('position') as THREE.BufferAttribute;
    const nor = this.geometry.getAttribute('normal') as THREE.BufferAttribute;
    // normals read neighbours, so widen the rect by one node
    const c0 = Math.max(0, (dirty?.c0 ?? 0) - 1), c1 = Math.min(cols - 1, (dirty?.c1 ?? cols - 1) + 1);
    const r0 = Math.max(0, (dirty?.r0 ?? 0) - 1), r1 = Math.min(rows - 1, (dirty?.r1 ?? rows - 1) + 1);
    const at = (c: number, r: number): number => h[Math.min(rows - 1, Math.max(0, r)) * cols + Math.min(cols - 1, Math.max(0, c))]!;
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const i = r * cols + c;
        pos.setXYZ(i, originX + c * cell, h[i]!, originZ + r * cell);
        const dx = (at(c + 1, r) - at(c - 1, r)) / (2 * cell);
        const dz = (at(c, r + 1) - at(c, r - 1)) / (2 * cell);
        const l = Math.hypot(dx, 1, dz);
        nor.setXYZ(i, -dx / l, 1 / l, -dz / l);
        const o = i * 4;
        this.maskData[o] = this.t.surfaceA[i]!;
        this.maskData[o + 1] = this.t.surfaceB[i]!;
        this.maskData[o + 2] = this.t.blend[i]!;
        this.maskData[o + 3] = 255;
      }
    }
    pos.needsUpdate = true;
    nor.needsUpdate = true;
    this.mask.needsUpdate = true;
    if (!dirty) this.geometry.computeBoundingSphere();
    // the PBR skin reads the mask per pixel; the flat skin's blocks are baked when it shows
    if (this.look.skin === 'flat') this.bakeBlocks(this.blocksStale ? null : dirty);
    else this.blocksStale = true;
  }

  dispose(): void {
    this.geometry.dispose();
    this.mask.dispose();
    this.blocks.dispose();
    this.material.dispose();
  }
}
