import type {
  BaseActions,
  BaseView,
  BaseViewSource,
  BuildView,
  DraftView,
  EquipSlot,
  InventoryView,
  ItemView,
  LatticeView,
  NetworkView,
  PieceKind,
  SlotRef,
  SlotView,
} from './view';
import { EQUIP_SLOTS } from './view';
import type { BaseCommand, BaseEvent, BaseWorld, Point, WorldEnv } from './world';
import { networkAt, relays, PLAYER_KG } from './world';
import {
  blueprint,
  blueprintId,
  DRAFT_ORE,
  ITEMS,
  MAPS,
  MATERIALS,
  PRIMITIVES,
  type MapId,
  type PrimitiveId,
} from './catalog';
import * as L from '@hm/lattice';
import * as S from '@hm/structure';
import type { Kind } from '@hm/structure';

export function toItemView(id: string): ItemView {
  const spec = ITEMS[id];
  if (spec) {
    return {
      id,
      name: spec.name,
      kind: spec.kind,
      tint: spec.tint,
      stack: spec.stack,
      kg: spec.kg,
    };
  }
  return {
    id,
    name: id,
    kind: 'bulk',
    tint: '#94a3b8',
    stack: 100,
    kg: 1,
  };
}

export function formatRefusalToast(event: Extract<BaseEvent, { type: 'refused' }>): string {
  if (event.why === 'short' && event.short && event.short.length > 0) {
    const s = event.short[0]!;
    const name = ITEMS[s.item]?.name ?? s.item;
    return `Missing: ${s.n} ${name}`;
  }
  switch (event.why) {
    case 'no-blueprint':
      return 'No blueprint equipped';
    case 'wrong-kind':
      return 'Cannot build this piece with current blueprint';
    case 'not-empty':
      return 'Empty the bin first';
    case 'would-spill':
      return 'A full bin would fall';
    case 'no-bench':
      return 'Stand at a Drafting Table';
    case 'known':
      return 'Blueprint already known';
    case 'too-heavy':
      return 'Cargo mass exceeded';
    case 'out-of-range':
      return 'Out of network range';
    case 'box-full':
      return 'Storage bin full';
    case 'bad-slot':
      return 'Invalid slot';
    case 'occupied':
      return 'Slot occupied';
    case 'wrong-slot':
      return 'Incompatible equipment slot';
    case 'nothing':
      return 'Nothing to move';
    case 'no-room':
      return 'Inventory full';
    case 'missing':
      return 'Piece not found';
    default:
      return `Action refused: ${event.why}`;
  }
}

export interface WorldViewSourceOptions {
  getWorld(): BaseWorld;
  env: WorldEnv;
  getAt(): Point;
  dispatch(cmd: BaseCommand): void;
  getBuildKind?: () => Kind | null;
  getPreview?: () => { snap: S.Snap | null; cost: readonly L.Stack[]; short: readonly L.Stack[] } | null;
}

export class WorldViewSource implements BaseViewSource {
  private readonly getWorld: () => BaseWorld;
  private readonly env: WorldEnv;
  private readonly getAt: () => Point;
  private readonly dispatchFn: (cmd: BaseCommand) => void;
  private readonly getBuildKind?: () => Kind | null;
  private readonly getPreview?: () => { snap: S.Snap | null; cost: readonly L.Stack[]; short: readonly L.Stack[] } | null;

  private listeners: Set<() => void> = new Set();
  private selectedPrimitive: PrimitiveId | null = 'cube';
  private selectedMap: MapId | null = 'basalt';
  private integrity = false;

  readonly actions: BaseActions;

  constructor(opts: WorldViewSourceOptions) {
    this.getWorld = opts.getWorld;
    this.env = opts.env;
    this.getAt = opts.getAt;
    this.dispatchFn = opts.dispatch;
    this.getBuildKind = opts.getBuildKind;
    this.getPreview = opts.getPreview;

    this.actions = {
      selectHotbar: (index: number) => {
        this.dispatchFn({ t: 'hotbar', index });
        this.notify();
      },
      move: (from: SlotRef, to: SlotRef, n: number) => {
        this.dispatchFn({ t: 'move', at: this.getAt(), from, to, n });
        this.notify();
      },
      quickStack: () => {
        this.dispatchFn({ t: 'quickStack', at: this.getAt() });
        this.notify();
      },
      pickDraft: (primitive: string | null, map: string | null) => {
        const p = primitive ? (primitive.replace(/^prim[-_]/, '') as PrimitiveId) : null;
        const m = map ? (map.replace(/^map[-_]/, '') as MapId) : null;
        this.selectedPrimitive = p && PRIMITIVES.includes(p) ? p : null;
        this.selectedMap = m && MAPS.includes(m) ? m : null;
        this.notify();
      },
      draft: () => {
        if (this.selectedPrimitive && this.selectedMap) {
          this.dispatchFn({
            t: 'draft',
            at: this.getAt(),
            primitive: this.selectedPrimitive,
            map: this.selectedMap,
          });
          this.notify();
        }
      },
      toggleIntegrity: () => {
        this.integrity = !this.integrity;
        this.notify();
      },
    };
  }

  notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private countItemInNetworkOrInv(world: BaseWorld, item: string, netBoxIds: number[]): number {
    const fromPlayer = L.count(world.player, item);
    const totals = L.totals(world.boxes, netBoxIds);
    return fromPlayer + (totals[item] ?? 0);
  }

  private getInventoryView(world: BaseWorld): InventoryView {
    const slots: SlotView[] = world.player.slots.map((s) => ({
      item: s ? toItemView(s.item) : null,
      n: s ? s.n : 0,
    }));

    const equipment = {} as Record<EquipSlot, SlotView>;
    let wornKg = 0;
    for (const k of EQUIP_SLOTS) {
      const eq = world.equipment[k];
      equipment[k] = {
        item: eq ? toItemView(eq.item) : null,
        n: eq ? eq.n : 0,
      };
      if (eq) {
        wornKg += (ITEMS[eq.item]?.kg ?? 0) * eq.n;
      }
    }

    const gridKg = L.kg(world.player, ITEMS);
    const totalKg = Math.round((gridKg + wornKg) * 10) / 10;

    return {
      cols: 9,
      rows: 4,
      slots,
      hotbar: world.hotbar,
      equipment,
      kg: totalKg,
      maxKg: world.player.maxKg || PLAYER_KG,
    };
  }

  private getLatticeView(world: BaseWorld, at: Point): LatticeView {
    const allRelays = relays(world, this.env);
    const groups = L.links([...world.boxes], allRelays);
    const netHereIds = networkAt(world, this.env, at);

    const inRelayRange = allRelays.some(
      (r) => Math.hypot(at.x - r.x, at.z - r.z) <= r.range
    );

    let hereGroupIndex: number | null = null;
    const networks: NetworkView[] = groups.map((boxIds, idx) => {
      const netId = idx + 1;
      const groupSet = new Set(boxIds);
      if (netHereIds.length > 0 && netHereIds.some((id) => groupSet.has(id))) {
        hereGroupIndex = netId;
      }

      const totalsMap = L.totals(world.boxes, boxIds);
      const totals = Object.entries(totalsMap)
        .map(([id, n]) => ({ item: toItemView(id), n }))
        .filter((t) => t.n > 0)
        .sort((a, b) => b.n - a.n);

      return {
        id: netId,
        boxes: boxIds.length,
        relays: allRelays.length,
        totals,
      };
    });

    if (networks.length === 0 && inRelayRange) {
      networks.push({
        id: 1,
        boxes: 0,
        relays: allRelays.length,
        totals: [],
      });
    }

    const here = hereGroupIndex ?? (inRelayRange ? 1 : null);

    return {
      networks,
      here,
    };
  }

  private getDraftView(world: BaseWorld, at: Point): DraftView {
    const netIds = networkAt(world, this.env, at);

    const primitives: SlotView[] = PRIMITIVES.map((p) => {
      const itemId = `prim-${p}`;
      return {
        item: toItemView(itemId),
        n: this.countItemInNetworkOrInv(world, itemId, netIds),
      };
    });

    const maps: SlotView[] = MAPS.map((m) => {
      const itemId = `map-${m}`;
      return {
        item: toItemView(itemId),
        n: this.countItemInNetworkOrInv(world, itemId, netIds),
      };
    });

    let result: DraftView['result'] = null;
    if (this.selectedPrimitive && this.selectedMap) {
      const bpId = blueprintId(this.selectedPrimitive, this.selectedMap);
      const bp = blueprint(bpId);
      const mat = MATERIALS[this.selectedMap];
      const primItem = toItemView(`prim-${this.selectedPrimitive}`);
      const mapItem = toItemView(`map-${this.selectedMap}`);
      const oreItem = toItemView('ore');

      if (bp && mat) {
        result = {
          name: bp.name,
          piece: bp.kinds[0] as PieceKind,
          vKeep: mat.vKeep,
          hKeep: mat.hKeep,
          kg: primItem.kg + mapItem.kg,
          cost: [
            {
              item: primItem,
              n: 1,
              have: this.countItemInNetworkOrInv(world, primItem.id, netIds),
            },
            {
              item: mapItem,
              n: 1,
              have: this.countItemInNetworkOrInv(world, mapItem.id, netIds),
            },
            {
              item: oreItem,
              n: DRAFT_ORE,
              have: this.countItemInNetworkOrInv(world, 'ore', netIds),
            },
          ],
        };
      }
    }

    return {
      primitives,
      maps,
      result,
    };
  }

  private getBuildView(world: BaseWorld): BuildView {
    const activeSlot = world.player.slots[world.hotbar];
    let bpView: BuildView['blueprint'] = null;
    let verdict: BuildView['verdict'] = null;

    if (activeSlot && activeSlot.n > 0) {
      const bp = blueprint(activeSlot.item);
      if (bp) {
        const overrideKind = this.getBuildKind ? this.getBuildKind() : null;
        const currentKind = (overrideKind && bp.kinds.includes(overrideKind)
          ? overrideKind
          : bp.kinds[0]) as PieceKind;

        bpView = {
          id: bp.id,
          name: bp.name,
          piece: currentKind,
        };

        if (this.getPreview) {
          const prev = this.getPreview();
          if (prev && prev.snap) {
            const ok = prev.snap.ok && prev.short.length === 0;
            let why = '';
            if (prev.short.length > 0) {
              why = 'Missing: ' + prev.short.map((s) => `${s.n} ${ITEMS[s.item]?.name ?? s.item}`).join(', ');
            } else if (!prev.snap.ok) {
              why = prev.snap.why;
            }
            const support = prev.snap.mode === 'place' ? prev.snap.support : 1;
            verdict = { ok, why, support };
          }
        }
      }
    }

    return {
      blueprint: bpView,
      verdict,
      integrity: this.integrity,
    };
  }

  get(): BaseView {
    const world = this.getWorld();
    const at = this.getAt();

    return {
      inventory: this.getInventoryView(world),
      lattice: this.getLatticeView(world, at),
      draft: this.getDraftView(world, at),
      build: this.getBuildView(world),
    };
  }
}

export function createWorldViewSource(opts: WorldViewSourceOptions): BaseViewSource {
  return new WorldViewSource(opts);
}
