#!/usr/bin/env node
/**
 * Reads a save written in Odin Serializer's binary format (the format Unity games such as Plasma use for their world and device
 * files) into a JSON tree, read-only. Odin Serializer is open source (Apache 2.0, github.com/TeamSirenix/odin-serializer); this
 * follows its BinaryDataWriter's entry layout. It is for the mimic work (docs/MIMIC_GAMES_RESEARCH.md): only numbers and
 * structure from the owner's own saves and his Workshop downloads are read, and nothing is written into any game's files.
 *
 *   node scripts/read-odin-save.mjs <file> [--out <file.json>]
 *
 * The tree: a node is { $type, $id, ...fields } (or an array of entries); primitive arrays are { $prim, bytes, length } with their
 * first values decoded where the element size is known.
 */
import fs from 'node:fs';

const E = {
  NamedStartOfReferenceNode: 0x01, UnnamedStartOfReferenceNode: 0x02, NamedStartOfStructNode: 0x03, UnnamedStartOfStructNode: 0x04,
  EndOfNode: 0x05, StartOfArray: 0x06, EndOfArray: 0x07, PrimitiveArray: 0x08,
  NamedInternalReference: 0x09, UnnamedInternalReference: 0x0a, NamedExternalReferenceByIndex: 0x0b, UnnamedExternalReferenceByIndex: 0x0c,
  NamedExternalReferenceByGuid: 0x0d, UnnamedExternalReferenceByGuid: 0x0e,
  NamedSByte: 0x0f, UnnamedSByte: 0x10, NamedByte: 0x11, UnnamedByte: 0x12, NamedShort: 0x13, UnnamedShort: 0x14,
  NamedUShort: 0x15, UnnamedUShort: 0x16, NamedInt: 0x17, UnnamedInt: 0x18, NamedUInt: 0x19, UnnamedUInt: 0x1a,
  NamedLong: 0x1b, UnnamedLong: 0x1c, NamedULong: 0x1d, UnnamedULong: 0x1e, NamedFloat: 0x1f, UnnamedFloat: 0x20,
  NamedDouble: 0x21, UnnamedDouble: 0x22, NamedDecimal: 0x23, UnnamedDecimal: 0x24, NamedChar: 0x25, UnnamedChar: 0x26,
  NamedString: 0x27, UnnamedString: 0x28, NamedGuid: 0x29, UnnamedGuid: 0x2a, NamedBoolean: 0x2b, UnnamedBoolean: 0x2c,
  NamedNull: 0x2d, UnnamedNull: 0x2e, TypeName: 0x2f, TypeID: 0x30, EndOfStream: 0x31,
  NamedExternalReferenceByString: 0x32, UnnamedExternalReferenceByString: 0x33,
};

export function readOdin(buf) {
  let p = 0;
  const types = new Map();
  const u8 = () => buf[p++];
  const i32 = () => { const v = buf.readInt32LE(p); p += 4; return v; };
  const str = () => {
    const wide = u8();
    const n = i32();
    if (n < 0 || n > 1 << 24) throw new Error(`bad string length ${n} at ${p}`);
    let s;
    if (wide === 1) { s = buf.toString('utf16le', p, p + n * 2); p += n * 2; } else { s = buf.toString('latin1', p, p + n); p += n; }
    return s;
  };
  const guid = () => { const g = buf.subarray(p, p + 16).toString('hex'); p += 16; return g; };
  /** A type entry before a node: a new type name (with its id) or an id already seen; or a null type. */
  const typeEntry = () => {
    const t = u8();
    if (t === E.TypeName) { const id = i32(); const name = str(); types.set(id, name); return name; }
    if (t === E.TypeID) return types.get(i32()) ?? '?';
    if (t === E.UnnamedNull) return null;
    throw new Error(`expected a type entry, found 0x${t.toString(16)} at ${p - 1}`);
  };
  const primitive = () => {
    const count = i32();
    const size = i32();
    const bytes = buf.subarray(p, p + count * size);
    p += count * size;
    const out = { $prim: true, length: count, elementSize: size };
    if (size === 4 && count <= 4096) out.values = Array.from({ length: count }, (_, k) => bytes.readFloatLE(k * 4));
    else if (size === 1 && count <= 4096) out.values = Array.from(bytes);
    return out;
  };

  /** Reads entries until an end marker; returns [entries as {name, value}, ended by]. */
  function entries(until) {
    const list = [];
    while (p < buf.length) {
      const t = u8();
      if (t === until || t === E.EndOfStream) return list;
      const named = [E.NamedStartOfReferenceNode, E.NamedStartOfStructNode, E.NamedInternalReference, E.NamedExternalReferenceByIndex,
        E.NamedExternalReferenceByGuid, E.NamedSByte, E.NamedByte, E.NamedShort, E.NamedUShort, E.NamedInt, E.NamedUInt, E.NamedLong,
        E.NamedULong, E.NamedFloat, E.NamedDouble, E.NamedDecimal, E.NamedChar, E.NamedString, E.NamedGuid, E.NamedBoolean, E.NamedNull,
        E.NamedExternalReferenceByString].includes(t);
      const name = named ? str() : null;
      let value;
      switch (t) {
        case E.NamedStartOfReferenceNode: case E.UnnamedStartOfReferenceNode: {
          const $type = typeEntry(); const $id = i32();
          value = { $type, $id, ...fold(entries(E.EndOfNode)) };
          break;
        }
        case E.NamedStartOfStructNode: case E.UnnamedStartOfStructNode: {
          const $type = typeEntry();
          value = { $type, ...fold(entries(E.EndOfNode)) };
          break;
        }
        case E.StartOfArray: { const n = Number(buf.readBigInt64LE(p)); p += 8; value = entries(E.EndOfArray).map((e) => e.value); value.$declared = n; break; }
        case E.PrimitiveArray: value = primitive(); break;
        case E.NamedInternalReference: case E.UnnamedInternalReference: value = { $ref: i32() }; break;
        case E.NamedExternalReferenceByIndex: case E.UnnamedExternalReferenceByIndex: value = { $extIndex: i32() }; break;
        case E.NamedExternalReferenceByGuid: case E.UnnamedExternalReferenceByGuid: value = { $extGuid: guid() }; break;
        case E.NamedExternalReferenceByString: case E.UnnamedExternalReferenceByString: value = { $extString: str() }; break;
        case E.NamedSByte: case E.UnnamedSByte: value = buf.readInt8(p); p += 1; break;
        case E.NamedByte: case E.UnnamedByte: value = buf[p]; p += 1; break;
        case E.NamedShort: case E.UnnamedShort: value = buf.readInt16LE(p); p += 2; break;
        case E.NamedUShort: case E.UnnamedUShort: value = buf.readUInt16LE(p); p += 2; break;
        case E.NamedInt: case E.UnnamedInt: value = i32(); break;
        case E.NamedUInt: case E.UnnamedUInt: value = buf.readUInt32LE(p); p += 4; break;
        case E.NamedLong: case E.UnnamedLong: value = Number(buf.readBigInt64LE(p)); p += 8; break;
        case E.NamedULong: case E.UnnamedULong: value = Number(buf.readBigUInt64LE(p)); p += 8; break;
        case E.NamedFloat: case E.UnnamedFloat: value = buf.readFloatLE(p); p += 4; break;
        case E.NamedDouble: case E.UnnamedDouble: value = buf.readDoubleLE(p); p += 8; break;
        case E.NamedDecimal: case E.UnnamedDecimal: value = { $decimal: buf.subarray(p, p + 16).toString('hex') }; p += 16; break;
        case E.NamedChar: case E.UnnamedChar: value = String.fromCharCode(buf.readUInt16LE(p)); p += 2; break;
        case E.NamedString: case E.UnnamedString: value = str(); break;
        case E.NamedGuid: case E.UnnamedGuid: value = { $guid: guid() }; break;
        case E.NamedBoolean: case E.UnnamedBoolean: value = buf[p] !== 0; p += 1; break;
        case E.NamedNull: case E.UnnamedNull: value = null; break;
        case E.TypeName: { const id = i32(); types.set(id, str()); continue; }
        case E.TypeID: i32(); continue;
        default: throw new Error(`unknown entry 0x${t.toString(16)} at ${p - 1}`);
      }
      list.push({ name, value });
    }
    return list;
  }
  /** Named entries to fields; unnamed ones (a dictionary's or list's) to $items. */
  function fold(list) {
    const o = {};
    for (const { name, value } of list) {
      if (name === null) (o.$items ??= []).push(value);
      else o[name] = value;
    }
    return o;
  }
  const top = entries(E.EndOfStream);
  return { root: top.length === 1 ? top[0].value : top.map((e) => e.value), types: [...types.values()], end: p, size: buf.length };
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/').replace(/^([A-Za-z]):/, '/$1:')}` || process.argv[1]?.endsWith('read-odin-save.mjs')) {
  const file = process.argv[2];
  if (!file) { console.error('usage: node scripts/read-odin-save.mjs <file> [--out <file.json>]'); process.exit(2); }
  const outAt = process.argv.indexOf('--out');
  const res = readOdin(fs.readFileSync(file));
  console.log(`read ${res.end} of ${res.size} bytes; ${res.types.length} types`);
  if (outAt > 0) { fs.writeFileSync(process.argv[outAt + 1], JSON.stringify(res, null, 1)); console.log(`wrote ${process.argv[outAt + 1]}`); }
}
