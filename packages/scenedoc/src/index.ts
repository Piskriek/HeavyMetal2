/**
 * @hm/scenedoc - the document model under the Studio.
 *
 * Plain JSON-serialisable data in, plain data out. Nothing is mutated: every
 * exported function returns new state (unchanged parts are shared). No DOM,
 * no Date, no Math.random, no imports.
 *
 * Internally, edits run against a mutable draft that is private to one call;
 * the draft is frozen into a fresh Doc before anything is returned.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type PropType =
  | { readonly kind: 'number'; readonly min?: number; readonly max?: number; readonly default: number }
  | { readonly kind: 'int'; readonly min?: number; readonly max?: number; readonly default: number }
  | { readonly kind: 'bool'; readonly default: boolean }
  | { readonly kind: 'string'; readonly maxLength?: number; readonly default: string }
  | { readonly kind: 'enum'; readonly options: readonly string[]; readonly default: string }
  | { readonly kind: 'vec3'; readonly default: readonly [number, number, number] }
  | { readonly kind: 'color'; readonly default: string }
  | { readonly kind: 'ref'; readonly default: null }
  | { readonly kind: 'json'; readonly default: unknown };

export interface TypeDef {
  readonly type: string;
  readonly version: number;
  readonly props: Readonly<Record<string, PropType>>;
  readonly migrate?: (props: Readonly<Record<string, unknown>>, fromVersion: number) => Record<string, unknown>;
}

export interface Registry {
  readonly types: ReadonlyMap<string, TypeDef>;
}

export interface DocNode {
  readonly id: string;
  readonly type: string;
  readonly name: string;
  readonly parent: string | null;
  readonly children: readonly string[];
  readonly props: Readonly<Record<string, unknown>>;
}

export interface Doc {
  readonly v: 1;
  readonly nextId: number;
  readonly roots: readonly string[];
  readonly nodes: Readonly<Record<string, DocNode>>;
}

export type Op =
  | { readonly op: 'create'; readonly type: string; readonly id?: string; readonly name?: string; readonly parent?: string | null; readonly index?: number; readonly props?: Readonly<Record<string, unknown>> }
  | { readonly op: 'remove'; readonly id: string }
  | { readonly op: 'set'; readonly id: string; readonly props: Readonly<Record<string, unknown>> }
  | { readonly op: 'rename'; readonly id: string; readonly name: string }
  | { readonly op: 'move'; readonly id: string; readonly parent: string | null; readonly index?: number }
  | { readonly op: 'duplicate'; readonly id: string };

export interface Change {
  readonly id: string;
  readonly kind: 'created' | 'removed' | 'changed' | 'moved' | 'renamed';
}

export interface Step {
  readonly label: string;
  readonly mergeKey: string | null;
  readonly at: number;
}

export interface History {
  readonly doc: Doc;
  readonly past: readonly Step[];
  readonly future: readonly Step[];
}

export interface Selection {
  readonly ids: readonly string[];
  readonly primary: string | null;
}

export const MERGE_MS = 500;

/**
 * A history entry is a Step plus the two snapshots and the change list it stands for.
 * Snapshots make undo and redo pointer swaps (O(1)), so they stay fast on big documents.
 * The entries are plain data, so a History still serialises cleanly.
 */
interface Entry extends Step {
  readonly before: Doc;
  readonly after: Doc;
  readonly changes: readonly Change[];
  /** False when the step was run without an `at` stamp. Such steps never merge. */
  readonly timed: boolean;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;
const HAS = Object.prototype.hasOwnProperty;

/** Own-property test. Plain `in` or indexing would accept ids such as "constructor". */
function own(o: object, key: string): boolean {
  return HAS.call(o, key);
}

function fail(why: string): never {
  throw new Error(why);
}

function isObj(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function isStrArray(x: unknown): x is string[] {
  return Array.isArray(x) && (x as readonly unknown[]).every((e) => typeof e === 'string');
}

function lastOf<T>(xs: readonly T[]): T | undefined {
  return xs[xs.length - 1];
}

function dedupe(xs: readonly string[]): string[] {
  return [...new Set(xs)];
}

function docNode(doc: Doc, id: string): DocNode | undefined {
  return own(doc.nodes, id) ? doc.nodes[id] : undefined;
}

/** Deep copy of a JSON-like value. Uses fromEntries so a "__proto__" key stays an ordinary key. */
function cloneJson(v: unknown): unknown {
  if (Array.isArray(v)) return (v as readonly unknown[]).map((e) => cloneJson(e));
  if (isObj(v)) {
    const o: Record<string, unknown> = v;
    return Object.fromEntries(Object.keys(o).map((k): [string, unknown] => [k, cloneJson(o[k])]));
  }
  return v;
}

function isJson(v: unknown, depth = 0): boolean {
  if (depth > 256) return false;
  if (v === null || typeof v === 'string' || typeof v === 'boolean') return true;
  if (typeof v === 'number') return Number.isFinite(v);
  if (Array.isArray(v)) {
    const a = v as readonly unknown[];
    for (let i = 0; i < a.length; i++) {
      if (!(i in a) || !isJson(a[i], depth + 1)) return false;
    }
    return true;
  }
  if (isObj(v)) {
    const proto = Object.getPrototypeOf(v) as unknown;
    if (proto !== Object.prototype && proto !== null) return false;
    for (const k of Object.keys(v)) {
      if (!isJson(v[k], depth + 1)) return false;
    }
    return true;
  }
  return false;
}

function outOfRange(v: number, min: number | undefined, max: number | undefined): boolean {
  return (min !== undefined && v < min) || (max !== undefined && v > max);
}

/** Returns null when `v` is a valid value for `pt`, otherwise the reason it is not. */
function valueError(pt: PropType, v: unknown, exists: (id: string) => boolean): string | null {
  switch (pt.kind) {
    case 'number':
      if (typeof v !== 'number' || !Number.isFinite(v)) return 'expected a finite number';
      return outOfRange(v, pt.min, pt.max) ? `expected a number in [${pt.min ?? '-inf'}, ${pt.max ?? 'inf'}]` : null;
    case 'int':
      if (typeof v !== 'number' || !Number.isInteger(v)) return 'expected an integer';
      return outOfRange(v, pt.min, pt.max) ? `expected an integer in [${pt.min ?? '-inf'}, ${pt.max ?? 'inf'}]` : null;
    case 'bool':
      return typeof v === 'boolean' ? null : 'expected true or false';
    case 'string':
      if (typeof v !== 'string') return 'expected a string';
      return pt.maxLength !== undefined && v.length > pt.maxLength ? `expected at most ${pt.maxLength} characters` : null;
    case 'enum':
      return typeof v === 'string' && pt.options.includes(v) ? null : `expected one of: ${pt.options.join(', ')}`;
    case 'vec3': {
      if (!Array.isArray(v) || v.length !== 3) return 'expected [x, y, z]';
      const a = v as readonly unknown[];
      for (let i = 0; i < 3; i++) {
        const c = a[i];
        if (typeof c !== 'number' || !Number.isFinite(c)) return 'expected three finite numbers';
      }
      return null;
    }
    case 'color':
      return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? null : 'expected a colour like #rrggbb';
    case 'ref':
      if (v === null) return null;
      return typeof v === 'string' && exists(v) ? null : 'expected null or the id of an existing node';
    case 'json':
      return isJson(v) ? null : 'expected a JSON value';
  }
}

// ---------------------------------------------------------------------------
// Registry and empty document
// ---------------------------------------------------------------------------

export function createRegistry(defs: readonly TypeDef[]): Registry {
  const types = new Map<string, TypeDef>();
  for (const def of defs) {
    if (typeof def.type !== 'string' || def.type === '' || def.type === '__proto__') {
      fail(`bad type name "${String(def.type)}"`);
    }
    if (!Number.isInteger(def.version) || def.version < 1) {
      fail(`type "${def.type}": version must be an integer >= 1`);
    }
    if (types.has(def.type)) fail(`duplicate type "${def.type}"`);
    for (const [key, pt] of Object.entries(def.props)) {
      if (key === '' || key === '__proto__') fail(`type "${def.type}": bad prop name "${key}"`);
      const err = valueError(pt, pt.default, () => false);
      if (err !== null) fail(`type "${def.type}", prop "${key}": its default ${err}`);
    }
    types.set(def.type, def);
  }
  return { types };
}

export function emptyDoc(): Doc {
  return { v: 1, nextId: 1, roots: [], nodes: {} };
}

// ---------------------------------------------------------------------------
// Draft: a private, mutable working copy used while one call runs
// ---------------------------------------------------------------------------

interface WNode {
  id: string;
  type: string;
  name: string;
  parent: string | null;
  children: string[];
  props: Record<string, unknown>;
}

interface Draft {
  readonly reg: Registry;
  readonly nodes: Map<string, WNode>;
  roots: string[];
  rootsOwned: boolean;
  /** Ids whose children array was copied in this draft, so it may be edited in place. */
  readonly owned: Set<string>;
  nextId: number;
  readonly changes: Change[];
  readonly seen: Set<string>;
  readonly created: string[];
}

function toDraft(reg: Registry, doc: Doc): Draft {
  const nodes = new Map<string, WNode>();
  for (const [id, n] of Object.entries(doc.nodes)) nodes.set(id, n as WNode);
  return {
    reg,
    nodes,
    roots: doc.roots as string[],
    rootsOwned: false,
    owned: new Set<string>(),
    nextId: doc.nextId,
    changes: [],
    seen: new Set<string>(),
    created: [],
  };
}

function finish(d: Draft): Doc {
  return { v: 1, nextId: d.nextId, roots: d.roots, nodes: Object.fromEntries(d.nodes) };
}

function note(d: Draft, id: string, kind: Change['kind']): void {
  const key = kind + ' ' + id;
  if (d.seen.has(key)) return;
  d.seen.add(key);
  d.changes.push({ id, kind });
}

function need(d: Draft, id: string): WNode {
  const n = d.nodes.get(id);
  if (n === undefined) fail(`no node "${id}"`);
  return n;
}

function freshId(d: Draft): string {
  while (d.nodes.has('n' + d.nextId)) d.nextId++;
  const id = 'n' + d.nextId;
  d.nextId++;
  return id;
}

function rootList(d: Draft): string[] {
  if (!d.rootsOwned) {
    d.roots = d.roots.slice();
    d.rootsOwned = true;
  }
  return d.roots;
}

function childList(d: Draft, id: string): string[] {
  const n = need(d, id);
  if (d.owned.has(id)) return n.children;
  const copy: WNode = { ...n, children: n.children.slice() };
  d.nodes.set(id, copy);
  d.owned.add(id);
  return copy.children;
}

function listOf(d: Draft, parent: string | null): string[] {
  return parent === null ? rootList(d) : childList(d, parent);
}

function insertAt(d: Draft, parent: string | null, id: string, index: number | undefined): void {
  const list = listOf(d, parent);
  const at = index ?? list.length;
  if (!Number.isInteger(at) || at < 0 || at > list.length) {
    fail(`index ${String(index)} is out of range for ${list.length} children`);
  }
  list.splice(at, 0, id);
}

function detach(d: Draft, id: string, parent: string | null): void {
  const list = listOf(d, parent);
  const i = list.indexOf(id);
  if (i < 0) fail(`corrupt tree: "${id}" is not listed under its parent`);
  list.splice(i, 1);
}

/** Checks and applies a prop map onto `target`. Each value is validated and copied. */
function applyProps(d: Draft, def: TypeDef, target: Record<string, unknown>, given: unknown): void {
  if (!isObj(given)) fail('props must be an object');
  for (const key of Object.keys(given)) {
    const pt = own(def.props, key) ? def.props[key] : undefined;
    if (pt === undefined) fail(`unknown prop "${key}" on type "${def.type}"`);
    const v = given[key];
    const err = valueError(pt, v, (id) => d.nodes.has(id));
    if (err !== null) fail(`prop "${key}": ${err}`);
    target[key] = cloneJson(v);
  }
}

type OpOf<K extends Op['op']> = Extract<Op, { readonly op: K }>;

function applyOp(d: Draft, op: Op): void {
  switch (op.op) {
    case 'create':
      doCreate(d, op);
      return;
    case 'remove':
      doRemove(d, op.id);
      return;
    case 'set':
      doSet(d, op.id, op.props);
      return;
    case 'rename':
      doRename(d, op.id, op.name);
      return;
    case 'move':
      doMove(d, op.id, op.parent, op.index);
      return;
    case 'duplicate':
      doDuplicate(d, op.id);
      return;
    default:
      fail('unknown operation');
  }
}

function doCreate(d: Draft, op: OpOf<'create'>): void {
  const def = d.reg.types.get(op.type) ?? fail(`unknown type "${op.type}"`);
  let id: string;
  if (op.id !== undefined) {
    if (!ID_RE.test(op.id)) fail(`bad id "${op.id}": use 1 to 40 letters, digits, "_" or "-"`);
    if (d.nodes.has(op.id)) fail(`id "${op.id}" already exists`);
    id = op.id;
  } else {
    id = freshId(d);
  }
  const parent = op.parent ?? null;
  if (parent !== null && !d.nodes.has(parent)) fail(`no parent "${parent}"`);
  if (op.name !== undefined && typeof op.name !== 'string') fail('name must be a string');
  const props: Record<string, unknown> = {};
  for (const [key, pt] of Object.entries(def.props)) props[key] = cloneJson(pt.default);
  if (op.props !== undefined) applyProps(d, def, props, op.props);
  d.nodes.set(id, { id, type: def.type, name: op.name ?? def.type, parent, children: [], props });
  insertAt(d, parent, id, op.index);
  d.created.push(id);
  note(d, id, 'created');
  if (parent !== null) note(d, parent, 'changed');
}

function doRemove(d: Draft, id: string): void {
  const n = need(d, id);
  const gone: string[] = [];
  const stack: string[] = [id];
  while (stack.length > 0) {
    const x = stack.pop()!;
    gone.push(x);
    const cur = d.nodes.get(x);
    if (cur !== undefined) for (const c of cur.children) stack.push(c);
  }
  const goneSet = new Set(gone);
  detach(d, id, n.parent);
  for (const x of gone) {
    d.nodes.delete(x);
    note(d, x, 'removed');
  }
  // Refs that pointed into the removed subtree become null.
  const updates: [string, WNode][] = [];
  for (const [k, m] of d.nodes) {
    const def = d.reg.types.get(m.type);
    if (def === undefined) continue;
    let props: Record<string, unknown> | null = null;
    for (const [key, pt] of Object.entries(def.props)) {
      if (pt.kind !== 'ref') continue;
      const v = m.props[key];
      if (typeof v === 'string' && goneSet.has(v)) {
        if (props === null) props = { ...m.props };
        props[key] = null;
      }
    }
    if (props !== null) updates.push([k, { ...m, props }]);
  }
  for (const [k, m] of updates) {
    d.nodes.set(k, m);
    note(d, k, 'changed');
  }
  if (n.parent !== null) note(d, n.parent, 'changed');
}

function doSet(d: Draft, id: string, given: unknown): void {
  const n = need(d, id);
  const def = d.reg.types.get(n.type) ?? fail(`unknown type "${n.type}"`);
  const props: Record<string, unknown> = { ...n.props };
  applyProps(d, def, props, given);
  d.nodes.set(id, { ...n, props });
  note(d, id, 'changed');
}

function doRename(d: Draft, id: string, name: unknown): void {
  const n = need(d, id);
  if (typeof name !== 'string') fail('name must be a string');
  d.nodes.set(id, { ...n, name });
  note(d, id, 'renamed');
}

function doMove(d: Draft, id: string, parentArg: string | null, index: number | undefined): void {
  const n = need(d, id);
  const target = parentArg ?? null;
  if (target !== null) {
    if (!d.nodes.has(target)) fail(`no parent "${target}"`);
    let cur: string | null = target;
    while (cur !== null) {
      if (cur === id) fail('a node cannot be moved into itself or into its descendants');
      cur = d.nodes.get(cur)?.parent ?? null;
    }
  }
  detach(d, id, n.parent);
  d.nodes.set(id, { ...n, parent: target });
  insertAt(d, target, id, index);
  note(d, id, 'moved');
  if (n.parent !== null) note(d, n.parent, 'changed');
  if (target !== null) note(d, target, 'changed');
}

function doDuplicate(d: Draft, id: string): void {
  const src = need(d, id);
  // Preorder of the subtree, so every copy id is allocated in a fixed order.
  const order: string[] = [];
  const stack: string[] = [id];
  while (stack.length > 0) {
    const x = stack.pop()!;
    order.push(x);
    const cur = need(d, x);
    for (let i = cur.children.length - 1; i >= 0; i--) stack.push(cur.children[i]!);
  }
  const copies = new Map<string, string>();
  for (const x of order) copies.set(x, freshId(d));
  for (const x of order) {
    const cur = need(d, x);
    const def = d.reg.types.get(cur.type);
    const props: Record<string, unknown> = {};
    for (const key of Object.keys(cur.props)) {
      const pt = def !== undefined && own(def.props, key) ? def.props[key] : undefined;
      let v = cur.props[key];
      // A ref inside the subtree points at the copy; a ref outside is kept as it is.
      if (pt?.kind === 'ref' && typeof v === 'string') v = copies.get(v) ?? v;
      props[key] = cloneJson(v);
    }
    const newId = copies.get(x) ?? fail('internal: missing copy id');
    let parent: string | null = src.parent;
    if (x !== id) parent = cur.parent === null ? null : (copies.get(cur.parent) ?? null);
    d.nodes.set(newId, {
      id: newId,
      type: cur.type,
      name: cur.name,
      parent,
      children: cur.children.map((c) => copies.get(c) ?? c),
      props,
    });
    d.created.push(newId);
    note(d, newId, 'created');
  }
  const topId = copies.get(id) ?? fail('internal: missing copy id');
  const list = listOf(d, src.parent);
  const at = list.indexOf(id);
  if (at < 0) fail('corrupt tree');
  list.splice(at + 1, 0, topId);
  if (src.parent !== null) note(d, src.parent, 'changed');
}

// ---------------------------------------------------------------------------
// Checking and applying single operations
// ---------------------------------------------------------------------------

export function check(reg: Registry, doc: Doc, op: Op): { readonly ok: boolean; readonly why: string } {
  try {
    applyOp(toDraft(reg, doc), op);
    return { ok: true, why: '' };
  } catch (e) {
    return { ok: false, why: e instanceof Error ? e.message : String(e) };
  }
}

export function apply(
  reg: Registry,
  doc: Doc,
  op: Op,
): { readonly doc: Doc; readonly changes: readonly Change[]; readonly created: readonly string[] } {
  const d = toDraft(reg, doc);
  applyOp(d, op);
  return { doc: finish(d), changes: d.changes, created: d.created };
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

const FLIP: Readonly<Record<Change['kind'], Change['kind']>> = {
  created: 'removed',
  removed: 'created',
  changed: 'changed',
  moved: 'moved',
  renamed: 'renamed',
};

function unionChanges(a: readonly Change[], b: readonly Change[]): readonly Change[] {
  const seen = new Set<string>();
  const out: Change[] = [];
  for (const c of [...a, ...b]) {
    const key = c.kind + ' ' + c.id;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(c);
    }
  }
  return out;
}

export function createHistory(doc: Doc): History {
  return { doc, past: [], future: [] };
}

/**
 * Runs `ops` as one undo step. All or nothing: if any op fails this throws and
 * `h` is untouched. A step merges into the previous one when both have the same
 * non-null mergeKey and their `at` times are within MERGE_MS. A step run without
 * an `at` stamp is stored with at = 0 and never merges, in either direction.
 */
export function run(
  reg: Registry,
  h: History,
  label: string,
  ops: readonly Op[],
  o?: { readonly mergeKey?: string; readonly at?: number },
): { readonly history: History; readonly changes: readonly Change[] } {
  if (ops.length === 0) return { history: h, changes: [] };
  const d = toDraft(reg, h.doc);
  for (const op of ops) applyOp(d, op);
  const doc = finish(d);
  const mergeKey = o?.mergeKey ?? null;
  const at = o?.at;
  const prev = lastOf(h.past) as Entry | undefined;
  let past: Step[];
  if (prev !== undefined && prev.timed && at !== undefined && mergeKey !== null && prev.mergeKey === mergeKey && Math.abs(at - prev.at) <= MERGE_MS) {
    const merged: Entry = {
      label: prev.label,
      mergeKey,
      at,
      before: prev.before,
      after: doc,
      changes: unionChanges(prev.changes, d.changes),
      timed: true,
    };
    past = [...h.past.slice(0, -1), merged];
  } else {
    const entry: Entry = {
      label,
      mergeKey,
      at: at ?? 0,
      before: h.doc,
      after: doc,
      changes: d.changes,
      timed: at !== undefined,
    };
    past = [...h.past, entry];
  }
  return { history: { doc, past, future: [] }, changes: d.changes };
}

export function undo(_reg: Registry, h: History): { readonly history: History; readonly changes: readonly Change[] } {
  const top = lastOf(h.past) as Entry | undefined;
  if (top === undefined) return { history: h, changes: [] };
  return {
    history: { doc: top.before, past: h.past.slice(0, -1), future: [...h.future, top] },
    changes: top.changes.map((c) => ({ id: c.id, kind: FLIP[c.kind] })),
  };
}

export function redo(_reg: Registry, h: History): { readonly history: History; readonly changes: readonly Change[] } {
  const top = lastOf(h.future) as Entry | undefined;
  if (top === undefined) return { history: h, changes: [] };
  return {
    history: { doc: top.after, past: [...h.past, top], future: h.future.slice(0, -1) },
    changes: top.changes,
  };
}

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

export function select(
  doc: Doc,
  sel: Selection,
  ids: readonly string[],
  mode: 'replace' | 'add' | 'toggle' | 'remove',
): Selection {
  const inDoc = (id: string): boolean => own(doc.nodes, id);
  const given = dedupe(ids.filter(inDoc));
  let list = dedupe(sel.ids.filter(inDoc));
  let primary: string | null = sel.primary;
  if (mode === 'replace') {
    list = given;
    primary = lastOf(given) ?? null;
  } else {
    for (const id of given) {
      const i = list.indexOf(id);
      if (mode === 'remove' || (mode === 'toggle' && i >= 0)) {
        if (i >= 0) list.splice(i, 1);
      } else if (i < 0) {
        list.push(id);
        primary = id;
      }
    }
  }
  if (primary === null || !list.includes(primary)) primary = lastOf(list) ?? null;
  return { ids: list, primary };
}

export function prune(doc: Doc, sel: Selection): Selection {
  const list = dedupe(sel.ids.filter((id) => own(doc.nodes, id)));
  const primary = sel.primary !== null && list.includes(sel.primary) ? sel.primary : (lastOf(list) ?? null);
  return { ids: list, primary };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Depth-first, pre-order walk over the given start ids and everything under them. */
function preorderFrom(doc: Doc, start: readonly string[]): string[] {
  const out: string[] = [];
  const stack: string[] = [];
  for (let i = start.length - 1; i >= 0; i--) stack.push(start[i]!);
  while (stack.length > 0) {
    const id = stack.pop()!;
    out.push(id);
    const n = docNode(doc, id);
    if (n !== undefined) {
      for (let i = n.children.length - 1; i >= 0; i--) stack.push(n.children[i]!);
    }
  }
  return out;
}

export function path(doc: Doc, id: string): readonly string[] {
  const out: string[] = [];
  let cur: string | null = id;
  while (cur !== null) {
    const n = docNode(doc, cur);
    if (n === undefined) return [];
    out.push(cur);
    cur = n.parent;
  }
  return out.reverse();
}

export function descendants(doc: Doc, id: string): readonly string[] {
  const n = docNode(doc, id);
  if (n === undefined) return [];
  return preorderFrom(doc, n.children);
}

export function findByType(doc: Doc, type: string): readonly string[] {
  return preorderFrom(doc, doc.roots).filter((id) => docNode(doc, id)?.type === type);
}

// ---------------------------------------------------------------------------
// Save and load
// ---------------------------------------------------------------------------

export function save(reg: Registry, doc: Doc): unknown {
  const versions = new Map<string, number>();
  const nodes = Object.fromEntries(
    Object.entries(doc.nodes).map(([id, n]): [string, unknown] => {
      const def = reg.types.get(n.type) ?? fail(`unknown type "${n.type}"`);
      versions.set(n.type, def.version);
      return [
        id,
        {
          id: n.id,
          type: n.type,
          name: n.name,
          parent: n.parent,
          children: [...n.children],
          props: cloneJson(n.props),
        },
      ];
    }),
  );
  return {
    v: 1,
    nextId: doc.nextId,
    roots: [...doc.roots],
    nodes,
    types: Object.fromEntries(versions),
  };
}

/**
 * Loads a save. Returns null for anything that is not a valid document after
 * migration. Nodes saved at an older type version go through `migrate`, then get
 * defaults for missing props, and props the type does not have are dropped.
 */
export function load(reg: Registry, json: unknown): { readonly doc: Doc; readonly migrated: number } | null {
  if (!isObj(json) || json['v'] !== 1) return null;
  const nextId = json['nextId'];
  const rootsRaw = json['roots'];
  const typesRaw = json['types'];
  const nodesRaw = json['nodes'];
  if (typeof nextId !== 'number' || !Number.isSafeInteger(nextId) || nextId < 1) return null;
  if (!isStrArray(rootsRaw) || !isObj(typesRaw) || !isObj(nodesRaw)) return null;

  const parsed = new Map<string, WNode>();
  let migrated = 0;
  for (const id of Object.keys(nodesRaw)) {
    const raw = nodesRaw[id];
    if (!ID_RE.test(id) || !isObj(raw) || raw['id'] !== id) return null;
    const type = raw['type'];
    const name = raw['name'];
    const rawParent = raw['parent'];
    const children = raw['children'];
    const rawProps = raw['props'];
    if (
      typeof type !== 'string' ||
      typeof name !== 'string' ||
      (rawParent !== null && typeof rawParent !== 'string') ||
      !isStrArray(children) ||
      !isObj(rawProps)
    ) {
      return null;
    }
    const def = reg.types.get(type);
    const savedV = own(typesRaw, type) ? typesRaw[type] : undefined;
    if (def === undefined || typeof savedV !== 'number' || !Number.isSafeInteger(savedV) || savedV < 1 || savedV > def.version) {
      return null;
    }
    const parent: string | null = typeof rawParent === 'string' ? rawParent : null;

    let saved: Record<string, unknown> = { ...rawProps };
    if (savedV < def.version) {
      migrated++;
      if (def.migrate !== undefined) {
        let out: unknown = undefined;
        try {
          out = def.migrate({ ...rawProps }, savedV);
        } catch {
          return null;
        }
        if (!isObj(out)) return null;
        saved = out;
      }
    }
    const props: Record<string, unknown> = {};
    for (const [key, pt] of Object.entries(def.props)) {
      props[key] = cloneJson(own(saved, key) ? saved[key] : pt.default);
    }
    parsed.set(id, { id, type, name, parent, children: children.slice(), props });
  }

  // Every prop must be valid; refs must name nodes that exist.
  const exists = (id: string): boolean => parsed.has(id);
  for (const n of parsed.values()) {
    const def = reg.types.get(n.type);
    if (def === undefined) return null;
    for (const [key, pt] of Object.entries(def.props)) {
      if (valueError(pt, n.props[key], exists) !== null) return null;
    }
  }

  // Links: each node is listed exactly once, as a root or as a child of its parent.
  const roots = rootsRaw.slice();
  const listed = new Set<string>();
  for (const r of roots) {
    const n = parsed.get(r);
    if (n === undefined || n.parent !== null || listed.has(r)) return null;
    listed.add(r);
  }
  for (const n of parsed.values()) {
    for (const c of n.children) {
      const cn = parsed.get(c);
      if (cn === undefined || cn.parent !== n.id || listed.has(c)) return null;
      listed.add(c);
    }
  }
  if (listed.size !== parsed.size) return null;
  // Everything must be reachable from the roots, which rules out cycles.
  const reached = new Set<string>();
  const stack = [...roots];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (reached.has(id)) return null;
    reached.add(id);
    const n = parsed.get(id);
    if (n !== undefined) for (const c of n.children) stack.push(c);
  }
  if (reached.size !== parsed.size) return null;

  return { doc: { v: 1, nextId, roots, nodes: Object.fromEntries(parsed) }, migrated };
}
