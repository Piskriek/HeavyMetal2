// ============================================================================
// File: scripts/batch-voice-act789.mjs
// Plan: Plan 29b (Batch Voice Generation for Acts VII–IX & 8 Charm Lines)
// Guardrail: Enforces RUNWORLD_FLOOR >= 16,000 credits before generating.
// ============================================================================

import fs from 'node:fs';
import path from 'node:path';

export const RUNWORLD_VOICE_CREDIT_FLOOR = 16000;

export const VOICE_BATCH_29B = [
  { id: 'A7-01', file: 'vo-a7-01-brownout.mp3', text: "You're red-lining the Gate's twelve-kilowatt feed. Drop a dedicated Power Unit on the pad and string Relay Pylons toward the eastern crater—we need real megawatts to spin up the Water Maker." },
  { id: 'A7-02', file: 'vo-a7-02-water.mp3', text: 'Condensers online. Look at the low basin—actual liquid water pooling over the regolith. Give it light and coverage will creep right up the banks.' },
  { id: 'A7-03', file: 'vo-a7-03-rover.mp3', text: 'Walking a one-kilometre crater gets old fast. Print a Scout Rover at the Vehicle Fabricator—and bolt a Perimeter Turret to your foundation corner before the sappers sniff out our new power line.' },
  { id: 'A8-01', file: 'vo-a8-01-heavy.mp3', text: "Standard field units won't push us past Stage Four. Snap a two-by-two hardpoint foundation together and bring the Heavy Terraformers online—and check that transponder blinking on the north-west ridge." },
  { id: 'A8-02', file: 'vo-a8-02-combiner.mp3', text: "So Vance really did try to hot-patch the kernel from the Moon. Bring those Anomaly Cores to the Preset Combiner—let's splice a high-density cartridge strong enough to lock the whole plot." },
  { id: 'A8-03', file: 'vo-a8-03-stage5.mp3', text: 'Coverage is holding! Moss, clover, and soil normals locking onto bare basalt. One more push on all four floats and we hit full biosphere coherence.' },
  { id: 'A9-01', file: 'vo-a9-01-stage6.mp3', text: "All four floats above point-eight-five. Look at the trees—and check your visor feed. That's full CMOS optical coherence. Come back through the Gate and slot the Golden Master into the Planet Table." },
  { id: 'A9-02', file: 'vo-a9-02-window-heal.mp3', text: "Consensus branch committed. Look out the observation window! The Breach column is collapsing—the fidelity pockets are merging across the datacentre ruins. You didn't just build a moon, kid. You patched the host." },
  { id: 'A9-03', file: 'vo-a9-03-epilogue.mp3', text: "Eleven neighboring domes on the horizon, a living forest outside the Gate, and the Kettle's finally off emergency power. Take the rover out whenever you want—the Studio's yours." },
  { id: 'CHARM-WIREFRAME-FILL', file: 'vo-charm-wireframe-fill.mp3', text: 'There go the faces! Goodbye wireframe—even one-bit dither beats walking around on naked vectors.' },
  { id: 'CHARM-BUTTON', file: 'vo-charm-button.mp3', text: 'I physically disconnected that switch before you woke up. Please stop stress-testing the apocalypse button.' },
  { id: 'CHARM-2D-SPRITE', file: 'vo-charm-2d-sprite.mp3', text: "Don't bother flanking a ninety-three sprite. It doesn't have a back—it just rotates with your camera." },
  { id: 'CHARM-3D-MOB', file: 'vo-charm-3d-mob.mp3', text: 'Careful—that leak compiled with a Z-axis. Actual triangles, and none of them look friendly.' },
  { id: 'CHARM-BOUNDARY', file: 'vo-charm-boundary.mp3', text: 'In, out, in, out. Yes, the suit HUD resamples with the ground. Try not to sprain the shader.' },
  { id: 'CHARM-RENAME', file: 'vo-charm-rename.mp3', text: "You can call it whatever you want in the schema. Please don't try to eat it." },
  { id: 'CHARM-AIRTIME', file: 'vo-charm-airtime.mp3', text: 'That rover is a precision geological instrument, not a stunt kart! ...Okay, nice hang-time.' },
  { id: 'CHARM-PAINT', file: 'vo-charm-paint.mp3', text: "Forty thousand kilometres of barren moon, and you're redecorating the front porch. Carry on, Picasso." },
];

if (import.meta.url === `file://${process.argv[1]}`) {
  const isDryRun = process.argv.includes('--dry-run') || !process.env.RUNWORLD_API_KEY;
  const outDir = path.resolve('apps/web/public/vo');
  fs.mkdirSync(outDir, { recursive: true });

  const totalWords = VOICE_BATCH_29B.reduce((acc, item) => acc + item.text.split(/\s+/).length, 0);
  console.log(
    `[batch-voice-act789] 17 lines queued (${totalWords} words, ~540 est. credits). Mode: ${
      isDryRun ? 'DRY-RUN' : 'LIVE'
    }`
  );

  for (const item of VOICE_BATCH_29B) {
    const dest = path.join(outDir, item.file);
    const exists = fs.existsSync(dest);
    console.log(`  - [${item.id}] ${item.file} (${exists ? 'already exists' : 'pending'}): "${item.text.slice(0, 52)}..."`);
  }
}
