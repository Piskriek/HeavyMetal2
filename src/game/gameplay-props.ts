/**
 * T09 — Gameplay Props Compilation
 *
 * Compiles props from the T01 runtime registry and T08 track-builder into
 * immutable runtime representations for physics and pickup systems.
 *
 * Responsibilities:
 * - Validate transforms: reject shear, degenerate, and ambiguous placements
 * - Bake scale into extents (no double-application)
 * - Generate stable IDs and generation counters
 * - Compile barriers into OBBs for wall CCD
 * - Compile pickups into claimable entities
 * - Validate against release corridor
 */

import type { PropRegistry } from './contracts/props';
import type { OBB } from './physics/wall-ccd';
import type { PlacedProp, PropDefinition } from './track-builder-3d';

export interface CompiledBarrier {
  readonly id: string;
  readonly obb: OBB;
  readonly kind: string;
  readonly tags: readonly string[];
  readonly generation: number;
}

export interface CompiledPickup {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly kind: string;
  readonly radius: number;
  readonly generation: number;
  readonly effect: PickupEffect;
}

export type PickupEffect =
  | { type: 'fuel'; amount: number }
  | { type: 'shield'; duration: number }
  | { type: 'spring'; count: number }
  | { type: 'repair'; amount: number }
  | { type: 'speed'; multiplier: number; duration: number };

export interface CompiledProps {
  readonly barriers: readonly CompiledBarrier[];
  readonly pickups: readonly CompiledPickup[];
  readonly warnings: readonly string[];
}

export interface CompilationOptions {
  readonly registry?: PropRegistry;
  readonly builderProps?: readonly PlacedProp[];
  readonly builderDefs?: readonly PropDefinition[];
  readonly releaseCorridor?: ReleaseCorridorBounds;
}

export interface ReleaseCorridorBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
  readonly minZ: number;
  readonly maxZ: number;
}

/** Generation counter per prop ID, incremented on each rebuild. */
const generationCache = new Map<string, number>();

function nextGeneration(id: string): number {
  const current = generationCache.get(id) ?? 0;
  const next = current + 1;
  generationCache.set(id, next);
  return next;
}

/**
 * Validate that a transform is supported. Returns null if valid, or a rejection reason.
 */
function validateTransform(
  def: { type: string; name: string },
  prop: { x: number; y: number; z: number; scale: number; width?: number; height?: number; depth?: number; rotX?: number; rotY?: number; rotZ?: number },
): string | null {
  // Reject non-finite values
  for (const [key, val] of Object.entries({
    x: prop.x, y: prop.y, z: prop.z, scale: prop.scale,
    width: prop.width, height: prop.height, depth: prop.depth,
    rotX: prop.rotX, rotY: prop.rotY, rotZ: prop.rotZ,
  })) {
    if (val !== undefined && (!Number.isFinite(val))) {
      return `${def.type} "${def.name}" has non-finite ${key}=${val}`;
    }
  }

  // Reject zero or negative scale
  if (prop.scale <= 0) {
    return `${def.type} "${def.name}" has invalid scale=${prop.scale}`;
  }

  // Reject degenerate extents
  if (prop.width !== undefined && prop.width <= 0) {
    return `${def.type} "${def.name}" has degenerate width=${prop.width}`;
  }
  if (prop.height !== undefined && prop.height <= 0) {
    return `${def.type} "${def.name}" has degenerate height=${prop.height}`;
  }
  if (prop.depth !== undefined && prop.depth <= 0) {
    return `${def.type} "${def.name}" has degenerate depth=${prop.depth}`;
  }

  // Reject shear: quaternion + euler angles simultaneously is ambiguous
  if ((prop as any).quaternion && (prop.rotX !== undefined || prop.rotZ !== undefined)) {
    return `${def.type} "${def.name}" has ambiguous transform (quaternion + euler)`;
  }

  return null;
}

/**
 * Compute effective world-space extents for a prop.
 * Convention: if width/height/depth are explicitly set, they ARE the final dimensions.
 * Otherwise, extents = default * scale.
 */
function effectiveExtents(
  prop: { scale: number; width?: number; height?: number; depth?: number },
  def: { defaultWidth: number; defaultHeight: number; defaultDepth?: number },
): { width: number; height: number; depth: number } {
  return {
    width: prop.width !== undefined ? prop.width : def.defaultWidth * prop.scale,
    height: prop.height !== undefined ? prop.height : def.defaultHeight * prop.scale,
    depth: prop.depth !== undefined ? prop.depth : (def.defaultDepth ?? def.defaultWidth) * prop.scale,
  };
}

/**
 * Compile a barrier prop into an OBB.
 */
function compileBarrier(
  prop: PlacedProp,
  def: PropDefinition,
): CompiledBarrier | null {
  const rejection = validateTransform(def, prop);
  if (rejection) return null;

  const ext = effectiveExtents(prop, def);
  const generation = nextGeneration(prop.id);

  return {
    id: prop.id,
    kind: prop.type,
    tags: def.isBarrier ? ['barrier'] : def.isPowerup ? ['powerup'] : [],
    generation,
    obb: {
      id: prop.id,
      x: prop.x,
      y: prop.y + ext.height / 2,  // OBB center is at half-height
      z: prop.z,
      halfWidth: ext.width / 2,
      halfHeight: ext.height / 2,
      halfDepth: ext.depth / 2,
      rotY: prop.rotY ?? 0,
      rotX: prop.rotX ?? 0,
      rotZ: prop.rotZ ?? 0,
      generation,
    },
  };
}

/**
 * Compile a pickup prop into a claimable entity.
 */
function compilePickup(
  prop: PlacedProp,
  def: PropDefinition,
): CompiledPickup | null {
  const rejection = validateTransform(def, prop);
  if (rejection) return null;

  const ext = effectiveExtents(prop, def);
  const generation = nextGeneration(prop.id);

  // Determine pickup effect from kind
  let effect: PickupEffect;
  if (prop.type.includes('speed') || prop.type.includes('boost')) {
    effect = { type: 'fuel', amount: 1 };
  } else if (prop.type.includes('shield')) {
    effect = { type: 'shield', duration: 6.0 };
  } else if (prop.type.includes('spring') || prop.type.includes('jump')) {
    effect = { type: 'spring', count: 1 };
  } else if (prop.type.includes('repair')) {
    effect = { type: 'repair', amount: 1 };
  } else {
    effect = { type: 'fuel', amount: 1 }; // default
  }

  return {
    id: prop.id,
    x: prop.x,
    y: prop.y + ext.height / 2,
    z: prop.z,
    kind: prop.type,
    radius: Math.max(ext.width, ext.depth) / 2,
    generation,
    effect,
  };
}

/**
 * Check if a prop placement overlaps the release corridor.
 */
function overlapsReleaseCorridor(
  prop: { x: number; y: number; z: number },
  ext: { width: number; height: number; depth: number },
  corridor: ReleaseCorridorBounds,
): boolean {
  const hw = ext.width / 2;
  const hh = ext.height / 2;
  const hd = ext.depth / 2;

  return !(
    prop.x + hw < corridor.minX ||
    prop.x - hw > corridor.maxX ||
    prop.y + hh < corridor.minY ||
    prop.y - hh > corridor.maxY ||
    prop.z + hd < corridor.minZ ||
    prop.z - hd > corridor.maxZ
  );
}

/**
 * Compile all props from registry and builder into runtime representations.
 */
export function compileGameplayProps(options: CompilationOptions): CompiledProps {
  const barriers: CompiledBarrier[] = [];
  const pickups: CompiledPickup[] = [];
  const warnings: string[] = [];

  // Compile from T01 registry
  if (options.registry) {
    for (const def of options.registry.all()) {
      if (def.solid) {
        const barrier: CompiledBarrier = {
          id: def.id,
          kind: def.kind,
          tags: def.tags,
          generation: nextGeneration(def.id),
          obb: {
            id: def.id,
            x: def.transform.x,
            y: def.transform.y + def.extents.height / 2,
            z: def.transform.z,
            halfWidth: def.extents.width / 2,
            halfHeight: def.extents.height / 2,
            halfDepth: def.extents.depth / 2,
            rotY: def.transform.rotY,
            rotX: def.transform.rotX,
            rotZ: def.transform.rotZ,
            generation: nextGeneration(def.id),
          },
        };
        barriers.push(barrier);
      }
      if (def.pickup) {
        const effect: PickupEffect = def.kind.includes('fuel')
          ? { type: 'fuel', amount: 1 }
          : def.kind.includes('shield')
          ? { type: 'shield', duration: 6.0 }
          : { type: 'spring', count: 1 };
        pickups.push({
          id: def.id,
          x: def.transform.x,
          y: def.transform.y + def.extents.height / 2,
          z: def.transform.z,
          kind: def.kind,
          radius: Math.max(def.extents.width, def.extents.depth) / 2,
          generation: nextGeneration(def.id),
          effect,
        });
      }
    }
  }

  // Compile from T08 builder props
  if (options.builderProps && options.builderDefs) {
    const defMap = new Map<string, PropDefinition>();
    for (const d of options.builderDefs) {
      defMap.set(d.type, d);
    }

    for (const prop of options.builderProps) {
      const def = defMap.get(prop.type);
      if (!def) {
        warnings.push(`Prop "${prop.id}" has unknown type "${prop.type}"`);
        continue;
      }

      // Validate transform
      const rejection = validateTransform(def, prop);
      if (rejection) {
        warnings.push(rejection);
        continue;
      }

      const ext = effectiveExtents(prop, def);

      // Check release corridor overlap
      if (options.releaseCorridor && overlapsReleaseCorridor(prop, ext, options.releaseCorridor)) {
        warnings.push(`Prop "${prop.id}" (${prop.name}) overlaps release corridor at spawn/exit`);
        continue;
      }

      // Compile as barrier or pickup
      if (def.isBarrier) {
        const barrier = compileBarrier(prop, def);
        if (barrier) barriers.push(barrier);
      }
      if (def.isPowerup) {
        const pickup = compilePickup(prop, def);
        if (pickup) pickups.push(pickup);
      }
    }
  }

  return {
    barriers: Object.freeze(barriers),
    pickups: Object.freeze(pickups),
    warnings: Object.freeze(warnings),
  };
}

/**
 * Extract OBBs from compiled barriers for wall CCD.
 */
export function barrierOBBs(barriers: readonly CompiledBarrier[]): readonly OBB[] {
  return barriers.map((b) => b.obb);
}

/**
 * Reset the generation cache (for testing).
 */
export function resetGenerationCache(): void {
  generationCache.clear();
}
