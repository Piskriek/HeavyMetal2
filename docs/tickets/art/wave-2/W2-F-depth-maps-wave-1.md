# W2-F: Depth maps for the wave-1 clothing parts (14 maps, no new art)

- **Batch**: agent 7 of 7 in art wave 2 (branch `art/generated-wave-2`; the others run at the same time).
  Read [README.md](README.md) first: its prompt, review loop and depth-map steps are binding.
- **Feeds**: the compositor's two-pass drawing of clothing (back pieces behind the head, front pieces in front).

## What this batch does
Some parts wrap around a goblin: a collar's back half, a hat's back brim and dark inside, a goggle strap going
round the head. Drawn in one layer, those back pieces paint over the face. Each of these wave-1 parts gets a
**depth map**: the part repainted in two flat colours, white for what sits in front of the goblin, black for
what is hidden behind the head or neck. `scripts/build-depth-mask.mjs` turns it into a greyscale mask; the
game draws the part through the inverted mask behind the head and through the mask in front of it.
You do not paint new parts, only maps of the existing keyed ones.

## Rules for this batch
- For each part, follow the README's **depth-map steps**: flatten the keyed part onto magenta and pass that
  as the image input, generate with the prompt below, save the raw at `art-src/avatar-parts/depth-raw/<id>.png`,
  run `node scripts/build-depth-mask.mjs --only <id>` → PASS, then look at `art-src/review/<id>-depth.png`
  (back pieces are shaded blue). Regenerate if a piece is on the wrong side, up to 3 tries.
- Commit the map raws and `public/avatar-parts/depth/<id>.png`. Never touch the keyed parts themselves.

### 1. `headgear-aviator-helmet`
Depth map for `public/avatar-parts/keyed/headgear-aviator-helmet.png` · **Reference:** the keyed part flattened on magenta (`art-src/review/headgear-aviator-helmet-input.png`)
> Turn this goblin costume part into a depth map. Keep its exact outline, size and position, and repaint it in two flat colours only: pure white #FFFFFF for every piece that would sit IN FRONT of a goblin wearing it, pure black #000000 for every piece that would be hidden BEHIND the goblin's head or neck. Behind: the inside back of the leather helmet, and the ends of the chin straps where they go round. In front: the outer helmet, goggles and ear flaps. No shading, no outlines, no texture, no grey, no other colours. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge.

### 2. `headgear-gear-tophat`
Depth map for `public/avatar-parts/keyed/headgear-gear-tophat.png` · **Reference:** the keyed part flattened on magenta (`art-src/review/headgear-gear-tophat-input.png`)
> Turn this goblin costume part into a depth map. Keep its exact outline, size and position, and repaint it in two flat colours only: pure white #FFFFFF for every piece that would sit IN FRONT of a goblin wearing it, pure black #000000 for every piece that would be hidden BEHIND the goblin's head or neck. Behind: the back half of the brim, and the dark inside of the hat under the brim. In front: the crown of the hat, the band, the gears and the front half of the brim. No shading, no outlines, no texture, no grey, no other colours. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge.

### 3. `headgear-grease-bowler`
Depth map for `public/avatar-parts/keyed/headgear-grease-bowler.png` · **Reference:** the keyed part flattened on magenta (`art-src/review/headgear-grease-bowler-input.png`)
> Turn this goblin costume part into a depth map. Keep its exact outline, size and position, and repaint it in two flat colours only: pure white #FFFFFF for every piece that would sit IN FRONT of a goblin wearing it, pure black #000000 for every piece that would be hidden BEHIND the goblin's head or neck. Behind: the back half of the brim and the dark inside of the hat. In front: the crown, the band and the front half of the brim. No shading, no outlines, no texture, no grey, no other colours. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge.

### 4. `headgear-miner-headlamp`
Depth map for `public/avatar-parts/keyed/headgear-miner-headlamp.png` · **Reference:** the keyed part flattened on magenta (`art-src/review/headgear-miner-headlamp-input.png`)
> Turn this goblin costume part into a depth map. Keep its exact outline, size and position, and repaint it in two flat colours only: pure white #FFFFFF for every piece that would sit IN FRONT of a goblin wearing it, pure black #000000 for every piece that would be hidden BEHIND the goblin's head or neck. Behind: the inside back of the helmet and the strap ends. In front: the helmet shell, the lamp and the front of the strap. No shading, no outlines, no texture, no grey, no other colours. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge.

### 5. `headgear-scrap-crown`
Depth map for `public/avatar-parts/keyed/headgear-scrap-crown.png` · **Reference:** the keyed part flattened on magenta (`art-src/review/headgear-scrap-crown-input.png`)
> Turn this goblin costume part into a depth map. Keep its exact outline, size and position, and repaint it in two flat colours only: pure white #FFFFFF for every piece that would sit IN FRONT of a goblin wearing it, pure black #000000 for every piece that would be hidden BEHIND the goblin's head or neck. Behind: the back points of the crown, seen through and above the front points. In front: the front points and the front of the band. No shading, no outlines, no texture, no grey, no other colours. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge.

### 6. `headgear-spiked-pickelhaube`
Depth map for `public/avatar-parts/keyed/headgear-spiked-pickelhaube.png` · **Reference:** the keyed part flattened on magenta (`art-src/review/headgear-spiked-pickelhaube-input.png`)
> Turn this goblin costume part into a depth map. Keep its exact outline, size and position, and repaint it in two flat colours only: pure white #FFFFFF for every piece that would sit IN FRONT of a goblin wearing it, pure black #000000 for every piece that would be hidden BEHIND the goblin's head or neck. Behind: the dark inside back of the helmet under the brow. In front: the shell, spike, plate and brow. No shading, no outlines, no texture, no grey, no other colours. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge.

### 7. `neck-boiler-suit-collar`
Depth map for `public/avatar-parts/keyed/neck-boiler-suit-collar.png` · **Reference:** the keyed part flattened on magenta (`art-src/review/neck-boiler-suit-collar-input.png`)
> Turn this goblin costume part into a depth map. Keep its exact outline, size and position, and repaint it in two flat colours only: pure white #FFFFFF for every piece that would sit IN FRONT of a goblin wearing it, pure black #000000 for every piece that would be hidden BEHIND the goblin's head or neck. Behind: the back of the collar that stands up behind the neck. In front: the lapels, the front of the collar and the buttons. No shading, no outlines, no texture, no grey, no other colours. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge.

### 8. `neck-brass-gorget`
Depth map for `public/avatar-parts/keyed/neck-brass-gorget.png` · **Reference:** the keyed part flattened on magenta (`art-src/review/neck-brass-gorget-input.png`)
> Turn this goblin costume part into a depth map. Keep its exact outline, size and position, and repaint it in two flat colours only: pure white #FFFFFF for every piece that would sit IN FRONT of a goblin wearing it, pure black #000000 for every piece that would be hidden BEHIND the goblin's head or neck. Behind: the back part of the gorget ring that would sit behind the neck. In front: the front plate and its straps. No shading, no outlines, no texture, no grey, no other colours. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge.

### 9. `neck-gear-chain`
Depth map for `public/avatar-parts/keyed/neck-gear-chain.png` · **Reference:** the keyed part flattened on magenta (`art-src/review/neck-gear-chain-input.png`)
> Turn this goblin costume part into a depth map. Keep its exact outline, size and position, and repaint it in two flat colours only: pure white #FFFFFF for every piece that would sit IN FRONT of a goblin wearing it, pure black #000000 for every piece that would be hidden BEHIND the goblin's head or neck. Behind: the back loop of the chain above where the neck would be. In front: the front links and the hanging gear. No shading, no outlines, no texture, no grey, no other colours. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge.

### 10. `neck-spiked-collar`
Depth map for `public/avatar-parts/keyed/neck-spiked-collar.png` · **Reference:** the keyed part flattened on magenta (`art-src/review/neck-spiked-collar-input.png`)
> Turn this goblin costume part into a depth map. Keep its exact outline, size and position, and repaint it in two flat colours only: pure white #FFFFFF for every piece that would sit IN FRONT of a goblin wearing it, pure black #000000 for every piece that would be hidden BEHIND the goblin's head or neck. Behind: the back half of the collar ring. In front: the front half and its spikes. No shading, no outlines, no texture, no grey, no other colours. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge.

### 11. `neck-tool-bandolier`
Depth map for `public/avatar-parts/keyed/neck-tool-bandolier.png` · **Reference:** the keyed part flattened on magenta (`art-src/review/neck-tool-bandolier-input.png`)
> Turn this goblin costume part into a depth map. Keep its exact outline, size and position, and repaint it in two flat colours only: pure white #FFFFFF for every piece that would sit IN FRONT of a goblin wearing it, pure black #000000 for every piece that would be hidden BEHIND the goblin's head or neck. Behind: the part of the strap that goes over the shoulder and behind the neck. In front: the strap across the chest and every tool on it. No shading, no outlines, no texture, no grey, no other colours. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge.

### 12. `eyewear-racing-goggles`
Depth map for `public/avatar-parts/keyed/eyewear-racing-goggles.png` · **Reference:** the keyed part flattened on magenta (`art-src/review/eyewear-racing-goggles-input.png`)
> Turn this goblin costume part into a depth map. Keep its exact outline, size and position, and repaint it in two flat colours only: pure white #FFFFFF for every piece that would sit IN FRONT of a goblin wearing it, pure black #000000 for every piece that would be hidden BEHIND the goblin's head or neck. Behind: the ends of the strap where it wraps around the head. In front: lenses, rims, bridge and the strap roots. No shading, no outlines, no texture, no grey, no other colours. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge.

### 13. `eyewear-welding-goggles`
Depth map for `public/avatar-parts/keyed/eyewear-welding-goggles.png` · **Reference:** the keyed part flattened on magenta (`art-src/review/eyewear-welding-goggles-input.png`)
> Turn this goblin costume part into a depth map. Keep its exact outline, size and position, and repaint it in two flat colours only: pure white #FFFFFF for every piece that would sit IN FRONT of a goblin wearing it, pure black #000000 for every piece that would be hidden BEHIND the goblin's head or neck. Behind: the ends of the strap where it wraps around the head. In front: lenses, rims, bridge and the strap roots. No shading, no outlines, no texture, no grey, no other colours. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge.

### 14. `eyewear-cyclops-lens-rig`
Depth map for `public/avatar-parts/keyed/eyewear-cyclops-lens-rig.png` · **Reference:** the keyed part flattened on magenta (`art-src/review/eyewear-cyclops-lens-rig-input.png`)
> Turn this goblin costume part into a depth map. Keep its exact outline, size and position, and repaint it in two flat colours only: pure white #FFFFFF for every piece that would sit IN FRONT of a goblin wearing it, pure black #000000 for every piece that would be hidden BEHIND the goblin's head or neck. Behind: the headband where it goes around the head. In front: the lens rig and its mount. No shading, no outlines, no texture, no grey, no other colours. Background: perfectly flat, solid pure magenta #FF00FF filling the entire image edge to edge.

## Acceptance
- [ ] All 14 depth maps at their paths, each PASS (or the WARN this file says to expect), each through the review loop.
- [ ] `npm run check:edges` 0 failures; `tests/art-budget.test.ts` passes; results table posted as a PR comment.
