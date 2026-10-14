// ============================================================================
// File: packages/content/src/charm-and-act789.ts
// Plans: Plan 26 (Acts VII-IX), Plan 29 (Depth & Charm), Plan 29b (Voice Manifest)
// Purity: 100% pure TypeScript data and deterministic state helpers.
// ============================================================================

export interface VoiceManifestEntry {
  id: string;
  actOrCategory: string;
  filename: string;
  triggerDescription: string;
  subtitle: string;
}

export const ACT789_AND_CHARM_VOICES: Record<string, VoiceManifestEntry> = {
  'A7-01': {
    id: 'A7-01',
    actOrCategory: 'Act VII',
    filename: 'vo-a7-01-brownout.mp3',
    triggerDescription: 'Power demand exceeds 12 kW Gate baseline',
    subtitle: "You're red-lining the Gate's twelve-kilowatt feed. Drop a dedicated Power Unit on the pad and string Relay Pylons toward the eastern crater—we need real megawatts to spin up the Water Maker.",
  },
  'A7-02': {
    id: 'A7-02',
    actOrCategory: 'Act VII',
    filename: 'vo-a7-02-water.mp3',
    triggerDescription: 'Water Maker placed and Aq >= 0.40',
    subtitle: 'Condensers online. Look at the low basin—actual liquid water pooling over the regolith. Give it light and coverage will creep right up the banks.',
  },
  'A7-03': {
    id: 'A7-03',
    actOrCategory: 'Act VII',
    filename: 'vo-a7-03-rover.mp3',
    triggerDescription: 'Vehicle Fabricator / Scout Rover unlocked',
    subtitle: 'Walking a one-kilometre crater gets old fast. Print a Scout Rover at the Vehicle Fabricator—and bolt a Perimeter Turret to your foundation corner before the sappers sniff out our new power line.',
  },
  'A8-01': {
    id: 'A8-01',
    actOrCategory: 'Act VIII',
    filename: 'vo-a8-01-heavy.mp3',
    triggerDescription: 'Stage 4 reached; 8m Heavy Terraformer hardpoints unlocked',
    subtitle: "Standard field units won't push us past Stage Four. Snap a two-by-two hardpoint foundation together and bring the Heavy Terraformers online—and check that transponder blinking on the north-west ridge.",
  },
  'A8-02': {
    id: 'A8-02',
    actOrCategory: 'Act VIII',
    filename: 'vo-a8-02-combiner.mp3',
    triggerDescription: 'Player recovers LOG-08 at Wreck Site Gamma',
    subtitle: "So Vance really did try to hot-patch the kernel from the Moon. Bring those Anomaly Cores to the Preset Combiner—let's splice a high-density cartridge strong enough to lock the whole plot.",
  },
  'A8-03': {
    id: 'A8-03',
    actOrCategory: 'Act VIII',
    filename: 'vo-a8-03-stage5.mp3',
    triggerDescription: 'Stage 5 Coverage Creep reached',
    subtitle: 'Coverage is holding! Moss, clover, and soil normals locking onto bare basalt. One more push on all four floats and we hit full biosphere coherence.',
  },
  'A9-01': {
    id: 'A9-01',
    actOrCategory: 'Act IX',
    filename: 'vo-a9-01-stage6.mp3',
    triggerDescription: 'All 4 floats >= 0.85 (Stage 6 Full PBR Forest + 100% Suit-Cam)',
    subtitle: "All four floats above point-eight-five. Look at the trees—and check your visor feed. That's full CMOS optical coherence. Come back through the Gate and slot the Golden Master into the Planet Table.",
  },
  'A9-02': {
    id: 'A9-02',
    actOrCategory: 'Act IX',
    filename: 'vo-a9-02-window-heal.mp3',
    triggerDescription: 'Operator Console Master Sync Lever pulled; Earth Window Breach heals',
    subtitle: "Consensus branch committed. Look out the observation window! The Breach column is collapsing—the fidelity pockets are merging across the datacentre ruins. You didn't just build a moon, kid. You patched the host.",
  },
  'A9-03': {
    id: 'A9-03',
    actOrCategory: 'Act IX',
    filename: 'vo-a9-03-epilogue.mp3',
    triggerDescription: '3.0s after Window Breach heal completes; launches Credits Video',
    subtitle: "Eleven neighboring domes on the horizon, a living forest outside the Gate, and the Kettle's finally off emergency power. Take the rover out whenever you want—the Studio's yours.",
  },
  'CHARM-WIREFRAME-FILL': {
    id: 'CHARM-WIREFRAME-FILL',
    actOrCategory: 'Charm',
    filename: 'vo-charm-wireframe-fill.mp3',
    triggerDescription: 'Stage 0a Wireframe fills into Stage 0b 1-Bit Facets',
    subtitle: 'There go the faces! Goodbye wireframe—even one-bit dither beats walking around on naked vectors.',
  },
  'CHARM-BUTTON': {
    id: 'CHARM-BUTTON',
    actOrCategory: 'Charm',
    filename: 'vo-charm-button.mp3',
    triggerDescription: 'Pressing the locked red emergency button 3 times',
    subtitle: 'I physically disconnected that switch before you woke up. Please stop stress-testing the apocalypse button.',
  },
  'CHARM-2D-SPRITE': {
    id: 'CHARM-2D-SPRITE',
    actOrCategory: 'Charm',
    filename: 'vo-charm-2d-sprite.mp3',
    triggerDescription: 'Circling 180 degrees around a 2D billboard sprite within 8m',
    subtitle: "Don't bother flanking a ninety-three sprite. It doesn't have a back—it just rotates with your camera.",
  },
  'CHARM-3D-MOB': {
    id: 'CHARM-3D-MOB',
    actOrCategory: 'Charm',
    filename: 'vo-charm-3d-mob.mp3',
    triggerDescription: 'First Stage 2 .md1/.md2 3D polygon monster spawns',
    subtitle: 'Careful—that leak compiled with a Z-axis. Actual triangles, and none of them look friendly.',
  },
  'CHARM-BOUNDARY': {
    id: 'CHARM-BOUNDARY',
    actOrCategory: 'Charm',
    filename: 'vo-charm-boundary.mp3',
    triggerDescription: 'Crossing a stage/HUD skin boundary 3 times in 6 seconds',
    subtitle: 'In, out, in, out. Yes, the suit HUD resamples with the ground. Try not to sprain the shader.',
  },
  'CHARM-RENAME': {
    id: 'CHARM-RENAME',
    actOrCategory: 'Charm',
    filename: 'vo-charm-rename.mp3',
    triggerDescription: 'Renaming dirt to a food or joke word in the Studio schema',
    subtitle: "You can call it whatever you want in the schema. Please don't try to eat it.",
  },
  'CHARM-AIRTIME': {
    id: 'CHARM-AIRTIME',
    actOrCategory: 'Charm',
    filename: 'vo-charm-airtime.mp3',
    triggerDescription: 'Rover airborne hang-time >= 1.8 seconds',
    subtitle: 'That rover is a precision geological instrument, not a stunt kart! ...Okay, nice hang-time.',
  },
  'CHARM-PAINT': {
    id: 'CHARM-PAINT',
    actOrCategory: 'Charm',
    filename: 'vo-charm-paint.mp3',
    triggerDescription: 'Painting within 6m of the Twin Gate in Apply mode',
    subtitle: "Forty thousand kilometres of barren moon, and you're redecorating the front porch. Carry on, Picasso.",
  },
};

/**
 * Stateful Multi-Inspection Quips for Permanent Lab Fixtures (Plan 29 §2.2)
 */
export const LAB_FIXTURE_MULTI_INSPECT: Record<string, string[]> = {
  'old-monitor': [
    'BRIDGE TELEMETRY [T-00:04:12]: Recursive sub-sim allocation hit 99.4% of host substrate. Exterior terrain meshes dropping to 1-bit fallback.',
    'STILL 99.4% ALLOCATED. HITTING [E] HARDER WILL NOT DOWNLOAD MORE RAM.',
    'KERNEL UPTIME: 4,109 DAYS. STICKY NOTE UNDER BEZEL: "IF SCREEN FLICKERS, DO NOT DEGAUSS WHILE GATE IS OPEN."',
  ],
  'server-rack': [
    'BLADE RACK 04: Running emergency 4-float kernel S = (Pxd, Vtx, Lx, Aq). All non-essential material shaders unloaded to preserve Lab life support.',
    'FAN TRAY #2 IS RATTLING IN B-FLAT. DR. HADDY TAPED A PENNY TO THE CHASSIS TO STOP IT.',
    'ASSET ARCHIVE MOUNTED: /mnt/shareware_1993_1997 (READ-ONLY // QUARANTINE FAILED).',
  ],
  'filing-cabinet': [
    'PERSONNEL MEMO — FROM: Dr. G. Haddy // TO: Bridge Staff: Stop spinning up nested test worlds on the primary array.',
    'DRAWER 2 IS JAMMED SHUT BY THIRTY YEARS OF UNFILED OSHA VIOLATIONS.',
    'FOUND AT BOTTOM OF DRAWER: ONE (1) EXPIRED CAFETERIA VOUCHER FOR "SYNTH-CHEESE TUESDAY".',
  ],
  'sample-case': [
    'CONTAINMENT LOG #09: Uncompiled 1993–1997 shareware entities leaking through low-Pxd fault lines.',
    'CASE FOAM IMPRESSION: SHAPED LIKE A 64x64 PIXEL FIREBALL. SMELLS FAINTLY OF OZONE AND 1994.',
  ],
};

export function getLabFixtureInspectLine(propId: string, inspectCount: number): string | null {
  const lines = LAB_FIXTURE_MULTI_INSPECT[propId];
  if (!lines || lines.length === 0) return null;
  const idx = Math.min(Math.max(0, inspectCount - 1), lines.length - 1);
  return lines[idx];
}

/**
 * Rover Boot Greeting Selector (Plan 29 §2.7) — with 1-in-50 (2%) original FIDELITY easter egg
 */
export const ROVER_STANDARD_GREETINGS = [
  'REMOTE YOKE LINKED // SQUARE-SECTION CHASSIS NOMINAL.',
  'SCOUT TELEMETRY ONLINE // LOW-G TRACTION CONTROL: ENGAGED.',
  'CAB SEALED // DRIVING BY WIRE AT 1.62 M/S^2.',
];

export const ROVER_RARE_GREETING =
  'WELCOME ABOARD, OPERATOR // YOU ARE MY FAVOURITE SUB-ROUTINE ON THIS MOON. DO NOT TELL DR. HADDY.';

export function selectRoverGreeting(randomFloat0to1: number): { text: string; isRare: boolean } {
  if (randomFloat0to1 < 0.02) {
    return { text: ROVER_RARE_GREETING, isRare: true };
  }
  const idx = Math.floor(randomFloat0to1 * ROVER_STANDARD_GREETINGS.length) % ROVER_STANDARD_GREETINGS.length;
  return { text: ROVER_STANDARD_GREETINGS[idx], isRare: false };
}

/**
 * Act V Studio Schema Rename Easter Egg Detector (Plan 29 §2.6)
 */
const JOKE_DIRT_WORDS = new Set([
  'cheese', 'cake', 'chocolate', 'pizza', 'soup', 'coffee', 'Gold', 'gold',
  'diamonds', 'money', 'pudding', 'beans', 'spaghetti', 'tacos', 'mystery',
]);

export function isJokeDirtRename(newName: string): boolean {
  const cleaned = newName.trim().toLowerCase();
  return JOKE_DIRT_WORDS.has(cleaned);
}
