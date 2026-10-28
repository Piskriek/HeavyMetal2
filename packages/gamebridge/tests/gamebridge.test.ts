// Plan 51 Wave 2: the game bridge for ANY game, by permission. Assets never cross; mechanics always do (a game no one
// checked bridges through its own telemetry or the screen); official telemetry maps through presets (data, not code) into the harness, which must recover what it was made with.
import test from 'node:test';
import assert from 'node:assert/strict';
import { transduceMechanic, type MechanicObservation } from '@hm/harness';
import {
  allowedChannels, anonymizeEvents, bestChannel, checkBridgeProfile, createTelemetryAccumulator, decodeBridgeProfileCode, encodeBridgeProfileCode, gameIdOf,
  gateObservation, profileLine, rankRunningGames, readPath, uncheckedProfile, type BridgePermissionProfile,
} from '../src/index';

const profile = (over: Record<string, unknown> = {}): BridgePermissionProfile => checkBridgeProfile({
  schema: 'hm2:bridge-profile:v1', gameId: 'testgame', title: 'Test Game', verdict: 'permitted',
  channels: ['telemetry', 'screen'], streams: ['mechanics', 'telemetry', 'entity-kinds'], soloOnly: true,
  sources: [{ url: 'https://example.com/eula', quote: 'You may read game state through the official integration.' }],
  checkedBy: 'claude-opus via the bridge', checkedOn: '2026-10-28', setup: ['Turn on game state integration.'], notes: [],
  ...over,
})!;

test('a profile is checked strictly: assets never cross, mechanics always do, a refusal keeps only the floor, junk is refused', () => {
  const p = profile({ streams: ['mechanics', 'assets', 'telemetry'] });
  assert.deepEqual(p.streams, ['mechanics', 'telemetry'], 'assets stripped whatever the profile says');
  assert.deepEqual(profile({ streams: ['telemetry'] }).streams, ['mechanics', 'telemetry'], 'mechanics are always in');
  const refused = profile({ verdict: 'refused', channels: ['mod-loader', 'telemetry'], soloOnly: false });
  assert.deepEqual([refused.channels, refused.streams, refused.soloOnly], [['telemetry', 'screen'], ['mechanics'], true]);
  assert.equal(checkBridgeProfile({ ...profile(), gameId: '../etc' }), null);
  assert.equal(checkBridgeProfile({ ...profile(), schema: 'v0' }), null);
  assert.equal(profile({ sources: [{ url: 'javascript:alert(1)', quote: 'x' }] }).sources.length, 0, 'only http(s) sources');
  assert.equal(profile({ channels: ['memory-hack', 'telemetry'] }).channels.join(), 'telemetry', 'no such rung');
  assert.equal(decodeBridgeProfileCode(encodeBridgeProfileCode(p))?.title, 'Test Game');
});

test('a game no one checked bridges its mechanics out of the box: its own telemetry and the screen, solo, and it says so', () => {
  const u = uncheckedProfile('Some Game');
  assert.deepEqual([u.verdict, u.channels, u.streams, u.soloOnly], ['unchecked', ['telemetry', 'screen'], ['mechanics'], true]);
  assert.match(profileLine(u), /Nobody checked its terms/);
  assert.match(profileLine(u), /Mechanics cross by telemetry > screen/);
  assert.match(profileLine(u), /Never its art, audio, models or text/);
  assert.match(profileLine(profile({ verdict: 'refused' })), /mechanics still cross/i);
  assert.equal(gameIdOf('Counter-Strike 2'), 'counter-strike-2');
  assert.equal(gameIdOf('cs2.exe'), 'cs2');
});

test('gating never refuses mechanics: unchecked, refused and mechanics-only profiles all pass trajectory, shots and rules', () => {
  const traj = { t: [0, 1], x: [0, 1], y: [0, 0], z: [0, 0] };
  const events = [{ t: 0, name: 'boss.state:Calm' }, { t: 1, name: 'boss.state:Enraged' }, { t: 2, name: 'boss.state:Calm' }];
  const fromTelemetry: MechanicObservation = { game: 'Test Game', channel: 'telemetry', trajectory: traj, shots: { t: [0, 0.2, 0.4] }, events };
  for (const p of [null, uncheckedProfile('Test Game'), profile({ verdict: 'refused' }), profile({ streams: ['mechanics'] })]) {
    for (const channel of ['telemetry', 'screen'] as const) {
      const r = gateObservation(p, { ...fromTelemetry, channel });
      assert.ok(r.observation?.trajectory && r.observation.shots && r.observation.events, `${p?.verdict ?? 'no profile'} via ${channel}`);
      // the rule keeps its shape and timing; the game's own words do not cross
      assert.deepEqual(r.observation.events, [{ t: 0, name: 'boss.state:#1' }, { t: 1, name: 'boss.state:#2' }, { t: 2, name: 'boss.state:#1' }]);
    }
  }
  // a checked profile that allows entity kinds keeps the names
  assert.deepEqual(gateObservation(profile(), fromTelemetry).observation?.events, events);
  // the deeper rungs touch the game's code or files: they need a checked profile that names them
  const loader: MechanicObservation = { ...fromTelemetry, channel: 'mod-loader' };
  const r = gateObservation(null, loader);
  assert.equal(r.observation, null);
  assert.match(r.dropped[0]!, /mod-loader rung needs a checked profile/);
  assert.ok(gateObservation(profile({ channels: ['mod-loader'] }), loader).observation);
  assert.equal(gateObservation(profile({ verdict: 'refused', channels: ['mod-loader'] }), loader).observation, null, 'a refusal drops the deeper rungs');
  assert.ok(gateObservation(null, { ...fromTelemetry, channel: 'synthetic' }).observation, 'test data always passes');
  assert.deepEqual(anonymizeEvents([{ t: 0, name: 'plain' }]), [{ t: 0, name: 'event:#1' }]);
  assert.deepEqual(allowedChannels(profile({ channels: ['game-files'] })), ['telemetry', 'game-files', 'screen'], 'the ladder order, floor included');
  assert.equal(bestChannel(profile(), ['screen', 'telemetry']), 'telemetry', 'best rung first');
  assert.equal(bestChannel(uncheckedProfile('x'), ['telemetry']), 'telemetry', 'the floor works unchecked');
  assert.equal(bestChannel(uncheckedProfile('x'), ['mod-sdk']), null);
});

test('official telemetry maps through a preset (data, not code) and the harness recovers the gravity it was made with', () => {
  // a GSI-style payload: position as an "x, y, z" string in centimetres, an ammo counter, a round phase
  const mapping = {
    t: { path: 'provider.timestamp' },
    x: { path: 'player.position', split: ',', index: 0, scale: 0.01 },
    y: { path: 'player.position', split: ',', index: 2, scale: 0.01 },
    z: { path: 'player.position', split: ',', index: 1, scale: 0.01 },
    shotCounter: { path: 'player.weapons.weapon_1.shots_fired' },
    events: ['round.phase'],
  };
  assert.equal(readPath({ player: { position: '120.5, -40, 64' } }, { path: 'player.position', split: ',', index: 1 }), -40);
  const acc = createTelemetryAccumulator(mapping);
  const g = 8, dt = 1 / 30;
  let h = 0, vy = 0, px = 0, fired = 0;
  for (let f = 0; f < 300; f++) {
    if (h <= 0 && f % 75 === 10) vy = 5;
    vy -= g * dt;
    h = Math.max(0, h + vy * dt);
    if (h === 0) vy = 0;
    px += (f < 150 ? 3 : 6) * dt;
    if (f % 6 === 0) fired += 1;
    acc.push({
      provider: { timestamp: f * dt },
      player: { position: `${(px * 100).toFixed(2)}, 0, ${(h * 100).toFixed(3)}`, weapons: { weapon_1: { shots_fired: fired } } },
      round: { phase: f < 200 ? 'live' : 'over' },
    }, 0);
  }
  const obs = acc.take('Test Game', 'telemetry')!;
  assert.ok(obs.trajectory && obs.shots && obs.events);
  assert.deepEqual(obs.events, [{ t: 200 * dt, name: 'round.phase:over' }]);
  assert.equal(acc.size(), 0, 'take clears');
  const gated = gateObservation(profile(), obs);
  const r = transduceMechanic(gated.observation!);
  assert.ok(Math.abs(r.locomotion!.gravityMps2 - g) / g < 0.05, `gravity ${r.locomotion!.gravityMps2}`);
  assert.ok(Math.abs(r.fire!.roundsPerSecond - 5) < 0.2, `fire ${r.fire!.roundsPerSecond}`);
});

test('finding the game the player means: the name said wins, then known engines, never the OS or the toolchain', () => {
  const procs = ['svchost.exe', 'chrome.exe', 'node.exe', 'SomeIndie.exe', 'javaw.exe', 'cs2.exe', 'explorer.exe', 'Steam.exe'];
  const known = [{ tokens: ['javaw', 'minecraft'], title: 'Minecraft' }];
  const anyGame = rankRunningGames(procs, null, known);
  assert.deepEqual(anyGame.map((c) => c.process), ['javaw.exe', 'cs2.exe', 'SomeIndie.exe']);
  assert.equal(anyGame[0]!.title, 'Minecraft');
  assert.equal(rankRunningGames(procs, 'cs2', known)[0]!.process, 'cs2.exe', 'the name the player said wins');
  assert.equal(rankRunningGames(procs, 'some indie', known)[0]!.process, 'SomeIndie.exe');
});
