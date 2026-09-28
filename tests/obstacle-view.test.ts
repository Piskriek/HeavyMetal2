/**
 * The race's obstacle layer: every gameplay obstacle the physics can hit has a marker in the 3D
 * scene, at the physics' own lane and distance; TNT and sheep markers vanish when hit.
 *
 * And — the wiring wave — every one of those markers is **painted art**: a texture on the road for
 * pads, gaps and ramps, a painted billboard for the things standing on it, painted sheets for the
 * cauldron and the pinball spinner, and a warning sign before every gap. No kind is a flat colour
 * or a tinted box any more, and reduced motion holds every sheet on frame 0 with the chevrons still.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import * as THREE from 'three';
import {
  GAP_SIGN_LEAD, OBSTACLE_ART, ObstacleView, TRACK_ART, TRACK_ART_PATHS,
  obstacleArtFor, sheetFrameAt, spinnerFrameAt,
} from '../src/game/obstacle-view';
import { createTrackLayout } from '../src/game/track-layout';
import { withoutLoopRides } from '../src/game/sim/decor-loops';
import { passageMouthX } from '../src/game/qualifying/passage';
import { createQualifyingGate } from '../src/game/qualifying/gate';
import { getTrackSpace, worldFromCanonical, engineDistanceFromX } from '../src/game/track-space';
import { RADIUS, obstacleZ, type Obstacle } from '../src/game/scene';

const root = fileURLToPath(new URL('../', import.meta.url));

function raceLayout() {
  const built = createTrackLayout('ridge');
  return withoutLoopRides(createTrackLayout('ridge', { skipBeforeX: passageMouthX(), keepLoopsFromX: createQualifyingGate('ridge', built).x }));
}

/** The kinds the physics can hit and the view therefore has to draw. */
const HITTABLE = ['gap', 'boost', 'ramp', 'sheep', 'tnt', 'spring', 'pinball_spinner', 'rock_gate', 'water_rock', 'cauldron', 'roller_rails'];

test('every hittable obstacle gets a marker; only scenery kinds are skipped', () => {
  const layout = raceLayout();
  const scene = new THREE.Scene();
  const view = new ObstacleView(scene, {}, getTrackSpace());
  view.update(layout, 0, false);
  const hittable = layout.filter((o) => HITTABLE.includes(o.kind));
  assert.equal(view.stats.drawn, hittable.length, `${view.stats.drawn} markers for ${hittable.length} hittable obstacles`);
  assert.ok(view.stats.drawn >= 130, `${view.stats.drawn} markers`);
  const again = view.root.children.length;
  view.update(layout, 0, false); // same layout: no rebuild
  assert.equal(view.root.children.length, again);
});

test('no obstacle kind is drawn as a tinted box or a flat colour: every marker is painted art', () => {
  // 1. The declaration: every hittable kind names painted art, and the art really ships.
  for (const kind of HITTABLE) {
    const art = obstacleArtFor(kind);
    assert.ok(art, `${kind} must declare painted art`);
    if (art.style === 'sprite') {
      // The game's own painted sprite sheet (sheep, TNT, springs).
      assert.equal(existsSync(join(root, 'public/art/track-sprites.png')), true);
      continue;
    }
    assert.match(art.art, /^\/art\//, `${kind} names a painted file`);
    assert.equal(existsSync(join(root, 'public', art.art.replace(/^\//, ''))), true, `${art.art} must ship`);
  }
  // Every file the layer draws with is in the preload list, so nothing decodes mid-race.
  for (const art of Object.values(OBSTACLE_ART)) {
    if (art.style === 'sprite') continue;
    assert.equal(TRACK_ART_PATHS.includes(art.art), true, `${art.art} is preloaded`);
  }
  assert.equal(TRACK_ART_PATHS.includes(TRACK_ART.gapSign), true, 'the gap sign is preloaded');
  assert.equal(TRACK_ART_PATHS.includes(TRACK_ART.shieldBubble), true, 'the shield bubble is preloaded');

  // 2. The scene: every marker the view builds records the painted art it wears.
  const layout = raceLayout();
  const scene = new THREE.Scene();
  const view = new ObstacleView(scene, {}, getTrackSpace());
  view.update(layout, 0, false);
  const kinds = new Set<string>();
  for (const child of view.root.children) {
    assert.ok(child.userData.art, `${child.name} is painted art, not a colour`);
    kinds.add(String(child.name).replace('Obstacle_', ''));
  }
  for (const kind of HITTABLE) {
    if (layout.some((o) => o.kind === kind)) assert.equal(kinds.has(kind), true, `${kind} is drawn`);
  }

  // 3. The source keeps no interim colour table and no wireframe.
  const source = readFileSync(join(root, 'src/game/obstacle-view.ts'), 'utf8');
  assert.doesNotMatch(source, /BLOCK_COLOURS/, 'the tinted-block table is gone');
  assert.doesNotMatch(source, /0x8a5a2b|0xff8a1f|0x070504/, 'the flat road colours are gone');
});

test('a gap marker lies on the road in the gap lane, and its warning sign stands before it', () => {
  const layout = raceLayout();
  const gap = layout.find((o) => o.kind === 'gap')!;
  const scene = new THREE.Scene();
  const view = new ObstacleView(scene, {}, getTrackSpace());
  view.update([gap], 0, false);
  const group = view.root.children[0] as THREE.Group;
  const mesh = group.children[0] as THREE.Mesh;
  mesh.geometry.computeBoundingBox();
  const centre = new THREE.Vector3(); mesh.geometry.boundingBox!.getCenter(centre);
  const map = getTrackSpace();
  const s = map.trackDistFromEngineDistance(engineDistanceFromX(gap.x + gap.width / 2));
  const expect = worldFromCanonical(map, { s, laneZ: obstacleZ(gap), altitude: -RADIUS });
  const d = Math.hypot(centre.x - expect.world.x, centre.y - expect.world.y, centre.z - expect.world.z);
  assert.ok(d < 40, `gap marker ${d.toFixed(1)} units from the physics gap`);

  // The sign stands a fixed lead before the gap, in the gap's own lane.
  const sign = group.children[1];
  assert.ok(sign, 'a gap is announced');
  assert.equal(sign.userData.art, TRACK_ART.gapSign);
  const ahead = map.trackDistFromEngineDistance(engineDistanceFromX(gap.x - GAP_SIGN_LEAD));
  const signSpot = worldFromCanonical(map, { s: ahead, laneZ: obstacleZ(gap), altitude: 0 });
  const lead = Math.hypot(sign.position.x - signSpot.world.x, sign.position.z - signSpot.world.z);
  assert.ok(lead < 60, `the sign stands ${GAP_SIGN_LEAD} before the gap (${lead.toFixed(1)} off)`);
  assert.equal(GAP_SIGN_LEAD, 400);
});

test('reduced motion: the chevrons stop scrolling and every sheet holds frame 0', () => {
  const sheet = { cols: 2, rows: 2, fps: 12 };
  assert.equal(sheetFrameAt(sheet, 0.4, false), 4 % 4, 'the sheet plays on its own clock');
  assert.equal(sheetFrameAt(sheet, 0.13, false), 1);
  assert.equal(sheetFrameAt(sheet, 9.7, true), 0, 'reduced motion holds frame 0');

  const spinner: Obstacle = { ...createTrackLayout('ridge').find((o) => o.kind === 'pinball_spinner')! };
  assert.equal(spinnerFrameAt(spinner, 5.5, true), 0, 'the spinner holds frame 0 too');
  const frames = new Set([0, 0.09, 0.18, 0.27].map((t) => spinnerFrameAt(spinner, t, false)));
  assert.ok(frames.size > 1, 'and turns with the sim otherwise');
  // The sim state drives the phase: a spinner already part-way round is not in lockstep with a
  // freshly authored one.
  const turned: Obstacle = { ...spinner, spinAngle: 180 };
  assert.notEqual(spinnerFrameAt(turned, 0, false), spinnerFrameAt(spinner, 0, false));

  // The boost pad's chevrons scroll, and stop dead under reduced motion.
  const boost = raceLayout().find((o) => o.kind === 'boost')!;
  const pads = [boost];
  const scene = new THREE.Scene();
  const view = new ObstacleView(scene, {}, getTrackSpace());
  view.update(pads, 0, false);
  const material = (view.root.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial;
  const map = material.map!;
  assert.ok(map, 'the pad wears the chevron texture');
  view.update(pads, 1.5, false);
  const moving = map.offset.y;
  assert.notEqual(moving, 0, 'the chevrons scroll toward the direction of travel');
  view.update(pads, 3, true);
  assert.equal(map.offset.y, 0, 'reduced motion parks them');

  // The spinner marker itself: its texture walks the sheet, and stops on frame 0.
  const spinners = [spinner];
  const spinnerView = new ObstacleView(new THREE.Scene(), {}, getTrackSpace());
  spinnerView.update(spinners, 0, false);
  const spinnerMap = ((spinnerView.root.children[0] as THREE.Sprite).material as THREE.SpriteMaterial).map!;
  const cell = () => `${spinnerMap.offset.x.toFixed(2)},${spinnerMap.offset.y.toFixed(2)}`;
  const start = cell();
  spinnerView.update(spinners, 0.2, false);
  assert.notEqual(cell(), start, 'the spinner plays its sheet');
  spinnerView.update(spinners, 5, true);
  assert.equal(cell(), '0.00,0.50', 'and holds the top-left frame under reduced motion');
});

test('TNT and sheep markers disappear once hit; the renderer draws the layer every frame', () => {
  const layout = raceLayout();
  const tnt = { ...layout.find((o) => o.kind === 'tnt')! };
  const scene = new THREE.Scene();
  const view = new ObstacleView(scene, {}, getTrackSpace());
  const list = [tnt];
  view.update(list, 0, false);
  assert.equal(view.root.children[0].visible, true);
  tnt.hit = true; view.update(list, 0, false);
  assert.equal(view.root.children[0].visible, false);
  const r = readFileSync(new URL('../src/game/renderer-3d.ts', import.meta.url), 'utf8');
  assert.match(r, /this\.obstacleView\.update\(frame\.obstacles\);/);
});
