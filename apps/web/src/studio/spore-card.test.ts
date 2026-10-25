/** JOB-26 / Plan 45: real PNGs and all four lossless mathematical payloads, with hostile input gates. No DOM required. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { zlibSync, unzlibSync } from 'fflate';
import {
  encodeSporeCardPng, decodeSporeCardPng, pngChunk, pngCrc32, SporeCardError, SporeCardSchema,
  MaterialSpecSchema, KitSpecSchema, CreatureGenomeSchema, MAX_SPORE_PAYLOAD_BYTES, MAX_SPORE_PNG_BYTES, SPORE_KEYWORD,
  type SporeCard, type SporeCardErrorCode,
} from '@hm/cartlab';
import { canonicalJson, frozenJsonCopy, GAME_PRESETS } from '@hm/gamepreset';
import { MATERIAL_SHELF } from '@hm/matstack';
import { CREATURE_ARCHETYPE_GENOMES, THEROPOD_GENOME } from '@hm/creature';
import type { Kit } from '@hm/kitspec';
import { MESH_OPERATORS } from '@hm/meshops';
import { ALL_MACHINE_VEHICLE_KIT_IDS, gameRigKit } from '../play/game-presets';
import { bindSporeCardDrop } from './spore-drop';

const bytes = (s: string): Uint8Array<ArrayBuffer> => new TextEncoder().encode(s);
const join = (...items: readonly Uint8Array[]): Uint8Array<ArrayBuffer> => {
  const out = new Uint8Array(items.reduce((n, b) => n + b.length, 0));
  let at = 0; for (const b of items) { out.set(b, at); at += b.length; } return out;
};
const signature = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);
const header = (w = 512, h = 512, depth = 8, colour = 6): Uint8Array => {
  const out = new Uint8Array(13); const view = new DataView(out.buffer);
  view.setUint32(0, w); view.setUint32(4, h); out[8] = depth; out[9] = colour; return pngChunk('IHDR', out);
};
// Filter byte 0, 512 transparent RGBA pixels per row. A valid, independently viewable PNG, not a mocked chunk table.
const imageData = pngChunk('IDAT', zlibSync(new Uint8Array((512 * 4 + 1) * 512)));
const ending = pngChunk('IEND', new Uint8Array());
const beauty = join(signature, header(), imageData, ending);
const gameCard: SporeCard = { schema: 'hm2:spore-card:v1', title: 'Test circuit / 🌍', author: 'Studio, Cape Town', creation: { kind: 'game', spec: GAME_PRESETS[0]! } };
const encoded = (): Uint8Array<ArrayBuffer> => encodeSporeCardPng({ card: gameCard, beautyPng: beauty });
function payloadChunk(raw: Uint8Array, keyword = SPORE_KEYWORD, method = 0): Uint8Array {
  return pngChunk('zTXt', join(bytes(keyword), Uint8Array.of(0, method), zlibSync(raw, { level: 9 })));
}
const inject = (raw: string | Uint8Array): Uint8Array => join(signature, header(), imageData, payloadChunk(typeof raw === 'string' ? bytes(raw) : raw), ending);
const injectValue = (value: unknown): Uint8Array => inject(JSON.stringify(value));
const refuses = (input: Uint8Array | Blob | ArrayBuffer, code?: SporeCardErrorCode): Promise<void> => assert.rejects(
  decodeSporeCardPng(input), (e: unknown) => e instanceof SporeCardError && (!code || e.code === code),
);
function chunks(png: Uint8Array): { type: string; data: Uint8Array; chunk: Uint8Array; offset: number }[] {
  const out = []; let p = 8;
  while (p < png.length) { const n = new DataView(png.buffer, png.byteOffset + p, 4).getUint32(0); out.push({ type: new TextDecoder().decode(png.subarray(p + 4, p + 8)), data: png.subarray(p + 8, p + 8 + n), chunk: png.subarray(p, p + n + 12), offset: p }); p += n + 12; }
  return out;
}
function assertDeepFrozen(value: unknown): void {
  if (value === null || typeof value !== 'object') return;
  assert.ok(Object.isFrozen(value)); for (const x of Object.values(value)) assertDeepFrozen(x);
}

for (const [id, spec] of Object.entries(MATERIAL_SHELF)) test(`Spore roundtrip: full MaterialSpec ${id}, without quantization`, async () => {
  const card: SporeCard = { ...gameCard, title: spec.name, creation: { kind: 'material', spec } };
  const result = await decodeSporeCardPng(encodeSporeCardPng({ card, beautyPng: beauty }));
  assert.deepEqual(result, card); assertDeepFrozen(result); assert.deepEqual(MaterialSpecSchema.parse(spec), spec);
});
for (const id of ALL_MACHINE_VEHICLE_KIT_IDS) test(`Spore roundtrip: KitSpec ${id} passes the real anatomy audit`, async () => {
  const rig = gameRigKit(id)!;
  const card: SporeCard = { ...gameCard, creation: { kind: 'kit', spec: rig.kit, preset: rig.preset } };
  assert.deepEqual(await decodeSporeCardPng(encodeSporeCardPng({ card, beautyPng: beauty })), card);
});
function kitWithOperator(op: string): SporeCard {
  const rig = gameRigKit('kit:scout-rover')!;
  const entry = Object.entries(rig.kit.parts).find(([, part]) => part.source.kind === 'param');
  assert.ok(entry);
  const [id, part] = entry;
  const spec = { ...rig.kit, parts: { ...rig.kit.parts, [id]: { ...part, source: { ...part.source, ops: [{ op, params: {} }] } } } };
  return { ...gameCard, creation: { kind: 'kit', spec, preset: rig.preset } };
}
for (const op of ['uv-box-triplanar', 'uv-cylindrical-unwrap']) test(`Spore roundtrip: audited KitSpec with topology-preserving ${op}`, async () => {
  const card = kitWithOperator(op);
  assert.deepEqual(await decodeSporeCardPng(encodeSporeCardPng({ card, beautyPng: beauty })), card);
});
test('geometry-changing and topology-expanding operators cannot bypass pre-operator anatomy bounds or exhaust the renderer', async () => {
  for (const op of Object.keys(MESH_OPERATORS).filter((id) => id !== 'uv-box-triplanar' && id !== 'uv-cylindrical-unwrap')) {
    const card = kitWithOperator(op);
    assert.throws(() => encodeSporeCardPng({ card, beautyPng: beauty }), /geometry-changing mesh operators/);
    await refuses(injectValue(card));
  }
});
for (const spec of CREATURE_ARCHETYPE_GENOMES) test(`Spore roundtrip: full CreatureGenomeSpec ${spec.id}, including mounts and bone templates`, async () => {
  const card: SporeCard = { ...gameCard, creation: { kind: 'creature', spec } };
  const decoded = await decodeSporeCardPng(encodeSporeCardPng({ card, beautyPng: beauty }));
  assert.deepEqual(decoded, card); assertDeepFrozen(decoded); assert.deepEqual(CreatureGenomeSchema.parse(spec), spec);
});
for (const spec of GAME_PRESETS) test(`Spore roundtrip: frozen Rung 5 preset ${spec.id}`, async () => {
  const card: SporeCard = { ...gameCard, creation: { kind: 'game', spec } };
  const result = await decodeSporeCardPng(encodeSporeCardPng({ card, beautyPng: beauty }));
  assert.deepEqual(result, card); assertDeepFrozen(result);
});

test('standard zTXt keyword, method 0, zlib level 9, IEEE CRC-32, and untouched beauty pixel bytes', () => {
  assert.equal(pngCrc32(bytes('123456789')), 0xcbf43926);
  const png = encoded(); const table = chunks(png);
  assert.deepEqual(table.map((c) => c.type), ['IHDR', 'IDAT', 'zTXt', 'IEND']);
  assert.deepEqual(table.find((c) => c.type === 'IDAT')!.chunk, imageData);
  const data = table[2]!.data; const zero = data.indexOf(0);
  assert.equal(new TextDecoder().decode(data.subarray(0, zero)), SPORE_KEYWORD); assert.equal(data[zero + 1], 0);
  const compressed = data.subarray(zero + 2);
  assert.deepEqual(compressed, zlibSync(bytes(canonicalJson(gameCard)), { level: 9 }));
  assert.equal(new TextDecoder().decode(unzlibSync(compressed)), canonicalJson(gameCard));
  for (const c of table) assert.equal(pngCrc32(c.chunk.subarray(4, -4)), new DataView(c.chunk.buffer, c.chunk.byteOffset + c.chunk.length - 4, 4).getUint32(0));
});

test('ArrayBuffer, Blob, Node Buffer and a nonzero-byteOffset Uint8Array all decode identically', async () => {
  const png = encoded(); const wrapped = join(Uint8Array.of(0, 0, 0), png, Uint8Array.of(255));
  for (const input of [png.buffer, new Blob([png], { type: 'not/an-image' }), Buffer.from(png), wrapped.subarray(3, -1)]) assert.deepEqual(await decodeSporeCardPng(input), gameCard);
});

test('encoding sorts object keys canonically, never rounds parameters, and preserves negative zero', async () => {
  const reverse = (v: unknown): unknown => v === null || typeof v !== 'object' ? v : Array.isArray(v) ? v.map(reverse) : Object.fromEntries(Object.entries(v).reverse().map(([k, x]) => [k, reverse(x)]));
  assert.deepEqual(encodeSporeCardPng({ card: reverse(gameCard) as SporeCard, beautyPng: beauty }), encoded());
  const spec = { ...MATERIAL_SHELF['mat:moon-dusted']!, age: 0.12345678901234567 };
  const card: SporeCard = { ...gameCard, creation: { kind: 'material', spec } };
  assert.deepEqual(await decodeSporeCardPng(encodeSporeCardPng({ card, beautyPng: beauty })), card);
  assert.ok(Object.is(JSON.parse(canonicalJson({ number: -0 })).number, -0));
});

test('256 KiB is accepted exactly; one byte over and a highly compressed 8 MiB bomb abort before JSON/schema parsing', async () => {
  const json = JSON.stringify(gameCard);
  assert.deepEqual(await decodeSporeCardPng(inject(json.padEnd(json.length + MAX_SPORE_PAYLOAD_BYTES - bytes(json).length, ' '))), gameCard);
  await refuses(inject(json.padEnd(json.length + MAX_SPORE_PAYLOAD_BYTES + 1 - bytes(json).length, ' ')), 'payload-limit');
  await refuses(inject(new Uint8Array(8 * 1024 * 1024).fill(65)), 'payload-limit');
});

test('every chunk CRC is checked, including ancillary chunks and compressed preset data', async () => {
  for (const type of ['IHDR', 'IDAT', 'zTXt', 'IEND']) {
    const png = encoded(); const c = chunks(png).find((x) => x.type === type)!;
    const at = c.data.length ? c.offset + 8 : c.offset + 8; png[at] = png[at]! ^ 1;
    await refuses(png, 'crc');
  }
  const ancillary = pngChunk('tEXt', bytes('author\0Nobody')); ancillary[ancillary.length - 1] = ancillary[ancillary.length - 1]! ^ 4;
  await refuses(join(signature, header(), ancillary, imageData, payloadChunk(bytes(JSON.stringify(gameCard))), ending), 'crc');
});

test('invalid PNG signatures, bounds, truncation, chunk types, ordering and endings are refused', async () => {
  const badLength = encoded(); new DataView(badLength.buffer).setUint32(8, 0xffff_ffff);
  const wrongSize = pngChunk('IHDR', new Uint8Array(12));
  const text = payloadChunk(bytes(JSON.stringify(gameCard)));
  for (const png of [
    new Uint8Array(), bytes('version https://git-lfs.github.com/spec/v1'), badLength,
    encoded().subarray(0, -1), join(signature, header(), imageData), join(signature, header(), imageData, text, ending, Uint8Array.of(0)),
    join(signature, wrongSize, imageData, text, ending), join(signature, header(), header(), imageData, text, ending),
    join(signature, imageData, header(), text, ending), join(signature, header(0), imageData, text, ending),
    join(signature, header(8193), imageData, text, ending), join(signature, header(512, 512, 7), imageData, text, ending),
    join(signature, header(), pngChunk('NOPE', new Uint8Array()), imageData, text, ending),
    join(signature, header(), imageData, pngChunk('teat', new Uint8Array()), text, ending),
    join(signature, header(), imageData, text, imageData, ending), join(signature, header(), text, ending),
    join(signature, header(), imageData, text, pngChunk('IEND', Uint8Array.of(0))),
  ]) await refuses(png, 'png');
});

test('oversized file is refused before Blob reads, and excessive chunk tables are bounded', async () => {
  class OversizedBlob extends Blob { override arrayBuffer(): Promise<ArrayBuffer> { throw new Error('must not read this oversized input'); } }
  await refuses(new OversizedBlob([new Uint8Array(MAX_SPORE_PNG_BYTES + 1)]), 'png');
  const emptyText = pngChunk('tEXt', new Uint8Array());
  await refuses(join(signature, header(), ...Array<Uint8Array>(8192).fill(emptyText), imageData, ending), 'png');
});

test('missing, duplicate, bad-method and malformed zTXt payloads never choose a lucky interpretation', async () => {
  const raw = bytes(JSON.stringify(gameCard)); const text = payloadChunk(raw);
  await refuses(beauty, 'missing-preset');
  await refuses(join(signature, header(), imageData, payloadChunk(raw, 'something:else'), ending), 'missing-preset');
  for (const chunk of [
    payloadChunk(raw, SPORE_KEYWORD, 1), pngChunk('zTXt', bytes('no-separator')),
    pngChunk('zTXt', Uint8Array.of(0, 0, 1)), pngChunk('zTXt', bytes(`${'x'.repeat(80)}\0\0payload`)),
  ]) await refuses(join(signature, header(), imageData, chunk, ending), 'png');
  await refuses(join(signature, header(), imageData, text, text, ending), 'png');
  assert.throws(() => encodeSporeCardPng({ card: gameCard, beautyPng: encoded() }), (e: unknown) => e instanceof SporeCardError && e.code === 'png');
  assert.throws(() => encodeSporeCardPng({ card: gameCard, beautyPng: join(signature, header(256), imageData, ending) }), /512/);
});

test('outer CRC cannot disguise a damaged zlib stream, trailer or external dictionary', async () => {
  const compressed = zlibSync(bytes(JSON.stringify(gameCard)), { level: 9 });
  const inChunk = (data: Uint8Array): Uint8Array => join(signature, header(), imageData, pngChunk('zTXt', join(bytes(SPORE_KEYWORD), Uint8Array.of(0, 0), data)), ending);
  const checksum = compressed.slice(); checksum[checksum.length - 1] = checksum[checksum.length - 1]! ^ 1; await refuses(inChunk(checksum), 'compression');
  const badHeader = compressed.slice(); badHeader[0] = 0; await refuses(inChunk(badHeader), 'compression');
  const dictionary = compressed.slice(); dictionary[1] = 0x20; await refuses(inChunk(dictionary), 'compression');
  await refuses(inChunk(compressed.subarray(0, -5)), 'compression');
  await refuses(inChunk(new Uint8Array(MAX_SPORE_PAYLOAD_BYTES + 1025)), 'compression');
});

test('valid zlib levels are portable, but trailing bytes, concatenated streams and false final blocks are refused', async () => {
  const raw = bytes(JSON.stringify(gameCard));
  const inChunk = (data: Uint8Array): Uint8Array => join(signature, header(), imageData, pngChunk('zTXt', join(bytes(SPORE_KEYWORD), Uint8Array.of(0, 0), data)), ending);
  for (const level of [0, 1, 6, 9] as const) {
    const compressed = zlibSync(raw, { level });
    assert.deepEqual(await decodeSporeCardPng(inChunk(compressed)), gameCard);
    for (const tail of [Uint8Array.of(0), new Uint8Array(130), zlibSync(raw).subarray(2, -4)]) {
      await refuses(inChunk(join(compressed.subarray(0, -4), tail, compressed.subarray(-4))), 'compression');
    }
    const nonFinal = compressed.slice(); nonFinal[2] = nonFinal[2]! & 0xfe;
    await refuses(inChunk(nonFinal), 'compression');
  }
});

test('UTF-8 and JSON only: JavaScript syntax, invalid UTF-8, prototype injection, unknown fields and bad rules are refused', async () => {
  await refuses(inject('(() => { globalThis.sporeExecuted = true; return {}; })()'), 'schema');
  await refuses(inject(Uint8Array.of(0xc0, 0xaf)), 'schema');
  await refuses(inject('{"__proto__":{"polluted":true}}'), 'schema');
  assert.equal(({} as { polluted?: boolean }).polluted, undefined);
  for (const value of [
    null, [], { ...gameCard, schema: 'future' }, { ...gameCard, auditStamp: 'TRUST ME' },
    { ...gameCard, creation: { kind: 'game', spec: { ...GAME_PRESETS[0]!, version: 2 } } },
    { ...gameCard, creation: { kind: 'game', spec: { ...GAME_PRESETS[0]!, activeRules: { ...GAME_PRESETS[0]!.activeRules, stageAnimRateHz: 7 } } } },
    { ...gameCard, creation: { kind: 'game', spec: { ...GAME_PRESETS[0]!, activeRules: { ...GAME_PRESETS[0]!.activeRules, gravityScale: -1 } } } },
  ]) await refuses(injectValue(value), 'schema');
});

test('encoder/schema rejects closures, accessors, toJSON, custom classes, unsafe keys, sparse arrays, cycles and nonfinite numbers', () => {
  let invoked = 0;
  const getter = Object.defineProperty({}, 'creation', { enumerable: true, get: () => { invoked++; return gameCard.creation; } });
  const cyclic: { self?: unknown } = {}; cyclic.self = cyclic;
  const sparse = new Array(3); sparse[2] = 1;
  const hidden = Object.defineProperty({}, 'title', { value: 'hidden' });
  const arrayProperty: unknown[] = []; Object.defineProperty(arrayProperty, '4294967295', { enumerable: true, value: 1 });
  for (const value of [getter, cyclic, hidden, sparse, arrayProperty, new Date(), { f: () => 1 }, { toJSON: () => { invoked++; return gameCard; } }, { n: NaN }, { n: Infinity }, { n: undefined }, { n: 1n }, { [Symbol('x')]: 1 }, JSON.parse('{"constructor": 1}')]) assert.throws(() => frozenJsonCopy(value));
  assert.equal(invoked, 0);
  const result = SporeCardSchema.safeParse({ ...gameCard, creation: () => gameCard.creation }); assert.equal(result.success, false);
  assert.ok(Object.isFrozen(SporeCardSchema)); assert.ok(Object.isFrozen(MaterialSpecSchema));
});

test('schema bounds assembly cycles, repeat expansion and unknown generators before flatten/audit', async () => {
  const base: Kit = { parts: { block: { source: { kind: 'box', size: [1, 1, 1] }, material: 'steel', rank: 0 } }, assemblies: { main: { children: [{ ref: 'block' }] } } };
  const cases = [
    { ...base, assemblies: { main: { children: [{ ref: 'main' }] } } },
    { ...base, assemblies: { main: { children: [{ ref: 'x' }] }, x: { children: [{ ref: 'block', repeat: { count: 64, step: [0, 0, 0] } }, { ref: 'block', repeat: { count: 64, step: [0, 0, 0] } }, { ref: 'block', repeat: { count: 64, step: [0, 0, 0] } }, { ref: 'block', repeat: { count: 64, step: [0, 0, 0] } }, { ref: 'block' }] } } },
    { ...base, parts: { block: { ...base.parts.block!, source: { kind: 'param', gen: 'run-foreign-code', params: {} } } } },
  ];
  for (const spec of cases) { assert.equal(KitSpecSchema.safeParse(spec).success, false); await refuses(injectValue({ ...gameCard, creation: { kind: 'kit', spec, preset: 'main' } }), 'schema'); }
});

test('a schema-valid kit with interpenetration is refused by studio.kit.audit; an image stamp cannot bypass it', async () => {
  const spec: Kit = {
    parts: { slab: { source: { kind: 'box', size: [1, 1, 1] }, material: 'steel', rank: 0 } },
    assemblies: { main: { children: [{ ref: 'slab', key: 'a' }, { ref: 'slab', key: 'b', at: [0.1, 0, 0] }] } },
  };
  assert.equal(KitSpecSchema.safeParse(spec).success, true);
  const card: SporeCard = { ...gameCard, title: 'AUDIT CLEAN, 0 LOOSE ENDS', creation: { kind: 'kit', spec, preset: 'main' } };
  assert.throws(() => encodeSporeCardPng({ card, beautyPng: beauty }), (e: unknown) => e instanceof SporeCardError && e.code === 'audit');
  await refuses(injectValue(card), 'audit');
  await refuses(injectValue({ ...gameCard, creation: { kind: 'creature', spec: { ...THEROPOD_GENOME, sensoryControls: [{ ...THEROPOD_GENOME.sensoryControls[0]!, mount: 'not-a-spine.front' }] } } }), 'schema');
});

// A tiny browser EventTarget is sufficient: the importer must not require a WebGL renderer or an undo implementation.
function drop(target: EventTarget, files: readonly Blob[]): void {
  target.dispatchEvent(Object.assign(new Event('drop', { cancelable: true }), { dataTransfer: { files } }));
}
const settle = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));
test('canvas drops are transactional: corruption makes only a refusal; no state/undo mutation, valid cards load once', async () => {
  const target = new EventTarget(); const world = { undo: ['existing'], creations: [] as SporeCard[] }; const refusals: string[] = [];
  const dispose = bindSporeCardDrop(target as HTMLElement, { onCard: (card) => { world.creations.push(card); world.undo.push('import'); }, onRefusal: (r) => { refusals.push(r.detail); } });
  const before = structuredClone(world); const bad = encoded(); bad[bad.length - 1] = bad[bad.length - 1]! ^ 1;
  drop(target, [new Blob([bad])]); await settle(); assert.deepEqual(world, before); assert.equal(refusals.length, 1);
  drop(target, [new Blob([encoded()])]); await settle(); assert.deepEqual(world.creations, [gameCard]); assert.deepEqual(world.undo, ['existing', 'import']);
  drop(target, [new Blob([beauty]), new Blob([beauty])]); await settle(); assert.equal(refusals.length, 2); assert.equal(world.creations.length, 1);
  dispose(); drop(target, [new Blob([encoded()])]); await settle(); assert.equal(world.creations.length, 1);
});

test('a superseded or disposed asynchronous drop cannot mutate a later world', async () => {
  let finish: ((data: ArrayBuffer) => void) | undefined;
  class SlowFile extends Blob { override arrayBuffer(): Promise<ArrayBuffer> { return new Promise((resolve) => { finish = resolve; }); } }
  const target = new EventTarget(); const cards: SporeCard[] = [];
  const dispose = bindSporeCardDrop(target as HTMLElement, { onCard: (c) => { cards.push(c); }, onRefusal: () => assert.fail('stale drop should be ignored') });
  drop(target, [new SlowFile()]); drop(target, [new Blob([encoded()])]); await settle();
  finish!(encoded().buffer); await settle(); assert.equal(cards.length, 1);
  drop(target, [new SlowFile()]); dispose(); finish!(encoded().buffer); await settle(); assert.equal(cards.length, 1);
});

test('a newer drop also cancels a prior callback during its asynchronous registered-asset preload', async () => {
  const target = new EventTarget(); const loaded: string[] = [];
  let finish: (() => void) | undefined, calls = 0;
  const dispose = bindSporeCardDrop(target as HTMLElement, {
    onCard: async (card, isCurrent) => {
      if (++calls === 1) await new Promise<void>((resolve) => { finish = resolve; });
      if (isCurrent()) loaded.push(card.title);
    },
    onRefusal: () => assert.fail('stale drop should be ignored'),
  });
  drop(target, [new Blob([encoded()])]); await settle(); assert.equal(calls, 1);
  drop(target, [new Blob([encoded()])]); await settle(); assert.equal(calls, 2);
  finish!(); await settle(); assert.equal(loaded.length, 1);
  dispose();
});

test('a schema-valid but anatomically interpenetrating genome is refused by the full shared audit', async () => {
  const spec = { ...THEROPOD_GENOME, pelvis: { ...THEROPOD_GENOME.pelvis, radius: [10, 10, 10] as const } };
  assert.equal(CreatureGenomeSchema.safeParse(spec).success, true);
  const card: SporeCard = { ...gameCard, creation: { kind: 'creature', spec } };
  assert.throws(() => encodeSporeCardPng({ card, beautyPng: beauty }), (e: unknown) => e instanceof SporeCardError && e.code === 'audit');
  await refuses(injectValue(card), 'audit');
});

test('beauty camera fits wide, tall, deep and large kits above the six-zone footer without clipping badges', async () => {
  const THREE = await import('three');
  const { frameSporeBeautyCamera } = await import('./spore-card');
  for (const [x, y, z] of [[4, 3, 6], [50, 0.1, 0.1], [0.1, 50, 0.1], [0.1, 0.1, 50], [1000, 1000, 1000]] as const) {
    const bounds = new THREE.Box3(new THREE.Vector3(-x / 2, 0, -z / 2), new THREE.Vector3(x / 2, y, z / 2));
    const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 200); frameSporeBeautyCamera(camera, bounds);
    for (const px of [bounds.min.x, bounds.max.x]) for (const py of [bounds.min.y, bounds.max.y]) for (const pz of [bounds.min.z, bounds.max.z]) {
      const projected = new THREE.Vector3(px, py, pz).project(camera);
      assert.ok(Math.abs(projected.x) < 0.95); assert.ok(projected.y < 1 - 2 * 88 / 512 && projected.y > 1 - 2 * 414 / 512);
      assert.ok(projected.z > -1 && projected.z < 1);
    }
  }
});
