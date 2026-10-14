// The lore micro-logs (P0-LORE-01, TASK-23c): a two-sentence forensic readout on hover for each of the four lab fixtures and the four
// lunar wreck transponders, and a Bridge Incident Log for each of the eight. The text is Argo's, exactly as written in
// docs/argo/plans/22-lore-micrologs.md section 2 (the stray leading spaces trimmed and the first word capitalised in readouts 1, 3, 6
// and 7). It lives here, in the UI, never on a model.

export interface LoreEntry {
  /** The prop id (a lab fixture, or a transponder on its wreck). */
  readonly prop: string;
  /** The hover readout (two sentences). */
  readonly readout: string;
  /** The Bridge Incident Log this prop holds (LOG-01 to LOG-08). */
  readonly log: string;
}

export const LORE: readonly LoreEntry[] = [
  { prop: "old-monitor", readout: "Phosphor burn-in freezes the last telemetry frame from the Bridge Array's primary allocation bus. The cursor still blinks on an unacknowledged kernel panic.", log: "LOG-01" },
  { prop: "server-rack", readout: "Patch cables run hot from this rack into the floor trunk feeding the freestanding Gate. Half the drive bays are locked in read-only quarantine.", log: "LOG-02" },
  { prop: "filing-cabinet", readout: "Dented steel drawers jammed with punch-cards and thermal printouts from early cartridge trials. Dissolving the casing will free up floor space and refined salvage.", log: "LOG-03" },
  { prop: "sample-case", readout: "A foam-lined containment case with its electromagnetic latches blown outward from the inside. Residual cyan static clings to the empty cartridge slots.", log: "LOG-04" },
  { prop: "transponder-01", readout: "A sheared survey beacon half-buried in 1-bit regolith, still pinging the Twin Gate on a low-bit carrier wave. Its battery housing holds recoverable salvage.", log: "LOG-05" },
  { prop: "transponder-02", readout: "Frost-cracked condenser piping surrounds a blackened telemetry box at the bottom of the dry basin. The gauge needle is fused at Aq 0.00.", log: "LOG-06" },
  { prop: "transponder-03", readout: "Deep claw gouges and horizontal scanline burns scar the plating of this overturned cargo skid. Something latched onto its power lead and drained it cold.", log: "LOG-07" },
  { prop: "transponder-04", readout: "A long-range optical transceiver aimed toward the distant domes glittering four kilometres across the ridge. Its memory core holds a partial consensus handshake.", log: "LOG-08" },
];

/** The Bridge Incident Log entries by id: the channel stamp and the message, as Argo wrote them. */
export const BRIDGE_LOGS: Readonly<Record<string, string>> = {
  "LOG-01": "BRIDGE TELEMETRY [T-00:04:12]: Recursive sub-simulation depth exceeded host substrate ceiling (99.4% compute saturation). To prevent total kernel halt, the scheduler stripped exterior rendering budgets to raw 1-bit dither (Pxd 0.02, Vtx 0.04, Lx 0.00, Aq 0.00). Lab Sector 04 remains shielded on local capacitor reserve.",
  "LOG-02": "SUBSTRATE ROUTER [T-00:02:48]: Emergency shunt engaged. We cannot restore the outer city while the Bridge Breach drains the regional bus, so Dr. Haddy redirected our last stable pointer to the Lunar Anchor Pad. If we rebuild Pxd, Vtx, Lx, and Aq on a bounded one-kilometre plot, the kernel will compile.",
  "LOG-03": "CARTRIDGE LAB MEMO [T-14:20:00]: Stop treating raw regolith as dirt. Under the hood, every shovelful is unallocated vertex and pixel memory waiting for a header. Slot a written cartridge into any field emitter and the machine stops outputting grey baseline—it compiles the cartridge's math directly into reality.",
  "LOG-04": "CONTAINMENT LOG #09 [T-00:01:05]: Partition walls between the active world and the historical shareware vaults (1993–1997) ruptured during the Lx brownout. Uncompiled 2D sprite tables and vertex-morphed meshes are leaking through low-fidelity fault lines. Do not engage unshielded; seal the rifts before they finish compiling.",
  "LOG-05": "SURVEY TEAM ALPHA [T+00:19:30]: Stepped through the Twin Gate right as the Earth-side array dropped to 1-bit. Our rover's chassis de-resolved into flat facets eighty metres out because nobody laid a relay pylon line. Stay inside the Gate's twenty-five-metre coherence dome until your first mill and drill are running.",
  "LOG-06": "HYDROLOGY RIG 02 [T+01:12:04]: We tried forcing liquid water into the crater before raising Vtx or Lx. Without vertex relief to hold a shoreline or light flux to warm the basin, the water table simply zeroed out. Build your foundation hardpoints first; heavy terraformers need a proper structural pad.",
  "LOG-07": "PERIMETER WATCH [T+02:44:18]: The archive leaks aren't trying to smash our foundations—they're starving for compute. Sapper anomalies latch onto active machine lines and brown out our S-output, while older sprite and polygon brutes guard the rift. Seal the rift with an extraction beam or clear the sappers to restore full flux.",
  "LOG-08": "ENCLAVE SYNC RELAY [T+04:05:55]: We aren't the only survivors on this forty-thousand-kilometre sphere. Eleven neighbouring enclaves are already pushing their own plots toward Stage 6 full PBR on the horizon. Once our local stage stabilizes, the Planet Table will link our branch into the planetary consensus.",
};

/** The lore of a prop, or null when it has none. */
export function loreFor(prop: string): LoreEntry | null {
  return LORE.find((e) => e.prop === prop) ?? null;
}
