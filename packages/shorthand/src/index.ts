/**
 * @hm/shorthand: the compact language an observer and the harness speak (hm2:shorthand:v1).
 *
 * One frame is typed JSON (validated with the gamepreset combinators) with a one-item-per-line text form of at most
 * 4 KiB and a CRC'd share-code tail for a preset's memory. Pure and deterministic: no clock, no random, no I/O.
 * Parsing treats its input as hostile: parseFrame, decodeMem and splitMem never throw, every loop is bounded, and
 * anything invalid is null. Assets never appear: there is no field for bytes, and no string may open like a URL.
 *
 * Text form (see formatFrame): `@game src=api t=12.4 seq=88 perm=ent,rule`, then `e7 mob pos=...`, `f jump.apex=1.82m ...`,
 * `r loc id=m1 ...`, `o ctx=...`, `m of=loc:ab12 ...` (each mem followed by its `me` episode lines, then its `mc` cause lines).
 *
 * Decisions taken where the brief left a choice:
 *  - An Ent id carries its own `e` prefix ('e7'), so the line starts with the id and `focus=e7` points at it directly.
 *    Line heads f, r, o, m, me, mc and @ never clash because an ent id is `e` plus at least one more character.
 *  - A Fact subj has no dot: `jump.apex` is subj `jump`, pred `apex`; the pred may hold dots (split at the first dot).
 *  - A text value (a Fact value or a rule param) is written with a leading apostrophe (`state='open`), so it can never
 *    be mistaken for a number. Units are letters, % and ² only, and only follow numbers.
 *  - Rule params are written in a fixed order: walk, run, jump, g, air first (the loc preset's field order, which the
 *    owner's example uses), then every other key sorted. Graph tokens follow the params and keep their order.
 *  - Plan 56's one-line example carried `ep=14 cause=a>b:5` inline. That cannot hold 32 episodes losslessly, so the
 *    episodes and the cause links are their own `me` and `mc` lines instead (lossless text form).
 *  - 'look' permission also gates `Rule look` (the synthesis maps Rule look and Ent.look to the same permission).
 */
import { canonicalJson, dictionary, frozenSchema, id, invalid, list, number, oneOf, optional, shape, text, type JsonRule } from '@hm/gamepreset';
import { decode, encode, type Field, type Schema } from '@hm/presetcodec';

// ------------------------------------------------------------------ vocabulary

export const SHORTHAND_SCHEMA = 'hm2:shorthand:v1';
export const SOURCES = ['api', 'sdk', 'loader', 'files', 'screen', 'audio'] as const;
export const PERM_KINDS = ['ent', 'fact', 'rule', 'order', 'look', 'mem'] as const;
export const RULE_KINDS = ['loc', 'mot', 'logic', 'brain', 'game', 'look', 'sound'] as const;
export const ORDER_CTX = ['IDLE', 'PATROL', 'COMBAT_ESCORT', 'RECOVERY'] as const;
export const ENT_GROUPS = ['base', 'structure', 'mechanism', 'controls', 'subject'] as const;
export const STAGE_IDS = ['S0a', 'S0b', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6'] as const;
export const SQ_IDS = [
  'root-lack', 'root-fear', 'root-reactivity', 'root-apathy', 'root-trauma',
  'sacral-resistance', 'sacral-guilt', 'sacral-shame', 'sacral-insecurity', 'sacral-frustration', 'sacral-addiction', 'sacral-repression',
  'solar-control', 'solar-anxiety', 'solar-victimhood', 'solar-jealousy', 'solar-projection', 'solar-pride',
  'heart-awakening', 'throat-actualization', 'thirdeye-illumination',
] as const;
export const ALIGNED = 'aligned';

export const MAX_FRAME_BYTES = 4096;
export const MAX_EPISODES = 32;
export const MAX_CAUSE_LINKS = 64;
export const MAX_VOCAB = 16;
/** Ents, facts, rules, orders and mems: at most this many of each in a frame. */
export const MAX_ITEMS = 64;

export type Source = (typeof SOURCES)[number];
export type PermKind = (typeof PERM_KINDS)[number];
export type PermMask = readonly PermKind[];
export type RuleKind = (typeof RULE_KINDS)[number];
export type OrderCtx = (typeof ORDER_CTX)[number];
export type EntGroup = (typeof ENT_GROUPS)[number];
export type StageId = (typeof STAGE_IDS)[number];
export type SqId = (typeof SQ_IDS)[number];
export type SqOrAligned = SqId | typeof ALIGNED;

// ------------------------------------------------------------------ types

export type Vec3 = readonly [number, number, number];
export type Vec2 = readonly [number, number];

export interface Ent {
  readonly id: string;
  readonly kind: string;
  readonly grp?: EntGroup;
  readonly pos: Vec3;
  readonly vel?: Vec3;
  readonly yaw?: number;
  readonly size?: number;
  readonly hp?: number;
  readonly look?: { readonly pal?: string; readonly sil?: string };
  readonly c: number;
}
export interface Fact {
  readonly subj: string;
  readonly pred: string;
  readonly value: number | string;
  readonly unit?: string;
  readonly n: number;
  readonly c: number;
}
export interface Rule {
  readonly kind: RuleKind;
  readonly id: string;
  readonly params: Readonly<Record<string, number | string>>;
  readonly graph?: readonly string[];
  readonly evidence: { readonly n: number; readonly fit?: number; readonly mdl?: number };
  readonly c: number;
}
export interface Order {
  readonly ctx: OrderCtx;
  readonly ethics: number;
  readonly att?: Vec2;
  readonly kappa: number;
  readonly focus?: string;
  readonly verb?: string;
  readonly ttl: number;
}
export interface Episode {
  readonly t: number;
  readonly stage: StageId;
  readonly cat: string;
  readonly ex: number;
  readonly err: number;
  readonly h: number;
  readonly d: SqOrAligned;
  readonly by: SqOrAligned;
}
export interface CauseLink {
  readonly by: SqOrAligned;
  readonly d: SqId;
  readonly n: number;
  readonly open: boolean;
}
export interface Mem {
  readonly of: string;
  readonly hard: number;
  readonly bal: number;
  readonly charge: readonly number[];
  readonly ep: readonly Episode[];
  readonly cause: readonly CauseLink[];
  readonly inv: number;
  readonly cyc: number;
  readonly vocab?: readonly string[];
}
export interface Frame {
  readonly schema: typeof SHORTHAND_SCHEMA;
  readonly game: string;
  readonly src: Source;
  readonly t: number;
  readonly seq: number;
  readonly perm: PermMask;
  readonly S?: readonly [number, number, number, number];
  readonly ents: readonly Ent[];
  readonly facts: readonly Fact[];
  readonly rules: readonly Rule[];
  readonly orders: readonly Order[];
  readonly mems: readonly Mem[];
}

// ------------------------------------------------------------------ validation rules

const MAX_ID = 64;
/** Param keys that the rule line reserves for its own fields. */
const RESERVED_PARAM_KEYS: readonly string[] = ['id', 'n', 'fit', 'mdl', 'c'];
/** A graph token: a short lowercase tag, a colon, then up to 60 of letters, digits, _ . - < >. No spaces, no '='. */
const GRAPH_TOKEN_RE = /^[a-z][a-z0-9]{0,3}:[A-Za-z0-9_.\-<>]{1,60}$/;
const UNIT_RE = /^[A-Za-z%²]{1,8}$/;
const OF_RE = /^[a-z]+:[0-9a-f]{4,16}$/;
const ASSET_RE = /^(?:https?|data|file):/i;

const shid: JsonRule = (v, p) => {
  id(v, p);
  if ((v as string).length > MAX_ID) invalid(p, `id longer than ${MAX_ID} characters`);
};
const entId: JsonRule = (v, p) => {
  shid(v, p);
  const s = v as string;
  if (s.length < 2 || !s.startsWith('e')) invalid(p, "an ent id is 'e' plus at least one more character");
};
const factSubj: JsonRule = (v, p) => {
  shid(v, p);
  if ((v as string).includes('.')) invalid(p, 'a fact subject has no dot');
};
const unitRule: JsonRule = (v, p) => {
  text(8)(v, p);
  if (!UNIT_RE.test(v as string)) invalid(p, 'a unit is letters, % or ² (at most 8)');
};
const graphToken: JsonRule = (v, p) => {
  if (typeof v !== 'string' || !GRAPH_TOKEN_RE.test(v)) invalid(p, 'invalid graph token');
};
const ofRule: JsonRule = (v, p) => {
  if (typeof v !== 'string' || v.length > 32 || !OF_RE.test(v)) invalid(p, 'expected a preset kind and content hash like loc:ab12cd34');
};

const n01 = number(0, 1);
const nBig = number(-10_000_000, 10_000_000);
const nPos = number(0, 10_000_000);
const int31 = number(0, 2_147_483_647, true);
const vec3Rule: JsonRule = list(nBig, 3, 3);
const sqRule: JsonRule = oneOf(SQ_IDS);
const sqOrAlignedRule: JsonRule = oneOf([...SQ_IDS, ALIGNED]);
const boolRule: JsonRule = (v, p) => { if (typeof v !== 'boolean') invalid(p, 'expected boolean'); };

const paramValue: JsonRule = (v, p) => { if (typeof v === 'number') nBig(v, p); else shid(v, p); };
const paramsRule: JsonRule = (v, p) => {
  dictionary(paramValue, 32)(v, p);
  for (const key of Object.keys(v as object)) {
    if (key.length > 32 || RESERVED_PARAM_KEYS.includes(key)) invalid(`${p}.${key}`, 'param key reserved or longer than 32');
  }
};

const entRule: JsonRule = shape({
  id: entId, kind: shid, grp: optional(oneOf(ENT_GROUPS)), pos: vec3Rule, vel: optional(vec3Rule),
  yaw: optional(nBig), size: optional(nPos), hp: optional(n01),
  look: optional(shape({ pal: optional(shid), sil: optional(shid) })), c: n01,
});
const factShape = shape({ subj: factSubj, pred: shid, value: (v, p) => paramValue(v, p), unit: optional(unitRule), n: int31, c: n01 });
const factRule: JsonRule = (v, p) => {
  factShape(v, p);
  const f = v as { value: unknown; unit?: unknown };
  if (typeof f.value === 'string' && f.unit !== undefined) invalid(`${p}.unit`, 'a unit only follows a number');
};
const ruleRule: JsonRule = shape({
  kind: oneOf(RULE_KINDS), id: shid, params: paramsRule, graph: optional(list(graphToken, 32)),
  evidence: shape({ n: int31, fit: optional(nBig), mdl: optional(nBig) }), c: n01,
});
const orderRule: JsonRule = shape({
  ctx: oneOf(ORDER_CTX), ethics: number(0, 255, true), att: optional(list(nBig, 2, 2)), kappa: n01,
  focus: optional(shid), verb: optional(shid), ttl: nPos,
});
const episodeRule: JsonRule = shape({
  t: int31, stage: oneOf(STAGE_IDS), cat: shid, ex: n01, err: n01, h: n01, d: sqOrAlignedRule, by: sqOrAlignedRule,
});
const causeRule: JsonRule = shape({ by: sqOrAlignedRule, d: sqRule, n: number(0, 65535, true), open: boolRule });
const memRule: JsonRule = shape({
  of: ofRule, hard: n01, bal: n01, charge: list(number(-127, 127, true), 7, 7),
  ep: list(episodeRule, MAX_EPISODES), cause: list(causeRule, MAX_CAUSE_LINKS), inv: n01, cyc: number(0, 65535, true),
  vocab: optional(list(shid, MAX_VOCAB)),
});
const frameRule: JsonRule = shape({
  schema: oneOf([SHORTHAND_SCHEMA]), game: shid, src: oneOf(SOURCES), t: nPos, seq: int31,
  perm: list(oneOf(PERM_KINDS), PERM_KINDS.length), S: optional(list(n01, 4, 4)),
  ents: list(entRule, MAX_ITEMS), facts: list(factRule, MAX_ITEMS), rules: list(ruleRule, MAX_ITEMS),
  orders: list(orderRule, MAX_ITEMS), mems: list(memRule, MAX_ITEMS),
});

const FRAME_SCHEMA = frozenSchema<Frame>(frameRule);
const MEM_SCHEMA = frozenSchema<Mem>(memRule);

// ------------------------------------------------------------------ quantization

/** Round to 1/1000, half away from zero, never -0. Idempotent. Used for every number the frame carries. */
function q3(x: number): number {
  const q = Math.round(Math.abs(x) * 1000) / 1000;
  return x < 0 ? (q === 0 ? 0 : -q) : q;
}
const qv3 = (v: Vec3): Vec3 => [q3(v[0]), q3(v[1]), q3(v[2])];

const PARAM_FIRST: readonly string[] = ['walk', 'run', 'jump', 'g', 'air'];
function orderedParamKeys(params: Readonly<Record<string, unknown>>): string[] {
  const keys = Object.keys(params);
  return [...PARAM_FIRST.filter((k) => keys.includes(k)), ...keys.filter((k) => !PARAM_FIRST.includes(k)).sort()];
}

function quantizeEnt(e: Ent): Ent {
  const look = e.look === undefined ? undefined : { ...(e.look.pal !== undefined ? { pal: e.look.pal } : {}), ...(e.look.sil !== undefined ? { sil: e.look.sil } : {}) };
  return {
    id: e.id, kind: e.kind, ...(e.grp !== undefined ? { grp: e.grp } : {}), pos: qv3(e.pos),
    ...(e.vel !== undefined ? { vel: qv3(e.vel) } : {}), ...(e.yaw !== undefined ? { yaw: q3(e.yaw) } : {}),
    ...(e.size !== undefined ? { size: q3(e.size) } : {}), ...(e.hp !== undefined ? { hp: q3(e.hp) } : {}),
    ...(look !== undefined && Object.keys(look).length > 0 ? { look } : {}), c: q3(e.c),
  };
}
function quantizeFact(f: Fact): Fact {
  return {
    subj: f.subj, pred: f.pred, value: typeof f.value === 'number' ? q3(f.value) : f.value,
    ...(f.unit !== undefined ? { unit: f.unit } : {}), n: f.n, c: q3(f.c),
  };
}
function quantizeRule(r: Rule): Rule {
  const params: Record<string, number | string> = Object.fromEntries(orderedParamKeys(r.params).map((k): [string, number | string] => {
    const v = r.params[k] ?? 0;
    return [k, typeof v === 'number' ? q3(v) : v];
  }));
  return {
    kind: r.kind, id: r.id, params, ...(r.graph !== undefined && r.graph.length > 0 ? { graph: [...r.graph] } : {}),
    evidence: { n: r.evidence.n, ...(r.evidence.fit !== undefined ? { fit: q3(r.evidence.fit) } : {}), ...(r.evidence.mdl !== undefined ? { mdl: q3(r.evidence.mdl) } : {}) },
    c: q3(r.c),
  };
}
function quantizeOrder(o: Order): Order {
  return {
    ctx: o.ctx, ethics: o.ethics, ...(o.att !== undefined ? { att: [q3(o.att[0]), q3(o.att[1])] as const } : {}),
    kappa: q3(o.kappa), ...(o.focus !== undefined ? { focus: o.focus } : {}), ...(o.verb !== undefined ? { verb: o.verb } : {}), ttl: q3(o.ttl),
  };
}
/** The mem with every 0..1 field on a 1/1000 grid and an empty vocab dropped. */
export function quantizeMem(m: Mem): Mem {
  return {
    of: m.of, hard: q3(m.hard), bal: q3(m.bal), charge: [...m.charge],
    ep: m.ep.map((e) => ({ t: e.t, stage: e.stage, cat: e.cat, ex: q3(e.ex), err: q3(e.err), h: q3(e.h), d: e.d, by: e.by })),
    cause: m.cause.map((c) => ({ by: c.by, d: c.d, n: c.n, open: c.open })),
    inv: q3(m.inv), cyc: m.cyc, ...(m.vocab !== undefined && m.vocab.length > 0 ? { vocab: [...m.vocab] } : {}),
  };
}
/** The canonical frame: numbers on their grids, perm deduplicated in PERM_KINDS order, empty look and vocab dropped, param keys in canonical order. */
export function quantizeFrame(f: Frame): Frame {
  return {
    schema: f.schema, game: f.game, src: f.src, t: q3(f.t), seq: f.seq, perm: PERM_KINDS.filter((k) => f.perm.includes(k)),
    ...(f.S !== undefined ? { S: [q3(f.S[0]), q3(f.S[1]), q3(f.S[2]), q3(f.S[3])] as const } : {}),
    ents: f.ents.map(quantizeEnt), facts: f.facts.map(quantizeFact), rules: f.rules.map(quantizeRule),
    orders: f.orders.map(quantizeOrder), mems: f.mems.map(quantizeMem),
  };
}

// ------------------------------------------------------------------ text form: format

/** Up to 3 decimals, trailing zeros stripped, the leading zero dropped: 0.62 -> .62, -0.5 -> -.5, 0 -> 0. */
function num(x: number): string {
  const q = q3(x);
  if (q === 0) return '0';
  let s = Math.abs(q).toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
  if (s.startsWith('0.')) s = s.slice(1);
  return q < 0 ? `-${s}` : s;
}
const vec = (v: readonly number[]): string => v.map(num).join(',');
const val = (v: number | string): string => (typeof v === 'number' ? num(v) : `'${v}`);

/** The text form of a frame: header, ents, facts, rules, orders, then each mem with its `me` and `mc` lines. No trailing newline. */
export function formatFrame(frame: Frame): string {
  const f = quantizeFrame(frame);
  const out: string[] = [];
  out.push(`@${f.game} src=${f.src} t=${num(f.t)} seq=${f.seq} perm=${f.perm.join(',')}${f.S !== undefined ? ` S=${vec(f.S)}` : ''}`);
  for (const e of f.ents) {
    const p = [e.id, e.kind, `pos=${vec(e.pos)}`];
    if (e.vel !== undefined) p.push(`vel=${vec(e.vel)}`);
    if (e.yaw !== undefined) p.push(`yaw=${num(e.yaw)}`);
    if (e.size !== undefined) p.push(`size=${num(e.size)}`);
    if (e.hp !== undefined) p.push(`hp=${num(e.hp)}`);
    if (e.grp !== undefined) p.push(`grp=${e.grp}`);
    if (e.look?.pal !== undefined) p.push(`pal=${e.look.pal}`);
    if (e.look?.sil !== undefined) p.push(`sil=${e.look.sil}`);
    p.push(`c=${num(e.c)}`);
    out.push(p.join(' '));
  }
  for (const x of f.facts) {
    out.push(`f ${x.subj}.${x.pred}=${val(x.value)}${x.unit ?? ''} n=${x.n} c=${num(x.c)}`);
  }
  for (const r of f.rules) {
    const p = ['r', r.kind, `id=${r.id}`];
    for (const k of orderedParamKeys(r.params)) p.push(`${k}=${val(r.params[k] ?? 0)}`);
    for (const g of r.graph ?? []) p.push(g);
    p.push(`n=${r.evidence.n}`);
    if (r.evidence.fit !== undefined) p.push(`fit=${num(r.evidence.fit)}`);
    if (r.evidence.mdl !== undefined) p.push(`mdl=${num(r.evidence.mdl)}`);
    p.push(`c=${num(r.c)}`);
    out.push(p.join(' '));
  }
  for (const o of f.orders) {
    const p = ['o', `ctx=${o.ctx}`, `ethics=${o.ethics}`];
    if (o.att !== undefined) p.push(`att=${vec(o.att)}`);
    p.push(`kappa=${num(o.kappa)}`);
    if (o.focus !== undefined) p.push(`focus=${o.focus}`);
    if (o.verb !== undefined) p.push(`verb=${o.verb}`);
    p.push(`ttl=${num(o.ttl)}`);
    out.push(p.join(' '));
  }
  for (const m of f.mems) {
    out.push(`m of=${m.of} hard=${num(m.hard)} bal=${num(m.bal)} ch=${m.charge.join(',')} inv=${num(m.inv)} cyc=${m.cyc}${m.vocab !== undefined ? ` vocab=${m.vocab.join(',')}` : ''}`);
    for (const e of m.ep) out.push(`me t=${e.t} st=${e.stage} cat=${e.cat} ex=${num(e.ex)} err=${num(e.err)} h=${num(e.h)} d=${e.d} by=${e.by}`);
    for (const c of m.cause) out.push(`mc by=${c.by} d=${c.d} n=${c.n} open=${c.open ? 1 : 0}`);
  }
  return out.join('\n');
}

/** The canonical JSON of a frame (sorted keys, quantized): the form to hash or compare. */
export function canonicalFrameJson(frame: Frame): string {
  return canonicalJson(quantizeFrame(frame));
}

// ------------------------------------------------------------------ checking

function utf8Bytes(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff) { n += 4; i++; }
    else n += 3;
  }
  return n;
}

/** Rejects any string (or key) that opens like a URL or a data blob. Assets never cross. */
function assertNoAssets(v: unknown, path: string, depth = 0): void {
  if (depth > 16) invalid(path, 'nested too deeply');
  if (typeof v === 'string') {
    if (ASSET_RE.test(v)) invalid(path, 'assets and URLs are not allowed');
  } else if (Array.isArray(v)) {
    v.forEach((x, i) => assertNoAssets(x, `${path}[${i}]`, depth + 1));
  } else if (v !== null && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) {
      if (ASSET_RE.test(k)) invalid(`${path}.${k}`, 'assets and URLs are not allowed');
      assertNoAssets(x, `${path}.${k}`, depth + 1);
    }
  }
}

/** Validates a value as a Frame and returns it quantized and frozen. Throws Error('path: why') on anything invalid, including a text form over 4 KiB. */
export function checkFrame(value: unknown): Frame {
  const raw = FRAME_SCHEMA.parse(value);
  assertNoAssets(raw, '$');
  const frame = FRAME_SCHEMA.parse(quantizeFrame(raw));
  const bytes = utf8Bytes(formatFrame(frame));
  if (bytes > MAX_FRAME_BYTES) invalid('$', `text form is ${bytes} bytes, the limit is ${MAX_FRAME_BYTES}`);
  return frame;
}

export function safeCheckFrame(value: unknown): { readonly ok: true; readonly frame: Frame } | { readonly ok: false; readonly why: string } {
  try {
    return { ok: true, frame: checkFrame(value) };
  } catch (e) {
    return { ok: false, why: e instanceof Error ? e.message : 'invalid frame' };
  }
}

/** Validates a value as a Mem and returns it quantized and frozen. Throws on anything invalid. */
export function checkMem(value: unknown): Mem {
  const raw = MEM_SCHEMA.parse(value);
  assertNoAssets(raw, '$');
  return MEM_SCHEMA.parse(quantizeMem(raw));
}

// ------------------------------------------------------------------ text form: parse

const BAD = new Error('bad shorthand');
const NUM_RE = /^-?(?:\d{1,12}(?:\.\d{1,12})?|\.\d{1,12})$/;
const FACT_NUM_RE = /^(-?(?:\d{1,12}(?:\.\d{1,12})?|\.\d{1,12}))([A-Za-z%²]{0,8})$/;

function pn(s: string | undefined): number {
  if (s === undefined || !NUM_RE.test(s)) throw BAD;
  return Number(s);
}
function pvec(s: string | undefined, n: number): number[] {
  if (s === undefined) throw BAD;
  const parts = s.split(',');
  if (parts.length !== n) throw BAD;
  return parts.map(pn);
}
/** The key=value tokens from `from`, each key checked against `allowed`, no repeats, no bare tokens. */
function kv(tokens: readonly string[], from: number, allowed: readonly string[]): Map<string, string> {
  const m = new Map<string, string>();
  for (let i = from; i < tokens.length; i++) {
    const t = tokens[i] ?? '';
    const at = t.indexOf('=');
    if (at <= 0) throw BAD;
    const key = t.slice(0, at);
    if (!allowed.includes(key) || m.has(key)) throw BAD;
    m.set(key, t.slice(at + 1));
  }
  return m;
}
function need(m: ReadonlyMap<string, string>, key: string): string {
  const v = m.get(key);
  if (v === undefined) throw BAD;
  return v;
}
/** A param or fact value: `'text` is a string, anything else is a number. */
function pval(s: string): number | string {
  return s.startsWith("'") ? s.slice(1) : pn(s);
}
const opt = <T>(m: ReadonlyMap<string, string>, key: string, f: (s: string) => T): { [k: string]: T } | Record<string, never> => {
  const v = m.get(key);
  return v === undefined ? {} : { [key]: f(v) };
};

function parseInner(textIn: string): Frame {
  if (typeof textIn !== 'string' || textIn.length > MAX_FRAME_BYTES + 1) throw BAD;
  const s = textIn.endsWith('\n') ? textIn.slice(0, -1) : textIn;
  if (utf8Bytes(s) > MAX_FRAME_BYTES) throw BAD;
  const lines = s.split('\n');

  const h = (lines[0] ?? '').split(' ');
  const gameTok = h[0] ?? '';
  if (!gameTok.startsWith('@')) throw BAD;
  const hm = kv(h, 1, ['src', 't', 'seq', 'perm', 'S']);
  const permText = need(hm, 'perm');

  const ents: unknown[] = [];
  const facts: unknown[] = [];
  const rules: unknown[] = [];
  const orders: unknown[] = [];
  const mems: Array<{ ep: unknown[]; cause: unknown[] } & Record<string, unknown>> = [];

  for (let li = 1; li < lines.length; li++) {
    const tk = (lines[li] ?? '').split(' ');
    const head = tk[0] ?? '';
    if (head === 'f') {
      const body = tk[1] ?? '';
      const eq = body.indexOf('=');
      const dot = body.indexOf('.');
      if (eq < 0 || dot < 1 || dot > eq) throw BAD;
      const rest = kv(tk, 2, ['n', 'c']);
      const vs = body.slice(eq + 1);
      let value: number | string;
      let unit: string | undefined;
      if (vs.startsWith("'")) {
        value = vs.slice(1);
      } else {
        const mm = FACT_NUM_RE.exec(vs);
        if (mm === null) throw BAD;
        value = Number(mm[1]);
        unit = mm[2] === '' ? undefined : mm[2];
      }
      facts.push({ subj: body.slice(0, dot), pred: body.slice(dot + 1, eq), value, ...(unit !== undefined ? { unit } : {}), n: pn(need(rest, 'n')), c: pn(need(rest, 'c')) });
    } else if (head === 'r') {
      const rkind = tk[1] ?? '';
      const evid = new Map<string, string>();
      const params: Array<[string, number | string]> = [];
      const graph: string[] = [];
      for (let i = 2; i < tk.length; i++) {
        const t = tk[i] ?? '';
        const at = t.indexOf('=');
        if (at < 0) { graph.push(t); continue; }
        const key = t.slice(0, at);
        const value = t.slice(at + 1);
        if (key === '') throw BAD;
        if (RESERVED_PARAM_KEYS.includes(key)) {
          if (evid.has(key)) throw BAD;
          evid.set(key, value);
        } else {
          if (params.some(([k]) => k === key)) throw BAD;
          params.push([key, pval(value)]);
        }
      }
      rules.push({
        kind: rkind, id: need(evid, 'id'), params: Object.fromEntries(params), ...(graph.length > 0 ? { graph } : {}),
        evidence: { n: pn(need(evid, 'n')), ...opt(evid, 'fit', pn), ...opt(evid, 'mdl', pn) }, c: pn(need(evid, 'c')),
      });
    } else if (head === 'o') {
      const m = kv(tk, 1, ['ctx', 'ethics', 'att', 'kappa', 'focus', 'verb', 'ttl']);
      orders.push({
        ctx: need(m, 'ctx'), ethics: pn(need(m, 'ethics')), ...opt(m, 'att', (x) => pvec(x, 2)), kappa: pn(need(m, 'kappa')),
        ...opt(m, 'focus', (x) => x), ...opt(m, 'verb', (x) => x), ttl: pn(need(m, 'ttl')),
      });
    } else if (head === 'm') {
      const m = kv(tk, 1, ['of', 'hard', 'bal', 'ch', 'inv', 'cyc', 'vocab']);
      mems.push({
        of: need(m, 'of'), hard: pn(need(m, 'hard')), bal: pn(need(m, 'bal')), charge: pvec(need(m, 'ch'), 7), ep: [], cause: [],
        inv: pn(need(m, 'inv')), cyc: pn(need(m, 'cyc')), ...opt(m, 'vocab', (x) => (x === '' ? [] : x.split(','))),
      });
    } else if (head === 'me' || head === 'mc') {
      const cur = mems[mems.length - 1];
      if (cur === undefined) throw BAD;
      if (head === 'me') {
        const m = kv(tk, 1, ['t', 'st', 'cat', 'ex', 'err', 'h', 'd', 'by']);
        cur.ep.push({
          t: pn(need(m, 't')), stage: need(m, 'st'), cat: need(m, 'cat'), ex: pn(need(m, 'ex')), err: pn(need(m, 'err')),
          h: pn(need(m, 'h')), d: need(m, 'd'), by: need(m, 'by'),
        });
      } else {
        const m = kv(tk, 1, ['by', 'd', 'n', 'open']);
        const open = need(m, 'open');
        if (open !== '0' && open !== '1') throw BAD;
        cur.cause.push({ by: need(m, 'by'), d: need(m, 'd'), n: pn(need(m, 'n')), open: open === '1' });
      }
    } else if (head.length >= 2 && head.startsWith('e')) {
      const m = kv(tk, 2, ['pos', 'vel', 'yaw', 'size', 'hp', 'grp', 'pal', 'sil', 'c']);
      const pal = m.get('pal');
      const sil = m.get('sil');
      ents.push({
        id: head, kind: tk[1] ?? '', ...(m.has('grp') ? { grp: need(m, 'grp') } : {}), pos: pvec(need(m, 'pos'), 3),
        ...opt(m, 'vel', (x) => pvec(x, 3)), ...opt(m, 'yaw', pn), ...opt(m, 'size', pn), ...opt(m, 'hp', pn),
        ...(pal !== undefined || sil !== undefined ? { look: { ...(pal !== undefined ? { pal } : {}), ...(sil !== undefined ? { sil } : {}) } } : {}),
        c: pn(need(m, 'c')),
      });
    } else {
      throw BAD;
    }
  }

  return checkFrame({
    schema: SHORTHAND_SCHEMA, game: gameTok.slice(1), src: need(hm, 'src'), t: pn(need(hm, 't')), seq: pn(need(hm, 'seq')),
    perm: permText === '' ? [] : permText.split(','), ...opt(hm, 'S', (x) => pvec(x, 4)), ents, facts, rules, orders, mems,
  });
}

/** Reads the text form. Returns the frame (quantized, checked) or null. Never throws. */
export function parseFrame(textIn: string): Frame | null {
  try {
    return parseInner(textIn);
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------ permission mask

/**
 * Keeps only what both the frame's own perm and `perm` allow, and sets the result's perm to that intersection.
 * Drops ents, facts, rules, orders and mems whose kind is not allowed; strips ent `look` (and `Rule look`) without 'look'.
 */
export function applyPerm(frame: Frame, perm: PermMask): Frame {
  const f = quantizeFrame(frame);
  const keep = PERM_KINDS.filter((k) => f.perm.includes(k) && perm.includes(k));
  const has = (k: PermKind): boolean => keep.includes(k);
  const noLook = (e: Ent): Ent => {
    const { look: _look, ...rest } = e;
    return rest;
  };
  return {
    ...f,
    perm: keep,
    ents: has('ent') ? f.ents.map((e) => (has('look') || e.look === undefined ? e : noLook(e))) : [],
    facts: has('fact') ? f.facts : [],
    rules: has('rule') ? f.rules.filter((r) => has('look') || r.kind !== 'look') : [],
    orders: has('order') ? f.orders : [],
    mems: has('mem') ? f.mems : [],
  };
}

// ------------------------------------------------------------------ memory share-code tail

const SQ_OPTIONS: readonly string[] = [...SQ_IDS, ALIGNED];
const fl = (): Field => ({ kind: 'float', min: 0, max: 1, step: 0.001 });
const str = (maxBytes: number): Field => ({ kind: 'string', maxBytes });

/** The presetcodec schema of a Mem: floats on the 1/1000 grid, enums for the stage and SQ ids. */
export const MEM_CODEC_SCHEMA: Schema = {
  id: 'hm2:shorthand-mem',
  version: 1,
  root: {
    kind: 'object',
    fields: {
      of: str(32), hard: fl(), bal: fl(), charge: { kind: 'array', of: { kind: 'int', min: -127, max: 127 }, maxLength: 7 },
      ep: {
        kind: 'array', maxLength: MAX_EPISODES,
        of: {
          kind: 'object',
          fields: {
            t: { kind: 'int', min: 0, max: 2_147_483_647 }, stage: { kind: 'enum', options: STAGE_IDS }, cat: str(MAX_ID),
            ex: fl(), err: fl(), h: fl(), d: { kind: 'enum', options: SQ_OPTIONS }, by: { kind: 'enum', options: SQ_OPTIONS },
          },
        },
      },
      cause: {
        kind: 'array', maxLength: MAX_CAUSE_LINKS,
        of: {
          kind: 'object',
          fields: { by: { kind: 'enum', options: SQ_OPTIONS }, d: { kind: 'enum', options: SQ_IDS }, n: { kind: 'int', min: 0, max: 65535 }, open: { kind: 'bool' } },
        },
      },
      inv: fl(), cyc: { kind: 'int', min: 0, max: 65535 }, vocab: { kind: 'array', of: str(MAX_ID), maxLength: MAX_VOCAB },
    },
  },
};

/** A mem as a share code (checked and quantized first). Throws Error(why) on an invalid mem. */
export function encodeMem(mem: Mem): string {
  const m = checkMem(mem);
  return encode(MEM_CODEC_SCHEMA, { ...m, vocab: m.vocab ?? [] });
}

/** Reads a mem code. Returns null for anything that is not a valid mem. Never throws. */
export function decodeMem(code: string): Mem | null {
  try {
    const v = decode(MEM_CODEC_SCHEMA, code);
    if (v === null) return null;
    const raw = v as Mem;
    return checkMem(quantizeMem(raw));
  } catch {
    return null;
  }
}

const TAIL_MARK = '~';
const TAIL_PREFIX = 'm:';

/** `${presetCode}~m:${memCode}`. Throws if the preset code already has a tail or contains '~'. */
export function attachMem(presetCode: string, mem: Mem): string {
  if (typeof presetCode !== 'string' || presetCode.includes(TAIL_MARK)) throw new Error('the preset code already has a tail or contains "~"');
  return `${presetCode}${TAIL_MARK}${TAIL_PREFIX}${encodeMem(mem)}`;
}

/** Splits a code into the pristine preset code and its memory. No tail or a bad tail gives mem null; the preset part is still returned. */
export function splitMem(code: string): { readonly preset: string; readonly mem: Mem | null } {
  if (typeof code !== 'string') return { preset: '', mem: null };
  const at = code.indexOf(TAIL_MARK);
  if (at < 0) return { preset: code, mem: null };
  const preset = code.slice(0, at);
  const tail = code.slice(at + 1);
  return { preset, mem: tail.startsWith(TAIL_PREFIX) ? decodeMem(tail.slice(TAIL_PREFIX.length)) : null };
}

/** The pristine preset code, without its memory. */
export function stripMem(code: string): string {
  return splitMem(code).preset;
}
