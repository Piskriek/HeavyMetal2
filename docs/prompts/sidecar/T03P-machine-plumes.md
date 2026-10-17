# T03P: colourful pixel plumes, only while machines operate (TICKET-03 glue)

**Spec:** Argo's `docs/argo/notes/ARGO_NOTE_08_plumes.md`. Read it fully: it has the per-kind colours, rates and cadence, and the root-cause fixes in `machine-props.ts`.

**The owner's rule:** believable machines spew colourful pixel plumes, and only while they operate.

## Known gaps
- Plot machines plume only when running above 5%, when `PIXELS_OF[kind]` names a metric, and when `findMachineVent` finds a vent (`play-scene.ts`, about lines 1590 and 1637). Kinds without a metric never plume.
- The base hardpoint machines (mill, press, fabricator, heavies) don't go through this path at all.
- T03 scaled machines to real height (`machineSize`), so the vents must be found after scaling (POL-75).
- POL-77 (the hopper cap shown in the inspector) is in the same area; fix it if Argo's note covers it.

## Do
Implement Argo's note. Every operating machine (plot or base) plumes from its vent, in its kind's colour; idle or unpowered machines don't. Plumes start and stop with the inspector's status, and their cost stays within the Low budget.

## Verify
- **A new `scripts/test-machine-plumes.mjs`:** place one machine of each kind and run it, and assert each plumes. Switch one off or starve it, and assert its plume stops.
- Look at the shots: plumes rise from the vents, never from the middle of a body or from the ground.
- **fps on the laptop:** no more than 2 fps below F-09 at stage 6 on Low.
- Through `scripts/test-on-3dpc.sh --only ...` (with `npm run build` first): `npm test`, the new test, `test-machine-inspector` and `test-campaign` (45 of 45).

## Stay inside
`play-scene.ts` (the plume emitters), `machine-props.ts`, `base/machine-inspect.ts` (only if the hopper fix needs it), and the new test.
