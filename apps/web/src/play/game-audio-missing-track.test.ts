/** Plan 45 gateway regression: absent optional/LFS audio must not trap the shared engine in a microtask loop. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { GameAudioController } from '../audio/game-audio';

function scoreController(): { controller: GameAudioController; starts: () => number } {
  const controller = new GameAudioController();
  let starts = 0;
  const node = (): object => {
    const self = { gain: { value: 0, setTargetAtTime: () => {} }, connect: () => self, start: () => { starts++; }, loop: false };
    return self;
  };
  // Only the score's Web Audio boundary is faked; we execute the real preload/retry controller.
  Object.assign(controller, {
    currentContext: 'moon',
    ctx: { currentTime: 0, createBufferSource: node, createGain: node },
    moonTrackGains: Array.from({ length: 7 }, node),
  });
  return { controller, starts: () => starts };
}

test('missing decoded score tracks stop after one load instead of recursively retrying cached null promises', async () => {
  const { controller, starts } = scoreController();
  let loads = 0;
  controller.getBuffer = () => null;
  controller.preloadMoonAudio = async () => { loads++; if (loads > 1) throw new Error('recursive preload'); };
  controller.ensureMoonScoreRunning();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(loads, 1); assert.equal(starts(), 0);
});

test('a completed preload starts the seven existing score sources exactly once', async () => {
  const { controller, starts } = scoreController();
  let ready = false, loads = 0;
  controller.getBuffer = () => ready ? {} as AudioBuffer : null;
  controller.preloadMoonAudio = async () => { loads++; ready = true; };
  controller.ensureMoonScoreRunning();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(loads, 1); assert.equal(starts(), 7);
  controller.ensureMoonScoreRunning(); assert.equal(starts(), 7);
});

test('an asynchronous optional score load cannot restart Moon music after leaving the shared play screen', async () => {
  const { controller, starts } = scoreController();
  let ready = false, finish: (() => void) | undefined;
  controller.getBuffer = () => ready ? {} as AudioBuffer : null;
  controller.preloadMoonAudio = () => new Promise<void>((resolve) => { finish = resolve; });
  controller.ensureMoonScoreRunning();
  Object.assign(controller, { currentContext: 'silent' }); ready = true; finish!();
  await new Promise<void>((resolve) => setImmediate(resolve)); assert.equal(starts(), 0);
});
