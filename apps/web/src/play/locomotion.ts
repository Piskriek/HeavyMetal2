/**
 * Which locomotion preset tunes the body (plan 43, `loc:`), and the live switch that changes it.
 *
 * `@hm/kinematic` owns the four curated presets — walk and sprint speed, jump impulse, gravity, air control, coyote time,
 * jump buffer, step-up and the landing spring's stiffness and damping. This module owns the *choice*: `auto` follows the
 * ground you stand on (the lab deck keeps Earth's pull, the Moon's surface keeps the suit's ballast), and any named preset
 * pins one feel everywhere, so the difference between Earth and lunar movement can be felt, and an arcade run can be
 * tuned, without a rebuild.
 *
 * The switch is live: the scene reads the preset every frame and the solver keeps the state it already had, so changing
 * mid-jump retunes the arc from that moment (the rules change, the state does not). The choice is kept on this PC.
 */
import { LOCOMOTION_PRESETS, type LocomotionPreset, type LocomotionPresetId } from '@hm/kinematic';
import { kv } from '../storage/profile-storage';

/** `auto` follows the ground (the lab is Earth, the Moon keeps its ballast); a named preset pins one feel everywhere. */
export type LocomotionChoice = LocomotionPresetId | 'auto';

/** The key the choice is kept under, in the profile's storage (kv guards every read and write). */
export const LOCOMOTION_CHOICE_KEY = 'settings.locomotion';

/** Every choice, in the order the menus list them: auto first, then the curated presets. */
export const LOCOMOTION_CHOICES: readonly LocomotionChoice[] = ['auto', ...(Object.keys(LOCOMOTION_PRESETS) as LocomotionPresetId[])];

/** Where `auto` points: the lab floor is Earth's, the Moon's surface is the suit's own weight. */
export const AUTO_PRESET_FOR = { lab: 'earth-standard', planet: 'lunar-ballast' } as const;

/** Is this string one of the choices? (a saved value, or a menu's, before it is trusted). */
export function isLocomotionChoice(v: unknown): v is LocomotionChoice {
  return typeof v === 'string' && (LOCOMOTION_CHOICES as readonly string[]).includes(v);
}

/** The stored choice, or `auto` when nothing is stored or storage is blocked. */
export function readLocomotionChoice(): LocomotionChoice {
  const stored = kv.get(LOCOMOTION_CHOICE_KEY);
  return isLocomotionChoice(stored) ? stored : 'auto';
}

let choice: LocomotionChoice = readLocomotionChoice();

/** The choice in force now. */
export function locomotionChoice(): LocomotionChoice {
  return choice;
}

/**
 * Sets the choice and keeps it. An unknown name (a stale save, a typo) falls back to `auto` rather than pinning a preset
 * that does not exist. Returns what is now in force.
 */
export function setLocomotionChoice(next: string | null | undefined): LocomotionChoice {
  choice = isLocomotionChoice(next) ? next : 'auto';
  kv.set(LOCOMOTION_CHOICE_KEY, choice);
  return choice;
}

/** The preset a choice means on a given ground. Pure. */
export function presetFor(where: 'lab' | 'planet', which: LocomotionChoice = choice): LocomotionPreset {
  const id = which === 'auto' ? AUTO_PRESET_FOR[where] : which;
  return LOCOMOTION_PRESETS[id];
}

/** The preset in force where the player stands. */
export function activeLocomotion(where: 'lab' | 'planet'): LocomotionPreset {
  return presetFor(where, choice);
}

/**
 * The speed the ground under you allows: the preset's walk or sprint speed, times its air control while the feet are off
 * the ground. Air control is the share of the ground's authority the body still has in the air (0.45 for Earth standard,
 * 0.85 for the shareware arena): 1 on the ground, `preset.airControl` in the air. Pure.
 */
export function locomotionSpeed(preset: LocomotionPreset, running: boolean, airborne: boolean): number {
  const ground = running ? preset.runSpeedMps : preset.walkSpeedMps;
  return ground * (airborne ? preset.airControl : 1);
}
