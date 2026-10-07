export const KINDS = ['drill', 'mill', 'pylon', 'press', 'power', 'projector', 'water'] as const;
export type MachineKind = (typeof KINDS)[number];

export const METRICS = ['pxd', 'vtx', 'lx', 'aq'] as const;
export type Metric = (typeof METRICS)[number];

export const LIMITS = {
  maxBytes: 65536,
  maxMachines: 400,
  maxCartridges: 400,
  ownerBytes: 32,
  nameBytes: 64,
  plotRadius: 500,
} as const;

export interface SnapMachine {
  readonly kind: MachineKind;
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  readonly on: boolean;
  readonly cartridge: number;
}

export interface SnapCartridge {
  readonly name: string;
  readonly affinity: Readonly<Record<Metric, number>>;
}

export interface Snapshot {
  readonly v: 1;
  readonly owner: string;
  readonly stage: number;
  readonly time: number;
  readonly points: Readonly<Record<Metric, number>>;
  readonly machines: readonly SnapMachine[];
  readonly cartridges: readonly SnapCartridge[];
}

const MAGIC_A = 0x48;
const MAGIC_B = 0x4d;
const FORMAT_VERSION = 1;
const BASE64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const MAX_BASE64_LENGTH = Math.ceil(LIMITS.maxBytes * 4 / 3);

interface PreparedCartridge {
  readonly name: Uint8Array;
  readonly affinity: Readonly<Record<Metric, number>>;
}

interface PreparedMachine {
  readonly kind: number;
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  readonly on: boolean;
  readonly cartridge: number;
}

interface PreparedSnapshot {
  readonly owner: Uint8Array;
  readonly stage: number;
  readonly time: number;
  readonly points: Readonly<Record<Metric, number>>;
  readonly machines: readonly PreparedMachine[];
  readonly cartridges: readonly PreparedCartridge[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUnknownArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function hasControlCharacters(text: string): boolean {
  for (let index = 0; index < text.length; index += 1) {
    let point = text.charCodeAt(index);
    if (point >= 0xd800 && point <= 0xdbff) {
      const low = text.charCodeAt(index + 1);
      if (!(low >= 0xdc00 && low <= 0xdfff)) return true;
      point = 0x10000 + ((point - 0xd800) << 10) + (low - 0xdc00);
      index += 1;
    } else if (point >= 0xdc00 && point <= 0xdfff) {
      return true;
    }
    if (point <= 0x1f || (point >= 0x7f && point <= 0x9f)) return true;
  }
  return false;
}

function appendUtf8Byte(bytes: number[], value: number, maximum: number, label: string): void {
  if (bytes.length >= maximum) throw new Error(`${label} exceeds ${maximum} UTF-8 bytes.`);
  bytes.push(value);
}

function encodeUtf8(text: string, label: string, maximum: number): Uint8Array {
  if (text.trim().length === 0) throw new Error(`${label} must not be only whitespace.`);

  const bytes: number[] = [];
  for (let index = 0; index < text.length; index += 1) {
    let point = text.charCodeAt(index);
    if (point >= 0xd800 && point <= 0xdbff) {
      const low = text.charCodeAt(index + 1);
      if (!(low >= 0xdc00 && low <= 0xdfff)) {
        throw new Error(`${label} must contain valid Unicode text.`);
      }
      point = 0x10000 + ((point - 0xd800) << 10) + (low - 0xdc00);
      index += 1;
    } else if (point >= 0xdc00 && point <= 0xdfff) {
      throw new Error(`${label} must contain valid Unicode text.`);
    }

    if (point <= 0x1f || (point >= 0x7f && point <= 0x9f)) {
      throw new Error(`${label} must not contain control characters.`);
    }

    if (point <= 0x7f) {
      appendUtf8Byte(bytes, point, maximum, label);
    } else if (point <= 0x7ff) {
      appendUtf8Byte(bytes, 0xc0 | (point >> 6), maximum, label);
      appendUtf8Byte(bytes, 0x80 | (point & 0x3f), maximum, label);
    } else if (point <= 0xffff) {
      appendUtf8Byte(bytes, 0xe0 | (point >> 12), maximum, label);
      appendUtf8Byte(bytes, 0x80 | ((point >> 6) & 0x3f), maximum, label);
      appendUtf8Byte(bytes, 0x80 | (point & 0x3f), maximum, label);
    } else {
      appendUtf8Byte(bytes, 0xf0 | (point >> 18), maximum, label);
      appendUtf8Byte(bytes, 0x80 | ((point >> 12) & 0x3f), maximum, label);
      appendUtf8Byte(bytes, 0x80 | ((point >> 6) & 0x3f), maximum, label);
      appendUtf8Byte(bytes, 0x80 | (point & 0x3f), maximum, label);
    }
  }

  return Uint8Array.from(bytes);
}

function decodeUtf8(bytes: Uint8Array): string | null {
  let text = '';
  for (let index = 0; index < bytes.length;) {
    const first = bytes[index];
    if (first === undefined) return null;

    let point: number;
    let count: number;
    if (first <= 0x7f) {
      point = first;
      count = 1;
    } else if (first >= 0xc2 && first <= 0xdf) {
      point = first & 0x1f;
      count = 2;
    } else if (first >= 0xe0 && first <= 0xef) {
      point = first & 0x0f;
      count = 3;
    } else if (first >= 0xf0 && first <= 0xf4) {
      point = first & 0x07;
      count = 4;
    } else {
      return null;
    }

    if (index + count > bytes.length) return null;
    for (let offset = 1; offset < count; offset += 1) {
      const continuation = bytes[index + offset];
      if (continuation === undefined || continuation < 0x80 || continuation > 0xbf) return null;
      point = (point << 6) | (continuation & 0x3f);
    }

    if (
      (count === 3 && ((first === 0xe0 && (bytes[index + 1] ?? 0) < 0xa0) ||
        (first === 0xed && (bytes[index + 1] ?? 0) >= 0xa0))) ||
      (count === 4 && ((first === 0xf0 && (bytes[index + 1] ?? 0) < 0x90) ||
        (first === 0xf4 && (bytes[index + 1] ?? 0) > 0x8f)))
    ) {
      return null;
    }

    if (point <= 0xffff) {
      text += String.fromCharCode(point);
    } else {
      const adjusted = point - 0x10000;
      text += String.fromCharCode(0xd800 + (adjusted >> 10), 0xdc00 + (adjusted & 0x3ff));
    }
    index += count;
  }

  return text;
}

function kindIndex(kind: unknown): number {
  for (let index = 0; index < KINDS.length; index += 1) {
    if (KINDS[index] === kind) return index;
  }
  return -1;
}

function requireFiniteNonNegative(value: unknown, label: string): number {
  if (!isFiniteNumber(value) || value < 0) throw new Error(`${label} must be finite and non-negative.`);
  return value;
}

function requireAffinity(record: Record<string, unknown>, label: string): Record<Metric, number> {
  const affinity: Record<Metric, number> = { pxd: 0, vtx: 0, lx: 0, aq: 0 };
  for (const metric of METRICS) {
    const value = record[metric];
    if (!isFiniteNumber(value) || value < 0.5 || value > 3) {
      throw new Error(`${label} ${metric} affinity must be between 0.5 and 3.`);
    }
    affinity[metric] = value;
  }
  return affinity;
}

function symmetricRound(value: number): number {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

function quantizePosition(x: number, z: number): { readonly x: number; readonly z: number } {
  let xCentimetres = symmetricRound(x * 100);
  let zCentimetres = symmetricRound(z * 100);

  // Rounding a point on the boundary can move it outside the plot; nudge that quantized point inward.
  for (let pass = 0; pass < 4 && Math.hypot(xCentimetres, zCentimetres) > LIMITS.plotRadius * 100; pass += 1) {
    if (Math.abs(xCentimetres) >= Math.abs(zCentimetres) && xCentimetres !== 0) {
      xCentimetres += xCentimetres > 0 ? -1 : 1;
    } else if (zCentimetres !== 0) {
      zCentimetres += zCentimetres > 0 ? -1 : 1;
    }
  }

  if (Math.hypot(xCentimetres, zCentimetres) > LIMITS.plotRadius * 100) {
    throw new Error('Machine position cannot be represented inside the plot radius.');
  }
  return { x: xCentimetres, z: zCentimetres };
}

function quantizeYaw(yaw: number): number {
  const rounded = symmetricRound(yaw * 1000);
  if (rounded > 3141) return 3142;
  if (rounded < -3141) return -3142;
  return rounded;
}

function prepareSnapshot(value: unknown): PreparedSnapshot {
  if (!isRecord(value)) throw new Error('Snapshot must be an object.');
  if (value.v !== 1) throw new Error('Snapshot version must be 1.');

  const ownerText = value.owner;
  if (typeof ownerText !== 'string') throw new Error('Owner must be text.');
  const owner = encodeUtf8(ownerText, 'Owner', LIMITS.ownerBytes);
  if (owner.length < 1) throw new Error('Owner must contain at least one UTF-8 byte.');

  const stage = value.stage;
  if (typeof stage !== 'number' || !Number.isInteger(stage) || stage < 0 || stage > 6) {
    throw new Error('Stage must be an integer from 0 to 6.');
  }
  const time = requireFiniteNonNegative(value.time, 'Time');

  const rawPoints = value.points;
  if (!isRecord(rawPoints)) throw new Error('Points must contain all four metrics.');
  const points: Record<Metric, number> = { pxd: 0, vtx: 0, lx: 0, aq: 0 };
  for (const metric of METRICS) {
    points[metric] = requireFiniteNonNegative(rawPoints[metric], `Points ${metric}`);
  }

  const rawCartridges = value.cartridges;
  if (!isUnknownArray(rawCartridges)) throw new Error('Cartridges must be an array.');
  if (rawCartridges.length > LIMITS.maxCartridges) {
    throw new Error(`A plot can publish at most ${LIMITS.maxCartridges} cartridges.`);
  }
  const cartridges: PreparedCartridge[] = [];
  for (const rawCartridge of rawCartridges) {
    if (!isRecord(rawCartridge)) throw new Error('Each cartridge must be an object.');
    const cartridgeName = rawCartridge.name;
    if (typeof cartridgeName !== 'string') throw new Error('Cartridge name must be text.');
    const name = encodeUtf8(cartridgeName, 'Cartridge name', LIMITS.nameBytes);
    if (name.length < 1) throw new Error('Cartridge name must contain at least one UTF-8 byte.');
    const rawAffinity = rawCartridge.affinity;
    if (!isRecord(rawAffinity)) throw new Error('Cartridge affinity must contain all four metrics.');
    cartridges.push({ name, affinity: requireAffinity(rawAffinity, 'Cartridge') });
  }

  const rawMachines = value.machines;
  if (!isUnknownArray(rawMachines)) throw new Error('Machines must be an array.');
  if (rawMachines.length > LIMITS.maxMachines) {
    throw new Error(`A plot can publish at most ${LIMITS.maxMachines} machines.`);
  }
  const machines: PreparedMachine[] = [];
  for (const rawMachine of rawMachines) {
    if (!isRecord(rawMachine)) throw new Error('Each machine must be an object.');
    const kind = kindIndex(rawMachine.kind);
    if (kind < 0) throw new Error('Machine kind is not supported.');

    const x = rawMachine.x;
    const z = rawMachine.z;
    const yaw = rawMachine.yaw;
    if (!isFiniteNumber(x) || !isFiniteNumber(z) || Math.hypot(x, z) > LIMITS.plotRadius) {
      throw new Error(`Machine position must be within ${LIMITS.plotRadius} metres of the plot origin.`);
    }
    if (!isFiniteNumber(yaw) || yaw < -Math.PI || yaw > Math.PI) {
      throw new Error('Machine yaw must be between -PI and PI radians.');
    }
    const on = rawMachine.on;
    if (typeof on !== 'boolean') throw new Error('Machine on must be a boolean.');

    const cartridge = rawMachine.cartridge;
    if (
      typeof cartridge !== 'number' ||
      !Number.isInteger(cartridge) ||
      cartridge < -1 ||
      cartridge >= cartridges.length
    ) {
      throw new Error('Machine cartridge must be -1 or an existing cartridge index.');
    }

    const position = quantizePosition(x, z);
    machines.push({
      kind,
      x: position.x,
      z: position.z,
      yaw: quantizeYaw(yaw),
      on,
      cartridge,
    });
  }

  return { owner, stage, time, points, machines, cartridges };
}

function pushU8(bytes: number[], value: number): void {
  bytes.push(value & 0xff);
}

function pushU16(bytes: number[], value: number): void {
  bytes.push(value & 0xff, (value >>> 8) & 0xff);
}

function pushI16(bytes: number[], value: number): void {
  pushU16(bytes, value < 0 ? value + 0x10000 : value);
}

function pushI24(bytes: number[], value: number): void {
  const unsigned = value < 0 ? value + 0x1000000 : value;
  bytes.push(unsigned & 0xff, (unsigned >>> 8) & 0xff, (unsigned >>> 16) & 0xff);
}

function pushF64(bytes: number[], value: number): void {
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setFloat64(0, value, true);
  for (let index = 0; index < 8; index += 1) bytes.push(view.getUint8(index));
}

function base64UrlEncode(bytes: Uint8Array): string {
  let text = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const hasSecond = index + 1 < bytes.length;
    const hasThird = index + 2 < bytes.length;
    const second = hasSecond ? bytes[index + 1] ?? 0 : 0;
    const third = hasThird ? bytes[index + 2] ?? 0 : 0;

    text += BASE64URL.charAt(first >> 2);
    text += BASE64URL.charAt(((first & 0x03) << 4) | (second >> 4));
    if (hasSecond) text += BASE64URL.charAt(((second & 0x0f) << 2) | (third >> 6));
    if (hasThird) text += BASE64URL.charAt(third & 0x3f);
  }
  return text;
}

export function encode(s: Snapshot): string {
  const snapshot = prepareSnapshot(s);
  const bytes: number[] = [MAGIC_A, MAGIC_B, FORMAT_VERSION];

  pushU8(bytes, snapshot.owner.length);
  for (const byte of snapshot.owner) pushU8(bytes, byte);
  pushU8(bytes, snapshot.stage);
  pushF64(bytes, snapshot.time);
  for (const metric of METRICS) pushF64(bytes, snapshot.points[metric]);

  pushU16(bytes, snapshot.cartridges.length);
  for (const cartridge of snapshot.cartridges) {
    pushU8(bytes, cartridge.name.length);
    for (const byte of cartridge.name) pushU8(bytes, byte);
    for (const metric of METRICS) {
      pushU16(bytes, symmetricRound(cartridge.affinity[metric] * 1000));
    }
  }

  pushU16(bytes, snapshot.machines.length);
  for (const machine of snapshot.machines) {
    pushU8(bytes, machine.kind);
    pushI24(bytes, machine.x);
    pushI24(bytes, machine.z);
    pushI16(bytes, machine.yaw);
    pushU8(bytes, machine.on ? 1 : 0);
    pushU16(bytes, machine.cartridge < 0 ? 0 : machine.cartridge + 1);
  }

  if (bytes.length > LIMITS.maxBytes) throw new Error(`Snapshot exceeds ${LIMITS.maxBytes} encoded bytes.`);
  return base64UrlEncode(Uint8Array.from(bytes));
}

class ByteReader {
  private offset = 0;
  private readonly view: DataView;
  private readonly bytes: Uint8Array;

  constructor(bytes: Uint8Array) {
    this.bytes = bytes;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  get remaining(): number {
    return this.bytes.length - this.offset;
  }

  readU8(): number | null {
    if (this.remaining < 1) return null;
    const value = this.bytes[this.offset];
    this.offset += 1;
    return value ?? null;
  }

  readU16(): number | null {
    if (this.remaining < 2) return null;
    const value = this.view.getUint16(this.offset, true);
    this.offset += 2;
    return value;
  }

  readI16(): number | null {
    if (this.remaining < 2) return null;
    const value = this.view.getInt16(this.offset, true);
    this.offset += 2;
    return value;
  }

  readI24(): number | null {
    if (this.remaining < 3) return null;
    const first = this.bytes[this.offset] ?? 0;
    const second = this.bytes[this.offset + 1] ?? 0;
    const third = this.bytes[this.offset + 2] ?? 0;
    const unsigned = first | (second << 8) | (third << 16);
    this.offset += 3;
    return (unsigned & 0x800000) !== 0 ? unsigned - 0x1000000 : unsigned;
  }

  readF64(): number | null {
    if (this.remaining < 8) return null;
    const value = this.view.getFloat64(this.offset, true);
    this.offset += 8;
    return value;
  }

  readBytes(length: number): Uint8Array | null {
    if (!Number.isInteger(length) || length < 0 || this.remaining < length) return null;
    const result = this.bytes.subarray(this.offset, this.offset + length);
    this.offset += length;
    return result;
  }
}

function base64Value(character: string): number {
  if (character.length !== 1) return -1;
  const code = character.charCodeAt(0);
  if (code >= 65 && code <= 90) return code - 65;
  if (code >= 97 && code <= 122) return code - 97 + 26;
  if (code >= 48 && code <= 57) return code - 48 + 52;
  if (code === 45) return 62;
  if (code === 95) return 63;
  return -1;
}

function base64UrlDecode(text: string): Uint8Array | null {
  if (text.length === 0 || text.length % 4 === 1) return null;
  const byteLength = Math.floor(text.length * 3 / 4);
  if (byteLength > LIMITS.maxBytes) return null;

  const bytes = new Uint8Array(byteLength);
  let output = 0;
  for (let index = 0; index < text.length; index += 4) {
    const remaining = text.length - index;
    const first = base64Value(text.charAt(index));
    const second = base64Value(text.charAt(index + 1));
    const third = remaining > 2 ? base64Value(text.charAt(index + 2)) : 0;
    const fourth = remaining > 3 ? base64Value(text.charAt(index + 3)) : 0;
    if (first < 0 || second < 0 || third < 0 || fourth < 0) return null;

    if (output < byteLength) bytes[output++] = (first << 2) | (second >> 4);
    if (remaining > 2 && output < byteLength) bytes[output++] = ((second & 0x0f) << 4) | (third >> 2);
    if (remaining > 3 && output < byteLength) bytes[output++] = ((third & 0x03) << 6) | fourth;
  }

  return base64UrlEncode(bytes) === text ? bytes : null;
}

function readText(reader: ByteReader, maximum: number): string | null {
  const length = reader.readU8();
  if (length === null || length < 1 || length > maximum) return null;
  const bytes = reader.readBytes(length);
  if (bytes === null) return null;
  const text = decodeUtf8(bytes);
  if (text === null || text.trim().length === 0 || hasControlCharacters(text)) return null;
  return text;
}

function readMetricValues(reader: ByteReader): Record<Metric, number> | null {
  const values: Record<Metric, number> = { pxd: 0, vtx: 0, lx: 0, aq: 0 };
  for (const metric of METRICS) {
    const encoded = reader.readU16();
    if (encoded === null || encoded < 500 || encoded > 3000) return null;
    values[metric] = encoded / 1000;
  }
  return values;
}

function decodeBytes(bytes: Uint8Array): Snapshot | null {
  const reader = new ByteReader(bytes);
  if (reader.readU8() !== MAGIC_A || reader.readU8() !== MAGIC_B || reader.readU8() !== FORMAT_VERSION) {
    return null;
  }

  const owner = readText(reader, LIMITS.ownerBytes);
  const stage = reader.readU8();
  const time = reader.readF64();
  if (owner === null || stage === null || stage > 6 || time === null || !Number.isFinite(time) || time < 0) {
    return null;
  }

  const points: Record<Metric, number> = { pxd: 0, vtx: 0, lx: 0, aq: 0 };
  for (const metric of METRICS) {
    const value = reader.readF64();
    if (value === null || !Number.isFinite(value) || value < 0) return null;
    points[metric] = value;
  }

  const cartridgeCount = reader.readU16();
  if (cartridgeCount === null || cartridgeCount > LIMITS.maxCartridges) return null;
  const cartridges: SnapCartridge[] = [];
  for (let index = 0; index < cartridgeCount; index += 1) {
    const name = readText(reader, LIMITS.nameBytes);
    if (name === null) return null;
    const affinity = readMetricValues(reader);
    if (affinity === null) return null;
    cartridges.push({ name, affinity });
  }

  const machineCount = reader.readU16();
  if (machineCount === null || machineCount > LIMITS.maxMachines) return null;
  const machines: SnapMachine[] = [];
  for (let index = 0; index < machineCount; index += 1) {
    const kindCode = reader.readU8();
    const xCentimetres = reader.readI24();
    const zCentimetres = reader.readI24();
    const yawCode = reader.readI16();
    const onCode = reader.readU8();
    const cartridgeCode = reader.readU16();

    if (
      kindCode === null || kindCode >= KINDS.length ||
      xCentimetres === null || zCentimetres === null ||
      yawCode === null || Math.abs(yawCode) > 3142 ||
      onCode === null || onCode > 1 ||
      cartridgeCode === null
    ) {
      return null;
    }

    const kind = KINDS[kindCode];
    if (kind === undefined) return null;
    const x = xCentimetres / 100;
    const z = zCentimetres / 100;
    const cartridge = cartridgeCode === 0 ? -1 : cartridgeCode - 1;
    if (
      Math.hypot(x, z) > LIMITS.plotRadius ||
      (cartridge >= 0 && cartridge >= cartridges.length)
    ) {
      return null;
    }

    machines.push({
      kind,
      x,
      z,
      yaw: yawCode === 3142 ? Math.PI : yawCode === -3142 ? -Math.PI : yawCode / 1000,
      on: onCode === 1,
      cartridge,
    });
  }

  if (reader.remaining !== 0) return null;
  return { v: 1, owner, stage, time, points, machines, cartridges };
}

export function decode(text: string): Snapshot | null {
  try {
    if (typeof text !== 'string' || text.length === 0 || text.length > MAX_BASE64_LENGTH) return null;
    const bytes = base64UrlDecode(text);
    if (bytes === null || base64UrlEncode(bytes) !== text) return null;
    return decodeBytes(bytes);
  } catch {
    return null;
  }
}
