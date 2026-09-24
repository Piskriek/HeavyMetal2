import test from 'node:test';
import assert from 'node:assert/strict';
import { AssetDB, MemoryKV, type QuotaProbe } from '../src/game/assets/asset-db';

test('T4 AssetDB: dedupe by hash on blob insertion', async () => {
  const db = new AssetDB(new MemoryKV());
  const data = new TextEncoder().encode('v 1 2 3\nf 1 1 1');

  const res1 = await db.putBlob(data);
  assert.equal(res1.ok, true);
  if (!res1.ok) return;
  assert.equal(res1.reused, false);

  const res2 = await db.putBlob(data);
  assert.equal(res2.ok, true);
  if (!res2.ok) return;
  assert.equal(res2.reused, true);
  assert.equal(res1.sha256, res2.sha256);
});

test('T4 AssetDB: quota exceeded refusal', async () => {
  const fakeQuota: QuotaProbe = {
    async estimate() {
      return { usage: 950, quota: 1000 }; // 95% full > 90% threshold
    },
    async persist() {
      return true;
    },
  };

  const db = new AssetDB(new MemoryKV(), fakeQuota);
  const data = new Uint8Array([1, 2, 3, 4]);

  const res = await db.putBlob(data);
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.equal(res.refusal, 'quota_exceeded');
  }
});

test('T4 AssetDB: in-use asset deletion refusal', async () => {
  const db = new AssetDB(new MemoryKV());
  const record = {
    assetId: 'a_custom_tree',
    sha256: 'abc123',
    name: 'Custom Tree',
    importedAt: new Date().toISOString(),
  };

  await db.putAsset(record);

  const inUse = new Set(['a_custom_tree', 'p2']);
  const delRes = await db.remove('a_custom_tree', inUse);
  assert.equal(delRes.ok, false);
  if (!delRes.ok) {
    assert.equal(delRes.refusal, 'asset_in_use');
  }

  // Deleting unreferenced asset succeeds
  const notInUse = new Set(['other_prop']);
  const delRes2 = await db.remove('a_custom_tree', notInUse);
  assert.equal(delRes2.ok, true);
});
