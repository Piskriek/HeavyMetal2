# Player character

The player character is **Astro** (the "Armored Space Suit"). The owner generated it with Meshy AI, and it is Mixamo-rigged (28 joints).
- The model: `../astro/astro-model.ts` — `ASTRO_SUIT_CREATURE_KIT`, a 45-part `@hm/creature` assembly on the Mixamo
  rest rig table (`../astro/mixamo-rig.ts`). There is no character GLB and no skinning (plan 44).
- This folder keeps the animation set (`anims.bin`, 14 Mixamo clips) and the animator. `adaptClipsForAstro` fits the clips to Astro's rig.
