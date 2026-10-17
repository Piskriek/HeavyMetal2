// ============================================================================
// File: apps/web/src/studio/scene-tab.test.ts
// Unit tests for serializeScene and parseScene (TICKET-08b Item B).
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { parseScene, serializeScene, type SceneDoc } from './scene-tab';

test('serializeScene and parseScene round-trip a valid SceneDoc with normalized transforms', () => {
  const doc: SceneDoc = {
    name: 'Outpost Alpha',
    items: [
      {
        id: 'mill-1',
        assetId: 'mill',
        t: { offset: [1.23456, 0, -4.5], yaw: 45, scale: 1 },
      },
      {
        id: 'press-2',
        assetId: 'press-frame',
        t: { offset: [-3, 0.5, 2.125], yaw: -90, scale: 1.25 },
      },
    ],
  };

  const json = serializeScene(doc);
  const parsed = parseScene(json);

  assert.equal(parsed.name, 'Outpost Alpha');
  assert.equal(parsed.items.length, 2);
  assert.deepEqual(parsed.items[0], {
    id: 'mill-1',
    assetId: 'mill',
    t: { offset: [1.235, 0, -4.5], yaw: 45, scale: 1 },
  });
  assert.deepEqual(parsed.items[1], {
    id: 'press-2',
    assetId: 'press-frame',
    t: { offset: [-3, 0.5, 2.125], yaw: -90, scale: 1.25 },
  });
  assert.equal(serializeScene(parsed), json);
});

test('parseScene rejects malformed JSON, missing fields, duplicate ids, and non-positive scale', () => {
  assert.throws(() => parseScene(''), /Empty scene JSON/i);
  assert.throws(() => parseScene('{not valid json'), /Invalid scene JSON/i);
  assert.throws(() => parseScene('[]'), /SceneDoc must be a JSON object/i);
  assert.throws(() => parseScene(JSON.stringify({ name: '   ', items: [] })), /name/i);
  assert.throws(() => parseScene(JSON.stringify({ name: 'Valid', items: 'not-array' })), /items/i);
  assert.throws(
    () =>
      parseScene(
        JSON.stringify({
          name: 'Bad Offset',
          items: [{ id: 'a', assetId: 'mill', t: { offset: [1, 2], yaw: 0, scale: 1 } }],
        }),
      ),
    /offset/i,
  );
  assert.throws(
    () =>
      parseScene(
        JSON.stringify({
          name: 'Zero Scale',
          items: [{ id: 'a', assetId: 'mill', t: { offset: [0, 0, 0], yaw: 0, scale: 0 } }],
        }),
      ),
    /scale/i,
  );
  assert.throws(
    () =>
      parseScene(
        JSON.stringify({
          name: 'Duplicate IDs',
          items: [
            { id: 'dup', assetId: 'mill', t: { offset: [0, 0, 0], yaw: 0, scale: 1 } },
            { id: 'dup', assetId: 'press-frame', t: { offset: [2, 0, 0], yaw: 0, scale: 1 } },
          ],
        }),
      ),
    /Duplicate SceneItem id/i,
  );
});
