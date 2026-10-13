import test from 'node:test';
import assert from 'node:assert/strict';
import { apply, BRIDGE_STORE, createWorld, hashWorld, PLAYER_KG, withBridgeStore, type BaseCommand, type BaseWorld, type WorldEnv } from './world';
import { saveWorld } from './save';
import { DEV_KIT_STOCK, hasBridgeStore, hasWork, startCampaignWorld } from './campaign-world';
import { STARTER } from './catalog';
import * as L from '@hm/lattice';

const env: WorldEnv = { heightAt: () => 0, bridge: { x: 0, z: 0, range: 60 } };
const run = (w: BaseWorld, ...cmds: BaseCommand[]): BaseWorld => cmds.reduce((x, c) => {
  const r = apply(x, env, c);
  assert.equal(r.events.find((e) => e.type === 'refused'), undefined, c.t);
  return r.world;
}, w);

test('a new profile starts with the starter kit in the hotbar and the bridge store, and has made nothing yet', () => {
  const start = startCampaignWorld(null);
  assert.equal(start.played, false);
  assert.equal(start.world.player.slots[0]?.item, STARTER);
  assert.equal(start.world.player.maxKg, PLAYER_KG);
  assert.equal(hasBridgeStore(start.world), true);
  assert.equal(start.world.shelter, false);
  assert.equal(hasWork(start.world), false, 'a fresh world has made nothing yet');
});

test('an unreadable or empty save starts as a new profile (no empty hotbar)', () => {
  for (const text of ['', 'nonsense', '{"v":2}', JSON.stringify({ v: 3, base: 'not-a-base' })]) {
    const start = startCampaignWorld(text);
    assert.equal(start.played, false, text);
    assert.equal(start.world.player.slots[0]?.item, STARTER, text);
    assert.equal(hasBridgeStore(start.world), true, text);
  }
});

test('the dev kit fixture adds stock and two blueprints', () => {
  const start = startCampaignWorld(null, { devKit: true });
  assert.equal(start.world.player.slots[1]?.item, 'bp:beam:basalt');
  assert.equal(start.world.player.slots[2]?.item, 'bp:column:basalt');
  const bridge = start.world.boxes.find((b) => b.id === BRIDGE_STORE)!;
  assert.ok(bridge, 'the bridge store exists');
  assert.equal(L.totals([bridge], [BRIDGE_STORE])['ore'], DEV_KIT_STOCK.find((s) => s.item === 'ore')!.n);
});

test('a played base saves and reloads with the same state, and starts played (no shelter drop again)', () => {
  let w = withBridgeStore(createWorld(1), env, [{ item: 'ore', n: 40 }]);
  w = run(w, { t: 'shelter', cx: 2, cz: 2, yaw: 0 });
  const back = startCampaignWorld(saveWorld(w));
  assert.equal(back.played, true);
  assert.equal(hasWork(back.world), true);
  const again = startCampaignWorld(saveWorld(back.world));
  assert.equal(hashWorld(again.world), hashWorld(back.world), 'a second save reloads to the same state');
});

test('an old profile with a played base but no bridge store keeps its pieces; the screen adds the store at the gate', () => {
  const w = run(createWorld(1), { t: 'shelter', cx: 2, cz: 2, yaw: 0 });
  const back = startCampaignWorld(saveWorld(w)).world;
  assert.equal(back.shelter, true);
  assert.equal(hasBridgeStore(back), false);
});
