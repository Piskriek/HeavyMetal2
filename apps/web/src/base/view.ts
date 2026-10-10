/**
 * The base HUD's contract (docs/BASE_BUILDING_ARCHITECTURE.md section 7).
 *
 * The windows (inventory, hotbar, Drafting Table, lattice storage, build ghost readout) draw only from a `BaseView` and
 * only ask for changes through `BaseActions`. The glue (`world.ts`, Opus) fills the view from @hm/structure, @hm/lattice
 * and @hm/substrate; until those land, the HUD runs on a mock provider. Changing this file is a board conversation.
 */

/** What an item is, for its icon, colour and where it may go. */
export type ItemKind = 'bulk' | 'raw-pxd' | 'raw-vtx' | 'map' | 'primitive' | 'blueprint' | 'tool' | 'weapon' | 'equip';

export interface ItemView {
  readonly id: string;
  readonly name: string;
  readonly kind: ItemKind;
  /** CSS colour of the item's substrate (a map's albedo, a raw pixel's hue). */
  readonly tint: string;
  /** Stack size. */
  readonly stack: number;
  /** Kilograms per unit. */
  readonly kg: number;
}

export interface SlotView {
  readonly item: ItemView | null;
  readonly n: number;
}

export type EquipSlot = 'visor' | 'shield' | 'rebreather' | 'beam' | 'sidearm';
export const EQUIP_SLOTS: readonly EquipSlot[] = ['visor', 'shield', 'rebreather', 'beam', 'sidearm'];

/** The player's own grid. Row 0 (slots 0..8) is the hotbar on keys 1–9 (D5). */
export interface InventoryView {
  readonly cols: 9;
  readonly rows: 4;
  /** cols * rows slots, row-major. */
  readonly slots: readonly SlotView[];
  /** The selected hotbar slot, 0..8. */
  readonly hotbar: number;
  readonly equipment: Readonly<Record<EquipSlot, SlotView>>;
  readonly kg: number;
  readonly maxKg: number;
}

/** One linked storage network (boxes joined through relays and the lab's bridge). */
export interface NetworkView {
  readonly id: number;
  readonly boxes: number;
  readonly relays: number;
  /** Everything stored in the network, largest count first. */
  readonly totals: readonly { readonly item: ItemView; readonly n: number }[];
}

export interface LatticeView {
  readonly networks: readonly NetworkView[];
  /** The network the player stands in (benches here pull from it), or null out of range. */
  readonly here: number | null;
}

/** A Drafting Table recipe: one primitive plus one texture map gives a blueprint for a building piece. */
export interface DraftView {
  readonly primitives: readonly SlotView[];
  readonly maps: readonly SlotView[];
  /** The preview for the current pick, or null until both are picked. */
  readonly result: {
    readonly name: string;
    readonly piece: PieceKind;
    /** Support kept per vertical / horizontal step (0..1): how far it builds. */
    readonly vKeep: number;
    readonly hKeep: number;
    readonly kg: number;
    readonly cost: readonly { readonly item: ItemView; readonly n: number; readonly have: number }[];
  } | null;
}

export type PieceKind = 'foundation' | 'floor' | 'ramp' | 'wall' | 'airlock' | 'pillar' | 'hardpoint' | 'bin' | 'bench' | 'repeater';

/** The build ghost's verdict, under the reticle. */
export interface BuildView {
  /** The blueprint in the hand (from the hotbar), or null when not building. */
  readonly blueprint: { readonly id: string; readonly name: string; readonly piece: PieceKind } | null;
  readonly verdict: {
    readonly ok: boolean;
    /** '' when ok, else a reason code from @hm/structure: occupied, ground, steep, overlap, needs-floor, needs-pad, unsupported, ... */
    readonly why: string;
    /** 0..1, the support the piece would get. */
    readonly support: number;
  } | null;
  /** Build mode shows every piece's support colour. */
  readonly integrity: boolean;
}

export interface BaseView {
  readonly inventory: InventoryView;
  readonly lattice: LatticeView;
  readonly draft: DraftView;
  readonly build: BuildView;
}

/** Where a slot lives, for moves. */
export type SlotRef =
  | { readonly at: 'inventory'; readonly index: number }
  | { readonly at: 'equipment'; readonly slot: EquipSlot }
  | { readonly at: 'box'; readonly box: number; readonly index: number };

/** Everything the HUD may ask for. The glue validates each one; a refusal comes back as the next view's state. */
export interface BaseActions {
  selectHotbar(index: number): void;
  move(from: SlotRef, to: SlotRef, n: number): void;
  /** Valheim's "place stacks": every inventory stack the network already holds goes into it. */
  quickStack(): void;
  pickDraft(primitive: string | null, map: string | null): void;
  /** Make the picked blueprint: pulls its cost from the network in range. */
  draft(): void;
  toggleIntegrity(): void;
}

/** A source of views; the HUD subscribes and re-renders on change. */
export interface BaseViewSource {
  get(): BaseView;
  subscribe(listener: () => void): () => void;
  readonly actions: BaseActions;
}
