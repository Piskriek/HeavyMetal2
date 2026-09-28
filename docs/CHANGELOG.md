# Changelog

All notable user-facing changes to Goblin Rally, newest first. Ticket-fix detail lives in the git
history; this file is for what a player or a reviewer can see.

## Unreleased

### Round 1: six more wardrobes for the bust (avatar art)

- New pickable bodies in the creator's **Body** tray: mechanic overalls, pilot bomber, junkknight
  plate, warlord pauldron, pit-crew vest, engineer apron — same headless-bust recipe as the racer
  bust, each registered to the neck-top anchor off its measured stump and collar pixels. All
  original generated art, keyed and despilled in-repo (key-art QA 6/6 pass), tint-mapped
  (skin + leather; the whistle follows the metal swatch).
- This is also DNA v4's first live payload: goblins wearing these encode as `GOB-4…`, decode on
  this build, and are refused honestly on older ones. Old codes on the racer bust still render
  unchanged.
- Contact sheet `docs/art-rounds/bodies-1.png` (all bodies on all three head shapes via real
  creator-UI renders). Three further wardrobe prompts (champion cape, scavenger poncho, captain
  coat) are written and queued for Round 1b.

### Round 1b: champion cape, scavenger poncho, captain coat

- Three more pickable bodies, completing the first wardrobe drop: a golden championship cape with
  laurel brooch (the gold follows the leather swatch, so a team's cape matches its kart trim), a
  ragged scrap poncho, and a crimson race-captain frock coat (the crimson follows the racing
  accent — the captain parades in team colours).
- Same recipe, same registration law, 3/3 key-art QA zero-residual; contact sheet
  `docs/art-rounds/bodies-1b.png` per head shape. The body catalog holds ten wardrobes (of the v4
  budget of sixteen).

### Round 2: the neck and the crown (avatar art)

- Five chin-anchored neck pieces join the tray: cream aviator scarf, crimson sergeant collar
  (brass-piped, with the number 5), braided copper wire torc, racing checkered bandana, and a
  tuning-wrench pendant that hangs down the chest (registered from the measured hang-point, not
  guessed).
- Four hats: the sooty riveted smokestack and the valve-wheel skull cap rise off the crown like the
  gear top hat does (documented top-frame tolerance), the jeweled crown perches regally at it, and
  the slouched oil beret grips the brow — every one on the measured per-head widths, so they sit
  the same on angular, bloated and scrawny heads.
- 9/9 key-art QA pass, residual ≤ 4 px; contact sheets `docs/art-rounds/necks-1.png` and
  `docs/art-rounds/crowns-1.png`. Neck catalog 18/20, headgear 19/24 — still inside DNA v4.

### Round 3: iron grins and greasy hair (avatar art)

- Five mouths join the tray: rivet gnashers (bolted iron tooth plates), a cast-iron bear-trap
  jaw, a blowtorch grin with its little blue flame, zipper lips with a dangling pull tab, and a
  spanner clamped hard in the teeth (registered at the measured bite, off-centre like the pipe).
- Four hair pieces: greasy copper-wired pigtails that hang past the jaw, a swept-back ponytail
  cinched in copper wire, a rivet-studded beetle fringe on the brow line, and a stud-traced buzz
  ridge. Every hat's hide-hair list learned the four new cuts, so nothing clips through a helmet.
- Hair catalog full (16/16), mouth 17/20 — DNA v4 untouched. 9/9 key-art QA pass after the
  part-only prompt re-roll; contact sheets `docs/art-rounds/mouths-1.png` and
  `docs/art-rounds/hair-1.png`.
- public/ size-budget rescue (it was 28 MB over since before this round): the six legacy 4K track
  skies superseded by the CC0 island set moved to `art-src/unreferenced/`, five concept-art JPGs
  joined them, and the four live course skyboxes became q90 JPEGs (`courses.ts` updated) — public/
  is 587 MB with 13 MB of headroom, and M2 is green again.

### Round 4: eyes front and collars full (avatar art)

- Seven eyewear pieces complete the rack (20/20): a raised welder visor on its brow strap,
  riveted steam goggles with one green and one amber lens, fur-lined pilot goggles, pressure-gauge
  eyes with red needles, chunky workshop safety specs, a dark full-width visor strip with a
  glowing slit, and big amber retro shades — lens bands pinned to the measured eye line, straps
  follow the leather swatch, gauge bodies the metal.
- Two neck fills close the collar tray (20/20): a shaggy fur mantle for the winter circuit and a
  loop of spark-plug cables whose braided jackets take the racing accent like the captain's coat.
- 9/9 key-art QA pass, zero re-rolls (the part-only prompt guard from round 3 did its job);
  contact sheets `docs/art-rounds/goggles-1.png` and `docs/art-rounds/necks-2.png`.

### Round 5: the last grin and the last hat (avatar art)

- Mouth tray full (20/20): a steam whistle clamped at the corner of the fangs, a threaded bolt
  bitten across the whole grin with hex nuts at both ends, and a lazy oil-drooling open grin for
  the goblin who just kissed the sump.
- Headgear rack full (24/24): riveted ear defenders with team-tinted cups, a grease-black newsboy
  flatcap, a turbocharger snail shell worn as a helmet, the checkered flag cap with its brass "1"
  wreath, and a lucky horseshoe magnet bristling with stuck nuts and bolts (yes, the magnet takes
  the racing accent).
- 8/8 key-art QA pass, no re-rolls; contact sheets `docs/art-rounds/mouths-2.png` and
  `docs/art-rounds/hats-2.png`. With eyewear, neck, mouth, headgear and hair all at capacity, every
  fashion catalog is now full — only ears/eyes/nose/background spare slots and the big one, head
  shapes, remain.

### DNA v4: the body becomes the twelfth encoded layer (avatar art Phase 1)

- New `GOB-4…` code shape (five hex groups, optional fine-tune block as before). The codec now
  encodes `body` — the rig gained its twelfth layer in Phase 0 — and heads grow room for 8 shapes
  (v3 held 4). Everything else keeps its v3 budget. `body` carries a full nibble, sixteen drops.
- Backwards- and forwards-safe, by construction rather than by fate: v1–v3 codes decode and
  re-encode byte-identically (700-fixture corpus); any goblin on the structural racer bust (body 0)
  still encodes in its shortest old form, so today's codes don't change a character. v4 codes appear
  by themselves the day a second body (or a fifth head) lands: one catalog `push`, no codec work.
- Codes from the future are refused honestly (`"uses a body item this game doesn't have yet"`), and
  `GOB-5…` reports an unsupported version, as v4 did before it.
- The codec packs v4's 68-bit payload with BigInt (past exact float space); v1–v3 produce the same
  strings as before — the golden re-encode corpus is the proof, not a promise.
- The creator's "Random face" rolls with generator 4 (frozen: generators 1–3 never spend a roll on
  the body, so persisted lobby faces don't move).

### The proportional rig, and the goblin gets a body (avatar art Phase 0)

**User-visible**

- The Goblin Creator avatar is no longer a floating head on a backdrop: every painted goblin now
  sits on a chunky hand-painted racer bust — stub leather kart jacket, brass studs, worn open
  collar framing the neck. Original generated part like every other avatar part, keyed and
  despilled through the same pipeline (`art-src/avatar-parts/raw` → `public/avatar-parts/keyed`),
  registered to a new `neck-top` rig anchor off its real collar pixels.
- The bust follows the head: wider shoulders under a bloated head, narrower under a scrawny one,
  and the neck stump always hides under the chin (guard: the stump top stays ≥ 8 px above the chin
  anchor on every head). The head really sits on it with no visible seam, at any rig size.
- The whole avatar rig is now proportional: anchors and part sizes are derived from the head that
  is actually on the goblin (measured off the keyed head PNGs on all three shapes), so parts that
  used to float or overhang on the bloated and scrawny heads — wide jaws misplacing mouths, wide
  heads overflowing ears — land where they belong. On the canonical angular head every anchor stays
  within 1 px of the old hand-tuned constants (pinned by a regression test).
- Three ears that pre-date the rig overflowed the canvas on the widest head (bloated): bat −16 px,
  torn brass ring −13 px, long ragged −29 px (already bleeding on main). Their widths are now
  capped so the whole ear is in frame on every head while the angular head keeps its hand-tuned
  width: bat ≤ 0 px and torn ≤ 6 px bleed at the ear tip, long ragged fully inside. Every ear now
  passes the 12 px silhouette rule like hair and backgrounds.

**Compatibility**

- No data migration: `GOB-…` codes of versions 1–3 decode and re-encode byte-identically (the
  700-fixture golden corpus is unchanged). Those codes render with the racer bust automatically,
  like every newly built goblin. The body layer is structural (not pickable, not nudgeable) and is
  only encoded from DNA v4 on — v1/v2/v3 stay at their current capacities.

**Under the hood**

- `painted-parts.ts`: rig anchors are `headH` fractions off the eye line via `headRig(shape)`
  (head height measured off the keyed PNG, never guessed); fixed widths became `S(n) = n/54·headW`;
  headgear widths are `2·headW + gap`; `eye-mid` is a measured catalogue token per head (128 on
  angular); new anchors `ear-left`, `scalp`, `neck-top` (shoulder, frame, face-square existed).
- The compositor draws `body` between `background` and `ears`; scaled heads stay symmetric (the old
  hair-front ↔ ears+back reorder is gone — backs splice right behind the body).
- The creator shows a **Body** chip (backdrop row) with the bust card; click-picking and
  position-dragging skip the structural `body` layer.
- `scripts/goblin-sheet.mjs` renders real creator-UI contact sheets (rig guides on) from a DNA
  spec — the eyeball tool for every art round (`docs/art-rounds/rig-check.png` is Phase 0's).
- Registration tests now pin per-layer, per-axis bleed tolerances (documented in
  `tests/painted-parts.test.ts`): everything sits strictly inside the 256² frame except hair and
  backgrounds (≤ 12 px anywhere) and, for now, three ears that pre-date the rig and bled on main —
  they are re-registered in the follow-up commit. Crown headgear may rise off the top edge and
  neck-wear may run to the shoulder line (framing, like shoulders off the bottom), both documented.
