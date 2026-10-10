// Heavy terraformers (docs/BASE_BUILDING_ARCHITECTURE.md D3): added after the plotsim battle, kept beside its own tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { GATE, HEAVY_KINDS, KINDS, MACHINE_KINDS, newPlot, place, rates, running, type Env } from '../src/index';

const env: Env = { gate: { x: 0, z: 0 }, plotRadius: 500, richness: () => 0.5 };

test('heavy kinds: paid by the base, about 20x the output for 4x the power of their field twins', () => {
  for (const h of HEAVY_KINDS) {
    const twin = KINDS[h.replace('heavy-', '') as 'mill' | 'press' | 'projector' | 'water'];
    const spec = KINDS[h];
    assert.equal(spec.cost, 0);
    assert.equal(spec.emits, twin.emits);
    assert.equal(spec.rate, twin.rate * 20);
    assert.equal(spec.draw, twin.draw * 4);
    assert.equal(spec.unlock, twin.unlock);
    assert.ok(!MACHINE_KINDS.includes(h), 'heavy kinds stay out of the field build list');
  }
});

test('a heavy mill near the gate lifts stage 0 to 1 and runs at the share the gate can feed', () => {
  const s = place(newPlot(), env, 'heavy-mill', 12, 0, 0);
  assert.equal(s.ore, newPlot().ore);
  assert.equal(s.stage, 1);
  const id = s.machines[0]!.id;
  // the gate gives 12 kW, the heavy mill asks 16: it runs at 75%; it needs ore, and a new plot has none
  const run = running({ ...s, ore: 100 }, env).get(id) ?? 0;
  assert.ok(Math.abs(run - GATE.supply / KINDS['heavy-mill'].draw) < 1e-9, `${run}`);
  assert.ok(rates({ ...s, ore: 100 }, env).points.pxd > 0);
  assert.throws(() => place(s, env, 'heavy-mill', 15, 0, 0), /Too close/);
});
