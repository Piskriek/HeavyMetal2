/**
 * Stable, dependency-free hashing. Used for content-addressed presets and for bundle identity.
 * WHY a hand-rolled hash: no runtime dependencies are allowed and the result must be identical
 * in every JS engine, today and after a reload (so: no object key order, no Date, no Math.random).
 */
import type { Params, PresetKind, Ref, ScriptSource } from '@hm/contracts';

/** JSON with object keys sorted at every level, so equal content always produces equal text. */
export const stableStringify = (value: unknown): string => {
  if (value === null) return 'null';
  const type = typeof value;
  if (type === 'number') return Number.isFinite(value as number) ? JSON.stringify(value as number) : 'null';
  if (type === 'boolean') return (value as boolean) ? 'true' : 'false';
  if (type === 'string') return JSON.stringify(value as string);
  if (type === 'undefined') return 'null';
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  if (type === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
  }
  throw new Error(
    `stableStringify cannot serialise a value of type '${type}'. Presets must be plain JSON data: use numbers, booleans, strings, null, arrays and plain objects.`,
  );
};

/** cyrb53: a fast 53-bit string hash. Not cryptographic; it only has to be stable and collision-shy. */
export const cyrb53 = (text: string, seed = 0): number => {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
};

/** A short, stable base36 hash string for text. */
export const hashText = (text: string): string => cyrb53(text).toString(36).padStart(11, '0');

/** A short, stable base36 hash string for any JSON-serialisable value. */
export const hashValue = (value: unknown): string => hashText(stableStringify(value));

/** The part of a preset that its hash is made of: identity (id, revision) and meta are deliberately excluded. */
export interface PresetContent {
  readonly kind: PresetKind;
  readonly name: string;
  readonly params: Params;
  readonly children: Readonly<Record<string, readonly Ref[]>>;
  readonly script?: ScriptSource;
}

/** Content hash of a preset: equal kind, name, params, children and script means equal hash. */
export const hashPresetContent = (content: PresetContent): string =>
  hashValue({
    kind: content.kind,
    name: content.name,
    params: content.params,
    children: content.children,
    script: content.script,
  });
