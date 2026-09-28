/**
 * PROFILE: the gold wallet: integer ledger with idempotency keys, bets on your own finish (placed,
 * settled, voided exactly once), race purses and the cosmetics shop.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_STAKE, MIN_STAKE, STARTING_GOLD, balance, betOdds, buyItem, emptyWallet, normalizeWallet, payRacePurse,
  placeBet, post, readWallet, settleRound, updateWallet, voidRound, WALLET_KEY, type BetRequest,
} from '../src/game/meta/wallet';

const req = (over: Partial<BetRequest> = {}): BetRequest => ({ sessionId: 's1', round: 0, market: 'win', stake: 100, odds: 3, label: 'Serpentine Isle', fieldSize: 4, at: 1, ...over });

test('a new wallet holds the starting purse', () => {
  assert.equal(balance(emptyWallet()), STARTING_GOLD);
});

test('ledger: one entry per idempotency key, whole gold only, never below zero', () => {
  let doc = emptyWallet();
  doc = post(doc, { id: 'a', amount: 40, reason: 'race-purse', note: '' }).doc;
  const again = post(doc, { id: 'a', amount: 40, reason: 'race-purse', note: '' });
  assert.equal(again.posted, false, 'the same key twice changes nothing');
  assert.equal(balance(again.doc), STARTING_GOLD + 40);
  assert.equal(post(doc, { id: 'b', amount: 1.5, reason: 'race-purse', note: '' }).posted, false);
  const broke = post(doc, { id: 'c', amount: -(STARTING_GOLD + 41), reason: 'shop', note: '' });
  assert.equal(broke.posted, false);
  assert.match(broke.error!, /Not enough gold/);
});

test('bets: the stake leaves now, a win pays stake × odds once, a loss pays nothing', () => {
  let doc = placeBet(emptyWallet(), req()).doc;
  assert.equal(balance(doc), STARTING_GOLD - 100);
  doc = placeBet(doc, req({ market: 'podium', stake: 50, odds: 1.5 })).doc;
  doc = settleRound(doc, 's1', 0, { finished: true, position: 2 });
  assert.equal(balance(doc), STARTING_GOLD - 100 - 50 + 75, 'podium won (75), win lost');
  const settledOnce = balance(doc);
  doc = settleRound(doc, 's1', 0, { finished: true, position: 1 });
  assert.equal(balance(doc), settledOnce, 'settling again changes nothing');
  assert.deepEqual(doc.bets.map((b) => b.status), ['lost', 'won']);
  assert.equal(doc.bets[1]!.position, 2);
});

test('bets: one per market per round, a floor and a ceiling on the stake, never more than you have', () => {
  const doc = placeBet(emptyWallet(), req()).doc;
  assert.match(placeBet(doc, req()).error!, /already have that bet/);
  assert.match(placeBet(doc, req({ market: 'finish', stake: MIN_STAKE - 1 })).error!, /at least/);
  assert.match(placeBet(doc, req({ market: 'finish', stake: MAX_STAKE + 1 })).error!, /at most/);
  assert.match(placeBet(doc, req({ market: 'finish', stake: STARTING_GOLD })).error!, /Not enough gold/);
  assert.ok(placeBet(doc, req({ round: 1 })).bet, 'the same market on the next round is a new bet');
});

test('bets: a DNF loses every market; a void refunds the stake once', () => {
  let doc = placeBet(emptyWallet(), req({ market: 'finish', stake: 20, odds: 1.15 })).doc;
  doc = settleRound(doc, 's1', 0, { finished: false });
  assert.equal(doc.bets[0]!.status, 'lost');
  let v = placeBet(emptyWallet(), req()).doc;
  v = voidRound(v, 's1', 0);
  v = voidRound(v, 's1', 0);
  assert.equal(balance(v), STARTING_GOLD);
  assert.equal(v.bets[0]!.status, 'void');
});

test('odds: a harder CPU and a bigger field pay more; winning pays more than a podium, a podium more than finishing', () => {
  assert.equal(betOdds('win', 4, 'racer'), 3);
  assert.equal(betOdds('podium', 4, 'racer'), 1.5);
  assert.ok(betOdds('win', 4, 'veteran') > betOdds('win', 4, 'racer'));
  assert.ok(betOdds('win', 4, 'rookie') < betOdds('win', 4, 'racer'));
  assert.ok(betOdds('win', 20, 'racer') > betOdds('win', 4, 'racer'));
  for (const f of [4, 20, 50, 100]) assert.ok(betOdds('win', f) > betOdds('podium', f) && betOdds('podium', f) > betOdds('finish', f));
  for (const f of [2, 4, 100]) for (const m of ['win', 'podium', 'finish'] as const) assert.ok(betOdds(m, f) >= 1.02);
});

test('race purse: paid once per round, bigger for a better place, nothing for a DNF', () => {
  let doc = payRacePurse(emptyWallet(), 's1', 0, true, 1, 4, 'x');
  doc = payRacePurse(doc, 's1', 0, true, 1, 4, 'x');
  assert.equal(balance(doc), STARTING_GOLD + 60);
  assert.equal(balance(payRacePurse(emptyWallet(), 's1', 0, false, undefined, 4, 'x')), STARTING_GOLD);
});

test('shop: an item is bought once; free items cost nothing; no gold, no item', () => {
  let doc = buyItem(emptyWallet(), 'damascus', 300, 'Damascus').doc;
  doc = buyItem(doc, 'damascus', 300, 'Damascus').doc;
  assert.equal(balance(doc), STARTING_GOLD - 300);
  assert.match(buyItem(doc, 'obsidian', 1200, 'Obsidian').error!, /Not enough gold/);
  assert.equal(buyItem(doc, 'scrap', 0, 'Scrap').doc, doc);
});

test('storage: reads back what it wrote; junk reads as a fresh wallet', () => {
  const data = new Map<string, string>();
  const store = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); } };
  updateWallet((d) => placeBet(d, req()).doc, store);
  assert.equal(balance(readWallet(store)), STARTING_GOLD - 100);
  data.set(WALLET_KEY, '{nonsense');
  assert.deepEqual(readWallet(store), emptyWallet());
  assert.deepEqual(normalizeWallet({ ledger: [{ id: 1 }], bets: 'x' }), emptyWallet());
});
