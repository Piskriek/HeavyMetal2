/**
 * T2 acceptance: compile + sandbox + live reload of preset scripts.
 * Script authoring convention (YOU define the compiler side, tests fix the surface): a script is a TypeScript module whose
 * named exports are the members of its interface (`export function update(ctx) {...}`). `ScriptContext`, `Mechanic`, `Rule`
 * are ambient types (no imports needed or allowed). Scripts have NO access to the host: see ScriptContext in contracts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCRIPT_API_VERSION, SCRIPT_INTERFACES, type Preset, type ScriptContext, type Value } from '@hm/contracts';
import { createScriptHost } from '@hm/script';

const preset = (source: string, id = 's1'): Preset => ({
  id, kind: 'mechanic', name: 'T', revision: 1, hash: 'h', params: { power: 3 }, children: {}, tags: [], tier: 'pro',
  script: { language: 'ts', source, apiVersion: SCRIPT_API_VERSION }, meta: { createdAt: 0 },
});

function makeCtx(over: Partial<ScriptContext> = {}): ScriptContext & { writes: unknown[]; emitted: unknown[]; logs: unknown[] } {
  const writes: unknown[] = [], emitted: unknown[] = [], logs: unknown[] = [];
  let r = 0;
  const base: ScriptContext = {
    self: { id: 's1', params: { power: 3 } }, tick: 7, dt: 1 / 120,
    rng: {
      next: () => (r = (r + 0.25) % 1), int: (a: number) => a, pick: <T>(x: readonly T[]) => x[0] as T,
      fork: () => makeCtx().rng, state: () => [r], restore: () => undefined,
    },
    vars: { read: () => 1, write: () => undefined, evaluate: () => 0 },
    world: { query: () => [1, 2], get: () => ({ x: 1 }), has: () => true, alive: () => true, getResource: () => null, presetOf: () => undefined },
    set: (e: number, c: string, v: Readonly<Record<string, Value>>) => { writes.push([e, c, v]); },
    spawn: () => 1, despawn: () => undefined,
    emit: (n: string, p?: Value) => { emitted.push([n, p]); },
    log: (...p: Value[]) => { logs.push(p); },
  };
  return Object.assign(base, over, { writes, emitted, logs });
}

test('compile: valid TypeScript compiles to JavaScript', () => {
  const host = createScriptHost();
  const r = host.compile('export function update(ctx: ScriptContext): void { ctx.emit("hi", ctx.tick); }');
  assert.equal(r.ok, true, JSON.stringify(r.diagnostics));
  assert.ok(r.js.length > 0);
  host.dispose();
});

test('compile: syntax errors and type errors are DIAGNOSTICS with line/column, never exceptions', () => {
  const host = createScriptHost();
  const syntax = host.compile('export function update( {');
  assert.equal(syntax.ok, false); assert.equal(syntax.js, '');
  assert.ok(syntax.diagnostics[0]!.line >= 1 && syntax.diagnostics[0]!.column >= 1);
  const type = host.compile('export function update(ctx: ScriptContext) {\n  const n: number = "x";\n  ctx.nothing();\n}');
  assert.equal(type.ok, false);
  assert.ok(type.diagnostics.some((d) => d.line === 2), JSON.stringify(type.diagnostics));
  assert.ok(type.diagnostics.some((d) => d.line === 3), 'unknown members of ctx are type errors');
  host.dispose();
});

test('compile: imports, require, eval and the host globals are refused at compile time', () => {
  const host = createScriptHost();
  for (const src of [
    'import fs from "fs"; export function update() {}',
    'export function update() { const x = require("fs"); }',
    'export function update() { eval("1"); }',
    'export function update() { window.alert(1); }',
    'export function update() { fetch("http://x"); }',
    'export function update() { new Function("return 1")(); }',
  ]) {
    assert.equal(host.compile(src).ok, false, src);
  }
  host.dispose();
});

test('load + call: a Mechanic reads ctx and writes through ctx.set; members are optional', () => {
  const host = createScriptHost();
  const s = host.load(preset('export function update(ctx: ScriptContext) { for (const e of ctx.world.query("pos")) ctx.set(e, "pos", { x: ctx.tick * Number(ctx.self.params.power) }); ctx.emit("done", ctx.tick); }'), 'Mechanic');
  const ctx = makeCtx();
  const out = host.call(s, 'update', ctx);
  assert.equal(out.ok, true, out.error);
  assert.deepEqual(ctx.writes, [[1, 'pos', { x: 21 }], [2, 'pos', { x: 21 }]]);
  assert.deepEqual(ctx.emitted, [['done', 7]]);
  assert.equal(host.call(s, 'init', ctx).ok, true, 'a member the script does not export is a no-op');
  assert.equal(host.call(s, 'notAMember', ctx).ok, false, 'a member outside the interface is refused');
  host.dispose();
});

test('load: unknown interface or compile error throws; every SCRIPT_INTERFACES key loads', () => {
  const host = createScriptHost();
  assert.throws(() => host.load(preset('export function update() {}'), 'Nope'));
  assert.throws(() => host.load(preset('export function update( {'), 'Mechanic'), /./);
  for (const k of Object.keys(SCRIPT_INTERFACES)) assert.doesNotThrow(() => host.load(preset('export {};'), k));
  host.dispose();
});

test('sandbox: no host objects, no Date, no Math.random, no timers, no escape through constructors', () => {
  const host = createScriptHost();
  const probe = (body: string, member = 'evaluate') => {
    // type-check is bypassed on purpose with casts: the RUNTIME must still be sealed
    const s = host.load(preset(`export function ${member}(ctx: ScriptContext): any { ${body} }`), 'Rule');
    return host.call(s, member, makeCtx());
  };
  assert.equal(probe('return typeof (globalThis as any).process;').value, 'undefined');
  assert.equal(probe('return typeof (globalThis as any).window;').value, 'undefined');
  assert.equal(probe('return typeof (globalThis as any).document;').value, 'undefined');
  assert.equal(probe('return typeof (globalThis as any).require;').value, 'undefined');
  assert.equal(probe('return Math.random();').ok, false, 'Math.random must be unavailable (use ctx.rng)');
  assert.equal(probe('return Date.now();').ok, false, 'Date must be unavailable (use ctx.tick)');
  assert.equal(probe('return (new (Date as any)()).getTime();').ok, false);
  assert.equal(probe('return typeof (globalThis as any).setTimeout;').value, 'undefined');
  const escape = probe('return (function(){}).constructor("return typeof process")();');
  assert.ok(!escape.ok || escape.value === 'undefined', 'the Function constructor must not reach host globals');
  const proto = probe('return (({}) as any).constructor.constructor("return typeof process")();');
  assert.ok(!proto.ok || proto.value === 'undefined');
  host.dispose();
});

test('sandbox: scripts cannot change the host (frozen builtins, no shared state between scripts)', () => {
  const host = createScriptHost();
  const a = host.load(preset('let n = 0; export function evaluate(): number { return ++n; }', 'a'), 'Rule');
  const b = host.load(preset('let n = 0; export function evaluate(): number { return ++n; }', 'b'), 'Rule');
  const ctx = makeCtx();
  assert.equal(host.call(a, 'evaluate', ctx).value, 1);
  assert.equal(host.call(a, 'evaluate', ctx).value, 2);
  assert.equal(host.call(b, 'evaluate', ctx).value, 1, 'each script has its own state');
  const tamper = host.load(preset('export function evaluate(): any { try { (Array.prototype as any).evil = 1; (Object as any).prototype.evil = 1; } catch (e) {} return 0; }', 't'), 'Rule');
  host.call(tamper, 'evaluate', ctx);
  assert.equal(({} as Record<string, unknown>)['evil'], undefined, 'the host\'s Object.prototype is untouched');
  assert.equal((Array.prototype as unknown as Record<string, unknown>)['evil'], undefined);
  host.dispose();
});

test('limits: an infinite loop is stopped, the script is marked faulted, and the host survives', () => {
  const host = createScriptHost({ limits: { callBudgetMs: 100, opBudget: 200_000 } });
  const s = host.load(preset('export function update() { while (true) {} }'), 'Mechanic');
  const t0 = Date.now();
  const out = host.call(s, 'update', makeCtx());
  assert.equal(out.ok, false);
  assert.match(String(out.error), /budget|limit|too long|loop/i);
  assert.ok(Date.now() - t0 < 3000, 'stopped promptly');
  assert.equal(s.faulted, true);
  const again = host.call(s, 'update', makeCtx());
  assert.equal(again.ok, false);
  assert.match(String(again.error), /fault/i, 'a faulted script is skipped until reloaded');
  host.dispose();
});

test('limits: the op budget is deterministic (same script, same count, on any machine)', () => {
  const host = createScriptHost({ limits: { callBudgetMs: 10_000, opBudget: 5_000 } });
  const src = (n: number) => `export function evaluate(): number { let s = 0; for (let i = 0; i < ${n}; i++) { s += i; } return s; }`;
  assert.equal(host.call(host.load(preset(src(1000)), 'Rule'), 'evaluate', makeCtx()).ok, true);
  assert.equal(host.call(host.load(preset(src(1_000_000)), 'Rule'), 'evaluate', makeCtx()).ok, false);
  host.dispose();
});

test('errors: a throwing script returns the error, faults, and never propagates', () => {
  const host = createScriptHost();
  const s = host.load(preset('export function update() { throw new Error("boom"); }'), 'Mechanic');
  const out = host.call(s, 'update', makeCtx());
  assert.equal(out.ok, false); assert.match(String(out.error), /boom/);
  assert.equal(s.faulted, true); assert.match(String(s.lastError), /boom/);
  host.dispose();
});

test('reload: live editing swaps behaviour, clears a fault, keeps state isolated', () => {
  const host = createScriptHost();
  const s = host.load(preset('export function evaluate(): number { return 1; }'), 'Rule');
  assert.equal(host.call(s, 'evaluate', makeCtx()).value, 1);
  const s2 = host.reload(s, { language: 'ts', source: 'export function evaluate(): number { return 2; }', apiVersion: SCRIPT_API_VERSION });
  assert.equal(host.call(s2, 'evaluate', makeCtx()).value, 2);
  const broken = host.load(preset('export function evaluate(): number { throw 1 as any; }'), 'Rule');
  host.call(broken, 'evaluate', makeCtx());
  assert.equal(broken.faulted, true);
  const fixed = host.reload(broken, { language: 'ts', source: 'export function evaluate(): number { return 5; }', apiVersion: SCRIPT_API_VERSION });
  assert.equal(fixed.faulted, false);
  assert.equal(host.call(fixed, 'evaluate', makeCtx()).value, 5);
  assert.throws(() => host.reload(s, { language: 'ts', source: 'export function evaluate( {', apiVersion: SCRIPT_API_VERSION }), 'a reload with a compile error throws and the old script keeps working');
  assert.equal(host.call(s2, 'evaluate', makeCtx()).value, 2);
  host.dispose();
});

test('determinism: the same script with the same context gives the same output every time', () => {
  const host = createScriptHost();
  const src = 'export function evaluate(ctx: ScriptContext): number { let s = 0; for (let i = 0; i < 10; i++) s += ctx.rng.next(); return s; }';
  const run = () => host.call(host.load(preset(src), 'Rule'), 'evaluate', makeCtx()).value as Value;
  assert.equal(run(), run());
  host.dispose();
});

test('typings: the editor gets the .d.ts of ScriptContext and the chosen interface', () => {
  const host = createScriptHost();
  const t = host.typings('Mechanic');
  assert.match(t, /interface ScriptContext/);
  assert.match(t, /update/);
  assert.match(t, /rng/);
  assert.doesNotMatch(t, /\bwindow\b/);
  host.dispose();
});
