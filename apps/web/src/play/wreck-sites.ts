// The wreck sites on the plot (TASK-23c, TICKET-07 Item F): every leak (TASK-23b-2) sits in a cluster of two to four wasteland props, and four scenery-only
// sites hold clusters with no leak. Pure: the same plot gives the same layout, and the test pins it. The runtime (play/wrecks.ts)
// builds the props and swaps their models.
//
// The owner's junk-model ladder: a leak's junk is broken until it is sealed. Its rung is one below its plot's stage; sealing lifts it
// one rung, to the stage's rung. The rungs: 0 broken junk, 1 our pack, 2 the RUN.world tier, 3 the max tier. A scenery site has no
// break: it stands at its stage's rung.
import { LEAK_SITE_COUNT, MIN_GATE_DISTANCE, leakSites, type Point } from '../monsters/policy';
import { hash32 } from '../monsters/adapter';
import { loreFor } from './lore-logs';

/** Scenery-only sites (no leak), numbered after the leak sites (their index is LEAK_SITE_COUNT and on). */
export const SCENERY_SITE_COUNT = 4;

/** The four lunar wreck transponders (Argo's micro-logs, P0-LORE-01): each on the leak site named, as a packed prop. */
export const TRANSPONDERS: readonly { readonly id: string; readonly model: string; readonly site: number }[] = [
  { id: 'transponder-01', model: 'battery-pack-a', site: 1 },
  { id: 'transponder-02', model: 'terminal-old-a', site: 2 },
  { id: 'transponder-03', model: 'control-box', site: 3 },
  { id: 'transponder-04', model: 'radar-panel-b', site: 4 },
];

/** The wasteland props a cluster adds round its centre (each one a packed model). */
export const NEIGHBOUR_MODELS: readonly string[] = [
  'barrier-block-a', 'drum-square-b', 'container-crushed-a', 'wrecked-truck-cab-c', 'generator-small-a', 'cable-reel-square-a', 'rubble-slab', 'wrecked-van-a',
];

export interface WreckMember {
  readonly model: string;
  /** Position on the plot, metres (y is the ground under it). */
  readonly x: number;
  readonly z: number;
  /** Turn about y, radians. */
  readonly yaw: number;
  /** Tip about the x axis, radians (a tipped prop lies over; 0 stands). */
  readonly tilt: number;
  /** How far the base sinks into the ground, metres (a half-buried transponder). */
  readonly sink: number;
  /** The transponder this prop is (its lore id), when it is one. */
  readonly transponder?: string;
  /** The leak's junk model: the centre of a leak site. */
  readonly junk: boolean;
}

export interface WreckSite {
  /** The leak site index (0 to LEAK_SITE_COUNT - 1), or a scenery site (LEAK_SITE_COUNT and on). */
  readonly index: number;
  /** A leak site: its junk is broken until the leak is sealed. */
  readonly leak: boolean;
  /** The Act IV dormant anomaly (site 0). */
  readonly dormant: boolean;
  readonly x: number;
  readonly z: number;
  readonly members: readonly WreckMember[];
}

export interface SettledWreckPose {
  readonly yaw: number;
  readonly pitch: number;
  readonly roll: number;
  readonly sink: number;
}

export interface WreckInteraction {
  readonly salvage?: {
    readonly item: string;
    readonly n: number;
    readonly secs: number;
  };
  readonly log?: string;
}

/** An integer hash, deterministic in its inputs (the same as the monsters' hash32 family). */
const mix = (a: number, b: number): number => hash32(((a | 0) * 73856093) ^ ((b | 0) * 19349663) ^ 0x51ed27);
const unit = (h: number): number => (h >>> 0) / 4294967296;

function modelSeedHash(model: string, x: number, z: number, seed: number): number {
  let h = seed | 0;
  for (let i = 0; i < model.length; i++) {
    h = mix(h, model.charCodeAt(i));
  }
  h = mix(h, Math.round(x * 100));
  h = mix(h, Math.round(z * 100));
  return h;
}

/**
 * Pure deterministic wreck pose settler (TICKET-07 Item F — VEH-03):
 * Tilts wreck trucks, vans, containers, and props onto the local terrain slope
 * with extra pitch and roll and buries their base (`sink > 0`) so no corner ever floats.
 */
export function settleWreck(
  member: Pick<WreckMember, 'model' | 'x' | 'z'> & { readonly yaw?: number; readonly tilt?: number; readonly sink?: number },
  heightAt: (x: number, z: number) => number,
  seed = 1
): SettledWreckPose {
  const h = modelSeedHash(member.model, member.x, member.z, seed);
  const yaw = member.yaw !== undefined && Number.isFinite(member.yaw)
    ? member.yaw
    : unit(mix(h, 3)) * Math.PI * 2;

  const isVehicleWreck =
    member.model.includes('truck') ||
    member.model.includes('van') ||
    member.model.includes('container');

  // Sample terrain around the footprint along the prop's rotated axes
  const span = isVehicleWreck ? 1.8 : 0.9;
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const hCentre = heightAt(member.x, member.z);
  const hFront = heightAt(member.x + sin * span, member.z + cos * span);
  const hBack = heightAt(member.x - sin * span, member.z - cos * span);
  const hRight = heightAt(member.x + cos * span, member.z - sin * span);
  const hLeft = heightAt(member.x - cos * span, member.z + sin * span);

  const slopePitch = Math.atan2(hBack - hFront, span * 2);
  const slopeRoll = Math.atan2(hLeft - hRight, span * 2);

  const tiltMag = isVehicleWreck ? 0.18 + unit(mix(h, 7)) * 0.18 : 0.08 + unit(mix(h, 7)) * 0.14;
  const rollMag = isVehicleWreck ? 0.14 + unit(mix(h, 11)) * 0.16 : 0.06 + unit(mix(h, 11)) * 0.10;
  const pitchSign = Math.abs(slopePitch) > 0.01 ? Math.sign(slopePitch) : ((mix(h, 13) & 1) === 0 ? 1 : -1);
  const rollSign = Math.abs(slopeRoll) > 0.01 ? Math.sign(slopeRoll) : ((mix(h, 17) & 1) === 0 ? 1 : -1);

  const pitch = Math.max(-0.55, Math.min(0.55, slopePitch + (member.tilt || tiltMag * pitchSign)));
  const roll = Math.max(-0.55, Math.min(0.55, slopeRoll + rollMag * rollSign));

  const minGround = Math.min(hCentre, hFront, hBack, hRight, hLeft);
  const groundDrop = Math.max(0, hCentre - minGround);
  const tiltDrop = Math.abs(Math.sin(pitch)) * span + Math.abs(Math.sin(roll)) * (span * 0.75);
  const baseBurial = isVehicleWreck ? 0.38 : Math.max(0.22, member.sink ?? 0.22);
  const sink = Math.round((groundDrop + tiltDrop + baseBurial) * 1000) / 1000;

  return { yaw, pitch, roll, sink };
}

const WRECK_SALVAGE_TABLE: Readonly<Record<string, { readonly item: string; readonly n: number; readonly secs: number; readonly defaultLog?: string }>> = {
  'wrecked-truck-cab-c': { item: 'prim-chassis', n: 2, secs: 2.0, defaultLog: 'LOG-05' },
  'wrecked-van-a': { item: 'prim-beam', n: 2, secs: 1.8, defaultLog: 'LOG-07' },
  'container-crushed-a': { item: 'prim-cube', n: 2, secs: 1.8 },
  'generator-small-a': { item: 'prim-column', n: 1, secs: 1.5, defaultLog: 'LOG-06' },
  'cable-reel-square-a': { item: 'pxd-mono', n: 12, secs: 1.2 },
  'drum-square-b': { item: 'ore', n: 15, secs: 1.2 },
  'barrier-block-a': { item: 'vtx-rough', n: 8, secs: 1.2 },
  'battery-pack-a': { item: 'pxd-chroma', n: 6, secs: 1.4, defaultLog: 'LOG-05' },
  'terminal-old-a': { item: 'pxd-mono', n: 10, secs: 1.4, defaultLog: 'LOG-06' },
  'control-box': { item: 'vtx-fine', n: 6, secs: 1.4, defaultLog: 'LOG-07' },
  'radar-panel-b': { item: 'pxd-chroma', n: 8, secs: 1.6, defaultLog: 'LOG-08' },
};

/**
 * Pure wreck interaction lookup (TICKET-07 Item F — VEH-03):
 * Returns `{ salvage?: { item, n, secs }; log?: string }` for a `WreckMember`.
 * Wreck trucks and vans provide both hold-E salvage and a readable Bridge Incident Log.
 */
export function wreckInteract(
  member: Pick<WreckMember, 'model'> & { readonly transponder?: string; readonly x?: number; readonly z?: number }
): WreckInteraction {
  const trLore = member.transponder ? loreFor(member.transponder) : null;
  const spec = WRECK_SALVAGE_TABLE[member.model];

  const log = trLore?.log ?? spec?.defaultLog;
  const salvage = spec
    ? { item: spec.item, n: spec.n, secs: spec.secs }
    : member.model !== 'rubble-slab'
      ? { item: 'ore', n: 10, secs: 1.4 }
      : undefined;

  return {
    ...(salvage ? { salvage } : {}),
    ...(log ? { log } : {}),
  };
}

/** Pure: the wreck sites of a plot, from its seed and gate and the leak sites the monsters use (`leakSites(seed, gate)`). */
export function wreckSites(seed: number, gate: Point): WreckSite[] {
  const leaks = leakSites(seed, gate);
  const out: WreckSite[] = [];
  for (const site of leaks) {
    const h = mix(seed + 101, site.index);
    const total = 2 + (h % 3);
    const members: WreckMember[] = [];
    const base = unit(mix(h, 3)) * Math.PI * 2;
    const tr = TRANSPONDERS.find((t) => t.site === site.index);
    members.push({ model: site.junk, x: site.x, z: site.z, yaw: unit(mix(h, 5)) * Math.PI * 2, tilt: 0, sink: 0, junk: true });
    if (tr) {
      const a = base + Math.PI * 0.5;
      members.push({ model: tr.model, x: site.x + Math.cos(a) * 2.4, z: site.z + Math.sin(a) * 2.4, yaw: unit(mix(h, 7)) * Math.PI * 2, tilt: 0.22, sink: 0.25, transponder: tr.id, junk: false });
    }
    const neighbours = total - members.length;
    for (let k = 0; k < neighbours; k++) {
      const a = base + (k * Math.PI * 2) / Math.max(1, neighbours) + unit(mix(h, 11 + k)) * 0.6;
      const r = 3.0 + unit(mix(h, 13 + k)) * 1.8;
      const model = NEIGHBOUR_MODELS[mix(h, 17 + k) % NEIGHBOUR_MODELS.length]!;
      const isTruckOrVan = model.includes('truck') || model.includes('van');
      members.push({
        model,
        x: site.x + Math.cos(a) * r,
        z: site.z + Math.sin(a) * r,
        yaw: unit(mix(h, 19 + k)) * Math.PI * 2,
        tilt: isTruckOrVan ? 0.24 : unit(mix(h, 23 + k)) < 0.3 ? 0.12 : 0,
        sink: isTruckOrVan ? 0.38 : 0,
        junk: false,
      });
    }
    out.push({ index: site.index, leak: true, dormant: site.dormant, x: site.x, z: site.z, members });
  }
  const far = (p: Point, q: Point, d: number): boolean => Math.hypot(p.x - q.x, p.z - q.z) >= d;
  const centres: Point[] = [];
  for (let j = 0; j < SCENERY_SITE_COUNT; j++) {
    for (let attempt = 0; attempt < 64; attempt++) {
      const h = mix(seed + 307 + j * 17, attempt);
      const a = unit(h) * Math.PI * 2;
      const r = 44 + unit(mix(h, 2)) * 70;
      const c = { x: gate.x + Math.cos(a) * r, z: gate.z + Math.sin(a) * r };
      if (!far(c, gate, MIN_GATE_DISTANCE + 8)) continue;
      if (!leaks.every((l) => far(c, l, 28))) continue;
      if (!centres.every((o) => far(c, o, 30))) continue;
      centres.push(c);
      const index = LEAK_SITE_COUNT + j;
      const total = 2 + (mix(h, 29) % 3);
      const members: WreckMember[] = [];
      const base = unit(mix(h, 31)) * Math.PI * 2;
      for (let k = 0; k < total; k++) {
        const ang = base + (k * Math.PI * 2) / total;
        const rr = k === 0 ? 0 : 3.2 + unit(mix(h, 37 + k)) * 1.6;
        const model = NEIGHBOUR_MODELS[mix(h, 41 + k) % NEIGHBOUR_MODELS.length]!;
        const isTruckOrVan = model.includes('truck') || model.includes('van');
        members.push({
          model,
          x: c.x + Math.cos(ang) * rr,
          z: c.z + Math.sin(ang) * rr,
          yaw: unit(mix(h, 43 + k)) * Math.PI * 2,
          tilt: isTruckOrVan ? 0.24 : 0,
          sink: isTruckOrVan ? 0.38 : 0,
          junk: false,
        });
      }
      out.push({ index, leak: false, dormant: false, x: c.x, z: c.z, members });
      break;
    }
  }
  return out;
}

/** The stage's rung: 0 at stage 0, 1 at stages 1 and 2, 2 at 3 and 4, 3 at 5 and 6. */
export function stageRung(stage: number): number {
  const s = Math.floor(stage);
  return s <= 0 ? 0 : s <= 2 ? 1 : s <= 4 ? 2 : 3;
}

/** A site's rung: a leak is one below its stage until it is sealed; a sealed leak and a scenery site stand at the stage's rung. */
export function wreckRung(stage: number, leak: boolean, sealed: boolean): number {
  const top = stageRung(stage);
  return leak && !sealed ? Math.max(0, top - 1) : top;
}

/** A leak's junk reads as broken until its seal. */
export const isBroken = (leak: boolean, sealed: boolean): boolean => leak && !sealed;

/** The model level a rung draws: broken junk and our pack use the low model, the RUN.world tier the mid, the max tier the high. */
export function rungLevel(rung: number): 'low' | 'mid' | 'high' {
  return rung >= 3 ? 'high' : rung === 2 ? 'mid' : 'low';
}

/** Every wreck model the sites use, once each (the preload's list). */
export function wreckModels(sites: readonly WreckSite[]): string[] {
  return [...new Set(sites.flatMap((s) => s.members.map((m) => m.model)))];
}
