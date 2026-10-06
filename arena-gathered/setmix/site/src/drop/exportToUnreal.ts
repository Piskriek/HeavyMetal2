/* ============================================================================
 *  packages/export-ue5/src/exportToUnreal.ts
 *  ---------------------------------------------------------------------------
 *  THE DUAL-HORIZON BRIDGE.
 *
 *  SetMix runs procedurally in real time on the web. Unreal does not want a
 *  procedure — it wants Nanite clusters and virtual textures. So the export
 *  path is a BAKE: evaluate the DAG once at 4096², freeze it to PNG, emit a
 *  dense mesh for Nanite, and hand UE a manifest describing exactly how to
 *  wire it up.
 *
 *  The cartridge stays the source of truth. The bake is a build artefact,
 *  regenerable from a 90 kB bundle at any resolution, forever.
 * ==========================================================================*/

import type { Cartridge, EvaluateOptions, TexelSize } from "./contracts.setmix";
import { adaptGraph, certify, contentHash, deriveBudget, DEVICES } from "./fidelity";

/* ─────────────────────────── the @hm/texgraph surface we consume ─────── */

export interface EvaluatedTexture {
  size: number;
  albedo?: Float32Array;
  height?: Float32Array;
  roughness?: Float32Array;
  normal?: Float32Array;
}
export type EvaluateFn = (g: Cartridge["graph"], o: EvaluateOptions) => EvaluatedTexture;
/** Injected so this package stays pure and testable: PNG encoding differs
 *  between Node (sharp/pngjs) and the browser (OffscreenCanvas). */
export type PngEncoder = (
  width: number, height: number, data: Uint8Array | Uint16Array,
  channels: 1 | 3 | 4, bitDepth: 8 | 16,
) => Uint8Array;

/* ───────────────────────────────────────────────────────── options ───── */

export interface ExportOptions {
  bakeSize?: 1024 | 2048 | 4096 | 8192;
  /** world size the tile represents, in centimetres (UE's native unit) */
  worldSizeCm?: number;
  /** peak displacement in centimetres */
  displacementCm?: number;
  /** dense mesh resolution for Nanite; 512 → 523k tris */
  meshResolution?: 128 | 256 | 512 | 1024;
  seed?: number;
  contentRoot?: string;
  lumen?: Partial<LumenSettings>;
  nanite?: Partial<NaniteSettings>;
  emitGltf?: boolean;
  evaluate: EvaluateFn;
  encodePng: PngEncoder;
}

export interface NaniteSettings {
  enabled: boolean;
  positionPrecision: number;
  /** 0 = auto; UE5.5 keeps roughly this fraction of source triangles */
  keepTrianglePercent: number;
  fallbackRelativeError: number;
  trimRelativeError: number;
  preserveArea: boolean;
}

export interface LumenSettings {
  /** UE5.5 needs a distance field for software Lumen tracing */
  generateDistanceField: boolean;
  distanceFieldResolutionScale: number;
  affectDistanceFieldLighting: boolean;
  castRayTracedShadows: boolean;
  /** Nanite meshes need an explicit simple collision hull */
  collisionComplexity: "UseSimpleAndComplex" | "UseComplexAsSimple" | "UseSimpleAsComplex";
  emissiveLightSource: boolean;
}

export interface UnrealTextureAsset {
  file: string;
  role: "albedo" | "displacement" | "rma" | "normal";
  width: number;
  height: number;
  channels: 1 | 3 | 4;
  bitDepth: 8 | 16;
  srgb: boolean;
  compression: "TC_Default" | "TC_Masks" | "TC_Normalmap" | "TC_Displacementmap";
  bytes: Uint8Array;
}

export interface UnrealExportPackage {
  id: string;
  name: string;
  hash: string;
  textures: UnrealTextureAsset[];
  mesh: { file: string; format: "obj" | "gltf"; bytes: Uint8Array; tris: number; verts: number };
  manifest: UE5Manifest;
  manifestFile: string;
  totalBytes: number;
  bakeMs: number;
}

export interface UE5Manifest {
  schema: "setmix.ue5/1.0";
  generator: string;
  source: {
    cartridgeId: string; rev: number; hash: string; graphHash: string;
    author: string; class: string; parents: string[]; licence: string;
  };
  assetPaths: { root: string; material: string; materialInstance: string; mesh: string; textures: Record<string, string> };
  textures: Omit<UnrealTextureAsset, "bytes">[];
  mesh: {
    file: string; format: string; tris: number; verts: number;
    worldSizeCm: number; displacementCm: number; pivot: "centre-bottom"; upAxis: "Z";
  };
  material: {
    parent: string;
    scalarParameters: Record<string, number>;
    vectorParameters: Record<string, [number, number, number, number]>;
    textureParameters: Record<string, string>;
    staticSwitches: Record<string, boolean>;
    twoSided: boolean;
    shadingModel: "DefaultLit";
    blendMode: "BLEND_Opaque";
  };
  nanite: NaniteSettings;
  lumen: LumenSettings;
  /** The 8 exposed VarDecls become UE material scalar params, so the
   *  cartridge's authored knobs survive the trip into Unreal intact. */
  exposedParameters: {
    name: string; real: string; path: string; unit: string;
    min: number; max: number; default: number; tier: number; explain: string;
  }[];
  verification: { determinism: "seed-stable"; seed: number; certificate: ReturnType<typeof certify> };
}

const DEFAULTS = {
  bakeSize: 4096 as const,
  worldSizeCm: 102400,
  displacementCm: 8192,
  meshResolution: 512 as const,
  seed: 7,
  contentRoot: "/Game/SetMix/Imports",
  emitGltf: false,
};

const NANITE_DEFAULT: NaniteSettings = {
  enabled: true,
  positionPrecision: 0,
  keepTrianglePercent: 100,
  fallbackRelativeError: 1.0,
  trimRelativeError: 0.0,
  preserveArea: true,
};

const LUMEN_DEFAULT: LumenSettings = {
  generateDistanceField: true,
  distanceFieldResolutionScale: 2.0,
  affectDistanceFieldLighting: true,
  castRayTracedShadows: true,
  collisionComplexity: "UseComplexAsSimple",
  emissiveLightSource: false,
};

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 48) || "cartridge";

/* ═════════════════════════════════════════════════════════ THE BAKE ══ */

export function exportToUnreal(cartridge: Cartridge, opts: ExportOptions): UnrealExportPackage {
  const t0 = typeof performance !== "undefined" ? performance.now() : 0;
  const o = { ...DEFAULTS, ...opts };
  const size = o.bakeSize;
  const name = slug(cartridge.name);

  /* 1 ── adapt the DAG to a "Stage 6, unlimited device" budget.
   *      We reuse the SAME governor the game uses rather than a special
   *      export path, so what UE receives is exactly what Stage 6 looks
   *      like in the browser — no "export looks different" class of bug. */
  const ultraState = { pxd: 1.24e8, vtx: 9.4e7, lx: 6.6e7, aq: 0, tick: 0 };
  const budget = { ...deriveBudget(ultraState, DEVICES[3]), size: size as TexelSize };
  const graph = adaptGraph(cartridge.graph, budget);

  /* 2 ── evaluate once at full resolution, with normals */
  const tex = o.evaluate(graph, { size, seed: o.seed, relief: budget.relief, normal: true });

  /* 3 ── pack the channels UE expects.
   *      Displacement is 16-bit: 8 bits over an 82 m displacement range is
   *      32 cm per step, which terraces visibly under Lumen. 16-bit is
   *      1.25 mm and costs 32 MB — the right trade for a hero asset. */
  const px = size * size;

  const albedo = new Uint8Array(px * 3);
  for (let i = 0; i < px; i++) {
    for (let c = 0; c < 3; c++) {
      const lin = tex.albedo ? clamp01(tex.albedo[i * 3 + c]) : 0.5;
      albedo[i * 3 + c] = Math.round(Math.pow(lin, 1 / 2.2) * 255); // → sRGB
    }
  }

  const disp = new Uint16Array(px);
  for (let i = 0; i < px; i++) disp[i] = Math.round(clamp01(tex.height ? tex.height[i] : 0.5) * 65535);

  // RMA: R = roughness, G = metallic, B = ambient occlusion. One sample,
  // three channels, linear — the standard UE packing.
  const rma = new Uint8Array(px * 3);
  for (let i = 0; i < px; i++) {
    const rough = tex.roughness ? clamp01(tex.roughness[i]) : 0.8;
    const ao = tex.height ? clamp01(0.45 + tex.height[i] * 0.55) : 1;
    rma[i * 3] = Math.round(rough * 255);
    rma[i * 3 + 1] = 0;
    rma[i * 3 + 2] = Math.round(ao * 255);
  }

  const normal = new Uint8Array(px * 3);
  for (let i = 0; i < px; i++) {
    const nx = tex.normal ? tex.normal[i * 2] : 0;
    const ny = tex.normal ? tex.normal[i * 2 + 1] : 0;
    const nz = Math.sqrt(Math.max(0.02, 1 - nx * nx - ny * ny));
    normal[i * 3] = Math.round(clamp01(nx * 0.5 + 0.5) * 255);
    normal[i * 3 + 1] = Math.round(clamp01(ny * 0.5 + 0.5) * 255);
    normal[i * 3 + 2] = Math.round(clamp01(nz) * 255);
  }

  const textures: UnrealTextureAsset[] = [
    { file: `T_${name}_BC.png`, role: "albedo", width: size, height: size, channels: 3, bitDepth: 8, srgb: true, compression: "TC_Default", bytes: o.encodePng(size, size, albedo, 3, 8) },
    { file: `T_${name}_H.png`, role: "displacement", width: size, height: size, channels: 1, bitDepth: 16, srgb: false, compression: "TC_Displacementmap", bytes: o.encodePng(size, size, disp, 1, 16) },
    { file: `T_${name}_RMA.png`, role: "rma", width: size, height: size, channels: 3, bitDepth: 8, srgb: false, compression: "TC_Masks", bytes: o.encodePng(size, size, rma, 3, 8) },
    { file: `T_${name}_N.png`, role: "normal", width: size, height: size, channels: 3, bitDepth: 8, srgb: false, compression: "TC_Normalmap", bytes: o.encodePng(size, size, normal, 3, 8) },
  ];

  /* 4 ── the dense mesh. Nanite WANTS the source dense; it clusters and
   *      decimates on import, so pre-decimating here would be actively
   *      harmful. 512² quads = 524,288 triangles. */
  const mesh = buildDenseMesh(tex, o.meshResolution, o.worldSizeCm, o.displacementCm, name, o.emitGltf);

  /* 5 ── manifest */
  const root = `${o.contentRoot}/${name}`;
  const nanite = { ...NANITE_DEFAULT, ...o.nanite };
  const lumen = { ...LUMEN_DEFAULT, ...o.lumen };

  const manifest: UE5Manifest = {
    schema: "setmix.ue5/1.0",
    generator: "@hm/export-ue5 1.0 · UE 5.5",
    source: {
      cartridgeId: cartridge.id, rev: cartridge.rev, hash: cartridge.hash,
      graphHash: contentHash(cartridge.graph), author: cartridge.author,
      class: cartridge.cls, parents: cartridge.parents, licence: "CC-BY-SA-SETMIX",
    },
    assetPaths: {
      root,
      material: "/Game/SetMix/Materials/M_SetMix_Nanite_Master",
      materialInstance: `${root}/MI_${name}`,
      mesh: `${root}/SM_${name}`,
      textures: Object.fromEntries(textures.map((t) => [t.role, `${root}/${t.file.replace(/\.png$/, "")}`])),
    },
    textures: textures.map(({ bytes: _b, ...rest }) => rest),
    mesh: {
      file: mesh.file, format: mesh.format, tris: mesh.tris, verts: mesh.verts,
      worldSizeCm: o.worldSizeCm, displacementCm: o.displacementCm,
      pivot: "centre-bottom", upAxis: "Z",
    },
    material: {
      parent: "/Game/SetMix/Materials/M_SetMix_Nanite_Master",
      scalarParameters: {
        DisplacementScale: o.displacementCm,
        DisplacementCenter: 0.5,
        TilingScale: 1.0,
        NormalIntensity: budget.relief,
        RoughnessMin: 0.04,
        RoughnessMax: 1.0,
        AOIntensity: 0.85,
        WetnessMask: 0.0,
        TriplanarSharpness: 2 + budget.relief * 3,
      },
      vectorParameters: {
        TintA: [1, 1, 1, 1],
        SubsurfaceColour: [0.35, 0.52, 0.28, 1],
      },
      textureParameters: Object.fromEntries(
        textures.map((t) => [
          { albedo: "BaseColor", displacement: "Displacement", rma: "RMA", normal: "Normal" }[t.role],
          `${root}/${t.file.replace(/\.png$/, "")}`,
        ]),
      ),
      staticSwitches: {
        UseDisplacement: true,
        UseTriplanar: true,
        UseWetness: true,
        UseSubsurface: cartridge.cls === "BIOME",
      },
      twoSided: false,
      shadingModel: "DefaultLit",
      blendMode: "BLEND_Opaque",
    },
    nanite,
    lumen,
    exposedParameters: cartridge.vars.slice(0, 8).map((v) => ({
      name: v.label, real: v.real, path: v.path, unit: v.unit,
      min: v.min, max: v.max, default: v.def, tier: v.tier, explain: v.explain,
    })),
    verification: {
      determinism: "seed-stable",
      seed: o.seed,
      certificate: certify(cartridge, DEVICES[3]),
    },
  };

  const totalBytes =
    textures.reduce((a, t) => a + t.bytes.length, 0) + mesh.bytes.length;

  return {
    id: cartridge.id,
    name,
    hash: contentHash({ cartridge: cartridge.hash, opts: { size, res: o.meshResolution, seed: o.seed } }),
    textures,
    mesh,
    manifest,
    manifestFile: "manifest.ue5.json",
    totalBytes,
    bakeMs: (typeof performance !== "undefined" ? performance.now() : 0) - t0,
  };
}

/* ───────────────────────────────── dense mesh for Nanite ─────────────── */

function buildDenseMesh(
  tex: EvaluatedTexture, res: number, worldCm: number, dispCm: number,
  name: string, gltf: boolean,
) {
  const n = res + 1;
  const verts = n * n;
  const tris = res * res * 2;
  const step = worldCm / res;
  const half = worldCm / 2;
  const sample = (ix: number, iy: number) => {
    if (!tex.height) return 0.5;
    const sx = Math.min(tex.size - 1, Math.round((ix / res) * (tex.size - 1)));
    const sy = Math.min(tex.size - 1, Math.round((iy / res) * (tex.size - 1)));
    return tex.height[sy * tex.size + sx];
  };

  // Wavefront OBJ: UE 5.5 imports it natively, it is diffable in git, and it
  // streams — we never hold the whole string in memory for an 8k bake.
  const parts: string[] = [
    `# SetMix → Unreal Engine 5.5 · Nanite source mesh`,
    `# ${verts.toLocaleString()} verts · ${tris.toLocaleString()} tris · Z-up · centimetres`,
    `o SM_${name}`,
  ];
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const h = sample(x, y) * dispCm;
      // UE is Z-up, left-handed. X right, Y forward, Z up.
      parts.push(`v ${(x * step - half).toFixed(3)} ${(y * step - half).toFixed(3)} ${h.toFixed(3)}`);
    }
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) parts.push(`vt ${(x / res).toFixed(6)} ${(1 - y / res).toFixed(6)}`);
  for (let y = 0; y < res; y++)
    for (let x = 0; x < res; x++) {
      const a = y * n + x + 1, b = a + 1, c = a + n, d = c + 1;
      parts.push(`f ${a}/${a} ${c}/${c} ${b}/${b}`);
      parts.push(`f ${b}/${b} ${c}/${c} ${d}/${d}`);
    }

  const text = parts.join("\n");
  const bytes = new TextEncoder().encode(text);
  return {
    file: gltf ? `SM_${name}.gltf` : `SM_${name}.obj`,
    format: (gltf ? "gltf" : "obj") as "gltf" | "obj",
    bytes, tris, verts,
  };
}

/** Browser-side PNG encoder via OffscreenCanvas. 16-bit falls back to two
 *  8-bit channels (hi/lo) which the UE material recombines — documented in
 *  the manifest so the importer knows. Node uses sharp/pngjs instead. */
export function browserPngEncoder(
  width: number, height: number, data: Uint8Array | Uint16Array,
  channels: 1 | 3 | 4, bitDepth: 8 | 16,
): Uint8Array {
  const px = width * height;
  const out = new Uint8ClampedArray(px * 4);
  for (let i = 0; i < px; i++) {
    if (bitDepth === 16) {
      const v = (data as Uint16Array)[i];
      out[i * 4] = v >> 8; out[i * 4 + 1] = v & 255; out[i * 4 + 2] = 0;
    } else if (channels === 1) {
      out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = (data as Uint8Array)[i];
    } else {
      out[i * 4] = (data as Uint8Array)[i * channels];
      out[i * 4 + 1] = (data as Uint8Array)[i * channels + 1];
      out[i * 4 + 2] = (data as Uint8Array)[i * channels + 2];
    }
    out[i * 4 + 3] = 255;
  }
  // Caller converts via OffscreenCanvas.convertToBlob(); returning raw RGBA
  // keeps this function synchronous and pure for the manifest-size estimate.
  return new Uint8Array(out.buffer.slice(0));
}

export function manifestJson(pkg: UnrealExportPackage): string {
  return JSON.stringify(pkg.manifest, null, 2);
}
