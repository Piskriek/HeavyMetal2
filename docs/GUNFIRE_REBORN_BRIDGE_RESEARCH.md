# Gunfire Reborn and the AI companion bridge: feasibility research

Date: 2026-10-27. Status: research only, nothing was installed, copied or modified. Tags: **[V]** verified (local check or a page I read), **[I]** inferred, **[U]** unknown. Numbers in brackets point to the sources at the end. This aligns with `docs/ENGINE_OPTIMIZATION_AND_BRIDGING_SPEC.md` sections 3 and 4 and the Neural Bridge in `scripts/companion-bridge.mjs`.

## 1. What Gunfire Reborn is, checked locally

- Installed under `C:\Program Files (x86)\Steam\steamapps\common\Gunfire Reborn` (app 1217060, build 25361614). The manifest shows a pending update to build 25979701. [V]
- Unity **2018.4.36f1**, scripting backend **IL2CPP**. Evidence: `GameAssembly.dll` (121 MB), no `Managed` folder, no `Assembly-CSharp.dll`, version string in `globalgamemanagers` and `sharedassets0.assets`. [V]
- There is no standard `global-metadata.dat`. `il2cpp_data` holds eight hashed files whose bytes are scrambled, so I infer custom-packed metadata. The 2021-era dumper still read `global-metadata.dat` from disk [3], so this build differs. [V absent, I reason]
- Game content is scrambled too: 3,478 extensionless files in `StreamingAssets/assetbundles` start with a non-Unity header, and 300 `.fls` files carry `FLS`/`0SLF` magic. [V] Only the root `*.assets` files are plain Unity.
- Native components in `Plugins`: `dgw.dll` (company string Duoyi, 1.0.0.810), `m1logic4.dll`, `DYNative.dll`, `DYCallToCpp.dll`, `RecastTool64.dll`, `dnet.dll`, Wwise. [V names] Their roles are inferred from the 2021 claim that most game logic runs "outside of Unity in a native dll / python" [3]. Treat that claim as unverified for today's build; a 2022 plugin did read a Unity-side `DropManager` [4].
- No BepInEx or MelonLoader is installed. This PC's GPU is a GTX 950M, below the Steam minimum of GTX 960 [1]. [V]

## 2. Mod loaders and existing mods

- BepInEx supports Unity Mono and IL2CPP, but its README says only Mono has stable releases; IL2CPP is the 6.x bleeding edge using Cpp2IL and Il2CppInterop [12][14]. MelonLoader supports both backends and generates assemblies at first run [13]. [V]
- **AeonLucid/GunfireRebornMods**: BepInEx 6 IL2CPP (be.546), "supported version 2022-01-21", quality-of-life only. Its `PickupComponent` iterates `DropManager.AutoPickDict` each `FixedUpdate` and widens `AutoPickRange` [4]. This proves a BepInEx IL2CPP plugin can reach Unity-side game managers. [V for 2022 build; U for today]
- **shalzuth/AutoGunfireReborn** (MIT, pushed 2026-10-25): injects Mono into the IL2CPP game with Il2CppDumper and Unhollower. Features: auto-aim, ESP for portals, chests, vendors and enemies, ammo, speed. Its README says unlocks are "mostly server-side" and the dumper must be rerun after each update [3]. [V]
- **xieemengxin/GunfireReborn_InternalCheat**: BepInEx plugin containing an `AntiCheat.cs` file [5]. **needitem/gunfire-reborn-internal-mod**: C++ DLL with MinHook, ImGui and an IL2CPP resolver, aimbot and ESP [6]. Haptics plugins (bHaptics, OWO) and a VR mod also exist [8]. [V existence; hooks mostly unstated]
- I found no Nexus or Thunderstore listing: Nexus returned 403 and Thunderstore's list showed none in the part I read. [U]
- Community: threads on Steam say official Discord and Reddit forbid mod talk, and that the VR mod was tolerated then broken by updates. Both are user claims with no developer statement [9]. [V as claims]

## 3. Duoyi's stance, ToS and anti-cheat

- The Steam page says it "Requires agreement to a 3rd-party EULA" and lists single-player and online co-op [1]. The linked Duoyi Terms of Service (last updated 2025-07-07) does not name the game and has no offline exemption [2]. I read it through a summariser, so re-read clauses before relying on them. [V]
- Clauses: 2.6 cheat detection, and disabling it ends the licence; 3.4 and 4.1 no derivative works; 3.5 no bypassing technological protection; 4.3(b)(v) no reverse engineering or decompiling; 7.1(g) no cheating programs, bots or scripts; 7.1(c) no unauthorised plug-ins; 7.3 and 7.4 warnings, suspension, or immediate termination [2].
- Anti-cheat: update notes from 2020 and 2021 mention an anti-cheat and a report-a-cheater feature [11]. Players say 24-hour suspensions for multiplayer cheating, escalating on repeats, and some claim solo-flagged accounts [10]. All anecdotal; the vendor is unnamed. [V as claims, U as fact]
- Reading: any injected mod breaches the ToS by its letter even in solo. Observed enforcement is multiplayer-centred and report-driven. Progression and unlocks are server-side [3], so never write them. The account risk is the owner's to accept. [I]

## 4. Survey of mod routes by engine family

| Route | State read | Actions injected | Latency | Risk |
|---|---|---|---|---|
| Unity Mono (BepInEx 5, MelonLoader) | Full managed API: scene objects, components, Harmony patches [12][13] | Call game methods, set fields, simulate input | Per frame in-process; network adds under 1 ms on loopback [I] | Low in single-player games with open modding; varies online |
| Unity IL2CPP (BepInEx 6, MelonLoader) | Interop assemblies mirror game classes [14]; breaks per game update [3] | Same, via interop | Same | Same, plus update fragility; obfuscated metadata (as here) blocks generation [I] |
| Unreal 4/5 (UE4SS) | Lua and C++ over the UObject system; `FindAllOf`, `RegisterHook`, `NotifyOnNewObject` [15] | `ExecuteInGameThread`, `LoopAsync` [15] | Per tick | Needs per-game AOB fixes; no documented socket API, so use C++ mods or a file spool [15] |
| Minecraft Java, Fabric/Forge/NeoForge | Full Java access to world, entities, inventory via events and mixins [16] | Call any game logic | Per tick (20 Hz) | Fine in single-player; servers may ban |
| Minecraft bot client (Mineflayer) | Entities, blocks, inventory, health over the protocol [17] | Dig, attack, move, chat; A* via plugin [17] | Protocol tick | No mod at all; bot is a separate player [17] |
| Source / Garry's Mod (Lua) | Entities and players in Lua | Lua actions | Per tick | `HTTP()` is async but blocks loopback addresses except dedicated servers with `-allowlocalhttp` [19]; use a file spool or binary module [I] |
| Godot | Source access only if the game loads packs; PCK mods replace files [20] | Via packs and scripts | Per frame | `WebSocketPeer` polled each frame works in exports [20] |
| Roblox | Studio plugins can reach localhost; published servers need HTTP enabled and cannot see your PC [21][I] | Plugin or game scripts | Request-yielding | Plugin route is for creators' own places |
| Official APIs | Dota 2 bot Lua (fog-of-war enforced, `Think()` [22]); BWAPI (visible state only [23]); kRPC TCP server for Kerbal Space Program [23]; SMAPI for Stardew Valley [23] | Native commands | Per game tick | Sanctioned, lowest risk |

## 5. Minecraft AI companion mods (the whole category)

- **Baritone**: pathfinder library with goto and mine (LGPL-3.0), used as an API by other projects [17]. **Mineflayer** (MIT) is a bot client; **Mindcraft** (MIT) runs LLM bots on it, joins by LAN or server, and warns that LLM-written code runs on your machine [17]. **Voyager** (MIT) lets GPT-4 write reusable skill code [17].
- **Player2NPC** (Fabric 1.20.1): the LLM turns chat into commands such as `get oak_log 10`, executed by a deterministic task system on PlayerEngine entities [18].
- **AI Companion – LLM Player Bot** (Fabric 1.20.1, LGPL-3.0, alpha for single-player and LAN): OpenAI-compatible endpoint, local llama.cpp or Ollama allowed; collects, mines, crafts, fights; tasks continue if the LLM goes offline [18]. This is the closest match to the two-brain design.
- **Numen AI**: reasoning on the client, the LLM writes Lua programs doing "dozens of steps in a single call", optional External Brain so Claude Code can drive it over MCP; Fabric, Forge and NeoForge [18]. The CurseForge page I fetched at the `tulpa` URL showed Numen, so the slug and name disagree. [V, naming U]
- **Steve AI** (Forge 1.20.x): LLM decomposes commands into structured steps, re-plans on failure, multi-agent [18]. **Shabao AI Companion** (Fabric 1.21.1): fights hostile mobs, re-plans [18]. **AI Companion Mod** (Forge, client): comments, speech, no combat [18].
- **VoxelMind, ProPlayer-AI, Az's Companions** appear in search results only; I could not open their pages. [U]
- **"varity"**: most likely **Verity**. A Modrinth recreation of the ThatMob mob follows you, can be thrown, and attacks mobs; a separate licensed "Verity JE" is an AI-chat companion without combat [18]. Spelling match is likely (about 60 percent), but neither version "finds items", so the exact mod is low confidence (about 35 percent). Player2NPC, LLM Player Bot or Numen fit "fights and finds items" better.

## 6. Fallbacks without an in-game mod

- Capture: DXcam reaches 61 fps at a 60 fps target and 239 fps at 240 on an RTX 3090 [24]; its exclusive-fullscreen claim failed for one project, which advised borderless [7]. [V]
- Detection: a fine-tuned YOLOv8n took 6.6 ms with TensorRT, 20 ms on CUDA and 43 ms on CPU (61, 35 and 22 fps overall) on an RTX 4060 laptop; it was trained on 357 screenshots and auto-fires [7]. Author's numbers. Fast enough for 60 Hz reflexes, but that is an aimbot in effect. SendInput and `mouse_event` did not work in-game for that author [7].
- Vision-language models: I found no measured per-frame figures. A calculator site estimates 2 to 7 s time-to-first-token for a 7B model on a 4060 [25]. I infer 1 to 5 s per frame for small models, which suits orders every 10 to 30 s, never reflexes, and cannot share this 4 GB laptop with the game. [I]
- Audio cues (Wwise is present) via loopback capture give coarse events such as low-health alarms. [I]
- Can do: spotting, loot callouts by OCR, health reading, voice. Cannot do: precise state (enemy ids, hit points), reliable 60 Hz aim without a detector, or cooperation with the game's own logic.

## 7. Reverse direction: assets from his own install

- Root Unity files are readable, but the bundles and metadata are scrambled (section 1). Reading them means defeating Duoyi's scrambling, which ToS 3.5 and 4.3(b)(v) forbid [2]. UnityPy can use a decrypt key the game passes to `SetAssetBundleDecryptKey` [26], but fetching that key is itself reverse engineering. [V]
- Tools: AssetStudio (MIT, archived 2023-01-21, Unity 3.4 to 2022.1), AssetRipper (GPL-3.0, 3.5.0 to 6000.4.X, no use guidance), UnityPy (MIT) [26].
- Licence is "solely personal, non-commercial" with no derivative works [2], so shipping extracted assets inside FIDELITY breaks both the ToS and the project's legal-art rule. Not legal advice.
- Clean crossover: stream only telemetry (positions, enemy kinds, loot names) and render original or CC0 art in FIDELITY. Nothing from the game's files ever enters the repo or the bundle.

## 8. Game-agnostic adapter protocol

Reuse the Neural Bridge endpoints: `GET /poll`, `POST /event`, `GET /events?after=`, `POST /command`, `GET /status`. The spec's port-5196 daemon keeps process detection (`Gunfire Reborn.exe`) and the status pill. Prefer a plugin to the spec's "memory sampling", the riskiest route.

All messages are JSON with `v`, `game`, `session`, `seq`, and game time `t`.

- Mod to bridge: `hello {game, build, adapter, caps[], mode:'solo'|'coop', tier}`; `state` at 1 to 4 Hz (`self{pos,vel,yaw,hp,shield,ammo,weapon}`, `entities[{id,kind,faction,pos,hp,visible}]`, `items[{id,kind,rarity,pos}]`, `world{zone,time}`); edge-triggered `event` (damage-taken, kill, pickup, room-clear, boss, death, player-say, ping); `ack {cmdId, status}`.
- Bridge to mod (batched on `/poll`): `order {id, ttl_s, kind: say|follow|goto|hold|engage|loot|mark, args}` and `policy {targetPriority, retreatHp, lootFilter, engageRadius}`. Orders expire; the mod runs the policy locally at frame rate.
- Capabilities gate everything: the bridge drops any `act.*` order the mod did not declare, and drops all of them when `mode` is not `solo`. The mod also disables itself if it sees more than one human.
- Transport fallback: a JSONL file spool tailed by a sidecar, for sandboxes that block loopback (Garry's Mod, Lua-only UE4SS).
- Keep the reflex inside the adapter for v1; the schema allows moving it to an external host later (UDP or WebSocket at 30 to 60 Hz). [I]

## 9. Recommended route

**Prove the protocol first on Minecraft** with Mineflayer (no mod) or a Fabric adapter, then port. For Gunfire Reborn, build in tiers:

1. **Tier 0, observe-only** (screen and audio spotter, or a read-only plugin): voice callouts, loot and threat reports. Lowest risk; no state is changed.
2. **Tier 1, BepInEx 6 IL2CPP plugin, read-only**: enumerate player, enemies and drops from Unity-side managers (as the 2022 plugin did [4]), post `hello`, `state`, `event`; speak `order` as overlay and voice only.
3. **Tier 2, drone actions**: only if verified safe. Aim or fire on the player's behalf is functionally the cheats listed in section 2, so prefer an overlay drone and callouts. A damaging drone entity needs the game's own spawn logic.

**Solo-only safeguards:** refuse to start with more than one human or in an online lobby; no progression or unlock writes; hotkey kill switch; build-id check; never touch `dgw.dll` or cheat detection; log only to the local bridge.

**Verify against the real game, on a PC meeting GTX 960 or better:** (1) whether BepInEx 6 loads and generates assemblies from the scrambled metadata; (2) class names for player, enemies, drops, lobby; (3) whether combat state lives in Unity or in the native and Python layer; (4) how the player count is exposed; (5) whether an injected loader trips the anti-cheat in solo; (6) whether a spawnable drone exists.

**Risks:** ToS breach and possible account action; every update breaks hooks (one is pending); possible need for reverse engineering that the ToS forbids; no sanctioned modding path; GTX 950M cannot run the game.

## Sources

1. https://store.steampowered.com/app/1217060/Gunfire_Reborn/
2. https://store.steampowered.com/eula/1217060_eula_0
3. https://github.com/shalzuth/AutoGunfireReborn and https://raw.githubusercontent.com/shalzuth/AutoGunfireReborn/master/README.md
4. https://github.com/AeonLucid/GunfireRebornMods (Plugin.cs, PickupComponent.cs, AeonFire.csproj via raw.githubusercontent.com)
5. https://github.com/xieemengxin/GunfireReborn_InternalCheat
6. https://github.com/needitem/gunfire-reborn-internal-mod (tree via api.github.com)
7. https://github.com/MiddleAgeMage/GunfireReborn-auto_aim_fire
8. https://api.github.com/search/repositories?q=gunfire+reborn
9. https://steamcommunity.com/app/1217060/discussions/0/4950020834828952343 , .../3047230768365246580 , .../4353369145000513775
10. https://community.wemod.com/t/gunfire-reborn-cheats-and-trainer-for-steam/143350?page=8
11. https://www.player.one/gunfire-reborn-update-11262021-anti-cheat-optimization-and-bug-fixes-144042 (search result only)
12. https://github.com/BepInEx/BepInEx
13. https://github.com/LavaGang/MelonLoader
14. https://github.com/BepInEx/Il2CppInterop
15. https://github.com/UE4SS-RE/RE-UE4SS and https://docs.ue4ss.com/lua-api.html
16. https://docs.fabricmc.net/develop/
17. https://github.com/PrismarineJS/mineflayer , https://github.com/mindcraft-bots/mindcraft , https://github.com/MineDojo/Voyager , https://github.com/cabaletta/baritone
18. https://goodbird-git.itch.io/player2npc , https://www.curseforge.com/minecraft/mc-mods/ai-companion-fabric , https://www.curseforge.com/minecraft/mc-mods/tulpa (shows Numen), https://www.curseforge.com/minecraft/mc-mods/shabao-ai-companion , https://modrinth.com/project/v7nkOnMp , https://modrinth.com/mod/steve-ai (search result), https://modrinth.com/mod/verity-java (search result)
19. https://wiki.facepunch.com/gmod/Global.HTTP
20. https://docs.godotengine.org/en/stable/tutorials/networking/websocket.html and https://docs.godotengine.org/en/stable/tutorials/export/exporting_pcks.html
21. https://create.roblox.com/docs/cloud-services/http-service
22. https://developer.valvesoftware.com/wiki/Dota_Bot_Scripting (search result; page returned 403)
23. https://github.com/bwapi/bwapi , https://krpc.github.io/krpc/latest/ , https://github.com/Pathoschild/SMAPI
24. https://github.com/ra1nty/DXcam
25. https://willitrunai.com/can-run/qwen-2.5-vl-7b-on-rtx-4060-8gb (estimate)
26. https://github.com/Perfare/AssetStudio , https://github.com/AssetRipper/AssetRipper , https://github.com/K0lb3/UnityPy
