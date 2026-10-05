import test from 'node:test';
import assert from 'node:assert/strict';
import { appeal, earnings, makeBuyers, sellable, simulateDay, type Listing } from '../src/index';
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

import { suggestPrice } from '../src/index';

test('a listing waits until the buyer patience requirement is met', () => {
  const buyers = [{ id: 'b', taste: 1, budget: 100, patience: 2 }];
  assert.deepEqual(simulateDay(1, buyers, [L('patient', 1, 0, 10)]), []);
  assert.deepEqual(simulateDay(2, buyers, [L('patient', 1, 0, 10)]).map((s) => s.listing), ['patient']);
});

test('buyers cannot spend above their daily budget', () => {
  const buyers = [{ id: 'b', taste: 1, budget: 10, patience: 0 }];
  assert.deepEqual(simulateDay(1, buyers, [L('expensive', 1, 0, 11)]), []);
});

test('only-me and share-alike listings never sell', () => {
  const buyers = [{ id: 'b', taste: 1, budget: 100, patience: 0 }];
  const listings = [L('private', 1, 0, 1, 'only-me'), L('share', 1, 0, 1, 'share-alike')];
  assert.deepEqual(simulateDay(1, buyers, listings), []);
});

test('appeal ties prefer lower price, then lower id', () => {
  const buyer = { id: 'b', taste: 1, budget: 8, patience: 0 };
  const lowerPrice = L('lower-price', 0.75, 0, 2);
  const higherPrice = L('higher-price', 1, 0, 4);
  assert.equal(appeal(buyer, lowerPrice), 0.5);
  assert.equal(appeal(buyer, higherPrice), 0.5);
  assert.deepEqual(
    simulateDay(1, [buyer], [higherPrice, lowerPrice]).map((s) => s.listing),
    ['lower-price'],
  );

  const laterId = L('z-id', 0.75, 0, 2);
  const earlierId = L('a-id', 0.75, 0, 2);
  assert.deepEqual(
    simulateDay(1, [buyer], [laterId, earlierId]).map((s) => s.listing),
    ['a-id'],
  );
});

test('a preset can sell repeatedly as copies', () => {
  const buyers = [
    { id: 'b1', taste: 1, budget: 100, patience: 0 },
    { id: 'b2', taste: 1, budget: 100, patience: 0 },
  ];
  assert.deepEqual(
    simulateDay(1, buyers, [L('copy', 1, 0, 10)]).map((s) => s.listing),
    ['copy', 'copy'],
  );
});

test('earnings round the market cut down per sale', () => {
  const listings = [L('nine', 1, 0, 9), L('nineteen', 1, 0, 19)];
  const sales = [
    { day: 1, listing: 'nine', buyer: 'b1', price: 9 },
    { day: 1, listing: 'nineteen', buyer: 'b2', price: 19 },
  ];
  assert.deepEqual(earnings(sales, listings), { p1: 27 });
});

test('suggested price is monotonic as the target share rises', () => {
  const buyers = [
    { id: 'b1', taste: 0.75, budget: 128, patience: 0 },
    { id: 'b2', taste: 0.5, budget: 128, patience: 0 },
    { id: 'b3', taste: 0.25, budget: 128, patience: 0 },
  ];
  const listing = L('heavy', 1, 65536, 1);
  const oneThird = suggestPrice(buyers, listing, 1 / 3);
  const twoThirds = suggestPrice(buyers, listing, 2 / 3);
  const all = suggestPrice(buyers, listing, 1);

  assert.ok(oneThird >= twoThirds);
  assert.ok(twoThirds >= all);
  assert.deepEqual([oneThird, twoThirds, all], [48, 32, 16]);
});