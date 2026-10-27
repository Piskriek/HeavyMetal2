// Plan 49 Mission 1: the ping's pure half — what a hit is called, how the marker pulses and dies, and what the bridge gets.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyPing,
  kitName,
  nearestPingHit,
  pingCallout,
  pingEvent,
  pingLabel,
  pingPulse,
  pingSizeM,
  pingTargetOf,
  PING_DROP_FROM,
  PING_DROP_S,
  PING_FADE_S,
  PING_LIFE_S,
  type PingHit,
} from './ping';

const up = { x: 0, y: 1, z: 0 };
const hit = (over: Partial<PingHit>): PingHit => ({ point: { x: 0, y: 0, z: 0 }, normal: up, distance: 5, source: 'ground', ...over });

test('a hit is classified by what the ray met', () => {
  assert.equal(classifyPing(hit({ source: 'kit', kitId: 'gate' })), 'machine');
  assert.equal(classifyPing(hit({ source: 'kit', kitId: 'plot:mill-3@120' })), 'machine');
  assert.equal(classifyPing(hit({ source: 'kit', kitId: 'vehicle-scout' })), 'rover');
  assert.equal(classifyPing(hit({ source: 'kit', kitId: 'player-rig' })), 'creation');
  assert.equal(classifyPing(hit({ source: 'kit', kitId: 'astro-suit' })), 'prop');
  assert.equal(classifyPing(hit({ source: 'piece', objectId: 'piece:12' })), 'structure');
  assert.equal(classifyPing(hit({ source: 'clutter', objectId: 'crate-2' })), 'prop');
  assert.equal(classifyPing(hit({ source: 'ground' })), 'terrain');
  // the lab shell: the floor is ground, a wall is a wall
  assert.equal(classifyPing(hit({ source: 'shell', normal: up })), 'terrain');
  assert.equal(classifyPing(hit({ source: 'shell', normal: { x: 0, y: 0, z: 1 } })), 'wall');
  assert.equal(classifyPing(hit({ source: 'shell', normal: { x: 0.3, y: 0.5, z: 0.81 } })), 'wall');
});

test('the wire target rounds to centimetres, normalises the normal and names the entity', () => {
  const t = pingTargetOf(
    hit({ source: 'kit', kitId: 'gate', partId: 'rim-front', part: 'hazard-rim', material: 'hazard', point: { x: 0.123456, y: 0.0849, z: -6.4049 }, normal: { x: 0, y: 0, z: 2 }, distance: 6.3333 }),
    'lab',
  );
  assert.deepEqual(t, {
    x: 0.12, y: 0.08, z: -6.4,
    normal: { x: 0, y: 0, z: 1 },
    entityType: 'machine', entityId: 'gate', kitId: 'gate', partId: 'rim-front', part: 'hazard-rim', material: 'hazard',
    distance: 6.33,
  });
  // no kit: the surface names itself, by the lab's compass (west is -x, north is -z)
  assert.equal(pingTargetOf(hit({ source: 'shell', normal: up }), 'lab').entityId, 'lab-floor');
  assert.equal(pingTargetOf(hit({ source: 'shell', normal: { x: 0, y: -1, z: 0 } }), 'lab').entityId, 'lab-ceiling');
  assert.equal(pingTargetOf(hit({ source: 'shell', normal: { x: 1, y: 0, z: 0 } }), 'lab').entityId, 'lab-wall-west');
  assert.equal(pingTargetOf(hit({ source: 'shell', normal: { x: 0, y: 0, z: 1 } }), 'lab').entityId, 'lab-wall-north');
  assert.equal(pingTargetOf(hit({ source: 'ground' }), 'planet').entityId, 'ground');
  assert.equal(pingTargetOf(hit({ source: 'piece', objectId: 'piece:7' }), 'planet').entityId, 'piece:7');
  // optional fields stay off the wire when the hit has none
  assert.equal('kitId' in pingTargetOf(hit({}), 'planet'), false);
});

test('the nearest hit wins and a missing cast is skipped', () => {
  const a = hit({ distance: 9 });
  const b = hit({ distance: 4, source: 'kit', kitId: 'gate' });
  assert.equal(nearestPingHit([a, null, b]), b);
  assert.equal(nearestPingHit([null, null]), null);
  assert.equal(nearestPingHit([hit({ distance: Number.NaN }), a]), a);
});

test('the names Piskriek hears and reads', () => {
  assert.equal(kitName('gate'), 'Quantum archway gate');
  assert.equal(kitName('gate-dais'), 'Gate dais');
  assert.equal(kitName('vehicle-scout'), 'Scout rover');
  assert.equal(kitName('plot:mill-3@120'), 'Mill');
  assert.equal(kitName('relay-cabinet'), 'Relay cabinet');
  const t = pingTargetOf(hit({ source: 'kit', kitId: 'gate', partId: 'rim-front', part: 'hazard-rim', point: { x: 0, y: 0.1, z: -6.4 }, distance: 6.3 }), 'lab');
  assert.equal(pingLabel(t), 'Quantum archway gate · rim front');
  assert.equal(pingCallout(t), 'Target locked: Quantum archway gate, rim front, at (0.0, -6.4), 6.3 m.');
  assert.equal(pingLabel(pingTargetOf(hit({ source: 'shell', normal: { x: -1, y: 0, z: 0 } }), 'lab')), 'Lab wall, east side');
  assert.equal(pingLabel(pingTargetOf(hit({ source: 'ground' }), 'planet')), 'Ground');
  const e = pingEvent(t, 'lab');
  assert.equal(e.type, 'ping');
  assert.equal(e.where, 'lab');
  assert.equal(e.target.kitId, 'gate');
  assert.equal(e.label, 'Quantum archway gate · rim front');
});

test('the marker drops in, breathes, fades over its last half second and is gone at 3 s', () => {
  const born = pingPulse(0);
  assert.equal(born.alive, true);
  assert.ok(Math.abs(born.scale - PING_DROP_FROM) < 1e-9, 'the brackets start wide');
  assert.ok(Math.abs(pingPulse(PING_DROP_S).scale - 1) < 1e-9, 'and land on the reticle');
  // the breathing stays within its depth
  for (let t = PING_DROP_S; t < PING_LIFE_S; t += 0.01) {
    const p = pingPulse(t);
    assert.ok(p.scale > 0.93 && p.scale < 1.07, `scale ${p.scale} at ${t}`);
  }
  assert.equal(pingPulse(PING_LIFE_S - PING_FADE_S).alpha, 1);
  assert.ok(Math.abs(pingPulse(PING_LIFE_S - PING_FADE_S / 2).alpha - 0.5) < 1e-9);
  assert.equal(pingPulse(PING_LIFE_S).alive, false);
  assert.equal(pingPulse(-1).alive, false);
  assert.equal(pingPulse(Number.NaN).alive, false);
  // the ripple grows out and fades within each period
  const early = pingPulse(0.76);
  const late = pingPulse(1.4);
  assert.ok(late.ripple > early.ripple && late.rippleAlpha < early.rippleAlpha);
});

test('the reticle reads at distance and stays small up close', () => {
  assert.equal(pingSizeM(1), 0.28);
  assert.ok(Math.abs(pingSizeM(20) - 0.9) < 1e-9);
  assert.equal(pingSizeM(200), 2.4);
});
