import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  migrateV1toV2,
  validateV2,
  writeTrack,
  readTrack,
  TRACK_STORAGE_KEY,
  TRACK_STORAGE_KEY_V2,
  TRACK_BACKUP_KEY_V2,
  type TrackDocV2,
} from '../src/game/track-storage';

class MockStorage implements Storage {
  private data = new Map<string, string>();
  throwOnSet = false;

  get length(): number {
    return this.data.size;
  }

  clear(): void {
    this.data.clear();
  }

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.data.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  setItem(key: string, value: string): void {
    if (this.throwOnSet) {
      const err = new DOMException('The quota has been exceeded.', 'QuotaExceededError');
      throw err;
    }
    this.data.set(key, value);
  }
}

describe('IF-STORAGE-V2: Schema v2 and Lossless Migration', () => {
  it('AC-1: migrates v1 fixtures preserving all fields, coordinates, and unknown fields', () => {
    const v1Doc = {
      version: 1,
      savedAt: '2026-09-20T12:00:00Z',
      courseId: 'ridge',
      customAuthorNote: 'Hand-crafted cliffside chicane',
      props: [
        {
          id: 'pine_1',
          type: 'pines_cluster',
          name: 'Pine Wall',
          x: 1200,
          y: 450,
          z: -120,
          rotY: 1.57,
          scale: 1.2,
          alignToTrack: true,
          lit: true,
          myCustomMetadataTag: 'secret_easter_egg',
        },
        {
          id: 'torch_1',
          type: 'prop_01_lantern_post',
          name: 'Triple Lantern',
          x: 1800,
          y: 450,
          z: 80,
          rotY: 0,
          scale: 1.0,
          alignToTrack: true,
          lit: false,
        },
      ],
    };

    const v2 = migrateV1toV2(v1Doc);

    assert.equal(v2.version, 2);
    assert.equal(v2.savedAt, v1Doc.savedAt);
    assert.equal(v2.courseId, 'ridge');
    assert.equal(v2.customAuthorNote, 'Hand-crafted cliffside chicane');

    // Prop 1 migration
    const p1 = v2.props[0];
    assert.equal(p1.id, 'pine_1');
    assert.equal(p1.x, 1200);
    assert.equal(p1.shadingMode, 'lit');
    assert.equal(p1.meshRole, 'decoration');
    assert.equal(p1.modelRef, null);
    assert.equal(p1.myCustomMetadataTag, 'secret_easter_egg');

    // Prop 2 migration (lit: false -> shadingMode: 'unlit')
    const p2 = v2.props[1];
    assert.equal(p2.id, 'torch_1');
    assert.equal(p2.shadingMode, 'unlit');
  });

  it('AC-2: migration is strictly idempotent', () => {
    const sample = {
      version: 1,
      props: [{ id: 'p1', type: 'rock', x: 10, y: 20, z: 30, scale: 1, rotY: 0, alignToTrack: true }],
    };

    const once = migrateV1toV2(sample);
    const twice = migrateV1toV2(once);
    assert.deepEqual(once, twice, 'migrateV1toV2 must be idempotent on v2 documents');
  });

  it('AC-3: v2 write leaves v1 key untouched for downgrade safety', () => {
    const store = new MockStorage();
    const v1Content = JSON.stringify({ version: 1, props: [{ id: 'v1_prop' }] });
    store.setItem(TRACK_STORAGE_KEY, v1Content);

    const docV2: TrackDocV2 = {
      version: 2,
      savedAt: new Date().toISOString(),
      props: [
        {
          id: 'v2_prop',
          type: 'boulder_a',
          name: 'Boulder',
          x: 0, y: 0, z: 0,
          rotY: 0, scale: 1,
          alignToTrack: true,
          modelRef: null,
          meshRole: 'decoration',
          shadingMode: 'lit',
          customProps: {},
        },
      ],
      groups: [],
      assetsUsed: {},
      patchHash: null,
    };

    const writeRes = writeTrack(store, docV2);
    assert.equal(writeRes.ok, true);

    // v1 key must be byte-identical to before
    assert.equal(store.getItem(TRACK_STORAGE_KEY), v1Content);
    assert.ok(store.getItem(TRACK_STORAGE_KEY_V2));
  });

  it('AC-4: write quota error leaves previous v2 and backup intact', () => {
    const store = new MockStorage();
    const initialV2: TrackDocV2 = {
      version: 2,
      savedAt: 'initial',
      props: [{ id: 'old_prop', type: 'rock', x: 0, y: 0, z: 0, rotY: 0, scale: 1, alignToTrack: true, modelRef: null, meshRole: 'decoration', shadingMode: 'lit', customProps: {} }],
      groups: [],
      assetsUsed: {},
      patchHash: null,
    };

    writeTrack(store, initialV2);
    const storedOld = store.getItem(TRACK_STORAGE_KEY_V2);
    assert.ok(storedOld);

    // Now make setItem throw QuotaExceededError
    store.throwOnSet = true;

    const nextV2: TrackDocV2 = {
      ...initialV2,
      savedAt: 'second',
    };

    const res = writeTrack(store, nextV2);
    assert.equal(res.ok, false);
    assert.deepEqual(res.errors, [{ code: 'quota_exceeded' }]);

    // Turn off throwing to inspect readability
    store.throwOnSet = false;
    const read = readTrack(store);
    assert.ok(read);
    assert.equal(read.doc.savedAt, 'initial');
  });

  it('AC-5: unknown meshRole survives round trip', () => {
    const docWithCustomRole = {
      version: 2,
      savedAt: 'now',
      props: [
        {
          id: 'p_spinner',
          type: 'custom_spinner',
          name: 'Spinner',
          x: 0, y: 0, z: 0,
          rotY: 0, scale: 1,
          alignToTrack: true,
          modelRef: null,
          meshRole: 'spinner', // custom unknown role
          shadingMode: 'lit',
          customProps: { rpm: 60 },
        },
      ],
      groups: [],
      assetsUsed: {},
      patchHash: null,
    };

    const val = validateV2(docWithCustomRole);
    assert.equal(val.ok, true);
    assert.equal(val.doc.props[0].meshRole, 'spinner');
  });

  it('AC-6: dangling modelRef is rejected when assetsUsed map is supplied', () => {
    const docWithDangling: TrackDocV2 = {
      version: 2,
      savedAt: 'now',
      props: [
        {
          id: 'p1',
          type: 'custom',
          name: 'Custom',
          x: 0, y: 0, z: 0,
          rotY: 0, scale: 1,
          alignToTrack: true,
          modelRef: 'asset_missing_123',
          meshRole: 'decoration',
          shadingMode: 'lit',
          customProps: {},
        },
      ],
      groups: [],
      assetsUsed: {}, // Empty, missing asset_missing_123!
      patchHash: null,
    };

    const val = validateV2(docWithDangling);
    assert.equal(val.ok, false);
    assert.deepEqual(val.errors, [{ code: 'dangling_model_ref', id: 'p1', modelRef: 'asset_missing_123' }]);
  });
});
