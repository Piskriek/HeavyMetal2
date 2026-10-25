/**
 * @hm/matstack First Shelf (Plan 41 section 4.9 & section 4.6).
 *
 * Defines the canonical preset libraries for all four levels of the layered material system:
 *   1. SURFACE_SHELF (14 base surfaces + 15 weathering surfaces = 29 SurfaceSpec presets)
 *   2. MASK_SHELF    (11 MaskSpec presets)
 *   3. LAYER_SHELF   (16 LayerSpec presets)
 *   4. MATERIAL_SHELF / FIRST_MATSTACK_SHELF (12 canonical Plan 41 materials + 4 machine-detail presets)
 *
 * All specs conform strictly to SurfaceSpec, MaskSpec, LayerSpec, and MaterialSpec in ./index.ts.
 * Authored by Argo (creative lead, 2026-10-21); rank 0 flattens through index.ts's flattenMesh.
 */

import type { LayerSpec, MaskSpec, MaterialSpec, SurfaceSpec } from './index';

// ------------------------------------------------------------------ 1. SURFACES (Plan 41 §4.9)

export const BASE_SURFACE_SHELF: Readonly<Record<string, SurfaceSpec>> = Object.freeze({
  'bare-steel': {
    name: 'Bare steel',
    colour: '#8a929a',
    metal: 0.88,
    rough: 0.42,
    specular: 0.5,
    tile: { tile: 'brushed-metal', scale: 0.5, bump: 0.15, roughVar: 0.12, colourVar: 0.06 },
  },
  'brushed-stainless': {
    name: 'Brushed stainless',
    colour: '#b4bcc4',
    metal: 0.92,
    rough: 0.34,
    specular: 0.5,
    tile: { tile: 'brushed-metal', scale: 0.35, bump: 0.12, roughVar: 0.1, colourVar: 0.05 },
    aniso: { amount: 0.65, axis: 'u' },
  },
  'galvanised': {
    name: 'Galvanised',
    colour: '#9ca4ac',
    ramp: [
      { at: 0.0, colour: '#788088' },
      { at: 0.5, colour: '#a4acb4' },
      { at: 1.0, colour: '#c2cad2' },
    ],
    metal: 0.82,
    rough: 0.48,
    specular: 0.5,
    tile: { tile: 'cells', scale: 0.18, bump: 0.08, roughVar: 0.18, colourVar: 0.14 },
  },
  'cast-iron': {
    name: 'Cast iron',
    colour: '#4a525a',
    metal: 0.78,
    rough: 0.64,
    specular: 0.5,
    tile: { tile: 'cast-iron', scale: 0.4, bump: 0.28, roughVar: 0.16, colourVar: 0.08 },
    detail: { tile: 'pits', scale: 0.08, bump: 0.35, roughVar: 0.2 },
  },
  'anodised-aluminium': {
    name: 'Anodised aluminium',
    colour: 'paint1',
    metal: 0.76,
    rough: 0.36,
    specular: 0.5,
    tile: { tile: 'fine-grain', scale: 0.25, bump: 0.06, roughVar: 0.08, colourVar: 0.04 },
  },
  'copper': {
    name: 'Copper and brass',
    colour: '#c87d4b',
    metal: 0.92,
    rough: 0.32,
    specular: 0.5,
    tile: { tile: 'brushed-metal', scale: 0.4, bump: 0.1, roughVar: 0.1, colourVar: 0.06 },
  },
  'powder-coat': {
    name: 'Powder coat',
    colour: 'paint1',
    metal: 0.0,
    rough: 0.54,
    specular: 0.5,
    detail: { tile: 'orange-peel', scale: 0.06, bump: 0.18, roughVar: 0.12 },
  },
  'enamel': {
    name: 'Enamel',
    colour: 'paint1',
    metal: 0.0,
    rough: 0.28,
    specular: 0.55,
    coat: { amount: 0.85, rough: 0.08 },
  },
  'hazard-paint': {
    name: 'Hazard paint',
    colour: 'paint2',
    ramp: [
      { at: 0.0, colour: '#1f2429' },
      { at: 0.48, colour: '#1f2429' },
      { at: 0.52, colour: '#eab308' },
      { at: 1.0, colour: '#eab308' },
    ],
    metal: 0.0,
    rough: 0.46,
    specular: 0.5,
    tile: { tile: 'stripes', scale: 0.24, bump: 0.05, roughVar: 0.06, colourVar: 0.0 },
  },
  'rubber': {
    name: 'Rubber',
    colour: '#2d333b',
    metal: 0.0,
    rough: 0.86,
    specular: 0.35,
    tile: { tile: 'rubber-grain', scale: 0.2, bump: 0.22, roughVar: 0.1, colourVar: 0.04 },
  },
  'concrete': {
    name: 'Concrete',
    colour: '#8c8880',
    metal: 0.0,
    rough: 0.88,
    specular: 0.35,
    tile: { tile: 'concrete', scale: 0.8, bump: 0.38, roughVar: 0.16, colourVar: 0.12 },
    detail: { tile: 'pits', scale: 0.12, bump: 0.25, roughVar: 0.14 },
  },
  'carbon-fibre': {
    name: 'Carbon fibre',
    colour: '#22262b',
    metal: 0.0,
    rough: 0.36,
    specular: 0.55,
    tile: { tile: 'carbon-weave', scale: 0.08, bump: 0.2, roughVar: 0.18, colourVar: 0.12 },
    coat: { amount: 0.9, rough: 0.06 },
    aniso: { amount: 0.45, axis: 'u' },
  },
  'ceramic-insulator': {
    name: 'Ceramic insulator',
    colour: '#d8d4cc',
    metal: 0.0,
    rough: 0.24,
    specular: 0.6,
    coat: { amount: 0.92, rough: 0.05 },
  },
  'lab-composite': {
    name: 'Lab composite',
    colour: 'paint1',
    metal: 0.0,
    rough: 0.4,
    specular: 0.5,
    tile: { tile: 'hex-micro', scale: 0.16, bump: 0.1, roughVar: 0.08, colourVar: 0.04 },
    coat: { amount: 0.35, rough: 0.18 },
  },
});

export const WEATHERING_SURFACE_SHELF: Readonly<Record<string, SurfaceSpec>> = Object.freeze({
  'rust': {
    name: 'Rust',
    colour: '#7a3e22',
    ramp: [
      { at: 0.0, colour: '#4a2212' },
      { at: 0.5, colour: '#7a3e22' },
      { at: 1.0, colour: '#b85d28' },
    ],
    metal: 0.04,
    rough: 0.88,
    specular: 0.35,
    tile: { tile: 'cells', scale: 0.35, bump: 0.42, roughVar: 0.18, colourVar: 0.2 },
    detail: { tile: 'pits', scale: 0.09, bump: 0.35, roughVar: 0.15 },
  },
  'heavy-scale': {
    name: 'Heavy scale',
    colour: '#3d281e',
    ramp: [
      { at: 0.0, colour: '#2a1c16' },
      { at: 0.6, colour: '#4d3022' },
      { at: 1.0, colour: '#72442b' },
    ],
    metal: 0.12,
    rough: 0.92,
    specular: 0.3,
    tile: { tile: 'flake-scale', scale: 0.28, bump: 0.65, roughVar: 0.22, colourVar: 0.18 },
  },
  'verdigris': {
    name: 'Verdigris',
    colour: '#4e8c7a',
    ramp: [
      { at: 0.0, colour: '#2f594d' },
      { at: 0.5, colour: '#4e8c7a' },
      { at: 1.0, colour: '#78b8a4' },
    ],
    metal: 0.05,
    rough: 0.82,
    specular: 0.4,
    tile: { tile: 'cells', scale: 0.3, bump: 0.28, roughVar: 0.16, colourVar: 0.15 },
  },
  'grime': {
    name: 'Grime',
    colour: '#38342e',
    metal: 0.0,
    rough: 0.86,
    specular: 0.3,
    tile: { tile: 'grime-clouds', scale: 0.55, bump: 0.12, roughVar: 0.16, colourVar: 0.14 },
  },
  'dust': {
    name: 'Dust',
    colour: '#9c9282',
    metal: 0.0,
    rough: 0.92,
    specular: 0.25,
    fuzz: { amount: 0.65, colour: '#b8ae9e' },
  },
  'regolith': {
    name: 'Regolith',
    colour: '#948e84',
    metal: 0.0,
    rough: 0.94,
    specular: 0.22,
    tile: { tile: 'regolith-grain', scale: 0.4, bump: 0.2, roughVar: 0.1, colourVar: 0.08 },
    fuzz: { amount: 0.78, colour: '#b2aba0' },
  },
  'soot': {
    name: 'Soot',
    colour: '#1c1e22',
    metal: 0.0,
    rough: 0.95,
    specular: 0.2,
    fuzz: { amount: 0.4, colour: '#2a2d32' },
  },
  'oil': {
    name: 'Oil',
    colour: '#1e1b18',
    metal: 0.0,
    rough: 0.14,
    specular: 0.65,
    coat: { amount: 0.95, rough: 0.06 },
    film: { amount: 0.35, thickness: 480 },
  },
  'heat-tint': {
    name: 'Heat tint',
    colour: '#8a7258',
    metal: 0.85,
    rough: 0.36,
    specular: 0.5,
    film: { amount: 0.82, thickness: 520 },
  },
  'moss': {
    name: 'Moss',
    colour: '#466832',
    ramp: [
      { at: 0.0, colour: '#2d4720' },
      { at: 0.5, colour: '#466832' },
      { at: 1.0, colour: '#688f48' },
    ],
    metal: 0.0,
    rough: 0.92,
    specular: 0.25,
    tile: { tile: 'moss-clump', scale: 0.25, bump: 0.48, roughVar: 0.14, colourVar: 0.18 },
    fuzz: { amount: 0.85, colour: '#6e964c' },
  },
  'frost': {
    name: 'Frost',
    colour: '#dce8f2',
    metal: 0.0,
    rough: 0.62,
    specular: 0.6,
    tile: { tile: 'frost-crystal', scale: 0.22, bump: 0.3, roughVar: 0.2, colourVar: 0.1 },
    fuzz: { amount: 0.55, colour: '#eef6fc' },
  },
  'mud': {
    name: 'Mud',
    colour: '#4a3b2c',
    metal: 0.0,
    rough: 0.72,
    specular: 0.42,
    tile: { tile: 'mud-splatter', scale: 0.45, bump: 0.38, roughVar: 0.22, colourVar: 0.14 },
    coat: { amount: 0.3, rough: 0.24 },
  },
  'limescale': {
    name: 'Limescale',
    colour: '#c8c4b8',
    metal: 0.0,
    rough: 0.84,
    specular: 0.35,
    tile: { tile: 'mineral-crust', scale: 0.3, bump: 0.34, roughVar: 0.16, colourVar: 0.12 },
  },
  'scorch': {
    name: 'Scorch',
    colour: '#24201e',
    metal: 0.05,
    rough: 0.88,
    specular: 0.25,
    tile: { tile: 'scorch-burn', scale: 0.5, bump: 0.24, roughVar: 0.18, colourVar: 0.16 },
  },
  'bright-metal': {
    name: 'Bright metal',
    colour: '#b8c0c8',
    metal: 0.94,
    rough: 0.28,
    specular: 0.5,
    tile: { tile: 'scratches', scale: 0.3, bump: 0.14, roughVar: 0.12, colourVar: 0.06 },
  },
});

export const SURFACE_SHELF: Readonly<Record<string, SurfaceSpec>> = Object.freeze({
  ...BASE_SURFACE_SHELF,
  ...WEATHERING_SURFACE_SHELF,
});

// ------------------------------------------------------------------ 2. MASKS (Plan 41 §4.9)

export const MASK_SHELF: Readonly<Record<string, MaskSpec>> = Object.freeze({
  'everywhere': {
    name: 'Everywhere',
    inputs: [{ kind: 'all', blend: 'normal', opacity: 1.0, invert: false }],
    balance: 0.0,
    contrast: 0.0,
    invert: false,
  },
  'edge-chips': {
    name: 'Edge chips',
    inputs: [
      { kind: 'edge', width: 0.028, blend: 'normal', opacity: 1.0, invert: false },
      { kind: 'noise', noise: 'cells', scale: 0.22, seed: 11, blend: 'multiply', opacity: 0.55, invert: false },
    ],
    balance: 0.28,
    contrast: 0.72,
    invert: false,
  },
  'worn-edges': {
    name: 'Worn edges',
    inputs: [
      { kind: 'edge', width: 0.042, blend: 'normal', opacity: 1.0, invert: false },
      { kind: 'noise', noise: 'clouds', scale: 0.35, seed: 23, blend: 'multiply', opacity: 0.38, invert: false },
    ],
    balance: 0.22,
    contrast: 0.52,
    invert: false,
  },
  'crevices': {
    name: 'Crevices',
    inputs: [
      { kind: 'cavity', width: 0.048, blend: 'normal', opacity: 1.0, invert: false },
      { kind: 'noise', noise: 'clouds', scale: 0.4, seed: 37, blend: 'multiply', opacity: 0.35, invert: false },
    ],
    balance: 0.24,
    contrast: 0.56,
    invert: false,
  },
  'tops': {
    name: 'Tops',
    inputs: [
      { kind: 'up', angle: 52, soft: 24, blend: 'normal', opacity: 1.0, invert: false },
      { kind: 'noise', noise: 'clouds', scale: 0.6, seed: 41, blend: 'multiply', opacity: 0.32, invert: false },
    ],
    balance: 0.2,
    contrast: 0.42,
    invert: false,
  },
  'undersides': {
    name: 'Undersides',
    inputs: [
      { kind: 'down', angle: 55, soft: 25, blend: 'normal', opacity: 1.0, invert: false },
      { kind: 'noise', noise: 'clouds', scale: 0.5, seed: 53, blend: 'multiply', opacity: 0.35, invert: false },
    ],
    balance: 0.2,
    contrast: 0.48,
    invert: false,
  },
  'splash-zone': {
    name: 'Splash zone',
    inputs: [
      { kind: 'ground', height: 0.65, soft: 0.35, blend: 'normal', opacity: 1.0, invert: false },
      { kind: 'noise', noise: 'speckle', scale: 0.35, seed: 67, blend: 'multiply', opacity: 0.45, invert: false },
    ],
    balance: 0.25,
    contrast: 0.55,
    invert: false,
  },
  'drips': {
    name: 'Drips',
    inputs: [
      { kind: 'streaks', scale: 0.28, stretch: 4.5, seed: 79, blend: 'normal', opacity: 1.0, invert: false },
      { kind: 'cavity', width: 0.045, blend: 'add', opacity: 0.45, invert: false },
    ],
    balance: 0.18,
    contrast: 0.62,
    invert: false,
  },
  'patches': {
    name: 'Patches',
    inputs: [
      { kind: 'noise', noise: 'clouds', scale: 0.65, seed: 83, blend: 'normal', opacity: 1.0, invert: false },
      { kind: 'noise', noise: 'cells', scale: 0.28, seed: 89, blend: 'multiply', opacity: 0.45, invert: false },
    ],
    balance: 0.24,
    contrast: 0.68,
    invert: false,
  },
  'pitting': {
    // A bloom, not a coat: large, slow cloud patches broken up by pitting cells, and creases gathering the damp. The balance sits
    // above the noise's mean on purpose, so only the peaks pass (plan 41 §7: 5-15% of a face, not 67%).
    name: 'Pitting',
    inputs: [
      { kind: 'noise', noise: 'clouds', scale: 0.9, seed: 97, blend: 'normal', opacity: 1.0, invert: false },
      { kind: 'noise', noise: 'cells', scale: 0.45, seed: 89, blend: 'multiply', opacity: 0.5, invert: false },
      { kind: 'cavity', width: 0.045, blend: 'add', opacity: 0.3, invert: false },
    ],
    balance: -0.05,
    contrast: 0.8,
    invert: false,
  },
  'seeps': {
    // Oil and water run down from an edge or sit in a crease: the streak field is gated by edge proximity, creases add on top.
    name: 'Seeps',
    inputs: [
      { kind: 'streaks', scale: 0.32, stretch: 5.0, seed: 79, blend: 'normal', opacity: 1.0, invert: false },
      { kind: 'edge', width: 0.03, blend: 'multiply', opacity: 0.9, invert: false },
      { kind: 'cavity', width: 0.045, blend: 'add', opacity: 0.45, invert: false },
    ],
    balance: 0.5,
    contrast: 0.7,
    invert: false,
  },
  'soot-fall': {
    // Soot falls on tops and clings under ledges; a machine in use has both. Tops first, undersides added in.
    name: 'Soot fall',
    inputs: [
      { kind: 'up', angle: 58, soft: 28, blend: 'normal', opacity: 1.0, invert: false },
      { kind: 'down', angle: 55, soft: 25, blend: 'max', opacity: 1.0, invert: false },
      { kind: 'noise', noise: 'clouds', scale: 0.55, seed: 53, blend: 'multiply', opacity: 1.0, invert: false },
    ],
    balance: 0.1,
    contrast: 0.45,
    invert: false,
  },
  'scratches': {
    name: 'Scratches',
    inputs: [
      { kind: 'noise', noise: 'scratches', scale: 0.32, seed: 103, blend: 'normal', opacity: 1.0, invert: false },
      { kind: 'edge', width: 0.048, blend: 'add', opacity: 0.5, invert: false },
    ],
    balance: 0.22,
    contrast: 0.76,
    invert: false,
  },
});

// ------------------------------------------------------------------ 3. LAYERS (Plan 41 §4.9)

export const LAYER_SHELF: Readonly<Record<string, LayerSpec>> = Object.freeze({
  'edge-wear': {
    name: 'Edge wear',
    surface: SURFACE_SHELF['bright-metal']!,
    mask: MASK_SHELF['worn-edges']!,
    opacity: 0.88,
    writes: ['colour', 'metal', 'rough', 'specular', 'height', 'coat', 'aniso'],
    heightBlend: 0.2,
    weathering: true,
    visible: true,
  },
  'paint-chips': {
    name: 'Paint chips',
    surface: SURFACE_SHELF['bare-steel']!,
    mask: MASK_SHELF['edge-chips']!,
    opacity: 0.92,
    writes: ['colour', 'metal', 'rough', 'specular', 'height', 'coat', 'aniso'],
    heightBlend: 0.35,
    weathering: true,
    visible: true,
  },
  'rust-bloom': {
    name: 'Rust bloom',
    surface: SURFACE_SHELF['rust']!,
    mask: MASK_SHELF['pitting']!,
    opacity: 0.82,
    writes: ['colour', 'metal', 'rough', 'specular', 'height', 'coat', 'aniso'],
    heightBlend: 0.55,
    weathering: true,
    visible: true,
  },
  'rust-streaks': {
    name: 'Rust streaks',
    surface: SURFACE_SHELF['rust']!,
    mask: MASK_SHELF['drips']!,
    opacity: 0.76,
    writes: ['colour', 'metal', 'rough', 'specular', 'height', 'coat', 'aniso'],
    heightBlend: 0.4,
    weathering: true,
    visible: true,
  },
  'heavy-rust': {
    name: 'Heavy rust',
    surface: SURFACE_SHELF['heavy-scale']!,
    mask: MASK_SHELF['patches']!,
    opacity: 0.9,
    writes: ['colour', 'metal', 'rough', 'specular', 'height', 'coat', 'aniso'],
    heightBlend: 0.65,
    weathering: true,
    visible: true,
  },
  'dirt': {
    name: 'Dirt',
    surface: SURFACE_SHELF['mud']!,
    mask: MASK_SHELF['splash-zone']!,
    opacity: 0.8,
    writes: ['colour', 'metal', 'rough', 'specular', 'height', 'coat', 'aniso'],
    heightBlend: 0.45,
    weathering: true,
    visible: true,
  },
  'grime': {
    name: 'Grime',
    surface: SURFACE_SHELF['grime']!,
    mask: MASK_SHELF['crevices']!,
    opacity: 0.78,
    writes: ['colour', 'metal', 'rough', 'specular', 'height', 'coat', 'aniso'],
    heightBlend: 0.3,
    weathering: true,
    visible: true,
  },
  'dust': {
    name: 'Dust',
    surface: SURFACE_SHELF['dust']!,
    mask: MASK_SHELF['tops']!,
    opacity: 0.72,
    writes: ['colour', 'metal', 'rough', 'specular', 'coat', 'fuzz', 'aniso'],
    heightBlend: 0.15,
    weathering: true,
    visible: true,
  },
  'moon-dust': {
    name: 'Moon dust',
    surface: SURFACE_SHELF['regolith']!,
    mask: MASK_SHELF['tops']!,
    opacity: 0.84,
    writes: ['colour', 'metal', 'rough', 'specular', 'height', 'coat', 'fuzz', 'aniso'],
    heightBlend: 0.25,
    weathering: true,
    visible: true,
  },
  'oil-leaks': {
    name: 'Oil leaks',
    surface: SURFACE_SHELF['oil']!,
    mask: MASK_SHELF['seeps']!,
    opacity: 0.78,
    writes: ['colour', 'rough', 'specular', 'coat', 'aniso', 'film'],
    heightBlend: 0.15,
    weathering: true,
    visible: true,
  },
  'soot': {
    name: 'Soot',
    surface: SURFACE_SHELF['soot']!,
    mask: MASK_SHELF['soot-fall']!,
    opacity: 0.82,
    writes: ['colour', 'metal', 'rough', 'specular', 'coat', 'fuzz', 'aniso'],
    heightBlend: 0.2,
    weathering: true,
    visible: true,
  },
  'heat-tint': {
    name: 'Heat tint',
    surface: SURFACE_SHELF['heat-tint']!,
    mask: MASK_SHELF['tops']!,
    opacity: 0.8,
    writes: ['colour', 'rough', 'film'],
    heightBlend: 0.0,
    weathering: true,
    visible: true,
  },
  'verdigris': {
    name: 'Verdigris',
    surface: SURFACE_SHELF['verdigris']!,
    mask: MASK_SHELF['crevices']!,
    opacity: 0.84,
    writes: ['colour', 'metal', 'rough', 'specular', 'height', 'coat', 'aniso'],
    heightBlend: 0.45,
    weathering: true,
    visible: true,
  },
  'moss': {
    name: 'Moss',
    surface: SURFACE_SHELF['moss']!,
    mask: MASK_SHELF['tops']!,
    opacity: 0.88,
    writes: ['colour', 'metal', 'rough', 'specular', 'height', 'coat', 'fuzz', 'aniso'],
    heightBlend: 0.55,
    weathering: true,
    visible: true,
  },
  'frost': {
    name: 'Frost',
    surface: SURFACE_SHELF['frost']!,
    mask: MASK_SHELF['tops']!,
    opacity: 0.86,
    writes: ['colour', 'metal', 'rough', 'specular', 'height', 'coat', 'fuzz', 'aniso'],
    heightBlend: 0.4,
    weathering: true,
    visible: true,
  },
  'scratches': {
    name: 'Scratches',
    surface: SURFACE_SHELF['bright-metal']!,
    mask: MASK_SHELF['scratches']!,
    opacity: 0.85,
    writes: ['colour', 'metal', 'rough', 'specular', 'height', 'coat', 'aniso'],
    heightBlend: 0.25,
    weathering: true,
    visible: true,
  },
});

// ------------------------------------------------------------------ 4. MATERIALS (Plan 41 §4.9 + Machine Kit companions)

export const MATERIAL_SHELF: Readonly<Record<string, MaterialSpec>> = Object.freeze({
  'mat:lab-fresh': {
    name: 'Lab fresh',
    base: SURFACE_SHELF['lab-composite']!,
    paint: ['#e2e6ec', '#3dc8ff'],
    layers: [LAYER_SHELF['grime']!, LAYER_SHELF['edge-wear']!],
    age: 0.15,
  },
  'mat:workshop-steel': {
    name: 'Workshop steel',
    base: SURFACE_SHELF['bare-steel']!,
    paint: ['#8a929a', '#eab308'],
    layers: [
      LAYER_SHELF['grime']!,
      LAYER_SHELF['oil-leaks']!,
      LAYER_SHELF['edge-wear']!,
      LAYER_SHELF['scratches']!,
    ],
    age: 0.42,
  },
  'mat:field-worn-hazard': {
    name: 'Field-worn hazard',
    base: SURFACE_SHELF['powder-coat']!,
    paint: ['#b8b2a2', '#eab308'],
    layers: [
      LAYER_SHELF['grime']!,
      LAYER_SHELF['rust-bloom']!,
      LAYER_SHELF['dirt']!,
      LAYER_SHELF['paint-chips']!,
      LAYER_SHELF['edge-wear']!,
    ],
    age: 0.48,
  },
  'mat:moon-dusted': {
    name: 'Moon-dusted',
    base: SURFACE_SHELF['powder-coat']!,
    paint: ['#b8b2a2', '#3dc8ff'],
    layers: [
      LAYER_SHELF['grime']!,
      LAYER_SHELF['moon-dust']!,
      LAYER_SHELF['edge-wear']!,
      LAYER_SHELF['scratches']!,
    ],
    age: 0.58,
  },
  'mat:rust-bucket': {
    name: 'Rust bucket',
    base: SURFACE_SHELF['cast-iron']!,
    paint: ['#4a525a', '#b85d28'],
    layers: [
      LAYER_SHELF['grime']!,
      LAYER_SHELF['rust-bloom']!,
      LAYER_SHELF['rust-streaks']!,
      LAYER_SHELF['heavy-rust']!,
      LAYER_SHELF['edge-wear']!,
    ],
    age: 0.68,
  },
  'mat:furnace': {
    name: 'Furnace',
    base: SURFACE_SHELF['cast-iron']!,
    paint: ['#3c4248', '#ff5a1f'],
    layers: [
      LAYER_SHELF['heat-tint']!,
      LAYER_SHELF['soot']!,
      LAYER_SHELF['heavy-rust']!,
      LAYER_SHELF['edge-wear']!,
    ],
    age: 0.62,
  },
  'mat:old-copper': {
    name: 'Old copper',
    base: SURFACE_SHELF['copper']!,
    paint: ['#c87d4b', '#4e8c7a'],
    layers: [
      LAYER_SHELF['grime']!,
      LAYER_SHELF['verdigris']!,
      LAYER_SHELF['edge-wear']!,
      LAYER_SHELF['scratches']!,
    ],
    age: 0.5,
  },
  'mat:oily-engine': {
    name: 'Oily engine',
    base: SURFACE_SHELF['cast-iron']!,
    paint: ['#4a525a', '#eab308'],
    layers: [
      LAYER_SHELF['grime']!,
      LAYER_SHELF['soot']!,
      LAYER_SHELF['oil-leaks']!,
      LAYER_SHELF['edge-wear']!,
      LAYER_SHELF['scratches']!,
    ],
    age: 0.55,
  },
  'mat:overgrown-relic': {
    name: 'Overgrown relic',
    base: SURFACE_SHELF['powder-coat']!,
    paint: ['#8f9688', '#688f48'],
    layers: [
      LAYER_SHELF['rust-bloom']!,
      LAYER_SHELF['heavy-rust']!,
      LAYER_SHELF['dirt']!,
      LAYER_SHELF['moss']!,
      LAYER_SHELF['edge-wear']!,
    ],
    age: 0.76,
  },
  'mat:frozen-rig': {
    name: 'Frozen rig',
    base: SURFACE_SHELF['enamel']!,
    paint: ['#6c889c', '#dce8f2'],
    layers: [
      LAYER_SHELF['paint-chips']!,
      LAYER_SHELF['grime']!,
      LAYER_SHELF['frost']!,
      LAYER_SHELF['edge-wear']!,
    ],
    age: 0.64,
  },
  'mat:brushed-lab-steel': {
    name: 'Brushed lab steel',
    base: SURFACE_SHELF['brushed-stainless']!,
    paint: ['#b4bcc4', '#3dc8ff'],
    layers: [
      LAYER_SHELF['grime']!,
      LAYER_SHELF['scratches']!,
      LAYER_SHELF['edge-wear']!,
    ],
    age: 0.28,
  },
  'mat:carbon-racer': {
    name: 'Carbon racer',
    base: SURFACE_SHELF['carbon-fibre']!,
    paint: ['#22262b', '#ff3d8a'],
    layers: [
      LAYER_SHELF['dust']!,
      LAYER_SHELF['scratches']!,
      LAYER_SHELF['edge-wear']!,
    ],
    age: 0.22,
  },
  // Companion machine-detail presets used by kit modules & MILL_V2_KIT
  'mat:hazard-chevron': {
    name: 'Hazard chevron',
    base: SURFACE_SHELF['hazard-paint']!,
    paint: ['#b8b2a2', '#eab308'],
    layers: [
      LAYER_SHELF['grime']!,
      LAYER_SHELF['dirt']!,
      LAYER_SHELF['paint-chips']!,
      LAYER_SHELF['edge-wear']!,
    ],
    age: 0.45,
  },
  'mat:rubber-seal': {
    name: 'Rubber seal',
    base: SURFACE_SHELF['rubber']!,
    paint: ['#2d333b', '#948e84'],
    layers: [
      LAYER_SHELF['grime']!,
      LAYER_SHELF['dirt']!,
      LAYER_SHELF['moon-dust']!,
    ],
    age: 0.4,
  },
  'mat:slatted-grille-steel': {
    name: 'Slatted grille steel',
    base: SURFACE_SHELF['galvanised']!,
    paint: ['#788088', '#38342e'],
    layers: [
      LAYER_SHELF['grime']!,
      LAYER_SHELF['soot']!,
      LAYER_SHELF['rust-bloom']!,
      LAYER_SHELF['edge-wear']!,
    ],
    age: 0.52,
  },
  'mat:crushed-ore-bed': {
    name: 'Crushed ore bed',
    base: SURFACE_SHELF['concrete']!,
    paint: ['#4a3b2c', '#7a3e22'],
    layers: [
      LAYER_SHELF['heavy-rust']!,
      LAYER_SHELF['dirt']!,
      LAYER_SHELF['grime']!,
    ],
    age: 0.7,
  },
});

/** Alias map so earlier machine slot IDs resolve to the canonical Plan 41 §4.9 presets. */
export const MATERIAL_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  'mat:khaki-painted-steel': 'mat:field-worn-hazard',
  'mat:brushed-structural-steel': 'mat:workshop-steel',
  'mat:dark-hopper-iron': 'mat:rust-bucket',
  'mat:copper-bus-bar': 'mat:old-copper',
});

/** Ordered array of the first-shelf MaterialSpec presets (with `id` attached for lookup). */
export interface NamedMaterialPreset extends MaterialSpec {
  readonly id: string;
}

export const FIRST_MATSTACK_SHELF: readonly NamedMaterialPreset[] = Object.freeze(
  Object.entries(MATERIAL_SHELF).map(([id, spec]) =>
    Object.freeze({
      id,
      ...spec,
    }),
  ),
);

/** Resolves any `mat:<id>` preset (including aliases) or returns undefined. */
export function resolveMatPreset(id: string): MaterialSpec | undefined {
  const normalized = id.startsWith('mat:') ? id : `mat:${id}`;
  const canonical = MATERIAL_ALIASES[normalized] ?? normalized;
  return MATERIAL_SHELF[canonical];
}
