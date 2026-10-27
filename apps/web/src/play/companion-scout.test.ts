// Plan 50 §3: "find me guns" is one member of a category; the drone finds and marks the whole category.
import test from 'node:test';
import assert from 'node:assert/strict';
import { compass, nearestPoi, parseScoutOrder, scoutLine, SCOUT_CATEGORIES, type PointOfInterest } from './companion-scout';

test('find orders name every category, the owner\'s example among them', () => {
  assert.equal(parseScoutOrder('find me guns'), 'weapons');
  assert.equal(parseScoutOrder('look for weapons'), 'weapons');
  assert.equal(parseScoutOrder('any ammo around?'), 'ammo');
  assert.equal(parseScoutOrder('I need health'), 'health');
  assert.equal(parseScoutOrder('find some ore'), 'resources');
  assert.equal(parseScoutOrder('search for loot'), 'salvage');
  assert.equal(parseScoutOrder('where is the exit'), 'exits');
  assert.equal(parseScoutOrder('scout for enemies'), 'enemies');
  assert.equal(parseScoutOrder('mark the hazards'), 'hazards');
  assert.equal(parseScoutOrder('find the tapes'), 'secrets');
  assert.equal(parseScoutOrder('where are the keys'), 'keys');
  assert.equal(parseScoutOrder('get me a rover'), 'vehicles');
  // not a find order
  assert.equal(parseScoutOrder('follow me'), null);
  assert.equal(parseScoutOrder('guns are cool'), null);
  assert.equal(SCOUT_CATEGORIES.length, 14);
});

test('the nearest point of interest and a compass bearing by the game\'s compass (north is -z)', () => {
  const pois: PointOfInterest[] = [
    { category: 'resources', x: 10, y: 0, z: 0, label: 'an ore boulder' },
    { category: 'resources', x: 0, y: 0, z: -4, label: 'an ore boulder' },
  ];
  assert.equal(nearestPoi(pois, 0, 0), pois[1]);
  assert.equal(nearestPoi([], 0, 0), null);
  assert.equal(compass(0, 0, 0, -5), 'north');
  assert.equal(compass(0, 0, 5, 0), 'east');
  assert.equal(compass(0, 0, -5, 5), 'south-west');
  assert.equal(scoutLine('resources', pois[1]!, { x: 0, z: 0 }, 2), 'Marked: an ore boulder, 4 m north. 1 more nearby.');
});

test('a category this world has no source for gets a plain answer, not silence', () => {
  assert.match(scoutLine('ammo', null, { x: 0, z: 0 }, 0), /no ammo/);
  assert.match(scoutLine('health', null, { x: 0, z: 0 }, 0), /Nothing heals/);
  assert.equal(scoutLine('vehicles', null, { x: 0, z: 0 }, 0), 'No vehicles in range of this world right now.');
});
