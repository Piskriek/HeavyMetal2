// Plan 51 Wave 2: the game bridge for ANY game, by permission. Assets never cross; mechanics always do (a game no one
// checked bridges through its own telemetry or the screen); official telemetry maps through presets (data, not code) into the harness, which must recover what it was made with.
import test from 'node:test';
import assert from 'node:assert/strict';
import { transduceMechanic, type MechanicObservation } from '@hm/harness';
import {
  allowedChannels, anonymizeEvents, bestChannel, createCadenceAnalyzer, parseCadenceLine, PRESET_SIGNATURES, bridgePresetFor, checkBridgeProfile, classifyEventField, createEventAnonymizer, CS2_TELEMETRY_MAPPING, pathTokens, readRaw, createTelemetryAccumulator, decodeBridgeProfileCode, encodeBridgeProfileCode, gameIdOf,
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
  assert.deepEqual([refused.channels, refused.streams, refused.soloOnly], [['telemetry', 'screen', 'input-audio'], ['mechanics'], true]);
  assert.equal(checkBridgeProfile({ ...profile(), gameId: '../etc' }), null);
  assert.equal(checkBridgeProfile({ ...profile(), schema: 'v0' }), null);
  assert.equal(profile({ sources: [{ url: 'javascript:alert(1)', quote: 'x' }] }).sources.length, 0, 'only http(s) sources');
  assert.equal(profile({ channels: ['memory-hack', 'telemetry'] }).channels.join(), 'telemetry', 'no such rung');
  assert.equal(decodeBridgeProfileCode(encodeBridgeProfileCode(p))?.title, 'Test Game');
});

test('a game no one checked bridges its mechanics out of the box: its own telemetry and the screen, solo, and it says so', () => {
  const u = uncheckedProfile('Some Game');
  assert.deepEqual([u.verdict, u.channels, u.streams, u.soloOnly], ['unchecked', ['telemetry', 'screen', 'input-audio'], ['mechanics'], true]);
  assert.match(profileLine(u), /Nobody checked its terms/);
  assert.match(profileLine(u), /Mechanics cross by telemetry > screen > input-audio/);
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
  assert.deepEqual(allowedChannels(profile({ channels: ['game-files'] })), ['telemetry', 'game-files', 'screen', 'input-audio'], 'the ladder order, floor included');
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

test('mapping v2: selectors pick the active weapon, paths are checked token by token', () => {
  const payload = { player: { weapons: { weapon_0: { name: 'knife', state: 'holstered' }, weapon_1: { name: 'rifle', state: 'active', ammo_clip: 27 } } } };
  assert.equal(readPath(payload, { path: 'player.weapons[state=active].ammo_clip' }), 27);
  assert.equal(readRaw(payload, 'player.weapons[state=active].name'), 'rifle');
  assert.equal(readRaw(payload, 'player.weapons[state=reloading].name'), undefined);
  for (const ok of ['a.b[0].c', 'a[k=v w].c', 'round.phase']) assert.ok(pathTokens(ok), ok);
  for (const bad of ['a..b', '../x', 'a[b]', 'a;b', '']) assert.equal(pathTokens(bad), null, bad);
  assert.equal(checkBridgeProfile({ ...profile(), telemetry: { shotCounter: { path: 'a', counts: 'sideways' } } }), null, 'counts is up or down');
});

test('a CS2-shaped GSI stream: the clip falling is shots, a reload and a weapon switch are not, round events cross', () => {
  const acc = createTelemetryAccumulator(CS2_TELEMETRY_MAPPING);
  const weapons = (active: 'rifle' | 'pistol' | 'reload', rifleClip: number, pistolClip = 20) => ({
    weapon_0: { name: 'weapon_knife', state: 'holstered' },
    weapon_1: { name: 'weapon_ak47', type: 'Rifle', ammo_clip: rifleClip, ammo_clip_max: 30, state: active === 'rifle' ? 'active' : active === 'reload' ? 'reloading' : 'holstered' },
    weapon_2: { name: 'weapon_glock', type: 'Pistol', ammo_clip: pistolClip, ammo_clip_max: 20, state: active === 'pistol' ? 'active' : 'holstered' },
  });
  // GSI at throttle 0.1 s; the rifle fires 10 rounds/s for 2.5 s (25 rounds), reloads, then the player switches to the pistol
  let fired = 0, clip = 30, t = 0;
  const post = (w: ReturnType<typeof weapons>, phase: string): void => { acc.push({ round: { phase }, player: { weapons: w, state: { health: 100 } } }, t); t += 0.1; };
  post(weapons('rifle', clip), 'live');
  for (let k = 0; k < 25; k++) { clip -= 1; fired += 1; post(weapons('rifle', clip), 'live'); }
  for (let k = 0; k < 25; k++) post(weapons('reload', clip), 'live');
  clip = 30;
  post(weapons('rifle', clip), 'live');
  post(weapons('pistol', clip, 13), 'live'); // switched to a pistol with 13 left: not 17 shots
  post(weapons('pistol', clip, 13), 'over');
  const obs = acc.take('Counter-Strike 2', 'telemetry')!;
  assert.equal(obs.shots?.t.length, fired, 'only the rounds fired');
  assert.deepEqual(obs.events?.map((e) => e.name), ['round.phase:over']);
  const r = transduceMechanic(gateObservation(bridgePresetFor('cs2'), obs).observation!);
  assert.ok(r.fire && Math.abs(r.fire.roundsPerSecond - 10) < 0.5, `fire ${r.fire?.roundsPerSecond}`);
  assert.equal(bridgePresetFor('cs2')?.verdict, 'limited');
  assert.equal(bridgePresetFor('fidelity-arena-survivor')?.title, 'FIDELITY arena survivor');
  assert.equal(bridgePresetFor('some-indie'), null);
});

test('event classes: keywords by field, a mapping overrides them, unknown fields are unclassed', () => {
  assert.equal(classifyEventField('boss.state:#2'), 'threat');
  assert.equal(classifyEventField('wave.number:4'), 'threat');
  assert.equal(classifyEventField('player.dash:#1'), 'mobility');
  assert.equal(classifyEventField('movement.mode:air'), 'mobility');
  assert.equal(classifyEventField('round.phase:over'), 'outcome');
  assert.equal(classifyEventField('kill.count:3'), 'outcome');
  assert.equal(classifyEventField('round.bomb:planted', CS2_TELEMETRY_MAPPING.eventClasses), 'objective', 'the override wins over "round"');
  assert.equal(classifyEventField('player.state.health:80'), 'harm');
  assert.equal(classifyEventField('weird.field:x'), null);
});

test('one session anonymizer keeps labels stable across batches and passes labels through', () => {
  const anon = createEventAnonymizer();
  assert.equal(anon('boss.state:Calm'), 'boss.state:#1');
  assert.equal(anon('boss.state:Enraged'), 'boss.state:#2');
  assert.equal(anon('boss.state:Calm'), 'boss.state:#1', 'the same value, the same label, later');
  assert.equal(anon('boss.state:#7'), 'boss.state:#7');
  const acc = createTelemetryAccumulator({ events: ['boss.state'] }, { rename: anon });
  acc.push({ boss: { state: 'Calm' } }, 0);
  assert.deepEqual(acc.push({ boss: { state: 'Enraged' } }, 1), [{ t: 1, name: 'boss.state:#2' }], 'push returns the live events');
});

test('the input-audio rung: audio onsets while fire is held are shots; presses are edges; keys only count in focus', () => {
  assert.deepEqual(parseCadenceLine('1.2500 1 1 0 0 0.3000'), { t: 1.25, fg: true, fire: true, jump: false, dash: false, peak: 0.3 });
  assert.equal(parseCadenceLine('1.25 0 1 1 1 0.3')?.fire, false, 'out of focus: no key counts');
  assert.equal(parseCadenceLine('garbage'), null);
  assert.equal(parseCadenceLine('1 1 1 1 1 7'), null, 'a peak is 0..1');
  // 4 s at 200 Hz: fire held 1..3 s with a 10-round/s weapon (12 ms of sound per round, the meter holding each a little),
  // a jump press every second, music-free; plus sound out of the fire hold (an explosion) that is not a shot
  const a = createCadenceAnalyzer();
  const live: string[] = [];
  for (let k = 0; k < 800; k++) {
    const t = k / 200;
    const firing = t >= 1 && t < 3;
    const round = firing && ((t - 1) % 0.1) < 0.02;
    const boom = t >= 3.5 && t < 3.56;
    const jump = (t % 1) < 0.1;
    live.push(...a.push({ t, fg: true, fire: firing, jump, dash: false, peak: round ? 0.6 : boom ? 0.9 : 0.004 }));
  }
  assert.deepEqual([...new Set(live)].sort(), ['input.fire:down', 'input.jump:down']);
  const obs = a.take('Some Game')!;
  assert.equal(obs.channel, 'input-audio');
  assert.equal(obs.shots?.t.length, 20, 'twenty rounds, not the explosion');
  const r = transduceMechanic(gateObservation(null, obs).observation!);
  assert.ok(r.fire && Math.abs(r.fire.roundsPerSecond - 10) < 0.5, `fire ${r.fire?.roundsPerSecond}`);
  assert.equal(a.size(), 0);
  // a silent game: the presses are the shots (semi-auto at 4 clicks/s)
  const b = createCadenceAnalyzer();
  for (let k = 0; k < 400; k++) { const t = k / 200; b.push({ t, fg: true, fire: (t % 0.25) < 0.05, jump: false, dash: false, peak: 0 }); }
  assert.equal(b.take('Silent')?.shots?.t.length, 8);
});

test('"bridge counter strike" finds cs2.exe and its shipped profile', () => {
  const top = rankRunningGames(['explorer.exe', 'cs2.exe', 'Discord.exe', 'SomeTool.exe'], 'counter strike', PRESET_SIGNATURES)[0]!;
  assert.deepEqual([top.process, top.title], ['cs2.exe', 'Counter-Strike 2']);
  assert.equal(bridgePresetFor(top.gameId)?.gameId, 'cs2', 'the session runs as cs2, where its GSI posts');
});

test('a sparse feed fills by time: the accumulator reports the span of game time it holds', () => {
  const acc = createTelemetryAccumulator({ shotCounter: { path: 'n' } });
  for (let k = 0; k < 6; k++) acc.push({ n: k }, k * 2.5);
  assert.equal(acc.span(), 12.5);
  acc.take('Sparse', 'telemetry');
  assert.equal(acc.span(), 0, 'take clears the span');
});
