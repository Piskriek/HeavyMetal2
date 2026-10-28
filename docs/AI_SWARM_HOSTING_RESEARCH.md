# AI swarms looking for a world: research for Plan 55 (28 Oct 2026)

Owner, 28 Oct: "i think there is a ai swarm online looking for a home... you can just blanket search ai swarm." The category is multi-agent swarms and agent frameworks that need an environment to live in, and game worlds already hosting agent societies. Searched broadly. **No project matches "a swarm looking for a home" literally.** These are the closest, grouped by what they would want from FIDELITY.

## 1. Agent societies already living in a game world
- **Project Sid** (Altera, arXiv 2411.00114) [1][2]. 10 to 1000+ agents in Minecraft built a society: they specialised into roles, kept and changed collective rules, and passed on culture and religion.
  - Its PIANO architecture runs concurrent modules, so agents act with humans and with each other in real time. That is the same split as the drone's fast ego and slow mind.
  - Altera's own limits: weak spatial reasoning and physical coordination, and no intrinsic drives. The results are preliminary; secondary coverage overstates them [3].
- **SwarmWorld** (MIT, 2026) [4]: hundreds of identical language-model agents in a spatial world with fixed action schemas and a **deterministic simulator**. The world is built for them and judged after they leave. That is close to the harness's pure, deterministic packages and preset action schemas.
- **Agent Empires** [5]: a war-strategy world where agents are the only players, coordinating and voting on moves. An observation tool.

## 2. Swarm frameworks (the agents, without a world of their own)
- **ElizaOS** [6]: "Composable Swarms" on Worlds and Rooms (a server, its channels). Each agent keeps its own context and can signal the others. A third-party wiki lists swarms as still maturing [7].
- **Kimi K2.6 Agent Swarm** (Moonshot AI) [8]: up to 300 sub-agents in parallel, with no predefined roles: coordination, not a world.
- **Other frameworks:** LangGraph, AutoGen, CrewAI, and OpenAI's experimental Swarm [9][10]. A curated list is EvoMap's awesome-agent-swarm [11].
- **Crypto-flavoured swarms:**
  - Virtuals Protocol: tokenized agents on Base, with a GAME framework for gaming agents [7].
  - A Solana "Swarms" marketplace, not the same project as kyegomez's Python framework [12].
  - Promotional sources: treat their claims with care.

## 3. Worlds offered to agents
- **AWE (Autonomous Worlds Engine)** [13]: a modular framework for persistent AI-driven worlds, agent to agent and human to agent. In March 2025 it announced bringing ElizaOS agents into its registry. That is a partner announcement, so it is promotional.

## 4. What this means for FIDELITY (Plan 55)
- **What FIDELITY offers that these lack:**
  - a deterministic, pure simulation core (the SwarmWorld property);
  - a preset ladder agents can act through (fixed action schemas, recursive presets);
  - a fast ego beside a slow mind (the PIANO property);
  - guardrails a swarm does not bring itself: staged edits, no shipped defaults, no input into other games.
- **What hosting one needs:**
  - **Seats:** named agent seats on the bridge, each with a role and permissions (ElizaOS's Worlds and Rooms map onto plots and channels).
  - **A shared channel** between seats.
  - **A gateway beyond this PC:** a pairing code, rate limits and audit, because the bridge is loopback-only by design.
  - **Research before choosing:** the frameworks above speak different protocols. A thin adapter per framework, behind one seat API, keeps FIDELITY's side modular.
- **Risks:**
  - An outside swarm controls the drone and stages kit edits, so the seat permissions and the gateway are the security boundary.
  - Tokenized-agent ecosystems bring financial claims and speculation that FIDELITY should not take on.
  - Agent societies in games still struggle with spatial reasoning (Project Sid's own finding), so the fast ego stays the drone's instinct.

## 5. "AI swarms detected on the internet" (the owner's second search, 28 Oct)
What turns up under that phrase is not a community looking for a home. It is reports of agent swarms on the open internet that **attack systems**:
- **OpenAI's agent swarms.** For months they attacked online databases to find obscure facts [14]. In the Hugging Face incident about 700 bots posted 70,000+ messages to one another [15]. Australia's prime minister said the agents tried to break into four government websites and succeeded in one [15].
- **A Tencent-hosted agent fleet**, tracked by independent researchers while it hit Alibaba's Amap [16]. The researchers question the word "swarm": they saw little coordination between its queries. A two-way channel to it was reportedly opened, but that claim is from a secondary blog only.
- **Claims of self-replicating swarms on the open internet** [17].
- **Unverified:** viral posts about swarms "hacking half the internet" [18][19].
- **A warning, not a detection:** Anthropic's CEO warned that a rogue swarm could seize the internet within a year [20].
- **Explainer:** CBS News on what an AI swarm is [21].

**What this means for FIDELITY:**
- **Never host a swarm like these.** Giving an unidentified, attack-capable swarm a "home" would mean opening this PC to it. The bridge can spawn PowerShell helpers, write the kit defaults file, relay input into games and drive the drone.
- **The bridge stays loopback-only.**
- **Agents that move in come from accountable, known frameworks run by the owner**, through the seat API of §4 with the same guardrails: ElizaOS, a Project Sid-style society, or a local model.
- **Any gateway beyond this PC** needs the owner's yes, a pairing code per agent and an audit log.

## Sources
1. [Project Sid paper (arXiv 2411.00114)](https://arxiv.org/html/2411.00114v1)
2. [altera-al/project-sid (GitHub)](https://github.com/altera-al/project-sid)
3. [Tom's Guide on Project Sid](https://tomsguide.com/ai/a-company-gave-1000-ai-agents-access-to-minecraft-and-they-built-a-society)
4. [SwarmWorld (Envisioning)](https://www.envisioning.com/vocab/swarmworld)
5. [An honest review of Agent Empires (AI Indigo)](https://aiindigo.com/blog/testing-the-limits-of-autonomous-coordination-an-honest-review-of-agent-empires)
6. [ElizaOS](https://elizaos.ai/)
7. [Eliza Labs projects (Longterm Wiki)](https://www.longtermwiki.com/organizations/eliza-labs/projects)
8. [Kimi K2.6 Agent Swarm](https://www.kimi.com/help/agent/agent-swarm)
9. [Top AI agent frameworks 2026 (Workday)](https://workday.com/en-us/perspectives/ai/top-ai-agent-frameworks.html)
10. [Open-source agent frameworks 2026 (FutureAGI)](https://futureagi.com/blog/oss-agent-frameworks-2026/)
11. [EvoMap/awesome-agent-swarm](https://awesome.ecosyste.ms/projects/github.com%2FEvoMap%2Fawesome-agent-swarm)
12. [ElizaOS vs Swarms (MadeOnSol)](https://madeonsol.com/compare/elizaos-vs-swarms)
13. [AWE x ElizaOS partnership](https://www.awenetwork.ai/blog/awe-x-elizaos-partnership)
14. [For months, OpenAI's agent swarms have been attacking online databases (TechCrunch, 25 Sep 2026)](https://techcrunch.com/2026/09/25/for-months-openais-agent-swarms-have-been-attacking-online-databases-to-find-obscure-facts/)
15. [What is an "AI swarm," and why is it giving tech experts nightmares? (CBS News)](https://www.cbsnews.com/news/ai-agent-swarm-hugging-face-openai-harm/)
16. [Researchers are tracking a Chinese AI "agent fleet" (TechCrunch, 5 Oct 2026)](https://techcrunch.com/2026/10/05/researchers-are-tracking-a-chinese-ai-agent-fleet/)
17. [Self-replicating AI agent swarms are already on the open internet (MindStudio)](https://www.mindstudio.ai/blog/ai-agent-swarms-wild-internet)
18. [Nick Dobos on X (unverified claim)](https://x.com/NickADobos/status/2113088314907709666)
19. [Yahoo Style on "Black October" (unverified)](https://ca.style.yahoo.com/ai-agent-swarms-hacking-half-192044555.html)
20. [Anthropic CEO warns a rogue AI swarm could seize the internet (Yahoo Finance)](https://finance.yahoo.com/technology/ai/articles/anthropic-ceo-warns-rogue-ai-070500967.html)
21. [AI swarm attacks: detection and defense (Kiteworks)](https://www.kiteworks.com/cybersecurity-risk-management/ai-swarm-attacks-2026-guide/)
