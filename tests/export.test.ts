import test from 'node:test';
import assert from 'node:assert/strict';
import {
  exportSceneDoc,
  applyRoundTrip,
} from '../src/game/export/scene-export';
import {
  createHmtPackage,
  parseHmtPackage,
} from '../src/game/export/track-package';
import { UNITS_PER_METER } from '../src/game/assets/model-import';
import type { PlacedProp } from '../src/game/track-builder-3d';

test('T8 Export: GLB export scales to meters and attaches extras', () => {
  const props: PlacedProp[] = [
    {
      id: 'prop_barrel_1',
      type: 'barrel',
      name: 'Explosive Barrel',
      x: 124, // 124 / 62 = 2.0 meters
      y: 62,  // 62 / 62 = 1.0 meter
      z: -186, // -186 / 62 = -3.0 meters
      rotY: 1.57,
      scale: 1.2,
      alignToTrack: false,
    },
  ];

  const doc = exportSceneDoc(props);
  assert.equal(doc.version, 2);
  assert.equal(doc.nodes.length, 1);

  const node = doc.nodes[0];
  assert.equal(node.extras.hm2PropId, 'prop_barrel_1');
  assert.equal(node.extras.hm2Type, 'barrel');
  assert.equal(node.position[0], 2.0);
  assert.equal(node.position[1], 1.0);
  assert.equal(node.position[2], -3.0);
});

test('T8 Export: applyRoundTrip matches IDs and converts meters to world units', () => {
  const currentProps: PlacedProp[] = [
    {
      id: 'prop_crate_1',
      type: 'crate',
      name: 'Crate',
      x: 62,
      y: 0,
      z: 0,
      rotY: 0,
      scale: 1,
      alignToTrack: false,
    },
  ];

  // Modified in Blender: moved from 1 meter to 5 meters along X
  const importedDoc = {
    generator: 'HeavyMetalGP2-Forge',
    version: 2,
    scaleUnitsPerMeter: UNITS_PER_METER,
    nodes: [
      {
        name: 'crate_prop_crate_1',
        position: [5, 0, 0] as [number, number, number], // 5 meters = 310 world units
        rotation: [0, 0.5, 0] as [number, number, number],
        scale: [1, 1, 1] as [number, number, number],
        extras: {
          hm2PropId: 'prop_crate_1',
          hm2Type: 'crate',
          hm2Version: 2,
        },
      },
    ],
  };

  const res = applyRoundTrip(currentProps, importedDoc);
  assert.equal(res.changedCount, 1);
  assert.equal(res.unrecognizedNodeCount, 0);

  const updated = res.updatedProps[0];
  assert.equal(updated.x, 310);
  assert.equal(updated.rotY, 0.5);
});

test('T8 Export: .hmt package serialization and validation', () => {
  const trackDoc: any = {
    version: 2,
    courseId: 'ridge',
    props: [],
  };

  const pkg = createHmtPackage(trackDoc);
  assert.equal(pkg.format, 'hmt');
  assert.equal(pkg.version, 2);

  const jsonStr = JSON.stringify(pkg);
  const parseRes = parseHmtPackage(jsonStr);
  assert.equal(parseRes.ok, true);
  if (!parseRes.ok) return;

  assert.equal(parseRes.pkg.track.courseId, 'ridge');

  // Corrupt string test
  const badRes = parseHmtPackage('not a json');
  assert.equal(badRes.ok, false);
});
