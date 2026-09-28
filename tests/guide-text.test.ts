/**
 * H13: the in-game guide describes the race as it is: a push start (no slingshot to drag), loops as
 * scenery (no points for riding them), no bunny-hop key, and the camera and slow-motion keys.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const GUIDES = ['src/screens/RaceScreen.tsx', 'src/App.tsx', 'src/components/RaceLoadingScreen.tsx', 'src/components/ControlsSettings.tsx'];

test('H13: no guide text describes the retired slingshot, loop points or the hop key', () => {
  for (const path of GUIDES) {
    const text = read(path);
    for (const lie of [/drag (your|the) (orange|glowing) ball/i, /pull (your glowing ball )?back/i, /350 chaos points/i, /bunny-hops/i, /adjust power and angle/i]) {
      assert.doesNotMatch(text, lie, `${path}: ${lie}`);
    }
  }
});

test('H13: the guides explain the push start and the V / [ / ] keys', () => {
  assert.match(read('src/screens/RaceScreen.tsx'), /starter goblin pushes you off the pad/);
  assert.match(read('src/App.tsx'), /starter goblin pushes you off/);
  for (const path of ['src/screens/RaceScreen.tsx', 'src/components/ControlsSettings.tsx', 'src/components/RaceLoadingScreen.tsx']) {
    const text = read(path);
    assert.match(text, /<(kbd|strong)>V<\/(kbd|strong)>/, `${path} documents V`);
    assert.match(text, /<(kbd|strong)>\[<\/(kbd|strong)> <(kbd|strong)>\]<\/(kbd|strong)>/, `${path} documents [ and ]`);
  }
  // …and the keys really do those things in a race.
  const bar = read('src/components/TestDriveBar.tsx');
  assert.match(bar, /e\.code === 'KeyV'/);
  assert.match(bar, /e\.code === 'BracketLeft'/);
});
