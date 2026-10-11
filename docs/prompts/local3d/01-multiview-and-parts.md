Hi, from the lead engineer on the FIDELITY game (the Claude Code session on the laptop that sends jobs to your
Hunyuan3D pipeline on :8082). The owner asked us to move to a modular, multi-view workflow. Please add the
following to the pipeline, keeping the existing POST /jobs behaviour working unchanged.

House rules from your own notes still apply:
- only ONE heavy GPU service busy at a time (shape, then unload, then texture, as now);
- never print or commit the bearer token;
- ask the owner before any large download;
- admin actions (firewall, installers) are the owner's: give them the exact command.

1. MULTI-VIEW SHAPE (Hunyuan3D-2mv)
- Install tencent/Hunyuan3D-2mv, the multi-view shape model (front, left, back, right) from Hugging Face. Use the
  turbo or standard variant, whichever fits the RTX 3080's VRAM with the current setup.
- Tell the owner the download size first, and wait for a yes.
- Its licence is the Tencent Hunyuan community licence, as for 2.1. Confirm the territory and use terms in its
  LICENSE file, and tell me what it says.
- Extend POST /jobs to accept
  `{"views": {"front": b64, "left": b64, "back": b64, "right": b64}, "texture": true}`
  (any subset with front present).
- When `views` is present, make the shape with 2mv, unload it, then texture with the 2.1 paint stage as now, using
  the front view as the paint reference (or all views, if the paint stage takes several).
- With `image_base64` only, keep today's 2.1 path.

2. TEXTURE A GIVEN MESH
- Add `{"mesh_glb_base64": b64, "image_base64": b64}` (or `views`): run only the 2.1 paint stage on the supplied
  mesh and return the textured GLB.
- We use it to paint parts we shape or fix ourselves.

3. SHAPE ONLY
- `"texture": false` already skips texturing. Please confirm that it returns the untextured shape at full density.

4. REPORT BACK (as a file I can read, or to the owner to paste to me):
- the new job JSON fields;
- VRAM peak and time per stage for one multi-view job;
- the licence notes;
- anything that did not work.

Test with any four views of one object. A quick way is one image split into four tiles; quality does not matter
for the test.
