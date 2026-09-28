import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CommandStack,
  diffCommand,
  undo,
  redo,
} from '../src/game/builder/history';

interface TestProp {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
}

describe('IF-HISTORY: Command Stack with Drag Coalescing', () => {
  it('AC-6: drag coalesces into 1 entry; undo then redo round trips; cancel restores before', () => {
    const stack = new CommandStack<TestProp>();
    const initial: TestProp[] = [
      { id: 'p1', name: 'Pine', x: 100, y: 0, z: 200 },
      { id: 'p2', name: 'Rock', x: 300, y: 0, z: 400 },
    ];

    // Begin drag interaction
    stack.begin('move', initial);

    // Simulate 240 frames of intermediate positions
    let current = structuredClone(initial);
    for (let frame = 1; frame <= 240; frame++) {
      current[0].x = 100 + frame;
      current[0].z = 200 + frame * 2;
    }

    // Commit drag at frame 240
    const cmd = stack.commit(current);
    assert.ok(cmd, 'Expected command to be committed');
    assert.equal(stack.depth, 1, '240 frames of drag must coalesce into exactly 1 command entry');

    // Undo restores initial state
    const undone = stack.undo(current);
    assert.ok(undone);
    assert.deepEqual(undone, initial, 'Undo must restore exact initial state');

    // Redo restores final moved state
    const redone = stack.redo(undone);
    assert.ok(redone);
    assert.deepEqual(redone, current, 'Redo must restore exact final moved state');

    // Test Esc / cancel mid-drag
    stack.begin('move', current);
    current[0].x = 9999;
    const restored = stack.cancel();
    assert.deepEqual(restored, redone, 'Cancel must return prior snapshot');
    assert.equal(stack.depth, 1, 'Cancelled drag must not create an undo entry');
  });

  it('AC-7: editing 1 of 1000 props records minimal diff bytes (< 2 kB), not full snapshot', () => {
    const initial: TestProp[] = [];
    for (let i = 0; i < 1000; i++) {
      initial.push({ id: `prop_${i}`, name: `Prop ${i}`, x: i * 10, y: 0, z: i * 20 });
    }

    const modified = structuredClone(initial);
    modified[42].x += 50;

    const diff = diffCommand('edit single prop', initial, modified);
    assert.ok(diff);
    assert.equal(diff.before.length, 1);
    assert.equal(diff.after.length, 1);
    assert.equal(diff.added.length, 0);
    assert.equal(diff.removed.length, 0);
    assert.ok(diff.bytes < 2048, `Diff bytes should be < 2048, got ${diff.bytes}`);
  });

  it('ignores no-op diffs and does not push empty commands', () => {
    const stack = new CommandStack<TestProp>();
    const initial: TestProp[] = [{ id: 'p1', name: 'Tree', x: 0, y: 0, z: 0 }];

    stack.begin('noop', initial);
    const cmd = stack.commit(initial);
    assert.equal(cmd, null, 'No-op change should not create a command');
    assert.equal(stack.depth, 0);
  });
});
