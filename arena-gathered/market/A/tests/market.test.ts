import test from 'node:test';
import assert from 'node:assert/strict';
import { appeal, earnings, makeBuyers, sellable, simulateDay, suggestPrice, type Listing } from '../src/index';

const L = (id: string, looks: number, bytes: number, price: number, license: Listing['license'] = 'mine'): Listing => ({ id, seller: 'p1', kind: 'texture', looks, bytes, price, listedDay: 0, license });

test('same seed, same crowd', () => {
  assert.deepEqual(makeBuyers(4, 20), makeBuyers(4, 20));
  assert.equal(makeBuyers(4, 20).length, 20);
});

test('appeal', () => {
  const b = { id: 'b', taste: 1, budget: 100, patience: 0 };
  assert.ok(Math.abs(appeal(b, L('a', 0.9, 0, 10)) - 0.8) < 1e-9);
  assert.ok(Math.abs(appeal({ ...b, taste: 0 }, L('a', 0, 65536, 0 + 1)) - 0.49) < 1e-9);
});

test('only sellable things sell, and the market keeps 10%', () => {
  assert.equal(sellable(L('x', 1, 0, 5, 'only-me')), false);
  assert.equal(sellable(L('y', 1, 0, 5, 'share-alike')), false);
  const buyers = [{ id: 'b1', taste: 1, budget: 100, patience: 0 }];
  const sales = simulateDay(1, buyers, [L('good', 0.95, 0, 10), L('mine-only', 1, 0, 1, 'only-me')]);
  assert.deepEqual(sales.map((s) => s.listing), ['good']);
  assert.deepEqual(earnings(sales, [L('good', 0.95, 0, 10)]), { p1: 9 });
});

test('patience: buyers wait required days before considering listings', () => {
  const patientBuyer = [{ id: 'patient', taste: 1, budget: 100, patience: 2 }];
  const item = { ...L('wait-for-it', 0.9, 0, 10), listedDay: 3 };

  // Day 4: item was listed only 1 day ago (4 - 3 = 1 < patience 2) -> no sale
  const salesDay4 = simulateDay(4, patientBuyer, [item]);
  assert.equal(salesDay4.length, 0);

  // Day 5: item was listed 2 days ago (5 - 3 = 2 >= patience 2) -> sale happens
  const salesDay5 = simulateDay(5, patientBuyer, [item]);
  assert.equal(salesDay5.length, 1);
  assert.equal(salesDay5[0]?.listing, 'wait-for-it');
});

test('budget: listings priced over budget cannot be bought', () => {
  const frugalBuyer = [{ id: 'frugal', taste: 1, budget: 15, patience: 0 }];
  const expensive = L('exp', 0.99, 0, 20); // price 20 > budget 15
  const affordable = L('aff', 0.9, 0, 15); // price 15 <= budget 15

  const sales1 = simulateDay(1, frugalBuyer, [expensive]);
  assert.equal(sales1.length, 0);

  const sales2 = simulateDay(1, frugalBuyer, [expensive, affordable]);
  assert.equal(sales2.length, 1);
  assert.equal(sales2[0]?.listing, 'aff');
});

test('only-me and share-alike never sell under any circumstances', () => {
  assert.equal(sellable(L('m', 1, 0, 5, 'mine')), true);
  assert.equal(sellable(L('c0', 1, 0, 5, 'cc0')), true);
  assert.equal(sellable(L('cb', 1, 0, 5, 'cc-by')), true);
  assert.equal(sellable(L('sa', 1, 0, 5, 'share-alike')), false);
  assert.equal(sellable(L('om', 1, 0, 5, 'only-me')), false);

  const buyer = [{ id: 'b', taste: 1, budget: 100, patience: 0 }];
  const sales = simulateDay(1, buyer, [
    L('sa-listing', 1, 0, 1, 'share-alike'),
    L('om-listing', 1, 0, 1, 'only-me'),
  ]);
  assert.equal(sales.length, 0);
});

test('ties: broken by lower price then id', () => {
  const buyer = [{ id: 'b', taste: 1, budget: 100, patience: 0 }];

  // Tie in appeal broken by lower price:
  // Both have appeal 0.8:
  // itemA: 1 * 0.9 - 10 / 100 = 0.8
  // itemB: 1 * 0.95 - 15 / 100 = 0.8
  // itemA has price 10 < 15, so itemA wins
  const itemA = L('a-cheaper', 0.9, 0, 10);
  const itemB = L('b-pricier', 0.95, 0, 15);
  const salesPriceTie = simulateDay(1, buyer, [itemB, itemA]);
  assert.equal(salesPriceTie[0]?.listing, 'a-cheaper');

  // Tie in appeal and price broken by lexicographical id:
  // itemBeta vs itemAlpha: both appeal 0.8, price 10
  const itemBeta = L('item-z', 0.9, 0, 10);
  const itemAlpha = L('item-a', 0.9, 0, 10);
  const salesIdTie = simulateDay(1, buyer, [itemBeta, itemAlpha]);
  assert.equal(salesIdTie[0]?.listing, 'item-a');
});

test('earnings: market keeps 10% rounded down per sale across sellers', () => {
  const listings: Listing[] = [
    { ...L('l1', 1, 0, 15), seller: 'alice' }, // fee: floor(1.5) = 1, seller cut: 14
    { ...L('l2', 1, 0, 5), seller: 'alice' },  // fee: floor(0.5) = 0, seller cut: 5
    { ...L('l3', 1, 0, 29), seller: 'bob' },   // fee: floor(2.9) = 2, seller cut: 27
    { ...L('l4', 1, 0, 100), seller: 'charlie' }, // unsold
  ];

  const sales = [
    { day: 1, listing: 'l1', buyer: 'b1', price: 15 },
    { day: 1, listing: 'l2', buyer: 'b2', price: 5 },
    { day: 1, listing: 'l3', buyer: 'b3', price: 29 },
  ];

  const e = earnings(sales, listings);
  assert.deepEqual(e, {
    alice: 19, // 14 + 5
    bob: 27,
  });
});

test('suggestPrice is monotonic in share', () => {
  const buyers = makeBuyers(42, 60);
  const item = L('cool-skin', 0.9, 2048, 10);

  const shares = [0.05, 0.15, 0.3, 0.5, 0.75, 0.95, 1.0];
  const prices = shares.map((s) => suggestPrice(buyers, item, s));

  for (let i = 0; i < prices.length - 1; i++) {
    const cur = prices[i];
    const nxt = prices[i + 1];
    assert.ok(cur !== undefined && nxt !== undefined);
    assert.ok(
      cur >= nxt,
      `Price for share ${shares[i]} (${cur}) must be >= price for share ${shares[i + 1]} (${nxt})`
    );
  }

  // Every price should be at least 1
  for (const p of prices) {
    assert.ok(p >= 1);
  }
});