import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  TrackBuilder3D,
  DEFAULT_TRACK_PROPS,
  PROP_DEFINITIONS,
  type PlacedProp,
  propsFingerprint,
} from '../src/game/track-builder-3d';
import type { TrackData } from '../src/game/types';

// Mock minimal TrackData
const mockTrack: TrackData = {
  id: 'ridge',
  name: 'Rustbucket Ridge',
  theme: 'ridge',
  points: [
    { x: 0, y: 18000, z: -3000 },
    { x: 0, y: 18000, z: 0 },
    { x: 0, y: 18000, z: 3000 },
  ],
  segments: [],
  spline: null as any,
  curve: null as any,
  loopings: [],
  ramps: [],
  boostPads: [],
  obstacles: [],
  skybox: 'ridge',
} as unknown as TrackData;

// In-memory mock localStorage for node test runner
const memoryStorage = new Map<string, string>();
const mockLocalStorage = {
  getItem: (key: string) => memoryStorage.get(key) ?? null,
  setItem: (key: string, val: string) => memoryStorage.set(key, String(val)),
  removeItem: (key: string) => memoryStorage.delete(key),
  clear: () => memoryStorage.clear(),
};
(globalThis as any).localStorage = mockLocalStorage;

test('Track Props Backup and Recovery System', async (t) => {
  mockLocalStorage.clear();

  await t.test('DEFAULT_TRACK_PROPS contains 14 curated decorations with valid definitions', () => {
    assert.equal(DEFAULT_TRACK_PROPS.length, 14);

    const validTypes = new Set(PROP_DEFINITIONS.map((d) => d.type));
    for (const prop of DEFAULT_TRACK_PROPS) {
      assert.ok(
        validTypes.has(prop.type),
        `Default prop type "${prop.type}" must exist in PROP_DEFINITIONS`,
      );
      assert.ok(prop.id, 'Prop must have an id');
      assert.ok(typeof prop.x === 'number');
      assert.ok(typeof prop.y === 'number');
      assert.ok(typeof prop.z === 'number');
    }
  });

  await t.test('Builder auto-bootstraps starter decorations when storage is empty', () => {
    mockLocalStorage.clear();
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    const builder = new TrackBuilder3D(scene, camera, mockTrack);

    const props = builder.getProps();
    assert.equal(props.length, 14);
    assert.equal(props[0].type, 'slingshot_3d_launcher');

    // Verify written to storage (T08: uses versioned storage key)
    const raw = mockLocalStorage.getItem('hm2-track-props-v1');
    assert.ok(raw);
    const parsed = JSON.parse(raw);
    assert.equal(parsed.props.length, 14);

    // Verify written to rolling backup latest
    const rawBackup = mockLocalStorage.getItem('hm2-3d-track-props-backup-latest');
    assert.ok(rawBackup);
    const backupData = JSON.parse(rawBackup);
    assert.equal(backupData.count, 14);

    builder.destroy();
  });

  await t.test('saveToStorage maintains rolling backup history in localStorage', () => {
    mockLocalStorage.clear();
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    const builder = new TrackBuilder3D(scene, camera, mockTrack);

    const initial = builder.getProps();
    assert.equal(initial.length, 14);

    const rawHist = mockLocalStorage.getItem('hm2-3d-track-props-backup-history');
    assert.ok(rawHist);
    const hist = JSON.parse(rawHist);
    assert.ok(Array.isArray(hist));
    assert.ok(hist.length >= 1);
    assert.equal(hist[0].count, 14);

    builder.destroy();
  });

  await t.test('restoreDefaultPreset restores all 14 decorations after clearing', async () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    const builder = new TrackBuilder3D(scene, camera, mockTrack);

    builder.clearAll();
    assert.equal(builder.getProps().length, 0);

    await builder.restoreDefaultPreset();
    assert.equal(builder.getProps().length, 14);

    builder.destroy();
  });

  await t.test('backup status listeners receive updates on backup lifecycle', () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    const builder = new TrackBuilder3D(scene, camera, mockTrack);

    let receivedInfo: any = null;
    const unsub = builder.onBackupStatus((info) => {
      receivedInfo = info;
    });

    assert.ok(receivedInfo);
    assert.equal(receivedInfo.count, 14);

    unsub();
    builder.destroy();
  });

  await t.test('destroy cleans up timers and listeners cleanly', () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    const builder = new TrackBuilder3D(scene, camera, mockTrack);

    builder.destroy();
    // Subsequent calls to clearAll or actions should not crash
    assert.doesNotThrow(() => builder.clearAll());
  });

  await t.test('decal rotation rotates quaternion and 3D mesh while preserving surface normal', () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    const builder = new TrackBuilder3D(scene, camera, mockTrack);

    builder.clearAll();

    // Place a decal with an initial slope/quaternion
    const normal = new THREE.Vector3(0.2, 0.95, 0.1).normalize();
    const rotY = 0;
    const F_horiz = new THREE.Vector3(Math.sin(-rotY), 0, Math.cos(-rotY)).normalize();
    const F_surface = F_horiz.clone().sub(normal.clone().multiplyScalar(F_horiz.dot(normal))).normalize();
    const R_surface = new THREE.Vector3().crossVectors(F_surface, normal).normalize();
    const mBasis = new THREE.Matrix4().makeBasis(R_surface, F_surface, normal);
    const initialQ = new THREE.Quaternion().setFromRotationMatrix(mBasis);

    const decalProp: PlacedProp = {
      id: 'test_decal_1',
      type: 'road_tire_mark_1',
      name: 'Tire Mark Decal',
      x: 100,
      y: 18000,
      z: 500,
      rotY: 0,
      rotX: Math.asin(F_surface.y),
      rotZ: Math.asin(R_surface.y),
      quaternion: [initialQ.x, initialQ.y, initialQ.z, initialQ.w],
      scale: 1,
      cameraFacing: false,
      flipX: false,
      isDecal: true,
    };

    builder.restorePropsState([decalProp]);
    builder.selectProp('test_decal_1');

    const propBefore = builder.getProps().find((p) => p.id === 'test_decal_1')!;
    assert.ok(propBefore.quaternion, 'Decal must have initial quaternion');
    const qBefore = new THREE.Quaternion(...propBefore.quaternion!);
    const normalBefore = new THREE.Vector3(0, 0, 1).applyQuaternion(qBefore);

    // 1. Rotate via rotateSelectedProps (+45 deg)
    const delta = (45 * Math.PI) / 180;
    builder.rotateSelectedProps(delta);

    const propAfterRotate = builder.getProps().find((p) => p.id === 'test_decal_1')!;
    assert.ok(propAfterRotate.quaternion, 'Decal must still have quaternion');
    const qAfterRotate = new THREE.Quaternion(...propAfterRotate.quaternion!);

    // Quaternion must have changed!
    assert.ok(
      Math.abs(qBefore.dot(qAfterRotate)) < 0.999,
      'Quaternion must have rotated after rotateSelectedProps',
    );

    // Surface normal must be preserved (diff < 1e-6)
    const normalAfter = new THREE.Vector3(0, 0, 1).applyQuaternion(qAfterRotate);
    assert.ok(
      normalBefore.distanceTo(normalAfter) < 1e-5,
      `Surface normal must be preserved across rotation, diff was ${normalBefore.distanceTo(normalAfter)}`,
    );

    // 2. Rotate via updatePropTransform (rotY)
    const qBeforeUpdate = qAfterRotate.clone();
    builder.updatePropTransform('test_decal_1', { rotY: (90 * Math.PI) / 180 });

    const propAfterUpdate = builder.getProps().find((p) => p.id === 'test_decal_1')!;
    const qAfterUpdate = new THREE.Quaternion(...propAfterUpdate.quaternion!);
    assert.ok(
      Math.abs(qBeforeUpdate.dot(qAfterUpdate)) < 0.999,
      'Quaternion must have updated after updatePropTransform({ rotY })',
    );

    // 3. Rotate via rotateDecal method
    builder.rotateDecal('test_decal_1', (15 * Math.PI) / 180);
    const propAfterRotateDecal = builder.getProps().find((p) => p.id === 'test_decal_1')!;
    const qAfterRotateDecal = new THREE.Quaternion(...propAfterRotateDecal.quaternion!);
    assert.ok(
      Math.abs(qAfterUpdate.dot(qAfterRotateDecal)) < 0.999,
      'Quaternion must have rotated after rotateDecal',
    );

    // Surface normal must remain strictly preserved throughout
    const finalNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(qAfterRotateDecal);
    assert.ok(
      normalBefore.distanceTo(finalNormal) < 1e-5,
      `Normal must remain preserved after all rotations, diff: ${normalBefore.distanceTo(finalNormal)}`,
    );

    builder.destroy();
  });

  await t.test('persistent billboard mode and camera-facing angle when not aligned to track', () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(300, 500, 400);

    const builder = new TrackBuilder3D(scene, camera, mockTrack);

    // Initial default is billboard mode (cameraFacingDefault === true)
    assert.equal(builder.snapping.cameraFacingDefault, true);

    // Switch mode to Fixed 3D (cameraFacingDefault === false)
    builder.setCameraFacingDefault(false);
    assert.equal(builder.snapping.cameraFacingDefault, false);
    assert.equal(mockLocalStorage.getItem('hm2-builder-camera-facing-default'), 'false');

    // Create a mock canvas
    const canvas = {} as HTMLCanvasElement;

    // Mock raycastSurface to return a point at (0, 0, 0)
    (builder as any).raycastSurface = () => ({
      point: new THREE.Vector3(0, 0, 0),
      normal: new THREE.Vector3(0, 1, 0),
      sample: undefined,
    });

    builder.snapping.alignToTrack = false;
    builder.setActivePropType('prop_38_scrap_barricade');

    const placed = builder.placeActiveProp(100, 100, canvas);
    assert.ok(placed, 'Should place prop');
    assert.equal(placed.cameraFacing, false, 'Placed prop must inherit persistent cameraFacingDefault === false');

    // Expected angle to camera at (300, 500, 400) from (0, 0, 0):
    // dx = 300, dz = 400 => Math.atan2(300, 400)
    const expectedYaw = Math.atan2(300, 400);
    assert.ok(
      Math.abs(placed.rotY - expectedYaw) < 1e-4,
      `Placed prop must face camera angle. Got ${placed.rotY}, expected ${expectedYaw}`,
    );

    // Verify subsequent placements keep this mode
    const placed2 = builder.placeActiveProp(100, 100, canvas);
    assert.ok(placed2);
    assert.equal(placed2.cameraFacing, false, 'Subsequent placement must also inherit cameraFacingDefault === false');

    // Switch mode back to Billboard (true)
    builder.setCameraFacingDefault(true);
    assert.equal(builder.snapping.cameraFacingDefault, true);
    assert.equal(mockLocalStorage.getItem('hm2-builder-camera-facing-default'), 'true');

    const placed3 = builder.placeActiveProp(100, 100, canvas);
    assert.ok(placed3);
    assert.equal(placed3.cameraFacing, true, 'Subsequent placement after toggle back must be billboard');

    builder.destroy();
  });
});

test('M12: the auto-backup only writes when the props change', async (t) => {
  mockLocalStorage.clear();
  const posts: string[] = [];
  const originalFetch = globalThis.fetch;
  (globalThis as any).fetch = async (url: string, init?: { method?: string; body?: string }) => {
    if (init?.method === 'POST') posts.push(init.body ?? '');
    return { ok: true, json: async () => ({ success: true, latest: null, history: [] }) };
  };
  const builder = new TrackBuilder3D(new THREE.Scene(), new THREE.PerspectiveCamera(), mockTrack);
  try {
    await t.test('the fingerprint follows content, not identity or runtime fields', () => {
      const props = builder.getProps();
      const copy = JSON.parse(JSON.stringify(props)) as PlacedProp[];
      assert.equal(propsFingerprint([...props], "ridge"), propsFingerprint(copy, "ridge"));
      (copy[0] as any)._runtimeState = { collected: true };
      assert.equal(propsFingerprint([...props], 'ridge'), propsFingerprint(copy, 'ridge'), 'runtime state is not saved');
      copy[0] = { ...copy[0], x: copy[0].x + 1 };
      assert.notEqual(propsFingerprint([...props], 'ridge'), propsFingerprint(copy, 'ridge'), 'a move changes it');
      assert.notEqual(propsFingerprint([...props], 'ridge'), propsFingerprint([...props], 'canyon'), 'so does the course');
    });

    await t.test('an unchanged track is written once, then never again', async () => {
      const first = await builder.backupToFile(false);
      assert.equal(first?.unchanged, undefined);
      assert.equal(posts.length, 1);
      for (let i = 0; i < 5; i++) {
        const again = await builder.backupToFile(false);
        assert.equal(again?.unchanged, true);
      }
      assert.equal(posts.length, 1, 'idle auto-backups send nothing');
    });

    await t.test('an explicit save always writes', async () => {
      await builder.backupToFile(true);
      assert.equal(posts.length, 2);
    });

    await t.test('an edit makes the next auto-backup write', async () => {
      const [prop] = builder.getProps();
      builder.deleteProp(prop.id);
      (builder as any).lastBackupTimestamp = 0; // past the 15 s spacing
      const result = await builder.backupToFile(false);
      assert.equal(result?.unchanged, undefined);
      assert.equal(posts.length, 3);
      assert.equal(JSON.parse(posts[2]).props.length, 13);
    });
  } finally {
    builder.destroy();
    (globalThis as any).fetch = originalFetch;
  }
});
