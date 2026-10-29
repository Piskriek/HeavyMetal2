import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CANNED_CALLOUTS,
  GUILD_HARVEST_AT,
  createClipManifest,
  createCommsMessage,
  createPlayerWanderer,
  createPresetMemory,
  decodeClipShareCode,
  encodeClipShareCode,
  evaluateGuildComplex,
  evaluateParty,
  recordExperience,
  stepPlayerWanderer,
  validateHarnessSettings,
} from '../src/index.js';

test('Plan 56 W6e & Plan 57 §19.1: Player as Wanderer anchor (`wan.from = "player"`) lends 0.3 calm when steady and 0 when panic-spraying', () => {
  const player = createPlayerWanderer();
  assert.equal(player.wan?.from, 'player');
  assert.equal(player.hard, 0.8);
  assert.equal(player.bal, 1);

  // Steady action keeps the player balanced and lends 0.3 calm
  const s1 = stepPlayerWanderer(player, { t: 10, stage: 'S2', creativeFlow: true });
  assert.equal(s1.steady, true);
  assert.equal(s1.calm, 0.3);

  // Panic-spraying charges root-reactivity, dropping balance < 0.9 so calm becomes 0
  const s2 = stepPlayerWanderer(s1.mem, { t: 20, stage: 'S2', panicSpray: true });
  assert.equal(s2.steady, false);
  assert.equal(s2.calm, 0);
  assert.ok(s2.mem.bal < 0.9);
  assert.ok(s2.warning && s2.warning.includes('Root-reactivity'));

  // Returning to steady play bleeds off the panic charge and restores anchor status
  let recovering = s2.mem;
  for (let i = 0; i < 4; i++) {
    recovering = stepPlayerWanderer(recovering, { t: 30 + i * 10, stage: 'S2' }).mem;
  }
  const s3 = stepPlayerWanderer(recovering, { t: 80, stage: 'S2' });
  assert.equal(s3.steady, true);
  assert.equal(s3.calm, 0.3);
});

test('Plan 57 §19.2: Party working group shares anchorCalm (up to 0.6) and Law-of-One 10.12 harmonious doubling ($2^{N-1}$)', () => {
  const p1 = createPlayerWanderer('species:00a1c401');
  const p2 = createPlayerWanderer('species:00a1c402');
  const drone = createPresetMemory('brain:d0e0');

  const party = evaluateParty([
    { id: 'piskriek', name: 'Piskriek', mem: p1, stage: 'S3', worldGateCode: 'plot:11223344' },
    { id: 'wingman', name: 'Wingman', mem: p2, stage: 'S3', worldGateCode: 'plot:11223344' },
    { id: 'overwatch', name: 'Overwatch Drone', mem: drone, stage: 'S3', worldGateCode: 'plot:11223344' },
  ]);

  assert.equal(party.sharedAnchorCalm, 0.6, 'two anchors reach the 0.6 calm cap');
  assert.equal(party.harmoniousCount, 3, 'all three have open Heart Ray >= 4 and balance >= 0.85');
  assert.equal(party.doublingMultiplier, 4, '2^(3-1) = 4x harmonious working power');
  assert.equal(party.meanBalance, 1);
});

test('Plan 57 §19.2: Guild Social Memory Complex pools closed cause links and shelf codes at coherence >= 0.95', () => {
  let mA = createPresetMemory('kit:ab12cd01');
  mA = {
    ...mA,
    cause: [{ by: 'solar-control', d: 'root-reactivity', n: 3, open: false }],
  };
  const mB = createPresetMemory('matc:ab12cd02');
  const egoA = createPresetMemory('brain:d0e0');

  const guild = evaluateGuildComplex({
    guildId: 'guild-orion-free',
    guildName: 'The Orion-Free Builders',
    memberPresets: [mA, mB],
    memberEgos: [{ ego: egoA, presets: ['kit:ab12cd01', 'matc:ab12cd02'] }],
  });
  assert.ok(guild.pack.coherence >= GUILD_HARVEST_AT);
  assert.equal(guild.isSocialMemoryComplex, true);
  assert.deepEqual(guild.pooledClosedCauses, ['solar-control>root-reactivity']);
  assert.deepEqual(guild.sharedShelfCodes, ['kit:ab12cd01', 'matc:ab12cd02']);

  // Distorted guild drops below 0.95 and does not pool closed causes
  let distorted = createPresetMemory('kit:bad00001');
  distorted = recordExperience(distorted, {
    t: 1,
    stage: 'S1',
    cat: 'PANIC',
    excitement: 1.0,
    error: 1.0,
    by: 'solar-control',
    felt: 'root-fear',
  });
  const unformed = evaluateGuildComplex({
    guildId: 'guild-scattered',
    guildName: 'Scattered',
    memberPresets: [distorted],
    memberEgos: [{ ego: egoA, presets: ['kit:bad00001'] }],
  });
  assert.equal(unformed.isSocialMemoryComplex, false);
  assert.equal(unformed.pooledClosedCauses.length, 0);
});

test('Plan 57 §19.3 & §9: Tiered Comms enforces child-safe preset-only callouts for unverified accounts and extracts preset cartridges', () => {
  // Unverified / child account: free text is stripped, only canned callout + valid preset codes pass
  const childMsg = createCommsMessage({
    id: 'msg-1',
    senderId: 'kid-wanderer',
    channel: 'party',
    trustTier: 'unverified-or-child',
    tick: 100,
    calloutId: 'ping:craft',
    rawText: 'Hey meet me at 123 Main St check out kit:ab12cd34 and matc:00ff1122!',
  });
  assert.equal(childMsg.displayText, `${CANNED_CALLOUTS['ping:craft']} [kit:ab12cd34, matc:00ff1122]`);
  assert.deepEqual(childMsg.attachedPresets, ['kit:ab12cd34', 'matc:00ff1122']);

  // Verified account: keeps sanitized text and extracts preset cartridges
  const verifiedMsg = createCommsMessage({
    id: 'msg-2',
    senderId: 'piskriek',
    channel: 'guild',
    trustTier: 'verified',
    tick: 110,
    rawText: 'Try this hover-coil tuning: kit:ab12cd34 with logic:5ef100aa',
  });
  assert.match(verifiedMsg.displayText, /Try this hover-coil tuning/);
  assert.deepEqual(verifiedMsg.attachedPresets, ['kit:ab12cd34', 'logic:5ef100aa']);
});

test('Plan 57 §19.4 & §19.5: Video Clip & Shorthand Replay manifest round-trips and Harness Settings enforce anti-cheat & child-safety guards', () => {
  const clip = createClipManifest({
    clipId: 'clip-eureka-01',
    authorId: 'piskriek',
    worldSeed: 'seed-424242',
    stage: 'S4',
    trigger: 'eureka',
    durationSec: 6.0,
    videoMime: 'video/webm;codecs=vp9',
    featuredPresets: ['kit:ab12cd34', 'matc:99887766'],
    replayFrames: ['1200:beam:apply:kit:ab12cd34', '1260:eureka:solar-control>root-reactivity'],
    caption: 'Steam Hover-Turbine Eureka at S4',
  });

  const code = encodeClipShareCode(clip);
  assert.ok(code.startsWith('clip:'));
  const decoded = decodeClipShareCode(code);
  assert.deepEqual(decoded, clip);
  assert.equal(decodeClipShareCode('invalid:code'), null);

  // Harness settings: anti-cheat forces mirror-only; unverified forces childSafeFilter = true
  const safeSettings = validateHarnessSettings(
    {
      bridgeMode: 'checked-profile-relay',
      higherSelfSeatEnabled: true,
      autoClipOnEureka: true,
      childSafeFilter: false,
      streamMaxFps: 60,
    },
    { hasAntiCheat: true, trustTier: 'unverified-or-child' },
  );
  assert.equal(safeSettings.bridgeMode, 'mirror-only', 'anti-cheat downgrades relay to mirror-only');
  assert.equal(safeSettings.childSafeFilter, true, 'unverified account locks child-safe filter on');
});
