// ============================================================================
// File: packages/shareware/tests/sprite-sheet.test.ts
// Plan 43 step 4 (@hm/shareware/sprite-sheet): a kit's turntable baked on the CPU into eight palette-indexed frames, at the
// Fidelity Stage's palette, deterministically enough that a `pxdc:` cartridge can carry the recipe and re-bake the same sheet.
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import type { Kit } from '@hm/kitspec';
import { paletteForStage } from '@hm/skin';
import {
  BILLBOARD_CYCLE,
  bakeTurntable,
  billboardFrameAt,
  defaultMaterialColour,
  frameForView,
  frameToRgba,
  sheetToImage,
  sheetToRgba,
  TURNTABLE_ANGLES,
} from '../src/index';

const steel = '#8a8f98';

/** An asymmetric little kit: a 2 m skid, a column at one end, a cap on it and a lamp post on the other side, so every angle
 *  of the turntable sees something different. */
const RIG: Kit = {
  parts: {
    skid: { source: { kind: 'box', size: [2.4, 0.16, 0.8] }, material: 'hull-steel', rank: 0,
      sockets: { left: { at: [-0.9, 0.16, 0] }, right: { at: [0.9, 0.16, 0] } } },
    column: { source: { kind: 'box', size: [0.28, 1.5, 0.28] }, material: 'accent-hardware', rank: 0,
      sockets: { top: { at: [0, 1.5, 0] } } },
    cap: { source: { kind: 'box', size: [0.5, 0.14, 0.5] }, material: 'khaki-paint', rank: 1 },
    post: { source: { kind: 'box', size: [0.12, 0.9, 0.12] }, material: 'lamp', rank: 0 },
  },
  assemblies: {
    rig: {
      children: [
        { ref: 'skid', key: 'skid' },
        { ref: 'column', key: 'column', on: { child: 0, socket: 'left' } },
        { ref: 'cap', key: 'cap', on: { child: 1, socket: 'top' } },
        { ref: 'post', key: 'post', on: { child: 0, socket: 'right' } },
      ],
    },
  },
};

const inkOf = (material: string): string => (material === 'lamp' ? '#ffc13d' : material === 'hull-steel' ? steel : material === 'khaki-paint' ? '#a89968' : '#c8ccd4');

/** How many pixels of a frame are not the (black) background. */
const inked = (frame: { readonly indices: Uint8Array }): number => {
  let n = 0;
  for (const i of frame.indices) if (i !== 0) n += 1;
  return n;
};

test('a turntable bakes eight frames, all inked, all indexed into the stage\'s palette', () => {
  const sheet = bakeTurntable({ kit: RIG, preset: 'rig', stage: 6, size: 32, colourOf: inkOf, background: '#000000' });
  assert.equal(sheet.angles, TURNTABLE_ANGLES);
  assert.equal(sheet.frames.length, 8);
  assert.equal(sheet.size, 32);
  assert.deepEqual(sheet.yawDeg, [0, 45, 90, 135, 180, 225, 270, 315]);
  assert.equal(sheet.palette.id, paletteForStage(6).id);
  for (const frame of sheet.frames) {
    assert.equal(frame.width, 32);
    assert.equal(frame.height, 32);
    assert.equal(frame.indices.length, 32 * 32);
    assert.ok(inked(frame) > 100, `a 2.4 m rig should cover a good part of a 32 px frame (got ${inked(frame)})`);
    for (const i of frame.indices) assert.ok((i as number) < frame.palette.colours.length);
  }
});

test('the palette and dither of a stage decide what the sprite is made of', () => {
  const at = (stage: number) => bakeTurntable({ kit: RIG, preset: 'rig', stage, size: 32, colourOf: inkOf, background: null });
  const mono = at(0);
  assert.equal(mono.palette.id, 'mono');
  assert.deepEqual([...new Set(mono.frames[0]!.indices)].sort((a, b) => a - b).slice(0, 2), [0, 1], 'one bit is two inks');
  for (const frame of mono.frames) assert.ok(new Set(frame.indices).size <= 2);
  const ega = at(1);
  assert.equal(ega.palette.id, 'ega');
  assert.ok(new Set(ega.frames[0]!.indices).size <= 16);
  assert.ok(new Set(ega.frames[0]!.indices).size > 2, 'EGA shows the machine in colour');
  const full = at(6);
  assert.equal(full.palette.id, 'true');
  assert.ok(inked(full.frames[0]!) > 0);
  // a stage past six is the same as six, and a stage below zero is the same as zero
  assert.equal(at(9).palette.id, full.palette.id);
  assert.equal(at(-2).palette.id, 'mono');
});

test('the frames differ: it is a turntable, not eight copies', () => {
  const sheet = bakeTurntable({ kit: RIG, preset: 'rig', stage: 6, size: 24, colourOf: inkOf, background: '#000000' });
  const signatures = sheet.frames.map((f) => f.indices.join(','));
  assert.equal(new Set(signatures).size, 8, 'all eight views are distinct');
  // the front and the back are as different as it gets
  let differing = 0;
  const front = sheet.frames[0]!.indices, back = sheet.frames[4]!.indices;
  for (let i = 0; i < front.length; i += 1) if (front[i] !== back[i]) differing += 1;
  assert.ok(differing > front.length * 0.05, `the back view should not be the front (${differing} pixels differ)`);
});

test('a bake is deterministic, and the same recipe always makes the same sheet', () => {
  const options = { kit: RIG, preset: 'rig', stage: 2, size: 24, colourOf: inkOf, background: '#000000' } as const;
  const a = bakeTurntable(options);
  const b = bakeTurntable(options);
  assert.equal(a.angles, b.angles);
  for (let k = 0; k < a.angles; k += 1) assert.deepEqual(a.frames[k]!.indices, b.frames[k]!.indices);
  // the stage is part of the recipe: a different stage is a different sheet
  const other = bakeTurntable({ ...options, stage: 1 });
  assert.notDeepEqual(a.frames[0]!.indices, other.frames[0]!.indices);
  // and so is the palette: a reskin of the kit's ink changes the pixels, not the shape
  const reskinned = bakeTurntable({ ...options, colourOf: (m) => (m === 'hull-steel' ? '#ac3232' : inkOf(m)) });
  assert.equal(inked(reskinned.frames[0]!), inked(a.frames[0]!), 'the same shape');
  assert.notDeepEqual(reskinned.frames[0]!.indices, a.frames[0]!.indices);
});

test('options are clamped, and the frames can be turned back into pixels', () => {
  const big = bakeTurntable({ kit: RIG, preset: 'rig', size: 999, angles: 99, colourOf: inkOf });
  assert.equal(big.size, 128);
  assert.equal(big.angles, 16);
  const tiny = bakeTurntable({ kit: RIG, preset: 'rig', size: 1, angles: 0, colourOf: inkOf });
  assert.equal(tiny.size, 4);
  assert.equal(tiny.angles, 1);
  const sheet = bakeTurntable({ kit: RIG, preset: 'rig', stage: 2, size: 16, colourOf: inkOf, background: '#000000' });
  const rgba = frameToRgba(sheet, 3);
  assert.equal(rgba.length, 16 * 16 * 4);
  assert.equal(rgba[3], 255);
  const contact = sheetToImage(sheet);
  assert.equal(contact.width, 16 * sheet.angles);
  assert.equal(contact.height, 16);
  assert.equal(sheetToRgba(sheet).length, contact.width * contact.height * 4);
  // frame indices past the end clamp instead of going undefined
  assert.deepEqual(frameToRgba(sheet, 99), frameToRgba(sheet, sheet.angles - 1));
  assert.deepEqual(frameToRgba(sheet, -3), frameToRgba(sheet, 0));
  // an unknown preset bakes an empty sheet rather than throwing (a cartridge can name a kit this build has not got)
  const empty = bakeTurntable({ kit: RIG, preset: 'no-such-preset', size: 8 });
  assert.equal(empty.frames.length, 8);
  assert.equal(inked(empty.frames[0]!), 0);
});

test('the runtime rules: which frame a billboard shows, and which one a camera sees', () => {
  assert.deepEqual(BILLBOARD_CYCLE, [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.equal(billboardFrameAt(0), 0);
  assert.equal(billboardFrameAt(1 / 8), 1);
  assert.equal(billboardFrameAt(7 / 8), 7);
  assert.equal(billboardFrameAt(1), 0, 'it wraps at the end of the cycle');
  assert.equal(billboardFrameAt(2.5, 8), ((20 % 8) + 8) % 8);
  assert.equal(billboardFrameAt(-3), 0, 'a clock before zero holds the first frame');
  assert.equal(billboardFrameAt(Number.NaN), 0);
  assert.equal(billboardFrameAt(1, 0), 8 % 8, 'a zero rate falls back to eight a second');
  // the view: standing in front of the actor (+z) is frame 0, to its right (+x) a quarter turn round
  assert.equal(frameForView(0, 1), 0);
  assert.equal(frameForView(1, 0), 2);
  assert.equal(frameForView(-1, 0), 6);
  assert.equal(frameForView(0, -1), 4);
  assert.equal(frameForView(0.3, 1.2), 0, 'a view near the front still rounds to the front');
});

test('a material with no ink of its own gets a stable one, spread over the hue wheel in OKLab', () => {
  assert.equal(defaultMaterialColour('hull-steel'), '#8a8f98');
  assert.equal(defaultMaterialColour('lamp'), '#ffc13d');
  assert.match(defaultMaterialColour('lx:3400:1.4:pulse'), /^#[0-9a-f]{6}$/);
  const a = defaultMaterialColour('rusty-panel');
  assert.equal(a, defaultMaterialColour('rusty-panel'), 'the same name always gets the same colour');
  assert.match(a, /^#[0-9a-f]{6}$/);
  // different names land on different inks often enough to tell parts apart
  const many = new Set(['panel-a', 'panel-b', 'panel-c', 'panel-d', 'panel-e'].map((n) => defaultMaterialColour(n)));
  assert.ok(many.size >= 3, `five names should not all be the same ink (${[...many].join(', ')})`);
});
