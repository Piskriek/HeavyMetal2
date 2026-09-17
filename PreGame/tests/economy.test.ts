import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAccount, purchaseItem, settleRace, parseAccount, prizeFor, RACE_PRIZES } from '../src/game/economy';
import { emptyInventory, ITEM_INFO, ITEM_TYPES, MAX_ITEM_STACK, normalizeInventory } from '../src/game/types';

test('Economy: a purchase subtracts its exact price and adds one persistent charge', () => {
  const before = createAccount();
  const bought = purchaseItem(before, 'rocket');
  assert.equal(bought.error, undefined);
  assert.equal(bought.account.credits, 400 - ITEM_INFO.rocket.price);
  assert.equal(bought.account.inventory.rocket, 1);
  assert.equal(before.inventory.rocket, 0);
  assert.deepEqual(parseAccount(JSON.stringify(bought.account)), bought.account);
});

test('Economy: insufficient funds and full stacks cannot be purchased', () => {
  const empty = { ...createAccount(), credits: 0 };
  assert.strictEqual(purchaseItem(empty, 'jump').account, empty);
  assert.ok(purchaseItem(empty, 'jump').error);
  const full = { ...createAccount(), inventory: { ...emptyInventory(), jump: MAX_ITEM_STACK } };
  assert.strictEqual(purchaseItem(full, 'jump').account, full);
  assert.ok(purchaseItem(full, 'jump').error);
});

test('Economy: all placements pay credits and orange pegs add a finish bonus', () => {
  for (let i = 1; i <= 10; i++) {
    const prize = prizeFor({ id: 0, rank: i, time: 40000, pegs: 3 });
    assert.equal(prize.placement, RACE_PRIZES[i - 1]);
    assert.equal(prize.pegBonus, 15);
  }
  assert.deepEqual(prizeFor({ id: 0, rank: 1, time: null, pegs: 99 }), { placement: 0, pegBonus: 0 });
  assert.deepEqual(prizeFor({ id: 0, rank: -1, time: 20, pegs: 99 }), { placement: 0, pegBonus: 0 });
});

test('Economy: the same race payout cannot be collected twice, including after reload', () => {
  const result = { id: 0, rank: 2, time: 50000, pegs: 3 };
  const first = settleRace(createAccount(), 'champ:42:0:0', result);
  assert.equal(first.payout.total, 365);
  assert.equal(first.account.credits, 765);
  assert.equal(first.account.finishes, 1);
  const loaded = parseAccount(JSON.stringify(first.account));
  const second = settleRace(loaded, 'champ:42:0:0', result);
  assert.strictEqual(second.account, loaded);
  assert.equal(second.payout.alreadyPaid, true);
  assert.equal(second.account.credits, 765);
  assert.equal(settleRace(loaded, 'champ:42:0:1', result).account.credits, 1130);
});

test('Economy: invalid saves and inventory counts are safely normalized', () => {
  assert.equal(parseAccount('invalid json').credits, 400);
  assert.equal(parseAccount('{"version":1,"credits":-10}').credits, 400);
  const clean = normalizeInventory({ rocket: 999, jump: -2, aero: '5', shock: NaN, oil: 3.9, invalid: 3 });
  assert.equal(clean.rocket, 9);
  assert.equal(clean.jump, 0);
  assert.equal(clean.aero, 0);
  assert.equal(clean.shock, 0);
  assert.equal(clean.oil, 3);
  assert.deepEqual(Object.keys(clean).sort(), [...ITEM_TYPES].sort());
});

test('Economy: fast consecutive purchases never overspend or reset an inventory', () => {
  let account = createAccount();
  for (let i = 0; i < 20; i++) account = purchaseItem(account, 'jump').account;
  assert.equal(account.inventory.jump, Math.floor(400 / ITEM_INFO.jump.price));
  assert.equal(account.credits, 400 % ITEM_INFO.jump.price);
  assert.ok(account.credits >= 0);
});