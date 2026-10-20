import test from 'node:test';
import assert from 'node:assert/strict';
import { GENERATORS, type MeshData } from '@hm/partgen';
import { MESH_OPERATORS } from '../src/index';

/** Problems with a mesh, or [] when it is well-formed. */
function problems(md: MeshData): string[] {
  const out: string[] = [];
  const verts = md.positions.length / 3;
  if (!Number.isInteger(verts)) out.push('positions not a multiple of 3');
  if (md.normals.length !== md.positions.length) out.push(`normals ${md.normals.length} vs positions ${md.positions.length}`);
  if (md.uvs.length / 2 !== verts) out.push(`uvs ${md.uvs.length / 2} vs verts ${verts}`);
  if (md.indices.length % 3 !== 0) out.push('indices not a multiple of 3');
  for (let i = 0; i < md.positions.length; i++) if (!Number.isFinite(md.positions[i]!)) { out.push(`position ${i} not finite`); break; }
  for (const i of md.indices) if (i >= verts) { out.push(`index ${i} >= ${verts}`); break; }
  for (let v = 0; v < verts; v++) {
    const l = Math.hypot(md.normals[v * 3]!, md.normals[v * 3 + 1]!, md.normals[v * 3 + 2]!);
    if (!(Math.abs(l - 1) < 1e-3)) { out.push(`normal ${v} length ${l}`); break; }
  }
  const covered = md.slots.reduce((s, x) => s + x.count, 0);
  if (covered !== md.indices.length) out.push(`slots cover ${covered} of ${md.indices.length} indices`);
  return out;
}

const inputs = Object.values(GENERATORS).map((g) => [g.id, g.build({}, 2)] as const);

test('every operator, at its one-click preset and every named preset, gives a well-formed mesh on every part', () => {
  const failures: string[] = [];
  for (const op of Object.values(MESH_OPERATORS)) {
    const presets = [['one-click', op.oneClickPreset], ...Object.entries(op.namedPresets)] as const;
    for (const [pname, p] of presets) {
      for (const [gid, md] of inputs) {
        try {
          const res = op.apply(md, p);
          const bad = problems(res);
          if (bad.length) failures.push(`${op.id} ${pname} on ${gid}: ${bad.join('; ')}`);
        } catch (e) {
          failures.push(`${op.id} ${pname} on ${gid}: threw ${(e as Error).message}`);
        }
      }
    }
  }
  assert.deepEqual(failures, []);
});

test('operators are deterministic and never change their input', () => {
  for (const op of Object.values(MESH_OPERATORS)) {
    for (const [gid, md] of inputs) {
      const before = Array.from(md.positions);
      const a = op.apply(md, op.oneClickPreset);
      const b = op.apply(md, op.oneClickPreset);
      assert.deepEqual(Array.from(a.positions), Array.from(b.positions), `${op.id} on ${gid} is deterministic`);
      assert.deepEqual(Array.from(md.positions), before, `${op.id} left ${gid} unchanged`);
    }
  }
});

test('the registry holds the six families, every operator with a schema and a one-click label', () => {
  const fams = new Set(Object.values(MESH_OPERATORS).map((o) => o.family));
  assert.equal(fams.size, 6);
  for (const op of Object.values(MESH_OPERATORS)) {
    assert.ok(op.oneClickPresetLabel.length > 0, op.id);
    assert.ok(Array.isArray(op.params), op.id);
  }
});
