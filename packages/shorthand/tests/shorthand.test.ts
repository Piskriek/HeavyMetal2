// Plan 56 wave W1: the shorthand language. One frame is typed JSON with a 4 KiB line text form and a CRC'd memory tail for share codes.
// The text form must reproduce the owner's example exactly, round-trip every frame, and survive hostile input without a throw.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SQ_DISTORTION_IDS, VEIL_STAGES } from '@hm/harness';
import {
  ALIGNED, MAX_FRAME_BYTES, PERM_KINDS, SQ_IDS, STAGE_IDS, applyPerm, attachMem, checkFrame, decodeMem, encodeMem, formatFrame, parseFrame,
  quantizeFrame, quantizeMem, safeCheckFrame, splitMem, stripMem, type Episode, type Frame, type Mem, type PermKind,
} from '../src/index';

const GOLDEN = [
  '@game src=api t=12.4 seq=88 perm=ent,rule',
  'e7 mob pos=3,0,-4 vel=0,0,1.2 hp=.6 c=.9',
  'f jump.apex=1.82m n=14 c=.8',
  'r loc id=m1 walk=4.3 run=5.6 jump=7.1 g=19.6 air=.3 n=14 mdl=-38 c=.7',
  'r logic id=d1 s:prox<2.5 n:and a:open-door n=9 c=.6',
  'o ctx=COMBAT_ESCORT ethics=1 att=4,-2 kappa=.7 focus=e7 ttl=30',
].join('\n');

/** Plain JSON copy so a test can edit a frame (checkFrame returns frozen data). */
const thaw = (f: Frame): Record<string, unknown> => JSON.parse(JSON.stringify(f)) as Record<string, unknown>;

const episode = (i: number): Episode => ({
  t: 100 + i * 7, stage: STAGE_IDS[i % STAGE_IDS.length]!, cat: i % 2 === 0 ? 'burst' : 'fall',
  ex: 0.1234 + (i % 5) / 10, err: (i % 7) / 10, h: 0.5, d: SQ_IDS[i % SQ_IDS.length]!, by: i % 3 === 0 ? ALIGNED : SQ_IDS[(i + 4) % SQ_IDS.length]!, ...(i % 4 === 0 ? { src: 'logic:reflex' } : {}),
});
const bigMem: Mem = {
  of: 'loc:ab12cd34', hard: 0.6204, bal: 0.41, charge: [0, 3, -2, 0, -127, 127, 1], inv: 0.3, cyc: 2, pol: -40, wan: { from: 'brain:0e01', done: 2, lim: 0.8 },
  ep: Array.from({ length: 32 }, (_, i) => episode(i)),
  cause: [
    { by: 'solar-control', d: 'root-reactivity', n: 5, open: true },
    { by: ALIGNED, d: 'sacral-shame', n: 65535, open: false },
  ],
  vocab: ['burst', 'fall'],
};
const smallMem: Mem = { of: 'logic:00ff', hard: 0, bal: 1, charge: [0, 0, 0, 0, 0, 0, 0], inv: 0, cyc: 0, ep: [], cause: [] };

const full = (): Frame => ({
  schema: 'hm2:shorthand:v1', game: 'fidelity', src: 'sdk', t: 12.40049, seq: 88, perm: ['mem', 'ent', 'fact', 'rule', 'order', 'look'],
  S: [0.5, 0.25, 0.1254, 1],
  ents: [
    { id: 'e7', kind: 'mob', grp: 'subject', pos: [3.00049, 0, -4], vel: [0, 0, 1.2], yaw: -1.5708, size: 0.45, hp: 0.6004, look: { pal: 'pal1', sil: 'sil2' }, c: 0.8999999 },
    { id: 'e8', kind: 'door', pos: [-0.0004, 2, 1e6], c: 1 },
  ],
  facts: [
    { subj: 'jump', pred: 'apex', value: 1.82, unit: 'm', n: 14, c: 0.8 },
    { subj: 'door', pred: 'state.now', value: 'open', n: 1, c: 0.5 },
  ],
  rules: [
    { kind: 'loc', id: 'm1', params: { walk: 4.3, run: 5.6, jump: 7.1, g: 19.6, air: 0.3, zeta: 2, alpha: 'x1' }, evidence: { n: 14, mdl: -38 }, c: 0.7 },
    { kind: 'logic', id: 'd1', params: {}, graph: ['s:prox<2.5', 'n:and', 'a:open-door'], evidence: { n: 9, fit: 0.9876 }, c: 0.6 },
  ],
  orders: [
    { ctx: 'COMBAT_ESCORT', ethics: 1, att: [4, -2], kappa: 0.7, focus: 'e7', verb: 'guard', ttl: 30 },
    { ctx: 'IDLE', ethics: 255, kappa: 0, ttl: 0 },
  ],
  mems: [bigMem, { ...smallMem, vocab: ['a', 'b'] }],
});

const reverseKeys = (v: unknown): unknown => {
  if (Array.isArray(v)) return v.map(reverseKeys);
  if (v !== null && typeof v === 'object') return Object.fromEntries(Object.entries(v).reverse().map(([k, x]) => [k, reverseKeys(x)]));
  return v;
};

test('the owner example block parses and formats back to the very same text (golden)', () => {
  const f = parseFrame(GOLDEN);
  assert.ok(f, 'the example parses');
  assert.equal(formatFrame(f), GOLDEN);
  assert.equal(f.game, 'game');
  assert.deepEqual(f.perm, ['ent', 'rule']);
  assert.equal(f.ents[0]?.id, 'e7');
  assert.equal(f.facts[0]?.subj, 'jump');
  assert.equal(f.facts[0]?.unit, 'm');
  assert.equal(f.rules[1]?.graph?.[0], 's:prox<2.5');
  assert.equal(f.orders[0]?.focus, 'e7');
  // one trailing newline is tolerated
  assert.equal(formatFrame(parseFrame(`${GOLDEN}\n`)!), GOLDEN);
});

test('a full frame with every item kind and a 32-episode mem round-trips exactly, and formatting is canonical', () => {
  const f = full();
  const text = formatFrame(f);
  assert.ok(Buffer.byteLength(text, 'utf8') <= MAX_FRAME_BYTES, `text form is ${Buffer.byteLength(text, 'utf8')} bytes`);
  const back = parseFrame(text);
  assert.ok(back, 'the text parses');
  assert.deepStrictEqual(back, quantizeFrame(f));
  assert.equal(back.mems[0]?.ep.length, 32);
  // quantization: 3 decimals, exact on the way back
  assert.equal(back.t, 12.4);
  assert.equal(back.ents[0]?.hp, 0.6);
  assert.equal(back.ents[1]?.pos[0], 0);
  assert.equal(Object.is(back.ents[1]?.pos[0], -0), false);
  assert.equal(back.mems[0]?.hard, 0.62);
  // text of the second round is the same text
  assert.equal(formatFrame(back), text);
  // key insertion order changes nothing
  const flipped = reverseKeys(f) as Frame;
  assert.equal(formatFrame(flipped), text);
  assert.equal(formatFrame(checkFrame(flipped)), text);
  // an empty look and an empty vocab are dropped, so they still round-trip
  const odd = { ...thaw(f), ents: [{ id: 'e1', kind: 'k', pos: [0, 0, 0], look: {}, c: 1 }], mems: [{ ...smallMem, vocab: [] }] } as unknown as Frame;
  assert.deepStrictEqual(parseFrame(formatFrame(odd)), quantizeFrame(odd));
});

test('hostile input: 2000 garbage and mutated texts never throw, and every accepted frame passes checkFrame', () => {
  let x = 12345;
  const next = (): number => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x; };
  const pick = (n: number): number => next() % n;
  const seeds = [GOLDEN, formatFrame(full()), '@a src=api t=0 seq=0 perm=', ''];
  const noise = " =,.'@:<>-_/\n\n0123456789abcdefxyzEMRSq%²\u0000é\ud83d";
  const garbage = (len: number): string => { let s = ''; for (let i = 0; i < len; i++) s += noise.charAt(pick(noise.length)); return s; };
  let accepted = 0;
  for (let i = 0; i < 2000; i++) {
    let s = seeds[pick(seeds.length)] ?? '';
    const kind = pick(5);
    if (kind === 0) s = garbage(pick(300));
    else if (kind === 4) s = s.repeat(1 + pick(4)) + garbage(pick(40));
    else {
      for (let m = 0, n = 1 + pick(6); m < n; m++) {
        const at = pick(s.length + 1);
        const op = pick(4);
        if (op === 0) s = s.slice(0, at) + noise.charAt(pick(noise.length)) + s.slice(at + 1);
        else if (op === 1) s = s.slice(0, at) + s.slice(at + 1 + pick(8));
        else if (op === 2) s = s.slice(0, at) + garbage(1 + pick(5)) + s.slice(at);
        else s = s.slice(0, at);
      }
    }
    let got: Frame | null = null;
    assert.doesNotThrow(() => { got = parseFrame(s); }, `parseFrame threw on ${JSON.stringify(s.slice(0, 80))}`);
    if (got !== null) {
      accepted++;
      assert.doesNotThrow(() => checkFrame(got));
      assert.ok(Buffer.byteLength(formatFrame(got), 'utf8') <= MAX_FRAME_BYTES);
    }
  }
  assert.ok(accepted > 0, 'some mutations still parse');
  for (const bad of [null, undefined, 42, {}, [], 'x'.repeat(100_000)]) assert.equal(parseFrame(bad as unknown as string), null);
  assert.equal(splitMem(null as unknown as string).mem, null);
});

test('validation: unknown fields, 33 episodes, charge 128, a foreign SQ id, an oversize text form and a URL are all refused', () => {
  const base = thaw(full());
  assert.equal(safeCheckFrame(base).ok, true);
  const refuse = (frame: unknown, want: RegExp): void => {
    const r = safeCheckFrame(frame);
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.why, want);
    assert.throws(() => checkFrame(frame), want);
  };
  refuse({ ...base, extra: 1 }, /extra.*unknown field/);
  const mem = (patch: Record<string, unknown>) => ({ ...base, mems: [{ ...smallMem, ...patch }] });
  refuse(mem({ ep: Array.from({ length: 33 }, (_, i) => episode(i)) }), /ep.*0\.\.32/);
  refuse(mem({ charge: [0, 0, 0, 0, 0, 0, 128] }), /charge\[6\]/);
  refuse(mem({ charge: [0, 0, 0, 0, 0, 0] }), /charge/);
  refuse(mem({ ep: [{ ...episode(0), d: 'solar-banana' }] }), /ep\[0\]\.d/);
  refuse(mem({ cause: [{ by: 'solar-control', d: ALIGNED, n: 1, open: true }] }), /cause\[0\]\.d/);
  refuse(mem({ of: 'LOC:zz' }), /\.of/);
  const wide = { ...base, ents: Array.from({ length: 64 }, (_, i) => ({ id: `e${i}`, kind: 'k'.repeat(60), pos: [i, 0, 0], c: 1 })), facts: [], rules: [], orders: [], mems: [] };
  assert.ok(formatFrame(wide as unknown as Frame).length > MAX_FRAME_BYTES);
  refuse(wide, /4096/);
  refuse({ ...base, ents: [{ id: 'e1', kind: 'https://x', pos: [0, 0, 0], c: 1 }] }, /URL|assets/);
  refuse({ ...base, ents: [{ id: 'e1', kind: 'k', pos: [0, 0, 0], look: { pal: 'DATA:abc' }, c: 1 }] }, /assets/);
  refuse({ ...base, game: 'file:x' }, /assets/);
  refuse({ ...base, rules: [{ kind: 'logic', id: 'r1', params: {}, graph: ['http:x'], evidence: { n: 1 }, c: 1 }] }, /assets/);
  refuse({ ...base, src: 'cloud' }, /src/);
  refuse({ ...base, ents: [{ id: '7', kind: 'k', pos: [0, 0, 0], c: 1 }] }, /ents\[0\]\.id/);
  refuse({ ...base, facts: [{ subj: 'a.b', pred: 'c', value: 1, n: 1, c: 1 }] }, /subj/);
  refuse({ ...base, facts: [{ subj: 'a', pred: 'c', value: 'on', unit: 'm', n: 1, c: 1 }] }, /unit/);
  refuse({ ...base, rules: [{ kind: 'loc', id: 'r1', params: { n: 1 }, evidence: { n: 1 }, c: 1 }] }, /params/);
  refuse({ ...base, rules: [{ kind: 'logic', id: 'r1', params: {}, graph: ['has space'], evidence: { n: 1 }, c: 1 }] }, /graph/);
  refuse({ ...base, ents: [{ id: 'e1', kind: 'k', pos: [0, 0, 0], c: 1.2 }] }, /ents\[0\]\.c/);
  refuse({ ...base, orders: [{ ctx: 'IDLE', ethics: 256, kappa: 0, ttl: 0 }] }, /ethics/);
});

test('applyPerm keeps only the allowed kinds, strips look without look, and sets perm to the intersection', () => {
  const f = full();
  const noMem = applyPerm(f, ['ent', 'fact', 'rule', 'order', 'look']);
  assert.equal(noMem.mems.length, 0);
  assert.equal(noMem.ents.length, 2);
  assert.deepEqual(noMem.perm, ['ent', 'fact', 'rule', 'order', 'look']);
  assert.equal(noMem.ents[0]?.look?.pal, 'pal1');
  const noLook = applyPerm(f, ['ent', 'rule', 'mem']);
  assert.equal(noLook.ents[0]?.look, undefined);
  assert.equal(noLook.ents[0]?.id, 'e7');
  assert.equal(noLook.facts.length, 0);
  assert.equal(noLook.orders.length, 0);
  assert.equal(noLook.mems.length, 2);
  assert.deepEqual(noLook.perm, ['ent', 'rule', 'mem']);
  const lookRule = { ...f, rules: [{ kind: 'look' as const, id: 'l1', params: {}, evidence: { n: 1 }, c: 1 }] };
  assert.equal(applyPerm(lookRule, ['rule']).rules.length, 0);
  assert.equal(applyPerm(lookRule, ['rule', 'look']).rules.length, 1);
  // the frame's own declared perm also limits what survives
  const narrow: Frame = { ...f, perm: ['ent'] };
  const out = applyPerm(narrow, [...PERM_KINDS] as PermKind[]);
  assert.deepEqual(out.perm, ['ent']);
  assert.equal(out.facts.length, 0);
  // nothing allowed: only the header is left
  const none = applyPerm(f, []);
  assert.deepEqual([none.perm.length, none.ents.length, none.facts.length, none.rules.length, none.orders.length, none.mems.length], [0, 0, 0, 0, 0, 0]);
  assert.equal(parseFrame(formatFrame(none)) !== null, true);
});

test('the memory tail: attach, split and strip round-trip; garbage is null; a bad tail keeps the preset', () => {
  const code = 'LOC1abc';
  const tailed = attachMem(code, bigMem);
  assert.ok(tailed.startsWith('LOC1abc~m:'));
  assert.equal(tailed.split('~').length, 2);
  const { preset, mem } = splitMem(tailed);
  assert.equal(preset, code);
  assert.deepStrictEqual(mem, quantizeMem(bigMem));
  assert.equal(stripMem(tailed), code);
  assert.equal(stripMem(code), code);
  assert.deepStrictEqual(decodeMem(encodeMem(smallMem)), quantizeMem(smallMem));
  assert.equal(splitMem(code).mem, null);
  assert.equal(splitMem(code).preset, code);
  assert.deepEqual(splitMem(`${code}~m:garbage!`), { preset: code, mem: null });
  assert.deepEqual(splitMem(`${code}~x:abc`), { preset: code, mem: null });
  assert.deepEqual(splitMem(`${code}~m:`), { preset: code, mem: null });
  assert.equal(splitMem(`${code}~m:a~m:b`).mem, null);
  for (const g of ['', 'garbage', '~', 'AAAA', '🙂', 'x'.repeat(200_000)]) assert.equal(decodeMem(g), null);
  // one flipped character breaks the CRC
  const code2 = encodeMem(smallMem);
  const flipped = `${code2.slice(0, 10)}${code2.charAt(10) === 'A' ? 'B' : 'A'}${code2.slice(11)}`;
  assert.equal(decodeMem(flipped), null);
  assert.throws(() => attachMem(tailed, smallMem), /tail/);
  assert.throws(() => attachMem('a~b', smallMem), /tail/);
  assert.throws(() => attachMem(code, { ...smallMem, charge: [1] }), /charge/);
  // a mem code is not a frame schema code and vice versa: wrong preset schema decodes to null, not a throw
  assert.equal(decodeMem(code), null);
});

test('vocabulary parity with the harness: SQ ids and veil stages are the very same lists', () => {
  assert.deepEqual([...SQ_IDS], [...SQ_DISTORTION_IDS]);
  assert.deepEqual([...STAGE_IDS], [...VEIL_STAGES]);
  assert.equal(SQ_IDS.length, 21);
});
