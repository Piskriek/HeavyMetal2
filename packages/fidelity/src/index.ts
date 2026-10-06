// @hm/fidelity: The Resolution Crafter's core. A world's progress is four numbers (pxd, vtx, lx, aq); everything
// the renderer may spend, how the ground is meshed and how cartridges fuse is a pure function of them.
// Pure: no clock, no randomness, no I/O (a test reads the source to keep it that way).
export * from "./types";
export { contentHash } from "./hash";
export { clamp, coherence, fidelityIndex, normalised, smoothstepC1, stageOf, stepFidelity, TIER_MULT } from "./metrics";
export { DEVICES, EDGE_KEYS, adaptGraph, deriveBudget, deviceFor, toEvaluateOptions } from "./budget";
export { meshPolicyFor, minPolicy, seamKeyFor, seamsAgree } from "./mesh";
export { fuse } from "./fusion";
export { NODE_WEIGHT, certify, graphCost } from "./certify";
