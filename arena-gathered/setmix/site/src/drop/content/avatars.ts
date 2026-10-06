/* ============================================================================
 *  packages/content/src/avatars.ts
 *  ---------------------------------------------------------------------------
 *  THE GOBLIN WARDROBE — 8 cosmetic rigs across the fidelity ladder.
 *
 *  Each rig is a COSMETIC LAYER over one shared skeleton. Nothing here changes
 *  hitbox, reach or movement — the GoblinController owns all of that. A player
 *  who prefers the Scrap Golem at Stage 6 keeps the Stage-6 triangle budget
 *  and loses nothing but the ceramic.
 *
 *  Attachment offsets are in METRES, in rig-local space, measured from the
 *  root at the feet. They are authored once here rather than baked into
 *  meshes so that a hat fits every rig without a per-rig variant.
 * ==========================================================================*/

import type { Stage } from "../contracts.setmix";

export type Socket =
  | "head" | "crown" | "visor" | "shoulderL" | "shoulderR"
  | "back" | "hip" | "handL" | "handR" | "capeAnchor";

export interface SocketOffset {
  socket: Socket;
  /** metres, rig-local, root at the feet */
  pos: [number, number, number];
  /** degrees, XYZ euler */
  rot: [number, number, number];
  scale: number;
}

export interface AvatarMaterialSet {
  /** the four-entry palette the suit shader ramps through */
  palette: [string, string, string, string];
  /** emissive trim colour, used for conduits / glyphs / visor glow */
  emissive: string;
  /** 0..1 authored defaults; the AvatarFidelityManager drives them at runtime */
  baseWear: number;
  baseRough: number;
  metallic: number;
  subsurface: number;
  /** visor transmission; 1 = clear glass, 0 = opaque plate */
  visorTransmission: number;
}

export interface AvatarRig {
  id: string;
  name: string;
  subtitle: string;
  unlockStage: Stage;
  /** triangle budget this rig targets; clamped by the device profile */
  triBudget: number;
  boneCount: number;
  /** which AvatarFidelityManager subsystems this rig actually uses */
  features: {
    ik: boolean;
    headLook: boolean;
    cape: boolean;
    capeNodes: [number, number] | null;
    blendshapes: boolean;
    breathFog: boolean;
    sss: boolean;
  };
  materials: AvatarMaterialSet;
  sockets: SocketOffset[];
  /** cosmetic accessories bolted to sockets */
  accessories: { name: string; socket: Socket; tris: number; note: string }[];
  silhouette: string;
  lore: string;
  /** purely cosmetic flavour the audio engine reads for footstep timbre */
  footstepTimbre: "hollow" | "clank" | "quilt" | "squelch" | "ceramic" | "chime";
  unlockCondition: string;
}

const S = (socket: Socket, pos: [number, number, number], rot: [number, number, number] = [0, 0, 0], scale = 1): SocketOffset =>
  ({ socket, pos, rot, scale });

/** Shared skeleton socket layout. Rigs override only what they must, which is
 *  why a hat authored for the Scrap Golem still sits correctly on the Runic
 *  Architect's taller skull. */
const BASE_SOCKETS: SocketOffset[] = [
  S("head", [0, 1.18, 0]),
  S("crown", [0, 1.34, 0]),
  S("visor", [0, 1.19, 0.11]),
  S("shoulderL", [-0.21, 1.02, 0]),
  S("shoulderR", [0.21, 1.02, 0]),
  S("back", [0, 0.96, -0.11]),
  S("hip", [0, 0.68, -0.09]),
  S("handL", [-0.3, 0.74, 0.06]),
  S("handR", [0.3, 0.74, 0.06]),
  S("capeAnchor", [0, 1.09, -0.08]),
];

const merge = (over: SocketOffset[]): SocketOffset[] => {
  const m = new Map(BASE_SOCKETS.map((s) => [s.socket, s]));
  for (const o of over) m.set(o.socket, o);
  return [...m.values()];
};

export const WARDROBE: AvatarRig[] = [
  {
    id: "scrap_golem",
    name: "The Scrap Golem",
    subtitle: "Stage 1 · 48 triangles",
    unlockStage: 1,
    triBudget: 48,
    boneCount: 1,
    features: { ik: false, headLook: false, cape: false, capeNodes: null, blendshapes: false, breathFog: false, sss: false },
    materials: {
      palette: ["#2b2f36", "#4a515c", "#6e7682", "#9aa3b0"],
      emissive: "#4fd6a0", baseWear: 0.0, baseRough: 0.92, metallic: 0.15,
      subsurface: 0, visorTransmission: 0.1,
    },
    sockets: merge([S("visor", [0, 1.14, 0.13], [0, 0, 0], 1.15)]),
    accessories: [
      { name: "CRT Wireframe Visor", socket: "visor", tris: 8, note: "A single quad with a scanline decal that flickers on a 6 s loop. The flicker is the only animation on the entire rig." },
      { name: "Taped Copper Joints", socket: "shoulderL", tris: 4, note: "Two triangles of exposed copper per shoulder. They are the only warm colour you own at Stage 1." },
      { name: "Ration Clip", socket: "hip", tris: 6, note: "Clatters on a 2-frame cycle. Purely diegetic reassurance that something is there." },
    ],
    silhouette: "One box for the torso, one for the head, two for each limb. Readable from 400 m because it is the only non-terrain silhouette in existence.",
    lore: "Assembled in eleven minutes from a decommissioned calibration frame and whatever was in the drawer. The visor does not display telemetry; it displays a wireframe of itself, because that was the only asset the facility had cached.",
    footstepTimbre: "hollow",
    unlockCondition: "Default. You wake up in this.",
  },
  {
    id: "rust_scavenger",
    name: "The Rust Scavenger",
    subtitle: "Stage 2 · 420 triangles",
    unlockStage: 2,
    triBudget: 420,
    boneCount: 9,
    features: { ik: false, headLook: false, cape: true, capeNodes: [4, 5], blendshapes: false, breathFog: false, sss: false },
    materials: {
      palette: ["#231308", "#6b3a16", "#a9682c", "#d9a868"],
      emissive: "#ff8a3d", baseWear: 0.42, baseRough: 0.86, metallic: 0.44,
      subsurface: 0, visorTransmission: 0.22,
    },
    sockets: merge([
      S("crown", [0, 1.36, -0.01], [-6, 0, 0], 1.1),
      S("back", [0, 0.99, -0.14], [0, 0, 0], 1.2),
      S("capeAnchor", [0, 1.06, -0.12]),
    ]),
    accessories: [
      { name: "Riveted Bronze Cowl", socket: "crown", tris: 96, note: "Hand-beaten from a pressure vessel. Every rivet is a real triangle, which at 420 total is an extravagance the player can see." },
      { name: "Patchwork Burlap Cape", socket: "capeAnchor", tris: 120, note: "The first Verlet cloth in the game: a 4×5 node sheet at 2 constraint iterations. Deliberately stiff — it reads as heavy fabric." },
      { name: "External O₂ Canisters", socket: "back", tris: 110, note: "Two cylinders that clank against each other on every third step. The audio engine keys the clank off the walk cycle phase." },
      { name: "Scavenger's Pry Bar", socket: "handR", tris: 34, note: "Doubles as the Stage-2 mining tool. Wear accumulates on the striking end only, via the curvature mask." },
    ],
    silhouette: "Broad-shouldered and top-heavy from the canisters, with a cape that lags half a second behind every turn.",
    lore: "Six weeks on the surface taught you that nothing the lab printed was built for dust. Everything on this rig was made twice: once by the facility, and once again by you, correctly.",
    footstepTimbre: "clank",
    unlockCondition: "Reach Fi 1,200 and return through the portal once.",
  },
  {
    id: "moon_archaeologist",
    name: "The Moon Archaeologist",
    subtitle: "Stage 3 · 2,800 triangles",
    unlockStage: 3,
    triBudget: 2800,
    boneCount: 34,
    features: { ik: true, headLook: true, cape: true, capeNodes: [6, 7], blendshapes: false, breathFog: false, sss: false },
    materials: {
      palette: ["#1d1a14", "#4e463a", "#8a7d64", "#cfc0a0"],
      emissive: "#ffc13d", baseWear: 0.28, baseRough: 0.74, metallic: 0.3,
      subsurface: 0, visorTransmission: 0.48,
    },
    sockets: merge([
      S("crown", [0, 1.4, -0.03], [-10, 0, 0], 1.0),
      S("shoulderR", [0.23, 1.04, -0.02], [0, -14, 0]),
      S("back", [0, 0.98, -0.13], [0, 0, 0], 1.1),
    ]),
    accessories: [
      { name: "Quilted Vacuum Suit", socket: "head", tris: 980, note: "Channel-quilted insulation. The quilt lines are geometry, not a normal map — which is why they catch the first real shadows the planet has." },
      { name: "Brass Telemetry Dish", socket: "shoulderR", tris: 410, note: "Tracks the nearest spire via the same head-look solver as the eyes, at a quarter of the damping. It points at what matters before you do." },
      { name: "Amber Visor Lens", socket: "visor", tris: 64, note: "The first transmissive material on the avatar. Lx ≥ 0.18 is required for it to read as glass rather than paint." },
      { name: "Field Satchel", socket: "hip", tris: 220, note: "Physically holds your three cartridge slots. Slotting one is a visible hand-to-satchel animation, not a menu." },
    ],
    silhouette: "Rounded and padded, with an antenna dish that breaks the outline asymmetrically — the first rig you can identify from behind.",
    lore: "You stopped scavenging and started cataloguing. The dish is pointed at a spire you did not build, on a hill you did not raise, and it has been returning a signal for eleven days.",
    footstepTimbre: "quilt",
    unlockCondition: "Discover 6 fusion recipes and reach the polar Clathrate fields.",
  },
  {
    id: "bio_engineer",
    name: "The Bio-Engineer",
    subtitle: "Stage 4 · 9,600 triangles",
    unlockStage: 4,
    triBudget: 9600,
    boneCount: 44,
    features: { ik: true, headLook: true, cape: true, capeNodes: [8, 10], blendshapes: false, breathFog: true, sss: true },
    materials: {
      palette: ["#0a1a10", "#1d5438", "#48a670", "#a8e0b8"],
      emissive: "#2fd68a", baseWear: 0.2, baseRough: 0.62, metallic: 0.12,
      subsurface: 0.35, visorTransmission: 0.66,
    },
    sockets: merge([
      S("capeAnchor", [0, 1.12, -0.1], [0, 0, 0], 1.15),
      S("shoulderL", [-0.23, 1.03, -0.01]),
      S("shoulderR", [0.23, 1.03, -0.01]),
    ]),
    accessories: [
      { name: "Moss-Woven Cape", socket: "capeAnchor", tris: 1800, note: "Living cloth: an 8×10 Verlet sheet whose node colours shift with the planet's Aq. It is visibly wetter after rain and takes four minutes to dry." },
      { name: "Symbiotic Spore Tubes", socket: "back", tris: 2100, note: "Six translucent tubes carrying a culture that scrubs your CO₂. They pulse at your breathing rate, which is driven by your actual stamina value." },
      { name: "Iridescent Breathing Membrane", socket: "visor", tris: 340, note: "Thin-film interference on a flexible membrane. The first time subsurface scattering appears on the avatar." },
      { name: "Grafting Gauntlet", socket: "handL", tris: 520, note: "Plants a biome cartridge directly into soil without a spire. Slow, local, and the only way to author a garden by hand." },
    ],
    silhouette: "Softer and more organic than anything before it, with a cape that moves like wet wool and tubes that catch the light from behind.",
    lore: "The first suit that is partly alive. It costs you forty minutes a week in maintenance and returns roughly nine hours of oxygen you did not have to carry. You have started talking to it.",
    footstepTimbre: "squelch",
    unlockCondition: "Create an ocean: reach Aq 1.6e6 and germinate a biome cartridge.",
  },
  {
    id: "quantum_scout",
    name: "The Quantum Scout",
    subtitle: "Stage 5 · 24,000 triangles",
    unlockStage: 5,
    triBudget: 24000,
    boneCount: 58,
    features: { ik: true, headLook: true, cape: false, capeNodes: null, blendshapes: true, breathFog: true, sss: false },
    materials: {
      palette: ["#0e1116", "#39414c", "#b8c2cc", "#f4f8fc"],
      emissive: "#3dc8ff", baseWear: 0.08, baseRough: 0.26, metallic: 0.22,
      subsurface: 0.1, visorTransmission: 0.82,
    },
    sockets: merge([
      S("visor", [0.06, 1.2, 0.12], [0, -8, 0], 0.7),
      S("back", [0, 1.0, -0.1], [0, 0, 0], 0.9),
    ]),
    accessories: [
      { name: "Ceramic Composite Plating", socket: "head", tris: 11200, note: "Seventeen overlapping plates with authored edge wear. The plates slide against each other during the run cycle — the first rig with secondary motion in its armour." },
      { name: "Holographic Monocular HUD", socket: "visor", tris: 180, note: "Projects the Fidelity readout onto one eye only, so the HUD is diegetically inside the fiction rather than on the player's screen." },
      { name: "Circuit Conduits", socket: "shoulderL", tris: 2400, note: "Emissive channels whose brightness is literally the planet's dFi/dt. Your suit gets brighter while the world is improving fastest." },
      { name: "Null-Pit Tether", socket: "hip", tris: 760, note: "Fires a monofilament anchor. Converts a Null Pit from a death into a traversal puzzle." },
    ],
    silhouette: "Narrow, sharp and deliberately inhuman — the first rig that reads as equipment rather than as a person wearing equipment.",
    lore: "Facility-spec, finally. White ceramic, zero field repairs, and a HUD that tells you the truth. You have not needed the pry bar in two hundred hours and you still carry it.",
    footstepTimbre: "ceramic",
    unlockCondition: "Publish a .setmix bundle that passes its export certificate.",
  },
  {
    id: "runic_architect",
    name: "The Runic Architect",
    subtitle: "Stage 6 · 48,000 triangles",
    unlockStage: 6,
    triBudget: 48000,
    boneCount: 68,
    features: { ik: true, headLook: true, cape: true, capeNodes: [12, 16], blendshapes: true, breathFog: true, sss: true },
    materials: {
      palette: ["#06160f", "#12492e", "#2f9c62", "#bff0cf"],
      emissive: "#7affc0", baseWear: 0.0, baseRough: 0.34, metallic: 0.0,
      subsurface: 0.92, visorTransmission: 1.0,
    },
    sockets: merge([
      S("crown", [0, 1.42, 0], [0, 0, 0], 1.0),
      S("capeAnchor", [0, 1.14, -0.07], [0, 0, 0], 1.3),
    ]),
    accessories: [
      { name: "Translucent Emerald Skin", socket: "head", tris: 18000, note: "Full subsurface scattering at 0.92 depth. Backlight it at sunset and you can see the skeleton. Nobody asked for this; everybody kept it." },
      { name: "Flowing Silk Verlet Cape", socket: "capeAnchor", tris: 14000, note: "A 12×16 sheet at 8 constraint iterations with shear. The most expensive cosmetic in the game and worth every microsecond." },
      { name: "Geometric Glyph Tattoos", socket: "back", tris: 0, note: "Zero triangles — pure emissive mask driven by the Runic Granite cartridge you discovered. Your own fusions are written on your skin." },
      { name: "Architect's Stylus", socket: "handR", tris: 940, note: "Sculpts terrain directly at Stage 6 precision. Replaces every earlier tool and animates with real IK finger curls." },
    ],
    silhouette: "Tall, fluid and unmistakable, trailing fourteen thousand triangles of silk that settle for a full two seconds after you stop.",
    lore: "The goblin and the scientist are now rendered at the same fidelity, which means the portal no longer transforms you. You cross it as one person. That was always the win condition.",
    footstepTimbre: "chime",
    unlockCondition: "Reach Fi 100,000,000 and choose a house style in the Finalisation Pass.",
  },
  {
    id: "vault_curator",
    name: "The Vault Curator",
    subtitle: "Prestige · 32,000 triangles",
    unlockStage: 6,
    triBudget: 32000,
    boneCount: 68,
    features: { ik: true, headLook: true, cape: true, capeNodes: [10, 12], blendshapes: true, breathFog: false, sss: true },
    materials: {
      palette: ["#120d1c", "#36215e", "#7a4fd0", "#dcc8ff"],
      emissive: "#b46bff", baseWear: 0.0, baseRough: 0.3, metallic: 0.55,
      subsurface: 0.3, visorTransmission: 0.9,
    },
    sockets: merge([S("back", [0, 1.02, -0.16], [0, 0, 0], 1.4)]),
    accessories: [
      { name: "Cartridge Bandolier", socket: "back", tris: 4200, note: "Twenty-four live cartridge windows across the back, each spinning its own 3D thumbnail. Other players read your library from behind." },
      { name: "Curator's Mantle", socket: "capeAnchor", tris: 9800, note: "Violet silk whose hem colour samples your three most-used cartridges. No two curators look alike." },
      { name: "Archive Lantern", socket: "handL", tris: 1100, note: "Projects a hologram of any cartridge at 1:1 scale. The social tool: this is how players show each other things." },
    ],
    silhouette: "Broad-backed from the bandolier, with twenty-four tiny rotating lights that make a crowd of curators look like a constellation.",
    lore: "Awarded to the first thousand authors whose bundles were imported by someone they had never met. The bandolier is not storage. It is a résumé.",
    footstepTimbre: "chime",
    unlockCondition: "Have one of your published cartridges imported by 10 other players.",
  },
  {
    id: "null_walker",
    name: "The Null Walker",
    subtitle: "Prestige · 48 triangles, by choice",
    unlockStage: 6,
    triBudget: 48,
    boneCount: 1,
    features: { ik: false, headLook: false, cape: false, capeNodes: null, blendshapes: false, breathFog: false, sss: false },
    materials: {
      palette: ["#ff00ff", "#000000", "#ff00ff", "#000000"],
      emissive: "#ff00ff", baseWear: 0, baseRough: 1, metallic: 0,
      subsurface: 0, visorTransmission: 0,
    },
    sockets: merge([]),
    accessories: [
      { name: "Missing Texture", socket: "head", tris: 0, note: "The magenta-and-black checkerboard, rendered deliberately and perfectly. The single most requested cosmetic in every playtest." },
      { name: "Decohered Shimmer", socket: "capeAnchor", tris: 0, note: "A permanent 12 Hz input-quantisation visual effect that is purely cosmetic — the controller is untouched." },
    ],
    silhouette: "Forty-eight triangles of defiant magenta on a photoreal paradise. Visible from orbit, mostly out of embarrassment.",
    lore: "You finished the planet. You raised an ocean, lit a sky and published nine cartridges. And then you walked back out in the error state, because somebody had to.",
    footstepTimbre: "hollow",
    unlockCondition: "Reach Stage 6, then decohere voluntarily inside your own finished paradise.",
  },
];

export const WARDROBE_BY_ID = new Map(WARDROBE.map((r) => [r.id, r]));

export const WARDROBE_STATS = {
  rigs: WARDROBE.length,
  accessories: WARDROBE.reduce((a, r) => a + r.accessories.length, 0),
  totalTris: WARDROBE.reduce((a, r) => a + r.triBudget, 0),
  sockets: BASE_SOCKETS.length,
};

export { BASE_SOCKETS };
