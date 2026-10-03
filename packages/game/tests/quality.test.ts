import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdaptiveQuality, gpuClass, guessQuality, parseFpsTarget, parseQuality, tidyGpuName } from '../src/quality';

test('graphics chips by name: the owner\'s laptop chips are weak, software is software, unknown is null', () => {
  assert.equal(gpuClass('ANGLE (Intel, Intel(R) HD Graphics 530 (0x0000191B) Direct3D11 vs_5_0 ps_5_0, D3D11)'), 'weak');
  assert.equal(gpuClass('ANGLE (NVIDIA, NVIDIA GeForce GTX 950M Direct3D11 vs_5_0 ps_5_0, D3D11)'), 'weak');
  assert.equal(gpuClass('ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)'), 'weak');
  assert.equal(gpuClass('ANGLE (AMD, AMD Radeon(TM) Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)'), 'weak');
  assert.equal(gpuClass('ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)'), 'software');
  assert.equal(gpuClass('ANGLE (NVIDIA, NVIDIA GeForce GTX 1060 6GB Direct3D11 vs_5_0 ps_5_0, D3D11)'), 'mid');
  assert.equal(gpuClass('ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 Direct3D11 vs_5_0 ps_5_0, D3D11)'), 'strong');
  assert.equal(gpuClass('ANGLE (AMD, AMD Radeon RX 6800 XT Direct3D11 vs_5_0 ps_5_0, D3D11)'), 'strong');
  assert.equal(gpuClass('Mali-G78'), 'weak');
  assert.equal(gpuClass(''), null);
  assert.equal(gpuClass('Mystery Accelerator 9000'), null);
});

test('chip names read plainly in Settings', () => {
  assert.equal(tidyGpuName('ANGLE (Intel, Intel(R) HD Graphics 530 (0x0000191B) Direct3D11 vs_5_0 ps_5_0, D3D11)'), 'Intel HD Graphics 530');
  assert.equal(tidyGpuName('ANGLE (NVIDIA, NVIDIA GeForce GTX 950M Direct3D11 vs_5_0 ps_5_0, D3D11)'), 'NVIDIA GeForce GTX 950M');
  assert.equal(tidyGpuName('ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)'), 'Apple M2');
  assert.equal(tidyGpuName('Mali-G78'), 'Mali-G78');
});

test('first guess: the chip leads; without one, desktops start in the middle and phones go by cores and screen', () => {
  assert.equal(guessQuality({ touch: false, cores: 8, dpr: 1, width: 1920, gpu: 'ANGLE (Intel, Intel(R) HD Graphics 530 (0x0000191B) Direct3D11 vs_5_0 ps_5_0, D3D11)' }), 'low');
  assert.equal(guessQuality({ touch: false, cores: 16, dpr: 1, width: 1920, gpu: 'NVIDIA GeForce RTX 4090' }), 'ultra');
  assert.equal(guessQuality({ touch: false, cores: 6, dpr: 1, width: 1920, gpu: 'NVIDIA GeForce RTX 3060' }), 'high');
  assert.equal(guessQuality({ touch: false, cores: 8, dpr: 1, width: 1920, gpu: 'NVIDIA GeForce GTX 1060' }), 'medium');
  assert.equal(guessQuality({ touch: false, cores: 16, dpr: 1, width: 1920 }), 'medium');
  assert.equal(guessQuality({ touch: false, cores: 2, dpr: 1, width: 1280 }), 'low');
  assert.equal(guessQuality({ touch: true, cores: 4, dpr: 3, width: 390 }), 'low');
  assert.equal(guessQuality({ touch: true, cores: 8, dpr: 3, width: 390 }), 'medium');
  assert.equal(guessQuality({ touch: true, cores: 8, dpr: 2, width: 820 }), 'high');
  assert.equal(guessQuality({ touch: true, cores: 8, dpr: 2, width: 820, gpu: 'Adreno (TM) 740' }), 'low');
});

test('parseQuality accepts only the four tiers', () => {
  assert.equal(parseQuality('medium'), 'medium');
  assert.equal(parseQuality('ultra'), 'ultra');
  assert.equal(parseQuality('extreme'), null);
  assert.equal(parseQuality(undefined), null);
});

test('slow frames drop one tier at a time after the warmup; fast frames never change it', () => {
  const q = createAdaptiveQuality('high', { window: 10, warmup: 5 });
  const feed = (n: number, ms: number): (string | null)[] => Array.from({ length: n }, () => q.frame(ms));
  assert.deepEqual(feed(40, 12).filter(Boolean), []);
  const dropped = feed(30, 40).filter(Boolean);
  assert.equal(dropped[0], 'medium');
  assert.equal(q.current === 'medium' || q.current === 'low', true);
  feed(200, 40);
  assert.equal(q.current, 'low');
  assert.deepEqual(feed(50, 40).filter(Boolean), []);
});

test('very slow frames drop two tiers at once, within seconds rather than hundreds of frames', () => {
  const q = createAdaptiveQuality('ultra');
  let t = 0, first: string | null = null;
  while (first === null && t < 10_000) { first = q.frame(130); t += 130; }
  assert.equal(first, 'medium');
  assert.ok(t <= 4500, `dropped after ${t} ms`);
});

test('a frame-rate target: drops below it, rises with room to spare, and never retries a tier that was too slow', () => {
  const q = createAdaptiveQuality('low', { targetFps: 30, window: 10, warmup: 5 });
  const feed = (n: number, ms: number): (string | null)[] => Array.from({ length: n }, () => q.frame(ms));
  // 60 fps on low with a 30 target: room to spare, so it tries medium after two roomy windows
  assert.deepEqual(feed(25, 16.7).filter(Boolean), ['medium']);
  // medium runs at 20 fps: too slow for 30, back to low, and medium is never tried again
  assert.deepEqual(feed(30, 50).filter(Boolean), ['low']);
  assert.deepEqual(feed(200, 16.7).filter(Boolean), []);
  assert.equal(q.current, 'low');
});

test('with a 60 target the screen cap hides any room, so it only ever drops', () => {
  const q = createAdaptiveQuality('medium', { targetFps: 60, window: 10, warmup: 5 });
  assert.deepEqual(Array.from({ length: 200 }, () => q.frame(16.7)).filter(Boolean), []);
  assert.equal(Array.from({ length: 40 }, () => q.frame(24)).find(Boolean), 'low');
});

test('targets read from storage fall back to 60', () => {
  assert.equal(parseFpsTarget(15), 15);
  assert.equal(parseFpsTarget(30), 30);
  assert.equal(parseFpsTarget('30'), 60);
  assert.equal(parseFpsTarget(undefined), 60);
});

test('the warmup frames and absurd frame times are ignored; a locked tier never moves', () => {
  const q = createAdaptiveQuality('high', { window: 5, warmup: 20, warmupMs: Infinity });
  for (let i = 0; i < 20; i++) assert.equal(q.frame(200), null);
  assert.equal(q.frame(5000), null);
  assert.equal(q.frame(NaN), null);
  const locked = createAdaptiveQuality('high', { window: 5, warmup: 0, locked: true });
  for (let i = 0; i < 50; i++) assert.equal(locked.frame(100), null);
  assert.equal(locked.current, 'high');
});
