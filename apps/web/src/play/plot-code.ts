import {
  encode,
  decode,
  LIMITS,
  type Snapshot,
  type SnapMachine,
  type SnapCartridge,
} from '@hm/plotcodec';
import type { PlayState } from './quest';
import type { PlotState, Machine } from '@hm/plotsim';
import type { LabState, Cartridge } from '@hm/cartlab';

function normalizeYaw(yaw: number): number {
  let y = yaw % (2 * Math.PI);
  if (y > Math.PI) y -= 2 * Math.PI;
  if (y < -Math.PI) y += 2 * Math.PI;
  return y;
}

/**
 * Turns a PlayState into a pure Snapshot relative to the gate centre.
 * Returns null if any machine is further than LIMITS.plotRadius (500m) from the gate.
 */
export function snapshotOf(state: PlayState, gate: { readonly x: number; readonly z: number }): Snapshot | null {
  for (const m of state.plot.machines) {
    const rx = m.x - gate.x;
    const rz = m.z - gate.z;
    if (Math.hypot(rx, rz) > LIMITS.plotRadius) {
      return null;
    }
  }

  const snapCartridges: SnapCartridge[] = [];
  const cartridgeIdToIndex = new Map<string, number>();

  for (const m of state.plot.machines) {
    if (m.cartridge && !cartridgeIdToIndex.has(m.cartridge)) {
      const found = state.lab?.cartridges?.find((c) => c.id === m.cartridge);
      if (found) {
        const idx = snapCartridges.length;
        snapCartridges.push({
          name: found.name,
          affinity: {
            pxd: found.affinity.pxd,
            vtx: found.affinity.vtx,
            lx: found.affinity.lx,
            aq: found.affinity.aq,
          },
        });
        cartridgeIdToIndex.set(m.cartridge, idx);
      }
    }
  }

  const snapMachines: SnapMachine[] = state.plot.machines.map((m) => {
    const rx = m.x - gate.x;
    const rz = m.z - gate.z;
    const cartIdx = m.cartridge && cartridgeIdToIndex.has(m.cartridge)
      ? cartridgeIdToIndex.get(m.cartridge)!
      : -1;
    return {
      kind: m.kind,
      x: rx,
      z: rz,
      yaw: normalizeYaw(m.yaw),
      on: m.on,
      cartridge: cartIdx,
    };
  });

  const rawOwner = (state.avatar?.name ?? 'Scientist').trim();
  const owner = rawOwner.length > 0 ? rawOwner.slice(0, 32) : 'Scientist';

  return {
    v: 1,
    owner,
    stage: Math.max(0, Math.min(6, state.plot.stage)),
    time: Math.max(0, state.plot.time ?? 0),
    points: {
      pxd: Math.max(0, state.plot.points?.pxd ?? 0),
      vtx: Math.max(0, state.plot.points?.vtx ?? 0),
      lx: Math.max(0, state.plot.points?.lx ?? 0),
      aq: Math.max(0, state.plot.points?.aq ?? 0),
    },
    machines: snapMachines,
    cartridges: snapCartridges,
  };
}

/**
 * Encodes a plot to a base64url string code.
 * Refuses with a clean error message if the plot cannot be encoded.
 */
export function encodePlot(
  state: PlayState,
  gate: { readonly x: number; readonly z: number },
): { readonly ok: true; readonly code: string } | { readonly ok: false; readonly why: string } {
  const snapshot = snapshotOf(state, gate);
  if (!snapshot) {
    return { ok: false, why: 'A machine is too far from the gate to encode (500 m limit).' };
  }
  try {
    return { ok: true, code: encode(snapshot) };
  } catch (e) {
    return { ok: false, why: e instanceof Error ? e.message : 'Could not encode plot code.' };
  }
}

/**
 * Decodes a base64url plot code. Returns null if invalid or corrupt.
 */
export function decodePlot(code: string): Snapshot | null {
  return decode(code);
}

/**
 * Reconstructs a PlotState and LabState from a Snapshot and planet gate position.
 */
export function plotOfSnapshot(
  snapshot: Snapshot,
  gate: { readonly x: number; readonly z: number },
): { readonly plot: PlotState; readonly lab: LabState } {
  const labCartridges: Cartridge[] = snapshot.cartridges.map((c, i) => ({
    id: `visit-cart-${i}`,
    name: c.name,
    kind: 'preset' as const,
    preset: null,
    from: [],
    affinity: c.affinity,
    slot: null,
  }));

  const machines: Machine[] = snapshot.machines.map((m, i) => {
    const cartId = m.cartridge >= 0 && m.cartridge < labCartridges.length
      ? `visit-cart-${m.cartridge}`
      : null;
    return {
      id: i + 1,
      kind: m.kind,
      x: m.x + gate.x,
      z: m.z + gate.z,
      yaw: m.yaw,
      on: m.on,
      cartridge: cartId,
      built: 0,
    };
  });

  const plot: PlotState = {
    v: 1,
    time: snapshot.time,
    ore: 9999, // Read-only visits have plenty of ore to power running machines
    points: snapshot.points,
    stage: snapshot.stage,
    machines,
    nextId: machines.length + 1,
  };

  const lab: LabState = {
    v: 1,
    time: snapshot.time,
    cartridges: labCartridges,
    bench: null,
    combiner: null,
    nextId: labCartridges.length + 1,
    catalogueUntil: 0,
  };

  return { plot, lab };
}
