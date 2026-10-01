import type { Value } from '@hm/contracts';

/**
 * A streaming 64-bit hash (two independent 32-bit FNV-1a lanes). Numbers are hashed by their IEEE bits, with -0 folded into 0,
 * so equal state always gives an equal hash and nothing is allocated per value.
 */
export class Hasher {
  private a = 0x811c9dc5;
  private b = 0x9e3779b1;
  private readonly f64 = new Float64Array(1);
  private readonly u32 = new Uint32Array(this.f64.buffer);

  private byte(x: number): void {
    this.a = Math.imul(this.a ^ x, 0x01000193);
    this.b = Math.imul(this.b ^ (x + 0x5b), 0x85ebca6b);
  }

  private int32(x: number): void {
    this.byte(x & 255);
    this.byte((x >>> 8) & 255);
    this.byte((x >>> 16) & 255);
    this.byte((x >>> 24) & 255);
  }

  str(s: string): void {
    this.byte(1);
    this.int32(s.length);
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      this.byte(c & 255);
      this.byte(c >>> 8);
    }
  }

  num(n: number): void {
    if (Number.isNaN(n)) throw new Error('hash: NaN in simulation state (it would make runs differ)');
    this.byte(2);
    this.f64[0] = n === 0 ? 0 : n;
    this.int32(this.u32[0] as number);
    this.int32(this.u32[1] as number);
  }

  value(v: Value | undefined): void {
    if (v === undefined) { this.byte(0); return; }
    if (v === null) { this.byte(3); return; }
    switch (typeof v) {
      case 'number': this.num(v); return;
      case 'string': this.str(v); return;
      case 'boolean': this.byte(v ? 4 : 5); return;
      default: break;
    }
    if (Array.isArray(v)) {
      this.byte(6);
      this.int32(v.length);
      for (const item of v) this.value(item as Value);
      return;
    }
    const obj = v as { readonly [k: string]: Value };
    const keys = Object.keys(obj).sort();
    this.byte(7);
    this.int32(keys.length);
    for (const k of keys) { this.str(k); this.value(obj[k]); }
  }

  hex(): string {
    return (this.a >>> 0).toString(16).padStart(8, '0') + (this.b >>> 0).toString(16).padStart(8, '0');
  }
}

/** Throws if a value holds a NaN anywhere (NaN poisons determinism: it never equals itself). */
export function assertNoNaN(v: Value, where: string): void {
  if (typeof v === 'number') {
    if (Number.isNaN(v)) throw new Error(`${where}: NaN is not allowed in simulation state`);
  } else if (Array.isArray(v)) {
    for (const x of v) assertNoNaN(x as Value, where);
  } else if (v !== null && typeof v === 'object') {
    for (const x of Object.values(v)) assertNoNaN(x as Value, where);
  }
}

/** A deep copy of plain JSON-like data. */
export function cloneValue<T extends Value>(v: T): T {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map((x) => cloneValue(x as Value)) as unknown as T;
  const out: Record<string, Value> = {};
  for (const [k, x] of Object.entries(v)) out[k] = cloneValue(x as Value);
  return out as unknown as T;
}
