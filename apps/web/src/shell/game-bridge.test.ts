// The menu room's game bridge (Plan 57 §16.5): its words for each state say what is happening and what to do, in the player's
// terms, and the bridge's address follows play's rule (localhost only).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BRIDGE_COMMAND, bridgeWords } from './game-bridge';
import { companionBridgeUrl } from '../play/bridge-url';

test('each state says what is happening and offers the one action that fits', () => {
  assert.equal(bridgeWords('checking').action, null);
  assert.match(bridgeWords('offline').line, /not running/);
  assert.equal(bridgeWords('ready').action, 'Link a game window');
  const linked = bridgeWords('linked', { frames: 1, windowName: 'Plasma' });
  assert.equal(linked.line, 'Watching Plasma. The drone has seen 1 frame.');
  assert.equal(linked.action, 'Unlink the game');
  assert.match(bridgeWords('linked', { frames: 12 }).line, /12 frames/);
  assert.equal(bridgeWords('unavailable').action, null);
  assert.equal(BRIDGE_COMMAND, 'node scripts/companion-bridge.mjs');
});

test('the bridge is reached only from a game on this PC', () => {
  assert.equal(companionBridgeUrl({ hostname: 'localhost', search: '' }), 'http://localhost:8220');
  assert.equal(companionBridgeUrl({ hostname: '127.0.0.1', search: '?bridge=8231' }), 'http://localhost:8231');
  assert.equal(companionBridgeUrl({ hostname: 'example.com', search: '' }), null);
  assert.equal(companionBridgeUrl({ hostname: 'localhost', search: '?bridge=evil.com' }), null);
});
