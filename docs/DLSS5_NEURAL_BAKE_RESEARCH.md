# DLSS 5 and a "neural bake": research and a proposal (2026-10-13)

The owner: "we can add DLSS5 on top of the last fidelity stage to push it over the edge, altho im wondering, is there a way to bake in the dlss5 into the models? is there an innovation opportunity here?"

## 1. What DLSS 5 is
- **What it does:** a final neural-rendering stage at the end of the frame. A one-step, pixel-space diffusion model takes the engine's frame (colour, motion vectors, albedo, normals, lighting) plus its own temporal state. It outputs the final image with "photoreal lighting and materials". NVIDIA says it is the first DLSS that *generates* the final appearance rather than reconstructing a reference. It is deterministic and trained for frame-to-frame stability. ([NVIDIA ADLR](https://research.nvidia.com/labs/adlr/DLSS5/), [NVIDIA developer blog](https://developer.nvidia.com/blog/whats-new-for-game-developers-dlss-5-with-3d-guided-neural-rendering-nvidia-ace-updates-and-new-rtx-kit-capabilities/), [GeForce news](https://www.nvidia.com/en-us/geforce/news/dlss-5-3d-guided-neural-rendering/))
- **Controls:** pre-trained indoor and outdoor models; structure and tone sliders (25% to 95% intervention); semantic masks for characters, clothing and foliage. ([gamegpu](https://en.gamegpu.com/news/igry/kompaniya-nvidia-ofitsialno-predstavila-tekhnologiyu-nejronnogo-renderinga-dlss-5))
- **Availability:**
  - Announced at GTC on 16 March 2026; the first game was NBA 2K27 in September.
  - Official support is the **RTX 50 series only**.
  - It integrates through Streamline and a UE5 plugin. On 13 October, the public UE 5.8 download was still the DLSS 4.5 plugin; developers report no DLSS 5 package yet. ([NVIDIA forum](https://forums.developer.nvidia.com/t/official-dlss-5-neural-rendering-plugin-access-for-unreal-engine-5-8-2/382731), [dlss5.net status](https://www.dlss5.net/dlss-5-unreal-engine))
- **The browser:** DLSS is a native DirectX 12 and Vulkan feature. WebGL and WebGPU cannot reach it, so our web build cannot use DLSS 5 at all.

## 2. What players and developers said
- **The backlash was large:**
  - "a bland, uncanny gloss";
  - shadows flattened and art direction homogenised;
  - faces "yassified".
- **Developers:** Mike Bithell said it is "for when you absolutely, positively, don't want any art direction". Gunfire's concept artist said every shot had less character. ([GameDev.net](https://gamedev.net/news/2267-gamers-react-with-overwhelming-disgust-to-dlss-5s-generative-ai-glow-ups/), [Euronews](https://euronews.com/next/2026/03/19/yassified-graphics-and-uncanny-faces-gamers-turn-nvidias-dlss-5-reveal-into-a-meme-storm))
- **NVIDIA's answer:** the sliders and masks keep developers in control. ([Tom's Guide](https://www.tomsguide.com/gaming/theyre-completely-wrong-nvidia-ceo-jensen-huang-responds-to-dlss-5-criticism))
- **The lesson for us:** the look must stay ours, and every asset must be reviewable.

## 3. Can it be baked into the models?
**Not DLSS 5 itself.** It is a runtime SDK with no offline mode, and it rewrites whole frames, lighting included.

**Its idea can be baked, though.** Do offline what DLSS 5 does live, then store the result in the model's textures:
1. Render each model at full PBR from 8 to 12 views, keeping the albedo, normal and depth for each view.
2. Run an image model conditioned on those buffers (DLSS 5's "3D-guided" idea) at a low structure strength, so the shapes and the owner's palette stay.
3. Project the enhanced views back into UV space, weighted by visibility, and bake them into albedo, roughness, AO and detail-normal maps.
4. Review them in our four-angle check (`render-angles.py`), as every model is now.

**Tools we already have:**
- **Hunyuan3D-Paint** (part of the Hunyuan3D stack on the 3D PC) is a mesh-conditioned multi-view diffusion model. It re-textures an *existing* mesh from a reference image and outputs albedo, metallic and roughness. Feeding it our own model and its own render is exactly a "retexture that keeps our shape". ([Hunyuan3D 2.1 report](https://arxiv.org/html/2506.15442v1), [hy3dpaint README](https://huggingface.co/spaces/tencent/Hunyuan3D-2.1/blob/main/hy3dpaint/README.md))
- **Paint3D** is the reference design for a UV-space clean-up pass that removes baked-in lighting. ([Paint3D](https://arxiv.org/html/2312.13913v2))
- **RUN.world images** (the reference picture) and **Meshy's retexture** (the max tier when its credits reset).

**Why this beats runtime DLSS 5 for us:**
- It runs on every GPU, including the GTX 950M, and in the browser: the result is only textures.
- No flicker or ghosting, and the same result every time.
- The art direction stays ours: every asset passes review before it ships. That answers the backlash.
- It ships in the HD pack the owner already chose ("Lean file + HD pack").

**Limits:**
- Only view-independent appearance bakes (colour, wear, AO, micro-detail). Real-time lighting stays PBR.
- The player character is excluded, or kept at very low strength: faces are where DLSS 5 drew the most anger.

## 4. Proposal (for the owner)
1. **"Neural" texture tier:** the top rung of the fidelity ladder, the same ladder as the owner's containment-leak idea (broken junk, our pack, a RUN.world tier, a Meshy max tier). It is a Graphics setting with Auto under the toggle rule, and it applies at the final stage. It is not a new global metric (the constitution keeps four floats); it is a texture tier.
2. **Pilot:** bake 3 assets (weapon-bench, scout-body, datacentre-hall) through Hunyuan3D-Paint on the 3D PC, and show the owner side by side with the current high.
3. **Native DLSS 5:** only in the Unreal bridge build (`C:\Repos\SetmixUnreal\SetMix_UE5`, UE 5.8), as an "RTX 50" toggle on the last stage, once NVIDIA publishes the UE plugin. It needs an RTX 50 card; which GPU is in the owner's faster machine?
4. **Not now:** an in-browser neural post-process (a small WebGPU CNN). No source shows NVIDIA's neural tech reaching the browser. ([RTX Neural Texture Compression](https://www.phoronix.com/news/NVIDIA-RTXNTC-0.5-Beta/) is DirectX 12 and Vulkan only.)
