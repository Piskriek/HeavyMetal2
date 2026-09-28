/**
 * Hoop-Pod livery contract (docs/HOOP_POD.md §Acceptance).
 *
 * Pure: imports only the DOM-free livery module plus the existing roster/loadout data, so it runs
 * in the plain Node test process like the rest of `npm run check`. Rendering is verified by the
 * browser checks and by playtesting, not here.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { CAPSULES, RIDERS, type Loadout } from '../src/game/loadouts';
import { PLAYER_ID, buildRoster } from '../src/game/roster';
import {
  CAPSULE_FINISH, POD_EMBLEMS, POD_PATTERNS, POD_PRESETS, RIDER_EMBLEM, describeLivery, liveryForLoadout,
  liveryForRacer, loadPlayerLivery, sameLivery, savePlayerLivery, validateLivery, type PodLivery,
} from '../src/game/pod/pod-livery';

const memoryStore = () => {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data,
  };
};

test('every rider/capsule pair resolves to a valid, distinct livery', () => {
  const seen = new Set<string>();
  for (const rider of RIDERS) {
    for (const capsule of CAPSULES) {
      const loadout: Loadout = { rider: rider.id, capsule: capsule.id };
      const livery = liveryForLoadout(loadout, '#f0a15b');
      assert.equal(validateLivery(livery).ok, true, `${rider.id}/${capsule.id}`);
      assert.equal(livery.primary, CAPSULE_FINISH[capsule.id].primary);
      assert.equal(livery.hubDecal, RIDER_EMBLEM[rider.id]);
      assert.equal(livery.decalColor, rider.color);
      seen.add(`${livery.primary}|${livery.hubDecal}`);
    }
  }
  assert.equal(seen.size, RIDERS.length * CAPSULES.length);
});

test('liveries are identity-based: the same racer id always paints the same pod', () => {
  const roster = buildRoster(100, { rider: 'nix', capsule: 'siege' });
  assert.equal(roster.length, 100);
  roster.forEach((entry, slot) => {
    const a = liveryForRacer(entry, slot, null);
    const b = liveryForRacer({ ...entry }, 99 - slot, null); // slot must not matter when id is present
    assert.ok(sameLivery(a, b), `racer ${entry.id}`);
    // The team colour becomes the accent hoops + inner ball (the legacy rim ring's job).
    if (/^#[0-9a-f]{6}$/i.test(entry.color)) assert.equal(a.secondary, entry.color);
    assert.equal(validateLivery(a).ok, true);
  });
});

test('the saved livery repaints the player only', () => {
  const custom = POD_PRESETS[2].livery;
  const roster = buildRoster(20, { rider: 'rivet', capsule: 'iron' });
  const player = roster.find((r) => r.id === PLAYER_ID)!;
  const cpu = roster.find((r) => r.id !== PLAYER_ID)!;
  assert.ok(sameLivery(liveryForRacer(player, 0, custom), custom));
  assert.ok(!sameLivery(liveryForRacer(cpu, 1, custom), custom));
});

test('a frame without loadout or colour still gets a deterministic livery', () => {
  const a = liveryForRacer({}, 7, null);
  const b = liveryForRacer({ id: 7 }, 3, null);
  assert.ok(sameLivery(a, b));
  assert.equal(validateLivery(a).ok, true);
});

test('validation refuses with a typed code and never repairs silently', () => {
  const good = POD_PRESETS[1].livery;
  const cases: [unknown, RegExp][] = [
    [null, /object/],
    [{ ...good, primary: 'red' }, /primary/],
    [{ ...good, glass: '#12345' }, /glass/],
    [{ ...good, hubDecal: POD_EMBLEMS.length }, /hubDecal/],
    [{ ...good, bandPattern: -1 }, /bandPattern/],
    [{ ...good, bandPattern: 1.5 }, /bandPattern/],
    [{ ...good, wear: 2 }, /wear/],
    [{ ...good, wear: Number.NaN }, /wear/],
  ];
  for (const [value, reason] of cases) {
    const result = validateLivery(value);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'E_POD_LIVERY');
      assert.match(result.reason, reason);
    }
  }
  const ok = validateLivery({ ...good, primary: '#ABCDEF' });
  assert.ok(ok.ok && ok.livery.primary === '#abcdef');
  assert.ok(ok.ok && Object.isFrozen(ok.livery));
});

test('persistence is versioned, validated and reports failure instead of throwing', () => {
  const store = memoryStore();
  const livery: PodLivery = POD_PRESETS[0].livery;
  assert.deepEqual(savePlayerLivery(livery, store), { ok: true });
  assert.ok(sameLivery(loadPlayerLivery(store), livery));

  store.data.set('hm2-pod-livery-v1', JSON.stringify({ version: 999, livery }));
  assert.equal(loadPlayerLivery(store), null, 'future version is ignored, not guessed');
  store.data.set('hm2-pod-livery-v1', '{not json');
  assert.equal(loadPlayerLivery(store), null);

  assert.deepEqual(savePlayerLivery(livery, null), { ok: false, reason: 'unavailable' });
  const denied = { getItem: () => null, setItem: () => { throw new Error('QuotaExceeded'); }, removeItem: () => undefined };
  assert.deepEqual(savePlayerLivery(livery, denied), { ok: false, reason: 'denied' });
  assert.deepEqual(savePlayerLivery({ ...livery, wear: 9 }, store), { ok: false, reason: 'invalid' });
  assert.deepEqual(savePlayerLivery(null, store), { ok: true });
  assert.equal(loadPlayerLivery(store), null);
});

test('descriptions never rely on colour alone', () => {
  for (const preset of POD_PRESETS) {
    const text = describeLivery(preset.livery);
    assert.ok(text.length > 10);
    assert.doesNotMatch(text, /#[0-9a-f]{6}/i);
  }
  assert.equal(POD_PATTERNS.length, 7);
});
