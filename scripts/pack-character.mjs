// RETIRED (plan 44, rule 8a): Astro is no longer a packed GLB.
//
// The suit is now `ASTRO_SUIT_CREATURE_KIT` in apps/web/src/avatar/astro/astro-model.ts: 45 `@hm/partgen` parts compiled
// from the `ASTRO_SUIT_GENOME` genome, parented onto the Mixamo rest rig table (astro/mixamo-rig.ts). There is no mesh
// asset to pack, no skin and no texture sheet: the character's 1.2 MiB `astro-low.glb` (and the optional HD pack) is gone.
//
// The rest rig the clips were authored on is kept as data in astro/mixamo-rig.ts; the animation sets are packed by
// scripts/pack-anims.mjs (scientist/anims.bin) and scripts/retarget-astro.ts --rifle (astro/rifle-anims.bin).
console.error('pack-character.mjs is retired: the player suit is procedural (ASTRO_SUIT_CREATURE_KIT, plan 44).');
process.exit(2);
