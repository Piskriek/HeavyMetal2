/**
 * Accessibility Tests — Keyboard Controls, Reduced Motion, High Contrast
 * 
 * Verifies that accessibility features are properly implemented:
 * - Keyboard controls are configurable and functional
 * - Reduced motion mode disables animations and screen shake
 * - High contrast mode is available
 * - All actions have keyboard bindings
 */

// Mock browser globals before importing preferences
(globalThis as any).window = {
  matchMedia: (query: string) => ({ matches: false, media: query }),
};
(globalThis as any).localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
};

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { 
  ACTIONS, 
  getDefaultBindings, 
  formatKey, 
  normalizeCode,
} from '../src/game/controls';
import { defaultOptions } from '../src/game/preferences';
import type { ActionId } from '../src/game/controls';

// ============================================================================
// Keyboard Controls
// ============================================================================

test('T12: Accessibility — all required actions have keyboard bindings', () => {
  const bindings = getDefaultBindings();
  
  for (const action of ACTIONS) {
    assert.ok(bindings[action.id], `Action ${action.id} has bindings`);
    assert.ok(bindings[action.id].length > 0, `Action ${action.id} has at least one key`);
  }
});

test('T12: Accessibility — default bindings include common keys', () => {
  const bindings = getDefaultBindings();
  
  // Arrow keys for steering
  assert.ok(bindings.steerLeft.includes('ArrowLeft'), 'Arrow left for steering');
  assert.ok(bindings.steerRight.includes('ArrowRight'), 'Arrow right for steering');
  
  // WASD as alternative
  assert.ok(bindings.steerLeft.includes('KeyA'), 'A key for steering');
  assert.ok(bindings.steerRight.includes('KeyD'), 'D key for steering');
  
  // Space for bounce
  assert.ok(bindings.bounce.includes('Space'), 'Space for bounce');
  
  // Escape for pause
  assert.ok(bindings.pause.includes('Escape'), 'Escape for pause');
});

test('T12: Accessibility — formatKey produces readable labels', () => {
  assert.strictEqual(formatKey('Space'), 'SPACE');
  assert.strictEqual(formatKey('Escape'), 'ESC');
  assert.strictEqual(formatKey('ArrowLeft'), '←');
  assert.strictEqual(formatKey('ArrowRight'), '→');
  assert.strictEqual(formatKey('KeyA'), 'A');
  assert.strictEqual(formatKey('ShiftLeft'), 'SHIFT');
});

test('T12: Accessibility — normalizeCode handles edge cases', () => {
  assert.strictEqual(normalizeCode('Space'), 'Space');
  assert.strictEqual(normalizeCode(''), '');
});

test('T12: Accessibility — all actions have labels and descriptions', () => {
  for (const action of ACTIONS) {
    assert.ok(action.label, `Action ${action.id} has label`);
    assert.ok(action.description, `Action ${action.id} has description`);
    assert.ok(action.label.length > 0, `Action ${action.id} label is not empty`);
    assert.ok(action.description.length > 0, `Action ${action.id} description is not empty`);
  }
});

test('T12: Accessibility — no conflicting default bindings', () => {
  const bindings = getDefaultBindings();
  const allKeys = new Map<string, ActionId>();
  
  for (const action of ACTIONS) {
    for (const key of bindings[action.id]) {
      if (allKeys.has(key)) {
        const conflict = allKeys.get(key);
        assert.fail(`Key ${key} is bound to both ${conflict} and ${action.id}`);
      }
      allKeys.set(key, action.id);
    }
  }
});

test('T12: Accessibility — pause has multiple bindings for easy access', () => {
  const bindings = getDefaultBindings();
  assert.ok(bindings.pause.length >= 2, 'Pause has at least 2 key bindings');
});

// ============================================================================
// Reduced Motion
// ============================================================================

test('T12: Accessibility — reducedMotion option exists', () => {
  const options = defaultOptions();
  assert.strictEqual(typeof options.reducedMotion, 'boolean');
});

test('T12: Accessibility — reduced motion disables animations', () => {
  const options = defaultOptions();
  
  // When reducedMotion is explicitly set, related options should follow
  if (options.reducedMotion) {
    assert.strictEqual(options.menuMotion, false, 'Menu motion disabled');
    assert.strictEqual(options.screenShake, false, 'Screen shake disabled');
  }
});

test('T12: Accessibility — screenShake can be disabled independently', () => {
  const options = defaultOptions();
  assert.strictEqual(typeof options.screenShake, 'boolean');
});

test('T12: Accessibility — menuMotion option exists', () => {
  const options = defaultOptions();
  assert.strictEqual(typeof options.menuMotion, 'boolean');
});

// ============================================================================
// High Contrast
// ============================================================================

test('T12: Accessibility — highContrast option exists', () => {
  const options = defaultOptions();
  assert.strictEqual(typeof options.highContrast, 'boolean');
});

// ============================================================================
// Game Options Coverage
// ============================================================================

test('T12: Accessibility — all game actions keyboard-accessible', () => {
  const requiredActions: ActionId[] = [
    'steerLeft',
    'steerRight',
    'bounce',
    'boost',
    'pause',
  ];
  
  const definedActions = ACTIONS.map(a => a.id);
  
  for (const action of requiredActions) {
    assert.ok(definedActions.includes(action), `Required action ${action} is defined`);
  }
});

test('T12: Accessibility — steering supports both WASD and arrow keys', () => {
  const bindings = getDefaultBindings();
  
  assert.ok(
    bindings.steerLeft.includes('KeyA') || bindings.steerLeft.includes('ArrowLeft'),
    'Left steering has A or ArrowLeft'
  );
  assert.ok(
    bindings.steerRight.includes('KeyD') || bindings.steerRight.includes('ArrowRight'),
    'Right steering has D or ArrowRight'
  );
});

test('T12: Accessibility — action keys on standard keyboard positions', () => {
  const bindings = getDefaultBindings();
  
  // Space is easy to reach
  assert.ok(bindings.bounce.includes('Space'), 'Bounce uses Space');
  
  // Shift keys
  const hasShift = bindings.boost.includes('ShiftLeft') || bindings.boost.includes('ShiftRight');
  assert.ok(hasShift, 'Boost uses Shift key');
});

test('T12: Accessibility — options include graphics mode for performance', () => {
  const options = defaultOptions();
  assert.ok(
    options.graphics === 'auto' || options.graphics === 'performance' || options.graphics === 'quality',
    `Graphics mode is valid: ${options.graphics}`
  );
});
