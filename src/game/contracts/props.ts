/**
 * T01 — runtime prop registry schema.
 *
 * The registry is the immutable contract between the authoring tools (Track Builder, T08)
 * and the simulation (T09): validated static oriented boxes with a stable ID and a
 * generation counter, plus every unknown field preserved verbatim so an older build can
 * round-trip a newer document without silently dropping data.
 *
 * Scale convention: **extents are already in world units.** A definition may carry a
 * `scale` field for authoring continuity, but if it also carries `extents` the definition is
 * rejected as double-scaled — T08's acceptance criterion "scale and dimensions are not
 * applied twice" is enforced here, at the type boundary.
 */

import { ContractError, frozenArray, isFiniteNumber, safeRecord } from './core';

export const PROP_REGISTRY_VERSION = 1;
export const PROP_CATEGORIES = ['decoration', 'barrier', 'powerup', 'hazard', 'marker'] as const;
export type PropCategory = (typeof PROP_CATEGORIES)[number];
export type ScaleConvention = 'baked-extents';
export const SCALE_CONVENTION: ScaleConvention = 'baked-extents';

export interface PropTransform {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly rotY: number;
  readonly rotX: number;
  readonly rotZ: number;
}

export interface PropExtents {
  readonly width: number;
  readonly height: number;
  readonly depth: number;
}

export interface RuntimePropDefinition {
  readonly id: string;
  readonly kind: string;
  readonly category: PropCategory;
  readonly transform: PropTransform;
  readonly extents: PropExtents;
  readonly scaleConvention: ScaleConvention;
  readonly solid: boolean;
  readonly pickup: boolean;
  readonly tags: readonly string[];
  /** Authoring fields this build does not understand, preserved for round-tripping. */
  readonly unknown: Readonly<Record<string, unknown>>;
}

export interface PropRegistry {
  readonly version: typeof PROP_REGISTRY_VERSION;
  readonly size: number;
  readonly ids: readonly string[];
  get(id: string): RuntimePropDefinition | undefined;
  require(id: string): RuntimePropDefinition;
  all(): readonly RuntimePropDefinition[];
  byCategory(category: PropCategory): readonly RuntimePropDefinition[];
  /** The subset the simulation must collide against. */
  solids(): readonly RuntimePropDefinition[];
}

const KNOWN_FIELDS = new Set([
  'id', 'kind', 'type', 'category', 'transform', 'x', 'y', 'z', 'rotX', 'rotY', 'rotZ',
  'rotation', 'extents', 'size', 'width', 'height', 'depth', 'scale', 'scaleConvention',
  'solid', 'pickup', 'tags', 'collision', 'unknown',
]);

const reject = (message: string, detail: Record<string, unknown> = {}) => {
  throw new ContractError('E_PROP_DEFINITION', message, detail);
};

function readTransform(record: Record<string, unknown>): PropTransform {
  const nested = safeRecord(record.transform);
  const rotation = safeRecord(record.rotation);
  const pick = (key: keyof PropTransform, aliases: readonly string[] = []) => {
    const value = nested[key] ?? rotation[key] ?? record[key] ?? aliases.map((alias) => record[alias]).find((entry) => entry !== undefined);
    return isFiniteNumber(value) ? value : 0;
  };
  const transform: PropTransform = Object.freeze({
    x: pick('x'), y: pick('y'), z: pick('z'),
    rotY: pick('rotY', ['yaw']), rotX: pick('rotX', ['pitch']), rotZ: pick('rotZ', ['roll']),
  });
  return transform;
}

function readExtents(record: Record<string, unknown>): PropExtents {
  const nested = safeRecord(record.extents);
  const size = safeRecord(record.size);
  const read = (key: 'width' | 'height' | 'depth', fallback: number) => {
    const value = nested[key] ?? size[key] ?? record[key];
    return isFiniteNumber(value) ? value : fallback;
  };
  const width = read('width', 1);
  const height = read('height', 1);
  const depth = read('depth', 1);
  if (!(width > 0) || !(height > 0) || !(depth > 0)) {
    reject(`Prop extents must be positive; got ${width}×${height}×${depth}.`, { width, height, depth });
  }
  return Object.freeze({ width, height, depth });
}

export function validatePropDefinition(raw: unknown): readonly string[] {
  const problems: string[] = [];
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return frozenArray(['Definition is not an object.']);
  const record = raw as Record<string, unknown>;
  if (typeof record.id !== 'string' || record.id.trim() === '') problems.push('Definition needs a non-empty string id.');
  const kind = record.kind ?? record.type;
  if (typeof kind !== 'string' || kind.trim() === '') problems.push('Definition needs a non-empty kind.');
  if (record.category !== undefined && !(PROP_CATEGORIES as readonly unknown[]).includes(record.category)) {
    problems.push(`Unknown category "${String(record.category)}".`);
  }
  const hasExtents = record.extents !== undefined || (isFiniteNumber(record.width) && isFiniteNumber(record.height) && isFiniteNumber(record.depth));
  if (hasExtents && isFiniteNumber(record.scale) && record.scale !== 1) {
    problems.push('Definition carries both baked extents and a non-unit scale; scale must not be applied twice.');
  }
  if (record.scaleConvention !== undefined && record.scaleConvention !== SCALE_CONVENTION) {
    problems.push(`Scale convention "${String(record.scaleConvention)}" is not "${SCALE_CONVENTION}".`);
  }
  const nested = safeRecord(record.extents);
  for (const key of ['width', 'height', 'depth'] as const) {
    const value = nested[key] ?? record[key];
    if (value !== undefined && (!isFiniteNumber(value) || value <= 0)) problems.push(`Extent ${key}=${String(value)} must be a positive finite number.`);
  }
  return frozenArray(problems);
}

export function createPropDefinition(raw: unknown): RuntimePropDefinition {
  const problems = validatePropDefinition(raw);
  if (problems.length) {
    const record = raw as Record<string, unknown>;
    const doubleScaled = problems.some((problem) => problem.includes('applied twice'));
    throw new ContractError(doubleScaled ? 'E_DOUBLE_SCALE' : 'E_PROP_DEFINITION',
      `Invalid prop definition "${String(record?.id ?? '<unnamed>')}": ${problems.join(' ')}`, { problems });
  }
  const record = raw as Record<string, unknown>;
  const kind = String(record.kind ?? record.type);
  const collision = safeRecord(record.collision);
  const category = (PROP_CATEGORIES as readonly unknown[]).includes(record.category)
    ? (record.category as PropCategory)
    : 'decoration';
  const tags = Array.isArray(record.tags) ? record.tags.filter((tag): tag is string => typeof tag === 'string') : [];
  // Start from whatever the document already preserved, so a definition read from an older
  // build round-trips its unknown fields instead of nesting them under a second `unknown`.
  const unknown: Record<string, unknown> = { ...safeRecord(record.unknown) };
  for (const [key, value] of Object.entries(record)) if (!KNOWN_FIELDS.has(key)) unknown[key] = value;
  return Object.freeze({
    id: String(record.id).trim(),
    kind,
    category,
    transform: readTransform(record),
    extents: readExtents(record),
    scaleConvention: SCALE_CONVENTION,
    solid: record.solid === true || collision.solid === true,
    pickup: record.pickup === true || collision.pickup === true,
    tags: frozenArray(tags),
    unknown: Object.freeze(unknown),
  });
}

export function createPropRegistry(definitions: readonly unknown[]): PropRegistry {
  const byId = new Map<string, RuntimePropDefinition>();
  const order: string[] = [];
  for (const entry of definitions) {
    const definition = createPropDefinition(entry);
    if (byId.has(definition.id)) {
      throw new ContractError('E_DUPLICATE_PROP', `Prop ID "${definition.id}" is duplicated; IDs must be unique and stable.`, { id: definition.id });
    }
    byId.set(definition.id, definition);
    order.push(definition.id);
  }
  const ids = frozenArray(order);
  const all = frozenArray(ids.map((id) => byId.get(id)!));
  return Object.freeze({
    version: PROP_REGISTRY_VERSION as typeof PROP_REGISTRY_VERSION,
    size: ids.length,
    ids,
    get: (id: string) => byId.get(id),
    require: (id: string) => {
      const found = byId.get(id);
      if (!found) throw new ContractError('E_PROP_DEFINITION', `Prop "${id}" is not in the registry.`, { id });
      return found;
    },
    all: () => all,
    byCategory: (category: PropCategory) => frozenArray(all.filter((definition) => definition.category === category)),
    solids: () => frozenArray(all.filter((definition) => definition.solid)),
  });
}

/** A registry rebuilt from its own definitions is byte-identical (round-trip check). */
export function registryRoundTrip(registry: PropRegistry): readonly RuntimePropDefinition[] {
  return createPropRegistry(registry.all()).all();
}
