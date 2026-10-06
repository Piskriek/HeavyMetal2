/**
 * FNV-1a 32-bit over a key-sorted serialisation, with non-integer numbers pinned to 6 decimals,
 * so the same data hashes the same on every machine (0.1 + 0.2 hashes as 0.3). Only graphs and
 * parameters are hashed, never evaluated pixels.
 */
export function contentHash(value: unknown): string {
  const stable = (x: unknown): string => {
    if (x === null || x === undefined) return "n";
    if (Array.isArray(x)) return "[" + x.map(stable).join(",") + "]";
    if (typeof x === "object") {
      const record = x as Record<string, unknown>;
      return "{" + Object.keys(record).sort().map((k) => k + ":" + stable(record[k])).join(",") + "}";
    }
    if (typeof x === "number") return Number.isInteger(x) ? String(x) : x.toFixed(6);
    return String(x);
  };
  const text = stable(value);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return "0x" + h.toString(16).padStart(8, "0");
}
