import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  Keymap,
  findConflicts,
  BUILDER_BINDINGS,
  RACE_BINDINGS,
} from '../src/game/builder/keymap';

describe('IF-KEYMAP: Scoped Keymap System', () => {
  it('AC-1: no conflicts per scope and when combination across all bindings', () => {
    const all = [...RACE_BINDINGS, ...BUILDER_BINDINGS];
    const conflicts = findConflicts(all);
    assert.deepEqual(conflicts, [], `Found unexpected keymap conflicts: ${JSON.stringify(conflicts)}`);
  });

  it('AC-2: builder scope shadows race keys and handles rmbHeld modifier', () => {
    const keymap = new Keymap();
    keymap.pushScope('builder');

    // R resolves to gizmo.scale, not race.restart
    assert.equal(keymap.resolve({ code: 'KeyR' }), 'gizmo.scale');

    // F resolves to camera.focus, not race.fullscreen
    assert.equal(keymap.resolve({ code: 'KeyF' }), 'camera.focus');

    // Space when rmbHeld resolves to fly.up
    keymap.pushScope('builder.fly');
    assert.equal(keymap.resolve({ code: 'Space' }, true), 'fly.up');

    // KeyW when rmbHeld resolves to fly.forward
    assert.equal(keymap.resolve({ code: 'KeyW' }, true), 'fly.forward');
  });

  it('AC-3: with only race scope active, race keys resolve normally', () => {
    const keymap = new Keymap();
    assert.equal(keymap.resolve({ code: 'KeyR' }), 'race.restart');
    assert.equal(keymap.resolve({ code: 'KeyF' }), 'race.fullscreen');
    assert.equal(keymap.resolve({ code: 'KeyB' }), 'race.builder');
    assert.equal(keymap.resolve({ code: 'KeyC' }), 'race.camera');
    assert.equal(keymap.resolve({ code: 'Space' }), 'race.jump');
  });

  it('AC-4: focused text-input scope swallows bare keys but passes modifier chords', () => {
    const keymap = new Keymap();
    keymap.pushScope('builder');
    keymap.pushScope('text-input');

    // Bare keys are swallowed
    assert.equal(keymap.resolve({ code: 'KeyW' }), null);
    assert.equal(keymap.resolve({ code: 'KeyE' }), null);
    assert.equal(keymap.resolve({ code: 'KeyR' }), null);
    assert.equal(keymap.resolve({ code: 'KeyF' }), null);
    assert.equal(keymap.resolve({ code: 'KeyH' }), null);

    // Modifier chords (like Ctrl+Z undo) still resolve
    assert.equal(keymap.resolve({ code: 'KeyZ', ctrlKey: true }), 'builder.undo');
  });

  it('AC-5: laptop ortho fallbacks and chords resolve properly', () => {
    const keymap = new Keymap();
    keymap.pushScope('builder');

    assert.equal(keymap.resolve({ code: 'Numpad7' }), 'camera.ortho.top');
    assert.equal(keymap.resolve({ code: 'Digit7', altKey: true }), 'camera.ortho.top');
    assert.equal(keymap.resolve({ code: 'Numpad1' }), 'camera.ortho.front');
    assert.equal(keymap.resolve({ code: 'Digit1', altKey: true }), 'camera.ortho.front');
    assert.equal(keymap.resolve({ code: 'Numpad3' }), 'camera.ortho.side');
    assert.equal(keymap.resolve({ code: 'Digit3', altKey: true }), 'camera.ortho.side');
  });
});
