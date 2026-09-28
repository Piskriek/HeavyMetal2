/**
 * PLATFORM: the cloud-backed localStorage stand-in (RUN.world has no browser storage in the game
 * iframe), the rebasing of root file paths for a game served from a subfolder, and the plain-browser
 * defaults (no RUN SDK, no dev server) that the node tests run under.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { CLOUD_LIMITS, CloudBackedStorage, installLocalStorage, type WriteFailure } from '../src/platform/storage-shim';
import { PUBLIC_ROOTS, rebase, rebaseCssUrls } from '../src/platform/asset-base';
import { asset } from '../src/platform/asset';
import { hasDevServer } from '../src/platform/dev-server';
import { RUN_BUILD, isRunHosted, platformKind } from '../src/platform/platform';

function fakeBackend(fail = false) {
  const calls: string[] = [];
  const data = new Map<string, string>();
  return {
    calls, data,
    backend: {
      async setItem(k: string, v: string) { calls.push(`set ${k}`); if (fail) throw new Error('offline'); data.set(k, v); },
      async removeItem(k: string) { calls.push(`remove ${k}`); if (fail) throw new Error('offline'); data.delete(k); },
      async clear() { calls.push('clear'); if (fail) throw new Error('offline'); data.clear(); },
    },
  };
}

test('cloud storage: reads come from the loaded bucket at once, like localStorage', () => {
  const { backend } = fakeBackend();
  const s = new CloudBackedStorage(backend, { a: '1', b: 'two' });
  assert.equal(s.getItem('a'), '1');
  assert.equal(s.getItem('missing'), null);
  assert.equal(s.length, 2);
  assert.equal(s.key(1), 'b');
  assert.equal(s.key(5), null);
});

test('cloud storage: writes land in memory now and in the cloud in the background', async () => {
  const f = fakeBackend();
  const s = new CloudBackedStorage(f.backend);
  s.setItem('k', 'v');
  assert.equal(s.getItem('k'), 'v', 'readable before the cloud answers');
  s.setItem('k', 'v');
  assert.deepEqual(f.calls, ['set k'], 'an unchanged value is not sent again');
  s.removeItem('k');
  s.removeItem('never-there');
  await s.flush();
  assert.deepEqual(f.calls, ['set k', 'remove k']);
  assert.equal(f.data.has('k'), false);
  s.setItem('x', '1'); s.clear();
  await s.flush();
  assert.equal(s.length, 0);
  assert.equal(f.data.size, 0);
});

test('cloud storage: a failed cloud write is reported, never thrown, and the session keeps the value', async () => {
  const f = fakeBackend(true);
  const failures: WriteFailure[] = [];
  const s = new CloudBackedStorage(f.backend, {}, (x) => failures.push(x));
  s.setItem('save', 'data');
  await s.flush();
  assert.equal(failures.length, 1);
  assert.equal(failures[0]!.op, 'set');
  assert.equal(s.getItem('save'), 'data');
});

test('cloud storage: refuses what the cloud would refuse, the way a full localStorage does', () => {
  const { backend } = fakeBackend();
  const s = new CloudBackedStorage(backend);
  assert.throws(() => s.setItem('k'.repeat(CLOUD_LIMITS.keyBytes + 1), 'v'), { name: 'QuotaExceededError' });
  assert.throws(() => s.setItem('big', 'x'.repeat(CLOUD_LIMITS.valueBytes + 1)), { name: 'QuotaExceededError' });
  const full = new CloudBackedStorage(backend, Object.fromEntries(Array.from({ length: CLOUD_LIMITS.items }, (_, i) => [`k${i}`, 'v'])));
  assert.throws(() => full.setItem('one-more', 'v'), { name: 'QuotaExceededError' });
  full.setItem('k0', 'changed');
  assert.equal(full.getItem('k0'), 'changed', 'an existing key can still change when the bucket is full');
});

test('cloud storage: installs where the game looks for localStorage', () => {
  const target = {} as { localStorage?: Storage };
  const s = new CloudBackedStorage(fakeBackend().backend, { hello: 'world' });
  assert.equal(installLocalStorage(target, s), true);
  assert.equal(target.localStorage!.getItem('hello'), 'world');
});

test('rebase: only the game\'s own root folders move under the base', () => {
  const sub = (p: string) => './' + p.slice(1);
  for (const root of PUBLIC_ROOTS) assert.equal(rebase(`/${root}/a.png`, sub, null), `./${root}/a.png`);
  assert.equal(rebase('/favicon.png', sub, null), './favicon.png');
  for (const keep of ['/api/island-ground', 'data:image/png;base64,AAA', 'blob:x', 'https://fonts.gstatic.com/a.woff2', '//cdn/x', 'art/relative.png', '/artsy/x.png']) {
    assert.equal(rebase(keep, sub, null), keep, keep);
  }
  assert.equal(rebase(undefined, sub, null), '');
  // The same file as an absolute URL on the page's own origin (three.js's FileLoader hands fetch a Request).
  assert.equal(rebase('http://host.test/models/island.obj', (p) => '/game/hm2' + p, 'http://host.test'), 'http://host.test/game/hm2/models/island.obj');
  assert.equal(rebase('http://other.test/models/island.obj', sub, 'http://host.test'), 'http://other.test/models/island.obj');
});

test('rebase: url(…) inside CSS values, quoted or not, other urls untouched', () => {
  const sub = (p: string) => './' + p.slice(1);
  assert.equal(rebaseCssUrls('linear-gradient(red, red), url(/art/a.png)', sub), 'linear-gradient(red, red), url(./art/a.png)');
  assert.equal(rebaseCssUrls('url("/ui/b.png") center / cover', sub), 'url("./ui/b.png") center / cover');
  assert.equal(rebaseCssUrls('url(#gradient)', sub), 'url(#gradient)');
  assert.equal(rebaseCssUrls('url(data:image/png;base64,AAA)', sub), 'url(data:image/png;base64,AAA)');
});

test('plain browser defaults: no RUN build, no dev server, asset paths unchanged', () => {
  assert.equal(RUN_BUILD, false);
  assert.equal(isRunHosted(), false);
  assert.equal(platformKind(), 'browser');
  assert.equal(hasDevServer(), false);
  assert.equal(asset('/art/x.png'), '/art/x.png');
  assert.equal(rebase('/art/x.png'), '/art/x.png', 'default base: rebase is the identity');
});
