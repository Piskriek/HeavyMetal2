/**
 * Sprite and sound cartridges in play (plan 43, step 4): the `pxdc:` and `sndc:` codes, what a print costs, the turntable a
 * sprite print bakes to, and the stem a sound print plays.
 *
 * A sprite cartridge is a kit preset turned eight ways at a Fidelity Stage: `@hm/shareware` bakes the sheet, the stage's
 * palette decides its inks, and the card it becomes turns at the stage's own cadence. A sound cartridge is a recursive
 * patch: `@hm/soundlab` reduces it to the stage's hardware, so the same code is a 1-bit buzz at Stage 0 and a placed stem at
 * Stage 4. Nothing here touches the DOM or a clock.
 */
import { printKind, readPrint, type Print, type SoundPrintSpec, type SpritePrintSpec } from '@hm/cartlab';
import { bakeTurntable, sheetToRgba, type SpriteSheet } from '@hm/shareware';
import type { Kit } from '@hm/kitspec';
import { countAtoms, stageSoundsLike, stemLengthMs, type StemPreset, type Wave } from '@hm/soundlab';
import { GATE_KIT } from './kit-gate';
import { MILL_FRAME_KIT } from './kit-mill-frame';
import { PRESS_FRAME_KIT } from './kit-press-frame';
import { WATERMAKER_FRAME_KIT } from './kit-watermaker-frame';
import { FABRICATOR_FRAME_KIT } from './kit-fabricator-frame';
import { CAPACITOR_BANK_KIT } from './kit-capacitor-bank';

/**
 * The kits a sprite cartridge can turn: the room's machines and the Gate, by the names the bench shows. `assembly` is the kit's
 * own preset name (the frame a machine is actually built from), which is not always the machine's kind.
 */
export const SPRITE_KITS: Readonly<Record<string, { readonly label: string; readonly kit: Kit; readonly assembly: string }>> = Object.freeze({
  gate: { label: 'Gate', kit: GATE_KIT, assembly: 'gate' },
  mill: { label: 'Mill', kit: MILL_FRAME_KIT, assembly: 'mill-frame' },
  press: { label: 'Press', kit: PRESS_FRAME_KIT, assembly: 'press-frame' },
  watermaker: { label: 'Water maker', kit: WATERMAKER_FRAME_KIT, assembly: 'watermaker-frame' },
  fabricator: { label: 'Fabricator', kit: FABRICATOR_FRAME_KIT, assembly: 'fabricator-upright' },
  'capacitor-bank': { label: 'Capacitor bank', kit: CAPACITOR_BANK_KIT, assembly: 'capacitor-cell' },
});

/** The cartridges' codes: `pxdc:` for a sprite, `sndc:` for a sound. */
export const SPRITE_CODE = 'pxdc:';
export const SOUND_CODE = 'sndc:';

const toBase64Url = (text: string): string => {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromBase64Url = (code: string): string => {
  const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
};

/**
 * The stage's billboard cadence: a 1-bit card barely turns, a full-colour one turns smoothly. The ladder is the same 4 to 12
 * the room's machines use, so a card never outruns the stage it is shown on.
 */
export function spriteFps(stage: number): number {
  const s = Number.isFinite(stage) ? Math.max(0, Math.min(6, Math.floor(stage))) : 0;
  return s <= 0 ? 4 : s === 1 ? 6 : s === 2 ? 8 : s === 3 ? 10 : 12;
}

/** What a sprite print costs: its pixels, by frame count and size (a billboard is four vertices). */
export function spriteBill(spec: Pick<SpritePrintSpec, 'size' | 'angles'>): { readonly item: string; readonly n: number }[] {
  const pxd = Math.max(4, Math.round((spec.size * spec.size * spec.angles) / 384));
  return [{ item: 'pxd-mono', n: pxd }, { item: 'vtx-rough', n: 4 }];
}

/**
 * What a sound print costs: nothing but the bench's time and the blank. A patch is data, not matter, and the game has already
 * paid for the chip it will play on.
 */
export function soundBill(): { readonly item: string; readonly n: number }[] {
  return [];
}

/** Whether a kit name can be turned at all. */
export const spriteKitIds = (): readonly string[] => Object.keys(SPRITE_KITS);

/** The turntable a sprite print bakes to. An unknown kit bakes the Gate rather than throwing: a code from another build still previews. */
export function bakeSpritePrint(spec: SpritePrintSpec): SpriteSheet {
  const entry = SPRITE_KITS[spec.kit] ?? SPRITE_KITS['gate']!;
  return bakeTurntable({
    kit: entry.kit,
    preset: entry.assembly,
    stage: spec.stage,
    size: spec.size,
    angles: spec.angles,
    dither: spec.dither,
    elevationDeg: spec.elevationDeg,
  });
}

/** A baked sheet as one atlas (all frames side by side) in RGBA, ready for a texture. */
export function spriteAtlas(sheet: SpriteSheet): { readonly rgba: Uint8Array; readonly width: number; readonly height: number } {
  return { rgba: Uint8Array.from(sheetToRgba(sheet)), width: sheet.size * sheet.angles, height: sheet.size };
}

const WAVES: readonly Wave[] = ['sine', 'square', 'sawtooth', 'triangle', 'noise'];
const isWave = (w: string): w is Wave => (WAVES as readonly string[]).includes(w);

/**
 * A shelf stem as a print: the same tree, the same gain and loop, with the stage it was written for. A stem with no stage of
 * its own is written for the top of the ladder.
 */
export function soundPrintFromStem(stem: StemPreset, stage = 6): SoundPrintSpec {
  return {
    name: stem.name,
    role: stem.role,
    stage: Math.max(0, Math.min(6, Math.floor(stage))),
    gain: stem.gain,
    patch: {
      name: stem.patch.name,
      ...(stem.patch.gain !== undefined ? { gain: stem.patch.gain } : {}),
      ...(stem.patch.atoms ? { atoms: stem.patch.atoms.map((a) => ({ wave: a.wave, freqHz: a.freqHz, gain: a.gain, attackMs: a.attackMs, decayMs: a.decayMs, ...(a.delayMs !== undefined ? { delayMs: a.delayMs } : {}), ...(a.detuneCents !== undefined ? { detuneCents: a.detuneCents } : {}) })) } : {}),
      ...(stem.patch.children ? { children: stem.patch.children.map((c) => soundPrintFromStem({ ...stem, name: stem.name, patch: c }, stage).patch) } : {}),
    },
    ...(stem.pan !== undefined ? { pan: stem.pan } : {}),
    ...(stem.loopSeconds !== undefined ? { loopSeconds: stem.loopSeconds } : {}),
  };
}

/**
 * The stem a sound print plays: the patch as written, with the filters and the loop the shelf would carry. A wave the engine does
 * not know is read as a square rather than dropped, so a hand-edited code still sounds.
 */
export function stemFromSoundPrint(spec: SoundPrintSpec): StemPreset {
  const convert = (p: SoundPrintSpec['patch']): StemPreset['patch'] => ({
    name: p.name,
    ...(p.gain !== undefined ? { gain: p.gain } : {}),
    ...(p.atoms ? { atoms: p.atoms.map((a) => ({ wave: isWave(a.wave) ? a.wave : 'square', freqHz: a.freqHz, gain: a.gain, attackMs: a.attackMs, decayMs: a.decayMs, ...(a.delayMs !== undefined ? { delayMs: a.delayMs } : {}), ...(a.detuneCents !== undefined ? { detuneCents: a.detuneCents } : {}) })) } : {}),
    ...(p.children ? { children: p.children.map(convert) } : {}),
  });
  return {
    id: `sndc:${spec.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'sound'}`,
    name: spec.name,
    role: spec.role,
    gain: spec.gain,
    patch: convert(spec.patch),
    ...(spec.pan !== undefined ? { pan: spec.pan } : {}),
    ...(spec.loopSeconds !== undefined ? { loopSeconds: spec.loopSeconds } : {}),
  };
}

/** The stem as the stage hears it, and how long one cycle of it lasts. */
export function stemAtStage(spec: SoundPrintSpec, stage = spec.stage): { readonly stem: StemPreset; readonly lengthMs: number } {
  const stem = stageSoundsLike(stemFromSoundPrint(spec), stage);
  return { stem, lengthMs: stemLengthMs(stem) };
}

/** How many voices a printed sound needs at its own stage (the bench shows it, the rack counts it). */
export function soundVoices(spec: SoundPrintSpec): number {
  return countAtoms(stemFromSoundPrint(spec).patch);
}

/** The `pxdc:` code for a sprite print: its JSON, base64url, behind the prefix. */
export const spriteCode = (spec: SpritePrintSpec): string => `${SPRITE_CODE}${toBase64Url(JSON.stringify({ sprite: spec }))}`;

/** The `sndc:` code for a sound print. */
export const soundCode = (spec: SoundPrintSpec): string => `${SOUND_CODE}${toBase64Url(JSON.stringify({ sound: spec }))}`;

/** The code for any print (a written material keeps its own prefix scheme in the library). */
export const printCode = (print: Print): string =>
  printKind(print) === 'sprite' ? spriteCode(('sprite' in print ? print.sprite : null) as SpritePrintSpec)
    : printKind(print) === 'sound' ? soundCode(('sound' in print ? print.sound : null) as SoundPrintSpec)
      : '';

/** The print in a `pxdc:` or `sndc:` code, or null for anything else (a typo, a code from another build, junk). */
export function readPrintCode(code: string): Print | null {
  const c = code.trim();
  const prefix = c.startsWith(SPRITE_CODE) ? SPRITE_CODE : c.startsWith(SOUND_CODE) ? SOUND_CODE : null;
  if (!prefix || c.length > 8000) return null;
  const want = prefix === SPRITE_CODE ? 'sprite' : 'sound';
  try {
    const print = readPrint(JSON.parse(fromBase64Url(c.slice(prefix.length))));
    return print && printKind(print) === want ? print : null;
  } catch {
    return null;
  }
}

/** The name a sprite print is offered under: its kit's label and the stage it was baked at. */
export function spritePrintName(kit: string, stage: number): string {
  const label = SPRITE_KITS[kit]?.label ?? 'Sprite';
  const s = Math.max(0, Math.min(6, Math.floor(stage)));
  return `${label} sprite, stage ${s}`;
}

/** A fresh sprite print at the bench's starting dials. */
export function defaultSpritePrint(): SpritePrintSpec {
  return { name: spritePrintName('gate', 2), kit: 'gate', stage: 2, size: 32, angles: 8, dither: 'bayer2', elevationDeg: 12 };
}
