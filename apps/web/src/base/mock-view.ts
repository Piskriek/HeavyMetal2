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
  PieceKind,
  SlotRef,
  SlotView,
} from './view';

export const MOCK_ITEMS: Record<string, ItemView> = {
  ore: {
    id: 'ore',
    name: 'Regolith Ore',
    kind: 'bulk',
    tint: '#f59e0b',
    stack: 500,
    kg: 1.0,
  },
  pxd_cyan: {
    id: 'pxd_cyan',
    name: 'Raw Pixel (Cyan [Lx-0])',
    kind: 'raw-pxd',
    tint: '#00f0ff',
    stack: 999,
    kg: 0.01,
  },
  pxd_magenta: {
    id: 'pxd_magenta',
    name: 'Raw Pixel (Magenta [Lx-1])',
    kind: 'raw-pxd',
    tint: '#ff00aa',
    stack: 999,
    kg: 0.01,
  },
  pxd_yellow: {
    id: 'pxd_yellow',
    name: 'Raw Pixel (Solar [Lx-2])',
    kind: 'raw-pxd',
    tint: '#ffd700',
    stack: 999,
    kg: 0.01,
  },
  vtx_quartz: {
    id: 'vtx_quartz',
    name: 'Raw Vertex Spire (Vtx)',
    kind: 'raw-vtx',
    tint: '#e0f7fa',
    stack: 500,
    kg: 0.05,
  },
  map_basalt: {
    id: 'map_basalt',
    name: 'Regolith Basalt Map',
    kind: 'map',
    tint: '#475569',
    stack: 20,
    kg: 0.5,
  },
  map_obsidian: {
    id: 'map_obsidian',
    name: 'Polished Obsidian Map',
    kind: 'map',
    tint: '#1e293b',
    stack: 20,
    kg: 0.5,
  },
  map_quartz: {
    id: 'map_quartz',
    name: 'Reflective Quartz Map',
    kind: 'map',
    tint: '#94a3b8',
    stack: 20,
    kg: 0.5,
  },
  map_moss: {
    id: 'map_moss',
    name: 'Luminescent Moss Map',
    kind: 'map',
    tint: '#10b981',
    stack: 20,
    kg: 0.5,
  },
  prim_cube: {
    id: 'prim_cube',
    name: 'Structural Cube (4m)',
    kind: 'primitive',
    tint: '#64748b',
    stack: 50,
    kg: 2.0,
  },
  prim_col: {
    id: 'prim_col',
    name: 'Cylinder Column (3m)',
    kind: 'primitive',
    tint: '#78716c',
    stack: 50,
    kg: 1.5,
  },
  prim_beam: {
    id: 'prim_beam',
    name: 'Chamfered Beam (4m)',
    kind: 'primitive',
    tint: '#475569',
    stack: 50,
    kg: 1.2,
  },
  prim_frame: {
    id: 'prim_frame',
    name: 'Chassis Frame',
    kind: 'primitive',
    tint: '#3b82f6',
    stack: 20,
    kg: 3.0,
  },
  bp_found_basalt: {
    id: 'bp_found_basalt',
    name: 'Foundation Slab (Basalt)',
    kind: 'blueprint',
    tint: '#38bdf8',
    stack: 10,
    kg: 0.1,
  },
  bp_wall_obsidian: {
    id: 'bp_wall_obsidian',
    name: 'Reinforced Wall (Obsidian)',
    kind: 'blueprint',
    tint: '#818cf8',
    stack: 10,
    kg: 0.1,
  },
  bp_airlock_seal: {
    id: 'bp_airlock_seal',
    name: 'Pressurized Airlock',
    kind: 'blueprint',
    tint: '#34d399',
    stack: 5,
    kg: 0.2,
  },
  tool_beam: {
    id: 'tool_beam',
    name: 'Substrate Extraction Beam',
    kind: 'tool',
    tint: '#00f0ff',
    stack: 1,
    kg: 3.5,
  },
  weap_shotgun: {
    id: 'weap_shotgun',
    name: 'Tactical Combat Shotgun',
    kind: 'weapon',
    tint: '#f59e0b',
    stack: 1,
    kg: 4.2,
  },
  equip_visor: {
    id: 'equip_visor',
    name: 'AR Spectrometer Visor',
    kind: 'equip',
    tint: '#38bdf8',
    stack: 1,
    kg: 1.0,
  },
  equip_shield: {
    id: 'equip_shield',
    name: 'Phase Harmonic Barrier',
    kind: 'equip',
    tint: '#a855f7',
    stack: 1,
    kg: 2.5,
  },
  equip_rebreather: {
    id: 'equip_rebreather',
    name: 'IVA Nitrogen Scrubber',
    kind: 'equip',
    tint: '#14b8a6',
    stack: 1,
    kg: 1.8,
  },
};

const BLUEPRINT_PIECES: Record<string, PieceKind> = {
  bp_found_basalt: 'foundation',
  bp_wall_obsidian: 'wall',
  bp_airlock_seal: 'airlock',
};

export class MockBaseViewSource implements BaseViewSource {
  private listeners: Set<() => void> = new Set();
  private slots: SlotView[] = [];
  private equipment: Record<EquipSlot, SlotView>;
  private hotbarIndex = 0;
  private integrity = false;

  private selectedPrimitive: string | null = null;
  private selectedMap: string | null = null;

  // Box storage mock: Box 0 (Bridge link)
  private networkBoxes: Record<number, SlotView[]> = {
    1: [
      { item: MOCK_ITEMS.ore!, n: 12400 },
      { item: MOCK_ITEMS.pxd_cyan!, n: 3450 },
      { item: MOCK_ITEMS.vtx_quartz!, n: 1820 },
      { item: MOCK_ITEMS.prim_cube!, n: 45 },
      { item: MOCK_ITEMS.map_basalt!, n: 32 },
      { item: MOCK_ITEMS.prim_beam!, n: 18 },
    ],
    2: [
      { item: MOCK_ITEMS.ore!, n: 850 },
      { item: MOCK_ITEMS.pxd_yellow!, n: 400 },
    ],
  };

  constructor() {
    this.slots = Array.from({ length: 36 }, () => ({ item: null, n: 0 }));

    // Initial loadout
    this.slots[0] = { item: MOCK_ITEMS.weap_shotgun!, n: 1 };
    this.slots[1] = { item: MOCK_ITEMS.tool_beam!, n: 1 };
    this.slots[2] = { item: MOCK_ITEMS.bp_found_basalt!, n: 8 };
    this.slots[3] = { item: MOCK_ITEMS.bp_wall_obsidian!, n: 12 };
    this.slots[4] = { item: MOCK_ITEMS.bp_airlock_seal!, n: 2 };
    this.slots[5] = { item: MOCK_ITEMS.ore!, n: 145 };
    this.slots[6] = { item: MOCK_ITEMS.pxd_cyan!, n: 250 };
    this.slots[7] = { item: MOCK_ITEMS.vtx_quartz!, n: 80 };
    this.slots[8] = { item: null, n: 0 };

    this.slots[9] = { item: MOCK_ITEMS.map_basalt!, n: 6 };
    this.slots[10] = { item: MOCK_ITEMS.map_obsidian!, n: 4 };
    this.slots[11] = { item: MOCK_ITEMS.prim_cube!, n: 15 };
    this.slots[12] = { item: MOCK_ITEMS.prim_col!, n: 8 };
    this.slots[13] = { item: MOCK_ITEMS.pxd_magenta!, n: 120 };

    this.equipment = {
      visor: { item: MOCK_ITEMS.equip_visor!, n: 1 },
      shield: { item: MOCK_ITEMS.equip_shield!, n: 1 },
      rebreather: { item: MOCK_ITEMS.equip_rebreather!, n: 1 },
      beam: { item: MOCK_ITEMS.tool_beam!, n: 1 },
      sidearm: { item: null, n: 0 },
    };
  }

  get(): BaseView {
    return {
      inventory: this.getInventoryView(),
      lattice: this.getLatticeView(),
      draft: this.getDraftView(),
      build: this.getBuildView(),
    };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    for (const listener of this.listeners) {
      listener();
    }
  }

  private getInventoryView(): InventoryView {
    let totalKg = 0;
    for (const s of this.slots) {
      if (s.item) totalKg += s.item.kg * s.n;
    }
    for (const key of Object.keys(this.equipment) as EquipSlot[]) {
      const eq = this.equipment[key];
      if (eq?.item) totalKg += eq.item.kg * eq.n;
    }

    return {
      cols: 9,
      rows: 4,
      slots: [...this.slots],
      hotbar: this.hotbarIndex,
      equipment: { ...this.equipment },
      kg: Math.round(totalKg * 10) / 10,
      maxKg: 120.0,
    };
  }

  private getLatticeView(): LatticeView {
    const networks = [
      {
        id: 1,
        boxes: 8,
        relays: 4,
        totals: (this.networkBoxes[1] || []).map((s) => ({ item: s.item!, n: s.n })),
      },
      {
        id: 2,
        boxes: 3,
        relays: 1,
        totals: (this.networkBoxes[2] || []).map((s) => ({ item: s.item!, n: s.n })),
      },
    ];

    return {
      networks,
      here: 1, // in range of lab bridge
    };
  }

  private getDraftView(): DraftView {
    const primitives: SlotView[] = [
      { item: MOCK_ITEMS.prim_cube!, n: this.countItemInInv('prim_cube') },
      { item: MOCK_ITEMS.prim_col!, n: this.countItemInInv('prim_col') },
      { item: MOCK_ITEMS.prim_beam!, n: this.countItemInInv('prim_beam') },
      { item: MOCK_ITEMS.prim_frame!, n: this.countItemInInv('prim_frame') },
    ];

    const maps: SlotView[] = [
      { item: MOCK_ITEMS.map_basalt!, n: this.countItemInInv('map_basalt') },
      { item: MOCK_ITEMS.map_obsidian!, n: this.countItemInInv('map_obsidian') },
      { item: MOCK_ITEMS.map_quartz!, n: this.countItemInInv('map_quartz') },
      { item: MOCK_ITEMS.map_moss!, n: this.countItemInInv('map_moss') },
    ];

    let result = null;
    if (this.selectedPrimitive && this.selectedMap) {
      const prim = MOCK_ITEMS[this.selectedPrimitive];
      const map = MOCK_ITEMS[this.selectedMap];
      if (prim && map) {
        const piece: PieceKind =
          prim.id === 'prim_cube'
            ? 'foundation'
            : prim.id === 'prim_beam'
              ? 'floor'
              : prim.id === 'prim_col'
                ? 'pillar'
                : 'wall';

        const vKeep = map.id === 'map_obsidian' ? 0.95 : map.id === 'map_quartz' ? 0.9 : 0.85;
        const hKeep = map.id === 'map_obsidian' ? 0.7 : map.id === 'map_quartz' ? 0.65 : 0.6;

        result = {
          name: `${prim.name.split(' ')[0]} ${map.name.replace(' Map', '')}`,
          piece,
          vKeep,
          hKeep,
          kg: prim.kg + map.kg,
          cost: [
            { item: prim, n: 1, have: this.countItemInNetworkOrInv(prim.id) },
            { item: map, n: 1, have: this.countItemInNetworkOrInv(map.id) },
            { item: MOCK_ITEMS.ore!, n: 20, have: this.countItemInNetworkOrInv('ore') },
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

  private getBuildView(): BuildView {
    const activeHotbarSlot = this.slots[this.hotbarIndex];
    let blueprint = null;
    let verdict = null;

    if (activeHotbarSlot?.item?.kind === 'blueprint') {
      const piece = BLUEPRINT_PIECES[activeHotbarSlot.item.id] || 'foundation';
      blueprint = {
        id: activeHotbarSlot.item.id,
        name: activeHotbarSlot.item.name,
        piece,
      };

      verdict = {
        ok: true,
        why: '',
        support: 1.0, // Grounded foundation or full support
      };
    }

    return {
      blueprint,
      verdict,
      integrity: this.integrity,
    };
  }

  private countItemInInv(id: string): number {
    let sum = 0;
    for (const s of this.slots) {
      if (s.item?.id === id) sum += s.n;
    }
    return sum;
  }

  private countItemInNetworkOrInv(id: string): number {
    let sum = this.countItemInInv(id);
    const box = this.networkBoxes[1] || [];
    for (const s of box) {
      if (s.item?.id === id) sum += s.n;
    }
    return sum;
  }

  readonly actions: BaseActions = {
    selectHotbar: (index: number) => {
      if (index >= 0 && index <= 8) {
        this.hotbarIndex = index;
        this.notify();
      }
    },

    move: (from: SlotRef, to: SlotRef, count: number) => {
      const getSlot = (ref: SlotRef): SlotView => {
        if (ref.at === 'inventory') return this.slots[ref.index] || { item: null, n: 0 };
        if (ref.at === 'equipment') return this.equipment[ref.slot] || { item: null, n: 0 };
        return { item: null, n: 0 };
      };

      const setSlot = (ref: SlotRef, val: SlotView) => {
        if (ref.at === 'inventory' && ref.index >= 0 && ref.index < this.slots.length) {
          this.slots[ref.index] = val;
        } else if (ref.at === 'equipment') {
          this.equipment[ref.slot] = val;
        }
      };

      const source = getSlot(from);
      const target = getSlot(to);

      if (!source.item || source.n <= 0) return;

      const nToMove = Math.min(count <= 0 ? source.n : count, source.n);

      // Same slot
      if (from.at === to.at && (from as any).index === (to as any).index) return;

      // Merge into target if same item
      if (target.item && target.item.id === source.item.id) {
        const canTake = target.item.stack - target.n;
        const actualMove = Math.min(nToMove, canTake);
        if (actualMove > 0) {
          setSlot(to, { item: target.item, n: target.n + actualMove });
          const rem = source.n - actualMove;
          setSlot(from, rem > 0 ? { item: source.item, n: rem } : { item: null, n: 0 });
          this.notify();
        }
        return;
      }

      // If moving all and target is empty or different, swap
      if (nToMove === source.n) {
        setSlot(to, source);
        setSlot(from, target);
        this.notify();
        return;
      }

      // Partial split into empty slot
      if (!target.item) {
        setSlot(to, { item: source.item, n: nToMove });
        setSlot(from, { item: source.item, n: source.n - nToMove });
        this.notify();
      }
    },

    quickStack: () => {
      const box = this.networkBoxes[1];
      if (!box) return;

      const networkItemIds = new Set(box.map((s) => s.item?.id).filter(Boolean));

      for (let i = 0; i < this.slots.length; i++) {
        const slot = this.slots[i];
        if (slot?.item && networkItemIds.has(slot.item.id)) {
          // Deposit to network
          const existingIdx = box.findIndex((s) => s.item?.id === slot.item!.id);
          if (existingIdx >= 0) {
            const existing = box[existingIdx]!;
            box[existingIdx] = { item: existing.item, n: existing.n + slot.n };
          } else {
            box.push({ item: slot.item, n: slot.n });
          }
          this.slots[i] = { item: null, n: 0 };
        }
      }
      this.notify();
    },

    pickDraft: (prim: string | null, map: string | null) => {
      this.selectedPrimitive = prim;
      this.selectedMap = map;
      this.notify();
    },

    draft: () => {
      const draft = this.getDraftView();
      if (!draft.result) return;

      // Check costs
      for (const c of draft.result.cost) {
        if (c.have < c.n) return; // cannot afford
      }

      // Deduct cost and produce blueprint
      const bpId = `bp_${draft.result.piece}_custom`;
      const bpItem: ItemView = {
        id: bpId,
        name: `${draft.result.name} Blueprint`,
        kind: 'blueprint',
        tint: '#38bdf8',
        stack: 10,
        kg: 0.1,
      };

      // Add to first available inventory slot
      for (let i = 0; i < this.slots.length; i++) {
        if (!this.slots[i]?.item) {
          this.slots[i] = { item: bpItem, n: 1 };
          break;
        }
      }
      this.notify();
    },

    toggleIntegrity: () => {
      this.integrity = !this.integrity;
      this.notify();
    },
  };
}

export const mockBaseViewSource = new MockBaseViewSource();
