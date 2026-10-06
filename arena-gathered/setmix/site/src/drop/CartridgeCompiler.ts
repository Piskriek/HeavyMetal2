/* ============================================================================
 *  packages/setmix-cartridge/src/CartridgeCompiler.ts
 *  ---------------------------------------------------------------------------
 *  THE .smx BINARY WIRE FORMAT.
 *
 *  A cartridge is a physical object in the fiction, so it is a physical object
 *  on disk: one file, one header, four sections, byte-addressable, streamable,
 *  and verifiable before a single instruction is evaluated.
 *
 *  ┌──────────────────────────────────────────────── 64 B HEADER ────────┐
 *  │ 0x00  u32   magic        0x534D5831  "SMX1"                         │
 *  │ 0x04  u16   major        format major (1)                           │
 *  │ 0x06  u16   minor        format minor (0)                           │
 *  │ 0x08  u32   engineVer    minimum engine build                       │
 *  │ 0x0C  u32   flags        bit0 signed · bit1 hasBVH · bit2 hasLOD …  │
 *  │ 0x10  u8[32] sha256      hash of bytes [64 … EOF]                   │
 *  │ 0x30  u8[12] authorId    ASCII, NUL-padded                          │
 *  │ 0x3C  u32   tocCount     number of TOC entries                      │
 *  └──────────────────────────────────────────────────────────────────── ┘
 *  ┌──────────── TOC · tocCount × 16 B ──────────────────────────────────┐
 *  │ u32 sectionId · u32 offset · u32 length · u32 crc32                 │
 *  └──────────────────────────────────────────────────────────────────── ┘
 *    §1 META   UTF-8 JSON   name, tags, description, minStage, maxStage
 *    §2 CODE   AST bytecode compact instructions, evaluated WITHOUT eval()
 *    §3 ART    128×128 thumbnail (PNG/WebP) + 16-entry palette table
 *    §4 GEOM   collision BVH + optional Nanite LOD chain
 *
 *  Everything is little-endian. Sections are 4-byte aligned so a zero-copy
 *  DataView over a slice is always legal.
 * ==========================================================================*/

export const SMX_MAGIC = 0x534d5831;          // "SMX1"
export const SMX_MAJOR = 1;
export const SMX_MINOR = 0;
export const HEADER_BYTES = 64;
export const TOC_ENTRY_BYTES = 16;

export const SECTION = {
  META: 1, CODE: 2, ART: 3, GEOM: 4,
} as const;
export type SectionId = (typeof SECTION)[keyof typeof SECTION];

export const FLAG = {
  SIGNED: 1 << 0, HAS_BVH: 1 << 1, HAS_LOD: 1 << 2,
  ANIMATED: 1 << 3, DEPRECATED: 1 << 4, NSFW_REVIEWED: 1 << 5,
} as const;

/* ─────────────────────────────────────────────────────────── §2 ISA ──── */

/**
 *  THE BYTECODE, AND WHY IT EXISTS.
 *
 *  A cartridge is user-generated content downloaded from strangers. Shipping
 *  a JS closure or anything `eval()`-shaped would make the Galaxy a malware
 *  distribution network. So the Synthesizer graph compiles to a flat,
 *  stack-free, register-based instruction stream over a FIXED opcode table:
 *
 *    · no jumps, no loops, no calls — the graph is a DAG, so a topological
 *      order is a straight line. Halting is guaranteed structurally.
 *    · every operand is a register index or an immediate float. There are no
 *      pointers, so there is nothing to escape.
 *    · the interpreter is a switch over 24 opcodes. It cannot do I/O because
 *      it has no opcode that does I/O.
 *
 *  A hostile cartridge can at worst be slow — and graphCost() rejects that
 *  before it is ever run.
 */
export const OP = {
  NOP: 0x00,
  CONST: 0x01,   // rD ← imm
  NOISE: 0x10, CELLULAR: 0x11, GRAIN: 0x12, STRIPES: 0x13, CHECKER: 0x14,
  CURL: 0x15,
  WARP: 0x20, BLEND: 0x21, LEVELS: 0x22, INVERT: 0x23, SCALEBIAS: 0x24, RAMP: 0x25,
  ADD: 0x30, MUL: 0x31, MIN: 0x32, MAX: 0x33, POW: 0x34, CLAMP: 0x35,
  OUT_ALBEDO: 0xf0, OUT_HEIGHT: 0xf1, OUT_ROUGH: 0xf2,
  END: 0xff,
} as const;
export type Opcode = (typeof OP)[keyof typeof OP];

export const OP_NAME: Record<number, string> = Object.fromEntries(
  Object.entries(OP).map(([k, v]) => [v, k]),
);

/** One instruction: u8 op · u8 dst · u8 a · u8 b · f32 imm0 · f32 imm1 = 12 B */
export const INSTR_BYTES = 12;

export interface Instruction {
  op: Opcode;
  dst: number;
  a: number;
  b: number;
  imm0: number;
  imm1: number;
}

/* ───────────────────────────────────────────────────────── manifest ──── */

export interface SmxMeta {
  name: string;
  author: string;
  tags: string[];
  description: string;
  cls: string;
  minStage: number;
  maxStage: number;
  params: { name: string; real: string; path: string; unit: string;
            min: number; max: number; def: number; tier: number; explain: string }[];
  createdAtTick: number;
  licence: string;
}

export interface SmxArt {
  /** 128×128 RGBA8, or an encoded PNG/WebP when `encoded` is true */
  thumbnail: Uint8Array;
  encoded: boolean;
  /** 16 × RGB8 — the cartridge's own palette, shown on the cassette label */
  palette: Uint8Array;
}

export interface SmxGeom {
  /** flat BVH: 8 × f32 per node (aabbMin3, aabbMax3, left, count) */
  bvh: Float32Array;
  lodVertexCounts: number[];
}

export interface CartridgeManifest {
  meta: SmxMeta;
  code: Instruction[];
  art: SmxArt;
  geom?: SmxGeom;
  flags: number;
  engineVersion: number;
  sha256: Uint8Array;
}

/* ═══════════════════════════════════════════════════ HASH + CHECKSUM ══ */

/**
 *  SHA-256, ~90 lines, no dependency. We need it synchronously inside
 *  packCartridge (WebCrypto's digest is async and would force the whole
 *  compiler to be async for no benefit), and in Node the CLI path can
 *  substitute node:crypto via the injected `hash` option.
 */
const K = new Uint32Array([
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
]);

export function sha256(data: Uint8Array): Uint8Array {
  const H = new Uint32Array([
    0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
  const bitLen = data.length * 8;
  const padded = new Uint8Array((((data.length + 9) >> 6) + 1) << 6);
  padded.set(data);
  padded[data.length] = 0x80;
  const dv = new DataView(padded.buffer);
  dv.setUint32(padded.length - 4, bitLen >>> 0, false);
  dv.setUint32(padded.length - 8, Math.floor(bitLen / 4294967296), false);

  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i-15],7) ^ rotr(w[i-15],18) ^ (w[i-15] >>> 3);
      const s1 = rotr(w[i-2],17) ^ rotr(w[i-2],19) ^ (w[i-2] >>> 10);
      w[i] = (w[i-16] + s0 + w[i-7] + s1) >>> 0;
    }
    let [a,b,c,d,e,f,g,h] = H;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e,6) ^ rotr(e,11) ^ rotr(e,25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rotr(a,2) ^ rotr(a,13) ^ rotr(a,22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      h=g; g=f; f=e; e=(d+t1)>>>0; d=c; c=b; b=a; a=(t1+t2)>>>0;
    }
    H[0]=(H[0]+a)>>>0; H[1]=(H[1]+b)>>>0; H[2]=(H[2]+c)>>>0; H[3]=(H[3]+d)>>>0;
    H[4]=(H[4]+e)>>>0; H[5]=(H[5]+f)>>>0; H[6]=(H[6]+g)>>>0; H[7]=(H[7]+h)>>>0;
  }
  const out = new Uint8Array(32);
  const odv = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) odv.setUint32(i * 4, H[i], false);
  return out;
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export const hex = (b: Uint8Array) =>
  Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");

/* ═══════════════════════════════════════════════════════════ PACK ══════ */

const align4 = (n: number) => (n + 3) & ~3;

export function packCartridge(m: CartridgeManifest): Uint8Array {
  const enc = new TextEncoder();

  /* §1 META */
  const metaBytes = enc.encode(JSON.stringify(m.meta));

  /* §2 CODE */
  const codeBytes = new Uint8Array(m.code.length * INSTR_BYTES);
  const cdv = new DataView(codeBytes.buffer);
  m.code.forEach((ins, i) => {
    const o = i * INSTR_BYTES;
    cdv.setUint8(o, ins.op);
    cdv.setUint8(o + 1, ins.dst & 0xff);
    cdv.setUint8(o + 2, ins.a & 0xff);
    cdv.setUint8(o + 3, ins.b & 0xff);
    cdv.setFloat32(o + 4, ins.imm0, true);
    cdv.setFloat32(o + 8, ins.imm1, true);
  });

  /* §3 ART — 4-byte length prefix, then thumbnail, then 48-byte palette */
  const artBytes = new Uint8Array(8 + m.art.thumbnail.length + m.art.palette.length);
  const adv = new DataView(artBytes.buffer);
  adv.setUint32(0, m.art.thumbnail.length, true);
  adv.setUint32(4, m.art.encoded ? 1 : 0, true);
  artBytes.set(m.art.thumbnail, 8);
  artBytes.set(m.art.palette, 8 + m.art.thumbnail.length);

  /* §4 GEOM */
  let geomBytes = new Uint8Array(0);
  if (m.geom) {
    const lodLen = m.geom.lodVertexCounts.length;
    geomBytes = new Uint8Array(8 + m.geom.bvh.byteLength + lodLen * 4);
    const gdv = new DataView(geomBytes.buffer);
    gdv.setUint32(0, m.geom.bvh.length, true);
    gdv.setUint32(4, lodLen, true);
    new Float32Array(geomBytes.buffer, 8, m.geom.bvh.length).set(m.geom.bvh);
    for (let i = 0; i < lodLen; i++)
      gdv.setUint32(8 + m.geom.bvh.byteLength + i * 4, m.geom.lodVertexCounts[i], true);
  }

  const sections: { id: SectionId; data: Uint8Array }[] = [
    { id: SECTION.META, data: metaBytes },
    { id: SECTION.CODE, data: codeBytes },
    { id: SECTION.ART, data: artBytes },
  ];
  if (geomBytes.length) sections.push({ id: SECTION.GEOM, data: geomBytes });

  const tocBytes = sections.length * TOC_ENTRY_BYTES;
  let offset = align4(HEADER_BYTES + tocBytes);
  const placed = sections.map((s) => {
    const at = offset;
    offset = align4(offset + s.data.length);
    return { ...s, offset: at };
  });

  const out = new Uint8Array(offset);
  const dv = new DataView(out.buffer);

  /* header */
  dv.setUint32(0x00, SMX_MAGIC, false);          // magic is big-endian so it
  dv.setUint16(0x04, SMX_MAJOR, true);           // reads as "SMX1" in a hex dump
  dv.setUint16(0x06, SMX_MINOR, true);
  dv.setUint32(0x08, m.engineVersion, true);
  dv.setUint32(0x0c, m.flags, true);
  const author = enc.encode(m.meta.author.slice(0, 12));
  out.set(author, 0x30);
  dv.setUint32(0x3c, placed.length, true);

  /* toc */
  placed.forEach((s, i) => {
    const o = HEADER_BYTES + i * TOC_ENTRY_BYTES;
    dv.setUint32(o + 0, s.id, true);
    dv.setUint32(o + 4, s.offset, true);
    dv.setUint32(o + 8, s.data.length, true);
    dv.setUint32(o + 12, crc32(s.data), true);
  });

  /* payload */
  for (const s of placed) out.set(s.data, s.offset);

  /* hash covers everything after the header, so the header can carry it */
  const digest = sha256(out.subarray(HEADER_BYTES));
  out.set(digest, 0x10);

  return out;
}

/* ═════════════════════════════════════════════════════════ UNPACK ══════ */

export interface UnpackResult {
  manifest: CartridgeManifest;
  sections: { id: number; offset: number; length: number; crc: number; crcOk: boolean }[];
  hashOk: boolean;
  bytes: number;
}

export function unpackCartridge(buf: Uint8Array): UnpackResult {
  if (buf.length < HEADER_BYTES) throw new Error("truncated: shorter than the header");
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

  const magic = dv.getUint32(0x00, false);
  if (magic !== SMX_MAGIC)
    throw new Error(`bad magic 0x${magic.toString(16)} — not a .smx file`);
  const major = dv.getUint16(0x04, true);
  if (major !== SMX_MAJOR) throw new Error(`unsupported major version ${major}`);

  const engineVersion = dv.getUint32(0x08, true);
  const flags = dv.getUint32(0x0c, true);
  const storedHash = buf.slice(0x10, 0x30);
  const tocCount = dv.getUint32(0x3c, true);

  const sections: UnpackResult["sections"] = [];
  const raw = new Map<number, Uint8Array>();
  for (let i = 0; i < tocCount; i++) {
    const o = HEADER_BYTES + i * TOC_ENTRY_BYTES;
    const id = dv.getUint32(o + 0, true);
    const offset = dv.getUint32(o + 4, true);
    const length = dv.getUint32(o + 8, true);
    const crc = dv.getUint32(o + 12, true);
    if (offset + length > buf.length) throw new Error(`section ${id} overruns the file`);
    const data = buf.subarray(offset, offset + length);
    const crcOk = crc32(data) === crc;
    sections.push({ id, offset, length, crc, crcOk });
    raw.set(id, data);
  }

  const actual = sha256(buf.subarray(HEADER_BYTES));
  const hashOk = hex(actual) === hex(storedHash);

  const dec = new TextDecoder();
  const metaRaw = raw.get(SECTION.META);
  if (!metaRaw) throw new Error("missing §1 META");
  const meta = JSON.parse(dec.decode(metaRaw)) as SmxMeta;

  const code: Instruction[] = [];
  const codeRaw = raw.get(SECTION.CODE);
  if (codeRaw) {
    const cdv = new DataView(codeRaw.buffer, codeRaw.byteOffset, codeRaw.byteLength);
    for (let o = 0; o + INSTR_BYTES <= codeRaw.length; o += INSTR_BYTES) {
      code.push({
        op: cdv.getUint8(o) as Opcode,
        dst: cdv.getUint8(o + 1), a: cdv.getUint8(o + 2), b: cdv.getUint8(o + 3),
        imm0: cdv.getFloat32(o + 4, true), imm1: cdv.getFloat32(o + 8, true),
      });
    }
  }

  let art: SmxArt = { thumbnail: new Uint8Array(0), encoded: false, palette: new Uint8Array(48) };
  const artRaw = raw.get(SECTION.ART);
  if (artRaw && artRaw.length >= 8) {
    const adv = new DataView(artRaw.buffer, artRaw.byteOffset, artRaw.byteLength);
    const thumbLen = adv.getUint32(0, true);
    art = {
      thumbnail: artRaw.subarray(8, 8 + thumbLen),
      encoded: adv.getUint32(4, true) === 1,
      palette: artRaw.subarray(8 + thumbLen),
    };
  }

  let geom: SmxGeom | undefined;
  const geomRaw = raw.get(SECTION.GEOM);
  if (geomRaw && geomRaw.length >= 8) {
    const gdv = new DataView(geomRaw.buffer, geomRaw.byteOffset, geomRaw.byteLength);
    const bvhLen = gdv.getUint32(0, true);
    const lodLen = gdv.getUint32(4, true);
    const bvh = new Float32Array(bvhLen);
    for (let i = 0; i < bvhLen; i++) bvh[i] = gdv.getFloat32(8 + i * 4, true);
    const lodVertexCounts: number[] = [];
    for (let i = 0; i < lodLen; i++)
      lodVertexCounts.push(gdv.getUint32(8 + bvhLen * 4 + i * 4, true));
    geom = { bvh, lodVertexCounts };
  }

  return {
    manifest: { meta, code, art, geom, flags, engineVersion, sha256: storedHash },
    sections, hashOk, bytes: buf.length,
  };
}

/* ═══════════════════════════════════════════ COMPILE: DAG → BYTECODE ══ */

const OP_FOR_TYPE: Record<string, Opcode> = {
  noise: OP.NOISE, cellular: OP.CELLULAR, grain: OP.GRAIN, stripes: OP.STRIPES,
  checker: OP.CHECKER, curl: OP.CURL, warp: OP.WARP, blend: OP.BLEND,
  levels: OP.LEVELS, invert: OP.INVERT, scaleBias: OP.SCALEBIAS,
  ramp: OP.RAMP, constant: OP.CONST,
};

/**
 *  Topological sort → register allocation → flat instruction stream.
 *  Because the source is a DAG, the emitted program has no control flow at
 *  all: it is a straight line that provably terminates in `code.length`
 *  steps. That property is the security model.
 */
export function compileGraph(
  graph: { nodes: { id: string; type: string; [k: string]: unknown }[];
           out: { albedo?: string; height?: string; roughness?: string } },
): Instruction[] {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const reg = new Map<string, number>();
  const code: Instruction[] = [];
  const seen = new Set<string>();
  let next = 0;
  const EDGES = ["input", "a", "b", "by", "mask", "potential", "vectorField"] as const;

  const emit = (id: string | undefined, depth = 0): number => {
    if (!id || depth > 64) return 0;
    const hit = reg.get(id);
    if (hit !== undefined) return hit;
    const n = byId.get(id);
    if (!n || seen.has(id)) return 0;
    seen.add(id);

    const operands: number[] = [];
    for (const k of EDGES) if (typeof n[k] === "string") operands.push(emit(n[k] as string, depth + 1));

    const dst = next++;
    reg.set(id, dst);
    const num = (k: string, d: number) => (typeof n[k] === "number" ? (n[k] as number) : d);
    code.push({
      op: OP_FOR_TYPE[n.type] ?? OP.NOP,
      dst,
      a: operands[0] ?? 0,
      b: operands[1] ?? 0,
      imm0: num("freq", num("amount", num("factor", num("value", num("scale", 0))))),
      imm1: num("octaves", num("gamma", num("jitter", num("angle", num("bias", 0))))),
    });
    return dst;
  };

  if (graph.out.albedo) code.push({ op: OP.OUT_ALBEDO, dst: 0, a: emit(graph.out.albedo), b: 0, imm0: 0, imm1: 0 });
  if (graph.out.height) code.push({ op: OP.OUT_HEIGHT, dst: 0, a: emit(graph.out.height), b: 0, imm0: 0, imm1: 0 });
  if (graph.out.roughness) code.push({ op: OP.OUT_ROUGH, dst: 0, a: emit(graph.out.roughness), b: 0, imm0: 0, imm1: 0 });
  code.push({ op: OP.END, dst: 0, a: 0, b: 0, imm0: 0, imm1: 0 });
  return code;
}

export function disassemble(code: readonly Instruction[]): string[] {
  return code.map((i, k) => {
    const name = (OP_NAME[i.op] ?? "???").padEnd(10);
    const args = i.op === OP.CONST ? `#${i.imm0.toFixed(3)}`
      : i.op >= 0xf0 ? `r${i.a}`
      : `r${i.a}, r${i.b}, ${i.imm0.toFixed(2)}, ${i.imm1.toFixed(2)}`;
    return `${String(k).padStart(3, "0")}  ${name} r${String(i.dst).padStart(2)} ← ${args}`;
  });
}

/* ═══════════════════════════════════════════════════════ VERIFY ════════ */

export interface VerifyReport {
  ok: boolean;
  magic: boolean;
  version: boolean;
  hash: boolean;
  crcs: boolean;
  sections: number;
  instructions: number;
  unknownOpcodes: number[];
  registerHigh: number;
  bytes: number;
  errors: string[];
  warnings: string[];
}

/**
 *  The gate every downloaded cartridge passes before it is ever interpreted.
 *  Note what is checked and in which order: structure, then integrity, then
 *  the instruction stream. We never parse §2 until §2's CRC has matched,
 *  and we never run it until every opcode is in the known table.
 */
export function verifyCartridge(buf: Uint8Array): VerifyReport {
  const r: VerifyReport = {
    ok: false, magic: false, version: false, hash: false, crcs: false,
    sections: 0, instructions: 0, unknownOpcodes: [], registerHigh: 0,
    bytes: buf.length, errors: [], warnings: [],
  };
  try {
    const u = unpackCartridge(buf);
    r.magic = true; r.version = true;
    r.hash = u.hashOk;
    r.crcs = u.sections.every((s) => s.crcOk);
    r.sections = u.sections.length;
    r.instructions = u.manifest.code.length;

    if (!u.hashOk) r.errors.push("SHA-256 mismatch — the payload was altered after packing");
    for (const s of u.sections)
      if (!s.crcOk) r.errors.push(`section ${s.id} failed CRC32`);

    const known = new Set<number>(Object.values(OP));
    for (const ins of u.manifest.code) {
      if (!known.has(ins.op)) { r.unknownOpcodes.push(ins.op); }
      r.registerHigh = Math.max(r.registerHigh, ins.dst, ins.a, ins.b);
    }
    if (r.unknownOpcodes.length)
      r.errors.push(`${r.unknownOpcodes.length} unknown opcode(s) — refusing to interpret`);
    if (r.registerHigh > 255) r.errors.push("register index out of range");
    if (u.manifest.code.length && u.manifest.code[u.manifest.code.length - 1].op !== OP.END)
      r.warnings.push("missing END terminator");
    if (!u.manifest.meta.description) r.warnings.push("no description — it will not surface in search");
    if (u.manifest.art.thumbnail.length === 0) r.warnings.push("no thumbnail — the cassette label will be blank");

    r.ok = r.errors.length === 0;
  } catch (e) {
    r.errors.push((e as Error).message);
  }
  return r;
}

/* ═════════════════════════════════════════════════════════ THE CLI ════ */

/**
 *  tools/smx/cli.ts — runs under Node 20+ or Bun with no dependencies.
 *
 *    setmix pack    <dir>        → <dir>.smx
 *    setmix inspect <file.smx>   → header, TOC, metadata, disassembly
 *    setmix verify  <file.smx>   → exit 0 ok, exit 1 rejected
 */
export const CLI_SOURCE = String.raw`#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import {
  packCartridge, unpackCartridge, verifyCartridge, compileGraph,
  disassemble, hex, SECTION, FLAG,
} from "@hm/setmix-cartridge";

const [cmd, target, ...rest] = process.argv.slice(2);
const die = (m) => { console.error("setmix: " + m); process.exit(1); };
const C = { dim: "\x1b[2m", b: "\x1b[1m", g: "\x1b[32m", r: "\x1b[31m", y: "\x1b[33m", x: "\x1b[0m" };

if (cmd === "pack") {
  if (!target || !existsSync(target)) die("pack <dir> — directory not found");
  const meta  = JSON.parse(readFileSync(join(target, "meta.json"), "utf8"));
  const graph = JSON.parse(readFileSync(join(target, "graph.json"), "utf8"));
  const thumbPath = join(target, "thumb.png");
  const thumbnail = existsSync(thumbPath) ? new Uint8Array(readFileSync(thumbPath)) : new Uint8Array(0);
  const palPath = join(target, "palette.bin");
  const palette = existsSync(palPath) ? new Uint8Array(readFileSync(palPath)) : new Uint8Array(48);

  const bytes = packCartridge({
    meta, code: compileGraph(graph),
    art: { thumbnail, encoded: thumbnail.length > 0, palette },
    flags: FLAG.SIGNED | (existsSync(join(target, "bvh.bin")) ? FLAG.HAS_BVH : 0),
    engineVersion: 70000, sha256: new Uint8Array(32),
  });

  const out = (rest[0] ?? basename(target)) + ".smx";
  writeFileSync(out, bytes);
  console.log(C.g + "✓" + C.x + " packed " + C.b + out + C.x +
    "  " + bytes.length.toLocaleString() + " B  " +
    C.dim + hex(unpackCartridge(bytes).manifest.sha256).slice(0, 16) + "…" + C.x);
}

else if (cmd === "inspect") {
  if (!target || !existsSync(target)) die("inspect <file.smx> — file not found");
  const buf = new Uint8Array(readFileSync(target));
  const u = unpackCartridge(buf);
  const m = u.manifest;
  const NAMES = { 1: "META", 2: "CODE", 3: "ART ", 4: "GEOM" };

  console.log("");
  console.log(C.b + "  " + m.meta.name + C.x + C.dim + "  by " + m.meta.author + C.x);
  console.log("  " + C.dim + m.meta.description + C.x);
  console.log("");
  console.log("  " + C.dim + "magic    " + C.x + "SMX1   " +
              C.dim + "engine " + C.x + m.engineVersion +
              C.dim + "   flags 0b" + C.x + m.flags.toString(2).padStart(6, "0"));
  console.log("  " + C.dim + "sha256   " + C.x + hex(m.sha256));
  console.log("  " + C.dim + "size     " + C.x + u.bytes.toLocaleString() + " B" +
              C.dim + "   stages S" + C.x + m.meta.minStage + "–S" + m.meta.maxStage);
  console.log("");
  console.log("  " + C.dim + "SECTION   OFFSET    LENGTH     CRC32    OK" + C.x);
  for (const s of u.sections)
    console.log("  " + (NAMES[s.id] ?? s.id) + "     " +
      String(s.offset).padStart(6) + "  " + String(s.length).padStart(8) + "  " +
      s.crc.toString(16).padStart(8, "0") + "   " +
      (s.crcOk ? C.g + "✓" : C.r + "✕") + C.x);
  console.log("");
  console.log("  " + C.dim + "params (" + m.meta.params.length + ")" + C.x);
  for (const p of m.meta.params)
    console.log("    " + p.name.padEnd(18) + C.dim + p.real.padEnd(26) +
      "[" + p.min + "…" + p.max + "] " + p.unit + C.x);
  console.log("");
  console.log("  " + C.dim + "disassembly (" + m.code.length + " instructions)" + C.x);
  for (const line of disassemble(m.code)) console.log("    " + C.dim + line + C.x);
  console.log("");
}

else if (cmd === "verify") {
  if (!target || !existsSync(target)) die("verify <file.smx> — file not found");
  const r = verifyCartridge(new Uint8Array(readFileSync(target)));
  const row = (k, v) => console.log("  " + (v ? C.g + "✓" : C.r + "✕") + C.x + " " + k);
  console.log("");
  row("magic 0x534D5831", r.magic);
  row("format version", r.version);
  row("SHA-256 payload hash", r.hash);
  row("section CRC32s (" + r.sections + ")", r.crcs);
  row("opcode table (" + r.instructions + " instr)", r.unknownOpcodes.length === 0);
  for (const w of r.warnings) console.log("  " + C.y + "!" + C.x + " " + w);
  for (const e of r.errors)   console.log("  " + C.r + "✕" + C.x + " " + e);
  console.log("");
  console.log(r.ok ? C.g + "  PASS" + C.x : C.r + "  REJECTED" + C.x);
  process.exit(r.ok ? 0 : 1);
}

else {
  console.log("");
  console.log("  " + C.b + "setmix" + C.x + " — .smx cartridge toolchain");
  console.log("");
  console.log("    setmix pack    <dir> [name]   compile a cartridge directory");
  console.log("    setmix inspect <file.smx>     header, TOC, metadata, disassembly");
  console.log("    setmix verify  <file.smx>     integrity gate; exit 1 on reject");
  console.log("");
  process.exit(cmd ? 1 : 0);
}
`;

export const SMX_NOTES = [
  ["Bytecode, because the Galaxy is UGC",
   "Shipping a JS closure would make federation a malware vector. The DAG compiles to a flat register machine over 24 fixed opcodes — no jumps, no calls, no I/O opcode. A hostile cartridge can at worst be slow, and graphCost() rejects that before it runs."],
  ["Halting is structural",
   "The source is a DAG, so a topological order is a straight line. The program provably terminates in code.length steps. There is no loop construct to abuse because there is no loop construct."],
  ["Hash the payload, store it in the header",
   "SHA-256 covers bytes [64…EOF], so the header can carry its own digest without a chicken-and-egg. Per-section CRC32 localises corruption to one chunk, which matters when a 4 MB cartridge streams over a flaky link."],
  ["Verify in dependency order",
   "Structure → integrity → instructions. §2 is never parsed until §2's CRC matches, and never interpreted until every opcode is in the table. Rejections are specific enough to be actionable."],
  ["4-byte aligned sections",
   "A zero-copy DataView over any section slice is always legal, so inspecting a 40 MB cartridge costs one mmap and no allocation."],
] as const;
