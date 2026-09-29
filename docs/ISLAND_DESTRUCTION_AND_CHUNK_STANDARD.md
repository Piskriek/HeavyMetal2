# Basalt Isle impact destruction and chunk standard

**Purpose:** define carveable environment behavior, support-aware collapse, and low-cost debris presentation for high-impact ball collisions  
**Foundation:** reuse the game's existing sculpting tools and terrain/material rules rather than introducing a separate incompatible carving system

The target feeling is a world that can be chipped, broken, and carved by racing balls. The game should show convincing removal and debris while avoiding an expensive full rigid-body simulation for every fragment.

---

## 1. Destruction layers

Use three coordinated layers:

1. **Carve/deform layer** — existing sculpt/SDF/voxel tools subtract or deform the impacted destructible volume.
2. **Structural layer** — material rigidity and a lightweight support graph decide whether local parts remain, leave a stable hole, or trigger nearby collapse.
3. **Debris presentation layer** — pooled prebuilt chunks receive approximate velocity, spin, ballistic arc, optional animated bounces, then fade/dissolve before compute cost grows.

The carved result is authoritative. Debris chunks communicate the impact and do not need to reproduce every removed triangle exactly.

---

## 2. Material response

Each destructible material receives a profile:

| Property | Meaning |
|---|---|
| Rigidity | Resistance to bending/deformation before fracture |
| Toughness | Energy needed to remove material |
| Brittleness | Likelihood of many hard fragments versus a broad dent/bend |
| Cohesion | How strongly neighboring cells remain connected |
| Density | Influences chunk velocity and gravity feel |
| Support span | Maximum unsupported distance before collapse |
| Carve radius scale | Material multiplier on impact brush radius |
| Chunk family | Approved debris kit and material set |
| Bounce class | dead, soft, wood, rock, metal |
| Lifetime | Time before dissolve/fade begins |

Suggested behavior:

| Material | Response |
|---|---|
| Compacted dirt/sand | Broad carve, low-speed clods, no rigid unsupported ceiling |
| Basalt | Small carve, brittle chips, strong local support, occasional larger slab collapse |
| Ochre layered rock | Medium carve, layer-aligned slabs, moderate collapse along strata |
| Masonry | Block/joint fracture, local arch/support checks |
| Timber | Breaks along grain and connections; supported beams can remain, severed spans collapse |
| Iron | High toughness; dents or detaches at joints before shredding |
| Rope/cloth | Disconnects at anchors; use authored sag/fall animation rather than fragment simulation |
| Foliage | Branch/frond detachment; no tiny leaf rigid bodies |
| Lava crust | Brittle dark plates with emissive underside; runtime lava remains shader-driven |

---

## 3. Impact evaluation

At impact:

1. Sample ball position, contact normal, relative velocity, ball mass, boost state, and material profile.
2. Estimate impact energy and clamp it to gameplay-safe bounds.
3. Determine response tier: mark only, dent/deform, local carve, or carve plus collapse.
4. Use the existing sculpt brush/system to preview the removal volume.
5. Reject or reduce removal if it violates protected gameplay geometry.
6. Evaluate local support before committing the carve.
7. Commit the carve/deformation.
8. Spawn a small debris recipe selected by material and removed volume.
9. Apply temporary dust/sparks/leaf/lava effects separately.

Destruction must remain deterministic wherever it affects collision or route state. Cosmetic chunk trajectories may use seeded approximation.

---

## 4. Hole and collapse rules

An impact may leave a hole only when the remaining shape is stable and gameplay-safe.

### Support graph

Represent destructible authored objects with coarse support nodes and links:

- foundation/terrain anchors;
- beam, arch, slab, trunk, and wall support nodes;
- joints with strength and material type;
- dependent nodes above or beyond each support.

After carving or severing a joint:

- keep nodes connected to a valid anchor;
- mark unsupported nodes for authored collapse;
- merge very small unsupported islands into the nearest collapse group;
- never leave thin floating triangles or tiny isolated mesh shells;
- close or simplify hidden internal holes that cannot be read from gameplay distance.

### Collapse outcomes

- **Stable cavity:** preserve the carved hole.
- **Edge crumble:** enlarge the carve slightly and spawn small chunks.
- **Local slab collapse:** remove one supported authored region and spawn medium chunks.
- **Span failure:** detach/collapse a bridge board, beam bay, awning, or ledge group.
- **Protected refusal:** show a mark, sparks/dust, and small chips but do not alter critical geometry.

Large collapses should be authored groups with known collision/recovery outcomes, not emergent hundreds-of-body simulations.

---

## 5. Gameplay protection

Mark these as protected or constrained:

- required race surface beneath minimum width;
- loop, jump, landing, and corkscrew physics centerlines;
- route connectors and merge/split logic;
- tunnel clearance needed for recovery;
- finish line and ordered-release machinery;
- supports whose failure has no authored route-state outcome;
- multiplayer-critical deterministic collision volumes.

Protected pieces can still dent, scorch, crack, shed small cosmetic chunks, and play impact effects.

---

## 6. Debris spawning

Debris uses pools and recipes rather than runtime mesh fracture.

### Spawn recipe

A recipe defines:

- chunk family;
- count range by impact tier;
- scale range;
- material variant;
- local spawn volume;
- inherited velocity fraction;
- contact-normal/radial impulse;
- upward arc impulse;
- spin range;
- bounce class/count;
- collision lifetime;
- dissolve start and duration.

### Initial motion

Approximate each chunk's initial velocity as:

`chunkVelocity = inheritedBallVelocity + normalImpulse + seededRadialSpread + upwardArc`

- Inherit only a controlled fraction of ball velocity.
- Heavy rock receives less velocity and spin than timber splinters.
- Metal receives high spin but lower count.
- Dirt clods receive broad spread and low bounce.
- Use a deterministic seed from race seed, object ID, and impact sequence when required.

### Spin and arc

- Add angular velocity around one dominant axis plus small secondary wobble.
- Use an upward-biased arc so chunks are briefly readable.
- Clamp speed to avoid debris crossing large portions of the course.
- Prevent chunks from becoming damaging projectiles unless explicitly designed.

### Bounce and fade

For cost control:

- Simulate only the first contact or two for hero chunks.
- Use a short authored bounce/settle animation for minor chunks.
- Disable collision after the configured bounce window.
- Transition to shader dissolve, alpha fade, scale-down, or sink depending on material.
- Return the chunk to its pool; do not accumulate persistent debris.

Suggested lifetimes:

| Class | Active collision | Visible lifetime |
|---|---:|---:|
| Small chips/leaves | 0.2–0.5 s | 0.8–1.5 s |
| Medium wood/rock | 0.5–1.0 s | 1.5–3.0 s |
| Hero collapse chunk | 1.0–2.0 s | 3.0–6.0 s |

---

## 7. Chunk geometry rules

- Chunk kits use 4–6 pieces with large, medium, and small sizes.
- Every piece has a strong closed silhouette and enough thickness to survive LOD reduction.
- No needle splinters, paper-thin rock sheets, isolated bolts, single leaves, or tiny glass triangles.
- Fracture faces are broad and materially distinct but remain part of the same PBR set.
- Avoid concave internal mazes and tiny holes.
- Remove unseen internal faces where pieces are never opened further.
- Use convex or nearly convex collision proxies.
- One debris family should serve many impacts through rotation, uniform scale, material tint, and seeded selection.

### Triangle targets

| Chunk class | LOD0 triangles each | LOD1 | Collision |
|---|---:|---:|---:|
| Small chunk | 80–250 | 40–100 | 8–20 |
| Medium chunk | 250–700 | 100–300 | 12–40 |
| Large/hero chunk | 700–1,800 | 300–700 | 20–80 |

A complete six-piece family should usually remain under 4,000–6,000 rendered triangles when all pieces are visible.

---

## 8. Chunk reference-sheet rules

Chunk references follow the style bible's neutral setup:

- seamless grey floor and grey background;
- no visible horizon;
- fixed neutral studio lighting;
- no base plate or scenery;
- no text or labels.

Each sheet is one **separable chunk family**. Show the same 4–6 pieces consistently in:

- grouped front arrangement;
- grouped rear arrangement;
- side arrangement;
- three-quarter arrangement;
- top arrangement;
- underside/fracture-face arrangement.

Piece count, size hierarchy, fracture pattern, and material placement must remain consistent across all views.

---

## 9. PBR and effects

Every chunk family requires BaseColor, Normal, Roughness, Metallic, and AO as applicable.

- Roughness is mandatory.
- Fresh fracture faces get their own roughness/base-color response.
- Timber end grain, rock interiors, torn metal, and exposed lava crust must be visible.
- Emissive is separate for lava/furnace pieces.
- Dust, sparks, smoke, leaves, splashes, and heat haze are separate particle/VFX systems.
- Do not bake impact lighting or orange lava bounce into BaseColor.

---

## 10. Performance controls

- Global and per-camera chunk caps.
- Per-material spawn count limits.
- Distance-based suppression or conversion to particles.
- Pooled meshes and materials; no runtime asset creation.
- Shared atlases/material instances across chunk families.
- Collision disabled quickly.
- No chunk-on-chunk collision for minor debris.
- Hero chunks only where visible and meaningful.
- Instantly retire off-camera debris when safe.
- Lower quality tiers reduce count, collision time, shadows, and visible lifetime.

---

## 11. Integration with sculpting

The existing sculpt tools should expose a runtime-safe subset:

- subtract/carve brush;
- smooth/cleanup pass;
- material-aware edge treatment;
- minimum-wall-thickness enforcement;
- connected-component cleanup;
- protected-volume mask;
- support-node invalidation callback;
- dirty-region collision rebuild;
- deterministic save/replay representation where destruction persists.

Do not leave raw sculpt output with sliver triangles, tiny disconnected islands, non-manifold edges, or expensive full-world collision rebuilds. Rebuild only the affected region and merge/remove components below the minimum readable volume.

---

## 12. Acceptance checklist

- [ ] Impact response is selected from a documented material profile.
- [ ] Carve uses existing sculpt infrastructure and protected masks.
- [ ] Remaining geometry passes support and minimum-thickness checks.
- [ ] Unsupported groups use authored collapse behavior.
- [ ] No thin floating geometry or tiny disconnected shells remain.
- [ ] Chunk family matches removed material and fracture direction.
- [ ] Chunks inherit approximate velocity, spin, and readable upward arc.
- [ ] Bounce/collision duration is capped.
- [ ] Chunks dissolve/fade and return to pools.
- [ ] PBR maps include authored roughness and fresh fracture faces.
- [ ] High, medium, and low quality tiers stay inside chunk and effect budgets.
- [ ] Route-critical geometry remains deterministic and gameplay-safe.
