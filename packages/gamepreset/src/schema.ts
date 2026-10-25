/** Small strict JSON schemas shared by game presets and Spore Cards. No coercion, defaults, code or class revival. */
export type JsonRule = (value: unknown, path: string) => void;
export type ParseResult<T> = { readonly success: true; readonly data: T } | { readonly success: false; readonly error: { readonly message: string } };
export interface FrozenSchema<T> {
  parse(value: unknown): T;
  safeParse(value: unknown): ParseResult<T>;
}

export function invalid(path: string, why: string): never { throw new Error(`${path}: ${why}`); }

/** Rejects accessors/toJSON, cycles, prototype keys, non-finite numbers and excessive nesting *before* serialization. */
export function frozenJsonCopy<T>(value: T): T {
  const seen = new Set<object>();
  let nodes = 0;
  function copy(v: unknown, depth: number): unknown {
    if (++nodes > 50_000 || depth > 32) invalid('$', 'JSON complexity limit exceeded');
    if (v === null || typeof v === 'boolean' || typeof v === 'string') return v;
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v !== 'object' || v === null) invalid('$', 'only finite, closure-free JSON data is allowed');
    if (seen.has(v)) invalid('$', 'cyclic JSON');
    const array = Array.isArray(v);
    if (Object.getPrototypeOf(v) !== (array ? Array.prototype : Object.prototype) && Object.getPrototypeOf(v) !== null) invalid('$', 'expected plain JSON');
    seen.add(v);
    const out: Record<string, unknown> | unknown[] = array ? [] : {};
    for (const key of Reflect.ownKeys(v)) {
      if (array && key === 'length') continue;
      if (typeof key !== 'string' || ['__proto__', 'prototype', 'constructor'].includes(key)) invalid('$', 'unsafe JSON key');
      if (array && (!/^(0|[1-9][0-9]*)$/.test(key) || !Number.isSafeInteger(Number(key)) || Number(key) >= (v as unknown[]).length)) invalid('$', 'non-JSON array property');
      const d = Object.getOwnPropertyDescriptor(v, key)!;
      if (!d.enumerable || !('value' in d)) invalid('$', 'accessors and hidden properties are not JSON');
      (out as Record<string, unknown>)[key] = copy(d.value, depth + 1);
    }
    if (array && (out as unknown[]).length !== (v as unknown[]).length) invalid('$', 'sparse JSON array');
    if (array) for (let i = 0; i < (v as unknown[]).length; i++) if (!Object.hasOwn(v, i)) invalid('$', 'sparse JSON array');
    seen.delete(v);
    return Object.freeze(out);
  }
  return copy(value, 0) as T;
}

export function frozenSchema<T>(rule: JsonRule): FrozenSchema<T> {
  const parse = (value: unknown): T => { const data = frozenJsonCopy(value); rule(data, '$'); return data as T; };
  return Object.freeze({
    parse,
    safeParse(value: unknown): ParseResult<T> {
      try { return { success: true, data: parse(value) }; }
      catch (e) { return { success: false, error: { message: e instanceof Error ? e.message : 'Invalid JSON schema' } }; }
    },
  });
}

export const number = (min: number, max: number, integer = false): JsonRule => (v, p) => {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max || (integer && !Number.isSafeInteger(v))) invalid(p, `expected ${integer ? 'integer' : 'number'} in ${min}..${max}`);
};
export const text = (max = 128, min = 1): JsonRule => (v, p) => {
  if (typeof v !== 'string' || v.length < min || v.length > max || /[\u0000-\u001f\u007f]/.test(v)) invalid(p, `expected text (${min}..${max} characters)`);
};
export const id: JsonRule = (v, p) => { text()(v, p); if (!/^[a-zA-Z0-9][a-zA-Z0-9_:.\-/]*$/.test(v as string)) invalid(p, 'invalid id'); };
export const boolean: JsonRule = (v, p) => { if (typeof v !== 'boolean') invalid(p, 'expected boolean'); };
export const oneOf = (values: readonly (string | number)[]): JsonRule => (v, p) => { if (!values.includes(v as string)) invalid(p, `expected one of ${values.join(', ')}`); };
export const optional = (rule: JsonRule): JsonRule => (v, p) => { if (v !== undefined) rule(v, p); };
export const shape = (fields: Readonly<Record<string, JsonRule>>): JsonRule => (v, p) => {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) invalid(p, 'expected object');
  const obj = v as Record<string, unknown>;
  for (const key of Object.keys(obj)) if (!Object.hasOwn(fields, key)) invalid(`${p}.${key}`, 'unknown field');
  for (const [key, rule] of Object.entries(fields)) rule(obj[key], `${p}.${key}`);
};
export const list = (rule: JsonRule, max: number, min = 0): JsonRule => (v, p) => {
  if (!Array.isArray(v) || v.length < min || v.length > max) invalid(p, `expected array (${min}..${max} entries)`);
  v.forEach((x, i) => rule(x, `${p}[${i}]`));
};
export const dictionary = (rule: JsonRule, max: number, min = 0): JsonRule => (v, p) => {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) invalid(p, 'expected dictionary');
  const entries = Object.entries(v);
  if (entries.length < min || entries.length > max) invalid(p, 'dictionary size limit');
  for (const [key, x] of entries) { id(key, `${p}.${key}`); rule(x, `${p}.${key}`); }
};
export const vector = (min = -10_000, max = 10_000): JsonRule => list(number(min, max), 3, 3);

/** Stable key ordering; does not quantize or discard any preset fields. */
export function canonicalJson(value: unknown): string {
  const data = frozenJsonCopy(value);
  const encode = (v: unknown): string => {
    if (v === null || typeof v !== 'object') return Object.is(v, -0) ? '-0' : JSON.stringify(v);
    if (Array.isArray(v)) return `[${v.map(encode).join(',')}]`;
    const r = v as Record<string, unknown>;
    return `{${Object.keys(r).sort().map((k) => `${JSON.stringify(k)}:${encode(r[k])}`).join(',')}}`;
  };
  return encode(data);
}
