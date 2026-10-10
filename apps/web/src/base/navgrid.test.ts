import test from 'node:test';
import assert from 'node:assert/strict';
import { shortestPath } from '@hm/navpath';
import * as S from '@hm/structure';
import { navFor } from './navgrid';

const env: S.Env = { heightAt: () => 0, materials: { reg: { vKeep: 0.9, hKeep: 0.6 } } };
/** One sealed cell (four walls, an airlock on +z) on a structure turned by `yaw`, its centre at (10, 10). */
function hut(yaw: number, open: boolean): S.Base {
  let b = S.found(S.empty(), env, 10, 10, yaw, 'reg').base; const s = b.structures[0]!.id;
  for (const p of [{ kind: 'wall', i: 0, j: 0, r: 0 }, { kind: 'wall', i: 0, j: 0, r: 1 }, { kind: 'wall', i: 1, j: 0, r: 1 }, { kind: 'airlock', i: 0, j: 1, r: 0 }] as const) {
    const r = S.place(b, env, { s, kind: p.kind, i: p.i, j: p.j, k: 0, r: p.r, mat: 'reg' }); assert.ok(r.ok, r.why); b = r.base;
  }
  return open ? S.setOpen(b, b.pieces.find((p) => p.kind === 'airlock')!.id, true) : b;
}
const cellOf = (nav: ReturnType<typeof navFor>, x: number, z: number): [number, number] => [(x - nav.originX) / nav.cell, (z - nav.originZ) / nav.cell];

test('a shut hut keeps mobs out at any angle; an open airlock lets them in', () => {
  for (const yaw of [0, 0.3, 0.7853981634, 1.2, -2.5]) {
    const shut = navFor(hut(yaw, false), { x: 10, z: 10 }, 16), open = navFor(hut(yaw, true), { x: 10, z: 10 }, 16);
    const outside = cellOf(shut, 10 + 7, 10 + 7), inside = cellOf(shut, 10, 10);
    assert.equal(shortestPath(shut.grid, outside, inside), null, `yaw ${yaw}: got into a sealed hut`);
    const path = shortestPath(open.grid, outside, inside);
    assert.ok(path, `yaw ${yaw}: the open airlock should let a mob in`);
  }
});

test('the grid never has a diagonal pinch, and fixtures and pillars block', () => {
  let b = hut(0.45, false); const s = b.structures[0]!.id;
  const r = S.place(b, env, { s, kind: 'foundation', i: 2, j: 0, k: 0, r: 0, mat: 'reg' }); assert.ok(r.ok); b = r.base;
  const pil = S.place(b, env, { s, kind: 'pillar', i: 3, j: 1, k: 0, r: 0, mat: 'reg' }); assert.ok(pil.ok); b = pil.base;
  const bin = S.place(b, env, { s, kind: 'bin', i: 2, j: 0, k: 0, r: 0, dx: 50, dz: 0, deg: 30, mat: 'reg' }); assert.ok(bin.ok, bin.why); b = bin.base;
  const nav = navFor(b, { x: 10, z: 10 }, 20);
  const { w, h } = nav.grid;
  for (let x = 0; x + 1 < w; x++) for (let y = 0; y + 1 < h; y++) {
    const a = nav.grid.blocked(x, y), bb = nav.grid.blocked(x + 1, y), c = nav.grid.blocked(x, y + 1), d = nav.grid.blocked(x + 1, y + 1);
    assert.ok(!((a && d && !bb && !c) || (bb && c && !a && !d)), `pinch at ${x}, ${y}`);
  }
  const st = b.structures[0]!, at = (u: number, v: number) => S.toWorld(st, u, v, 0);
  const binAt = at(2.5 * 4 + 0.5, 0.5 * 4), pillarAt = at(3 * 4, 1 * 4);
  for (const p of [binAt, pillarAt]) { const [gx, gz] = cellOf(nav, p.x, p.z); assert.ok(nav.grid.blocked(Math.floor(gx), Math.floor(gz)), 'should block'); }
  const free = at(2.5 * 4 - 1.5, 0.5 * 4 + 1.5), [fx, fz] = cellOf(nav, free.x, free.z);
  assert.equal(nav.grid.blocked(Math.floor(fx), Math.floor(fz)), false, 'open floor stays walkable');
});
