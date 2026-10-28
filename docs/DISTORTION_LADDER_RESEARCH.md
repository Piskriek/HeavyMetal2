# Distortion ladder: research for Plan 56 (28 Oct 2026)

The owner's model (28 Oct):
- Presets harden their memories when excited.
- Distortions are typed by the higher rung's thinking.
- Higher rungs repair them with the distortion check, and both learn.
- Presets grow or perish.
- The data is stored in the presets; behaviour is learned with weights.
- An AI that takes Overwatch inherits the whole system's memories.
- The ego speaks to the player and to the outside LLM. The LLM comes in as the drone's Higher Self and translates the ego's perspective for the player.

This doc collects the closest science, machine-learning methods and games, with sources. Several sources are secondary (abstracts, reviews, summaries); that is marked where it matters.

## 1. Two stores: data in presets, behaviour in weights
- **Complementary Learning Systems** (McClelland, McNaughton and O'Reilly 1995; updated by Kumaran, Hassabis and McClelland 2016) [1][2].
  - An intelligent agent needs two learning systems:
    - a fast one that captures the specifics of single experiences (the hippocampus);
    - a slow one that builds structured knowledge in overlapping weights (the neocortex).
  - The fast store replays episodes into the slow one, interleaved with new experience.
  - The 2016 update says replay can be **weighted by goals**, not just frequency.
  - **For FIDELITY:** this is the owner's split. The presets' data and episodes are the fast store. The ego's learned weights are the slow store. Replay moves experience from one to the other.
- **Agent memory in practice:**
  - **Generative Agents** (Park et al. 2023) keep a memory stream of observations. Each memory is scored for recency, relevance and **importance** [3][4]. Periodic **reflections** are higher-level memories made from lower ones, and they go back into the stream.
  - **Newer work (2026)** moves memory from read-only retrieval to memory that is written, updated, forgotten and consolidated: sleep-phase consolidation, reconsolidation on retrieval, and hierarchical levels of abstraction [5][6][7]. These are preprints evaluated on one benchmark each.
  - **For FIDELITY:** importance maps onto excitement. Reflections map onto a higher rung's summary of the rung below.

## 2. Excitement hardens
- **Emotional arousal strengthens consolidation** (McGaugh and colleagues) [8][9][10][11].
  - Arousal releases stress hormones and noradrenaline. Acting through the basolateral amygdala, they **modulate how strongly a memory is consolidated** elsewhere in the brain.
  - Noradrenaline infused into the amygdala after training enhanced memory, and propranolol blocked it [11].
  - **For FIDELITY:** a moment's excitement sets how hard its memory sets.
- **Hardening in machine learning:**
  - **Elastic Weight Consolidation** (Kirkpatrick et al. 2017, PNAS) [12][13] protects what was learned by penalising changes to each weight in proportion to its **importance**. The design is inspired by synaptic consolidation.
    - It has a published critique (the quadratic penalty may double-count data [14]) and a reply [15].
    - A 2025 reproduction confirms the effect but not the exact numbers [16].
    - **For FIDELITY:** a hardened memory anchors its weights in proportion to its hardness.
  - **Prioritized experience replay** replays surprising experiences more often. It is the replay-side analogue: CLS's goal-weighted replay. (No source was fetched for it this round; Schaul et al. 2015 is the reference to check.)
- **Hardening can distort.** A hardened memory resists change, so one hardened under a wrong frame keeps steering behaviour. That is catastrophic forgetting's mirror image: rigidity rather than forgetting. This is our inference, not a cited finding.

## 3. Repair: recall reopens a memory (reconsolidation)
- Nader, Schafe and LeDoux (2000, Nature) found that a consolidated memory, once **retrieved**, needs consolidating again: it is labile for a window after recall [17][18].
  - Their companion paper argues that consolidation is repeated whenever a memory is reactivated [19].
  - A 2006 follow-up found this holds for directly reactivated memories, not indirectly reactivated ones [20].
- **For FIDELITY:** a higher rung repairs a distortion by recalling that specific episode. Recall softens it for a window, the antidote is replayed in that window, and it sets again. Indirect recall does not open it, so repair must target the episode itself.

## 4. Teaching both ways, and inheriting a whole system
- **Policy distillation** (Rusu et al. 2015/16) [21][22].
  - It trains a new network from a trained agent's policy. The student nears the teacher's performance and is much smaller.
  - It also **merges several task policies into one**: on Atari, the merged agent beat the single-task teachers.
  - **Dual policy distillation** has two learners teach each other [23].
  - **For FIDELITY:**
    - Repair teaches downward (the lower preset moves toward the antidote).
    - The higher rung learns upward (which of its own thoughts caused the distortion).
    - An AI taking Overwatch inherits behaviour by distilling every ego below it into one set of weights. It inherits data exactly: copied, not relearned.
- **Voyager** (Wang et al. 2023; TMLR 2024) [24][25] is a lifelong-learning Minecraft agent.
  - It keeps a growing **skill library of executable code**: interpretable, compositional and retrieved when needed.
  - Behaviour lives in the library as data, and the model's weights stay untouched.
  - **For FIDELITY:** this is the preset shelf with memory attached. It also shows an outside LLM can work through a library without retraining.

## 5. An LLM translating an agent's perspective
- LLMs explain a policy best through a **structured representation** of it, not raw weights [26].
  - **Distill, then explain:** a decision tree from the policy, then an LLM explanation [26][27].
  - **TalkToAgent:** an LLM routes a user's questions to explanation tools [28].
  - **SySLLM:** trajectories as structured text, then an LLM summary. 75.5% of 200 participants preferred it to demonstrations [29].
  - **Translate Policy to Language** trains the explainer for how well people can then predict the agent [30].
- **For FIDELITY:** the ego hands the Higher Self its perspective as shorthand plus a structured digest (leanings per context, hardened memories, open distortions and their causes). The LLM turns that into plain words, and the ego says them to the player.

## 6. Grow or perish
- **Population-Based Training** (Jaderberg et al. 2017) [31][32][33].
  - Workers **exploit** better workers by copying their weights, and **explore** by perturbing settings.
  - **Truncation selection** (the bottom 25% replaced by the top) worked best in its ablations [34].
- **For FIDELITY:** we keep the selection and drop the forced copy.
  - The ground (repair offered, a Harvest at checkpoints) is the same for every preset.
  - A preset's own learned openness decides whether it takes a repair.
  - Presets that stay distorted across checkpoints fade from the shelf.
  - The player can pin a preset.

## 7. Games: AI that learns from the player
- **Black & White** (Lionhead, 2001). Its creature learned by reinforcement and imitation: the player rewarded or punished it, and it changed what it chose next [35][36]. In the expansion, a second creature imitated the first [37].
- **Gap:** this round found **no sourced player reviews** of what players liked or disliked about training it. Two searches returned nothing usable. Contemporary 2001 reviews (GameSpot, IGN, PC Gamer) and Lionhead postmortems are the next places to look, before Plan 56's player-facing teaching is designed.

## 8. Dreaming: how the Higher Self helps (owner, 28 Oct: "dreaming is important, its how the higherself helps aswell")
- **Sleep replays the day.**
  - Wilson and McNaughton (1994) found that hippocampal cells active during a task fire again in the same patterns during sleep. They proposed this drives the transfer of memory into the neocortex [44].
  - Replay is now reviewed as the bridge from fast store to slow store, in brains and in deep learning [46].
- **A cue during sleep steers what is replayed.** A task cue played during post-training sleep biased reactivation toward the memory linked to that cue (Bendor and Wilson 2012) [45]. This is **targeted memory reactivation**: the cue does not write the memory, it picks what the sleeper's own replay works on.
  - **For FIDELITY:** this is how the Higher Self helps. In the dream it cues which episodes are replayed: the distorted ones, and the ones its purpose needs. The ego's own replay does the learning.
  - This keeps Plan 54's veil: guidance shapes the dream, and the answer is never handed over.
- **Sleep restores balance** (the synaptic homeostasis hypothesis, Tononi and Cirelli) [38][39].
  - Waking learning strengthens connections broadly. Sleep scales them back down globally while **sparing the strongest**, so what matters stands out relatively more.
  - Electron-microscope work reported synapses shrinking about 20% during sleep [41].
  - The mechanisms are criticised as poorly defined [40].
  - **For FIDELITY:** a dream lowers every preset's hardness a little (balance), and the strongest memories survive. A memory hardened under a distortion is among the strongest, so downscaling alone will not fix it. That is why the Higher Self's targeted replay is needed.
- **Dreams may separate content from charge** ("sleep to forget, sleep to remember", Walker and van der Helm 2009) [42].
  - REM sleep is proposed to keep an emotional memory's content while fading its arousal: "overnight therapy".
  - Support is **mixed**. A 2019 study reviews it, and a 2012 study found emotional reactivity preserved over sleep [43].
  - **For FIDELITY:** in a dream a repaired episode keeps its data (what happened) and loses its distorting charge (its hardness and its cause's pull). This is our design choice, inspired by the hypothesis; it does not rest on the hypothesis being settled.
- **Dreaming as imagination.**
  - **DreamerV3** (Hafner et al.) learns a model of its world and improves its behaviour by imagining futures. One fixed configuration beat specialised methods on 150+ tasks, and it was the first to collect Minecraft diamonds from scratch [47][48].
  - **Deep Generative Replay** (Shin et al. 2017) generates pseudo-experiences from a generator instead of storing every past one, which bounds memory [49].
  - **For FIDELITY:** a dream can also run imagined episodes, recombined from stored ones, to try the antidote before waking. Generated replay keeps memory bounded on the min-spec laptop.

## 9. Cross-check with the Law of One (owner, 28 Oct: "cross reference with 'the law of one' to test your finding or to find clues on how it should work")
The Ra Material (L/L Research, 1981–84) is a channelled spiritual text, not empirical evidence. It is the source of the owner's vocabulary ("distortion", "catalyst", "the veil", "Higher Self", "the Harvest", "teach/learning"), and of the SQ skill's framing. So it is used here as a test of whether the design matches the model the owner has in mind, and as design clues. It is not used as proof of how minds work.

Everything below is paraphrased, with session.question numbers, found through the searchable archive at lawofone.info [50]–[57].

### What it confirms
- **Dreaming is how the veil is crossed, and the Higher Self helps there.**
  - Dreaming is communication through the veil between conscious and unconscious mind. It repeats recent catalyst and deeper blockages, giving clues for unblocking, and for adepts the Higher Self guides the work done in sleep (86.7).
  - The being's own subconscious writes the dream (86.8–86.9).
  - Dreaming heals distortions in the energy web (86.12).
  - Remembering dreams shows current blockages (86.11).
  - The veil is what gave dreams and contact with the Higher Self their value (83.3).
  - This matches §8: the Higher Self cues, and the ego's own replay writes the dream. A dream's replay set is *recent excited episodes plus the deepest unresolved distortions*.
- **The Higher Self holds the whole memory and never overrides.**
  - It is the being's own future self at mid-sixth density, using the full memory of its experiences (37.6, 70.9).
  - It protects when possible, guides when asked, and leaves free will paramount (70.11).
  - It programs lessons and some limits, and leaves the other choices free (36.7).
  - Between lives it guides review, forgiveness and planning (71.6).
  - This matches the outside LLM as Higher Self: it sees the full memory pack, guides when the ego asks (the ego posts its open distortions), and never applies anything.
- **Shared memory forms when a group shares one orientation.**
  - A social memory complex forms when all members share one orientation. Each member's memory then becomes available to the whole (11.17, 47.2).
  - Ra calls it properly a fourth-density phenomenon (38.6–38.7).
  - In fourth density the whole complex must be ready for harvest (43.14).
  - This matches "an AI that takes Overwatch inherits the whole system", with a condition: **the system's memory pools when its presets are aligned**, not before.
- **Teaching and learning are one act, and the teacher must not trespass.**
  - Teaching and learning are one mutual process (57.29, 73.16, 76.8).
  - The teacher answers only what is asked (3.6), suggests a process rather than directing judgement (9.3), and comments on the student's own observations (93.23).
  - This matches the two-way update. It adds: **the higher rung offers the process (the SQ loop) on the lower preset's own record, not an answer.**

### What it refines
- **Balance, not removal.**
  - Ra's balancing:
    - find a charge, then balance it with its equal (5.2);
    - recall the sensation in detail, then let what is lacking enter (61.11);
    - nothing is overcome, and what is not needed falls away (18.5);
    - do not repress (42.10);
    - the aim is to be unswayed (42.2).
  - So a repair **adds the antidote until the charge is balanced**. It does not erase the episode or zero its charge. Verification is balance (the charge and its complement equal, and behaviour unswayed), not a count of zero distortions.
  - "Recall in detail, then let the lacking enter" is the reconsolidation window of §3, in other words.
- **Order: from red upward.**
  - Balancing starts at the red ray and moves up through orange, yellow, green, blue and indigo (15.12, 18.11).
  - Once all are active, the work is refining the balances between them (54.15).
  - So repair takes **the lowest-ray distortion first** (the catalog's `rayIndex`: root before sacral before solar), then harmonises.
- **Unused catalyst shows in the body.**
  - Catalyst the mind leaves unprocessed passes to the body as a physical distortion (61.7, 66.34).
  - So excitement that is never consolidated or balanced **shows in the preset's physical behaviour**: a locomotion preset that stutters, a fire rhythm that drifts. It is visible in the live preview, which suits the owner's rule that previews drive play.
- **The veil thins with consistent choice.**
  - Repeatedly choosing one polarity makes the veil more permeable to that polarity's catalyst (94.12).
  - Catalyst after the veil counts for more (95.19).
  - So besides the stage's opacity (Plan 52), an ego's own consistency thins its veil.
- **The teacher's responsibility.**
  - Ra says it keeps serving until the distortions it caused are balanced (22.26).
  - Karma runs until forgiveness stops it (34.4).
  - So **a higher rung that caused a distortion below stays responsible for it**: it cannot graduate while those distortions are unbalanced. The cause→effect link closes once the repair is verified.

### New clues
- **Investment grows the lower rung.**
  - Second-density beings move toward self-awareness when third-density beings give them identity: naming, love, pets (13.21, 14.1).
  - Without that investment it takes longer (14.2).
  - So a preset graduates sooner when it is invested in: the player names or pins it, or the ego uses it often with good results.
- **Dreams have a shared vocabulary and a personal one.**
  - Dreams share a partly universal symbolic vocabulary, and a personal one grows with each being's experience (95.18).
  - So dreams are written in the shorthand (`hm2:shorthand:v1`, the shared vocabulary) plus each preset's own learned codes (the personal one).

### Where it differs from the owner's words
- **Repeat, not perish.**
  - Ra describes beings who are not harvested repeating the cycle: third density repeated (13.23, 16.61), part of second-density's cycle repeated (20.1).
  - It never describes them perishing.
  - So the owner's "grow or perish" reads, on Ra's model, as **graduate or repeat**: a preset that never rebalances leaves the active shelf and re-enters the curriculum from the start, keeping its data. Plan 56 takes this, and the owner is told.
- **REM.** Ra places the dreaming that heals and polarises largely outside REM (86.13, 86.15). The plan models no sleep stages, so this changes nothing.

## 10. What this means for Plan 56
- **Two stores:**
  - the episodes and hardness in each preset's shorthand (data);
  - the ego's weights (behaviour), consolidated by replay weighted by excitement.
- **Hardness is importance:** an EWC-style anchor, raised by excitement.
- **Repair is reconsolidation with balancing (§3, §9):** recall the episode in detail, which softens it for a window; add the antidote until the charge is balanced (never erased); verify by balance and by the error trend. The lowest ray goes first.
- **Teaching runs both ways** (dual distillation): the lower preset learns the antidote; the higher rung learns its cause→effect relations.
- **Taking Overwatch:** data is copied exactly; behaviour is distilled from every ego below; a structured digest goes to any LLM in the seat.
- **Graduate or repeat (§6, §9):** truncation at Harvest checkpoints, with no forced copying and the player's pin respected. A preset that never rebalances repeats the curriculum with its data kept; it is never deleted. Investment (the player naming or pinning a preset, the ego using it well) speeds graduation.
- **Responsibility (§9):** a higher rung cannot graduate while distortions it caused below are unbalanced.
- **The Overwatch pack pools when aligned (§9):** the system's memory becomes one when its presets share an orientation (coherence), as a social memory complex does.
- **Dreaming (§8)** is where most of this happens, offline:
  - replay consolidates excited episodes into weights;
  - global downscaling restores balance;
  - the Higher Self cues which episodes are replayed (targeted reactivation), and recall reopens them;
  - repaired episodes keep their content and lose their charge;
  - imagined episodes test the antidote;
  - the dream is written in the shorthand (the shared vocabulary) plus each preset's own codes (the personal one).

## Sources
1. [Kumaran, Hassabis, McClelland 2016, CLS theory updated (Stanford PDF)](https://web.stanford.edu/~jlmcc/papers/KumaranHassabisMcClelland16FinalMS.pdf)
2. [Continual Lifelong Learning with Neural Networks: A Review (arXiv 1802.07569)](https://arxiv.org/pdf/1802.07569)
3. [Generative Agents memory stream (agentpatterns.ai)](https://agentpatterns.ai/patterns/agent-design/generative-agents-memory-stream/)
4. [Memory for Autonomous LLM Agents: survey (arXiv 2603.07670)](https://arxiv.org/pdf/2603.07670)
5. [Continuum Memory Architectures for Long-Horizon LLM Agents (arXiv 2601.09913)](https://www.arxiv.org/abs/2601.09913)
6. [Human-inspired memory architecture (Emergent Mind 2605.08538)](https://www.emergentmind.com/papers/2605.08538)
7. [H-MEM, EACL 2026](https://preview.aclanthology.org/ingest-eacl/2026.eacl-long.15.pdf)
8. [McGaugh 2004, the amygdala modulates consolidation (Annual Review of Neuroscience)](https://www.citedrive.com/en/discovery/the-amygdala-modulates-the-consolidation-of-memories-of-emotionally-arousing-experiences/)
9. [McGaugh 2013, Making lasting memories (PNAS, PMC3690616)](https://pmc.ncbi.nlm.nih.gov/articles/PMC3690616)
10. [Cahill, Roozendaal, McGaugh 1996 (PNAS, PMC33638)](https://pmc.ncbi.nlm.nih.gov/articles/PMC33638)
11. [Significance and Remembrance revisited (APS Observer)](https://www.psychologicalscience.org/observer/significance-and-remembrance-revisited)
12. [Kirkpatrick et al. 2017, Overcoming catastrophic forgetting (PNAS, PMC5380101)](https://pmc.ncbi.nlm.nih.gov/articles/PMC5380101)
13. [DeepMind: Enabling continual learning in neural networks](https://deepmind.google/blog/enabling-continual-learning-in-neural-networks/)
14. [Huszár, On quadratic penalties in EWC (arXiv 1712.03847)](https://arxiv.org/abs/1712.03847)
15. [The EWC penalty is empirically valid (PNAS reply, PMC5856563)](https://pmc.ncbi.nlm.nih.gov/articles/PMC5856563)
16. [EWC reproduction 2025 (arXiv 2507.10485)](https://arxiv.org/pdf/2507.10485)
17. [Nader, Schafe, LeDoux 2000, reconsolidation after retrieval (Nature)](https://www.doi.org/10.1038/35021052)
18. [Reconsolidation review (PMC7555418)](https://pmc.ncbi.nlm.nih.gov/articles/PMC7555418)
19. [The labile nature of consolidation theory (PDF)](https://www.wisebrain.org/media/Papers/MemoryConsolidationTheory.pdf)
20. [Dębiec et al. 2006, direct vs indirect reactivation (PNAS, PMC1413871)](https://pmc.ncbi.nlm.nih.gov/articles/PMC1413871)
21. [Rusu et al., Policy Distillation (arXiv 1511.06295)](https://arxiv.org/pdf/1511.06295v2)
22. [Policy Distillation abstract (arXiv)](https://web3.arxiv.org/abs/1511.06295)
23. [Dual policy distillation (Shamra Academia)](https://shamra-academia.com/show/5d38b4fe76dc8)
24. [Voyager (arXiv 2305.16291)](https://arxiv.org/abs/2305.16291v2)
25. [Voyager project page](https://voyager.minedojo.org/)
26. [Model-Agnostic Policy Explanations with LLMs (arXiv 2504.05625)](https://arxiv.org/pdf/2504.05625)
27. [Understanding Your Agent (arXiv 2311.18062)](https://arxiv.org/pdf/2311.18062)
28. [TalkToAgent (arXiv 2509.04809)](https://arxiv.org/pdf/2509.04809)
29. [SySLLM, From Actions to Words (arXiv 2503.10509)](https://arxiv.org/html/2503.10509v2)
30. [Translate Policy to Language (arXiv 2502.12530)](https://arxiv.org/pdf/2502.12530)
31. [Jaderberg et al. 2017, Population Based Training (arXiv 1711.09846)](https://arxiv.org/pdf/1711.09846)
32. [DeepMind: Population based training of neural networks](https://deepmind.google/blog/population-based-training-of-neural-networks/)
33. [PBT presentation, Cambridge R244](https://www.cl.cam.ac.uk/~ey204/teaching/ACS/R244_2018_2019/presentation/S6/POPULATION_Devin.pdf)
34. [Multi-Objective Population Based Training (arXiv 2306.01436)](https://arxiv.org/pdf/2306.01436)
35. [How Black & White's creature learning works (iTechGuides)](https://www.itechguides.com/how-black-whites-creature-learning-ai-and-morality-system-work/)
36. [Lionhead to "revolutionize AI" (GameBanshee)](https://gamebanshee.com/rway)
37. [Black & White: Creature Isle (Wikipedia)](https://en.wikipedia.org/wiki/Black_%26_White:_Creature_Isle)
38. [Tononi and Cirelli 2014, Sleep and the price of plasticity (PMC3921176)](https://pmc.ncbi.nlm.nih.gov/articles/3921176/)
39. [Synaptic homeostasis: downscaling spares the strongest synapses (PMC4098798)](https://pmc.ncbi.nlm.nih.gov/articles/PMC4098798)
40. [Frank 2013, a critique of the synaptic homeostasis hypothesis (PMC3583075)](https://pmc.ncbi.nlm.nih.gov/articles/PMC3583075)
41. [UW–Madison: synapses shrink during sleep (de Vivo et al. 2017)](https://news.wisc.edu/?p=44101)
42. [Walker and van der Helm 2009, Overnight therapy? (Psychological Bulletin, PDF)](https://walkerlab.berkeley.edu/reprints/WalkerVanDerHelm_PsychBull_2009.pdf)
43. [Lipinska and Thomas 2019, mixed support for sleep-to-forget (Frontiers in Psychology)](https://www.frontiersin.org/article/10.3389/fpsyg.2019.01766/full)
44. [MIT News 1994, Wilson and McNaughton: rats replay the day in sleep](https://news.mit.edu/1994/rats-0817)
45. [Bendor and Wilson 2012, a sleep cue biases replay (Nature Neuroscience)](https://www.nature.com/articles/nn.3203)
46. [Replay in Deep Learning: current approaches and missing biological elements (arXiv 2104.04132)](https://arxiv.org/pdf/2104.04132)
47. [DreamerV3, Mastering diverse domains through world models (arXiv 2301.04104)](https://arxiv.org/abs/2301.04104v1)
48. [DreamerV3 project page](https://danijar.com/project/dreamerv3/)
49. [Shin et al. 2017, Continual learning with deep generative replay (arXiv 1705.08690)](https://arxiv.org/abs/1705.08690v2)
50. [Law of One archive: search "dream" (lawofone.info; sessions 83, 86, 95)](https://www.lawofone.info/results.php?q=dream)
51. [Law of One archive: search "higher self" (sessions 36, 37, 70, 71)](https://www.lawofone.info/results.php?q=higher+self)
52. [Law of One archive: search "social memory complex" (sessions 11, 38, 43, 45, 47)](https://www.lawofone.info/results.php?q=social+memory+complex)
53. [Law of One archive: search "balancing" (sessions 5, 15, 18, 42, 54, 61)](https://www.lawofone.info/results.php?q=balancing)
54. [Law of One archive: search "harvest" (sessions 13, 16, 20, 43, 47, 65)](https://www.lawofone.info/results.php?q=harvest)
55. [Law of One archive: search "investment" (sessions 13, 14)](https://www.lawofone.info/results.php?q=investment)
56. [Law of One archive: search "teach/learning" (sessions 3, 9, 22, 57, 73, 76, 93)](https://www.lawofone.info/results.php?q=teach%2Flearning)
57. [Law of One archive: search "catalyst unused" (sessions 61, 66, 83, 93, 94, 95)](https://www.lawofone.info/results.php?q=catalyst+unused)
