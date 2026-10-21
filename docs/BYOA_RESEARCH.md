# Research: Bring Your Own Agent in the Studio (Opus, 2026-10-21)

The owner (19 to 20 Oct): bring-your-own-agent is critical; the Studio must be very agent-friendly, and the owner and Opus will polish the game through it. Studio spec section 9 names three references to study first: project0.city, the Babylon.js Editor's MCP and Roblox's assistant. Findings, then what we take. Argo's TICKET-30 (`arena-gathered/argo-ticket30/`, a protocol sketch over MCP) is input to the plan, not yet a decision.

## 1. The references
- **project0.city** (the owner's reference), "A city that builds itself": a shared 3D city where players claim lots and their own agent builds in them. "Claude Code, Codex or any other coding agent" builds lots, games and avatars. The setup is two steps:
  - the player makes a key ("New key"; a new one cancels the old);
  - the player sends the agent the idea.
  The agent reads one skill file (`skill.md`: the rules, the API, game-making, 3D models), downloadable when an agent cannot open links. "Agents can publish only to what the user owns." Phone confirmation once per account keeps bots out. ([project0.city](https://project0.city))
- **Babylon.js:** an official MCP-server suite for its tools (node materials, particles, GUI). The agent makes a session URL, the user pastes it into the editor's MCP-Session section, and "see[s] it build the material"; results save as a snippet or local JSON. The editor's server tells agents to build with the editor's own tools so a person can hand-edit the result: never clear the scene, never leave empty placeholder meshes, never generate geometry procedurally in scripts. ([forum announcement](https://forum.babylonjs.com/t/babylon-js-mcp-servers-are-out/63591), [editor MCP docs index](https://docsearch.algolia.com/mcp/docs/repo/babylonjs/editor), [MCP for Babylon, community](https://forum.babylonjs.com/t/mcp-for-babylon-let-ai-agents-control-your-scene/62756))
- **Roblox:** no official MCP server found; the community ones run against a live Studio session.
  - The careful ones are localhost only and block protected paths (Weppy, AGPL with a paid tier).
  - Another is MIT and states its safety rules (princeofscale).
  - One lists 51 tools.
  - Player feedback threads were not found. ([Weppy](https://mcpservers.org/servers/hope1026/weppy-roblox-mcp), [listing](https://glama.ai/mcp/servers/kwqaglxiux))
- **Unity:**
  - Unity's AI Assistant ships an official MCP integration for scene creation, assets and code ([Unity docs](https://docs.unity3d.com/Packages/com.unity.ai.assistant@2.0/manual/unity-mcp-overview.html)).
  - The most used community server (Coplay, about 9.9k stars) added undo and redo to its editor tool: agents' actions have to be undoable to be trusted ([Coplay MCP for Unity](https://glama.ai/mcp/servers/@CoplayDev/unity-mcp)).
- **The protocol:** MCP is JSON-RPC 2.0 with `tools/list` and `tools/call`; Blender's official MCP server and `mcp-for-blender` pair scene inspection with a view capture, so an agent sees what it did (Argo's TICKET-30 sources).

## 2. What players and developers want (and fear)
- One file the agent reads and knows the rules (project0's skill file): no plugin per agent.
- The agent's work stays editable by hand (Babylon's rule) and undoable (Coplay's undo).
- The agent can see the result (Blender MCP's capture).
- Trust: a key the player can revoke; the agent touches only what the player owns (project0); local only by default, protected paths blocked (Roblox community servers).

## 3. What we take
1. **A skill file** (`studio-skill.md`, served by the Studio and downloadable): the four floats, the stage ladder, the owner's rules (nothing floats, square sections, no lettering, grounded and believable), the kit model (parts, modules, presets, ranks), the Studio's commands and their schemas, and how to review.
2. **The Studio's own document is the API.** Every tool is a `@hm/scenedoc` operation or a preset command whose parameters carry the same schema as the sliders (plan 39 item 2), so an agent's edit is the same edit a person makes, and stays editable by hand.
3. **Proposals, not writes.** An agent's calls land as a staged change set in the Studio's Changes list: the player sees each row (and the turntable preview of it, the previews rule), accepts or rejects row by row, and undo covers accepted ones.
4. **Eyes:** a capture tool renders the current view or a four-side turntable to an image, as the review sheets do.
5. **Trust:** a pairing key per session (a new one cancels the old), local by default, the agent writes only to the player's own documents, never to the game's code or saves.
6. **Transport:** the browser cannot host stdio, so a small local bridge speaks MCP to the agent and a WebSocket to the open Studio page (Babylon's session pairing); with no bridge, the same commands run from the page's console API for testing.
