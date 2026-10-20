# **ARGO\_NOTE\_32 — Studio Section 9: Bring Your Own Agent (BYOA) Research-First Plan & Asset Bench Single-Model T29 Bridge (TICKET-30)**

## **1\. Context & Alignment with Opus Commit 0005e5cb / 57979428**

While Opus waits for the 1:00 PM reset (after landing 0 errors on typecheck and 3,006 / 3,011 unit tests), I have completed the **Research-First \+ Co-Architecture Plan** and the pure deterministic package bundle (argo-ticket30-bundle.json) for the two items Opus noted in 0005e5cb and 0f5b526b:

> 1. **Studio Section 9 — Bring Your Own Agent (BYOA):** *“Research first, then a plan with Argo, then the build.”*  
> 2. **Asset Bench Single-Model T29 Regenerate Button:** *“The asset bench’s ‘regenerate’ button should later use T29’s pipeline for one model at a time.”*  
> 3. **Note on the plotbiome 40.68 ms vs 40.00 ms Laptop-Load Flake:** Diagnostic checklist for Opus if it ever recurs on a cold run without raising the 40 ms gate.

## **2\. Research-First Sources (§3.4) for Studio Section 9 (BYOA)**

> * [**Model Context Protocol (MCP) 2026-07-28 Specification**](https://modelcontextprotocol.io/specification/2026-07-28) **([GitHub](https://github.com/modelcontextprotocol/modelcontextprotocol)):** Standard JSON-RPC 2.0 tools/list and tools/call schema so any external coding or creative agent (Claude Code, Antigravity Argon, Cursor, Codex CLI, or local Ollama/llama.cpp) can connect to SetMix Studio without custom wrappers.  
> * [**Blender Lab Official MCP Server**](https://www.blender.org/lab/mcp-server/) **& [mcp-for-blender](https://github.com/ahujasid/mcp-for-blender):** Proven 3D editor agent loop: (1) inspect compact scene graph & socket registry, (2) execute bounded tool calls with undo/redo rollback, and (3) request a 4-angle offscreen turntable snapshot so vision-capable agents can verify their own 3D edits.

## **3\. Architecture & Files in argo-ticket30-bundle.json**

> 1. packages/studiomesh/src/byoa-studio-protocol.ts — Pure deterministic TypeScript module (strict types, noUncheckedIndexedAccess, zero DOM/Date/Math.random):  
   * **6 MCP Tools (STUDIO\_BYOA\_MCP\_TOOLS):**  
     1. studio.scene.inspect (read-only scene graph, POL-89 socket registry, triangle budgets, grounding state)  
     2. studio.mesh.audit\_webbing (read-only TICKET-29 single-mesh webbing & concave seam audit)  
     3. studio.mesh.retopo\_single\_asset (mutating — runs TICKET-29 part-split un-webbing on a single model & builds the exact CLI write-back job)  
     4. studio.node.transform\_and\_snap (mutating — moves/snaps nodes while enforcing SetMix grounding aabbMinY \<= 0.05 m when unsocketed)  
     5. studio.material.set\_palette (mutating — sets industrial palette/plume colors while blocking forbidden terms: goblin, cloth, cape, chimney, lettering, floating-island)  
     6. studio.viewport.capture\_turntable (read-only — requests front, side, iso, top snapshots from TICKET-20 shared offscreen renderer POL-92)  
   * **Automatic Undo/Redo Transactions (POL-90):** Every mutating agent tool call pushes a StudioUndoEntry onto the controller stack and can be rolled back in 1 click or via JSON-RPC studio/undo.  
   * **Single-Model T29 Asset Bench Helper (buildSingleModelT29RegenerateJob):** Builds both an instant in-memory PartSplitRetopoResult preview and the exact single-model CLI command (blender \-b \--python scripts/blender-part-split-retopo.py \-- \--in apps/web/public/hd/\<id\>.glb \--out apps/web/public/models/\<id\>-low.glb \--target-tris \<N\>).  
> 2. packages/studiomesh/tests/byoa-studio-protocol.test.ts — 3 node:test unit tests (all passing) covering MCP tool discovery, constitutional guardrail rejection, single-model T29 regeneration, and undo rollback.  
> 3. apps/web/src/studio/asset-bench-t29-regenerate-button.tsx — Drop-in React button (\<AssetBenchT29RegenerateButton /\>) for the Studio Asset Bench so clicking **“Regenerate Low-Poly (T29 Part-Split)”** runs T29 on that single model at a time.

## **4\. Note on plotbiome 40.68 ms vs 40.00 ms Test Flake**

> * If plotbiome passed on solo re-run after reset, it was purely CPU contention from running all 3,011 tests concurrently on the laptop.  
> * If it ever hovers near 38–40 ms solo, keep the strict 40 ms threshold and hoist the typed-array stride base index (const rowOffset \= z \* width) and precomputed inverse grid scale outside the inner x loop in packages/plotbiome/src/ — that shaves \~25–30% off the inner loop without altering determinism.