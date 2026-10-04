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
  /** The style: 'flat' = voxel blocks, posterised colour like the voxel avatars; 'pbr' = the painted ground. */
  skin?: 'flat' | 'pbr';
  /**
   * The detail (the owner's Flat / PBR buttons): normals, shine and height detail on or off, in either style. Left out: the painted ground
   * has it, the voxel blocks do not (as before).
   */
  detail?: boolean;
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
  /** Low tier, flat skin: plain diffuse lighting. The flat ground is matte (roughness 0.92), so it looks the same for much less work. */
  private lambert: THREE.MeshLambertMaterial | null = null;
  private lowCost = false;
  private forceFlat = false;
  /** Shared by both materials, so a change of look reaches whichever is drawing. */
  private readonly uniforms: Record<string, THREE.IUniform>;
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
    this.uniforms = {
      islSurfaces: { value: surfaces.texture }, islPbr: { value: surfaces.pbrTexture }, islFlatPalette: { value: surfaces.flatTexture },
      islVoxel: { value: surfaces.voxelTexture }, islVoxelPbr: { value: surfaces.voxelPbrTexture }, islVoxelVariants: { value: surfaces.voxelVariants },
      islNormalStrength: { value: this.look.normalStrength }, islLayerOf: { value: surfaces.layerOf },
      islParams: { value: surfaces.params }, islTurn: { value: surfaces.turn }, islAnim: { value: surfaces.anim }, islTime: { value: 0 }, islSoft: { value: this.look.soft }, islScale: { value: this.look.scale },
      islCliffLayer: { value: -1 }, islCliffNy: { value: new THREE.Vector2(0.55, 0.3) },
      paintMask: { value: this.mask }, paintRes: { value: new THREE.Vector2(cols, rows) },
      paintOrigin: { value: new THREE.Vector2(originX, originZ) }, paintCell: { value: cell },
      islBlocks: { value: this.blocks }, islBlockOrigin: { value: new THREE.Vector2(this.blockGrid.x0, this.blockGrid.z0) },
      islBlockMax: { value: new THREE.Vector2(this.blockGrid.w - 1, this.blockGrid.h - 1) },
    };
    this.material = this.hook(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0 }), 'terrain');
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
    void originX; void originZ; void cell;
    this.refresh(null);
    surfaces.ready.then(() => { this.material.needsUpdate = false; });
  }

  /** Teach a three.js material the island surface (its colour, roughness, bump and glow stages). Lambert simply has no roughness stage. */
  private hook<M extends THREE.MeshStandardMaterial | THREE.MeshLambertMaterial>(m: M, key: string): M {
    const layers = Math.max(1, this.surfaces.defs.length);
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms);
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
    m.customProgramCacheKey = () => `${key}-${layers}`;
    this.applySkinDefine(m);
    return m;
  }

  /** Graphics 'flatGround': draw the flat skin whatever the look says (the PBR skin is the heaviest thing to draw). */
  setForceFlat(on: boolean): void {
    if (on === this.forceFlat) return;
    this.forceFlat = on;
    this.setLook({});
  }

  /** The skin actually drawn. */
  private flat(): boolean {
    return this.forceFlat || this.look.skin === 'flat';
  }

  /** Low tier: the flat skin draws with plain diffuse lighting (the PBR skin keeps full lighting: its bumps and shine are the point). */
  setLowCost(on: boolean): void {
    this.lowCost = on;
    this.pickMaterial();
  }

  /** Normals, shine and height detail on (the PBR detail), in whichever style. */
  private detail(): boolean {
    return this.look.detail ?? !this.flat();
  }

  private pickMaterial(): void {
    // plain voxel blocks light the same with a diffuse-only material; voxel blocks with detail need the full one for their bumps and shine
    if (this.lowCost && this.flat() && !this.detail()) {
      this.lambert ??= this.hook(new THREE.MeshLambertMaterial({ color: 0xffffff }), 'terrain-lambert');
      this.mesh.material = this.lambert;
    } else this.mesh.material = this.material;
  }

  /**
   * Each combination is its own shader program, so none carries another's cost: ISL_FLAT the voxel style; ISL_DETAIL voxel blocks with
   * normals, shine and height detail; ISL_PLAIN the painted ground without them. Switching compiles once.
   */
  private applySkinDefine(m: THREE.MeshStandardMaterial | THREE.MeshLambertMaterial): void {
    const flat = this.flat(), detail = this.detail();
    const want: Record<string, boolean> = { ISL_FLAT: flat, ISL_DETAIL: flat && detail, ISL_PLAIN: !flat && !detail };
    const defines: Record<string, unknown> = { ...(m.defines ?? {}) };
    let changed = false;
    for (const [k, on] of Object.entries(want)) { if (on === (k in defines)) continue; changed = true; if (on) defines[k] = ''; else delete defines[k]; }
    if (!changed) return;
    m.defines = defines;
    m.needsUpdate = true;
  }

  private applyLook(): void {
    const layer = this.look.cliffSurface > 0 ? this.surfaces.layerOf[this.look.cliffSurface] ?? -1 : -1;
    this.uniforms['islCliffLayer']!.value = layer;
    this.uniforms['islSoft']!.value = this.look.soft;
    this.uniforms['islNormalStrength']!.value = this.look.normalStrength;
    this.uniforms['islScale']!.value = this.look.scale;
  }

  /** The clock for moving surfaces (texture mode's Animate), in seconds. */
  tick(seconds: number): void { this.uniforms['islTime']!.value = seconds % 3600; }

  setLook(look: Partial<TerrainLook>): void {
    Object.assign(this.look, look);
    this.applySkinDefine(this.material);
    if (this.lambert) this.applySkinDefine(this.lambert);
    this.pickMaterial();
    this.applyLook();
    if (this.flat() && this.blocksStale) this.bakeBlocks(null);
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
    if (this.flat()) this.bakeBlocks(this.blocksStale ? null : dirty);
    else this.blocksStale = true;
  }

  dispose(): void {
    this.geometry.dispose();
    this.mask.dispose();
    this.blocks.dispose();
    this.material.dispose();
    this.lambert?.dispose();
  }
}
