import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileExpression } from '../src/expr';
const ev = (s: string, scope = {}, read?: (p: string) => never) => compileExpression(s).evaluate(scope, read as never);
test('expr', () => {
  assert.equal(ev('1+2*3'), 7); assert.equal(ev('2^3^2'), 512); assert.equal(ev('-2^2'), -4); assert.equal(ev('(1+2)*3'), 9);
  assert.equal(ev('1 > 0 ? "yes" : "no"'), 'yes'); assert.equal(ev('true || missing'), true); assert.equal(ev('"a"+"b"'), 'ab');
  assert.equal(ev('clamp(12,0,10)'), 10); assert.equal(ev('lerp(0,10,0.25)'), 2.5); assert.equal(ev('max(a,b)', { a: 3, b: 7 }), 7);
  assert.deepEqual(ev('vec3(1,2,3)'), [1, 2, 3]); assert.equal(ev('10 % 4'), 2); assert.equal(ev('1e3'), 1000); assert.equal(ev('.5'), 0.5);
  const c = compileExpression('$p1.weight * 2 + $p2.grip.rolling'); assert.deepEqual(c.reads, ['p1.weight', 'p2.grip.rolling']);
  assert.equal(c.evaluate({}, ((p: string) => (p === 'p1.weight' ? 4 : 1)) as never), 9);
  assert.equal(compileExpression('$a - 1').evaluate({}, (() => 5) as never), 4);
  for (const bad of ['1 +', 'process.exit(1)', 'while(true){}', 'foo(1)', 'clamp(1)', '"x', 'a = 1']) assert.equal(compileExpression(bad).ok, false, bad);
  assert.equal(compileExpression('1'.repeat(2001)).ok, false);
  assert.equal(compileExpression('('.repeat(60) + '1' + ')'.repeat(60)).ok, false);
  assert.throws(() => ev('1/0'), /zero/); assert.throws(() => ev('sqrt(-1)'), /negative/); assert.throws(() => ev('nope'), /unknown/);
});
