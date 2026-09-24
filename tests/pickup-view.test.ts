/**
 * M01 — **the powerups are drawn where the physics collects them.**
 *
 * Two holes, closed together. `assets.pickupSprites` were painted and the engine has always loaded
 * them — and then nothing ever drew them: pickups were collectible (the HUD shows the charges) and
 * invisible. And `createAirPickups` lays the field out on the legacy four lanes, which under an
 * authored network may be in mid-air beside the road.
 *
 * Both halves are asserted here without a browser: three.js builds sprites, materials and textures in
 * node, and the layout function is pure.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { PickupView, PICKUP_HIDDEN_SECONDS, PICKUP_SPRITE_SIZE } from '../src/game/pickup-view';
import {
  createAirPickups, layoutPickupsForNetwork, pickupY, type AirPickup, type PowerupKind,
} from '../src/game/powerups';
import { createTrackLayout } from '../src/game/track-layout';
import { placementFromEngine, getTrackSpace } from '../src/game/track-space';
import { sampleLaneNetwork, sampleLane } from '../src/game/lane-network';
import { closestLane, RADIUS } from '../src/game/scene';

/** A canvas-shaped stand-in: `CanvasTexture` only needs something image-like for `image`. */
function fakeCanvas(): HTMLCanvasElement {
  return { width: 64, height: 64 } as unknown as HTMLCanvasElement;
}
const ART: Partial<Record<PowerupKind, HTMLCanvasElement>> = {
  fuel: fakeCanvas(), shield: fakeCanvas(), bounce: fakeCanvas(),
};

function makeView() {
  const scene = new THREE.Scene();
  const view = new PickupView(scene, ART, getTrackSpace());
  return { scene, view };
}

const pickups = () => createAirPickups('ridge', createTrackLayout('ridge'));

test('every pickup is drawn, at the exact point the collection solve tests against', () => {
  const { view } = makeView();
  const list = pickups();
  assert.ok(list.length > 10, `the ridge course has a field of pickups (${list.length})`);
  view.update(list, 3.25, false, 40);

  assert.equal(view.poolSize, list.length, 'one sprite per pickup');
  assert.equal(view.stats.visible, list.length, 'and all of them are visible');
  assert.equal(view.stats.hidden, 0, 'none of them has been taken yet');
  assert.equal(view.stats.spritesBuilt, list.length, 'built once');
  assert.equal(view.stats.materialsCreated, 3, 'one material per kind, not one per pickup');
  assert.equal(view.stats.texturesCreated, 3, 'and one texture per kind');

  // Position: the mapping the racers use, fed the bobbed height the solve reads. Any drift here is a
  // sprite a player aims at and misses.
  for (let index = 0; index < list.length; index++) {
    const pickup = list[index];
    const sprite = view.root.children[index] as THREE.Sprite;
    const y = pickupY(pickup, 3.25, false);
    const placement = placementFromEngine(getTrackSpace(), { x: pickup.x, z: pickup.z, y });
    assert.equal(sprite.position.x, placement.world.x, `pickup ${pickup.id} x`);
    assert.equal(sprite.position.y, placement.world.y, `pickup ${pickup.id} y`);
    assert.equal(sprite.position.z, placement.world.z, `pickup ${pickup.id} z`);
    assert.equal(sprite.scale.x, PICKUP_SPRITE_SIZE);
    assert.ok(sprite.visible);
  }
});

test('the bob is the solve\'s own bob, and reduced motion stills it', () => {
  const { view } = makeView();
  const list = pickups().slice(0, 4);
  view.update(list, 0, false, 10);
  const moving = list.map((_, index) => (view.root.children[index] as THREE.Sprite).position.y);

  view.update(list, 0.9, false, 10);
  const later = list.map((_, index) => (view.root.children[index] as THREE.Sprite).position.y);
  assert.ok(moving.some((y, index) => Math.abs(y - later[index]) > 1e-6), 'the field floats');

  view.update(list, 0.9, true, 10);
  const still = list.map((_, index) => (view.root.children[index] as THREE.Sprite).position.y);
  view.update(list, 1.8, true, 10);
  const stillLater = list.map((_, index) => (view.root.children[index] as THREE.Sprite).position.y);
  assert.deepEqual(still, stillLater, 'reduced motion: no bob at all');
});

test('a collected pickup is not drawn, and comes back when its window has passed', () => {
  const { view } = makeView();
  const list = pickups().slice(0, 3);
  list[1].collectedBy = 0;
  list[1].collectedAt = 20;

  view.update(list, 0, false, 21);
  assert.equal(view.stats.visible, 2, 'the taken one is not drawn');
  assert.equal(view.stats.hidden, 1);
  assert.equal((view.root.children[1] as THREE.Sprite).visible, false);

  view.update(list, 0, false, 20 + PICKUP_HIDDEN_SECONDS - 0.01);
  assert.equal((view.root.children[1] as THREE.Sprite).visible, false, 'still hidden inside the window');

  view.update(list, 0, false, 20 + PICKUP_HIDDEN_SECONDS);
  assert.equal((view.root.children[1] as THREE.Sprite).visible, true, 'and back once the window closes');
});

test('the pool is a pool: a shorter field reuses sprites and builds nothing', () => {
  const { view } = makeView();
  const list = pickups();
  view.update(list, 0, false, 0);
  const built = view.stats.spritesBuilt;
  assert.equal(built, list.length);

  view.update(list.slice(0, 5), 0, false, 0);
  assert.equal(view.stats.spritesBuilt, built, 'no new sprites for a shorter list');
  assert.equal(view.stats.visible, 5);
  assert.equal((view.root.children[built - 1] as THREE.Sprite).visible, false, 'the spares are hidden');

  view.update(list, 0, false, 0);
  assert.equal(view.stats.spritesBuilt, built, 'and the full field again costs nothing');
  assert.equal(view.stats.visible, list.length);

  const hidden = view.stats.hidden;
  view.hideAll();
  assert.equal(view.stats.visible, 0, 'hide all is for the pause screen');
  assert.equal(view.stats.hidden, hidden, 'and it is not a collection');
});

test('a kind with no art is skipped rather than drawn wrong', () => {
  const scene = new THREE.Scene();
  const view = new PickupView(scene, { fuel: fakeCanvas() }, getTrackSpace());
  const list = pickups();
  view.update(list, 0, false, 0);
  const fuel = list.filter((pickup) => pickup.kind === 'fuel').length;
  assert.equal(view.stats.visible, fuel, 'only the kind we have art for');
  assert.equal(view.stats.materialsCreated, 1);
});

test('dispose leaves the scene as it found it, textures and all', () => {
  const scene = new THREE.Scene();
  const before = scene.children.length;
  const view = new PickupView(scene, ART, getTrackSpace());
  view.update(pickups(), 0, false, 0);
  view.dispose();
  assert.equal(scene.children.length, before, 'the scene is exactly as it was');
  assert.equal(view.poolSize, 0);
  assert.equal(view.stats.visible, 0);
});

test('under a network the pickups move onto it, and a pickup with no road under it is dropped', () => {
  const bare = pickups();
  const network = sampleLaneNetwork('ridge');
  const laid = layoutPickupsForNetwork(bare, network);

  assert.ok(laid.length > 0, 'most of the field survives');
  assert.ok(laid.length <= bare.length, 'and none is invented');
  for (const pickup of laid) {
    // Each one is now on the network's own centre at its x — the same call the steering uses.
    const entries = network.paths
      .map((path) => ({ pathId: path.id, sample: sampleLane(network, path.id, pickup.x) }))
      .filter((entry) => entry.sample !== null);
    assert.ok(entries.length > 0, `pickup ${pickup.id} at x ${pickup.x} is over the authored road`);
    const nearest = entries.reduce((best, entry) => (
      Math.abs(entry.sample!.z - pickup.z) < Math.abs(best.sample!.z - pickup.z) ? entry : best
    ));
    assert.equal(pickup.z, nearest.sample!.z, `pickup ${pickup.id} sits on the nearest lane centre`);
    assert.equal(pickup.lane, closestLane(pickup.z), 'and its lane label agrees with its z');
  }

  // Altitude is untouched: the network says nothing about heights.
  for (const pickup of laid) {
    const original = bare.find((candidate) => candidate.x === pickup.x && candidate.kind === pickup.kind);
    assert.ok(original, 'a laid pickup corresponds to an original');
    assert.equal(pickup.y, original!.y, 'y is the pickup\'s own altitude design');
  }
  // Ids stay dense so the sprite pool and the saves agree.
  assert.deepEqual(laid.map((pickup) => pickup.id), laid.map((_, index) => index));

  // A pickup stranded away from every path — the whole point of the function — is dropped.
  const stranded: AirPickup[] = [{ id: 0, kind: 'fuel', x: 30_000, y: 106, z: 2_000, lane: 0, collectedBy: null, collectedAt: -100 }];
  assert.deepEqual(layoutPickupsForNetwork(stranded, network), [], 'no road under it, no pickup');
});

test('no network means the legacy layout, value for value', () => {
  const bare = pickups();
  const same = layoutPickupsForNetwork(bare, null);
  assert.notEqual(same, bare, 'a new list, not the caller\'s');
  assert.deepEqual(same, bare, 'with exactly the values it came in with');
  assert.equal(same[0].z, bare[0].z);
  assert.equal(same[0].lane, bare[0].lane);
});

test('the wiring: the renderer draws the frame\'s pickups, the engine lays them on the network', () => {
  const renderer = readFileSync(new URL('../src/game/renderer-3d.ts', import.meta.url), 'utf8');
  assert.match(renderer, /new PickupView\(this\.scene, this\.storedAssets\.pickupSprites/,
    'the layer is built from the painted sprites');
  assert.match(renderer, /this\.pickupView\.update\(frame\.pickups, frame\.time, frame\.reducedMotion, frame\.runTime/,
    'and updated from the frame\'s own list');
  assert.match(renderer, /this\.pickupView\?\.dispose\(\)/, 'and disposed with the renderer');

  const engine = readFileSync(new URL('../src/game/engine.ts', import.meta.url), 'utf8');
  assert.match(engine, /layoutPickupsForNetwork\(\s*createAirPickups\(/,
    'the engine lays a fresh field out on the authored network');
  assert.match(engine, /layoutPickupsForNetwork\(this\.pickups, network\)/,
    'and re-lays it when Test drive hands a new document over');
  assert.match(new URL('../src/game/powerups.ts', import.meta.url).pathname ? engine : engine, /RADIUS/, 'sanity');
});
