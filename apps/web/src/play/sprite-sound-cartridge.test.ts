import { test } from 'node:test';
import assert from 'node:assert/strict';
import { printKind, readPrint, type SoundPrintSpec } from '@hm/cartlab';
import { paletteForStage } from '@hm/skin';
import { countAtoms, renderStem, resolveStem, stageSoundsLike, stemLengthMs } from '@hm/soundlab';
import {
  SPRITE_CODE,
  SPRITE_KITS,
  SOUND_CODE,
  bakeSpritePrint,
  defaultSpritePrint,
  printCode,
  readPrintCode,
  soundBill,
  soundCode,
  soundPrintFromStem,
  soundVoices,
  spriteAtlas,
  spriteBill,
  spriteCode,
  spriteFps,
  spriteKitIds,
  spritePrintName,
  stemAtStage,
  stemFromSoundPrint,
} from './sprite-sound-cartridge';

test('six machines can be turned, and every one of them bakes a sheet with ink in it', () => {
  assert.deepEqual([...spriteKitIds()].sort(), ['capacitor-bank', 'fabricator', 'gate', 'mill', 'press', 'watermaker']);
  for (const [id, entry] of Object.entries(SPRITE_KITS)) {
    assert.equal(typeof entry.label, 'string');
    const sheet = bakeSpritePrint({ name: `${id} test`, kit: id, stage: 2, size: 16, angles: 8, dither: 'bayer2', elevationDeg: 12 });
    assert.equal(sheet.frames.length, 8, `${id} must bake eight frames`);
    assert.equal(sheet.size, 16);
    assert.equal(sheet.preset, entry.assembly, `${id} must bake its own assembly`);
    // the frames are a turntable of a real machine: each one has ink, and they are not all the same frame
    for (const frame of sheet.frames) assert.ok(frame.indices.some((i) => i !== 0), `${id} frame has no ink`);
    const first = sheet.frames[0]!.indices.join(',');
    assert.ok(sheet.frames.some((f) => f.indices.join(',') !== first), `${id} must not be eight copies of one frame`);
  }
  // a kit from another build still previews: it bakes the Gate under the Gate's name
  const foreign = bakeSpritePrint({ name: 'x', kit: 'not-a-kit', stage: 1, size: 8, angles: 4, dither: 'none', elevationDeg: 0 });
  assert.equal(foreign.preset, 'gate');
  assert.equal(foreign.frames.length, 4);
});

test('the stage decides the palette and the cadence, and neither ever goes backwards', () => {
  let lastFps = 0;
  for (let stage = 0; stage <= 6; stage += 1) {
    const sheet = bakeSpritePrint({ name: 's', kit: 'press', stage, size: 8, angles: 8, dither: 'none', elevationDeg: 12 });
    assert.equal(sheet.palette.id, paletteForStage(stage).id, `stage ${stage} must bake in its own palette`);
    const fps = spriteFps(stage);
    assert.ok(fps >= lastFps, `stage ${stage} must not turn slower than the one below it`);
    assert.ok(fps >= 4 && fps <= 12);
    lastFps = fps;
  }
  // off the ladder is clamped, not undefined
  assert.equal(spriteFps(-3), spriteFps(0));
  assert.equal(spriteFps(99), spriteFps(6));
  // a 1-bit sheet is drawn in two inks; a full-colour one has more
  const mono = bakeSpritePrint({ name: 'm', kit: 'gate', stage: 0, size: 16, angles: 8, dither: 'bayer4', elevationDeg: 12 });
  const true_ = bakeSpritePrint({ name: 't', kit: 'gate', stage: 6, size: 16, angles: 8, dither: 'none', elevationDeg: 12 });
  assert.ok(new Set(mono.frames[0]!.indices).size <= 2);
  assert.ok(new Set(true_.frames[0]!.indices).size > 2);
});

test('a sheet becomes one atlas a texture can hold, and a print costs pixels', () => {
  const sheet = bakeSpritePrint(defaultSpritePrint());
  const atlas = spriteAtlas(sheet);
  assert.equal(atlas.width, sheet.size * sheet.angles);
  assert.equal(atlas.height, sheet.size);
  assert.equal(atlas.rgba.length, atlas.width * atlas.height * 4);
  // the atlas is not empty: some pixel somewhere is opaque
  let opaque = 0;
  for (let i = 3; i < atlas.rgba.length; i += 4) if (atlas.rgba[i]! > 0) opaque += 1;
  assert.ok(opaque > 100, `the atlas must carry the sprite (${opaque} opaque pixels)`);

  // bigger and more frames cost more; a bill is stock the base knows
  const small = spriteBill({ size: 16, angles: 4 });
  const big = spriteBill({ size: 64, angles: 16 });
  assert.ok(big[0]!.n > small[0]!.n);
  assert.equal(big[1]!.item, 'vtx-rough');
  assert.equal(big[0]!.item, 'pxd-mono');
  assert.ok(small[0]!.n >= 4);
  // a patch is data, so a sound takes no stock at all: only the blank and the bench's time
  assert.deepEqual(soundBill(), []);
});

test('a sprite print travels as a pxdc: code, and only a sprite comes back out of one', () => {
  const spec = { ...defaultSpritePrint(), kit: 'mill', stage: 4, size: 24, angles: 6 };
  const code = spriteCode(spec);
  assert.ok(code.startsWith(SPRITE_CODE));
  const back = readPrintCode(code);
  assert.ok(back && 'sprite' in back);
  assert.deepEqual(back.sprite, spec);
  assert.equal(printKind(back), 'sprite');
  // the code is a print: cartlab's own reader takes it
  assert.ok(readPrint(JSON.parse(JSON.stringify(back))));

  // a sound code is a sound, and either prefix refuses the other's payload
  const sound = soundPrintFromStem(resolveStem('machine-hum-press')!, 3);
  const soundCoded = soundCode(sound);
  assert.ok(soundCoded.startsWith(SOUND_CODE));
  const soundBack = readPrintCode(soundCoded);
  assert.ok(soundBack && 'sound' in soundBack);
  assert.deepEqual(soundBack.sound, sound);
  assert.equal(readPrintCode(`${SPRITE_CODE}${soundCoded.slice(SOUND_CODE.length)}`), null);
  assert.equal(readPrintCode(`${SOUND_CODE}${code.slice(SPRITE_CODE.length)}`), null);

  // junk, a library code and a truncated code are all refused rather than half-read
  assert.equal(readPrintCode('pxdc:'), null);
  assert.equal(readPrintCode('pxdc:not base64 !!'), null);
  assert.equal(readPrintCode('SMX-PXD-abc'), null);
  assert.equal(readPrintCode(code.slice(0, 20)), null);
  assert.equal(readPrintCode(''), null);
  assert.equal(printCode(back), code);
});

test('a sound print is a patch: it keeps its tree, its gain and its loop, and the stage still trims it', () => {
  const lock = resolveStem('gate-chevron-lock')!;
  const spec = soundPrintFromStem(lock, 4);
  assert.equal(spec.role, 'gate');
  assert.equal(spec.stage, 4);
  assert.equal(spec.gain, lock.gain);
  assert.equal(countAtoms(stemFromSoundPrint(spec).patch), countAtoms(lock.patch));
  assert.equal(soundVoices(spec), countAtoms(lock.patch));
  assert.equal(stemFromSoundPrint(spec).patch.children?.length, lock.patch.children?.length);

  // the same print sounds like the hardware it is played on
  const at0 = stemAtStage(spec, 0);
  assert.equal(countAtoms(at0.stem.patch), 1, 'one voice at the PC speaker');
  assert.equal(at0.stem.pan, undefined);
  const at6 = stemAtStage(spec, 6);
  assert.equal(countAtoms(at6.stem.patch), countAtoms(lock.patch));
  assert.equal(at6.lengthMs, stemLengthMs(stageSoundsLike(lock, 6)));
  // and it renders: audible, in range, deterministic
  const a = renderStem(at6.stem, 6, 2);
  const b = renderStem(at6.stem, 6, 2);
  assert.ok(a.peak > 0.01 && a.peak <= 1);
  assert.deepEqual([...a.channels[0]!.slice(0, 2000)], [...b.channels[0]!.slice(0, 2000)]);

  // a hand-edited wave the engine does not know is read as a square rather than dropped
  const odd: SoundPrintSpec = {
    ...spec,
    patch: { name: 'odd', atoms: [{ wave: 'vocoder', freqHz: 300, gain: 0.4, attackMs: 2, decayMs: 80 }] },
  };
  assert.equal(stemFromSoundPrint(odd).patch.atoms?.[0]?.wave, 'square');
});

test('a sprite print is named for its kit and its stage, and a fresh one is a Gate at stage 2', () => {
  assert.equal(spritePrintName('mill', 3), 'Mill sprite, stage 3');
  assert.equal(spritePrintName('nope', 9), 'Sprite sprite, stage 6');
  const fresh = defaultSpritePrint();
  assert.equal(fresh.kit, 'gate');
  assert.equal(fresh.stage, 2);
  assert.equal(fresh.size, 32);
  assert.equal(fresh.angles, 8);
  assert.equal(fresh.dither, 'bayer2');
  // the default is a print cartlab accepts, so the bench can offer it as it stands
  assert.ok(readPrint({ sprite: fresh }));
  assert.equal(printKind({ sprite: fresh }), 'sprite');
});
