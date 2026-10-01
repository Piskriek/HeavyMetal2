import test from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../src/compile-lite';
import { compile as full } from '../src/compile';

test('lite: strips types and produces CommonJS exports', () => {
  const r = compile('export function update(ctx: { tick: number }): void { const n: number = ctx.tick; void n; }');
  assert.ok(r.ok, JSON.stringify(r.diagnostics));
  assert.ok(!r.js.includes(': number') && /exports\.update|exports\["update"\]/.test(r.js), r.js);
});

test('lite: syntax errors are diagnostics with line and column, never exceptions', () => {
  const r = compile('export function update( {\n');
  assert.equal(r.ok, false);
  assert.equal(r.diagnostics[0]?.severity, 'error');
  assert.ok((r.diagnostics[0]?.line ?? 0) >= 1);
});

test('lite: imports and dynamic imports are banned, with positions', () => {
  const a = compile('import fs from "node:fs";\nexport const x = 1;');
  assert.equal(a.ok, false); assert.equal(a.diagnostics[0]?.line, 1); assert.match(a.diagnostics[0]!.message, /imports/);
  const b = compile('export async function f() { await import("x"); }');
  assert.equal(b.ok, false); assert.match(b.diagnostics[0]!.message, /dynamic import/);
  assert.ok(compile('export const important = 1; const reimport = 2;').ok, 'words that merely contain "import" are fine');
});

test('lite and full agree on what is valid for well-typed scripts (full also catches type errors)', () => {
  const good = 'export function update(ctx: { tick: number }) { return ctx.tick + 1; }';
  assert.equal(compile(good).ok, true);
  assert.equal(full(good).ok, true);
  const bad = 'export function update(ctx: ScriptContext) { const n: number = "x"; void n; void ctx; }';
  assert.equal(compile(bad).ok, true, 'lite does not type-check');
  assert.equal(full(bad).ok, false, 'full does');
});
