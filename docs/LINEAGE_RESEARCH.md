# FIDELITY // Lineage Research: reproduction, inheritance and hybrids between presets
> **Why this exists**: the owner (28 Oct 2026): "Do you want the mechanical and organic characters to be able to reproduce and create hybrids? It's a good catalyst, children." SOP 4 (research before design) applies. Nothing here is decided.
> **Read with**: [`argo/plans/56-distortion-ladder.md`](argo/plans/56-distortion-ladder.md) §12 to §15 (polarity, the 3/6/9 frame, the lifecycle, wanderers), §19 (characters), §20 (the preset body). Proposals are L1 to L10, for the leads to accept or drop.
> **Category (not the example)**: lineage between **any two presets that have a body**: organic characters, mechanical characters, cyborgs, the drone. Two organic parents give an organic child, two mechanical parents a mechanical child, one of each a **hybrid**. The first test case is a creature and a robot.
> **Method and limits**: web search plus page fetches. Every `[n]` is a page that was opened (list at the end). Player sentiment comes from Steam threads, wikis and guides, so it is vocal players, not surveys. Odds in guides differ by source and patch; treat them as shape. I read the plan sections for vocabulary only, not the harness source.

---

## 1. Games: what the child inherits and how it shows

### 1.1 Creatures (1996)
- Each Norn has a genome, a variable-length binary string that sets brain organisation and part of its biochemistry. Mating merges and splices the parents' genes, and random errors add mutations [2].
- Most genes build internal structure (chemoreceptors, reactions, brain lobes), not behaviours such as fearlessness, so inherited behaviour is hard to predict [2]. Wikipedia calls the genes haploid, with no dominant or recessive form; mutation can bring new traits or faulty genomes (blind or near-immortal Norns) [1].
- **Learning is separate**: reward and punishment, and older Norns can teach younger ones [1][2]. No source I opened says whether a newborn inherits a parent's lessons.
- Care has weight: neglected Norns fall ill and they die of old age [4].
- **Population limits were real**: posters say the game allows 8 live Norns, imports are hard-coded to that, and a fan patch to 24 may crash a tool near 18 [3].

### 1.2 Niche
- Over 100 genes, dominant-recessive and co-dominant inheritance, plus drift, flow, mutation and selection [5]. Mutation-menu genes act on the next generation: a child gets a chance at a gene the parents lack [6]. Posters say the tutorial explains this poorly [6].

### 1.3 RimWorld Biotech
- **Genes**: germline genes pass to children; implanted xenogenes do not [7]. An embryo takes some germline genes from each parent; one both carry is likelier to pass [9].
- **Growth moments** at 7, 10 and 13: the player picks a trait and passion. How well the child's Learning need was met sets how many options appear (one trait from one option, up to one from six) [7][8].
- **Vats**: parental genetic material grows a baby in about nine days, but vat children miss childhood learning and get weaker choices [7]. A shortcut exists and it costs the child.
- **Presentation**: pregnancy is notices and a Health-tab entry; children can be switched off in storyteller settings; teenagers can reproduce only from 16 [9][10].

### 1.4 ARK
- Each stat comes from one parent (the higher value 55% of the time). Up to three mutation rolls of 2.5% each add 2 levels to a stat and recolour one region [12].
- Maternal and paternal counters show **ancestry**. A side at 20 stops producing mutations, and the counter is not a count of the creature's own mutations [12]. The wiki page covers stats only.

### 1.5 Crusader Kings 3
- Congenital traits pass down, likelier when both parents share one or are related; leveled traits can shift a level. A trait can pass as an **inactive** factor and show later. Related parents raise the odds, and Inbred carries significant penalties [14].
- The game warns before an inbreeding marriage [15]. The wiki and a guide disagree on exact odds [14][15]. The store page advertises traits passed down a dynasty [16].

### 1.6 The Sims 4, Spore, Black & White
- **Sims 4**: no dominant or recessive genes. Hair and eyes come from one parent, skin often blends, some features appear at teen age. Children inherit looks, not personality [18]. Some traits follow bloodlines across generations [19].
- **Spore** changed one creature in a lifetime; a critic wanted population-level inheritance [21].
- **Black & White**: the creature learns from reward, punishment and what it sees the player do; the player's alignment shows in the temple colour [17]. Secondary site; colour only.

### 1.7 Hybrids and fusion
- **Cassette Beasts**: modular parts let any pair fuse (14,000+ fusions), but a fusion lasts one battle. A reviewer was cooler on the mostly procedural fusions [22].
- **Palworld**: a Breeding Farm, a male and a female Pal and a cake give an egg about every 5 minutes. Species comes from averaging a hidden rank; passives and active skills pass from the parents; mutation is about 1% per egg [23].
- **Pokémon**: two Pokémon at the Day Care yield an egg; the baby inherits moves, ability and some IVs, and nature is random unless an item fixes it [25].
- **Robot-organic breeding**: no shipped game found. An itch.io design post suggests offspring usually follow one body type, with hybrids only when enough parts are structurally compatible [26]. A Mutants: Genetic Gladiators robot-zombie hybrid showed in a search snippet; the page would not open (unverified).

### 1.8 Newest: AI creatures that inherit learned behaviour
- One hobby neuroevolution sim passes initial brain parameters with mutation and states that a parent's learned weights are not copied [27].
- A 2026 paper compared regimes. Where learned weights pass to offspring (averaged across parents, output layer reset), training fitness was higher, but a frozen evaluation showed no consistent winner [28]. Passing learned weights is a choice with unproven benefit.
- NEAT aligns parental genes by permanent innovation numbers: shared genes from either parent, unshared ones only from the fitter parent [29].

---

## 2. What players praise and complain about

| Theme | Evidence | Fix |
|---|---|---|
| **Children make the world feel whole** | RimWorld posters say a colony without children feels lacking [11]. | n/a |
| **Care loops become chores** | ARK imprinting is mocked as "farmville"; a player missed 100% by seconds; owners use interval multipliers and a "baby care" kibble [13]. | Server multipliers, mods [13] |
| **RNG breeding** | Palworld posters say passive-skill RNG makes a Pal worth max-starring hard to get [24]. | Cakes that raise odds [23] |
| **Children feel like reskins** | Sims children inherit looks, not personality, which one guide finds odd [18]. | Genetic Rewards mod ties personality to inherited traits (100%, 33% or 4% by version) [18] |
| **Inbreeding, closed pool** | CK3 warns and applies Inbred [14][15]. | n/a |
| **Population limits, import bugs** | Creatures: 8-Norn limit; imports fail on pregnant Norns [3]. | Fan patch to 24 [3] |
| **Vats cost the child** | Vat children miss learning [7]. | n/a |

Not verified: the RimWorld mod "Children, School and Learning" (Workshop 1541438230; HTTP 429, search summary only); EA forum complaints that Sims genetics are predictable (HTTP 403).

---

## 3. Weight inheritance for a child preset

A child's "brain" is a data record with learned weights, so model merging applies.

- **Task vectors** are deltas from a shared base (fine-tuned minus base). Adding two combines skills; negating one removes a skill [30]. For us: child = template + a·ΔA + b·ΔB.
- **TIES** trims tiny deltas, elects one sign per weight where parents disagree, and averages only agreeing values, to reduce interference [31]. As described it has no random step.
- **DARE** drops a random share of deltas (up to 90 to 99%) and rescales the rest, on models sharing one base [32]. Its randomness would need a PRNG seeded from the parents' hashes.
- **Model soups** average models fine-tuned from one start, which tend to sit in one low-error region [33]. **Git Re-Basin** shows independently trained networks have permuted units and need alignment first [35]. Takeaway: merge only presets that descend from a **shared template**, or the child is muddled.
- **Evolutionary merging** searches recipes in weight space and data-flow space [34]. A cheap form: a seeded choice of which parent supplies each role whole, plus a seeded blend inside shared roles.
- **NEAT crossover** matches genes by ID: shared genes from either parent, unshared from the fitter [29]. Our role slots (fire, reflex, flight; move, attack, sense) are the genes; a hybrid has roles one parent lacks.
- **Mutation** in ARK is a bounded step on one stat with a per-side cap [12]. For us: one bounded step per child, seeded from hash(parent A, parent B, birth tick). No `Math.random`.

---

## 4. Law of One clues (paraphrased; each passage opened)

- **Parent teaches child (42.20)** [36]. Asked how a parent shows each energy center, Ra says a child is not an instrument to play. The teaching is open-hearted presence and full acceptance, a daily share of the parent's own thanks, and some discipline, since the child absorbs the parent's orientation toward service to others or self. Every relationship is unique, so the guidance is general.
- **Choosing parents (21.10, 50.5)**. Once incarnation is no longer automatic, an entity can choose its parents [37]. In 50.5, an entity made agreements with its parents and siblings before birth to supply catalyst for giving radiance without return [38].
- **The child takes part (66.14)**. Even a very young child's mind/body/spirit complex can will its own experience [40].
- **Children arriving from fourth density (63.15 to 63.18)**. Some harvested, service-oriented third-density entities earn early incarnation on Earth, and they are not wanderers because this is their fourth-density home. Ra confirms many metal-bending children are such entities, and agrees they affect polarization through teaching only later [39]. I found no passage on the "harvest of children" as a class.
- **The mated relationship as catalyst**. The original Logoi meant mating to raise polarization and left a bias toward committed pairs, offered, not forced (84.22) [41]. Between mates, energy rises from red, and the key above green is unconditional love (84.13, 84.20); Ra advises looking for the "jewel" in each experience with one's mate [41]. A pair seeking higher transfers gains polarization (86.20) [42]. A mate with a strong blue ray gave one entity lasting growth, with karma from inharmonious patterns (35.1) [47]. Imprinted monogamy in second density is a mild carryover; free will is stronger (99.10) [43].
- Seen only on the site's search listing, pages not opened: 18.9 (guides are what we call parents, teachers, friends) and 65.17 (a womb image for a planet's birth) [45]. Not searched: Ra on reproduction in higher densities.

---

## 5. Safety and presentation (children may play)

- **Pokémon** shows no act; an egg appears at the Day Care, and the games are "purposely vague" [25]. **Creatures** frames mating as a kissing sound and a pop [1], then a hatchery egg [4].
- **The Sims 4** is rated T with Sexual Themes; ESRB describes Sims under covers with hearts above the bed [20]. That level is not wanted here.
- **RimWorld** gates reproduction at 16, shows pregnancy as notices, and can disable children [9][10]. **Growth vats** give a no-contact route [7]. **Palworld** uses a facility and a cake to make the egg [23]. **Cassette Beasts** shows fusion as a modular merge [22].
- For FIDELITY the non-sexual routes that fit the fiction: a **co-built core** or **seed pod** at a fabricator (mechanical), **budding** or an egg or spore found at a nest (organic), a **graft** (hybrid). None needs a depicted act.

---

## 6. Design implications (proposals; the leads decide)

- **L1. Child = genome, not memory.** Inherit template, role weights, body zones and a polarity; do not copy the parents' hardened episodes, so the child has something to learn (Creatures, neuroevolution sims [2][27]). An optional seeded share of the parents' distilled leanings could pass if the leads want Lamarckian inheritance; the 2026 evidence is mixed [28].
- **L2. Merge deltas from a shared template.** Keep each character preset a delta from a kind template; child = base + a·ΔA + b·ΔB with TIES-style sign election [30][31]. Warn or align by role when templates differ [35].
- **L3. Seed everything from parent hashes.** Role choice NEAT-style (either parent for shared roles, the fitter for unshared), one bounded mutation step, a PRNG seeded from hash(A, B, birth tick) [12][29]. Same parents and tick give the same child.
- **L4. Hybrids at the zone level.** Seven zones by two sides gives 14 pick points; each is taken from either parent's body, so an organic base can carry a mechanical lens. That keeps hybrids visible, as ARK colours and Sims features do. Add a compatibility rule, such as enough matching zones [26].
- **L5. A hybrid sits near balance.** §19 puts creatures near −80 and mechs near +80, so a mixed child lands near 0. That fits the 3/6/9 frame: two poles and a **Harmonizer** child. Raising it could turn a dyad into a triad.
- **L6. Raising as growth moments.** Three or four fixed moments (RimWorld uses 7, 10, 13 [8]); at each, the child's pick (a leaning, a role, a zone tune) depends on how well the parents' care met its needs. A fabricator-only child gets fewer picks [7]. Parents learn here too: per Ra a child absorbs the parent's orientation [36], so an unbalanced parent sees its trench mirrored and a balanced, accepting one lends calm. That reuses the anchor and dream-cue rules (§15).
- **L7. Latent inheritance and ancestry.** CK3-style inactive carry: a parent's open distortion can appear as a dormant tendency that wakes at a growth moment [14]. Show lineage in the Studio as an ancestry view with a per-side counter like ARK's [12].
- **L8. Avoid the known pains.** No timers that punish absence or miss targets by seconds [13]. No hidden gambling: show a preview range before pairing and keep variance bounded [24]. Warn on near-identical parents, as CK3 does [15]. Show per zone what the child resembles, so it never reads as a reskin [18].
- **L9. Caps.** Creatures needed a community patch for population [3]. One active child per dyad, a per-plot limit, memory per species for short-lived monsters and per entity for persistent ones (already §19). Extra children archive as inert seed presets in the Studio library.
- **L10. Content safety.** Name it "bond", "co-build", "seed" or "graft", never "mate". Show a pod, nest or fabricator, not an act. Add an off switch and keep children out of combat by default [10]. Neglect should stall a child, not kill it (Creatures' illness and death [4] is the model to avoid).
- **Open idea (Ra 21.10, 50.5 [37][38])**: a **risen, harvest-ready** preset waiting for harvest day (§14) could "choose" which dyad to be born through, joining astral travel and the wanderer role (§15). Lore proposal, not a mechanic.

---

## Sources
1. https://en.wikipedia.org/wiki/Creatures_(video_game_series) : Creatures (video game series), Wikipedia
2. https://www.timeshighereducation.com/news/nine-hours-to-live-in-eden/109259.article : Nine hours to live in Eden, Times Higher Education
3. https://gog.com/forum/creatures_series/c1_creatures_die_on_import : Creatures die on import, GOG forum
4. https://games.multimedia.cx/creatures-adventures-revisited/ : Creatures Adventures revisited
5. https://store.steampowered.com/app/440650/Niche__a_genetics_survival_game/ : Niche, Steam store
6. https://steamcommunity.com/app/440650/discussions/1/1495615865231169642 : Niche mutation menu thread, Steam
7. https://ludeon.com/blog/?p=1632 : RimWorld Biotech release post, Ludeon
8. https://www.rimworldwiki.com/wiki/Growth_moments : Growth moments, RimWorld Wiki
9. https://rimworldwiki.com/wiki/Reproduction : Reproduction, RimWorld Wiki
10. https://rimworldwiki.com/wiki/Children_and_reproduction : Children and reproduction, RimWorld Wiki
11. https://steamcommunity.com/app/294100/discussions/0/600765687030442251 : RimWorld Biotech discussion, Steam
12. https://ark.wiki.gg/wiki/Mutations : Mutations, ARK wiki
13. https://steamcommunity.com/app/346110/discussions/0/1694919808736240246 : ARK imprinting thread, Steam
14. https://ck3.paradoxwikis.com/Traits : Traits, CK3 wiki
15. https://www.gamewatcher.com/crusader-kings-3-marriage-and-genetics-guide : CK3 marriage and genetics guide
16. https://store.steampowered.com/app/1158310/Crusader_Kings_III/ : Crusader Kings III, Steam store
17. https://macmyths.com/how-black-whites-creature-learning-ai-and-morality-system-work/ : How Black & White's creature learning works (secondary site)
18. https://snootysims.com/wiki/sims-4/sims-4-genetics-and-mods/ : Sims 4 genetics and mods
19. https://simscommunity.info/2026/04/22/guide-sims-4-inherited-traits/ : Guide: Sims 4 inherited traits
20. https://www.esrb.org/ratings/37346/the-simstm-4/ : The Sims 4, ESRB
21. https://blog.coturnix.org/2008/06/23/spore_creature/ : Spore Creature, Coturnix blog
22. https://en.wikipedia.org/wiki/Cassette_Beasts : Cassette Beasts, Wikipedia
23. https://www.gameserverkings.com/knowledge-base/palworld/palworld-breeding-guide.md : Palworld breeding guide
24. https://steamcommunity.com/app/1623730/discussions/0/4139438760457145186 : Palworld grind thread, Steam
25. https://pokemondb.net/mechanics/breeding : Pokémon breeding mechanics, PokémonDB
26. https://itch.io/post/428957 : creature-building design thread, itch.io
27. https://github.com/mixic/neural-selection : neural-selection brain evolution simulator
28. https://arxiv.org/html/2608.10323 : Neuroevolution Arena: update-and-inheritance regimes
29. https://neat-python.readthedocs.io/en/latest/innovation_numbers.html : Understanding Innovation Numbers, NEAT-Python
30. https://arxiv.org/abs/2212.04089 : Editing Models with Task Arithmetic
31. https://arxiv.org/abs/2306.01708 : TIES-Merging
32. https://arxiv.org/abs/2311.03099 : DARE (Language Models are Super Mario)
33. https://arxiv.org/abs/2203.05482 : Model soups
34. https://arxiv.org/abs/2403.13187 : Evolutionary Optimization of Model Merging Recipes
35. https://arxiv.org/abs/2209.04836 : Git Re-Basin
36. https://lawofone.info/s/42 : Law of One session 42
37. https://lawofone.info/s/21 : Law of One session 21
38. https://lawofone.info/s/50 : Law of One session 50
39. https://lawofone.info/s/63 : Law of One session 63
40. https://lawofone.info/s/66 : Law of One session 66
41. https://lawofone.info/s/84 : Law of One session 84
42. https://lawofone.info/s/86 : Law of One session 86
43. https://lawofone.info/s/99 : Law of One session 99
44. https://www.lawofone.info/results.php?q=children : lawofone.info search, "children"
45. https://www.lawofone.info/results.php?q=parents : lawofone.info search, "parents"
46. https://www.lawofone.info/results.php?q=mate : lawofone.info search, "mate"
47. https://lawofone.info/s/35 : Law of One session 35
